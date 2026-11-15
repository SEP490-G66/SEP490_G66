using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Examinations
{
    // OZ-EXAM-19 DeleteDiagnosis
    [Trait("Tab", "OZ-EXAM-19")]
    public class DeleteDiagnosisTests : DiagnosisTestBase
    {
        // UTCID01 (N): a secondary diagnosis is removed, the primary stays
        [Fact]
        public async Task DeleteDiagnosisAsync_ShouldRemoveSecondary()
        {
            var caries = WithCaries();
            _exam.Diagnoses.Add(new ClinicalDiagnosis { Id = 22, ExaminationId = ExaminationId, DiagnosisName = "Viem nuou", CreatedAt = DateTimeOffset.UtcNow });

            var result = await _service.DeleteDiagnosisAsync(DoctorUserId, ExaminationId, 22);

            result.Should().ContainSingle(x => x.Id == 21);
            caries.IsPrimary.Should().BeTrue();
            _examinationRepoMock.Verify(r => r.RemoveDiagnosis(It.Is<ClinicalDiagnosis>(x => x.Id == 22)), Times.Once);
        }

        // UTCID02 (N): removing the primary makes the oldest remaining one primary
        [Fact]
        public async Task DeleteDiagnosisAsync_ShouldMovePrimary_WhenPrimaryRemoved()
        {
            WithCaries();
            var gum = new ClinicalDiagnosis { Id = 22, ExaminationId = ExaminationId, DiagnosisName = "Viem nuou", CreatedAt = DateTimeOffset.UtcNow };
            _exam.Diagnoses.Add(gum);

            await _service.DeleteDiagnosisAsync(DoctorUserId, ExaminationId, 21);

            gum.IsPrimary.Should().BeTrue();
        }

        // UTCID03 (B): removing the only diagnosis leaves none
        [Fact]
        public async Task DeleteDiagnosisAsync_ShouldReturnEmpty_WhenLastRemoved()
        {
            WithCaries();

            var result = await _service.DeleteDiagnosisAsync(DoctorUserId, ExaminationId, 21);

            result.Should().BeEmpty();
        }

        // UTCID04 (A): the diagnosis is not in this examination
        [Fact]
        public async Task DeleteDiagnosisAsync_ShouldThrow_WhenNotFound()
        {
            WithCaries();

            var act = () => _service.DeleteDiagnosisAsync(DoctorUserId, ExaminationId, 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisNotFound);
        }

        // UTCID05 (A): a locked examination
        [Fact]
        public async Task DeleteDiagnosisAsync_ShouldThrow_WhenLocked()
        {
            WithCaries();
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.DeleteDiagnosisAsync(DoctorUserId, ExaminationId, 21);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }

    // OZ-EXAM-20 AddClinicalAddendum
    [Trait("Tab", "OZ-EXAM-20")]
    public class AddClinicalAddendumTests : ExaminationWorkTestBase
    {
        public AddClinicalAddendumTests()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;
            _examinationRepoMock.Setup(r => r.GetAddendaAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<ClinicalRecordAddendum>());
        }

        private static CreateAddendumRequest Addendum(string? type = "Addition", string? content = "Bo sung: benh nhan di ung penicillin", string? original = null) => new()
        {
            AddendumType = type,
            Content = content,
            OriginalContent = original
        };

        // UTCID01 (N): an addition is saved on the locked examination and audited
        [Fact]
        public async Task AddAddendumAsync_ShouldSaveAddition()
        {
            ClinicalRecordAddendum? saved = null;
            _examinationRepoMock.Setup(r => r.AddAddendumAsync(It.IsAny<ClinicalRecordAddendum>(), It.IsAny<CancellationToken>()))
                .Callback<ClinicalRecordAddendum, CancellationToken>((a, _) => saved = a);

            await _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum(type: " addition "));

            saved!.AddendumType.Should().Be(ExaminationConstants.AddendumAddition);
            saved.CreatedByDoctorId.Should().Be(DoctorId);
            _auditLogMock.Verify(a => a.LogAsync(AuditConstants.ExaminationAddendumAdded, AuditConstants.ExaminationEntity, ExaminationId.ToString(),
                It.IsAny<object?>(), It.IsAny<object?>(), It.IsAny<string?>()), Times.Once);
        }

        // UTCID02 (N): a correction keeps the original text
        [Fact]
        public async Task AddAddendumAsync_ShouldSaveCorrectionWithOriginal()
        {
            ClinicalRecordAddendum? saved = null;
            _examinationRepoMock.Setup(r => r.AddAddendumAsync(It.IsAny<ClinicalRecordAddendum>(), It.IsAny<CancellationToken>()))
                .Callback<ClinicalRecordAddendum, CancellationToken>((a, _) => saved = a);

            await _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum(type: "Correction", content: "Rang 36", original: "Rang 46"));

            saved!.AddendumType.Should().Be(ExaminationConstants.AddendumCorrection);
            saved.OriginalContent.Should().Be("Rang 46");
        }

        // UTCID03 (A): an examination not locked yet is edited directly
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenNotLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.InProgress;

            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumOnlyLocked);
        }

        // UTCID04 (A): a type outside the list
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenTypeInvalid()
        {
            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum(type: "Note"));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumTypeInvalid);
        }

        // UTCID05 (A): no content
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenContentMissing()
        {
            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum(content: "  "));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumContentRequired);
        }

        // UTCID06 (B): content one character over the limit
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenContentTooLong()
        {
            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId,
                Addendum(content: new string('a', ExaminationConstants.AddendumContentMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumContentTooLong);
        }

        // UTCID07 (A): a correction without the original text
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenCorrectionWithoutOriginal()
        {
            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId, Addendum(type: "Correction"));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumOriginalRequired);
        }

        // UTCID08 (B): original text one character over the limit
        [Fact]
        public async Task AddAddendumAsync_ShouldThrow_WhenOriginalTooLong()
        {
            var act = () => _service.AddAddendumAsync(DoctorUserId, ExaminationId,
                Addendum(type: "Correction", original: new string('a', ExaminationConstants.AddendumContentMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AddendumOriginalTooLong);
        }
    }
}

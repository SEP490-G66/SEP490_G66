using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Examinations
{
    // OZ-EXAM-14 DeletePrescription
    [Trait("Tab", "OZ-EXAM-14")]
    public class DeletePrescriptionTests : PrescriptionTestBase
    {
        // UTCID01 (N): the draft prescription is removed
        [Fact]
        public async Task DeletePrescriptionAsync_ShouldRemoveDraft()
        {
            WithDraft();

            var result = await _service.DeletePrescriptionAsync(DoctorUserId, ExaminationId);

            result.Items.Should().BeEmpty();
            _exam.Prescriptions.Should().BeEmpty();
            _examinationRepoMock.Verify(r => r.RemovePrescription(It.Is<Prescription>(x => x.Id == 5)), Times.Once);
        }

        // UTCID02 (B): no prescription is not an error
        [Fact]
        public async Task DeletePrescriptionAsync_ShouldDoNothing_WhenNone()
        {
            var result = await _service.DeletePrescriptionAsync(DoctorUserId, ExaminationId);

            result.Id.Should().Be(0);
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (A): a finalized prescription must be reopened first
        [Fact]
        public async Task DeletePrescriptionAsync_ShouldThrow_WhenFinalized()
        {
            WithDraft(PrescriptionConstants.Finalized);

            var act = () => _service.DeletePrescriptionAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionFinalized);
        }
    }

    // OZ-EXAM-15 FinalizePrescription
    [Trait("Tab", "OZ-EXAM-15")]
    public class FinalizePrescriptionTests : PrescriptionTestBase
    {
        // UTCID01 (N): the draft becomes final
        [Fact]
        public async Task FinalizePrescriptionAsync_ShouldFinalizeDraft()
        {
            var prescription = WithDraft();

            var result = await _service.FinalizePrescriptionAsync(DoctorUserId, ExaminationId);

            prescription.Status.Should().Be(PrescriptionConstants.Finalized);
            result.Status.Should().Be(PrescriptionConstants.Finalized);
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (A): no prescription to finalize
        [Fact]
        public async Task FinalizePrescriptionAsync_ShouldThrow_WhenNoPrescription()
        {
            var act = () => _service.FinalizePrescriptionAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionNothingToFinalize);
        }

        // UTCID03 (B): a prescription with no medication
        [Fact]
        public async Task FinalizePrescriptionAsync_ShouldThrow_WhenNoMedication()
        {
            WithDraft().Items.Clear();

            var act = () => _service.FinalizePrescriptionAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionNothingToFinalize);
        }

        // UTCID04 (B): finalizing twice changes nothing
        [Fact]
        public async Task FinalizePrescriptionAsync_ShouldDoNothing_WhenAlreadyFinalized()
        {
            WithDraft(PrescriptionConstants.Finalized);

            var result = await _service.FinalizePrescriptionAsync(DoctorUserId, ExaminationId);

            result.Status.Should().Be(PrescriptionConstants.Finalized);
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID05 (A): a locked examination
        [Fact]
        public async Task FinalizePrescriptionAsync_ShouldThrow_WhenLocked()
        {
            WithDraft();
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.FinalizePrescriptionAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }

    // OZ-EXAM-16 ReopenPrescription
    [Trait("Tab", "OZ-EXAM-16")]
    public class ReopenPrescriptionTests : PrescriptionTestBase
    {
        // UTCID01 (N): a final prescription goes back to draft
        [Fact]
        public async Task ReopenPrescriptionAsync_ShouldReturnToDraft()
        {
            var prescription = WithDraft(PrescriptionConstants.Finalized);

            var result = await _service.ReopenPrescriptionAsync(DoctorUserId, ExaminationId);

            prescription.Status.Should().Be(PrescriptionConstants.Draft);
            result.Status.Should().Be(PrescriptionConstants.Draft);
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (B): a draft stays draft with nothing saved
        [Fact]
        public async Task ReopenPrescriptionAsync_ShouldDoNothing_WhenAlreadyDraft()
        {
            WithDraft();

            await _service.ReopenPrescriptionAsync(DoctorUserId, ExaminationId);

            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (A): a locked examination
        [Fact]
        public async Task ReopenPrescriptionAsync_ShouldThrow_WhenLocked()
        {
            WithDraft(PrescriptionConstants.Finalized);
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.ReopenPrescriptionAsync(DoctorUserId, ExaminationId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }

    // A diagnosis already on the examination: caries (Id 21, primary)
    public abstract class DiagnosisTestBase : ExaminationWorkTestBase
    {
        protected ClinicalDiagnosis WithCaries()
        {
            var diagnosis = new ClinicalDiagnosis
            {
                Id = 21,
                ExaminationId = ExaminationId,
                DiagnosisCode = "K02.1",
                DiagnosisName = "Sau rang",
                IsPrimary = true,
                CreatedAt = DateTimeOffset.UtcNow.AddMinutes(-5)
            };
            _exam.Diagnoses.Add(diagnosis);
            return diagnosis;
        }

        protected static SaveDiagnosisRequest Diagnosis(string? name = "Viem nuou", string? code = "k05.1", string? description = null, bool isPrimary = false) => new()
        {
            DiagnosisName = name,
            DiagnosisCode = code,
            Description = description,
            IsPrimary = isPrimary
        };
    }

    // OZ-EXAM-17 AddDiagnosis
    [Trait("Tab", "OZ-EXAM-17")]
    public class AddDiagnosisTests : DiagnosisTestBase
    {
        // UTCID01 (N): the first diagnosis is primary and its code is upper-cased
        [Fact]
        public async Task AddDiagnosisAsync_ShouldMakeFirstDiagnosisPrimary()
        {
            var result = await _service.AddDiagnosisAsync(DoctorUserId, ExaminationId, Diagnosis(name: " Viem nuou "));

            var diagnosis = _exam.Diagnoses.Single();
            diagnosis.IsPrimary.Should().BeTrue();
            diagnosis.DiagnosisName.Should().Be("Viem nuou");
            diagnosis.DiagnosisCode.Should().Be("K05.1");
            diagnosis.DiagnosedByDoctorId.Should().Be(DoctorId);
            result.Should().ContainSingle();
        }

        // UTCID02 (N): a new primary diagnosis takes over from the old one
        [Fact]
        public async Task AddDiagnosisAsync_ShouldMovePrimary_WhenAskedPrimary()
        {
            var caries = WithCaries();

            await _service.AddDiagnosisAsync(DoctorUserId, ExaminationId, Diagnosis(isPrimary: true));

            caries.IsPrimary.Should().BeFalse();
            _exam.Diagnoses.Single(x => x.DiagnosisName == "Viem nuou").IsPrimary.Should().BeTrue();
        }

        // UTCID03 (N): a second diagnosis not marked primary is secondary
        [Fact]
        public async Task AddDiagnosisAsync_ShouldAddSecondary_WhenNotPrimary()
        {
            var caries = WithCaries();

            var result = await _service.AddDiagnosisAsync(DoctorUserId, ExaminationId, Diagnosis());

            result.Should().HaveCount(2);
            caries.IsPrimary.Should().BeTrue();
            _exam.Diagnoses.Single(x => x.DiagnosisName == "Viem nuou").IsPrimary.Should().BeFalse();
        }

        // UTCID04 (A): no diagnosis name
        [Fact]
        public async Task AddDiagnosisAsync_ShouldThrow_WhenNameMissing()
        {
            var act = () => _service.AddDiagnosisAsync(DoctorUserId, ExaminationId, Diagnosis(name: "  "));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisNameRequired);
        }

        // UTCID05 (B): a name one character over the limit
        [Fact]
        public async Task AddDiagnosisAsync_ShouldThrow_WhenNameTooLong()
        {
            var act = () => _service.AddDiagnosisAsync(DoctorUserId, ExaminationId,
                Diagnosis(name: new string('a', ExaminationConstants.DiagnosisNameMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisNameTooLong);
        }

        // UTCID06 (B): a code one character over the limit
        [Fact]
        public async Task AddDiagnosisAsync_ShouldThrow_WhenCodeTooLong()
        {
            var act = () => _service.AddDiagnosisAsync(DoctorUserId, ExaminationId,
                Diagnosis(code: new string('K', ExaminationConstants.DiagnosisCodeMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisCodeTooLong);
        }

        // UTCID07 (B): a description one character over the limit
        [Fact]
        public async Task AddDiagnosisAsync_ShouldThrow_WhenDescriptionTooLong()
        {
            var act = () => _service.AddDiagnosisAsync(DoctorUserId, ExaminationId,
                Diagnosis(description: new string('a', ExaminationConstants.DiagnosisDescriptionMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisDescriptionTooLong);
        }

        // UTCID08 (A): a locked examination
        [Fact]
        public async Task AddDiagnosisAsync_ShouldThrow_WhenLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.AddDiagnosisAsync(DoctorUserId, ExaminationId, Diagnosis());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }

    // OZ-EXAM-18 UpdateDiagnosis
    [Trait("Tab", "OZ-EXAM-18")]
    public class UpdateDiagnosisTests : DiagnosisTestBase
    {
        // UTCID01 (N): the diagnosis is changed
        [Fact]
        public async Task UpdateDiagnosisAsync_ShouldChangeDiagnosis()
        {
            var caries = WithCaries();

            await _service.UpdateDiagnosisAsync(DoctorUserId, ExaminationId, 21, Diagnosis(description: "Nuou do", isPrimary: true));

            caries.DiagnosisName.Should().Be("Viem nuou");
            caries.DiagnosisCode.Should().Be("K05.1");
            caries.Description.Should().Be("Nuou do");
            caries.IsPrimary.Should().BeTrue();
        }

        // UTCID02 (B): unmarking the only diagnosis keeps it primary
        [Fact]
        public async Task UpdateDiagnosisAsync_ShouldKeepPrimary_WhenOnlyDiagnosisUnmarked()
        {
            var caries = WithCaries();

            await _service.UpdateDiagnosisAsync(DoctorUserId, ExaminationId, 21, Diagnosis(isPrimary: false));

            caries.IsPrimary.Should().BeTrue();
        }

        // UTCID03 (N): marking another diagnosis primary unmarks the old one
        [Fact]
        public async Task UpdateDiagnosisAsync_ShouldMovePrimary_WhenOtherMarked()
        {
            var caries = WithCaries();
            var gum = new ClinicalDiagnosis { Id = 22, ExaminationId = ExaminationId, DiagnosisName = "Viem nuou", CreatedAt = DateTimeOffset.UtcNow };
            _exam.Diagnoses.Add(gum);

            await _service.UpdateDiagnosisAsync(DoctorUserId, ExaminationId, 22, Diagnosis(isPrimary: true));

            caries.IsPrimary.Should().BeFalse();
            gum.IsPrimary.Should().BeTrue();
        }

        // UTCID04 (A): the diagnosis is not in this examination
        [Fact]
        public async Task UpdateDiagnosisAsync_ShouldThrow_WhenNotFound()
        {
            WithCaries();

            var act = () => _service.UpdateDiagnosisAsync(DoctorUserId, ExaminationId, 99, Diagnosis());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisNotFound);
        }

        // UTCID05 (A): no diagnosis name
        [Fact]
        public async Task UpdateDiagnosisAsync_ShouldThrow_WhenNameMissing()
        {
            WithCaries();

            var act = () => _service.UpdateDiagnosisAsync(DoctorUserId, ExaminationId, 21, Diagnosis(name: null));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.DiagnosisNameRequired);
        }
    }
}

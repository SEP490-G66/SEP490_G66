using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Examinations
{
    // A draft prescription of the open examination, with one medication (Amoxicillin, line 11)
    public abstract class PrescriptionTestBase : ExaminationWorkTestBase
    {
        protected Prescription WithDraft(string status = PrescriptionConstants.Draft)
        {
            var prescription = new Prescription { Id = 5, ExaminationId = ExaminationId, Status = status };
            prescription.Items.Add(new PrescriptionItem { Id = 11, MedicationName = "Amoxicillin 500mg", Quantity = 10, SortOrder = 1 });
            _exam.Prescriptions.Add(prescription);
            return prescription;
        }

        protected static SavePrescriptionItemRequest Medication(string? name = "Paracetamol 500mg", int? quantity = 6) => new()
        {
            MedicationName = name,
            Dosage = "1 vien",
            Frequency = "2 lan/ngay",
            Duration = "3 ngay",
            Quantity = quantity,
            Instructions = "Uong sau an"
        };
    }

    // OZ-EXAM-09 GetPrescription
    [Trait("Tab", "OZ-EXAM-09")]
    public class GetPrescriptionTests : PrescriptionTestBase
    {
        // UTCID01 (N): the prescription with its medications
        [Fact]
        public async Task GetPrescriptionAsync_ShouldReturnPrescriptionWithItems()
        {
            WithDraft();

            var result = await _service.GetPrescriptionAsync(DoctorUserId, ExaminationId);

            result.Id.Should().Be(5);
            result.Items.Should().ContainSingle(x => x.MedicationName == "Amoxicillin 500mg");
        }

        // UTCID02 (B): no prescription yet gives an empty draft
        [Fact]
        public async Task GetPrescriptionAsync_ShouldReturnEmptyDraft_WhenNone()
        {
            var result = await _service.GetPrescriptionAsync(DoctorUserId, ExaminationId);

            result.Id.Should().Be(0);
            result.Status.Should().Be(PrescriptionConstants.Draft);
            result.Items.Should().BeEmpty();
        }
    }

    // OZ-EXAM-10 SavePrescriptionNotes
    [Trait("Tab", "OZ-EXAM-10")]
    public class SavePrescriptionNotesTests : PrescriptionTestBase
    {
        // UTCID01 (N): the first note creates the draft prescription
        [Fact]
        public async Task SavePrescriptionNotesAsync_ShouldCreateDraftWithNote()
        {
            var result = await _service.SavePrescriptionNotesAsync(DoctorUserId, ExaminationId, new SavePrescriptionNotesRequest { Notes = " Kieng do lanh " });

            result.Notes.Should().Be("Kieng do lanh");
            _exam.Prescriptions.Should().ContainSingle(x => x.Status == PrescriptionConstants.Draft && x.PrescribedByDoctorId == DoctorId);
        }

        // UTCID02 (B): a note one character over the limit
        [Fact]
        public async Task SavePrescriptionNotesAsync_ShouldThrow_WhenNoteTooLong()
        {
            var act = () => _service.SavePrescriptionNotesAsync(DoctorUserId, ExaminationId,
                new SavePrescriptionNotesRequest { Notes = new string('a', PrescriptionConstants.NotesMaxLength + 1) });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionNotesTooLong);
        }

        // UTCID03 (A): a finalized prescription must be reopened first
        [Fact]
        public async Task SavePrescriptionNotesAsync_ShouldThrow_WhenFinalized()
        {
            WithDraft(PrescriptionConstants.Finalized);

            var act = () => _service.SavePrescriptionNotesAsync(DoctorUserId, ExaminationId, new SavePrescriptionNotesRequest { Notes = "x" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionFinalized);
        }
    }

    // OZ-EXAM-11 AddPrescriptionItem
    [Trait("Tab", "OZ-EXAM-11")]
    public class AddPrescriptionItemTests : PrescriptionTestBase
    {
        // UTCID01 (N): a medication is added after the existing one
        [Fact]
        public async Task AddPrescriptionItemAsync_ShouldAddMedicationAtTheEnd()
        {
            var prescription = WithDraft();

            var result = await _service.AddPrescriptionItemAsync(DoctorUserId, ExaminationId, Medication());

            result.Items.Should().HaveCount(2);
            prescription.Items.Single(x => x.MedicationName == "Paracetamol 500mg").SortOrder.Should().Be(2);
        }

        // UTCID02 (A): no medication name
        [Fact]
        public async Task AddPrescriptionItemAsync_ShouldThrow_WhenNameMissing()
        {
            var act = () => _service.AddPrescriptionItemAsync(DoctorUserId, ExaminationId, Medication(name: "  "));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.MedicationNameRequired);
        }

        // UTCID03 (B): quantity 0 is below the minimum
        [Fact]
        public async Task AddPrescriptionItemAsync_ShouldThrow_WhenQuantityZero()
        {
            var act = () => _service.AddPrescriptionItemAsync(DoctorUserId, ExaminationId, Medication(quantity: 0));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.QuantityInvalid);
        }

        // UTCID04 (B): quantity one over the maximum
        [Fact]
        public async Task AddPrescriptionItemAsync_ShouldThrow_WhenQuantityAboveMaximum()
        {
            var act = () => _service.AddPrescriptionItemAsync(DoctorUserId, ExaminationId, Medication(quantity: PrescriptionConstants.MaxQuantity + 1));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.QuantityInvalid);
        }

        // UTCID05 (A): a finalized prescription
        [Fact]
        public async Task AddPrescriptionItemAsync_ShouldThrow_WhenFinalized()
        {
            WithDraft(PrescriptionConstants.Finalized);

            var act = () => _service.AddPrescriptionItemAsync(DoctorUserId, ExaminationId, Medication());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionFinalized);
        }
    }

    // OZ-EXAM-12 UpdatePrescriptionItem
    [Trait("Tab", "OZ-EXAM-12")]
    public class UpdatePrescriptionItemTests : PrescriptionTestBase
    {
        // UTCID01 (N): the medication line is changed
        [Fact]
        public async Task UpdatePrescriptionItemAsync_ShouldChangeMedication()
        {
            var prescription = WithDraft();

            await _service.UpdatePrescriptionItemAsync(DoctorUserId, ExaminationId, 11, Medication(quantity: 20));

            var item = prescription.Items.Single();
            item.MedicationName.Should().Be("Paracetamol 500mg");
            item.Quantity.Should().Be(20);
        }

        // UTCID02 (A): the line is not in this prescription
        [Fact]
        public async Task UpdatePrescriptionItemAsync_ShouldThrow_WhenItemNotFound()
        {
            WithDraft();

            var act = () => _service.UpdatePrescriptionItemAsync(DoctorUserId, ExaminationId, 99, Medication());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionItemNotFound);
        }

        // UTCID03 (B): a name one character over the limit
        [Fact]
        public async Task UpdatePrescriptionItemAsync_ShouldThrow_WhenNameTooLong()
        {
            WithDraft();

            var act = () => _service.UpdatePrescriptionItemAsync(DoctorUserId, ExaminationId, 11,
                Medication(name: new string('a', PrescriptionConstants.MedicationNameMaxLength + 1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.MedicationNameTooLong);
        }
    }

    // OZ-EXAM-13 DeletePrescriptionItem
    [Trait("Tab", "OZ-EXAM-13")]
    public class DeletePrescriptionItemTests : PrescriptionTestBase
    {
        // UTCID01 (N): the medication line is removed
        [Fact]
        public async Task DeletePrescriptionItemAsync_ShouldRemoveLine()
        {
            var prescription = WithDraft();

            var result = await _service.DeletePrescriptionItemAsync(DoctorUserId, ExaminationId, 11);

            result.Items.Should().BeEmpty();
            prescription.Items.Should().BeEmpty();
            _examinationRepoMock.Verify(r => r.RemovePrescriptionItem(It.Is<PrescriptionItem>(x => x.Id == 11)), Times.Once);
        }

        // UTCID02 (A): the line is not in this prescription
        [Fact]
        public async Task DeletePrescriptionItemAsync_ShouldThrow_WhenItemNotFound()
        {
            WithDraft();

            var act = () => _service.DeletePrescriptionItemAsync(DoctorUserId, ExaminationId, 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionItemNotFound);
        }

        // UTCID03 (A): a finalized prescription
        [Fact]
        public async Task DeletePrescriptionItemAsync_ShouldThrow_WhenFinalized()
        {
            WithDraft(PrescriptionConstants.Finalized);

            var act = () => _service.DeletePrescriptionItemAsync(DoctorUserId, ExaminationId, 11);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.PrescriptionFinalized);
        }
    }
}

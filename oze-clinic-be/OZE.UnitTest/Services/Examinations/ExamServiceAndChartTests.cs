using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Examinations
{
    // Services already on the examination: general exam (line 1) and scaling (line 2)
    public abstract class ExamServiceLinesTestBase : ExaminationWorkTestBase
    {
        protected readonly Service _exam1 = new() { Id = 1, ServiceName = "Kham tong quat", ReferencePrice = 0, EstimatedMinutes = 30, IsActive = true };
        protected readonly Service _scaling = new() { Id = 4, ServiceName = "Cao voi", ReferencePrice = 300000, EstimatedMinutes = 30, IsActive = true };
        protected readonly Service _filling = new() { Id = 5, ServiceName = "Tram rang", ReferencePrice = 500000, EstimatedMinutes = 45, IsActive = true };

        protected ExamServiceLinesTestBase()
        {
            _exam.Appointment.ServiceItems.Add(new AppointmentServiceItem { Id = 1, ServiceId = 1, Service = _exam1 });
            _exam.Appointment.ServiceItems.Add(new AppointmentServiceItem { Id = 2, ServiceId = 4, Service = _scaling, PriceAtBooking = 300000 });
            _examinationRepoMock.Setup(r => r.GetServiceAsync(1, It.IsAny<CancellationToken>())).ReturnsAsync(_exam1);
            _examinationRepoMock.Setup(r => r.GetServiceAsync(4, It.IsAny<CancellationToken>())).ReturnsAsync(_scaling);
            _examinationRepoMock.Setup(r => r.GetServiceAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(_filling);
        }
    }

    // OZ-EXAM-04 UpdateExamService
    [Trait("Tab", "OZ-EXAM-04")]
    public class UpdateExamServiceTests : ExamServiceLinesTestBase
    {
        // UTCID01 (N): the scaling line becomes a filling, with the price and time of the filling
        [Fact]
        public async Task UpdateServiceAsync_ShouldChangeLineAndCopyPrice()
        {
            await _service.UpdateServiceAsync(DoctorUserId, ExaminationId, 2, new SaveExaminationServiceRequest { ServiceId = 5 });

            var line = _exam.Appointment.ServiceItems.Single(x => x.Id == 2);
            line.ServiceId.Should().Be(5);
            line.PriceAtBooking.Should().Be(500000);
            line.DurationMinutes.Should().Be(45);
            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (B): choosing what the line already is changes nothing
        [Fact]
        public async Task UpdateServiceAsync_ShouldDoNothing_WhenSameService()
        {
            await _service.UpdateServiceAsync(DoctorUserId, ExaminationId, 2, new SaveExaminationServiceRequest { ServiceId = 4 });

            _examinationRepoMock.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID03 (A): the line is not in this appointment
        [Fact]
        public async Task UpdateServiceAsync_ShouldThrow_WhenLineNotFound()
        {
            var act = () => _service.UpdateServiceAsync(DoctorUserId, ExaminationId, 99, new SaveExaminationServiceRequest { ServiceId = 5 });

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ServiceItemNotFound);
        }

        // UTCID04 (A): changing to a service that another line already has
        [Fact]
        public async Task UpdateServiceAsync_ShouldThrow_WhenServiceAlreadyOnAnotherLine()
        {
            var act = () => _service.UpdateServiceAsync(DoctorUserId, ExaminationId, 2, new SaveExaminationServiceRequest { ServiceId = 1 });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ServiceAlreadyAdded);
        }
    }

    // OZ-EXAM-05 RemoveExamService
    [Trait("Tab", "OZ-EXAM-05")]
    public class RemoveExamServiceTests : ExamServiceLinesTestBase
    {
        // UTCID01 (N): one of two lines is removed
        [Fact]
        public async Task RemoveServiceAsync_ShouldRemoveLine()
        {
            var result = await _service.RemoveServiceAsync(DoctorUserId, ExaminationId, 2);

            result.Should().ContainSingle();
            _examinationRepoMock.Verify(r => r.RemoveServiceItem(It.Is<AppointmentServiceItem>(x => x.Id == 2)), Times.Once);
        }

        // UTCID02 (A): the line is not in this appointment
        [Fact]
        public async Task RemoveServiceAsync_ShouldThrow_WhenLineNotFound()
        {
            var act = () => _service.RemoveServiceAsync(DoctorUserId, ExaminationId, 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ServiceItemNotFound);
        }

        // UTCID03 (B): the last line cannot be removed
        [Fact]
        public async Task RemoveServiceAsync_ShouldThrow_WhenLastLine()
        {
            _exam.Appointment.ServiceItems.Remove(_exam.Appointment.ServiceItems.Single(x => x.Id == 2));

            var act = () => _service.RemoveServiceAsync(DoctorUserId, ExaminationId, 1);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.CannotRemoveLastService);
        }
    }

    // OZ-EXAM-06 GetDentalChart
    [Trait("Tab", "OZ-EXAM-06")]
    public class GetDentalChartTests : ExaminationWorkTestBase
    {
        // UTCID01 (N): earlier problems of the patient are shown with the changes of this examination
        [Fact]
        public async Task GetDentalChartAsync_ShouldMergeEarlierAndCurrentTeeth()
        {
            _examinationRepoMock.Setup(r => r.GetEarlierChartEntriesAsync(It.IsAny<int>(), It.IsAny<DateTimeOffset>(), It.IsAny<long>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<DentalChartEntry>
                {
                    new() { Id = 1, ToothNumber = "16", Condition = DentalChartConstants.Filled },
                    new() { Id = 2, ToothNumber = "21", Condition = DentalChartConstants.Healthy }
                });
            _exam.DentalChartEntries.Add(new DentalChartEntry { Id = 3, ToothNumber = "36", Condition = DentalChartConstants.Caries });

            var result = await _service.GetDentalChartAsync(DoctorUserId, ExaminationId);

            result.Select(x => (x.ToothNumber, x.Condition, x.RecordedInThisExamination)).Should().Equal(
                ("16", DentalChartConstants.Filled, false), ("36", DentalChartConstants.Caries, true));
        }

        // UTCID02 (B): a patient with no recorded tooth
        [Fact]
        public async Task GetDentalChartAsync_ShouldReturnEmpty_WhenNothingRecorded()
        {
            var result = await _service.GetDentalChartAsync(DoctorUserId, ExaminationId);

            result.Should().BeEmpty();
        }
    }

    // OZ-EXAM-07 SetTooth
    [Trait("Tab", "OZ-EXAM-07")]
    public class SetToothTests : ExaminationWorkTestBase
    {
        // UTCID01 (N): a cavity on tooth 36 is recorded
        [Fact]
        public async Task SetToothAsync_ShouldRecordToothChange()
        {
            var result = await _service.SetToothAsync(DoctorUserId, ExaminationId, "36",
                new SaveToothRequest { Condition = "caries", Surface = "o", Notes = " Sau nga " });

            var entry = _exam.DentalChartEntries.Single();
            entry.Condition.Should().Be(DentalChartConstants.Caries);
            entry.Surface.Should().Be("O");
            entry.Notes.Should().Be("Sau nga");
            result.Should().ContainSingle(x => x.ToothNumber == "36" && x.RecordedInThisExamination);
        }

        // UTCID02 (B): setting a tooth back to how it was, with nothing to add, leaves no change
        [Fact]
        public async Task SetToothAsync_ShouldDropChange_WhenBackToEarlierState()
        {
            _exam.DentalChartEntries.Add(new DentalChartEntry { Id = 3, ToothNumber = "36", Condition = DentalChartConstants.Caries });

            await _service.SetToothAsync(DoctorUserId, ExaminationId, "36", new SaveToothRequest { Condition = DentalChartConstants.Healthy });

            _exam.DentalChartEntries.Should().BeEmpty();
            _examinationRepoMock.Verify(r => r.RemoveChartEntry(It.Is<DentalChartEntry>(x => x.Id == 3)), Times.Once);
        }

        // UTCID03 (A): a condition outside the list
        [Fact]
        public async Task SetToothAsync_ShouldThrow_WhenConditionInvalid()
        {
            var act = () => _service.SetToothAsync(DoctorUserId, ExaminationId, "36", new SaveToothRequest { Condition = "Broken" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ToothConditionInvalid);
        }

        // UTCID04 (A): a tooth number that does not exist in the FDI numbering
        [Fact]
        public async Task SetToothAsync_ShouldThrow_WhenToothNumberInvalid()
        {
            var act = () => _service.SetToothAsync(DoctorUserId, ExaminationId, "99", new SaveToothRequest { Condition = DentalChartConstants.Caries });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ToothNumberInvalid);
        }

        // UTCID05 (B): a surface one character over the limit
        [Fact]
        public async Task SetToothAsync_ShouldThrow_WhenSurfaceTooLong()
        {
            var act = () => _service.SetToothAsync(DoctorUserId, ExaminationId, "36",
                new SaveToothRequest { Condition = DentalChartConstants.Caries, Surface = new string('M', DentalChartConstants.SurfaceMaxLength + 1) });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ToothSurfaceTooLong);
        }
    }

    // OZ-EXAM-08 RemoveToothChange
    [Trait("Tab", "OZ-EXAM-08")]
    public class RemoveToothChangeTests : ExaminationWorkTestBase
    {
        // UTCID01 (N): the change of tooth 36 in this examination is removed
        [Fact]
        public async Task RemoveToothChangeAsync_ShouldRemoveChange()
        {
            _exam.DentalChartEntries.Add(new DentalChartEntry { Id = 3, ToothNumber = "36", Condition = DentalChartConstants.Caries });

            var result = await _service.RemoveToothChangeAsync(DoctorUserId, ExaminationId, "36");

            result.Should().BeEmpty();
            _examinationRepoMock.Verify(r => r.RemoveChartEntry(It.Is<DentalChartEntry>(x => x.Id == 3)), Times.Once);
        }

        // UTCID02 (A): nothing was recorded for that tooth
        [Fact]
        public async Task RemoveToothChangeAsync_ShouldThrow_WhenToothNotRecorded()
        {
            var act = () => _service.RemoveToothChangeAsync(DoctorUserId, ExaminationId, "36");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.ToothNotRecorded);
        }

        // UTCID03 (A): a locked examination
        [Fact]
        public async Task RemoveToothChangeAsync_ShouldThrow_WhenLocked()
        {
            _exam.ExaminationStatus = ExaminationConstants.Locked;

            var act = () => _service.RemoveToothChangeAsync(DoctorUserId, ExaminationId, "36");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.ExaminationMessage.AlreadyLocked);
        }
    }
}

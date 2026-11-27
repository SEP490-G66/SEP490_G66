using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-APPT-20 StaffProxyBooking — lễ tân đặt lịch hộ (BookByReceptionistAsync)
    [Trait("Tab", "OZ-APPT-20")]
    public class StaffProxyBookingTests : BookingFlowTestBase
    {
        public StaffProxyBookingTests()
        {
            _appointmentRepoMock.Setup(r => r.GetPatientByIdAsync(_patient.Id)).ReturnsAsync(_patient);
        }

        private ReceptionBookingRequest ExistingPatientRequest() => Booking(new ReceptionBookingRequest
        {
            PatientId = _patient.Id,
            ServiceId = new List<int>()
        });

        private static ReceptionBookingRequest NewPatientRequest(string? name = "Nguyen Van A", string? phone = Phone) => new()
        {
            FullName = name,
            PhoneNumber = phone,
            Date = Tomorrow,
            SlotStart = new TimeOnly(8, 0),
            DoctorId = DoctorId,
            ServiceId = new List<int>()
        };

        // UTCID01 (N): book for an existing patient → confirmed at once
        [Fact]
        public async Task BookByReceptionistAsync_ShouldConfirm_WhenExistingPatient()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>()))
                .Callback<Appointment>(a => { a.Id = 500; saved = a; })
                .Returns(Task.CompletedTask);

            var result = await _service.BookByReceptionistAsync(ExistingPatientRequest(), "lt");

            result.Id.Should().Be(500);
            saved!.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
            saved.Patient.Should().BeSameAs(_patient);
            _appointmentRepoMock.Verify(r => r.AddPatientAsync(It.IsAny<Patient>()), Times.Never);
        }

        // UTCID02 (N): create a walk-in patient record then book confirmed
        [Fact]
        public async Task BookByReceptionistAsync_ShouldCreatePatientAndConfirm_WhenNewPhone()
        {
            Patient? added = null;
            _appointmentRepoMock.Setup(r => r.AddPatientAsync(It.IsAny<Patient>()))
                .Callback<Patient>(p => { p.Id = 88; added = p; })
                .Returns(Task.CompletedTask);

            var result = await _service.BookByReceptionistAsync(NewPatientRequest(), "lt");

            added.Should().NotBeNull();
            added!.FullName.Should().Be("Nguyen Van A");
            added.PhoneNumber.Should().Be("+84912345678");
            result.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
        }

        // UTCID03 (A): patient id does not exist
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenPatientNotFound()
        {
            _appointmentRepoMock.Setup(r => r.GetPatientByIdAsync(99)).ReturnsAsync((Patient?)null);

            var act = () => _service.BookByReceptionistAsync(
                Booking(new ReceptionBookingRequest { PatientId = 99, ServiceId = new List<int>() }), "lt");

            (await act.Should().ThrowAsync<NotFoundException>())
                .Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientProfileNotFound);
        }

        // UTCID04 (A): new patient without a name
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenNewPatientMissingName()
        {
            var act = () => _service.BookByReceptionistAsync(NewPatientRequest(name: null), "lt");

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(ErrorConstants.AuthMessage.FullNameRequired);
        }

        // UTCID05 (A): new patient with an invalid phone
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenNewPatientBadPhone()
        {
            var act = () => _service.BookByReceptionistAsync(NewPatientRequest(phone: "123"), "lt");

            (await act.Should().ThrowAsync<BadRequestException>())
                .Which.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
        }
    }
}

using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // Shared setup for the booking tests: config, a free doctor shift, a new phone number
    public abstract class BookingFlowTestBase : AppointmentFollowUpTestBase
    {
        protected const string Phone = "0912345678";
        protected static DateOnly Today => DateOnly.FromDateTime(ClinicClock.Today);
        protected static DateOnly Tomorrow => Today.AddDays(1);

        protected BookingFlowTestBase()
        {
            _registrationRepoMock.Setup(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync((ApplicationUser?)null);
            _registrationRepoMock.Setup(r => r.FindUnlinkedPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient>());
            _registrationRepoMock.Setup(r => r.FindPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient>());
            _appointmentRepoMock.Setup(r => r.AddPatientAsync(It.IsAny<Patient>())).Returns(Task.CompletedTask);
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => a.Id = 500).Returns(Task.CompletedTask);
            _appointmentRepoMock.Setup(r => r.SaveChangesAsync()).Returns(Task.CompletedTask);
            _appointmentRepoMock
                .Setup(r => r.ExecuteSerializableAsync(It.IsAny<Func<Task<(Appointment, Patient)>>>()))
                .Returns<Func<Task<(Appointment, Patient)>>>(action => action());
            SetupDoctorShift(Tomorrow, new TimeOnly(8, 0), new TimeOnly(10, 0));
        }

        protected static T Booking<T>(T request, DateOnly? date = null, TimeOnly? slot = null) where T : BookingRequest
        {
            request.Date = date ?? Tomorrow;
            request.SlotStart = slot ?? new TimeOnly(8, 0);
            request.DoctorId = DoctorId;
            return request;
        }
    }

    // OZ-APPT-02 GetAvailableSlots
    [Trait("Tab", "OZ-APPT-02")]
    public class GetAvailableSlotsTests : BookingFlowTestBase
    {
        private static AvailableSlotRequest Query(DateOnly date) => new() { Date = date, DoctorId = DoctorId };

        // UTCID01 (N): a free 08:00-10:00 shift gives four 30-minute slots
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldSplitShiftIntoSlots()
        {
            var result = await _service.GetAvailableSlotsAsync(Query(Tomorrow));

            result.Select(x => x.SlotStart).Should().Equal(new TimeOnly(8, 0), new TimeOnly(8, 30), new TimeOnly(9, 0), new TimeOnly(9, 30));
            result.Should().OnlyContain(x => x.DoctorId == DoctorId);
        }

        // UTCID02 (N): a booked time is left out
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldSkipBookedSlot()
        {
            _appointmentRepoMock.Setup(r => r.GetActiveAppointmentsInRangeAsync(Tomorrow, Tomorrow, It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Appointment> { new() { DoctorId = DoctorId, TimeSlotStart = new TimeOnly(8, 30), TimeSlotEnd = new TimeOnly(9, 0) } });

            var result = await _service.GetAvailableSlotsAsync(Query(Tomorrow));

            result.Select(x => x.SlotStart).Should().Equal(new TimeOnly(8, 0), new TimeOnly(9, 0), new TimeOnly(9, 30));
        }

        // UTCID03 (B): the last day that can be booked (today + 30 days)
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldAllowLastBookableDay()
        {
            var lastDay = Today.AddDays(30);
            SetupDoctorShift(lastDay, new TimeOnly(8, 0), new TimeOnly(9, 0));

            var result = await _service.GetAvailableSlotsAsync(Query(lastDay));

            result.Should().HaveCount(2);
        }

        // UTCID04 (A): a day in the past
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldThrow_WhenDateInPast()
        {
            var act = () => _service.GetAvailableSlotsAsync(Query(Today.AddDays(-1)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PastDate);
        }

        // UTCID05 (A): more than 30 days ahead
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldThrow_WhenDateTooFarAhead()
        {
            var act = () => _service.GetAvailableSlotsAsync(Query(Today.AddDays(31)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.TooFarAhead);
        }
    }

    // OZ-APPT-03 BookAsGuest
    [Trait("Tab", "OZ-APPT-03")]
    public class BookAsGuestTests : BookingFlowTestBase
    {
        private static GuestBookingRequest Guest(string phone = Phone, string? email = null, TimeOnly? slot = null) =>
            Booking(new GuestBookingRequest { FullName = " Nguyen Van A ", PhoneNumber = phone, Email = email }, slot: slot);

        // UTCID01 (N): a new phone gets a new patient record and a PENDING booking
        [Fact]
        public async Task BookAsGuestAsync_ShouldCreatePatientAndPendingAppointment()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            var result = await _service.BookAsGuestAsync(Guest(email: "a@oze.vn"));

            result.Id.Should().Be(500);
            saved!.Status.Should().Be(AppointmentConstants.PendingStatus);
            saved.Patient.FullName.Should().Be("Nguyen Van A");
            saved.TimeSlotStart.Should().Be(new TimeOnly(8, 0));
            _appointmentRepoMock.Verify(r => r.AddPatientAsync(It.IsAny<Patient>()), Times.Once);
        }

        // UTCID02 (A): the phone number is not valid
        [Fact]
        public async Task BookAsGuestAsync_ShouldThrow_WhenPhoneInvalid()
        {
            var act = () => _service.BookAsGuestAsync(Guest(phone: "abc123"));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
        }

        // UTCID03 (A): the email is not valid
        [Fact]
        public async Task BookAsGuestAsync_ShouldThrow_WhenEmailInvalid()
        {
            var act = () => _service.BookAsGuestAsync(Guest(email: "not-an-email"));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AuthMessage.EmailInvalid);
        }

        // UTCID04 (A): the phone already has an account, so the person must sign in
        [Fact]
        public async Task BookAsGuestAsync_ShouldThrow_WhenPhoneHasAccount()
        {
            _registrationRepoMock.Setup(r => r.FindUserByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new ApplicationUser { Id = "user-1" });

            var act = () => _service.BookAsGuestAsync(Guest());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PhoneHasAccount);
        }

        // UTCID05 (A): the chosen time is not a free slot of the doctor
        [Fact]
        public async Task BookAsGuestAsync_ShouldThrow_WhenSlotNotAvailable()
        {
            var act = () => _service.BookAsGuestAsync(Guest(slot: new TimeOnly(13, 0)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.SlotNotAvailable);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID06 (A): the record of this phone is in the middle of a treatment plan, so no new visit
        [Fact]
        public async Task BookAsGuestAsync_ShouldThrow_WhenTreatmentPlanActive()
        {
            _registrationRepoMock.Setup(r => r.FindUnlinkedPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient> { _patient });
            _appointmentRepoMock.Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, null)).ReturnsAsync(false);
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(_patient.Id)).ReturnsAsync(true);

            var act = () => _service.BookAsGuestAsync(Guest());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasActiveTreatmentPlan);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }
    }

    // OZ-APPT-04 BookAsPatient
    [Trait("Tab", "OZ-APPT-04")]
    public class BookAsPatientTests : BookingFlowTestBase
    {
        private const string UserId = "user-patient-15";

        public BookAsPatientTests()
        {
            _appointmentRepoMock.Setup(r => r.GetPatientByUserIdAsync(UserId)).ReturnsAsync(_patient);
            _appointmentRepoMock.Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, null)).ReturnsAsync(false);
        }

        // UTCID01 (N): the signed-in patient books a free slot
        [Fact]
        public async Task BookAsPatientAsync_ShouldCreatePendingAppointmentForPatient()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            var result = await _service.BookAsPatientAsync(Booking(new BookingRequest { Note = " Dau rang " }), UserId);

            result.Id.Should().Be(500);
            saved!.Patient.Should().BeSameAs(_patient);
            saved.Status.Should().Be(AppointmentConstants.PendingStatus);
            saved.Notes.Should().Be("Dau rang");
            _appointmentRepoMock.Verify(r => r.AddPatientAsync(It.IsAny<Patient>()), Times.Never);
        }

        // UTCID02 (A): the account has no patient record
        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenNoPatientProfile()
        {
            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest()), "user-without-profile");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientProfileNotFound);
        }

        // UTCID03 (A): the patient already has an appointment that is not finished
        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenPatientHasUnfinishedAppointment()
        {
            _appointmentRepoMock.Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, null)).ReturnsAsync(true);

            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasUnfinishedAppointment);
        }

        // UTCID04 (A): a day in the past
        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenDateInPast()
        {
            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest(), date: Today.AddDays(-1)), UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PastDate);
        }

        // UTCID05 (A): a service that is turned off cannot be booked
        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenServiceInactive()
        {
            _appointmentRepoMock.Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Service> { new() { Id = 9, ServiceName = "Tay trang", IsActive = false } });

            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest { ServiceId = new List<int> { 9 } }), UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.ServiceInactive);
        }

        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenPhoneNotVerified()
        {
            _userManagerMock
                .Setup(m => m.FindByIdAsync(UserId))
                .ReturnsAsync(new ApplicationUser
                {
                    Id = UserId,
                    PhoneNumber = null,
                    PhoneNumberConfirmed = false
                });

            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PhoneNotVerified);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID07 (A): the patient's treatment plan is being carried out (even with no session date set), so no new visit
        [Fact]
        public async Task BookAsPatientAsync_ShouldThrow_WhenTreatmentPlanActive()
        {
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(_patient.Id)).ReturnsAsync(true);

            var act = () => _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasActiveTreatmentPlan);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID08 (N): a returning patient (one COMPLETED visit) is confirmed at once, no call back needed
        [Fact]
        public async Task BookAsPatientAsync_ShouldConfirmAtOnce_WhenReturningPatient()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(true);

            var result = await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            saved!.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
            result.Status.Should().Be(AppointmentConstants.ConfirmedStatus);
        }

        // UTCID09 (N): a patient who has never come to the clinic still waits for the front desk call
        [Fact]
        public async Task BookAsPatientAsync_ShouldStayPending_WhenNoCompletedVisit()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(false);

            await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            saved!.Status.Should().Be(AppointmentConstants.PendingStatus);
        }

        // UTCID10 (N): a returning patient gets the "confirmed" email, not "the receptionist will call to confirm" (no SMS any more)
        [Fact]
        public async Task BookAsPatientAsync_ShouldSendConfirmedEmail_WhenReturningPatient()
        {
            _patient.Email = "benhnhan@oze.vn";
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(true);

            await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            _emailSenderMock.Verify(s => s.SendEmailAsync(_patient.Email, PatientEmailTemplates.SubjectAppointmentConfirmed, It.IsAny<string>()), Times.Once);
            _emailSenderMock.Verify(s => s.SendEmailAsync(It.IsAny<string>(), PatientEmailTemplates.SubjectAppointmentRequest, It.IsAny<string>()), Times.Never);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID11 (N): a new patient is told by email that the request was received and the receptionist will call
        [Fact]
        public async Task BookAsPatientAsync_ShouldSendRequestReceivedEmail_WhenNewPatient()
        {
            _patient.Email = "benhnhan@oze.vn";
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(false);

            await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            _emailSenderMock.Verify(s => s.SendEmailAsync(_patient.Email, PatientEmailTemplates.SubjectAppointmentRequest, It.IsAny<string>()), Times.Once);
            _smsSenderMock.Verify(s => s.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        // UTCID12 (N): for a returning patient the receptionists are told no call is needed, and the doctor is told at once
        [Fact]
        public async Task BookAsPatientAsync_ShouldNotifyNoCallNeeded_WhenReturningPatient()
        {
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(true);

            await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            _notificationsMock.Verify(n => n.NotifyPatientAsync(_patient.Id,
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.ReturningBookingConfirmedTitle), It.IsAny<CancellationToken>()), Times.Once);
            _notificationsMock.Verify(n => n.NotifyRolesAsync(It.IsAny<IReadOnlyCollection<string>>(),
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.ReturningOnlineBookingTitle), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
            _notificationsMock.Verify(n => n.NotifyRolesAsync(It.IsAny<IReadOnlyCollection<string>>(),
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.NewOnlineBookingTitle), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
            _notificationsMock.Verify(n => n.NotifyStaffAsync(DoctorId, It.IsAny<NotificationContent>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID13 (N): for a new patient the receptionists still get the "call to confirm" task
        [Fact]
        public async Task BookAsPatientAsync_ShouldAskReceptionToCall_WhenNewPatient()
        {
            _appointmentRepoMock.Setup(r => r.HasCompletedVisitAsync(_patient.Id)).ReturnsAsync(false);

            await _service.BookAsPatientAsync(Booking(new BookingRequest()), UserId);

            _notificationsMock.Verify(n => n.NotifyRolesAsync(It.IsAny<IReadOnlyCollection<string>>(),
                It.Is<NotificationContent>(c => c.Title == NotificationConstants.Text.NewOnlineBookingTitle), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Once);
            _notificationsMock.Verify(n => n.NotifyStaffAsync(It.IsAny<int?>(), It.IsAny<NotificationContent>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }

    // OZ-APPT-05 CreateWalkIn
    [Trait("Tab", "OZ-APPT-05")]
    public class CreateWalkInTests : BookingFlowTestBase
    {
        public CreateWalkInTests()
        {
            SetupDoctorShift(Today, TimeOnly.MinValue, TimeOnly.MaxValue);
        }

        private static WalkInRequest WalkIn(string phone = Phone) => new()
        {
            FullName = "Tran Van B",
            PhoneNumber = phone,
            Gender = PatientConstants.Gender.Male,
            DoctorId = DoctorId
        };

        // UTCID01 (N): a new person is registered and checked in at once
        [Fact]
        public async Task CreateWalkInAsync_ShouldCreatePatientAndCheckIn()
        {
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            var result = await _service.CreateWalkInAsync(WalkIn(), "receptionist-1");

            saved!.AppointmentType.Should().Be(AppointmentConstants.WalkInType);
            saved.Status.Should().Be(AppointmentConstants.CheckedInStatus);
            result.RoomId.Should().Be(RoomId);
            result.TimeSlotStart.Should().BeNull();
            _appointmentRepoMock.Verify(r => r.AddPatientAsync(It.IsAny<Patient>()), Times.Once);
        }

        // UTCID02 (N): a phone that already has a record uses that record
        [Fact]
        public async Task CreateWalkInAsync_ShouldReuseExistingPatient()
        {
            _registrationRepoMock.Setup(r => r.FindPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient> { _patient });
            _appointmentRepoMock.Setup(r => r.HasUnfinishedAppointmentAsync(_patient.Id, null)).ReturnsAsync(false);

            var result = await _service.CreateWalkInAsync(WalkIn(), "receptionist-1");

            result.PatientId.Should().Be(_patient.Id);
            _appointmentRepoMock.Verify(r => r.AddPatientAsync(It.IsAny<Patient>()), Times.Never);
        }

        // UTCID03 (A): the existing patient is already in the clinic today (a booking on another day does not block a walk-in)
        [Fact]
        public async Task CreateWalkInAsync_ShouldThrow_WhenPatientAlreadyInClinicToday()
        {
            _registrationRepoMock.Setup(r => r.FindPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient> { _patient });
            _appointmentRepoMock.Setup(r => r.GetPatientAppointmentsOnDateAsync(_patient.Id, Today))
                .ReturnsAsync(new List<Appointment> { new() { Id = 1, PatientId = _patient.Id, AppointmentDate = Today, Status = AppointmentConstants.CheckedInStatus } });

            var act = () => _service.CreateWalkInAsync(WalkIn(), "receptionist-1");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.WalkInPatientInClinic);
        }

        // UTCID06 (A): the existing patient is in the middle of a treatment plan, so no new walk-in visit
        [Fact]
        public async Task CreateWalkInAsync_ShouldThrow_WhenTreatmentPlanActive()
        {
            _registrationRepoMock.Setup(r => r.FindPatientsByPhoneAsync(It.IsAny<IReadOnlyCollection<string>>())).ReturnsAsync(new List<Patient> { _patient });
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(_patient.Id)).ReturnsAsync(true);

            var act = () => _service.CreateWalkInAsync(WalkIn(), "receptionist-1");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasActiveTreatmentPlan);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID04 (A): the phone number is not valid
        [Fact]
        public async Task CreateWalkInAsync_ShouldThrow_WhenPhoneInvalid()
        {
            var act = () => _service.CreateWalkInAsync(WalkIn("123"), "receptionist-1");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AuthMessage.InvalidPhone);
        }

        // UTCID05 (A): the doctor has no shift today
        [Fact]
        public async Task CreateWalkInAsync_ShouldThrow_WhenDoctorHasNoShiftToday()
        {
            _appointmentRepoMock.Setup(r => r.GetDoctorShiftsInRangeAsync(Today, Today, DoctorId)).ReturnsAsync(new List<StaffSchedule>());

            var act = () => _service.CreateWalkInAsync(WalkIn(), "receptionist-1");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.DoctorNoSuitableShiftToday);
        }
    }

    // OZ-APPT-06 GetAppointments
    [Trait("Tab", "OZ-APPT-06")]
    public class GetAppointmentsTests : BookingFlowTestBase
    {
        private Appointment Item(long id) => new()
        {
            Id = id,
            PatientId = _patient.Id,
            Patient = _patient,
            DoctorId = DoctorId,
            AppointmentDate = Tomorrow,
            TimeSlotStart = new TimeOnly(8, 0),
            Status = AppointmentConstants.PendingStatus
        };

        // UTCID01 (N): one page of appointments with the paging numbers
        [Fact]
        public async Task GetAppointmentsAsync_ShouldMapPage()
        {
            var query = new AppointmentQueryParameters { PageNumber = 2, PageSize = 2 };
            _appointmentRepoMock.Setup(r => r.GetAppointmentsAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PagedResult<Appointment>(new List<Appointment> { Item(1), Item(2) }, 12, 2, 2));

            var result = await _service.GetAppointmentsAsync(query);

            result.Items.Select(x => x.Id).Should().Equal(1, 2);
            result.TotalCount.Should().Be(12);
            result.PageNumber.Should().Be(2);
            result.Items[0].PatientName.Should().Be(_patient.FullName);
        }

        // UTCID02 (B): no appointment matches
        [Fact]
        public async Task GetAppointmentsAsync_ShouldReturnEmptyPage_WhenNothingMatches()
        {
            var query = new AppointmentQueryParameters();
            _appointmentRepoMock.Setup(r => r.GetAppointmentsAsync(query, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new PagedResult<Appointment>(new List<Appointment>(), 0, 1, 10));

            var result = await _service.GetAppointmentsAsync(query);

            result.Items.Should().BeEmpty();
            result.TotalCount.Should().Be(0);
        }
    }

    // OZ-APPT-22 BookByReceptionist: a patient in the middle of a treatment plan gets only its sessions
    [Trait("Tab", "OZ-APPT-22")]
    public class ReceptionBookingTreatmentPlanTests : BookingFlowTestBase
    {
        private const long StageId = 7;

        public ReceptionBookingTreatmentPlanTests()
        {
            _appointmentRepoMock.Setup(r => r.GetPatientByIdAsync(_patient.Id)).ReturnsAsync(_patient);
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(_patient.Id)).ReturnsAsync(true);
        }

        private ReceptionBookingRequest Request(long? stageId = null) =>
            Booking(new ReceptionBookingRequest { PatientId = _patient.Id, TreatmentPlanStageId = stageId });

        // UTCID01 (A): a new visit for a patient whose plan is running is refused
        [Fact]
        public async Task BookByReceptionistAsync_ShouldThrow_WhenTreatmentPlanActive()
        {
            var act = () => _service.BookByReceptionistAsync(Request(), "receptionist-1");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.PatientHasActiveTreatmentPlan);
            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Never);
        }

        // UTCID02 (N): the next session of that plan can be booked
        [Fact]
        public async Task BookByReceptionistAsync_ShouldBookPlanSession_WhenTreatmentPlanActive()
        {
            var plan = new TreatmentPlan { Id = 3, PatientId = _patient.Id, Status = TreatmentPlanConstants.InProgress };
            var stage = new TreatmentPlanStage { Id = StageId, StageNumber = 2, StageName = "Buoi 2", StageStatus = TreatmentPlanConstants.StageStatus.Scheduled, TreatmentPlan = plan };
            plan.Stages = new List<TreatmentPlanStage> { stage };
            _appointmentRepoMock.Setup(r => r.GetTreatmentStageAsync(StageId)).ReturnsAsync(stage);
            Appointment? saved = null;
            _appointmentRepoMock.Setup(r => r.AddAsync(It.IsAny<Appointment>())).Callback<Appointment>(a => { a.Id = 500; saved = a; }).Returns(Task.CompletedTask);

            await _service.BookByReceptionistAsync(Request(StageId), "receptionist-1");

            saved.Should().NotBeNull();
            saved!.TreatmentPlanStageId.Should().Be(StageId);
        }

        // UTCID03 (N): once the plan is cancelled (no plan running) the patient can book a new visit
        [Fact]
        public async Task BookByReceptionistAsync_ShouldBook_WhenNoTreatmentPlanActive()
        {
            _appointmentRepoMock.Setup(r => r.HasActiveTreatmentPlanAsync(_patient.Id)).ReturnsAsync(false);

            await _service.BookByReceptionistAsync(Request(), "receptionist-1");

            _appointmentRepoMock.Verify(r => r.AddAsync(It.IsAny<Appointment>()), Times.Once);
        }
    }
}

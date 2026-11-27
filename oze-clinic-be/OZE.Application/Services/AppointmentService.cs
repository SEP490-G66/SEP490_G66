using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class AppointmentService : IAppointmentService
    {
        private readonly IAppointmentRepository _appointmentRepository;
        private readonly IRegistrationRepository _registrationRepository;
        private readonly IServiceRepository _serviceRepository;
        private readonly ISmsSender _smsSender;
        private readonly IEmailSender _emailSender;
        private readonly IAuditLogService _auditLogService;
        private readonly ILogger<AppointmentService> _logger;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IQueueService? _queueService;
        private readonly IInvoiceRepository? _invoiceRepository;
        private readonly IInstallmentRepository? _installmentRepository;
        private readonly INotificationService? _notifications;

        public AppointmentService(
            IAppointmentRepository appointmentRepository,
            IRegistrationRepository registrationRepository,
            IServiceRepository serviceRepository,
            ISmsSender smsSender,
            IEmailSender emailSender,
            IAuditLogService auditLogService,
            ILogger<AppointmentService> logger,
            UserManager<ApplicationUser> userManager,
            IQueueService? queueService = null,
            IInvoiceRepository? invoiceRepository = null,
            IInstallmentRepository? installmentRepository = null,
            INotificationService? notifications = null)
        {
            _appointmentRepository = appointmentRepository;
            _registrationRepository = registrationRepository;
            _serviceRepository = serviceRepository;
            _smsSender = smsSender;
            _emailSender = emailSender;
            _auditLogService = auditLogService;
            _logger = logger;
            _userManager = userManager;
            _queueService = queueService;
            _invoiceRepository = invoiceRepository;
            _installmentRepository = installmentRepository;
            _notifications = notifications;
        }

        public async Task<List<BookableServiceResponse>> GetBookableServicesAsync()
        {
            var examServiceCode = await GetStringConfigAsync(ConfigKeyConstants.GeneralExamServiceCode);
            var services = await _appointmentRepository.GetBookableServicesAsync();

            return services
                .Select(s => new BookableServiceResponse
                {
                    ServiceId = s.Id,
                    ServiceName = s.ServiceName,
                    Description = s.Description,
                    ReferencePrice = s.ReferencePrice,
                    EstimatedMinutes = s.EstimatedMinutes,
                    IsMandatory = s.ServiceCode == examServiceCode,
                    Variants = s.Variants.Select(v => new BookableVariantResponse
                    {
                        VariantId = v.Id,
                        VariantName = v.VariantName,
                        Description = v.Description,
                        ReferencePrice = v.ReferencePrice,
                        EstimatedMinutes = v.EstimatedMinutes
                    }).ToList()
                })
                .ToList();
        }

        public async Task<List<AvailableSlotResponse>> GetAvailableSlotsAsync(AvailableSlotRequest request)
        {
            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);
            return await FindSlotsAsync(lines, request.Date!.Value, request.DoctorId);
        }

        public async Task<List<AvailableDayResponse>> GetAvailableDaysAsync(AvailableDaysRequest request)
        {
            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);
            return await FindDaysAsync(lines, request.From!.Value, request.To!.Value, request.DoctorId);
        }

        public async Task<AppointmentResponse> BookAsGuestAsync(GuestBookingRequest request)
        {
            ConditionGuard.Ensure(PhoneNumberHelper.TryNormalize(request.PhoneNumber, out var phone),
                ErrorConstants.AuthMessage.InvalidPhone);

            var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
            ConditionGuard.ThrowIf(email != null && (email.Length > 256 || !new EmailAddressAttribute().IsValid(email)),
                ErrorConstants.AuthMessage.EmailInvalid);

            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);
            var phoneVariants = PhoneNumberHelper.GetLookupVariants(phone);

            // AC4: a phone that belongs to an account must sign in instead
            var user = await _registrationRepository.FindUserByPhoneAsync(phoneVariants);
            ConditionGuard.ThrowIf(user != null, ErrorConstants.AppointmentMessage.PhoneHasAccount);

            var (appointment, patient, slot) = await CreateBookingAsync(lines, request.Date!.Value, request.SlotStart!.Value,
                request.DoctorId, request.Note, null, async () =>
                {
                    // AC6: reuse the walk-in record of this phone, or create a new one
                    var patients = await _registrationRepository.FindUnlinkedPatientsByPhoneAsync(phoneVariants);
                    ConditionGuard.ThrowIf(patients.Count > 1, ErrorConstants.AuthMessage.MultiplePatientRecords);

                    var patient = patients.FirstOrDefault();
                    if (patient == null)
                    {
                        patient = new Patient
                        {
                            PatientCode = GeneratePatientCode(),
                            FullName = request.FullName.Trim(),
                            PhoneNumber = phone,
                            Email = email,
                            CreatedAt = DateTimeOffset.UtcNow
                        };
                        await _appointmentRepository.AddPatientAsync(patient);
                    }

                    return patient;
                }, selfBooking: true);

            await SendBookingEmailAsync(appointment, email, patient.FullName, lines.Select(l => l.DisplayName), confirmed: false);
            await NotifyNewOnlineBookingAsync(appointment, patient);
            await LogCreatedAsync(appointment, lines);
            return ToResponse(appointment, patient, slot, lines);
        }

        public async Task<AppointmentResponse> BookAsPatientAsync(BookingRequest request, string userId)
        {
            await EnsurePatientPhoneVerifiedAsync(userId);

            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);

            // The patient comes from the token, never from the request
            var existing = await _appointmentRepository.GetPatientByUserIdAsync(userId);
            ConditionGuard.Ensure<NotFoundException>(existing != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);

            // A returning patient (came to the clinic at least once) books with a verified phone, so the front desk
            // has nothing to check: the booking is CONFIRMED at once. A new patient still waits for the call back
            var returning = await _appointmentRepository.HasCompletedVisitAsync(existing!.Id);
            var initialStatus = returning ? AppointmentConstants.ConfirmedStatus : AppointmentConstants.PendingStatus;

            var (appointment, patient, slot) = await CreateBookingAsync(lines, request.Date!.Value, request.SlotStart!.Value,
                request.DoctorId, request.Note, userId, () => Task.FromResult(existing!),
                initialStatus: initialStatus, selfBooking: true);

            // A confirmed booking must not say "the receptionist will call to confirm"
            await SendBookingEmailAsync(appointment, patient.Email, patient.FullName, lines.Select(l => l.DisplayName), confirmed: returning);

            if (returning)
            {
                await NotifyReturningOnlineBookingAsync(appointment, patient);
            }
            else
            {
                await NotifyNewOnlineBookingAsync(appointment, patient);
            }
            await LogCreatedAsync(appointment, lines, autoConfirmed: returning);
            return ToResponse(appointment, patient, slot, lines);
        }

        // F-APT-09: the receptionist books for a known patient, or for a new one by phone, and the booking is CONFIRMED at once
        // (the receptionist is already talking to the patient, so there is nobody to call back)
        public async Task<AppointmentResponse> BookByReceptionistAsync(ReceptionBookingRequest request, string receptionistUserId)
        {
            Patient? known = null;
            string? phone = null;
            string? email = null;
            if (request.PatientId.HasValue)
            {
                known = await _appointmentRepository.GetPatientByIdAsync(request.PatientId.Value);
                ConditionGuard.Ensure<NotFoundException>(known != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);
            }
            else
            {
                ConditionGuard.Ensure(!string.IsNullOrWhiteSpace(request.FullName), ErrorConstants.AuthMessage.FullNameRequired);
                ConditionGuard.Ensure(PhoneNumberHelper.TryNormalize(request.PhoneNumber, out var normalized), ErrorConstants.AuthMessage.InvalidPhone);
                phone = normalized;
                email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
                ConditionGuard.ThrowIf(email != null && !new EmailAddressAttribute().IsValid(email), ErrorConstants.AuthMessage.EmailInvalid);
            }

            // Basic details for a new record; an existing record is never overwritten
            ConditionGuard.Ensure(PatientConstants.Gender.TryNormalize(request.Gender, out var gender), ErrorConstants.PatientMessage.InvalidGender);
            ConditionGuard.Ensure(request.DateOfBirth == null || request.DateOfBirth.Value <= DateOnly.FromDateTime(ClinicClock.Today),
                ErrorConstants.PatientMessage.InvalidDateOfBirth);
            var address = string.IsNullOrWhiteSpace(request.Address) ? null : request.Address.Trim();

            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);
            var (appointment, patient, slot) = await CreateBookingAsync(lines, request.Date!.Value, request.SlotStart!.Value,
                request.DoctorId, request.Note, receptionistUserId, async () =>
                {
                    if (known != null)
                    {
                        return known;
                    }

                    // The phone of an account: book for the patient of that account
                    var variants = PhoneNumberHelper.GetLookupVariants(phone!);
                    var user = await _registrationRepository.FindUserByPhoneAsync(variants);
                    if (user != null)
                    {
                        var linked = await _appointmentRepository.GetPatientByUserIdAsync(user.Id);
                        ConditionGuard.Ensure<NotFoundException>(linked != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);
                        return linked!;
                    }

                    var patients = await _registrationRepository.FindUnlinkedPatientsByPhoneAsync(variants);
                    ConditionGuard.ThrowIf(patients.Count > 1, ErrorConstants.AuthMessage.MultiplePatientRecords);
                    var patient = patients.FirstOrDefault();
                    if (patient == null)
                    {
                        patient = new Patient
                        {
                            PatientCode = GeneratePatientCode(),
                            FullName = request.FullName!.Trim(),
                            PhoneNumber = phone,
                            Email = email,
                            Gender = gender,
                            DateOfBirth = request.DateOfBirth,
                            Address = address,
                            CreatedAt = DateTimeOffset.UtcNow
                        };
                        await _appointmentRepository.AddPatientAsync(patient);
                    }

                    return patient;
                }, initialStatus: AppointmentConstants.ConfirmedStatus);

            await SendBookingEmailAsync(appointment, patient.Email, patient.FullName, lines.Select(l => l.DisplayName), confirmed: true);
            await NotifyAsync(n => n.NotifyPatientAsync(patient.Id, Content(NotificationConstants.Text.AppointmentBookedByClinicTitle, NotificationConstants.Text.AppointmentBookedByClinicMessage, appointment)));
            await NotifyDoctorOfNewAppointmentAsync(appointment, patient.FullName);
            await LogCreatedAsync(appointment, lines);
            return ToResponse(appointment, patient, slot, lines);
        }

        // Booking email to the patient: "confirmed" when the visit is CONFIRMED, otherwise "request received, we will call".
        // The appointment is already saved, so a failed email is only logged and never undoes it
        private async Task SendBookingEmailAsync(
            Appointment appointment, string? email, string? patientName, IEnumerable<string?> serviceNames, bool confirmed)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                return;
            }

            var services = string.Join(", ", serviceNames);
            var message = confirmed
                ? PatientEmailTemplates.AppointmentConfirmed(patientName, services, appointment.AppointmentDate, appointment.TimeSlotStart)
                : PatientEmailTemplates.AppointmentRequest(patientName, services, appointment.AppointmentDate, appointment.TimeSlotStart);
            var subject = confirmed
                ? PatientEmailTemplates.SubjectAppointmentConfirmed
                : PatientEmailTemplates.SubjectAppointmentRequest;
            try
            {
                await _emailSender.SendEmailAsync(email, subject, message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not send the booking email for appointment {AppointmentId}", appointment.Id);
            }
        }

        // Confirmation email for an existing appointment (confirmed by the receptionist, rescheduled, follow-up)
        private Task SendConfirmationEmailAsync(Appointment appointment) =>
            SendBookingEmailAsync(appointment, appointment.Patient?.Email, appointment.Patient?.FullName,
                appointment.ServiceItems.Select(i => i.Variant == null
                    ? i.Service?.ServiceName
                    : $"{i.Service?.ServiceName} - {i.Variant.VariantName}"),
                confirmed: true);

        // Re-checks the slot and saves the appointment in one serializable transaction;
        // getPatientAsync runs inside it so a new patient record is saved together with the appointment
        private async Task<(Appointment Appointment, Patient Patient, AvailableSlotResponse Slot)> CreateBookingAsync(
            List<BookingLine> lines, DateOnly date, TimeOnly slotStart, int? doctorId, string? note,
            string? createdByUserId, Func<Task<Patient>> getPatientAsync, long? excludeAppointmentId = null, long? parentAppointmentId = null,
            string initialStatus = AppointmentConstants.PendingStatus, bool selfBooking = false)
        {
            var slotMinutes = await GetIntConfigAsync(ConfigKeyConstants.SlotDurationMinutes);

            return await _appointmentRepository.ExecuteSerializableAsync(async () =>
            {
                // Re-check inside the transaction; never trust the slot sent by the client
                var candidates = (await FindSlotsAsync(lines, date, doctorId))
                    .Where(x => x.SlotStart == slotStart)
                    .ToList();
                ConditionGuard.Ensure(candidates.Count > 0, ErrorConstants.AppointmentMessage.SlotNotAvailable);

                var chosen = doctorId.HasValue ? candidates[0] : await PickLeastBusyAsync(candidates, date);
                var patient = await getPatientAsync();

                // One appointment at a time: the earlier one must be completed, cancelled or marked NO_SHOW first.
                // A patient without a record yet (Id 0) cannot have one.
                if (patient.Id != 0)
                {
                    ConditionGuard.ThrowIf(await _appointmentRepository.HasUnfinishedAppointmentAsync(patient.Id, excludeAppointmentId),
                        ErrorConstants.AppointmentMessage.PatientHasUnfinishedAppointment);

                    // The clinic keeps one booking at a time: a patient whose treatment plan already has a session
                    // scheduled cannot book online on top of it; the front desk arranges such visits
                    if (selfBooking)
                    {
                        ConditionGuard.ThrowIf(await _appointmentRepository.HasUpcomingTreatmentSessionAsync(patient.Id),
                            ErrorConstants.AppointmentMessage.PatientHasScheduledTreatmentSession);
                    }
                }

                var appointment = new Appointment
                {
                    Patient = patient,
                    DoctorId = chosen.DoctorId,
                    AppointmentType = AppointmentConstants.BookedType,
                    AppointmentDate = date,
                    TimeSlotStart = chosen.SlotStart,
                    TimeSlotEnd = chosen.SlotEnd,
                    // The slot is held, but the receptionist must confirm the booking before it is approved
                    // (a booking made by the receptionist is confirmed at once)
                    Status = initialStatus,
                    Notes = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
                    ParentAppointmentId = parentAppointmentId,
                    CreatedAt = DateTimeOffset.UtcNow,
                    CreatedByUserId = createdByUserId,
                    // Saved together with the appointment in the same transaction
                    ServiceItems = lines.Select(l => new AppointmentServiceItem
                    {
                        ServiceId = l.Service.Id,
                        VariantId = l.Variant?.Id,
                        DurationMinutes = l.GetMinutes(slotMinutes),
                        PriceAtBooking = l.Price,
                        CreatedAt = DateTimeOffset.UtcNow
                    }).ToList()
                };
                await _appointmentRepository.AddAsync(appointment);
                await _appointmentRepository.SaveChangesAsync();

                return (appointment, patient, chosen);
            });
        }

        // Splits each doctor shift into slots and keeps the ones that are free and not too soon
        // excludeAppointmentId: the appointment being rescheduled, so it does not block its own new time
        private async Task<List<AvailableSlotResponse>> FindSlotsAsync(List<BookingLine> lines, DateOnly date, int? doctorId, long? excludeAppointmentId = null)
        {
            var rules = await LoadSlotRulesAsync(lines);
            ConditionGuard.Ensure(date >= rules.Today, ErrorConstants.AppointmentMessage.PastDate);
            ConditionGuard.Ensure(date <= rules.LastDay, ErrorConstants.AppointmentMessage.TooFarAhead);

            // Only shifts in the kind of room the services need (a general treatment room when they ask for none)
            var shifts = (await _appointmentRepository.GetDoctorShiftsInRangeAsync(date, date, doctorId))
                .Where(x => x.Room!.RoomType == rules.RequiredRoomType)
                .ToList();

            var doctorIds = shifts.Select(x => x.StaffProfileId).Distinct().ToList();
            var booked = (await _appointmentRepository.GetActiveAppointmentsInRangeAsync(date, date, doctorIds))
                .Where(a => a.Id != excludeAppointmentId)
                .ToList();

            return BuildSlots(date, shifts, booked, rules);
        }

        // Free-slot count of every day from..to for the booking calendar: the same rules as FindSlotsAsync, but the
        // config, the services, the shifts and the appointments are read once for the whole range instead of once a day.
        private async Task<List<AvailableDayResponse>> FindDaysAsync(List<BookingLine> lines, DateOnly from, DateOnly to, int? doctorId, long? excludeAppointmentId = null)
        {
            ConditionGuard.Ensure(from <= to, ErrorConstants.AppointmentMessage.DateRangeInvalid);
            var rules = await LoadSlotRulesAsync(lines);
            // Days outside the bookable window have no slot: only today..last bookable day is computed
            var first = from < rules.Today ? rules.Today : from;
            var last = to > rules.LastDay ? rules.LastDay : to;
            if (first > last)
            {
                return new List<AvailableDayResponse>();
            }
            ConditionGuard.Ensure(last.DayNumber - first.DayNumber < AppointmentConstants.AvailableDaysMaxRange,
                ErrorConstants.AppointmentMessage.DateRangeTooLong);

            var shifts = (await _appointmentRepository.GetDoctorShiftsInRangeAsync(first, last, doctorId))
                .Where(x => x.Room!.RoomType == rules.RequiredRoomType)
                .ToList();
            var doctorIds = shifts.Select(x => x.StaffProfileId).Distinct().ToList();
            var booked = doctorIds.Count == 0
                ? new List<Appointment>()
                : (await _appointmentRepository.GetActiveAppointmentsInRangeAsync(first, last, doctorIds))
                    .Where(a => a.Id != excludeAppointmentId)
                    .ToList();
            var shiftsByDay = shifts.ToLookup(x => x.ScheduleDate);
            var bookedByDay = booked.ToLookup(x => x.AppointmentDate);

            var days = new List<AvailableDayResponse>();
            for (var date = first; date <= last; date = date.AddDays(1))
            {
                var dayShifts = shiftsByDay[date].ToList();
                // Several doctors may be free at the same time: the patient sees one slot per start time
                var starts = BuildSlots(date, dayShifts, bookedByDay[date].ToList(), rules)
                    .Select(x => x.SlotStart)
                    .Distinct()
                    .ToList();
                days.Add(new AvailableDayResponse
                {
                    Date = date,
                    FreeSlotCount = starts.Count,
                    IsWorkingDay = dayShifts.Count > 0,
                    FirstSlotStart = starts.Count > 0 ? starts[0] : null
                });
            }

            return days;
        }

        // What decides the slots, read once per request
        private sealed record SlotRules(DateOnly Today, DateOnly LastDay, int SlotMinutes, DateTime EarliestStart, TimeSpan Duration, string RequiredRoomType);

        private async Task<SlotRules> LoadSlotRulesAsync(List<BookingLine> lines)
        {
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            var maxDaysAhead = await GetIntConfigAsync(ConfigKeyConstants.BookingMaxDaysAhead);
            var slotMinutes = await GetIntConfigAsync(ConfigKeyConstants.SlotDurationMinutes);
            var minHoursAhead = await GetIntConfigAsync(ConfigKeyConstants.BookingMinHoursAhead);
            return new SlotRules(
                today,
                today.AddDays(maxDaysAhead),
                slotMinutes,
                ClinicClock.Now.AddHours(minHoursAhead),
                // Services are done one after another, so the slot must fit their total time, held in whole slots (R3);
                // each service line still keeps its own minutes (DurationMinutes) for the doctor
                TimeSpan.FromMinutes(SlotTimeHelper.HeldMinutes(lines.Sum(l => l.GetMinutes(slotMinutes)), slotMinutes)),
                RequiredRoomTypeOf(lines.Select(l => l.Service.RequiredRoomType)));
        }

        // The free slots of one day: each slot of each shift that fits the total time, is not taken and is not too soon
        private static List<AvailableSlotResponse> BuildSlots(DateOnly date, List<StaffSchedule> shifts, List<Appointment> booked, SlotRules rules)
        {
            var slots = new List<AvailableSlotResponse>();
            foreach (var shift in shifts)
            {
                for (var start = shift.ShiftStart; ; start = start.AddMinutes(rules.SlotMinutes))
                {
                    var end = start.Add(rules.Duration);
                    // TimeOnly wraps at midnight, so "end < start" also means past the shift
                    if (end < start || end > shift.ShiftEnd)
                    {
                        break;
                    }

                    var isTaken = booked.Any(a => a.DoctorId == shift.StaffProfileId
                        && a.TimeSlotStart < end && start < a.TimeSlotEnd);
                    var isTooSoon = date.ToDateTime(start) < rules.EarliestStart;

                    if (!isTaken && !isTooSoon)
                    {
                        slots.Add(new AvailableSlotResponse
                        {
                            DoctorId = shift.StaffProfileId,
                            DoctorName = shift.StaffProfile.FullName,
                            Date = date,
                            SlotStart = start,
                            SlotEnd = end
                        });
                    }
                }
            }

            return slots.OrderBy(x => x.SlotStart).ThenBy(x => x.DoctorId).ToList();
        }

        // AC5: when the patient picks no doctor, choose the one with the fewest appointments that day
        private async Task<AvailableSlotResponse> PickLeastBusyAsync(List<AvailableSlotResponse> candidates, DateOnly date)
        {
            var doctorIds = candidates.Select(x => x.DoctorId).Distinct().ToList();
            var booked = await _appointmentRepository.GetActiveAppointmentsInRangeAsync(date, date, doctorIds);

            return candidates
                .OrderBy(c => booked.Count(a => a.DoctorId == c.DoctorId))
                .ThenBy(c => c.DoctorId)
                .First();
        }

        // One bookable line: a whole service, or one variant of a service
        private sealed record BookingLine(Service Service, ServiceVariant? Variant)
        {
            public string DisplayName => Variant == null
                ? Service.ServiceName
                : $"{Service.ServiceName} - {Variant.VariantName}";

            // A variant is priced as its own line, so it never falls back to the service's price
            public decimal Price => Variant?.ReferencePrice ?? Service.ReferencePrice;

            // A line without an estimate takes one slot
            public int GetMinutes(int slotMinutes) =>
                (Variant != null ? Variant.EstimatedMinutes : Service.EstimatedMinutes) ?? slotMinutes;
        }

        // The general exam comes first, then the services and variants the patient picked, without duplicates
        private async Task<List<BookingLine>> ResolveBookingLinesAsync(
            IReadOnlyCollection<int> pickedServiceIds, IReadOnlyCollection<int> pickedVariantIds)
        {
            var examServiceCode = await GetStringConfigAsync(ConfigKeyConstants.GeneralExamServiceCode);
            var exam = await _serviceRepository.GetByCodeAsync(examServiceCode);
            ConditionGuard.Ensure(exam != null && exam.IsActive, ErrorConstants.AppointmentMessage.GeneralExamServiceMissing);

            var variantIds = pickedVariantIds.Distinct().ToList();
            var variants = await _appointmentRepository.GetVariantsByIdsAsync(variantIds);
            ConditionGuard.Ensure<NotFoundException>(variants.Count == variantIds.Count, ErrorConstants.AppointmentMessage.VariantNotFound);

            // An old appointment can hold a variant that was switched off because its service no longer has variants;
            // moving that appointment books the service itself. Any other inactive variant is refused.
            var retired = variants.Where(v => !v.IsActive).ToList();
            if (retired.Count > 0)
            {
                var owners = await _appointmentRepository.GetServicesByIdsAsync(retired.Select(v => v.ServiceId).Distinct().ToList());
                ConditionGuard.Ensure(retired.All(v => owners.Any(s => s.Id == v.ServiceId && s.IsActive && !s.Variants.Any())),
                    ErrorConstants.AppointmentMessage.VariantInactive);
                variants = variants.Except(retired).ToList();
                variantIds = variantIds.Where(id => variants.Any(v => v.Id == id)).ToList();
            }
            ConditionGuard.Ensure(variants.All(v => v.Service.IsActive), ErrorConstants.AppointmentMessage.VariantInactive);

            // A variant line already carries its service, so the same service sent on its own is not a second line
            var variantServiceIds = variants.Select(v => v.ServiceId).ToHashSet();
            var pickedIds = pickedServiceIds.Concat(retired.Select(v => v.ServiceId))
                .Where(id => id != exam!.Id && !variantServiceIds.Contains(id))
                .Distinct()
                .ToList();
            var picked = await _appointmentRepository.GetServicesByIdsAsync(pickedIds);
            ConditionGuard.Ensure<NotFoundException>(picked.Count == pickedIds.Count, ErrorConstants.AppointmentMessage.ServiceNotFound);
            ConditionGuard.Ensure(picked.All(s => s.IsActive), ErrorConstants.AppointmentMessage.ServiceInactive);

            // A service that has active variants is booked through exactly one of them, never on its own
            var serviceNeedingVariant = picked.FirstOrDefault(s => s.Variants.Any(v => v.IsActive));
            ConditionGuard.Ensure(serviceNeedingVariant == null,
                string.Format(ErrorConstants.AppointmentMessage.VariantRequired, serviceNeedingVariant?.ServiceName));
            var serviceWithManyVariants = variants.GroupBy(v => v.ServiceId).FirstOrDefault(g => g.Count() > 1);
            ConditionGuard.Ensure(serviceWithManyVariants == null,
                string.Format(ErrorConstants.AppointmentMessage.OneVariantPerService, serviceWithManyVariants?.First().Service.ServiceName));

            // Keep the order the patient chose; a variant is a separate line next to its service
            var lines = new List<BookingLine> { new(exam!, null) };
            lines.AddRange(pickedIds.Select(id => new BookingLine(picked.First(s => s.Id == id), null)));
            lines.AddRange(variantIds.Select(id =>
            {
                var variant = variants.First(v => v.Id == id);
                return new BookingLine(variant.Service, variant);
            }));

            // One appointment uses one doctor shift in one room
            var roomTypes = lines
                .Where(l => !string.IsNullOrWhiteSpace(l.Service.RequiredRoomType))
                .Select(l => l.Service.RequiredRoomType)
                .Distinct()
                .Count();
            ConditionGuard.Ensure(roomTypes <= 1, ErrorConstants.AppointmentMessage.ServicesNeedDifferentRooms);

            return lines;
        }

        private async Task<string> GetStringConfigAsync(string configKey)
        {
            var value = await _appointmentRepository.GetConfigValueAsync(configKey);
            ConditionGuard.Ensure(!string.IsNullOrWhiteSpace(value),
                string.Format(ErrorConstants.AppointmentMessage.ConfigMissing, configKey));
            return value!;
        }


        private async Task<int> GetIntConfigAsync(string configKey)
        {
            var value = await _appointmentRepository.GetConfigValueAsync(configKey);
            ConditionGuard.Ensure(int.TryParse(value, out var result),
                string.Format(ErrorConstants.AppointmentMessage.ConfigMissing, configKey));
            return result;
        }


        // Same format as AuthService.GeneratePatientCode
        private static string GeneratePatientCode()
        {
            return $"BN-{DateTime.UtcNow:yyMMdd}-{RandomNumberGenerator.GetInt32(0, 1_000_000):D6}";
        }

        private static AppointmentResponse ToResponse(Appointment appointment, Patient patient,
            AvailableSlotResponse slot, List<BookingLine> lines)
        {
            return new AppointmentResponse
            {
                Id = appointment.Id,
                PatientId = patient.Id,
                PatientCode = patient.PatientCode,
                PatientName = patient.FullName,
                PatientPhoneNumber = PhoneNumberHelper.Mask(patient.PhoneNumber ?? string.Empty),
                DoctorId = slot.DoctorId,
                DoctorName = slot.DoctorName,
                // Kept for the current frontend: the first service (the general exam)
                ServiceId = lines[0].Service.Id,
                ServiceName = lines[0].Service.ServiceName,
                Services = appointment.ServiceItems.Select(item => new AppointmentServiceResponse
                {
                    ServiceId = item.ServiceId,
                    ServiceName = lines.First(l => l.Service.Id == item.ServiceId).Service.ServiceName,
                    VariantId = item.VariantId,
                    VariantName = lines.FirstOrDefault(l => l.Variant?.Id == item.VariantId && item.VariantId != null)?.Variant?.VariantName,
                    DurationMinutes = item.DurationMinutes,
                    PriceAtBooking = item.PriceAtBooking
                }).ToList(),
                RequiredRoomType = RequiredRoomTypeOf(lines.Select(l => l.Service.RequiredRoomType)),
                AppointmentType = appointment.AppointmentType,
                AppointmentDate = appointment.AppointmentDate,
                TimeSlotStart = slot.SlotStart,
                TimeSlotEnd = slot.SlotEnd,
                Status = appointment.Status,
                Notes = appointment.Notes,
                CreatedAt = appointment.CreatedAt,
                ParentAppointmentId = appointment.ParentAppointmentId,
                ExaminationId = appointment.Examination?.Id,
                ExaminationStatus = appointment.Examination?.ExaminationStatus,
                FollowUp = appointment.Examination.ToFollowUpSummary()
            };
        }

        public async Task<PagedResult<AppointmentResponse>> GetAppointmentsAsync(AppointmentQueryParameters query, CancellationToken cancellationToken = default)
        {
            var pagedResult = await _appointmentRepository.GetAppointmentsAsync(query, cancellationToken);
            var mappedItems = pagedResult.Items.Select(MapToResponse).ToList();
            return new PagedResult<AppointmentResponse>(mappedItems, pagedResult.TotalCount, pagedResult.PageNumber, pagedResult.PageSize);
        }

        // Waiting order: booked patients on time (by booked time), then booked patients who came late (by check-in time),
        // then walk-ins (by check-in time). Only the order of people who are waiting; nobody who is already being seen moves
        public async Task<List<WaitingListItemResponse>> GetWaitingListAsync(int? doctorId, string? doctorUserId, CancellationToken cancellationToken = default)
        {
            if (doctorUserId != null)
            {
                var ownDoctorId = await _appointmentRepository.GetStaffProfileIdByUserIdAsync(doctorUserId);
                ConditionGuard.Ensure<NotFoundException>(ownDoctorId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
                doctorId = ownDoctorId;
            }

            var lateMinutes = await GetIntConfigAsync(ConfigKeyConstants.CheckInLateMinutes);
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            var waiting = await _appointmentRepository.GetWaitingAppointmentsAsync(today, doctorId, cancellationToken);

            // A doctor sees the waiting list only while on shift (started and not ended); off duty, only the patients
            // already examined (back from the X-ray) are listed
            if (doctorUserId != null && doctorId.HasValue && _queueService != null
                && await _queueService.IsDoctorOffDutyAsync(doctorId.Value, cancellationToken))
            {
                waiting = waiting.Where(a => a.Examination != null).ToList();
            }

            // Same order as "call next" (QueueService), so the patient on top is the one who is called
            return WaitingOrder.Sort(waiting, a => a, WaitingOrder.SkipCountOf, lateMinutes)
                .Select(a => (Appointment: a, Group: WaitingOrder.GetGroup(a, lateMinutes)))
                .Select((x, index) => new WaitingListItemResponse
                {
                    Position = index + 1,
                    AppointmentId = x.Appointment.Id,
                    PatientId = x.Appointment.PatientId,
                    PatientCode = x.Appointment.Patient?.PatientCode ?? string.Empty,
                    PatientName = x.Appointment.Patient?.FullName ?? string.Empty,
                    DoctorId = x.Appointment.DoctorId,
                    DoctorName = x.Appointment.Doctor?.FullName,
                    AppointmentType = x.Appointment.AppointmentType,
                    TimeSlotStart = x.Appointment.TimeSlotStart,
                    CheckInAt = x.Appointment.CheckInAt,
                    RoomId = GetCurrentRoom(x.Appointment)?.Id,
                    RoomName = GetCurrentRoom(x.Appointment)?.RoomName,
                    Priority = x.Appointment.Priority,
                    PriorityReason = x.Appointment.PriorityReason,
                    RequiredRoomType = RequiredRoomTypeOf(x.Appointment.ServiceItems.Select(i => i.Service?.RequiredRoomType)),
                    PatientPhoneNumber = x.Appointment.Patient?.PhoneNumber,
                    PatientAllergies = x.Appointment.Patient?.MedicalProfiles
                        .Where(m => m.RecordType == PatientConstants.MedicalProfile.AllergyType
                            && m.Status == PatientConstants.MedicalProfile.ActiveStatus)
                        .Select(m => m.Title)
                        .ToList() ?? new List<string>(),
                    SkipCount = WaitingOrder.SkipCountOf(x.Appointment),
                    IsLate = x.Group == WaitingOrder.LateGroup,
                    IsPriorityReturn = x.Group == WaitingOrder.PriorityReturnGroup,
                    Services = x.Appointment.ServiceItems
                        .Select(i => i.Variant == null ? i.Service.ServiceName : $"{i.Service.ServiceName} - {i.Variant.VariantName}")
                        .ToList()
                })
                .ToList();
        }

        public async Task<PagedResult<AppointmentResponse>> GetMyAppointmentsAsync(AppointmentQueryParameters query, string userId, CancellationToken cancellationToken = default)
        {
            var patient = await _appointmentRepository.GetPatientByUserIdAsync(userId);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);

            // Always the signed-in patient's own id; a PatientId sent by the client is overwritten
            query.PatientId = patient!.Id;
            return await GetAppointmentsAsync(query, cancellationToken);
        }

        public async Task<AppointmentResponse> GetAppointmentByIdAsync(long id, string? ownerUserId, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);
            EnsureOwnedBy(appointment!, ownerUserId);

            var response = MapToResponse(appointment!);
            response.QueueNumber = await GetQueueNumberAsync(appointment!, cancellationToken);
            return response;
        }

        // Only while the patient is in the clinic for this visit; the entry is closed once the examination is done
        private async Task<int?> GetQueueNumberAsync(Appointment appointment, CancellationToken cancellationToken)
        {
            var inClinic = appointment.Status == AppointmentConstants.CheckedInStatus || appointment.Status == AppointmentConstants.InServiceStatus;
            if (!inClinic || _queueService == null)
            {
                return null;
            }

            var entry = await _queueService.GetActiveEntryAsync(appointment.Id, QueueConstants.ExaminationType, cancellationToken);
            return entry?.QueueNumber;
        }

        public async Task<AppointmentResponse> CancelAppointmentAsync(long id, CancelAppointmentRequest request, string? userId, string? ownerUserId, CancellationToken cancellationToken = default)
        {
            ConditionGuard.Ensure(!string.IsNullOrWhiteSpace(request?.Reason), ErrorConstants.AppointmentMessage.ReasonRequired);

            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);
            EnsureOwnedBy(appointment!, ownerUserId);

            ConditionGuard.ThrowIf(!IsOpen(appointment!), ErrorConstants.AppointmentMessage.OnlyOpenCanBeCancelled);

            // Staff can cancel at any time (a patient may phone just before the visit).
            // A patient can cancel a pending or confirmed appointment online, before the cutoff
            if (ownerUserId != null)
            {
                await EnsureBeforeCutoffAsync(appointment!, ErrorConstants.AppointmentMessage.CancelDeadlinePassed);
            }

            var oldStatus = appointment!.Status;
            appointment.Status = AppointmentConstants.CancelledStatus;
            appointment.CancellationReason = request!.Reason.Trim();
            appointment.CancelledAt = DateTimeOffset.UtcNow;
            appointment.CancelledByUserId = userId;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            // If this appointment was a follow-up appointment, release the active link on the original examination
            if (appointment.ParentAppointment?.Examination != null && appointment.ParentAppointment.Examination.FollowUpAppointmentId == appointment.Id)
            {
                appointment.ParentAppointment.Examination.FollowUpAppointmentId = null;
                appointment.ParentAppointment.Examination.UpdatedAt = DateTimeOffset.UtcNow;
            }

            await _appointmentRepository.UpdateAsync(appointment);
            await _auditLogService.LogAsync(AuditConstants.AppointmentCancelled, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status }, appointment.CancellationReason);

            var cancelArgs = new object[] { Hm(appointment.TimeSlotStart), Dmy(appointment.AppointmentDate), appointment.CancellationReason };
            if (ownerUserId != null)
            {
                // The patient cancelled online: the desk should know the slot is free
                await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ReceptionistRole },
                    new NotificationContent(NotificationConstants.Text.PatientCancelledTitle,
                        string.Format(NotificationConstants.Text.PatientCancelledMessage, new object[] { appointment.Patient?.FullName ?? string.Empty }.Concat(cancelArgs).ToArray()),
                        NotificationConstants.Reference.Appointment, appointment.Id.ToString()), cancellationToken: cancellationToken));
            }
            else
            {
                await NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId,
                    new NotificationContent(NotificationConstants.Text.AppointmentCancelledTitle, string.Format(NotificationConstants.Text.AppointmentCancelledMessage, cancelArgs),
                        NotificationConstants.Reference.Appointment, appointment.Id.ToString()), cancellationToken));
            }
            if (oldStatus == AppointmentConstants.ConfirmedStatus)
            {
                await NotifyAsync(n => n.NotifyStaffAsync(appointment.DoctorId,
                    Content(NotificationConstants.Text.AppointmentCancelledForDoctorTitle, NotificationConstants.Text.AppointmentCancelledForDoctorMessage, appointment, appointment.Patient?.FullName), cancellationToken));
            }

            return MapToResponse(appointment);
        }

        public async Task<AppointmentResponse> RescheduleAppointmentAsync(long id, RescheduleAppointmentRequest request, string? ownerUserId, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);
            EnsureOwnedBy(appointment!, ownerUserId);

            ConditionGuard.ThrowIf(!IsOpen(appointment!), ErrorConstants.AppointmentMessage.OnlyOpenCanBeRescheduled);

            var isPatient = ownerUserId != null;
            if (isPatient)
            {
                // A pending or confirmed appointment can be moved online, before the cutoff; it goes back to pending
                await EnsureBeforeCutoffAsync(appointment!, ErrorConstants.AppointmentMessage.RescheduleDeadlinePassed);
            }

            // The services stay the same, so the new slot must fit the same total time and room type
            var lines = appointment!.ServiceItems.Select(i => new BookingLine(i.Service, i.Variant)).ToList();
            ConditionGuard.Ensure(lines.Count > 0, ErrorConstants.AppointmentMessage.ServiceNotFound);

            var date = request.Date!.Value;
            var slotStart = request.SlotStart!.Value;
            var before = new { appointment.Status, appointment.AppointmentDate, appointment.TimeSlotStart, appointment.TimeSlotEnd, appointment.DoctorId };

            var chosen = await _appointmentRepository.ExecuteSerializableAsync(async () =>
            {
                // Re-check inside the transaction; never trust the slot sent by the client
                var candidates = (await FindSlotsAsync(lines, date, request.DoctorId, excludeAppointmentId: appointment.Id))
                    .Where(x => x.SlotStart == slotStart)
                    .ToList();
                ConditionGuard.Ensure(candidates.Count > 0, ErrorConstants.AppointmentMessage.SlotNotAvailable);

                // No doctor sent: keep the current doctor when free, otherwise take the least busy one
                var slot = request.DoctorId.HasValue
                    ? candidates[0]
                    : candidates.FirstOrDefault(c => c.DoctorId == appointment.DoctorId)
                        ?? await PickLeastBusyAsync(candidates, date);

                appointment.AppointmentDate = date;
                appointment.TimeSlotStart = slot.SlotStart;
                appointment.TimeSlotEnd = slot.SlotEnd;
                appointment.DoctorId = slot.DoctorId;
                // A patient's change still needs the receptionist's call; staff changed it after talking to the patient
                appointment.Status = isPatient ? AppointmentConstants.PendingStatus : AppointmentConstants.ConfirmedStatus;
                appointment.UpdatedAt = DateTimeOffset.UtcNow;

                // Keep parent examination's follow-up date in sync with the rescheduled appointment date
                if (appointment.ParentAppointment?.Examination != null && appointment.ParentAppointment.Examination.FollowUpAppointmentId == appointment.Id)
                {
                    appointment.ParentAppointment.Examination.FollowUpDate = date;
                    appointment.ParentAppointment.Examination.UpdatedAt = DateTimeOffset.UtcNow;
                }

                await _appointmentRepository.UpdateAsync(appointment);
                return slot;
            });

            var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
            await _auditLogService.LogAsync(AuditConstants.AppointmentRescheduled, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                before, new { appointment.Status, appointment.AppointmentDate, appointment.TimeSlotStart, appointment.TimeSlotEnd, appointment.DoctorId }, reason);

            if (!isPatient)
            {
                await SendConfirmationEmailAsync(appointment);
            }

            var patientName = appointment.Patient?.FullName;
            if (isPatient)
            {
                await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ReceptionistRole },
                    Content(NotificationConstants.Text.PatientRescheduledTitle, NotificationConstants.Text.PatientRescheduledMessage, appointment, patientName), cancellationToken: cancellationToken));
            }
            else
            {
                await NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId, RescheduledContent(appointment, chosen.DoctorName, reason), cancellationToken));
                await NotifyDoctorOfNewAppointmentAsync(appointment, patientName);
            }
            // The doctor who had a confirmed visit at the old time no longer has it
            if (before.Status == AppointmentConstants.ConfirmedStatus && before.DoctorId.HasValue
                && (before.DoctorId != appointment.DoctorId || isPatient))
            {
                await NotifyAsync(n => n.NotifyStaffAsync(before.DoctorId,
                    new NotificationContent(NotificationConstants.Text.AppointmentMovedAwayTitle,
                        string.Format(NotificationConstants.Text.AppointmentMovedAwayMessage, patientName, Hm(before.TimeSlotStart), Dmy(before.AppointmentDate)),
                        NotificationConstants.Reference.Appointment, appointment.Id.ToString()), cancellationToken));
            }

            var rescheduled = MapToResponse(appointment);
            rescheduled.DoctorId = chosen.DoctorId;
            rescheduled.DoctorName = chosen.DoctorName;
            return rescheduled;
        }

        // The new time and doctor, and the reason when the clinic gave one
        private static NotificationContent RescheduledContent(Appointment appointment, string? doctorName, string? reason)
        {
            var message = string.IsNullOrWhiteSpace(doctorName)
                ? string.Format(NotificationConstants.Text.AppointmentRescheduledMessage, Hm(appointment.TimeSlotStart), Dmy(appointment.AppointmentDate))
                : string.Format(NotificationConstants.Text.AppointmentRescheduledWithDoctorMessage, Hm(appointment.TimeSlotStart), Dmy(appointment.AppointmentDate), doctorName);
            if (reason != null)
            {
                message += string.Format(NotificationConstants.Text.AppointmentRescheduledReasonSuffix, reason);
            }
            return new NotificationContent(NotificationConstants.Text.AppointmentRescheduledTitle, message, NotificationConstants.Reference.Appointment, appointment.Id.ToString());
        }

        public async Task<AppointmentResponse> ConfirmAppointmentAsync(long id, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            ConditionGuard.ThrowIf(appointment!.Status != AppointmentConstants.PendingStatus, ErrorConstants.AppointmentMessage.OnlyPendingCanBeConfirmed);

            var oldStatus = appointment.Status;
            appointment.Status = AppointmentConstants.ConfirmedStatus;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            await _appointmentRepository.UpdateAsync(appointment);
            await _auditLogService.LogAsync(AuditConstants.AppointmentConfirmed, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status });
            await SendConfirmationEmailAsync(appointment);
            await NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId,
                Content(NotificationConstants.Text.AppointmentConfirmedTitle, NotificationConstants.Text.AppointmentConfirmedMessage, appointment), cancellationToken));
            await NotifyDoctorOfNewAppointmentAsync(appointment, appointment.Patient?.FullName);

            return MapToResponse(appointment);
        }

        public async Task<AppointmentResponse> CheckInAppointmentAsync(long id, CheckInRequest? request, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            // The receptionist confirms the booking first (this is also what filters out fake bookings)
            ConditionGuard.ThrowIf(appointment!.Status == AppointmentConstants.PendingStatus, ErrorConstants.AppointmentMessage.CheckInNeedsConfirmation);
            ConditionGuard.ThrowIf(appointment.Status != AppointmentConstants.ConfirmedStatus, ErrorConstants.AppointmentMessage.OnlyConfirmedCanBeCheckedIn);
            // A patient may arrive at any time of that day, early or late; the waiting order decides who is seen first
            ConditionGuard.ThrowIf(appointment.AppointmentDate != DateOnly.FromDateTime(ClinicClock.Today), ErrorConstants.AppointmentMessage.CheckInWrongDay);

            var priority = request?.Priority ?? PriorityConstants.Normal;
            EnsureValidPriority(priority, request?.Reason);

            // The booked doctor cannot see the patient today and the patient chose another doctor working today
            var oldDoctorId = appointment.DoctorId;
            var doctorName = appointment.Doctor?.FullName;
            Room? room;
            var newDoctorId = request?.DoctorId;
            var doctorChanged = newDoctorId.HasValue && newDoctorId != appointment.DoctorId;
            if (doctorChanged)
            {
                var shift = await FindDoctorShiftAsync(newDoctorId!.Value, appointment.AppointmentDate, null,
                    RequiredRoomTypeOf(appointment.ServiceItems.Select(i => i.Service?.RequiredRoomType)));
                ConditionGuard.Ensure(shift != null, ErrorConstants.AppointmentMessage.DoctorNoSuitableShiftToday);
                room = shift!.Room;
                doctorName = shift.StaffProfile?.FullName;
                appointment.DoctorId = newDoctorId;
            }
            else
            {
                // The patient goes to the room of the doctor's shift
                room = await FindDoctorRoomAsync(appointment);
            }

            var oldStatus = appointment.Status;
            appointment.Status = AppointmentConstants.CheckedInStatus;
            appointment.Priority = priority;
            appointment.PriorityReason = PriorityReasonOf(priority, request?.Reason);
            appointment.CheckInAt = DateTimeOffset.UtcNow;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            await _appointmentRepository.UpdateAsync(appointment);

            var entry = await EnterExaminationQueueAsync(appointment, room, request?.Reason, cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.AppointmentCheckedIn, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status, appointment.Priority }, request?.Reason?.Trim());
            if (doctorChanged)
            {
                await _auditLogService.LogAsync(AuditConstants.AppointmentDoctorReassigned, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                    new { DoctorId = oldDoctorId }, new { appointment.DoctorId, RoomId = room?.Id });
                await NotifyAsync(n => n.NotifyStaffAsync(appointment.DoctorId,
                    new NotificationContent(NotificationConstants.Text.PatientReassignedTitle, string.Format(NotificationConstants.Text.PatientReassignedMessage, appointment.Patient?.FullName),
                        NotificationConstants.Reference.Appointment, appointment.Id.ToString()), cancellationToken));
            }
            await NotifyCheckedInAsync(appointment, entry, doctorName, room, cancellationToken);

            var response = MapToResponse(appointment);
            response.DoctorId = appointment.DoctorId;
            response.DoctorName = doctorName;
            response.RoomId = room?.Id;
            response.RoomName = room?.RoomName;
            response.QueueNumber = entry?.QueueNumber;
            return response;
        }

        public async Task<List<NeedsAttentionResponse>> GetNeedsAttentionAsync(CancellationToken cancellationToken = default)
        {
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            var shifts = await _appointmentRepository.GetEndedShiftsAsync(today);
            if (shifts.Count == 0)
            {
                return new List<NeedsAttentionResponse>();
            }

            var doctorIds = shifts.Select(x => x.StaffProfileId).Distinct().ToList();
            var statuses = new[] { AppointmentConstants.PendingStatus, AppointmentConstants.ConfirmedStatus, AppointmentConstants.CheckedInStatus };
            var appointments = await _appointmentRepository.GetAppointmentsOfDoctorsAsync(today, doctorIds, statuses);

            var items = new List<NeedsAttentionResponse>();
            foreach (var appointment in appointments)
            {
                // The patient belongs to the shift the doctor ended, the same rule as when the shift was ended
                var shift = shifts.FirstOrDefault(s => s.StaffProfileId == appointment.DoctorId && ShiftTimeHelper.IsInShift(appointment, s));
                if (shift == null)
                {
                    continue;
                }

                string group;
                if (appointment.Status == AppointmentConstants.CheckedInStatus)
                {
                    group = AppointmentConstants.AttentionWaiting;
                }
                else if (appointment.TimeSlotStart.HasValue && shift.ActualEndTime.HasValue && appointment.TimeSlotStart.Value > shift.ActualEndTime.Value)
                {
                    // Booked for a time after the doctor left
                    group = AppointmentConstants.AttentionUpcoming;
                }
                else
                {
                    continue;
                }

                items.Add(new NeedsAttentionResponse
                {
                    AppointmentId = appointment.Id,
                    PatientId = appointment.PatientId,
                    PatientCode = appointment.Patient?.PatientCode ?? string.Empty,
                    PatientName = appointment.Patient?.FullName ?? string.Empty,
                    PatientPhoneNumber = appointment.Patient?.PhoneNumber ?? string.Empty,
                    AppointmentType = appointment.AppointmentType,
                    Status = appointment.Status,
                    Group = group,
                    TimeSlotStart = appointment.TimeSlotStart,
                    DoctorId = appointment.DoctorId,
                    DoctorName = appointment.Doctor?.FullName,
                    ShiftEndedAt = shift.ActualEndTime,
                    HasExamination = appointment.Examination != null
                });
            }

            // The ones in the clinic first, then the booked ones by time
            return items
                .OrderBy(x => x.Group == AppointmentConstants.AttentionWaiting ? 0 : 1)
                .ThenBy(x => x.TimeSlotStart)
                .ThenBy(x => x.AppointmentId)
                .ToList();
        }

        public async Task<List<PendingOverdueResponse>> GetPendingOverdueAsync(CancellationToken cancellationToken = default)
        {
            var confirmHours = await GetIntConfigAsync(ConfigKeyConstants.BookingPendingConfirmHours);
            var visitSoonHours = await GetIntConfigAsync(ConfigKeyConstants.BookingPendingVisitSoonHours);
            var now = ClinicClock.Now;

            var pending = await _appointmentRepository.GetPendingFromAsync(DateOnly.FromDateTime(ClinicClock.Today), cancellationToken);
            var items = new List<PendingOverdueResponse>();
            foreach (var appointment in pending)
            {
                // A reschedule by the patient puts the appointment back to PENDING, so the wait starts again from there
                var pendingSince = appointment.UpdatedAt ?? appointment.CreatedAt;
                var waitDeadline = ClinicClock.ToClinicTime(pendingSince).AddHours(confirmHours);
                // A booking without a time (should not happen for PENDING) counts from the start of its day
                var visitAt = appointment.AppointmentDate.ToDateTime(appointment.TimeSlotStart ?? TimeOnly.MinValue);
                var visitDeadline = visitAt.AddHours(-visitSoonHours);
                var deadline = waitDeadline < visitDeadline ? waitDeadline : visitDeadline;
                if (now < deadline)
                {
                    continue;
                }

                items.Add(new PendingOverdueResponse
                {
                    AppointmentId = appointment.Id,
                    PatientId = appointment.PatientId,
                    PatientCode = appointment.Patient?.PatientCode ?? string.Empty,
                    PatientName = appointment.Patient?.FullName ?? string.Empty,
                    PatientPhoneNumber = appointment.Patient?.PhoneNumber ?? string.Empty,
                    AppointmentDate = appointment.AppointmentDate,
                    TimeSlotStart = appointment.TimeSlotStart,
                    DoctorId = appointment.DoctorId,
                    DoctorName = appointment.Doctor?.FullName,
                    PendingSince = pendingSince,
                    ConfirmDeadline = deadline,
                    PendingHours = (int)Math.Floor((now - ClinicClock.ToClinicTime(pendingSince)).TotalHours),
                    HoursUntilVisit = (int)Math.Floor((visitAt - now).TotalHours),
                    Reason = now >= visitDeadline ? AppointmentConstants.PendingVisitSoon : AppointmentConstants.PendingWaitingTooLong
                });
            }

            // The visits closest in time first: those are the calls that cannot wait
            return items
                .OrderBy(x => x.Reason == AppointmentConstants.PendingVisitSoon ? 0 : 1)
                .ThenBy(x => x.AppointmentDate)
                .ThenBy(x => x.TimeSlotStart)
                .ThenBy(x => x.AppointmentId)
                .ToList();
        }

        public async Task<AppointmentResponse> ReassignDoctorAsync(long id, ReassignDoctorRequest request, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithExaminationAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            ConditionGuard.ThrowIf(appointment!.Status != AppointmentConstants.CheckedInStatus, ErrorConstants.AppointmentMessage.ReassignOnlyWaiting);
            // A patient the doctor has already examined (back from the X-ray) belongs to that examination
            ConditionGuard.ThrowIf(appointment.Examination != null, ErrorConstants.AppointmentMessage.ReassignAlreadyExamined);
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            ConditionGuard.ThrowIf(appointment.AppointmentDate != today, ErrorConstants.AppointmentMessage.ReassignWrongDay);
            var newDoctorId = request.DoctorId!.Value;
            ConditionGuard.ThrowIf(appointment.DoctorId == newDoctorId, ErrorConstants.AppointmentMessage.ReassignSameDoctor);
            // The patient is told why they are moved
            var reason = request.Reason?.Trim();
            ConditionGuard.Ensure(!string.IsNullOrEmpty(reason), ErrorConstants.AppointmentMessage.ReassignReasonRequired);

            // The same rule as booking: a shift in the kind of room the services need
            var shift = await FindDoctorShiftAsync(newDoctorId, today, null,
                RequiredRoomTypeOf(appointment.ServiceItems.Select(i => i.Service?.RequiredRoomType)));
            ConditionGuard.Ensure(shift != null, ErrorConstants.AppointmentMessage.DoctorNoSuitableShiftToday);
            var room = shift!.Room;

            var oldDoctorId = appointment.DoctorId;
            appointment.DoctorId = newDoctorId;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
            await _appointmentRepository.UpdateAsync(appointment);

            // The same queue entry goes to the new doctor: the number, missed calls and priority stay, so the doctor calls the
            // number the patient holds. Only a patient without an open entry gets a new one
            QueueEntry? entry = null;
            if (_queueService != null)
            {
                entry = await _queueService.ReassignAsync(appointment.Id, QueueConstants.ExaminationType, room?.Id, newDoctorId, cancellationToken);
            }
            entry ??= await EnterExaminationQueueAsync(appointment, room, null, cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.AppointmentDoctorReassigned, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { DoctorId = oldDoctorId }, new { DoctorId = newDoctorId, RoomId = room?.Id }, reason);
            await NotifyAsync(n => n.NotifyStaffAsync(newDoctorId,
                new NotificationContent(NotificationConstants.Text.PatientReassignedTitle, string.Format(NotificationConstants.Text.PatientReassignedMessage, appointment.Patient?.FullName),
                    NotificationConstants.Reference.Appointment, appointment.Id.ToString()), cancellationToken));
            await NotifyMovedToDoctorAsync(appointment, entry, shift.StaffProfile?.FullName, room, cancellationToken, reason);

            var response = MapToResponse(appointment);
            response.DoctorId = newDoctorId;
            response.DoctorName = shift.StaffProfile?.FullName;
            response.QueueNumber = entry?.QueueNumber;
            response.RoomId = room?.Id;
            response.RoomName = room?.RoomName;
            return response;
        }

        public async Task<AppointmentResponse> MarkNoShowAsync(long id, MarkNoShowRequest? request, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithExaminationAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            ConditionGuard.ThrowIf(appointment!.Status != AppointmentConstants.CheckedInStatus, ErrorConstants.AppointmentMessage.NoShowOnlyWaiting);
            // A patient the doctor has started on is finished by the doctor, not dropped
            ConditionGuard.ThrowIf(appointment.Examination != null, ErrorConstants.AppointmentMessage.NoShowAlreadyExamined);

            var oldStatus = appointment.Status;
            appointment.Status = AppointmentConstants.NoShowStatus;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
            await _appointmentRepository.UpdateAsync(appointment);

            if (_queueService != null)
            {
                await _queueService.UpdateStatusAsync(appointment.Id, QueueConstants.ExaminationType, QueueConstants.Cancelled, cancellationToken);
            }

            await _auditLogService.LogAsync(AuditConstants.AppointmentNoShow, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status }, request?.Reason?.Trim());

            return MapToResponse(appointment);
        }

        private const string WalkInCancelReason = "Bệnh nhân đến trực tiếp, đã tiếp nhận vãng lai";

        public async Task<AppointmentResponse> CreateWalkInAsync(WalkInRequest request, string? createdByUserId, CancellationToken cancellationToken = default)
        {
            ConditionGuard.Ensure(PhoneNumberHelper.TryNormalize(request.PhoneNumber, out var phone), ErrorConstants.AuthMessage.InvalidPhone);

            var email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
            ConditionGuard.ThrowIf(email != null && (email.Length > 256 || !new EmailAddressAttribute().IsValid(email)),
                ErrorConstants.AuthMessage.EmailInvalid);
            ConditionGuard.Ensure(PatientConstants.Gender.TryNormalize(request.Gender, out var gender), ErrorConstants.PatientMessage.InvalidGender);
            ConditionGuard.Ensure(request.DateOfBirth == null || request.DateOfBirth.Value <= DateOnly.FromDateTime(ClinicClock.Today),
                ErrorConstants.PatientMessage.InvalidDateOfBirth);

            // Normal unless the desk says otherwise; above normal needs a reason, like at check-in
            var priority = request.Priority ?? PriorityConstants.Normal;
            EnsureValidPriority(priority, request.Reason);

            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);

            // The patient is seen by the doctor they asked for, in the room of that doctor's shift
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            var shift = await FindDoctorShiftAsync(request.DoctorId!.Value, today, null,
                RequiredRoomTypeOf(lines.Select(l => l.Service.RequiredRoomType)));
            ConditionGuard.Ensure(shift != null, ErrorConstants.AppointmentMessage.DoctorNoSuitableShiftToday);
            var room = shift!.Room;

            string? emergencyPhone = null;
            if (!string.IsNullOrWhiteSpace(request.EmergencyContactPhone))
            {
                ConditionGuard.Ensure(PhoneNumberHelper.TryNormalize(request.EmergencyContactPhone, out var normalized), ErrorConstants.AuthMessage.InvalidPhone);
                emergencyPhone = normalized;
            }
            var history = new List<(string RecordType, string Title)>();
            foreach (var item in request.MedicalHistory ?? new List<WalkInMedicalHistoryItem>())
            {
                if (string.IsNullOrWhiteSpace(item.Title))
                {
                    continue;
                }
                ConditionGuard.Ensure(PatientConstants.MedicalProfile.TryNormalizeRecordType(item.RecordType, out var recordType),
                    ErrorConstants.PatientMessage.InvalidRecordType);
                var title = item.Title.Trim();
                if (!history.Any(h => h.RecordType == recordType && string.Equals(h.Title, title, StringComparison.OrdinalIgnoreCase)))
                {
                    history.Add((recordType!, title));
                }
            }

            var slotMinutes = await GetIntConfigAsync(ConfigKeyConstants.SlotDurationMinutes);
            var phoneVariants = PhoneNumberHelper.GetLookupVariants(phone);
            var replacedPending = new HashSet<long>();

            var (appointment, patient) = await _appointmentRepository.ExecuteSerializableAsync(async () =>
            {
                // A phone that already has a record (with or without an account) is the same person: the record is used as it is
                var patients = await _registrationRepository.FindPatientsByPhoneAsync(phoneVariants);
                ConditionGuard.ThrowIf(patients.Count > 1, ErrorConstants.AuthMessage.MultiplePatientRecords);

                var patient = patients.FirstOrDefault();
                if (patient == null)
                {
                    patient = new Patient
                    {
                        PatientCode = GeneratePatientCode(),
                        FullName = request.FullName.Trim(),
                        PhoneNumber = phone,
                        Email = email,
                        DateOfBirth = request.DateOfBirth,
                        Gender = gender,
                        EmergencyContactName = string.IsNullOrWhiteSpace(request.EmergencyContactName) ? null : request.EmergencyContactName.Trim(),
                        EmergencyContactPhone = emergencyPhone,
                        CreatedAt = DateTimeOffset.UtcNow,
                        MedicalProfiles = history.Select(h => new PatientMedicalProfile
                        {
                            RecordType = h.RecordType,
                            Title = h.Title,
                            Status = PatientConstants.MedicalProfile.AllowedStatuses[0],
                            CreatedByUserId = createdByUserId,
                            CreatedAt = DateTimeOffset.UtcNow
                        }).ToList()
                    };
                    await _appointmentRepository.AddPatientAsync(patient);
                }
                else
                {
                    // Someone who walks in is received even with a booking on another day; that booking stays as it is.
                    // Today: already in the clinic, or a confirmed booking to check in instead, blocks; a pending one is cancelled.
                    var sameDay = await _appointmentRepository.GetPatientAppointmentsOnDateAsync(patient.Id, today) ?? new List<Appointment>();
                    ConditionGuard.ThrowIf(sameDay.Any(x => x.Status == AppointmentConstants.CheckedInStatus || x.Status == AppointmentConstants.InServiceStatus),
                        ErrorConstants.AppointmentMessage.WalkInPatientInClinic);
                    ConditionGuard.ThrowIf(sameDay.Any(x => x.Status == AppointmentConstants.ConfirmedStatus),
                        ErrorConstants.AppointmentMessage.WalkInPatientHasConfirmedToday);
                    foreach (var pending in sameDay.Where(x => x.Status == AppointmentConstants.PendingStatus))
                    {
                        pending.Status = AppointmentConstants.CancelledStatus;
                        pending.CancellationReason = WalkInCancelReason;
                        pending.CancelledAt = DateTimeOffset.UtcNow;
                        pending.CancelledByUserId = createdByUserId;
                        pending.UpdatedAt = DateTimeOffset.UtcNow;
                        replacedPending.Add(pending.Id);
                    }
                }

                var now = DateTimeOffset.UtcNow;
                var appointment = new Appointment
                {
                    Patient = patient,
                    DoctorId = request.DoctorId,
                    AppointmentType = AppointmentConstants.WalkInType,
                    AppointmentDate = today,
                    // The patient is at the desk, so there is nothing to confirm
                    Status = AppointmentConstants.CheckedInStatus,
                    Priority = priority,
                    PriorityReason = PriorityReasonOf(priority, request.Reason),
                    CheckInAt = now,
                    Notes = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim(),
                    CreatedAt = now,
                    CreatedByUserId = createdByUserId,
                    ServiceItems = lines.Select(l => new AppointmentServiceItem
                    {
                        ServiceId = l.Service.Id,
                        VariantId = l.Variant?.Id,
                        DurationMinutes = l.GetMinutes(slotMinutes),
                        PriceAtBooking = l.Price,
                        CreatedAt = now
                    }).ToList()
                };
                await _appointmentRepository.AddAsync(appointment);
                await _appointmentRepository.SaveChangesAsync();

                return (appointment, patient);
            });

            // After the transaction: the queue gives out its numbers in a transaction of its own
            var entry = await EnterExaminationQueueAsync(appointment, room, request.Reason?.Trim(), cancellationToken);

            await LogCreatedAsync(appointment, lines);
            await _auditLogService.LogAsync(AuditConstants.AppointmentCheckedIn, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                null, new { appointment.Status, appointment.Priority }, request.Reason?.Trim());
            foreach (var id in replacedPending)
            {
                await _auditLogService.LogAsync(AuditConstants.AppointmentCancelled, AuditConstants.AppointmentEntity, id.ToString(),
                    new { Status = AppointmentConstants.PendingStatus }, new { Status = AppointmentConstants.CancelledStatus, WalkInAppointmentId = appointment.Id }, WalkInCancelReason);
            }

            // A walk-in has no booked time, so the time fields stay empty
            var response = ToResponse(appointment, patient, new AvailableSlotResponse
            {
                DoctorId = shift.StaffProfileId,
                DoctorName = shift.StaffProfile?.FullName ?? string.Empty,
                Date = today
            }, lines);
            response.TimeSlotStart = null;
            response.TimeSlotEnd = null;
            response.CheckInAt = appointment.CheckInAt;
            response.RoomId = room?.Id;
            response.RoomName = room?.RoomName;
            response.QueueNumber = entry?.QueueNumber;
            await NotifyCheckedInAsync(appointment, entry, shift.StaffProfile?.FullName, room, cancellationToken);
            return response;
        }

        // The room of the doctor's shift: the one the booked slot belongs to, else the one running now, else the next one of the day.
        // A doctor who has ended the shift takes no more patients; a doctor without a shift today is left without a room.
        private async Task<Room?> FindDoctorRoomAsync(Appointment appointment)
        {
            if (appointment.DoctorId == null)
            {
                return null;
            }

            var shift = await FindDoctorShiftAsync(appointment.DoctorId.Value, appointment.AppointmentDate, appointment.TimeSlotStart,
                RequiredRoomTypeOf(appointment.ServiceItems.Select(i => i.Service?.RequiredRoomType)));
            return shift?.Room;
        }

        // The kind of room the services need; services that ask for none are done in a general treatment room
        private static string RequiredRoomTypeOf(IEnumerable<string?> roomTypes)
        {
            return roomTypes.FirstOrDefault(t => !string.IsNullOrWhiteSpace(t)) ?? RoomTypeConstants.GeneralTreatment;
        }

        // The shift the patient is seen in, in the kind of room the services need; null when the doctor has none to offer today.
        // A booked patient belongs to the shift of the booked time even when arriving during an earlier shift.
        private async Task<StaffSchedule?> FindDoctorShiftAsync(int doctorId, DateOnly date, TimeOnly? slot, string requiredRoomType)
        {
            var shifts = (await _appointmentRepository.GetDoctorShiftsInRangeAsync(date, date, doctorId) ?? new List<StaffSchedule>())
                .Where(x => x.Room?.RoomType == requiredRoomType)
                .ToList();
            var now = TimeOnly.FromDateTime(ClinicClock.Now);
            var shift = shifts.FirstOrDefault(x => slot.HasValue && x.ShiftStart <= slot.Value && slot.Value < x.ShiftEnd)
                ?? shifts.FirstOrDefault(x => x.ShiftStart <= now && now < x.ShiftEnd)
                ?? shifts.FirstOrDefault(x => x.ShiftStart > now);
            if (shift == null)
            {
                var hasEnded = await _appointmentRepository.HasEndedShiftAsync(doctorId, date);
                ConditionGuard.ThrowIf(hasEnded, ErrorConstants.AppointmentMessage.CheckInDoctorShiftEnded);
            }

            return shift;
        }

        // The patient waits for the doctor in the examination queue, in the room of the shift
        private async Task<QueueEntry?> EnterExaminationQueueAsync(Appointment appointment, Room? room, string? reason, CancellationToken cancellationToken)
        {
            return _queueService == null
                ? null
                : await _queueService.EnqueueAsync(appointment.Id, QueueConstants.ExaminationType, room?.Id, appointment.DoctorId,
                    appointment.Priority, reason, cancellationToken);
        }

        private static string QueueNumberText(int number) => number.ToString("D2");

        private static string? DoctorAndRoom(string? doctorName, Room? room)
        {
            var place = string.Join(" · ", new[] { doctorName, room?.RoomName }.Where(x => !string.IsNullOrWhiteSpace(x)));
            return place.Length == 0 ? null : place;
        }

        // Moved to another doctor: the patient keeps the number, only the doctor and room change
        private Task NotifyMovedToDoctorAsync(Appointment appointment, QueueEntry? entry, string? doctorName, Room? room, CancellationToken cancellationToken, string? reason = null)
        {
            var place = DoctorAndRoom(doctorName, room);
            if (entry == null || place == null)
            {
                return Task.CompletedTask;
            }

            var message = string.IsNullOrWhiteSpace(reason)
                ? string.Format(NotificationConstants.Text.MovedToDoctorMessage, place, QueueNumberText(entry.QueueNumber))
                : string.Format(NotificationConstants.Text.MovedToDoctorWithReasonMessage, place, QueueNumberText(entry.QueueNumber), reason);
            return NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId,
                new NotificationContent(NotificationConstants.Text.MovedToDoctorTitle, message, NotificationConstants.Reference.Appointment, appointment.Id.ToString()),
                cancellationToken));
        }

        // The patient learns the number given at the desk
        private Task NotifyCheckedInAsync(Appointment appointment, QueueEntry? entry, string? doctorName, Room? room, CancellationToken cancellationToken)
        {
            if (entry == null)
            {
                return Task.CompletedTask;
            }

            var number = QueueNumberText(entry.QueueNumber);
            var place = DoctorAndRoom(doctorName, room);
            var message = place == null
                ? string.Format(NotificationConstants.Text.CheckedInMessage, number)
                : string.Format(NotificationConstants.Text.CheckedInWithPlaceMessage, number, place);
            return NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId,
                new NotificationContent(NotificationConstants.Text.CheckedInTitle, message, NotificationConstants.Reference.Appointment, appointment.Id.ToString()),
                cancellationToken));
        }

        // The room the waiting patient was sent to at check-in
        private static Room? GetCurrentRoom(Appointment appointment)
        {
            return appointment.QueueEntries
                .Where(q => q.QueueType == QueueConstants.ExaminationType && QueueConstants.ActiveStatuses.Contains(q.Status))
                .OrderByDescending(q => q.CreatedAt)
                .Select(q => q.Room)
                .FirstOrDefault();
        }

        public async Task<AppointmentResponse> SetPriorityAsync(long id, SetPriorityRequest request, CancellationToken cancellationToken = default)
        {
            var appointment = await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            // Only someone who is checked in and still waiting has a place in the waiting list to change
            ConditionGuard.ThrowIf(appointment!.Status != AppointmentConstants.CheckedInStatus, ErrorConstants.AppointmentMessage.PriorityOnlyForWaiting);

            var priority = request.Priority!.Value;
            EnsureValidPriority(priority, request.Reason);

            var oldPriority = appointment.Priority;
            appointment.Priority = priority;
            // Back to normal clears the reason
            appointment.PriorityReason = PriorityReasonOf(priority, request.Reason);
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            await _appointmentRepository.UpdateAsync(appointment);

            // The queue board orders by its own copy of the priority, so it has to follow
            if (_queueService != null)
            {
                await _queueService.UpdatePriorityAsync(appointment.Id, QueueConstants.ExaminationType, priority, cancellationToken);
            }

            await _auditLogService.LogAsync(AuditConstants.AppointmentPriorityChanged, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Priority = oldPriority }, new { appointment.Priority }, request.Reason?.Trim());

            return MapToResponse(appointment);
        }

        public async Task<StartExaminationResponse> StartExaminationAsync(long id, string doctorUserId, CancellationToken cancellationToken = default)
        {
            var doctorId = await _appointmentRepository.GetStaffProfileIdByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctorId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);

            var appointment = await _appointmentRepository.GetByIdWithExaminationAsync(id, cancellationToken)
                ?? await _appointmentRepository.GetByIdWithDetailsAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);

            // The waiting list of a doctor contains only that doctor's checked-in patients
            ConditionGuard.Ensure<ForbiddenException>(appointment!.DoctorId == doctorId, ErrorConstants.AppointmentMessage.NotAssignedDoctor);
            ConditionGuard.ThrowIf(appointment.Status != AppointmentConstants.CheckedInStatus, ErrorConstants.AppointmentMessage.OnlyCheckedInCanBeStarted);
            ConditionGuard.ThrowIf(appointment.AppointmentDate != DateOnly.FromDateTime(ClinicClock.Today), ErrorConstants.AppointmentMessage.ExaminationWrongDay);

            // A doctor takes new patients only after starting the shift and until ending it; one already examined
            // (back from the X-ray) is still theirs
            if (appointment.Examination == null && _queueService != null)
            {
                ConditionGuard.ThrowIf(await _queueService.IsDoctorOffDutyAsync(doctorId!.Value, cancellationToken),
                    ErrorConstants.AppointmentMessage.DoctorNotOnShiftCannotStart);
            }

            // One patient at a time: the doctor must finish the current examination first
            var isExamining = await _appointmentRepository.HasAppointmentInServiceAsync(doctorId!.Value, appointment.AppointmentDate);
            ConditionGuard.ThrowIf(isExamining, ErrorConstants.AppointmentMessage.DoctorAlreadyExamining);

            var now = DateTimeOffset.UtcNow;
            var oldStatus = appointment.Status;
            appointment.Status = AppointmentConstants.InServiceStatus;
            appointment.UpdatedAt = now;

            Examination examination;
            if (appointment.Examination != null)
            {
                // Resuming an existing examination (e.g. returning from X-ray / lab)
                examination = appointment.Examination;
                examination.UpdatedAt = now;
                await _appointmentRepository.UpdateAsync(appointment);
            }
            else
            {
                examination = new Examination
                {
                    PatientId = appointment.PatientId,
                    DoctorId = doctorId!.Value,
                    // The reason left when booking; the doctor corrects it during the examination
                    ChiefComplaint = appointment.Notes,
                    ExaminationStatus = ExaminationConstants.InProgress,
                    CreatedAt = now
                };

                await _appointmentRepository.SaveStartedExaminationAsync(appointment, examination, cancellationToken);
            }

            if (_queueService != null)
            {
                await _queueService.UpdateStatusAsync(appointment.Id, QueueConstants.ExaminationType, QueueConstants.InProgress, cancellationToken);
            }

            await _auditLogService.LogAsync(AuditConstants.AppointmentExaminationStarted, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status, ExaminationId = examination.Id, examination.ExaminationStatus });

            return new StartExaminationResponse
            {
                ExaminationId = examination.Id,
                AppointmentId = appointment.Id,
                PatientId = appointment.PatientId,
                DoctorId = examination.DoctorId,
                ExaminationStatus = examination.ExaminationStatus,
                AppointmentStatus = appointment.Status,
                ChiefComplaint = examination.ChiefComplaint
            };
        }

        public async Task<AppointmentResponse> CompleteExaminationAsync(long id, string doctorUserId, CancellationToken cancellationToken = default)
        {
            var doctorId = await _appointmentRepository.GetStaffProfileIdByUserIdAsync(doctorUserId);
            ConditionGuard.Ensure<NotFoundException>(doctorId != null, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);

            var appointment = await _appointmentRepository.GetByIdWithExaminationAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null && appointment.DoctorId == doctorId,
                ErrorConstants.AppointmentMessage.AppointmentNotFound);

            ConditionGuard.ThrowIf(appointment!.Status != AppointmentConstants.InServiceStatus,
                ErrorConstants.AppointmentMessage.OnlyInServiceCanBeCompleted);
            var examination = appointment.Examination;
            ConditionGuard.ThrowIf(examination == null, ErrorConstants.AppointmentMessage.ExaminationNotFound);
            ConditionGuard.ThrowIf(examination!.ExaminationStatus != ExaminationConstants.InProgress,
                ErrorConstants.AppointmentMessage.ExaminationAlreadyLocked);

            // A locked record cannot be filled in later: it must say something, and a prescription with medications
            // must be final, otherwise it would stay a draft for ever
            var (diagnoses, draftPrescriptions) = await _appointmentRepository.GetExaminationCompletionCountsAsync(examination.Id, cancellationToken);
            ConditionGuard.ThrowIf(diagnoses == 0 && string.IsNullOrWhiteSpace(examination.ClinicalNotes),
                ErrorConstants.ExaminationMessage.NothingRecorded);
            ConditionGuard.ThrowIf(draftPrescriptions > 0, ErrorConstants.ExaminationMessage.PrescriptionNotFinalized);
            await _appointmentRepository.RemoveEmptyDraftPrescriptionsAsync(examination.Id, cancellationToken);

            var now = DateTimeOffset.UtcNow;
            var oldStatus = appointment.Status;
            examination.ExaminationStatus = "Locked";
            examination.LockedAt = now;
            examination.LockedByUserId = doctorUserId;
            examination.UpdatedAt = now;

            appointment.Status = AppointmentConstants.CompletedStatus;
            appointment.UpdatedAt = now;
            ApplyPeriodicRecall(appointment, examination);

            await _appointmentRepository.UpdateAsync(appointment);

            if (_queueService != null)
            {
                await _queueService.UpdateStatusAsync(appointment.Id, QueueConstants.ExaminationType, QueueConstants.Completed, cancellationToken);
            }

            await _auditLogService.LogAsync(AuditConstants.AppointmentCompleted, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                new { Status = oldStatus }, new { appointment.Status, ExaminationId = examination.Id, examination.ExaminationStatus });

            await NotifyAsync(n => n.NotifyPatientAsync(appointment.PatientId,
                new NotificationContent(NotificationConstants.Text.ExaminationCompletedTitle,
                    string.Format(NotificationConstants.Text.ExaminationCompletedMessage, Dmy(appointment.AppointmentDate)),
                    NotificationConstants.Reference.Examination, examination.Id.ToString()), cancellationToken));

            // AD-9: never block clinical completion; attach soft payment warnings for the patient.
            var response = MapToResponse(appointment);
            response.PaymentWarnings = await TryBuildPaymentWarningsAsync(appointment.PatientId, cancellationToken);
            return response;
        }

        // BR-CRM-03: when the doctor set no follow-up, a service done today with a recall interval sets one
        // (the shortest interval wins, e.g. scaling every 6 months). The receptionist then reminds it like any follow-up.
        private static void ApplyPeriodicRecall(Appointment appointment, Examination examination)
        {
            if (examination.FollowUpDate != null || examination.FollowUpAppointmentId != null)
            {
                return;
            }

            var recalled = appointment.ServiceItems
                .Where(x => x.Service?.RecallIntervalMonths is > 0)
                .ToList();
            if (recalled.Count == 0)
            {
                return;
            }

            var months = recalled.Min(x => x.Service.RecallIntervalMonths!.Value);
            var names = string.Join(", ", recalled
                .Where(x => x.Service.RecallIntervalMonths == months)
                .Select(x => x.Service.ServiceName)
                .Distinct());
            examination.FollowUpDate = DateOnly.FromDateTime(ClinicClock.Today).AddMonths(months);
            var notes = $"Nhắc định kỳ {months} tháng: {names}";
            examination.FollowUpNotes = notes.Length <= 500 ? notes : notes[..500];
            examination.FollowUpIsRecall = true;
        }

        private async Task<List<PaymentWarning>> TryBuildPaymentWarningsAsync(
            int patientId,
            CancellationToken cancellationToken)
        {
            try
            {
                return await BuildPaymentWarningsAsync(patientId, cancellationToken);
            }
            catch (Exception ex)
            {
                // Clinical complete already persisted — warnings must not fail the HTTP response.
                _logger.LogWarning(ex, "Failed to build payment warnings for patient {PatientId} after examination complete.", patientId);
                return new List<PaymentWarning>();
            }
        }

        private async Task<List<PaymentWarning>> BuildPaymentWarningsAsync(
            int patientId,
            CancellationToken cancellationToken)
        {
            var warnings = new List<PaymentWarning>();
            if (_invoiceRepository is null && _installmentRepository is null)
            {
                return warnings;
            }

            if (_invoiceRepository is not null)
            {
                var outstanding = await _invoiceRepository.GetOutstandingForPatientAsync(patientId, cancellationToken);
                foreach (var invoice in outstanding)
                {
                    var remaining = decimal.Round(
                        Math.Max(0m, invoice.FinalAmount - invoice.PaidAmount),
                        2,
                        MidpointRounding.AwayFromZero);
                    if (remaining <= 0)
                    {
                        continue;
                    }

                    warnings.Add(new PaymentWarning
                    {
                        Code = PaymentConstants.WarningCode.OutstandingBalance,
                        Message = ErrorConstants.PaymentWarningMessage.OutstandingBalance,
                        InvoiceId = invoice.Id,
                        InvoiceNumber = invoice.InvoiceNumber,
                        RemainingAmount = remaining
                    });
                }
            }

            if (_installmentRepository is not null)
            {
                var asOf = DateOnly.FromDateTime(ClinicClock.Today);
                var overdueCount = await _installmentRepository.CountOverdueForPatientAsync(
                    patientId,
                    asOf,
                    cancellationToken);
                if (overdueCount > 0)
                {
                    warnings.Add(new PaymentWarning
                    {
                        Code = PaymentConstants.WarningCode.OverdueInstallment,
                        Message = ErrorConstants.PaymentWarningMessage.OverdueInstallment,
                        OverduePeriodCount = overdueCount
                    });
                }
            }

            return warnings;
        }

        // Anything above normal needs a reason, so the order of the waiting list can be explained later
        private static void EnsureValidPriority(int priority, string? reason)
        {
            ConditionGuard.Ensure(PriorityConstants.AllowedLevels.Contains(priority), ErrorConstants.AppointmentMessage.PriorityInvalid);
            ConditionGuard.Ensure(priority == PriorityConstants.Normal || !string.IsNullOrWhiteSpace(reason),
                ErrorConstants.AppointmentMessage.PriorityReasonRequired);
        }

        // The reason is kept only while the patient is above normal priority
        private static string? PriorityReasonOf(int priority, string? reason)
        {
            if (priority == PriorityConstants.Normal || string.IsNullOrWhiteSpace(reason))
            {
                return null;
            }

            var trimmed = reason.Trim();
            return trimmed.Length > PriorityReasonMaxLength ? trimmed[..PriorityReasonMaxLength] : trimmed;
        }

        private const int PriorityReasonMaxLength = 500;

        // autoConfirmed: a returning patient's online booking that skipped the front desk call, kept so the log shows why
        // an online booking started as CONFIRMED
        private Task LogCreatedAsync(Appointment appointment, List<BookingLine> lines, bool autoConfirmed = false) =>
            _auditLogService.LogAsync(AuditConstants.AppointmentCreated, AuditConstants.AppointmentEntity, appointment.Id.ToString(),
                newValues: new
                {
                    appointment.Status,
                    AutoConfirmed = autoConfirmed,
                    appointment.AppointmentDate,
                    appointment.TimeSlotStart,
                    appointment.TimeSlotEnd,
                    appointment.DoctorId,
                    Services = lines.Select(l => l.DisplayName)
                });


        // In-app notifications are optional so unit tests can build the service without them
        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        private static string Hm(TimeOnly? time) => time?.ToString("HH:mm") ?? string.Empty;
        private static string Dmy(DateOnly date) => date.ToString("dd/MM/yyyy");

        // A notification about one appointment. With a name the text starts with it ({0} name, {1} time, {2} date),
        // otherwise {0} time, {1} date
        private static NotificationContent Content(string title, string template, Appointment appointment, string? name = null)
        {
            var message = name == null
                ? string.Format(template, Hm(appointment.TimeSlotStart), Dmy(appointment.AppointmentDate))
                : string.Format(template, name, Hm(appointment.TimeSlotStart), Dmy(appointment.AppointmentDate));
            return new NotificationContent(title, message, NotificationConstants.Reference.Appointment, appointment.Id.ToString());
        }

        // A new PENDING booking made online: every receptionist, so someone calls the patient back
        private Task NotifyNewOnlineBookingAsync(Appointment appointment, Patient patient) =>
            NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ReceptionistRole },
                Content(NotificationConstants.Text.NewOnlineBookingTitle, NotificationConstants.Text.NewOnlineBookingMessage, appointment, patient.FullName)));

        // A returning patient's online booking is CONFIRMED at once: the patient is told it is confirmed, the
        // receptionists that no call is needed, and the doctor learns about the visit as for any confirmed booking
        private async Task NotifyReturningOnlineBookingAsync(Appointment appointment, Patient patient)
        {
            await NotifyAsync(n => n.NotifyPatientAsync(patient.Id,
                Content(NotificationConstants.Text.ReturningBookingConfirmedTitle, NotificationConstants.Text.ReturningBookingConfirmedMessage, appointment)));
            await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ReceptionistRole },
                Content(NotificationConstants.Text.ReturningOnlineBookingTitle, NotificationConstants.Text.ReturningOnlineBookingMessage, appointment, patient.FullName)));
            await NotifyDoctorOfNewAppointmentAsync(appointment, patient.FullName);
        }

        // The doctor learns about a visit once it is confirmed
        private Task NotifyDoctorOfNewAppointmentAsync(Appointment appointment, string? patientName) =>
            NotifyAsync(n => n.NotifyStaffAsync(appointment.DoctorId,
                Content(NotificationConstants.Text.NewAppointmentForDoctorTitle, NotificationConstants.Text.NewAppointmentForDoctorMessage, appointment, patientName ?? string.Empty)));

        // A patient can only cancel or reschedule while the appointment is further away than the cutoff.
        // A cutoff of 0 means no limit: until check-in, even after the booked time
        private async Task EnsureBeforeCutoffAsync(Appointment appointment, string errorMessage)
        {
            var cutoffHours = await GetIntConfigAsync(ConfigKeyConstants.BookingCancelCutoffHours);
            if (cutoffHours <= 0)
            {
                return;
            }

            var startsAt = appointment.AppointmentDate.ToDateTime(appointment.TimeSlotStart ?? default);
            ConditionGuard.ThrowIf(startsAt - ClinicClock.Now < TimeSpan.FromHours(cutoffHours), errorMessage);
        }

        // Only an appointment that has not started yet can be cancelled or checked in
        private static bool IsOpen(Appointment appointment) =>
            appointment.Status == AppointmentConstants.PendingStatus || appointment.Status == AppointmentConstants.ConfirmedStatus;

        // A null owner means staff access. A patient only reaches their own appointments; anyone else's looks like "not found"
        private static void EnsureOwnedBy(Appointment appointment, string? ownerUserId)
        {
            if (ownerUserId == null)
            {
                return;
            }

            ConditionGuard.Ensure<NotFoundException>(appointment.Patient?.UserId == ownerUserId, ErrorConstants.AppointmentMessage.AppointmentNotFound);
        }

        private async Task EnsurePatientPhoneVerifiedAsync(string userId)
        {
            var user = await _userManager.FindByIdAsync(userId);
            ConditionGuard.Ensure<NotFoundException>(user != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);
            ConditionGuard.Ensure(
                user!.PhoneNumberConfirmed && !string.IsNullOrWhiteSpace(user.PhoneNumber),
                ErrorConstants.AppointmentMessage.PhoneNotVerified);
        }

        // Booked by the receptionist: confirmed at once
        public Task<AppointmentResponse> ScheduleFollowUpAsync(
            long appointmentId, ScheduleFollowUpRequest request, string userId, CancellationToken cancellationToken = default)
            => ScheduleFollowUpCoreAsync(appointmentId, request, userId, false, cancellationToken);

        // Set by the doctor at the end of the visit: in the doctor's own shift, waiting for the receptionist to confirm it with the patient
        public Task<AppointmentResponse> ScheduleFollowUpByDoctorAsync(
            long appointmentId, ScheduleFollowUpRequest request, string doctorUserId, CancellationToken cancellationToken = default)
            => ScheduleFollowUpCoreAsync(appointmentId, request, doctorUserId, true, cancellationToken);

        private async Task<AppointmentResponse> ScheduleFollowUpCoreAsync(
            long appointmentId, ScheduleFollowUpRequest request, string userId, bool byDoctor, CancellationToken cancellationToken)
        {
            ConditionGuard.Ensure(request.Date.HasValue, ErrorConstants.AppointmentMessage.DateRequired);
            ConditionGuard.Ensure(request.SlotStart.HasValue, ErrorConstants.AppointmentMessage.SlotRequired);

            var originalAppointment = await _appointmentRepository.GetByIdWithExaminationAsync(appointmentId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(originalAppointment != null, ErrorConstants.AppointmentMessage.AppointmentNotFound);
            ConditionGuard.Ensure(originalAppointment!.Examination != null, ErrorConstants.AppointmentMessage.ExaminationNotFoundForAppointment);

            // Allow re-scheduling if the previously linked follow-up appointment was cancelled or marked no-show
            var existingFollowUp = originalAppointment.Examination!.FollowUpAppointment;
            var hasActiveFollowUp = existingFollowUp != null
                ? (existingFollowUp.Status != AppointmentConstants.CancelledStatus
                   && existingFollowUp.Status != AppointmentConstants.NoShowStatus)
                : originalAppointment.Examination.FollowUpAppointmentId != null;
            ConditionGuard.ThrowIf(hasActiveFollowUp, ErrorConstants.AppointmentMessage.FollowUpAlreadyScheduled);

            ConditionGuard.Ensure(request.Date!.Value > originalAppointment.AppointmentDate, ErrorConstants.ExaminationMessage.FollowUpDateMustBeFuture);

            var doctorId = request.DoctorId ?? originalAppointment.DoctorId;
            if (byDoctor)
            {
                doctorId = await _appointmentRepository.GetStaffProfileIdByUserIdAsync(userId);
                ConditionGuard.Ensure<ForbiddenException>(doctorId.HasValue, ErrorConstants.AppointmentMessage.DoctorProfileNotFound);
            }
            var lines = await ResolveBookingLinesAsync(request.ServiceId, request.VariantId);

            var (appointment, patient, slot) = await CreateBookingAsync(
                lines, request.Date!.Value, request.SlotStart!.Value, doctorId, request.Notes, userId,
                () => Task.FromResult(originalAppointment.Patient),
                excludeAppointmentId: originalAppointment.Id,
                parentAppointmentId: originalAppointment.Id);

            // Q9: a follow-up booked by the receptionist is confirmed directly; one set by the doctor waits for the receptionist
            appointment.Status = byDoctor ? AppointmentConstants.PendingStatus : AppointmentConstants.ConfirmedStatus;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;

            originalAppointment.Examination.FollowUpAppointmentId = appointment.Id;
            originalAppointment.Examination.FollowUpDate = appointment.AppointmentDate;
            if (!string.IsNullOrWhiteSpace(request.Notes))
            {
                originalAppointment.Examination.FollowUpNotes = request.Notes.Trim();
            }
            originalAppointment.Examination.UpdatedAt = DateTimeOffset.UtcNow;

            // The confirmation SMS/email goes out only for a confirmed booking; a pending one is confirmed later by the receptionist
            if (!byDoctor)
            {
                await SendConfirmationEmailAsync(appointment);
            }

            await _appointmentRepository.SaveChangesAsync();
            await NotifyAsync(n => n.NotifyPatientAsync(originalAppointment.PatientId,
                byDoctor
                    ? Content(NotificationConstants.Text.FollowUpProposedTitle, NotificationConstants.Text.FollowUpProposedMessage, appointment)
                    : Content(NotificationConstants.Text.FollowUpScheduledTitle, NotificationConstants.Text.FollowUpScheduledMessage, appointment), cancellationToken));

            await _auditLogService.LogAsync(
                AuditConstants.AppointmentFollowUpScheduled,
                AuditConstants.AppointmentEntity,
                appointment.Id.ToString(),
                newValues: new
                {
                    ParentAppointmentId = originalAppointment.Id,
                    ExaminationId = originalAppointment.Examination.Id,
                    appointment.AppointmentDate,
                    appointment.TimeSlotStart,
                    DoctorId = doctorId,
                    appointment.Status
                });

            return ToResponse(appointment, patient, slot, lines);
        }

        private static AppointmentResponse MapToResponse(Appointment appointment)
        {
            var firstItem = appointment.ServiceItems.FirstOrDefault();
            return new AppointmentResponse
            {
                Id = appointment.Id,
                PatientId = appointment.PatientId,
                PatientCode = appointment.Patient?.PatientCode ?? string.Empty,
                PatientName = appointment.Patient?.FullName ?? string.Empty,
                PatientPhoneNumber = appointment.Patient?.PhoneNumber ?? string.Empty,
                DoctorId = appointment.DoctorId,
                DoctorName = appointment.Doctor?.FullName,
                ServiceId = firstItem?.ServiceId ?? 0,
                ServiceName = firstItem?.Service?.ServiceName ?? string.Empty,
                Services = appointment.ServiceItems.Select(item => new AppointmentServiceResponse
                {
                    ServiceId = item.ServiceId,
                    ServiceName = item.Service?.ServiceName ?? string.Empty,
                    VariantId = item.VariantId,
                    VariantName = item.Variant?.VariantName,
                    DurationMinutes = item.DurationMinutes,
                    PriceAtBooking = item.PriceAtBooking
                }).ToList(),
                RequiredRoomType = RequiredRoomTypeOf(appointment.ServiceItems.Select(i => i.Service?.RequiredRoomType)),
                AppointmentType = appointment.AppointmentType,
                AppointmentDate = appointment.AppointmentDate,
                TimeSlotStart = appointment.TimeSlotStart,
                TimeSlotEnd = appointment.TimeSlotEnd,
                Status = appointment.Status,
                CheckInAt = appointment.CheckInAt,
                CancellationReason = appointment.CancellationReason,
                Notes = appointment.Notes,
                CreatedAt = appointment.CreatedAt,
                ParentAppointmentId = appointment.ParentAppointmentId,
                ExaminationId = appointment.Examination?.Id,
                ExaminationStatus = appointment.Examination?.ExaminationStatus,
                FollowUp = appointment.Examination.ToFollowUpSummary()
            };
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OZE.Common.Constants
{
    public static class ErrorConstants
    {
        public static class AuthMessage
        {
            public const string OtpTooManyRequests = "Too many codes were requested for this phone number or email. Please try again later";
            public const string TooManyRequests = "Too many requests. Please wait a moment and try again";
            public const string OtpAlreadyUsed = "This code has already been used. Continue with the new password";
            public const string InvalidConfirmationLink = "The confirmation link is invalid or has expired";
            public const string EmailNotFound = "Email not found in system";
            public const string EmailCantSent = "Could not send the email. Please try again later.";
            public const string UserExist = "User is exist in system";
            public const string ResetSessionInvalid = "Password reset session is invalid or expired, please request a new code";
            // Register (UC-01). Texts follow the System Messages table of SRS Report 3.
            // MSG07
            public const string FullNameRequired = "Please enter full name.";
            public const string DateOfBirthRequired = "Please enter date of birth.";
            public const string GenderRequired = "Please enter gender.";
            public const string PhoneRequired = "Please enter phone number.";
            public const string EmailRequired = "Please enter email.";
            public const string PasswordRequired = "Please enter password.";
            public const string ConfirmPasswordRequired = "Please enter confirm password.";
            public const string VerificationMethodRequired = "Please enter verification method.";
            public const string SessionIdRequired = "Please enter session id.";
            public const string OtpRequired = "Please enter OTP.";
            // MSG66
            public const string FullNameInvalid = "Full name is invalid. Please check again.";
            public const string DateOfBirthInvalid = "Date of birth is invalid. Please check again.";
            public const string GenderInvalid = "Gender is invalid. Please check again.";
            public const string InvalidPhone = "Phone number is invalid. Please check again.";
            public const string EmailInvalid = "Email is invalid. Please check again.";
            public const string PasswordInvalid = "Password is invalid. Please check again.";
            public const string ConfirmPasswordInvalid = "Confirm password is invalid. Please check again.";
            public const string VerificationMethodInvalid = "Verification method is invalid. Please check again.";
            public const string PasswordResetPhoneOnly = "Password reset is only available via phone number.";
            public const string InvalidOtp = "OTP is invalid. Please check again.";
            public const string InvalidData = "{0} is invalid. Please check again.";
            // MSG10, formatted with the phone number
            public const string PhoneExist = "Patient with phone number {0} already exists in the system.";
            // MSG68
            public const string EmailExist = "Email already exists in the system.";
            // MSG63
            public const string AccountCreated = "Create account success!";
            // TODO(spec): the messages below have no System Message code in the SRS yet.
            public const string OtpSentSms = "OTP has been sent to your phone number.";
            public const string OtpSentEmail = "OTP has been sent to your email.";
            public const string OtpSendFailed = "Could not send the OTP. Please try again later.";
            public const string OtpExpired = "OTP has expired. Please register again.";
            public const string OtpResendTooSoon = "Please wait before requesting another OTP.";
            public const string MultiplePatientRecords = "This phone number belongs to more than one patient record. Please contact the reception desk.";
            public const string UserNotFound = "User not found in system";
            public const string EmailConfirmRequired = "Email confirm Required";
            public const string InvalidLogin = "Invalid login, please check again";
            // Temporary lockout after too many failed attempts (BR-101).
            public const string AccountLocked = "Account is temporarily locked. Please try again later.";
            // Staff/manager disabled the account (MSG80 on FE).
            public const string AccountDisabled = "Account has been disabled. Please contact the clinic.";
            public const string InvalidRefreshToken = "Refresh token is expiry or not found";
            public const string TwoFactorRequired = "Two factor required, please check your code";
            public const string SamePassword = "New password cannot be the same as current password";
            public const string PasswordMismatch = "New password and confirmation password do not match";
            public const string LogoutRequiresToken = "Refresh token or authenticated user is required";
            public const string GoogleTokenInvalid = "Google sign-in token is invalid or expired.";
            public const string GoogleEmailNotVerified = "Google email is not verified.";
            public const string GoogleNotPatient = "Google sign-in is only available for patient accounts.";
            public const string GoogleNotConfigured = "Google sign-in is not configured.";
        }

        // Stable codes for login failures (UC-04). FE matches these instead of English message text.
        public static class AuthCode
        {
            public const string InvalidCredentials = "INVALID_CREDENTIALS";
            public const string LockedOut = "LOCKED_OUT";
            public const string AccountDisabled = "ACCOUNT_DISABLED";
            public const string GoogleTokenInvalid = "GOOGLE_TOKEN_INVALID";
            public const string GoogleEmailNotVerified = "GOOGLE_EMAIL_NOT_VERIFIED";
            public const string GoogleNotPatient = "GOOGLE_NOT_PATIENT";
            public const string GoogleNotConfigured = "GOOGLE_NOT_CONFIGURED";
        }

        public static class RoomMessage
        {
            public const string HasUpcomingShifts = "This room still has upcoming shifts. Move them to another room before changing its type or taking it out of service.";
            public const string RoomNotFound = "Room not found.";
            public const string RoomNameExist = "A room with this name already exists.";
            public const string InvalidRoomType = "Room type must be GeneralTreatment, MinorSurgery or XRay.";
            public const string InvalidStatus = "Room status must be Active, Maintenance or Inactive.";
            public const string RoomInUse = "This room has schedule or queue history and cannot be deleted. Set its status to Inactive instead.";
            public const string RoomCreated = "Room created successfully.";
            public const string RoomUpdated = "Room updated successfully.";
            public const string RoomDeleted = "Room deleted successfully.";
        }

        // Update profile (UC-08). Texts follow the System Messages table of SRS Report 3.
        public static class ProfileMessage
        {
            public const string NoEmailToConfirm = "There is no email waiting for confirmation";
            public const string ConfirmationEmailSent = "A new confirmation link has been sent to your email";
            public const string ProfileChangedMeanwhile = "Your profile was changed after this code was sent. Please make the change again";
            // MSG64
            public const string ProfileUpdated = "Update profile success!";
            // MSG66
            public const string AddressInvalid = "Address is invalid. Please check again.";
            // MSG39
            public const string PatientNotLinked = "Your account is not linked to a patient record. Please contact the reception desk.";
            // TODO(spec): the messages below have no System Message code in the SRS yet.
            public const string OtpExpired = "OTP has expired. Please update your profile again.";
            public const string UpdateFailed = "Update profile failed";
        }

        // Manage User (UC-44). Texts follow the System Messages table of SRS Report 3.
        public static class StaffMessage
        {
            public const string HasUpcomingWork = "This staff member still has shifts or appointments from now on; move or cancel them first";
            public const string LastManager = "The clinic must keep at least one active clinic manager";
            // MSG07
            public const string RoleRequired = "Please enter role.";
            public const string LicenseNumberRequired = "Please enter license number.";
            // MSG66
            public const string RoleInvalid = "Role is invalid. Please check again.";
            public const string SpecializationInvalid = "Specialization is invalid. Please check again.";
            public const string LicenseNumberInvalid = "License number is invalid. Please check again.";
            // MSG67
            public const string StaffNotFound = "Staff not found.";
            // MSG68
            public const string PhoneExist = "Phone number already exists in the system.";
            public const string LicenseNumberExist = "License number already exists in the system.";
            // MSG63
            public const string StaffCreated = "Create staff success!";
            // MSG64
            public const string StaffUpdated = "Update staff success!";
            // MSG70
            public const string AlreadyInactive = "Cannot deactivate because staff is inactive.";
            public const string AlreadyActive = "Cannot activate because staff is active.";
            // TODO(spec): the messages below have no System Message code in the SRS yet.
            public const string CannotChangeOwnRole = "You cannot change your own role.";
            public const string CannotDeactivateSelf = "You cannot deactivate your own account.";
            public const string StaffDeactivated = "Deactivate staff success!";
            public const string StaffActivated = "Activate staff success!";
            public const string UpdateFailed = "Update staff failed";
            public const string CreateFailed = "Create staff failed";
        }
        // Manage Role. Texts follow the System Messages table of SRS Report 3.
        public static class RoleMessage
        {
            // MSG07
            public const string NameRequired = "Please enter role name.";
            // MSG66
            public const string NameInvalid = "Role name is invalid. Please check again.";
            public const string DescriptionInvalid = "Description is invalid. Please check again.";
            // MSG68
            public const string RoleExist = "Role already exists in the system.";
            // MSG67
            public const string RoleNotFound = "Role not found.";
            // MSG63
            public const string RoleCreated = "Create role success!";
            // MSG64
            public const string RoleUpdated = "Update role success!";
            // TODO(spec): the messages below have no System Message code in the SRS yet.
            public const string CreateFailed = "Create role failed";
            public const string UpdateFailed = "Update role failed";
        }

        public static class WorkShiftMessage
        {
            public const string StaffNotFound = "Staff not found";
            public const string StaffInactive = "Staff account is inactive";
            public const string RoomNotFound = "Room not found";
            public const string RoomNotActive = "Room is not active";
            public const string InvalidTimeRange = "Shift start time must be earlier than end time";
            public const string PastDate = "Shift date cannot be in the past";
            public const string ShiftOverlap = "This staff member already has a shift that overlaps this time";
            public const string RoomOverlap = "This room is already used by another shift at that time";
            public const string WorkShiftNotFound = "Work shift not found";
            public const string InvalidDateRange = "From date must be earlier than or equal to to date";
            public const string ShiftAlreadyStarted = "Cannot delete a work shift that has already started or passed";
            public const string ShiftHasAppointments = "Cannot delete this work shift because it has booked appointments. Please move the appointments first";
            public const string CannotUpdateStartedShift = "Cannot update a work shift that has already started or passed";
            public const string ShiftHasAppointmentsCannotChange = "Cannot change staff, date or time of this work shift because it has booked appointments. Please move the appointments first";
            public const string BulkShiftInvalidRange = "Bulk shift date range is invalid or longer than 62 days";
            public const string BulkShiftInvalidSlots = "Bulk shift slots are invalid or overlap each other";
            public const string BulkShiftInvalidStaff = "Bulk shift must include between 1 and 20 unique staff members";
            public const string BulkShiftInvalidDaysOfWeek = "Bulk shift days of week must be between 0 (Sunday) and 6 (Saturday) and not empty";
            public const string BulkShiftNothingToCreate = "No valid work shifts to create";
            public const string BulkShiftBatchOverlap = "This shift overlaps another shift in the same bulk request";
        }
        public static class Common
        {
            public const string NotFound = "Not Found";
            // MSG02
            public const string NoData = "No Data.";
        }

        public static class ServiceMessage
        {
            public const string HasOpenAppointments = "This service is in appointments that are not finished yet; it cannot be turned off now";
            public const string ServiceNotFound = "Service not found in system";
            public const string ServiceCodeExist = "Service code already exists in system";
            public const string ServiceNameExist = "Service name already exists in system";
            public const string ServiceInUse = "Cannot delete service because it is currently linked to existing invoices or treatment plan stages. Please deactivate the service instead.";
            public const string InvalidRoomType = "Required room type must be one of: GeneralTreatment, MinorSurgery, XRay";
            public const string InvalidPrice = "Reference price must be greater than or equal to 0";
            public const string InvalidEstimatedMinutes = "Estimated minutes must be greater than 0";
        }

        // System configuration (clinic manager)
        public static class SystemConfigMessage
        {
            public const string NotFound = "Configuration not found.";
            public const string ValueRequired = "Please enter a value.";
            public const string ValueTooLong = "Value cannot exceed 500 characters.";
            public const string InvalidInt = "Value must be a whole number greater than or equal to 0.";
            public const string MustBePositive = "Value must be greater than 0.";
            public const string InvalidBool = "Value must be true or false.";
            public const string InvalidDecimal = "Value must be a number.";
            public const string InvalidPercent = "Value must be a percentage from 0 to 100.";
            public const string InvalidJson = "Value must be valid JSON.";
            public const string InvalidTime = "Value must be a time in HH:mm format.";
            public const string WorkTimeOrder = "Opening time must be earlier than closing time.";
            public const string ServiceCodeNotFound = "No active service has this code.";
        }

        // Audit log, read only (clinic manager)
        public static class AuditLogMessage
        {
            public const string NotFound = "Audit log not found.";
            public const string InvalidDateRange = "From date must be on or before to date.";
        }

        // In-app notifications (F-CRM-03)
        public static class NotificationMessage
        {
            public const string NotFound = "Notification not found.";
        }

        // Service variant management for the clinic manager
        public static class ServiceVariantMessage
        {
            public const string VariantNotFound = "Service variant not found in system";
            public const string VariantCodeExist = "Variant code already exists in system";
            public const string InvalidPrice = "Reference price must be greater than or equal to 0";
            public const string InvalidEstimatedMinutes = "Estimated minutes must be greater than 0";
            public const string InvalidDisplayOrder = "Display order must be greater than or equal to 0";
            public const string HasOpenAppointments = "This variant is in appointments that are not finished yet; it cannot be turned off now";
            public const string VariantInUse = "Cannot delete variant because it is already used in appointments. Please deactivate the variant instead.";
        }

        // Track Treatment Progress (UC-52 / SCRUM-351). Texts follow System Messages where applicable.
        public static class TreatmentPlanMessage
        {
            public const string NoAccess = "You do not have access to this patient's treatment plan";
            // MSG67
            public const string PlanNotFound = "Treatment plan not found.";
            public const string StageNotFound = "Treatment stage not found.";
            // MSG70
            public const string PlanNotApproved = "Cannot start treatment because the plan is not approved.";
            public const string EarlierStageNotCompleted = "Cannot start this stage because an earlier stage is not completed.";
            public const string StageNotScheduled = "Cannot start this stage because it is not scheduled.";
            public const string StageNotInProgress = "Cannot update or complete this stage because it is not in progress.";
            public const string PlanNotInProgress = "Cannot complete this stage because the plan is not in progress.";
            // MSG07 / BR-187
            public const string NotesRequiredWhenCostDiffers = "Please enter a note when the actual cost differs from the estimated cost.";
            // MSG66
            public const string InvalidActualCost = "Actual cost is invalid. Please check again.";
            public const string ScheduledDateInvalid = "Scheduled date is invalid. Please check again.";
            // MSG67
            public const string NextStageNotFound = "Next treatment stage not found.";
            public const string OpenPlanExists = "This examination already has an open treatment plan.";
            public const string StagesRequired = "Please add at least one treatment stage.";
            public const string InvalidEstimatedCost = "Estimated cost is invalid. Please check again.";
            public const string PlanNotEditable = "Only a draft or proposed treatment plan can be edited.";
            public const string OnlyDraftCanBeDeleted = "Only a draft treatment plan can be deleted.";
            public const string PlanInvoiced = "This treatment plan already has an invoice, so it can no longer be changed.";
            public const string DuplicateStage = "A treatment stage is listed more than once.";
            public const string OnlyDraftCanBeProposed = "Only a draft treatment plan can be proposed to the patient.";
            public const string OnlyProposedCanBeApproved = "Only a proposed treatment plan can be approved.";
            public const string PlanNotCancellable = "This treatment plan is already completed or cancelled. A draft plan is deleted instead.";
            public const string StageStillInProgress = "A treatment stage is still in progress. Please complete it before cancelling the plan.";
            public const string CancelReasonRequired = "Please enter the reason for cancelling the treatment plan.";
            public const string ExaminationIdRequired = "Examination id is required to create a treatment plan.";
            public const string CannotCreateNewVersion = "Only proposed, approved, or in-progress treatment plans can be updated with a new version.";
            public const string StageAlreadyCompleted = "This treatment stage is already completed.";
            public const string FollowUpAppointmentOrPlanRequired = "Either a previous appointment ID or a treatment plan ID is required.";
        }
        public static class AppointmentMessage
        {
            public const string RecordChangedMeanwhile = "This record was changed by someone else. Please reload and try again";
            public const string ServiceNotFound = "Service not found";
            public const string ServiceInactive = "This service is not available for booking";
            public const string PatientProfileNotFound = "No patient profile is linked to this account";
            public const string VariantNotFound = "Service variant not found";
            public const string VariantInactive = "This service variant is not available for booking";
            public const string VariantRequired = "Please choose a variant for the service {0}";
            public const string OneVariantPerService = "Please choose only one variant for the service {0}";
            public const string GeneralExamServiceMissing = "The general exam service is not set up. Please contact the clinic";
            public const string ServicesNeedDifferentRooms = "These services need different rooms and cannot be booked in one appointment";
            public const string DateRequired = "Appointment date is required";
            public const string SlotRequired = "Appointment time slot is required";
            public const string PastDate = "Appointment date cannot be in the past";
            public const string TooFarAhead = "Appointment date is too far in advance";
            public const string DateRangeInvalid = "From date must be on or before To date.";
            public const string DateRangeTooLong = "The date range must be at most 62 days.";
            public const string SlotNotAvailable = "This time slot is no longer available. Please choose another time";
            public const string PhoneHasAccount = "This phone number already has an account. Please sign in to book";
            public const string WalkInPatientInClinic = "The patient is already being seen today";
            public const string WalkInPatientHasConfirmedToday = "The patient has a confirmed appointment today. Check in that appointment instead";
            public const string PatientHasUnfinishedAppointment = "You already have an appointment that is not finished. Please finish or cancel it before booking a new one";
            public const string PatientHasScheduledTreatmentSession = "You already have a treatment session scheduled in your treatment plan. Please contact the clinic to change it instead of booking a new appointment";
            public const string TreatmentStageNeedsPatient = "Choose the patient record before booking a treatment plan session";
            public const string TreatmentStageNotFound = "This treatment plan session was not found for the patient";
            public const string TreatmentStageNotOpen = "This treatment plan session is already done or cancelled, or its plan is not being carried out";
            public const string TreatmentStageAlreadyBooked = "This treatment plan session already has an appointment";
            public const string PhoneNotVerified = "Please verify your phone number before booking an appointment";
            public const string ConfigMissing = "System configuration {0} is missing";
            public const string AppointmentNotFound = "Appointment not found in system";
            public const string OnlyOpenCanBeCancelled = "Only an appointment that is pending or confirmed can be cancelled";
            public const string CancelDeadlinePassed = "It is too close to the appointment time to cancel online. Please call the clinic";
            public const string OnlyOpenCanBeRescheduled = "Only an appointment that is pending or confirmed can be rescheduled";
            public const string RescheduleDeadlinePassed = "It is too close to the appointment time to reschedule online. Please call the clinic";
            public const string ReasonRequired = "Cancellation reason is required";
            public const string OnlyConfirmedCanBeCheckedIn = "Only a confirmed appointment can be checked in";
            public const string CheckInNeedsConfirmation = "This appointment is not confirmed yet. Please confirm it before check-in";
            public const string CheckInWrongDay = "Check-in is only possible on the day of the appointment";
            public const string CheckInDoctorShiftEnded = "The doctor has already ended the shift today";
            public const string DoctorNotOnShiftCannotStart = "You are not on a shift now. Start your shift to see new patients; only patients you have already examined can still be seen";
            public const string NoShowOnlyWaiting = "Only a patient who is checked in and waiting can be marked as not there";
            public const string NoShowAlreadyExamined = "The doctor has already started on this patient; the doctor completes the examination instead";
            public const string ReassignOnlyWaiting = "Only a patient who is checked in and waiting can be moved to another doctor";
            public const string ReassignAlreadyExamined = "This patient was already seen by the doctor and stays with that doctor";
            public const string ReassignWrongDay = "A patient can only be moved to another doctor on the day of the appointment";
            public const string ReassignSameDoctor = "The patient is already with this doctor";
            public const string ReassignReasonRequired = "Please enter why the patient is moved to another doctor";
            public const string DoctorNoSuitableShiftToday = "The doctor has no shift today in a room that suits these services";
            public const string DoctorProfileNotFound = "No doctor profile is linked to this account";
            public const string PriorityInvalid = "Priority must be 0 (normal), 1 (high) or 2 (urgent)";
            public const string PriorityReasonRequired = "A reason is required when the priority is above normal";
            public const string PriorityOnlyForWaiting = "The priority can only be changed while the patient is checked in and waiting";
            public const string OnlyPendingCanBeConfirmed = "Only an appointment that is waiting for confirmation can be confirmed";
            public const string OnlyCheckedInCanStartExamination = "Only a patient who is checked in can be examined";
            public const string ExaminationWrongDay = "An examination can only be started on the day of the appointment";
            public const string DoctorAlreadyExamining = "You are already examining another patient. Complete that examination first";
            public const string OnlyInServiceCanBeCompleted = "Only an examination that is in progress can be completed";
            public const string ExaminationNotFound = "No examination was found for this appointment";
            public const string ExaminationAlreadyLocked = "This examination is already completed and locked";
            public const string OnlyCheckedInCanBeStarted = "Only a checked-in appointment can be started";
            public const string NotAssignedDoctor = "You can only examine your own appointments";
            public const string ExaminationAlreadyStarted = "This appointment already has an examination";
            public const string FollowUpAlreadyScheduled = "A follow-up appointment has already been scheduled for this visit";
            public const string ExaminationNotFoundForAppointment = "No examination was found for this appointment";
        }
        public static class PatientMessage
        {
            public const string HasOpenAppointments = "This patient has appointments that are not finished yet; cancel or complete them first";
            public const string PatientNotFound = "Patient not found in system";
            public const string PhoneExist = "Phone number already exists in system";
            public const string InvalidGender = "Gender must be one of: Male, Female, Other";
            public const string InvalidBloodType = "Blood type must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-";
            public const string InvalidRecordType = "Record type must be one of: History, Condition, Allergy, Medication";
            public const string InvalidSeverity = "Severity must be one of: Mild, Moderate, Severe";
            public const string InvalidStatus = "Status must be one of: Active, Resolved, Discontinued";
            public const string InvalidDateOfBirth = "Date of birth cannot be in the future";
            public const string ContactManagedByAccount = "This patient has an account; only the patient can change the phone number or email in the app";
        }
        public static class DoctorScheduleMessage
        {
            public const string DoctorNotFound = "Doctor profile not found";
            public const string ShiftNotFound = "Work shift not found";
            public const string InvalidDateRange = "From date must be earlier than or equal to to date";
            public const string DateRangeTooLong = "You can view at most one week at a time";
            public const string ShiftNotToday = "Only a shift of today can be started or ended";
            public const string ShiftAlreadyStarted = "This shift has already been started";
            public const string ShiftTooEarlyToStart = "It is too early to start this shift";
            public const string ShiftOverCannotStart = "The time of this shift is over, it cannot be started";
            public const string ShiftNotStarted = "Start the shift before ending it";
            public const string ShiftAlreadyEnded = "This shift has already been ended";
            public const string ExaminationStillRunning = "Finish the examination in progress before ending the shift";
            public const string ShiftNotEnded = "This shift has not been ended";
            public const string ShiftTimeOver = "The time of this shift is over, it cannot be reopened";
            public const string RoomInUse = "The room is already used by another doctor's shift";
            // Texts sent to the patient; {0} doctor, {1} time, {2} date
            public const string ShiftEndedWaitingNotice = "OZE Dental: {0} has ended the shift. Please see the front desk to be moved to another doctor.";
            public const string ShiftEndedUpcomingNotice = "OZE Dental: {0} has ended the shift early. Your appointment at {1} on {2} needs to change. Please contact the front desk to reschedule.";
            public const string ShiftEndedNoticeSubject = "OZE Dental - Your appointment needs to change";
            public const string ShiftReopenedReason ="The shift was reopened after it had been ended by mistake";
            public const string NoShowReason ="The doctor ended the shift before the patient was examined";
        }
        public static class MedicalRecordMessage
        {
            public const string DoctorNotFound = "Doctor profile not found";
            public const string PatientNotFound = "Patient not found";
            public const string ExaminationNotFound = "Examination not found";
            public const string AccessDenied = "You do not have permission to view this patient's medical record";
        }

        // Writing the content of an examination: services, notes and diagnoses
        public static class ExaminationMessage
        {
            // Addenda (F-EXM-08)
            public const string AddendumOnlyLocked = "Addenda can only be added to a locked examination. Edit the examination directly";
            public const string AddendumTypeInvalid = "The addendum type must be one of: Correction, Addition, Clarification";
            public const string AddendumContentRequired = "Please enter the addendum content";
            public const string AddendumContentTooLong = "Addendum content cannot exceed 2000 characters";
            public const string AddendumOriginalRequired = "Please enter the original content being corrected";
            public const string AddendumOriginalTooLong = "Original content cannot exceed 2000 characters";
            public const string NothingRecorded = "Please record at least a diagnosis or clinical notes before completing the examination";
            public const string PrescriptionNotFinalized = "Please finalize the prescription, or delete it, before completing the examination";
            public const string NotExaminingDoctor = "You can only work on the examinations you are performing";
            public const string AlreadyLocked = "This examination is already completed and locked, it can no longer be edited";
            public const string ChiefComplaintTooLong = "The reason for the visit is too long";
            public const string ClinicalNotesTooLong = "The clinical notes are too long";
            public const string DiagnosisNameRequired = "Please enter the diagnosis name";
            public const string DiagnosisNameTooLong = "The diagnosis name is too long";
            public const string DiagnosisCodeTooLong = "The diagnosis code is too long";
            public const string DiagnosisDescriptionTooLong = "The diagnosis description is too long";
            public const string DiagnosisNotFound = "Diagnosis not found in this examination";
            public const string ServiceAlreadyAdded = "This service is already in the appointment";
            public const string ServiceItemNotFound = "Service not found in this appointment";
            public const string CannotRemoveLastService = "An appointment must keep at least one service";
            public const string VariantMismatch = "This variant does not belong to the selected service";
            public const string ToothNumberInvalid = "The tooth number is not valid. Use the FDI number, for example 46";
            public const string ToothConditionInvalid = "The tooth condition must be one of: Healthy, Caries, Filled, Crown, Missing, Denture, Implant";
            public const string ToothSurfaceTooLong = "The tooth surface is too long";
            public const string ToothSeverityTooLong = "The severity is too long";
            public const string ToothNotesTooLong = "The tooth notes are too long";
            public const string ToothFindingNotFound = "Tooth finding not found";
            public const string ToothFindingConditionRequired = "Please enter the tooth condition";
            public const string ToothFindingConditionTooLong = "The tooth condition is too long";
            public const string ToothFindingSurfaceInvalid = "Tooth surfaces must be M, O, D, B or L";
            public const string SymptomsInvalid = "Too many symptoms, or a symptom is too long";
            public const string DiagnosisTeethInvalid = "Too many teeth for one diagnosis";
            public const string ToothNotRecorded = "No change was recorded for this tooth in this examination";
            public const string MedicationNameRequired = "Please enter the medication name";
            public const string MedicationNameTooLong = "The medication name is too long";
            public const string DosageTooLong = "The dosage is too long";
            public const string FrequencyTooLong = "The frequency is too long";
            public const string DurationTooLong = "The duration is too long";
            public const string InstructionsTooLong = "The instructions are too long";
            public const string PrescriptionNotesTooLong = "The prescription note is too long";
            public const string QuantityInvalid = "The quantity must be a whole number between 1 and the allowed maximum";
            public const string PrescriptionItemNotFound = "Medication not found in this prescription";
            public const string PrescriptionFinalized = "The prescription is finalized. Reopen it to change it";
            public const string PrescriptionNothingToFinalize = "Add at least one medication before finalizing the prescription";
            public const string FollowUpDateMustBeFuture = "Follow-up date must be in the future";
            public const string FollowUpNotesTooLong = "Follow-up notes are too long";
            public const string FollowUpAppointmentAlreadyScheduled = "A follow-up appointment has already been scheduled for this examination";
            public const string FollowUpNotSet = "No follow-up date has been set for this examination";
            public const string ExaminationNotFound = "Examination not found";
        }

        // Request Imaging (UC-82). Texts follow the System Messages table of SRS Report 3.
        public static class QueueMessage
        {
            public const string EntryNotFound = "Queue number not found";
            public const string OnlyCalledCanBeSkipped = "Only a number that has been called can be skipped";
            public const string DoctorNotOnShift = "You are not on a shift now. Start your shift to call new patients; only patients you have already examined can still be called";
            public const string OnlyWaitingCanBeCalled = "Only a number that is waiting can be called";
            public const string NotInTodayQueue = "This number is not in today's queue";
            public const string NotYourPatientToCall = "You can only call your own patients";
            public const string NotYourPatient = "You can only skip your own patients";
        }

        public static class ImagingRequestMessage
        {
            // MSG07
            public const string ImagingTypeRequired = "Please enter imaging type.";
            public const string TargetAreaRequired = "Please enter target area.";
            public const string ClinicalIndicationRequired = "Please enter clinical indication.";
            // MSG66
            public const string ImagingTypeInvalid = "Imaging type is invalid. Please check again.";
            public const string TargetAreaInvalid = "Target area is invalid. Please check again.";
            public const string ClinicalIndicationInvalid = "Clinical indication is invalid. Please check again.";
            // MSG70
            public const string ExaminationNotInProgress = "Cannot request imaging because the examination is {0}.";
            // MSG71
            public const string RequestSubmitted = "Imaging request has been submitted.";
            public const string NotExaminingDoctor = "You do not have permission to request imaging for this examination.";
            public const string CannotViewRequests = "You do not have permission to view imaging requests for this examination.";
            // MSG67
            public const string RequestNotFound = "Imaging request not found.";
            public const string CannotViewRequest = "You do not have permission to view this imaging request.";
            public const string CancelReasonRequired = "Please enter cancel reason.";
            public const string CancelReasonInvalid = "Cancel reason is invalid. Please check again.";
            public const string CannotCancelRequest = "You do not have permission to cancel this imaging request.";
            public const string RequestNotPending = "Cannot cancel imaging request because the imaging request is {0}.";
            public const string RequestNotOpen = "Cannot complete imaging request because the imaging request is {0}.";
            public const string RequestCancelled = "Cancel imaging request success!";
            public const string WebhookSignatureMissing = "Missing webhook signature";
            public const string WebhookSignatureInvalid = "Invalid webhook signature";
            public const string WebhookSecretNotConfigured = "Webhook secret is not configured";
            public const string WebhookPayloadInvalid = "Invalid payload";
            // MSG02
            public const string QueueEmpty = "No Data.";
        }

        // Documents the doctor asks the patient to submit ("Yêu cầu bổ sung tài liệu")
        public static class DocumentRequestMessage
        {
            public const string DocumentNameRequired = "Please enter document name.";
            public const string DocumentNameInvalid = "Document name must be at most 200 characters.";
            public const string NoteInvalid = "Note must be at most 500 characters.";
            public const string ExaminationNotInProgress = "Cannot request documents because the examination is {0}.";
            public const string NotExaminingDoctor = "You do not have permission to request documents for this examination.";
            public const string CannotViewRequests = "You do not have permission to view document requests for this examination.";
            public const string RequestNotFound = "Document request not found.";
            public const string CannotCancelRequest = "You do not have permission to cancel this document request.";
            public const string RequestNotPending = "Cannot cancel document request because the document request is {0}.";
            public const string PatientNotFound = "Patient profile not found.";
            public const string CannotSubmit = "You do not have permission to submit documents for this request.";
            public const string RequestCancelledCannotSubmit = "Cannot submit documents because the document request is Cancelled.";
            public const string UploadFilesRequired = "Please choose at least one file.";
            public const string UploadTooManyFiles = "You can upload at most 10 files at a time.";
            public const string UploadFileTypeInvalid = "{0} is not a supported file. Use .pdf, .jpg, .jpeg or .png.";
            public const string UploadFileTooLarge = "{0} is larger than 20 MB.";
            public const string UploadFileEmpty = "{0} is empty.";
            public const string DocumentNotFound = "Document not found.";
            public const string CannotViewDocument = "You do not have permission to view this document.";
            public const string RequestCreated = "Document request has been sent to the patient.";
            public const string RequestCancelled = "Document request has been cancelled.";
            public const string FilesUploaded = "Documents uploaded.";
        }

        // Documents the patient uploads without a doctor's request ("Cung cấp tài liệu")
        public static class ProvidedDocumentMessage
        {
            public const string DocumentNameRequired = "Please enter document name.";
            public const string DocumentNameInvalid = "Document name must be at most 200 characters.";
            public const string ProviderAddressRequired = "Please enter provider address.";
            public const string ProviderAddressInvalid = "Provider address must be at most 300 characters.";
            public const string PerformedOnInFuture = "Performed date cannot be in the future.";
            public const string UploadFilesRequired = "Please choose at least one file.";
            public const string UploadTooManyFiles = "You can upload at most 5 files for a document.";
            public const string UploadFileTypeInvalid = "{0} is not a supported file. Use .pdf, .jpg, .jpeg, .png or .dcm.";
            public const string UploadFileTooLarge = "{0} is larger than 20 MB.";
            public const string UploadFileEmpty = "{0} is empty.";
            public const string DocumentNotFound = "Document not found.";
            public const string CannotDelete = "You do not have permission to delete this document.";
            public const string Uploaded = "Document uploaded.";
            public const string Deleted = "Document deleted.";
        }

        // Capturing on the X-ray simulator and reading the stored pictures
        public static class ImagingCaptureMessage
        {
            public const string TechnicianNotFound = "Imaging technician not found.";
            public const string DeviceRequired = "Please select an X-ray device.";
            public const string ImageCountInvalid = "Number of images must be between 1 and 10.";
            public const string ImagingTypeNotSupported = "The X-ray device cannot take {0}. Please upload the images by hand.";
            public const string RequestNotOpen = "Cannot capture because the imaging request is {0}.";
            public const string CaptureAlreadyRunning = "A capture is already running for this imaging request.";
            public const string CaptureNotFound = "Capture not found.";
            public const string CaptureNotRunning = "Cannot cancel because the capture is {0}.";
            public const string SimulatorUnavailable = "The X-ray device is not reachable. Please try again later.";
            public const string SimulatorRejected = "The X-ray device refused the capture: {0}";
            public const string CaptureStarted = "Capture started.";
            public const string CaptureCancelled = "Capture cancelled.";
            public const string ResultNotFound = "Image not found.";
            public const string CannotViewResult = "You do not have permission to view this image.";
            public const string HistoryStatusInvalid = "Status must be Completed or Cancelled.";
            public const string HistoryDateRangeInvalid = "The start date must not be after the end date.";
            public const string ReviewStatusInvalid = "Status must be Pending, Approved, Retake or Cancelled.";
            public const string CannotReviewRequest = "You do not have permission to review this imaging request.";
            public const string ReviewNotCompleted = "Cannot review because the imaging request is {0}.";
            public const string NothingToReview = "There is no image waiting for review.";
            public const string ReviewApproved = "Images approved.";
            public const string RetakeReasonRequired = "Please enter retake reason.";
            public const string RetakeReasonInvalid = "Retake reason is invalid. Please check again.";
            public const string RetakeRequested = "Retake requested.";
            public const string UploadFilesRequired = "Please choose at least one image.";
            public const string UploadTooManyFiles = "You can upload at most 10 images at a time.";
            public const string UploadFileTypeInvalid = "{0} is not a supported image. Use .png, .jpg, .jpeg or .dcm.";
            public const string UploadFileTooLarge = "{0} is larger than 20 MB.";
            public const string UploadFileEmpty = "{0} is empty.";
            public const string ImagesUploaded = "Images uploaded.";
        }

        public static class InvoiceMessage
        {
            public const string PatientRequired = "Please select a patient.";
            public const string PatientNotFound = "Patient not found.";
            public const string ItemsRequired = "Please add at least one invoice item.";
            public const string PlanPackageTotalRequired =
                "Plan invoice needs Items, or TotalAmount greater than 0, or a treatment plan EstimatedTotalCost greater than 0.";
            public const string PlanPackageTotalInvalid = "Plan package total must be greater than 0.";
            public const string PlanPackageRequiresTreatmentPlan =
                "Package total without Items requires a TreatmentPlanId.";
            public const string ServiceNameRequired = "Please enter service name.";
            public const string QuantityInvalid = "Quantity must be greater than 0.";
            public const string UnitPriceInvalid = "Unit price must be greater than or equal to 0.";
            public const string DiscountInvalid = "Discount amount is invalid.";
            public const string DiscountExceedsTotal = "Discount amount cannot exceed the invoice total.";
            public const string AppointmentNotFound = "Appointment not found.";
            public const string AppointmentPatientMismatch = "The appointment does not belong to this patient.";
            public const string TreatmentPlanNotFound = "Treatment plan not found.";
            public const string TreatmentPlanPatientMismatch = "The treatment plan does not belong to this patient.";
            public const string StageNotFound = "Treatment plan stage not found.";
            public const string StagePlanMismatch = "The treatment plan stage does not belong to the selected treatment plan.";
            public const string ServiceNotFound = "Service not found.";
            public const string OpenInvoiceExistsForAppointment = "An open invoice already exists for this appointment.";
            public const string OpenInvoiceExistsForTreatmentPlan = "An open invoice already exists for this treatment plan.";
            public const string InvoiceCreated = "Invoice has been created.";
            public const string InvoiceUpdated = "Invoice has been updated.";
            public const string InvoiceCancelled = "Invoice has been cancelled.";
            public const string InvoiceNotFound = "Invoice not found.";
            public const string InvoiceNotCancellable = "Invoice cannot be cancelled because a confirmed payment exists.";
            public const string InvoiceAlreadyCancelled = "Invoice is already cancelled.";
            public const string InvoiceNotUpdatable = "Invoice cannot be updated in its current state.";
            public const string InvoiceUpdateEmpty = "Please provide notes, discount, or items to update.";
            public const string InvoiceConcurrencyConflict = "Invoice was modified by another user. Please reload and try again.";
            public const string AccessDenied = "You do not have access to this invoice.";
            public const string CollectionInvalid = "Collection must be received, paid or partial.";
        }

        public static class PaymentMessage
        {
            public const string InvoiceNotFound = "Invoice not found.";
            public const string InvoiceNotPayable = "Payments cannot be recorded on this invoice.";
            public const string AmountInvalid = "Payment amount must be greater than 0.";
            public const string AmountExceedsRemaining = "Payment amount exceeds the remaining balance.";
            public const string MethodInvalid = "Payment method must be one of: CASH, BANK_TRANSFER, QR_TRANSFER.";
            public const string PurposeInvalid = "Payment purpose must be one of: Deposit, Regular, Installment.";
            public const string StatusInvalid = "Payment status must be one of: PENDING, CONFIRMED, FAILED, REFUNDED.";
            public const string PaymentNotFound = "Payment not found.";
            public const string PaymentNotPending = "Only pending payments can be confirmed.";
            public const string PaymentNotConfirmable = "Payment cannot be confirmed.";
            public const string PaymentNotVoidable = "Payment cannot be voided.";
            public const string TransactionReferenceDuplicate = "Transaction reference already exists.";
            public const string PaymentRecorded = "Payment has been recorded.";
            public const string PaymentConfirmed = "Payment has been confirmed.";
            public const string PaymentVoided = "Payment has been voided.";
            public const string InstallmentPeriodRequired = "Installment period is required for installment payments.";
            public const string InstallmentPeriodInvalid = "Installment period is invalid for this invoice.";
            public const string AccessDenied = "You do not have access to this payment.";
            public const string ConcurrencyConflict = "Payment data was modified by another user. Please reload and try again.";
            public const string ConfirmAtCashier = "This payment belongs to a cashier receipt. Confirm it on the cashier screen.";
        }

        public static class RefundMessage
        {
            public const string InvoiceNotFound = "Invoice not found.";
            public const string InvoiceNotRefundable = "Refunds cannot be requested on this invoice.";
            public const string RequestNotFound = "Refund request not found.";
            public const string ReasonRequired = "Please enter a reason.";
            public const string AmountInvalid = "Refund amount must be greater than 0.";
            public const string TypeInvalid = "Request type must be one of: Refund, Adjustment.";
            public const string StatusInvalid = "Refund request status must be one of: Pending, Approved, Rejected, Processed.";
            public const string WorkDoneAmountRequired = "Work-done amount is required before approval.";
            public const string WorkDoneAmountInvalid = "Work-done amount is invalid.";
            public const string WorkDoneExceedsPaid = "Work-done amount cannot exceed confirmed paid amount.";
            public const string RequestNotPending = "Only pending refund requests can be processed.";
            public const string RequestNotApproved = "Only approved refund requests can be paid out.";
            public const string RequestPaidOut = "Refund has been paid out.";
            public const string PendingRequestExists = "A pending refund request already exists for this invoice.";
            public const string PaymentInvalid = "Payment does not belong to this invoice or is not confirmed.";
            public const string RejectionReasonRequired = "Please enter a rejection reason.";
            public const string RequestCreated = "Refund request has been created.";
            public const string RequestApproved = "Refund request has been approved.";
            public const string RequestRejected = "Refund request has been rejected.";
            public const string RequestProcessed = "Refund request has been marked as processed.";
            public const string WorkDoneUpdated = "Work-done amount has been updated.";
            public const string NoConfirmedPayments = "There are no confirmed payments to refund.";
            public const string ConcurrencyConflict = "Refund request was modified by another user. Please reload and try again.";
        }

        public static class InstallmentMessage
        {
            public const string InvoiceNotFound = "Invoice not found.";
            public const string PlanNotFound = "Installment plan not found.";
            public const string PlanAlreadyExists = "An active installment plan already exists for this invoice.";
            public const string PeriodsRequired = "Please add at least one installment period.";
            public const string PeriodAmountInvalid = "Period amount must be greater than 0.";
            public const string PeriodDueDateInvalid = "Period due date is invalid.";
            public const string PeriodSequenceInvalid = "Period sequence must be unique and greater than 0.";
            public const string PeriodsExceedRemaining = "Sum of installment periods cannot exceed the remaining balance.";

            public const string PeriodNotFound = "Installment period not found.";
            public const string PeriodNotPayable = "Installment period cannot be paid.";
            public const string PlanCreated = "Installment plan has been created.";
        }

        public static class ReportMessage
        {
            public const string DateRangeInvalid = "Report date range is invalid. 'From' must be on or before 'To'.";
            public const string DateRangeTooLarge = "Report date range cannot exceed 366 days.";
            public const string DailyRetrieved = "Daily invoice report has been retrieved.";
            public const string OverviewRetrieved = "Invoice overview report has been retrieved.";
            public const string SeriesRangeTooLarge = "Revenue chart range cannot exceed 31 days.";
            public const string SeriesRetrieved = "Revenue by day has been retrieved.";
        }

        public static class ScheduleMessage
        {
            public const string DateRangeInvalid = "'FromDate' must be on or before 'ToDate'.";
            public const string DateRangeTooLarge = "Date range cannot exceed 62 days.";
            public const string StaffProfileNotFound = "Your staff profile was not found.";
            public const string DoctorsRetrieved = "Doctors on duty have been retrieved.";
            public const string ShiftsRetrieved = "Your shifts have been retrieved.";
        }

        public static class LeaveRequestMessage
        {
            public const string NotFound = "Leave request not found.";
            public const string StaffNotFound = "Your staff profile was not found.";
            public const string SlotInvalid = "Slot must be Morning, Afternoon or empty for the whole day.";
            public const string ReasonRequired = "Please enter the reason for the leave.";
            public const string DateInPast = "Leave can only be requested for a future shift.";
            public const string NoShiftToLeave = "You have no shift in that time to take leave from.";
            public const string ShiftAlreadyStarted = "A shift in that time has already started.";
            public const string AlreadyRequested = "You already have a pending or approved leave request for that time.";
            public const string NotOwner = "You can only cancel your own leave request.";
            public const string NotPending = "This leave request has already been decided.";
            public const string RejectReasonRequired = "Please enter the reason for rejecting.";
            public const string SubstituteRequired = "These shifts have booked appointments. Choose a substitute or reschedule the appointments first.";
            public const string SubstituteNotFound = "Substitute staff not found or inactive.";
            public const string SubstituteSamePerson = "The substitute must be another staff member.";
            public const string SubstituteWrongRole = "The substitute must have the same role.";
            public const string SubstituteBusy = "The substitute already has a shift or leave in that time.";
            public const string Created = "Leave request has been sent.";
            public const string Cancelled = "Leave request has been cancelled.";
            public const string Approved = "Leave request has been approved.";
            public const string Rejected = "Leave request has been rejected.";
        }

        public static class ConsultationMessage
        {
            public const string Created = "Your request has been sent. The clinic will call you back soon.";
            public const string AlreadySent = "A request from this phone number was sent a few minutes ago. The clinic will call you back.";
            public const string NotFound = "Consultation request not found.";
            public const string StatusInvalid = "Status must be Contacted, Booked or Closed.";
            public const string Handled = "Consultation request has been updated.";
        }

        public static class CareMessage
        {
            public const string ExaminationNotFound = "Examination not found.";
            public const string NoFollowUp = "This examination has no follow-up to contact the patient about.";
            public const string OutcomeInvalid = "Outcome must be Booked, CallBack, Unreachable or Declined.";
            public const string CallBackDateRequired = "Please choose the day to call the patient back (today or later).";
            public const string ContactRecorded = "Call result has been recorded.";
            public const string InvoiceNotFound = "Invoice not found.";
            public const string NothingOwed = "This invoice has nothing left to pay.";
            public const string NoContact = "The patient has no email to send a reminder to.";
            public const string RemindedRecently = "A payment reminder was sent less than 4 hours ago. Send again only if needed.";
            public const string PaymentReminded = "Payment reminder has been sent.";
            public const string SendFailed = "The reminder could not be sent by SMS or email. Try again later or call the patient.";
            public const string ReconciliationFutureDate = "A day can be reconciled only once it has started.";
            public const string ReconciliationDone = "This day has already been reconciled.";
            public const string ReconciliationOpenSessions = "Some cash drawers of this day are still open. Close them before reconciling.";
            public const string ReconciliationNoteRequired = "There is a cash difference, cash outside the drawers or a transfer still waiting. Please explain in the notes.";
            public const string ReconciliationConfirmed = "The day has been reconciled.";
        }

        public static class CashSessionMessage
        {
            public const string NoOpenSession = "You have no open cash session. Open one first.";
            public const string AlreadyOpen = "You already have an open cash session.";
            public const string NotFound = "Cash session not found.";
            public const string NotOwner = "You can only view your own cash sessions.";
            public const string OpeningCashInvalid = "Opening cash cannot be negative.";
            public const string ExpenseAmountInvalid = "Expense amount must be greater than 0.";
            public const string ExpenseDescriptionRequired = "Please enter what the money was spent on.";
            public const string ExpenseCategoryInvalid = "Expense category must be Supplies or Other.";
            public const string ExpenseNotFound = "Expense not found in your open session.";
            public const string ExpenseExceedsCash = "The expense is larger than the cash in the drawer.";
            public const string CountedCashInvalid = "Counted cash cannot be negative.";
            public const string DifferenceNoteRequired = "The counted cash differs from the expected cash. Please explain in the notes.";
            public const string HandoverInvalid = "The person receiving the hand-over must be another active receptionist.";
            public const string StatusInvalid = "Status must be Open or Closed.";
            // {0} receptionist, {1} opened at (clinic time)
            public const string AnotherSessionOpen = "{0} still has a cash session open since {1}. It must be closed before a new one is opened.";
            public const string SessionChanged = "This is not your open cash session any more. Reload the page.";
            public const string FiguresChanged = "The system figures changed while you were counting. Reload and count again.";
            public const string DenominationsInvalid = "Each banknote must be a valid face value with a count from 0 to 9999.";
            public const string DenominationsMismatch = "The banknote count does not add up to the counted cash.";
            public const string TransferNoteRequired = "The checked transfers differ from the confirmed transfers. Please explain in the notes.";
            public const string NoPreviousSession = "No cash session was closed earlier today.";
            public const string Opened = "Cash session has been opened.";
            public const string ExpenseAdded = "Expense has been recorded.";
            public const string ExpenseRemoved = "Expense has been removed.";
            public const string Closed = "Cash session has been closed and handed over.";
        }

        // Cashier pages (Thanh toán, Đặt cọc, Theo đợt, Ghi nhận thu tiền)
        public static class CashierMessage
        {
            public const string PatientNotFound = "Patient not found.";
            public const string PlanNotFound = "Treatment plan not found.";
            public const string PlanNotOpen = "This treatment plan is not agreed yet or is closed.";
            public const string OptionInvalid = "Payment option must be FULL, PERIODS or DEPOSIT.";
            public const string OptionLocked = "The payment option of this plan has already been chosen and cannot be changed.";
            public const string OptionNotChosen = "Choose the payment option of the plan first.";
            public const string NoLines = "Add at least one item to the receipt.";
            public const string AmountInvalid = "Amount must be a whole number greater than 0.";
            public const string KindInvalid = "Unknown receipt line.";
            public const string WrongPatient = "An item of the receipt does not belong to this patient.";
            public const string WrongPlan = "The treatment session does not belong to this plan.";
            public const string NotDepositPlan = "This plan is not paid by deposit.";
            public const string NotFullPlan = "This plan is not paid in full.";
            public const string NotCollectable = "This treatment session cannot take money now.";
            public const string OverCeiling = "The amount is more than what is still owed.";
            public const string ReceiptNotFound = "Receipt not found.";
            public const string ReceiptNotPending = "Only a receipt waiting for confirmation can be confirmed or rejected.";
            public const string VisitHasNoServices = "This visit has no service to collect.";
            public const string ReceiptCodeFailed = "Could not create a receipt code. Please try again.";
            public const string OptionSaved = "Payment option has been saved.";
            public const string ReceiptSaved = "Receipt has been recorded.";
            public const string ReceiptConfirmed = "Receipt has been confirmed.";
            public const string ReceiptRejected = "Receipt has been rejected.";
            public const string DebtAgeInvalid = "Debt age must be lt7, 7to30 or gt30.";
            public const string DebtDateRangeInvalid = "From date must be on or before to date.";
        }

        public static class PaymentWarningMessage
        {
            public const string OutstandingBalance = "Patient has outstanding invoice balance.";
            public const string OverdueInstallment = "Patient has overdue installment period(s).";
            public const string ExaminationCompleted = "Examination completed successfully.";
            public const string ExaminationCompletedWithWarnings =
                "Examination completed successfully with payment warnings.";
        }
    }
}



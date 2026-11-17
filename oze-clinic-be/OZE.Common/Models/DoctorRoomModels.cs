namespace OZE.Common.Models
{
    // The signed-in doctor's examination room today: patients still to see (in call order) and the ones done
    public class DoctorRoomResponse
    {
        public List<DoctorRoomPatientResponse> Queue { get; set; } = new();
        public List<DoctorRoomDoneResponse> Done { get; set; } = new();
    }

    public class DoctorRoomPatientResponse
    {
        // Call and skip use the queue entry, start and complete use the appointment, the exam screens use the examination
        public long QueueEntryId { get; set; }
        public long AppointmentId { get; set; }
        public string AppointmentCode { get; set; } = string.Empty;
        public long? ExaminationId { get; set; }
        public string? ExaminationStatus { get; set; }
        public int QueueNumber { get; set; }
        // WAITING, CALLED or IN_PROGRESS
        public string Status { get; set; } = string.Empty;
        public int Priority { get; set; }
        public int SkipCount { get; set; }
        // Sent for an X-ray and not back yet: the doctor cannot call the patient until the film is done
        public bool AtImaging { get; set; }
        // Back from an X-ray with the examination still open: resuming continues the same examination
        public bool IsReturning { get; set; }
        public DateTimeOffset? CalledAt { get; set; }
        public DateTimeOffset? StartedAt { get; set; }
        public DateTimeOffset? CheckInAt { get; set; }
        public TimeOnly? TimeSlotStart { get; set; }
        public string? Reason { get; set; }
        public int PatientId { get; set; }
        public string PatientCode { get; set; } = string.Empty;
        public string PatientName { get; set; } = string.Empty;
        public string? Gender { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public string? EmergencyContactPhone { get; set; }
        public List<DoctorRoomServiceResponse> Services { get; set; } = new();
    }

    public class DoctorRoomServiceResponse
    {
        public int ServiceId { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    public class DoctorRoomDoneResponse
    {
        public long AppointmentId { get; set; }
        public int QueueNumber { get; set; }
        public string PatientName { get; set; } = string.Empty;
        public DateTimeOffset? CompletedAt { get; set; }
    }
}

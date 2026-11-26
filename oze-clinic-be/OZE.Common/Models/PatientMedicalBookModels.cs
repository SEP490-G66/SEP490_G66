using System;
using System.Collections.Generic;

namespace OZE.Common.Models
{
    // The patient's own "Sổ khám bệnh": finished visits, treatment plans, films, tooth chart and history, read only
    public class PatientMedicalBookResponse
    {
        public string PatientCode { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public DateOnly? DateOfBirth { get; set; }
        public string? Gender { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Address { get; set; }
        public List<PatientBookExaminationResponse> Examinations { get; set; } = new();
        public List<PatientBookPlanResponse> TreatmentPlans { get; set; } = new();
        public List<PatientBookFilmResponse> Films { get; set; } = new();
        public List<PatientBookToothResponse> Chart { get; set; } = new();
        public List<PatientBookToothFindingResponse> ToothFindings { get; set; } = new();
        public List<PatientBookHistoryResponse> History { get; set; } = new();
    }

    public class PatientBookExaminationResponse
    {
        public long Id { get; set; }
        public long AppointmentId { get; set; }
        public string AppointmentCode => $"LH{AppointmentId:D6}";
        public int? QueueNumber { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly? TimeSlotStart { get; set; }
        public TimeOnly? TimeSlotEnd { get; set; }
        public string? DoctorName { get; set; }
        public List<string> Services { get; set; } = new();
        public string? ChiefComplaint { get; set; }
        // Primary diagnosis first
        public List<string> Diagnoses { get; set; } = new();
        public string? ClinicalNotes { get; set; }
        public List<PatientBookAddendumResponse> Addenda { get; set; } = new();
        public List<PatientBookPrescriptionResponse> Prescriptions { get; set; } = new();
        public DateOnly? FollowUpDate { get; set; }
        public string? FollowUpNotes { get; set; }
        public bool FollowUpBooked { get; set; }
        // Plans this visit belongs to: the plan made in it, or a plan stage done on its day
        public List<long> TreatmentPlanIds { get; set; } = new();
    }

    public class PatientBookAddendumResponse
    {
        public string AddendumType { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
    }

    public class PatientBookPrescriptionResponse
    {
        public string? Notes { get; set; }
        public List<PatientBookPrescriptionItemResponse> Items { get; set; } = new();
    }

    public class PatientBookPrescriptionItemResponse
    {
        public string MedicationName { get; set; } = string.Empty;
        public string? Dosage { get; set; }
        public string? Frequency { get; set; }
        public string? Duration { get; set; }
        public int? Quantity { get; set; }
        public string? Instructions { get; set; }
    }

    public class PatientBookPlanResponse
    {
        public long Id { get; set; }
        public long ExaminationId { get; set; }
        public string? PlanName { get; set; }
        public string? Description { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? DoctorName { get; set; }
        public string? Diagnosis { get; set; }
        public decimal EstimatedTotalCost { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset? ApprovedAt { get; set; }
        public List<PatientBookStageResponse> Stages { get; set; } = new();
    }

    public class PatientBookStageResponse
    {
        // Matches AppointmentResponse.PlanSession.StageId, so the patient app knows which session an appointment is for
        public long Id { get; set; }
        public int Number { get; set; }
        public string StageName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = string.Empty;
        public decimal EstimatedCost { get; set; }
        public DateOnly? ScheduledDate { get; set; }
        public DateOnly? ActualDate { get; set; }
        public string? Notes { get; set; }
    }

    public class PatientBookFilmResponse
    {
        public long ResultId { get; set; }
        public long ExaminationId { get; set; }
        public string ImagingType { get; set; } = string.Empty;
        public string? TargetArea { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public string? DoctorName { get; set; }
        public string? DoctorNotes { get; set; }
    }

    public class PatientBookToothResponse
    {
        public long ExaminationId { get; set; }
        public DateOnly Date { get; set; }
        public string ToothNumber { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string? Surface { get; set; }
        public string? Notes { get; set; }
    }

    public class PatientBookToothFindingResponse
    {
        public long ExaminationId { get; set; }
        public DateOnly Date { get; set; }
        public string ToothNumber { get; set; } = string.Empty;
        public string Condition { get; set; } = string.Empty;
        public string? Surfaces { get; set; }
        public string? Notes { get; set; }
    }

    public class PatientBookHistoryResponse
    {
        public string RecordType { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Severity { get; set; }
        public DateOnly? StartDate { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}

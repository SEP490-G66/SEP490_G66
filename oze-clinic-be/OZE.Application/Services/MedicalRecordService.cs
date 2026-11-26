using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace OZE.Application.Services
{
    public class MedicalRecordService : IMedicalRecordService
    {
        private readonly IMedicalRecordRepository _medicalRecordRepository;
        private readonly IStaffRepository _staffRepository;

        public MedicalRecordService(IMedicalRecordRepository medicalRecordRepository, IStaffRepository staffRepository)
        {
            _medicalRecordRepository = medicalRecordRepository;
            _staffRepository = staffRepository;
        }

        public async Task<PatientMedicalRecordResponse> GetPatientRecordAsync(string userId, int patientId)
        {
            var patient = await _medicalRecordRepository.GetPatientAsync(patientId);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.MedicalRecordMessage.PatientNotFound);
            await EnsureAccessAsync(userId, patientId);

            var profiles = await _medicalRecordRepository.GetActiveMedicalProfilesAsync(patientId);
            var examinations = await _medicalRecordRepository.GetExaminationsAsync(patientId);

            return new PatientMedicalRecordResponse
            {
                PatientId = patient!.Id,
                PatientCode = patient.PatientCode,
                FullName = patient.FullName,
                DateOfBirth = patient.DateOfBirth,
                Gender = patient.Gender,
                PhoneNumber = patient.PhoneNumber,
                BloodType = patient.BloodType,
                Notes = patient.Notes,
                MedicalProfiles = profiles.Select(x => new MedicalProfileResponse
                {
                    Id = x.Id,
                    RecordType = x.RecordType,
                    Title = x.Title,
                    Description = x.Description,
                    Severity = x.Severity
                }).ToList(),
                Examinations = examinations.Select(x => new ExaminationSummaryResponse
                {
                    Id = x.Id,
                    AppointmentDate = x.Appointment.AppointmentDate,
                    DoctorName = x.Doctor.FullName,
                    ChiefComplaint = x.ChiefComplaint,
                    PrimaryDiagnosis = x.Diagnoses.FirstOrDefault(d => d.IsPrimary)?.DiagnosisName,
                    ExaminationStatus = x.ExaminationStatus,
                    FollowUpDate = x.FollowUpDate,
                    FollowUpNotes = x.FollowUpNotes,
                    NextAppointmentText = x.FollowUpDate.HasValue ? $"Tái khám ngày {x.FollowUpDate.Value:dd/MM/yyyy}{(x.FollowUpAppointmentId != null ? string.Empty : " · chưa xác nhận")}" : null
                }).ToList()
            };
        }

        public async Task<ExaminationDetailResponse> GetExaminationDetailAsync(string userId, long examinationId)
        {
            var exam = await _medicalRecordRepository.GetExaminationDetailAsync(examinationId);
            ConditionGuard.Ensure<NotFoundException>(exam != null, ErrorConstants.MedicalRecordMessage.ExaminationNotFound);
            await EnsureAccessAsync(userId, exam!.PatientId);

            return new ExaminationDetailResponse
            {
                Id = exam.Id,
                PatientId = exam.PatientId,
                AppointmentDate = exam.Appointment.AppointmentDate,
                DoctorName = exam.Doctor.FullName,
                ChiefComplaint = exam.ChiefComplaint,
                ClinicalNotes = exam.ClinicalNotes,
                ExaminationStatus = exam.ExaminationStatus,
                FollowUpDate = exam.FollowUpDate,
                FollowUpNotes = exam.FollowUpNotes,
                FollowUp = exam.ToFollowUpSummary(),
                Diagnoses = exam.Diagnoses
                    .OrderByDescending(d => d.IsPrimary)
                    .Select(d => new DiagnosisResponse
                    {
                        Id = d.Id,
                        DiagnosisCode = d.DiagnosisCode,
                        DiagnosisName = d.DiagnosisName,
                        Description = d.Description,
                        IsPrimary = d.IsPrimary
                    }).ToList(),
                Prescriptions = exam.Prescriptions.Select(p => new PrescriptionResponse
                {
                    Id = p.Id,
                    Status = p.Status,
                    Notes = p.Notes,
                    Items = p.Items.OrderBy(i => i.SortOrder).Select(i => new PrescriptionItemResponse
                    {
                        Id = i.Id,
                        MedicationName = i.MedicationName,
                        Dosage = i.Dosage,
                        Frequency = i.Frequency,
                        Duration = i.Duration,
                        Quantity = i.Quantity,
                        Instructions = i.Instructions
                    }).ToList()
                }).ToList(),
                TreatmentPlans = exam.TreatmentPlans.Select(t => new TreatmentPlanSummaryResponse
                {
                    Id = t.Id,
                    PlanName = t.PlanName,
                    Status = t.Status,
                    TotalStages = t.TotalStages,
                    EstimatedTotalCost = t.EstimatedTotalCost
                }).ToList(),
                // AC4: images rejected for poor quality are hidden
                Images = exam.ImagingRequests
                    .SelectMany(r => r.Results
                        .Where(img => img.ReviewStatus != MedicalRecordConstants.RejectedImageStatus)
                        .Select(img => new ImagingResponse
                        {
                            ResultId = img.Id,
                            ImagingType = r.ImagingType,
                            TargetArea = r.TargetArea,
                            FileName = img.FileName,
                            FilePath = img.FilePath,
                            ReviewStatus = img.ReviewStatus,
                            DoctorNotes = img.DoctorNotes,
                            CreatedAt = img.CreatedAt
                        }))
                    .OrderBy(img => img.CreatedAt)
                    .ToList()
            };
        }

        public async Task<PatientMedicalBookResponse> GetMyMedicalBookAsync(string userId, CancellationToken cancellationToken = default)
        {
            var patient = await _medicalRecordRepository.GetPatientByUserIdAsync(userId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.AppointmentMessage.PatientProfileNotFound);

            var examinations = await _medicalRecordRepository.GetFinishedExaminationsForBookAsync(patient!.Id, cancellationToken);
            var plans = await _medicalRecordRepository.GetTreatmentPlansForBookAsync(patient.Id, cancellationToken);
            var profiles = await _medicalRecordRepository.GetActiveMedicalProfilesAsync(patient.Id);

            return new PatientMedicalBookResponse
            {
                PatientCode = patient.PatientCode,
                FullName = patient.FullName,
                DateOfBirth = patient.DateOfBirth,
                Gender = patient.Gender,
                PhoneNumber = patient.PhoneNumber,
                Address = patient.Address,
                Examinations = examinations.Select(x => ToBookExamination(x, plans)).ToList(),
                TreatmentPlans = plans.Select(ToBookPlan).ToList(),
                Films = examinations
                    .SelectMany(x => x.ImagingRequests.SelectMany(r => r.Results
                        .Where(img => img.ReviewStatus == MedicalRecordConstants.ReviewedImageStatus)
                        .Select(img => new PatientBookFilmResponse
                        {
                            ResultId = img.Id,
                            ExaminationId = x.Id,
                            ImagingType = r.ImagingType,
                            TargetArea = r.TargetArea,
                            CreatedAt = img.CreatedAt,
                            DoctorName = img.ReviewedByDoctor?.FullName ?? x.Doctor?.FullName,
                            DoctorNotes = img.DoctorNotes
                        })))
                    .OrderByDescending(f => f.CreatedAt)
                    .ToList(),
                Chart = examinations
                    .SelectMany(x => x.DentalChartEntries.Select(c => new PatientBookToothResponse
                    {
                        ExaminationId = x.Id,
                        Date = x.Appointment.AppointmentDate,
                        ToothNumber = c.ToothNumber,
                        Condition = c.Condition,
                        Surface = c.Surface,
                        Notes = c.Notes
                    }))
                    .ToList(),
                ToothFindings = examinations
                    .SelectMany(x => x.ToothFindings.Where(f => !f.IsReplaced).Select(f => new PatientBookToothFindingResponse
                    {
                        ExaminationId = x.Id,
                        Date = x.Appointment.AppointmentDate,
                        ToothNumber = f.ToothNumber,
                        Condition = f.Condition,
                        Surfaces = f.Surfaces,
                        Notes = f.Notes
                    }))
                    .ToList(),
                History = profiles.Select(x => new PatientBookHistoryResponse
                {
                    RecordType = x.RecordType,
                    Title = x.Title,
                    Description = x.Description,
                    Severity = x.Severity,
                    StartDate = x.StartDate,
                    UpdatedAt = x.UpdatedAt ?? x.CreatedAt
                }).ToList()
            };
        }

        private static PatientBookExaminationResponse ToBookExamination(OZE.Domain.Entities.Examination exam, List<OZE.Domain.Entities.TreatmentPlan> plans)
        {
            var date = exam.Appointment.AppointmentDate;
            return new PatientBookExaminationResponse
            {
                Id = exam.Id,
                AppointmentId = exam.AppointmentId,
                QueueNumber = exam.Appointment.QueueEntries
                    .Where(q => q.QueueType == QueueConstants.ExaminationType && q.Status != QueueConstants.Cancelled)
                    .OrderByDescending(q => q.CreatedAt)
                    .Select(q => (int?)q.QueueNumber)
                    .FirstOrDefault(),
                Date = date,
                TimeSlotStart = exam.Appointment.TimeSlotStart,
                TimeSlotEnd = exam.Appointment.TimeSlotEnd,
                DoctorName = exam.Doctor?.FullName,
                Services = exam.Appointment.ServiceItems
                    .Select(i => i.Variant == null ? i.Service.ServiceName : $"{i.Service.ServiceName} · {i.Variant.VariantName}")
                    .ToList(),
                ChiefComplaint = exam.ChiefComplaint,
                Diagnoses = exam.Diagnoses
                    .OrderByDescending(d => d.IsPrimary)
                    .ThenBy(d => d.CreatedAt)
                    .Select(d => string.IsNullOrWhiteSpace(d.Teeth) ? d.DiagnosisName : $"{d.DiagnosisName} (răng {d.Teeth})")
                    .ToList(),
                ClinicalNotes = exam.ClinicalNotes,
                Addenda = exam.Addenda
                    .OrderBy(a => a.CreatedAt)
                    .Select(a => new PatientBookAddendumResponse { AddendumType = a.AddendumType, Content = a.Content, CreatedAt = a.CreatedAt })
                    .ToList(),
                Prescriptions = exam.Prescriptions
                    .Where(p => p.Status == MedicalRecordConstants.FinalizedPrescriptionStatus)
                    .OrderBy(p => p.CreatedAt)
                    .Select(p => new PatientBookPrescriptionResponse
                    {
                        Notes = p.Notes,
                        Items = p.Items.OrderBy(i => i.SortOrder).Select(i => new PatientBookPrescriptionItemResponse
                        {
                            MedicationName = i.MedicationName,
                            Dosage = i.Dosage,
                            Frequency = i.Frequency,
                            Duration = i.Duration,
                            Quantity = i.Quantity,
                            Instructions = i.Instructions
                        }).ToList()
                    })
                    .ToList(),
                FollowUpDate = exam.FollowUpDate,
                FollowUpNotes = exam.FollowUpNotes,
                FollowUpBooked = exam.FollowUpAppointmentId != null,
                TreatmentPlanIds = plans
                    .Where(p => p.ExaminationId == exam.Id || p.Stages.Any(s => s.ActualDate == date))
                    .Select(p => p.Id)
                    .ToList()
            };
        }

        private static PatientBookPlanResponse ToBookPlan(OZE.Domain.Entities.TreatmentPlan plan) => new()
        {
            Id = plan.Id,
            ExaminationId = plan.ExaminationId,
            PlanName = plan.PlanName,
            Description = plan.Description,
            Status = plan.Status,
            DoctorName = plan.CreatedByDoctor?.FullName,
            Diagnosis = plan.Examination?.Diagnoses
                .OrderByDescending(d => d.IsPrimary)
                .Select(d => d.DiagnosisName)
                .FirstOrDefault(),
            EstimatedTotalCost = plan.EstimatedTotalCost,
            CreatedAt = plan.CreatedAt,
            ApprovedAt = plan.ApprovedAt,
            Stages = plan.Stages
                .OrderBy(s => s.StageNumber)
                .Select(s => new PatientBookStageResponse
                {
                    Id = s.Id,
                    Number = s.StageNumber,
                    StageName = s.StageName ?? string.Empty,
                    Description = s.Description,
                    Status = s.StageStatus,
                    EstimatedCost = s.EstimatedCost,
                    ScheduledDate = s.ScheduledDate,
                    ActualDate = s.ActualDate,
                    Notes = s.Notes
                })
                .ToList()
        };

        // AC5
        private async Task EnsureAccessAsync(string userId, int patientId)
        {
            var doctor = await _staffRepository.GetByUserIdAsync(userId);
            ConditionGuard.Ensure<NotFoundException>(doctor != null, ErrorConstants.MedicalRecordMessage.DoctorNotFound);

            var hasAccess = await _medicalRecordRepository.HasDoctorAccessAsync(doctor!.Id, patientId);
            ConditionGuard.Ensure<ForbiddenException>(hasAccess, ErrorConstants.MedicalRecordMessage.AccessDenied);
        }
    }
}

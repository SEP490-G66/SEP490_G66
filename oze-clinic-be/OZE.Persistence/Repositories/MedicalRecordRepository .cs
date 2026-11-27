using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace OZE.Persistence.Repositories
{
    public class MedicalRecordRepository : IMedicalRecordRepository
    {
        private readonly AppIdentityDbContext _context;

        public MedicalRecordRepository(AppIdentityDbContext context)
        {
            _context = context;
        }
        public async Task<Patient?> GetPatientAsync(int patientId)
        {
            return await _context.Patients
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == patientId && x.DeletedAt == null);
        }

        public async Task<List<PatientMedicalProfile>> GetActiveMedicalProfilesAsync(int patientId)
        {
            return await _context.PatientMedicalProfiles
                .AsNoTracking()
                .Where(x => x.PatientId == patientId && x.Status == MedicalRecordConstants.ActiveProfileStatus)
                .OrderBy(x => x.RecordType)
                .ToListAsync();
        }

        // AC2: newest visit first
        public async Task<List<Examination>> GetExaminationsAsync(int patientId)
        {
            return await _context.Examinations
                .AsNoTracking()
                .Include(x => x.Appointment)
                .Include(x => x.Doctor)
                .Include(x => x.FollowUpAppointment).ThenInclude(x => x!.Doctor)
                .Include(x => x.Diagnoses)
                .Where(x => x.PatientId == patientId)
                .OrderByDescending(x => x.Appointment.AppointmentDate)
                .ThenByDescending(x => x.CreatedAt)
                .ToListAsync();
        }

      
        public async Task<Examination?> GetExaminationDetailAsync(long examinationId)
        {
            return await _context.Examinations
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.Appointment)
                .Include(x => x.Doctor)
                .Include(x => x.FollowUpAppointment).ThenInclude(x => x!.Doctor)
                .Include(x => x.Diagnoses)
                .Include(x => x.Prescriptions).ThenInclude(p => p.Items)
                .Include(x => x.TreatmentPlans)
                .Include(x => x.ImagingRequests).ThenInclude(r => r.Results)
                // The record of a deleted patient is not shown here either, as on the patient's own record
                .FirstOrDefaultAsync(x => x.Id == examinationId && x.Patient.DeletedAt == null);
        }

        // Same rule as HasDoctorAccessAsync, so every patient listed opens; never examined patients come last
        public async Task<PagedResult<DoctorPatientResponse>> GetDoctorPatientsAsync(
            int doctorId, string? keyword, string? phoneDigits, int pageNumber, int pageSize, CancellationToken cancellationToken = default)
        {
            var statuses = MedicalRecordConstants.AccessAppointmentStatuses;
            var query = _context.Patients
                .AsNoTracking()
                .Where(p => p.DeletedAt == null
                    && (_context.Examinations.Any(e => e.PatientId == p.Id && e.DoctorId == doctorId)
                        || _context.Appointments.Any(a => a.PatientId == p.Id && a.DoctorId == doctorId && statuses.Contains(a.Status))));

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(p => p.FullName.Contains(keyword)
                    || p.PatientCode.Contains(keyword)
                    || (p.PhoneNumber != null && (p.PhoneNumber.Contains(keyword) || (phoneDigits != null && p.PhoneNumber.Contains(phoneDigits)))));
            }

            var totalCount = await query.CountAsync(cancellationToken);
            var items = await query
                .Select(p => new DoctorPatientResponse
                {
                    PatientId = p.Id,
                    PatientCode = p.PatientCode,
                    FullName = p.FullName,
                    Gender = p.Gender,
                    DateOfBirth = p.DateOfBirth,
                    PhoneNumber = p.PhoneNumber,
                    LastVisitDate = _context.Examinations
                        .Where(e => e.PatientId == p.Id)
                        .Max(e => (DateOnly?)e.Appointment.AppointmentDate)
                })
                // SQL Server sorts NULL lowest, so patients never examined end the list
                .OrderByDescending(x => x.LastVisitDate)
                .ThenBy(x => x.FullName)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return new PagedResult<DoctorPatientResponse>
            {
                Items = items,
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize
            };
        }

        public async Task<bool> HasDoctorAccessAsync(int doctorId, int patientId)
        {
            var hasExamined = await _context.Examinations
                .AnyAsync(x => x.PatientId == patientId && x.DoctorId == doctorId);
            if (hasExamined)
            {
                return true;
            }

            // A booking not yet confirmed, or one the patient never came to, does not open the record
            return await _context.Appointments
                .AnyAsync(x => x.PatientId == patientId && x.DoctorId == doctorId
                    && MedicalRecordConstants.AccessAppointmentStatuses.Contains(x.Status));
        }

        public async Task<Patient?> GetPatientByUserIdAsync(string userId, CancellationToken cancellationToken = default)
        {
            return await _context.Patients
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.UserId == userId && x.DeletedAt == null, cancellationToken);
        }

        public async Task<List<Examination>> GetFinishedExaminationsForBookAsync(int patientId, CancellationToken cancellationToken = default)
        {
            return await _context.Examinations
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.Appointment).ThenInclude(a => a.ServiceItems).ThenInclude(i => i.Service)
                .Include(x => x.Appointment).ThenInclude(a => a.ServiceItems).ThenInclude(i => i.Variant)
                .Include(x => x.Appointment).ThenInclude(a => a.QueueEntries)
                .Include(x => x.Doctor)
                .Include(x => x.Diagnoses)
                .Include(x => x.Addenda)
                .Include(x => x.Prescriptions).ThenInclude(p => p.Items)
                .Include(x => x.DentalChartEntries)
                .Include(x => x.ToothFindings)
                .Include(x => x.ImagingRequests).ThenInclude(r => r.Results).ThenInclude(i => i.ReviewedByDoctor)
                .Where(x => x.PatientId == patientId
                    && (x.ExaminationStatus == ExaminationConstants.Completed || x.ExaminationStatus == ExaminationConstants.Locked))
                .OrderByDescending(x => x.Appointment.AppointmentDate)
                .ThenByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<TreatmentPlan>> GetTreatmentPlansForBookAsync(int patientId, CancellationToken cancellationToken = default)
        {
            return await _context.TreatmentPlans
                .AsNoTracking()
                .AsSplitQuery()
                .Include(x => x.Stages)
                .Include(x => x.CreatedByDoctor)
                .Include(x => x.Examination).ThenInclude(e => e.Diagnoses)
                .Where(x => x.PatientId == patientId && MedicalRecordConstants.PatientVisiblePlanStatuses.Contains(x.Status))
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);
        }
    }
}

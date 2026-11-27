using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace OZE.Application.Interfaces
{
    public interface IMedicalRecordRepository
    {
        Task<Patient?> GetPatientAsync(int patientId);
        Task<List<PatientMedicalProfile>> GetActiveMedicalProfilesAsync(int patientId);
        Task<List<Examination>> GetExaminationsAsync(int patientId);
        Task<Examination?> GetExaminationDetailAsync(long examinationId);
        Task<bool> HasDoctorAccessAsync(int doctorId, int patientId);
        // The patients HasDoctorAccessAsync lets the doctor open, latest visit first. keyword: name / code / phone;
        // phoneDigits: the keyword as a national number without its 0 / +84 prefix, also matched against the phone.
        Task<PagedResult<DoctorPatientResponse>> GetDoctorPatientsAsync(int doctorId, string? keyword, string? phoneDigits, int pageNumber, int pageSize, CancellationToken cancellationToken = default);
        Task<Patient?> GetPatientByUserIdAsync(string userId, CancellationToken cancellationToken = default);
        // The patient's finished visits with everything the patient's medical book shows
        Task<List<Examination>> GetFinishedExaminationsForBookAsync(int patientId, CancellationToken cancellationToken = default);
        Task<List<TreatmentPlan>> GetTreatmentPlansForBookAsync(int patientId, CancellationToken cancellationToken = default);
    }
}

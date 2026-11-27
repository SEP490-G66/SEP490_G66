using OZE.Common.Models;
using OZE.Common.Models.Base;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace OZE.Application.Interfaces
{
    public interface IMedicalRecordService
    {
        // The doctor's "Hồ sơ bệnh án" list: the patients whose record the doctor may open
        Task<PagedResult<DoctorPatientResponse>> GetMyPatientsAsync(string userId, DoctorPatientQuery query, CancellationToken cancellationToken = default);
        Task<PatientMedicalRecordResponse> GetPatientRecordAsync(string userId, int patientId);
        Task<ExaminationDetailResponse> GetExaminationDetailAsync(string userId, long examinationId);
        // The signed-in patient's own medical book, read only
        Task<PatientMedicalBookResponse> GetMyMedicalBookAsync(string userId, CancellationToken cancellationToken = default);
    }
}

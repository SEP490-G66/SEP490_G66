using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using System.Security.Claims;

namespace OZE.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/medical-records")]
    public class MedicalRecordsController : BaseApiController
    {
        private readonly IMedicalRecordService _medicalRecordService;

        public MedicalRecordsController(IMedicalRecordService medicalRecordService)
        {
            _medicalRecordService = medicalRecordService;
        }

        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpGet("patients/{patientId:int}")]
        public async Task<ActionResult<ApiResponse<PatientMedicalRecordResponse>>> GetPatientRecordAsync(int patientId)
        {
            var record = await _medicalRecordService.GetPatientRecordAsync(CurrentUserId ?? string.Empty, patientId);
            return Ok(ApiResponse<PatientMedicalRecordResponse>.SuccessResult(record));
        }

        [Authorize(Roles = RoleConstants.DoctorRole)]
        [HttpGet("examinations/{examinationId:long}")]
        public async Task<ActionResult<ApiResponse<ExaminationDetailResponse>>> GetExaminationDetailAsync(long examinationId)
        {
            var detail = await _medicalRecordService.GetExaminationDetailAsync(CurrentUserId ?? string.Empty, examinationId);
            return Ok(ApiResponse<ExaminationDetailResponse>.SuccessResult(detail));
        }

        /// <summary>
        /// The signed-in patient's own medical book: finished visits, treatment plans, films, tooth chart and history.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpGet("my")]
        public async Task<ActionResult<ApiResponse<PatientMedicalBookResponse>>> GetMyMedicalBookAsync(CancellationToken cancellationToken)
        {
            var book = await _medicalRecordService.GetMyMedicalBookAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<PatientMedicalBookResponse>.SuccessResult(book));
        }
    }
}

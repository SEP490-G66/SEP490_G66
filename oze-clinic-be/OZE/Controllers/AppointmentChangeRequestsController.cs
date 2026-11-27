using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    // "Xin đổi / huỷ lịch": the patient asks about a visit the clinic arranged; the front desk handles it.
    [ApiController]
    [Authorize]
    [Route("api/appointment-change-requests")]
    public class AppointmentChangeRequestsController : BaseApiController
    {
        private readonly IAppointmentChangeRequestService _service;

        public AppointmentChangeRequestsController(IAppointmentChangeRequestService service)
        {
            _service = service;
        }

        /// <summary>
        /// The patient asks to reschedule or cancel a booked session / follow-up (appointmentId) or a treatment session
        /// with no appointment yet (treatmentPlanStageId). The visit stays as it is until the front desk acts.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpPost]
        public async Task<ActionResult<ApiResponse<AppointmentChangeRequestResponse>>> CreateAsync(
            [FromBody] CreateAppointmentChangeRequest request,
            CancellationToken cancellationToken)
        {
            var created = await _service.CreateAsync(CurrentUserId ?? string.Empty, request, cancellationToken);
            return Ok(ApiResponse<AppointmentChangeRequestResponse>.SuccessResult(created, ErrorConstants.AppointmentChangeRequestMessage.Created));
        }

        /// <summary>
        /// The signed-in patient's requests, newest first.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpGet("my")]
        public async Task<ActionResult<ApiResponse<List<AppointmentChangeRequestResponse>>>> GetMineAsync(CancellationToken cancellationToken)
        {
            var requests = await _service.GetMineAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<List<AppointmentChangeRequestResponse>>.SuccessResult(requests));
        }

        /// <summary>
        /// The patient takes back a request the front desk has not handled yet.
        /// </summary>
        [Authorize(Roles = RoleConstants.PatientRole)]
        [HttpPost("{id:long}/withdraw")]
        public async Task<ActionResult<ApiResponse<AppointmentChangeRequestResponse>>> WithdrawAsync(long id, CancellationToken cancellationToken)
        {
            var withdrawn = await _service.WithdrawAsync(CurrentUserId ?? string.Empty, id, cancellationToken);
            return Ok(ApiResponse<AppointmentChangeRequestResponse>.SuccessResult(withdrawn, ErrorConstants.AppointmentChangeRequestMessage.Withdrawn));
        }

        /// <summary>
        /// Front desk: every request (status: Pending, Rescheduled, Cancelled, Kept, Withdrawn; empty = all), newest first.
        /// </summary>
        [Authorize(Roles = RoleConstants.ReceptionistRole + "," + RoleConstants.ClinicManagerRole)]
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<AppointmentChangeRequestResponse>>>> GetAllAsync([FromQuery] string? status, CancellationToken cancellationToken)
        {
            var requests = await _service.GetAllAsync(status, cancellationToken);
            return Ok(ApiResponse<List<AppointmentChangeRequestResponse>>.SuccessResult(requests));
        }

        /// <summary>
        /// Front desk: records what was done (Rescheduled, Cancelled or Kept) after calling the patient; the patient is notified.
        /// </summary>
        [Authorize(Roles = RoleConstants.ReceptionistRole)]
        [HttpPost("{id:long}/resolve")]
        public async Task<ActionResult<ApiResponse<AppointmentChangeRequestResponse>>> ResolveAsync(
            long id,
            [FromBody] ResolveAppointmentChangeRequest request,
            CancellationToken cancellationToken)
        {
            var resolved = await _service.ResolveAsync(CurrentUserId ?? string.Empty, id, request, cancellationToken);
            return Ok(ApiResponse<AppointmentChangeRequestResponse>.SuccessResult(resolved, ErrorConstants.AppointmentChangeRequestMessage.Resolved));
        }
    }
}

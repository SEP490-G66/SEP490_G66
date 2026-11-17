using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    [ApiController]
    [Authorize(Roles = RoleConstants.DoctorRole)]
    [Route("api/doctor-room")]
    public class DoctorRoomController : BaseApiController
    {
        private readonly IDoctorRoomService _doctorRoomService;

        public DoctorRoomController(IDoctorRoomService doctorRoomService)
        {
            _doctorRoomService = doctorRoomService;
        }

        /// <summary>
        /// The signed-in doctor's examination queue for today, in call order, with the queue entry, appointment and examination
        /// of each patient; plus the patients already done today.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<DoctorRoomResponse>>> GetAsync(CancellationToken cancellationToken)
        {
            var room = await _doctorRoomService.GetAsync(CurrentUserId ?? string.Empty, cancellationToken);
            return Ok(ApiResponse<DoctorRoomResponse>.SuccessResult(room));
        }
    }
}

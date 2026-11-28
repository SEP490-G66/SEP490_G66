using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    [ApiController]
    [AllowAnonymous]
    [Route("api/clinic")]
    public class ClinicController : ControllerBase
    {
        /// <summary>
        /// The clinic's current time. Screens take "now" from here instead of the device clock, so a fake time set with
        /// Clinic:FakeNow on a test server reaches the frontend too.
        /// </summary>
        [HttpGet("now")]
        public ActionResult<ApiResponse<ClinicNowResponse>> GetNow()
        {
            var now = ClinicClock.UtcNow;
            var clinicTime = ClinicClock.ToClinicTime(now);
            return Ok(ApiResponse<ClinicNowResponse>.SuccessResult(new ClinicNowResponse
            {
                UtcNow = now,
                ClinicTime = clinicTime.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture),
                Today = clinicTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                TimeZone = ClinicTimeConstants.IanaTimeZoneId,
                IsFake = ClinicClock.IsFake,
                IsFrozen = ClinicClock.IsFrozen
            }));
        }
    }
}

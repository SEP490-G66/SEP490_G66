using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    /// <summary>
    /// System settings (booking limits, check-in times, opening hours...) for the clinic manager.
    /// Only the value of an existing setting can be changed.
    /// </summary>
    [Route("api/system-configs")]
    [Authorize(Roles = RoleConstants.ClinicManagerRole)]
    public class SystemConfigsController : BaseApiController
    {
        private readonly ISystemConfigurationService _systemConfigurationService;

        public SystemConfigsController(ISystemConfigurationService systemConfigurationService)
        {
            _systemConfigurationService = systemConfigurationService;
        }

        /// <summary>
        /// Every setting with its value, type and description.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ApiResponse<List<SystemConfigurationResponse>>>> GetAllAsync(CancellationToken cancellationToken)
        {
            var result = await _systemConfigurationService.GetAllAsync(cancellationToken);
            return Ok(ApiResponse<List<SystemConfigurationResponse>>.SuccessResult(result));
        }

        /// <summary>
        /// One setting by its key, e.g. Booking.CancelCutoffHours.
        /// </summary>
        [HttpGet("{key}")]
        public async Task<ActionResult<ApiResponse<SystemConfigurationResponse>>> GetByKeyAsync([FromRoute] string key, CancellationToken cancellationToken)
        {
            var result = await _systemConfigurationService.GetByKeyAsync(key, cancellationToken);
            return Ok(ApiResponse<SystemConfigurationResponse>.SuccessResult(result));
        }

        /// <summary>
        /// Changes the value of one setting. The value is checked against the setting's type; the change is written to the audit log.
        /// </summary>
        [HttpPut("{key}")]
        public async Task<ActionResult<ApiResponse<SystemConfigurationResponse>>> UpdateAsync(
            [FromRoute] string key,
            [FromBody] UpdateSystemConfigurationRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _systemConfigurationService.UpdateAsync(key, request.Value, CurrentUserId!, cancellationToken);
            return Ok(ApiResponse<SystemConfigurationResponse>.SuccessResult(result, "Configuration updated successfully"));
        }
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Common.Models.Base;

namespace OZE.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ServicesController : ControllerBase
    {
        private readonly IClinicServiceService _clinicService;

        public ServicesController(IClinicServiceService clinicService)
        {
            _clinicService = clinicService;
        }

        /// <summary>
        /// Retrieves a paginated list of clinic services with optional filtering, search, and sorting.
        /// </summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<PagedResult<ServiceDto>>>> GetServicesAsync(
            [FromQuery] ServiceQueryParameters query,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetServicesAsync(query, cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Retrieves all active clinic services (useful for booking forms and dropdown menus).
        /// </summary>
        [HttpGet("active")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<ServiceDto>>>> GetActiveServicesAsync(
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetActiveServicesAsync(cancellationToken);
            return Ok(result);
        }

        /// <summary>
        /// Retrieves a single clinic service by its ID.
        /// </summary>
        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> GetServiceByIdAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetServiceByIdAsync(id, cancellationToken);
            if (!result.Success)
            {
                return NotFound(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Retrieves a single clinic service by its unique service code.
        /// </summary>
        [HttpGet("by-code/{code}")]
        [AllowAnonymous]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> GetServiceByCodeAsync(
            [FromRoute] string code,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetServiceByCodeAsync(code, cancellationToken);
            if (!result.Success)
            {
                return NotFound(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Creates a new clinic service. Requires ClinicManager role.
        /// </summary>
        [HttpPost]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> CreateServiceAsync(
            [FromBody] CreateServiceRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.CreateServiceAsync(request, cancellationToken);
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return CreatedAtAction(
                nameof(GetServiceByIdAsync),
                new { id = result.Data!.Id },
                result);
        }

        /// <summary>
        /// Updates an existing clinic service. Requires ClinicManager role.
        /// </summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> UpdateServiceAsync(
            [FromRoute] int id,
            [FromBody] UpdateServiceRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.UpdateServiceAsync(id, request, cancellationToken);
            if (!result.Success)
            {
                if (result.Message == ErrorConstants.ServiceMessage.ServiceNotFound)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Toggles or updates the active status of a clinic service. Requires ClinicManager role.
        /// </summary>
        [HttpPatch("{id:int}/status")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> ToggleStatusAsync(
            [FromRoute] int id,
            [FromBody] ToggleServiceStatusRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.ToggleServiceStatusAsync(id, request.IsActive, cancellationToken);
            if (!result.Success)
            {
                if (result.Message == ErrorConstants.ServiceMessage.ServiceNotFound)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Deactivates a clinic service (SDS Section 7.5). Requires ClinicManager role.
        /// </summary>
        [HttpPatch("{id:int}/deactivate")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> DeactivateServiceAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.DeactivateServiceAsync(id, cancellationToken);
            if (!result.Success)
            {
                if (result.Message == ErrorConstants.ServiceMessage.ServiceNotFound)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Activates a clinic service. Requires ClinicManager role.
        /// </summary>
        [HttpPatch("{id:int}/activate")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> ActivateServiceAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.ActivateServiceAsync(id, cancellationToken);
            if (!result.Success)
            {
                if (result.Message == ErrorConstants.ServiceMessage.ServiceNotFound)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Deletes a clinic service. If the service is referenced by invoices or treatment plans, deletion is rejected. Requires ClinicManager role.
        /// </summary>
        [HttpDelete("{id:int}")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteServiceAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.DeleteServiceAsync(id, cancellationToken);
            if (!result.Success)
            {
                if (result.Message == ErrorConstants.ServiceMessage.ServiceNotFound)
                {
                    return NotFound(result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }

        /// <summary>
        /// Lists every variant of a service, active and inactive. Requires ClinicManager role.
        /// </summary>
        [HttpGet("{serviceId:int}/variants")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<IReadOnlyList<ServiceVariantDto>>>> GetVariantsAsync(
            [FromRoute] int serviceId,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetVariantsAsync(serviceId, cancellationToken);
            return result.Success ? Ok(result) : NotFound(result);
        }

        /// <summary>
        /// Adds a variant to a service. Requires ClinicManager role.
        /// </summary>
        [HttpPost("{serviceId:int}/variants")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceVariantDto>>> CreateVariantAsync(
            [FromRoute] int serviceId,
            [FromBody] SaveServiceVariantRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.CreateVariantAsync(serviceId, request, cancellationToken);
            if (!result.Success)
            {
                return VariantFailure(result);
            }

            return StatusCode(StatusCodes.Status201Created, result);
        }

        /// <summary>
        /// Updates a variant of a service. Requires ClinicManager role.
        /// </summary>
        [HttpPut("{serviceId:int}/variants/{variantId:int}")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceVariantDto>>> UpdateVariantAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            [FromBody] SaveServiceVariantRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.UpdateVariantAsync(serviceId, variantId, request, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Turns a variant on or off. Requires ClinicManager role.
        /// </summary>
        [HttpPatch("{serviceId:int}/variants/{variantId:int}/status")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceVariantDto>>> ToggleVariantStatusAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            [FromBody] ToggleServiceStatusRequest request,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.ToggleVariantStatusAsync(serviceId, variantId, request.IsActive, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Deletes a variant that was never booked. Requires ClinicManager role.
        /// </summary>
        [HttpDelete("{serviceId:int}/variants/{variantId:int}")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<bool>>> DeleteVariantAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.DeleteVariantAsync(serviceId, variantId, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Returns the picture of a service as an image file. Anyone may read it.
        /// </summary>
        [HttpGet("{id:int}/image")]
        [AllowAnonymous]
        public async Task<IActionResult> GetServiceImageAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetServiceImageAsync(id, cancellationToken);
            return result.Success ? ImageFile(result.Data!) : NotFound(result);
        }

        /// <summary>
        /// Uploads or replaces the picture of a service (JPG, PNG or WebP, at most 2 MB). Requires ClinicManager role.
        /// </summary>
        [HttpPut("{id:int}/image")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(ServiceImageConstants.MaxRequestBytes)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> SetServiceImageAsync(
            [FromRoute] int id,
            IFormFile? file,
            CancellationToken cancellationToken)
        {
            var data = await ReadUploadAsync(file, cancellationToken);
            var result = await _clinicService.SetServiceImageAsync(id, data, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Removes the picture of a service. Requires ClinicManager role.
        /// </summary>
        [HttpDelete("{id:int}/image")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceDto>>> RemoveServiceImageAsync(
            [FromRoute] int id,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.RemoveServiceImageAsync(id, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Returns the picture of a service variant as an image file. Anyone may read it.
        /// </summary>
        [HttpGet("{serviceId:int}/variants/{variantId:int}/image")]
        [AllowAnonymous]
        public async Task<IActionResult> GetVariantImageAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.GetVariantImageAsync(serviceId, variantId, cancellationToken);
            return result.Success ? ImageFile(result.Data!) : NotFound(result);
        }

        /// <summary>
        /// Uploads or replaces the picture of a service variant (JPG, PNG or WebP, at most 2 MB). Requires ClinicManager role.
        /// </summary>
        [HttpPut("{serviceId:int}/variants/{variantId:int}/image")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(ServiceImageConstants.MaxRequestBytes)]
        public async Task<ActionResult<ApiResponse<ServiceVariantDto>>> SetVariantImageAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            IFormFile? file,
            CancellationToken cancellationToken)
        {
            var data = await ReadUploadAsync(file, cancellationToken);
            var result = await _clinicService.SetVariantImageAsync(serviceId, variantId, data, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        /// <summary>
        /// Removes the picture of a service variant. Requires ClinicManager role.
        /// </summary>
        [HttpDelete("{serviceId:int}/variants/{variantId:int}/image")]
        [Authorize(Roles = RoleConstants.ClinicManagerRole)]
        public async Task<ActionResult<ApiResponse<ServiceVariantDto>>> RemoveVariantImageAsync(
            [FromRoute] int serviceId,
            [FromRoute] int variantId,
            CancellationToken cancellationToken)
        {
            var result = await _clinicService.RemoveVariantImageAsync(serviceId, variantId, cancellationToken);
            return result.Success ? Ok(result) : VariantFailure(result);
        }

        // The uploaded bytes; empty when no file came or it is over the limit, so the service answers with the right message
        private static async Task<byte[]> ReadUploadAsync(IFormFile? file, CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
            {
                return Array.Empty<byte>();
            }

            if (file.Length > ServiceImageConstants.MaxBytes)
            {
                // One byte over the limit is enough for the service to reject it without reading the whole file
                return new byte[ServiceImageConstants.MaxBytes + 1];
            }

            using var stream = new MemoryStream((int)file.Length);
            await file.CopyToAsync(stream, cancellationToken);
            return stream.ToArray();
        }

        // The picture with caching. The imageUrl in the API carries ?v=<time of the picture>, which changes with every new picture,
        // so that address may be kept for a year; an address without it is checked again each time.
        // The ETag lets a browser that asks again get 304 instead of the whole file.
        private FileContentResult ImageFile(ServiceImageFile image)
        {
            Response.Headers.CacheControl = Request.Query.ContainsKey("v")
                ? "public, max-age=31536000, immutable"
                : "no-cache";
            var etag = new Microsoft.Net.Http.Headers.EntityTagHeaderValue($"\"{image.UpdatedAt.UtcTicks}\"");
            return File(image.Data, image.ContentType, image.UpdatedAt, etag);
        }

        // Not found for a missing service, variant or picture, bad request for everything else
        private ObjectResult VariantFailure<T>(ApiResponse<T> result)
        {
            return result.Message == ErrorConstants.ServiceMessage.ServiceNotFound
                || result.Message == ErrorConstants.ServiceVariantMessage.VariantNotFound
                || result.Message == ErrorConstants.ServiceImageMessage.ImageNotFound
                ? NotFound(result)
                : BadRequest(result);
        }
    }
}

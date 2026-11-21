using System.Reflection;
using System.Security.Claims;
using System.Text;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Controllers;

namespace OZE.UnitTest.Controllers
{
    public class DocumentRequestsControllerTests
    {
        private const string UserId = "user-test-id";
        private readonly Mock<IDocumentRequestService> _service = new();

        private DocumentRequestsController ControllerFor(string role)
        {
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, UserId),
                new Claim(ClaimTypes.Role, role)
            }, "TestAuth"));
            return new DocumentRequestsController(_service.Object)
            {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } }
            };
        }

        [Theory]
        [InlineData(nameof(DocumentRequestsController.CreateAsync), new[] { RoleConstants.DoctorRole })]
        [InlineData(nameof(DocumentRequestsController.GetByExaminationAsync), new[] { RoleConstants.DoctorRole })]
        [InlineData(nameof(DocumentRequestsController.CancelAsync), new[] { RoleConstants.DoctorRole })]
        [InlineData(nameof(DocumentRequestsController.GetMineAsync), new[] { RoleConstants.PatientRole })]
        [InlineData(nameof(DocumentRequestsController.SubmitAsync), new[] { RoleConstants.PatientRole })]
        [InlineData(nameof(DocumentRequestsController.GetFileAsync), new[] { RoleConstants.DoctorRole, RoleConstants.ClinicManagerRole, RoleConstants.PatientRole })]
        public void Action_ShouldOnlyAllowItsRoles(string action, string[] roles)
        {
            RolesOf(action).Should().BeEquivalentTo(roles);
        }

        [Fact]
        public void SubmitAsync_ShouldAllowTheLargestValidUploadPlusMultipartMargin()
        {
            var method = typeof(DocumentRequestsController).GetMethod(nameof(DocumentRequestsController.SubmitAsync))!;

            method.GetCustomAttribute<RequestSizeLimitAttribute>().Should().NotBeNull();
            // RequestSizeLimitAttribute keeps its limit private; it is applied as an IRequestSizeLimitMetadata filter
            var sizeLimit = (Microsoft.AspNetCore.Http.Metadata.IRequestSizeLimitMetadata)method.GetCustomAttribute<RequestSizeLimitAttribute>()!;
            sizeLimit.MaxRequestBodySize.Should().Be(DocumentRequestConstants.UploadMaxRequestBytes);
            method.GetCustomAttribute<RequestFormLimitsAttribute>()!.MultipartBodyLengthLimit.Should().Be(DocumentRequestConstants.UploadMaxRequestBytes);
            DocumentRequestConstants.UploadMaxRequestBytes.Should().BeGreaterThan(DocumentRequestConstants.UploadMaxFiles * DocumentRequestConstants.UploadMaxFileBytes);
        }

        [Fact]
        public async Task SubmitAsync_ShouldPassEveryFormFileWithItsNameAndBytes()
        {
            List<UploadedImagingFile>? received = null;
            _service
                .Setup(s => s.SubmitAsync(UserId, 77, It.IsAny<List<UploadedImagingFile>>(), It.IsAny<CancellationToken>()))
                .Callback<string, long, List<UploadedImagingFile>, CancellationToken>((_, _, files, _) => received = files)
                .ReturnsAsync(new DocumentRequestResponse { Id = 77, Status = DocumentRequestConstants.Submitted });
            var files = new List<IFormFile> { FormFile("ket-qua.pdf", "application/pdf", "PDF"), FormFile("phim.png", "image/png", "PNG!") };

            var result = await ControllerFor(RoleConstants.PatientRole).SubmitAsync(77, files, CancellationToken.None);

            result.Result.Should().BeOfType<OkObjectResult>();
            received.Should().NotBeNull();
            received!.Select(f => f.FileName).Should().Equal("ket-qua.pdf", "phim.png");
            received[0].Data.Should().Equal(Encoding.UTF8.GetBytes("PDF"));
            received[1].Data.Should().Equal(Encoding.UTF8.GetBytes("PNG!"));
            received[1].ContentType.Should().Be("image/png");
        }

        private static IFormFile FormFile(string name, string contentType, string content)
        {
            var bytes = Encoding.UTF8.GetBytes(content);
            return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "files", name)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType
            };
        }

        private static string[] RolesOf(string action)
        {
            var roles = typeof(DocumentRequestsController).GetMethod(action)!.GetCustomAttribute<AuthorizeAttribute>()!.Roles!;
            return roles.Split(',', StringSplitOptions.TrimEntries);
        }

        [Theory]
        [InlineData(RoleConstants.PatientRole, true)]
        [InlineData(RoleConstants.DoctorRole, false)]
        [InlineData(RoleConstants.ClinicManagerRole, false)]
        public async Task GetFileAsync_ShouldTellTheServiceWhetherTheCallerIsAPatient(string role, bool isPatient)
        {
            _service
                .Setup(s => s.GetFileAsync(It.IsAny<string>(), It.IsAny<bool>(), 500, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new ImagingFileResult { Data = new byte[] { 1 }, ContentType = "application/pdf", FileName = "ket-qua.pdf" });

            var result = await ControllerFor(role).GetFileAsync(500, CancellationToken.None);

            var file = result.Should().BeOfType<FileContentResult>().Subject;
            file.ContentType.Should().Be("application/pdf");
            file.FileDownloadName.Should().Be("ket-qua.pdf");
            _service.Verify(s => s.GetFileAsync(UserId, isPatient, 500, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}

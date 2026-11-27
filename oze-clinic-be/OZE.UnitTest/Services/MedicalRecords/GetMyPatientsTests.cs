using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Xunit;

namespace OZE.UnitTest.Services.MedicalRecords
{
    // The doctor's "Hồ sơ bệnh án" list (GET api/medical-records/patients)
    public class GetMyPatientsTests : MedicalRecordTestBase
    {
        private static readonly PagedResult<DoctorPatientResponse> Page = new()
        {
            Items = new List<DoctorPatientResponse> { new() { PatientId = PatientId, PatientCode = "BN000003", FullName = "Nguyen Van A" } },
            TotalCount = 1,
            PageNumber = 1,
            PageSize = 10
        };

        private void SetupRepo() =>
            _repo.Setup(r => r.GetDoctorPatientsAsync(It.IsAny<int>(), It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Page);

        // The list is the signed-in doctor's (staff id 5), with the paging asked for
        [Fact]
        public async Task GetMyPatientsAsync_ShouldListTheDoctorsPatients()
        {
            SetupRepo();

            var result = await _service.GetMyPatientsAsync(DoctorUserId, new DoctorPatientQuery { PageNumber = 2, PageSize = 8 });

            result.Should().BeSameAs(Page);
            _repo.Verify(r => r.GetDoctorPatientsAsync(5, null, null, 2, 8, It.IsAny<CancellationToken>()), Times.Once);
        }

        // A name is searched as typed (trimmed), not as a phone number
        [Fact]
        public async Task GetMyPatientsAsync_ShouldSearchName_WithoutPhoneDigits()
        {
            SetupRepo();

            await _service.GetMyPatientsAsync(DoctorUserId, new DoctorPatientQuery { SearchKeyword = "  Nguyen Van A " });

            _repo.Verify(r => r.GetDoctorPatientsAsync(5, "Nguyen Van A", null, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
        }

        // Phones are stored as +84…: a number typed with 0 or +84 also searches the digits after the prefix
        [Theory]
        [InlineData("0912 345 678", "912345678")]
        [InlineData("+84912345678", "912345678")]
        [InlineData("0912", "912")]
        [InlineData("345678", "345678")]
        public async Task GetMyPatientsAsync_ShouldSearchPhoneDigits(string keyword, string digits)
        {
            SetupRepo();

            await _service.GetMyPatientsAsync(DoctorUserId, new DoctorPatientQuery { SearchKeyword = keyword });

            _repo.Verify(r => r.GetDoctorPatientsAsync(5, keyword.Trim(), digits, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
        }

        // A patient code is not a phone number
        [Fact]
        public async Task GetMyPatientsAsync_ShouldNotTreatPatientCodeAsPhone()
        {
            SetupRepo();

            await _service.GetMyPatientsAsync(DoctorUserId, new DoctorPatientQuery { SearchKeyword = "BN000123" });

            _repo.Verify(r => r.GetDoctorPatientsAsync(5, "BN000123", null, 1, 10, It.IsAny<CancellationToken>()), Times.Once);
        }

        // A signed-in user without a staff profile
        [Fact]
        public async Task GetMyPatientsAsync_ShouldThrow_WhenDoctorNotFound()
        {
            var act = () => _service.GetMyPatientsAsync("unknown-user", new DoctorPatientQuery());

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.MedicalRecordMessage.DoctorNotFound);
        }
    }
}

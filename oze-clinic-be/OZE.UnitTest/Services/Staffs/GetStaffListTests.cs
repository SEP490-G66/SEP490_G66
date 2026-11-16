using FluentAssertions;
using Moq;
using OZE.Common.Constants;
using OZE.Common.Models;
using Xunit;

namespace OZE.UnitTest.Services.Staffs
{
    // OZ-STAFF-01 GetStaffList
    [Trait("Tab", "OZ-STAFF-01")]
    public class GetStaffListTests : StaffTestBase
    {
        // UTCID01 (N): Return staff list from repository when no filters are applied
        [Fact]
        public async Task GetStaffListAsync_ShouldReturnStaff_WhenRepositoryReturnsStaff()
        {
            // Arrange
            var query = new StaffQueryRequest();
            var staff = new List<StaffResponse>
            {
                CreateSampleStaffResponse(),
                CreateSampleStaffResponse(
                    userId: "staff-user-2",
                    fullName: "Tran Thi B",
                    email: "reception@oze.vn",
                    phoneNumber: "+84987654321",
                    role: RoleConstants.ReceptionistRole,
                    specialization: null,
                    licenseNumber: null,
                    isActive: true)
            };

            _staffRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(staff);

            // Act
            var result = await _service.GetStaffListAsync(query);

            // Assert
            result.Should().HaveCount(2);
            result[0].UserId.Should().Be(ValidUserId);
            result[0].FullName.Should().Be(ValidFullName);
            result[0].Email.Should().Be("doctor@oze.vn");
            result[0].PhoneNumber.Should().Be("+84912345678");
            result[0].Role.Should().Be(RoleConstants.DoctorRole);
            result[0].Specialization.Should().Be("Nha khoa tong quat");
            result[0].LicenseNumber.Should().Be("BS-001");
            result[0].IsActive.Should().BeTrue();
            result[1].UserId.Should().Be("staff-user-2");
            result[1].FullName.Should().Be("Tran Thi B");
            result[1].Role.Should().Be(RoleConstants.ReceptionistRole);
            result[1].Specialization.Should().BeNull();
            result[1].LicenseNumber.Should().BeNull();
            _staffRepositoryMock.Verify(r => r.GetAllAsync(query), Times.Once);
        }

        // UTCID02 (N): Forward Keyword, Role and IsActive filters to repository
        [Fact]
        public async Task GetStaffListAsync_ShouldPassQueryFiltersToRepository_WhenFiltersProvided()
        {
            // Arrange
            var query = new StaffQueryRequest
            {
                Keyword = "Nguyen",
                Role = RoleConstants.DoctorRole,
                IsActive = true
            };
            var staff = new List<StaffResponse> { CreateSampleStaffResponse() };

            _staffRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(staff);

            // Act
            var result = await _service.GetStaffListAsync(query);

            // Assert
            result.Should().HaveCount(1);
            result[0].FullName.Should().Be(ValidFullName);
            _staffRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<StaffQueryRequest>(q =>
                        q.Keyword == "Nguyen"
                        && q.Role == RoleConstants.DoctorRole
                        && q.IsActive == true)),
                Times.Once);
        }

        // UTCID03 (N): Return empty list when repository returns no staff
        [Fact]
        public async Task GetStaffListAsync_ShouldReturnEmptyList_WhenRepositoryReturnsNoStaff()
        {
            // Arrange
            var query = new StaffQueryRequest { Keyword = "KhongTonTai" };

            _staffRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(new List<StaffResponse>());

            // Act
            var result = await _service.GetStaffListAsync(query);

            // Assert
            result.Should().NotBeNull();
            result.Should().BeEmpty();
            _staffRepositoryMock.Verify(r => r.GetAllAsync(query), Times.Once);
        }

        // UTCID04 (B): Null/whitespace Keyword, null Role and null IsActive are forwarded unchanged
        [Fact]
        public async Task GetStaffListAsync_ShouldForwardEmptyFilters_WhenKeywordRoleAndIsActiveAreNullOrWhitespace()
        {
            // Arrange
            var query = new StaffQueryRequest
            {
                Keyword = "   ",
                Role = null,
                IsActive = null
            };
            var staff = new List<StaffResponse> { CreateSampleStaffResponse() };

            _staffRepositoryMock
                .Setup(r => r.GetAllAsync(query))
                .ReturnsAsync(staff);

            // Act
            var result = await _service.GetStaffListAsync(query);

            // Assert
            result.Should().HaveCount(1);
            _staffRepositoryMock.Verify(
                r => r.GetAllAsync(
                    It.Is<StaffQueryRequest>(q =>
                        q.Keyword == "   "
                        && q.Role == null
                        && q.IsActive == null)),
                Times.Once);
        }
    }
}

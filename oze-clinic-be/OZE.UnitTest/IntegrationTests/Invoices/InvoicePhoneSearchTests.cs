using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Repositories;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.Invoices
{
    // Hóa đơn of the receptionist: the phone column and searching by phone typed as 0... or +84...
    [Trait("Tab", "Invoices-Phone")]
    public class InvoicePhoneSearchTests : IDisposable
    {
        private readonly AppIdentityDbContext _dbContext;
        private readonly InvoiceService _service;
        private static readonly DateTimeOffset Day = new(2026, 11, 20, 2, 0, 0, TimeSpan.Zero);

        public InvoicePhoneSearchTests()
        {
            var options = new DbContextOptionsBuilder<AppIdentityDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new AppIdentityDbContext(options);
            _service = new InvoiceService(
                new InvoiceRepository(_dbContext),
                new Mock<IPatientRepository>().Object,
                new Mock<IAppointmentRepository>().Object,
                new Mock<ITreatmentPlanRepository>().Object,
                new Mock<IServiceRepository>().Object,
                new Mock<IAuditLogService>().Object);
        }

        public void Dispose() => _dbContext.Dispose();

        private static Invoice NewInvoice(long id, int patientId) => new()
        {
            Id = id,
            InvoiceNumber = $"INV-{id}",
            PatientId = patientId,
            TotalAmount = 500_000m,
            FinalAmount = 500_000m,
            PaymentStatus = InvoiceConstants.Unpaid,
            CreatedAt = Day.AddMinutes(id)
        };

        // Patient 1 stored as +84, patient 2 stored as 0..., patient 3 without a phone
        private async Task SeedAsync()
        {
            _dbContext.Patients.AddRange(
                new Patient { Id = 1, UserId = "p1", PatientCode = "BN-1", FullName = "Nguyễn Văn A", PhoneNumber = "+84909000001", CreatedAt = Day },
                new Patient { Id = 2, UserId = "p2", PatientCode = "BN-2", FullName = "Trần Thị B", PhoneNumber = "0912000002", CreatedAt = Day },
                new Patient { Id = 3, UserId = "p3", PatientCode = "BN-3", FullName = "Lê Văn C", CreatedAt = Day });
            _dbContext.Invoices.AddRange(NewInvoice(1, 1), NewInvoice(2, 2), NewInvoice(3, 3));
            await _dbContext.SaveChangesAsync();
            _dbContext.ChangeTracker.Clear();
        }

        private async Task<List<long>> IdsAsync(string keyword)
        {
            var page = await _service.GetPagedAsync(new InvoiceQueryParameters { SearchKeyword = keyword, PageSize = 50 });
            return page.Items.Select(i => i.Id).OrderBy(i => i).ToList();
        }

        [Fact]
        public async Task Summary_HasPatientPhoneNumber()
        {
            await SeedAsync();

            var items = (await _service.GetPagedAsync(new InvoiceQueryParameters { PageSize = 50 })).Items.ToDictionary(i => i.Id);

            items[1].PatientPhoneNumber.Should().Be("+84909000001");
            items[2].PatientPhoneNumber.Should().Be("0912000002");
            items[3].PatientPhoneNumber.Should().BeNull();
        }

        [Theory]
        [InlineData("0909000001")]
        [InlineData("+84909000001")]
        [InlineData("84909000001")]
        [InlineData("0909 000 001")]
        [InlineData("0909.000.001")]
        [InlineData("0909000")]
        public async Task Search_PhoneStoredAsInternational_MatchesLocalAndInternational(string keyword)
        {
            await SeedAsync();

            (await IdsAsync(keyword)).Should().Equal(1);
        }

        [Theory]
        [InlineData("0912000002")]
        [InlineData("+84912000002")]
        public async Task Search_PhoneStoredAsLocal_MatchesLocalAndInternational(string keyword)
        {
            await SeedAsync();

            (await IdsAsync(keyword)).Should().Equal(2);
        }

        [Fact]
        public async Task Search_ByNameAndInvoiceNumber_Unchanged()
        {
            await SeedAsync();

            (await IdsAsync("Trần Thị")).Should().Equal(2);
            (await IdsAsync("INV-3")).Should().Equal(3);
            (await IdsAsync("BN-1")).Should().Equal(1);
        }
    }
}

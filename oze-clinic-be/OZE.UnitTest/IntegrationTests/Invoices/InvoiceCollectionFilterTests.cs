using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Repositories;
using Xunit;

namespace OZE.UnitTest.IntegrationTests.Invoices
{
    // Hóa đơn of the receptionist: list by money collected (confirmed payments), refunds not subtracted
    [Trait("Tab", "Invoices-Collection")]
    public class InvoiceCollectionFilterTests : IDisposable
    {
        private readonly AppIdentityDbContext _dbContext;
        private readonly InvoiceService _service;
        private static readonly DateTimeOffset Day = new(2026, 11, 20, 2, 0, 0, TimeSpan.Zero);

        public InvoiceCollectionFilterTests()
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

        private static Invoice NewInvoice(long id, string status, decimal final, decimal paid) => new()
        {
            Id = id,
            InvoiceNumber = $"INV-{id}",
            PatientId = 1,
            TotalAmount = final,
            FinalAmount = final,
            PaidAmount = paid,
            PaymentStatus = status,
            CreatedAt = Day.AddMinutes(id)
        };

        private static Payment NewPayment(long id, long invoiceId, decimal amount, string status) => new()
        {
            Id = id,
            InvoiceId = invoiceId,
            Amount = amount,
            PaymentMethod = PaymentConstants.Cash,
            PaymentStatus = status,
            CreatedAt = Day
        };

        private static RefundAdjustmentRequest NewRefund(long id, long invoiceId, decimal amount) => new()
        {
            Id = id,
            InvoiceId = invoiceId,
            RequestType = PaymentConstants.RefundRequestType.Refund,
            Amount = amount,
            Reason = "test",
            Status = PaymentConstants.RefundRequestStatus.Processed,
            RequestedByUserId = "u1",
            CreatedAt = Day
        };

        // 1 paid in full, 2 partly paid with a pending transfer, 3 paid in full then partly refunded,
        // 4 paid in full then refunded in full, 5 unpaid, 6 only a pending transfer, 7 cancelled
        private async Task SeedAsync()
        {
            _dbContext.Patients.Add(new Patient { Id = 1, UserId = "p1", PatientCode = "BN-1", FullName = "Nguyễn Văn A", CreatedAt = Day });
            _dbContext.Invoices.AddRange(
                NewInvoice(1, InvoiceConstants.Paid, 1_000_000m, 1_000_000m),
                NewInvoice(2, InvoiceConstants.PartiallyPaid, 1_000_000m, 400_000m),
                NewInvoice(3, InvoiceConstants.PartiallyRefunded, 1_000_000m, 700_000m),
                NewInvoice(4, InvoiceConstants.Refunded, 500_000m, 0m),
                NewInvoice(5, InvoiceConstants.Unpaid, 800_000m, 0m),
                NewInvoice(6, InvoiceConstants.PendingConfirmation, 600_000m, 0m),
                NewInvoice(7, InvoiceConstants.Cancelled, 900_000m, 0m));
            _dbContext.Payments.AddRange(
                NewPayment(11, 1, 1_000_000m, PaymentConstants.Confirmed),
                NewPayment(21, 2, 400_000m, PaymentConstants.Confirmed),
                NewPayment(22, 2, 300_000m, PaymentConstants.Pending),
                NewPayment(31, 3, 1_000_000m, PaymentConstants.Confirmed),
                NewPayment(41, 4, 500_000m, PaymentConstants.Confirmed),
                NewPayment(61, 6, 600_000m, PaymentConstants.Pending),
                NewPayment(71, 7, 900_000m, PaymentConstants.Confirmed));
            _dbContext.RefundAdjustmentRequests.AddRange(NewRefund(1, 3, 300_000m), NewRefund(2, 4, 500_000m));
            await _dbContext.SaveChangesAsync();
            _dbContext.ChangeTracker.Clear();
        }

        private async Task<List<long>> IdsAsync(string? collection)
        {
            var page = await _service.GetPagedAsync(new InvoiceQueryParameters { Collection = collection, PageSize = 50 });
            return page.Items.Select(i => i.Id).OrderBy(i => i).ToList();
        }

        [Fact]
        public async Task Received_IncludesRefundedInvoices_ExcludesUnpaidPendingCancelled()
        {
            await SeedAsync();

            (await IdsAsync(InvoiceConstants.Collection.Received)).Should().Equal(1, 2, 3, 4);
        }

        [Fact]
        public async Task Paid_UsesCollectedNotNetOfRefund()
        {
            await SeedAsync();

            (await IdsAsync(InvoiceConstants.Collection.Paid)).Should().Equal(1, 3, 4);
        }

        [Fact]
        public async Task Partial_CollectedBelowFinal()
        {
            await SeedAsync();

            (await IdsAsync(InvoiceConstants.Collection.Partial)).Should().Equal(2);
        }

        [Theory]
        [InlineData(" PAID ")]
        [InlineData("Paid")]
        public async Task Collection_IgnoresCaseAndSpaces(string collection)
        {
            await SeedAsync();

            (await IdsAsync(collection)).Should().Equal(1, 3, 4);
        }

        [Fact]
        public async Task NoCollection_ListsEveryInvoiceAsBefore()
        {
            await SeedAsync();

            (await IdsAsync(null)).Should().Equal(1, 2, 3, 4, 5, 6, 7);
        }

        [Fact]
        public async Task UnknownCollection_IsRejected()
        {
            var act = () => _service.GetPagedAsync(new InvoiceQueryParameters { Collection = "refunded" });

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.InvoiceMessage.CollectionInvalid);
        }

        [Fact]
        public async Task Summary_CollectedAmountIgnoresPendingAndRefund()
        {
            await SeedAsync();

            var items = (await _service.GetPagedAsync(new InvoiceQueryParameters { PageSize = 50 })).Items.ToDictionary(i => i.Id);

            items[2].CollectedAmount.Should().Be(400_000m);
            items[2].CollectionStatus.Should().Be(InvoiceConstants.PartiallyPaid);
            items[3].CollectedAmount.Should().Be(1_000_000m);
            items[3].PaidAmount.Should().Be(700_000m);
            items[3].CollectionStatus.Should().Be(InvoiceConstants.Paid);
            items[4].CollectedAmount.Should().Be(500_000m);
            items[4].CollectionStatus.Should().Be(InvoiceConstants.Paid);
        }

        [Fact]
        public async Task CollectionStatus_IsUnpaid_WhenNothingConfirmed()
        {
            await SeedAsync();

            var items = (await _service.GetPagedAsync(new InvoiceQueryParameters { PageSize = 50 })).Items.ToDictionary(i => i.Id);

            items[5].CollectedAmount.Should().Be(0m);
            items[5].CollectionStatus.Should().Be(InvoiceConstants.Unpaid);
            items[6].CollectedAmount.Should().Be(0m);
            items[6].CollectionStatus.Should().Be(InvoiceConstants.Unpaid);
        }
    }
}

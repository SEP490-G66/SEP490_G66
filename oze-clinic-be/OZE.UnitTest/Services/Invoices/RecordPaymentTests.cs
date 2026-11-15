using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Invoices
{
    // OZ-INV-03 CreatePayment (thu tiền)
    [Trait("Tab", "OZ-INV-03")]
    public class RecordPaymentTests
    {
        private readonly Mock<IPaymentRepository> _paymentRepo = new();
        private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
        private readonly PaymentService _service;
        private readonly Invoice _invoice = new()
        {
            Id = 9,
            InvoiceNumber = "INV-9",
            TotalAmount = 400_000m,
            FinalAmount = 400_000m,
            PaymentStatus = InvoiceConstants.Unpaid
        };

        public RecordPaymentTests()
        {
            _service = new PaymentService(_paymentRepo.Object, _invoiceRepo.Object, new Mock<IAuditLogService>().Object);
            _invoiceRepo.Setup(r => r.GetByIdWithDetailsAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(_invoice);
            _paymentRepo.Setup(r => r.ExecuteInTransactionAsync(It.IsAny<Func<Task<PaymentResponse>>>(), It.IsAny<CancellationToken>()))
                        .Returns((Func<Task<PaymentResponse>> action, CancellationToken _) => action());
            // Like EF Core: adding a payment of a tracked invoice also puts it in invoice.Payments
            _paymentRepo.Setup(r => r.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
                        .Callback<Payment, CancellationToken>((p, _) => _invoice.Payments.Add(p));
        }

        // UTCID01 (N): one cash payment counts once, even when EF already attached it to the invoice
        [Fact]
        public async Task CashPayment_CountsOnce()
        {
            var result = await _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 200_000m, PaymentMethod = PaymentConstants.Cash });

            _invoice.Payments.Should().HaveCount(1);
            _invoice.PaidAmount.Should().Be(200_000m);
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.PartiallyPaid);
            result.InvoiceRemainingAmount.Should().Be(200_000m);
        }

        // UTCID02 (N): a duplicated entry in the collection is still summed once
        [Fact]
        public void Recalculate_IgnoresDuplicateEntries()
        {
            var payment = new Payment { Amount = 400_000m, PaymentStatus = PaymentConstants.Confirmed };
            _invoice.Payments.Add(payment);
            _invoice.Payments.Add(payment);

            InvoiceMoneyHelper.Recalculate(_invoice);

            _invoice.PaidAmount.Should().Be(400_000m);
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.Paid);
        }

        // UTCID03 (N): a bank transfer waits for confirmation and does not count as paid yet
        [Fact]
        public async Task BankTransfer_StaysPending()
        {
            var result = await _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 400_000m, PaymentMethod = " bank_transfer " });

            result.PaymentStatus.Should().Be(PaymentConstants.Pending);
            _invoice.PaidAmount.Should().Be(0m);
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.PendingConfirmation);
        }

        // UTCID04 (A): the invoice does not exist
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenInvoiceNotFound()
        {
            var act = () => _service.RecordAsync(99, "lt", new RecordPaymentRequest { Amount = 100_000m, PaymentMethod = PaymentConstants.Cash });

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.InvoiceNotFound);
        }

        // UTCID05 (A): a cancelled invoice
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenInvoiceCancelled()
        {
            _invoice.PaymentStatus = InvoiceConstants.Cancelled;

            var act = () => _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 100_000m, PaymentMethod = PaymentConstants.Cash });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.InvoiceNotPayable);
        }

        // UTCID06 (A): a method outside the list
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenMethodInvalid()
        {
            var act = () => _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 100_000m, PaymentMethod = "CARD" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.MethodInvalid);
        }

        // UTCID07 (B): amount 0
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenAmountZero()
        {
            var act = () => _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 0m, PaymentMethod = PaymentConstants.Cash });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.AmountInvalid);
        }

        // UTCID08 (B): cash one dong over the balance
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenAmountExceedsRemaining()
        {
            var act = () => _service.RecordAsync(9, "lt", new RecordPaymentRequest { Amount = 400_001m, PaymentMethod = PaymentConstants.Cash });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.AmountExceedsRemaining);
        }

        // UTCID09 (A): an installment payment without its period
        [Fact]
        public async Task RecordAsync_ShouldThrow_WhenInstallmentPeriodMissing()
        {
            var act = () => _service.RecordAsync(9, "lt", new RecordPaymentRequest
            {
                Amount = 100_000m,
                PaymentMethod = PaymentConstants.Cash,
                Purpose = PaymentConstants.PurposeInstallment
            });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.PaymentMessage.InstallmentPeriodRequired);
        }
    }
}

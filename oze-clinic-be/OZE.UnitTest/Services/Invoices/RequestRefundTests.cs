using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Invoices
{
    // OZ-INV-04 RequestRefund
    [Trait("Tab", "OZ-INV-04")]
    public class RequestRefundTests
    {
        private readonly Mock<IRefundRepository> _refundRepo = new();
        private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
        private readonly RefundService _service;
        private readonly Invoice _invoice = new()
        {
            Id = 9,
            InvoiceNumber = "INV-9",
            TotalAmount = 400000,
            FinalAmount = 400000,
            PaidAmount = 400000,
            PaymentStatus = InvoiceConstants.Paid
        };

        public RequestRefundTests()
        {
            _service = new RefundService(_refundRepo.Object, _invoiceRepo.Object, new Mock<IAuditLogService>().Object);
            _invoice.Payments.Add(new Payment { Id = 50, InvoiceId = 9, Amount = 400000, PaymentStatus = PaymentConstants.Confirmed, Purpose = PaymentConstants.PurposeRegular });
            _invoiceRepo.Setup(r => r.GetByIdWithDetailsAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(_invoice);
            _refundRepo.Setup(r => r.ExecuteInTransactionAsync(It.IsAny<Func<Task<RefundRequestResponse>>>(), It.IsAny<CancellationToken>()))
                .Returns((Func<Task<RefundRequestResponse>> action, CancellationToken _) => action());
        }

        private Task<RefundRequestResponse> Request(string reason = "Benh nhan doi y", long? paymentId = null, long invoiceId = 9) =>
            _service.RequestAsync(invoiceId, "receptionist-user", new CreateRefundRequest { Reason = reason, PaymentId = paymentId });

        // UTCID01 (N): a pending request for the full amount paid
        [Fact]
        public async Task RequestAsync_ShouldCreatePendingRequest()
        {
            var result = await Request(paymentId: 50);

            result.Amount.Should().Be(400000);
            result.Status.Should().Be(PaymentConstants.RefundRequestStatus.Pending);
            _refundRepo.Verify(r => r.AddAsync(It.Is<RefundAdjustmentRequest>(x => x.PaymentId == 50 && x.Reason == "Benh nhan doi y"), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (A): no reason
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenReasonMissing()
        {
            var act = () => Request(reason: "  ");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.ReasonRequired);
        }

        // UTCID03 (A): the invoice does not exist
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenInvoiceNotFound()
        {
            var act = () => Request(invoiceId: 99);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.InvoiceNotFound);
        }

        // UTCID04 (A): a cancelled invoice
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenInvoiceCancelled()
        {
            _invoice.PaymentStatus = InvoiceConstants.Cancelled;

            var act = () => Request();

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.InvoiceNotRefundable);
        }

        // UTCID05 (A): a request is already waiting
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenPendingRequestExists()
        {
            _refundRepo.Setup(r => r.HasPendingForInvoiceAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => Request();

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.PendingRequestExists);
        }

        // UTCID06 (B): nothing paid yet
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenNothingPaid()
        {
            _invoice.Payments.Clear();
            _invoice.PaymentStatus = InvoiceConstants.Unpaid;

            var act = () => Request();

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.NoConfirmedPayments);
        }

        // UTCID07 (A): a payment that is not of this invoice
        [Fact]
        public async Task RequestAsync_ShouldThrow_WhenPaymentInvalid()
        {
            var act = () => Request(paymentId: 77);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.PaymentInvalid);
        }
    }
}

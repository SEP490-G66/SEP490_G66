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
    // OZ-INV-05 ApproveRefund
    [Trait("Tab", "OZ-INV-05")]
    public class ApproveRefundTests
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
        private readonly RefundAdjustmentRequest _request;

        public ApproveRefundTests()
        {
            _service = new RefundService(_refundRepo.Object, _invoiceRepo.Object, new Mock<IAuditLogService>().Object);
            _invoice.Payments.Add(new Payment { Id = 50, InvoiceId = 9, Amount = 400000, PaymentStatus = PaymentConstants.Confirmed, Purpose = PaymentConstants.PurposeRegular });
            _request = new RefundAdjustmentRequest
            {
                Id = 60,
                InvoiceId = 9,
                Invoice = _invoice,
                RequestType = PaymentConstants.RefundRequestType.Refund,
                Amount = 400000,
                Reason = "Benh nhan doi y",
                Status = PaymentConstants.RefundRequestStatus.Pending,
                RequestedByUserId = "receptionist-user",
                WorkDoneAmount = 150000
            };
            _invoice.RefundAdjustmentRequests.Add(_request);
            _refundRepo.Setup(r => r.GetByIdWithInvoiceAsync(60, It.IsAny<CancellationToken>())).ReturnsAsync(_request);
            _refundRepo.Setup(r => r.ExecuteInTransactionAsync(It.IsAny<Func<Task<RefundRequestResponse>>>(), It.IsAny<CancellationToken>()))
                .Returns((Func<Task<RefundRequestResponse>> action, CancellationToken _) => action());
        }

        // UTCID01 (N): the paid amount less the work done is refunded and the invoice is partly refunded;
        // the request waits as Approved until the receptionist pays it out
        [Fact]
        public async Task ApproveAsync_ShouldRefundPaidLessWorkDone()
        {
            var result = await _service.ApproveAsync(60, "manager-user");

            result.Amount.Should().Be(250000);
            _request.Status.Should().Be(PaymentConstants.RefundRequestStatus.Approved);
            _request.ApprovedByUserId.Should().Be("manager-user");
            _invoice.PaidAmount.Should().Be(150000);
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.PartiallyRefunded);
        }

        // UTCID02 (B): no work done refunds everything
        [Fact]
        public async Task ApproveAsync_ShouldRefundAll_WhenNoWorkDone()
        {
            _request.WorkDoneAmount = 0;

            var result = await _service.ApproveAsync(60, "manager-user");

            result.Amount.Should().Be(400000);
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.Refunded);
        }

        // UTCID07 (N): paying an approved refund out records who paid, so it is counted in that receptionist's cash session
        [Fact]
        public async Task PayoutAsync_ShouldRecordWhoPaidOut()
        {
            _request.Status = PaymentConstants.RefundRequestStatus.Approved;

            await _service.PayoutAsync(60, "receptionist-user");

            _request.Status.Should().Be(PaymentConstants.RefundRequestStatus.Processed);
            _request.ProcessedByUserId.Should().Be("receptionist-user");
            _request.ProcessedAt.Should().NotBeNull();
        }

        // UTCID03 (A): the request does not exist
        [Fact]
        public async Task ApproveAsync_ShouldThrow_WhenRequestNotFound()
        {
            var act = () => _service.ApproveAsync(99, "manager-user");

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.RequestNotFound);
        }

        // UTCID04 (A): the request was already handled
        [Fact]
        public async Task ApproveAsync_ShouldThrow_WhenNotPending()
        {
            _request.Status = PaymentConstants.RefundRequestStatus.Rejected;

            var act = () => _service.ApproveAsync(60, "manager-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.RequestNotPending);
        }

        // UTCID05 (A): the work done is not set yet
        [Fact]
        public async Task ApproveAsync_ShouldThrow_WhenWorkDoneMissing()
        {
            _request.WorkDoneAmount = null;

            var act = () => _service.ApproveAsync(60, "manager-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.WorkDoneAmountRequired);
        }

        // UTCID06 (B): work done equal to the amount paid leaves nothing to refund
        [Fact]
        public async Task ApproveAsync_ShouldThrow_WhenWorkDoneEqualsPaid()
        {
            _request.WorkDoneAmount = 400000;

            var act = () => _service.ApproveAsync(60, "manager-user");

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.RefundMessage.WorkDoneExceedsPaid);
        }
    }
}

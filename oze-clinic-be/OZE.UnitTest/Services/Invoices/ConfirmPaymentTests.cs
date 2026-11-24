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
    // Xác nhận chuyển khoản trên màn Hóa đơn: needs an open cash session; a line of a cashier receipt is confirmed on the cashier screen
    [Trait("Tab", "OZ-INV-03")]
    public class ConfirmPaymentTests
    {
        private readonly Mock<IPaymentRepository> _paymentRepo = new();
        private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
        private readonly Mock<ICashSessionRepository> _sessions = new();
        private readonly Invoice _invoice = new()
        {
            Id = 9,
            InvoiceNumber = "INV-9",
            TotalAmount = 400_000m,
            FinalAmount = 400_000m,
            PaymentStatus = InvoiceConstants.PendingConfirmation
        };
        private readonly Payment _payment;

        public ConfirmPaymentTests()
        {
            _payment = new Payment
            {
                Id = 5,
                InvoiceId = 9,
                Invoice = _invoice,
                Amount = 400_000m,
                PaymentMethod = PaymentConstants.BankTransfer,
                PaymentStatus = PaymentConstants.Pending
            };
            _invoice.Payments.Add(_payment);
            _paymentRepo.Setup(r => r.GetByIdWithInvoiceAsync(5, It.IsAny<CancellationToken>())).ReturnsAsync(_payment);
            _paymentRepo.Setup(r => r.ExecuteInTransactionAsync(It.IsAny<Func<Task<PaymentResponse>>>(), It.IsAny<CancellationToken>()))
                        .Returns((Func<Task<PaymentResponse>> action, CancellationToken _) => action());
        }

        private PaymentService Service(bool withSessions = true) =>
            new(_paymentRepo.Object, _invoiceRepo.Object, new Mock<IAuditLogService>().Object, null, withSessions ? _sessions.Object : null);

        private void OpenSession() =>
            _sessions.Setup(r => r.GetOpenByUserAsync("lt", It.IsAny<CancellationToken>())).ReturnsAsync(new CashSession { Id = 1 });

        [Fact]
        public async Task NoOpenSession_IsRejected_PaymentStaysPending()
        {
            var act = () => Service().ConfirmAsync(5, "lt");

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CashSessionMessage.NoOpenSession);
            _payment.PaymentStatus.Should().Be(PaymentConstants.Pending);
        }

        [Fact]
        public async Task LineOfCashierReceipt_IsRejected_PaymentStaysPending()
        {
            OpenSession();
            _payment.ReceiptCode = "PT-261123-000001";

            var act = () => Service().ConfirmAsync(5, "lt");

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.PaymentMessage.ConfirmAtCashier);
            _payment.PaymentStatus.Should().Be(PaymentConstants.Pending);
        }

        [Fact]
        public async Task OpenSession_PaymentWithoutReceiptCode_IsConfirmed()
        {
            OpenSession();

            var result = await Service().ConfirmAsync(5, "lt");

            result.PaymentStatus.Should().Be(PaymentConstants.Confirmed);
            _payment.ConfirmedByUserId.Should().Be("lt");
            _invoice.PaymentStatus.Should().Be(InvoiceConstants.Paid);
        }

        [Fact]
        public async Task WithoutSessionRepository_ConfirmsAsBefore()
        {
            var result = await Service(withSessions: false).ConfirmAsync(5, "lt");

            result.PaymentStatus.Should().Be(PaymentConstants.Confirmed);
        }
    }
}

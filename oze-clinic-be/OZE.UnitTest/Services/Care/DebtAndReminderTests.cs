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

namespace OZE.UnitTest.Services.Care
{
    // OZ-PAY-07 Debts and payment reminders (công nợ, nhắc thanh toán)
    [Trait("Tab", "OZ-PAY-07")]
    public class DebtAndReminderTests
    {
        private readonly Mock<ICareRepository> _repo = new();
        private readonly Mock<IEmailSender> _email = new();
        private readonly DebtService _service;
        private readonly DateOnly _today = DateOnly.FromDateTime(ClinicClock.Today);

        public DebtAndReminderTests()
        {
            _service = new DebtService(_repo.Object, new Mock<IAuditLogService>().Object, null, _email.Object);
            _repo.Setup(r => r.GetReminderStatsAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<long, (int, DateTimeOffset)>());
            _repo.Setup(r => r.GetStaffNamesAsync(It.IsAny<IEnumerable<string?>>(), It.IsAny<CancellationToken>())).ReturnsAsync(new Dictionary<string, string>());
        }

        private Invoice InvoiceOwing(decimal final, decimal paid, string? email = "bn@oze.vn", params InstallmentPeriod[] periods)
        {
            var invoice = new Invoice
            {
                Id = 9, InvoiceNumber = "INV-9", PatientId = 1, FinalAmount = final, PaidAmount = paid,
                PaymentStatus = InvoiceConstants.PartiallyPaid, CreatedAt = DateTimeOffset.UtcNow.AddDays(-10),
                Patient = new Patient { FullName = "Benh nhan", Email = email, PhoneNumber = "0912345678" }
            };
            if (periods.Length > 0)
            {
                invoice.InstallmentPlans.Add(new InstallmentPlan { Periods = periods.ToList() });
            }

            _repo.Setup(r => r.GetInvoiceWithPatientAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(invoice);
            return invoice;
        }

        // UTCID01 (N): list shows remaining, overdue first, totals across all invoices
        [Fact]
        public async Task Debts_OverdueFirst_WithTotals()
        {
            var overdue = new Invoice
            {
                Id = 1, InvoiceNumber = "A", FinalAmount = 1000, PaidAmount = 0, PaymentStatus = InvoiceConstants.Unpaid,
                CreatedAt = DateTimeOffset.UtcNow, Patient = new Patient { FullName = "A" }
            };
            overdue.InstallmentPlans.Add(new InstallmentPlan { Periods = { new InstallmentPeriod { Id = 1, Amount = 500, DueDate = _today.AddDays(-3), Status = InstallmentConstants.PeriodPending } } });
            var plain = new Invoice
            {
                Id = 2, InvoiceNumber = "B", FinalAmount = 300, PaidAmount = 100, PaymentStatus = InvoiceConstants.PartiallyPaid,
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-30), Patient = new Patient { FullName = "B" }
            };
            _repo.Setup(r => r.GetOpenInvoicesAsync(null, It.IsAny<CancellationToken>())).ReturnsAsync(new List<Invoice> { plain, overdue });

            var result = await _service.GetDebtsAsync(new DebtQuery());

            result.Items.Select(x => x.InvoiceId).Should().Equal(1, 2);
            result.Items[0].OverdueAmount.Should().Be(500);
            result.TotalRemaining.Should().Be(1200);
            result.OverdueInvoiceCount.Should().Be(1);
        }

        // UTCID02 (N): a reminder is sent by email and recorded with the installment
        [Fact]
        public async Task Remind_SendsEmailAndRecords()
        {
            InvoiceOwing(1000, 400, "bn@oze.vn", new InstallmentPeriod { Id = 3, Sequence = 2, Amount = 300, DueDate = _today.AddDays(2), Status = InstallmentConstants.PeriodPending });
            PaymentReminder? saved = null;
            string? emailBody = null;
            _repo.Setup(r => r.AddReminderAsync(It.IsAny<PaymentReminder>(), It.IsAny<CancellationToken>())).Callback<PaymentReminder, CancellationToken>((x, _) => saved = x);
            _email.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<string, string, string>((_, _, body) => emailBody = body)
                .Returns(Task.CompletedTask);

            var result = await _service.RemindAsync(9, "lt", new RemindPaymentRequest());

            emailBody.Should().NotBeNullOrEmpty();
            emailBody.Should().Contain("<!DOCTYPE html>");
            emailBody.Should().Contain("INV-9");
            // HtmlEncode turns ó -> &#243; (e.g. góp)
            emailBody.Should().Contain("g&#243;p 2");
            _email.Verify(e => e.SendEmailAsync("bn@oze.vn", PatientEmailTemplates.SubjectPaymentReminder, It.IsAny<string>()), Times.Once);
            saved!.InstallmentPeriodId.Should().Be(3);
            result.Channels.Should().Be("Email");
        }

        // UTCID03 (A): within 4 hours of the last reminder
        [Fact]
        public async Task Remind_Recently_Throws()
        {
            InvoiceOwing(1000, 0);
            _repo.Setup(r => r.GetReminderStatsAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<long, (int, DateTimeOffset)> { [9] = (1, DateTimeOffset.UtcNow.AddHours(-1)) });

            var act = () => _service.RemindAsync(9, "lt", new RemindPaymentRequest());

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CareMessage.RemindedRecently);
        }

        // UTCID04 (A): nothing left to pay
        [Fact]
        public async Task Remind_NothingOwed_Throws()
        {
            InvoiceOwing(1000, 1000);

            var act = () => _service.RemindAsync(9, "lt", new RemindPaymentRequest());

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CareMessage.NothingOwed);
        }

        // UTCID05 (A): no phone and no email
        [Fact]
        public async Task Remind_NoContact_Throws()
        {
            InvoiceOwing(1000, 0, email: null);

            var act = () => _service.RemindAsync(9, "lt", new RemindPaymentRequest());

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CareMessage.NoContact);
        }

        // UTCID06 (N): the daily job reminds a period due tomorrow once, and skips an overdue one reminded 2 days ago
        [Fact]
        public async Task DailyJob_RemindsDueAndRespectsWeeklyOverdue()
        {
            var tomorrow = _today.AddDays(1);
            Invoice Inv(long id) => new() { Id = id, InvoiceNumber = $"I{id}", FinalAmount = 1000, PaidAmount = 0, PaymentStatus = InvoiceConstants.Unpaid, Patient = new Patient { FullName = "X", PhoneNumber = "09", Email = "x@oze.vn" } };
            var due = new InstallmentPeriod { Id = 1, Amount = 100, DueDate = tomorrow, Status = InstallmentConstants.PeriodPending, InstallmentPlan = new InstallmentPlan { InvoiceId = 1, Invoice = Inv(1) } };
            var overdue = new InstallmentPeriod { Id = 2, Amount = 100, DueDate = _today.AddDays(-5), Status = InstallmentConstants.PeriodOverdue, InstallmentPlan = new InstallmentPlan { InvoiceId = 2, Invoice = Inv(2) } };
            _repo.Setup(r => r.GetPeriodsToRemindAsync(tomorrow, _today, It.IsAny<CancellationToken>())).ReturnsAsync(new List<InstallmentPeriod> { due, overdue });
            _repo.Setup(r => r.GetLastReminderByPeriodAsync(It.IsAny<IEnumerable<long>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<long, DateTimeOffset> { [2] = DateTimeOffset.UtcNow.AddDays(-2) });

            var result = await _service.RemindDueInstallmentsAsync(tomorrow);

            result.TotalTargeted.Should().Be(1);
            result.RemindedCount.Should().Be(1);
            _repo.Verify(r => r.AddReminderAsync(It.Is<PaymentReminder>(x => x.InvoiceId == 1 && x.IsAutomatic), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}

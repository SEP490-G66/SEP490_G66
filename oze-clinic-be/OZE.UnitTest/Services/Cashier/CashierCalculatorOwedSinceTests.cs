using FluentAssertions;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Common.Models;
using Xunit;

namespace OZE.UnitTest.Services.Cashier
{
    // Công nợ: since when a plan, a walk-in visit and a patient owe confirmed money
    [Trait("Tab", "Cashier-Debts")]
    public class CashierCalculatorOwedSinceTests
    {
        private static readonly DateOnly Today = new(2026, 11, 23);
        private static readonly DateOnly Chosen = new(2026, 10, 1);

        private static CashierPeriodData Period(long id, int seq, DateOnly date, decimal amount, bool finished, decimal extra = 0m) => new()
        {
            Id = id,
            Seq = seq,
            Date = date,
            PlanAmount = amount,
            ExtraAmount = extra,
            Finished = finished
        };

        private static CashierPlanData Plan(string? option, DateOnly? chosenAt, params CashierPeriodData[] periods) => new()
        {
            Id = 1,
            PatientId = 1,
            Name = "Kế hoạch",
            PlanPrice = periods.Sum(p => p.PlanAmount),
            Option = option,
            DepositRate = option == CashierConstants.Option.Deposit ? 0.3m : null,
            OptionChosenAt = chosenAt,
            Periods = periods.ToList()
        };

        private static CashierCalculator.Line Line(string kind, decimal amount, string status = CashierConstants.ReceiptStatus.Confirmed, long? periodId = null, long? visitId = null) =>
            new(kind, kind == CashierConstants.LineKind.VisitService ? null : 1, periodId, visitId, amount, status);

        private static CashierVisitData Visit(long id, DateOnly date, decimal amount) => new()
        {
            Id = id,
            PatientId = 1,
            AppointmentId = id,
            StartAt = date.ToString("yyyy-MM-dd") + "T09:00",
            Amount = amount
        };

        [Fact]
        public void Periods_EarliestFinishedSessionStillOwing()
        {
            var plan = Plan(CashierConstants.Option.Periods, Chosen,
                Period(11, 1, new DateOnly(2026, 10, 5), 1_000_000m, true),
                Period(12, 2, new DateOnly(2026, 10, 20), 1_000_000m, true),
                Period(13, 3, new DateOnly(2026, 12, 1), 1_000_000m, false));
            var lines = new List<CashierCalculator.Line> { Line(CashierConstants.LineKind.Period, 1_000_000m, periodId: 11) };

            var view = CashierCalculator.ComputePlan(plan, lines);

            view.CurrentDue.Should().Be(1_000_000m);
            view.OwedSince.Should().Be(new DateOnly(2026, 10, 20));
        }

        [Fact]
        public void NotChosen_UsesFinishedSessions()
        {
            var plan = Plan(null, null, Period(11, 1, new DateOnly(2026, 11, 2), 500_000m, true));

            CashierCalculator.ComputePlan(plan, new List<CashierCalculator.Line>()).OwedSince.Should().Be(new DateOnly(2026, 11, 2));
        }

        [Fact]
        public void Full_OwesFromTheDayTheOptionWasChosen()
        {
            var plan = Plan(CashierConstants.Option.Full, Chosen, Period(11, 1, new DateOnly(2026, 10, 15), 2_000_000m, true));

            var view = CashierCalculator.ComputePlan(plan, new List<CashierCalculator.Line>());

            view.FullDue.Should().Be(2_000_000m);
            view.OwedSince.Should().Be(Chosen);
        }

        [Fact]
        public void Full_PaidInFull_ExtraOwesFromItsSession()
        {
            var plan = Plan(CashierConstants.Option.Full, Chosen, Period(11, 1, new DateOnly(2026, 10, 15), 2_000_000m, true, extra: 300_000m));
            var lines = new List<CashierCalculator.Line> { Line(CashierConstants.LineKind.Full, 2_000_000m) };

            var view = CashierCalculator.ComputePlan(plan, lines);

            view.CurrentDue.Should().Be(300_000m);
            view.OwedSince.Should().Be(new DateOnly(2026, 10, 15));
        }

        [Fact]
        public void Deposit_OwedDeposit_OwesFromTheDayTheOptionWasChosen()
        {
            var plan = Plan(CashierConstants.Option.Deposit, Chosen, Period(11, 1, new DateOnly(2026, 12, 10), 10_000_000m, false));

            var view = CashierCalculator.ComputePlan(plan, new List<CashierCalculator.Line>());

            view.DepositOwed.Should().Be(3_000_000m);
            view.OwedSince.Should().Be(Chosen);
        }

        [Fact]
        public void Deposit_PaidDeposit_SessionOwesFromItsDate()
        {
            var plan = Plan(CashierConstants.Option.Deposit, Chosen,
                Period(11, 1, new DateOnly(2026, 11, 5), 6_000_000m, true),
                Period(12, 2, new DateOnly(2026, 12, 10), 4_000_000m, false));
            var lines = new List<CashierCalculator.Line> { Line(CashierConstants.LineKind.Deposit, 3_000_000m) };

            var view = CashierCalculator.ComputePlan(plan, lines);

            view.DepositOwed.Should().Be(0m);
            view.CurrentDue.Should().Be(3_000_000m);
            view.OwedSince.Should().Be(new DateOnly(2026, 11, 5));
        }

        [Fact]
        public void Full_WithoutChosenDate_HasNoDate()
        {
            var plan = Plan(CashierConstants.Option.Full, null, Period(11, 1, new DateOnly(2026, 12, 10), 2_000_000m, false));

            var view = CashierCalculator.ComputePlan(plan, new List<CashierCalculator.Line>());

            view.CurrentDue.Should().Be(2_000_000m);
            view.OwedSince.Should().BeNull();
        }

        [Fact]
        public void Visit_OwesFromItsDate_UntilPaid_PendingDoesNotCount()
        {
            var visit = Visit(7, new DateOnly(2026, 11, 17), 650_000m);
            var pending = new List<CashierCalculator.Line> { Line(CashierConstants.LineKind.VisitService, 650_000m, CashierConstants.ReceiptStatus.Pending, visitId: 7) };
            var paid = new List<CashierCalculator.Line> { Line(CashierConstants.LineKind.VisitService, 650_000m, visitId: 7) };

            CashierCalculator.ComputeVisit(visit, pending).OwedSince.Should().Be(new DateOnly(2026, 11, 17));
            CashierCalculator.ComputeVisit(visit, paid).OwedSince.Should().BeNull();
        }

        [Fact]
        public void Patient_TakesTheEarliestDate()
        {
            var account = new CashierAccountResponse
            {
                Patient = new CashierPatientInfo { Id = 1, Code = "BN1", Name = "A" },
                Plans = { Plan(CashierConstants.Option.Periods, Chosen, Period(11, 1, new DateOnly(2026, 11, 10), 1_000_000m, true)) },
                Visits = { Visit(7, new DateOnly(2026, 11, 3), 200_000m), Visit(8, new DateOnly(2026, 10, 1), 100_000m) },
                Receipts =
                {
                    new CashierReceiptData
                    {
                        Id = "PT-1",
                        Status = CashierConstants.ReceiptStatus.Confirmed,
                        Lines = { new CashierReceiptLineData { Kind = CashierConstants.LineKind.VisitService, VisitId = 8, Amount = 100_000m } }
                    }
                }
            };

            var view = CashierCalculator.ComputePatient(account, Today);
            var item = CashierCalculator.ToDebtItem(account.Patient, view, Today);

            view.OwedSince.Should().Be(new DateOnly(2026, 11, 3));
            item.DebtDays.Should().Be(20);
        }
    }
}

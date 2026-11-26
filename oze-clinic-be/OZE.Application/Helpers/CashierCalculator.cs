using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Helpers
{
    /// <summary>
    /// Bộ tính toán quy tắc tài chính thuần túy cho quầy thu ngân (Cashier Calculator).
    /// Đồng bộ 100% với logic frontend utils/cashier.js nhằm tính toán chính xác công nợ,
    /// số dư tạm ứng, số tiền trần tối đa được phép thu (Ceiling) và hạn nợ (OwedSince).
    /// </summary>
    public static class CashierCalculator
    {
        public sealed record Line(string Kind, long? PlanId, long? PeriodId, long? VisitId, decimal Amount, string Status);

        public sealed record PeriodView(
            CashierPeriodData Period,
            decimal FullCover,
            decimal Paid,
            decimal Deposit,
            decimal PlanDue,
            decimal ExtraDue,
            decimal Due,
            decimal Ceiling,
            bool Collectable,
            string Status);

        public sealed record PlanView(
            CashierPlanData Plan,
            IReadOnlyList<PeriodView> Periods,
            decimal PaidTotal,
            decimal Pending,
            decimal FullCeiling,
            decimal DepositToPay,
            decimal DepositLeft,
            decimal CurrentDue,
            decimal CurrentDueHeld,
            decimal RefundableDeposit,
            bool HasUnfinished,
            string Action,
            decimal FullDue,
            decimal DepositOwed,
            DateOnly? OwedSince);

        public sealed record VisitView(CashierVisitData Visit, DateOnly Date, decimal Remaining, decimal Ceiling, DateOnly? OwedSince);

        public sealed record PatientView(
            IReadOnlyList<PlanView> Plans,
            IReadOnlyList<VisitView> Visits,
            decimal Owed,
            decimal OwedHeld,
            decimal Pending,
            decimal Refundable,
            decimal DepositLeft,
            DateOnly? LastVisit,
            IReadOnlyList<DateOnly> Dates,
            IReadOnlyList<string> Statuses,
            IReadOnlyList<CashierOpenItem> Open,
            DateOnly? OwedSince);

        private static readonly string[] PaidStatuses = { CashierConstants.ReceiptStatus.Confirmed };
        private static readonly string[] HeldStatuses = { CashierConstants.ReceiptStatus.Confirmed, CashierConstants.ReceiptStatus.Pending };

        // Phát sinh of a session: only what a finished session cost over its estimate; a cheaper session keeps the planned price
        public static decimal ExtraOf(TreatmentPlanStage stage) =>
            stage.StageStatus == TreatmentPlanConstants.StageStatus.Completed && stage.ActualCost.HasValue
                ? Math.Max(0m, stage.ActualCost.Value - stage.EstimatedCost)
                : 0m;

        public static List<Line> LinesOf(IEnumerable<CashierReceiptData> receipts) =>
            receipts.SelectMany(r => r.Lines.Select(l => new Line(l.Kind, l.PlanId, l.PeriodId, l.VisitId, l.Amount, r.Status))).ToList();

        public static decimal DepositRequired(CashierPlanData plan) =>
            plan.Option == CashierConstants.Option.Deposit && plan.DepositRate is > 0
                ? Math.Round(plan.PlanPrice * plan.DepositRate.Value, 0, MidpointRounding.AwayFromZero)
                : 0m;

        private sealed record Totals(decimal Full, decimal Deposit, Dictionary<long, decimal> PeriodPaid);

        private sealed record Row(
            CashierPeriodData Period,
            decimal Cover,
            decimal PaidPlan,
            decimal PaidExtra,
            decimal DepositPlan,
            decimal DepositExtra,
            decimal PlanDue,
            decimal ExtraDue);

        private static Totals TotalsOf(CashierPlanData plan, IEnumerable<Line> lines, string[] statuses)
        {
            var own = lines.Where(l => l.PlanId == plan.Id && statuses.Contains(l.Status)).ToList();
            var periodPaid = new Dictionary<long, decimal>();
            foreach (var line in own.Where(l => l.Kind == CashierConstants.LineKind.Period && l.PeriodId.HasValue))
            {
                periodPaid[line.PeriodId!.Value] = periodPaid.GetValueOrDefault(line.PeriodId.Value) + line.Amount;
            }

            return new Totals(
                own.Where(l => l.Kind == CashierConstants.LineKind.Full).Sum(l => l.Amount),
                own.Where(l => l.Kind == CashierConstants.LineKind.Deposit).Sum(l => l.Amount),
                periodPaid);
        }

        // Where the money of a plan lands, period by period.
        // Pass 1: FULL money covers planAmount of every period by seq (finished or not), never the extra part.
        // Pass 2, finished periods only, by seq: PERIOD lines, then the deposit; plan part first, then the extra part.
        // On a FULL plan the PERIOD lines only pay the extra part (the plan part is paid through "Thu toàn bộ").
        private static (List<Row> Rows, decimal DepositUsed) Allocate(CashierPlanData plan, Totals totals)
        {
            var fullLeft = plan.Option == CashierConstants.Option.Full ? totals.Full : 0m;
            var depositLeft = plan.Option == CashierConstants.Option.Deposit ? totals.Deposit : 0m;
            var depositUsed = 0m;
            var rows = new List<Row>();

            foreach (var p in plan.Periods.OrderBy(x => x.Seq))
            {
                var cover = Math.Min(fullLeft, p.PlanAmount);
                fullLeft -= cover;
                var planDue = p.PlanAmount - cover;
                var extraDue = p.ExtraAmount;
                decimal paidPlan = 0, paidExtra = 0, depositPlan = 0, depositExtra = 0;

                if (p.Finished)
                {
                    var paid = totals.PeriodPaid.GetValueOrDefault(p.Id);
                    if (plan.Option == CashierConstants.Option.Full)
                    {
                        paidExtra = Math.Min(paid, extraDue);
                    }
                    else
                    {
                        paidPlan = Math.Min(paid, planDue);
                        paidExtra = Math.Min(paid - paidPlan, extraDue);
                    }
                    planDue -= paidPlan;
                    extraDue -= paidExtra;

                    var use = Math.Min(depositLeft, planDue + extraDue);
                    depositPlan = Math.Min(use, planDue);
                    depositExtra = use - depositPlan;
                    depositLeft -= use;
                    depositUsed += use;
                    planDue -= depositPlan;
                    extraDue -= depositExtra;
                }

                rows.Add(new Row(p, cover, paidPlan, paidExtra, depositPlan, depositExtra, planDue, extraDue));
            }

            return (rows, depositUsed);
        }

        private static string PeriodStatusOf(bool finished, decimal due, bool isFull, decimal extraDue, decimal value, decimal ceiling, bool moneyIn)
        {
            if (!finished) return CashierConstants.PeriodStatus.NotYet;
            if (due == 0) return CashierConstants.PeriodStatus.Paid;
            if (isFull && extraDue == 0) return CashierConstants.PeriodStatus.WaitFull;
            if (value > 0 && ceiling == 0) return CashierConstants.PeriodStatus.Pending;
            if (moneyIn) return CashierConstants.PeriodStatus.Partial;
            return CashierConstants.PeriodStatus.Due;
        }

        public static PlanView ComputePlan(CashierPlanData plan, IReadOnlyList<Line> lines)
        {
            var isFull = plan.Option == CashierConstants.Option.Full;
            var isDeposit = plan.Option == CashierConstants.Option.Deposit;
            var paid = TotalsOf(plan, lines, PaidStatuses);
            var held = TotalsOf(plan, lines, HeldStatuses);
            var paidAlloc = Allocate(plan, paid);
            var heldAlloc = Allocate(plan, held);
            var pendingLines = lines.Where(l => l.PlanId == plan.Id && l.Status == CashierConstants.ReceiptStatus.Pending).ToList();

            var periods = new List<PeriodView>();
            for (var i = 0; i < paidAlloc.Rows.Count; i++)
            {
                var row = paidAlloc.Rows[i];
                var heldRow = heldAlloc.Rows[i];
                var due = row.PlanDue + row.ExtraDue;
                var value = isFull ? row.ExtraDue : due;
                var ceiling = Math.Max(0m, isFull ? heldRow.ExtraDue : heldRow.PlanDue + heldRow.ExtraDue);
                var moneyIn = row.Cover > 0 || row.PaidPlan + row.PaidExtra > 0 || row.DepositPlan + row.DepositExtra > 0;
                var collectable = plan.Option != null && row.Period.Finished && ceiling > 0;
                periods.Add(new PeriodView(
                    row.Period,
                    row.Cover,
                    row.PaidPlan + row.PaidExtra,
                    row.DepositPlan + row.DepositExtra,
                    row.PlanDue,
                    row.ExtraDue,
                    due,
                    ceiling,
                    collectable,
                    PeriodStatusOf(row.Period.Finished, due, isFull, row.ExtraDue, value, ceiling, moneyIn)));
            }

            var finished = periods.Where(p => p.Period.Finished).ToList();
            var sumDue = finished.Sum(p => p.Due);
            var fullDue = isFull ? Math.Max(0m, plan.PlanPrice - paid.Full) : 0m;
            var fullCeiling = isFull ? Math.Max(0m, plan.PlanPrice - held.Full) : 0m;
            var depositRequired = DepositRequired(plan);
            var depositPaid = isDeposit ? paid.Deposit : 0m;
            var depositPending = isDeposit ? held.Deposit - paid.Deposit : 0m;
            var depositUsed = isDeposit ? paidAlloc.DepositUsed : 0m;
            var depositLeft = depositPaid - depositUsed;

            // Room still left in the periods for more deposit (finished or not), so no one pays a deposit that has nowhere to go
            decimal PeriodPaidOf(Totals totals, CashierPeriodData p) =>
                Math.Min(totals.PeriodPaid.GetValueOrDefault(p.Id), p.PlanAmount + p.ExtraAmount);
            var room = Math.Max(0m, plan.Periods.Sum(p => p.PlanAmount + p.ExtraAmount - PeriodPaidOf(paid, p)) - depositPaid);
            var roomHeld = Math.Max(0m, plan.Periods.Sum(p => p.PlanAmount + p.ExtraAmount - PeriodPaidOf(held, p)) - depositPaid - depositPending);
            var depositOwed = isDeposit ? Math.Min(Math.Max(0m, depositRequired - depositPaid), room) : 0m;
            var depositToPay = isDeposit ? Math.Min(Math.Max(0m, depositRequired - depositPaid - depositPending), roomHeld) : 0m;

            var currentDue = sumDue;
            if (isFull) currentDue = fullDue + finished.Sum(p => p.ExtraDue);
            if (isDeposit) currentDue = Math.Max(sumDue, depositOwed);

            var sumCeiling = finished.Sum(p => p.Ceiling);
            var currentDueHeld = sumCeiling;
            if (isFull) currentDueHeld = fullCeiling + sumCeiling;
            if (isDeposit) currentDueHeld = Math.Max(sumCeiling, depositToPay);

            var allFinished = plan.Periods.All(p => p.Finished);
            var refundableDeposit = isDeposit && allFinished && sumDue == 0 && pendingLines.Count == 0 ? depositLeft : 0m;
            var hasCollectable = periods.Any(p => p.Collectable);

            var action = CashierConstants.Action.View;
            if (plan.Option == null) action = CashierConstants.Action.Choose;
            else if (isDeposit && depositToPay > 0) action = CashierConstants.Action.Deposit;
            else if (isFull && fullCeiling > 0) action = CashierConstants.Action.Full;
            else if (hasCollectable) action = CashierConstants.Action.Collect;

            // Since when the confirmed debt of the plan runs: the earliest finished session still owing,
            // and for FULL / DEPOSIT the day the option was chosen while the full payment or the deposit is owed
            var owedDates = finished
                .Where(p => (isFull ? p.ExtraDue : p.Due) > 0 && p.Period.Date.HasValue)
                .Select(p => p.Period.Date!.Value)
                .ToList();
            if (((isFull && fullDue > 0) || (isDeposit && depositOwed > 0)) && plan.OptionChosenAt.HasValue)
            {
                owedDates.Add(plan.OptionChosenAt.Value);
            }
            DateOnly? owedSince = currentDue > 0 && owedDates.Count > 0 ? owedDates.Min() : null;

            return new PlanView(
                plan,
                periods,
                lines.Where(l => l.PlanId == plan.Id && l.Status == CashierConstants.ReceiptStatus.Confirmed).Sum(l => l.Amount),
                pendingLines.Sum(l => l.Amount),
                fullCeiling,
                depositToPay,
                depositLeft,
                currentDue,
                currentDueHeld,
                refundableDeposit,
                !allFinished,
                action,
                fullDue,
                depositOwed,
                owedSince);
        }

        // A walk-in visit: remaining by paid money, ceiling by held money, for the visit as a whole
        public static VisitView ComputeVisit(CashierVisitData visit, IReadOnlyList<Line> lines)
        {
            var own = lines.Where(l => l.Kind == CashierConstants.LineKind.VisitService && l.VisitId == visit.Id).ToList();
            var paid = own.Where(l => PaidStatuses.Contains(l.Status)).Sum(l => l.Amount);
            var held = own.Where(l => HeldStatuses.Contains(l.Status)).Sum(l => l.Amount);
            var date = DateOnly.TryParse(visit.StartAt.Length >= 10 ? visit.StartAt[..10] : visit.StartAt, out var d) ? d : DateOnly.MinValue;
            var remaining = Math.Max(0m, visit.Amount - paid);
            DateOnly? owedSince = remaining > 0 && date != DateOnly.MinValue ? date : null;
            return new VisitView(visit, date, remaining, Math.Max(0m, visit.Amount - held), owedSince);
        }

        // One patient with all plans and walk-ins worked out
        public static PatientView ComputePatient(CashierAccountResponse account, DateOnly today)
        {
            var lines = LinesOf(account.Receipts);
            var plans = account.Plans.Select(p => ComputePlan(p, lines)).ToList();
            var visits = account.Visits.Select(v => ComputeVisit(v, lines)).ToList();

            var owed = plans.Sum(p => p.CurrentDue) + visits.Sum(v => v.Remaining);
            var owedHeld = plans.Sum(p => p.CurrentDueHeld) + visits.Sum(v => v.Ceiling);
            var pending = lines.Where(l => l.Status == CashierConstants.ReceiptStatus.Pending).Sum(l => l.Amount);
            var refundable = plans.Sum(p => p.RefundableDeposit);

            var visitDates = plans
                .SelectMany(p => p.Periods.Where(x => x.Period.Finished && x.Period.Date.HasValue).Select(x => x.Period.Date!.Value))
                .Concat(visits.Select(v => v.Date))
                .Where(d => d <= today)
                .ToList();
            DateOnly? lastVisit = visitDates.Count > 0 ? visitDates.Max() : null;

            var statuses = new List<string>();
            if (owedHeld > 0) statuses.Add(CashierConstants.PatientStatus.Owed);
            if (pending > 0) statuses.Add(CashierConstants.PatientStatus.Pending);
            if (refundable > 0) statuses.Add(CashierConstants.PatientStatus.Refund);
            if (plans.Any(p => p.HasUnfinished)) statuses.Add(CashierConstants.PatientStatus.Upcoming);
            if (statuses.Count == 0) statuses.Add(CashierConstants.PatientStatus.Settled);

            // Plans by name, walk-in visits by the services done in them
            static CashierOpenItem VisitItem(VisitView v) => new()
            {
                Kind = "visit",
                Label = string.Join(", ", v.Visit.Services.Select(s => s.Name).Where(n => !string.IsNullOrWhiteSpace(n))),
                Date = v.Date
            };
            var open = plans
                .Where(p => p.CurrentDue > 0 || p.HasUnfinished)
                .Select(p => new CashierOpenItem { Kind = "plan", Label = p.Plan.Name, Date = p.Periods.Select(x => x.Period.Date).Where(d => d.HasValue).Min() })
                .Concat(visits.Where(v => v.Remaining > 0).OrderByDescending(v => v.Date).Select(VisitItem))
                .ToList();
            // Nothing left to pay: still say what the patient had done, the latest plan or else the latest visit
            if (open.Count == 0 && plans.Count > 0)
            {
                var latest = plans.OrderByDescending(p => p.Plan.Id).First();
                open.Add(new CashierOpenItem { Kind = "plan", Label = latest.Plan.Name });
            }
            else if (open.Count == 0 && visits.Count > 0)
            {
                open.Add(VisitItem(visits.OrderByDescending(v => v.Date).First()));
            }

            var dates = plans
                .SelectMany(p => p.Periods.Where(x => x.Period.Date.HasValue).Select(x => x.Period.Date!.Value))
                .Concat(visits.Select(v => v.Date))
                .Distinct()
                .ToList();

            var owedDates = plans.Where(p => p.CurrentDue > 0).Select(p => p.OwedSince)
                .Concat(visits.Where(v => v.Remaining > 0).Select(v => v.OwedSince))
                .Where(d => d.HasValue)
                .Select(d => d!.Value)
                .ToList();
            DateOnly? owedSince = owedDates.Count > 0 ? owedDates.Min() : null;

            return new PatientView(plans, visits, owed, owedHeld, pending, refundable, plans.Sum(p => p.DepositLeft), lastVisit, dates, statuses, open, owedSince);
        }

        // Checks of a new receipt on the data as it is now. Returns an error text, or null when the receipt may be saved.
        // Same rules as receiveDeposit / collectError of the FE; the ceilings use held money.
        public static string? ReceiptError(CashierAccountResponse account, IReadOnlyList<CreateReceiptLineRequest> requestLines)
        {
            if (requestLines.Count == 0) return ErrorConstants.CashierMessage.NoLines;

            var view = ComputePatient(account, DateOnly.MaxValue);
            var used = new Dictionary<string, decimal>();

            foreach (var line in requestLines)
            {
                if (line.Amount <= 0 || line.Amount != decimal.Truncate(line.Amount)) return ErrorConstants.CashierMessage.AmountInvalid;

                string key;
                decimal ceiling;
                var kind = line.Kind?.Trim().ToUpperInvariant() ?? string.Empty;

                if (kind == CashierConstants.LineKind.Deposit || kind == CashierConstants.LineKind.Full || kind == CashierConstants.LineKind.Period)
                {
                    var plan = view.Plans.FirstOrDefault(p => p.Plan.Id == line.PlanId);
                    if (plan == null) return ErrorConstants.CashierMessage.WrongPatient;
                    if (plan.Plan.Option == null) return ErrorConstants.CashierMessage.OptionNotChosen;

                    if (kind == CashierConstants.LineKind.Deposit)
                    {
                        if (plan.Plan.Option != CashierConstants.Option.Deposit) return ErrorConstants.CashierMessage.NotDepositPlan;
                        key = $"deposit:{plan.Plan.Id}";
                        ceiling = plan.DepositToPay;
                    }
                    else if (kind == CashierConstants.LineKind.Full)
                    {
                        if (plan.Plan.Option != CashierConstants.Option.Full) return ErrorConstants.CashierMessage.NotFullPlan;
                        key = $"full:{plan.Plan.Id}";
                        ceiling = plan.FullCeiling;
                    }
                    else
                    {
                        var period = plan.Periods.FirstOrDefault(x => x.Period.Id == line.PeriodId);
                        if (period == null) return ErrorConstants.CashierMessage.WrongPlan;
                        if (!period.Collectable) return ErrorConstants.CashierMessage.NotCollectable;
                        key = $"period:{period.Period.Id}";
                        ceiling = period.Ceiling;
                    }
                }
                else if (kind == CashierConstants.LineKind.VisitService)
                {
                    var visit = view.Visits.FirstOrDefault(v => v.Visit.Id == line.VisitId);
                    if (visit == null) return ErrorConstants.CashierMessage.WrongPatient;
                    key = $"visit:{visit.Visit.Id}";
                    ceiling = visit.Ceiling;
                }
                else
                {
                    return ErrorConstants.CashierMessage.KindInvalid;
                }

                var total = used.GetValueOrDefault(key) + line.Amount;
                if (total > ceiling) return ErrorConstants.CashierMessage.OverCeiling;
                used[key] = total;
            }

            return null;
        }

        public static CashierPatientSummaryResponse ToSummary(CashierPatientInfo patient, PatientView view) => new()
        {
            Id = patient.Id,
            Code = patient.Code,
            Name = patient.Name,
            Phone = patient.Phone,
            Owed = view.Owed,
            OwedHeld = view.OwedHeld,
            Pending = view.Pending,
            Refundable = view.Refundable,
            DepositLeft = view.DepositLeft,
            LastVisit = view.LastVisit,
            Statuses = view.Statuses.ToList(),
            Status = view.Statuses[0],
            Open = view.Open.ToList()
        };

        public static CashierDebtItemResponse ToDebtItem(CashierPatientInfo patient, PatientView view, DateOnly today) => new()
        {
            Id = patient.Id,
            Code = patient.Code,
            Name = patient.Name,
            Phone = patient.Phone,
            Owed = view.Owed,
            OwedHeld = view.OwedHeld,
            Pending = view.Pending,
            Refundable = view.Refundable,
            DepositLeft = view.DepositLeft,
            LastVisit = view.LastVisit,
            Statuses = view.Statuses.ToList(),
            Status = view.Statuses[0],
            Open = view.Open.ToList(),
            OwedSince = view.OwedSince,
            DebtDays = view.OwedSince.HasValue ? Math.Max(0, today.DayNumber - view.OwedSince.Value.DayNumber) : null
        };
    }
}

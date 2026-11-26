using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    // Cashier pages (plan bản 4 of the FE). Each receipt line is one Payment on the invoice of its plan or visit;
    // lines of one receipt share Payment.ReceiptCode. Money rules: CashierCalculator (same as utils/cashier.js).
    public class CashierService : ICashierService
    {
        private readonly ICashierRepository _cashierRepository;
        private readonly ICashSessionRepository _cashSessionRepository;
        private readonly IAuditLogService _auditLogService;

        public CashierService(
            ICashierRepository cashierRepository,
            ICashSessionRepository cashSessionRepository,
            IAuditLogService auditLogService)
        {
            _cashierRepository = cashierRepository;
            _cashSessionRepository = cashSessionRepository;
            _auditLogService = auditLogService;
        }

        // ---------- Reads ----------

        public async Task<PagedResult<CashierPatientSummaryResponse>> GetPatientsAsync(
            CashierPatientQuery query,
            CancellationToken cancellationToken = default)
        {
            var search = Clean(query.SearchKeyword);
            var status = Clean(query.Status)?.ToUpperInvariant();
            ConditionGuard.ThrowIf(status != null && !CashierConstants.PatientStatus.All.Contains(status), ErrorConstants.CashierMessage.KindInvalid);

            var patients = (await _cashierRepository.GetCandidatePatientsAsync(cancellationToken))
                .Where(p => MatchesSearch(p, search))
                .ToList();
            var accounts = await _cashierRepository.GetAccountsAsync(patients, cancellationToken);
            var today = DateOnly.FromDateTime(ClinicClock.Today);

            // A typed search looks at every day; otherwise only patients with a session or visit on that day
            var rows = accounts
                .Select(a => (Account: a, View: CashierCalculator.ComputePatient(a, today)))
                .Where(x => search != null || !query.Date.HasValue || x.View.Dates.Contains(query.Date.Value))
                .Where(x => status == null || x.View.Statuses.Contains(status))
                .Select(x => CashierCalculator.ToSummary(x.Account.Patient, x.View))
                .ToList();

            var items = rows
                .Skip((query.PageNumber - 1) * query.PageSize)
                .Take(query.PageSize)
                .ToList();
            return new PagedResult<CashierPatientSummaryResponse>(items, rows.Count, query.PageNumber, query.PageSize);
        }

        // Công nợ: patients still owing confirmed money (the Còn phải thu of Thanh toán), oldest debt first
        public async Task<CashierDebtListResponse> GetDebtsAsync(
            CashierDebtQuery query,
            CancellationToken cancellationToken = default)
        {
            var search = Clean(query.SearchKeyword);
            var age = Clean(query.Age)?.ToLowerInvariant();
            ConditionGuard.ThrowIf(age != null && !CashierConstants.DebtAge.All.Contains(age), ErrorConstants.CashierMessage.DebtAgeInvalid);
            ConditionGuard.ThrowIf(
                query.FromDate.HasValue && query.ToDate.HasValue && query.FromDate > query.ToDate,
                ErrorConstants.CashierMessage.DebtDateRangeInvalid);
            var dated = query.FromDate.HasValue || query.ToDate.HasValue;

            var patients = (await _cashierRepository.GetCandidatePatientsAsync(cancellationToken))
                .Where(p => MatchesSearch(p, search))
                .ToList();
            var accounts = await _cashierRepository.GetAccountsAsync(patients, cancellationToken);
            var today = DateOnly.FromDateTime(ClinicClock.Today);

            var rows = accounts
                .Select(a => CashierCalculator.ToDebtItem(a.Patient, CashierCalculator.ComputePatient(a, today), today))
                .Where(r => r.Owed > 0)
                .Where(r => age == null || (r.DebtDays.HasValue && InAge(r.DebtDays.Value, age)))
                .Where(r => !dated || (r.OwedSince.HasValue
                    && (!query.FromDate.HasValue || r.OwedSince >= query.FromDate)
                    && (!query.ToDate.HasValue || r.OwedSince <= query.ToDate)))
                .OrderBy(r => r.OwedSince.HasValue ? 0 : 1)
                .ThenBy(r => r.OwedSince)
                .ThenBy(r => r.Name)
                .ToList();

            return new CashierDebtListResponse
            {
                Items = rows.Skip((query.PageNumber - 1) * query.PageSize).Take(query.PageSize).ToList(),
                TotalCount = rows.Count,
                PageNumber = query.PageNumber,
                PageSize = query.PageSize,
                TotalOwed = rows.Sum(r => r.Owed)
            };
        }

        private static bool InAge(int days, string age) => age switch
        {
            CashierConstants.DebtAge.Under7 => days < 7,
            CashierConstants.DebtAge.From7To30 => days >= 7 && days <= 30,
            _ => days > 30
        };

        public async Task<CashierAccountResponse> GetAccountAsync(int patientId, CancellationToken cancellationToken = default)
        {
            var patient = await _cashierRepository.GetPatientAsync(patientId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.CashierMessage.PatientNotFound);
            return await LoadAccountAsync(patient!, cancellationToken);
        }

        public async Task<List<CashierPatientOption>> GetPatientOptionsAsync(string? search, CancellationToken cancellationToken = default)
        {
            var text = Clean(search);
            return (await _cashierRepository.GetCandidatePatientsAsync(cancellationToken))
                .Where(p => MatchesSearch(p, text))
                .Take(text == null ? int.MaxValue : CashierConstants.OptionListSize)
                .Select(p => new CashierPatientOption { Id = p.Id, Code = p.Code, Name = p.Name, Phone = p.Phone })
                .ToList();
        }

        public async Task<CashierConfigResponse> GetConfigAsync(CancellationToken cancellationToken = default)
        {
            return new CashierConfigResponse { DepositRate = await GetDepositRatePercentAsync(cancellationToken) / 100m };
        }

        // ---------- Writes ----------

        public Task<CashierPlanData> ChoosePaymentOptionAsync(
            long planId,
            ChoosePaymentOptionRequest request,
            string userId,
            CancellationToken cancellationToken = default)
        {
            return _cashierRepository.ExecuteInTransactionAsync(async () =>
            {
                await EnsureOpenSessionAsync(userId, cancellationToken);

                var plan = await _cashierRepository.GetTrackedPlanAsync(planId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(plan != null, ErrorConstants.CashierMessage.PlanNotFound);
                ConditionGuard.Ensure(plan!.PatientId == request.PatientId, ErrorConstants.CashierMessage.WrongPatient);
                ConditionGuard.Ensure(CashierConstants.PlanStatuses.Contains(plan.Status), ErrorConstants.CashierMessage.PlanNotOpen);
                // Changing the option is not allowed for now
                ConditionGuard.Ensure(plan.PaymentOption == null, ErrorConstants.CashierMessage.OptionLocked);

                var option = request.Option?.Trim().ToUpperInvariant() ?? string.Empty;
                ConditionGuard.Ensure(CashierConstants.Option.All.Contains(option), ErrorConstants.CashierMessage.OptionInvalid);

                var now = DateTimeOffset.UtcNow;
                plan.PaymentOption = option;
                plan.DepositRate = option == CashierConstants.Option.Deposit
                    ? await GetDepositRatePercentAsync(cancellationToken)
                    : null;
                plan.PaymentOptionChosenAt = now;
                plan.PaymentOptionChosenByUserId = NullIfEmpty(userId);
                plan.UpdatedAt = now;

                var invoice = await _cashierRepository.GetTrackedPlanInvoiceAsync(plan.Id, cancellationToken)
                    ?? await CreatePlanInvoiceAsync(plan, userId, now, cancellationToken);
                SyncPlanInvoice(invoice, plan, now);

                await _cashierRepository.SaveChangesAsync(cancellationToken);
                await SafeAuditAsync(AuditConstants.PaymentOptionChosen, AuditConstants.TreatmentPlanEntity, plan.Id.ToString(),
                    new { plan.Id, Option = option, plan.DepositRate, InvoiceId = invoice.Id, userId });

                var account = await GetAccountAsync(plan.PatientId, cancellationToken);
                return account.Plans.First(p => p.Id == plan.Id);
            }, cancellationToken);
        }

        public Task<CashierReceiptData> CreateReceiptAsync(
            CreateReceiptRequest request,
            string userId,
            CancellationToken cancellationToken = default)
        {
            return _cashierRepository.ExecuteInTransactionAsync(async () =>
            {
                await EnsureOpenSessionAsync(userId, cancellationToken);

                var patient = await _cashierRepository.GetPatientAsync(request.PatientId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.CashierMessage.PatientNotFound);
                var method = NormalizeMethod(request.PaymentMethod);
                var lines = request.Lines ?? new List<CreateReceiptLineRequest>();

                // Same checks as the FE, on the data as it is now (pending transfers count against the ceiling)
                var account = await LoadAccountAsync(patient!, cancellationToken);
                var error = CashierCalculator.ReceiptError(account, lines);
                ConditionGuard.ThrowIf(error != null, error ?? string.Empty);

                var now = DateTimeOffset.UtcNow;
                var isCash = method == PaymentConstants.Cash;
                var code = await NewReceiptCodeAsync(cancellationToken);
                var reference = isCash ? null : NullIfEmpty(request.TransactionReference?.Trim());
                var notes = NullIfEmpty(request.Notes?.Trim());
                var invoices = new Dictionary<string, Invoice>();

                for (var index = 0; index < lines.Count; index++)
                {
                    var line = lines[index];
                    var kind = line.Kind.Trim().ToUpperInvariant();
                    var invoice = kind == CashierConstants.LineKind.VisitService
                        ? await GetVisitInvoiceAsync(invoices, patient!.Id, line.VisitId!.Value, userId, now, cancellationToken)
                        : await GetPlanInvoiceAsync(invoices, line.PlanId!.Value, userId, now, cancellationToken);

                    invoice.Payments.Add(new Payment
                    {
                        Invoice = invoice,
                        Amount = line.Amount,
                        PaymentMethod = method,
                        PaymentStatus = isCash ? PaymentConstants.Confirmed : PaymentConstants.Pending,
                        Purpose = kind == CashierConstants.LineKind.Deposit ? PaymentConstants.PurposeDeposit : PaymentConstants.PurposeRegular,
                        TreatmentPlanStageId = kind == CashierConstants.LineKind.Period ? line.PeriodId : null,
                        ReceiptCode = code,
                        // The transaction reference is unique, so it goes on the first line of the receipt only
                        TransactionReference = index == 0 ? reference : null,
                        Notes = index == 0 ? notes : null,
                        CreatedByUserId = NullIfEmpty(userId),
                        CreatedAt = now,
                        PaidAt = isCash ? now : null,
                        ConfirmedByUserId = isCash ? NullIfEmpty(userId) : null
                    });
                }

                foreach (var invoice in invoices.Values)
                {
                    ConditionGuard.ThrowIf(InvoiceMoneyHelper.GetNetPaidAmount(invoice) > invoice.FinalAmount, ErrorConstants.CashierMessage.OverCeiling);
                    // Touching the invoice makes its RowVersion catch two receipts saved at the same time
                    InvoiceMoneyHelper.Recalculate(invoice);
                    invoice.UpdatedAt = now;
                }

                await _cashierRepository.SaveChangesAsync(cancellationToken);
                await SafeAuditAsync(AuditConstants.ReceiptRecorded, AuditConstants.ReceiptEntity, code,
                    new { patientId = patient!.Id, method, total = lines.Sum(l => l.Amount), lines = lines.Count, userId });

                return await LoadReceiptAsync(patient, code, cancellationToken);
            }, cancellationToken);
        }

        public Task<CashierReceiptData> ConfirmReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default) =>
            DecideReceiptAsync(patientId, receiptId, userId, confirm: true, cancellationToken);

        public Task<CashierReceiptData> RejectReceiptAsync(int patientId, string receiptId, string userId, CancellationToken cancellationToken = default) =>
            DecideReceiptAsync(patientId, receiptId, userId, confirm: false, cancellationToken);

        // A pending transfer / QR receipt: the money arrived (CONFIRMED, counted in the confirmer's cash session) or not (FAILED)
        private Task<CashierReceiptData> DecideReceiptAsync(int patientId, string receiptId, string userId, bool confirm, CancellationToken cancellationToken)
        {
            return _cashierRepository.ExecuteInTransactionAsync(async () =>
            {
                await EnsureOpenSessionAsync(userId, cancellationToken);

                var patient = await _cashierRepository.GetPatientAsync(patientId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.CashierMessage.PatientNotFound);

                var id = receiptId?.Trim() ?? string.Empty;
                var payments = await _cashierRepository.GetTrackedReceiptPaymentsAsync(patientId, id, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(payments.Count > 0, ErrorConstants.CashierMessage.ReceiptNotFound);
                ConditionGuard.Ensure(payments.All(p => p.PaymentStatus == PaymentConstants.Pending), ErrorConstants.CashierMessage.ReceiptNotPending);
                // Installment payments of the old flow also mark their period; they are confirmed on the invoice screen
                ConditionGuard.ThrowIf(payments.Any(p => p.Purpose == PaymentConstants.PurposeInstallment), ErrorConstants.CashierMessage.KindInvalid);

                var now = DateTimeOffset.UtcNow;
                foreach (var payment in payments)
                {
                    if (confirm)
                    {
                        payment.PaymentStatus = PaymentConstants.Confirmed;
                        payment.PaidAt = now;
                        payment.ConfirmedByUserId = NullIfEmpty(userId);
                    }
                    else
                    {
                        payment.PaymentStatus = PaymentConstants.Failed;
                    }
                }

                foreach (var invoice in payments.Select(p => p.Invoice).Distinct())
                {
                    if (confirm)
                    {
                        ConditionGuard.ThrowIf(InvoiceMoneyHelper.GetNetPaidAmount(invoice) > invoice.FinalAmount, ErrorConstants.CashierMessage.OverCeiling);
                    }
                    InvoiceMoneyHelper.Recalculate(invoice);
                    invoice.UpdatedAt = now;
                }

                await _cashierRepository.SaveChangesAsync(cancellationToken);
                await SafeAuditAsync(confirm ? AuditConstants.ReceiptConfirmed : AuditConstants.ReceiptRejected, AuditConstants.ReceiptEntity, id,
                    new { patientId, total = payments.Sum(p => p.Amount), userId });

                return await LoadReceiptAsync(patient!, id, cancellationToken);
            }, cancellationToken);
        }

        public async Task OnSessionChangedAsync(long planId, long stageId, int? doctorId, CancellationToken cancellationToken = default)
        {
            try
            {
                var plan = await _cashierRepository.GetTrackedPlanAsync(planId, cancellationToken);
                var stage = plan?.Stages.FirstOrDefault(s => s.Id == stageId);
                if (plan == null || stage == null)
                {
                    return;
                }

                // The visit the session was done in, so its services are not collected again as a walk-in
                // The visit booked for the session comes first; only a session without one is matched by patient, doctor and day
                if (stage.StageStatus == TreatmentPlanConstants.StageStatus.Completed && stage.AppointmentId == null)
                {
                    stage.AppointmentId = await _cashierRepository.FindBookedSessionAppointmentIdAsync(stage.Id, cancellationToken);
                    if (stage.AppointmentId == null && doctorId.HasValue)
                    {
                        var date = stage.ActualDate ?? DateOnly.FromDateTime(ClinicClock.Today);
                        stage.AppointmentId = await _cashierRepository.FindSessionAppointmentIdAsync(plan.PatientId, doctorId.Value, date, cancellationToken);
                    }
                }

                if (plan.PaymentOption != null)
                {
                    var invoice = await _cashierRepository.GetTrackedPlanInvoiceAsync(plan.Id, cancellationToken);
                    if (invoice != null)
                    {
                        SyncPlanInvoice(invoice, plan, DateTimeOffset.UtcNow);
                    }
                }

                await _cashierRepository.SaveChangesAsync(cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                // The doctor's work is already saved; the cashier pages fall back to matching nothing for this session
            }
        }

        // ---------- Invoices ----------

        private async Task<Invoice> GetPlanInvoiceAsync(
            Dictionary<string, Invoice> cache, long planId, string userId, DateTimeOffset now, CancellationToken cancellationToken)
        {
            var key = $"plan:{planId}";
            if (cache.TryGetValue(key, out var cached))
            {
                return cached;
            }

            var invoice = await _cashierRepository.GetTrackedPlanInvoiceAsync(planId, cancellationToken);
            if (invoice == null)
            {
                var plan = await _cashierRepository.GetTrackedPlanAsync(planId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(plan != null, ErrorConstants.CashierMessage.PlanNotFound);
                invoice = await CreatePlanInvoiceAsync(plan!, userId, now, cancellationToken);
                SyncPlanInvoice(invoice, plan!, now);
            }

            cache[key] = invoice;
            return invoice;
        }

        private async Task<Invoice> GetVisitInvoiceAsync(
            Dictionary<string, Invoice> cache, int patientId, long appointmentId, string userId, DateTimeOffset now, CancellationToken cancellationToken)
        {
            var key = $"visit:{appointmentId}";
            if (cache.TryGetValue(key, out var cached))
            {
                return cached;
            }

            var invoice = await _cashierRepository.GetTrackedVisitInvoiceAsync(appointmentId, cancellationToken)
                ?? await CreateVisitInvoiceAsync(patientId, appointmentId, userId, now, cancellationToken);
            cache[key] = invoice;
            return invoice;
        }

        private async Task<Invoice> CreatePlanInvoiceAsync(TreatmentPlan plan, string userId, DateTimeOffset now, CancellationToken cancellationToken)
        {
            var invoice = new Invoice
            {
                InvoiceNumber = await NewInvoiceNumberAsync(cancellationToken),
                PatientId = plan.PatientId,
                TreatmentPlanId = plan.Id,
                PaymentStatus = InvoiceConstants.Unpaid,
                Notes = "Hóa đơn kế hoạch điều trị, lập khi chọn phương án thanh toán",
                CreatedAt = now,
                CreatedByUserId = NullIfEmpty(userId)
            };
            await _cashierRepository.AddInvoiceAsync(invoice, cancellationToken);
            return invoice;
        }

        // First collection of a walk-in visit with no invoice yet: one line per booked service that is not a plan session done in it
        private async Task<Invoice> CreateVisitInvoiceAsync(int patientId, long appointmentId, string userId, DateTimeOffset now, CancellationToken cancellationToken)
        {
            var appointment = await _cashierRepository.GetVisitAsync(patientId, appointmentId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(appointment != null, ErrorConstants.CashierMessage.WrongPatient);
            var sessions = await _cashierRepository.GetSessionServicesByAppointmentAsync(new[] { appointmentId }, cancellationToken);
            var done = sessions.GetValueOrDefault(appointmentId) ?? new HashSet<int>();

            var items = appointment!.ServiceItems
                .Where(s => !done.Contains(s.ServiceId))
                .OrderBy(s => s.Id)
                .Select((s, index) => new InvoiceItem
                {
                    ServiceId = s.ServiceId,
                    ServiceName = s.Service?.ServiceName ?? string.Empty,
                    UnitPrice = s.PriceAtBooking,
                    Quantity = 1,
                    Amount = s.PriceAtBooking,
                    SortOrder = index
                })
                .ToList();
            ConditionGuard.Ensure(items.Count > 0, ErrorConstants.CashierMessage.VisitHasNoServices);

            var total = decimal.Round(items.Sum(i => i.Amount), 2, MidpointRounding.AwayFromZero);
            var invoice = new Invoice
            {
                InvoiceNumber = await NewInvoiceNumberAsync(cancellationToken),
                PatientId = patientId,
                AppointmentId = appointmentId,
                TotalAmount = total,
                FinalAmount = total,
                PaymentStatus = InvoiceConstants.Unpaid,
                CreatedAt = now,
                CreatedByUserId = NullIfEmpty(userId),
                Items = items
            };
            await _cashierRepository.AddInvoiceAsync(invoice, cancellationToken);
            return invoice;
        }

        // One line per session not cancelled: estimate + phát sinh. Invoices made by hand with other lines are left as they are.
        private static void SyncPlanInvoice(Invoice invoice, TreatmentPlan plan, DateTimeOffset now)
        {
            if (invoice.Items.Any(i => i.TreatmentPlanStageId == null))
            {
                return;
            }

            var stages = plan.Stages
                .Where(s => s.StageStatus != TreatmentPlanConstants.StageStatus.Cancelled)
                .OrderBy(s => s.StageNumber)
                .ToList();
            var keep = stages.Select(s => s.Id).ToHashSet();
            foreach (var stale in invoice.Items.Where(i => !keep.Contains(i.TreatmentPlanStageId!.Value)).ToList())
            {
                invoice.Items.Remove(stale);
            }

            foreach (var (stage, index) in stages.Select((s, i) => (s, i)))
            {
                var amount = decimal.Round(stage.EstimatedCost + CashierCalculator.ExtraOf(stage), 2, MidpointRounding.AwayFromZero);
                var item = invoice.Items.FirstOrDefault(i => i.TreatmentPlanStageId == stage.Id);
                if (item == null)
                {
                    item = new InvoiceItem { TreatmentPlanStageId = stage.Id, Quantity = 1 };
                    invoice.Items.Add(item);
                }
                item.ServiceId = stage.ServiceId;
                item.ServiceName = string.IsNullOrWhiteSpace(stage.StageName) ? $"Đợt {stage.StageNumber}" : stage.StageName.Trim();
                item.Description = $"Đợt {stage.StageNumber}";
                item.UnitPrice = amount;
                item.Amount = amount;
                item.SortOrder = index;
            }

            invoice.TotalAmount = decimal.Round(invoice.Items.Sum(i => i.Amount), 2, MidpointRounding.AwayFromZero);
            invoice.DiscountAmount = Math.Min(invoice.DiscountAmount, invoice.TotalAmount);
            invoice.FinalAmount = invoice.TotalAmount - invoice.DiscountAmount;
            InvoiceMoneyHelper.Recalculate(invoice);
            invoice.UpdatedAt = now;
        }

        // ---------- Helpers ----------

        private async Task<CashierAccountResponse> LoadAccountAsync(CashierPatientInfo patient, CancellationToken cancellationToken)
        {
            var accounts = await _cashierRepository.GetAccountsAsync(new[] { patient }, cancellationToken);
            return accounts[0];
        }

        private async Task<CashierReceiptData> LoadReceiptAsync(CashierPatientInfo patient, string receiptId, CancellationToken cancellationToken)
        {
            var account = await LoadAccountAsync(patient, cancellationToken);
            var receipt = account.Receipts.FirstOrDefault(r => r.Id == receiptId);
            ConditionGuard.Ensure<NotFoundException>(receipt != null, ErrorConstants.CashierMessage.ReceiptNotFound);
            return receipt!;
        }

        // Money is taken only inside an open cash session, so every receipt lands in someone's hand-over
        private async Task EnsureOpenSessionAsync(string userId, CancellationToken cancellationToken)
        {
            var session = string.IsNullOrWhiteSpace(userId)
                ? null
                : await _cashSessionRepository.GetOpenByUserAsync(userId, cancellationToken);
            ConditionGuard.Ensure(session != null, ErrorConstants.CashSessionMessage.NoOpenSession);
        }

        private async Task<decimal> GetDepositRatePercentAsync(CancellationToken cancellationToken)
        {
            var value = await _cashierRepository.GetConfigValueAsync(ConfigKeyConstants.PaymentDepositRate, cancellationToken);
            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var rate) && rate >= 0 && rate <= 100
                ? rate
                : CashierConstants.DefaultDepositRatePercent;
        }

        private async Task<string> NewReceiptCodeAsync(CancellationToken cancellationToken)
        {
            for (var attempt = 0; attempt < 10; attempt++)
            {
                var code = $"{CashierConstants.ReceiptCodePrefix}-{ClinicClock.Now:yyMMdd}-{RandomNumberGenerator.GetInt32(0, 1_000_000):D6}";
                if (!await _cashierRepository.ReceiptCodeExistsAsync(code, cancellationToken))
                {
                    return code;
                }
            }
            throw new BadRequestException(ErrorConstants.CashierMessage.ReceiptCodeFailed);
        }

        private async Task<string> NewInvoiceNumberAsync(CancellationToken cancellationToken)
        {
            for (var attempt = 0; attempt < 10; attempt++)
            {
                var number = $"{InvoiceConstants.NumberPrefix}-{DateTime.UtcNow:yyMMdd}-{RandomNumberGenerator.GetInt32(0, 1_000_000):D6}";
                if (!await _cashierRepository.InvoiceNumberExistsAsync(number, cancellationToken))
                {
                    return number;
                }
            }
            throw new BadRequestException("Could not generate a unique invoice number. Please try again.");
        }

        private static string NormalizeMethod(string? method)
        {
            var normalized = method?.Trim().ToUpperInvariant() ?? string.Empty;
            ConditionGuard.Ensure(PaymentConstants.Methods.Contains(normalized), ErrorConstants.PaymentMessage.MethodInvalid);
            return normalized;
        }

        private static string? Clean(string? text)
        {
            var trimmed = text?.Trim();
            if (string.IsNullOrEmpty(trimmed))
            {
                return null;
            }
            return trimmed.Length > CashierConstants.SearchMaxLength ? trimmed[..CashierConstants.SearchMaxLength] : trimmed;
        }

        private static string? NullIfEmpty(string? text) => string.IsNullOrWhiteSpace(text) ? null : text;

        // Vietnamese without marks, lower case: "Nguyễn Minh Anh" -> "nguyen minh anh"
        private static string PlainText(string? text)
        {
            var decomposed = (text ?? string.Empty).Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(decomposed.Length);
            foreach (var c in decomposed)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(c == 'đ' ? 'd' : c == 'Đ' ? 'D' : c);
                }
            }
            return builder.ToString().ToLowerInvariant().Trim();
        }

        // By name / code (without marks) or by phone digits (+84 and 0 both work), like matchesSearch of the FE
        private static bool MatchesSearch(CashierPatientInfo patient, string? search)
        {
            var q = PlainText(search);
            if (q.Length == 0)
            {
                return true;
            }

            var digits = new string(q.Where(char.IsDigit).ToArray());
            var compact = new string(q.Where(c => !char.IsWhiteSpace(c) && c != '.' && c != '+' && c != '-').ToArray());
            if (digits.Length > 0 && digits.Length == compact.Length)
            {
                var phone = new string((patient.Phone ?? string.Empty).Where(char.IsDigit).ToArray());
                if (PhoneLocal(phone).Contains(PhoneLocal(digits), StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return PlainText(patient.Name).Contains(q, StringComparison.Ordinal)
                || PlainText(patient.Code).Contains(q, StringComparison.Ordinal);
        }

        private static string PhoneLocal(string digits) => digits.StartsWith("84", StringComparison.Ordinal) ? "0" + digits[2..] : digits;

        private async Task SafeAuditAsync(string action, string entity, string entityId, object newValues)
        {
            try
            {
                await _auditLogService.LogAsync(action, entity, entityId, null, newValues);
            }
            catch
            {
                // Audit must never fail the business operation.
            }
        }
    }
}

using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    /// <summary>
    /// Service xử lý thông tin tài chính chỉ đọc cho bệnh nhân.
    /// Tính toán các khoản "Đến hạn" (Due) dựa trên công việc đã thực hiện hoặc kỳ trả góp đã đến hạn,
    /// và "Dự kiến" (Planned) cho các giai đoạn điều trị chưa thực hiện nhằm minh bạch công nợ.
    /// </summary>
    public class PatientBillingService : IPatientBillingService
    {
        public const string ModeOnce = "ONCE";
        public const string ModeStep = "STEP";
        public const string ModeInstallment = "INSTALLMENT";

        public const string StepDone = "DONE";
        public const string StepInProgress = "IN_PROGRESS";
        public const string StepNotStarted = "NOT_STARTED";

        private static readonly string[] ShownPaymentStatuses = { PaymentConstants.Confirmed, PaymentConstants.Refunded };

        private readonly IInvoiceRepository _invoiceRepository;
        private readonly IPatientRepository _patientRepository;

        public PatientBillingService(IInvoiceRepository invoiceRepository, IPatientRepository patientRepository)
        {
            _invoiceRepository = invoiceRepository;
            _patientRepository = patientRepository;
        }

        /// <summary>
        /// Lấy danh sách tài khoản công nợ của bệnh nhân theo mã tài khoản người dùng.
        /// </summary>
        public async Task<List<PatientPaymentAccountResponse>> GetMyAccountsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var invoices = await LoadAsync(userId, cancellationToken);
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            return invoices.Select(invoice => ToAccount(invoice, today)).ToList();
        }

        /// <summary>
        /// Lấy danh sách chi tiết các hóa đơn và lịch sử thanh toán của bệnh nhân.
        /// </summary>
        public async Task<List<PatientInvoiceDetailResponse>> GetMyInvoiceDetailsAsync(string userId, CancellationToken cancellationToken = default)
        {
            var invoices = await LoadAsync(userId, cancellationToken);
            return invoices.Select(ToDetail).ToList();
        }

        /// <summary>
        /// Tải toàn bộ danh sách hóa đơn khả dụng của bệnh nhân từ cơ sở dữ liệu.
        /// </summary>
        private async Task<IReadOnlyList<Invoice>> LoadAsync(string userId, CancellationToken cancellationToken)
        {
            var patient = await _patientRepository.GetByUserIdAsync(userId);
            ConditionGuard.Ensure<NotFoundException>(patient != null, ErrorConstants.InvoiceMessage.PatientNotFound);
            return await _invoiceRepository.GetPatientBillingAsync(patient!.Id, cancellationToken);
        }

        // A refunded invoice is closed: the refund settles it, nothing more is collected (as in PaymentService / debts)
        private static decimal Remaining(Invoice invoice) =>
            invoice.PaymentStatus == InvoiceConstants.Refunded || invoice.PaymentStatus == InvoiceConstants.PartiallyRefunded
                ? 0m
                : Math.Max(0m, invoice.FinalAmount - invoice.PaidAmount);

        private static PatientPaymentAccountResponse ToAccount(Invoice invoice, DateOnly today)
        {
            var remaining = Remaining(invoice);
            var periods = LatestPeriods(invoice);
            var plan = invoice.TreatmentPlan;
            var account = new PatientPaymentAccountResponse
            {
                Key = $"invoice-{invoice.Id}",
                InvoiceId = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                Name = plan?.PlanName is { Length: > 0 } planName ? planName : ServiceNames(invoice),
                DoctorName = invoice.Appointment?.Doctor?.FullName ?? plan?.CreatedByDoctor?.FullName,
                StartedOn = invoice.Appointment?.AppointmentDate ?? DateOnly.FromDateTime(ClinicClock.ToClinicTime(invoice.CreatedAt)),
                FinalAmount = invoice.FinalAmount,
                PaidAmount = invoice.PaidAmount,
                Payments = ToPayments(invoice),
                Refunds = ToRefunds(invoice)
            };

            if (periods.Count > 0)
            {
                var statuses = periods.Select(period => (period, status: PeriodStatus(period, today))).ToList();
                var notYetDue = statuses
                    .Where(x => x.status == InstallmentConstants.PeriodPending && x.period.DueDate > today)
                    .Sum(x => x.period.Amount);
                account.PaymentMode = ModeInstallment;
                account.DueAmount = Math.Clamp(remaining - notYetDue, 0m, remaining);
                account.HasOverdue = statuses.Any(x => x.status == InstallmentConstants.PeriodOverdue);
                account.Steps = statuses.Select(x => new PatientPaymentStepResponse
                {
                    Number = x.period.Sequence,
                    Amount = x.period.Amount,
                    Status = x.status,
                    Date = x.period.DueDate
                }).ToList();
            }
            else if (plan != null)
            {
                var stages = plan.Stages
                    .Where(stage => stage.StageStatus != TreatmentPlanConstants.StageStatus.Cancelled)
                    .OrderBy(stage => stage.StageNumber)
                    .ToList();
                var doneCost = stages
                    .Where(stage => stage.StageStatus == TreatmentPlanConstants.StageStatus.Completed)
                    .Sum(StageCost);
                account.PaymentMode = ModeStep;
                account.DueAmount = Math.Clamp(doneCost - invoice.PaidAmount, 0m, remaining);
                account.Steps = stages.Select(stage => new PatientPaymentStepResponse
                {
                    Number = stage.StageNumber,
                    Name = stage.StageName ?? stage.Service?.ServiceName ?? string.Empty,
                    Amount = StageCost(stage),
                    Status = StageStatus(stage),
                    Date = stage.ActualDate ?? stage.ScheduledDate
                }).ToList();
            }
            else
            {
                account.PaymentMode = ModeOnce;
                account.DueAmount = remaining;
                account.Steps = invoice.Items
                    .OrderBy(item => item.SortOrder)
                    .Select((item, index) => new PatientPaymentStepResponse { Number = index + 1, Name = item.ServiceName, Amount = item.Amount })
                    .ToList();
            }

            account.PlannedAmount = remaining - account.DueAmount;
            return account;
        }

        private static PatientInvoiceDetailResponse ToDetail(Invoice invoice)
        {
            var examination = invoice.Appointment?.Examination;
            return new PatientInvoiceDetailResponse
            {
                Id = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                CreatedAt = invoice.CreatedAt,
                PaymentStatus = invoice.PaymentStatus,
                TotalAmount = invoice.TotalAmount,
                DiscountAmount = invoice.DiscountAmount,
                FinalAmount = invoice.FinalAmount,
                PaidAmount = invoice.PaidAmount,
                RemainingAmount = Remaining(invoice),
                AppointmentId = invoice.AppointmentId,
                VisitDate = invoice.Appointment?.AppointmentDate,
                DoctorName = invoice.Appointment?.Doctor?.FullName ?? invoice.TreatmentPlan?.CreatedByDoctor?.FullName,
                ChiefComplaint = examination?.ChiefComplaint,
                Diagnoses = examination?.Diagnoses
                    .OrderByDescending(diagnosis => diagnosis.IsPrimary)
                    .Select(diagnosis => diagnosis.DiagnosisName)
                    .ToList() ?? new List<string>(),
                FollowUpDate = examination?.FollowUpDate,
                FollowUpNotes = examination?.FollowUpNotes,
                TreatmentPlanId = invoice.TreatmentPlanId,
                TreatmentPlanName = invoice.TreatmentPlan?.PlanName,
                Items = invoice.Items
                    .OrderBy(item => item.SortOrder)
                    .Select(item => new PatientInvoiceLineResponse
                    {
                        ServiceName = item.ServiceName,
                        Description = item.Description,
                        UnitPrice = item.UnitPrice,
                        Quantity = item.Quantity,
                        Amount = item.Amount,
                        StageName = item.TreatmentPlanStage?.StageName
                    }).ToList(),
                Payments = ToPayments(invoice),
                Refunds = ToRefunds(invoice)
            };
        }

        // An invoice normally has one installment plan; the newest one wins if there are more
        private static List<InstallmentPeriod> LatestPeriods(Invoice invoice) =>
            invoice.InstallmentPlans
                .OrderByDescending(plan => plan.CreatedAt)
                .FirstOrDefault()?.Periods
                .OrderBy(period => period.Sequence)
                .ToList() ?? new List<InstallmentPeriod>();

        // Same rule as InstallmentService.MarkOverdueOnRead, without saving: a pending period past its due date is overdue
        private static string PeriodStatus(InstallmentPeriod period, DateOnly today) =>
            period.Status == InstallmentConstants.PeriodPending && period.DueDate < today ? InstallmentConstants.PeriodOverdue : period.Status;

        private static decimal StageCost(TreatmentPlanStage stage) => stage.ActualCost ?? stage.EstimatedCost;

        private static string StageStatus(TreatmentPlanStage stage) => stage.StageStatus switch
        {
            TreatmentPlanConstants.StageStatus.Completed => StepDone,
            TreatmentPlanConstants.StageStatus.InProgress => StepInProgress,
            _ => StepNotStarted
        };

        private static string ServiceNames(Invoice invoice) =>
            string.Join(", ", invoice.Items.OrderBy(item => item.SortOrder).Select(item => item.ServiceName).Distinct());

        private static List<PatientPaymentRecordResponse> ToPayments(Invoice invoice) =>
            invoice.Payments
                .Where(payment => ShownPaymentStatuses.Contains(payment.PaymentStatus))
                .OrderByDescending(payment => payment.PaidAt ?? payment.CreatedAt)
                .Select(payment => new PatientPaymentRecordResponse
                {
                    Id = payment.Id,
                    Amount = payment.Amount,
                    PaymentMethod = payment.PaymentMethod,
                    PaymentStatus = payment.PaymentStatus,
                    PaidAt = payment.PaidAt ?? payment.CreatedAt
                }).ToList();

        private static List<PatientRefundRequestResponse> ToRefunds(Invoice invoice) =>
            invoice.RefundAdjustmentRequests
                .Where(request => request.RequestType == PaymentConstants.RefundRequestType.Refund)
                .OrderByDescending(request => request.CreatedAt)
                .Select(request => new PatientRefundRequestResponse
                {
                    Id = request.Id,
                    Amount = request.Amount,
                    Reason = request.Reason,
                    Status = request.Status,
                    RejectionReason = request.RejectionReason,
                    CreatedAt = request.CreatedAt,
                    ProcessedAt = request.ProcessedAt
                }).ToList();
    }
}

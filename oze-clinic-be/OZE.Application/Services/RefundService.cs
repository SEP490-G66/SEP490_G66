using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Middlewares;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Services
{
    public class RefundService : IRefundService
    {
        private readonly IRefundRepository _refundRepository;
        private readonly IInvoiceRepository _invoiceRepository;
        private readonly IAuditLogService _auditLogService;
        private readonly INotificationService? _notifications;

        public RefundService(
            IRefundRepository refundRepository,
            IInvoiceRepository invoiceRepository,
            IAuditLogService auditLogService,
            INotificationService? notifications = null)
        {
            _refundRepository = refundRepository;
            _invoiceRepository = invoiceRepository;
            _auditLogService = auditLogService;
            _notifications = notifications;
        }

        public Task<RefundRequestResponse> RequestAsync(
            long invoiceId,
            string requestedByUserId,
            CreateRefundRequest request,
            CancellationToken cancellationToken = default)
        {
            return _refundRepository.ExecuteInTransactionAsync(async () =>
            {
                var reason = request.Reason?.Trim() ?? string.Empty;
                ConditionGuard.Ensure(reason.Length > 0, ErrorConstants.RefundMessage.ReasonRequired);

                var invoice = await _invoiceRepository.GetByIdWithDetailsAsync(invoiceId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(invoice != null, ErrorConstants.RefundMessage.InvoiceNotFound);
                EnsureInvoiceRefundable(invoice!);

                ConditionGuard.ThrowIf(
                    await _refundRepository.HasPendingForInvoiceAsync(invoiceId, cancellationToken),
                    ErrorConstants.RefundMessage.PendingRequestExists);

                var netPaid = InvoiceMoneyHelper.GetNetPaidAmount(invoice!);
                ConditionGuard.Ensure(netPaid > 0, ErrorConstants.RefundMessage.NoConfirmedPayments);

                long? paymentId = null;
                if (request.PaymentId.HasValue)
                {
                    var payment = invoice!.Payments.FirstOrDefault(p => p.Id == request.PaymentId.Value);
                    ConditionGuard.Ensure(
                        payment != null && payment.PaymentStatus == PaymentConstants.Confirmed,
                        ErrorConstants.RefundMessage.PaymentInvalid);
                    paymentId = payment!.Id;
                }

                var now = DateTimeOffset.UtcNow;
                var refundRequest = new RefundAdjustmentRequest
                {
                    InvoiceId = invoice!.Id,
                    PaymentId = paymentId,
                    RequestType = PaymentConstants.RefundRequestType.Refund,
                    // Provisional: full net paid until Manager sets WorkDone and approves
                    Amount = netPaid,
                    Reason = reason,
                    Status = PaymentConstants.RefundRequestStatus.Pending,
                    RequestedByUserId = requestedByUserId,
                    CreatedAt = now
                };

                await _refundRepository.AddAsync(refundRequest, cancellationToken);
                invoice.RefundAdjustmentRequests.Add(refundRequest);
                invoice.UpdatedAt = now;
                _invoiceRepository.Update(invoice);
                await _refundRepository.SaveChangesAsync(cancellationToken);

                await SafeAuditAsync(
                    AuditConstants.RefundRequested,
                    refundRequest.Id.ToString(),
                    null,
                    new
                    {
                        refundRequest.InvoiceId,
                        refundRequest.Amount,
                        refundRequest.PaymentId,
                        requestedByUserId
                    });
                await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ClinicManagerRole },
                    new NotificationContent(NotificationConstants.Text.NewRefundRequestTitle,
                        string.Format(NotificationConstants.Text.NewRefundRequestMessage, NotificationFormat.Money(refundRequest.Amount), invoice.InvoiceNumber, reason),
                        NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken: cancellationToken));

                return ToResponse(refundRequest, invoice);
            }, cancellationToken);
        }


        // In-app notifications are optional so unit tests can build the service without them
        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        public async Task<IReadOnlyList<RefundRequestResponse>> GetListAsync(
            RefundRequestQueryParameters parameters,
            CancellationToken cancellationToken = default)
        {
            string? status = null;
            if (!string.IsNullOrWhiteSpace(parameters.Status))
            {
                status = NormalizeStatus(parameters.Status);
            }

            var items = await _refundRepository.GetListAsync(status, parameters.InvoiceId, cancellationToken);
            return items.Select(r => ToResponse(r, r.Invoice)).ToList();
        }

        public Task<RefundRequestResponse> SetWorkDoneAsync(
            long requestId,
            string managerUserId,
            SetWorkDoneAmountRequest request,
            CancellationToken cancellationToken = default)
        {
            return _refundRepository.ExecuteInTransactionAsync(async () =>
            {
                var refundRequest = await _refundRepository.GetByIdWithInvoiceAsync(requestId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(
                    refundRequest != null,
                    ErrorConstants.RefundMessage.RequestNotFound);

                ConditionGuard.Ensure(
                    refundRequest!.Status == PaymentConstants.RefundRequestStatus.Pending,
                    ErrorConstants.RefundMessage.RequestNotPending);

                var invoice = refundRequest.Invoice;
                var netPaid = InvoiceMoneyHelper.GetNetPaidAmount(invoice);
                var workDone = decimal.Round(request.WorkDoneAmount, 2, MidpointRounding.AwayFromZero);
                ConditionGuard.Ensure(workDone >= 0, ErrorConstants.RefundMessage.WorkDoneAmountInvalid);
                // Must leave a positive refund amount (CK_RefundAdjustments_Amount: Amount > 0)
                ConditionGuard.Ensure(workDone < netPaid, ErrorConstants.RefundMessage.WorkDoneExceedsPaid);

                refundRequest.WorkDoneAmount = workDone;
                refundRequest.UpdatedAt = DateTimeOffset.UtcNow;
                invoice.UpdatedAt = refundRequest.UpdatedAt;
                _invoiceRepository.Update(invoice);
                await _refundRepository.SaveChangesAsync(cancellationToken);

                await SafeAuditAsync(
                    AuditConstants.RefundWorkDoneSet,
                    refundRequest.Id.ToString(),
                    null,
                    new { refundRequest.InvoiceId, workDone, netPaid, managerUserId });

                return ToResponse(refundRequest, invoice);
            }, cancellationToken);
        }

        public Task<RefundRequestResponse> ApproveAsync(
            long requestId,
            string approvedByUserId,
            CancellationToken cancellationToken = default)
        {
            return _refundRepository.ExecuteInTransactionAsync(async () =>
            {
                var refundRequest = await _refundRepository.GetByIdWithInvoiceAsync(requestId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(
                    refundRequest != null,
                    ErrorConstants.RefundMessage.RequestNotFound);

                ConditionGuard.Ensure(
                    refundRequest!.Status == PaymentConstants.RefundRequestStatus.Pending,
                    ErrorConstants.RefundMessage.RequestNotPending);

                ConditionGuard.Ensure(
                    refundRequest.WorkDoneAmount.HasValue,
                    ErrorConstants.RefundMessage.WorkDoneAmountRequired);

                var invoice = refundRequest.Invoice;
                // Net before this pending request (pending Amount is provisional and not counted)
                var netPaid = InvoiceMoneyHelper.GetNetPaidAmount(invoice);
                var workDone = decimal.Round(refundRequest.WorkDoneAmount!.Value, 2, MidpointRounding.AwayFromZero);
                ConditionGuard.Ensure(workDone >= 0, ErrorConstants.RefundMessage.WorkDoneAmountInvalid);
                ConditionGuard.Ensure(workDone < netPaid, ErrorConstants.RefundMessage.WorkDoneExceedsPaid);

                var refundAmount = decimal.Round(netPaid - workDone, 2, MidpointRounding.AwayFromZero);

                var now = DateTimeOffset.UtcNow;
                refundRequest.Amount = refundAmount;
                // BE-B3: approved, the receptionist pays it out later (payout)
                refundRequest.Status = PaymentConstants.RefundRequestStatus.Approved;
                refundRequest.ApprovedByUserId = string.IsNullOrWhiteSpace(approvedByUserId) ? null : approvedByUserId;
                refundRequest.ApprovedAt = now;
                refundRequest.UpdatedAt = now;

                InvoiceMoneyHelper.Recalculate(invoice);
                invoice.UpdatedAt = now;
                _invoiceRepository.Update(invoice);
                await _refundRepository.SaveChangesAsync(cancellationToken);

                await SafeAuditAsync(
                    AuditConstants.RefundApproved,
                    refundRequest.Id.ToString(),
                    null,
                    new
                    {
                        refundRequest.InvoiceId,
                        refundRequest.Amount,
                        refundRequest.WorkDoneAmount,
                        invoice.PaidAmount,
                        invoice.PaymentStatus,
                        approvedByUserId
                    });

                await NotifyAsync(n => n.NotifyPatientAsync(invoice.PatientId,
                    new NotificationContent(NotificationConstants.Text.RefundApprovedTitle, string.Format(NotificationConstants.Text.RefundApprovedMessage, NotificationFormat.Money(refundRequest.Amount), invoice.InvoiceNumber),
                        NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken));
                if (!IsSentByPatient(refundRequest, invoice))
                {
                    await NotifyAsync(n => n.NotifyUsersAsync(new[] { refundRequest.RequestedByUserId },
                        new NotificationContent(NotificationConstants.Text.RefundDecidedForRequesterTitle,
                            string.Format(NotificationConstants.Text.RefundDecidedForRequesterMessage, invoice.InvoiceNumber, "đã duyệt, hoàn " + NotificationFormat.Money(refundRequest.Amount)),
                            NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken));
                }

                return ToResponse(refundRequest, invoice);
            }, cancellationToken);
        }

        public Task<RefundRequestResponse> RejectAsync(
            long requestId,
            string rejectedByUserId,
            RejectRefundRequest request,
            CancellationToken cancellationToken = default)
        {
            return _refundRepository.ExecuteInTransactionAsync(async () =>
            {
                var rejectionReason = request.RejectionReason?.Trim() ?? string.Empty;
                ConditionGuard.Ensure(
                    rejectionReason.Length > 0,
                    ErrorConstants.RefundMessage.RejectionReasonRequired);

                var refundRequest = await _refundRepository.GetByIdWithInvoiceAsync(requestId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(
                    refundRequest != null,
                    ErrorConstants.RefundMessage.RequestNotFound);

                ConditionGuard.Ensure(
                    refundRequest!.Status == PaymentConstants.RefundRequestStatus.Pending,
                    ErrorConstants.RefundMessage.RequestNotPending);

                var now = DateTimeOffset.UtcNow;
                refundRequest.Status = PaymentConstants.RefundRequestStatus.Rejected;
                refundRequest.RejectionReason = rejectionReason;
                refundRequest.ApprovedByUserId = string.IsNullOrWhiteSpace(rejectedByUserId) ? null : rejectedByUserId;
                refundRequest.ApprovedAt = now;
                refundRequest.UpdatedAt = now;

                var invoice = refundRequest.Invoice;
                invoice.UpdatedAt = now;
                _invoiceRepository.Update(invoice);
                await _refundRepository.SaveChangesAsync(cancellationToken);

                await SafeAuditAsync(
                    AuditConstants.RefundRejected,
                    refundRequest.Id.ToString(),
                    null,
                    new
                    {
                        refundRequest.InvoiceId,
                        rejectionReason,
                        rejectedByUserId
                    });
                await NotifyAsync(n => n.NotifyPatientAsync(invoice.PatientId,
                    new NotificationContent(NotificationConstants.Text.RefundRejectedTitle, string.Format(NotificationConstants.Text.RefundRejectedMessage, invoice.InvoiceNumber, rejectionReason),
                        NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken));
                if (!IsSentByPatient(refundRequest, invoice))
                {
                    await NotifyAsync(n => n.NotifyUsersAsync(new[] { refundRequest.RequestedByUserId },
                        new NotificationContent(NotificationConstants.Text.RefundDecidedForRequesterTitle,
                            string.Format(NotificationConstants.Text.RefundDecidedForRequesterMessage, invoice.InvoiceNumber, "bị từ chối, lý do: " + rejectionReason),
                            NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken));
                }

                return ToResponse(refundRequest, invoice);
            }, cancellationToken);
        }

        public Task<RefundRequestResponse> PayoutAsync(
            long requestId,
            string paidOutByUserId,
            CancellationToken cancellationToken = default)
        {
            return _refundRepository.ExecuteInTransactionAsync(async () =>
            {
                var refundRequest = await _refundRepository.GetByIdWithInvoiceAsync(requestId, cancellationToken);
                ConditionGuard.Ensure<NotFoundException>(
                    refundRequest != null,
                    ErrorConstants.RefundMessage.RequestNotFound);

                ConditionGuard.Ensure(
                    refundRequest!.Status == PaymentConstants.RefundRequestStatus.Approved,
                    ErrorConstants.RefundMessage.RequestNotApproved);

                var now = DateTimeOffset.UtcNow;
                refundRequest.Status = PaymentConstants.RefundRequestStatus.Processed;
                refundRequest.ProcessedAt = now;
                // So the cash paid out is counted in this receptionist's cash session
                refundRequest.ProcessedByUserId = string.IsNullOrWhiteSpace(paidOutByUserId) ? null : paidOutByUserId;
                refundRequest.UpdatedAt = now;

                var invoice = refundRequest.Invoice;
                invoice.UpdatedAt = now;
                _invoiceRepository.Update(invoice);
                await _refundRepository.SaveChangesAsync(cancellationToken);

                await SafeAuditAsync(
                    AuditConstants.RefundProcessed,
                    refundRequest.Id.ToString(),
                    null,
                    new { refundRequest.InvoiceId, refundRequest.Amount, refundRequest.ProcessedAt, paidOutByUserId });
                await NotifyAsync(n => n.NotifyPatientAsync(invoice.PatientId,
                    new NotificationContent(NotificationConstants.Text.RefundPaidOutTitle,
                        string.Format(NotificationConstants.Text.RefundPaidOutMessage, NotificationFormat.Money(refundRequest.Amount), invoice.InvoiceNumber),
                        NotificationConstants.Reference.RefundRequest, refundRequest.Id.ToString()), cancellationToken));

                return ToResponse(refundRequest, invoice);
            }, cancellationToken);
        }

        public async Task<IReadOnlyList<MyRefundRequestResponse>> GetMyAsync(
            string userId,
            CancellationToken cancellationToken = default)
        {
            var invoices = await GetMyInvoicesAsync(userId, cancellationToken);
            return invoices
                .SelectMany(invoice => invoice.RefundAdjustmentRequests
                    .Where(r => r.RequestType == PaymentConstants.RefundRequestType.Refund)
                    .Select(r => ToMyResponse(r, invoice)))
                .OrderByDescending(r => r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .ToList();
        }

        public async Task<IReadOnlyList<MyRefundableInvoiceResponse>> GetMyRefundableInvoicesAsync(
            string userId,
            CancellationToken cancellationToken = default)
        {
            var invoices = await GetMyInvoicesAsync(userId, cancellationToken);
            return invoices
                .Where(invoice => invoice.PaymentStatus != InvoiceConstants.Refunded
                    && InvoiceMoneyHelper.GetNetPaidAmount(invoice) > 0
                    && !invoice.RefundAdjustmentRequests.Any(r => r.Status == PaymentConstants.RefundRequestStatus.Pending))
                .Select(invoice => new MyRefundableInvoiceResponse
                {
                    InvoiceId = invoice.Id,
                    InvoiceNumber = invoice.InvoiceNumber,
                    TreatmentPlanId = invoice.TreatmentPlanId,
                    AccountName = AccountName(invoice),
                    InvoiceDate = invoice.CreatedAt,
                    DoctorName = DoctorName(invoice),
                    PaidAmount = InvoiceMoneyHelper.GetNetPaidAmount(invoice)
                })
                .ToList();
        }

        public async Task<MyRefundRequestResponse> RequestMyAsync(
            string userId,
            CreateMyRefundRequest request,
            CancellationToken cancellationToken = default)
        {
            var patientId = await GetMyPatientIdAsync(userId, cancellationToken);
            var invoice = await _invoiceRepository.GetByIdWithDetailsAsync(request.InvoiceId, cancellationToken);
            // Another patient's invoice looks the same as a missing one
            ConditionGuard.Ensure<NotFoundException>(invoice != null && invoice.PatientId == patientId, ErrorConstants.RefundMessage.InvoiceNotFound);

            var created = await RequestAsync(request.InvoiceId, userId, new CreateRefundRequest { Reason = request.Reason }, cancellationToken);
            var mine = await GetMyAsync(userId, cancellationToken);
            return mine.First(r => r.Id == created.Id);
        }

        private async Task<int> GetMyPatientIdAsync(string userId, CancellationToken cancellationToken)
        {
            var patientId = await _refundRepository.GetPatientIdByUserIdAsync(userId, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(patientId.HasValue, ErrorConstants.AppointmentMessage.PatientProfileNotFound);
            return patientId!.Value;
        }

        private async Task<IReadOnlyList<Invoice>> GetMyInvoicesAsync(string userId, CancellationToken cancellationToken)
        {
            var patientId = await GetMyPatientIdAsync(userId, cancellationToken);
            return await _refundRepository.GetPatientInvoicesForRefundAsync(patientId, cancellationToken);
        }

        private static MyRefundRequestResponse ToMyResponse(RefundAdjustmentRequest request, Invoice invoice)
        {
            var decided = request.Status == PaymentConstants.RefundRequestStatus.Approved
                || request.Status == PaymentConstants.RefundRequestStatus.Processed;
            return new MyRefundRequestResponse
            {
                Id = request.Id,
                Code = $"HT{request.Id:D6}",
                InvoiceId = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                TreatmentPlanId = invoice.TreatmentPlanId,
                AccountName = AccountName(invoice),
                InvoiceDate = invoice.CreatedAt,
                DoctorName = DoctorName(invoice),
                // Once decided, Amount = paid − work done, so the paid amount at that time is their sum
                PaidAmount = decided ? request.Amount + (request.WorkDoneAmount ?? 0m) : InvoiceMoneyHelper.GetNetPaidAmount(invoice),
                RefundAmount = decided ? request.Amount : null,
                WorkDoneAmount = decided ? request.WorkDoneAmount : null,
                Reason = request.Reason,
                Status = request.Status,
                RejectionReason = request.RejectionReason,
                CreatedAt = request.CreatedAt,
                ApprovedAt = request.ApprovedAt,
                ProcessedAt = request.ProcessedAt,
                RefundMethod = RefundMethod(request, invoice)
            };
        }

        private static string? AccountName(Invoice invoice) =>
            invoice.TreatmentPlan?.PlanName is { Length: > 0 } planName
                ? planName
                : string.Join(" · ", invoice.Items.OrderBy(i => i.SortOrder).Select(i => i.ServiceName).Distinct());

        private static string? DoctorName(Invoice invoice) =>
            invoice.Appointment?.Doctor?.FullName ?? invoice.TreatmentPlan?.CreatedByDoctor?.FullName;

        // Money goes back the way it was paid: the chosen payment, otherwise the latest confirmed one
        private static string? RefundMethod(RefundAdjustmentRequest request, Invoice invoice)
        {
            var confirmed = invoice.Payments.Where(p => p.PaymentStatus == PaymentConstants.Confirmed).ToList();
            var payment = confirmed.FirstOrDefault(p => p.Id == request.PaymentId)
                ?? confirmed.OrderByDescending(p => p.PaidAt ?? p.CreatedAt).FirstOrDefault();
            return payment?.PaymentMethod;
        }

        private static bool IsSentByPatient(RefundAdjustmentRequest request, Invoice? invoice) =>
            invoice?.Patient?.UserId is { Length: > 0 } patientUserId && patientUserId == request.RequestedByUserId;

        private static void EnsureInvoiceRefundable(Invoice invoice)
        {
            ConditionGuard.ThrowIf(
                invoice.PaymentStatus == InvoiceConstants.Cancelled
                || invoice.PaymentStatus == InvoiceConstants.Refunded,
                ErrorConstants.RefundMessage.InvoiceNotRefundable);
        }

        private static string NormalizeStatus(string status)
        {
            var trimmed = status.Trim();
            var match = PaymentConstants.RefundRequestStatus.All.FirstOrDefault(s =>
                string.Equals(s, trimmed, StringComparison.OrdinalIgnoreCase));
            ConditionGuard.Ensure(match != null, ErrorConstants.RefundMessage.StatusInvalid);
            return match!;
        }

        private async Task SafeAuditAsync(string action, string entityId, object? oldValues, object? newValues)
        {
            try
            {
                await _auditLogService.LogAsync(
                    action,
                    AuditConstants.RefundRequestEntity,
                    entityId,
                    oldValues,
                    newValues);
            }
            catch
            {
                // Audit must never fail the business operation.
            }
        }

        private static RefundRequestResponse ToResponse(RefundAdjustmentRequest request, Invoice? invoice)
        {
            return new RefundRequestResponse
            {
                Id = request.Id,
                InvoiceId = request.InvoiceId,
                InvoiceNumber = invoice?.InvoiceNumber,
                PaymentId = request.PaymentId,
                RequestType = request.RequestType,
                Amount = request.Amount,
                WorkDoneAmount = request.WorkDoneAmount,
                Reason = request.Reason,
                Status = request.Status,
                RequestedByUserId = request.RequestedByUserId,
                ApprovedByUserId = request.ApprovedByUserId,
                ApprovedAt = request.ApprovedAt,
                RejectionReason = request.RejectionReason,
                ProcessedAt = request.ProcessedAt,
                CreatedAt = request.CreatedAt,
                InvoicePaidAmount = invoice?.PaidAmount,
                InvoicePaymentStatus = invoice?.PaymentStatus,
                PatientName = invoice?.Patient?.FullName,
                PatientCode = invoice?.Patient?.PatientCode,
                ServiceNames = invoice?.Items is { Count: > 0 } items ? string.Join(" · ", items.Select(i => i.ServiceName)) : null,
                RequestedByName = IsSentByPatient(request, invoice) ? "Bệnh nhân" : "Lễ tân"
            };
        }
    }
}

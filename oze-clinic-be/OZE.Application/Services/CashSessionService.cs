using System.Text.Json;
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
    // A receptionist's cash drawer: open with the starting cash, record cash paid out, count and hand over at the end
    public class CashSessionService : ICashSessionService
    {
        private readonly ICashSessionRepository _cashSessionRepository;
        private readonly IAuditLogService _auditLogService;
        private readonly INotificationService? _notifications;

        public CashSessionService(ICashSessionRepository cashSessionRepository, IAuditLogService auditLogService, INotificationService? notifications = null)
        {
            _cashSessionRepository = cashSessionRepository;
            _auditLogService = auditLogService;
            _notifications = notifications;
        }

        public async Task<CashSessionResponse?> GetCurrentAsync(string userId, CancellationToken cancellationToken = default)
        {
            var session = await _cashSessionRepository.GetOpenByUserAsync(userId, cancellationToken);
            return session == null ? null : await ToResponseAsync(session, cancellationToken);
        }

        public async Task<CashSessionResponse> OpenAsync(
            string userId,
            OpenCashSessionRequest request,
            CancellationToken cancellationToken = default)
        {
            var openingCash = MoneyHelper.Round(request.OpeningCash ?? 0m);
            ConditionGuard.Ensure(openingCash >= 0, ErrorConstants.CashSessionMessage.OpeningCashInvalid);

            var existing = await _cashSessionRepository.GetOpenByUserAsync(userId, cancellationToken);
            ConditionGuard.ThrowIf(existing != null, ErrorConstants.CashSessionMessage.AlreadyOpen);

            // One drawer at a time: the previous shift is closed and counted before the next one starts
            var other = await _cashSessionRepository.GetOpenOfOthersAsync(userId, cancellationToken);
            if (other != null)
            {
                var otherNames = await _cashSessionRepository.GetStaffNamesAsync(new[] { other.OpenedByUserId }, cancellationToken);
                throw new BadRequestException(string.Format(ErrorConstants.CashSessionMessage.AnotherSessionOpen,
                    otherNames.GetValueOrDefault(other.OpenedByUserId, string.Empty),
                    ClinicClock.ToClinicTime(other.OpenedAt).ToString("HH:mm dd/MM/yyyy")));
            }

            var now = DateTimeOffset.UtcNow;
            var session = new CashSession
            {
                OpenedByUserId = userId,
                OpenedAt = now,
                OpeningCash = openingCash,
                Status = CashSessionConstants.Open,
                Notes = Trimmed(request.Notes),
                CreatedAt = now
            };
            await _cashSessionRepository.AddAsync(session, cancellationToken);
            await _cashSessionRepository.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.CashSessionOpened, AuditConstants.CashSessionEntity, session.Id.ToString(),
                newValues: new { session.OpeningCash });

            return await ToResponseAsync(session, cancellationToken);
        }

        public async Task<CashSessionResponse> AddExpenseAsync(
            string userId,
            AddCashExpenseRequest request,
            CancellationToken cancellationToken = default)
        {
            var session = await LoadOpenAsync(userId, cancellationToken);

            var amount = MoneyHelper.Round(request.Amount ?? 0m);
            ConditionGuard.Ensure(amount > 0, ErrorConstants.CashSessionMessage.ExpenseAmountInvalid);
            var description = request.Description?.Trim() ?? string.Empty;
            ConditionGuard.Ensure(description.Length > 0, ErrorConstants.CashSessionMessage.ExpenseDescriptionRequired);
            var category = NormalizeCategory(request.Category);

            // Money cannot leave a drawer that does not have it
            var current = await ToResponseAsync(session, cancellationToken);
            ConditionGuard.ThrowIf(amount > current.ExpectedCash, ErrorConstants.CashSessionMessage.ExpenseExceedsCash);

            var expense = new CashExpense
            {
                Amount = amount,
                Category = category,
                Description = description,
                CreatedByUserId = userId,
                CreatedAt = DateTimeOffset.UtcNow
            };
            session.Expenses.Add(expense);
            session.UpdatedAt = expense.CreatedAt;
            await _cashSessionRepository.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.CashExpenseAdded, AuditConstants.CashSessionEntity, session.Id.ToString(),
                newValues: new { expense.Id, expense.Amount, expense.Category, expense.Description });

            return await ToResponseAsync(session, cancellationToken);
        }

        public async Task<CashSessionResponse> RemoveExpenseAsync(string userId, long expenseId, CancellationToken cancellationToken = default)
        {
            var session = await LoadOpenAsync(userId, cancellationToken);
            var expense = session.Expenses.FirstOrDefault(x => x.Id == expenseId);
            ConditionGuard.Ensure<NotFoundException>(expense != null, ErrorConstants.CashSessionMessage.ExpenseNotFound);

            session.Expenses.Remove(expense!);
            _cashSessionRepository.RemoveExpense(expense!);
            session.UpdatedAt = DateTimeOffset.UtcNow;
            await _cashSessionRepository.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.CashExpenseRemoved, AuditConstants.CashSessionEntity, session.Id.ToString(),
                oldValues: new { expense!.Id, expense.Amount, expense.Description });

            return await ToResponseAsync(session, cancellationToken);
        }

        public async Task<CashSessionResponse> CloseAsync(
            string userId,
            CloseCashSessionRequest request,
            CancellationToken cancellationToken = default)
        {
            var session = await LoadOpenAsync(userId, cancellationToken);
            // The screen was counting another session (closed in another tab, or a new one opened since)
            if (request.SessionId.HasValue && request.SessionId.Value != session.Id)
            {
                throw new ConflictException(ErrorConstants.CashSessionMessage.SessionChanged, CashSessionConstants.SessionChangedCode);
            }

            var counted = MoneyHelper.Round(request.CountedCash ?? -1m);
            ConditionGuard.Ensure(counted >= 0, ErrorConstants.CashSessionMessage.CountedCashInvalid);
            var denominations = ValidDenominations(request.Denominations, counted);
            decimal? countedTransfer = request.CountedTransfer.HasValue ? MoneyHelper.Round(request.CountedTransfer.Value) : null;
            ConditionGuard.Ensure(countedTransfer is null or >= 0m, ErrorConstants.CashSessionMessage.CountedCashInvalid);

            string? handoverTo = null;
            if (!string.IsNullOrWhiteSpace(request.HandoverToUserId))
            {
                handoverTo = request.HandoverToUserId.Trim();
                var candidates = await _cashSessionRepository.GetActiveReceptionistsAsync(cancellationToken);
                ConditionGuard.Ensure(
                    handoverTo != userId && candidates.Any(x => x.UserId == handoverTo),
                    ErrorConstants.CashSessionMessage.HandoverInvalid);
            }

            var now = DateTimeOffset.UtcNow;
            var numbers = await ComputeAsync(session, now, cancellationToken);
            // A payment, expense or refund came in while the drawer was being counted: count again on the new figures
            var figuresChanged = (request.ExpectedCash.HasValue && MoneyHelper.Round(request.ExpectedCash.Value) != numbers.ExpectedCash)
                || (request.ExpectedTransfer.HasValue && MoneyHelper.Round(request.ExpectedTransfer.Value) != numbers.TransferConfirmed);
            if (figuresChanged)
            {
                throw new ConflictException(ErrorConstants.CashSessionMessage.FiguresChanged, CashSessionConstants.FiguresChangedCode);
            }

            var difference = counted - numbers.ExpectedCash;
            decimal? transferDifference = countedTransfer.HasValue ? countedTransfer.Value - numbers.TransferConfirmed : null;
            var notes = Trimmed(request.Notes);
            ConditionGuard.ThrowIf(difference != 0 && notes == null, ErrorConstants.CashSessionMessage.DifferenceNoteRequired);
            ConditionGuard.ThrowIf(transferDifference is not null and not 0m && notes == null, ErrorConstants.CashSessionMessage.TransferNoteRequired);

            // Numbers are frozen at hand-over so later voids or edits do not rewrite a closed drawer
            session.Status = CashSessionConstants.Closed;
            session.ClosedAt = now;
            session.CashCollected = numbers.CashCollected;
            session.TransferConfirmed = numbers.TransferConfirmed;
            session.ExpenseTotal = numbers.ExpenseTotal;
            session.RefundPaidOut = numbers.RefundPaidOut;
            session.ExpectedCash = numbers.ExpectedCash;
            session.CountedCash = counted;
            session.Difference = difference;
            session.CountedTransfer = countedTransfer;
            session.TransferDifference = transferDifference;
            session.Denominations = denominations == null ? null : JsonSerializer.Serialize(denominations);
            session.HandoverToUserId = handoverTo;
            session.Notes = notes ?? session.Notes;
            session.UpdatedAt = now;
            await _cashSessionRepository.SaveChangesAsync(cancellationToken);

            await _auditLogService.LogAsync(AuditConstants.CashSessionClosed, AuditConstants.CashSessionEntity, session.Id.ToString(),
                newValues: new { session.ExpectedCash, session.CountedCash, session.Difference, session.CountedTransfer, session.TransferDifference, session.HandoverToUserId });

            var response = await ToResponseAsync(session, cancellationToken);
            await NotifyAsync(n => n.NotifyUsersAsync(new[] { handoverTo },
                new NotificationContent(NotificationConstants.Text.CashHandoverTitle, string.Format(NotificationConstants.Text.CashHandoverMessage, response.OpenedByName, NotificationFormat.Money(counted)),
                    NotificationConstants.Reference.CashSession, session.Id.ToString()), cancellationToken));
            if (difference != 0)
            {
                // A drawer that does not match the books is for the manager to look at
                await NotifyAsync(n => n.NotifyRolesAsync(new[] { RoleConstants.ClinicManagerRole },
                    new NotificationContent(NotificationConstants.Text.CashDifferenceTitle,
                        string.Format(NotificationConstants.Text.CashDifferenceMessage, response.OpenedByName, (difference > 0 ? "+" : "-") + NotificationFormat.Money(Math.Abs(difference)), notes),
                        NotificationConstants.Reference.CashSession, session.Id.ToString()), cancellationToken: cancellationToken));
            }

            return response;
        }


        // In-app notifications are optional so unit tests can build the service without them
        private Task NotifyAsync(Func<INotificationService, Task> send) => _notifications == null ? Task.CompletedTask : send(_notifications);

        public async Task<List<StaffOption>> GetHandoverCandidatesAsync(string userId, CancellationToken cancellationToken = default)
        {
            var receptionists = await _cashSessionRepository.GetActiveReceptionistsAsync(cancellationToken);
            return receptionists.Where(x => x.UserId != userId).ToList();
        }

        public async Task<NextCashShiftResponse> GetNextShiftAsync(string userId, CancellationToken cancellationToken = default)
        {
            var today = DateOnly.FromDateTime(ClinicClock.Today);
            var dayStart = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(ClinicTimeConstants.UtcOffsetHours));

            // The drawer starts with what the previous shift of today counted and handed over, whoever closed it
            var previous = await _cashSessionRepository.GetLatestClosedAsync(dayStart, dayStart.AddDays(1), cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(previous != null, ErrorConstants.CashSessionMessage.NoPreviousSession);

            var now = TimeOnly.FromDateTime(ClinicClock.Now);
            var shifts = await _cashSessionRepository.GetShiftsOfUserAsync(userId, today, cancellationToken) ?? new List<StaffSchedule>();
            var shift = shifts.FirstOrDefault(x => x.ShiftEnd > now);
            var names = await _cashSessionRepository.GetStaffNamesAsync(new[] { userId, previous!.OpenedByUserId }, cancellationToken);
            var previousName = names.GetValueOrDefault(previous.OpenedByUserId, string.Empty);

            return new NextCashShiftResponse
            {
                StaffName = names.GetValueOrDefault(userId, string.Empty),
                ShiftStart = shift?.ShiftStart,
                ShiftEnd = shift?.ShiftEnd,
                ExpectedOpeningCash = previous.CountedCash ?? previous.ExpectedCash ?? 0m,
                FromSessionId = previous.Id,
                FromUserName = previousName,
                PreviousClosedAt = previous.ClosedAt,
                PreviousClosedByName = previousName
            };
        }

        public async Task<CashSessionResponse> GetByIdAsync(string userId, bool isManager, long id, CancellationToken cancellationToken = default)
        {
            var session = await _cashSessionRepository.GetByIdAsync(id, cancellationToken);
            ConditionGuard.Ensure<NotFoundException>(session != null, ErrorConstants.CashSessionMessage.NotFound);
            ConditionGuard.Ensure<ForbiddenException>(isManager || session!.OpenedByUserId == userId, ErrorConstants.CashSessionMessage.NotOwner);
            return await ToResponseAsync(session!, cancellationToken);
        }

        public async Task<PagedResult<CashSessionSummaryResponse>> GetPagedAsync(
            string userId,
            bool isManager,
            CashSessionQuery query,
            CancellationToken cancellationToken = default)
        {
            query.Status = NormalizeStatus(query.Status);
            // A receptionist sees only their own sessions, except the open ones: before opening a shift they check
            // that nobody else's drawer is still open
            var openedBy = isManager ? query.OpenedByUserId
                : query.Status == CashSessionConstants.Open ? null : userId;
            var page = await _cashSessionRepository.GetPagedAsync(query, openedBy, cancellationToken);
            var names = await _cashSessionRepository.GetStaffNamesAsync(
                page.Items.SelectMany(x => new[] { x.OpenedByUserId, x.HandoverToUserId ?? string.Empty }),
                cancellationToken);

            return new PagedResult<CashSessionSummaryResponse>
            {
                Items = page.Items.Select(x => new CashSessionSummaryResponse
                {
                    Id = x.Id,
                    OpenedByName = names.GetValueOrDefault(x.OpenedByUserId, string.Empty),
                    OpenedAt = x.OpenedAt,
                    ClosedAt = x.ClosedAt,
                    Status = x.Status,
                    OpeningCash = x.OpeningCash,
                    CashCollected = x.CashCollected,
                    ExpenseTotal = x.ExpenseTotal,
                    ExpectedCash = x.ExpectedCash,
                    CountedCash = x.CountedCash,
                    Difference = x.Difference,
                    RefundPaidOut = x.RefundPaidOut,
                    TransferConfirmed = x.TransferConfirmed,
                    CountedTransfer = x.CountedTransfer,
                    TransferDifference = x.TransferDifference,
                    HandoverToName = x.HandoverToUserId == null ? null : names.GetValueOrDefault(x.HandoverToUserId)
                }).ToList(),
                TotalCount = page.TotalCount,
                PageNumber = page.PageNumber,
                PageSize = page.PageSize
            };
        }

        private async Task<CashSession> LoadOpenAsync(string userId, CancellationToken cancellationToken)
        {
            var session = await _cashSessionRepository.GetOpenByUserAsync(userId, cancellationToken);
            ConditionGuard.Ensure(session != null, ErrorConstants.CashSessionMessage.NoOpenSession);
            return session!;
        }

        private sealed record Numbers(
            decimal CashCollected,
            decimal TransferConfirmed,
            decimal ExpenseTotal,
            decimal RefundPaidOut,
            decimal ExpectedCash,
            List<CashSessionPaymentItem> Payments,
            List<CashSessionRefundItem> Refunds);

        // Cash in the drawer = opening cash + cash payments this receptionist took - expenses - refunds paid out
        private async Task<Numbers> ComputeAsync(CashSession session, DateTimeOffset until, CancellationToken cancellationToken)
        {
            var payments = await _cashSessionRepository.GetPaymentsConfirmedByAsync(
                session.OpenedByUserId, session.OpenedAt, until, cancellationToken) ?? new List<CashSessionPaymentItem>();
            var refunds = await _cashSessionRepository.GetRefundsPaidOutByAsync(
                session.OpenedByUserId, session.OpenedAt, until, cancellationToken) ?? new List<CashSessionRefundItem>();
            var cash = MoneyHelper.Round(payments.Where(x => x.PaymentMethod == PaymentConstants.Cash).Sum(x => x.Amount));
            var transfer = MoneyHelper.Round(payments.Where(x => x.PaymentMethod != PaymentConstants.Cash).Sum(x => x.Amount));
            var expenses = MoneyHelper.Round(session.Expenses.Sum(x => x.Amount));
            var refunded = MoneyHelper.Round(refunds.Sum(x => x.Amount));
            return new Numbers(cash, transfer, expenses, refunded, session.OpeningCash + cash - expenses - refunded, payments, refunds);
        }

        // Null when the drawer was counted only as a total
        private static SortedDictionary<int, int>? ValidDenominations(Dictionary<int, int>? denominations, decimal counted)
        {
            if (denominations == null)
            {
                return null;
            }

            ConditionGuard.Ensure(
                denominations.All(x => CashSessionConstants.Denominations.Contains(x.Key)
                    && x.Value >= 0 && x.Value <= CashSessionConstants.MaxNotesPerDenomination),
                ErrorConstants.CashSessionMessage.DenominationsInvalid);
            var total = denominations.Sum(x => (decimal)x.Key * x.Value);
            ConditionGuard.Ensure(total == counted, ErrorConstants.CashSessionMessage.DenominationsMismatch);

            // Largest note first, empty rows dropped
            var ordered = new SortedDictionary<int, int>(Comparer<int>.Create((a, b) => b.CompareTo(a)));
            foreach (var (note, count) in denominations.Where(x => x.Value > 0))
            {
                ordered[note] = count;
            }
            return ordered;
        }

        private static Dictionary<int, int>? ReadDenominations(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<Dictionary<int, int>>(json);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string? NormalizeStatus(string? status)
        {
            if (string.IsNullOrWhiteSpace(status))
            {
                return null;
            }

            var match = CashSessionConstants.Statuses
                .FirstOrDefault(x => string.Equals(x, status.Trim(), StringComparison.OrdinalIgnoreCase));
            ConditionGuard.Ensure(match != null, ErrorConstants.CashSessionMessage.StatusInvalid);
            return match;
        }

        private async Task<CashSessionResponse> ToResponseAsync(CashSession session, CancellationToken cancellationToken)
        {
            var isClosed = session.Status == CashSessionConstants.Closed;
            var numbers = await ComputeAsync(session, session.ClosedAt ?? DateTimeOffset.UtcNow.AddSeconds(1), cancellationToken);
            var names = await _cashSessionRepository.GetStaffNamesAsync(
                new[] { session.OpenedByUserId, session.HandoverToUserId ?? string.Empty }, cancellationToken);

            return new CashSessionResponse
            {
                Id = session.Id,
                OpenedByUserId = session.OpenedByUserId,
                OpenedByName = names.GetValueOrDefault(session.OpenedByUserId, string.Empty),
                OpenedAt = session.OpenedAt,
                Status = session.Status,
                OpeningCash = session.OpeningCash,
                CashCollected = isClosed ? session.CashCollected ?? 0 : numbers.CashCollected,
                TransferConfirmed = isClosed ? session.TransferConfirmed ?? 0 : numbers.TransferConfirmed,
                ExpenseTotal = isClosed ? session.ExpenseTotal ?? 0 : numbers.ExpenseTotal,
                RefundPaidOut = isClosed ? session.RefundPaidOut ?? 0 : numbers.RefundPaidOut,
                ExpectedCash = isClosed ? session.ExpectedCash ?? 0 : numbers.ExpectedCash,
                CountedCash = session.CountedCash,
                Difference = session.Difference,
                CountedTransfer = session.CountedTransfer,
                TransferDifference = session.TransferDifference,
                Denominations = ReadDenominations(session.Denominations),
                ClosedAt = session.ClosedAt,
                HandoverToUserId = session.HandoverToUserId,
                HandoverToName = session.HandoverToUserId == null ? null : names.GetValueOrDefault(session.HandoverToUserId),
                Notes = session.Notes,
                Expenses = session.Expenses
                    .OrderBy(x => x.CreatedAt)
                    .Select(x => new CashExpenseResponse
                    {
                        Id = x.Id,
                        Amount = x.Amount,
                        Category = x.Category,
                        Description = x.Description,
                        CreatedAt = x.CreatedAt
                    }).ToList(),
                Payments = numbers.Payments,
                Refunds = numbers.Refunds
            };
        }

        private static string NormalizeCategory(string? category)
        {
            if (string.IsNullOrWhiteSpace(category))
            {
                return CashSessionConstants.ExpenseOther;
            }

            var match = CashSessionConstants.ExpenseCategories
                .FirstOrDefault(x => string.Equals(x, category.Trim(), StringComparison.OrdinalIgnoreCase));
            ConditionGuard.Ensure(match != null, ErrorConstants.CashSessionMessage.ExpenseCategoryInvalid);
            return match!;
        }

        private static string? Trimmed(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}

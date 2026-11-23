using System.Globalization;
using Microsoft.EntityFrameworkCore;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class CashierRepository : ICashierRepository
    {
        private readonly AppIdentityDbContext _context;

        public CashierRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<List<CashierPatientInfo>> GetCandidatePatientsAsync(CancellationToken cancellationToken = default)
        {
            return _context.Patients
                .AsNoTracking()
                .Where(p => p.DeletedAt == null
                    && (_context.TreatmentPlans.Any(t => t.PatientId == p.Id && CashierConstants.PlanStatuses.Contains(t.Status))
                        || _context.Appointments.Any(a => a.PatientId == p.Id && a.Status == AppointmentConstants.CompletedStatus)))
                .OrderBy(p => p.FullName)
                .Select(p => new CashierPatientInfo { Id = p.Id, Code = p.PatientCode, Name = p.FullName, Phone = p.PhoneNumber })
                .ToListAsync(cancellationToken);
        }

        public Task<CashierPatientInfo?> GetPatientAsync(int patientId, CancellationToken cancellationToken = default)
        {
            return _context.Patients
                .AsNoTracking()
                .Where(p => p.Id == patientId && p.DeletedAt == null)
                .Select(p => new CashierPatientInfo { Id = p.Id, Code = p.PatientCode, Name = p.FullName, Phone = p.PhoneNumber })
                .FirstOrDefaultAsync(cancellationToken);
        }

        public async Task<List<CashierAccountResponse>> GetAccountsAsync(
            IReadOnlyCollection<CashierPatientInfo> patients,
            CancellationToken cancellationToken = default)
        {
            var ids = patients.Select(p => p.Id).Distinct().ToList();
            if (ids.Count == 0)
            {
                return new List<CashierAccountResponse>();
            }

            var plans = await _context.TreatmentPlans
                .AsNoTracking()
                .Include(t => t.Stages)
                .Where(t => ids.Contains(t.PatientId) && CashierConstants.PlanStatuses.Contains(t.Status))
                .ToListAsync(cancellationToken);
            var planIds = plans.Select(t => t.Id).ToList();

            var appointments = await _context.Appointments
                .AsNoTracking()
                .Include(a => a.ServiceItems)
                    .ThenInclude(s => s.Service)
                .Where(a => ids.Contains(a.PatientId) && a.Status == AppointmentConstants.CompletedStatus)
                .ToListAsync(cancellationToken);
            var appointmentIds = appointments.Select(a => a.Id).ToList();

            var invoices = await _context.Invoices
                .AsNoTracking()
                .Include(i => i.Items)
                .Include(i => i.Payments)
                .Where(i => i.PaymentStatus != InvoiceConstants.Cancelled
                    && ((i.TreatmentPlanId != null && planIds.Contains(i.TreatmentPlanId.Value))
                        || (i.TreatmentPlanId == null && i.AppointmentId != null && appointmentIds.Contains(i.AppointmentId.Value))))
                .AsSplitQuery()
                .ToListAsync(cancellationToken);

            var sessionServices = await GetSessionServicesByAppointmentAsync(appointmentIds, cancellationToken);

            var userIds = invoices
                .SelectMany(i => i.Payments)
                .SelectMany(p => new[] { p.CreatedByUserId, p.ConfirmedByUserId })
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => x!)
                .Distinct()
                .ToList();
            var names = userIds.Count == 0
                ? new Dictionary<string, string>()
                : await _context.StaffProfiles
                    .AsNoTracking()
                    .Where(s => userIds.Contains(s.UserId))
                    .ToDictionaryAsync(s => s.UserId, s => s.FullName, cancellationToken);

            return patients.Select(patient =>
            {
                var ownPlans = plans.Where(t => t.PatientId == patient.Id).OrderBy(t => t.Id).ToList();
                var ownPlanIds = ownPlans.Select(t => t.Id).ToHashSet();
                var planInvoices = invoices.Where(i => i.TreatmentPlanId.HasValue && ownPlanIds.Contains(i.TreatmentPlanId.Value)).ToList();

                var visits = appointments
                    .Where(a => a.PatientId == patient.Id)
                    .Select(a => ToVisit(a, invoices.FirstOrDefault(i => i.TreatmentPlanId == null && i.AppointmentId == a.Id), sessionServices))
                    .Where(v => v != null)
                    .Select(v => v!)
                    .OrderBy(v => v.StartAt)
                    .ToList();
                var visitIds = visits.Select(v => v.Id).ToHashSet();
                var visitInvoices = invoices.Where(i => i.TreatmentPlanId == null && i.AppointmentId.HasValue && visitIds.Contains(i.AppointmentId.Value)).ToList();

                return new CashierAccountResponse
                {
                    Patient = patient,
                    Plans = ownPlans.Select(t => ToPlan(t, planInvoices.FirstOrDefault(i => i.TreatmentPlanId == t.Id))).ToList(),
                    Visits = visits,
                    Receipts = ToReceipts(patient.Id, planInvoices.Concat(visitInvoices), names)
                };
            }).ToList();
        }

        public async Task<Dictionary<long, HashSet<int>>> GetSessionServicesByAppointmentAsync(
            IReadOnlyCollection<long> appointmentIds,
            CancellationToken cancellationToken = default)
        {
            if (appointmentIds.Count == 0)
            {
                return new Dictionary<long, HashSet<int>>();
            }

            var rows = await _context.TreatmentPlanStages
                .AsNoTracking()
                .Where(s => s.AppointmentId != null
                    && appointmentIds.Contains(s.AppointmentId.Value)
                    && s.ServiceId != null
                    && s.StageStatus != TreatmentPlanConstants.StageStatus.Cancelled)
                .Select(s => new { AppointmentId = s.AppointmentId!.Value, ServiceId = s.ServiceId!.Value })
                .ToListAsync(cancellationToken);

            return rows
                .GroupBy(x => x.AppointmentId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.ServiceId).ToHashSet());
        }

        // Plan price = estimated cost of the sessions not cancelled; a finished session adds what it cost over the estimate
        private static CashierPlanData ToPlan(TreatmentPlan plan, Invoice? invoice)
        {
            var stages = plan.Stages
                .Where(s => s.StageStatus != TreatmentPlanConstants.StageStatus.Cancelled)
                .OrderBy(s => s.StageNumber)
                .ToList();

            return new CashierPlanData
            {
                Id = plan.Id,
                PatientId = plan.PatientId,
                Name = string.IsNullOrWhiteSpace(plan.PlanName) ? $"Kế hoạch điều trị #{plan.Id}" : plan.PlanName.Trim(),
                Status = plan.Status,
                PlanPrice = stages.Count > 0 ? stages.Sum(s => s.EstimatedCost) : plan.EstimatedTotalCost,
                Option = plan.PaymentOption,
                DepositRate = plan.PaymentOption == CashierConstants.Option.Deposit && plan.DepositRate.HasValue
                    ? plan.DepositRate.Value / 100m
                    : null,
                OptionChosenAt = plan.PaymentOptionChosenAt.HasValue
                    ? DateOnly.FromDateTime(ClinicClock.ToClinicTime(plan.PaymentOptionChosenAt.Value))
                    : null,
                InvoiceId = invoice?.Id,
                Periods = stages.Select(s => new CashierPeriodData
                {
                    Id = s.Id,
                    Seq = s.StageNumber,
                    Name = s.StageName,
                    AppointmentId = s.AppointmentId,
                    Date = s.ActualDate ?? s.ScheduledDate,
                    PlanAmount = s.EstimatedCost,
                    ExtraAmount = CashierCalculator.ExtraOf(s),
                    Finished = s.StageStatus == TreatmentPlanConstants.StageStatus.Completed
                }).ToList()
            };
        }

        // A walk-in visit: the lines of its invoice, or its booked services that are not a plan session done in it
        private static CashierVisitData? ToVisit(Appointment appointment, Invoice? invoice, Dictionary<long, HashSet<int>> sessionServices)
        {
            List<CashierVisitServiceData> services;
            decimal amount;
            if (invoice != null)
            {
                services = invoice.Items
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new CashierVisitServiceData { Id = i.Id, Name = i.ServiceName, Amount = i.Amount })
                    .ToList();
                amount = invoice.FinalAmount;
            }
            else
            {
                var done = sessionServices.GetValueOrDefault(appointment.Id) ?? new HashSet<int>();
                services = appointment.ServiceItems
                    .Where(s => !done.Contains(s.ServiceId))
                    .OrderBy(s => s.Id)
                    .Select(s => new CashierVisitServiceData { Id = s.Id, Name = s.Service?.ServiceName ?? string.Empty, Amount = s.PriceAtBooking })
                    .ToList();
                amount = services.Sum(s => s.Amount);
            }

            if (services.Count == 0 && amount == 0)
            {
                return null;
            }

            var time = appointment.TimeSlotStart
                ?? (appointment.CheckInAt.HasValue ? TimeOnly.FromDateTime(ClinicClock.ToClinicTime(appointment.CheckInAt.Value)) : TimeOnly.MinValue);

            return new CashierVisitData
            {
                Id = appointment.Id,
                PatientId = appointment.PatientId,
                AppointmentId = appointment.Id,
                StartAt = appointment.AppointmentDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                    + "T" + time.ToString("HH:mm", CultureInfo.InvariantCulture),
                InvoiceId = invoice?.Id,
                Amount = amount,
                Services = services
            };
        }

        private static List<CashierReceiptData> ToReceipts(int patientId, IEnumerable<Invoice> invoices, Dictionary<string, string> names)
        {
            string? NameOf(string? userId) => userId != null && names.TryGetValue(userId, out var name) ? name : null;

            return invoices
                .SelectMany(i => i.Payments.Select(p => (Invoice: i, Payment: p)))
                .GroupBy(x => ReceiptIdOf(x.Payment))
                .Select(g =>
                {
                    var rows = g.OrderBy(x => x.Payment.Id).ToList();
                    var first = rows[0].Payment;
                    return new CashierReceiptData
                    {
                        Id = g.Key,
                        PatientId = patientId,
                        Method = first.PaymentMethod,
                        Status = ReceiptStatusOf(first.PaymentStatus),
                        Ref = rows.Select(x => x.Payment.TransactionReference).FirstOrDefault(x => x != null),
                        Note = rows.Select(x => x.Payment.Notes).FirstOrDefault(x => x != null),
                        CreatedAt = first.CreatedAt,
                        ReceivedBy = NameOf(first.CreatedByUserId ?? first.ConfirmedByUserId),
                        ConfirmedBy = NameOf(first.ConfirmedByUserId),
                        ConfirmedAt = first.PaymentStatus == PaymentConstants.Confirmed ? first.PaidAt : null,
                        Lines = rows.Select(x => ToLine(x.Invoice, x.Payment)).ToList()
                    };
                })
                .OrderByDescending(r => r.CreatedAt)
                .ToList();
        }

        public static string ReceiptIdOf(Payment payment) =>
            payment.ReceiptCode ?? $"{CashierConstants.SinglePaymentPrefix}{payment.Id}";

        public static string ReceiptStatusOf(string paymentStatus) => paymentStatus switch
        {
            PaymentConstants.Confirmed => CashierConstants.ReceiptStatus.Confirmed,
            PaymentConstants.Pending => CashierConstants.ReceiptStatus.Pending,
            _ => CashierConstants.ReceiptStatus.Rejected
        };

        // The kind is not stored: deposit by purpose, a session by its stage, otherwise by what the invoice is for
        private static CashierReceiptLineData ToLine(Invoice invoice, Payment payment)
        {
            string kind;
            if (payment.Purpose == PaymentConstants.PurposeDeposit)
            {
                kind = CashierConstants.LineKind.Deposit;
            }
            else if (payment.TreatmentPlanStageId.HasValue)
            {
                kind = CashierConstants.LineKind.Period;
            }
            else if (invoice.TreatmentPlanId.HasValue)
            {
                kind = CashierConstants.LineKind.Full;
            }
            else
            {
                kind = CashierConstants.LineKind.VisitService;
            }

            return new CashierReceiptLineData
            {
                PaymentId = payment.Id,
                Kind = kind,
                PlanId = invoice.TreatmentPlanId,
                PeriodId = payment.TreatmentPlanStageId,
                VisitId = invoice.TreatmentPlanId.HasValue ? null : invoice.AppointmentId,
                Amount = payment.Amount
            };
        }

        public Task<TreatmentPlan?> GetTrackedPlanAsync(long planId, CancellationToken cancellationToken = default)
        {
            return _context.TreatmentPlans
                .Include(t => t.Stages)
                .FirstOrDefaultAsync(t => t.Id == planId, cancellationToken);
        }

        public Task<Invoice?> GetTrackedPlanInvoiceAsync(long planId, CancellationToken cancellationToken = default)
        {
            return InvoicesWithMoney()
                .Where(i => i.TreatmentPlanId == planId && i.PaymentStatus != InvoiceConstants.Cancelled)
                .OrderByDescending(i => i.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public Task<Invoice?> GetTrackedVisitInvoiceAsync(long appointmentId, CancellationToken cancellationToken = default)
        {
            return InvoicesWithMoney()
                .Where(i => i.AppointmentId == appointmentId && i.TreatmentPlanId == null && i.PaymentStatus != InvoiceConstants.Cancelled)
                .OrderByDescending(i => i.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private IQueryable<Invoice> InvoicesWithMoney() =>
            _context.Invoices
                .Include(i => i.Items)
                .Include(i => i.Payments)
                .Include(i => i.RefundAdjustmentRequests)
                .AsSplitQuery();

        public Task<Appointment?> GetVisitAsync(int patientId, long appointmentId, CancellationToken cancellationToken = default)
        {
            return _context.Appointments
                .AsNoTracking()
                .Include(a => a.ServiceItems)
                    .ThenInclude(s => s.Service)
                .FirstOrDefaultAsync(a => a.Id == appointmentId
                    && a.PatientId == patientId
                    && a.Status == AppointmentConstants.CompletedStatus, cancellationToken);
        }

        public async Task<List<Payment>> GetTrackedReceiptPaymentsAsync(int patientId, string receiptId, CancellationToken cancellationToken = default)
        {
            var query = _context.Payments
                .Include(p => p.Invoice)
                    .ThenInclude(i => i.Payments)
                .Include(p => p.Invoice)
                    .ThenInclude(i => i.RefundAdjustmentRequests)
                .AsSplitQuery()
                .Where(p => p.Invoice.PatientId == patientId);

            // P{id}: a payment recorded on its own, without a receipt code
            if (receiptId.StartsWith(CashierConstants.SinglePaymentPrefix, StringComparison.Ordinal)
                && !receiptId.StartsWith(CashierConstants.ReceiptCodePrefix, StringComparison.Ordinal)
                && long.TryParse(receiptId.AsSpan(CashierConstants.SinglePaymentPrefix.Length), out var paymentId))
            {
                return await query.Where(p => p.Id == paymentId && p.ReceiptCode == null).ToListAsync(cancellationToken);
            }

            return await query.Where(p => p.ReceiptCode == receiptId).OrderBy(p => p.Id).ToListAsync(cancellationToken);
        }

        public Task<long?> FindSessionAppointmentIdAsync(int patientId, int doctorId, DateOnly date, CancellationToken cancellationToken = default)
        {
            // In service first, then any visit of the day with that doctor that is still open or just finished
            return _context.Appointments
                .AsNoTracking()
                .Where(a => a.PatientId == patientId
                    && a.AppointmentDate == date
                    && a.DoctorId == doctorId
                    && (a.Status == AppointmentConstants.InServiceStatus
                        || a.Status == AppointmentConstants.CheckedInStatus
                        || a.Status == AppointmentConstants.CompletedStatus))
                .OrderBy(a => a.Status == AppointmentConstants.InServiceStatus ? 0 : a.Status == AppointmentConstants.CheckedInStatus ? 1 : 2)
                .ThenByDescending(a => a.CheckInAt)
                .Select(a => (long?)a.Id)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public Task<string?> GetConfigValueAsync(string key, CancellationToken cancellationToken = default)
        {
            return _context.SystemConfigurations
                .AsNoTracking()
                .Where(c => c.ConfigKey == key)
                .Select(c => (string?)c.ConfigValue)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public Task<bool> ReceiptCodeExistsAsync(string code, CancellationToken cancellationToken = default)
        {
            return _context.Payments.AnyAsync(p => p.ReceiptCode == code, cancellationToken);
        }

        public Task<bool> InvoiceNumberExistsAsync(string number, CancellationToken cancellationToken = default)
        {
            return _context.Invoices.AnyAsync(i => i.InvoiceNumber == number, cancellationToken);
        }

        public async Task AddInvoiceAsync(Invoice invoice, CancellationToken cancellationToken = default)
        {
            await _context.Invoices.AddAsync(invoice, cancellationToken);
        }

        public async Task AddPaymentAsync(Payment payment, CancellationToken cancellationToken = default)
        {
            await _context.Payments.AddAsync(payment, cancellationToken);
        }

        public async Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken = default)
        {
            var strategy = _context.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
                try
                {
                    var result = await action();
                    await transaction.CommitAsync(cancellationToken);
                    return result;
                }
                catch
                {
                    await transaction.RollbackAsync(cancellationToken);
                    throw;
                }
            });
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }
    }
}

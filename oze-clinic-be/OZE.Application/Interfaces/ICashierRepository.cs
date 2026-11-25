using OZE.Common.Models;
using OZE.Domain.Entities;

namespace OZE.Application.Interfaces
{
    public interface ICashierRepository
    {
        // Patients that have a plan the cashier works on or a finished visit (not deleted)
        Task<List<CashierPatientInfo>> GetCandidatePatientsAsync(CancellationToken cancellationToken = default);

        Task<CashierPatientInfo?> GetPatientAsync(int patientId, CancellationToken cancellationToken = default);

        // Plans, walk-in visits and receipts of the patients, in the shape of the FE mock (read only)
        Task<List<CashierAccountResponse>> GetAccountsAsync(IReadOnlyCollection<CashierPatientInfo> patients, CancellationToken cancellationToken = default);

        Task<TreatmentPlan?> GetTrackedPlanAsync(long planId, CancellationToken cancellationToken = default);

        // Open (not cancelled) invoice of a plan, with items, payments and refund requests
        Task<Invoice?> GetTrackedPlanInvoiceAsync(long planId, CancellationToken cancellationToken = default);

        // Open invoice of a walk-in visit (no plan), with items, payments and refund requests
        Task<Invoice?> GetTrackedVisitInvoiceAsync(long appointmentId, CancellationToken cancellationToken = default);

        // Finished appointment of the patient with its booked services
        Task<Appointment?> GetVisitAsync(int patientId, long appointmentId, CancellationToken cancellationToken = default);

        // Services of plan sessions done in these appointments (appointment id -> service ids)
        Task<Dictionary<long, HashSet<int>>> GetSessionServicesByAppointmentAsync(IReadOnlyCollection<long> appointmentIds, CancellationToken cancellationToken = default);

        // Lines of one receipt: ReceiptCode, or P{id} for a payment recorded on its own; with their invoices
        Task<List<Payment>> GetTrackedReceiptPaymentsAsync(int patientId, string receiptId, CancellationToken cancellationToken = default);

        // Appointment the patient is being treated in today by that doctor, for linking a finished session to its visit
        Task<long?> FindSessionAppointmentIdAsync(int patientId, int doctorId, DateOnly date, CancellationToken cancellationToken = default);

        Task<string?> GetConfigValueAsync(string key, CancellationToken cancellationToken = default);

        Task<bool> ReceiptCodeExistsAsync(string code, CancellationToken cancellationToken = default);

        Task<bool> InvoiceNumberExistsAsync(string number, CancellationToken cancellationToken = default);

        Task AddInvoiceAsync(Invoice invoice, CancellationToken cancellationToken = default);

        Task AddPaymentAsync(Payment payment, CancellationToken cancellationToken = default);

        Task<T> ExecuteInTransactionAsync<T>(Func<Task<T>> action, CancellationToken cancellationToken = default);

        Task SaveChangesAsync(CancellationToken cancellationToken = default);
    }
}

using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;

namespace OZE.Persistence.Repositories
{
    public class DocumentRequestRepository : IDocumentRequestRepository
    {
        private readonly AppIdentityDbContext _context;

        public DocumentRequestRepository(AppIdentityDbContext context)
        {
            _context = context;
        }

        public Task<Examination?> GetExaminationAsync(long examinationId, CancellationToken cancellationToken = default)
        {
            return _context.Examinations
                .AsNoTracking()
                .Include(x => x.Patient)
                .Include(x => x.Doctor)
                .FirstOrDefaultAsync(x => x.Id == examinationId, cancellationToken);
        }

        public Task<List<DocumentRequest>> GetByPatientIdAsync(int patientId, long? examinationId, CancellationToken cancellationToken = default)
        {
            var requests = _context.DocumentRequests
                .AsNoTracking()
                .Where(x => x.PatientId == patientId);
            if (examinationId.HasValue)
            {
                requests = requests.Where(x => x.ExaminationId == examinationId.Value);
            }

            return requests
                .Include(x => x.Examination)
                .Include(x => x.RequestedByDoctor)
                .Include(x => x.Documents)
                .AsSplitQuery()
                .OrderByDescending(x => x.CreatedAt)
                .ThenByDescending(x => x.Id)
                .ToListAsync(cancellationToken);
        }

        public Task<DocumentRequest?> GetTrackedByIdAsync(long id, CancellationToken cancellationToken = default)
        {
            return _context.DocumentRequests
                .Include(x => x.Patient)
                .Include(x => x.RequestedByDoctor)
                .Include(x => x.Documents)
                .AsSplitQuery()
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        }

        public Task<PatientDocument?> GetDocumentWithPatientAsync(long documentId, CancellationToken cancellationToken = default)
        {
            return _context.PatientDocuments
                .AsNoTracking()
                .Include(x => x.Patient)
                .FirstOrDefaultAsync(x => x.Id == documentId, cancellationToken);
        }

        public async Task AddAsync(DocumentRequest request, CancellationToken cancellationToken = default)
        {
            _context.DocumentRequests.Add(request);
            await _context.SaveChangesAsync(cancellationToken);
        }

        public void AddDocuments(IEnumerable<PatientDocument> documents)
        {
            _context.PatientDocuments.AddRange(documents);
        }

        public Task SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            return _context.SaveChangesAsync(cancellationToken);
        }
    }
}

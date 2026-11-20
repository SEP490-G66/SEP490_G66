using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Models;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Repositories;

namespace OZE.UnitTest.IntegrationTests.DocumentRequests
{
    // The real DocumentRequestService on the real repositories (EF InMemory) with files kept in memory
    public class DocumentRequestServiceIntegrationTests : IDisposable
    {
        private const string DoctorUserId = "doctor-5";
        private const string PatientUserId = "patient-1";

        private readonly AppIdentityDbContext _dbContext;
        private readonly MemoryFileStore _fileStore = new();
        private readonly DocumentRequestService _service;

        public DocumentRequestServiceIntegrationTests()
        {
            var dbOptions = new DbContextOptionsBuilder<AppIdentityDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new AppIdentityDbContext(dbOptions);
            _service = new DocumentRequestService(
                new DocumentRequestRepository(_dbContext), new StaffRepository(_dbContext), new PatientRepository(_dbContext), _fileStore);
        }

        private sealed class MemoryFileStore : IImagingFileStore
        {
            public Dictionary<string, byte[]> Files { get; } = new();

            public Task SaveAsync(string relativePath, byte[] data, CancellationToken cancellationToken = default)
            {
                Files[relativePath] = data;
                return Task.CompletedTask;
            }

            public Task<byte[]?> ReadAsync(string relativePath, CancellationToken cancellationToken = default) =>
                Task.FromResult(Files.TryGetValue(relativePath, out var data) ? data : null);
        }

        private async Task SeedAsync()
        {
            var now = DateTimeOffset.UtcNow;
            _dbContext.Patients.Add(new Patient { Id = 1, UserId = PatientUserId, PatientCode = "BN-1", FullName = "Nguyễn Văn A", CreatedAt = now });
            _dbContext.StaffProfiles.Add(new StaffProfile { Id = 5, UserId = DoctorUserId, FullName = "Trần Minh Khoa", CreatedAt = now });
            _dbContext.Examinations.Add(new Examination { Id = 10, AppointmentId = 100, PatientId = 1, DoctorId = 5, ExaminationStatus = "InProgress", CreatedAt = now });
            await _dbContext.SaveChangesAsync();
            _dbContext.ChangeTracker.Clear();
        }

        [Fact]
        public async Task CreateThenSubmit_ShouldStoreTheRequestAndItsDocuments()
        {
            await SeedAsync();

            var created = await _service.CreateAsync(DoctorUserId, 10, new CreateDocumentRequest { DocumentName = "Xét nghiệm máu" });

            created.Id.Should().NotBe(0);
            created.Status.Should().Be(DocumentRequestConstants.Pending);
            _dbContext.ChangeTracker.Clear();

            var submitted = await _service.SubmitAsync(PatientUserId, created.Id, new List<UploadedImagingFile>
            {
                new("ket-qua.pdf", "application/pdf", new byte[] { 1, 2, 3 }),
                new("phim.png", "image/png", new byte[] { 4, 5 })
            });

            submitted.Status.Should().Be(DocumentRequestConstants.Submitted);
            submitted.Files.Should().HaveCount(2);
            submitted.Files.Should().OnlyContain(f => f.Id != 0 && f.FileUrl == $"/api/patient-documents/{f.Id}/file");

            _dbContext.ChangeTracker.Clear();
            var rows = await _dbContext.PatientDocuments.AsNoTracking().OrderBy(d => d.Id).ToListAsync();
            rows.Should().HaveCount(2);
            rows.Should().OnlyContain(d => d.DocumentRequestId == created.Id && d.PatientId == 1);
            rows.Select(d => d.Id).Should().BeEquivalentTo(submitted.Files.Select(f => f.Id));
            _fileStore.Files.Keys.Should().BeEquivalentTo(rows.Select(d => d.FilePath));
            (await _dbContext.DocumentRequests.AsNoTracking().SingleAsync()).Status.Should().Be(DocumentRequestConstants.Submitted);

            var file = await _service.GetFileAsync(PatientUserId, true, rows[0].Id);
            file.Data.Should().Equal(1, 2, 3);
        }

        public void Dispose()
        {
            _dbContext.Database.EnsureDeleted();
            _dbContext.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}

using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using OZE.Common.Constants;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Repositories;

namespace OZE.UnitTest.IntegrationTests.DocumentRequests
{
    // DocumentRequestRepository queries against the EF InMemory provider (same set-up as ServiceCatalogIntegrationTestBase)
    public class DocumentRequestRepositoryIntegrationTests : IDisposable
    {
        private readonly AppIdentityDbContext _dbContext;
        private readonly DocumentRequestRepository _repository;

        public DocumentRequestRepositoryIntegrationTests()
        {
            var dbOptions = new DbContextOptionsBuilder<AppIdentityDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _dbContext = new AppIdentityDbContext(dbOptions);
            _repository = new DocumentRequestRepository(_dbContext);
        }

        private static readonly DateTimeOffset Day = new(2026, 11, 1, 9, 0, 0, TimeSpan.Zero);

        // Patients 1 and 2, doctor 5; examinations 10 (patient 1, earlier), 11 (patient 1), 20 (patient 2)
        private async Task SeedAsync()
        {
            _dbContext.Patients.AddRange(
                new Patient { Id = 1, UserId = "patient-1", PatientCode = "BN-1", FullName = "Nguyễn Văn A", CreatedAt = Day },
                new Patient { Id = 2, UserId = "patient-2", PatientCode = "BN-2", FullName = "Trần Thị B", CreatedAt = Day });
            _dbContext.StaffProfiles.Add(new StaffProfile { Id = 5, UserId = "doctor-5", FullName = "Trần Minh Khoa", CreatedAt = Day });
            _dbContext.Examinations.AddRange(
                new Examination { Id = 10, AppointmentId = 100, PatientId = 1, DoctorId = 5, CreatedAt = Day },
                new Examination { Id = 11, AppointmentId = 101, PatientId = 1, DoctorId = 5, CreatedAt = Day.AddDays(7) },
                new Examination { Id = 20, AppointmentId = 200, PatientId = 2, DoctorId = 5, CreatedAt = Day });
            _dbContext.DocumentRequests.AddRange(
                Request(1, examinationId: 10, patientId: 1, createdAt: Day),
                Request(2, examinationId: 11, patientId: 1, createdAt: Day.AddDays(7)),
                Request(3, examinationId: 10, patientId: 1, createdAt: Day.AddHours(1)),
                Request(4, examinationId: 20, patientId: 2, createdAt: Day.AddDays(8)));
            _dbContext.PatientDocuments.Add(new PatientDocument
            {
                Id = 500, PatientId = 1, DocumentRequestId = 1, FileName = "ket-qua.pdf", FilePath = "documents/2026/11/DR-1/a.pdf", CreatedAt = Day.AddDays(2)
            });
            await _dbContext.SaveChangesAsync();
            _dbContext.ChangeTracker.Clear();
        }

        private static DocumentRequest Request(long id, long examinationId, int patientId, DateTimeOffset createdAt) => new()
        {
            Id = id,
            ExaminationId = examinationId,
            PatientId = patientId,
            RequestedByDoctorId = 5,
            DocumentName = $"Tài liệu {id}",
            Status = DocumentRequestConstants.Pending,
            CreatedAt = createdAt
        };

        [Fact]
        public async Task GetByPatientIdAsync_ShouldReturnOnlyThePatientsRequests_NewestFirst_WithExaminationDoctorAndFiles()
        {
            await SeedAsync();

            var result = await _repository.GetByPatientIdAsync(1, null);

            result.Select(r => r.Id).Should().Equal(2, 3, 1);
            result.Should().OnlyContain(r => r.Examination != null && r.RequestedByDoctor != null);
            result.Single(r => r.Id == 1).Documents.Should().ContainSingle(d => d.Id == 500);
            result.Single(r => r.Id == 2).Examination.CreatedAt.Should().Be(Day.AddDays(7));
        }

        [Fact]
        public async Task GetByPatientIdAsync_ShouldKeepOneExamination_WhenExaminationIdIsSet()
        {
            await SeedAsync();

            var result = await _repository.GetByPatientIdAsync(1, 10);

            result.Select(r => r.Id).Should().Equal(3, 1);
        }

        [Fact]
        public async Task GetByPatientIdAsync_ShouldReturnNothing_ForAnExaminationOfAnotherPatient()
        {
            await SeedAsync();

            var result = await _repository.GetByPatientIdAsync(1, 20);

            result.Should().BeEmpty();
        }

        [Fact]
        public async Task GetTrackedByIdAsync_ShouldLoadPatientAndDocuments_AndTrackChanges()
        {
            await SeedAsync();

            var request = await _repository.GetTrackedByIdAsync(1);

            request.Should().NotBeNull();
            request!.Patient.UserId.Should().Be("patient-1");
            request.Documents.Should().ContainSingle(d => d.FileName == "ket-qua.pdf");
            request.Status = DocumentRequestConstants.Submitted;
            await _repository.SaveChangesAsync();
            _dbContext.ChangeTracker.Clear();
            (await _dbContext.DocumentRequests.SingleAsync(r => r.Id == 1)).Status.Should().Be(DocumentRequestConstants.Submitted);
        }

        [Fact]
        public async Task GetDocumentWithPatientAsync_ShouldLoadTheOwner()
        {
            await SeedAsync();

            var document = await _repository.GetDocumentWithPatientAsync(500);

            document!.Patient.UserId.Should().Be("patient-1");
        }

        public void Dispose()
        {
            _dbContext.Database.EnsureDeleted();
            _dbContext.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}

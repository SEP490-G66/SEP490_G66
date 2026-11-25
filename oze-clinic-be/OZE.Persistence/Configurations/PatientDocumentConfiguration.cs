using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class PatientDocumentConfiguration : IEntityTypeConfiguration<PatientDocument>
    {
        public void Configure(EntityTypeBuilder<PatientDocument> builder)
        {
            builder.ToTable("PatientDocuments");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.DocumentType).HasMaxLength(50);
            builder.Property(x => x.FileName).HasMaxLength(500).IsRequired();
            builder.Property(x => x.FilePath).HasMaxLength(1000).IsRequired();
            builder.Property(x => x.MimeType).HasMaxLength(100);
            builder.Property(x => x.Description).HasMaxLength(500);
            builder.Property(x => x.ProviderAddress).HasMaxLength(300);
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");

            builder.HasOne(x => x.Patient)
                   .WithMany(x => x.Documents)
                   .HasForeignKey(x => x.PatientId)
                   .HasConstraintName("FK_PatientDocuments_Patients")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.DocumentRequest)
                   .WithMany(x => x.Documents)
                   .HasForeignKey(x => x.DocumentRequestId)
                   .HasConstraintName("FK_PatientDocuments_DocumentRequests")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne<ApplicationUser>()
                   .WithMany()
                   .HasForeignKey(x => x.UploadedByUserId)
                   .HasConstraintName("FK_PatientDocuments_UploadedBy")
                   .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => x.DocumentRequestId).HasDatabaseName("IX_PatientDocuments_DocumentRequestId");
            builder.HasIndex(x => x.UploadGroupId).HasDatabaseName("IX_PatientDocuments_UploadGroupId");
            builder.HasIndex(x => new { x.PatientId, x.DocumentType, x.CreatedAt })
                   .HasDatabaseName("IX_PatientDocuments_PatientId_Type")
                   .IsDescending(false, false, true);
        }
    }
}

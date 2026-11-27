using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class DocumentRequestConfiguration : IEntityTypeConfiguration<DocumentRequest>
    {
        public void Configure(EntityTypeBuilder<DocumentRequest> builder)
        {
            builder.ToTable("DocumentRequests", t =>
            {
                // Must match DocumentRequestConstants.Statuses
                t.HasCheckConstraint("CK_DocumentRequests_Status", "[Status] IN ('Pending', 'Submitted', 'Cancelled')");
            });
            builder.HasKey(x => x.Id);

            builder.Property(x => x.DocumentName).HasMaxLength(200).IsRequired();
            builder.Property(x => x.Note).HasMaxLength(500);
            builder.Property(x => x.Category).HasMaxLength(30);
            builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("Pending");
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");

            builder.HasOne(x => x.Examination)
                   .WithMany()
                   .HasForeignKey(x => x.ExaminationId)
                   .HasConstraintName("FK_DocumentRequests_Examinations")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.Patient)
                   .WithMany()
                   .HasForeignKey(x => x.PatientId)
                   .HasConstraintName("FK_DocumentRequests_Patients")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.RequestedByDoctor)
                   .WithMany()
                   .HasForeignKey(x => x.RequestedByDoctorId)
                   .HasConstraintName("FK_DocumentRequests_Doctors")
                   .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => x.ExaminationId).HasDatabaseName("IX_DocumentRequests_ExaminationId");
            builder.HasIndex(x => new { x.PatientId, x.CreatedAt }).HasDatabaseName("IX_DocumentRequests_PatientId");
        }
    }
}

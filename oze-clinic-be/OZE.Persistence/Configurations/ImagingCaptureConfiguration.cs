using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Common.Constants;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class ImagingCaptureConfiguration : IEntityTypeConfiguration<ImagingCapture>
    {
        public void Configure(EntityTypeBuilder<ImagingCapture> builder)
        {
            builder.ToTable("ImagingCaptures", t =>
            {
                t.HasCheckConstraint("CK_ImagingCaptures_Status",
                    "[Status] IN ('ACCEPTED', 'CAPTURING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')");
                t.HasCheckConstraint("CK_ImagingCaptures_Progress", "[Progress] BETWEEN 0 AND 100");
            });
            builder.HasKey(x => x.Id);

            builder.Property(x => x.SimulationId).HasMaxLength(ImagingCaptureConstants.SimulationIdMaxLength).IsRequired();
            builder.Property(x => x.DeviceId).HasMaxLength(ImagingCaptureConstants.DeviceIdMaxLength).IsRequired();
            builder.Property(x => x.Modality).HasMaxLength(ImagingCaptureConstants.ModalityMaxLength).IsRequired();
            builder.Property(x => x.BodyRegion).HasMaxLength(ImagingCaptureConstants.BodyRegionMaxLength);
            builder.Property(x => x.Status).HasMaxLength(ImagingCaptureConstants.StatusMaxLength).IsRequired();
            builder.Property(x => x.FailureCode).HasMaxLength(ImagingCaptureConstants.FailureCodeMaxLength);
            builder.Property(x => x.FailureMessage).HasMaxLength(ImagingCaptureConstants.FailureMessageMaxLength);
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");

            builder.HasOne(x => x.ImagingRequest)
                   .WithMany()
                   .HasForeignKey(x => x.ImagingRequestId)
                   .HasConstraintName("FK_ImagingCaptures_Requests")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.Technician)
                   .WithMany()
                   .HasForeignKey(x => x.TechnicianId)
                   .HasConstraintName("FK_ImagingCaptures_Technician")
                   .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => x.SimulationId).HasDatabaseName("IX_ImagingCaptures_SimulationId").IsUnique();
            builder.HasIndex(x => x.ImagingRequestId).HasDatabaseName("IX_ImagingCaptures_RequestId");
        }
    }
}

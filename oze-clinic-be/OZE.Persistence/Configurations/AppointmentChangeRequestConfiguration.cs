using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class AppointmentChangeRequestConfiguration : IEntityTypeConfiguration<AppointmentChangeRequest>
    {
        public void Configure(EntityTypeBuilder<AppointmentChangeRequest> builder)
        {
            builder.ToTable("AppointmentChangeRequests");
            builder.HasKey(x => x.Id);

            builder.Property(x => x.RequestType).HasMaxLength(20).IsRequired();
            builder.Property(x => x.Reason).HasMaxLength(200).IsRequired();
            builder.Property(x => x.PreferredTimes).HasMaxLength(200);
            builder.Property(x => x.Note).HasMaxLength(500);
            builder.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("Pending");
            builder.Property(x => x.HandledByUserId).HasMaxLength(450);
            builder.Property(x => x.HandlerNote).HasMaxLength(500);
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");

            builder.HasOne(x => x.Patient)
                   .WithMany()
                   .HasForeignKey(x => x.PatientId)
                   .HasConstraintName("FK_AppointmentChangeRequests_Patients")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.Appointment)
                   .WithMany()
                   .HasForeignKey(x => x.AppointmentId)
                   .HasConstraintName("FK_AppointmentChangeRequests_Appointments")
                   .OnDelete(DeleteBehavior.NoAction);
            builder.HasOne(x => x.TreatmentPlanStage)
                   .WithMany()
                   .HasForeignKey(x => x.TreatmentPlanStageId)
                   .HasConstraintName("FK_AppointmentChangeRequests_TreatmentPlanStages")
                   .OnDelete(DeleteBehavior.NoAction);

            // The front desk's list: pending first, newest first
            builder.HasIndex(x => new { x.Status, x.CreatedAt }).HasDatabaseName("IX_AppointmentChangeRequests_Status_CreatedAt");
            builder.HasIndex(x => x.PatientId).HasDatabaseName("IX_AppointmentChangeRequests_PatientId");
            builder.HasIndex(x => x.AppointmentId).HasDatabaseName("IX_AppointmentChangeRequests_AppointmentId");
            builder.HasIndex(x => x.TreatmentPlanStageId).HasDatabaseName("IX_AppointmentChangeRequests_TreatmentPlanStageId");
        }
    }
}

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Common.Constants;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class ExaminationToothFindingConfiguration : IEntityTypeConfiguration<ExaminationToothFinding>
    {
        public void Configure(EntityTypeBuilder<ExaminationToothFinding> builder)
        {
            builder.ToTable("ExaminationToothFindings");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.ToothNumber).HasMaxLength(DentalChartConstants.ToothNumberMaxLength).IsRequired();
            builder.Property(x => x.Condition).HasMaxLength(ExaminationConstants.ToothFindingConditionMaxLength).IsRequired();
            builder.Property(x => x.Surfaces).HasMaxLength(ExaminationConstants.ToothFindingSurfacesMaxLength);
            builder.Property(x => x.Notes).HasMaxLength(DentalChartConstants.NotesMaxLength);
            builder.Property(x => x.IsReplaced).HasDefaultValue(false);
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("SYSDATETIMEOFFSET()");

            builder.HasOne(x => x.Examination)
                   .WithMany(x => x.ToothFindings)
                   .HasForeignKey(x => x.ExaminationId)
                   .HasConstraintName("FK_ExaminationToothFindings_Examinations")
                   .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(x => x.Patient)
                   .WithMany()
                   .HasForeignKey(x => x.PatientId)
                   .HasConstraintName("FK_ExaminationToothFindings_Patients")
                   .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => x.ExaminationId).HasDatabaseName("IX_ExaminationToothFindings_ExaminationId");
        }
    }
}

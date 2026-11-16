using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using OZE.Domain.Entities;

namespace OZE.Persistence.Configurations
{
    public class ServiceImageConfiguration : IEntityTypeConfiguration<ServiceImage>
    {
        public void Configure(EntityTypeBuilder<ServiceImage> builder)
        {
            builder.ToTable("ServiceImages");
            builder.HasKey(x => x.ServiceId);

            builder.Property(x => x.ContentType).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Data).IsRequired();

            builder.HasOne(x => x.Service)
                   .WithOne(x => x.Image)
                   .HasForeignKey<ServiceImage>(x => x.ServiceId)
                   .HasConstraintName("FK_ServiceImages_Services")
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class ServiceVariantImageConfiguration : IEntityTypeConfiguration<ServiceVariantImage>
    {
        public void Configure(EntityTypeBuilder<ServiceVariantImage> builder)
        {
            builder.ToTable("ServiceVariantImages");
            builder.HasKey(x => x.ServiceVariantId);

            builder.Property(x => x.ContentType).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Data).IsRequired();

            builder.HasOne(x => x.ServiceVariant)
                   .WithOne(x => x.Image)
                   .HasForeignKey<ServiceVariantImage>(x => x.ServiceVariantId)
                   .HasConstraintName("FK_ServiceVariantImages_ServiceVariants")
                   .OnDelete(DeleteBehavior.Cascade);
        }
    }
}

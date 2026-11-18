using AutoMapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using OZE.Application.MappingProfiles;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Controllers;
using OZE.Domain.Entities;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Repositories;

namespace OZE.UnitTest.IntegrationTests.ServiceCatalog
{
    public abstract class ServiceCatalogIntegrationTestBase : IDisposable
    {
        protected readonly AppIdentityDbContext DbContext;
        protected readonly ServiceRepository Repository;
        protected readonly ClinicServiceService Service;
        protected readonly ServicesController Controller;
        protected readonly IDistributedCache Cache;
        protected readonly IMapper Mapper;
        protected readonly Mock<ILogger<ClinicServiceService>> LoggerMock;

        protected ServiceCatalogIntegrationTestBase()
        {
            var dbOptions = new DbContextOptionsBuilder<AppIdentityDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            DbContext = new AppIdentityDbContext(dbOptions);

            var mapperConfig = new MapperConfiguration(cfg =>
            {
                cfg.AddProfile<BaseMappingObject>();
            });
            Mapper = mapperConfig.CreateMapper();

            Cache = new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));
            LoggerMock = new Mock<ILogger<ClinicServiceService>>();

            Repository = new ServiceRepository(DbContext);
            Service = new ClinicServiceService(Repository, Mapper, LoggerMock.Object, Cache);
            Controller = new ServicesController(Service);
        }

        protected async Task<Service> SeedServiceAsync(
            string code = "TRN01",
            string name = "Trám răng composite",
            decimal price = 300000m,
            int? estimatedMinutes = 30,
            string? requiredRoomType = "GeneralTreatment",
            bool isActive = true,
            string? description = "Mô tả trám răng",
            int? recallIntervalMonths = 6)
        {
            var entity = new Service
            {
                ServiceCode = code.Trim().ToUpperInvariant(),
                ServiceName = name.Trim(),
                Description = description,
                ReferencePrice = price,
                EstimatedMinutes = estimatedMinutes,
                RequiredRoomType = requiredRoomType,
                RecallIntervalMonths = recallIntervalMonths,
                IsActive = isActive,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.Services.AddAsync(entity);
            await DbContext.SaveChangesAsync();
            return entity;
        }

        protected async Task<ServiceVariant> SeedVariantAsync(
            int serviceId,
            string variantCode = "TRN01_XO",
            string variantName = "Trám răng xoang 1",
            decimal price = 350000m,
            int? estimatedMinutes = 30,
            int displayOrder = 1,
            bool isActive = true)
        {
            var variant = new ServiceVariant
            {
                ServiceId = serviceId,
                VariantCode = variantCode.Trim().ToUpperInvariant(),
                VariantName = variantName.Trim(),
                ReferencePrice = price,
                EstimatedMinutes = estimatedMinutes,
                DisplayOrder = displayOrder,
                IsActive = isActive,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.ServiceVariants.AddAsync(variant);
            await DbContext.SaveChangesAsync();
            return variant;
        }

        protected async Task AttachServiceToAppointmentAsync(
            int serviceId,
            int? variantId = null,
            DateOnly? appointmentDate = null,
            string status = AppointmentConstants.ConfirmedStatus)
        {
            var appointment = new Appointment
            {
                AppointmentDate = appointmentDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
                Status = status,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.Appointments.AddAsync(appointment);
            await DbContext.SaveChangesAsync();

            var item = new AppointmentServiceItem
            {
                AppointmentId = appointment.Id,
                ServiceId = serviceId,
                VariantId = variantId,
                DurationMinutes = 30,
                PriceAtBooking = 300000m,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.AppointmentServiceItems.AddAsync(item);
            await DbContext.SaveChangesAsync();
        }

        protected async Task AttachServiceToInvoiceAsync(int serviceId)
        {
            var invoice = new Invoice
            {
                InvoiceNumber = $"INV-{Guid.NewGuid():N}"[..12],
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.Invoices.AddAsync(invoice);
            await DbContext.SaveChangesAsync();

            var item = new InvoiceItem
            {
                InvoiceId = invoice.Id,
                ServiceId = serviceId,
                ServiceName = "Dịch vụ tính tiền",
                UnitPrice = 300000m,
                Quantity = 1,
                Amount = 300000m
            };

            await DbContext.InvoiceItems.AddAsync(item);
            await DbContext.SaveChangesAsync();
        }

        protected async Task AttachServiceToTreatmentPlanStageAsync(int serviceId)
        {
            var plan = new TreatmentPlan
            {
                PlanName = $"TP-{Guid.NewGuid():N}"[..10],
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.TreatmentPlans.AddAsync(plan);
            await DbContext.SaveChangesAsync();

            var stage = new TreatmentPlanStage
            {
                TreatmentPlanId = plan.Id,
                StageNumber = 1,
                StageName = "Giai đoạn 1",
                ServiceId = serviceId,
                EstimatedCost = 500000m,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await DbContext.TreatmentPlanStages.AddAsync(stage);
            await DbContext.SaveChangesAsync();
        }

        public void Dispose()
        {
            DbContext.Database.EnsureDeleted();
            DbContext.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}

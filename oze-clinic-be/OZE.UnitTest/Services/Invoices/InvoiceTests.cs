using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.Invoices
{
    // Patient 3 "Lan Nguyen" (user "patient-user-3"), appointment 7 and plan 30 of the patient
    public abstract class InvoiceTestBase
    {
        protected const int PatientId = 3;
        protected readonly Mock<IInvoiceRepository> _invoiceRepo = new();
        protected readonly Mock<IPatientRepository> _patientRepo = new();
        protected readonly Mock<IAppointmentRepository> _appointmentRepo = new();
        protected readonly Mock<ITreatmentPlanRepository> _planRepo = new();
        protected readonly Mock<IServiceRepository> _serviceRepo = new();
        protected readonly InvoiceService _service;

        protected InvoiceTestBase()
        {
            _service = new InvoiceService(_invoiceRepo.Object, _patientRepo.Object, _appointmentRepo.Object, _planRepo.Object,
                _serviceRepo.Object, new Mock<IAuditLogService>().Object);
            var patient = new Patient { Id = PatientId, FullName = "Lan Nguyen", UserId = "patient-user-3" };
            _patientRepo.Setup(r => r.GetByIdAsync(PatientId, It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<CancellationToken>())).ReturnsAsync(patient);
            _patientRepo.Setup(r => r.GetByUserIdAsync("patient-user-3")).ReturnsAsync(patient);
            _patientRepo.Setup(r => r.GetByUserIdAsync("patient-user-4")).ReturnsAsync(new Patient { Id = 4 });
            _appointmentRepo.Setup(r => r.GetByIdWithDetailsAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(new Appointment { Id = 7, PatientId = PatientId });
            _appointmentRepo.Setup(r => r.GetByIdWithDetailsAsync(8, It.IsAny<CancellationToken>())).ReturnsAsync(new Appointment { Id = 8, PatientId = 4 });
            _planRepo.Setup(r => r.GetByIdWithStagesAsync(30, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new TreatmentPlan { Id = 30, PatientId = PatientId, PlanName = "Dieu tri tuy rang 36", EstimatedTotalCost = 3000000 });
            _serviceRepo.Setup(r => r.GetByIdAsync(4, true, It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Service { Id = 4, ServiceName = "Cao voi", ReferencePrice = 300000 });
        }
    }

    // OZ-INV-01 CreateInvoice
    [Trait("Tab", "OZ-INV-01")]
    public class CreateInvoiceTests : InvoiceTestBase
    {
        private static CreateInvoiceRequest Request(decimal discount = 0, params CreateInvoiceItemRequest[] items) => new()
        {
            PatientId = PatientId,
            AppointmentId = 7,
            DiscountAmount = discount,
            Items = items.ToList()
        };

        private static CreateInvoiceItemRequest Scaling(int quantity = 2) => new() { ServiceId = 4, Quantity = quantity };
        private static CreateInvoiceItemRequest Medicine() => new() { ServiceName = "Thuoc giam dau", UnitPrice = 50000, Quantity = 1 };

        // UTCID01 (N): an unpaid invoice with a service line at the list price, a free line and a discount
        [Fact]
        public async Task CreateAsync_ShouldCreateUnpaidInvoice()
        {
            var result = await _service.CreateAsync("receptionist-user", Request(100000, Scaling(), Medicine()));

            result.TotalAmount.Should().Be(650000);
            result.FinalAmount.Should().Be(550000);
            result.PaymentStatus.Should().Be(InvoiceConstants.Unpaid);
            result.InvoiceNumber.Should().StartWith(InvoiceConstants.NumberPrefix);
            _invoiceRepo.Verify(r => r.AddAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()), Times.Once);
        }

        // UTCID02 (N): a plan invoice without lines bills the plan as one package
        [Fact]
        public async Task CreateAsync_ShouldBillPlanAsPackage_WhenNoItems()
        {
            var result = await _service.CreateAsync("receptionist-user", new CreateInvoiceRequest { PatientId = PatientId, TreatmentPlanId = 30 });

            result.TotalAmount.Should().Be(3000000);
            result.Items.Should().ContainSingle(x => x.ServiceName == "Dieu tri tuy rang 36");
        }

        // UTCID03 (A): no patient chosen
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenPatientMissing()
        {
            var request = Request(0, Scaling());
            request.PatientId = 0;

            var act = () => _service.CreateAsync("receptionist-user", request);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.PatientRequired);
        }

        // UTCID04 (B): a negative discount
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenDiscountNegative()
        {
            var act = () => _service.CreateAsync("receptionist-user", Request(-1, Scaling()));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.DiscountInvalid);
        }

        // UTCID05 (A): the patient does not exist
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenPatientNotFound()
        {
            var request = Request(0, Scaling());
            request.PatientId = 99;

            var act = () => _service.CreateAsync("receptionist-user", request);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.PatientNotFound);
        }

        // UTCID06 (A): the appointment is of another patient
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenAppointmentOfAnotherPatient()
        {
            var request = Request(0, Scaling());
            request.AppointmentId = 8;

            var act = () => _service.CreateAsync("receptionist-user", request);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.AppointmentPatientMismatch);
        }

        // UTCID07 (A): the appointment already has an open invoice
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenOpenInvoiceExists()
        {
            _invoiceRepo.Setup(r => r.HasOpenInvoiceForAppointmentAsync(7, It.IsAny<CancellationToken>())).ReturnsAsync(true);

            var act = () => _service.CreateAsync("receptionist-user", Request(0, Scaling()));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.OpenInvoiceExistsForAppointment);
        }

        // UTCID08 (A): no line and no treatment plan
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenNoItems()
        {
            var act = () => _service.CreateAsync("receptionist-user", Request());

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.ItemsRequired);
        }

        // UTCID09 (B): quantity 0
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenQuantityZero()
        {
            var act = () => _service.CreateAsync("receptionist-user", Request(0, Scaling(quantity: 0)));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.QuantityInvalid);
        }

        // UTCID10 (B): a discount one dong over the total
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenDiscountExceedsTotal()
        {
            var act = () => _service.CreateAsync("receptionist-user", Request(600001, Scaling()));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.DiscountExceedsTotal);
        }

        // UTCID11 (A): a service that does not exist
        [Fact]
        public async Task CreateAsync_ShouldThrow_WhenServiceNotFound()
        {
            var act = () => _service.CreateAsync("receptionist-user", Request(0, new CreateInvoiceItemRequest { ServiceId = 77, Quantity = 1 }));

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.ServiceNotFound);
        }
    }

    // OZ-INV-02 GetInvoice
    [Trait("Tab", "OZ-INV-02")]
    public class GetInvoiceTests : InvoiceTestBase
    {
        public GetInvoiceTests()
        {
            _invoiceRepo.Setup(r => r.GetByIdWithDetailsAsync(9, It.IsAny<CancellationToken>())).ReturnsAsync(new Invoice
            {
                Id = 9,
                InvoiceNumber = "INV-9",
                PatientId = PatientId,
                Patient = new Patient { Id = PatientId, FullName = "Lan Nguyen" },
                TotalAmount = 400000,
                FinalAmount = 400000,
                PaymentStatus = InvoiceConstants.Unpaid
            });
        }

        // UTCID01 (N): the staff open any invoice
        [Fact]
        public async Task GetByIdAsync_ShouldReturnInvoice_ForStaff()
        {
            var result = await _service.GetByIdAsync(9, ownerUserId: null);

            result.InvoiceNumber.Should().Be("INV-9");
            result.FinalAmount.Should().Be(400000);
        }

        // UTCID02 (N): the patient opens their own invoice
        [Fact]
        public async Task GetByIdAsync_ShouldReturnInvoice_ForOwner()
        {
            var result = await _service.GetByIdAsync(9, "patient-user-3");

            result.Id.Should().Be(9);
        }

        // UTCID03 (A): the invoice does not exist
        [Fact]
        public async Task GetByIdAsync_ShouldThrow_WhenNotFound()
        {
            var act = () => _service.GetByIdAsync(99, ownerUserId: null);

            (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.InvoiceNotFound);
        }

        // UTCID04 (A): another patient's invoice
        [Fact]
        public async Task GetByIdAsync_ShouldThrow_WhenNotOwner()
        {
            var act = () => _service.GetByIdAsync(9, "patient-user-4");

            (await act.Should().ThrowAsync<ForbiddenException>()).Which.Message.Should().Be(ErrorConstants.InvoiceMessage.AccessDenied);
        }
    }
}

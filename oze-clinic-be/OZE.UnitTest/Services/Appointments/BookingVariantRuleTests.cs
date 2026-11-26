using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Domain.Entities;
using OZE.UnitTest.Services.Examinations;
using Xunit;

namespace OZE.UnitTest.Services.Appointments
{
    // OZ-SVC-11 Variant rules when booking: a service with active variants needs exactly one of them
    [Trait("Tab", "OZ-SVC-11")]
    public class BookingVariantRuleTests : AppointmentFollowUpTestBase
    {
        private static Service Braces()
        {
            var service = new Service { Id = 7, ServiceCode = "NIENG", ServiceName = "Nieng rang", IsActive = true };
            service.Variants = new List<ServiceVariant>
            {
                new() { Id = 71, ServiceId = 7, VariantName = "Mac cai kim loai", IsActive = true, Service = service },
                new() { Id = 72, ServiceId = 7, VariantName = "Mac cai su", IsActive = true, Service = service }
            };
            return service;
        }

        private static AvailableSlotRequest Request(List<int> serviceIds, List<int> variantIds) => new()
        {
            ServiceId = serviceIds,
            VariantId = variantIds,
            Date = DateOnly.FromDateTime(ClinicClock.Today).AddDays(1)
        };

        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldThrow_WhenServiceWithVariantsIsPickedWithoutVariant()
        {
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Service> { Braces() });

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int> { 7 }, new List<int>()));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(string.Format(ErrorConstants.AppointmentMessage.VariantRequired, "Nieng rang"));
        }

        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldThrow_WhenTwoVariantsOfOneServiceArePicked()
        {
            var braces = Braces();
            _appointmentRepoMock
                .Setup(r => r.GetVariantsByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(braces.Variants.ToList());

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int>(), new List<int> { 71, 72 }));

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(string.Format(ErrorConstants.AppointmentMessage.OneVariantPerService, "Nieng rang"));
        }

        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldNotAskForVariant_WhenServiceVariantsAreAllInactive()
        {
            var braces = Braces();
            foreach (var variant in braces.Variants) variant.IsActive = false;
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Service> { braces });

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int> { 7 }, new List<int>()));

            // Booking goes on to the slot search; it must not stop on the variant rule
            var thrown = await Record.ExceptionAsync(act);
            thrown?.Message.Should().NotBe(string.Format(ErrorConstants.AppointmentMessage.VariantRequired, "Nieng rang"));
        }

        // An old appointment of a service whose variants were all switched off is moved as the service itself
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldBookService_WhenVariantRetiredWithAllItsSiblings()
        {
            var braces = Braces();
            foreach (var variant in braces.Variants) variant.IsActive = false;
            _appointmentRepoMock
                .Setup(r => r.GetVariantsByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<ServiceVariant> { braces.Variants.First() });
            var plain = new Service { Id = 7, ServiceCode = "NIENG", ServiceName = "Nieng rang", IsActive = true };
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Service> { plain });

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int> { 7 }, new List<int> { 71 }));

            var thrown = await Record.ExceptionAsync(act);
            thrown?.Message.Should().NotBe(ErrorConstants.AppointmentMessage.VariantInactive);
            thrown?.Message.Should().NotBe(string.Format(ErrorConstants.AppointmentMessage.VariantRequired, "Nieng rang"));
        }

        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldThrow_WhenVariantInactiveButServiceStillHasVariants()
        {
            var braces = Braces();
            var retired = braces.Variants.First();
            retired.IsActive = false;
            _appointmentRepoMock
                .Setup(r => r.GetVariantsByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<ServiceVariant> { retired });
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<Service> { new() { Id = 7, ServiceName = "Nieng rang", IsActive = true, Variants = braces.Variants.Where(v => v.IsActive).ToList() } });

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int>(), new List<int> { 71 }));

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.AppointmentMessage.VariantInactive);
        }

        // Reception sends the service of every line, so a variant line also comes with its own service id
        [Fact]
        public async Task GetAvailableSlotsAsync_ShouldNotAskForVariant_WhenServiceIsSentWithItsVariant()
        {
            var braces = Braces();
            _appointmentRepoMock
                .Setup(r => r.GetVariantsByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync(new List<ServiceVariant> { braces.Variants.First() });
            _appointmentRepoMock
                .Setup(r => r.GetServicesByIdsAsync(It.IsAny<IReadOnlyCollection<int>>()))
                .ReturnsAsync((IReadOnlyCollection<int> ids) => ids.Contains(7) ? new List<Service> { braces } : new List<Service>());

            var act = () => _service.GetAvailableSlotsAsync(Request(new List<int> { 7 }, new List<int> { 71 }));

            var thrown = await Record.ExceptionAsync(act);
            thrown?.Message.Should().NotBe(string.Format(ErrorConstants.AppointmentMessage.VariantRequired, "Nieng rang"));
        }
    }

    // OZ-SVC-11 Variant rule when the doctor adds a service on the examination
    [Trait("Tab", "OZ-SVC-11")]
    public class ExaminationVariantRuleTests : ExaminationFollowUpTestBase
    {
        [Fact]
        public async Task AddServiceAsync_ShouldThrow_WhenServiceWithVariantsHasNoVariant()
        {
            var service = new Service { Id = 7, ServiceName = "Nieng rang", IsActive = true };
            service.Variants = new List<ServiceVariant> { new() { Id = 71, ServiceId = 7, VariantName = "Mac cai su", IsActive = true } };
            _examinationRepoMock
                .Setup(r => r.GetForWorkAsync(ExaminationId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(CreateTestExamination());
            _examinationRepoMock
                .Setup(r => r.GetServiceAsync(7, It.IsAny<CancellationToken>()))
                .ReturnsAsync(service);

            var act = () => _service.AddServiceAsync(DoctorUserId, ExaminationId, new SaveExaminationServiceRequest { ServiceId = 7 });

            var error = await act.Should().ThrowAsync<BadRequestException>();
            error.Which.Message.Should().Be(string.Format(ErrorConstants.AppointmentMessage.VariantRequired, "Nieng rang"));
        }
    }
}

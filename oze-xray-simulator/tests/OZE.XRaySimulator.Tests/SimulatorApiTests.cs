using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using OZE.XRaySimulator.Api.Contracts;
using OZE.XRaySimulator.Api.Controllers;
using OZE.XRaySimulator.Application;
using OZE.XRaySimulator.Domain.Entities;
using OZE.XRaySimulator.Domain.Enums;
using OZE.XRaySimulator.Domain.Models;
using OZE.XRaySimulator.Infrastructure;
using OZE.XRaySimulator.Infrastructure.Options;

namespace OZE.XRaySimulator.Tests;

// Devices kept in memory like DeviceManager, without reading the configuration
public sealed class FakeDeviceManager : IDeviceManager
{
    private readonly Dictionary<string, Device> _devices = new();

    public Device Add(string id, DeviceState state, params ImagingModality[] modalities)
    {
        var device = new Device(id, "May chup " + id, "SN-" + id, modalities.Length == 0 ? new[] { ImagingModality.PANORAMIC } : modalities);
        if (state != DeviceState.OFFLINE)
        {
            device.TransitionTo(DeviceState.INITIALIZING);
            if (state == DeviceState.ERROR) device.TransitionTo(DeviceState.ERROR, "Tube overheat");
            if (state is DeviceState.READY or DeviceState.BUSY) device.TransitionTo(DeviceState.READY);
            if (state == DeviceState.BUSY) device.TryReserve("SIM-OTHER", out _);
        }
        _devices[id] = device;
        return device;
    }

    public Task InitializeDevicesAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    public IReadOnlyList<Device> GetAllDevices() => _devices.Values.ToList();
    public bool TryGetDevice(string id, out Device? device) => _devices.TryGetValue(id, out device);

    public bool TryReserveDevice(string deviceId, string simulationId, out Device? device, out string? errorMessage)
    {
        errorMessage = null;
        if (!_devices.TryGetValue(deviceId, out device)) return false;
        return device.TryReserve(simulationId, out errorMessage);
    }

    public void ReleaseDevice(string deviceId, string simulationId)
    {
        if (_devices.TryGetValue(deviceId, out var device)) device.Release(simulationId);
    }

    public void SetDeviceState(string deviceId, DeviceState state, string? reason = null)
    {
        if (_devices.TryGetValue(deviceId, out var device)) device.TransitionTo(state, reason);
    }
}

public abstract class SimulatorTestBase
{
    protected readonly FakeDeviceManager _devices = new();
    protected readonly Mock<ISessionStore> _store = new();
    protected readonly Mock<ICaptureJobQueue> _queue = new();
    protected readonly IOptions<SimulatorOptions> _options = Options.Create(new SimulatorOptions { CaptureSeconds = 3, ProcessingSeconds = 4 });
    protected readonly CaptureService _captureService;
    protected readonly CapturesController _captures;

    protected SimulatorTestBase()
    {
        _devices.Add("XR-01", DeviceState.READY, ImagingModality.PANORAMIC, ImagingModality.PERIAPICAL);
        _captureService = new CaptureService(_store.Object, _devices, _queue.Object, _options, NullLogger<CaptureService>.Instance);
        _captures = new CapturesController(_captureService) { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() } };
    }

    protected static CaptureSession Session(string simulationId = "SIM-1", CaptureState state = CaptureState.ACCEPTED, int images = 0)
    {
        var session = new CaptureSession(simulationId, "CR-1", "IR-99", "XR-01", ImagingModality.PANORAMIC, "Full arch", Math.Max(1, images), new ExposureSettings());
        if (state is CaptureState.CAPTURING or CaptureState.PROCESSING or CaptureState.COMPLETED) session.TransitionTo(CaptureState.CAPTURING);
        if (state is CaptureState.PROCESSING or CaptureState.COMPLETED) session.TransitionTo(CaptureState.PROCESSING);
        if (state == CaptureState.COMPLETED) session.TransitionTo(CaptureState.COMPLETED);
        if (state == CaptureState.CANCELLED) session.TransitionTo(CaptureState.CANCELLED);
        for (var i = 1; i <= images; i++)
        {
            session.AddImage(new CaptureImage
            {
                ImageId = "IMG-" + i,
                FileName = $"pano-{i}.png",
                ContentType = "image/png",
                SizeBytes = 3,
                Modality = ImagingModality.PANORAMIC,
                SequenceNumber = i,
                MetadataJson = "{}",
                ImageBytes = new byte[] { 1, 2, 3 }
            });
        }
        return session;
    }

    protected void Stored(CaptureSession session)
    {
        CaptureSession? found = session;
        _store.Setup(s => s.TryGetBySimulationId(session.SimulationId, out found)).Returns(true);
    }

    protected static int? StatusOf(IActionResult result) => result switch
    {
        ObjectResult o => o.StatusCode ?? 200,
        StatusCodeResult s => s.StatusCode,
        ForbidResult => 403,
        FileContentResult => 200,
        _ => null
    };
}

// OZ-SIM-01 StartCapture
[Trait("Tab", "OZ-SIM-01")]
public class StartCaptureTests : SimulatorTestBase
{
    private static CreateCaptureCommand Command(string deviceId = "XR-01", ImagingModality modality = ImagingModality.PANORAMIC) =>
        new("CR-1", "IR-99", deviceId, modality, "Full arch", 1, new ExposureSettings());

    // UTCID01 (N): a READY device accepts the capture, becomes BUSY and the job is queued
    [Fact]
    public async Task CreateCapture_ShouldAcceptAndQueue()
    {
        var result = await _captureService.CreateCaptureSessionAsync(Command());

        result.Success.Should().BeTrue();
        result.StatusCode.Should().Be(StatusCodes.Status202Accepted);
        result.EstimatedDurationSeconds.Should().Be(7);
        result.Session!.State.Should().Be(CaptureState.ACCEPTED);
        _devices.GetAllDevices().Single().State.Should().Be(DeviceState.BUSY);
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<CaptureJob>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // UTCID02 (B): the same capture request id again returns the first session
    [Fact]
    public async Task CreateCapture_ShouldReturnExisting_WhenSameRequestId()
    {
        CaptureSession? existing = Session("SIM-OLD");
        _store.Setup(s => s.TryGetByCaptureRequestId("CR-1", out existing)).Returns(true);

        var result = await _captureService.CreateCaptureSessionAsync(Command());

        result.Session!.SimulationId.Should().Be("SIM-OLD");
        _queue.Verify(q => q.EnqueueAsync(It.IsAny<CaptureJob>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // UTCID03 (A): the device does not exist
    [Fact]
    public async Task CreateCapture_ShouldReturn404_WhenDeviceUnknown()
    {
        var result = await _captureService.CreateCaptureSessionAsync(Command(deviceId: "XR-99"));

        result.StatusCode.Should().Be(StatusCodes.Status404NotFound);
        result.ErrorMessage.Should().Be("Device 'XR-99' does not exist.");
    }

    // UTCID04 (A): the device is busy with another capture
    [Fact]
    public async Task CreateCapture_ShouldReturn409_WhenDeviceBusy()
    {
        _devices.Add("XR-02", DeviceState.BUSY);

        var result = await _captureService.CreateCaptureSessionAsync(Command(deviceId: "XR-02"));

        result.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        result.ErrorMessage.Should().Be("Device 'XR-02' is currently BUSY with another session.");
    }

    // UTCID05 (A): the device is in error
    [Fact]
    public async Task CreateCapture_ShouldReturn503_WhenDeviceError()
    {
        _devices.Add("XR-03", DeviceState.ERROR);

        var result = await _captureService.CreateCaptureSessionAsync(Command(deviceId: "XR-03"));

        result.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        result.ErrorMessage.Should().Be("Device 'XR-03' is ERROR (Tube overheat).");
    }

    // UTCID06 (A): the device cannot take that kind of film
    [Fact]
    public async Task CreateCapture_ShouldReturn400_WhenModalityNotSupported()
    {
        var result = await _captureService.CreateCaptureSessionAsync(Command(modality: ImagingModality.BITEWING));

        result.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        result.ErrorMessage.Should().StartWith("Device 'XR-01' does not support modality 'BITEWING'.");
    }

    // UTCID07 (A): a modality name that does not exist
    [Fact]
    public async Task CreateCapture_ShouldReturn400_WhenModalityInvalid()
    {
        var request = new CreateCaptureRequest { CaptureRequestId = "CR-1", OrderReference = "IR-99", DeviceId = "XR-01", Modality = "MRI" };

        var result = await _captures.CreateCapture(request);

        StatusOf(result).Should().Be(StatusCodes.Status400BadRequest);
    }
}

// OZ-SIM-02 GetCapture
[Trait("Tab", "OZ-SIM-02")]
public class GetCaptureTests : SimulatorTestBase
{
    // UTCID01 (N): the status and progress of a capture
    [Fact]
    public void GetStatus_ShouldReturnSession()
    {
        Stored(Session(state: CaptureState.CAPTURING));

        var result = _captures.GetStatus("SIM-1");

        var body = (CaptureResponse)((OkObjectResult)result).Value!;
        body.Status.Should().Be("CAPTURING");
        body.OrderReference.Should().Be("IR-99");
    }

    // UTCID02 (A): an unknown simulation id
    [Fact]
    public void GetStatus_ShouldReturn404_WhenNotFound()
    {
        var result = _captures.GetStatus("SIM-404");

        StatusOf(result).Should().Be(StatusCodes.Status404NotFound);
    }
}

// OZ-SIM-03 CancelCapture
[Trait("Tab", "OZ-SIM-03")]
public class CancelCaptureTests : SimulatorTestBase
{
    // UTCID01 (N): a capture still waiting is cancelled and the device is free again
    [Fact]
    public void CancelCapture_ShouldCancelAcceptedSession()
    {
        var device = _devices.GetAllDevices().Single();
        device.TryReserve("SIM-1", out _);
        var session = Session();
        Stored(session);

        var result = _captures.CancelCapture("SIM-1");

        StatusOf(result).Should().Be(StatusCodes.Status200OK);
        session.State.Should().Be(CaptureState.CANCELLED);
        device.State.Should().Be(DeviceState.READY);
    }

    // UTCID02 (N): a capture already running is stopped by its job
    [Fact]
    public void CancelCapture_ShouldStopRunningJob()
    {
        Stored(Session(state: CaptureState.CAPTURING));
        _queue.Setup(q => q.TryCancelSession("SIM-1")).Returns(true);

        var result = _captures.CancelCapture("SIM-1");

        StatusOf(result).Should().Be(StatusCodes.Status200OK);
        _queue.Verify(q => q.TryCancelSession("SIM-1"), Times.Once);
    }

    // UTCID03 (A): an unknown simulation id
    [Fact]
    public void CancelCapture_ShouldReturn404_WhenNotFound()
    {
        var result = _captures.CancelCapture("SIM-404");

        StatusOf(result).Should().Be(StatusCodes.Status404NotFound);
    }

    // UTCID04 (A): a capture already completed
    [Fact]
    public void CancelCapture_ShouldReturn409_WhenFinished()
    {
        Stored(Session(state: CaptureState.COMPLETED));

        var result = _captures.CancelCapture("SIM-1");

        StatusOf(result).Should().Be(StatusCodes.Status409Conflict);
    }
}

// OZ-SIM-04 ListCaptureImages
[Trait("Tab", "OZ-SIM-04")]
public class ListCaptureImagesTests : SimulatorTestBase
{
    // UTCID01 (N): the images of a completed capture
    [Fact]
    public void GetSessionImages_ShouldListImages()
    {
        Stored(Session(state: CaptureState.COMPLETED, images: 2));

        var result = _captures.GetSessionImages("SIM-1");

        var images = (IReadOnlyList<ImageSummaryDto>)((OkObjectResult)result).Value!;
        images.Select(x => x.FileName).Should().Equal("pano-1.png", "pano-2.png");
    }

    // UTCID02 (A): an unknown simulation id
    [Fact]
    public void GetSessionImages_ShouldReturn404_WhenNotFound()
    {
        var result = _captures.GetSessionImages("SIM-404");

        StatusOf(result).Should().Be(StatusCodes.Status404NotFound);
    }

    // UTCID03 (A): the capture is not finished yet
    [Fact]
    public void GetSessionImages_ShouldReturn409_WhenNotCompleted()
    {
        Stored(Session(state: CaptureState.PROCESSING));

        var result = _captures.GetSessionImages("SIM-1");

        StatusOf(result).Should().Be(StatusCodes.Status409Conflict);
    }
}

// OZ-SIM-05 GetCaptureImage
[Trait("Tab", "OZ-SIM-05")]
public class GetCaptureImageTests : SimulatorTestBase
{
    // UTCID01 (N): the image file, marked as simulated
    [Fact]
    public void GetImageBinary_ShouldReturnFile()
    {
        Stored(Session(state: CaptureState.COMPLETED, images: 1));

        var result = _captures.GetImageBinary("SIM-1", "img-1");

        var file = (FileContentResult)result;
        file.ContentType.Should().Be("image/png");
        file.FileDownloadName.Should().Be("pano-1.png");
        _captures.Response.Headers["X-Is-Simulated"].ToString().Should().Be("true");
    }

    // UTCID02 (A): an unknown simulation id
    [Fact]
    public void GetImageBinary_ShouldReturn404_WhenSessionNotFound()
    {
        var result = _captures.GetImageBinary("SIM-404", "IMG-1");

        StatusOf(result).Should().Be(StatusCodes.Status404NotFound);
    }

    // UTCID03 (A): the image is not in that capture
    [Fact]
    public void GetImageBinary_ShouldReturn404_WhenImageNotFound()
    {
        Stored(Session(state: CaptureState.COMPLETED, images: 1));

        var result = _captures.GetImageBinary("SIM-1", "IMG-9");

        StatusOf(result).Should().Be(StatusCodes.Status404NotFound);
    }
}

// OZ-SIM-06 ListDevices
[Trait("Tab", "OZ-SIM-06")]
public class ListDevicesTests
{
    // UTCID01 (N): every device with its state
    [Fact]
    public void GetAll_ShouldListDevices()
    {
        var devices = new FakeDeviceManager();
        devices.Add("XR-01", DeviceState.READY);
        devices.Add("XR-02", DeviceState.OFFLINE);

        var result = new DevicesController(devices).GetAll();

        var body = (List<DeviceResponse>)((OkObjectResult)result).Value!;
        body.Select(x => (x.Id, x.State)).Should().BeEquivalentTo(new[] { ("XR-01", "READY"), ("XR-02", "OFFLINE") });
    }

    // UTCID02 (B): no device configured
    [Fact]
    public void GetAll_ShouldReturnEmpty_WhenNoDevice()
    {
        var result = new DevicesController(new FakeDeviceManager()).GetAll();

        ((List<DeviceResponse>)((OkObjectResult)result).Value!).Should().BeEmpty();
    }
}

// OZ-SIM-07 GetDevice
[Trait("Tab", "OZ-SIM-07")]
public class GetDeviceTests
{
    private readonly FakeDeviceManager _devices = new();

    public GetDeviceTests() => _devices.Add("XR-01", DeviceState.ERROR, ImagingModality.PANORAMIC, ImagingModality.BITEWING);

    // UTCID01 (N): one device with its modalities and last error
    [Fact]
    public void GetById_ShouldReturnDevice()
    {
        var result = new DevicesController(_devices).GetById("XR-01");

        var body = (DeviceResponse)((OkObjectResult)result).Value!;
        body.SupportedModalities.Should().Equal("PANORAMIC", "BITEWING");
        body.State.Should().Be("ERROR");
        body.LastError.Should().Be("Tube overheat");
    }

    // UTCID02 (A): an unknown device
    [Fact]
    public void GetById_ShouldReturn404_WhenNotFound()
    {
        var result = new DevicesController(_devices).GetById("XR-99");

        result.Should().BeOfType<NotFoundObjectResult>();
    }
}

public abstract class DemoTestBase
{
    protected readonly FakeDeviceManager _devices = new();
    protected readonly FaultInjector _faults = new();
    protected readonly SimulatorOptions _settings = new() { EnableDemoControls = true };
    protected readonly DemoController _demo;

    protected DemoTestBase()
    {
        _devices.Add("XR-01", DeviceState.READY);
        _demo = new DemoController(_devices, _faults, Options.Create(_settings));
    }
}

// OZ-SIM-08 DemoSetDeviceState
[Trait("Tab", "OZ-SIM-08")]
public class DemoSetDeviceStateTests : DemoTestBase
{
    // UTCID01 (N): a READY device is put in error for the demo
    [Fact]
    public void SetDeviceState_ShouldChangeState()
    {
        var result = _demo.SetDeviceState("XR-01", new SetDeviceStateRequest("error", "Tube overheat"));

        result.Should().BeOfType<OkObjectResult>();
        _devices.GetAllDevices().Single().State.Should().Be(DeviceState.ERROR);
        _devices.GetAllDevices().Single().LastError.Should().Be("Tube overheat");
    }

    // UTCID02 (A): demo controls are turned off
    [Fact]
    public void SetDeviceState_ShouldForbid_WhenDemoDisabled()
    {
        _settings.EnableDemoControls = false;

        var result = _demo.SetDeviceState("XR-01", new SetDeviceStateRequest("ERROR", null));

        result.Should().BeOfType<ForbidResult>();
    }

    // UTCID03 (A): a state name that does not exist
    [Fact]
    public void SetDeviceState_ShouldReturn400_WhenStateInvalid()
    {
        var result = _demo.SetDeviceState("XR-01", new SetDeviceStateRequest("BROKEN", null));

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    // UTCID04 (A): an unknown device
    [Fact]
    public void SetDeviceState_ShouldReturn404_WhenDeviceNotFound()
    {
        var result = _demo.SetDeviceState("XR-99", new SetDeviceStateRequest("ERROR", null));

        result.Should().BeOfType<NotFoundObjectResult>();
    }

    // UTCID05 (B): a change the device cannot make (READY to INITIALIZING)
    [Fact]
    public void SetDeviceState_ShouldReturn400_WhenTransitionNotAllowed()
    {
        var result = _demo.SetDeviceState("XR-01", new SetDeviceStateRequest("INITIALIZING", null));

        result.Should().BeOfType<BadRequestObjectResult>();
        _devices.GetAllDevices().Single().State.Should().Be(DeviceState.READY);
    }
}

// OZ-SIM-09 DemoInjectFault
[Trait("Tab", "OZ-SIM-09")]
public class DemoInjectFaultTests : DemoTestBase
{
    // UTCID01 (N): the next capture is set to fail with the given code
    [Fact]
    public void InjectNextCaptureFault_ShouldSetFault()
    {
        var result = _demo.InjectNextCaptureFault(new InjectFaultRequest("DETECTOR_TIMEOUT", "Detector did not respond"));

        result.Should().BeOfType<OkObjectResult>();
        _faults.CurrentConfig.NextCaptureFailureCode.Should().Be("DETECTOR_TIMEOUT");
    }

    // UTCID02 (B): the fault is used once, the capture after it runs normally
    [Fact]
    public void InjectNextCaptureFault_ShouldBeConsumedOnce()
    {
        _demo.InjectNextCaptureFault(new InjectFaultRequest("DETECTOR_TIMEOUT", "Detector did not respond"));

        _faults.TryConsumeNextCaptureFailure(out var code, out var message).Should().BeTrue();
        code.Should().Be("DETECTOR_TIMEOUT");
        message.Should().Be("Detector did not respond");
        _faults.TryConsumeNextCaptureFailure(out _, out _).Should().BeFalse();
    }

    // UTCID03 (A): demo controls are turned off
    [Fact]
    public void InjectNextCaptureFault_ShouldForbid_WhenDemoDisabled()
    {
        _settings.EnableDemoControls = false;

        var result = _demo.InjectNextCaptureFault(new InjectFaultRequest("DETECTOR_TIMEOUT", "x"));

        result.Should().BeOfType<ForbidResult>();
        _faults.CurrentConfig.NextCaptureFailureCode.Should().BeNull();
    }

    // UTCID04 (N): clearing removes every injected fault
    [Fact]
    public void ClearFaults_ShouldRemoveAll()
    {
        _demo.InjectNextCaptureFault(new InjectFaultRequest("DETECTOR_TIMEOUT", "x"));
        _demo.SetDropWebhooks(true);
        _demo.SetWebhookDelay(-5);

        _faults.CurrentConfig.WebhookDelayMilliseconds.Should().Be(0);
        _demo.ClearFaults();

        _faults.CurrentConfig.Should().BeEquivalentTo(new FaultConfig());
    }
}

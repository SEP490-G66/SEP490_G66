using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OZE.Application.Interfaces;
using OZE.Common.Models;

namespace OZE.Application.Services
{
    // Typed HttpClient for the X-ray simulator. The base address and X-Api-Key header are set when it is registered.
    public class SimulatorClient : ISimulatorClient
    {
        private const string CapturesPath = "api/v1/captures";
        private const string DevicesPath = "api/v1/devices";

        private readonly HttpClient _http;
        private readonly ILogger<SimulatorClient> _logger;

        public SimulatorClient(HttpClient http, ILogger<SimulatorClient> logger)
        {
            _http = http;
            _logger = logger;
        }

        public Task<SimulatorResult<SimulatorCapture>> StartCaptureAsync(SimulatorCaptureRequest request, CancellationToken cancellationToken = default) =>
            SendJsonAsync<SimulatorCapture>(() => _http.PostAsJsonAsync(CapturesPath, request, cancellationToken), cancellationToken);

        public Task<SimulatorResult<SimulatorCapture>> GetCaptureAsync(string simulationId, CancellationToken cancellationToken = default) =>
            SendJsonAsync<SimulatorCapture>(() => _http.GetAsync($"{CapturesPath}/{Uri.EscapeDataString(simulationId)}", cancellationToken), cancellationToken);

        public Task<SimulatorResult<List<SimulatorDevice>>> GetDevicesAsync(CancellationToken cancellationToken = default) =>
            SendJsonAsync<List<SimulatorDevice>>(() => _http.GetAsync(DevicesPath, cancellationToken), cancellationToken);

        public async Task<SimulatorResult<bool>> CancelCaptureAsync(string simulationId, CancellationToken cancellationToken = default)
        {
            var result = await SendAsync(() => _http.PostAsync($"{CapturesPath}/{Uri.EscapeDataString(simulationId)}/cancel", null, cancellationToken));
            if (result.Response == null)
            {
                return SimulatorResult<bool>.Fail(0, result.Error, unreachable: true);
            }

            using var response = result.Response;
            return response.IsSuccessStatusCode
                ? SimulatorResult<bool>.Ok(true)
                : await FailAsync<bool>(response, cancellationToken);
        }

        public async Task<SimulatorResult<byte[]>> DownloadImageAsync(string simulationId, string imageId, CancellationToken cancellationToken = default)
        {
            var result = await SendAsync(() => _http.GetAsync(
                $"{CapturesPath}/{Uri.EscapeDataString(simulationId)}/images/{Uri.EscapeDataString(imageId)}", cancellationToken));
            if (result.Response == null)
            {
                return SimulatorResult<byte[]>.Fail(0, result.Error, unreachable: true);
            }

            using var response = result.Response;
            if (!response.IsSuccessStatusCode)
            {
                return await FailAsync<byte[]>(response, cancellationToken);
            }

            return SimulatorResult<byte[]>.Ok(await response.Content.ReadAsByteArrayAsync(cancellationToken));
        }

        private async Task<SimulatorResult<T>> SendJsonAsync<T>(Func<Task<HttpResponseMessage>> send, CancellationToken cancellationToken)
        {
            var result = await SendAsync(send);
            if (result.Response == null)
            {
                return SimulatorResult<T>.Fail(0, result.Error, unreachable: true);
            }

            using var response = result.Response;
            if (!response.IsSuccessStatusCode)
            {
                return await FailAsync<T>(response, cancellationToken);
            }

            try
            {
                var data = await response.Content.ReadFromJsonAsync<T>(cancellationToken);
                return data == null
                    ? SimulatorResult<T>.Fail((int)response.StatusCode, "Empty answer from the simulator")
                    : SimulatorResult<T>.Ok(data);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "The simulator answered with JSON that could not be read");
                return SimulatorResult<T>.Fail((int)response.StatusCode, "Unreadable answer from the simulator");
            }
        }

        // The response, or the reason no response came (network down, timeout)
        private async Task<(HttpResponseMessage? Response, string? Error)> SendAsync(Func<Task<HttpResponseMessage>> send)
        {
            try
            {
                return (await send(), null);
            }
            catch (HttpRequestException ex)
            {
                _logger.LogWarning(ex, "The X-ray simulator could not be reached");
                return (null, ex.Message);
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogWarning(ex, "The X-ray simulator did not answer in time");
                return (null, "Timeout");
            }
        }

        // The simulator answers errors as {"error": "..."}
        private static async Task<SimulatorResult<T>> FailAsync<T>(HttpResponseMessage response, CancellationToken cancellationToken)
        {
            string? error = null;
            try
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                using var json = JsonDocument.Parse(body);
                if (json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("error", out var value))
                {
                    error = value.GetString();
                }
            }
            catch (JsonException)
            {
                // Not JSON: keep the status code only
            }

            var unreachable = response.StatusCode >= HttpStatusCode.InternalServerError || response.StatusCode == HttpStatusCode.Unauthorized;
            return SimulatorResult<T>.Fail((int)response.StatusCode, error ?? response.ReasonPhrase, unreachable);
        }
    }
}

using System.Diagnostics;

namespace OZE.ProjectBase.Middlewares
{
    // Logs the requests that take longer than a second, so a slow page on the server can be traced to its endpoint
    public class SlowRequestLoggingMiddleware
    {
        private static readonly TimeSpan SlowThreshold = TimeSpan.FromSeconds(1);

        private readonly RequestDelegate _next;
        private readonly ILogger<SlowRequestLoggingMiddleware> _logger;

        public SlowRequestLoggingMiddleware(RequestDelegate next, ILogger<SlowRequestLoggingMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var watch = Stopwatch.StartNew();
            try
            {
                await _next(context);
            }
            finally
            {
                watch.Stop();
                if (watch.Elapsed >= SlowThreshold)
                {
                    _logger.LogWarning("Slow request {Method} {Path}{Query} -> {StatusCode} in {ElapsedMs} ms",
                        context.Request.Method, context.Request.Path, context.Request.QueryString, context.Response.StatusCode,
                        (long)watch.Elapsed.TotalMilliseconds);
                }
            }
        }
    }
}

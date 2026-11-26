using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using OZE.Application;
using OZE.Common.Models;
using OZE.Persistence;
using OZE.Persistence.DbContexts;
using OZE.Persistence.Seed;
using OZE.ProjectBase.Middlewares;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using OZE.Common.Constants;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;

var builder = WebApplication.CreateBuilder(args);

// Per-machine settings (real passwords, keys, a remote database) that must never be committed; the file is git-ignored
// and optional, so servers that take their settings from environment variables run without it
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);

const string CorsPolicyName = "ConfiguredCors";
// Vite / Playwright local frontend origins (used only when Cors:AllowedOrigins is empty in Development)
var developmentCorsOrigins = new[] { "http://localhost:5173", "https://localhost:5173" };

// 1. Add Services
// Keep the "Async" suffix in action names, so CreatedAtAction(nameof(GetXxxAsync)) finds the action
builder.Services.AddControllers(options => options.SuppressAsyncSuffixInActionNames = false);
builder.Services.AddEndpointsApiExplorer();

// 2. Add Clean Architecture Layers
builder.Services.AddPersistence(builder.Configuration);
builder.Services.AddApplication(builder.Configuration);

// Reverse proxy + CORS settings (env: ReverseProxy__*, Cors__AllowedOrigins__*)
builder.Services.Configure<ReverseProxySettings>(builder.Configuration.GetSection(ReverseProxySettings.SectionName));
builder.Services.Configure<CorsSettings>(builder.Configuration.GetSection(CorsSettings.SectionName));

var reverseProxySettings = builder.Configuration.GetSection(ReverseProxySettings.SectionName).Get<ReverseProxySettings>()
    ?? new ReverseProxySettings();
var corsSettings = builder.Configuration.GetSection(CorsSettings.SectionName).Get<CorsSettings>()
    ?? new CorsSettings();

// Trust only loopback defaults plus explicitly configured proxies; do not clear KnownProxies / KnownIPNetworks
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;

    foreach (var proxy in reverseProxySettings.KnownProxies)
    {
        if (string.IsNullOrWhiteSpace(proxy))
        {
            continue;
        }

        if (!IPAddress.TryParse(proxy.Trim(), out var address))
        {
            throw new InvalidOperationException($"ReverseProxy:KnownProxies contains an invalid IP address: '{proxy}'");
        }

        if (!options.KnownProxies.Contains(address))
        {
            options.KnownProxies.Add(address);
        }
    }
});

// 3. Configure CORS (explicit origins; never AllowAnyOrigin + AllowCredentials)
var configuredOrigins = (corsSettings.AllowedOrigins ?? Array.Empty<string>())
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim())
    .Distinct(StringComparer.Ordinal)
    .ToArray();

if (configuredOrigins.Length == 0)
{
    if (builder.Environment.IsDevelopment())
    {
        configuredOrigins = developmentCorsOrigins;
    }
    else
    {
        throw new InvalidOperationException(
            "Cors:AllowedOrigins must be configured with at least one origin outside Development");
    }
}

builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicyName, policy =>
    {
        // Frontend SignalR uses accessTokenFactory with withCredentials: false — no cookies required
        policy.WithOrigins(configuredOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              // The site and the API are on different hosts, so every call with a token is preceded by a preflight;
              // the browser may reuse the answer for 10 minutes instead of asking again before each call
              .SetPreflightMaxAge(TimeSpan.FromMinutes(10));
    });
});

// Pushes new notifications to the open pages of the user at once
builder.Services.AddSignalR();
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, OZE.Hubs.NotificationUserIdProvider>();
builder.Services.AddScoped<OZE.Application.Interfaces.INotificationPusher, OZE.Hubs.SignalRNotificationPusher>();

// 4. Configure JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>() ?? new JwtSettings();
// No built-in fallback key: a missing key must stop the start, not silently sign tokens with a public value
if (string.IsNullOrWhiteSpace(jwtSettings.Key))
{
    throw new InvalidOperationException("JwtSettings:Key is not configured");
}
var keyBytes = Encoding.UTF8.GetBytes(jwtSettings.Key);
builder.Services.AddDbContext<AppIdentityDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(keyBytes),
        ClockSkew = TimeSpan.Zero
    };
    // A token is refused once the account changed under it: logout, password change or reset, role change, account locked
    options.Events = new JwtBearerEvents
    {
        // A browser WebSocket cannot send the Authorization header, so the notification hub takes the token from the query
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.Request.Path.StartsWithSegments(OZE.Hubs.NotificationHub.Path))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? context.Principal?.FindFirstValue("sub");
            var stamp = context.Principal?.FindFirstValue(SecurityConstants.SecurityStampClaim);
            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
            var user = string.IsNullOrEmpty(userId) ? null : await userManager.FindByIdAsync(userId);
            var tokenId = context.Principal?.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Jti);
            var revoked = tokenId != null && await context.HttpContext.RequestServices.GetRequiredService<OZE.Application.Interfaces.IAccessTokenRevocationStore>()
                .IsRevokedAsync(tokenId, context.HttpContext.RequestAborted);
            if (user == null || stamp == null || stamp != user.SecurityStamp || user.LockoutEnd == DateTimeOffset.MaxValue || revoked)
            {
                context.Fail("The session has ended");
            }
        }
    };
});

// Limits the calls to the account endpoints from one address
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(SecurityConstants.AuthRateLimitPolicy, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = SecurityConstants.AuthRequestsPerWindow,
                Window = TimeSpan.FromSeconds(SecurityConstants.AuthRateLimitWindowSeconds),
                QueueLimit = 0
            }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            System.Text.Json.JsonSerializer.Serialize(ApiResponse.FailureResult(ErrorConstants.AuthMessage.TooManyRequests),
                new System.Text.Json.JsonSerializerOptions { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase }),
            cancellationToken);
    };
});

// 5. Configure Swagger / OpenAPI
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "OZE API",
        Version = "v1",
        Description = "OZE API"
    });

    var jwtSecurityScheme = new OpenApiSecurityScheme
    {
        BearerFormat = "JWT",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        Description = "Enter your JWT token directly: `ey...`",
        Reference = new OpenApiReference
        {
            Id = JwtBearerDefaults.AuthenticationScheme,
            Type = ReferenceType.SecurityScheme
        }
    };

    options.AddSecurityDefinition(jwtSecurityScheme.Reference.Id, jwtSecurityScheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { jwtSecurityScheme, Array.Empty<string>() }
    });
    options.CustomSchemaIds(type => type.FullName ?? type.ToString());
});

var app = builder.Build();

// 6. Global Exception Middleware
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<OZE.ProjectBase.Middlewares.SlowRequestLoggingMiddleware>();

// 7. Seed Database (Roles, Default Admin)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        await DatabaseSeeder.SeedAsync(services, app.Environment.IsDevelopment());
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogWarning(ex, "Could not run database seeder on startup (DB might not be initialized yet).");
    }
}

// 8. Pipeline Configuration
// Forwarded headers must run before HTTPS redirection, CORS, rate limiting, and auth so scheme/client IP are correct
app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "OZE API v1");
    });
}

if (reverseProxySettings.UseHttpsRedirection)
{
    app.UseHttpsRedirection();
}

app.UseCors(CorsPolicyName);

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<OZE.Hubs.NotificationHub>(OZE.Hubs.NotificationHub.Path)
    .RequireCors(CorsPolicyName);

app.Run();

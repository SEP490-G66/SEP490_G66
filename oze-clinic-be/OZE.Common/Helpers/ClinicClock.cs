using System.Globalization;
using OZE.Common.Constants;

namespace OZE.Common.Helpers
{
    // The current date and time at the clinic. Business code uses it instead of DateTime.Now / DateTime.UtcNow /
    // DateTimeOffset.UtcNow, so a fake time set with Clinic:FakeNow (dev/staging only) reaches every rule at once.
    // Security clocks (JWT, refresh tokens, OTP, rate limits) stay on the real clock on purpose.
    public static class ClinicClock
    {
        public const string FakeNowKey = "Clinic:FakeNow";
        public const string FakeNowModeKey = "Clinic:FakeNowMode";

        private static readonly TimeZoneInfo Zone = ResolveZone();

        // Set once at startup from configuration; null means the real clock
        private static FakeClock? _configured;

        // Lets a test move the clock for its own async flow only, without touching tests that run in parallel
        private static readonly AsyncLocal<FakeClock?> Scoped = new();

        public static TimeZoneInfo TimeZone => Zone;

        // True when a fake time is in force (configured or set by a test)
        public static bool IsFake => Current != null;

        // True when the fake time stands still (FakeNowMode Frozen)
        public static bool IsFrozen => Current is { Running: false };

        // The current moment in UTC
        public static DateTimeOffset UtcNow => Current?.UtcNow ?? DateTimeOffset.UtcNow;

        // The current moment as a UTC DateTime (Kind = Utc)
        public static DateTime UtcDateTime => UtcNow.UtcDateTime;

        // The clinic's wall-clock time (Vietnam)
        public static DateTime Now => TimeZoneInfo.ConvertTimeFromUtc(UtcDateTime, Zone);

        public static DateTime Today => Now.Date;

        public static DateOnly TodayDate => DateOnly.FromDateTime(Now);

        // A stored moment (for example a check-in time) as the clinic's wall-clock time
        public static DateTime ToClinicTime(DateTimeOffset moment) => TimeZoneInfo.ConvertTimeFromUtc(moment.UtcDateTime, Zone);

        private static FakeClock? Current => Scoped.Value ?? _configured;

        // Reads Clinic:FakeNow (clinic wall-clock time such as "2026-11-29 16:55") and Clinic:FakeNowMode
        // ("Frozen", the default, keeps the clock still; "Running" lets it tick on from that moment).
        // An empty value turns the fake clock off. Returns the fake moment in force, or null.
        public static DateTimeOffset? Configure(string? fakeNow, string? mode = null)
        {
            _configured = Create(fakeNow, mode);
            return _configured?.UtcNow;
        }

        // Test helper: fakes the clock for the calling async flow until the returned scope is disposed
        public static IDisposable Use(DateTime clinicWallClock, bool running = false)
        {
            var previous = Scoped.Value;
            Scoped.Value = new FakeClock(FromClinicTime(clinicWallClock), running);
            return new Restore(() => Scoped.Value = previous);
        }

        // Parses a clinic wall-clock time; returns null for an empty value and throws on an unreadable one
        public static DateTimeOffset? ParseFakeNow(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var text = value.Trim();
            string[] clinicFormats =
            {
                "yyyy-MM-dd HH:mm", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd"
            };
            if (DateTime.TryParseExact(text, clinicFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
            {
                return FromClinicTime(local);
            }

            // A value carrying its own offset ("2026-11-29T16:55:00+07:00" or "...Z") is taken as that moment
            string[] offsetFormats =
            {
                "yyyy-MM-ddTHH:mmzzz", "yyyy-MM-ddTHH:mm:sszzz", "yyyy-MM-ddTHH:mm:ss.FFFFFFFzzz",
                "yyyy-MM-ddTHH:mm'Z'", "yyyy-MM-ddTHH:mm:ss'Z'", "yyyy-MM-ddTHH:mm:ss.FFFFFFF'Z'"
            };
            if (DateTimeOffset.TryParseExact(text, offsetFormats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var withOffset))
            {
                return withOffset.ToUniversalTime();
            }

            throw new FormatException($"{FakeNowKey} '{value}' is not a valid clinic time; use the form yyyy-MM-dd HH:mm, for example 2026-11-29 16:55.");
        }

        private static FakeClock? Create(string? fakeNow, string? mode)
        {
            var start = ParseFakeNow(fakeNow);
            if (start == null)
            {
                return null;
            }

            var running = string.Equals(mode?.Trim(), "Running", StringComparison.OrdinalIgnoreCase);
            if (!running && !string.IsNullOrWhiteSpace(mode) && !string.Equals(mode.Trim(), "Frozen", StringComparison.OrdinalIgnoreCase))
            {
                throw new FormatException($"{FakeNowModeKey} '{mode}' must be Frozen or Running.");
            }

            return new FakeClock(start.Value, running);
        }

        private static DateTimeOffset FromClinicTime(DateTime clinicWallClock)
        {
            var unspecified = DateTime.SpecifyKind(clinicWallClock, DateTimeKind.Unspecified);
            return new DateTimeOffset(TimeZoneInfo.ConvertTimeToUtc(unspecified, Zone), TimeSpan.Zero);
        }

        private static TimeZoneInfo ResolveZone()
        {
            foreach (var id in new[] { ClinicTimeConstants.IanaTimeZoneId, ClinicTimeConstants.WindowsTimeZoneId })
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(id);
                }
                catch (TimeZoneNotFoundException)
                {
                }
                catch (InvalidTimeZoneException)
                {
                }
            }

            return TimeZoneInfo.CreateCustomTimeZone(ClinicTimeConstants.IanaTimeZoneId,
                TimeSpan.FromHours(ClinicTimeConstants.UtcOffsetHours), ClinicTimeConstants.IanaTimeZoneId, ClinicTimeConstants.IanaTimeZoneId);
        }

        private sealed class FakeClock
        {
            private readonly DateTimeOffset _start;
            private readonly DateTimeOffset _realStart = DateTimeOffset.UtcNow;

            public FakeClock(DateTimeOffset start, bool running)
            {
                _start = start;
                Running = running;
            }

            public bool Running { get; }

            public DateTimeOffset UtcNow => Running ? _start + (DateTimeOffset.UtcNow - _realStart) : _start;
        }

        private sealed class Restore : IDisposable
        {
            private Action? _undo;

            public Restore(Action undo) => _undo = undo;

            public void Dispose()
            {
                _undo?.Invoke();
                _undo = null;
            }
        }
    }
}

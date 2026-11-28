using FluentAssertions;
using OZE.Controllers;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace OZE.UnitTest.Helpers
{
    // ClinicClock with and without a fake time (Clinic:FakeNow)
    public class ClinicClockTests
    {
        [Fact]
        public void WithoutFakeNow_FollowsTheRealClock()
        {
            var before = DateTimeOffset.UtcNow;
            var now = ClinicClock.UtcNow;
            var after = DateTimeOffset.UtcNow;

            ClinicClock.IsFake.Should().BeFalse();
            now.Should().BeOnOrAfter(before).And.BeOnOrBefore(after);
            ClinicClock.Now.Should().BeCloseTo(DateTime.UtcNow.AddHours(7), TimeSpan.FromSeconds(5));
        }

        [Theory]
        [InlineData("2026-11-29 07:25", 2026, 11, 29, 7, 25)]
        [InlineData("2026-11-29 09:45", 2026, 11, 29, 9, 45)]
        [InlineData("2026-11-29 16:55", 2026, 11, 29, 16, 55)]
        [InlineData("2026-11-29T16:55:30", 2026, 11, 29, 16, 55)]
        public void ParseFakeNow_ReadsClinicWallClockTime(string value, int y, int m, int d, int h, int min)
        {
            var moment = ClinicClock.ParseFakeNow(value);

            moment.Should().NotBeNull();
            // Vietnam is UTC+7, so 16:55 clinic time is 09:55 UTC
            moment!.Value.UtcDateTime.Should().BeCloseTo(new DateTime(y, m, d, h, min, 0, DateTimeKind.Utc).AddHours(-7), TimeSpan.FromMinutes(1));
        }

        [Fact]
        public void ParseFakeNow_AcceptsAnExplicitOffset()
        {
            ClinicClock.ParseFakeNow("2026-11-29T09:55:00Z")!.Value.Should().Be(new DateTimeOffset(2026, 11, 29, 9, 55, 0, TimeSpan.Zero));
            ClinicClock.ParseFakeNow("2026-11-29T16:55:00+07:00")!.Value.Should().Be(new DateTimeOffset(2026, 11, 29, 9, 55, 0, TimeSpan.Zero));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void ParseFakeNow_EmptyMeansRealClock(string? value)
        {
            ClinicClock.ParseFakeNow(value).Should().BeNull();
        }

        [Fact]
        public void ParseFakeNow_RejectsUnreadableValue()
        {
            var act = () => ClinicClock.ParseFakeNow("29/11 sáng");

            act.Should().Throw<FormatException>();
        }

        [Fact]
        public void Use_FreezesEveryViewOfTheClock()
        {
            using (ClinicClock.Use(new DateTime(2026, 11, 29, 16, 55, 0)))
            {
                ClinicClock.IsFake.Should().BeTrue();
                ClinicClock.Now.Should().Be(new DateTime(2026, 11, 29, 16, 55, 0));
                ClinicClock.Today.Should().Be(new DateTime(2026, 11, 29));
                ClinicClock.TodayDate.Should().Be(new DateOnly(2026, 11, 29));
                ClinicClock.UtcNow.Should().Be(new DateTimeOffset(2026, 11, 29, 9, 55, 0, TimeSpan.Zero));
                ClinicClock.UtcDateTime.Kind.Should().Be(DateTimeKind.Utc);
                ClinicClock.ToClinicTime(ClinicClock.UtcNow).Should().Be(ClinicClock.Now);
            }

            ClinicClock.IsFake.Should().BeFalse();
        }

        [Fact]
        public void Use_JustAfterMidnightInVietnam_IsStillThePreviousDayInUtc()
        {
            using (ClinicClock.Use(new DateTime(2026, 11, 30, 0, 30, 0)))
            {
                ClinicClock.TodayDate.Should().Be(new DateOnly(2026, 11, 30));
                ClinicClock.UtcNow.UtcDateTime.Date.Should().Be(new DateTime(2026, 11, 29));
            }
        }

        [Fact]
        public async Task Use_RunningMode_TicksOnFromTheFakeMoment()
        {
            var start = new DateTime(2026, 11, 29, 7, 25, 0);
            using (ClinicClock.Use(start, running: true))
            {
                await Task.Delay(50);

                ClinicClock.Now.Should().BeAfter(start).And.BeBefore(start.AddMinutes(1));
                ClinicClock.IsFrozen.Should().BeFalse();
            }
        }

        [Fact]
        public void ClinicNowEndpoint_ReturnsTheClinicClock()
        {
            using (ClinicClock.Use(new DateTime(2026, 11, 29, 9, 45, 0)))
            {
                var result = new ClinicController().GetNow();

                var body = (result.Result as OkObjectResult)!.Value as ApiResponse<ClinicNowResponse>;
                body!.Data!.ClinicTime.Should().Be("2026-11-29T09:45:00");
                body.Data.Today.Should().Be("2026-11-29");
                body.Data.IsFake.Should().BeTrue();
                body.Data.IsFrozen.Should().BeTrue();
                body.Data.UtcNow.Should().Be(new DateTimeOffset(2026, 11, 29, 2, 45, 0, TimeSpan.Zero));
            }
        }
    }

    // Configure changes the process-wide clock, so these tests run alone, after the parallel ones
    [CollectionDefinition(nameof(ClinicClockConfigureCollection), DisableParallelization = true)]
    public class ClinicClockConfigureCollection
    {
    }

    [Collection(nameof(ClinicClockConfigureCollection))]
    public class ClinicClockConfigureTests
    {
        [Fact]
        public void Configure_WithFakeNow_HoldsTheTime_AndEmptyValueRestoresTheRealClock()
        {
            try
            {
                ClinicClock.Configure("2026-11-29 16:55").Should().NotBeNull();
                ClinicClock.Now.Should().Be(new DateTime(2026, 11, 29, 16, 55, 0));
                ClinicClock.IsFake.Should().BeTrue();

                ClinicClock.Configure("").Should().BeNull();
                ClinicClock.IsFake.Should().BeFalse();
                ClinicClock.UtcNow.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
            }
            finally
            {
                ClinicClock.Configure(null);
            }
        }

        [Fact]
        public void Configure_RejectsAnUnknownMode()
        {
            try
            {
                var act = () => ClinicClock.Configure("2026-11-29 16:55", "Sometimes");

                act.Should().Throw<FormatException>();
            }
            finally
            {
                ClinicClock.Configure(null);
            }
        }
    }
}

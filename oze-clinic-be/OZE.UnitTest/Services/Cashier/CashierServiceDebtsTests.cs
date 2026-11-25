using FluentAssertions;
using Moq;
using OZE.Application.Helpers;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using Xunit;

namespace OZE.UnitTest.Services.Cashier
{
    // Công nợ (GET api/cashier/debts): who owes, since when, in which order, and the total
    [Trait("Tab", "Cashier-Debts")]
    public class CashierServiceDebtsTests
    {
        private readonly Mock<ICashierRepository> _repo = new();
        private readonly CashierService _service;
        private readonly List<CashierAccountResponse> _accounts = new();
        private static readonly DateOnly Today = DateOnly.FromDateTime(ClinicClock.Today);

        public CashierServiceDebtsTests()
        {
            _service = new CashierService(_repo.Object, new Mock<ICashSessionRepository>().Object, new Mock<IAuditLogService>().Object);
            _repo.Setup(r => r.GetCandidatePatientsAsync(It.IsAny<CancellationToken>()))
                 .ReturnsAsync(() => _accounts.Select(a => a.Patient).ToList());
            _repo.Setup(r => r.GetAccountsAsync(It.IsAny<IReadOnlyCollection<CashierPatientInfo>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync((IReadOnlyCollection<CashierPatientInfo> patients, CancellationToken _) =>
                     _accounts.Where(a => patients.Any(p => p.Id == a.Patient.Id)).ToList());
        }

        private CashierAccountResponse AddVisitDebt(int id, string name, int daysAgo, decimal amount, string phone = "+84900000000", decimal pending = 0m)
        {
            var account = new CashierAccountResponse
            {
                Patient = new CashierPatientInfo { Id = id, Code = $"BN{id:D2}", Name = name, Phone = phone },
                Visits =
                {
                    new CashierVisitData
                    {
                        Id = id * 10,
                        PatientId = id,
                        AppointmentId = id * 10,
                        StartAt = Today.AddDays(-daysAgo).ToString("yyyy-MM-dd") + "T09:00",
                        Amount = amount
                    }
                }
            };
            if (pending > 0)
            {
                account.Receipts.Add(new CashierReceiptData
                {
                    Id = $"PT-{id}",
                    PatientId = id,
                    Status = CashierConstants.ReceiptStatus.Pending,
                    Lines = { new CashierReceiptLineData { Kind = CashierConstants.LineKind.VisitService, VisitId = id * 10, Amount = pending } }
                });
            }
            _accounts.Add(account);
            return account;
        }

        [Fact]
        public async Task OnlyPatientsOwingConfirmedMoney_PendingOnlyStillListed()
        {
            AddVisitDebt(1, "An", 3, 500_000m);
            AddVisitDebt(2, "Bình", 3, 400_000m, pending: 400_000m);
            var settled = AddVisitDebt(3, "Chi", 3, 300_000m);
            settled.Receipts.Add(new CashierReceiptData
            {
                Id = "PT-3",
                PatientId = 3,
                Status = CashierConstants.ReceiptStatus.Confirmed,
                Lines = { new CashierReceiptLineData { Kind = CashierConstants.LineKind.VisitService, VisitId = 30, Amount = 300_000m } }
            });

            var result = await _service.GetDebtsAsync(new CashierDebtQuery());

            result.Items.Select(i => i.Name).Should().BeEquivalentTo(new[] { "An", "Bình" });
            result.Items.Single(i => i.Name == "Bình").Pending.Should().Be(400_000m);
        }

        [Theory]
        [InlineData("lt7", new[] { 6 })]
        [InlineData("7to30", new[] { 7, 30 })]
        [InlineData("gt30", new[] { 31 })]
        public async Task AgeFilter_Boundaries(string age, int[] expectedDays)
        {
            AddVisitDebt(1, "A", 6, 100_000m);
            AddVisitDebt(2, "B", 7, 100_000m);
            AddVisitDebt(3, "C", 30, 100_000m);
            AddVisitDebt(4, "D", 31, 100_000m);

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { Age = age });

            result.Items.Select(i => i.DebtDays!.Value).Should().BeEquivalentTo(expectedDays);
        }

        [Fact]
        public async Task OldestFirst_NoDateLast_TotalOverEveryPage()
        {
            AddVisitDebt(1, "Mới", 2, 100_000m);
            AddVisitDebt(2, "Cũ", 40, 200_000m);
            _accounts.Add(new CashierAccountResponse
            {
                Patient = new CashierPatientInfo { Id = 3, Code = "BN03", Name = "Không ngày" },
                Plans =
                {
                    new CashierPlanData
                    {
                        Id = 30,
                        PatientId = 3,
                        Name = "Kế hoạch",
                        PlanPrice = 1_000_000m,
                        Option = CashierConstants.Option.Full,
                        Periods = { new CashierPeriodData { Id = 301, Seq = 1, PlanAmount = 1_000_000m, Finished = false } }
                    }
                }
            });

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { PageSize = 2 });

            result.Items.Select(i => i.Name).Should().Equal("Cũ", "Mới");
            result.TotalCount.Should().Be(3);
            result.TotalPages.Should().Be(2);
            result.TotalOwed.Should().Be(1_300_000m);
        }

        [Theory]
        [InlineData("0912345678")]
        [InlineData("+84912345678")]
        public async Task Search_ByPhone_WithZeroOrCountryCode(string keyword)
        {
            AddVisitDebt(1, "An", 3, 100_000m, phone: "+84912345678");
            AddVisitDebt(2, "Bình", 3, 100_000m, phone: "+84987654321");

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { SearchKeyword = keyword });

            result.Items.Select(i => i.Name).Should().Equal("An");
        }

        [Fact]
        public async Task UnknownAge_IsRejected()
        {
            var act = () => _service.GetDebtsAsync(new CashierDebtQuery { Age = "old" });

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CashierMessage.DebtAgeInvalid);
        }

        private void AddUndatedDebt(int id, string name)
        {
            _accounts.Add(new CashierAccountResponse
            {
                Patient = new CashierPatientInfo { Id = id, Code = $"BN{id:D2}", Name = name },
                Plans =
                {
                    new CashierPlanData
                    {
                        Id = id * 10,
                        PatientId = id,
                        Name = "Kế hoạch",
                        PlanPrice = 1_000_000m,
                        Option = CashierConstants.Option.Full,
                        Periods = { new CashierPeriodData { Id = id * 100, Seq = 1, PlanAmount = 1_000_000m, Finished = false } }
                    }
                }
            });
        }

        [Fact]
        public async Task DateRange_BothEndsIncluded()
        {
            AddVisitDebt(1, "A", 11, 100_000m);
            AddVisitDebt(2, "B", 10, 100_000m);
            AddVisitDebt(3, "C", 5, 100_000m);
            AddVisitDebt(4, "D", 4, 100_000m);

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { FromDate = Today.AddDays(-10), ToDate = Today.AddDays(-5) });

            result.Items.Select(i => i.Name).Should().Equal("B", "C");
        }

        [Fact]
        public async Task DateRange_OneEndOnly_AndDropsRowsWithoutDate()
        {
            AddVisitDebt(1, "A", 20, 100_000m);
            AddVisitDebt(2, "B", 2, 100_000m);
            AddUndatedDebt(3, "Không ngày");

            var from = await _service.GetDebtsAsync(new CashierDebtQuery { FromDate = Today.AddDays(-3) });
            var to = await _service.GetDebtsAsync(new CashierDebtQuery { ToDate = Today.AddDays(-3) });
            var none = await _service.GetDebtsAsync(new CashierDebtQuery());

            from.Items.Select(i => i.Name).Should().Equal("B");
            to.Items.Select(i => i.Name).Should().Equal("A");
            none.Items.Select(i => i.Name).Should().Contain("Không ngày");
        }

        [Fact]
        public async Task DateRange_WithAge_BothApply()
        {
            AddVisitDebt(1, "A", 40, 100_000m);
            AddVisitDebt(2, "B", 35, 100_000m);
            AddVisitDebt(3, "C", 20, 100_000m);

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { Age = CashierConstants.DebtAge.Over30, FromDate = Today.AddDays(-36) });

            result.Items.Select(i => i.Name).Should().Equal("B");
        }

        [Fact]
        public async Task DateRange_TotalsAfterFilter()
        {
            AddVisitDebt(1, "A", 20, 100_000m);
            AddVisitDebt(2, "B", 8, 200_000m);
            AddVisitDebt(3, "C", 6, 400_000m);

            var result = await _service.GetDebtsAsync(new CashierDebtQuery { FromDate = Today.AddDays(-10), PageSize = 1 });

            result.TotalCount.Should().Be(2);
            result.TotalPages.Should().Be(2);
            result.TotalOwed.Should().Be(600_000m);
        }

        [Fact]
        public async Task DateRange_Reversed_IsRejected()
        {
            var act = () => _service.GetDebtsAsync(new CashierDebtQuery { FromDate = Today, ToDate = Today.AddDays(-1) });

            await act.Should().ThrowAsync<BadRequestException>().WithMessage(ErrorConstants.CashierMessage.DebtDateRangeInvalid);
        }
    }
}

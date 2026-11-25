using FluentAssertions;
using Moq;
using OZE.Application.Interfaces;
using OZE.Application.Services;
using OZE.Common.Constants;
using OZE.Common.Exceptions;
using OZE.Common.Models;
using OZE.Common.Models.Base;
using OZE.Domain.Entities;
using Xunit;

namespace OZE.UnitTest.Services.CashSessions
{
    // OZ-CASH-02 Hand-over rules: one drawer at a time, close checks the session and the figures, refunds, next shift
    [Trait("Tab", "OZ-CASH-02")]
    public class CashSessionHandoverRulesTests
    {
        private const string UserId = "letan-1";
        private const string OtherUserId = "letan-2";
        private const long SessionId = 7;

        private readonly Mock<ICashSessionRepository> _repo = new();
        private readonly Mock<IAuditLogService> _audit = new();
        private readonly CashSessionService _service;

        public CashSessionHandoverRulesTests()
        {
            _service = new CashSessionService(_repo.Object, _audit.Object);
            _repo.Setup(r => r.GetStaffNamesAsync(It.IsAny<IEnumerable<string>>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new Dictionary<string, string> { [UserId] = "Le tan 1", [OtherUserId] = "Le tan 2" });
            _repo.Setup(r => r.GetPaymentsConfirmedByAsync(UserId, It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<CashSessionPaymentItem>
                 {
                     new() { PaymentId = 1, PaymentMethod = PaymentConstants.Cash, Amount = 300_000m },
                     new() { PaymentId = 2, PaymentMethod = "BankTransfer", Amount = 200_000m }
                 });
            GivenRefunds();
        }

        private CashSession OpenSession()
        {
            var session = new CashSession
            {
                Id = SessionId,
                OpenedByUserId = UserId,
                OpenedAt = DateTimeOffset.UtcNow.AddHours(-3),
                OpeningCash = 1_000_000m,
                Status = CashSessionConstants.Open
            };
            _repo.Setup(r => r.GetOpenByUserAsync(UserId, It.IsAny<CancellationToken>())).ReturnsAsync(session);
            return session;
        }

        private void GivenRefunds(params decimal[] amounts)
        {
            _repo.Setup(r => r.GetRefundsPaidOutByAsync(UserId, It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(amounts.Select((a, i) => new CashSessionRefundItem { RefundRequestId = i + 1, InvoiceNumber = $"HD{i + 1}", Amount = a }).ToList());
        }

        // Expected cash with the default data: 1,000,000 opening + 300,000 cash = 1,300,000; transfers 200,000
        private static CloseCashSessionRequest Close(decimal counted = 1_300_000m) => new()
        {
            SessionId = SessionId,
            CountedCash = counted,
            ExpectedCash = 1_300_000m,
            ExpectedTransfer = 200_000m
        };

        // UTCID01 (N): with Status=Open a receptionist sees the open drawers of everyone (BE-H4)
        [Fact]
        public async Task GetPaged_StatusOpen_Receptionist_ListsEveryOpenDrawer()
        {
            CashSessionQuery? sent = null;
            string? openedBy = "not-called";
            _repo.Setup(r => r.GetPagedAsync(It.IsAny<CashSessionQuery>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                 .Callback<CashSessionQuery, string?, CancellationToken>((q, o, _) => { sent = q; openedBy = o; })
                 .ReturnsAsync(new PagedResult<CashSession> { Items = new List<CashSession>(), PageNumber = 1, PageSize = 5 });

            await _service.GetPagedAsync(UserId, isManager: false, new CashSessionQuery { Status = "open" });

            sent!.Status.Should().Be(CashSessionConstants.Open);
            openedBy.Should().BeNull();
        }

        // UTCID02 (N): without a status filter a receptionist still sees only their own sessions
        [Fact]
        public async Task GetPaged_NoStatus_Receptionist_SeesOwnOnly()
        {
            string? openedBy = null;
            _repo.Setup(r => r.GetPagedAsync(It.IsAny<CashSessionQuery>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                 .Callback<CashSessionQuery, string?, CancellationToken>((_, o, _) => openedBy = o)
                 .ReturnsAsync(new PagedResult<CashSession> { Items = new List<CashSession>(), PageNumber = 1, PageSize = 5 });

            await _service.GetPagedAsync(UserId, isManager: false, new CashSessionQuery { Status = CashSessionConstants.Closed });

            openedBy.Should().Be(UserId);
        }

        // UTCID03 (A): an unknown status is refused
        [Fact]
        public async Task GetPaged_UnknownStatus_Throws()
        {
            var act = () => _service.GetPagedAsync(UserId, isManager: false, new CashSessionQuery { Status = "Pending" });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.CashSessionMessage.StatusInvalid);
        }

        // UTCID04 (A): a new drawer cannot be opened while another receptionist's is still open (BE-H4)
        [Fact]
        public async Task Open_AnotherReceptionistStillOpen_Throws()
        {
            _repo.Setup(r => r.GetOpenByUserAsync(UserId, It.IsAny<CancellationToken>())).ReturnsAsync((CashSession?)null);
            _repo.Setup(r => r.GetOpenOfOthersAsync(UserId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new CashSession { Id = 3, OpenedByUserId = OtherUserId, OpenedAt = DateTimeOffset.UtcNow.AddHours(-5), Status = CashSessionConstants.Open });

            var act = () => _service.OpenAsync(UserId, new OpenCashSessionRequest { OpeningCash = 500_000m });

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().StartWith("Le tan 2 still has a cash session open");
            _repo.Verify(r => r.AddAsync(It.IsAny<CashSession>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        // UTCID05 (A): closing another session than the open one is refused with SESSION_CHANGED (BE-H1)
        [Fact]
        public async Task Close_WrongSessionId_ConflictSessionChanged()
        {
            OpenSession();
            var request = Close();
            request.SessionId = 99;

            var act = () => _service.CloseAsync(UserId, request);

            (await act.Should().ThrowAsync<ConflictException>()).Which.Code.Should().Be(CashSessionConstants.SessionChangedCode);
        }

        // UTCID06 (A): a payment came in while counting, so the expected cash differs: refused with FIGURES_CHANGED (BE-H1)
        [Fact]
        public async Task Close_ExpectedCashChanged_ConflictFiguresChanged()
        {
            var session = OpenSession();
            var request = Close();
            request.ExpectedCash = 1_000_000m;

            var act = () => _service.CloseAsync(UserId, request);

            (await act.Should().ThrowAsync<ConflictException>()).Which.Code.Should().Be(CashSessionConstants.FiguresChangedCode);
            session.Status.Should().Be(CashSessionConstants.Open);
        }

        // UTCID07 (N): the count per banknote is saved and returned (BE-H1)
        [Fact]
        public async Task Close_DenominationsAddUp_Saved()
        {
            var session = OpenSession();
            var request = Close();
            request.Denominations = new Dictionary<int, int> { [500_000] = 2, [200_000] = 1, [100_000] = 1, [50_000] = 0 };

            var result = await _service.CloseAsync(UserId, request);

            session.Denominations.Should().NotBeNull();
            result.Denominations.Should().BeEquivalentTo(new Dictionary<int, int> { [500_000] = 2, [200_000] = 1, [100_000] = 1 });
        }

        // UTCID08 (A): banknotes that do not add up to the counted cash are refused
        [Fact]
        public async Task Close_DenominationsMismatch_Throws()
        {
            OpenSession();
            var request = Close();
            request.Denominations = new Dictionary<int, int> { [500_000] = 2 };

            var act = () => _service.CloseAsync(UserId, request);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.CashSessionMessage.DenominationsMismatch);
        }

        // UTCID09 (N): a refund paid out of the drawer lowers the expected cash and is listed in the session (BE-H4)
        [Fact]
        public async Task Close_RefundPaidOut_LowersExpectedCash()
        {
            var session = OpenSession();
            GivenRefunds(100_000m);
            var request = Close(1_200_000m);
            request.ExpectedCash = 1_200_000m;

            var result = await _service.CloseAsync(UserId, request);

            session.RefundPaidOut.Should().Be(100_000m);
            session.Difference.Should().Be(0m);
            result.Refunds.Should().ContainSingle(x => x.Amount == 100_000m);
        }

        // UTCID10 (A): transfers checked on the statement differ and there is no note (BE-H4)
        [Fact]
        public async Task Close_CountedTransferDiffersWithoutNote_Throws()
        {
            OpenSession();
            var request = Close();
            request.CountedTransfer = 150_000m;

            var act = () => _service.CloseAsync(UserId, request);

            (await act.Should().ThrowAsync<BadRequestException>()).Which.Message.Should().Be(ErrorConstants.CashSessionMessage.TransferNoteRequired);
        }

        // UTCID11 (N): with a note the counted transfer and its difference are kept
        [Fact]
        public async Task Close_CountedTransferWithNote_KeepsDifference()
        {
            var session = OpenSession();
            var request = Close();
            request.CountedTransfer = 150_000m;
            request.Notes = "Mot khoan chuyen khoan chua ve tai khoan";

            await _service.CloseAsync(UserId, request);

            session.CountedTransfer.Should().Be(150_000m);
            session.TransferDifference.Should().Be(-50_000m);
        }

        // UTCID12 (N): the next shift starts with what the previous shift of today counted (BE-H3)
        [Fact]
        public async Task NextShift_StartsWithPreviousCount()
        {
            _repo.Setup(r => r.GetLatestClosedAsync(It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new CashSession { Id = 3, OpenedByUserId = OtherUserId, Status = CashSessionConstants.Closed, CountedCash = 2_000_000m, ClosedAt = DateTimeOffset.UtcNow.AddHours(-1) });
            _repo.Setup(r => r.GetShiftsOfUserAsync(UserId, It.IsAny<DateOnly>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<StaffSchedule> { new() { ShiftStart = TimeOnly.MinValue, ShiftEnd = TimeOnly.MaxValue } });

            var result = await _service.GetNextShiftAsync(UserId);

            result.ExpectedOpeningCash.Should().Be(2_000_000m);
            result.FromSessionId.Should().Be(3);
            result.FromUserName.Should().Be("Le tan 2");
            result.StaffName.Should().Be("Le tan 1");
            result.ShiftEnd.Should().Be(TimeOnly.MaxValue);
        }

        // UTCID13 (B): nothing was closed earlier today: 404, the screen falls back to its own plan
        [Fact]
        public async Task NextShift_NothingClosedToday_NotFound()
        {
            _repo.Setup(r => r.GetLatestClosedAsync(It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
                 .ReturnsAsync((CashSession?)null);

            var act = () => _service.GetNextShiftAsync(UserId);

            await act.Should().ThrowAsync<NotFoundException>();
        }
    }
}

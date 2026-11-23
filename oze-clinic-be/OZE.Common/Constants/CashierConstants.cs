namespace OZE.Common.Constants
{
    // Cashier pages (Thanh toán, Đặt cọc, Theo đợt, Ghi nhận thu tiền). Values are the ones the FE uses (utils/cashier.js).
    public static class CashierConstants
    {
        // How a treatment plan is paid; must match CK_TreatmentPlans_PaymentOption
        public static class Option
        {
            public const string Full = "FULL";
            public const string Periods = "PERIODS";
            public const string Deposit = "DEPOSIT";
            public static readonly string[] All = { Full, Periods, Deposit };
        }

        // Kind of one line of a receipt. Not stored: worked out from Payment.Purpose, the invoice and TreatmentPlanStageId.
        public static class LineKind
        {
            public const string Deposit = "DEPOSIT";
            public const string Full = "FULL";
            public const string Period = "PERIOD";
            public const string VisitService = "VISIT_SERVICE";
            public static readonly string[] All = { Deposit, Full, Period, VisitService };
        }

        // Receipt status as the FE shows it; REJECTED is a FAILED payment
        public static class ReceiptStatus
        {
            public const string Confirmed = "CONFIRMED";
            public const string Pending = "PENDING";
            public const string Rejected = "REJECTED";
        }

        public static class PeriodStatus
        {
            public const string NotYet = "NOT_YET";
            public const string Paid = "PAID";
            public const string WaitFull = "WAIT_FULL";
            public const string Pending = "PENDING";
            public const string Partial = "PARTIAL";
            public const string Due = "DUE";
        }

        // In the order the status column picks the first one that applies
        public static class PatientStatus
        {
            public const string Owed = "OWED";
            public const string Pending = "PENDING";
            public const string Refund = "REFUND";
            public const string Upcoming = "UPCOMING";
            public const string Settled = "SETTLED";
            public static readonly string[] All = { Owed, Pending, Refund, Upcoming, Settled };
        }

        // Công nợ filter: days since the debt started
        public static class DebtAge
        {
            public const string Under7 = "lt7";
            public const string From7To30 = "7to30";
            public const string Over30 = "gt30";
            public static readonly string[] All = { Under7, From7To30, Over30 };
        }

        // Main button of a plan
        public static class Action
        {
            public const string Choose = "CHOOSE";
            public const string Deposit = "DEPOSIT";
            public const string Full = "FULL";
            public const string Collect = "COLLECT";
            public const string View = "VIEW";
        }

        // Plans the cashier works on; Draft / Proposed are not agreed yet, Cancelled / Superseded are closed
        public static readonly string[] PlanStatuses =
        {
            TreatmentPlanConstants.Approved,
            TreatmentPlanConstants.InProgress,
            TreatmentPlanConstants.Completed
        };

        // Used when Payment.DepositRate is missing or not a number
        public const decimal DefaultDepositRatePercent = 30m;

        // Lines of one receipt share PT-yyMMdd-xxxxxx; a payment recorded on its own reads as P{id}
        public const string ReceiptCodePrefix = "PT";
        public const string SinglePaymentPrefix = "P";

        public const int SearchMaxLength = 100;
        public const int DefaultPageSize = 20;
        public const int MaxPageSize = 100;
        public const int OptionListSize = 20;
    }
}

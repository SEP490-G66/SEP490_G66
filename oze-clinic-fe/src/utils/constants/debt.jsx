// Names and colours for the "Công nợ" page (api/debts). Statuses are the backend's own codes
// (InvoiceConstants / PaymentConstants).

// Payment status of an invoice that still has money owed.
export const DEBT_STATUS_LABELS = {
    UNPAID: { label: "Chưa thanh toán", badge: "badge-danger" },
    PARTIALLY_PAID: { label: "Thanh toán một phần", badge: "badge-warning" },
    PENDING_CONFIRMATION: { label: "Chờ xác nhận", badge: "badge-warning" },
    PARTIALLY_REFUNDED: { label: "Hoàn tiền một phần", badge: "badge-neutral" },
};

export const DEBT_STATUS_OPTIONS = Object.entries(DEBT_STATUS_LABELS).map(([value, { label }]) => ({ value, label }));

// Status of one payment of the invoice.
export const DEBT_PAYMENT_STATUS_LABELS = {
    CONFIRMED: { label: "Đã xác nhận", badge: "badge-success" },
    PENDING: { label: "Chờ xác nhận", badge: "badge-warning" },
    FAILED: { label: "Thất bại", badge: "badge-danger" },
    REFUNDED: { label: "Đã hoàn", badge: "badge-neutral" },
};

// How a debt is coloured once it is older than `days`. Oldest level first, which is the order getDebtAgeLevel checks.
export const DEBT_AGE_LEVELS = [
    {
        days: 60,
        row: "bg-danger-soft hover:bg-danger-soft",
        edge: "border-l-3 border-l-danger-solid",
        date: "font-semibold text-danger",
        swatch: "border-danger-solid bg-danger-soft",
    },
    {
        days: 30,
        row: "bg-warning-soft hover:bg-warning-soft",
        edge: "border-l-3 border-l-warning-solid",
        date: "font-semibold text-warning",
        swatch: "border-warning-solid bg-warning-soft",
    },
];

// The level of a debt that is ageDays old (the backend counts them), or null while it is 30 days old or less.
export const getDebtAgeLevel = (ageDays) => DEBT_AGE_LEVELS.find((level) => ageDays > level.days) ?? null;

export const DEBT_AGE_FILTERS = {
    WITHIN_30: "within_30",
    OVER_30: "over_30",
    OVER_60: "over_60",
};

export const DEBT_AGE_FILTER_LABELS = {
    [DEBT_AGE_FILTERS.WITHIN_30]: "Trong 30 ngày",
    [DEBT_AGE_FILTERS.OVER_30]: "Quá 30 ngày",
    [DEBT_AGE_FILTERS.OVER_60]: "Quá 60 ngày",
};

// Whether the invoice is paid in installments, and if a period is already late.
export const DEBT_TYPES = {
    INSTALLMENT: "installment",
    OVERDUE: "overdue",
    REGULAR: "regular",
};

export const DEBT_TYPE_LABELS = {
    [DEBT_TYPES.INSTALLMENT]: "Trả góp",
    [DEBT_TYPES.OVERDUE]: "Trả góp quá hạn",
    [DEBT_TYPES.REGULAR]: "Không trả góp",
};

// OLDEST is "" because it is the default choice of the sort dropdown.
export const DEBT_SORTS = {
    OLDEST: "",
    NEWEST: "newest",
    LARGEST: "largest",
};

export const DEBT_SORT_LABELS = {
    [DEBT_SORTS.OLDEST]: "Nợ lâu nhất",
    [DEBT_SORTS.NEWEST]: "Nợ mới nhất",
    [DEBT_SORTS.LARGEST]: "Còn nợ nhiều nhất",
};

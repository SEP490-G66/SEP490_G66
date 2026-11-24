import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppointmentTabs from "@/components/appointment/AppointmentTabs";
import InstallmentTable from "@/components/patientDebt/InstallmentTable";
import InvoiceTable from "@/components/paymentHistory/InvoiceTable";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import ListFooter from "@/components/ui/ListFooter";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import SearchInput from "@/components/ui/SearchInput";
import SortSelect from "@/components/ui/SortSelect";
import useAsync from "@/hooks/useAsync";
import usePagedList from "@/hooks/usePagedList";
import { getMyDebtAccounts, getMyPaymentReceipts } from "@/services/patientBillingService";
import { norm } from "@/utils/medicalRecord";
import { BOOKING_ERROR_CODE, PATIENT_DEBT_STATUS, PAYMENT_HISTORY_STATUS } from "@/utils/messages";
import { ROUTES, getPaymentHistoryRoute } from "@/utils/routes";

const TITLE_ID = "payment-history-title";
const TAB = { INVOICES: "invoices", INSTALLMENTS: "installments" };
const TAB_PARAM = "tab";
const INVOICE_STATUS_OPTIONS = Object.entries(PAYMENT_HISTORY_STATUS).map(([value, meta]) => ({ value, label: meta.label }));
const DEBT_STATUS_OPTIONS = Object.entries(PATIENT_DEBT_STATUS).map(([value, meta]) => ({ value, label: meta.label }));
const SORT_OPTIONS = [
    { value: "new", label: "Ngày lập mới nhất" },
    { value: "old", label: "Ngày lập cũ nhất" },
];

// "16/10/2026" -> "2026-10-16" (the mappers keep display dates; the tables and filters need ISO).
const toIso = (date) => (/^\d{2}\/\d{2}\/\d{4}$/.test(date ?? "") ? date.split("/").reverse().join("-") : "");

const statusOf = (resource) => {
    if (resource.loading) return "loading";
    if (!resource.error && resource.value?.code === BOOKING_ERROR_CODE.PROFILE_NOT_FOUND) return "unlinked";
    return resource.error || !resource.value?.success ? "failed" : "ready";
};

const toInvoiceRow = (receipt) => ({
    id: receipt.id,
    code: receipt.no,
    createdAt: toIso(receipt.date),
    content: receipt.title || receipt.lines.map((line) => line.name).join(", "),
    amount: receipt.net,
    remaining: receipt.left,
    statusKey: receipt.status,
    status: PAYMENT_HISTORY_STATUS[receipt.status],
    refundable: receipt.paid > 0,
    search: receipt.search,
});

const toInstallmentRow = (item) => ({
    id: item.id,
    name: item.name,
    doctorName: item.doctorName,
    installmentCount: item.stages.length,
    total: item.total,
    paid: item.paid,
    remaining: Math.max(item.total - item.paid, 0),
    statusKey: item.status,
    status: PATIENT_DEBT_STATUS[item.status],
    createdAt: toIso(item.start),
    search: item.search,
});

const InvoicesTab = ({ receipts }) => {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const keyword = norm(search.trim());
    const all = receipts.map(toInvoiceRow);
    const rows = all
        .filter((row) => (!keyword || row.search.includes(keyword)) && (!status || row.statusKey === status) && (!from || row.createdAt >= from) && (!to || row.createdAt <= to))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    const list = usePagedList(rows, { resetKey: `${keyword}|${status}|${from}|${to}` });

    const clear = () => {
        setSearch("");
        setStatus("");
        setFrom("");
        setTo("");
    };

    return (
        <div className="flex flex-col gap-4">
            <FilterBar canClear={Boolean(keyword || status || from || to)} onClear={clear}>
                <SearchInput id="invoice-search" label="Tìm theo mã hoá đơn, nội dung" placeholder="Tìm theo mã hoá đơn, nội dung" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                <FilterSelect id="invoice-status" label="Trạng thái" allLabel="Tất cả trạng thái" options={INVOICE_STATUS_OPTIONS} value={status} onChange={setStatus} className={FILTER_SELECT_CLASS} />
                <div className="field w-full sm:w-auto">
                    <label htmlFor="invoice-from" className="label">
                        Ngày tạo từ
                    </label>
                    <input id="invoice-from" type="date" className="input" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div className="field w-full sm:w-auto">
                    <label htmlFor="invoice-to" className="label">
                        đến
                    </label>
                    <input id="invoice-to" type="date" className="input" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
                </div>
            </FilterBar>
            <InvoiceTable
                invoices={list.rows}
                offset={list.offset}
                labelledBy={TITLE_ID}
                empty={all.length ? "Không có hoá đơn phù hợp." : "Bạn chưa có hoá đơn nào."}
                footer={list.total > 0 && <ListFooter list={list} label="Phân trang hoá đơn" />}
                invoiceHref={(invoice) => getPaymentHistoryRoute(invoice.id)}
                refundHref={() => ROUTES.REFUND_REQUESTS}
            />
        </div>
    );
};

const InstallmentsTab = ({ items }) => {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState("new");
    const keyword = norm(search.trim());
    const all = items.filter((item) => item.type !== "once").map(toInstallmentRow);
    const rows = all
        .filter((row) => (!keyword || row.search.includes(keyword)) && (!status || row.statusKey === status))
        .sort((a, b) => (sort === "new" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    const list = usePagedList(rows, { resetKey: `${keyword}|${status}|${sort}` });

    const clear = () => {
        setSearch("");
        setStatus("");
        setSort("new");
    };

    return (
        <div className="flex flex-col gap-4">
            <FilterBar canClear={Boolean(keyword || status || sort !== "new")} onClear={clear}>
                <SearchInput id="installment-search" label="Tìm theo tên dịch vụ, bác sĩ" placeholder="Tìm theo tên dịch vụ, bác sĩ" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                <FilterSelect id="installment-status" label="Trạng thái" allLabel="Tất cả trạng thái" options={DEBT_STATUS_OPTIONS} value={status} onChange={setStatus} className={FILTER_SELECT_CLASS} />
                <SortSelect id="installment-sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
            </FilterBar>
            <InstallmentTable
                plans={list.rows}
                offset={list.offset}
                labelledBy={TITLE_ID}
                empty={all.length ? "Không có khoản trả theo đợt phù hợp." : "Bạn chưa có khoản trả theo đợt nào."}
                footer={list.total > 0 && <ListFooter list={list} label="Phân trang trả theo đợt" />}
            />
        </div>
    );
};

// "Lịch sử thanh toán" (Figma 1243:4177 / 1244:4233): invoices and plans paid in several instalments.
const PaymentHistory = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get(TAB_PARAM) === TAB.INSTALLMENTS ? TAB.INSTALLMENTS : TAB.INVOICES;
    const [version, setVersion] = useState(0);
    const receiptsState = useAsync(() => getMyPaymentReceipts(), [version]);
    const accountsState = useAsync(() => getMyDebtAccounts(), [version]);
    const current = tab === TAB.INVOICES ? receiptsState : accountsState;
    const status = statusOf(current);
    const receipts = statusOf(receiptsState) === "ready" ? receiptsState.value.data.items : [];
    const accounts = statusOf(accountsState) === "ready" ? accountsState.value.data.items : [];

    const tabs = [
        { key: TAB.INVOICES, label: "Hoá đơn", count: receipts.length },
        { key: TAB.INSTALLMENTS, label: "Trả theo đợt", count: accounts.filter((item) => item.type !== "once").length },
    ];

    const selectTab = (key) => setSearchParams(key === TAB.INVOICES ? {} : { [TAB_PARAM]: key }, { replace: true });

    return (
        <>
            <PageHeader id={TITLE_ID} title="Lịch sử thanh toán" description="Thanh toán bằng tiền mặt hoặc chuyển khoản tại quầy lễ tân. Lễ tân ghi nhận, bạn xem lại tại đây." />
            <div className="mb-5">
                <AppointmentTabs tabs={tabs} selected={tab} onSelect={selectTab} labelledBy={TITLE_ID} idPrefix="payment-history" />
            </div>
            <div id="payment-history-panel" role="tabpanel" aria-labelledby={`payment-history-tab-${tab}`}>
                <PageLoadState status={status} onRetry={() => setVersion((value) => value + 1)} />
                {status === "ready" && (tab === TAB.INVOICES ? <InvoicesTab receipts={receipts} /> : <InstallmentsTab items={accounts} />)}
            </div>
        </>
    );
};

export default PaymentHistory;

import { useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import DebtsTab from "@/components/billing/DebtsTab";
import InvoicesTab from "@/components/billing/InvoicesTab";
import RefundsTab from "@/components/billing/RefundsTab";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const TABS = ["inv", "debt", "refund"];
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.INV_TITLE }];

const ReceptionInvoices = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = TABS.includes(searchParams.get("tab")) ? searchParams.get("tab") : "inv";

    usePageTitle(TEXT.INV_DOC_TITLE);

    const go = (next) => setSearchParams(next === "inv" ? {} : { tab: next }, { replace: true });
    const onKey = (event) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
        go(next);
        document.getElementById(`bill-tab-${next}`)?.focus();
    };

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.INV_TITLE}</h1>
            </div>
            <div role="tablist" aria-label={TEXT.TABS_LABEL} className="flex gap-1 overflow-x-auto border-b border-border" onKeyDown={onKey}>
                {TABS.map((key) => (
                    <button
                        key={key}
                        id={`bill-tab-${key}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        aria-controls="bill-panel"
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => go(key)}
                        className={cx(
                            "-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-label font-semibold",
                            tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink",
                        )}
                    >
                        {TEXT.TABS[key]}
                    </button>
                ))}
            </div>
            <div id="bill-panel" role="tabpanel" aria-labelledby={`bill-tab-${tab}`}>
                {tab === "inv" && <InvoicesTab />}
                {tab === "debt" && <DebtsTab />}
                {tab === "refund" && <RefundsTab />}
            </div>
        </div>
    );
};

export default ReceptionInvoices;

import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import InvoicesTab from "@/components/billing/InvoicesTab";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.FINANCE_CRUMB }, { label: TEXT.INVOICES_TITLE }];
const MOVED_TABS = { debt: ROUTES.RECEPTION_DEBTS, refund: ROUTES.RECEPTION_REFUNDS };

const ReceptionInvoices = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get("tab");

    usePageTitle(TEXT.INVOICES_DOC_TITLE);

    useEffect(() => {
        if (tab !== null && !MOVED_TABS[tab]) setSearchParams({}, { replace: true });
    }, [tab, setSearchParams]);

    if (MOVED_TABS[tab]) return <Navigate to={MOVED_TABS[tab]} replace />;

    return (
        <div className="space-y-6">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.INVOICES_TITLE}</h1>
            </div>
            <InvoicesTab />
        </div>
    );
};

export default ReceptionInvoices;

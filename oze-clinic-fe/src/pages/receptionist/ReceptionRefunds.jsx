import { useState } from "react";
import { toast } from "react-toastify";
import { Plus } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import RefundCreateDialog from "@/components/billing/RefundCreateDialog";
import RefundsTab from "@/components/billing/RefundsTab";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { BILLING_TEXT as TEXT, GENERIC_ERROR_MESSAGE } from "@/utils/messages";

const CRUMBS = [{ label: TEXT.FINANCE_CRUMB }, { label: TEXT.REFUNDS_TITLE }];

const ReceptionRefunds = () => {
    usePageTitle(TEXT.REFUNDS_DOC_TITLE);
    const [creating, setCreating] = useState(false);
    const [listKey, setListKey] = useState(0);

    const refresh = () => {
        setCreating(false);
        setListKey((n) => n + 1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-64 flex-1">
                    <Breadcrumb items={CRUMBS} className="mb-2" />
                    <h1 className="page-title">{TEXT.REFUNDS_TITLE}</h1>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                    <Plus className="size-4" aria-hidden="true" />
                    {TEXT.CREATE_REFUND}
                </button>
            </div>
            <RefundsTab key={listKey} />
            {creating && (
                <RefundCreateDialog
                    onClose={() => setCreating(false)}
                    onCreated={(name) => {
                        refresh();
                        toast.success(TEXT.REFUND_REQUESTED(name));
                    }}
                    onUncertain={() => {
                        refresh();
                        toast.error(GENERIC_ERROR_MESSAGE);
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionRefunds;

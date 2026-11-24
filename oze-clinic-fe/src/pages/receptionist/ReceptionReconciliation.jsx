import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, Printer } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import DailyChannelTable from "@/components/reconciliation/DailyChannelTable";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getDailyReconciliation } from "@/services/reconciliationService";
import { clinicToday } from "@/services/receptionService";
import { dmy } from "@/utils/calendar";
import { RECON_TEXT as TEXT } from "@/utils/messages";
import { RECON_NOTE, reconcile } from "@/utils/reconciliation";
import { RECONCILIATION_DATE_PARAM, ROUTES } from "@/utils/routes";

const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NOTE_TEXT = { [RECON_NOTE.OPEN]: TEXT.NOTE_OPEN, [RECON_NOTE.REFUND]: TEXT.NOTE_REFUND, [RECON_NOTE.PENDING]: TEXT.NOTE_PENDING, [RECON_NOTE.DAY]: TEXT.NOTE_DAY };
const BLOCKED = [403, 404];

const usable = (value, today) => DAY.test(value ?? "") && value <= today;

const printPage = () => {
    try {
        window.print();
    } catch {
        toast.error(TEXT.PRINT_ERROR);
    }
};

const Notes = ({ notes }) =>
    notes.map((note) => (
        <p key={note} className="text-caption text-muted">
            {NOTE_TEXT[note]}
        </p>
    ));

const ReceptionReconciliation = () => {
    usePageTitle(TEXT.DOC_TITLE);
    const today = clinicToday();
    const [searchParams] = useSearchParams();
    const asked = searchParams.get(RECONCILIATION_DATE_PARAM);
    const [date, setDate] = useState(() => (usable(asked, today) ? asked : today));
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);

    const valid = usable(date, today);
    const key = `${date}|${reload}`;

    useEffect(() => {
        if (!valid) return undefined;
        const controller = new AbortController();
        getDailyReconciliation(date, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            const sameDay = response.success && String(response.data?.clinicDate ?? "").slice(0, 10) === date;
            setResult(sameDay ? { key, ok: true, view: reconcile(response.data) } : { key, ok: false, status: response.success ? null : response.status });
        });
        return () => controller.abort();
    }, [date, key, valid]);

    const current = valid && result?.key === key ? result : null;
    const view = current?.ok ? current.view : null;
    const loading = valid && !current;
    const failed = current && !current.ok;
    const day = valid ? dmy(date) : "";

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 print:hidden">
                <div className="min-w-64 flex-1">
                    <Breadcrumb items={CRUMBS} className="mb-2" />
                    <h1 className="page-title">{TEXT.TITLE}</h1>
                </div>
                <div className="field">
                    <label htmlFor="rc-date" className="label">
                        {TEXT.DATE}
                    </label>
                    <input id="rc-date" type="date" className="input w-auto" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <button type="button" className="btn btn-primary" disabled={!view} onClick={printPage}>
                    <Printer className="size-4" aria-hidden="true" />
                    {TEXT.PRINT}
                </button>
            </div>
            {loading && (
                <section className="rounded-xl border border-border bg-canvas p-5 print:hidden" aria-busy="true">
                    <div className="skeleton h-6 w-1/3" />
                    <div className="skeleton mt-4 h-24" />
                </section>
            )}
            {failed && (
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3 print:hidden">
                    <span className="flex-1">{BLOCKED.includes(current.status) ? TEXT.FORBIDDEN : TEXT.LOAD_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            {view && (
                <>
                    <section className="rounded-xl border border-border bg-canvas print:hidden">
                        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
                            <h2 className="mr-auto font-heading text-title text-ink">{TEXT.TABLE_TITLE(day)}</h2>
                        </div>
                        <div className="table-wrap rounded-none border-x-0 border-b-0">
                            <DailyChannelTable view={view} />
                        </div>
                        <div className="space-y-1.5 border-t border-border px-5 py-4">
                            <Notes notes={view.notes} />
                        </div>
                    </section>
                    <div className="hidden space-y-4 print:block">
                        <div className="border-b border-border pb-3">
                            <p className="page-title">{TEXT.TITLE}</p>
                            <p className="num text-body-sm text-body">{TEXT.PRINT_DATE(day)}</p>
                        </div>
                        {view.confirmed ? (
                            <p className="text-body-sm text-success">{TEXT.CONFIRMED}</p>
                        ) : (
                            <p className="text-body-sm font-semibold text-warning">{TEXT.NOT_CONFIRMED}</p>
                        )}
                        <div className="overflow-hidden rounded-lg border border-border">
                            <DailyChannelTable view={view} stack={false} />
                        </div>
                        <Notes notes={view.notes} />
                    </div>
                </>
            )}
            <div className="flex print:hidden">
                <Link to={ROUTES.RECEPTION_CASH_HANDOVER} className="btn btn-secondary">
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {TEXT.TO_HANDOVER}
                </Link>
            </div>
        </div>
    );
};

export default ReceptionReconciliation;

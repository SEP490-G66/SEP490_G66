import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ChevronLeft } from "lucide-react";
import ShiftClosePanel from "@/components/handover/ShiftClosePanel";
import ShiftCloseDialog from "@/components/handover/ShiftCloseDialog";
import ShiftResultPanel from "@/components/handover/ShiftResultPanel";
import ShiftSummary from "@/components/handover/ShiftSummary";
import ShiftTransactions from "@/components/handover/ShiftTransactions";
import { Card } from "@/components/reception/shared";
import { clinicClock, report } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { closeCashSession, getCashSession } from "@/services/cashSessionService";
import { getMyShifts } from "@/services/myScheduleService";
import { weekdayIndex } from "@/utils/calendar";
import { dateKey, isOpen, shiftEndOf, shiftTypeOf, summarize, systemTotals, timeOf, transactionsOf } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };

const printSlip = () => {
    try {
        window.print();
    } catch {
        toast.error(TEXT.PRINT_ERROR);
    }
};

const CashHandoverDetail = () => {
    const { sessionId } = useParams();
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [closing, setClosing] = useState(null);
    const [myShifts, setMyShifts] = useState([]);

    const key = `${sessionId}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getCashSession(sessionId, { ...READ, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setResult({ key, ok: response.success, status: response.status, session: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [sessionId, key]);

    const session = result?.session;
    const sessionDay = session ? dateKey(session.openedAt) : null;

    useEffect(() => {
        if (!sessionDay) return undefined;
        let active = true;
        getMyShifts({ fromDate: sessionDay, toDate: sessionDay }).then((r) => active && r.success && Array.isArray(r.data) && setMyShifts(r.data));
        return () => {
            active = false;
        };
    }, [sessionDay]);
    usePageTitle(session?.code ? `${session.code} – ${TEXT.DOC_TITLE}` : TEXT.DOC_TITLE);

    const back = (
        <Link to={ROUTES.RECEPTION_CASH_HANDOVER} className="inline-flex items-center gap-1 text-label font-semibold text-primary hover:underline">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {TEXT.BACK}
        </Link>
    );

    if (!result || (result.key !== key && !session)) {
        return (
            <div className="app-content min-h-full space-y-5">
                {back}
                <div className="skeleton h-40 rounded-xl" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="app-content min-h-full space-y-5">
                {back}
                <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                    <span className="flex-1">{result.status === 404 ? TEXT.NOT_FOUND : TEXT.LOAD_ERROR}</span>
                    {result.status !== 404 && (
                        <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                            {TEXT.RETRY}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const open = isOpen(session);
    const type = shiftTypeOf(session);
    const label = TEXT.SHIFT[type];
    const transactions = transactionsOf(session);
    const summary = summarize(transactions);
    const system = systemTotals(session, summary);
    const day = dateKey(session.openedAt);
    const code = session.code ?? `#${session.id}`;
    const meta = [
        [TEXT.META[0], session.openedByName],
        [TEXT.META[1], label],
        [TEXT.META[2], `${TEXT.WEEKDAYS_SHORT[weekdayIndex(day)]} ${day.split("-").reverse().join("/")}`],
        [TEXT.META[3], timeOf(session.openedAt)],
        [TEXT.META[4], open ? "—" : timeOf(session.closedAt)],
    ];

    return (
        <div className="app-content min-h-full space-y-5">
            {back}
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="page-title">{code}</h1>
                <span className={cx("badge", open ? "badge-success" : "badge-neutral")}>{TEXT.STATUS_LABEL[open ? "Open" : "Closed"]}</span>
            </div>
            <Card>
                <dl className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-5">
                    {meta.map(([k, v]) => (
                        <div key={k}>
                            <dt className="text-caption text-muted">{k}</dt>
                            <dd className="num m-0 font-semibold text-ink">{v}</dd>
                        </div>
                    ))}
                </dl>
            </Card>
            <ShiftSummary summary={summary} />
            {open ? (
                <ShiftClosePanel key={key} openingCash={session.openingCash} system={system} onRequestClose={(values, print) => setClosing({ values, print })} />
            ) : (
                <ShiftResultPanel
                    system={system}
                    actual={{ cash: Number(session.countedCash ?? 0), transfer: Number(session.countedTransfer ?? system.transfer) }}
                    notes={session.notes}
                    onPrint={printSlip}
                />
            )}
            <ShiftTransactions transactions={transactions} />
            {closing && (
                <ShiftCloseDialog
                    label={label}
                    subtitle={[code, session.openedByName, clinicClock()].filter(Boolean).join(" · ")}
                    values={closing.values}
                    system={system}
                    shiftEnd={day === dateKey(new Date()) ? shiftEndOf(session, myShifts) : null}
                    now={clinicClock()}
                    print={closing.print}
                    onClose={() => setClosing(null)}
                    onSubmit={async () => {
                        const at = clinicClock();
                        if (!report(await closeCashSession(closing.values), TEXT.CLOSED_TOAST(label, at))) return;
                        const print = closing.print;
                        setClosing(null);
                        setReload((n) => n + 1);
                        if (print) setTimeout(printSlip, 300);
                    }}
                />
            )}
        </div>
    );
};

export default CashHandoverDetail;

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "react-toastify";
import BackLink from "@/components/navigation/BackLink";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import ShiftClosePanel from "@/components/handover/ShiftClosePanel";
import ShiftCloseDialog from "@/components/handover/ShiftCloseDialog";
import ShiftResultPanel from "@/components/handover/ShiftResultPanel";
import ShiftCashFlow from "@/components/handover/ShiftCashFlow";
import ShiftTransactions from "@/components/handover/ShiftTransactions";
import { Card } from "@/components/reception/shared";
import { clinicClock, report } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { closeCashSession, getCashSession, getCurrentCashSession } from "@/services/cashSessionService";
import { clinicToday } from "@/services/receptionService";
import { getMyShifts } from "@/services/myScheduleService";
import { dmy, weekdayIndex } from "@/utils/calendar";
import { dateKey, isOpen, shiftEndOf, shiftTypeOf, summarize, systemTotals, timeOf, transactionsOf } from "@/utils/cashShift";
import { HANDOVER_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getReconciliationRoute } from "@/utils/routes";
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
    const [mineId, setMineId] = useState(undefined);
    // Set when "close and print" succeeds; the slip is printed once the reloaded page shows the closed result.
    const printAfterReload = useRef(false);

    const key = `${sessionId}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getCashSession(sessionId, { ...READ, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setResult({ key, ok: response.success, status: response.status, session: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [sessionId, key]);

    // Only the person who opened a shift may close it: the session on screen must be the viewer's own open session.
    useEffect(() => {
        const controller = new AbortController();
        getCurrentCashSession({ ...READ, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setMineId(response.success ? (response.data?.id ?? null) : null);
        });
        return () => controller.abort();
    }, [reload]);

    const loaded = result?.key === key;
    const session = loaded ? result.session : null;
    const mine = Boolean(session) && mineId != null && String(mineId) === String(session.id);
    const sessionDay = mine ? dateKey(session.openedAt) : null;

    useEffect(() => {
        if (!sessionDay) return undefined;
        let active = true;
        getMyShifts({ fromDate: sessionDay, toDate: sessionDay }, READ).then((r) => active && r.success && Array.isArray(r.data) && setMyShifts(r.data));
        return () => {
            active = false;
        };
    }, [sessionDay]);

    useEffect(() => {
        if (!printAfterReload.current || !session || isOpen(session)) return;
        printAfterReload.current = false;
        printSlip();
    }, [session]);
    usePageTitle(session?.code ? `${session.code} – ${TEXT.DOC_TITLE}` : TEXT.DOC_TITLE);

    const crumbs = [
        { label: TEXT.CRUMB },
        { label: TEXT.TITLE, href: ROUTES.RECEPTION_CASH_HANDOVER },
        { label: session ? (session.code ?? `#${session.id}`) : loaded ? `#${sessionId}` : TEXT.LOADING_CRUMB },
    ];
    const back = (
        <div className="flex items-center gap-3 print:hidden">
            <BackLink to={ROUTES.RECEPTION_CASH_HANDOVER} label={TEXT.BACK_LABEL} />
            <Breadcrumb items={crumbs} className="min-w-0 flex-wrap wrap-anywhere" />
        </div>
    );

    // Anything not loaded for this exact id and reload is never shown, so a previous session's figures cannot be acted on.
    if (!loaded) {
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
                    <span className="flex-1">{[400, 404].includes(result.status) ? TEXT.NOT_FOUND : result.status === 403 ? TEXT.FORBIDDEN : TEXT.LOAD_ERROR}</span>
                    {![400, 403, 404].includes(result.status) && (
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
    const today = clinicToday();
    const staleDay = open && mine && day && day < today ? dmy(day) : null;
    const reconLink = getReconciliationRoute(day && day < today ? day : today);
    const meta = [
        [TEXT.META[0], session.openedByName],
        [TEXT.META[1], label],
        [TEXT.META[2], day ? `${TEXT.WEEKDAYS_SHORT[weekdayIndex(day)]} ${dmy(day)}` : "—"],
        [TEXT.META[3], timeOf(session.openedAt)],
        [TEXT.META[4], open ? "—" : timeOf(session.closedAt)],
    ];

    return (
        <div className="app-content min-h-full space-y-5">
            {back}
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="page-title">{code}</h1>
                <span className={cx("badge", open ? "badge-success" : "badge-neutral")}>{open ? TEXT.STATUS_LABEL.Open : (TEXT.STATUS_LABEL[session.status] ?? session.status)}</span>
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
            {staleDay && <p className="alert alert-warning print:hidden">{TEXT.STALE_OPEN(staleDay)}</p>}
            <div className="grid gap-5 lg:grid-cols-2">
                {open && mine ? (
                    <ShiftClosePanel
                        key={key}
                        className="min-w-0"
                        openingCash={session.openingCash}
                        cashNet={summary.net.cash}
                        system={system}
                        onRequestClose={(values, print) => setClosing({ values, print })}
                    />
                ) : open ? (
                    <div className="min-w-0">{mineId !== undefined && <p className="alert alert-info">{TEXT.NOT_MINE(session.openedByName)}</p>}</div>
                ) : (
                    <ShiftResultPanel
                        className="min-w-0"
                        openingCash={session.openingCash}
                        cashNet={summary.net.cash}
                        system={system}
                        countedCash={session.countedCash == null ? null : Number(session.countedCash)}
                        notes={session.notes}
                        onPrint={printSlip}
                    />
                )}
                <ShiftCashFlow className="min-w-0" net={summary.net} reconLink={reconLink} />
            </div>
            <ShiftTransactions transactions={transactions} />
            {closing && (
                <ShiftCloseDialog
                    label={label}
                    subtitle={[code, session.openedByName, clinicClock()].filter(Boolean).join(" · ")}
                    values={closing.values}
                    system={system}
                    shiftEnd={day === today ? shiftEndOf(session, myShifts) : null}
                    now={clinicClock()}
                    print={closing.print}
                    warning={staleDay ? TEXT.STALE_OPEN(staleDay) : null}
                    onClose={() => setClosing(null)}
                    onSubmit={async () => {
                        const done = () => {
                            setClosing(null);
                            setReload((n) => n + 1);
                        };
                        // The figures the cashier counted against must still be the system's: a payment taken meanwhile changes them.
                        const latest = await getCashSession(session.id, READ);
                        if (!latest.success) {
                            report(latest);
                            return done();
                        }
                        if (!isOpen(latest.data)) return done();
                        const now = systemTotals(latest.data, summarize(transactionsOf(latest.data)));
                        if (now.cash !== system.cash || now.transfer !== system.transfer) {
                            toast.warning(TEXT.FIGURES_CHANGED);
                            return done();
                        }
                        const closed = report(
                            await closeCashSession({ ...closing.values, sessionId: session.id, expectedCash: system.cash, expectedTransfer: system.transfer }, READ),
                            TEXT.CLOSED_TOAST(label, clinicClock()),
                        );
                        if (closed && closing.print) printAfterReload.current = true;
                        done();
                    }}
                />
            )}
        </div>
    );
};

export default CashHandoverDetail;

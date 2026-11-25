import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppointmentTabs from "@/components/appointment/AppointmentTabs";
import BackLink from "@/components/navigation/BackLink";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import BookingDialog from "@/components/reception/BookingDialog";
import PatientAppointmentsTab from "@/components/reception/PatientAppointmentsTab";
import PatientInfoTab from "@/components/reception/PatientInfoTab";
import PatientInvoicesTab from "@/components/reception/PatientInvoicesTab";
import PatientPlansTab from "@/components/reception/PatientPlansTab";
import PatientSummaryCard from "@/components/reception/PatientSummaryCard";
import PlanApproveDialog from "@/components/reception/PlanApproveDialog";
import WalkInMismatchDialog from "@/components/reception/WalkInMismatchDialog";
import { Card, EmptyState, WalkInDialog } from "@/components/reception/shared";
import { clinicClock, ddmm, hhmm, money } from "@/components/reception/receptionUtils";
import { useDialogSession, useFocusOnEnter, useLoadGuard, usePageTitle, usePatientRecordNav } from "@/hooks/usePatientRecordNav";
import {
    clinicToday,
    createWalkIn,
    getDoctorsOnDuty,
    getPatient,
    getPatientAppointments,
    getPatientInvoices,
    getPatientTreatmentPlans,
} from "@/services/receptionService";
import { getSessionToken } from "@/services/sessionStore";
import { requestNavigate } from "@/utils/errorHandler";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import {
    LABEL_PAGE_SIZE,
    OPEN_INVOICE_STATUSES,
    bookingBlock,
    checkInTimeText,
    invoiceLabels,
    onDutyDoctors,
    planApproveButtonId,
    readPatientId,
    readTab,
    safeListSearch,
    upcomingAppointment,
    upcomingText,
    walkInBlock,
    walkInToday,
} from "@/utils/patientRecord";
import { BE_MESSAGES, errorText, hasMessage, isPatientGone, isUncertain } from "@/utils/patientRecordErrors";
import { notifyPatientRecord } from "@/utils/patientRecordStore";
import { RECEPTION_PATIENT_TABS as TABS, ROUTES, getReceptionPatientEditRoute, getReceptionPatientRoute } from "@/utils/routes";

const READ = { skipErrorPage: true };
const BOOKING_READ = { skipErrorPage: true };
const BOOKING_WRITE = { skipErrorPage: true };
const TAB_PREFIX = "pr-tabs";
const TAB_PAGE_SIZE = 20;
const REFRESH_MS = 5 * 60 * 1000;
const TAB_LIST = [TABS.INFO, TABS.APPOINTMENTS, TABS.PLANS, TABS.INVOICES].map((key) => ({ key, label: TEXT.TABS[key] }));
const INITIAL_SEQ = { patient: 0, invoices: 0, appointments: 0, doctors: 0, [TABS.APPOINTMENTS]: 0, [TABS.PLANS]: 0, [TABS.INVOICES]: 0 };

const formatBookingError = (result) => errorText(result);

const itemsOf = (data) => (Array.isArray(data) ? data : (data?.items ?? []));

const mergeById = (current, next) => {
    const seen = new Set(current.map((x) => x.id));
    return [...current, ...next.filter((x) => !seen.has(x.id))];
};

const hasMoreOf = (data, count) => {
    if (!data || Array.isArray(data)) return false;
    if (Number(data.totalPages) > Number(data.pageNumber ?? 1)) return true;
    return Number(data.totalCount ?? 0) > count;
};

const tabRequest = (tab, id, page, config) => {
    if (tab === TABS.APPOINTMENTS) return getPatientAppointments(id, { sortBy: "appointmentDate", sortDescending: true, pageSize: TAB_PAGE_SIZE, pageNumber: page }, config);
    if (tab === TABS.INVOICES) return getPatientInvoices(id, { pageSize: TAB_PAGE_SIZE, pageNumber: page }, config);
    return getPatientTreatmentPlans(id, { includeClosed: true }, config);
};

const upcomingQuery = (day) => ({ fromDate: day, sortBy: "appointmentDate", sortDescending: false, pageSize: LABEL_PAGE_SIZE });

const nowClock = () => ({ today: clinicToday(), now: clinicClock() });

const ReceptionPatientDetail = () => {
    const { patientId } = useParams();
    const [patientRes, setPatientRes] = useState(null);
    const [reload, setReload] = useState(0);
    const nav = usePatientRecordNav({ failed: Boolean(patientRes && !patientRes.ok) });
    const { loadKey, kind, navigateSelf, location } = nav;
    const idInfo = readPatientId(patientId);
    const id = idInfo?.id ?? null;
    const { tab, fixed: tabFixed } = readTab(location.search);
    const baseKey = `${loadKey}.${reload}`;
    const [seq, setSeq] = useState(INITIAL_SEQ);
    const [invoiceRes, setInvoiceRes] = useState(null);
    const [apptRes, setApptRes] = useState(null);
    const [doctorRes, setDoctorRes] = useState(null);
    const [tabRes, setTabRes] = useState({});
    const [more, setMore] = useState({});
    const [clock, setClock] = useState(nowClock);
    const [dialog, setDialog] = useState(null);
    const [tabStatus, setTabStatus] = useState("");
    const h1Ref = useFocusOnEnter(loadKey, kind);
    const walkInRef = useRef(null);
    const bookRef = useRef(null);
    const normalized = useRef(null);
    const pendingFocus = useRef(null);
    const latest = useRef({});
    const uncertainWalkIns = useRef(new Set());
    const isHere = useLoadGuard(baseKey);
    const session = useDialogSession(baseKey);

    const key = (name) => `${baseKey}|${seq[name]}`;
    const patientKey = key("patient");
    const invoiceKey = key("invoices");
    const apptKey = key("appointments");
    const doctorKey = key("doctors");
    const tabKey = key(tab);

    const patientCurrent = patientRes?.key === patientKey ? patientRes : null;
    const patient = patientCurrent?.ok ? patientCurrent.data : null;
    const notFound = !idInfo || Boolean(patientCurrent?.gone);

    usePageTitle(patient ? TEXT.DOC_TITLE_DETAIL(patient.fullName) : TEXT.DOC_TITLE_LIST);

    const bump = useCallback((...names) => setSeq((s) => names.reduce((acc, n) => ({ ...acc, [n]: acc[n] + 1 }), s)), []);
    const retryDoctors = useCallback(() => bump("doctors"), [bump]);

    useEffect(() => {
        latest.current = { apptKey, doctorKey, apptRes, doctorRes, id, patient, dialog };
    });

    useEffect(() => {
        if (!idInfo || normalized.current === loadKey) return;
        normalized.current = loadKey;
        if (idInfo.fixed || tabFixed) navigateSelf(getReceptionPatientRoute(idInfo.id, tab), { replace: true });
    }, [idInfo, tabFixed, tab, loadKey, navigateSelf]);

    useEffect(() => {
        if (!id) return undefined;
        const controller = new AbortController();
        getPatient(id, { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            setPatientRes({ key: patientKey, ok: result.success, data: result.data, gone: !result.success && isPatientGone(result), result });
        });
        return () => controller.abort();
    }, [id, patientKey]);

    useEffect(() => {
        if (!id) return undefined;
        const controller = new AbortController();
        Promise.all(OPEN_INVOICE_STATUSES.map((paymentStatus) => getPatientInvoices(id, { paymentStatus, pageSize: LABEL_PAGE_SIZE }, { ...READ, signal: controller.signal }))).then(
            (results) => {
                if (controller.signal.aborted || results.some((r) => r.aborted)) return;
                const ok = results.every((r) => r.success);
                setInvoiceRes({ key: invoiceKey, ok, pages: ok ? results.map((r) => r.data) : null });
            },
        );
        return () => controller.abort();
    }, [id, invoiceKey]);

    useEffect(() => {
        if (!id) return undefined;
        const controller = new AbortController();
        getPatientAppointments(id, upcomingQuery(clinicToday()), { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            setClock(nowClock());
            setApptRes({ key: apptKey, ok: result.success, items: result.success ? itemsOf(result.data) : [] });
        });
        return () => controller.abort();
    }, [id, apptKey]);

    useEffect(() => {
        if (!id) return undefined;
        const controller = new AbortController();
        getDoctorsOnDuty(undefined, { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            setClock(nowClock());
            setDoctorRes({ key: doctorKey, ok: result.success, shifts: result.success ? itemsOf(result.data) : [] });
        });
        return () => controller.abort();
    }, [id, doctorKey]);

    useEffect(() => {
        if (!id || tab === TABS.INFO) return undefined;
        const controller = new AbortController();
        tabRequest(tab, id, 1, { ...READ, signal: controller.signal }).then((result) => {
            if (result.aborted || controller.signal.aborted) return;
            const items = result.success ? itemsOf(result.data) : [];
            setTabRes((all) => ({ ...all, [tab]: { key: tabKey, ok: result.success, items, page: 1, hasMore: result.success && hasMoreOf(result.data, items.length) } }));
            setMore((all) => ({ ...all, [tab]: null }));
            if (result.success) setTabStatus(TEXT.TAB_LOADED(TEXT.TABS[tab]));
        });
        return () => controller.abort();
    }, [id, tab, tabKey]);

    const patientLoaded = Boolean(patient);
    useEffect(() => {
        if (!patientLoaded) return undefined;
        const refresh = () => {
            if (document.visibilityState !== "visible") return;
            const { id: pid, apptKey: aKey, doctorKey: dKey, apptRes: aRes, doctorRes: dRes } = latest.current;
            if (aRes?.key === aKey) {
                getPatientAppointments(pid, upcomingQuery(clinicToday()), READ).then((result) => {
                    if (!result.success || latest.current.apptKey !== aKey) return;
                    setClock(nowClock());
                    setApptRes({ key: aKey, ok: true, items: itemsOf(result.data) });
                });
            }
            if (dRes?.key === dKey) {
                getDoctorsOnDuty(undefined, READ).then((result) => {
                    if (!result.success || latest.current.doctorKey !== dKey) return;
                    setClock(nowClock());
                    setDoctorRes({ key: dKey, ok: true, shifts: itemsOf(result.data) });
                });
            }
        };
        const timer = setInterval(refresh, REFRESH_MS);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [patientLoaded]);

    const currentTab = tabRes[tab]?.key === tabKey ? tabRes[tab] : null;

    useEffect(() => {
        const pending = pendingFocus.current;
        if (!pending || dialog) return;
        if (pending.key !== baseKey) {
            pendingFocus.current = null;
            return;
        }
        if (pending.waitTab && !currentTab) return;
        pendingFocus.current = null;
        const target =
            pending.target === "walkIn"
                ? walkInRef.current
                : pending.target === "book"
                  ? bookRef.current
                  : (document.getElementById(pending.target) ?? document.getElementById(`${TAB_PREFIX}-tab-${TABS.PLANS}`));
        (target && document.contains(target) ? target : h1Ref.current)?.focus();
    }, [dialog, baseKey, currentTab, h1Ref]);

    const selectTab = (next) => {
        if (next === tab) return;
        if (tabRes[next] && !tabRes[next].ok) bump(next);
        navigateSelf(getReceptionPatientRoute(id, next), { replace: true });
    };

    const loadMore = () => {
        const state = currentTab;
        if (!state || more[tab]?.loading) return;
        const target = tab;
        const forKey = tabKey;
        const nextPage = state.page + 1;
        setMore((all) => ({ ...all, [target]: { loading: true, error: false, key: forKey } }));
        tabRequest(target, id, nextPage, READ).then((result) => {
            if (!isHere(baseKey)) return;
            setTabRes((all) => {
                const now = all[target];
                if (!now || now.key !== forKey) return all;
                if (!result.success) return all;
                const items = mergeById(now.items, itemsOf(result.data));
                return { ...all, [target]: { ...now, items, page: nextPage, hasMore: hasMoreOf(result.data, items.length) } };
            });
            setMore((all) => (all[target]?.key === forKey ? { ...all, [target]: { loading: false, error: !result.success, key: forKey } } : all));
        });
    };

    const reloadAfterVisit = () => {
        const names = ["invoices", "appointments"];
        if (tabRes[TABS.APPOINTMENTS]) names.push(TABS.APPOINTMENTS);
        bump(...names);
    };

    const openDialog = (type, extra = {}) => {
        const token = session.open();
        setDialog({ type, key: baseKey, token, owner: getSessionToken(), ...extra });
    };

    const closeDialog = (focus) => {
        session.close();
        setDialog(null);
        if (focus) pendingFocus.current = { key: baseKey, ...focus };
    };

    const rereadAppointments = async (day) => {
        const result = await getPatientAppointments(id, upcomingQuery(day), READ);
        if (result.success && isHere(baseKey)) setApptRes({ key: apptKey, ok: true, items: itemsOf(result.data) });
        return result;
    };

    const submitWalkIn = async (body) => {
        const token = dialog?.token;
        const owner = getSessionToken();
        const day = clinicToday();
        const shown = patient;
        const alive = () => session.isAlive(token);
        const queueLink = { label: TEXT.QUEUE, url: ROUTES.RECEPTION_QUEUE };
        const fresh = await getPatient(id, READ);
        if (!alive()) return undefined;
        if (!fresh.success) {
            if (isPatientGone(fresh)) {
                closeDialog();
                setPatientRes({ key: patientKey, ok: false, gone: true, result: fresh });
                return { close: true };
            }
            return { alert: `${errorText(fresh)}${TEXT.WALK_IN_NOT_SENT}` };
        }
        if (fresh.data?.phoneNumber !== shown.phoneNumber) {
            closeDialog();
            bump("patient");
            notifyPatientRecord(owner, { text: TEXT.WALK_IN_PHONE_CHANGED }, { error: true });
            return { close: true };
        }
        if (!alive()) return undefined;
        const result = await createWalkIn(body, READ);
        const succeeded = (text, links = [], error = false) => {
            notifyPatientRecord(owner, { text, links }, { error });
            if (!alive()) return { close: true };
            closeDialog({ target: "walkIn" });
            reloadAfterVisit();
            return { close: true };
        };
        const foundAfter = async (onFound, onMissing) => {
            const check = await rereadAppointments(day);
            if (!check.success) return alive() ? { alert: TEXT.WALK_IN_UNKNOWN } : notifyPatientRecord(owner, { text: TEXT.WALK_IN_UNKNOWN }, { error: true });
            const visit = walkInToday(itemsOf(check.data), day);
            return visit ? onFound(visit) : onMissing();
        };
        if (result.success && result.data?.patientId != null) {
            if (Number(result.data.patientId) === Number(id)) return succeeded(TEXT.WALK_IN_DONE(shown.fullName));
            const code = result.data.patientCode ?? String(result.data.patientId);
            if (!alive()) {
                notifyPatientRecord(owner, { text: TEXT.WALK_IN_MISMATCH(code), links: [queueLink] }, { error: true });
                return undefined;
            }
            session.close();
            reloadAfterVisit();
            openDialog("mismatch", { code });
            return { close: true };
        }
        if (result.success || isUncertain(result, { conflictToo: true })) {
            uncertainWalkIns.current.add(token);
            return foundAfter(
                (visit) => {
                    const time = checkInTimeText(visit, day) ?? hhmm(visit.timeSlotStart) ?? "";
                    const text = result.noResponse ? TEXT.WALK_IN_FOUND_NO_RESPONSE(time) : TEXT.WALK_IN_FOUND_SERVER_ERROR(time);
                    return succeeded(text, [queueLink], true);
                },
                () => (alive() ? { alert: TEXT.WALK_IN_NOT_SEEN } : notifyPatientRecord(owner, { text: TEXT.WALK_IN_NOT_SEEN }, { error: true })),
            );
        }
        if (hasMessage(result, BE_MESSAGES.UNFINISHED) && uncertainWalkIns.current.has(token)) {
            return foundAfter(
                () => succeeded(TEXT.WALK_IN_CREATED_BEFORE, [queueLink], true),
                () => {
                    notifyPatientRecord(owner, { text: errorText(result) }, { error: true });
                    if (alive()) closeDialog({ target: "walkIn" });
                    return { close: true };
                },
            );
        }
        if (!alive()) {
            notifyPatientRecord(owner, { text: errorText(result) }, { error: true });
            return undefined;
        }
        return { alert: errorText(result) };
    };

    const onBooked = (appointment) => {
        const owner = getSessionToken();
        const token = dialog?.token;
        notifyPatientRecord(owner, { text: TEXT.BOOKED(hhmm(appointment.timeSlotStart) ?? "", ddmm(appointment.appointmentDate)) });
        if (!session.isAlive(token)) return;
        closeDialog({ target: "book" });
        const names = ["appointments"];
        if (tabRes[TABS.APPOINTMENTS]) names.push(TABS.APPOINTMENTS);
        bump(...names);
    };

    const onPatientGone = () => {
        if (!session.isAlive(dialog?.token)) return;
        closeDialog();
        setReload((n) => n + 1);
    };

    const onPlanResolved = useCallback(() => {
        const current = latest.current.dialog;
        if (current?.type === "plan") pendingFocus.current = { key: current.key, target: planApproveButtonId(current.plan.id), waitTab: true };
        setDialog(null);
        session.close();
        setSeq((s) => ({ ...s, [TABS.PLANS]: s[TABS.PLANS] + 1 }));
    }, [session]);

    const listHref = `${ROUTES.RECEPTION_PATIENTS}${safeListSearch(location.state?.listSearch)}`;
    const crumbs = [{ label: TEXT.TITLE, href: listHref }, { label: patient?.fullName ?? (notFound ? TEXT.NOT_FOUND : TEXT.LOADING) }];
    const backBar = (className) => (
        <div className={className ? `flex items-center gap-3 ${className}` : "flex items-center gap-3"}>
            <BackLink to={listHref} label={TEXT.BACK_LIST_LABEL} />
            <Breadcrumb items={crumbs} className="min-w-0 flex-wrap wrap-anywhere" />
        </div>
    );

    if (notFound) {
        return (
            <div className="app-content min-h-full">
                {backBar("mb-2")}
                <section className="rounded-xl border border-border bg-canvas p-8 text-center">
                    <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                        {TEXT.NOT_FOUND}
                    </h1>
                    <p className="mt-2 text-body-sm text-muted">{TEXT.NOT_FOUND_TEXT}</p>
                    <Link to={listHref} className="btn btn-primary mt-4">
                        {TEXT.BACK_TO_LIST}
                    </Link>
                </section>
            </div>
        );
    }

    const today = clock.today;
    const appointments = apptRes?.key === apptKey ? { status: apptRes.ok ? "ready" : "error", items: apptRes.items } : { status: "loading", items: [] };
    const doctorsReady = doctorRes?.key === doctorKey ? doctorRes : null;
    const doctorList = doctorsReady?.ok ? onDutyDoctors(doctorsReady.shifts, clock.now) : [];
    const doctors = { status: doctorsReady ? (doctorsReady.ok ? "ready" : "error") : "loading", items: doctorList };

    const labels = [];
    if (patient) {
        (patient.medicalProfiles ?? [])
            .filter((m) => m.recordType === "Allergy" && m.status === "Active" && String(m.title ?? "").trim())
            .forEach((m) => labels.push({ key: `allergy-${m.id}`, text: TEXT.LABEL_ALLERGY(m.title), badge: "badge-danger" }));
        if (invoiceRes?.key === invoiceKey) {
            if (!invoiceRes.ok) labels.push({ key: "debt-error", text: TEXT.LABEL_DEBT_ERROR, badge: "badge-neutral", retry: "invoices" });
            else {
                const info = invoiceLabels(invoiceRes.pages);
                if (info.incomplete) labels.push({ key: "debt", text: TEXT.LABEL_DEBT_PARTIAL, badge: "badge-danger" });
                else if (info.debt > 0) labels.push({ key: "debt", text: TEXT.LABEL_DEBT(money(info.debt)), badge: "badge-danger" });
                if (info.pendingCount > 0) labels.push({ key: "pending", text: TEXT.LABEL_PENDING(info.pendingCount), badge: "badge-warning" });
            }
        }
        if (appointments.status === "ready") {
            const next = upcomingAppointment(appointments.items, today, clock.now);
            if (next) labels.push({ key: "upcoming", text: upcomingText(next, today), badge: "badge-info" });
        }
    }

    const walkIn = patient ? { block: walkInBlock({ patient, appointments, doctors, today }), onClick: () => openDialog("walkIn") } : null;
    const book = patient ? { block: bookingBlock({ appointments, today }), onClick: () => openDialog("book") } : null;
    const patientError = patientCurrent && !patientCurrent.ok && !patientCurrent.gone;
    const shownDialog = dialog?.key === baseKey ? dialog : null;

    return (
        <div className="app-content min-h-full space-y-4">
            {backBar()}
            {patientError ? (
                <>
                    <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                        {TEXT.TITLE}
                    </h1>
                    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                        <span className="flex-1">
                            {TEXT.LOAD_ERROR} {errorText(patientCurrent.result)}
                        </span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => bump("patient")}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                </>
            ) : (
                <PatientSummaryCard
                    patient={patient}
                    h1Ref={h1Ref}
                    labels={labels}
                    editLink={{ to: id ? getReceptionPatientEditRoute(id) : listHref, state: nav.linkState() }}
                    walkIn={walkIn}
                    book={book}
                    walkInRef={walkInRef}
                    bookRef={bookRef}
                    onRetry={(source) => bump(source)}
                />
            )}
            {patient && (
                <section>
                    <AppointmentTabs tabs={TAB_LIST} selected={tab} onSelect={selectTab} idPrefix={TAB_PREFIX} />
                    <div role="tabpanel" id={`${TAB_PREFIX}-panel`} aria-labelledby={`${TAB_PREFIX}-tab-${tab}`} tabIndex={0} className="mt-5 outline-none">
                        {tab === TABS.INFO ? (
                            <PatientInfoTab patient={patient} today={today} />
                        ) : !currentTab ? (
                            <Card>
                                <EmptyState text={TEXT.LOADING} />
                            </Card>
                        ) : !currentTab.ok ? (
                            <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                                <span className="flex-1">{TEXT.TAB_ERROR}</span>
                                <button type="button" className="btn btn-secondary h-9" onClick={() => bump(tab)}>
                                    {TEXT.RETRY}
                                </button>
                            </div>
                        ) : tab === TABS.PLANS ? (
                            <PatientPlansTab items={currentTab.items} onApprove={(plan) => openDialog("plan", { plan })} />
                        ) : tab === TABS.APPOINTMENTS ? (
                            <Card>
                                <PatientAppointmentsTab items={currentTab.items} hasMore={currentTab.hasMore} more={more[tab] ?? {}} onMore={loadMore} />
                            </Card>
                        ) : (
                            <Card>
                                <PatientInvoicesTab items={currentTab.items} hasMore={currentTab.hasMore} more={more[tab] ?? {}} onMore={loadMore} />
                            </Card>
                        )}
                    </div>
                    <p role="status" className="sr-only">
                        {tabStatus}
                    </p>
                </section>
            )}
            {patient && shownDialog?.type === "walkIn" && (
                <WalkInDialog
                    doctors={doctorList}
                    doctorsStatus={doctors.status}
                    onRetryDoctors={retryDoctors}
                    patient={patient}
                    onClose={() => closeDialog({ target: "walkIn" })}
                    onSubmit={submitWalkIn}
                />
            )}
            {patient && shownDialog?.type === "book" && (
                <BookingDialog
                    patient={patient}
                    onClose={() => closeDialog({ target: "book" })}
                    onBooked={onBooked}
                    formatError={formatBookingError}
                    onPatientGone={onPatientGone}
                    readConfig={BOOKING_READ}
                    writeConfig={BOOKING_WRITE}
                />
            )}
            {patient && shownDialog?.type === "plan" && (
                <PlanApproveDialog
                    plan={shownDialog.plan}
                    owner={shownDialog.owner}
                    onClose={() => closeDialog({ target: planApproveButtonId(shownDialog.plan.id) })}
                    onResolved={onPlanResolved}
                />
            )}
            {shownDialog?.type === "mismatch" && (
                <WalkInMismatchDialog
                    patientCode={shownDialog.code}
                    onClose={() => closeDialog({ target: "walkIn" })}
                    onOpenQueue={() => {
                        closeDialog();
                        requestNavigate(ROUTES.RECEPTION_QUEUE, nav.linkState());
                    }}
                />
            )}
        </div>
    );
};

export default ReceptionPatientDetail;

import { useState } from "react";
import { CalendarCheck2, CalendarClock, CalendarX2, Clock3, ExternalLink, Inbox, Phone, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import StatusTabs from "@/components/ui/StatusTabs";
import useAsync from "@/hooks/useAsync";
import { CHANGE_REQUEST_STATUS, CHANGE_REQUEST_TYPE, getChangeRequests, resolveChangeRequest } from "@/services/appointmentChangeRequestService";
import { cx } from "@/utils/cx";
import { formatDate, formatDateTime, formatTimeRange, formatWeekday } from "@/utils/format";
import { phoneText } from "@/components/reception/receptionUtils";
import { RECEPTION_PATIENT_TABS, getReceptionPatientRoute } from "@/utils/routes";

const TITLE_ID = "reception-change-requests-title";
const TAB = { OPEN: "open", DONE: "done" };

const OUTCOMES = {
    [CHANGE_REQUEST_STATUS.RESCHEDULED]: { label: "Đã đổi lịch", badge: "badge-success", icon: CalendarCheck2, button: "btn-primary", placeholder: "Ví dụ: đã đổi sang 07/12, 09:00" },
    [CHANGE_REQUEST_STATUS.CANCELLED]: { label: "Đã huỷ lịch", badge: "badge-danger", icon: CalendarX2, button: "btn-danger", placeholder: "Ví dụ: bệnh nhân đi xa 2 tuần, hẹn gọi lại" },
    [CHANGE_REQUEST_STATUS.KEPT]: { label: "Giữ lịch", badge: "badge-neutral", icon: RotateCcw, button: "btn-secondary", placeholder: "Ví dụ: đã gọi, bệnh nhân vẫn đến được" },
};
const DONE_LABELS = { ...OUTCOMES, [CHANGE_REQUEST_STATUS.WITHDRAWN]: { label: "Bệnh nhân rút yêu cầu", badge: "badge-neutral" } };

const initials = (name) =>
    (name ?? "")
        .trim()
        .split(/\s+/)
        .slice(-2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

const visitWhat = (request) => {
    if (request.stageNumber && request.totalStages) return `Buổi điều trị ${request.stageNumber}/${request.totalStages}${request.planName ? ` · ${request.planName}` : ""}`;
    return request.isFollowUp ? "Tái khám bác sĩ hẹn" : "Lịch lễ tân đặt";
};

const ResolveDialog = ({ request, outcome, onClose, onDone }) => {
    const meta = OUTCOMES[outcome];
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        const response = await resolveChangeRequest(request.id, { outcome, note });
        setBusy(false);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        toast.success(response.message);
        onDone();
    };
    return (
        <Modal title={meta.label} description={`${request.patientName} · ${request.visitTitle}`} onClose={onClose} closeDisabled={busy}>
            <form noValidate onSubmit={submit} className="mt-5 flex flex-col gap-4">
                {outcome === CHANGE_REQUEST_STATUS.RESCHEDULED && (
                    <p className="rounded-md bg-primary-softer px-3 py-2.5 text-body-sm text-ink">
                        Đổi giờ ở <strong>hồ sơ bệnh nhân → Lịch hẹn</strong> trước (hoặc đặt buổi điều trị), rồi ghi lại ở đây để bệnh nhân nhận thông báo.
                    </p>
                )}
                <div className="field">
                    <label htmlFor="resolve-note" className="label">
                        Ghi chú cho bệnh nhân <span className="font-normal text-muted">(không bắt buộc)</span>
                    </label>
                    <textarea id="resolve-note" rows={3} maxLength={500} className="input h-auto min-h-20 py-2" placeholder={meta.placeholder} value={note} onChange={(event) => setNote(event.target.value)} />
                </div>
                <div className="modal-actions -mx-6 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>
                        Đóng
                    </button>
                    <button type="submit" className={cx("btn", meta.button === "btn-secondary" ? "btn-primary" : meta.button)} disabled={busy}>
                        {busy && <span className="btn-spinner" aria-hidden="true" />}
                        Xác nhận: {meta.label.toLowerCase()}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

const RequestCard = ({ request, onResolve }) => {
    const cancel = request.type === CHANGE_REQUEST_TYPE.CANCEL;
    const done = request.status !== CHANGE_REQUEST_STATUS.PENDING;
    const result = DONE_LABELS[request.status];
    const time = formatTimeRange(request.timeSlotStart, request.timeSlotEnd);

    return (
        <li className={cx("overflow-hidden rounded-xl border bg-canvas", done ? "border-border" : cancel ? "border-danger-solid/40" : "border-primary/40")}>
            <div className={cx("h-1", done ? "bg-border" : cancel ? "bg-danger-solid" : "bg-primary")} aria-hidden="true" />
            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-start">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-softer font-semibold text-primary">{initials(request.patientName)}</span>
                    <div className="min-w-0">
                        <Link to={getReceptionPatientRoute(request.patientId, RECEPTION_PATIENT_TABS.APPOINTMENTS)} className="font-semibold text-ink hover:text-primary">
                            {request.patientName}
                        </Link>
                        <p className="num text-caption text-muted">{request.patientCode}</p>
                        {request.patientPhoneNumber && (
                            <a href={`tel:${request.patientPhoneNumber}`} className="num inline-flex items-center gap-1 text-caption font-semibold text-primary">
                                <Phone className="size-3.5" aria-hidden="true" />
                                {phoneText(request.patientPhoneNumber)}
                            </a>
                        )}
                    </div>
                </div>

                <div className="min-w-0">
                    <p className="text-caption font-semibold text-muted">Lần đến</p>
                    <p className="font-semibold text-ink">{request.visitTitle}</p>
                    <p className="num flex items-center gap-1 text-body-sm text-body">
                        <Clock3 className="size-3.5 text-muted" aria-hidden="true" />
                        {request.visitDate ? `${formatWeekday(request.visitDate)} ${formatDate(request.visitDate)}` : "Chưa có ngày"}
                        {time ? ` · ${time}` : " · chưa chốt giờ"}
                    </p>
                    <p className="text-caption text-muted">{[visitWhat(request), request.doctorName].filter(Boolean).join(" · ")}</p>
                </div>

                <div className="min-w-0">
                    <span className={cx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption font-bold", cancel ? "bg-danger-soft text-danger" : "bg-primary-softer text-primary")}>
                        {cancel ? <CalendarX2 className="size-3.5" aria-hidden="true" /> : <CalendarClock className="size-3.5" aria-hidden="true" />}
                        {cancel ? "XIN HUỶ" : "XIN ĐỔI LỊCH"}
                    </span>
                    <p className="mt-1 text-body-sm text-ink">
                        <span className="text-muted">Lý do:</span> {request.reason}
                    </p>
                    {request.preferredTimes?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                            {request.preferredTimes.map((time) => (
                                <span key={time} className="rounded-full bg-warning-soft px-2.5 py-0.5 text-caption font-semibold text-warning">
                                    {time}
                                </span>
                            ))}
                        </div>
                    )}
                    {request.note && <p className="mt-1 text-caption text-body">“{request.note}”</p>}
                    <p className="mt-1 text-caption text-muted">Gửi lúc {formatDateTime(request.createdAt)}</p>
                </div>

                <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
                    {done ? (
                        <div className="flex flex-col gap-1">
                            <span className={cx("badge", result?.badge ?? "badge-neutral")}>{result?.label ?? request.status}</span>
                            {request.handlerNote && <p className="text-caption text-body">{request.handlerNote}</p>}
                            {request.handledAt && <p className="text-caption text-muted">{formatDateTime(request.handledAt)}</p>}
                        </div>
                    ) : (
                        <>
                            {[cancel ? CHANGE_REQUEST_STATUS.CANCELLED : CHANGE_REQUEST_STATUS.RESCHEDULED, cancel ? CHANGE_REQUEST_STATUS.RESCHEDULED : null, CHANGE_REQUEST_STATUS.KEPT]
                                .filter(Boolean)
                                .map((outcome, index) => {
                                    const meta = OUTCOMES[outcome];
                                    const Icon = meta.icon;
                                    return (
                                        <button key={outcome} type="button" className={cx("btn justify-center", index === 0 ? meta.button : "btn-secondary")} onClick={() => onResolve(request, outcome)}>
                                            <Icon className="size-4" aria-hidden="true" />
                                            {meta.label}
                                        </button>
                                    );
                                })}
                            <Link to={getReceptionPatientRoute(request.patientId, RECEPTION_PATIENT_TABS.APPOINTMENTS)} className="btn btn-link justify-center">
                                <ExternalLink className="size-4" aria-hidden="true" />
                                Mở lịch hẹn
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </li>
    );
};

// "Yêu cầu đổi / huỷ lịch": patients ask to move or cancel a visit the clinic arranged (a treatment session, a
// follow-up). The desk calls back, changes the visit with its usual tools, then records what it did here.
const ReceptionChangeRequests = () => {
    const [version, setVersion] = useState(0);
    const [tab, setTab] = useState(TAB.OPEN);
    const [resolving, setResolving] = useState(null);
    const state = useAsync(() => getChangeRequests(), [version]);
    const status = state.loading ? "loading" : state.error || !state.value?.success ? "failed" : "ready";
    const all = status === "ready" ? state.value.data : [];
    const open = all.filter((request) => request.status === CHANGE_REQUEST_STATUS.PENDING).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const done = all.filter((request) => request.status !== CHANGE_REQUEST_STATUS.PENDING);
    const rows = tab === TAB.OPEN ? open : done;
    const reload = () => setVersion((current) => current + 1);

    return (
        <>
            <PageHeader id={TITLE_ID} title="Yêu cầu đổi / huỷ lịch" description="Bệnh nhân xin đổi hoặc huỷ buổi điều trị, lịch tái khám do phòng khám sắp xếp. Gọi lại cho bệnh nhân rồi ghi nhận kết quả." />
            <PageLoadState status={status} onRetry={reload} />
            {status === "ready" && (
                <div className="flex flex-col gap-4">
                    <StatusTabs
                        label="Trạng thái yêu cầu"
                        allLabel={`Chờ xử lý`}
                        options={[{ value: TAB.DONE, label: "Đã xử lý" }]}
                        value={tab === TAB.OPEN ? "" : TAB.DONE}
                        onChange={(value) => setTab(value ? TAB.DONE : TAB.OPEN)}
                        counts={{ "": open.length, [TAB.DONE]: done.length }}
                    />
                    {rows.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-canvas px-6 py-14 text-center">
                            <span className="grid size-12 place-items-center rounded-full bg-surface-tint text-muted">
                                <Inbox className="size-6" aria-hidden="true" />
                            </span>
                            <p className="font-semibold text-ink">{tab === TAB.OPEN ? "Không có yêu cầu nào đang chờ" : "Chưa có yêu cầu nào được xử lý"}</p>
                            <p className="text-body-sm text-muted">Khi bệnh nhân bấm &quot;Xin đổi / huỷ&quot;, yêu cầu sẽ hiện ở đây.</p>
                        </div>
                    ) : (
                        <ul aria-labelledby={TITLE_ID} className="flex flex-col gap-3">
                            {rows.map((request) => (
                                <RequestCard key={request.id} request={request} onResolve={(item, outcome) => setResolving({ request: item, outcome })} />
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {resolving && (
                <ResolveDialog
                    request={resolving.request}
                    outcome={resolving.outcome}
                    onClose={() => setResolving(null)}
                    onDone={() => {
                        setResolving(null);
                        reload();
                    }}
                />
            )}
        </>
    );
};

export default ReceptionChangeRequests;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import ConfirmActionDialog from "@/components/billing/ConfirmActionDialog";
import StepActionBar from "@/components/examination/StepActionBar";
import ImagingResultCard from "@/components/imagingReview/ImagingResultCard";
import CancelledOrderAlert from "@/components/imagingTechnician/CancelledOrderAlert";
import CapturePanel from "@/components/imagingTechnician/CapturePanel";
import ImagingOrderCard from "@/components/imagingTechnician/ImagingOrderCard";
import ImagingPatientCard from "@/components/imagingTechnician/ImagingPatientCard";
import ImagingQueuePanel from "@/components/imagingTechnician/ImagingQueuePanel";
import ManualUploadDialog from "@/components/imagingTechnician/ManualUploadDialog";
import Modal from "@/components/ui/Modal";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import {
    cancelCapture,
    completeImagingRequest,
    getCapture,
    getImagingQueue,
    startCapture,
    uploadManualImages,
} from "@/services/imagingTechnicianService";
import { CAPTURE_STATES, IMAGING_REQUEST_STATUSES, devicesForImagingType, imagingTypeLabel } from "@/utils/imagingRequest";

const REFRESH_MS = 20_000;
const POLL_MS = 1_000;
const CANCELLED_MESSAGE = "Bác sĩ đã huỷ chỉ định này.";

// Exposure filled in for the order type (the technician can change it).
const EXPOSURE = {
    "Periapical X-ray": { kv: 70, ma: 7, seconds: 0.2 },
    Panoramic: { kv: 70, ma: 10, seconds: 14 },
};

// The queue API returns one row per order: group them by patient, the patient being imaged first, then by order time.
// Only one patient is being imaged (activeId): the one called in, or after a reload the first one the backend has
// InProgress, unless the technician sent that patient back to the queue (released).
const groupQueue = (rows, calledId, released) => {
    const groups = new Map();
    for (const row of rows) {
        const key = String(row.patientId || `order-${row.id}`);
        if (!groups.has(key)) groups.set(key, { id: key, patientId: row.patientId, patientName: row.patientName, doctorName: row.doctorName, createdAt: row.createdAt, orders: [] });
        groups.get(key).orders.push({
            id: row.id,
            imagingType: row.imagingType,
            targetArea: row.targetArea,
            clinicalIndication: row.clinicalIndication,
            doctorName: row.doctorName,
            createdAt: row.createdAt,
            requestStatus: row.requestStatus,
        });
    }
    const byTime = [...groups.values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const activeId =
        calledId ??
        byTime.find((group) => !released.has(group.id) && group.orders.some((order) => order.requestStatus === IMAGING_REQUEST_STATUSES.IN_PROGRESS))?.id ??
        null;
    const items = byTime
        .map((group) => ({ ...group, status: group.id === activeId ? IMAGING_REQUEST_STATUSES.IN_PROGRESS : IMAGING_REQUEST_STATUSES.PENDING }))
        .sort((a, b) => Number(b.id === activeId) - Number(a.id === activeId));
    return { items, activeId };
};

const initialCapture = (order) => {
    const devices = devicesForImagingType(order.imagingType);
    return {
        state: devices.length ? CAPTURE_STATES.READY : CAPTURE_STATES.UNSUPPORTED,
        setup: { deviceId: devices[0]?.id ?? "", imageCount: 1, ...(EXPOSURE[order.imagingType] ?? {}) },
        session: {},
        images: [],
        message: null,
    };
};

const ImagingCapturePage = () => {
    usePageTitle("Chụp chiếu – OZE");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    // The patient the technician called into the room (the backend has no "start imaging" step yet).
    const [calledId, setCalledId] = useState(null);
    // Patients sent back to the queue ("Trả về hàng chờ"): their InProgress orders no longer make them the one being imaged.
    const [released, setReleased] = useState(() => new Set());
    // Capture block per order id: { state, setup, session, images, message }.
    const [captures, setCaptures] = useState({});
    // Orders the doctor cancelled while open here (found when "Hoàn thành" is refused).
    const [cancelled, setCancelled] = useState({});
    const [dialog, setDialog] = useState(null);
    const [busy, setBusy] = useState(false);

    // Bumped to reload the queue at once (after "Hoàn thành"); otherwise it refreshes every REFRESH_MS.
    const [version, setVersion] = useState(0);
    // Orders with a capture running or done, read by the queue refresh
    const heldIds = useRef(new Set());
    useEffect(() => {
        heldIds.current = new Set(
            Object.entries(captures)
                .filter(([, item]) => item.state === CAPTURE_STATES.CAPTURING || item.state === CAPTURE_STATES.COMPLETED)
                .map(([id]) => Number(id)),
        );
    }, [captures]);

    useEffect(() => {
        let active = true;
        const load = () =>
            getImagingQueue().then((response) => {
                if (!active) return;
                setLoading(false);
                if (response.success) {
                    // An order whose capture is running or done stays on screen until "Hoàn thành", even though
                    // the backend completes it (and drops it from the queue) as soon as the device returns the pictures.
                    setRows((current) => {
                        const held = current.filter((row) => heldIds.current.has(row.id) && !response.data.some((item) => item.id === row.id));
                        return [...response.data, ...held];
                    });
                    setLoadError(null);
                } else {
                    setLoadError(response.message || "Không tải được hàng chờ chụp.");
                }
            });
        load();
        const timer = setInterval(load, REFRESH_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [version]);

    const { items, activeId } = useMemo(() => groupQueue(rows, calledId, released), [rows, calledId, released]);
    const patient = items.find((item) => item.id === selectedPatientId) ?? items[0] ?? null;
    const order = patient?.orders.find((item) => item.id === selectedOrderId) ?? patient?.orders[0] ?? null;
    const called = Boolean(patient && patient.id === activeId);
    // Another patient is being imaged: this one can be looked at but not called in.
    const lockedBy = patient && activeId && !called ? items.find((item) => item.id === activeId) : null;
    const capture = order ? (captures[order.id] ?? initialCapture(order)) : null;
    const patientCapturing = Boolean(patient?.orders.some((item) => captures[item.id]?.state === CAPTURE_STATES.CAPTURING));
    const cancelledOrder = order ? cancelled[order.id] : null;

    const updateCapture = useCallback((target, changes) => {
        setCaptures((current) => {
            const base = current[target.id] ?? initialCapture(target);
            return { ...current, [target.id]: { ...base, ...changes } };
        });
    }, []);

    // While the device works, ask for the session every second (the page has no push from the backend yet).
    const capturing = Object.entries(captures).filter(([, item]) => item.state === CAPTURE_STATES.CAPTURING);
    const capturingKey = capturing.map(([id, item]) => `${id}:${item.session.id}`).join(",");
    useEffect(() => {
        if (!capturingKey) return undefined;
        const timer = setInterval(async () => {
            for (const [id, item] of capturing) {
                const response = await getCapture(Number(id), item.session.id);
                setCaptures((current) => {
                    const now = current[id];
                    if (!now || now.state !== CAPTURE_STATES.CAPTURING || now.session.id !== item.session.id) return current;
                    if (!response.success) return { ...current, [id]: { ...now, state: CAPTURE_STATES.FAILED, message: response.message } };
                    const data = response.data;
                    if (data.state === "completed")
                        return { ...current, [id]: { ...now, state: CAPTURE_STATES.COMPLETED, images: data.images, session: { ...now.session, finishedAt: data.finishedAt } } };
                    if (data.state === "cancelled") return { ...current, [id]: { ...now, state: CAPTURE_STATES.READY, session: {} } };
                    return current;
                });
            }
        }, POLL_MS);
        return () => clearInterval(timer);
        // capturing is rebuilt each render; capturingKey names what it holds.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [capturingKey]);

    const selectPatient = (id) => {
        setSelectedPatientId(id);
        setSelectedOrderId(null);
    };

    const withoutReleased = (id) =>
        setReleased((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
        });

    const callIn = () => {
        if (lockedBy) return;
        withoutReleased(patient.id);
        setCalledId(patient.id);
        setSelectedPatientId(patient.id);
    };

    // The patient leaves the room for now (called by mistake, not ready, device down…); pictures taken so far stay here.
    const sendBack = () => {
        if (patientCapturing) return;
        setReleased((current) => new Set(current).add(patient.id));
        setCalledId(null);
    };

    const start = async () => {
        setBusy(true);
        const response = await startCapture(order.id, capture.setup);
        setBusy(false);
        if (!response.success) {
            updateCapture(order, { state: CAPTURE_STATES.UNAVAILABLE, message: response.message });
            return;
        }
        updateCapture(order, { state: CAPTURE_STATES.CAPTURING, session: response.data, images: [], message: null });
    };

    const stop = async () => {
        setBusy(true);
        const response = await cancelCapture(order.id, capture.session.id);
        setBusy(false);
        if (response.success) updateCapture(order, { state: CAPTURE_STATES.READY, session: {} });
        else toast.error(response.message);
    };

    // Drops the order from the list: the next refresh would anyway, once it is completed or cancelled.
    const leaveOrder = (target, owner) => {
        setRows((current) => current.filter((row) => row.id !== target.id));
        setCaptures((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== String(target.id))));
        const remaining = owner.orders.filter((item) => item.id !== target.id);
        if (remaining.length) {
            setSelectedOrderId(remaining[0].id);
        } else {
            if (calledId === owner.id) setCalledId(null);
            withoutReleased(owner.id);
            setSelectedPatientId(null);
            setSelectedOrderId(null);
        }
    };

    const complete = async () => {
        const target = order;
        const owner = patient;
        const response = await completeImagingRequest(target.id);
        setDialog(null);
        if (response.success) {
            toast.success(`Đã gửi kết quả IR-${target.id} cho ${target.doctorName || "bác sĩ"}.`);
            leaveOrder(target, owner);
            setVersion((v) => v + 1);
            return;
        }
        if (response.message === CANCELLED_MESSAGE) {
            setCancelled((current) => ({ ...current, [target.id]: { id: target.id, doctorName: target.doctorName } }));
            return;
        }
        toast.error(response.message || "Không hoàn thành được chỉ định.");
    };

    const upload = async (payload) => {
        const response = await uploadManualImages(order.id, payload);
        if (!response.success) {
            toast.error(response.message);
            return;
        }
        updateCapture(order, {
            state: CAPTURE_STATES.COMPLETED,
            images: [...capture.images, ...response.data],
            session: { ...capture.session, deviceId: null, finishedAt: new Date().toISOString() },
            message: null,
        });
        toast.success(response.message);
        setDialog(null);
    };

    const subtitle = order ? `IR-${order.id} · ${patient.patientName}` : "";
    const imageCount = capture?.images.length ?? 0;
    // Other orders of this patient still to be imaged after this one
    const remainingOrders = patient ? patient.orders.length - 1 : 0;
    // Pictures from the device: the backend already completed the order and told the doctor when they arrived.
    // Pictures uploaded by hand (deviceId null) only reach the doctor once "Hoàn thành" is pressed.
    const sentByDevice = capture?.state === CAPTURE_STATES.COMPLETED && Boolean(capture.session.deviceId);
    const status = lockedBy
        ? `Đang chụp cho ${lockedBy.patientName}. Hoàn thành hoặc trả về hàng chờ trước.`
        : !called
          ? "Bấm Gọi vào chụp khi bệnh nhân sẵn sàng."
          : capture.state === CAPTURE_STATES.CAPTURING
            ? "Đang chờ máy trả ảnh…"
            : sentByDevice
              ? "Ảnh đã gửi cho bác sĩ. Kiểm tra ảnh rồi bấm Hoàn thành để đóng chỉ định."
              : imageCount
                ? `Đã có ${imageCount} ảnh.`
                : "Chưa có ảnh. Chụp hoặc tải ảnh thủ công để hoàn thành.";

    return (
        <div className="flex flex-col gap-5">
            <h1 className="sr-only">Chụp chiếu</h1>
            {loadError && (
                <p role="alert" className="alert alert-danger">
                    {loadError}
                </p>
            )}
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                <ImagingQueuePanel items={items} orderCount={rows.length} selectedId={patient?.id} onSelect={selectPatient} loading={loading} />

                {patient && order ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                        {cancelledOrder && <CancelledOrderAlert order={cancelledOrder} onNext={() => leaveOrder(order, patient)} />}
                        <ImagingPatientCard patient={{ name: patient.patientName }} />
                        <ImagingOrderCard orders={patient.orders} selectedId={order.id} onSelect={setSelectedOrderId} />
                        {called && !cancelledOrder && (
                            <CapturePanel
                                state={capture.state}
                                imagingType={order.imagingType}
                                setup={capture.setup}
                                onSetupChange={(changes) => updateCapture(order, { setup: { ...capture.setup, ...changes } })}
                                session={capture.session}
                                images={capture.images}
                                message={capture.message}
                                busy={busy}
                                onStart={start}
                                onCancel={stop}
                                onRetry={start}
                                onManualUpload={() => setDialog("upload")}
                                onOpenImage={() => setDialog("viewer")}
                            />
                        )}
                        {!cancelledOrder && (
                            <StepActionBar status={status}>
                                {called ? (
                                    <>
                                        <button type="button" className="btn btn-secondary" disabled={patientCapturing} onClick={sendBack}>
                                            Trả về hàng chờ
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            disabled={capture.state === CAPTURE_STATES.CAPTURING}
                                            onClick={() => setDialog("upload")}
                                        >
                                            Tải ảnh thủ công
                                        </button>
                                        {/* TODO(api): only checked here; POST imaging-requests/{id}/complete still accepts an order without pictures */}
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            disabled={capture.state === CAPTURE_STATES.CAPTURING || imageCount === 0}
                                            onClick={() => setDialog("complete")}
                                        >
                                            Hoàn thành
                                        </button>
                                    </>
                                ) : (
                                    <button type="button" className="btn btn-primary" disabled={Boolean(lockedBy)} onClick={callIn}>
                                        Gọi vào chụp
                                    </button>
                                )}
                            </StepActionBar>
                        )}
                    </div>
                ) : (
                    !loading && (
                        <div className="card-app flex min-w-0 flex-1 flex-col items-center py-16 text-center">
                            <p className="text-title text-ink">Chưa có chỉ định chụp</p>
                            <p className="mt-1 text-body-sm text-muted">Khi bác sĩ gửi chỉ định, bệnh nhân sẽ hiện ở hàng chờ bên trái.</p>
                        </div>
                    )
                )}
            </div>

            {dialog === "complete" && order && (
                <ConfirmActionDialog
                    title="Xác nhận hoàn thành chụp"
                    description={subtitle}
                    body={[
                        "Gửi ",
                        `${imageCount} ảnh`,
                        " cho ",
                        order.doctorName || "bác sĩ chỉ định",
                        remainingOrders > 0 ? ". Bệnh nhân còn " : ". Bệnh nhân sẽ được đưa lên đầu hàng chờ khám.",
                        ...(remainingOrders > 0 ? [`${remainingOrders} chỉ định chụp`, "."] : []),
                    ]}
                    closeLabel="Huỷ"
                    submitLabel="Xác nhận hoàn thành"
                    onClose={() => setDialog(null)}
                    onSubmit={complete}
                />
            )}
            {dialog === "upload" && order && (
                <ManualUploadDialog subtitle={`${subtitle} · ${imagingTypeLabel(order.imagingType)}`} onClose={() => setDialog(null)} onSubmit={upload} />
            )}
            {dialog === "viewer" && order && (
                <Modal title="Xem ảnh" description={subtitle} size="lg" onClose={() => setDialog(null)}>
                    <div className="mt-5">
                        <ImagingResultCard
                            title={`${imagingTypeLabel(order.imagingType)} · IR-${order.id}`}
                            subtitle={`${imageCount} ảnh · KTV chỉ xem, không chẩn đoán`}
                            typeLabel={imagingTypeLabel(order.imagingType)}
                            images={capture.images}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ImagingCapturePage;

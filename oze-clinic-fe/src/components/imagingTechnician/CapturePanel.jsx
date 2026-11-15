import { useId } from "react";
import { Image as ImageIcon } from "lucide-react";
import FormField from "@/components/ui/FormField";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatClock } from "@/utils/format";
import { CAPTURE_DEVICES, CAPTURE_IMAGE_COUNT_MAX, CAPTURE_STATES, CAPTURE_STATE_LABELS, devicesForImagingType, imagingTypeLabel } from "@/utils/imagingRequest";

const deviceText = (deviceId) => {
    const device = CAPTURE_DEVICES.find((item) => item.id === deviceId);
    return [deviceId, device?.name].filter(Boolean).join(" · ");
};

// Settings before the shot: device that takes this order type, number of images, exposure.
// setup: { deviceId, imageCount, kv, ma, seconds }; onSetupChange receives the changed fields.
const SetupForm = ({ imagingType, setup, onSetupChange, onStart, busy }) => {
    const id = useId();
    const devices = devicesForImagingType(imagingType);
    const number = (key) => (event) => onSetupChange({ [key]: event.target.value });

    return (
        <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                if (!busy) onStart();
            }}
        >
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <FormField id={`${id}-device`} label="Máy chụp">
                    <select id={`${id}-device`} className="input" value={setup.deviceId ?? ""} onChange={(event) => onSetupChange({ deviceId: event.target.value })}>
                        {devices.map((device) => (
                            <option key={device.id} value={device.id}>
                                {deviceText(device.id)}
                            </option>
                        ))}
                    </select>
                </FormField>
                <FormField id={`${id}-count`} label="Số ảnh">
                    <input id={`${id}-count`} type="number" min={1} max={CAPTURE_IMAGE_COUNT_MAX} className="input num" value={setup.imageCount ?? 1} onChange={number("imageCount")} />
                </FormField>
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <FormField id={`${id}-kv`} label="Điện áp (kV)">
                    <input id={`${id}-kv`} type="number" step="any" className="input num" value={setup.kv ?? ""} onChange={number("kv")} />
                </FormField>
                <FormField id={`${id}-ma`} label="Dòng (mA)">
                    <input id={`${id}-ma`} type="number" step="any" className="input num" value={setup.ma ?? ""} onChange={number("ma")} />
                </FormField>
                <FormField id={`${id}-sec`} label="Thời gian phát tia (s)">
                    <input id={`${id}-sec`} type="number" step="any" className="input num" value={setup.seconds ?? ""} onChange={number("seconds")} />
                </FormField>
                <button type="submit" className="btn btn-primary" disabled={busy || !setup.deviceId}>
                    {busy && <span className="btn-spinner" aria-hidden />}
                    Bắt đầu chụp
                </button>
            </div>
            <p className="text-caption text-muted">Thông số điền sẵn theo loại chụp “{imagingTypeLabel(imagingType)}”. Máy chỉ nhận lệnh khi đang Sẵn sàng.</p>
        </form>
    );
};

// Images returned by the device; a click opens the viewer (onOpenImage(index)). images: [{ id, url?, takenAt? }].
const Thumbnails = ({ images, onOpenImage }) => (
    <ul className="flex flex-wrap gap-3">
        {images.map((image, index) => {
            const caption = [`Ảnh ${index + 1}`, image.takenAt && formatClock(image.takenAt)].filter(Boolean).join(" · ");
            return (
                <li key={image.id}>
                    <button
                        type="button"
                        className="relative grid h-26 w-40 cursor-zoom-in place-items-center overflow-hidden rounded-md bg-surface-navy outline-none focus-visible:shadow-focus"
                        aria-label={`Phóng to ${caption}`}
                        onClick={() => onOpenImage?.(index)}
                    >
                        {image.url ? (
                            <img src={image.url} alt="" className="size-full object-cover" />
                        ) : (
                            <ImageIcon className="size-6 text-on-navy/60" aria-hidden="true" />
                        )}
                        <span className="num absolute bottom-1.5 left-2 text-caption text-on-navy">{caption}</span>
                    </button>
                </li>
            );
        })}
    </ul>
);

const ManualUploadButton = ({ onManualUpload }) =>
    onManualUpload && (
        <button type="button" className="btn btn-secondary" onClick={onManualUpload}>
            Tải ảnh thủ công
        </button>
    );

// "Máy chụp" block of the capture screen, one look per CAPTURE_STATES value:
// ready (SetupForm) → capturing (wait, Huỷ chụp) → completed (thumbnails) or failed (Chụp lại / Tải ảnh thủ công);
// unsupported: the order type has no device (CBCT, Cephalometric…); unavailable: the device is off or busy.
// session: { deviceId, imageCount, sentAt, finishedAt }; message: the device error or reason.
const CapturePanel = ({
    state,
    imagingType,
    setup = {},
    onSetupChange,
    session = {},
    images = [],
    message,
    busy = false,
    onStart,
    onCancel,
    onRetry,
    onManualUpload,
    onOpenImage,
}) => {
    const device = deviceText(session.deviceId ?? setup.deviceId);

    return (
        <section aria-label="Máy chụp" className="card-app p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <h3 className="font-heading text-body-md font-semibold text-ink">Máy chụp</h3>
                <StatusBadge status={state} labels={CAPTURE_STATE_LABELS} />
            </div>
            <div className="flex flex-col gap-4 px-5 py-4" aria-live="polite">
                {state === CAPTURE_STATES.READY && <SetupForm imagingType={imagingType} setup={setup} onSetupChange={onSetupChange} onStart={onStart} busy={busy} />}

                {state === CAPTURE_STATES.CAPTURING && (
                    <>
                        <p className="num text-caption text-muted">
                            {[device, session.imageCount && `${session.imageCount} ảnh`, session.sentAt && `gửi lệnh lúc ${formatClock(session.sentAt)}`].filter(Boolean).join(" · ")}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="min-w-0 flex-1">Đang chờ máy trả ảnh. Ảnh sẽ tự hiện ở đây khi máy chụp xong.</p>
                            {onCancel && (
                                <button type="button" className="btn btn-secondary text-danger hover:text-danger" disabled={busy} onClick={onCancel}>
                                    Huỷ chụp
                                </button>
                            )}
                        </div>
                    </>
                )}

                {state === CAPTURE_STATES.COMPLETED && (
                    <>
                        <div className="alert alert-success">
                            <div>
                                <p className="font-semibold">
                                    Máy đã trả về {images.length} ảnh{session.finishedAt && ` lúc ${formatClock(session.finishedAt)}`}
                                </p>
                                <p className="text-body">{device} · bấm vào ảnh để phóng to.</p>
                            </div>
                        </div>
                        <Thumbnails images={images} onOpenImage={onOpenImage} />
                        <p className="text-caption text-muted">Kiểm tra ảnh rồi bấm Hoàn thành để gửi kết quả cho bác sĩ.</p>
                    </>
                )}

                {state === CAPTURE_STATES.FAILED && (
                    <>
                        <div className="alert alert-danger">
                            <div>
                                <p className="font-semibold">Chưa nhận được ảnh từ máy</p>
                                <p className="text-body">{message || "Máy báo lỗi hoặc mất kết nối."} Chụp lại, hoặc chụp trực tiếp trên máy rồi tải ảnh thủ công.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="num min-w-0 flex-1 text-caption text-muted">{device}</p>
                            <ManualUploadButton onManualUpload={onManualUpload} />
                            {onRetry && (
                                <button type="button" className="btn btn-primary" disabled={busy} onClick={onRetry}>
                                    Chụp lại
                                </button>
                            )}
                        </div>
                    </>
                )}

                {state === CAPTURE_STATES.UNSUPPORTED && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="min-w-0 flex-1">
                            Chưa có máy kết nối cho loại chụp “{imagingTypeLabel(imagingType)}”. Chụp trên máy riêng rồi tải ảnh thủ công.
                        </p>
                        <ManualUploadButton onManualUpload={onManualUpload} />
                    </div>
                )}

                {state === CAPTURE_STATES.UNAVAILABLE && (
                    <>
                        <div className="alert alert-warning">
                            <div>
                                <p className="font-semibold">Máy {session.deviceId ?? setup.deviceId ?? ""} chưa sẵn sàng</p>
                                <p className="text-body">{message || "Máy đang tắt, đang khởi động hoặc đang chụp cho bệnh nhân khác."}</p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <ManualUploadButton onManualUpload={onManualUpload} />
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default CapturePanel;

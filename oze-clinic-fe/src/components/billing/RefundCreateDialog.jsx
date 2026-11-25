import { useEffect, useRef, useState } from "react";
import { Inbox, Info, Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PatientPicker from "./PatientPicker";
import { getPatientRefundableInvoices, requestRefund } from "@/services/receptionService";
import { refundCreateErrorCode } from "@/services/refundRequestService";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { BILLING_TEXT, REFUND_REQUEST_TEXT } from "@/utils/messages";
import { REFUND_REASON_MAX, classifySubmitError, invoiceOptionLabel, normalizeInvoiceList, validateRefundForm } from "@/utils/refundRequest";

const PATIENT_ID = "rr-patient";
const PATIENT_HELP_ID = "rr-patient-help";
const INVOICE_ID = "rr-invoice";
const INVOICE_HELP_ID = "rr-invoice-help";
const PICKED_ID = "rr-invoice-picked";
const REASON_ID = "rr-reason";
const REASON_HELP_ID = "rr-reason-help";
const UNSUPPORTED = [403, 404];

const FormAlert = ({ text }) =>
    text ? (
        <div className="alert alert-danger" role="alert">
            <div>{text}</div>
        </div>
    ) : null;

const RefundCreateDialog = ({ onClose, onCreated, onUncertain }) => {
    const sendingRef = useRef(false);
    const [patient, setPatient] = useState(null);
    const [seq, setSeq] = useState(0);
    const [loaded, setLoaded] = useState(null);
    const [form, setForm] = useState({ invoiceId: "", reason: "" });
    const [errors, setErrors] = useState({});
    const [sending, setSending] = useState(false);

    const loadKey = patient ? `${patient.id}|${seq}` : null;

    useEffect(() => {
        if (!patient) return undefined;
        const controller = new AbortController();
        getPatientRefundableInvoices(patient.id, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            const invoices = response.success ? normalizeInvoiceList(response.data) : null;
            if (invoices) setLoaded({ key: loadKey, status: "ready", invoices });
            else setLoaded({ key: loadKey, status: UNSUPPORTED.includes(response.status) ? "unsupported" : "error", invoices: [] });
        });
        return () => controller.abort();
    }, [patient, loadKey]);

    const inv = patient ? (loaded?.key === loadKey ? loaded : { status: "loading", invoices: [] }) : { status: "idle", invoices: [] };
    const selected = inv.invoices.find((invoice) => invoice.invoiceId === Number(form.invoiceId)) ?? null;

    const clearError = (...keys) => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key))));

    const choosePatient = (next) => {
        setPatient(next);
        setForm((current) => ({ ...current, invoiceId: "" }));
        clearError("patient", "invoiceId", "form");
    };

    const reloadInvoices = () => {
        setForm((current) => ({ ...current, invoiceId: "" }));
        setSeq((n) => n + 1);
    };

    const submit = async (event) => {
        event.preventDefault();
        if (sendingRef.current) return;
        if (!patient) {
            setErrors({ patient: BILLING_TEXT.ERR_PATIENT });
            document.getElementById(PATIENT_ID)?.focus();
            return;
        }
        if (inv.status !== "ready") return;
        const found = validateRefundForm(form);
        if (Object.keys(found).length) {
            setErrors(found);
            document.getElementById(found.invoiceId ? INVOICE_ID : REASON_ID)?.focus();
            return;
        }
        sendingRef.current = true;
        setSending(true);
        setErrors({});
        const result = await requestRefund(Number(form.invoiceId), form.reason.normalize("NFC").trim(), patient.id, { skipErrorPage: true });
        sendingRef.current = false;
        setSending(false);
        if (result.success) {
            onCreated(patient.fullName);
            return;
        }
        const outcome = classifySubmitError({ code: refundCreateErrorCode(result) });
        if (outcome.kind === "field") {
            setErrors(outcome.fields);
            document.getElementById(REASON_ID)?.focus();
            return;
        }
        if (outcome.kind === "reloadInvoices") {
            setErrors({ form: outcome.form });
            reloadInvoices();
            return;
        }
        onUncertain();
    };

    const actions = (submitLabel = REFUND_REQUEST_TEXT.SUBMIT) => (
        <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" disabled={sending} onClick={onClose}>
                {REFUND_REQUEST_TEXT.CANCEL}
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending || inv.status !== "ready" || !inv.invoices.length}>
                {sending ? <span className="btn-spinner" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                {sending ? REFUND_REQUEST_TEXT.SENDING : submitLabel}
            </button>
        </div>
    );

    const body = () => {
        if (inv.status === "idle") {
            return (
                <>
                    <div className="field">
                        <span className="label label-required">{REFUND_REQUEST_TEXT.INVOICE}</span>
                        <p className="input input-readonly text-muted">{BILLING_TEXT.PICK_PATIENT_FIRST}</p>
                    </div>
                    {actions()}
                </>
            );
        }
        if (inv.status === "loading") {
            return (
                <>
                    <FormAlert text={errors.form} />
                    <div className="flex flex-col gap-3" aria-busy="true">
                        <div className="skeleton h-11" />
                        <div className="skeleton h-24" />
                    </div>
                    {actions()}
                </>
            );
        }
        if (inv.status === "error" || inv.status === "unsupported") {
            return (
                <>
                    <FormAlert text={errors.form} />
                    <div className="alert alert-danger" role="alert">
                        <div>{inv.status === "error" ? BILLING_TEXT.REFUNDABLE_ERROR : BILLING_TEXT.REFUNDABLE_UNSUPPORTED}</div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {REFUND_REQUEST_TEXT.CANCEL}
                        </button>
                        {inv.status === "error" && (
                            <button type="button" className="btn btn-primary" onClick={reloadInvoices}>
                                {REFUND_REQUEST_TEXT.RETRY}
                            </button>
                        )}
                    </div>
                </>
            );
        }
        if (!inv.invoices.length) {
            return (
                <>
                    <FormAlert text={errors.form} />
                    <div className="empty-state">
                        <Inbox className="empty-state-icon" aria-hidden="true" />
                        <p className="empty-state-title">{BILLING_TEXT.REFUNDABLE_EMPTY_TITLE}</p>
                        <p className="empty-state-text">{BILLING_TEXT.REFUNDABLE_EMPTY_TEXT}</p>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {REFUND_REQUEST_TEXT.CLOSE}
                        </button>
                    </div>
                </>
            );
        }
        return (
            <>
                <div className="field">
                    <label htmlFor={INVOICE_ID} className="label label-required">
                        {REFUND_REQUEST_TEXT.INVOICE}
                    </label>
                    <select
                        id={INVOICE_ID}
                        className={cx("input", errors.invoiceId && "input-error")}
                        value={form.invoiceId}
                        disabled={sending}
                        aria-invalid={Boolean(errors.invoiceId)}
                        aria-describedby={errors.invoiceId ? INVOICE_HELP_ID : selected ? PICKED_ID : undefined}
                        onChange={(event) => {
                            setForm((current) => ({ ...current, invoiceId: event.target.value }));
                            clearError("invoiceId", "form");
                        }}
                    >
                        <option value="">{REFUND_REQUEST_TEXT.INVOICE_PLACEHOLDER}</option>
                        {inv.invoices.map((invoice) => (
                            <option key={invoice.invoiceId} value={String(invoice.invoiceId)}>
                                {invoiceOptionLabel(invoice)}
                            </option>
                        ))}
                    </select>
                    {errors.invoiceId && (
                        <p id={INVOICE_HELP_ID} className="error-text">
                            {errors.invoiceId}
                        </p>
                    )}
                    {selected && !errors.invoiceId && (
                        <div id={PICKED_ID} className="rounded-lg border border-primary bg-primary-soft px-3 py-2.5 text-body-sm">
                            <p className="font-semibold text-ink">{selected.accountName}</p>
                            <p className="num text-caption text-muted">{REFUND_REQUEST_TEXT.INVOICE_PICKED(selected.doctorName, formatCurrency(selected.paidAmount))}</p>
                        </div>
                    )}
                </div>
                <div className="field">
                    <label htmlFor={REASON_ID} className="label label-required">
                        {REFUND_REQUEST_TEXT.REASON_LABEL}
                    </label>
                    <textarea
                        id={REASON_ID}
                        className={cx("input py-2", errors.reason && "input-error")}
                        rows={3}
                        maxLength={REFUND_REASON_MAX}
                        value={form.reason}
                        disabled={sending}
                        placeholder={REFUND_REQUEST_TEXT.REASON_PLACEHOLDER}
                        aria-invalid={Boolean(errors.reason)}
                        aria-describedby={errors.reason ? REASON_HELP_ID : undefined}
                        onChange={(event) => {
                            setForm((current) => ({ ...current, reason: event.target.value }));
                            clearError("reason");
                        }}
                    />
                    <div className="flex justify-between gap-2">
                        {errors.reason ? (
                            <p id={REASON_HELP_ID} className="error-text">
                                {errors.reason}
                            </p>
                        ) : (
                            <span />
                        )}
                        <span className="num help-text">{REFUND_REQUEST_TEXT.REASON_COUNT(form.reason.length, REFUND_REASON_MAX)}</span>
                    </div>
                </div>
                <div className="alert alert-info">
                    <Info className="size-4" aria-hidden="true" />
                    <div>{BILLING_TEXT.REFUND_NOTICE}</div>
                </div>
                <FormAlert text={errors.form} />
                {actions()}
            </>
        );
    };

    return (
        <Modal title={BILLING_TEXT.CREATE_REFUND_TITLE} onClose={onClose} closeDisabled={sending}>
            <form noValidate className="mt-4 flex flex-col gap-4" onSubmit={submit}>
                <PatientPicker inputId={PATIENT_ID} value={patient} onChange={choosePatient} disabled={sending} error={errors.patient} errorId={PATIENT_HELP_ID} />
                {body()}
            </form>
        </Modal>
    );
};

export default RefundCreateDialog;

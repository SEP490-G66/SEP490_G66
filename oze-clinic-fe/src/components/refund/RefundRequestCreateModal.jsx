import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Inbox, Info, Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createMyRefundRequest, getMyRefundableInvoices } from "@/services/refundRequestService";
import { cx } from "@/utils/cx";
import { formatCurrency } from "@/utils/format";
import { GENERIC_ERROR_MESSAGE, REFUND_REQUEST_TEXT } from "@/utils/messages";
import { REFUND_INVOICE_ID, REFUND_REASON_ID, REFUND_REASON_MAX, REFUND_SUBMIT_ID, classifySubmitError, invoiceOptionLabel, validateRefundForm } from "@/utils/refundRequest";

const INVOICES_RETRY_ID = "refund-requests-invoices-retry";
const CLOSE_TARGET = "close";
const PICKED_ID = "refund-requests-invoice-picked";
const REASON_HELP_ID = "refund-requests-reason-help";
const INVOICE_HELP_ID = "refund-requests-invoice-help";

const isComposingKey = (event) => (event.key === "Enter" || event.key === "Escape") && (event.nativeEvent.isComposing || event.keyCode === 229);

const FormAlert = ({ text, className }) =>
    text ? (
        <div className={cx("alert alert-danger", className)} role="alert">
            <div>{text}</div>
        </div>
    ) : null;

const RefundRequestCreateModal = ({ navKey, isCurrentNav, onInvoicesLoaded, onSendingChange, onUncertain, onCreated, onClose }) => {
    const closeRef = useRef(null);
    const formRef = useRef(null);
    const sendingRef = useRef(false);
    const sendControllerRef = useRef(null);
    const aliveRef = useRef(false);
    const appliedFocusRef = useRef(0);

    const [inv, setInv] = useState({ seq: 1, status: "loading", invoices: null });
    const [form, setForm] = useState({ invoiceId: "", reason: "" });
    const [errors, setErrors] = useState({});
    const [sending, setSending] = useState(false);
    const [focusTarget, setFocusTarget] = useState(null);

    const invoicesLoaded = useEffectEvent((list) => onInvoicesLoaded(list));

    const requestFocus = (id) => setFocusTarget((current) => ({ id, token: (current?.token ?? 0) + 1 }));

    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            sendControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        const seq = inv.seq;
        const fail = () => {
            if (!active || controller.signal.aborted) return;
            setInv((current) => (current.seq === seq ? { ...current, status: "error" } : current));
            requestFocus(INVOICES_RETRY_ID);
        };
        getMyRefundableInvoices({ signal: controller.signal }).then((result) => {
            if (!active || controller.signal.aborted) return;
            if (!result?.success || !Array.isArray(result.data)) {
                fail();
                return;
            }
            const list = result.data;
            setInv((current) => (current.seq === seq ? { seq, status: "ready", invoices: list } : current));
            setForm((current) => (list.some((invoice) => invoice.invoiceId === Number(current.invoiceId)) ? current : { ...current, invoiceId: "" }));
            invoicesLoaded(list);
            requestFocus(list.length ? REFUND_INVOICE_ID : CLOSE_TARGET);
        }, fail);
        return () => {
            active = false;
            controller.abort();
        };
    }, [inv.seq]);

    useEffect(() => {
        if (!focusTarget || appliedFocusRef.current === focusTarget.token) return;
        const element = focusTarget.id === CLOSE_TARGET ? closeRef.current : document.getElementById(focusTarget.id);
        if (!element || element.disabled) return;
        appliedFocusRef.current = focusTarget.token;
        element.focus();
    }, [focusTarget, inv.status, sending]);

    const ready = inv.status === "ready";
    const invoices = inv.invoices ?? [];
    const selected = inv.invoices?.find((invoice) => invoice.invoiceId === Number(form.invoiceId)) ?? null;

    const reloadInvoices = () => {
        setInv((current) => ({ seq: current.seq + 1, status: "loading", invoices: current.invoices }));
        requestFocus(CLOSE_TARGET);
    };

    const clearError = (...keys) => {
        if (!keys.some((key) => errors[key])) return;
        setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key))));
    };

    const changeInvoice = (event) => {
        setForm((current) => ({ ...current, invoiceId: event.target.value }));
        clearError("invoiceId", "form");
    };

    const changeReason = (event) => {
        setForm((current) => ({ ...current, reason: event.target.value }));
        clearError("reason");
    };

    const handleFailure = (result) => {
        const outcome = classifySubmitError(result);
        if (outcome.uncertain) onUncertain();
        if (outcome.kind === "field") {
            setErrors(outcome.fields);
            requestFocus(REFUND_REASON_ID);
            return;
        }
        setErrors({ form: outcome.form });
        if (outcome.kind === "reloadInvoices") reloadInvoices();
        else requestFocus(REFUND_SUBMIT_ID);
    };

    const submit = async (event) => {
        event.preventDefault();
        if (sendingRef.current || !ready) return;
        const found = validateRefundForm(form);
        if (Object.keys(found).length) {
            setErrors(found);
            requestFocus(found.invoiceId ? REFUND_INVOICE_ID : REFUND_REASON_ID);
            return;
        }
        sendingRef.current = true;
        formRef.current?.closest('[role="dialog"]')?.focus();
        setErrors({});
        setSending(true);
        onSendingChange(true);
        const sentAt = navKey;
        const controller = new AbortController();
        sendControllerRef.current = controller;
        let result = null;
        let failed = false;
        try {
            result = await createMyRefundRequest({ invoiceId: Number(form.invoiceId), reason: form.reason.normalize("NFC").trim() }, { signal: controller.signal });
        } catch (error) {
            failed = error?.name !== "AbortError";
        } finally {
            sendingRef.current = false;
            if (aliveRef.current) {
                setSending(false);
                onSendingChange(false);
            }
        }
        if (!aliveRef.current || controller.signal.aborted || !isCurrentNav(sentAt)) return;
        if (failed || !result) {
            setErrors({ form: GENERIC_ERROR_MESSAGE });
            onUncertain();
            requestFocus(REFUND_SUBMIT_ID);
            return;
        }
        if (result.success) onCreated(result);
        else handleFailure(result);
    };

    const renderBody = () => {
        if (inv.status === "loading") {
            return (
                <>
                    <FormAlert text={errors.form} className="mb-3" />
                    <div className="flex flex-col gap-3" aria-busy="true">
                        <div className="skeleton h-11" />
                        <div className="skeleton h-11" />
                        <div className="skeleton h-24" />
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {REFUND_REQUEST_TEXT.CANCEL}
                        </button>
                        <button id={REFUND_SUBMIT_ID} type="button" className="btn btn-primary" disabled>
                            <Send className="size-4" aria-hidden="true" />
                            {REFUND_REQUEST_TEXT.SUBMIT}
                        </button>
                    </div>
                </>
            );
        }
        if (inv.status === "error") {
            return (
                <>
                    <FormAlert text={errors.form} className="mb-3" />
                    <div className="alert alert-danger" role="alert">
                        <div>{REFUND_REQUEST_TEXT.INVOICES_ERROR}</div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            {REFUND_REQUEST_TEXT.CANCEL}
                        </button>
                        <button id={INVOICES_RETRY_ID} type="button" className="btn btn-primary" onClick={reloadInvoices}>
                            {REFUND_REQUEST_TEXT.RETRY}
                        </button>
                    </div>
                </>
            );
        }
        if (!invoices.length) {
            return (
                <>
                    <FormAlert text={errors.form} className="mb-3" />
                    <div className="empty-state">
                        <Inbox className="empty-state-icon" aria-hidden="true" />
                        <p className="empty-state-title">{REFUND_REQUEST_TEXT.INVOICES_EMPTY_TITLE}</p>
                        <p className="empty-state-text">{REFUND_REQUEST_TEXT.INVOICES_EMPTY_TEXT}</p>
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
            <form ref={formRef} noValidate className="flex flex-col gap-4" onSubmit={submit} onKeyDown={(event) => isComposingKey(event) && event.preventDefault()}>
                <div className="field">
                    <label htmlFor={REFUND_INVOICE_ID} className="label label-required">
                        {REFUND_REQUEST_TEXT.INVOICE}
                    </label>
                    <select
                        id={REFUND_INVOICE_ID}
                        className={cx("input", errors.invoiceId && "input-error")}
                        value={form.invoiceId}
                        disabled={sending}
                        aria-invalid={Boolean(errors.invoiceId)}
                        aria-describedby={errors.invoiceId ? INVOICE_HELP_ID : selected ? PICKED_ID : undefined}
                        onChange={changeInvoice}
                    >
                        <option value="">{REFUND_REQUEST_TEXT.INVOICE_PLACEHOLDER}</option>
                        {invoices.map((invoice) => (
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
                    <label htmlFor={REFUND_REASON_ID} className="label label-required">
                        {REFUND_REQUEST_TEXT.REASON_LABEL}
                    </label>
                    <textarea
                        id={REFUND_REASON_ID}
                        className={cx("input", errors.reason && "input-error")}
                        maxLength={REFUND_REASON_MAX}
                        value={form.reason}
                        disabled={sending}
                        placeholder={REFUND_REQUEST_TEXT.REASON_PLACEHOLDER}
                        aria-invalid={Boolean(errors.reason)}
                        aria-describedby={errors.reason ? REASON_HELP_ID : undefined}
                        onChange={changeReason}
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
                    <div>{REFUND_REQUEST_TEXT.NOTICE}</div>
                </div>
                <FormAlert text={errors.form} />
                <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-secondary" disabled={sending} onClick={onClose}>
                        {REFUND_REQUEST_TEXT.CANCEL}
                    </button>
                    <button id={REFUND_SUBMIT_ID} type="submit" className="btn btn-primary" disabled={sending || !ready}>
                        {sending ? <span className="btn-spinner" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                        {sending ? REFUND_REQUEST_TEXT.SENDING : REFUND_REQUEST_TEXT.SUBMIT}
                    </button>
                </div>
            </form>
        );
    };

    return (
        <Modal title={REFUND_REQUEST_TEXT.CREATE_TITLE} onClose={onClose} initialFocusRef={closeRef} closeButtonRef={closeRef} closeDisabled={sending}>
            <div className="mt-4">{renderBody()}</div>
        </Modal>
    );
};

export default RefundRequestCreateModal;

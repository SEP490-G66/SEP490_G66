import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CircleAlert, Inbox, Search } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import BookingDialog from "@/components/reception/BookingDialog";
import { Card, DialogActions } from "@/components/reception/shared";
import { ddmm, hhmm, phoneText, slotText, useSubmit } from "@/components/reception/receptionUtils";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import RowMenu from "@/components/ui/RowMenu";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getConsultations, handleConsultation } from "@/services/receptionService";
import { cx } from "@/utils/cx";
import { getClinicDateTimeParts } from "@/utils/format";
import { CONSULTATION_HANDLE_NOTE_MAX_LENGTH as NOTE_MAX, CONSULTATION_RECEPTION_TEXT as TEXT } from "@/utils/messages";
import { subscriberDigits } from "@/utils/patientRecord";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4];
const COLUMN_COUNT = 6;
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];
const C = TEXT.COLUMNS;
const D = TEXT.DETAIL;
const STATUSES = ["New", "Contacted", "Booked", "Closed"];
const BADGE = { New: "badge-warning", Contacted: "badge-info", Booked: "badge-success", Closed: "badge-neutral" };
const EMPTY_FILTERS = { status: "", keyword: "", page: 1 };
const PHONE_LIKE = /^[\d\s.+-]+$/;

const dateTimeText = (value) => {
    if (!value) return TEXT.EMPTY_VALUE;
    const parts = getClinicDateTimeParts(value);
    return `${parts.date} ${parts.time.slice(0, 5)}`;
};

const searchKeyword = (value) => {
    const text = value.trim();
    if (!text || !PHONE_LIKE.test(text)) return text;
    const full = subscriberDigits(text);
    if (full) return full;
    const compact = text.replace(/[\s.-]/g, "");
    const rest = compact.startsWith("+84") ? compact.slice(3) : compact.startsWith("0") ? compact.slice(1) : compact;
    return rest || compact;
};

const StatusBadge = ({ status }) => <span className={cx("badge", BADGE[status] ?? "badge-neutral")}>{TEXT.STATUS[status] ?? status}</span>;

const PhoneLink = ({ phone }) => (
    <a className="btn-link num inline-flex min-h-6 items-center" href={`tel:${phone}`}>
        {phoneText(phone)}
    </a>
);

const NoteDialog = ({ item, title, required, placeholder, onClose, onSubmit }) => {
    const [note, setNote] = useState("");
    const [error, setError] = useState(null);
    const [busy, submit] = useSubmit(onSubmit);
    const send = (event) => {
        event.preventDefault();
        const value = note.trim();
        if (required && !value) {
            setError(TEXT.CLOSED_NOTE_REQUIRED);
            return;
        }
        submit(value);
    };
    return (
        <Modal title={title} description={TEXT.DIALOG_SUBTITLE(item.fullName, phoneText(item.phoneNumber))} onClose={onClose} closeDisabled={busy}>
            <form className="mt-5" onSubmit={send} noValidate>
                <div className="field">
                    <div className="flex items-baseline justify-between gap-4">
                        <label htmlFor="cs-note" className={cx("label", required && "label-required")}>
                            {TEXT.NOTE} {!required && <span className="text-muted">{TEXT.OPTIONAL}</span>}
                        </label>
                        <span className="num text-caption text-muted">
                            {note.length}/{NOTE_MAX}
                        </span>
                    </div>
                    <textarea
                        id="cs-note"
                        className="input"
                        rows={3}
                        maxLength={NOTE_MAX}
                        placeholder={placeholder}
                        value={note}
                        aria-invalid={Boolean(error) || undefined}
                        aria-describedby={error ? "cs-note-error" : undefined}
                        onChange={(event) => {
                            setNote(event.target.value);
                            if (error && event.target.value.trim()) setError(null);
                        }}
                    />
                    {error && (
                        <p id="cs-note-error" className="error-text">
                            {error}
                        </p>
                    )}
                </div>
                <DialogActions onClose={onClose} closeLabel={TEXT.CANCEL} submitLabel={TEXT.CONFIRM} busy={busy} closeDisabled={busy} />
            </form>
        </Modal>
    );
};

const DetailList = ({ rows }) => (
    <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-3 sm:gap-y-3">
        {rows.map(([label, value]) => (
            <div key={label} className="contents">
                <dt className="text-body-sm text-muted">{label}</dt>
                <dd className="mb-2 min-w-0 break-words text-body-sm text-ink sm:col-span-2 sm:mb-0">{value || <span className="text-muted">{TEXT.EMPTY_VALUE}</span>}</dd>
            </div>
        ))}
    </dl>
);

const DetailDialog = ({ item, onClose }) => (
    <Modal title={TEXT.DETAIL_TITLE} size="md" onClose={onClose}>
        <div className="mt-5">
            <DetailList
                rows={[
                    [D.NAME, item.fullName],
                    [D.PHONE, <PhoneLink key="phone" phone={item.phoneNumber} />],
                    [D.EMAIL, item.email],
                    [D.NOTE, item.note],
                    [D.SENT_AT, <span key="sent" className="num">{dateTimeText(item.createdAt)}</span>],
                    [D.STATUS, <StatusBadge key="status" status={item.status} />],
                ]}
            />
        </div>
        {item.handledAt && (
            <div className="mt-5 border-t border-border pt-5">
                <p className="mb-3 text-title text-ink">{D.HANDLED}</p>
                <DetailList
                    rows={[
                        [D.HANDLED_BY, item.handledByName],
                        [D.HANDLED_AT, <span key="handled" className="num">{dateTimeText(item.handledAt)}</span>],
                        [D.HANDLE_NOTE, item.handleNote],
                    ]}
                />
            </div>
        )}
        <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
                {TEXT.CLOSE}
            </button>
        </div>
    </Modal>
);

const BookedRetryDialog = ({ booked, onClose, onRetry }) => {
    const [busy, submit] = useSubmit(onRetry);
    return (
        <Modal title={TEXT.BOOKED_NOT_SAVED_TITLE} onClose={onClose} closeDisabled={busy}>
            <form
                className="mt-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <p role="alert" className="alert alert-warning">
                    {TEXT.BOOKED_NOT_SAVED(booked.name, booked.time, booked.date)}
                </p>
                <DialogActions onClose={onClose} closeLabel={TEXT.CLOSE} submitLabel={TEXT.BOOKED_RETRY} busy={busy} closeDisabled={busy} />
            </form>
        </Modal>
    );
};

const RowActions = ({ item, onOpen }) => {
    const primary = item.status === "New" ? "contacted" : item.status === "Contacted" ? "book" : null;
    const menu = [{ label: TEXT.MENU_DETAIL, onSelect: () => onOpen("detail", item) }];
    if (item.status === "New" || item.status === "Contacted") menu.push({ label: TEXT.MENU_CLOSED, onSelect: () => onOpen("closed", item) });
    return (
        <div className="flex items-center justify-start gap-1.5 @max-4xl:w-full @max-4xl:justify-end">
            {primary ? (
                <button type="button" className="btn btn-primary h-8 w-28 px-3 text-label @max-4xl:max-w-80 @max-4xl:flex-1" onClick={() => onOpen(primary, item)}>
                    {primary === "contacted" ? TEXT.ACTION_CONTACTED : TEXT.ACTION_BOOK}
                </button>
            ) : (
                <span className="inline-block w-28 @max-4xl:hidden" aria-hidden="true" />
            )}
            <RowMenu label={TEXT.MORE(item.fullName)} items={menu} />
        </div>
    );
};

const ReceptionConsultations = () => {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [search, setSearch] = useState("");
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [dialog, setDialog] = useState(null);
    const timer = useRef(null);
    const bookedFor = useRef(null);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${filters.status}|${filters.keyword}|${filters.page}|${reload}`;

    useEffect(() => {
        let active = true;
        getConsultations({ status: filters.status, keyword: searchKeyword(filters.keyword), page: filters.page, pageSize: PAGE_SIZE }).then((response) => {
            if (active) setResult({ key: requestKey, ok: response.success, data: response.success ? response.data : null });
        });
        return () => {
            active = false;
        };
    }, [filters, requestKey]);

    useEffect(() => () => clearTimeout(timer.current), []);

    const current = result?.key === requestKey ? result : null;
    const items = current?.data?.items ?? [];
    const total = Number(current?.data?.totalCount ?? 0);
    const totalPages = Number(current?.data?.totalPages ?? Math.ceil(total / PAGE_SIZE));
    const outOfRange = Boolean(current?.ok) && items.length === 0 && filters.page > 1;
    if (outOfRange) setFilters((f) => ({ ...f, page: Math.max(1, totalPages) }));
    const status = !current || outOfRange ? "loading" : current.ok ? "ready" : "error";

    const refresh = () => setReload((n) => n + 1);
    const close = () => setDialog(null);

    const onSearch = (value) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setFilters((f) => ({ ...f, keyword: value.trim(), page: 1 })), SEARCH_DELAY_MS);
    };

    const open = (type, item) => {
        if (type === "book") bookedFor.current = null;
        setDialog({ type, item });
    };

    const runHandle = async (item, body, doneText) => {
        const response = await handleConsultation(item.id, body);
        if (response.success) {
            toast.success(doneText, { role: "status" });
            close();
            refresh();
            return;
        }
        if (response.status === 404) {
            toast.error(TEXT.NOT_FOUND);
            close();
            refresh();
            return;
        }
        toast.error(TEXT.SAVE_FAILED);
    };

    const saveBooked = async (item, booked, retry) => {
        const response = await handleConsultation(item.id, { status: "Booked", note: booked.note });
        refresh();
        if (response.success) {
            toast.success(TEXT.BOOKED_DONE(booked.name, booked.time, booked.date), { role: "status" });
            close();
            return;
        }
        if (response.status === 404) {
            toast.error(TEXT.NOT_FOUND);
            close();
            return;
        }
        if (retry) toast.error(TEXT.SAVE_FAILED);
        setDialog({ type: "bookedRetry", item, booked });
    };

    const onBooked = (item, appointment) => {
        if (bookedFor.current === item.id) return;
        bookedFor.current = item.id;
        close();
        const date = ddmm(appointment.appointmentDate);
        const booked = {
            name: appointment.patientName ?? item.fullName,
            time: hhmm(appointment.timeSlotStart) ?? slotText(appointment),
            date,
            note: TEXT.BOOKED_NOTE(slotText(appointment), date),
        };
        saveBooked(item, booked, false);
    };

    const filtered = Boolean(filters.status || filters.keyword);
    const from = (filters.page - 1) * PAGE_SIZE + 1;

    const tableHead = (
        <thead>
            <tr className="whitespace-nowrap">
                <th className="w-14 text-right">{C.NO}</th>
                <th>{C.SENDER}</th>
                <th>{C.SENT_AT}</th>
                <th>{C.PHONE}</th>
                <th>{C.STATUS}</th>
                <th className="w-px">{C.ACTIONS}</th>
            </tr>
        </thead>
    );

    const body = () => {
        if (status === "error") {
            return (
                <div className="border-t border-border p-4 sm:p-6">
                    <div role="alert" className="alert alert-danger flex flex-wrap items-center gap-3">
                        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1">{TEXT.LOAD_ERROR}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={refresh}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                </div>
            );
        }
        if (status === "ready" && items.length === 0) {
            return filtered ? (
                <div className="empty-state border-t border-border">
                    <p className="empty-state-text">{TEXT.EMPTY_FILTERED}</p>
                </div>
            ) : (
                <div className="empty-state border-t border-border">
                    <Inbox className="empty-state-icon" aria-hidden="true" />
                    <p className="empty-state-title">{TEXT.EMPTY_TITLE}</p>
                    <p className="empty-state-text">{TEXT.EMPTY_TEXT}</p>
                </div>
            );
        }
        return (
            <>
                <div className="table-wrap rounded-none border-x-0 border-b-0" aria-busy={status === "loading" || undefined}>
                    <table className="table table-stack">
                        {tableHead}
                        <tbody>
                            {status === "loading"
                                ? SKELETON_ROWS.map((row) => (
                                      <tr key={row}>
                                          <td colSpan={COLUMN_COUNT}>
                                              <span className="skeleton block h-5 w-full" />
                                          </td>
                                      </tr>
                                  ))
                                : items.map((item, index) => (
                                      <tr key={item.id}>
                                          <td data-label={C.NO} data-hide-stack className="num w-14 text-right text-muted">
                                              {from + index}
                                          </td>
                                          <td data-primary>
                                              <span className="cell-primary">{item.fullName}</span>
                                          </td>
                                          <td data-label={C.SENT_AT} className="num whitespace-nowrap">
                                              {dateTimeText(item.createdAt)}
                                          </td>
                                          <td data-label={C.PHONE} className="whitespace-nowrap">
                                              <PhoneLink phone={item.phoneNumber} />
                                          </td>
                                          <td data-label={C.STATUS} className="whitespace-nowrap">
                                              <StatusBadge status={item.status} />
                                          </td>
                                          <td data-actions className="whitespace-nowrap py-2">
                                              <RowActions item={item} onOpen={open} />
                                          </td>
                                      </tr>
                                  ))}
                        </tbody>
                    </table>
                </div>
                {status === "ready" && (
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-4 py-3 max-sm:justify-center sm:px-6">
                        <p className="num text-body-sm text-muted">{TEXT.RANGE(from, from + items.length - 1, total)}</p>
                        {totalPages > 1 && (
                            <Pagination page={filters.page} totalPages={totalPages} label={TEXT.PAGINATION_LABEL} onChange={(page) => setFilters((f) => ({ ...f, page }))} />
                        )}
                    </div>
                )}
            </>
        );
    };

    const item = dialog?.item;

    return (
        <div className="app-content min-h-full space-y-6">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.TITLE}</h1>
                <p className="page-description">{TEXT.DESCRIPTION}</p>
            </div>
            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-4 p-4 sm:p-6">
                    <div className="field w-full sm:w-80">
                        <label htmlFor="cs-search" className="label">
                            {TEXT.SEARCH}
                        </label>
                        <div className="search">
                            <Search aria-hidden="true" />
                            <input id="cs-search" type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={search} onChange={(event) => onSearch(event.target.value)} />
                        </div>
                    </div>
                    <div className="field w-full sm:w-56">
                        <label htmlFor="cs-status" className="label">
                            {TEXT.STATUS_FILTER}
                        </label>
                        <select id="cs-status" className="input" value={filters.status} onChange={(event) => setFilters((f) => ({ ...f, status: event.target.value, page: 1 }))}>
                            <option value="">{TEXT.STATUS_ALL}</option>
                            {STATUSES.map((value) => (
                                <option key={value} value={value}>
                                    {TEXT.STATUS[value]}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {body()}
            </Card>

            {dialog?.type === "contacted" && (
                <NoteDialog
                    key={item.id}
                    item={item}
                    title={TEXT.CONTACTED_TITLE}
                    onClose={close}
                    onSubmit={(note) => runHandle(item, { status: "Contacted", note: note || null }, TEXT.CONTACTED_DONE(item.fullName))}
                />
            )}
            {dialog?.type === "closed" && (
                <NoteDialog
                    key={item.id}
                    item={item}
                    title={TEXT.CLOSED_TITLE}
                    required={item.status === "Contacted"}
                    placeholder={TEXT.CLOSED_NOTE_PLACEHOLDER}
                    onClose={close}
                    onSubmit={(note) => runHandle(item, { status: "Closed", note: note || null }, TEXT.CLOSED_DONE(item.fullName))}
                />
            )}
            {dialog?.type === "detail" && <DetailDialog item={item} onClose={close} />}
            {dialog?.type === "book" && (
                <BookingDialog
                    key={item.id}
                    initial={{ fullName: item.fullName, phoneNumber: item.phoneNumber }}
                    onClose={close}
                    onBooked={(appointment) => onBooked(item, appointment)}
                />
            )}
            {dialog?.type === "bookedRetry" && <BookedRetryDialog booked={dialog.booked} onClose={close} onRetry={() => saveBooked(item, dialog.booked, true)} />}
        </div>
    );
};

export default ReceptionConsultations;

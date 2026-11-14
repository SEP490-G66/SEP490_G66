import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import LabeledSelect from "@/components/ui/LabeledSelect";
import Pagination from "@/components/ui/Pagination";
import FollowUpBookDialog from "@/components/reception/FollowUpBookDialog";
import FollowUpCallDialog from "@/components/reception/FollowUpCallDialog";
import { Card } from "@/components/reception/shared";
import { phoneText } from "@/components/reception/receptionUtils";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { clinicToday, getDoctorOptions, getFollowUpList } from "@/services/receptionService";
import { FOLLOW_UP_TEXT as TEXT } from "@/utils/messages";
import { EMPTY_FILTERS, FOLLOW_UP_PAGE_SIZE, STATUS_CHIPS, contactStatusOf, dmy, followUpQuery, isFiltered } from "@/utils/followUp";
import { cx } from "@/utils/cx";

const READ = { skipErrorPage: true };
const SEARCH_DELAY_MS = 300;
const SKELETON_ROWS = [1, 2, 3, 4, 5];
const C = TEXT.COLUMNS;
const CRUMBS = [{ label: TEXT.CRUMB }, { label: TEXT.TITLE }];

const ReceptionFollowUps = () => {
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [search, setSearch] = useState("");
    const [reload, setReload] = useState(0);
    const [result, setResult] = useState(null);
    const [doctors, setDoctors] = useState([]);
    const [dialog, setDialog] = useState(null);
    const timer = useRef(null);

    usePageTitle(TEXT.DOC_TITLE);

    const requestKey = `${JSON.stringify(filters)}|${reload}`;

    useEffect(() => {
        const controller = new AbortController();
        getFollowUpList(followUpQuery(filters, clinicToday()), { ...READ, signal: controller.signal }).then((response) => {
            if (response.aborted || controller.signal.aborted) return;
            setResult({ key: requestKey, ok: response.success, data: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [filters, requestKey]);

    useEffect(() => {
        const controller = new AbortController();
        getDoctorOptions({ ...READ, signal: controller.signal }).then((response) => {
            if (!response.success || controller.signal.aborted) return;
            const items = Array.isArray(response.data) ? response.data : (response.data?.items ?? []);
            setDoctors(items.map((d) => ({ id: d.id, name: d.fullName })));
        });
        return () => controller.abort();
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    const current = result?.key === requestKey ? result : null;
    const status = current ? (current.ok ? "ready" : "error") : "loading";
    const items = current?.data?.items ?? [];
    const total = Number(current?.data?.totalCount ?? 0);
    const totalPages = Math.max(1, Number(current?.data?.totalPages ?? Math.ceil(total / FOLLOW_UP_PAGE_SIZE)));
    const lastPager = result?.ok ? Math.max(1, Number(result.data?.totalPages ?? 1)) : 1;

    const change = (patch) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

    const onSearch = (value) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => change({ keyword: value }), SEARCH_DELAY_MS);
    };

    const clearAll = () => {
        clearTimeout(timer.current);
        setSearch("");
        setFilters(EMPTY_FILTERS);
    };

    const done = (message) => {
        setDialog(null);
        toast.success(message, { role: "status" });
        setReload((n) => n + 1);
    };

    const doctorOptions = [["", TEXT.ALL_DOCTORS], ...doctors.map((d) => [String(d.id), d.name])];
    const dirty = isFiltered({ ...filters, keyword: search });
    const from = (filters.page - 1) * FOLLOW_UP_PAGE_SIZE + 1;

    return (
        <div className="app-content min-h-full space-y-5">
            <div>
                <Breadcrumb items={CRUMBS} className="mb-2" />
                <h1 className="page-title">{TEXT.TITLE}</h1>
            </div>
            <Card>
                <div className="flex flex-wrap items-end gap-3 px-4 py-3">
                    <div className="flex min-w-56 flex-1 flex-col gap-1">
                        <label htmlFor="fu-search" className="text-caption text-muted">
                            {TEXT.SEARCH}
                        </label>
                        <input id="fu-search" type="search" className="input" placeholder={TEXT.SEARCH_PLACEHOLDER} value={search} onChange={(event) => onSearch(event.target.value)} />
                    </div>
                    <LabeledSelect id="fu-due" label={TEXT.DUE} value={filters.due} options={Object.entries(TEXT.DUE_OPTIONS)} onChange={(due) => change({ due })} />
                    <LabeledSelect id="fu-status" label={TEXT.STATUS} value={filters.status} options={Object.entries(TEXT.STATUS_OPTIONS)} onChange={(value) => change({ status: value })} />
                    <LabeledSelect id="fu-doctor" label={TEXT.DOCTOR} value={filters.doctorId} options={doctorOptions} onChange={(doctorId) => change({ doctorId })} />
                    {dirty && (
                        <button type="button" className="btn btn-link mb-2.5 h-auto p-0" onClick={clearAll}>
                            {TEXT.CLEAR}
                        </button>
                    )}
                </div>
            </Card>
            <Card>
                {status === "error" ? (
                    <div role="alert" className="alert alert-danger m-4 flex flex-wrap items-center gap-3">
                        <span className="flex-1">{TEXT.LOAD_ERROR}</span>
                        <button type="button" className="btn btn-secondary h-9" onClick={() => setReload((n) => n + 1)}>
                            {TEXT.RETRY}
                        </button>
                    </div>
                ) : (
                    <div className="table-wrap rounded-none border-0" aria-busy={status === "loading" ? "true" : undefined}>
                        <table className="table table-stack">
                            <thead>
                                <tr>
                                    <th>{C.PATIENT}</th>
                                    <th>{C.PHONE}</th>
                                    <th>{C.WHAT}</th>
                                    <th>{C.DOCTOR}</th>
                                    <th>{C.DUE}</th>
                                    <th>{C.STATUS}</th>
                                    <th>
                                        <span className="sr-only">{C.ACTIONS}</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {status === "loading" ? (
                                    SKELETON_ROWS.map((row) => (
                                        <tr key={row}>
                                            <td colSpan={7}>
                                                <span className="skeleton block h-5 w-full" />
                                            </td>
                                        </tr>
                                    ))
                                ) : items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-muted">
                                            {TEXT.EMPTY}
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item) => {
                                        const contact = contactStatusOf(item);
                                        const [chipLabel, chipClass] = STATUS_CHIPS[contact];
                                        return (
                                            <tr key={item.examinationId}>
                                                <td data-primary className="whitespace-nowrap font-semibold text-ink">
                                                    {item.patientName}
                                                </td>
                                                <td data-label={C.PHONE} className="num whitespace-nowrap">
                                                    {item.patientPhoneNumber ? phoneText(item.patientPhoneNumber) : TEXT.DASH}
                                                </td>
                                                <td data-label={C.WHAT}>{item.followUpNotes || TEXT.DASH}</td>
                                                <td data-label={C.DOCTOR} className="whitespace-nowrap">
                                                    {item.doctorName || TEXT.DASH}
                                                </td>
                                                <td data-label={C.DUE} className="num whitespace-nowrap">
                                                    {item.followUpDate ? dmy(item.followUpDate) : TEXT.DASH}
                                                </td>
                                                <td data-label={C.STATUS}>
                                                    <span className={cx("badge", chipClass)}>{chipLabel}</span>
                                                </td>
                                                <td data-actions className="w-px text-right">
                                                    {contact !== "booked" && (
                                                        <div className="flex justify-end gap-1.5">
                                                            <button type="button" className="btn btn-primary h-8 px-3 text-label" onClick={() => setDialog({ type: "book", item })}>
                                                                {TEXT.BOOK}
                                                            </button>
                                                            <button type="button" className="btn btn-secondary h-8 px-3 text-label" onClick={() => setDialog({ type: "call", item })}>
                                                                {TEXT.CALL}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {(status === "ready" ? total > 0 : status === "loading" && result?.ok) && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
                        <span className="num text-caption text-muted">{status === "ready" ? TEXT.COUNT(from, from + items.length - 1, total) : ""}</span>
                        <span className="flex-1" />
                        {(status === "ready" ? totalPages : lastPager) > 1 && (
                            <Pagination
                                page={filters.page}
                                totalPages={status === "ready" ? totalPages : lastPager}
                                onChange={(page) => change({ page })}
                                busy={status === "loading"}
                                label={TEXT.TITLE}
                            />
                        )}
                    </div>
                )}
            </Card>
            {dialog?.type === "call" && <FollowUpCallDialog item={dialog.item} onClose={() => setDialog(null)} onSaved={done} />}
            {dialog?.type === "book" && <FollowUpBookDialog item={dialog.item} doctors={doctors} onClose={() => setDialog(null)} onBooked={done} />}
        </div>
    );
};

export default ReceptionFollowUps;

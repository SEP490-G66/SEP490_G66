import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ConfirmExamDialog from "@/components/examination/ConfirmExamDialog";
import QueueCurrentBanner from "@/components/examination/QueueCurrentBanner";
import MyShiftBar from "@/components/staff/MyShiftBar";
import DataTable from "@/components/ui/DataTable";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import ListFooter from "@/components/ui/ListFooter";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import StatusBadge from "@/components/ui/StatusBadge";
import usePagedList from "@/hooks/usePagedList";
import { callPatient, getExamWorkspace, markAbsent, startExamination } from "@/services/examinationService";
import { cx } from "@/utils/cx";
import { EXAM_QUEUE_STATUS, GENERIC_ERROR_MESSAGE, QUEUE_STATUS } from "@/utils/messages";
import { ROUTES, getDoctorPatientRoute } from "@/utils/routes";

const PAGE_SIZE = 8;
const TITLE_ID = "doctor-queue-title";
const DONE = "DONE";

const ROW_STATUS = { ...EXAM_QUEUE_STATUS, [DONE]: { label: "Đã khám", badge: "badge-success" } };

const STATUS_OPTIONS = [
    { value: QUEUE_STATUS.WAITING, label: "Đang chờ" },
    { value: QUEUE_STATUS.CALLED, label: "Đã gọi" },
    { value: QUEUE_STATUS.IN_EXAMINATION, label: "Đang khám" },
    { value: DONE, label: "Đã khám" },
];

const SMALL_BUTTON = "h-9 px-3 max-md:h-11";

const normalize = (value) => String(value ?? "").normalize("NFC").trim().toLocaleLowerCase("vi");

// Patients still in the queue, then those already seen this shift
const toRows = (workspace) => [
    ...workspace.queue,
    ...workspace.done.map((item) => ({ id: `done-${item.id}`, queueNumber: item.queueNumber, patientName: item.patientName, status: DONE, finishedAt: item.finishedAt })),
];

const matches = (row, keyword) => !keyword || [row.patientName, row.patientCode, String(row.queueNumber)].some((field) => normalize(field).includes(keyword));

// Second line under the name: code and why the patient is where they are
const detailOf = (row) =>
    [
        row.patientCode,
        row.status === DONE && row.finishedAt && `Xong lúc ${row.finishedAt}`,
        row.skipCount > 0 && `Đã báo vắng ${row.skipCount} lần`,
    ]
        .filter(Boolean)
        .join(" · ");

// "Hàng chờ" of the doctor's room for the current shift: who is in, who is waiting, who is done.
// One patient is in the room at a time, so "Gọi vào khám" waits until the one called / examined is finished.
const DoctorQueuePage = () => {
    const navigate = useNavigate();
    const [workspace, setWorkspace] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [version, setVersion] = useState(0);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [busy, setBusy] = useState(false);
    const [absent, setAbsent] = useState(null);

    useEffect(() => {
        let alive = true;
        getExamWorkspace().then((response) => {
            if (!alive) return;
            setLoadFailed(!response.success);
            if (response.success) setWorkspace(response.data);
        });
        return () => {
            alive = false;
        };
    }, [version]);

    const rows = workspace ? toRows(workspace) : [];
    const keyword = normalize(search);
    const visible = rows.filter((row) => (!status || row.status === status) && matches(row, keyword));
    const list = usePagedList(visible, { pageSize: PAGE_SIZE, resetKey: `${keyword}|${status}` });

    const inRoom = rows.find((row) => row.status === QUEUE_STATUS.IN_EXAMINATION) ?? rows.find((row) => row.status === QUEUE_STATUS.CALLED) ?? null;
    const waitingCount = rows.filter((row) => row.status === QUEUE_STATUS.WAITING).length;
    const shift = workspace?.shift;

    // Runs a queue action and shows the new queue; true when it worked
    const run = async (action, id) => {
        setBusy(true);
        const response = await action(id);
        setBusy(false);
        if (!response.success) {
            toast.error(response.message ?? GENERIC_ERROR_MESSAGE);
            return false;
        }
        if (response.message) toast.success(response.message);
        if (response.data?.queue) setWorkspace(response.data);
        return true;
    };

    const openExam = () => navigate(ROUTES.DOCTOR_EXAMINATION);
    const start = async (id) => {
        if (await run(startExamination, id)) openExam();
    };
    const confirmAbsent = async () => {
        if (await run(markAbsent, absent.id)) setAbsent(null);
    };

    const actionsOf = (row) => {
        if (row.status === DONE) return null;
        const recordLink = row.patientId && (
            <Link to={getDoctorPatientRoute(row.patientId)} className={cx("btn btn-secondary", SMALL_BUTTON)}>
                Xem hồ sơ
            </Link>
        );
        if (row.status === QUEUE_STATUS.IN_EXAMINATION) {
            return (
                <>
                    {recordLink}
                    <button type="button" className={cx("btn btn-primary", SMALL_BUTTON)} onClick={openExam}>
                        Mở lượt khám
                    </button>
                </>
            );
        }
        if (row.status === QUEUE_STATUS.CALLED) {
            return (
                <>
                    {recordLink}
                    <button type="button" className={cx("btn btn-primary", SMALL_BUTTON)} disabled={busy} onClick={() => start(row.id)}>
                        Bắt đầu khám
                    </button>
                    <button type="button" className={cx("btn btn-secondary", SMALL_BUTTON)} disabled={busy} onClick={() => setAbsent(row)}>
                        Vắng mặt
                    </button>
                </>
            );
        }
        return (
            <button
                type="button"
                className={cx("btn btn-secondary", SMALL_BUTTON)}
                disabled={busy || Boolean(inRoom) || row.atImaging}
                title={row.atImaging ? "Bệnh nhân đang đi chụp X-quang" : inRoom ? "Đang có bệnh nhân trong phòng" : undefined}
                onClick={() => run(callPatient, row.id)}
            >
                Gọi vào khám
            </button>
        );
    };

    const columns = [
        {
            key: "queueNumber",
            label: "STT",
            render: (row) => (
                <span
                    className={cx(
                        "num grid size-9 place-items-center rounded-md font-semibold",
                        row.status === QUEUE_STATUS.IN_EXAMINATION ? "bg-primary text-on-primary" : "bg-surface-muted text-ink",
                    )}
                >
                    {row.queueNumber}
                </span>
            ),
        },
        {
            key: "patientName",
            label: "Tên bệnh nhân",
            primary: true,
            className: "min-w-52",
            render: (row) => (
                <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                        {row.patientName}
                        {row.priority && <span className="badge badge-warning">Ưu tiên</span>}
                    </p>
                    {detailOf(row) && <p className="text-caption text-muted">{detailOf(row)}</p>}
                </div>
            ),
        },
        { key: "services", label: "Dịch vụ đăng ký", block: true, optional: true, className: "min-w-48", render: (row) => row.services?.join(", ") },
        { key: "status", label: "Trạng thái", render: (row) => <StatusBadge status={row.badge ?? row.status} labels={ROW_STATUS} /> },
        { key: "actions", label: "Thao tác", align: "right", actions: true, render: (row) => <div className="flex flex-wrap justify-end gap-2">{actionsOf(row)}</div> },
    ];

    const roomName = shift?.roomName ?? "Phòng khám";
    const description = shift ? [shift.start && `${shift.name} ${shift.start} – ${shift.end}`, `${waitingCount} bệnh nhân đang chờ`].filter(Boolean).join(" · ") : null;

    return (
        <>
            <MyShiftBar onChange={() => setVersion((current) => current + 1)} />
            <PageHeader id={TITLE_ID} title={`Hàng chờ · ${roomName}`} description={description} />

            <div className="flex flex-col gap-5">
                {loadFailed && (
                    <div role="alert" className="alert alert-danger flex-wrap items-center justify-between">
                        <span>{GENERIC_ERROR_MESSAGE}</span>
                        <button type="button" className="btn btn-secondary" onClick={() => setVersion((current) => current + 1)}>
                            Thử lại
                        </button>
                    </div>
                )}

                {inRoom?.status === QUEUE_STATUS.IN_EXAMINATION && (
                    <QueueCurrentBanner
                        title={`Đang khám số ${inRoom.queueNumber} · ${inRoom.patientName}`}
                        text="Chỉ gọi bệnh nhân tiếp theo khi hoàn thành lượt khám này."
                        action={
                            <button type="button" className="btn btn-secondary shrink-0" onClick={openExam}>
                                Mở lượt khám
                            </button>
                        }
                    />
                )}
                {inRoom?.status === QUEUE_STATUS.CALLED && (
                    <QueueCurrentBanner
                        title={`Đã gọi số ${inRoom.queueNumber} · ${inRoom.patientName}`}
                        text="Bấm “Bắt đầu khám” khi bệnh nhân vào phòng, hoặc báo vắng mặt."
                        action={
                            <button type="button" className="btn btn-primary shrink-0" disabled={busy} onClick={() => start(inRoom.id)}>
                                Bắt đầu khám
                            </button>
                        }
                    />
                )}

                <section aria-labelledby={TITLE_ID} className="card-app flex flex-col gap-4 p-0">
                    <div className="px-5 pt-5">
                        <FilterBar canClear={Boolean(search || status)} onClear={() => { setSearch(""); setStatus(""); }}>
                            <SearchInput
                                id="doctor-queue-search"
                                label="Tìm bệnh nhân trong hàng chờ"
                                placeholder="Tìm theo tên, mã bệnh nhân hoặc số thứ tự"
                                value={search}
                                onChange={setSearch}
                                className={cx(FILTER_SEARCH_CLASS, "sm:flex-1")}
                            />
                            <FilterSelect id="doctor-queue-status" label="Trạng thái" allLabel="Tất cả trạng thái" options={STATUS_OPTIONS} value={status} onChange={setStatus} className={FILTER_SELECT_CLASS} />
                        </FilterBar>
                    </div>
                    <DataTable
                        className="rounded-t-none border-x-0 border-b-0"
                        columns={columns}
                        rows={list.rows}
                        labelledBy={TITLE_ID}
                        loading={!workspace && !loadFailed}
                        rowClassName={(row) => row.status === QUEUE_STATUS.IN_EXAMINATION && "bg-primary-softer"}
                        empty={rows.length === 0 ? "Hàng chờ đang trống." : "Không có bệnh nhân nào khớp với bộ lọc."}
                        footer={list.total > 0 && <ListFooter list={list} label="Phân trang hàng chờ" />}
                    />
                </section>
            </div>

            {absent && (
                <ConfirmExamDialog
                    title="Báo vắng mặt"
                    description={`Số ${absent.queueNumber} · ${absent.patientName} không vào phòng? Bệnh nhân bị đẩy xuống cuối hàng chờ. Bạn có thể gọi lại sau.`}
                    confirmLabel="Báo vắng mặt"
                    danger
                    busy={busy}
                    onConfirm={confirmAbsent}
                    onClose={() => setAbsent(null)}
                />
            )}
        </>
    );
};

export default DoctorQueuePage;

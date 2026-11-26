import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "@/components/ui/DataTable";
import ListFooter from "@/components/ui/ListFooter";
import PageHeader from "@/components/ui/PageHeader";
import SearchInput from "@/components/ui/SearchInput";
import { useDebounced } from "@/hooks/usePatientRecordNav";
import { getDoctorPatients } from "@/services/doctorPatientService";
import { formatPhone } from "@/utils/format";
import { GENDER_LABELS, GENERIC_ERROR_MESSAGE } from "@/utils/messages";
import { getDoctorPatientRoute } from "@/utils/routes";

const PAGE_SIZE = 8;
const TITLE_ID = "doctor-patients-title";

const detailOf = (patient) => [patient.code, GENDER_LABELS[patient.gender], patient.age != null && `${patient.age} tuổi`].filter(Boolean).join(" · ");

// "Hồ sơ bệnh án": the patients the doctor examined or has a confirmed booking with (the ones whose record opens),
// latest visit first. Search by name, patient code or phone; paged by the server.
const DoctorPatientsPage = () => {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState({ keyword: "", page: 1 });
    const [result, setResult] = useState({ key: null, items: [], total: 0, failed: false });
    const [version, setVersion] = useState(0);
    const { schedule } = useDebounced(300);

    const key = `${query.keyword}|${query.page}|${version}`;
    useEffect(() => {
        const controller = new AbortController();
        getDoctorPatients({ keyword: query.keyword, page: query.page, pageSize: PAGE_SIZE, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted) return;
            setResult(response.success ? { key, ...response.data, failed: false } : { key, items: [], total: 0, failed: true });
        });
        return () => controller.abort();
    }, [key, query.keyword, query.page]);

    const loading = result.key !== key;
    const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    const offset = (query.page - 1) * PAGE_SIZE;
    const list = {
        page: query.page,
        totalPages,
        total: result.total,
        from: result.total ? offset + 1 : 0,
        to: Math.min(offset + PAGE_SIZE, result.total),
        setPage: (page) => setQuery((current) => ({ ...current, page })),
    };

    const changeSearch = (value) => {
        setSearch(value);
        schedule(() => setQuery({ keyword: value.trim(), page: 1 }));
    };

    const columns = [
        { key: "index", label: "STT", hideStack: true, render: (_, index) => <span className="num">{offset + index + 1}</span> },
        {
            key: "name",
            label: "Tên bệnh nhân",
            primary: true,
            className: "min-w-52",
            render: (patient) => (
                <div className="min-w-0">
                    <p className="font-semibold text-ink">{patient.name}</p>
                    <p className="text-caption text-muted">{detailOf(patient)}</p>
                </div>
            ),
        },
        { key: "phone", label: "Số điện thoại", render: (patient) => <span className="num whitespace-nowrap">{formatPhone(patient.phone) || "—"}</span> },
        { key: "lastVisit", label: "Lần khám gần nhất", render: (patient) => <span className="num">{patient.lastVisit || "—"}</span> },
        {
            key: "actions",
            label: "Thao tác",
            align: "right",
            actions: true,
            render: (patient) => (
                <Link to={getDoctorPatientRoute(patient.id)} className="btn btn-secondary h-9 px-3 max-md:h-11">
                    Xem hồ sơ bệnh án
                </Link>
            ),
        },
    ];

    return (
        <>
            <PageHeader
                id={TITLE_ID}
                title="Hồ sơ bệnh án"
                description={!loading && !result.failed ? `Bệnh nhân bạn đã khám hoặc có lịch hẹn với bạn · ${result.total} bệnh nhân` : "Bệnh nhân bạn đã khám hoặc có lịch hẹn với bạn"}
            />
            {result.failed && !loading && (
                <div role="alert" className="alert alert-danger mb-5 flex-wrap items-center justify-between">
                    <span>{GENERIC_ERROR_MESSAGE}</span>
                    <button type="button" className="btn btn-secondary" onClick={() => setVersion((current) => current + 1)}>
                        Thử lại
                    </button>
                </div>
            )}
            <section aria-labelledby={TITLE_ID} className="card-app flex flex-col gap-4 p-0">
                <div className="px-5 pt-5">
                    <SearchInput
                        id="doctor-patients-search"
                        label="Tìm bệnh nhân"
                        placeholder="Tìm theo tên, mã bệnh nhân hoặc số điện thoại"
                        value={search}
                        onChange={changeSearch}
                        className="w-full"
                    />
                </div>
                <DataTable
                    className="rounded-t-none border-x-0 border-b-0"
                    columns={columns}
                    rows={loading ? [] : result.items}
                    labelledBy={TITLE_ID}
                    loading={loading}
                    empty={query.keyword ? "Không có bệnh nhân nào khớp với từ khoá." : "Bạn chưa có bệnh nhân nào."}
                    footer={!loading && result.total > 0 && <ListFooter list={list} label="Phân trang hồ sơ bệnh án" />}
                />
            </section>
        </>
    );
};

export default DoctorPatientsPage;

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import ImagingHistoryDetailDialog from "@/components/imagingTechnician/ImagingHistoryDetailDialog";
import ImagingHistoryTable from "@/components/imagingTechnician/ImagingHistoryTable";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import useAsync from "@/hooks/useAsync";
import { usePageTitle } from "@/hooks/usePatientRecordNav";
import { getImagingHistory, getImagingHistoryDetail, releaseImagingHistoryPictures } from "@/services/imagingTechnicianService";
import { clinicToday } from "@/services/receptionService";
import { IMAGING_REQUEST_STATUSES, IMAGING_REQUEST_STATUS_LABELS, IMAGING_TYPE_LABELS } from "@/utils/imagingRequest";

const SEARCH_DELAY_MS = 300;
const TYPE_OPTIONS = Object.entries(IMAGING_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [IMAGING_REQUEST_STATUSES.COMPLETED, IMAGING_REQUEST_STATUSES.CANCELLED].map((value) => ({ value, label: IMAGING_REQUEST_STATUS_LABELS[value].label }));
const DEFAULT_RANGE = { from: clinicToday(-6), to: clinicToday() };

const ImagingHistoryPage = () => {
    usePageTitle("Lịch sử chụp chiếu – OZE");
    const [searchInput, setSearchInput] = useState("");
    const [keyword, setKeyword] = useState("");
    const [imagingType, setImagingType] = useState("");
    const [status, setStatus] = useState("");
    const [range, setRange] = useState(DEFAULT_RANGE);
    const [page, setPage] = useState(1);
    const [detail, setDetail] = useState(null);

    const { loading, value: result } = useAsync(
        () => getImagingHistory({ keyword, imagingType, status, from: range.from, to: range.to, page }),
        [keyword, imagingType, status, range, page],
    );

    useEffect(() => {
        const next = searchInput.trim();
        if (next === keyword) return undefined;
        const timer = setTimeout(() => {
            setKeyword(next);
            setPage(1);
        }, SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [searchInput, keyword]);

    const data = result?.success ? result.data : null;
    const filtered = Boolean(keyword || imagingType || status || range.from !== DEFAULT_RANGE.from || range.to !== DEFAULT_RANGE.to);

    const change = (setter) => (value) => {
        setter(value);
        setPage(1);
    };
    const changeDate = (key) => (event) => {
        setRange((current) => ({ ...current, [key]: event.target.value }));
        setPage(1);
    };
    const clear = () => {
        setSearchInput("");
        setKeyword("");
        setImagingType("");
        setStatus("");
        setRange(DEFAULT_RANGE);
        setPage(1);
    };
    const closeDetail = () => {
        releaseImagingHistoryPictures(detail);
        setDetail(null);
    };
    const openDetail = async (row) => {
        const response = await getImagingHistoryDetail(row.id);
        if (response.success) setDetail(response.data);
        else toast.error(response.message);
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="page-header mb-0">
                <div>
                    <h1 className="page-title">Lịch sử chụp chiếu</h1>
                    <p className="page-description">Chỉ định đã chụp hoặc đã bị bác sĩ huỷ{data ? ` · ${data.totalItems} lượt` : ""}</p>
                </div>
            </div>

            <FilterBar canClear={filtered} onClear={clear}>
                <SearchInput
                    id="imaging-history-search"
                    label="Tìm lượt chụp"
                    placeholder="Tên, mã bệnh nhân hoặc mã chỉ định"
                    value={searchInput}
                    onChange={setSearchInput}
                    className={FILTER_SEARCH_CLASS}
                />
                <FilterSelect id="imaging-history-type" label="Loại chụp" options={TYPE_OPTIONS} value={imagingType} onChange={change(setImagingType)} className={FILTER_SELECT_CLASS} />
                <label className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="shrink-0 text-body-sm text-muted">Từ</span>
                    <input type="date" className="input w-full sm:w-auto" max={range.to || undefined} value={range.from} onChange={changeDate("from")} aria-label="Từ ngày" />
                </label>
                <label className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="shrink-0 text-body-sm text-muted">đến</span>
                    <input type="date" className="input w-full sm:w-auto" min={range.from || undefined} value={range.to} onChange={changeDate("to")} aria-label="Đến ngày" />
                </label>
                <FilterSelect id="imaging-history-status" label="Trạng thái" options={STATUS_OPTIONS} value={status} onChange={change(setStatus)} className={FILTER_SELECT_CLASS} />
            </FilterBar>

            {!loading && result && !result.success && (
                <p role="alert" className="alert alert-danger">
                    {result.message || "Không tải được lịch sử chụp chiếu."}
                </p>
            )}

            <div>
                <ImagingHistoryTable rows={data?.items ?? []} loading={loading} filtered={filtered} onView={openDetail} />
                {data?.totalPages > 1 && (
                    <div className="mt-4 flex justify-end">
                        <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} label="Phân trang lịch sử chụp chiếu" />
                    </div>
                )}
            </div>

            {detail && <ImagingHistoryDetailDialog detail={detail} onClose={closeDetail} />}
        </div>
    );
};

export default ImagingHistoryPage;

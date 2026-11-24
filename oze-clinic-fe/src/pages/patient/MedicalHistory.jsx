import { useState } from "react";
import ExaminationHistoryTable from "@/components/medicalRecord/ExaminationHistoryTable";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import ListFooter from "@/components/ui/ListFooter";
import PageHeader from "@/components/ui/PageHeader";
import PageLoadState from "@/components/ui/PageLoadState";
import SearchInput from "@/components/ui/SearchInput";
import SortSelect from "@/components/ui/SortSelect";
import useMedicalBook from "@/hooks/useMedicalBook";
import usePagedList from "@/hooks/usePagedList";
import { norm } from "@/utils/medicalRecord";

const TITLE_ID = "medical-history-title";
const SORT_OPTIONS = [
    { value: "new", label: "Ngày khám mới nhất" },
    { value: "old", label: "Ngày khám cũ nhất" },
];

// "Lịch sử khám" (Figma 1240:3983): the visits recorded by the doctors, each opening its detail page.
const MedicalHistory = () => {
    const book = useMedicalBook();
    const [search, setSearch] = useState("");
    const [doctor, setDoctor] = useState("");
    const [sort, setSort] = useState("new");

    const visits = (book.data?.visits ?? []).map((visit) => ({ examinationId: visit.id, date: visit.isoDate, serviceName: visit.service, doctorName: visit.doctor }));
    const doctors = [...new Set(visits.map((visit) => visit.doctorName).filter(Boolean))].map((name) => ({ value: name, label: name }));
    const keyword = norm(search.trim());
    const rows = visits
        .filter((visit) => (!keyword || norm(visit.serviceName).includes(keyword)) && (!doctor || visit.doctorName === doctor))
        .sort((a, b) => (sort === "new" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
    const list = usePagedList(rows, { resetKey: `${keyword}|${doctor}|${sort}` });
    const filtered = Boolean(keyword || doctor || sort !== "new");

    const clear = () => {
        setSearch("");
        setDoctor("");
        setSort("new");
    };

    return (
        <>
            <PageHeader id={TITLE_ID} title="Lịch sử khám" description="Các lần khám tại Oze Clinic do bác sĩ ghi nhận." />
            <PageLoadState status={book.status} onRetry={book.reload} />
            {book.data && (
                <div className="flex flex-col gap-4">
                    <FilterBar canClear={filtered} onClear={clear}>
                        <SearchInput id="medical-history-search" label="Tìm theo dịch vụ" placeholder="Tìm theo dịch vụ" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                        <FilterSelect id="medical-history-doctor" label="Bác sĩ phụ trách" allLabel="Tất cả bác sĩ" options={doctors} value={doctor} onChange={setDoctor} className={FILTER_SELECT_CLASS} />
                        <SortSelect id="medical-history-sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                    </FilterBar>
                    <ExaminationHistoryTable
                        visits={list.rows}
                        offset={list.offset}
                        labelledBy={TITLE_ID}
                        empty={visits.length ? "Không có lần khám phù hợp." : "Bạn chưa có lần khám nào."}
                        footer={list.total > 0 && <ListFooter list={list} label="Phân trang lịch sử khám" />}
                    />
                </div>
            )}
        </>
    );
};

export default MedicalHistory;

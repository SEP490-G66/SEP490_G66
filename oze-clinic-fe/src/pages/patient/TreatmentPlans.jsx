import { useState } from "react";
import TreatmentPlanTable from "@/components/treatmentPlan/TreatmentPlanTable";
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
import { MEDICAL_RECORD_PLAN_STATUS } from "@/utils/messages";

const TITLE_ID = "treatment-plans-title";
const SORT_OPTIONS = [
    { value: "new", label: "Ngày lập mới nhất" },
    { value: "old", label: "Ngày lập cũ nhất" },
];
const STATUS_OPTIONS = Object.entries(MEDICAL_RECORD_PLAN_STATUS).map(([value, meta]) => ({ value, label: meta.label }));

// Shape for TreatmentPlanTable. TODO(api): pay type of a plan is not returned yet (column hidden).
const toPlanRow = (plan) => ({
    id: plan.id,
    name: plan.variant,
    doctorName: plan.doctor,
    sessionCount: plan.stages.filter((stage) => !stage.cancelled).length,
    createdAt: plan.createdAt,
    statusKey: plan.status,
    status: MEDICAL_RECORD_PLAN_STATUS[plan.status] ?? null,
});

// "Kế hoạch điều trị" (Figma 1240:4408): plans the doctor made after the patient agreed at the clinic.
const TreatmentPlans = () => {
    const book = useMedicalBook();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [sort, setSort] = useState("new");

    const plans = (book.data?.plans ?? []).map(toPlanRow);
    const keyword = norm(search.trim());
    const rows = plans
        .filter((plan) => (!keyword || norm(`${plan.name} ${plan.doctorName}`).includes(keyword)) && (!status || plan.statusKey === status))
        .sort((a, b) => (sort === "new" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)));
    const list = usePagedList(rows, { resetKey: `${keyword}|${status}|${sort}` });
    const filtered = Boolean(keyword || status || sort !== "new");

    const clear = () => {
        setSearch("");
        setStatus("");
        setSort("new");
    };

    return (
        <>
            <PageHeader id={TITLE_ID} title="Kế hoạch điều trị" description="Kế hoạch do bác sĩ lập sau khi đã thống nhất với bạn tại phòng khám." />
            <PageLoadState status={book.status} onRetry={book.reload} />
            {book.data && (
                <div className="flex flex-col gap-4">
                    <FilterBar canClear={filtered} onClear={clear}>
                        <SearchInput id="treatment-plans-search" label="Tìm theo dịch vụ, bác sĩ" placeholder="Tìm theo dịch vụ, bác sĩ" value={search} onChange={setSearch} className={FILTER_SEARCH_CLASS} />
                        <FilterSelect id="treatment-plans-status" label="Trạng thái" allLabel="Tất cả trạng thái" options={STATUS_OPTIONS} value={status} onChange={setStatus} className={FILTER_SELECT_CLASS} />
                        <SortSelect id="treatment-plans-sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
                    </FilterBar>
                    <TreatmentPlanTable
                        plans={list.rows}
                        offset={list.offset}
                        labelledBy={TITLE_ID}
                        empty={plans.length ? "Không có kế hoạch phù hợp." : "Bạn chưa có kế hoạch điều trị nào."}
                        footer={list.total > 0 && <ListFooter list={list} label="Phân trang kế hoạch điều trị" />}
                    />
                </div>
            )}
        </>
    );
};

export default TreatmentPlans;

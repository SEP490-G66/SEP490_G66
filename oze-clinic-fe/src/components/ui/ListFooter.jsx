import Pagination from "@/components/ui/Pagination";

// Bottom row of a list table: "Hiển thị 1–10 trong 11 bản ghi" + page buttons. Pass the object from usePagedList.
const ListFooter = ({ list, label = "Phân trang" }) => (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <p className="num">
            Hiển thị {list.from}–{list.to} trong {list.total} bản ghi
        </p>
        {list.totalPages > 1 && <Pagination page={list.page} totalPages={list.totalPages} onChange={list.setPage} label={label} />}
    </div>
);

export default ListFooter;

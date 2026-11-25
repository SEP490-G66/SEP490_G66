import { useState } from "react";

// Client-side paging of an already filtered and sorted list. resetKey: anything that changes the list
// (search, filters, sort) so the page goes back to 1 without an effect.
const usePagedList = (rows, { pageSize = 10, resetKey = "" } = {}) => {
    const [state, setState] = useState({ page: 1, key: resetKey });
    const requested = state.key === resetKey ? state.page : 1;
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requested, totalPages);
    const offset = (page - 1) * pageSize;
    return {
        page,
        totalPages,
        total,
        offset,
        from: total ? offset + 1 : 0,
        to: Math.min(offset + pageSize, total),
        rows: rows.slice(offset, offset + pageSize),
        setPage: (next) => setState({ page: next, key: resetKey }),
    };
};

export default usePagedList;

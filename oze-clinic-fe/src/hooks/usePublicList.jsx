import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

// ?page= as a whole number ≥ 1, or 1.
const pageFrom = (value) => {
    const page = Number(value);
    return Number.isInteger(page) && page >= 1 ? page : 1;
};

const withParam = (current, key, value) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
};

// Search + pages of a public list kept in the address bar (?q=&page=), e.g. /services, /doctors.
// search(keyword) returns every matching item; the hook cuts the current page.
const usePublicList = (search, pageSize) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get("q") ?? "";
    const matches = search(keyword);
    const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
    const requestedPage = searchParams.get("page");
    const page = Math.min(pageFrom(requestedPage), totalPages);

    // A wrong ?page= (not a number, 0, past the last page) is corrected in the address bar.
    useEffect(() => {
        if (requestedPage === null || requestedPage === String(page)) return;
        setSearchParams((current) => withParam(current, "page", page === 1 ? null : String(page)), { replace: true });
    }, [requestedPage, page, setSearchParams]);

    // Typing replaces the history entry and goes back to page 1.
    const setKeyword = (value) =>
        setSearchParams((current) => withParam(withParam(current, "q", value), "page", null), { replace: true });

    const setPage = (target) => setSearchParams((current) => withParam(current, "page", target === 1 ? null : String(target)));

    return {
        keyword,
        page,
        totalPages,
        total: matches.length,
        items: matches.slice((page - 1) * pageSize, page * pageSize),
        setKeyword,
        setPage,
    };
};

export default usePublicList;

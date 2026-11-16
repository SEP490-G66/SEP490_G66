import { useEffect, useRef } from "react";
import { SearchX } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import ImageCard from "@/components/ui/ImageCard";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import { searchServices } from "@/services/dentalService";
import { PUBLIC_SERVICE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getServiceDetailRoute } from "@/utils/routes";

// 10 cards fill whole rows with 1, 2 or 5 columns (the grid below), so no row is left half empty.
const PAGE_SIZE = 10;
const SEARCH_ID = "service-search";
const TITLE_ID = "service-list-title";

const BREADCRUMB = [{ label: TEXT.HOME, href: ROUTES.HOME }, { label: TEXT.SERVICES }];

// ?page= as a whole number ≥ 1, or 1.
const pageFrom = (value) => {
    const page = Number(value);
    return Number.isInteger(page) && page >= 1 ? page : 1;
};

// /services?q=&page= — every public service (fixed content), searchable, 10 per page.
const ServiceList = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const gridRef = useRef(null);
    const keyword = searchParams.get("q") ?? "";
    const services = searchServices(keyword);
    const totalPages = Math.max(1, Math.ceil(services.length / PAGE_SIZE));
    const requestedPage = searchParams.get("page");
    const page = Math.min(pageFrom(requestedPage), totalPages);
    const pageItems = services.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    // A wrong ?page= (not a number, 0, past the last page) is corrected in the address bar.
    useEffect(() => {
        if (requestedPage === null || requestedPage === String(page)) return;
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (page === 1) next.delete("page");
                else next.set("page", String(page));
                return next;
            },
            { replace: true },
        );
    }, [requestedPage, page, setSearchParams]);

    const changeKeyword = (value) =>
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (value) next.set("q", value);
                else next.delete("q");
                next.delete("page");
                return next;
            },
            { replace: true },
        );

    const changePage = (target) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (target === 1) next.delete("page");
            else next.set("page", String(target));
            return next;
        });
        gridRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };

    return (
        <div className="bg-canvas">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={BREADCRUMB} />
            </div>

            <section aria-labelledby={TITLE_ID} className="container-public flex flex-col gap-8 pb-12 md:pb-16">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <h1 id={TITLE_ID} className="font-heading text-display-section text-ink">
                        {TEXT.LIST_TITLE}
                    </h1>
                    <SearchInput
                        id={SEARCH_ID}
                        label={TEXT.SEARCH_LABEL}
                        placeholder={TEXT.SEARCH_PLACEHOLDER}
                        value={keyword}
                        onChange={changeKeyword}
                        className="w-full md:max-w-sm"
                    />
                </div>

                {pageItems.length > 0 ? (
                    <>
                        <ul
                            ref={gridRef}
                            aria-label={TEXT.LIST_LABEL}
                            className="grid scroll-mt-24 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5"
                        >
                            {pageItems.map((service) => (
                                <li key={service.slug} className="flex">
                                    <ImageCard
                                        imageUrl={service.imageUrl}
                                        imageAlt={service.name}
                                        title={service.name}
                                        description={service.summary}
                                        to={getServiceDetailRoute(service.slug)}
                                        className="w-full"
                                    />
                                </li>
                            ))}
                        </ul>
                        {totalPages > 1 && (
                            <div className="flex justify-center">
                                <Pagination page={page} totalPages={totalPages} onChange={changePage} label={TEXT.PAGINATION_LABEL} />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="empty-state" role="status">
                        <SearchX className="empty-state-icon" aria-hidden="true" />
                        <p className="empty-state-title">{TEXT.NO_RESULT(keyword.trim())}</p>
                        <p className="empty-state-text">{TEXT.NO_RESULT_HINT}</p>
                        <button type="button" className="btn btn-secondary mt-4" onClick={() => changeKeyword("")}>
                            {TEXT.CLEAR_SEARCH}
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
};

export default ServiceList;

import { useRef } from "react";
import { AlertCircle, Inbox, Search, Send } from "lucide-react";
import UnlinkedProfileCard from "@/components/patientDebt/UnlinkedProfileCard";
import PatientRefundTable from "@/components/refund/PatientRefundTable";
import RefundRequestCreateModal from "@/components/refund/RefundRequestCreateModal";
import RefundRequestDetailModal from "@/components/refund/RefundRequestDetailModal";
import FilterBar, { FILTER_SEARCH_CLASS, FILTER_SELECT_CLASS } from "@/components/ui/FilterBar";
import FilterSelect from "@/components/ui/FilterSelect";
import SortSelect from "@/components/ui/SortSelect";
import useRefundRequestNavigation from "@/hooks/useRefundRequestNavigation";
import { cx } from "@/utils/cx";
import { REFUND_REQUEST_TEXT } from "@/utils/messages";
import {
    REFUND_CREATE_ID,
    REFUND_DEFAULT_SORT,
    REFUND_REQUEST_STATUS_LABELS,
    REFUND_RETRY_ID,
    REFUND_SEARCH_ID,
    REFUND_SORTS,
    REFUND_STATUSES,
    REFUND_TITLE_ID,
    refundLiveText,
} from "@/utils/refundRequest";

const STATUS_OPTIONS = REFUND_STATUSES.map((status) => ({ value: status, label: REFUND_REQUEST_STATUS_LABELS[status].label }));

const TITLE_CLASS = "page-title outline-none focus-visible:shadow-none";

const focusById = (id) => document.getElementById(id)?.focus({ preventScroll: true });

const StateBox = ({ icon: Icon, title, text, children }) => (
    <section className="card-app p-0">
        <div className="empty-state">
            <Icon className="empty-state-icon" aria-hidden="true" />
            <h2 className="empty-state-title">{title}</h2>
            <p className="empty-state-text">{text}</p>
            {children}
        </div>
    </section>
);

const LoadingSkeleton = () => (
    <section className="card-app p-0" aria-busy="true" aria-label={REFUND_REQUEST_TEXT.LOADING}>
        <div className="border-b border-border px-5 py-3">
            <div className="skeleton h-8" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="px-5 py-3">
                <div className="skeleton h-12" />
            </div>
        ))}
    </section>
);

const RefundRequests = () => {
    const {
        load,
        requests,
        view,
        ui,
        setUi,
        h1Ref,
        closeButtonRef,
        navEventKey,
        detailOpen,
        showCreate,
        pickState,
        pickUrl,
        updateList,
        changePage,
        retry: reload,
        closeDetail,
        isCurrentNav,
        openCreate,
        closeCreate,
        onSendingChange,
        onUncertain,
        onInvoicesLoaded,
        onCreated,
    } = useRefundRequestNavigation();
    const composingAt = useRef(null);

    const ready = load.status === "ready";
    const hasData = ready && requests.length > 0;
    const { query } = view;

    const retry = () => {
        h1Ref.current?.focus({ preventScroll: true });
        reload();
    };

    const handleSearchChange = (event) => {
        const value = event.target.value;
        setUi({ searchInput: value });
        if (!event.nativeEvent.isComposing) updateList({ q: value });
    };

    const handleCompositionStart = () => {
        composingAt.current = navEventKey;
    };

    const resetFilters = () => {
        setUi({ searchInput: "", popover: null });
        updateList({ q: "", status: [], sort: REFUND_DEFAULT_SORT });
        focusById(REFUND_SEARCH_ID);
    };

    const handleCompositionEnd = (event) => {
        const kept = composingAt.current === navEventKey;
        composingAt.current = null;
        if (kept) updateList({ q: event.currentTarget.value });
        else setUi({ searchInput: query.q });
    };


    return (
        <>
            <div className="page-header">
                <div>
                    <h1 id={REFUND_TITLE_ID} ref={h1Ref} tabIndex={-1} className={TITLE_CLASS}>
                        {REFUND_REQUEST_TEXT.TITLE}
                    </h1>
                    <p className="page-description">{REFUND_REQUEST_TEXT.DESCRIPTION}</p>
                </div>
                {showCreate && (
                    <button id={REFUND_CREATE_ID} type="button" className="btn btn-primary" onClick={openCreate}>
                        <Send className="size-4" aria-hidden="true" />
                        {REFUND_REQUEST_TEXT.CREATE}
                    </button>
                )}
            </div>
            <p className="sr-only" role="status">
                {refundLiveText({ view, hasData: ready, live: ui.live })}
            </p>
            {load.status === "loading" && <LoadingSkeleton />}
            {load.status === "error" && (
                <StateBox icon={AlertCircle} title={REFUND_REQUEST_TEXT.ERROR_TITLE} text={REFUND_REQUEST_TEXT.ERROR_TEXT}>
                    <button id={REFUND_RETRY_ID} type="button" className="btn btn-secondary mt-3" onClick={retry}>
                        {REFUND_REQUEST_TEXT.RETRY}
                    </button>
                </StateBox>
            )}
            {load.status === "unlinked" && <UnlinkedProfileCard />}
            {ready && !hasData && <StateBox icon={Inbox} title={REFUND_REQUEST_TEXT.EMPTY_TITLE} text={REFUND_REQUEST_TEXT.EMPTY_TEXT} />}
            {hasData && (
                <div className="flex flex-col gap-4">
                    <FilterBar canClear={Boolean(query.q || query.status.length || query.sort !== REFUND_DEFAULT_SORT)} onClear={resetFilters}>
                        <div className={cx("search", FILTER_SEARCH_CLASS)}>
                            <label htmlFor={REFUND_SEARCH_ID} className="sr-only">
                                Tìm theo mã yêu cầu, nội dung
                            </label>
                            <Search aria-hidden="true" />
                            <input
                                id={REFUND_SEARCH_ID}
                                type="search"
                                className="input"
                                placeholder="Tìm theo mã yêu cầu, nội dung"
                                value={ui.searchInput}
                                onChange={handleSearchChange}
                                onCompositionStart={handleCompositionStart}
                                onCompositionEnd={handleCompositionEnd}
                            />
                        </div>
                        <FilterSelect
                            id="refund-requests-status"
                            label="Trạng thái"
                            allLabel="Tất cả trạng thái"
                            options={STATUS_OPTIONS}
                            value={query.status[0] ?? ""}
                            onChange={(value) => updateList({ status: value ? [value] : [] })}
                            className={FILTER_SELECT_CLASS}
                        />
                        <SortSelect id="refund-requests-sort-select" options={REFUND_SORTS} value={query.sort} onChange={(sort) => updateList({ sort })} />
                    </FilterBar>
                    <PatientRefundTable view={view} labelledBy={REFUND_TITLE_ID} pickUrl={pickUrl} pickState={pickState} onPageChange={changePage} />
                </div>
            )}
            {detailOpen && <RefundRequestDetailModal key={query.request} request={view.selected} code={query.request} closeButtonRef={closeButtonRef} onClose={closeDetail} />}
            {ui.createOpen && (
                <RefundRequestCreateModal
                    navKey={navEventKey}
                    isCurrentNav={isCurrentNav}
                    onInvoicesLoaded={onInvoicesLoaded}
                    onSendingChange={onSendingChange}
                    onUncertain={onUncertain}
                    onCreated={onCreated}
                    onClose={closeCreate}
                />
            )}
        </>
    );
};

export default RefundRequests;

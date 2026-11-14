import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { UserPlus } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import PatientListTable from "@/components/reception/PatientListTable";
import PatientListToolbar from "@/components/reception/PatientListToolbar";
import { Card } from "@/components/reception/shared";
import { useDebounced, useFocusOnEnter, usePageTitle, usePatientRecordNav } from "@/hooks/usePatientRecordNav";
import { clinicToday, getPatients } from "@/services/receptionService";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { LIST_SORTS, listSearch, readListUrl, searchKeywordOf } from "@/utils/patientRecord";
import { RECEPTION_PATIENT_CREATE_ROUTE, ROUTES } from "@/utils/routes";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 300;
const CRUMBS = [{ label: TEXT.PATIENTS_CRUMB }, { label: TEXT.TITLE }];

const ReceptionPatients = () => {
    const nav = usePatientRecordNav();
    const { loadKey, kind, navigateSelf, location } = nav;
    const { query, fixed } = readListUrl(location.search);
    const canonical = listSearch(query);
    const [retry, setRetry] = useState(0);
    const resultKey = `${loadKey}|${canonical}|${retry}`;
    const [result, setResult] = useState(null);
    const [box, setBox] = useState({ forKey: loadKey, value: query.q });
    const h1Ref = useFocusOnEnter(loadKey, kind);
    const countRef = useRef(null);
    const latest = useRef({ query, navigateSelf });
    const clamped = useRef(null);
    const normalized = useRef(null);
    const debounce = useDebounced(SEARCH_DELAY_MS);
    const { cancel } = debounce;

    usePageTitle(TEXT.DOC_TITLE_LIST);

    let searchValue = box.value;
    if (box.forKey !== loadKey) {
        searchValue = query.q;
        setBox({ forKey: loadKey, value: query.q });
    }

    useEffect(() => {
        latest.current = { query, navigateSelf };
    });

    useEffect(() => {
        cancel();
    }, [loadKey, cancel]);

    useEffect(() => {
        if (!fixed || normalized.current === loadKey) return;
        normalized.current = loadKey;
        navigateSelf(`${ROUTES.RECEPTION_PATIENTS}${canonical}`, { replace: true });
    }, [fixed, loadKey, canonical, navigateSelf]);

    useEffect(() => {
        const controller = new AbortController();
        const { q, gender, sort, page } = readListUrl(canonical).query;
        const order = LIST_SORTS[sort];
        getPatients(
            { keyword: q ? searchKeywordOf(q) : undefined, gender, sortBy: order.sortBy, sortDescending: order.sortDescending, page, pageSize: PAGE_SIZE },
            { skipErrorPage: true, signal: controller.signal },
        ).then((response) => {
            if (response.aborted || controller.signal.aborted) return;
            setResult({ key: resultKey, ok: response.success, data: response.success ? response.data : null });
        });
        return () => controller.abort();
    }, [resultKey, canonical]);

    const current = result?.key === resultKey ? result : null;
    const status = current ? (current.ok ? "ready" : "error") : "loading";
    const data = current?.ok ? current.data : null;
    const lastData = result?.ok ? result.data : null;

    useEffect(() => {
        if (status !== "ready" || !data) return;
        const totalPages = Math.max(1, Number(data.totalPages ?? 1));
        const scope = `${loadKey}|${query.q}|${query.gender}|${query.sort}`;
        if (query.page > totalPages && clamped.current !== scope) {
            clamped.current = scope;
            navigateSelf(`${ROUTES.RECEPTION_PATIENTS}${listSearch({ ...query, page: totalPages })}`, { replace: true });
        }
    }, [status, data, loadKey, query, navigateSelf]);

    useEffect(() => {
        if (status === "loading" || kind !== "self") return;
        const active = document.activeElement;
        if (!active || active === document.body || !document.contains(active)) {
            (countRef.current ?? h1Ref.current)?.focus();
        }
    }, [status, resultKey, kind, h1Ref]);

    const go = (patch, { replace = false } = {}) => {
        cancel();
        const next = { ...query, q: searchValue, page: 1, ...patch };
        navigateSelf(`${ROUTES.RECEPTION_PATIENTS}${listSearch(next)}`, { replace });
    };

    const scheduleSearch = (value) =>
        debounce.schedule(() => {
            const { query: now, navigateSelf: goSelf } = latest.current;
            goSelf(`${ROUTES.RECEPTION_PATIENTS}${listSearch({ ...now, q: value, page: 1 })}`, { replace: true });
        });

    const filtered = Boolean(query.q || query.gender);
    const countText = status === "ready" ? TEXT.COUNT(data.items.length, data.totalCount) : status === "loading" ? TEXT.LOADING : "";
    const pagerSource = data ?? lastData;
    const pager = pagerSource ? { page: data ? query.page : Math.min(query.page, Math.max(1, pagerSource.totalPages)), totalPages: pagerSource.totalPages } : null;
    const linkState = nav.linkState();

    return (
        <div className="app-content min-h-full">
            <Breadcrumb items={CRUMBS} className="mb-2" />
            <header className="page-header">
                <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                    {TEXT.TITLE}
                </h1>
                <Link to={RECEPTION_PATIENT_CREATE_ROUTE} state={linkState} className="btn btn-primary">
                    <UserPlus className="size-4" aria-hidden="true" /> {TEXT.CREATE}
                </Link>
            </header>
            <Card>
                <div>
                    <PatientListToolbar
                        search={searchValue}
                        onSearchChange={(value, composing) => {
                            setBox({ forKey: loadKey, value });
                            if (!composing) scheduleSearch(value);
                        }}
                        onSearchCompositionEnd={(value) => scheduleSearch(value)}
                        onSearchClear={() => {
                            setBox({ forKey: loadKey, value: "" });
                            go({ q: "" });
                        }}
                        gender={query.gender}
                        onGender={(gender) => go({ gender })}
                        sort={query.sort}
                        onSort={(sort) => go({ sort })}
                        onClearAll={() => {
                            setBox({ forKey: loadKey, value: "" });
                            go({ q: "", gender: "" });
                        }}
                        countText={countText}
                        countRef={countRef}
                        hasQuery={Boolean(query.q)}
                    />
                    <PatientListTable
                        status={status}
                        data={data}
                        today={clinicToday()}
                        filtered={filtered}
                        onRetry={() => setRetry((n) => n + 1)}
                        onClearAll={() => {
                            setBox({ forKey: loadKey, value: "" });
                            go({ q: "", gender: "" });
                        }}
                        onPage={(page) => go({ page })}
                        pager={pager}
                        linkState={linkState}
                    />
                </div>
            </Card>
        </div>
    );
};

export default ReceptionPatients;

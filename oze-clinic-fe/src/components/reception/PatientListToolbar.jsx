import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { GENDER_OPTIONS, LIST_SORTS, SEARCH_MAX_LENGTH } from "@/utils/patientRecord";

const PatientListToolbar = ({ search, onSearchChange, onSearchCompositionEnd, onSearchClear, gender, onGender, sort, onSort, onClearAll, countText, countRef, hasQuery }) => {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef(null);
    const panelRef = useRef(null);
    const activeCount = gender ? 1 : 0;

    useEffect(() => {
        if (!open) return;
        const target = panelRef.current?.querySelector("input:checked") ?? panelRef.current?.querySelector("input, button");
        target?.focus();
    }, [open]);

    const closePanel = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    return (
        <div className="space-y-3 px-5 py-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="relative min-w-64 flex-1">
                    <label htmlFor="pr-search" className="sr-only">
                        {TEXT.SEARCH_LABEL}
                    </label>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input
                        id="pr-search"
                        type="search"
                        className="input pr-10 pl-9"
                        aria-label={TEXT.SEARCH_LABEL}
                        placeholder={TEXT.SEARCH_PLACEHOLDER}
                        maxLength={SEARCH_MAX_LENGTH}
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value, event.nativeEvent?.isComposing === true)}
                        onCompositionEnd={(event) => onSearchCompositionEnd(event.currentTarget.value)}
                    />
                    {search && (
                        <button
                            type="button"
                            className="btn btn-icon absolute top-1/2 right-1 size-8 -translate-y-1/2 hover:bg-surface-tint"
                            aria-label={TEXT.SEARCH_CLEAR}
                            title={TEXT.SEARCH_CLEAR}
                            onClick={onSearchClear}
                        >
                            <X className="size-4" aria-hidden="true" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <button
                        ref={buttonRef}
                        type="button"
                        className="btn btn-secondary"
                        aria-expanded={open}
                        aria-controls="pr-filter-panel"
                        onClick={() => setOpen((v) => !v)}
                    >
                        <SlidersHorizontal className="size-4" aria-hidden="true" />
                        {activeCount ? TEXT.FILTER_COUNT(activeCount) : TEXT.FILTER}
                    </button>
                    {open && (
                        <div
                            ref={panelRef}
                            id="pr-filter-panel"
                            className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-canvas p-4 shadow-lg"
                            onKeyDown={(event) => {
                                if (event.key !== "Escape") return;
                                event.preventDefault();
                                closePanel();
                            }}
                        >
                            <fieldset className="field">
                                <legend className="label">{TEXT.FILTER_GENDER}</legend>
                                <div className="flex flex-wrap gap-4 pt-1">
                                    {GENDER_OPTIONS.map((code) => (
                                        <label key={code} className="flex items-center gap-2 text-body-sm">
                                            <input type="radio" name="pr-gender" checked={gender === code} onChange={() => onGender(code)} />
                                            {TEXT.GENDER_LABELS[code]}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <div className="mt-3 flex justify-end">
                                <button type="button" className="btn btn-link" onClick={() => onGender("")}>
                                    {TEXT.FILTER_CLEAR_ONE}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-1">
                    <label htmlFor="pr-sort" className="text-caption text-muted">
                        {TEXT.SORT}
                    </label>
                    <select id="pr-sort" className="input w-auto" value={sort} onChange={(event) => onSort(event.target.value)}>
                        {Object.keys(LIST_SORTS).map((key) => (
                            <option key={key} value={key}>
                                {TEXT.SORT_OPTIONS[key]}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {(gender || hasQuery) && (
                <div className="flex flex-wrap items-center gap-2">
                    {gender && (
                        <span className="chip-queue">
                            {TEXT.FILTER_CHIP_GENDER(TEXT.GENDER_LABELS[gender])}
                            <button
                                type="button"
                                className="btn btn-icon size-6 hover:bg-surface-tint"
                                aria-label={TEXT.FILTER_CHIP_REMOVE(TEXT.FILTER_CHIP_GENDER(TEXT.GENDER_LABELS[gender]))}
                                onClick={() => onGender("")}
                            >
                                <X className="size-3" aria-hidden="true" />
                            </button>
                        </span>
                    )}
                    <button type="button" className="btn btn-link" onClick={onClearAll}>
                        {TEXT.CLEAR_FILTERS}
                    </button>
                </div>
            )}
            <p ref={countRef} role="status" tabIndex={-1} className="num min-h-5 text-body-sm text-muted outline-none">
                {countText}
            </p>
        </div>
    );
};

export default PatientListToolbar;

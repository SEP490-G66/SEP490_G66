import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { getPatients } from "@/services/receptionService";
import { dmy } from "@/utils/calendar";
import { BILLING_TEXT as TEXT } from "@/utils/messages";
import { phoneDisplay, searchKeywordOf } from "@/utils/patientRecord";
import { cx } from "@/utils/cx";

const PAGE_SIZE = 5;
const DEBOUNCE_MS = 300;

const detailOf = (patient) =>
    [patient.patientCode, patient.phoneNumber ? phoneDisplay(patient.phoneNumber) : null, patient.dateOfBirth ? TEXT.PATIENT_DOB(dmy(String(patient.dateOfBirth).slice(0, 10))) : null]
        .filter(Boolean)
        .join(" · ");

const searchPatients = (keyword, config) => getPatients({ keyword, page: 1, pageSize: PAGE_SIZE }, config);

const PatientPicker = ({
    inputId,
    value,
    onChange,
    disabled,
    error,
    errorId,
    search = searchPatients,
    normalize = searchKeywordOf,
    label = TEXT.PATIENT,
    required = true,
    placeholder = TEXT.PATIENT_PLACEHOLDER,
    limit,
    limitText,
}) => {
    const listId = useId();
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const changeRef = useRef(null);
    const focusAfter = useRef(null);
    const [text, setText] = useState("");
    const [retry, setRetry] = useState(0);
    const [found, setFound] = useState(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const keyword = text.trim() ? normalize(text) : "";
    const key = `${keyword}|${retry}`;

    useEffect(() => {
        if (!keyword) return undefined;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            search(keyword, { skipErrorPage: true, signal: controller.signal }).then((response) => {
                if (controller.signal.aborted || response.aborted) return;
                const items = response.success && Array.isArray(response.data?.items) ? response.data.items : [];
                setFound({ key, ok: response.success, items, total: response.success ? Number(response.data?.totalCount ?? items.length) : 0 });
            });
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [keyword, key, search]);

    useEffect(() => {
        const target = focusAfter.current;
        if (!target) return;
        focusAfter.current = null;
        (target === "change" ? changeRef : inputRef).current?.focus();
    }, [value]);

    const current = keyword && found?.key === key ? found : null;
    const items = current?.ok ? current.items : [];
    const more = current?.ok ? Math.max(0, current.total - items.length) : 0;
    const shown = open && Boolean(keyword);
    const activeIndex = Math.min(active, Math.max(0, items.length - 1));
    const capped = Boolean(limit && limitText && current?.ok && items.length >= limit);

    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [found]);

    useEffect(() => {
        const list = listRef.current;
        const item = shown ? list?.children[activeIndex] : null;
        if (!item) return;
        const top = item.offsetTop;
        const bottom = top + item.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }, [shown, activeIndex, found]);

    const pick = (patient) => {
        focusAfter.current = "change";
        setOpen(false);
        onChange(patient);
    };

    const onKeyDown = (event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            if (!items.length) return;
            event.preventDefault();
            setOpen(true);
            setActive((n) => {
                const from = Math.min(n, items.length - 1);
                return event.key === "ArrowDown" ? (from + 1) % items.length : (from - 1 + items.length) % items.length;
            });
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            if (shown && items[activeIndex]) pick(items[activeIndex]);
            return;
        }
        if (event.key === "Escape" && shown) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        }
    };

    if (value) {
        return (
            <div className="field">
                <span className={cx("label", required && "label-required")}>{label}</span>
                <div className="flex items-start gap-3 rounded-lg border border-primary bg-primary-soft px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{value.fullName}</p>
                        <p className="num text-caption text-muted">{detailOf(value)}</p>
                    </div>
                    <button
                        ref={changeRef}
                        type="button"
                        className="btn-link text-label"
                        disabled={disabled}
                        onClick={() => {
                            focusAfter.current = "input";
                            onChange(null);
                        }}
                    >
                        {TEXT.CHANGE}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="field">
            <label htmlFor={inputId} className={cx("label", required && "label-required")}>
                {label}
            </label>
            <div className="search">
                <Search aria-hidden="true" />
                <input
                    ref={inputRef}
                    id={inputId}
                    type="search"
                    className={cx("input", error && "input-error")}
                    placeholder={placeholder}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={shown && items.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={shown && items[activeIndex] ? `${listId}-${activeIndex}` : undefined}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    disabled={disabled}
                    value={text}
                    onChange={(event) => {
                        setText(event.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={onKeyDown}
                />
            </div>
            {error && (
                <p id={errorId} className="error-text">
                    {error}
                </p>
            )}
            {shown && !current && <div className="skeleton mt-1 h-11" aria-hidden="true" />}
            {shown && current && !current.ok && (
                <div role="alert" className="alert alert-danger mt-1 flex flex-wrap items-center gap-3">
                    <span className="flex-1">{TEXT.PATIENT_SEARCH_ERROR}</span>
                    <button type="button" className="btn btn-secondary h-9" onClick={() => setRetry((n) => n + 1)}>
                        {TEXT.RETRY}
                    </button>
                </div>
            )}
            {shown && current?.ok && !items.length && <p className="help-text">{TEXT.PATIENT_NONE}</p>}
            <ul ref={listRef} id={listId} role="listbox" aria-label={TEXT.PATIENT_RESULTS} className={cx("relative mt-1 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border", !(shown && items.length) && "hidden")}>
                {shown &&
                    items.map((patient, index) => (
                        <li
                            key={patient.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === activeIndex}
                            className={cx("cursor-pointer px-3 py-2.5 hover:bg-surface-tint", index === activeIndex && "bg-surface-tint")}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => pick(patient)}
                        >
                            <span className="block font-semibold text-ink">{patient.fullName}</span>
                            <span className="num block text-caption text-muted">{detailOf(patient)}</span>
                        </li>
                    ))}
            </ul>
            {shown && more > 0 && <p className="help-text">{TEXT.PATIENT_MORE(more)}</p>}
            {shown && capped && <p className="help-text">{limitText}</p>}
        </div>
    );
};

export default PatientPicker;

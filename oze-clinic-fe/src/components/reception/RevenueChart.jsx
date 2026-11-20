import { useEffect, useState } from "react";
import { Card } from "./shared";
import { clinicToday, getRevenueByDay } from "@/services/receptionService";
import { addDays, ddmm, dmy, weekdayIndex } from "@/utils/calendar";
import { DASHBOARD_TEXT as TEXT, SCHEDULE_TEXT } from "@/utils/messages";
import { cx } from "@/utils/cx";

const CASH = "var(--color-primary)";
const TRANSFER = "var(--color-chart-3)";
const W = 720;
const H = 250;
const LEFT = 48;
const TOP = 12;
const MAX_DAYS = 31;
const BOTTOM = 28;

const vnd = (value) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;
const dayName = (key) => `${SCHEDULE_TEXT.WEEKDAYS_SHORT[weekdayIndex(key)]} ${ddmm(key)}`;
const sumOf = (list) =>
    list.reduce(
        (s, x) => ({
            cash: s.cash + Number(x?.cash ?? 0),
            transfer: s.transfer + Number(x?.transfer ?? 0),
        }),
        { cash: 0, transfer: 0 },
    );

const RevenueChart = () => {
    const [today] = useState(clinicToday);
    const [range, setRange] = useState(() => ({
        from: addDays(today, -6),
        to: today,
    }));
    const [result, setResult] = useState(null);
    const [hover, setHover] = useState(null);

    const key = `${range.from}|${range.to}`;

    useEffect(() => {
        const controller = new AbortController();
        getRevenueByDay({ from: range.from, to: range.to }, { skipErrorPage: true, signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || response.aborted) return;
            setResult({
                key,
                ok: response.success,
                days: response.success ? (response.data?.days ?? []) : [],
            });
        });
        return () => controller.abort();
    }, [range, key]);

    const setDate = (field) => (value) => {
        if (!value) return;
        setRange((r) => {
            const next = { ...r, [field]: value };
            const span = MAX_DAYS - 1;
            if (field === "from") {
                if (next.to < value) next.to = value;
                if (next.to > addDays(value, span)) next.to = addDays(value, span) < today ? addDays(value, span) : today;
            } else {
                if (next.from > value) next.from = value;
                if (next.from < addDays(value, -span)) next.from = addDays(value, -span);
            }
            return next;
        });
    };

    const byDate = new Map((result?.days ?? []).map((d) => [d.date, d]));
    const keys = [];
    for (let k = range.from; k <= range.to; k = addDays(k, 1)) keys.push(k);
    const rows = keys.map((k) => ({
        key: k,
        ...sumOf([byDate.get(k)]),
        future: k > today,
    }));
    const total = sumOf(rows);

    const max = Math.max(1, ...rows.map((r) => r.cash + r.transfer));
    const step = Math.max(1, Math.ceil(max / 4 / 1e6)) * 1e6;
    const top = step * 4;
    const plotH = H - TOP - BOTTOM;
    const cw = (W - LEFT - 8) / Math.max(1, rows.length);
    const bw = Math.max(6, Math.min(40, cw - 18));
    const scale = (v) => (plotH * v) / top;

    const bar = (x, g) => {
        const parts = [];
        let y = H - BOTTOM;
        [
            ["cash", g.cash, CASH],
            ["transfer", g.transfer, TRANSFER],
        ].forEach(([name, value, color], n) => {
            const h = scale(value);
            if (h <= 0) return;
            const isTop = n === 1 || g.transfer === 0;
            const hh = Math.max(0, h - (n === 0 && g.transfer > 0 ? 2 : 0));
            y -= h;
            const r = Math.min(4, hh, bw / 2);
            parts.push(
                isTop ? (
                    <path key={name} d={`M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}h${bw - 2 * r}a${r},${r} 0 0 1 ${r},${r}V${y + h}z`} fill={color} />
                ) : (
                    <rect key={name} x={x} y={y + 2} width={bw} height={hh} fill={color} />
                ),
            );
        });
        return parts;
    };

    const hovered = hover && rows.find((r) => r.key === hover);

    return (
        <Card
            title={TEXT.REVENUE}
            actions={
                <div className="flex flex-1 flex-wrap items-center gap-3">
                    <span className="flex items-center gap-2">
                        <label htmlFor="rv-from" className="sr-only">
                            {TEXT.FROM}
                        </label>
                        <input id="rv-from" type="date" className="input w-auto" max={today} value={range.from} onChange={(e) => setDate("from")(e.target.value)} />
                        <span className="text-muted" aria-hidden="true">
                            –
                        </span>
                        <label htmlFor="rv-to" className="sr-only">
                            {TEXT.TO}
                        </label>
                        <input id="rv-to" type="date" className="input w-auto" max={today} value={range.to} onChange={(e) => setDate("to")(e.target.value)} />
                    </span>
                    <dl className="ml-auto flex flex-wrap items-end gap-6 text-right">
                        <div>
                            <dt className="text-caption text-muted">{TEXT.CASH}</dt>
                            <dd className="num m-0 font-semibold text-ink">{vnd(total.cash)}</dd>
                        </div>
                        <div>
                            <dt className="text-caption text-muted">{TEXT.TRANSFER}</dt>
                            <dd className="num m-0 font-semibold text-ink">{vnd(total.transfer)}</dd>
                        </div>
                        <div>
                            <dt className="text-caption text-muted">{TEXT.TOTAL}</dt>
                            <dd className="num m-0 font-heading text-heading-3 font-bold text-ink">{vnd(total.cash + total.transfer)}</dd>
                        </div>
                    </dl>
                </div>
            }
        >
            <div className="space-y-4 px-5 py-4">
                {result && !result.ok && result.key === key && (
                    <p role="alert" className="alert alert-danger">
                        {TEXT.REVENUE_ERROR}
                    </p>
                )}
                <div className="flex gap-4 text-caption text-body">
                    {[
                        [TEXT.CASH, CASH],
                        [TEXT.TRANSFER, TRANSFER],
                    ].map(([label, color]) => (
                        <span key={label} className="inline-flex items-center gap-1.5">
                            <i aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: color }} />
                            {label}
                        </span>
                    ))}
                </div>
                <div className="overflow-x-auto">
                    <div className={cx("relative min-w-xl", result?.key !== key && "opacity-60")} onMouseLeave={() => setHover(null)}>
                        <svg
                            viewBox={`0 0 ${W} ${H}`}
                            className="block h-auto w-full"
                            role="img"
                            aria-label={TEXT.CHART_LABEL(ddmm(range.from), ddmm(range.to))}
                        >
                            {[0, 1, 2, 3, 4].map((i) => {
                                const y = TOP + plotH * (1 - i / 4);
                                return (
                                    <g key={i}>
                                        <line x1={LEFT} x2={W - 8} y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" />
                                        <text x={LEFT - 8} y={y + 4} textAnchor="end" className="fill-muted text-[11px]">
                                            {(i * step) / 1e6}tr
                                        </text>
                                    </g>
                                );
                            })}
                            {rows.map((r, i) => {
                                const x = LEFT + i * cw + (cw - bw) / 2;
                                return (
                                    <g key={r.key}>
                                        {hover === r.key && <rect x={LEFT + i * cw} y={TOP} width={cw} height={plotH} className="fill-surface-muted" />}
                                        {bar(x, r)}
                                        <text
                                            x={LEFT + i * cw + cw / 2}
                                            y={H - 8}
                                            textAnchor="middle"
                                            className={cx("text-[11px]", r.key === today ? "fill-primary font-bold" : "fill-muted")}
                                        >
                                            {dayName(r.key)}
                                        </text>
                                        <rect x={LEFT + i * cw} y={TOP} width={cw} height={plotH} fill="transparent" onMouseEnter={() => setHover(r.key)} />
                                    </g>
                                );
                            })}
                        </svg>
                        {hovered && (
                            <div
                                role="tooltip"
                                className="pointer-events-none absolute top-2 z-10 w-60 rounded-lg border border-border bg-canvas p-3 text-caption shadow-lg"
                                style={{
                                    left: `clamp(0px, calc(${((LEFT + (rows.indexOf(hovered) + 0.5) * cw) / W) * 100}% - 7.5rem), calc(100% - 15rem))`,
                                }}
                            >
                                <b className="mb-1 block text-ink">{`${SCHEDULE_TEXT.WEEKDAYS[weekdayIndex(hovered.key)]} ${dmy(hovered.key)}`}</b>
                                {hovered.future ? (
                                    <span className="text-muted">{TEXT.NOT_YET}</span>
                                ) : (
                                    [
                                        [TEXT.CASH, hovered.cash, CASH],
                                        [TEXT.TRANSFER, hovered.transfer, TRANSFER],
                                    ].map(([label, value, color]) => (
                                        <span key={label} className="flex items-center gap-1.5 whitespace-nowrap text-body">
                                            <i aria-hidden="true" className="size-2 rounded-sm" style={{ background: color }} />
                                            {label} <b className="num ml-auto text-ink">{vnd(value)}</b>
                                        </span>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <table className="sr-only">
                    <caption>{TEXT.REVENUE}</caption>
                    <thead>
                        <tr>
                            <th>{TEXT.TABLE_DAY}</th>
                            <th>{TEXT.CASH}</th>
                            <th>{TEXT.TRANSFER}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.key}>
                                <td>{dmy(r.key)}</td>
                                <td>{vnd(r.cash)}</td>
                                <td>{vnd(r.transfer)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default RevenueChart;

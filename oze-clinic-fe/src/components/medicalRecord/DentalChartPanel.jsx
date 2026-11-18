import { cx } from "@/utils/cx";
import { LOWER_TEETH, UPPER_TEETH, displayText, isPermanentTooth, sortByDate, surfaceText, toToothCode, toothName } from "@/utils/medicalRecord";
import { MEDICAL_RECORD_TEXT as TEXT, MEDICAL_RECORD_TOOTH_KIND, MEDICAL_RECORD_TOOTH_STATUS } from "@/utils/messages";
import { DentalLegend, JawLabel, ToothRow } from "./DentalChartParts";
import RecordStatusBadge from "./RecordStatusBadge";

const ROW_FOCUS_CLASS = "focus-visible:shadow-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary";

const surfaceOf = (entry) => {
    const code = entry.surf || entry.findingSurf;
    return code ? surfaceText(code) : TEXT.WHOLE_TOOTH;
};

const kindText = (entry) => MEDICAL_RECORD_TOOTH_KIND[entry.kind] ?? displayText(entry.kind);

const ToothHistory = ({ tooth, entries, visitId }) => {
    const rows = sortByDate(
        entries.filter((entry) => toToothCode(entry.tooth) === tooth),
        (entry) => entry.date,
        -1,
    );
    return (
        <section className="card-app p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                <h2 className="card-title">{TEXT.TOOTH_HISTORY(tooth, toothName(tooth))}</h2>
            </div>
            {rows.length ? (
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>{TEXT.COL_DATE}</th>
                                <th>{TEXT.COL_CONDITION}</th>
                                <th>{TEXT.COL_SURFACE}</th>
                                <th>{TEXT.COL_NOTE}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((entry) => (
                                <tr key={entry.id} className={cx(entry.visit === visitId && "bg-primary-soft")}>
                                    <td className="num whitespace-nowrap">
                                        {displayText(entry.date)}
                                        {entry.visit === visitId && <span className="badge badge-info ml-1.5">{TEXT.THIS_VISIT}</span>}
                                    </td>
                                    <td>
                                        <RecordStatusBadge status={entry.st} labels={MEDICAL_RECORD_TOOTH_STATUS} /> <span className="ml-1">{kindText(entry)}</span>
                                    </td>
                                    <td className="text-caption">{surfaceOf(entry)}</td>
                                    <td>{entry.note || "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="p-6 text-center text-body-sm text-muted">{TEXT.TOOTH_HISTORY_EMPTY}</p>
            )}
        </section>
    );
};

const DentalChartPanel = ({ entries, allEntries, visitId, selectedTooth, onSelectTooth }) => {
    const visitTeeth = new Set(entries.map((entry) => toToothCode(entry.tooth)).filter(isPermanentTooth));
    const selectByKey = (event, tooth) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelectTooth(tooth);
    };

    return (
        <div className="flex flex-col gap-4">
            <section className="card-app p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <h2 className="card-title">{TEXT.CHART_TITLE}</h2>
                    <span className="text-caption text-muted">{TEXT.CHART_COUNT(visitTeeth.size)}</span>
                </div>
                <div className="p-5">
                    <JawLabel name="HÀM TRÊN" />
                    <ToothRow teeth={UPPER_TEETH} entries={allEntries} visitTeeth={visitTeeth} selectedTooth={selectedTooth} onSelect={onSelectTooth} />
                    <div className="my-2.5 border-t-2 border-dashed border-border" />
                    <ToothRow teeth={LOWER_TEETH} entries={allEntries} visitTeeth={visitTeeth} selectedTooth={selectedTooth} onSelect={onSelectTooth} />
                    <JawLabel name="HÀM DƯỚI" />
                </div>
                <DentalLegend entries={allEntries} className="border-t border-border px-5 pb-4 pt-3" />
            </section>
            {isPermanentTooth(selectedTooth) && <ToothHistory tooth={selectedTooth} entries={allEntries} visitId={visitId} />}
            <section className="card-app p-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                    <h2 className="card-title">{TEXT.VISIT_ENTRIES}</h2>
                    <span className="num text-caption text-muted">{entries.length}</span>
                </div>
                {entries.length ? (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Răng</th>
                                    <th>{TEXT.COL_SURFACE}</th>
                                    <th>Ghi nhận</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, index) => {
                                    const tooth = toToothCode(entry.tooth);
                                    const selectable = isPermanentTooth(tooth);
                                    const selected = selectable && tooth === selectedTooth;
                                    return (
                                        <tr
                                            key={entry.id ?? index}
                                            tabIndex={selectable ? 0 : undefined}
                                            className={cx(selectable && "cursor-pointer", ROW_FOCUS_CLASS, selected && "bg-primary-soft")}
                                            onClick={selectable ? () => onSelectTooth(tooth) : undefined}
                                            onKeyDown={selectable ? (event) => selectByKey(event, tooth) : undefined}
                                        >
                                            <td className={cx("py-2", selected && "border-l-3 border-l-primary")}>
                                                <b className="text-ink">{displayText(entry.tooth)}</b>
                                                <p className="text-caption text-muted">{toothName(tooth)}</p>
                                            </td>
                                            <td className="text-caption">{surfaceOf(entry)}</td>
                                            <td className="py-2">
                                                {kindText(entry)}
                                                {entry.note && <p className="text-caption text-muted">{entry.note}</p>}
                                            </td>
                                            <td>
                                                <RecordStatusBadge status={entry.st} labels={MEDICAL_RECORD_TOOTH_STATUS} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="p-6 text-center text-body-sm text-muted">Buổi này bác sĩ không ghi nhận răng nào.</p>
                )}
            </section>
        </div>
    );
};

export default DentalChartPanel;

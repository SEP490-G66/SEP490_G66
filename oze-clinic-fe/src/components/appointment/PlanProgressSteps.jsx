import { Check } from "lucide-react";
import { cx } from "@/utils/cx";
import { formatDate } from "@/utils/format";

// Sessions of one plan as a row of steps: done ✓, the current one ringed, the rest grey.
// stages: toDashboardPlans stages (cancelled ones already left out). currentNumber: stageNumber to ring.
const PlanProgressSteps = ({ stages, currentNumber, label = "Tiến độ kế hoạch" }) => (
    <ol aria-label={label} className="grid auto-cols-[minmax(84px,1fr)] grid-flow-col overflow-x-auto pb-1">
        {stages.map((stage, index) => {
            const done = stage.stageStatus === "Completed";
            const current = stage.stageNumber === currentNumber;
            return (
                <li
                    key={stage.id}
                    aria-current={current ? "step" : undefined}
                    className={cx(
                        "relative flex flex-col items-center gap-0.5 px-1 text-center text-caption",
                        index > 0 && "before:absolute before:top-3.5 before:right-1/2 before:h-0.5 before:w-full",
                        index > 0 && (done || current ? "before:bg-primary" : "before:bg-surface-muted"),
                    )}
                >
                    <span
                        className={cx(
                            "relative z-1 flex size-7 items-center justify-center rounded-full border-2 border-canvas font-semibold",
                            done && "bg-primary text-white",
                            current && "bg-canvas text-primary ring-2 ring-primary",
                            !done && !current && "bg-surface-muted text-body",
                        )}
                    >
                        {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                        <span className="sr-only">{done ? " (đã xong)" : current ? " (buổi này)" : ""}</span>
                    </span>
                    <span className="mt-0.5 font-semibold text-ink">Buổi {index + 1}</span>
                    <span className="num text-muted">{formatDate(stage.scheduledDate) || "Chưa có ngày"}</span>
                </li>
            );
        })}
    </ol>
);

export default PlanProgressSteps;

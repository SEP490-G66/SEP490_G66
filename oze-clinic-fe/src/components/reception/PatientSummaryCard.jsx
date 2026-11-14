import { Link } from "react-router-dom";
import { CalendarPlus, Pencil, UserCheck } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { dmy } from "./receptionUtils";
import { PATIENT_RECORD_TEXT as TEXT } from "@/utils/messages";
import { genderOf, phoneDisplay } from "@/utils/patientRecord";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

const REASON_IDS = { walkIn: "pr-walk-in-reason", book: "pr-book-reason" };

const ReasonLine = ({ id, block, prefix, onRetry }) => (
    <p id={id} className="flex flex-wrap items-center gap-2 text-body-sm text-body">
        <span>
            {prefix}
            {block.text}
        </span>
        {block.retry && (
            <button type="button" className="btn btn-link h-auto p-0 text-caption" onClick={() => onRetry(block.retry)}>
                {TEXT.RETRY}
            </button>
        )}
        {block.checkIn && (
            <Link to={ROUTES.RECEPTION_CHECK_IN} className="font-semibold text-primary hover:underline">
                {TEXT.GO_CHECK_IN}
            </Link>
        )}
    </p>
);

const PatientSummaryCard = ({ patient, h1Ref, labels, editLink, walkIn, book, walkInRef, bookRef, onRetry }) => {
    const subline = patient
        ? [
              patient.patientCode,
              patient.phoneNumber ? phoneDisplay(patient.phoneNumber) : null,
              genderOf(patient.gender).code ? genderOf(patient.gender).label : null,
              patient.dateOfBirth ? TEXT.BORN_ON(dmy(String(patient.dateOfBirth).slice(0, 10))) : null,
          ].filter(Boolean)
        : [];
    const sameReason = walkIn?.block && book?.block && walkIn.block.text === book.block.text;
    const walkInReason = walkIn?.block ? REASON_IDS.walkIn : undefined;
    const bookReason = book?.block ? (sameReason ? REASON_IDS.walkIn : REASON_IDS.book) : undefined;
    const press = (action) => () => {
        if (!action.block) action.onClick();
    };

    return (
        <section className="rounded-xl border border-border bg-canvas p-5">
            <div className="flex flex-wrap items-start gap-4">
                {patient && <Avatar fullName={patient.fullName} size="lg" />}
                <div className="min-w-0 flex-1">
                    <h1 ref={h1Ref} tabIndex={-1} className="page-title outline-none">
                        {patient?.fullName ?? TEXT.TITLE}
                    </h1>
                    {subline.length > 0 && <p className="num mt-1 text-body-sm text-muted">{subline.join(" · ")}</p>}
                    {labels.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-2">
                            {labels.map((label) => (
                                <li key={label.key} className="flex items-center gap-1">
                                    <span className={cx("badge", label.badge)}>{label.text}</span>
                                    {label.retry && (
                                        <button type="button" className="btn btn-link h-auto p-0 text-caption" onClick={() => onRetry(label.retry)}>
                                            {TEXT.RETRY}
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {patient && (
                    <div className="flex flex-wrap gap-2">
                        <Link to={editLink.to} state={editLink.state} className="btn btn-secondary">
                            <Pencil className="size-4" aria-hidden="true" /> {TEXT.EDIT}
                        </Link>
                        <button
                            ref={walkInRef}
                            type="button"
                            className="btn btn-secondary"
                            aria-disabled={walkIn.block ? "true" : undefined}
                            aria-describedby={walkInReason}
                            onClick={press(walkIn)}
                        >
                            <UserCheck className="size-4" aria-hidden="true" /> {TEXT.WALK_IN}
                        </button>
                        <button
                            ref={bookRef}
                            type="button"
                            className="btn btn-primary"
                            aria-disabled={book.block ? "true" : undefined}
                            aria-describedby={bookReason}
                            onClick={press(book)}
                        >
                            <CalendarPlus className="size-4" aria-hidden="true" /> {TEXT.BOOK}
                        </button>
                    </div>
                )}
            </div>
            {patient && (walkIn.block || book.block) && (
                <div className="-mx-5 mt-4 space-y-2 border-t border-border px-5 pt-4">
                    {walkIn.block && <ReasonLine id={REASON_IDS.walkIn} block={walkIn.block} prefix={sameReason || !book.block ? "" : TEXT.REASON_PREFIX_WALK_IN} onRetry={onRetry} />}
                    {book.block && !sameReason && <ReasonLine id={REASON_IDS.book} block={book.block} prefix={walkIn.block ? TEXT.REASON_PREFIX_BOOK : ""} onRetry={onRetry} />}
                </div>
            )}
        </section>
    );
};

export default PatientSummaryCard;

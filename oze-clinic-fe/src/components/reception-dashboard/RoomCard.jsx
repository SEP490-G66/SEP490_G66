import { Link } from "react-router-dom";
import { DASHBOARD_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import { cx } from "@/utils/cx";

// room: from queueBoard rooms; rows: ordered rows of that room; later: today's appointments still to come for an ended doctor
const RoomCard = ({ room, rows, later, onCall, onMoveAll }) => {
    const serving = rows.find((r) => r.state === "serving");
    const waiting = rows.filter((r) => r.state !== "serving");
    const next = waiting[0];
    const alert = room.ended && (waiting.length > 0 || later > 0);
    return (
        <li
            className={cx(
                "flex flex-col gap-1.5 rounded-xl border p-3.5",
                alert ? "border-danger/40 bg-danger-soft" : "border-border bg-canvas",
                room.off && "text-muted",
            )}
        >
            <div className="flex items-center gap-2">
                <b className="flex-1 text-body-sm text-ink">{room.name}</b>
                <span className={cx("badge", waiting.length ? "badge-info" : "badge-neutral")}>{TEXT.ROOM_WAITING(waiting.length)}</span>
            </div>
            <small className="text-caption text-muted">
                {room.staff}
                {room.ended && <span className="text-danger"> · {TEXT.ROOM_ENDED(room.endAt)}</span>}
            </small>
            <div className="flex flex-1 flex-col gap-0.5 text-body-sm text-body">
                {room.off ? (
                    <span className="text-muted">{TEXT.ROOM_OFF(room.startAt)}</span>
                ) : (
                    <>
                        <span>
                            {TEXT.ROOM_NOW[room.tab]}: {serving ? <b className="text-ink">{serving.patientName}</b> : <span className="text-muted">{TEXT.ROOM_EMPTY}</span>}
                        </span>
                        <span>
                            {TEXT.ROOM_NEXT}:{" "}
                            {next ? (
                                <>
                                    <b className="num text-ink">
                                        {String(next.position).padStart(2, "0")} · {next.patientName}
                                    </b>
                                    {next.state === "called" && <span className="badge badge-warning ml-1.5">{TEXT.ROOM_CALLED}</span>}
                                </>
                            ) : (
                                <span className="text-muted">{TEXT.ROOM_NONE}</span>
                            )}
                        </span>
                    </>
                )}
                {room.ended && later > 0 && <span className="text-danger">{TEXT.ROOM_LATER(later)}</span>}
            </div>
            <div className="mt-1 flex items-center gap-2">
                {room.ended
                    ? waiting.length > 0 && (
                          <button type="button" className="btn btn-primary h-8 px-3" onClick={() => onMoveAll(room, waiting)}>
                              {TEXT.MOVE_DOCTOR}
                          </button>
                      )
                    : !room.off &&
                      next && (
                          <button type="button" className="btn btn-secondary h-8 px-3" onClick={() => onCall(room, next)}>
                              {next.state === "called" ? TEXT.CALL_AGAIN : TEXT.CALL_NEXT}
                          </button>
                      )}
                <Link to={ROUTES.RECEPTION_QUEUE} state={{ tab: room.tab, room: room.key }} className="ml-auto text-label font-semibold text-primary hover:underline">
                    {TEXT.VIEW}
                </Link>
            </div>
        </li>
    );
};

export default RoomCard;

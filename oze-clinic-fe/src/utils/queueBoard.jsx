import { norm } from "./medicalRecord";

export const QUEUE_TABS = ["kham", "xq", "tp"];

export const EMPTY_QUEUE_FILTERS = { keyword: "", room: "", state: "", priority: "" };

// Missed calls after which the receptionist must decide: keep the patient in the queue or let them leave
export const ABSENT_LIMIT = 3;

// Key of the exam room for checked-in patients without a doctor, so they never drop out of the board
export const NO_DOCTOR_KEY = "none";

const priorityOf = (value) => {
    const p = Number(value);
    return [0, 1, 2].includes(p) ? p : 0;
};

const skipsOf = (x) => Number(x.skipCount) || 0;

const TAB_OF_TYPE = { Imaging: "xq", Treatment: "tp" };

const ENTRY_STATE = { IN_PROGRESS: "serving", INPROGRESS: "serving", CALLED: "called", WAITING: "waiting" };

const entryState = (status) => ENTRY_STATE[String(status ?? "").toUpperCase()] ?? "waiting";

const ENDED = ["Ended", "OnLeave"];

const EXAM_TYPE = "Examination";

export const examRooms = (doctors, waiting, serving) => {
    const map = new Map();
    doctors.forEach((d) =>
        map.set(String(d.id), {
            key: String(d.id),
            tab: "kham",
            doctorId: d.id,
            name: d.room,
            staff: d.name,
            ended: ENDED.includes(d.status),
            endAt: d.endedAt ?? d.end,
            off: d.status === "NotStarted",
            startAt: d.start,
            // Only a doctor working now can take patients; one whose shift has not started is not a move target
            active: d.status === "Working",
        }),
    );
    [...waiting, ...serving].forEach((x) => {
        if (!x.doctorId) {
            if (!map.has(NO_DOCTOR_KEY)) map.set(NO_DOCTOR_KEY, { key: NO_DOCTOR_KEY, tab: "kham", doctorId: null, name: null, staff: null, ended: false, active: false });
            return;
        }
        if (map.has(String(x.doctorId))) return;
        // A doctor missing from today's duty list: the shift is unknown, so never a move target
        map.set(String(x.doctorId), { key: String(x.doctorId), tab: "kham", doctorId: x.doctorId, name: x.roomName, staff: x.doctorName, ended: false, active: false });
    });
    // Patients without a doctor come last, after every named room
    return [...map.values()].sort(
        (a, b) => Number(a.key === NO_DOCTOR_KEY) - Number(b.key === NO_DOCTOR_KEY) || String(a.name ?? "~").localeCompare(String(b.name ?? "~"), "vi", { numeric: true }),
    );
};

export const otherRooms = (entries) => {
    const map = new Map();
    entries.forEach((e) => {
        const tab = TAB_OF_TYPE[e.queueType];
        if (!tab) return;
        const key = `${e.queueType}-${e.roomId ?? "none"}`;
        if (!map.has(key)) map.set(key, { key, tab, roomId: e.roomId, name: e.roomName, staff: e.staffName, ended: false, active: e.roomId != null });
    });
    return [...map.values()].sort((a, b) => String(a.name ?? "~").localeCompare(String(b.name ?? "~"), "vi", { numeric: true }));
};

export const examRows = (waiting, serving, entries = []) => {
    const entryOf = new Map(entries.filter((e) => e.queueType === EXAM_TYPE).map((e) => [e.appointmentId, e]));
    const inRoom = serving.map((a) => ({
        key: `s${a.id}`,
        kind: "exam",
        appointmentId: a.id,
        roomKey: a.doctorId ? String(a.doctorId) : NO_DOCTOR_KEY,
        patientName: a.patientName,
        patientCode: a.patientCode,
        patientPhoneNumber: a.patientPhoneNumber,
        allergies: a.patientAllergies ?? [],
        number: entryOf.get(a.id)?.queueNumber ?? null,
        state: "serving",
        priority: priorityOf(a.priority),
        priorityReason: priorityOf(a.priority) > 0 ? (entryOf.get(a.id)?.notes ?? null) : null,
        checkInAt: a.checkInAt,
    }));
    const queue = waiting.map((w, index) => {
        const entry = entryOf.get(w.appointmentId);
        const priority = priorityOf(w.priority);
        return {
            key: `w${w.appointmentId}`,
            kind: "exam",
            appointmentId: w.appointmentId,
            roomKey: w.doctorId ? String(w.doctorId) : NO_DOCTOR_KEY,
            patientName: w.patientName,
            patientCode: w.patientCode,
            patientPhoneNumber: w.patientPhoneNumber,
            allergies: w.patientAllergies ?? [],
            number: entry?.queueNumber ?? null,
            state: entryState(entry?.status) === "called" ? "called" : "waiting",
            absent: (Number(entry?.skipCount) || 0) > 0,
            skips: skipsOf(entry ?? {}),
            examined: Boolean(w.isPriorityReturn),
            priority,
            priorityReason: priority > 0 ? (entry?.notes ?? null) : null,
            checkInAt: w.checkInAt,
            order: index,
        };
    });
    return [...inRoom, ...queue];
};

export const entryRows = (entries) =>
    entries
        .filter((e) => TAB_OF_TYPE[e.queueType])
        .map((e) => ({
            key: `q${e.id}`,
            kind: "queue",
            entryId: e.id,
            appointmentId: e.appointmentId,
            roomKey: `${e.queueType}-${e.roomId ?? "none"}`,
            patientName: e.patientName,
            patientCode: e.patientCode,
            patientPhoneNumber: e.patientPhoneNumber,
            allergies: e.patientAllergies ?? [],
            number: e.queueNumber ?? null,
            state: entryState(e.status),
            absent: (Number(e.skipCount) || 0) > 0,
            skips: skipsOf(e),
            priority: priorityOf(e.priority),
            priorityReason: e.priorityReason ?? null,
            checkInAt: e.createdAt,
            order: (2 - priorityOf(e.priority)) * 100000 + (Number(e.queueNumber) || 0),
        }));

const STATE_RANK = { serving: 0, called: 1, waiting: 2 };

export const orderRows = (rows, rooms) => {
    const roomIndex = new Map(rooms.map((r, i) => [r.key, i]));
    const sorted = [...rows].sort(
        (a, b) =>
            (roomIndex.get(a.roomKey) ?? 999) - (roomIndex.get(b.roomKey) ?? 999) ||
            STATE_RANK[a.state] - STATE_RANK[b.state] ||
            (a.order ?? 0) - (b.order ?? 0),
    );
    const seen = new Map();
    return sorted.map((row) => {
        if (row.state === "serving") return { ...row, position: row.number ?? null };
        const position = (seen.get(row.roomKey) ?? 0) + 1;
        seen.set(row.roomKey, position);
        return { ...row, position: row.number ?? position };
    });
};

export const waitingCount = (rows, roomKey) => rows.filter((r) => r.roomKey === roomKey && r.state !== "serving").length;

// Missed the call ABSENT_LIMIT times: the receptionist asks whether the patient still waits
export const needsDecision = (row) => row.state !== "serving" && (row.skips ?? 0) >= ABSENT_LIMIT;

export const matchesQueue = (row, filters) => {
    const q = filters.keyword.trim();
    const digits = q.replace(/\D/g, "");
    // "84…" typed as a full number becomes "0…"; a run of digits from the middle still matches as typed
    const local = digits.replace(/^84/, "0");
    const phone = String(row.patientPhoneNumber ?? "").replace(/\D/g, "").replace(/^84/, "0");
    const phoneOk = digits.length >= 3 && (phone.includes(digits) || (local.length >= 3 && phone.includes(local)));
    const keywordOk = !q || norm(row.patientName).includes(norm(q)) || norm(row.patientCode).includes(norm(q)) || phoneOk;
    return keywordOk && (!filters.room || row.roomKey === filters.room) && (!filters.state || (filters.state === "absent" ? row.absent || (row.skips ?? 0) > 0 : row.state === filters.state)) && (!filters.priority || String(row.priority) === filters.priority);
};

export const isQueueFiltered = (filters) => Object.keys(EMPTY_QUEUE_FILTERS).some((k) => filters[k] !== EMPTY_QUEUE_FILTERS[k]);

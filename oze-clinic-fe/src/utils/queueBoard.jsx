import { norm } from "./medicalRecord";

export const QUEUE_TABS = ["kham", "xq", "tp"];

export const EMPTY_QUEUE_FILTERS = { keyword: "", room: "", state: "", priority: "" };

const TAB_OF_TYPE = { Imaging: "xq", Treatment: "tp" };

const ENTRY_STATE = { IN_PROGRESS: "serving", CALLED: "called", WAITING: "waiting" };

const ENDED = ["Ended", "OnLeave"];

const isCalled = (w) => w.status === "CALLED" || w.queueStatus === "Called" || Boolean(w.calledAt);

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
            endAt: d.end,
            off: d.status === "NotStarted",
            startAt: d.start,
            active: !ENDED.includes(d.status),
        }),
    );
    [...waiting, ...serving].forEach((x) => {
        if (!x.doctorId || map.has(String(x.doctorId))) return;
        map.set(String(x.doctorId), { key: String(x.doctorId), tab: "kham", doctorId: x.doctorId, name: x.roomName, staff: x.doctorName, ended: false, active: true });
    });
    return [...map.values()].sort((a, b) => String(a.name ?? "~").localeCompare(String(b.name ?? "~"), "vi", { numeric: true }));
};

export const otherRooms = (entries) => {
    const map = new Map();
    entries.forEach((e) => {
        const tab = TAB_OF_TYPE[e.queueType];
        if (!tab) return;
        const key = `${e.queueType}-${e.roomId ?? "none"}`;
        if (!map.has(key)) map.set(key, { key, tab, roomId: e.roomId, name: e.roomName, staff: e.staffName, ended: false, active: true });
    });
    return [...map.values()].sort((a, b) => String(a.name ?? "~").localeCompare(String(b.name ?? "~"), "vi", { numeric: true }));
};

export const examRows = (waiting, serving) => {
    const inRoom = serving.map((a) => ({
        key: `s${a.id}`,
        kind: "exam",
        appointmentId: a.id,
        roomKey: String(a.doctorId),
        patientName: a.patientName,
        patientCode: a.patientCode,
        patientPhoneNumber: a.patientPhoneNumber,
        allergies: a.patientAllergies ?? [],
        state: "serving",
        priority: a.priority ?? 0,
        checkInAt: a.checkInAt,
    }));
    const queue = waiting.map((w, index) => ({
        key: `w${w.appointmentId}`,
        kind: "exam",
        appointmentId: w.appointmentId,
        roomKey: String(w.doctorId),
        patientName: w.patientName,
        patientCode: w.patientCode,
        patientPhoneNumber: w.patientPhoneNumber,
        allergies: w.patientAllergies ?? [],
        state: isCalled(w) ? "called" : "waiting",
        absent: Boolean(w.absentWhenCalled),
        priority: w.priority ?? 0,
        checkInAt: w.checkInAt,
        order: index,
    }));
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
            state: ENTRY_STATE[e.status] ?? "waiting",
            absent: Boolean(e.absentWhenCalled),
            priority: e.priority ?? 0,
            checkInAt: e.createdAt,
            order: (2 - (e.priority ?? 0)) * 100000 + (e.queueNumber ?? 0),
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
        if (row.state === "serving") return { ...row, position: null };
        const position = (seen.get(row.roomKey) ?? 0) + 1;
        seen.set(row.roomKey, position);
        return { ...row, position };
    });
};

export const waitingCount = (rows, roomKey) => rows.filter((r) => r.roomKey === roomKey && r.state !== "serving").length;

export const matchesQueue = (row, filters) => {
    const q = filters.keyword.trim();
    const digits = q.replace(/\D/g, "");
    const phone = String(row.patientPhoneNumber ?? "").replace(/\D/g, "").replace(/^84/, "0");
    const keywordOk = !q || norm(row.patientName).includes(norm(q)) || norm(row.patientCode).includes(norm(q)) || (digits.length >= 3 && phone.includes(digits));
    return keywordOk && (!filters.room || row.roomKey === filters.room) && (!filters.state || row.state === filters.state) && (!filters.priority || String(row.priority) === filters.priority);
};

export const isQueueFiltered = (filters) => Object.keys(EMPTY_QUEUE_FILTERS).some((k) => filters[k] !== EMPTY_QUEUE_FILTERS[k]);

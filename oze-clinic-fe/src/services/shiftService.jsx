import { formatDate, toDateOnly } from "../utils/format";
import { BACKEND_ROLE_NAMES, USER_ROLES } from "../utils/messages";
import { RECEPTION_DESK, ROOM_STATUSES, ROOM_TYPES } from "../utils/constants/room";
import { AFTERNOON_STARTS_AT, LEAVE_REQUEST_STATUSES, SHIFT_SLOTS, SHIFT_SLOT_OPTIONS, SHIFT_STATUSES } from "../utils/constants/shift";
import api from "./api";
import { call } from "./receptionService";

// Shift schedule of the manager (api/work-shifts). The backend stores single shifts (person, day, start/end, room);
// the page shows them as a week grid: one card per room and slot (morning / afternoon). The reception desk is the
// row of shifts without a room. Other data used:
// - api/Rooms: the rooms that get a row (active) and the ones under maintenance
// - api/Staff: name, role and phone of each person, and who can be put on a shift
// - api/leave-requests (Approved): who is on leave. Approving a leave with a substitute moves the shifts to the
//   substitute; without one the shift stays with the person, marked absent.
// Copying a week still uses single create calls. Monthly schedule uses POST /api/work-shifts/bulk
// (preview + create), one request per (room, slot) group from the weekly pattern.

const WEEK_MS = 7 * 86_400_000;
const LEAVE_PAGE_SIZE = 100;
const GENERIC_ERROR = "Có lỗi xảy ra, vui lòng thử lại sau.";

// Roles that can be put on shift, with the names used on the shift pages.
export const SHIFT_ROLE_OPTIONS = [
    { value: USER_ROLES.DOCTOR, label: "Bác sĩ" },
    { value: USER_ROLES.DENTAL_IMAGING_TECHNICIAN, label: "Kỹ thuật viên" },
    { value: USER_ROLES.RECEPTIONIST, label: "Lễ tân" },
];

// Lower-case name: an upper-case object of member expressions looks like a component to react-refresh.
const rolesByRoomType = {
    [ROOM_TYPES.GENERAL_TREATMENT]: USER_ROLES.DOCTOR,
    [ROOM_TYPES.MINOR_SURGERY]: USER_ROLES.DOCTOR,
    [ROOM_TYPES.XRAY]: USER_ROLES.DENTAL_IMAGING_TECHNICIAN,
    [RECEPTION_DESK.type]: USER_ROLES.RECEPTIONIST,
};

// Role that may work in a type of room.
export const roomTypeRole = (roomType) => rolesByRoomType[roomType];

// What the shift is for, as the backend seeds it.
const assignmentOf = (room) => {
    if (room.type === RECEPTION_DESK.type) return "Phòng tiếp tân";
    return room.type === ROOM_TYPES.XRAY ? "Chụp phim" : "Khám & điều trị";
};

export const WEEKDAYS_SHORT = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Whether a candidate can take a shift.
export const AVAILABILITY = {
    FREE: "free",
    BUSY: "busy",
    LEAVE: "leave",
};

const AVAILABILITY_ORDER = [AVAILABILITY.FREE, AVAILABILITY.BUSY, AVAILABILITY.LEAVE];

// Texts of ErrorConstants.WorkShiftMessage / LeaveRequest that a save can return.
const MESSAGES = {
    "Work shift created successfully": "Phân ca thành công!",
    "Work shift updated successfully": "Cập nhật phân ca thành công!",
    "Work shift deleted successfully": "Đã xoá ca.",
    "Staff not found": "Không tìm thấy nhân viên.",
    "Staff account is inactive": "Tài khoản nhân viên đã bị khoá.",
    "Room not found": "Phòng không còn tồn tại.",
    "Room is not active": "Phòng đang không hoạt động.",
    "Shift start time must be earlier than end time": "Giờ bắt đầu ca phải trước giờ kết thúc.",
    "Shift start time must fall on a booking slot boundary": "Giờ bắt đầu ca phải đúng mốc ô lịch hẹn (ví dụ 08:00, 08:30).",
    "Shift date cannot be in the past": "Không thể phân ca cho ngày đã qua.",
    "This staff member already has a shift that overlaps this time": "Nhân viên này đã có ca khác trùng giờ.",
    "This room is already used by another shift at that time": "Phòng này đã có người trực trong ca.",
    "Work shift not found": "Ca này không còn tồn tại.",
    "Cannot delete a work shift that has already started or passed": "Ca này đã bắt đầu, không thể xoá.",
    "Cannot delete this work shift because it has booked appointments. Please move the appointments first":
        "Ca này đã có lịch hẹn. Hãy chuyển các lịch hẹn trước khi xoá ca.",
    "Cannot update a work shift that has already started or passed": "Ca này đã bắt đầu, không thể thay đổi.",
    "Cannot change staff, date or time of this work shift because it has booked appointments. Please move the appointments first":
        "Ca này đã có lịch hẹn nên không đổi được người. Hãy chuyển các lịch hẹn trước.",
    "Bulk shift date range is invalid or longer than 62 days": "Khoảng ngày không hợp lệ hoặc dài hơn 62 ngày.",
    "Bulk shift slots are invalid or overlap each other": "Các khung giờ không hợp lệ hoặc bị chồng nhau.",
    "Bulk shift must include between 1 and 20 unique staff members": "Cần chọn từ 1 đến 20 nhân viên, không trùng.",
    "Bulk shift days of week must be between 0 (Sunday) and 6 (Saturday) and not empty": "Ngày trong tuần không hợp lệ.",
    "No valid work shifts to create": "Không có ca hợp lệ để tạo.",
    "This shift overlaps another shift in the same bulk request": "Ca này trùng với ca khác trong cùng lần xếp.",
};

const toVietnamese = (message) => MESSAGES[message] ?? message ?? GENERIC_ERROR;

// A failed save: a clash of the person goes under the staff field, the rest is a message for the whole form.
const STAFF_FIELD_MESSAGES = ["This staff member already has a shift that overlaps this time", "Staff account is inactive", "Staff not found"];

const toSaveResult = (result) => {
    if (result.success) return { ...result, message: toVietnamese(result.message) };
    const message = toVietnamese(result.message);
    return { ...result, message, errors: STAFF_FIELD_MESSAGES.includes(result.message) ? { staffId: message } : { form: message } };
};

// ----- dates -----

const pad = (value) => String(value).padStart(2, "0");

const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Monday of the week.
const startOfWeek = (date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

const parseDay = (dateOnly) => {
    const [year, month, day] = dateOnly.split("-").map(Number);
    return new Date(year, month - 1, day);
};

// 0 = Monday ... 6 = Sunday.
const weekdayOf = (dateOnly) => (parseDay(dateOnly).getDay() + 6) % 7;

const hhmm = (time) => (time ? String(time).slice(0, 5) : null);

// "T4 21/10/2026"
export const formatShiftDate = (dateOnly) => `${WEEKDAYS_SHORT[weekdayOf(dateOnly)]} ${formatDate(dateOnly)}`;

// Popup subtitle of a shift: "Phòng khám · Ca sáng · T4 21/10/2026".
export const formatShiftPlace = (cell) => `${cell.room.name} · ${cell.slotLabel} · ${formatShiftDate(cell.date)}`;

const slotOf = (value) => SHIFT_SLOT_OPTIONS.find((slot) => slot.value === value);

const slotOfTime = (time) => (hhmm(time) < AFTERNOON_STARTS_AT ? SHIFT_SLOTS.MORNING : SHIFT_SLOTS.AFTERNOON);

const nowMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

const toMinutes = (time) => {
    const [hours, minutes] = hhmm(time).split(":").map(Number);
    return hours * 60 + minutes;
};

// A shift has not started while its day is ahead, or it is today and its start time is ahead.
const isFuture = (date, start) => {
    const today = toDateOnly(new Date());
    if (date !== today) return date > today;
    return nowMinutes() < toMinutes(start);
};

// ----- backend data -----

const fail = (result) => ({ ...result, message: toVietnamese(result.message) });

const roleFromBackend = (backendRole) => Object.keys(BACKEND_ROLE_NAMES).find((key) => BACKEND_ROLE_NAMES[key] === backendRole) ?? "";

const roleLabel = (role) => SHIFT_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? "";

// Titles such as "BS." are left out of the schedule.
export const displayName = (fullName) => (fullName ?? "").replace(/^(BS|KTV)\.\s*/, "");

const toStaff = (item) => {
    const role = roleFromBackend(item.role);
    return {
        id: item.userId,
        name: displayName(item.fullName),
        role,
        roleLabel: roleLabel(role),
        phone: (item.phoneNumber ?? "").replace(/^\+84/, "0"),
        isActive: item.isActive,
    };
};

const toRoom = (item) => ({ id: item.id, name: item.roomName, type: item.roomType, floor: item.floor ?? "" });

const loadRooms = async () => {
    const result = await call(() => api.get("/api/Rooms"));
    if (!result.success) return result;
    return {
        ...result,
        data: {
            active: [...result.data.filter((room) => room.status === ROOM_STATUSES.ACTIVE).map(toRoom), RECEPTION_DESK],
            maintenance: result.data.filter((room) => room.status === ROOM_STATUSES.MAINTENANCE).map((room) => room.roomName),
        },
    };
};

const loadStaff = async () => {
    const result = await call(() => api.get("/api/Staff"));
    return result.success ? { ...result, data: result.data.map(toStaff) } : result;
};

const loadShifts = (from, to) => call(() => api.get("/api/work-shifts", { params: { fromDate: from, toDate: to } }));

// Approved leaves in [from, to]; slot null = the whole day.
const loadLeaves = async (from, to) => {
    const result = await call(() =>
        api.get("/api/leave-requests", { params: { status: "Approved", fromDate: from, toDate: to, pageSize: LEAVE_PAGE_SIZE } }),
    );
    if (!result.success) return result;
    return {
        ...result,
        data: result.data.items.map((item) => ({
            requestId: item.id,
            staffId: item.staffUserId,
            date: item.leaveDate,
            slot: item.slot === "Morning" ? SHIFT_SLOTS.MORNING : item.slot === "Afternoon" ? SHIFT_SLOTS.AFTERNOON : null,
        })),
    };
};

// Every call must succeed, otherwise the first failure is returned.
const loadAll = async (requests) => {
    const results = await Promise.all(requests);
    const failed = results.find((result) => !result.success);
    return failed ? { failed: fail(failed) } : { data: results.map((result) => result.data) };
};

const leaveOf = (leaves, staffId, date, slot) =>
    leaves.find((leave) => leave.staffId === staffId && leave.date === date && (leave.slot === null || leave.slot === slot));

const roomIdOf = (shift) => shift.roomId ?? RECEPTION_DESK.id;

const shiftsAt = (shifts, date, slot) => shifts.filter((shift) => shift.scheduleDate === date && slotOfTime(shift.shiftStart) === slot);

// ----- week schedule -----

const emptyCell = (date, slotValue, room) => {
    const slot = slotOf(slotValue);
    return {
        key: `${date}|${slotValue}|${room.id}`,
        shiftId: null,
        date,
        slot: slotValue,
        slotLabel: slot.label,
        start: slot.start,
        end: slot.end,
        room,
        staff: null,
        status: SHIFT_STATUSES.UNASSIGNED,
    };
};

const staffOf = (shift, staffById) =>
    staffById.get(shift.staffUserId) ?? { id: shift.staffUserId, name: displayName(shift.staffName), role: "", roleLabel: "", phone: "" };

const buildCell = (shift, room, staffById, leaves) => {
    const slotValue = slotOfTime(shift.shiftStart);
    const cell = {
        ...emptyCell(shift.scheduleDate, slotValue, room),
        key: `shift-${shift.id}`,
        shiftId: shift.id,
        start: hhmm(shift.shiftStart),
        end: hhmm(shift.shiftEnd),
        staff: staffOf(shift, staffById),
    };

    const leave = leaveOf(leaves, shift.staffUserId, shift.scheduleDate, slotValue);
    if (leave) {
        return { ...cell, status: SHIFT_STATUSES.LEAVE, leave: { requestId: leave.requestId, status: LEAVE_REQUEST_STATUSES.APPROVED, wholeDay: leave.slot === null } };
    }
    if (shift.isPresent === false) return { ...cell, status: SHIFT_STATUSES.ABSENT, absenceReason: shift.absenceReason };
    if (shift.actualStartTime || shift.isPresent === true) {
        return { ...cell, status: SHIFT_STATUSES.PRESENT, checkIn: hhmm(shift.actualStartTime), checkOut: hhmm(shift.actualEndTime) };
    }
    return { ...cell, status: SHIFT_STATUSES.PENDING };
};

// One card per shift of a room and slot; an empty card when nobody is on it.
const cellsOfSlot = (date, slotValue, room, shifts, staffById, leaves) => {
    const inRoom = shiftsAt(shifts, date, slotValue).filter((shift) => String(roomIdOf(shift)) === String(room.id));
    return inRoom.length ? inRoom.map((shift) => buildCell(shift, room, staffById, leaves)) : [emptyCell(date, slotValue, room)];
};

const weekLabel = (from, to) => `${pad(from.getDate())}/${pad(from.getMonth() + 1)} – ${formatDate(toDateOnly(to))}`;

// Week of the schedule that contains weekStart ("2026-11-02"; any day of the week works).
// weekOffset in the result: 0 = this week, 1 = next week, -1 = last week ...
// editable: the week has not started, so shifts can be assigned and changed.
export const getWeekShifts = async ({ weekStart }) => {
    const today = toDateOnly(new Date());
    const from = startOfWeek(parseDay(weekStart));
    const to = addDays(from, 6);
    const fromKey = toDateOnly(from);
    const toKey = toDateOnly(to);

    const { failed, data } = await loadAll([loadShifts(fromKey, toKey), loadRooms(), loadStaff(), loadLeaves(fromKey, toKey)]);
    if (failed) return failed;
    const [shifts, rooms, staff, leaves] = data;
    const staffById = new Map(staff.map((member) => [member.id, member]));

    const days = Array.from({ length: 7 }, (_, weekday) => {
        const date = toDateOnly(addDays(from, weekday));
        return { date, weekday: WEEKDAYS_SHORT[weekday], label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, isToday: date === today };
    });
    const cells = days.flatMap((day) =>
        SHIFT_SLOT_OPTIONS.flatMap((slot) => rooms.active.flatMap((room) => cellsOfSlot(day.date, slot.value, room, shifts, staffById, leaves))),
    );
    const upcoming = cells.filter((cell) => cell.date >= today);

    return {
        success: true,
        message: null,
        errors: null,
        data: {
            weekOffset: Math.round((from - startOfWeek(new Date())) / WEEK_MS),
            from: fromKey,
            to: toKey,
            label: weekLabel(from, to),
            editable: fromKey > today,
            days,
            slots: SHIFT_SLOT_OPTIONS,
            rooms: rooms.active,
            cells,
            summary: {
                unassigned: upcoming.filter((cell) => cell.status === SHIFT_STATUSES.UNASSIGNED).length,
                needReplacement: upcoming.filter((cell) => cell.status === SHIFT_STATUSES.LEAVE || cell.status === SHIFT_STATUSES.ABSENT).length,
            },
            maintenanceRooms: rooms.maintenance,
        },
    };
};

// ----- candidates -----

const activeWithRole = (staff, role) => staff.filter((member) => member.isActive && member.role === role);

// Staff whose role fits the room, with whether they can take the shift: free, already on another shift (busyRoom),
// or on leave. The person already on this shift counts as free.
export const getShiftCandidates = async ({ cell }) => {
    const { failed, data } = await loadAll([loadStaff(), loadShifts(cell.date, cell.date), loadLeaves(cell.date, cell.date), loadRooms()]);
    if (failed) return failed;
    const [staff, shifts, leaves, rooms] = data;
    const roomName = (shift) => rooms.active.find((room) => String(room.id) === String(roomIdOf(shift)))?.name ?? shift.roomName ?? RECEPTION_DESK.name;
    const others = shiftsAt(shifts, cell.date, cell.slot).filter((shift) => shift.id !== cell.shiftId);

    const candidates = activeWithRole(staff, roomTypeRole(cell.room.type)).map((member) => {
        const busy = others.find((shift) => shift.staffUserId === member.id);
        let availability = AVAILABILITY.FREE;
        if (leaveOf(leaves, member.id, cell.date, cell.slot)) availability = AVAILABILITY.LEAVE;
        else if (busy) availability = AVAILABILITY.BUSY;
        return { ...member, availability, busyRoom: busy ? roomName(busy) : null };
    });
    candidates.sort((a, b) => AVAILABILITY_ORDER.indexOf(a.availability) - AVAILABILITY_ORDER.indexOf(b.availability));
    return { success: true, message: null, errors: null, data: candidates };
};

// ----- saving -----

const toApiShift = ({ staffId, date, slot, room, start, end }) => {
    const slotOption = slotOf(slot);
    return {
        staffUserId: staffId,
        scheduleDate: date,
        shiftStart: `${start ?? slotOption.start}:00`,
        shiftEnd: `${end ?? slotOption.end}:00`,
        roomId: room.id === RECEPTION_DESK.id ? null : room.id,
        assignment: assignmentOf(room),
    };
};

// Puts staffId on the shift of a card: creates it for an empty card, otherwise changes who is on it.
export const saveShift = async ({ cell, staffId }) => {
    if (!isFuture(cell.date, cell.start)) return { success: false, message: null, data: null, errors: { form: "Ca này đã bắt đầu, không thể thay đổi." } };

    const body = toApiShift({ staffId, date: cell.date, slot: cell.slot, room: cell.room, start: cell.start, end: cell.end });
    const result = await call(() => (cell.shiftId ? api.put(`/api/work-shifts/${cell.shiftId}`, body) : api.post("/api/work-shifts", body)));
    return toSaveResult(result);
};

export const deleteShift = async ({ cell }) => {
    if (!isFuture(cell.date, cell.start)) return { success: false, message: null, data: null, errors: { form: "Ca này đã bắt đầu, không thể xoá." } };
    return toSaveResult(await call(() => api.delete(`/api/work-shifts/${cell.shiftId}`)));
};

// Creates shifts one at a time, so a refused one (clash found by the backend) does not stop the others.
// Returns how many were created and the refused ones with the reason.
const createShifts = async (bodies) => {
    let created = 0;
    const refused = [];
    for (const body of bodies) {
        const result = await call(() => api.post("/api/work-shifts", body));
        if (result.success) created++;
        else refused.push({ body, reason: toVietnamese(result.message) });
    }
    return { created, refused };
};

// Fills the empty places of a week with the people of the same shifts a week earlier (skipping anyone on leave or busy).
export const copyPreviousWeek = async ({ weekStart }) => {
    const from = startOfWeek(parseDay(weekStart));
    const fromKey = toDateOnly(from);
    const toKey = toDateOnly(addDays(from, 6));
    const { failed, data } = await loadAll([
        loadShifts(toDateOnly(addDays(from, -7)), toDateOnly(addDays(from, -1))),
        loadShifts(fromKey, toKey),
        loadLeaves(fromKey, toKey),
        loadRooms(),
    ]);
    if (failed) return failed;
    const [previousShifts, currentShifts, leaves, rooms] = data;
    const activeRoomIds = new Set(rooms.active.map((room) => String(room.id)));

    const bodies = [];
    const taken = [...currentShifts];
    for (const shift of previousShifts) {
        const date = toDateOnly(addDays(parseDay(shift.scheduleDate), 7));
        const slot = slotOfTime(shift.shiftStart);
        const roomKey = String(roomIdOf(shift));
        if (!activeRoomIds.has(roomKey) || !isFuture(date, hhmm(shift.shiftStart))) continue;
        const sameSlot = shiftsAt(taken, date, slot);
        // The room already has someone (the reception desk can have several people), or the person already works then
        if (roomKey !== RECEPTION_DESK.id && sameSlot.some((other) => String(roomIdOf(other)) === roomKey)) continue;
        if (sameSlot.some((other) => other.staffUserId === shift.staffUserId)) continue;
        if (leaveOf(leaves, shift.staffUserId, date, slot)) continue;

        const body = {
            staffUserId: shift.staffUserId,
            scheduleDate: date,
            shiftStart: shift.shiftStart,
            shiftEnd: shift.shiftEnd,
            roomId: shift.roomId,
            assignment: shift.assignment,
        };
        bodies.push(body);
        taken.push({ ...body, id: null });
    }

    const { created } = await createShifts(bodies);
    return {
        success: true,
        errors: null,
        data: { copied: created },
        message: created > 0 ? `Đã sao chép ${created} ca từ tuần trước.` : "Không có ca trống nào để sao chép.",
    };
};

// Staff who can be given a monthly schedule, and the rooms (plus the reception desk) they can work in.
export const getShiftStaff = async () => {
    const { failed, data } = await loadAll([loadStaff(), loadRooms()]);
    if (failed) return failed;
    const [staff, rooms] = data;
    const roles = SHIFT_ROLE_OPTIONS.map((option) => option.value);
    return {
        success: true,
        message: null,
        errors: null,
        data: { staff: staff.filter((member) => member.isActive && roles.includes(member.role)), rooms: rooms.active },
    };
};

// Rooms a role can work in, for the monthly schedule.
export const roomsForRole = (rooms, role) => rooms.filter((room) => roomTypeRole(room.type) === role);

// Key for a calendar cell / deselection: "yyyy-mm-dd|morning"
export const monthlyShiftKey = (date, slot) => `${date}|${slot}`;

// FE weekday 0=Mon … 6=Sun → .NET DayOfWeek 0=Sun … 6=Sat (bulk API).
const toBulkDayOfWeek = (feWeekday) => (feWeekday + 1) % 7;

const hhmmOnly = (value) => {
    if (value == null) return "";
    const text = String(value);
    return text.length >= 5 ? text.slice(0, 5) : text;
};

const dateOnlyOf = (value) => {
    if (value == null) return "";
    if (typeof value === "string") return value.slice(0, 10);
    return String(value).slice(0, 10);
};

// Bulk API accepts one roomId per request; the monthly form can pick a different room per weekday/slot.
// Group as one request per (room, slot) with the weekdays that use that room for that slot.
const buildMonthlyBulkGroups = (pattern, rooms) => {
    const roomById = (id) => rooms.find((room) => String(room.id) === String(id));
    const groups = new Map();
    pattern.forEach((dayPattern, feWeekday) => {
        SHIFT_SLOT_OPTIONS.forEach((slot) => {
            const selected = dayPattern?.[slot.value];
            if (!selected) return;
            const room = roomById(selected);
            if (!room) return;
            const apiRoomId = room.id === RECEPTION_DESK.id ? null : Number(room.id);
            const key = `${apiRoomId ?? "reception"}|${slot.value}`;
            if (!groups.has(key)) {
                groups.set(key, { room, apiRoomId, slot, daysOfWeek: new Set() });
            }
            groups.get(key).daysOfWeek.add(toBulkDayOfWeek(feWeekday));
        });
    });
    return [...groups.values()];
};

const toBulkBody = ({ staffId, from, to, group, skippedItems }) => ({
    staffUserIds: [staffId],
    fromDate: from,
    toDate: to,
    daysOfWeek: [...group.daysOfWeek],
    slots: [{ shiftStart: `${group.slot.start}:00`, shiftEnd: `${group.slot.end}:00` }],
    roomId: group.apiRoomId,
    assignment: assignmentOf(group.room),
    skippedItems: skippedItems?.length ? skippedItems : undefined,
});

const mapBulkPreviewItem = (item, rooms) => {
    const date = dateOnlyOf(item.scheduleDate);
    const start = hhmmOnly(item.shiftStart);
    const end = hhmmOnly(item.shiftEnd);
    const slot = slotOfTime(`${start}:00`);
    const slotOption = slotOf(slot);
    const room =
        item.roomId == null
            ? RECEPTION_DESK
            : (rooms.find((entry) => String(entry.id) === String(item.roomId)) ?? { id: item.roomId, name: `Phòng ${item.roomId}` });
    return {
        key: monthlyShiftKey(date, slot),
        date,
        slot,
        slotLabel: slot === SHIFT_SLOTS.MORNING ? "Sáng" : "Chiều",
        start: slotOption.start,
        end: slotOption.end,
        roomId: room.id,
        roomName: room.name,
        valid: Boolean(item.valid),
        reason: item.valid ? null : toVietnamese(item.reason),
    };
};

const skippedItemFromKey = (staffId, key) => {
    const [date, slot] = key.split("|");
    const slotOption = slotOf(slot);
    if (!date || !slotOption) return null;
    return { staffUserId: staffId, scheduleDate: date, shiftStart: `${slotOption.start}:00` };
};

// Monthly schedule via bulk APIs (preview + create). Still one person + weekly room pattern on the form.
// dryRun → POST /api/work-shifts/bulk/preview (one call per room×slot group), merged into calendar items.
// create → POST /api/work-shifts/bulk with skippedItems for deselected chips and leave slots.
export const createMonthlyShifts = async ({ staffId, staffName, rooms, from, to, pattern, dryRun = false, excludeKeys = [] }) => {
    if (!staffId) return { success: false, message: null, data: null, errors: { staffId: "Vui lòng chọn nhân viên." } };
    if (!from || !to || from > to) return { success: false, message: null, data: null, errors: { to: "Đến ngày phải sau Từ ngày." } };

    const groups = buildMonthlyBulkGroups(pattern, rooms);
    if (groups.length === 0) {
        return {
            success: true,
            message: null,
            errors: null,
            data: { created: 0, skippedLeave: [], conflicts: [], items: [] },
        };
    }

    const leavesResult = await loadLeaves(from, to);
    if (!leavesResult.success) return leavesResult;
    const leaves = leavesResult.data;

    if (dryRun) {
        const itemsByKey = new Map();
        for (const group of groups) {
            const preview = await call(() => api.post("/api/work-shifts/bulk/preview", toBulkBody({ staffId, from, to, group })));
            if (!preview.success) return { ...preview, message: toVietnamese(preview.message), errors: { form: toVietnamese(preview.message) } };
            (preview.data?.items ?? []).forEach((raw) => {
                const mapped = mapBulkPreviewItem(raw, rooms);
                itemsByKey.set(mapped.key, mapped);
            });
        }

        const skippedLeave = [];
        const conflicts = [];
        const items = [...itemsByKey.values()].map((item) => {
            if (item.valid && leaveOf(leaves, staffId, item.date, item.slot)) {
                skippedLeave.push(item.date);
                return { ...item, valid: false, reason: "Nghỉ phép" };
            }
            if (!item.valid) conflicts.push({ date: item.date, slot: item.slot, reason: item.reason });
            return item;
        });

        return {
            success: true,
            message: null,
            errors: null,
            data: {
                created: items.filter((item) => item.valid).length,
                skippedLeave,
                conflicts,
                items,
            },
        };
    }

    const leaveSkipKeys = [];
    for (let day = parseDay(from); toDateOnly(day) <= to; day = addDays(day, 1)) {
        const date = toDateOnly(day);
        for (const slot of SHIFT_SLOT_OPTIONS) {
            if (leaveOf(leaves, staffId, date, slot.value)) leaveSkipKeys.push(monthlyShiftKey(date, slot.value));
        }
    }

    const skippedItems = [...new Set([...excludeKeys, ...leaveSkipKeys])]
        .map((key) => skippedItemFromKey(staffId, key))
        .filter(Boolean);

    let created = 0;
    let hardFailure = null;

    for (const group of groups) {
        const result = await call(() => api.post("/api/work-shifts/bulk", toBulkBody({ staffId, from, to, group, skippedItems })));
        if (result.success) {
            created += result.data?.createdCount ?? 0;
            continue;
        }
        if (result.message === "No valid work shifts to create") continue;
        hardFailure = result;
        break;
    }

    if (hardFailure) {
        return { ...hardFailure, message: toVietnamese(hardFailure.message), errors: { form: toVietnamese(hardFailure.message) } };
    }

    // conflicts left empty: bulk also returns known preview-invalids in skipped; popup lists those from previewItems.
    return {
        success: true,
        errors: null,
        data: {
            created,
            skippedLeave: leaveSkipKeys.map((key) => key.split("|")[0]),
            conflicts: [],
            items: [],
        },
        message: `Đã tạo ${created} ca cho ${staffName}.`,
    };
};

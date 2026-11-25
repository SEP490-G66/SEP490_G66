// Room types and statuses of the Rooms API (RoomConstants / RoomTypeConstants on the backend), used by the room,
// shift and service pages.

export const ROOM_TYPES = {
    GENERAL_TREATMENT: "GeneralTreatment",
    MINOR_SURGERY: "MinorSurgery",
    XRAY: "XRay",
};

export const ROOM_TYPE_OPTIONS = [
    { value: ROOM_TYPES.GENERAL_TREATMENT, label: "Phòng khám" },
    { value: ROOM_TYPES.XRAY, label: "Phòng chụp chiếu" },
    { value: ROOM_TYPES.MINOR_SURGERY, label: "Phòng tiểu phẫu" },
];

export const ROOM_STATUSES = {
    ACTIVE: "Active",
    MAINTENANCE: "Maintenance",
    INACTIVE: "Inactive",
};

export const ROOM_STATUS_OPTIONS = [
    { value: ROOM_STATUSES.ACTIVE, label: "Hoạt động", badge: "badge-success" },
    { value: ROOM_STATUSES.MAINTENANCE, label: "Bảo trì", badge: "badge-warning" },
    { value: ROOM_STATUSES.INACTIVE, label: "Ngừng sử dụng", badge: "badge-neutral" },
];

// A doctor working in these kinds of room can take patients whose services need every required type.
// Unknown room types (an older backend) never block; the backend checks again.
export const fitsRoomTypes = (roomTypes = [], ...required) => !roomTypes.length || required.every((type) => !type || roomTypes.includes(type));

// Doctor id -> kinds of room of the given shifts (doctors-on-duty rows)
export const roomTypesByDoctor = (shifts = []) => {
    const map = new Map();
    shifts.forEach((s) => {
        const types = map.get(s.doctorId) ?? [];
        if (s.roomType && !types.includes(s.roomType)) types.push(s.roomType);
        map.set(s.doctorId, types);
    });
    return map;
};

export const roomTypeLabel = (type) => ROOM_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

// The reception desk is not a room on the backend: a receptionist's shift has no room (roomId null).
// The shift schedule shows it as one more row, with this id and type.
export const RECEPTION_DESK = { id: "reception", name: "Phòng tiếp tân", type: "Reception", floor: "" };

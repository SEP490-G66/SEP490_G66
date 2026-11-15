// TODO(api): mock room types, only for the service pages until they use the Services API.
// The "Phòng" and "Phân ca" pages use the Rooms API and utils/room.
export const ROOM_TYPES = {
    GENERAL: "general",
    MINOR_SURGERY: "minor_surgery",
    SPECIALIZED: "specialized",
    XRAY: "xray",
    RECEPTION: "reception",
};

export const ROOM_TYPE_OPTIONS = [
    { value: ROOM_TYPES.GENERAL, label: "Điều trị tổng quát" },
    { value: ROOM_TYPES.MINOR_SURGERY, label: "Tiểu phẫu" },
    { value: ROOM_TYPES.SPECIALIZED, label: "Điều trị chuyên sâu" },
    { value: ROOM_TYPES.XRAY, label: "Chụp X-quang" },
    { value: ROOM_TYPES.RECEPTION, label: "Tiếp tân" },
];

export const roomTypeLabel = (type) => ROOM_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;

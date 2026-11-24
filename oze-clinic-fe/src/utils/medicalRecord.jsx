export const NO_PLAN = "none";
export const SORT_OPTIONS = [
    { value: "desc", label: "Mới nhất trước" },
    { value: "asc", label: "Cũ nhất trước" },
];
export const EMPTY_FILTERS = { doctor: [], plan: [], month: [] };
const ID_PATTERN = /^[1-9]\d*$/;

export const norm = (value) =>
    String(value ?? "")
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();

export const parseRecordId = (value) => (typeof value === "string" && ID_PATTERN.test(value) ? Number(value) : null);

const isDisplayValue = (value) => typeof value === "string" || (typeof value === "number" && Number.isFinite(value));

export const displayText = (value) => (isDisplayValue(value) ? String(value) : "—");

export const monthOf = (date) => {
    const match = String(date ?? "").match(/\d{2}\/(\d{2})\/(\d{4})/);
    return match ? `Tháng ${Number(match[1])}/${match[2]}` : "Chưa xác định";
};

export const nextSelection = (ui, list, target, newestId, urlHasId) => {
    if (!list.length) return { selectionLost: true, pageVisitId: null, replaceId: null };
    const keep = !ui.selectionLost && list.some((visit) => visit.id === target);
    if (keep) return { selectionLost: false, pageVisitId: target, replaceId: null };
    const first = list[0].id;
    const replaceId = !urlHasId && first === newestId ? null : first;
    return { selectionLost: false, pageVisitId: first, replaceId };
};

export const teethLinks = (teeth) => (/^\d/.test(String(teeth ?? "")) ? String(teeth).split(/,\s*/) : null);

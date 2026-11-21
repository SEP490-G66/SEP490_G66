import { SYSTEM_ACTOR, auditFieldLabel, auditRoleLabel } from "../utils/constants/auditLog";
import api from "./api";
import { call } from "./receptionService";

// Audit log of the clinic manager (api/audit-logs), read only, newest first.
// keyword finds a person by name, an IP address or a record id (done by the backend).

export const AUDIT_LOG_PAGE_SIZE = 10;
// The backend returns at most 100 rows a page; the Excel export reads the pages one after another.
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 50;

const MESSAGES = {
    "Audit log not found.": "Không tìm thấy nhật ký này.",
    "From date must be on or before to date.": "Từ ngày phải trước hoặc bằng Đến ngày.",
};

const toVietnamese = (result) => ({ ...result, message: MESSAGES[result.message] ?? result.message });

const toLog = (item) => ({
    id: item.id,
    userId: item.userId,
    userName: item.userName ?? (item.userId ? item.userId : SYSTEM_ACTOR),
    userRole: item.userId ? auditRoleLabel(item.userRole) : "",
    action: item.action,
    entityType: item.entityType,
    entityId: item.entityId,
    ipAddress: item.ipAddress ?? "",
    userAgent: item.userAgent ?? "",
    createdAt: item.createdAt,
});

const toParams = ({ keyword = "", from = "", to = "", action = "", entityType = "" }) => ({
    keyword: keyword || undefined,
    fromDate: from || undefined,
    toDate: to || undefined,
    action: action || undefined,
    entityType: entityType || undefined,
});

const getPage = (filters, page, pageSize) => call(() => api.get("/api/audit-logs", { params: { ...toParams(filters), page, pageSize } }));

export const getAuditLogs = async ({ page = 1, pageSize = AUDIT_LOG_PAGE_SIZE, ...filters } = {}) => {
    const result = await getPage(filters, page, pageSize);
    if (!result.success) return toVietnamese(result);
    const data = result.data;
    return {
        ...result,
        data: { items: data.items.map(toLog), page: data.page, pageSize: data.pageSize, totalItems: data.totalItems, totalPages: Math.max(1, data.totalPages) },
    };
};

// Every log matching the filters, for the Excel export (at most EXPORT_PAGE_SIZE x EXPORT_MAX_PAGES rows).
export const getAllAuditLogs = async (filters = {}) => {
    const items = [];
    for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
        const result = await getPage(filters, page, EXPORT_PAGE_SIZE);
        if (!result.success) return toVietnamese(result);
        items.push(...result.data.items.map(toLog));
        if (page >= result.data.totalPages) break;
    }
    return { success: true, message: null, errors: null, data: items };
};

const parseJson = (text) => {
    if (!text) return null;
    try {
        const value = JSON.parse(text);
        return value && typeof value === "object" && !Array.isArray(value) ? value : { Value: value };
    } catch {
        return { Value: text };
    }
};

const showValue = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Có" : "Không";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
};

// One entry with what changed: changes [{ field, before, after }] when it has values before and after,
// data [{ field, value }] when it only has the values after (or before), and note (reason given with the action).
export const getAuditLog = async (id) => {
    const result = await call(() => api.get(`/api/audit-logs/${id}`));
    if (!result.success) return toVietnamese(result);

    const before = parseJson(result.data.oldValues);
    const after = parseJson(result.data.newValues);
    let changes = [];
    let data = [];
    if (before && after) {
        const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];
        changes = fields.map((field) => ({ field: auditFieldLabel(field), before: showValue(before[field]), after: showValue(after[field]) }));
    } else {
        data = Object.entries(after ?? before ?? {}).map(([field, value]) => ({ field: auditFieldLabel(field), value: showValue(value) }));
    }

    return { ...result, data: { ...toLog(result.data), changes, data, onlyBefore: Boolean(before && !after), note: result.data.additionalData } };
};

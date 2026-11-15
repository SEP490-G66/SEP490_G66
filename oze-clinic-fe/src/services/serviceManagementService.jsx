import api from "./api";
import { call } from "./receptionService";

// Services and their variants ("loại dịch vụ") of the clinic manager: api/Services and api/Services/{id}/variants.
// A service with active variants is booked by variant, so its price shows as "Từ" the cheapest active variant.
// ServiceDto has no variant count, so the variants of each service on the page are read alongside the list.
// Turning off is immediate (no date or reason on the backend); nothing is deleted, a service or variant is turned off.

export const SERVICE_PAGE_SIZE = 10;
const CODE_PAGE_SIZE = 100;
const CODE_PREFIX = "DV";
const GENERIC_ERROR = "Có lỗi xảy ra, vui lòng thử lại sau.";

// Texts of ErrorConstants.ServiceMessage / ServiceVariantMessage and the success texts of ClinicServiceService.
// [field, text]: a failure about one form field; a plain text: a message for the whole form or a toast.
const MESSAGES = {
    "Service not found in system": "Dịch vụ không còn tồn tại.",
    "Service code already exists in system": ["code", "Mã dịch vụ đã tồn tại."],
    "Required room type must be one of: GeneralTreatment, MinorSurgery, XRay": ["roomType", "Loại phòng không hợp lệ."],
    "Reference price must be greater than or equal to 0": ["price", "Giá tham khảo không được âm."],
    "Estimated minutes must be greater than 0": ["durationMinutes", "Thời gian phải lớn hơn 0."],
    "This service is in appointments that are not finished yet; it cannot be turned off now":
        "Dịch vụ đang có lịch hẹn chưa hoàn thành nên chưa thể ngưng hoạt động.",
    "Service variant not found in system": "Loại dịch vụ không còn tồn tại.",
    "Variant code already exists in system": ["code", "Mã loại dịch vụ đã tồn tại."],
    "Display order must be greater than or equal to 0": "Thứ tự hiển thị không hợp lệ.",
    "This variant is in appointments that are not finished yet; it cannot be turned off now":
        "Loại dịch vụ đang có lịch hẹn chưa hoàn thành nên chưa thể ngưng hoạt động.",
    "Service created successfully": "Đã thêm dịch vụ.",
    "Service updated successfully": "Đã cập nhật dịch vụ.",
    "Service activated successfully": "Đã kích hoạt lại dịch vụ.",
    "Service deactivated successfully": "Đã ngưng hoạt động dịch vụ.",
    "Variant created successfully": "Đã thêm loại dịch vụ.",
    "Variant updated successfully": "Đã cập nhật loại dịch vụ.",
    "Variant activated successfully": "Đã kích hoạt lại loại dịch vụ.",
    "Variant deactivated successfully": "Đã ngưng hoạt động loại dịch vụ.",
};

const translate = (result) => {
    const text = MESSAGES[result.message];
    if (Array.isArray(text)) return { ...result, message: text[1], errors: result.success ? null : { [text[0]]: text[1] } };
    return { ...result, message: text ?? result.message ?? (result.success ? null : GENERIC_ERROR), errors: null };
};

const toType = (item) => ({
    id: item.id,
    serviceId: item.serviceId,
    code: item.variantCode,
    name: item.variantName,
    description: item.description ?? "",
    price: Number(item.referencePrice),
    durationMinutes: item.estimatedMinutes,
    sortOrder: item.displayOrder,
    isActive: item.isActive,
});

// basePrice: the service's own price, used when it is booked without a variant.
// price / priceFrom: what the list shows, the cheapest active variant ("Từ ...") when there is one.
const toService = (item, types = []) => {
    const activePrices = types.filter((type) => type.isActive).map((type) => type.price);
    const basePrice = Number(item.referencePrice);
    return {
        id: item.id,
        code: item.serviceCode,
        name: item.serviceName,
        description: item.description ?? "",
        roomType: item.requiredRoomType ?? "",
        basePrice,
        price: activePrices.length ? Math.min(...activePrices) : basePrice,
        priceFrom: activePrices.length > 0,
        durationMinutes: item.estimatedMinutes,
        recallIntervalMonths: item.recallIntervalMonths,
        isActive: item.isActive,
        typeCount: types.length,
    };
};

const loadTypes = async (serviceId) => {
    const result = await call(() => api.get(`/api/Services/${serviceId}/variants`));
    return result.success ? { ...result, data: result.data.map(toType) } : translate(result);
};

// status: "" (all), "active" or "inactive"; roomType: "" or a ROOM_TYPES value of utils/room.
export const getServices = async ({ keyword = "", roomType = "", status = "", page = 1, pageSize = SERVICE_PAGE_SIZE } = {}) => {
    const result = await call(() =>
        api.get("/api/Services", {
            params: {
                pageNumber: page,
                pageSize,
                searchKeyword: keyword || undefined,
                requiredRoomType: roomType || undefined,
                isActive: status ? status === "active" : undefined,
                sortBy: "code",
            },
        }),
    );
    if (!result.success) return translate(result);

    const data = result.data;
    const typeResults = await Promise.all(data.items.map((item) => loadTypes(item.id)));
    return {
        ...result,
        data: {
            items: data.items.map((item, index) => toService(item, typeResults[index].success ? typeResults[index].data : [])),
            page: data.pageNumber,
            pageSize: data.pageSize,
            totalItems: data.totalCount,
            totalPages: Math.max(1, data.totalPages),
        },
    };
};

// Next free "DVnnn" code, to fill the code field of a new service (the manager can change it).
export const getNextServiceCode = async () => {
    let highest = 0;
    for (let page = 1; ; page++) {
        const result = await call(() => api.get("/api/Services", { params: { pageNumber: page, pageSize: CODE_PAGE_SIZE } }));
        if (!result.success) break;
        result.data.items.forEach((item) => {
            const match = /^DV(\d+)$/i.exec(item.serviceCode);
            if (match) highest = Math.max(highest, Number(match[1]));
        });
        if (page >= result.data.totalPages) break;
    }
    return `${CODE_PREFIX}${String(highest + 1).padStart(3, "0")}`;
};

// request: { code, name, price, durationMinutes, roomType, description, recallIntervalMonths }.
const toServiceBody = (request, isActive) => ({
    serviceCode: request.code.trim(),
    serviceName: request.name.trim(),
    description: request.description.trim() || null,
    referencePrice: request.price ?? 0,
    estimatedMinutes: request.durationMinutes ?? null,
    recallIntervalMonths: request.recallIntervalMonths ?? null,
    requiredRoomType: request.roomType || null,
    isActive,
});

// Variant codes follow the service code: DV009-01, DV009-02, ...
const nextTypeCode = (serviceCode, types) => {
    const last = Math.max(0, ...types.map((type) => Number(type.code.split("-").at(-1)) || 0));
    return `${serviceCode}-${String(last + 1).padStart(2, "0")}`;
};

// request: { name, price, durationMinutes, description }.
const toTypeBody = (request, code, displayOrder, isActive) => ({
    variantCode: code,
    variantName: request.name.trim(),
    description: request.description.trim() || null,
    referencePrice: request.price,
    estimatedMinutes: request.durationMinutes ?? null,
    displayOrder,
    isActive,
});

// A new service, then its types one by one. With types, the service's own price is the cheapest type.
export const createService = async ({ types = [], ...request }) => {
    const price = types.length ? Math.min(...types.map((type) => type.price)) : request.price;
    const created = translate(await call(() => api.post("/api/Services", toServiceBody({ ...request, price }, true))));
    if (!created.success) return created;

    const service = created.data;
    let failed = 0;
    for (const [index, type] of types.entries()) {
        const code = `${service.serviceCode}-${String(index + 1).padStart(2, "0")}`;
        const result = await call(() => api.post(`/api/Services/${service.id}/variants`, toTypeBody(type, code, index + 1, true)));
        if (!result.success) failed++;
    }
    const message = failed ? `Đã thêm dịch vụ ${service.serviceCode}, nhưng ${failed} loại chưa tạo được. Hãy thêm lại trong danh sách loại.` : `Đã thêm dịch vụ ${service.serviceCode}.`;
    return { ...created, message };
};

// service: the row being edited (its price is kept when it has types; its status is kept).
export const updateService = async (service, request) => {
    const price = service.typeCount > 0 ? service.basePrice : request.price;
    return translate(await call(() => api.put(`/api/Services/${service.id}`, toServiceBody({ ...request, price }, service.isActive))));
};

const setServiceStatus = async (id, isActive) => translate(await call(() => api.patch(`/api/Services/${id}/status`, { isActive })));

export const activateService = (id) => setServiceStatus(id, true);

// Immediate; refused while unfinished appointments still use the service.
export const deactivateService = (id) => setServiceStatus(id, false);

export const getServiceTypes = async (serviceId) => {
    const result = await loadTypes(serviceId);
    return result.success ? { ...result, data: [...result.data].sort((a, b) => a.sortOrder - b.sortOrder) } : result;
};

// service: { id, code }. The code and position of the new type are worked out from the existing types.
export const createServiceType = async (service, request) => {
    const existing = await loadTypes(service.id);
    if (!existing.success) return existing;
    const types = existing.data;
    const displayOrder = Math.max(0, ...types.map((type) => type.sortOrder)) + 1;
    const body = toTypeBody(request, nextTypeCode(service.code, types), displayOrder, true);
    return translate(await call(() => api.post(`/api/Services/${service.id}/variants`, body)));
};

// type: the type being edited (code, position and status are kept).
export const updateServiceType = async (type, request) =>
    translate(await call(() => api.put(`/api/Services/${type.serviceId}/variants/${type.id}`, toTypeBody(request, type.code, type.sortOrder, null))));

const setTypeStatus = async (type, isActive) =>
    translate(await call(() => api.patch(`/api/Services/${type.serviceId}/variants/${type.id}/status`, { isActive })));

export const activateServiceType = (type) => setTypeStatus(type, true);

export const deactivateServiceType = (type) => setTypeStatus(type, false);

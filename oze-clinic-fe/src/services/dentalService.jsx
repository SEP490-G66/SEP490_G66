import api from "./api";
import { call } from "./receptionService";
import { FOOTER_SERVICE_SLUGS, MENU_SERVICES, PUBLIC_SERVICES } from "../utils/data/publicServices";

export const toSearchText = (value) =>
    (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();

export const getPublicServices = () => PUBLIC_SERVICES;

export const getFeaturedServices = () => PUBLIC_SERVICES.filter((service) => service.featured);

export const getServiceBySlug = (slug) => PUBLIC_SERVICES.find((service) => service.slug === slug) ?? null;

export const searchServices = (keyword) => {
    const text = toSearchText(keyword);
    if (!text) return PUBLIC_SERVICES;
    return PUBLIC_SERVICES.filter((service) => toSearchText(`${service.name} ${service.summary}`).includes(text));
};

export const getFooterServices = () => FOOTER_SERVICE_SLUGS.map((slug) => getServiceBySlug(slug)).filter(Boolean);

export const getMenuServices = () => PUBLIC_SERVICES.filter((service) => !service.hiddenInMenu);

// The service catalog of the database, loaded once per page load; a failed load is tried again next time
let catalogRequest = null;

const loadCatalog = () => {
    catalogRequest ??= call(() => api.get("/api/appointments/bookable-services", { skipErrorPage: true })).then((result) => {
        if (result.success && Array.isArray(result.data)) return result.data;
        catalogRequest = null;
        return null;
    });
    return catalogRequest;
};

// Search over the services read from the database: name, description and variant names
export const filterServices = (services, keyword) => {
    const text = toSearchText(keyword);
    if (!text) return services;
    return services.filter((service) => toSearchText(`${service.name} ${service.intro} ${service.types.map((type) => type.name).join(" ")}`).includes(text));
};

export const isMenuSlug = (slug) => MENU_SERVICES.some((entry) => entry.slug === slug);

// Name, description and variants from the database; the picture, benefits and steps of the website page when it has them
const toMenuService = (row, { slug, imageUrl }) => {
    const page = getServiceBySlug(slug);
    return {
        slug,
        name: row.serviceName,
        imageUrl: imageUrl ?? page?.imageUrl ?? null,
        intro: row.description || page?.intro || "",
        types: (row.variants ?? []).map((variant) => ({ id: variant.variantId, name: variant.variantName, description: variant.description ?? "", imageUrl: null })),
        benefits: page?.benefits ?? [],
        steps: page?.steps ?? [],
    };
};

// The header menu: the website order, only the services that are active in the database
export const loadMenuServices = async () => {
    const rows = await loadCatalog();
    if (!rows) return [];
    return MENU_SERVICES.flatMap((entry) => {
        const row = rows.find((item) => item.serviceCode === entry.code);
        return row ? [toMenuService(row, entry)] : [];
    });
};

// null when the service is not in the database any more; the website page when the catalog could not be loaded
export const loadMenuService = async (slug) => {
    const rows = await loadCatalog();
    if (!rows) return getServiceBySlug(slug);
    const entry = MENU_SERVICES.find((item) => item.slug === slug);
    const row = rows.find((item) => item.serviceCode === entry?.code);
    return row ? toMenuService(row, entry) : null;
};

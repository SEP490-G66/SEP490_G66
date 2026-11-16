import { FOOTER_SERVICE_SLUGS, PUBLIC_SERVICES } from "../utils/data/publicServices";

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

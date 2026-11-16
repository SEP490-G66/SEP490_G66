import { PUBLIC_SERVICES } from "../utils/data/publicServices";

// Public "Dịch vụ" pages use fixed content (landing page), so these read the data file directly, without the API.

// Lower case, no Vietnamese accents (đ → d): "Niềng" and "nieng" match.
export const toSearchText = (value) =>
    (value ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();

// Every service, featured first (the data file keeps that order).
export const getPublicServices = () => PUBLIC_SERVICES;

// The ones shown on the home page.
export const getFeaturedServices = () => PUBLIC_SERVICES.filter((service) => service.featured);

export const getServiceBySlug = (slug) => PUBLIC_SERVICES.find((service) => service.slug === slug) ?? null;

// Services whose name or short description contains the keyword (blank keyword = all).
export const searchServices = (keyword) => {
    const text = toSearchText(keyword);
    if (!text) return PUBLIC_SERVICES;
    return PUBLIC_SERVICES.filter((service) => toSearchText(`${service.name} ${service.summary}`).includes(text));
};

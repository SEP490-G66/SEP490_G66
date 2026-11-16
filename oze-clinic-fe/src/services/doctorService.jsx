import { DOCTORS_PAGE_INTRO, MOCK_DOCTORS } from "../utils/data/mockDoctors";
import { toSearchText } from "./dentalService";

// Doctors on the public pages are fixed content (landing page), read from the data file.

const MOCK_DELAY_MS = 300;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Home page section (kept async as the section expects).
export const getDoctors = async () => {
    await wait(MOCK_DELAY_MS);

    return { success: true, message: null, data: MOCK_DOCTORS, errors: null };
};

export const getPublicDoctors = () => MOCK_DOCTORS;

export const getDoctorsPageIntro = () => DOCTORS_PAGE_INTRO;

// Doctors whose name or position contains the keyword, with or without accents (blank keyword = all).
export const searchDoctors = (keyword) => {
    const text = toSearchText(keyword);
    if (!text) return MOCK_DOCTORS;
    return MOCK_DOCTORS.filter((doctor) =>
        toSearchText(`${doctor.displayTitle} ${doctor.fullName} ${doctor.position}`).includes(text),
    );
};

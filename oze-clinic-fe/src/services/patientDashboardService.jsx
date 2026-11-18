import { getMockCurrentUser } from "../utils/data/mockData";
import { buildEmptyMedicalRecordData, buildMedicalRecordData } from "../utils/data/mockMedicalRecord";
import { MOCK_DASHBOARD_PATIENT_ID } from "../utils/data/mockPatientDashboard";
import { GENERIC_ERROR_MESSAGE } from "../utils/messages";

const MOCK_DELAY_MS = 300;
const MOCK_SWITCH_KEY = "mock_patient_dashboard";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const success = (data) => ({ success: true, message: null, data, errors: null });

const failure = (message) => ({ success: false, message, data: null, errors: null });

export const readMockMode = (key = MOCK_SWITCH_KEY) => (import.meta.env?.DEV && typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);

const abortError = () => new DOMException("Aborted", "AbortError");

export const getMyMedicalRecord = async ({ signal } = {}) => {
    await wait(MOCK_DELAY_MS);
    if (signal?.aborted) throw abortError();
    const mode = readMockMode();
    if (mode === "error") return failure(GENERIC_ERROR_MESSAGE);
    if (getMockCurrentUser()?.id !== MOCK_DASHBOARD_PATIENT_ID || mode === "empty") return success(buildEmptyMedicalRecordData());
    return success(buildMedicalRecordData(mode));
};

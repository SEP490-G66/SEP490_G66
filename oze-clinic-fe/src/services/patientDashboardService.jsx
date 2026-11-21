const MOCK_SWITCH_KEY = "mock_patient_dashboard";

export const readMockMode = (key = MOCK_SWITCH_KEY) => (import.meta.env?.DEV && typeof localStorage !== "undefined" ? localStorage.getItem(key) : null);

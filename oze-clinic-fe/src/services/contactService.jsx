import api from "./api";
import { CONSULTATION_TEXT, VALIDATION_MESSAGES } from "../utils/messages";
import { requiredMessage } from "../utils/validation";

const ERROR_MESSAGES = new Map([
    ["A request from this phone number was sent a few minutes ago. The clinic will call you back.", CONSULTATION_TEXT.ALREADY_SENT],
    ["Phone number is invalid. Please check again.", VALIDATION_MESSAGES.PHONE_INVALID],
    ["Please enter full name.", requiredMessage("họ và tên")],
    ["Email is invalid. Please check again.", VALIDATION_MESSAGES.EMAIL_INVALID],
]);

const failure = (message) => ({ success: false, message, data: null, errors: null });

export const submitConsultationRequest = async ({ fullName, phone, email, note }) => {
    try {
        const response = await api.post(
            "/api/consultation-requests",
            { fullName, phoneNumber: phone, email: email || null, note: note || null },
            { skipErrorPage: true },
        );
        return response.data;
    } catch (error) {
        return failure(ERROR_MESSAGES.get(error.response?.data?.message) ?? CONSULTATION_TEXT.SEND_FAILED);
    }
};

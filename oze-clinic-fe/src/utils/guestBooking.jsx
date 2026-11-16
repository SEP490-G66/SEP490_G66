import { GUEST_BOOKING_TEXT as TEXT } from "./messages";
import { isRequiredEmpty, normalizePhone, validateEmail, validatePhone } from "./validation";

// Fields of the guest booking form (pages/common/GuestBookAppointment.jsx)
export const GUEST_FIELD_IDS = {
    FULL_NAME: "guest-full-name",
    GENDER: "guest-gender-male",
    BIRTHDATE: "guest-birthdate",
    PHONE: "guest-phone",
    ADDRESS: "guest-address",
    EMAIL: "guest-email",
};

export const EMPTY_GUEST = { fullName: "", gender: "", birthdate: "", phone: "", address: "", email: "" };

// Field → message. today: clinic date "yyyy-mm-dd" (a birth date after it is wrong).
export const validateGuest = (values, today) => {
    const errors = {};
    const name = values.fullName.trim();
    if (!name) errors.fullName = TEXT.ERR_FULL_NAME;
    else if (name.length > 100) errors.fullName = TEXT.ERR_FULL_NAME_LONG;
    if (!values.gender) errors.gender = TEXT.ERR_GENDER;
    if (!values.birthdate) errors.birthdate = TEXT.ERR_BIRTHDATE;
    else if (values.birthdate > today) errors.birthdate = TEXT.ERR_BIRTHDATE_FUTURE;
    const phone = validatePhone(values.phone);
    if (phone) errors.phone = phone;
    const email = isRequiredEmpty(values.email) ? undefined : validateEmail(values.email.trim());
    if (email) errors.email = email;
    return errors;
};

// The id of the first wrong field, in page order (to move the focus there)
export const firstGuestError = (errors) =>
    [
        ["fullName", GUEST_FIELD_IDS.FULL_NAME],
        ["gender", GUEST_FIELD_IDS.GENDER],
        ["birthdate", GUEST_FIELD_IDS.BIRTHDATE],
        ["phone", GUEST_FIELD_IDS.PHONE],
        ["email", GUEST_FIELD_IDS.EMAIL],
    ].find(([key]) => errors[key])?.[1] ?? null;

// The guest's details added to the booking payload (POST /api/appointments/guest-booking)
export const guestPayload = (values) => ({
    FullName: values.fullName.trim(),
    PhoneNumber: normalizePhone(values.phone),
    Email: values.email.trim() || null,
    Gender: values.gender,
    DateOfBirth: values.birthdate,
    Address: values.address.trim() || null,
});

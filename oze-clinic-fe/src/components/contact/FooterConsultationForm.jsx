import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { submitConsultationRequest } from "@/services/contactService";
import { CONSULTATION_TEXT, PROFILE_LIMITS } from "@/utils/messages";
import { normalizePhone, validateFullName, validatePhone } from "@/utils/validation";

const NAME_ID = "footer-consult-name";
const PHONE_ID = "footer-consult-phone";

const EMPTY_VALUES = { fullName: "", phone: "" };

const FIELDS = {
    fullName: validateFullName,
    phone: validatePhone,
};

const validate = (values) => {
    const errors = {};
    for (const [name, validateField] of Object.entries(FIELDS)) {
        const error = validateField(values[name]);
        if (error) errors[name] = error;
    }
    return errors;
};

const FooterConsultationForm = ({ headingClassName }) => {
    const nameRef = useRef(null);
    const phoneRef = useRef(null);
    const [values, setValues] = useState(EMPTY_VALUES);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => ({ ...current, [name]: undefined }));
    };

    const handleBlur = (event) => {
        const { name, value } = event.target;
        if (value.trim() === "") return;
        const error = FIELDS[name](value);
        if (error) setErrors((current) => ({ ...current, [name]: error }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;

        const nextErrors = validate(values);
        setErrors(nextErrors);
        if (nextErrors.fullName) {
            nameRef.current?.focus();
            return;
        }
        if (nextErrors.phone) {
            phoneRef.current?.focus();
            return;
        }

        setLoading(true);
        try {
            const result = await submitConsultationRequest({
                fullName: values.fullName.trim(),
                phone: normalizePhone(values.phone),
            });
            if (result.success) {
                toast.success(CONSULTATION_TEXT.SUCCESS);
                setValues(EMPTY_VALUES);
                return;
            }
            toast.error(result.message);
        } finally {
            setLoading(false);
        }
    };

    const describedBy = (name, id) => (errors[name] ? `${id}-error` : undefined);

    return (
        <form noValidate onSubmit={handleSubmit} aria-labelledby="footer-consult-title" className="flex flex-col gap-4 sm:gap-5">
            <h3 id="footer-consult-title" className={headingClassName}>
                Đăng ký tư vấn
            </h3>
            <div className="field">
                <label htmlFor={NAME_ID} className="label label-required">
                    Họ và tên
                </label>
                <input
                    ref={nameRef}
                    id={NAME_ID}
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    maxLength={PROFILE_LIMITS.FULL_NAME_MAX}
                    placeholder="Nguyễn Văn A"
                    className="input"
                    aria-required="true"
                    aria-invalid={errors.fullName ? true : undefined}
                    aria-describedby={describedBy("fullName", NAME_ID)}
                    value={values.fullName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                />
                {errors.fullName && (
                    <p id={`${NAME_ID}-error`} className="error-text">
                        {errors.fullName}
                    </p>
                )}
            </div>
            <div className="field">
                <label htmlFor={PHONE_ID} className="label label-required">
                    Số điện thoại
                </label>
                <div className="flex gap-3">
                    <input
                        ref={phoneRef}
                        id={PHONE_ID}
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="0912 345 678"
                        className="input min-w-0 flex-1"
                        aria-required="true"
                        aria-invalid={errors.phone ? true : undefined}
                        aria-describedby={describedBy("phone", PHONE_ID)}
                        value={values.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        aria-busy={loading || undefined}
                        className="btn btn-primary shrink-0 px-6"
                    >
                        {loading && <span className="btn-spinner" aria-hidden="true" />}
                        Gửi
                    </button>
                </div>
                {errors.phone && (
                    <p id={`${PHONE_ID}-error`} className="error-text">
                        {errors.phone}
                    </p>
                )}
            </div>
        </form>
    );
};

export default FooterConsultationForm;

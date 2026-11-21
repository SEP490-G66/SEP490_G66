import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@/components/ui/Card";
import { requestPasswordReset } from "../../services/authService";
import { VERIFICATION_METHOD, VERIFICATION_METHOD_OPTIONS } from "../../utils/messages";
import { ROUTES } from "../../utils/routes";
import { isRequiredEmpty, normalizePhone, requiredMessage, validateEmail, validatePhone } from "../../utils/validation";

const FIELDS = {
    [VERIFICATION_METHOD.SMS]: {
        id: "phone",
        label: "Số điện thoại",
        type: "tel",
        inputMode: "numeric",
        autoComplete: "tel",
        placeholder: "0912 345 678",
        validate: (value) => validatePhone(value),
        normalize: (value) => normalizePhone(value),
    },
    [VERIFICATION_METHOD.EMAIL]: {
        id: "email",
        label: "Email",
        type: "email",
        inputMode: "email",
        autoComplete: "email",
        placeholder: "ten@example.com",
        validate: (value) => (isRequiredEmpty(value) ? requiredMessage("email") : validateEmail(value.trim())),
        normalize: (value) => value.trim(),
    },
};

const EMPTY_VALUES = { [VERIFICATION_METHOD.SMS]: "", [VERIFICATION_METHOD.EMAIL]: "" };

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [method, setMethod] = useState(VERIFICATION_METHOD.SMS);
    const [values, setValues] = useState(EMPTY_VALUES);
    const [error, setError] = useState();
    const [loading, setLoading] = useState(false);
    const field = FIELDS[method];
    const value = values[method];
    const errorId = `${field.id}-error`;

    const handleValueChange = (event) => {
        const next = event.target.value;
        setValues((current) => ({ ...current, [method]: next }));
        setError(undefined);
    };

    const handleBlur = (event) => {
        if (isRequiredEmpty(event.target.value)) return;
        const fieldError = field.validate(event.target.value);
        if (fieldError) setError(fieldError);
    };

    const handleMethodChange = (event) => {
        setMethod(event.target.value);
        setError(undefined);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;

        const fieldError = field.validate(value);
        setError(fieldError);
        if (fieldError) {
            inputRef.current?.focus();
            return;
        }

        const identifier = field.normalize(value);
        setLoading(true);
        try {
            const result = await requestPasswordReset({ identifier });
            if (result.success) {
                const { sessionId, maskedDestination } = result.data;
                navigate(ROUTES.VERIFY_OTP, { state: { identifier, method, sessionId, maskedDestination } });
                return;
            }
            setError(result.message);
            inputRef.current?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="auth-page">
            <Card variant="auth" className="w-full max-w-md">
                <h1 className="auth-title">Khôi phục tài khoản</h1>
                <p className="auth-subtitle">
                    Vui lòng cung cấp thông tin để xác minh tài khoản.
                </p>

                <form noValidate onSubmit={handleSubmit}>
                    <fieldset>
                        <legend className="label">Nhận mã xác minh qua</legend>
                        <div className="flex flex-wrap gap-x-6">
                            {VERIFICATION_METHOD_OPTIONS.map((option) => (
                                <div key={option.value} className="flex h-control items-center gap-2">
                                    <input
                                        id={`method-${option.value}`}
                                        name="method"
                                        type="radio"
                                        value={option.value}
                                        checked={method === option.value}
                                        onChange={handleMethodChange}
                                    />
                                    <label htmlFor={`method-${option.value}`} className="label cursor-pointer">
                                        {option.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    <div className="field mt-4">
                        <label htmlFor={field.id} className="label label-required">
                            {field.label}
                        </label>
                        <input
                            key={field.id}
                            ref={inputRef}
                            id={field.id}
                            name={field.id}
                            type={field.type}
                            inputMode={field.inputMode}
                            autoComplete={field.autoComplete}
                            placeholder={field.placeholder}
                            className="input"
                            aria-required="true"
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            value={value}
                            onChange={handleValueChange}
                            onBlur={handleBlur}
                        />
                        {error && (
                            <p id={errorId} className="error-text">
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        aria-busy={loading || undefined}
                        className="btn btn-primary btn-lg mt-6 w-full"
                    >
                        {loading && <span className="btn-spinner" aria-hidden="true" />}
                        {loading ? "Đang gửi mã..." : "Gửi mã OTP"}
                    </button>
                </form>
            </Card>
        </section>
    );
};

export default ForgotPasswordPage;

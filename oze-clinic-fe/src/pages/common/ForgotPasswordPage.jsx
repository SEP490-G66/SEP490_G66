import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@/components/ui/Card";
import { requestPasswordReset } from "../../services/authService";
import { VERIFICATION_METHOD } from "../../utils/messages";
import { ROUTES } from "../../utils/routes";
import { normalizePhone, validatePhone } from "../../utils/validation";

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [phone, setPhone] = useState("");
    const [error, setError] = useState();
    const [loading, setLoading] = useState(false);
    const errorId = "phone-error";

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (loading) return;

        const fieldError = validatePhone(phone);
        setError(fieldError);
        if (fieldError) {
            inputRef.current?.focus();
            return;
        }

        const identifier = normalizePhone(phone);
        setLoading(true);
        try {
            const result = await requestPasswordReset({ identifier });
            if (result.success) {
                const { sessionId, maskedDestination } = result.data;
                navigate(ROUTES.VERIFY_OTP, {
                    state: {
                        identifier,
                        method: VERIFICATION_METHOD.SMS,
                        sessionId,
                        maskedDestination,
                    },
                });
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
                    Nhập số điện thoại đã đăng ký để nhận mã OTP qua SMS.
                </p>

                <form noValidate onSubmit={handleSubmit}>
                    <div className="field mt-4">
                        <label htmlFor="phone" className="label label-required">
                            Số điện thoại
                        </label>
                        <input
                            ref={inputRef}
                            id="phone"
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="0912 345 678"
                            className="input"
                            aria-required="true"
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? errorId : undefined}
                            value={phone}
                            onChange={(event) => {
                                setPhone(event.target.value);
                                setError(undefined);
                            }}
                            onBlur={(event) => {
                                if (!event.target.value.trim()) return;
                                const fieldError = validatePhone(event.target.value);
                                if (fieldError) setError(fieldError);
                            }}
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

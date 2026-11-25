import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import CertificatesCard from "@/components/profile/CertificatesCard";
import HealthInfoCard from "@/components/profile/HealthInfoCard";
import Avatar from "@/components/ui/Avatar";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import useAsync from "@/hooks/useAsync";
import {
    PROFILE_FEATURES,
    getMyProfile,
    requestPhoneChange,
    updateContactInfo,
    updateIdentityInfo,
} from "@/services/profileService";
import { GENDER_LABELS, PROFILE_LIMITS, PROFILE_MESSAGES, ROLE_LABELS, USER_ROLES, VALIDATION_MESSAGES } from "@/utils/messages";
import { ROUTES, getErrorRoute } from "@/utils/routes";
import {
    isRequiredEmpty,
    normalizePhone,
    requiredMessage,
    validateEmail,
    validateFullName,
    validatePhone,
} from "@/utils/validation";

const PHONE_UNCHANGED = "Số điện thoại mới trùng với số hiện tại.";

const RELATIONSHIPS = ["Bố", "Mẹ", "Vợ", "Chồng", "Con", "Anh/chị/em", "Khác"];

const EMPTY_CONTACT_PERSON = { fullname: "", relationship: "", phone: "" };

// Local date as YYYY-MM-DD, the format of <input type="date">.
const today = () => new Date().toLocaleDateString("en-CA");

// "1990-01-01" -> "01/01/1990"
const formatDate = (value) => (value ? value.split("-").reverse().join("/") : "");

// "2024-05-12" -> "05/2024"
const formatMonth = (value) => (value ? value.slice(0, 7).split("-").reverse().join("/") : "");

// Card with a title row (title, optional description, optional action on the right) and a body.
const SectionCard = ({ id, title, description, action, children }) => (
    <section aria-labelledby={id} className="card-app p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
                <h2 id={id} className="card-title">
                    {title}
                </h2>
                {description && <p className="mt-1 text-caption text-muted">{description}</p>}
            </div>
            {action}
        </div>
        <div className="px-5 py-5">{children}</div>
    </section>
);

const ReadOnlyField = ({ label, value }) => (
    <div className="field">
        <p className="label">{label}</p>
        <p className="input input-readonly">{value || <span className="text-placeholder">Chưa cập nhật</span>}</p>
    </div>
);

// ---------- Identity ----------

const toIdentityValues = (profile) => ({
    fullname: profile.fullname ?? "",
    birthdate: profile.birthdate ?? "",
    gender: profile.gender ?? "",
});

const toIdentityRequest = (values) => ({
    fullname: values.fullname.trim().replace(/\s+/g, " "),
    birthdate: values.birthdate,
    gender: values.gender,
});

const validateIdentity = (request) => {
    const errors = {};
    const nameError = validateFullName(request.fullname);
    if (nameError) errors.fullname = nameError;
    if (request.birthdate && request.birthdate > today()) errors.birthdate = VALIDATION_MESSAGES.BIRTHDATE_IN_FUTURE;
    return errors;
};

const IdentitySection = ({ profile, onChange }) => {
    const [values, setValues] = useState(() => toIdentityValues(profile));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const request = toIdentityRequest(values);
    const dirty = JSON.stringify(request) !== JSON.stringify(toIdentityRequest(toIdentityValues(profile)));

    const update = (changes, clearErrors) => {
        setValues((current) => ({ ...current, ...changes }));
        setErrors((current) => ({ ...current, ...Object.fromEntries(clearErrors.map((key) => [key, undefined])) }));
    };

    const handleCancel = () => {
        setValues(toIdentityValues(profile));
        setErrors({});
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return;
        const nextErrors = validateIdentity(request);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            event.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
            return;
        }

        setSaving(true);
        const result = await updateIdentityInfo(request, profile);
        setSaving(false);
        if (!result.success) {
            if (result.errors) setErrors(result.errors);
            toast.error(result.message);
            return;
        }
        toast.success(result.message);
        onChange(result.data);
    };

    return (
        <SectionCard
            id="identity-title"
            title="Thông tin nhận dạng"
            description="Dùng để xác định đúng bạn khi khám. Bạn có thể tự cập nhật họ tên, ngày sinh và giới tính."
        >
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField id="identity-fullname" label="Họ và tên" required error={errors.fullname}>
                        <input
                            id="identity-fullname"
                            className="input"
                            maxLength={PROFILE_LIMITS.FULL_NAME_MAX}
                            aria-invalid={Boolean(errors.fullname)}
                            aria-describedby={errors.fullname ? "identity-fullname-error" : undefined}
                            value={values.fullname}
                            onChange={(event) => update({ fullname: event.target.value }, ["fullname"])}
                        />
                    </FormField>
                    <FormField id="identity-birthdate" label="Ngày sinh" error={errors.birthdate}>
                        <input
                            id="identity-birthdate"
                            type="date"
                            className="input"
                            max={today()}
                            aria-invalid={Boolean(errors.birthdate)}
                            aria-describedby={errors.birthdate ? "identity-birthdate-error" : undefined}
                            value={values.birthdate}
                            onChange={(event) => update({ birthdate: event.target.value }, ["birthdate"])}
                        />
                    </FormField>
                    <FormField id="identity-gender" label="Giới tính" error={errors.gender}>
                        <select
                            id="identity-gender"
                            className="input"
                            aria-invalid={Boolean(errors.gender)}
                            aria-describedby={errors.gender ? "identity-gender-error" : undefined}
                            value={values.gender}
                            onChange={(event) => update({ gender: event.target.value }, ["gender"])}
                        >
                            <option value="">Chọn giới tính</option>
                            {Object.entries(GENDER_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </FormField>
                </div>
                <div className="flex justify-end gap-3 border-t border-border pt-5">
                    <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={handleCancel}>
                        Hủy
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                        {saving && <span className="btn-spinner" aria-hidden="true" />}
                        Lưu thay đổi
                    </button>
                </div>
            </form>
        </SectionCard>
    );
};

// ---------- Contact ----------

const goToOtp = (navigate, data) => {
    toast.info(PROFILE_MESSAGES.OTP_SENT);
    navigate(ROUTES.PROFILE_VERIFY_OTP, {
        state: { flow: "profile", sessionId: data.sessionId, maskedDestination: data.maskedDestination },
    });
};

const toContactValues = (profile) => ({
    email: profile.email,
    address: profile.address,
    emergencyContact: profile.emergencyContact,
});

// Values as they are sent and compared: trimmed, phone without spaces, email in lower case.
const toContactRequest = (values) => ({
    email: values.email.trim().toLowerCase(),
    address: values.address.trim(),
    emergencyContact: values.emergencyContact && {
        fullname: values.emergencyContact.fullname.trim().replace(/\s+/g, " "),
        relationship: values.emergencyContact.relationship,
        phone: normalizePhone(values.emergencyContact.phone),
    },
});

const validateContact = (request) => {
    const errors = {};
    const emailError = validateEmail(request.email);
    if (emailError) errors.email = emailError;
    if (request.address.length > PROFILE_LIMITS.ADDRESS_MAX) errors.address = VALIDATION_MESSAGES.ADDRESS_TOO_LONG;

    const person = request.emergencyContact;
    if (person) {
        if (isRequiredEmpty(person.fullname)) errors.contactName = requiredMessage("họ tên người liên hệ");
        if (!person.relationship) errors.contactRelationship = "Vui lòng chọn mối quan hệ.";
        const phoneError = validatePhone(person.phone);
        if (phoneError) errors.contactPhone = phoneError;
    }
    return errors;
};

const EmergencyContactFields = ({ person, errors, onChange, onRemove }) => {
    const fieldProps = (name, errorKey) => ({
        id: `contact-${name}`,
        value: person[name],
        "aria-invalid": Boolean(errors[errorKey]),
        "aria-describedby": errors[errorKey] ? `contact-${name}-error` : undefined,
        onChange: (event) => onChange({ ...person, [name]: event.target.value }),
    });

    return (
        <div className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
                <p className="text-label text-ink">Người liên hệ khẩn cấp</p>
                <button
                    type="button"
                    className="btn btn-icon size-8 hover:bg-surface-tint"
                    aria-label="Bỏ người liên hệ khẩn cấp"
                    title="Bỏ người liên hệ"
                    onClick={onRemove}
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <FormField id="contact-fullname" label="Họ và tên" required error={errors.contactName}>
                        <input {...fieldProps("fullname", "contactName")} className="input" maxLength={PROFILE_LIMITS.FULL_NAME_MAX} placeholder="VD: Nguyễn Thị B" />
                    </FormField>
                </div>
                <FormField id="contact-relationship" label="Mối quan hệ" required error={errors.contactRelationship}>
                    <select {...fieldProps("relationship", "contactRelationship")} className="input">
                        <option value="">Chọn mối quan hệ</option>
                        {RELATIONSHIPS.map((relationship) => (
                            <option key={relationship} value={relationship}>
                                {relationship}
                            </option>
                        ))}
                    </select>
                </FormField>
                <FormField id="contact-phone" label="Số điện thoại" required error={errors.contactPhone}>
                    <input {...fieldProps("phone", "contactPhone")} type="tel" inputMode="numeric" className="input" placeholder="09xx xxx xxx" />
                </FormField>
            </div>
        </div>
    );
};

const StaffContactSection = ({ profile }) => (
    <SectionCard id="contact-title" title="Thông tin liên hệ" description="Thông tin do quản lý phòng khám cập nhật.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Số điện thoại" value={profile.phone} />
            <ReadOnlyField label="Email" value={profile.email} />
            <div className="sm:col-span-2">
                <ReadOnlyField label="Địa chỉ liên hệ" value={profile.address} />
            </div>
        </div>
    </SectionCard>
);

const RemoveEmailModal = ({ saving, onConfirm, onClose }) => (
    <Modal
        size="sm"
        title="Xóa email?"
        description="Bạn sẽ không đăng nhập bằng email được nữa và không nhận thông báo qua email."
        onClose={onClose}
        closeDisabled={saving}
    >
        <div className="modal-actions mt-6">
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
                Hủy
            </button>
            <button type="button" className="btn btn-danger" disabled={saving} onClick={onConfirm}>
                {saving && <span className="btn-spinner" aria-hidden="true" />}
                Xóa email
            </button>
        </div>
    </Modal>
);

const ContactSection = ({ profile, onChange }) => {
    const navigate = useNavigate();
    const hasPhone = Boolean(profile.phone);
    const phoneVerified = hasPhone && profile.phoneConfirmed;
    const [values, setValues] = useState(() => toContactValues(profile));
    const [phoneDraft, setPhoneDraft] = useState(profile.phone || "");
    const [phoneError, setPhoneError] = useState();
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [confirmingRemoval, setConfirmingRemoval] = useState(false);

    const request = toContactRequest(values);
    const dirty = JSON.stringify(request) !== JSON.stringify(toContactRequest(toContactValues(profile)));

    const update = (changes, clearErrors) => {
        setValues((current) => ({ ...current, ...changes }));
        setErrors((current) => ({ ...current, ...Object.fromEntries(clearErrors.map((key) => [key, undefined])) }));
    };

    const handleCancel = () => {
        setValues(toContactValues(profile));
        setErrors({});
    };

    const save = async () => {
        setSaving(true);
        const result = await updateContactInfo({ email: request.email, address: request.address }, profile);
        setSaving(false);
        setConfirmingRemoval(false);
        if (!result.success) {
            if (result.errors) setErrors(result.errors);
            toast.error(result.message);
            return;
        }
        toast.success(result.message);
        onChange(result.data);
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (saving) return;
        const nextErrors = validateContact(request);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            event.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
            return;
        }
        if (profile.email && !request.email) {
            setConfirmingRemoval(true);
            return;
        }
        save();
    };

    const handlePhoneAction = async () => {
        if (sendingOtp) return;
        const nextError = validatePhone(phoneDraft);
        if (nextError) {
            setPhoneError(nextError);
            document.getElementById("contact-phone")?.focus();
            return;
        }
        const normalized = normalizePhone(phoneDraft);
        if (hasPhone && normalized === profile.phone) {
            setPhoneError(PHONE_UNCHANGED);
            document.getElementById("contact-phone")?.focus();
            return;
        }

        setSendingOtp(true);
        const result = await requestPhoneChange({ phone: normalized }, profile);
        setSendingOtp(false);
        if (!result.success) {
            if (result.errors?.phone) setPhoneError(result.errors.phone);
            else toast.error(result.message);
            return;
        }
        goToOtp(navigate, result.data);
    };

    return (
        <SectionCard
            id="contact-title"
            title="Thông tin liên hệ"
            description="Bạn có thể tự cập nhật. Số điện thoại mới cần xác minh bằng mã OTP gửi qua SMS; email mới cần xác nhận qua link gửi tới email đó."
        >
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
                <FormField id="contact-phone" label="Số điện thoại" required error={phoneError}>
                    <div className="flex flex-wrap items-start gap-3">
                        <input
                            id="contact-phone"
                            type="tel"
                            inputMode="numeric"
                            className="input num max-w-xs flex-1"
                            placeholder="09xx xxx xxx"
                            aria-invalid={Boolean(phoneError)}
                            aria-describedby={phoneError ? "contact-phone-error" : "contact-phone-hint"}
                            value={phoneDraft}
                            onChange={(event) => {
                                setPhoneDraft(event.target.value);
                                setPhoneError(undefined);
                            }}
                        />
                        <button type="button" className="btn btn-primary shrink-0" disabled={sendingOtp} onClick={handlePhoneAction}>
                            {sendingOtp && <span className="btn-spinner" aria-hidden="true" />}
                            {hasPhone ? "Đổi số điện thoại" : "Xác minh số điện thoại"}
                        </button>
                    </div>
                    <p id="contact-phone-hint" className="flex flex-wrap items-center gap-2 text-caption text-muted">
                        {phoneVerified ? (
                            <span className="badge badge-success">Đã xác minh</span>
                        ) : (
                            <span className="badge badge-warning">Chưa xác minh</span>
                        )}
                        {hasPhone
                            ? "Nhập số mới rồi bấm Đổi số điện thoại để nhận OTP."
                            : "Nhập số điện thoại rồi bấm Xác minh để nhận OTP."}
                    </p>
                </FormField>

                <FormField id="contact-email" label="Email" error={errors.email}>
                    <input
                        id="contact-email"
                        type="email"
                        className="input"
                        placeholder="you@example.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={errors.email ? "contact-email-error" : undefined}
                        value={values.email}
                        onChange={(event) => update({ email: event.target.value }, ["email"])}
                    />
                </FormField>

                <FormField id="contact-address" label="Địa chỉ liên hệ" error={errors.address}>
                    <input
                        id="contact-address"
                        className="input"
                        maxLength={PROFILE_LIMITS.ADDRESS_MAX}
                        placeholder="VD: Số 12, ngõ 45 Cầu Diễn, Bắc Từ Liêm, Hà Nội"
                        aria-invalid={Boolean(errors.address)}
                        aria-describedby={errors.address ? "contact-address-error" : undefined}
                        value={values.address}
                        onChange={(event) => update({ address: event.target.value }, ["address"])}
                    />
                </FormField>

                {PROFILE_FEATURES.emergencyContact &&
                    (values.emergencyContact ? (
                        <EmergencyContactFields
                            person={values.emergencyContact}
                            errors={errors}
                            onChange={(person) => update({ emergencyContact: person }, ["contactName", "contactRelationship", "contactPhone"])}
                            onRemove={() => update({ emergencyContact: null }, ["contactName", "contactRelationship", "contactPhone"])}
                        />
                    ) : (
                        <div className="field">
                            <p className="label">Người liên hệ khẩn cấp (không bắt buộc)</p>
                            <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border-strong px-3 py-2.5">
                                <span className="text-body-sm text-placeholder">Chưa cập nhật</span>
                                <button
                                    type="button"
                                    className="btn btn-link gap-1 text-label"
                                    onClick={() => update({ emergencyContact: EMPTY_CONTACT_PERSON }, [])}
                                >
                                    <Plus className="size-3.5" aria-hidden="true" />
                                    Thêm người liên hệ
                                </button>
                            </div>
                        </div>
                    ))}

                <div className="flex justify-end gap-3 border-t border-border pt-5">
                    <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={handleCancel}>
                        Hủy
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>
                        {saving && <span className="btn-spinner" aria-hidden="true" />}
                        Lưu thay đổi
                    </button>
                </div>
            </form>
            {confirmingRemoval && <RemoveEmailModal saving={saving} onConfirm={save} onClose={() => setConfirmingRemoval(false)} />}
        </SectionCard>
    );
};

// ---------- Page ----------

const ProfileSummary = ({ profile, isPatient }) => {
    const showDetails = PROFILE_FEATURES.summaryDetails;
    const meta = !showDetails
        ? []
        : isPatient
        ? [
              profile.lastVisitAt && `Lần khám gần nhất: ${formatDate(profile.lastVisitAt)}`,
              profile.createdAt && `Đã đăng ký từ ${formatMonth(profile.createdAt)}`,
          ]
        : [profile.createdAt && `Đã tham gia từ ${formatMonth(profile.createdAt)}`];
    const metaText = meta.filter(Boolean).join(" · ");

    return (
        <div className="card-app flex flex-wrap items-center gap-4">
            <Avatar fullName={profile.fullname} className="size-16 text-heading-2" />
            <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-heading-2 text-ink">{profile.fullname}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                    {showDetails && isPatient && profile.code ? (
                        <span className="chip-queue num">Mã BN: {profile.code}</span>
                    ) : (
                        <span className="chip-queue">{ROLE_LABELS[profile.role]}</span>
                    )}
                    {showDetails && profile.status === "active" && <span className="badge badge-success">Đang hoạt động</span>}
                </div>
                {metaText && <p className="num mt-1.5 text-caption text-muted">{metaText}</p>}
            </div>
        </div>
    );
};

const ProfileSkeleton = () => (
    <div className="flex flex-col gap-6" aria-hidden="true">
        <div className="card-app flex items-center gap-4">
            <div className="skeleton size-16 rounded-full" />
            <div className="flex-1 space-y-2">
                <div className="skeleton h-6 w-48" />
                <div className="skeleton h-4 w-32" />
            </div>
        </div>
        <div className="skeleton h-48" />
        <div className="skeleton h-80" />
    </div>
);

// Shared by every role. Patients also get the emergency contact and health info; doctors get their certificates.
// After an OTP is verified the user comes back here and the profile is loaded again.
// TODO(be): PUT /api/Me only allows the Patient role for now, so staff edits need a backend change.
const ProfilePage = () => {
    const { loading, value } = useAsync(getMyProfile, []);
    const [updated, setUpdated] = useState(null);

    const header = <h1 className="page-title mb-6">Hồ sơ cá nhân</h1>;

    if (loading) {
        return (
            <>
                {header}
                <ProfileSkeleton />
            </>
        );
    }
    if (!value?.success) return <Navigate to={getErrorRoute(404)} replace />;

    const profile = updated ?? value.data;
    const isPatient = profile.role === USER_ROLES.PATIENT;
    const isDoctor = profile.role === USER_ROLES.DOCTOR;

    // One column across the full width: summary, identity, contact, then the role's own section
    // (health info for patients, certificates for doctors) at the bottom.
    return (
        <>
            {header}
            <div className="flex flex-col gap-6">
                <ProfileSummary profile={profile} isPatient={isPatient} />
                {isPatient ? (
                    <IdentitySection
                        key={`${profile.fullname}|${profile.birthdate}|${profile.gender}`}
                        profile={profile}
                        onChange={setUpdated}
                    />
                ) : (
                    <SectionCard
                        id="identity-title"
                        title="Thông tin nhận dạng"
                        description="Thông tin nhân viên do quản lý phòng khám cập nhật."
                    >
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <ReadOnlyField label="Họ và tên" value={profile.fullname} />
                            <ReadOnlyField label="Ngày sinh" value={formatDate(profile.birthdate)} />
                            <ReadOnlyField label="Giới tính" value={GENDER_LABELS[profile.gender]} />
                        </div>
                    </SectionCard>
                )}
                {/* key: a saved profile resets the form to the stored values. */}
                {isPatient ? (
                    <ContactSection
                        key={`${profile.phone}|${profile.phoneConfirmed}|${JSON.stringify(toContactValues(profile))}`}
                        profile={profile}
                        onChange={setUpdated}
                    />
                ) : (
                    <StaffContactSection profile={profile} />
                )}
                {PROFILE_FEATURES.healthInfo && isPatient && <HealthInfoCard health={profile.health} onChange={setUpdated} />}
                {PROFILE_FEATURES.certificates && isDoctor && <CertificatesCard certificates={profile.certificates} onChange={setUpdated} />}
            </div>
        </>
    );
};

export default ProfilePage;

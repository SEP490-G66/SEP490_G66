import { useState } from "react";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import { createStaffAccount, updateStaffAccount } from "@/services/staffService";
import { PROFILE_LIMITS, USER_ROLES, VALIDATION_MESSAGES } from "@/utils/messages";
import { STAFF_ROLE_OPTIONS, staffRoleLabel } from "@/utils/constants/staff";
import { isRequiredEmpty, requiredMessage, validateEmail, validatePhone } from "@/utils/validation";

// Same limits as UpdateStaffRequest on the backend.
const LICENSE_MAX = 50;
const SPECIALIZATION_MAX = 100;

const EMPTY_FORM = { fullName: "", role: "", email: "", phone: "", specialization: "", licenseNumber: "" };

const validateStaff = (form) => {
    const errors = {};
    if (isRequiredEmpty(form.fullName)) errors.fullName = requiredMessage("họ và tên");
    else if (form.fullName.trim().length > PROFILE_LIMITS.FULL_NAME_MAX) errors.fullName = VALIDATION_MESSAGES.FULL_NAME_TOO_LONG;
    if (!form.role) errors.role = "Vui lòng chọn vai trò.";
    if (isRequiredEmpty(form.email)) errors.email = requiredMessage("email");
    else errors.email = validateEmail(form.email.trim());
    errors.phone = validatePhone(form.phone);
    if (form.role === USER_ROLES.DOCTOR && isRequiredEmpty(form.licenseNumber))
        errors.licenseNumber = requiredMessage("số chứng chỉ hành nghề");
    return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
};

// "Tạo tài khoản nhân viên" (member = null) or "Cập nhật tài khoản". onSaved(message) runs after a successful save.
const StaffFormPopup = ({ member, onClose, onSaved }) => {
    const editing = Boolean(member);
    const [form, setForm] = useState(() =>
        editing
            ? {
                  fullName: member.fullName,
                  role: member.role,
                  email: member.email,
                  phone: member.phone,
                  specialization: member.specialization ?? "",
                  licenseNumber: member.licenseNumber ?? "",
              }
            : EMPTY_FORM,
    );
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const fieldProps = (name) => ({
        id: `staff-${name}`,
        name,
        value: form[name],
        "aria-invalid": Boolean(errors[name]),
        "aria-describedby": errors[name] ? `staff-${name}-error` : undefined,
        onChange: (event) => {
            setForm((current) => ({ ...current, [name]: event.target.value }));
            setErrors((current) => ({ ...current, [name]: undefined, form: undefined }));
        },
    });

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nextErrors = validateStaff(form);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            event.currentTarget.querySelector('[aria-invalid="true"]')?.focus();
            return;
        }

        setSaving(true);
        const response = editing ? await updateStaffAccount(member.id, form) : await createStaffAccount(form);
        setSaving(false);
        if (!response.success) {
            setErrors(response.errors ?? { form: response.message });
            return;
        }
        const tempPassword = response.data?.temporaryPassword;
        const message = tempPassword
            ? `${response.message} Mật khẩu tạm: ${tempPassword}`
            : response.message;
        onSaved(message);
    };

    return (
        <Modal
            title={editing ? "Cập nhật tài khoản nhân viên" : "Tạo tài khoản nhân viên"}
            description={
                editing
                    ? `${member.fullName} · ${member.email}`
                    : "Sau khi tạo, hệ thống sẽ hiện mật khẩu tạm một lần. Nhân viên đăng nhập bằng email và đổi mật khẩu sớm."
            }
            onClose={onClose}
            closeDisabled={saving}
        >
            <form noValidate onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                {errors.form && (
                    <p role="alert" className="alert alert-danger">
                        {errors.form}
                    </p>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField id="staff-fullName" label="Họ và tên" required error={errors.fullName}>
                        <input
                            {...fieldProps("fullName")}
                            className="input"
                            placeholder="Nhập họ và tên"
                            maxLength={PROFILE_LIMITS.FULL_NAME_MAX}
                        />
                    </FormField>
                    <FormField id="staff-role" label="Vai trò" required error={errors.role}>
                        <select {...fieldProps("role")} className="input">
                            <option value="">Chọn vai trò</option>
                            {STAFF_ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </FormField>
                    <FormField id="staff-email" label="Email" required error={errors.email}>
                        <input {...fieldProps("email")} type="email" className="input" placeholder="VD: ha.lt@oze.vn" />
                    </FormField>
                    <FormField id="staff-phone" label="Số điện thoại" required error={errors.phone}>
                        <input {...fieldProps("phone")} type="tel" inputMode="numeric" className="input" placeholder="VD: 0922 333 555" />
                    </FormField>
                </div>

                {form.role === USER_ROLES.DOCTOR && (
                    <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-4">
                        <p className="text-label font-semibold text-ink">Thông tin chuyên môn ({staffRoleLabel(form.role)})</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField id="staff-licenseNumber" label="Số chứng chỉ hành nghề" required error={errors.licenseNumber}>
                                <input
                                    {...fieldProps("licenseNumber")}
                                    className="input"
                                    placeholder="Nhập số CCHN"
                                    maxLength={LICENSE_MAX}
                                />
                            </FormField>
                            <FormField id="staff-specialization" label="Chuyên khoa" error={errors.specialization}>
                                <input
                                    {...fieldProps("specialization")}
                                    className="input"
                                    placeholder="VD: Chỉnh nha, Implant"
                                    maxLength={SPECIALIZATION_MAX}
                                />
                            </FormField>
                        </div>
                    </div>
                )}

                <div className="modal-actions -mx-6 mt-2 border-t border-border px-6 pt-4">
                    <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
                        Huỷ
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving && <span className="btn-spinner" aria-hidden="true" />}
                        {editing ? "Lưu thay đổi" : "Tạo tài khoản"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StaffFormPopup;

# Trạng thái của các entity

Tổng hợp mọi trường trạng thái trong `OZE.Domain/Entities`. Giá trị hợp lệ lấy từ check constraint trong `OZE.Persistence/Configurations/*Configuration.cs` (DB chỉ nhận đúng các giá trị này). Cột "Nhãn FE" là chữ frontend đang hiển thị (`oze-clinic-fe/src/utils/...`); "—" là chưa có nhãn riêng.

Lưu ý khi so chuỗi: mỗi bảng dùng một kiểu viết riêng. Có bảng viết HOA (`PENDING`), có bảng viết PascalCase (`Pending`).

## Mục lục

| Nhóm | Entity |
|---|---|
| Lịch hẹn & hàng chờ | [Appointment](#appointment), [QueueEntry](#queueentry), [ConsultationRequest](#consultationrequest), [FollowUpContact](#followupcontact) |
| Khám & điều trị | [Examination](#examination), [Prescription](#prescription), [TreatmentPlan](#treatmentplan), [TreatmentPlanStage](#treatmentplanstage), [ClinicalRecordAddendum](#clinicalrecordaddendum), [PatientMedicalProfile](#patientmedicalprofile) |
| Chụp chiếu | [ImagingRequest](#imagingrequest), [ImagingCapture](#imagingcapture), [ImagingResult](#imagingresult) |
| Tài liệu | [DocumentRequest](#documentrequest), [PatientDocument](#patientdocument) |
| Thanh toán | [Invoice](#invoice), [Payment](#payment), [InstallmentPeriod](#installmentperiod), [RefundAdjustmentRequest](#refundadjustmentrequest), [CashSession](#cashsession), [CashExpense](#cashexpense) |
| Nhân sự & cơ sở | [LeaveRequest](#leaverequest), [StaffSchedule](#staffschedule), [StaffProfile](#staffprofile), [ApplicationRole](#applicationrole), [Room](#room), [Service / ServiceVariant](#service--servicevariant) |
| Hệ thống | [Notification](#notification), [SystemConfiguration](#systemconfiguration) |

---

## Lịch hẹn & hàng chờ

### Appointment
Bảng `Appointments`.

**`Status`** (mặc định `PENDING`, constraint `CK_Appointments_Status`, hằng số `AppointmentConstants`)

| Giá trị | Ý nghĩa | Nhãn FE (bệnh nhân) |
|---|---|---|
| `PENDING` | Bệnh nhân mới tự đặt, chờ lễ tân gọi xác nhận | Chờ xác nhận |
| `CONFIRMED` | Đã xác nhận (lễ tân xác nhận, lễ tân đặt hộ, hoặc bệnh nhân cũ tự đặt được xác nhận ngay) | Đã xác nhận |
| `CHECKED_IN` | Đã báo có mặt tại quầy, đang chờ gọi khám | Đang chờ khám |
| `COMPLETED` | Đã khám xong | Đã khám |
| `CANCELLED` | Đã huỷ | Đã hủy |
| `NO_SHOW` | Không đến | Lỡ hẹn |

- "Chưa khám xong" (`UnfinishedStatuses`) = `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_SERVICE`. Mỗi bệnh nhân chỉ có tối đa 1 lịch hẹn ở các trạng thái này.
- Ca trống: lịch `CANCELLED` / `NO_SHOW` không giữ chỗ, mọi trạng thái khác đều giữ chỗ.

**`AppointmentType`** (`CK_Appointments_Type`): `BOOKED` (đặt trước), `WALK_IN` (đến trực tiếp, không có giờ hẹn).

**`Priority`** (`CK_Appointments_Priority`): `0`, `1`, `2`.

### QueueEntry
Bảng `QueueEntries`: hàng chờ trong phòng.

**`Status`** (mặc định `WAITING`, `CK_QueueEntries_Status`)

| Giá trị | Ý nghĩa |
|---|---|
| `WAITING` | Đang chờ gọi |
| `CALLED` | Đã gọi vào phòng |
| `IN_PROGRESS` | Đang khám / chụp / điều trị |
| `COMPLETED` | Xong |
| `SKIPPED` | Bị bỏ qua (gọi không có mặt) |
| `CANCELLED` | Đã huỷ |

**`QueueType`** (`CK_QueueEntries_QueueType`): `Examination`, `Imaging`, `Treatment`.

### ConsultationRequest
Bảng yêu cầu tư vấn từ trang công khai. **Không có check constraint**; giá trị nằm trong `ConsultationService`.

**`Status`** (mặc định `New`): `New` (mới gửi), `Contacted` (lễ tân đã liên hệ), `Booked` (đã đặt lịch), `Closed` (đóng). Lễ tân chỉ chuyển sang `Contacted`, `Booked`, `Closed`.

### FollowUpContact
Lịch sử các cuộc gọi nhắc tái khám (`CareEntities.cs`), không sửa sau khi ghi.

**`Outcome`** (`CK_FollowUpContacts_Outcome`): `Booked` (đã đặt lịch), `CallBack` (hẹn gọi lại), `Unreachable` (không liên lạc được), `Declined` (từ chối).

---

## Khám & điều trị

### Examination
Bảng `Examinations`.

**`ExaminationStatus`** (mặc định `InProgress`, `CK_Examinations_Status`)

| Giá trị | Ý nghĩa |
|---|---|
| `InProgress` | Đang khám |
| `Completed` | Đã kết thúc lượt khám |
| `Locked` | Hồ sơ đã khoá, chỉ bổ sung bằng phụ lục (`ClinicalRecordAddendum`) |

Bác sĩ chỉ yêu cầu bổ sung tài liệu được khi lượt khám đang `InProgress`.

### Prescription
**`Status`** (mặc định `Draft`, `CK_Prescriptions_Status`): `Draft` (đơn nháp), `Finalized` (đã chốt).

### TreatmentPlan
Bảng `TreatmentPlans`.

**`Status`** (mặc định `Draft`, `CK_TreatmentPlans_Status`)

| Giá trị | Ý nghĩa | Nhãn FE (sổ khám bệnh nhân) |
|---|---|---|
| `Draft` | Bác sĩ đang soạn | — (không hiện cho bệnh nhân) |
| `Proposed` | Đã đề xuất, chờ bệnh nhân đồng ý | Chờ đồng ý |
| `Approved` | Bệnh nhân đã đồng ý | Đang điều trị |
| `InProgress` | Đang điều trị | Đang điều trị |
| `Completed` | Hoàn thành | Hoàn thành |
| `Cancelled` | Đã dừng | Đã dừng |
| `Superseded` | Bị thay bằng kế hoạch mới | — |

### TreatmentPlanStage
Từng buổi / giai đoạn của kế hoạch.

**`StageStatus`** (mặc định `Scheduled`, `CK_TreatmentPlanStages_Status`)

| Giá trị | Nhãn FE |
|---|---|
| `Scheduled` | Đã lên lịch |
| `InProgress` | Đang điều trị |
| `Completed` | Hoàn thành |
| `Cancelled` | Đã hủy |

### ClinicalRecordAddendum
Phụ lục bổ sung hồ sơ đã khoá.

**`AddendumType`** (`CK_ClinicalRecordAddenda_Type`): `Correction` (đính chính), `Addition` (bổ sung), `Clarification` (làm rõ).

### PatientMedicalProfile
Tiền sử, bệnh nền, dị ứng, thuốc đang dùng.

| Trường | Giá trị |
|---|---|
| `Status` (mặc định `Active`) | `Active` (còn), `Resolved` (đã khỏi), `Discontinued` (đã ngừng) |
| `RecordType` | `History` (tiền sử răng miệng), `Condition` (bệnh nền), `Allergy` (dị ứng), `Medication` (thuốc đang dùng) |
| `Severity` | `Mild`, `Moderate`, `Severe` |

---

## Chụp chiếu

### ImagingRequest
Bác sĩ chỉ định chụp phim.

**`RequestStatus`** (mặc định `Pending`, `CK_ImagingRequests_Status`)

| Giá trị | Nhãn FE |
|---|---|
| `Pending` | Chờ chụp |
| `InProgress` | Đang chụp |
| `Completed` | Hoàn tất |
| `Cancelled` | Đã huỷ |

### ImagingCapture
Một lần chụp trên máy X-quang (giả lập), cập nhật qua webhook.

**`Status`** (mặc định `ACCEPTED`, `CK_ImagingCaptures_Status`)

| Giá trị | Ý nghĩa |
|---|---|
| `ACCEPTED` | Máy đã nhận lệnh |
| `CAPTURING` | Đang chụp |
| `PROCESSING` | Đang xử lý ảnh |
| `COMPLETED` | Xong, ảnh đã lưu |
| `FAILED` | Lỗi |
| `CANCELLED` | Đã huỷ |

`Progress` trong khoảng 0–100.

### ImagingResult
**`ReviewStatus`** (mặc định `Pending`, `CK_ImagingResults_ReviewStatus`): `Pending` (chờ bác sĩ duyệt), `Reviewed` (đã duyệt), `Rejected` (cần chụp lại).

---

## Tài liệu

### DocumentRequest
Bác sĩ yêu cầu bệnh nhân bổ sung tài liệu.

**`Status`** (mặc định `Pending`, `CK_DocumentRequests_Status`, `DocumentRequestConstants`)

| Giá trị | Ý nghĩa | Nhãn FE |
|---|---|---|
| `Pending` | Chờ bệnh nhân nộp | Chờ nộp |
| `Submitted` | Bệnh nhân đã nộp (vẫn nộp thêm được) | Đã nộp |
| `Cancelled` | Bác sĩ đã huỷ (không nộp được nữa) | Đã huỷ |

Bác sĩ chỉ huỷ được yêu cầu còn `Pending`.

### PatientDocument
Không có trường trạng thái. Loại tệp nằm ở `DocumentType`:
- `DocumentRequest`: tệp nộp theo yêu cầu của bác sĩ (có `DocumentRequestId`).
- `Provided`: tài liệu bệnh nhân tự tải lên ("Cung cấp tài liệu"). Các tệp của một lần tải dùng chung `UploadGroupId`. FE hiển thị "Đã tải lên".

---

## Thanh toán

### Invoice
**`PaymentStatus`** (mặc định `UNPAID`, `CK_Invoices_PaymentStatus`)

| Giá trị | Ý nghĩa | Nhãn FE (công nợ) |
|---|---|---|
| `UNPAID` | Chưa trả | Chưa thanh toán |
| `PENDING_CONFIRMATION` | Có khoản chuyển khoản chờ xác nhận | Chờ xác nhận |
| `PARTIALLY_PAID` | Đã trả một phần | Thanh toán một phần |
| `PAID` | Đã trả đủ | — (không vào danh sách công nợ) |
| `PARTIALLY_REFUNDED` | Đã hoàn một phần | Hoàn tiền một phần |
| `REFUNDED` | Đã hoàn toàn bộ | — |
| `CANCELLED` | Đã huỷ | — |

Trang bệnh nhân ("Lịch sử thanh toán") không đọc trường này mà tự tính từ số tiền: còn nợ 0 → Đã thanh toán đủ; đã trả > 0 → Thanh toán một phần; còn lại → Chưa thanh toán.

### Payment
| Trường | Giá trị | Nhãn FE |
|---|---|---|
| `PaymentStatus` (mặc định `PENDING`) | `PENDING`, `CONFIRMED`, `FAILED`, `REFUNDED` | Chờ xác nhận, Đã xác nhận, Thất bại, Đã hoàn |
| `PaymentMethod` | `CASH`, `BANK_TRANSFER`, `QR_TRANSFER` | Tiền mặt, Chuyển khoản, Chuyển khoản QR |
| `Purpose` | `Deposit` (đặt cọc), `Regular` (thanh toán thường), `Installment` (trả theo đợt) | — |

### InstallmentPeriod
Một đợt của khoản trả góp.

**`Status`** (mặc định `Pending`, `CK_InstallmentPeriods_Status`): `Pending` (chưa đến hạn / chưa trả), `Paid` (đã trả), `Overdue` (quá hạn).

Ràng buộc thêm:
- `Paid` bắt buộc có `PaymentId` và `PaidAt`.
- Khác `Paid` thì `PaymentId` phải null.

### RefundAdjustmentRequest
Yêu cầu hoàn tiền / điều chỉnh.

| Trường | Giá trị |
|---|---|
| `Status` (mặc định `Pending`) | `Pending`, `Approved`, `Rejected`, `Processed` |
| `RequestType` | `Refund` (hoàn tiền), `Adjustment` (điều chỉnh) |

| `Status` | Ý nghĩa | Nhãn FE |
|---|---|---|
| `Pending` | Chờ quản lý duyệt | Chờ duyệt |
| `Approved` | Đã duyệt, chưa trả tiền lại | Đã duyệt |
| `Processed` | Đã hoàn tiền | Đã hoàn tiền |
| `Rejected` | Từ chối | Từ chối |

FE đổi `Processed` thành `refunded` (`utils/refundRequest.jsx`).

### CashSession
Phiên thu ngân / giao ca. **`Status`** (mặc định `Open`, `CK_CashSessions_Status`): `Open` (đang mở), `Closed` (đã chốt).

### CashExpense
Khoản chi trong ca. **`Category`** (`CK_CashExpenses_Category`): `Supplies` (vật tư), `Other` (khác).

---

## Nhân sự & cơ sở

### LeaveRequest
| Trường | Giá trị |
|---|---|
| `Status` (mặc định `Pending`) | `Pending` (chờ duyệt), `Approved` (đã duyệt), `Rejected` (từ chối), `Cancelled` (nhân viên tự huỷ) |
| `Slot` (`CK_LeaveRequests_Slot`) | `Morning`, `Afternoon`, hoặc null (cả ngày) |

### StaffSchedule
Ca làm việc. Không có trường `Status`; tình trạng suy ra từ:
- `IsPresent` (bool?): `null` = chưa điểm danh, `true` = có mặt, `false` = vắng (ca `false` không được đặt lịch).
- `ActualEndTime`: có giá trị = bác sĩ đã kết thúc ca (không nhận thêm lịch).

Nhãn FE (`utils/constants/shift.jsx`): Có mặt, Vắng, Nghỉ, Chưa điểm danh, Chưa phân ca.

### StaffProfile
`IsActive` (bool, mặc định true): tài khoản nhân viên còn hoạt động. Bác sĩ đã tắt thì không được xếp lịch. `Gender`: `Male`, `Female`, `Other`.

### ApplicationRole
`IsActive` (bool, mặc định true).

### Room
| Trường | Giá trị | Nhãn FE |
|---|---|---|
| `Status` (mặc định `Active`, `CK_Rooms_Status`) | `Active`, `Maintenance`, `Inactive` | Hoạt động, Bảo trì, Ngừng sử dụng |
| `RoomType` | `GeneralTreatment`, `MinorSurgery`, `XRay` | Phòng khám, Phòng tiểu phẫu, Phòng chụp chiếu |

Chỉ phòng `Active` mới nhận ca trống khi đặt lịch.

### Service / ServiceVariant
- `IsActive` (bool, mặc định true): dịch vụ / loại còn cho đặt.
- `Service.RequiredRoomType`: `GeneralTreatment`, `MinorSurgery`, `XRay`, hoặc null (phòng khám thường).

### Patient
Không có trạng thái. `Gender`: `Male`, `Female`, `Other`; `BloodType`: `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`.

---

## Hệ thống

### Notification
| Trường | Giá trị |
|---|---|
| `DeliveryStatus` (mặc định `Pending`) | `Pending`, `Sent`, `Delivered`, `Failed` |
| `NotificationType` | `InApp`, `Email`, `SMS` |

### SystemConfiguration
`DataType` (`CK_SystemConfigurations_DataType`): `String`, `Int`, `Bool`, `Decimal`, `Json`.

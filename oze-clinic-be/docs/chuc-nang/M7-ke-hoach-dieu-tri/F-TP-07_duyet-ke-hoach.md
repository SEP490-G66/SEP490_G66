# F-TP-07 Ghi nhận bệnh nhân đồng ý (duyệt kế hoạch)

> Nghiệp vụ tổng: [Dac_ta_nghiep_vu_OZE.md](../../Dac_ta_nghiep_vu_OZE.md), mục M7. Mã quy tắc `BR-...` lấy từ đó.

| Mục | Giá trị |
|---|---|
| Module | M7 Kế hoạch điều trị |
| Trạng thái | ✅ Đã có API |
| Vai trò được dùng | `Doctor` |
| API | `POST api/TreatmentPlans/{id}/approve` |
| Code chính | `TreatmentPlansController.ApproveAsync` → `TreatmentPlanService.ApproveAsync` → `TreatmentPlanRepository` |

## 1. Chức năng này làm gì

Bác sĩ trao đổi trực tiếp với bệnh nhân, bệnh nhân đồng ý thì bác sĩ ghi nhận lên hệ thống: `Proposed` → `Approved`, lưu `ApprovedAt`. Từ đây mới bắt đầu giai đoạn và lập hóa đơn.

## 2. Tiền điều kiện

- Role `Doctor`. Lễ tân không ghi nhận được.
- Bác sĩ có hồ sơ, có quyền với kế hoạch (xem F-TP-02 mục 2).
- Kế hoạch `Proposed`.

## 3. API

**Request** `POST api/TreatmentPlans/{id:long}/approve`, quyền `[Authorize(Roles = "Doctor")]`. Không có body.

**Response thành công** (`ApiResponse<TreatmentPlanProgressResponse>`, HTTP 200, message `"Approve treatment plan success!"`), `status = "Approved"`, `approvedAt` có giá trị.

**Lỗi**

| HTTP | Khi nào | Message (`ErrorConstants`) |
|---|---|---|
| 404 | Không có kế hoạch | `TreatmentPlanMessage.PlanNotFound`: "Treatment plan not found." |
| 404 / 403 | (Bác sĩ) Không có hồ sơ / không có quyền | "Doctor profile not found" / "You do not have access to this patient's treatment plan" |
| 400 | Không phải `Proposed` | `TreatmentPlanMessage.OnlyProposedCanBeApproved`: "Only a proposed treatment plan can be approved." |
| 409 | Kế hoạch bị lưu cùng lúc (ví dụ bác sĩ đang sửa) | "This record was changed by someone else. Please reload and try again" |

## 4. Luồng xử lý trong code

1. Controller chỉ cho role `Doctor` — `TreatmentPlansController.cs:106-117`.
2. `LoadForStatusChangeAsync`: đọc có tracking (404), rồi `EnsureAccessAsync` kiểm bác sĩ có quyền với kế hoạch — `TreatmentPlanService.cs:210`, `:260-274`.
3. `Status == "Proposed"` — `TreatmentPlanService.cs:211`.
4. `Status = "Approved"`, `ApprovedAt = UpdatedAt = UtcNow`, lưu — `TreatmentPlanService.cs:213-218`.

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Được kiểm tra ở |
|---|---|---|
| BR-TP-06 | `Proposed` → `Approved` (chỉ bác sĩ), lưu `ApprovedAt` | `TreatmentPlanService.cs:211-216` |
| BR-C10 | Duyệt đua với sửa → 409 | `RowVersion` của `TreatmentPlans` |

## 6. Trạng thái và dữ liệu thay đổi

| Bảng / đối tượng | Trước | Sau | Ghi chú |
|---|---|---|---|
| `TreatmentPlans` | `Proposed` | `Approved` | `ApprovedAt`, `UpdatedAt` |

## 7. Liên quan

- Trước đó: [F-TP-06](F-TP-06_de-xuat-ke-hoach.md).
- Sau đó: [F-TP-09](F-TP-09_giai-doan-dieu-tri.md) bắt đầu giai đoạn, [F-PAY-01](../M8-thu-ngan/F-PAY-01_lap-hoa-don.md) lập hóa đơn, [F-TP-08](F-TP-08_huy-ke-hoach.md) hủy, ứng trước [F-PAY-04](../M8-thu-ngan/F-PAY-04_ung-truoc-tra-gop.md).

## 8. Kiểm thử

- Test hiện có: Chưa có.
- Ca cần test: lễ tân gọi API → 403; bác sĩ không liên quan → 403; `Draft` → 400; `Approved` → 400.

## 9. Còn thiếu / câu hỏi mở

- Không lưu ai duyệt (không có cột `ApprovedByUserId`).
- Không ghi `AuditLog`.
- Không có bằng chứng đồng ý (chữ ký, biên bản) — Q14 nói đồng ý tại quầy.

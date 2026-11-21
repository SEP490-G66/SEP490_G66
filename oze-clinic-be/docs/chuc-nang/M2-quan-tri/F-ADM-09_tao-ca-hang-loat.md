# F-ADM-09 Tạo ca làm việc hàng loạt theo tuần / tháng

> Khung chung: [_KHUNG_CHUC_NANG.md](../_KHUNG_CHUC_NANG.md). Nghiệp vụ tổng: [Dac_ta_nghiep_vu_OZE.md](../../Dac_ta_nghiep_vu_OZE.md), mục M2. Mở rộng của [F-ADM-05 Ca làm việc](F-ADM-05_ca-lam-viec.md).

| Mục | Giá trị |
|---|---|
| Module | M2 Quản trị |
| Trạng thái | ⬜ Chưa làm (đề xuất) |
| Vai trò được dùng | `ClinicManager` |
| API (đề xuất) | `POST api/work-shifts/bulk/preview`, `POST api/work-shifts/bulk`, `POST api/work-shifts/copy` (tùy chọn) |
| Code chính (đề xuất) | `WorkShiftController` → `WorkShiftService` (`IWorkShipService`) → `WorkShiftRepository` (dùng lại `HasOverlapAsync`, `HasRoomOverlapAsync`) |

## 1. Chức năng này làm gì

Quản lý xếp ca cho **cả tuần hoặc cả tháng trong một lần**, thay vì tạo từng ca. Quản lý khai báo một **mẫu lặp lại** gồm nhân viên, khoảng ngày, các ngày làm trong tuần, các khung giờ và phòng. Hệ thống sinh danh sách ca, cho xem trước, rồi tạo tất cả ca hợp lệ trong một lần bấm.

**Lý do:** hiện mỗi lần chỉ tạo được 1 ca (`CreateWorkShiftRequest`: 1 nhân viên, 1 ngày, 1 khung giờ, 1 phòng). Xếp 1 tháng cho 4 bác sĩ, mỗi ngày 2 ca, mất khoảng 200 lần tạo. Phòng khám thật **xếp lịch theo tháng** (biên bản phỏng vấn buổi 2, mục 19).

## 2. Tiền điều kiện

- Đăng nhập, role `ClinicManager`.
- Nhân viên được chọn tồn tại và `IsActive`.
- Phòng được chọn tồn tại và `Status = Active`.
- Khoảng ngày bắt đầu từ hôm nay trở đi và không quá giới hạn (đề xuất tối đa 62 ngày, tức khoảng 2 tháng).

## 3. API (đề xuất)

### 3.1 Xem trước

**Request** `POST api/work-shifts/bulk/preview`, quyền `ClinicManager`. Chỉ tính toán, **không ghi** dữ liệu.

DTO `BulkWorkShiftRequest`:

| Trường | Kiểu | Bắt buộc | Ràng buộc | Ý nghĩa |
|---|---|---|---|---|
| `staffUserIds` | string[] | Có | 1–20 người, không trùng | Nhân viên được xếp ca |
| `fromDate` | DateOnly | Có | ≥ hôm nay | Ngày bắt đầu |
| `toDate` | DateOnly | Có | ≥ `fromDate`, cách `fromDate` không quá 62 ngày | Ngày kết thúc |
| `daysOfWeek` | int[] | Có | Giá trị 0–6 (0 = Chủ nhật), không rỗng | Các ngày làm trong tuần, ví dụ T2–T7 |
| `slots` | `{ shiftStart, shiftEnd }[]` | Có | 1–3 khung; `shiftStart < shiftEnd`; các khung không chồng nhau | Khung ca, ví dụ Sáng 08:00–12:00, Chiều 13:30–17:30 |
| `roomId` | int? | Không | Phòng Active | Phòng cho các ca |
| `assignment` | string? | Không | ≤ 200 ký tự | Nhiệm vụ |
| `note` | string? | Không | ≤ 500 ký tự | Ghi chú |
| `excludedDates` | DateOnly[]? | Không | Nằm trong khoảng ngày | Ngày bỏ qua, ví dụ ngày lễ |

Ví dụ: xếp cả tháng 12 cho 1 bác sĩ, Thứ 2 – Thứ 7, 2 ca mỗi ngày, bỏ ngày 25/12.

```json
{
  "staffUserIds": ["<userId bác sĩ>"],
  "fromDate": "2026-12-01",
  "toDate": "2026-12-31",
  "daysOfWeek": [1, 2, 3, 4, 5, 6],
  "slots": [
    { "shiftStart": "08:00", "shiftEnd": "12:00" },
    { "shiftStart": "13:30", "shiftEnd": "17:30" }
  ],
  "roomId": 1,
  "excludedDates": ["2026-12-25"]
}
```

**Response** (`ApiResponse<BulkWorkShiftPreviewResponse>`, HTTP 200)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `items[]` | mảng | Từng ca sinh ra: `staffUserId`, `staffName`, `scheduleDate`, `shiftStart`, `shiftEnd`, `roomId`, `valid`, `reason` |
| `validCount` | int | Số ca tạo được |
| `invalidCount` | int | Số ca bị loại, kèm lý do ở từng dòng |

### 3.2 Tạo

**Request** `POST api/work-shifts/bulk`, quyền `ClinicManager`. Body như 3.1, thêm:

| Trường | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---|---|
| `skippedItems` | `{ staffUserId, scheduleDate, shiftStart }[]`? | Không | Các ca quản lý bỏ tick ở bước xem trước |

**Response** (`ApiResponse<BulkWorkShiftResultResponse>`, HTTP 201)

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `createdCount` | int | Số ca đã tạo |
| `createdIds` | long[] | Id các ca mới |
| `skipped[]` | mảng | Ca bị bỏ qua: ngày, giờ, nhân viên, lý do |

Ví dụ thông báo: *"Đã tạo 46 ca, bỏ qua 2 ca: trùng ca ngày 12/12, phòng đã có người dùng ngày 20/12."*

### 3.3 Sao chép lịch (tùy chọn)

**Request** `POST api/work-shifts/copy`: `{ sourceFrom, sourceTo, targetFrom, staffUserIds? }`. Sao chép các ca trong khoảng nguồn sang khoảng đích, giữ nguyên thứ trong tuần, giờ và phòng. Quy tắc kiểm tra giống 3.2.

**Lỗi chung**

| HTTP | Khi nào | Message (đề xuất) |
|---|---|---|
| 400 | Thiếu trường bắt buộc, khoảng ngày sai hoặc quá 62 ngày, khung giờ chồng nhau | `BulkShiftInvalidRange`, `BulkShiftInvalidSlots` |
| 400 | Không có ca hợp lệ nào để tạo | `BulkShiftNothingToCreate` |
| 404 | Nhân viên hoặc phòng không tồn tại | `StaffNotFound`, `RoomNotFound` (đã có) |
| 401/403 | Chưa đăng nhập hoặc không phải `ClinicManager` | — |

## 4. Luồng xử lý (đề xuất)

**Giao diện: chặn lỗi ngay khi chọn**

1. Ô chọn ngày **không cho chọn ngày đã qua**. Chọn "cả tháng" thì tự bắt đầu từ hôm nay.
2. Danh sách phòng **chỉ hiện phòng Active**.
3. Khi đã chọn nhân viên và khoảng ngày, giao diện tải các ca hiện có (`GET api/work-shifts` theo khoảng ngày). Ngày và giờ **nhân viên đã có ca** hoặc **phòng đã kín** hiện màu xám, không chọn được. Có gợi ý phòng khác cùng loại còn trống.
4. Bấm **Xem trước** để gọi `bulk/preview` và hiện bảng hoặc lịch tuần/tháng. Quản lý có thể bỏ tick từng ca.
5. Bấm **Xác nhận** để gọi `bulk`, rồi hiện kết quả đã tạo và bỏ qua.

**Backend: luôn kiểm tra lại lần cuối**

1. Kiểm tra dữ liệu đầu vào (mục 3.1).
2. Sinh danh sách ca: duyệt từng ngày trong khoảng, giữ ngày có thứ nằm trong `daysOfWeek` và không thuộc `excludedDates`, nhân với từng nhân viên và từng khung giờ.
3. Với từng ca, dùng lại kiểm tra của tạo ca lẻ:
   - ngày ≥ hôm nay;
   - nhân viên không có ca trùng giờ (`HasOverlapAsync`);
   - phòng không bị ca khác dùng (`HasRoomOverlapAsync`);
   - phòng Active.

   Kiểm tra thêm các ca **trong chính lô này** không trùng nhau.
4. Ca vi phạm thì **không tạo, ghi lý do**. Ca hợp lệ được thêm vào **một transaction**, gọi `SaveChangesAsync` **một lần**, không lưu trong vòng lặp.
5. Ghi audit log 1 dòng cho cả lô: người tạo, khoảng ngày, số ca.

**Vì sao giao diện đã chặn mà backend vẫn kiểm tra:** trong lúc quản lý đang xem trước, người khác (hoặc tab khác) có thể vừa tạo ca trùng. Ngoài ra, quy tắc nghiệp vụ phải nằm ở backend để không ai tạo được ca sai bằng cách gọi API trực tiếp.

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc | Được kiểm tra ở |
|---|---|---|
| BR-SHIFT-B1 | Không tạo ca ở ngày đã qua | Giao diện (chặn chọn) + backend |
| BR-SHIFT-B2 | Một nhân viên không có 2 ca trùng giờ trong cùng ngày, kể cả các ca trong cùng lô | Giao diện (tô xám) + backend |
| BR-SHIFT-B3 | Một phòng không được 2 ca dùng cùng giờ | Giao diện (tô xám) + backend |
| BR-SHIFT-B4 | Chỉ xếp ca vào phòng Active | Giao diện (lọc danh sách) + backend |
| BR-SHIFT-B5 | Một lô tối đa 62 ngày | Backend |
| BR-SHIFT-B6 | Ca lỗi chỉ bị bỏ qua và báo lại, các ca hợp lệ vẫn được tạo | Backend |

## 6. Trạng thái và dữ liệu thay đổi

| Bảng / đối tượng | Trước | Sau | Ghi chú |
|---|---|---|---|
| `StaffSchedules` | — | Thêm N dòng | **Không đổi cấu trúc bảng**, mỗi ca vẫn là một dòng như tạo ca lẻ. Không cần migration |
| `AuditLogs` | — | Thêm 1 dòng | Ghi lại lần tạo hàng loạt |

Ca tạo hàng loạt **giống hệt ca tạo tay**: vẫn sửa hoặc xóa lẻ được, dùng cho đặt lịch, bắt đầu/kết thúc ca và mở lại ca như bình thường.

## 7. Liên quan

- Trước đó: [F-ADM-01 Nhân viên](F-ADM-01_nhan-vien.md), [F-ADM-03 Phòng](F-ADM-03_phong.md).
- Sau đó: đặt lịch (M3) dùng ca để gợi ý giờ trống; [F-ADM-05](F-ADM-05_ca-lam-viec.md) sửa/xóa lẻ, bắt đầu/kết thúc ca, mở lại ca; [F-ADM-07 Đơn nghỉ phép](F-ADM-07_don-nghi-phep.md) liệt kê lịch hẹn bị ảnh hưởng.

## 8. Kiểm thử

- Test hiện có: chưa có.
- Ca cần test:
  - Tháng 12, T2–T7, 2 khung giờ, bỏ ngày 25/12 → đúng số ca sinh ra.
  - Nhân viên đã có ca trùng 1 ngày → ca đó bị bỏ qua có lý do, các ca khác vẫn tạo.
  - Phòng đã có người dùng → bỏ qua ca đó.
  - Hai khung giờ trong `slots` chồng nhau → 400.
  - `toDate < fromDate`, hoặc khoảng ngày > 62 ngày → 400.
  - `fromDate` ở quá khứ → 400.
  - Phòng Maintenance → 400 hoặc toàn bộ bị bỏ qua.
  - Bỏ tick một số ca ở bước xem trước → các ca đó không được tạo.
  - Không có ca hợp lệ nào → 400 `BulkShiftNothingToCreate`.
  - Không phải `ClinicManager` → 403.

## 9. Còn thiếu / câu hỏi mở

- Khi có ca lỗi: **tạo các ca hợp lệ và bỏ qua ca lỗi** (đề xuất), hay chặn toàn bộ? Cần nhóm chốt.
- Có làm **sao chép tuần/tháng trước** (mục 3.3) trong đợt này không?
- Có cho **chọn nhiều nhân viên cùng lúc** không, hay mỗi lần một người?
- Có cần **xóa hàng loạt** ca chưa có lịch hẹn trong một khoảng ngày để sửa khi xếp sai không?
- Phòng chuyển sang bảo trì **sau khi** đã xếp lịch: xử lý theo luồng hiện có (liệt kê lịch hẹn bị ảnh hưởng để đổi phòng hoặc dời lịch). Lúc tạo ca không biết trước được.

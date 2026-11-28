# Giờ giả khi test (`Clinic:FakeNow`)

Nhiều quy tắc nghiệp vụ dựa vào giờ hiện tại: không đặt lịch vào giờ đã qua, bệnh nhân đến muộn, bác sĩ hết ca, đợt thanh toán quá hạn... Để test các trường hợp này mà không phải chờ đến đúng giờ, có thể đặt **giờ giả** cho cả hệ thống ở môi trường dev/staging.

## Cách dùng

Đặt trong `OZE/appsettings.Local.json` hoặc `appsettings.Development.json` (cả hai đều không commit), **không** đặt giá trị vào `appsettings.json`:

```json
{
  "Clinic": {
    "FakeNow": "2026-11-29 16:55",
    "FakeNowMode": "Frozen"
  }
}
```

hoặc qua biến môi trường: `Clinic__FakeNow=2026-11-29 16:55`.

- `FakeNow`: giờ Việt Nam (Asia/Ho_Chi_Minh), dạng `yyyy-MM-dd HH:mm` (hoặc `yyyy-MM-dd HH:mm:ss`, `yyyy-MM-dd`; chuỗi có offset như `2026-11-29T16:55:00+07:00` cũng được). Để trống thì hệ thống chạy theo giờ thật.
- `FakeNowMode`:
  - `Frozen` (mặc định): giờ đứng yên tại mốc đã đặt. FE cũng đứng yên theo.
  - `Running`: giờ chạy tiếp từ mốc đó (mốc tính từ lúc BE khởi động hoặc lúc đổi cấu hình).
- Sửa `appsettings.Local.json` thì BE nhận giờ mới ngay, không cần khởi động lại. FE đọc giờ một lần khi tải trang, nên cần **tải lại trang (F5)** sau khi đổi.
- Ở môi trường `Production` giá trị này bị bỏ qua (có log cảnh báo). Server staging cần chạy với `ASPNETCORE_ENVIRONMENT=Staging` hoặc `Development`.
- Khi giờ giả đang bật, log khởi động có dòng `Clinic clock is FAKE: ...`.

Các mốc hay dùng cho màn lễ tân: `07:25` (chưa vào ca), `09:45` (đang trong ca, bệnh nhân hẹn sớm đã trễ), `16:55` (sắp hết ca, nhiều lịch quá giờ chưa đến).

Dữ liệu mẫu (`SampleDataSeeder`, `CashierDemoSeeder`) cũng tính "hôm nay" theo giờ giả, nhưng chỉ khi seed lần đầu (DB trống dữ liệu mẫu). Muốn dữ liệu khớp ngày giả khác ngày thật thì phải seed lại DB với `FakeNow` đã đặt.

## Endpoint

`GET /api/clinic/now` (không cần đăng nhập) trả giờ hiện tại theo `ClinicClock`:

```json
{ "utcNow": "2026-11-29T09:55:00+00:00", "clinicTime": "2026-11-29T16:55:00", "today": "2026-11-29",
  "timeZone": "Asia/Ho_Chi_Minh", "isFake": true, "isFrozen": true }
```

FE (`src/services/clinicTimeService.jsx`) gọi endpoint này trước khi render, lưu độ lệch so với giờ máy; `serverNow()` / `serverNowMs()` = giờ máy + độ lệch (hoặc mốc cố định khi `isFrozen`). `clinicClock()`, `clinicToday()`, `getClinicToday()` và các màn nghiệp vụ dùng giờ này. Nếu không gọi được endpoint thì FE dùng giờ máy.

## Trong code

Code nghiệp vụ dùng `ClinicClock` (`OZE.Common/Helpers/ClinicClock.cs`), không gọi thẳng `DateTime.Now/UtcNow/Today` hay `DateTimeOffset.UtcNow`:

| Cần | Dùng |
| --- | --- |
| Thời điểm lưu DB (`CreatedAt`, `UpdatedAt`, `CheckInAt`...) | `ClinicClock.UtcNow` (`DateTimeOffset`) |
| `DateTime` UTC | `ClinicClock.UtcDateTime` |
| Giờ / ngày tại phòng khám | `ClinicClock.Now`, `ClinicClock.Today`, `ClinicClock.TodayDate` (`DateOnly`) |

Trong unit test, có thể giả giờ cho riêng test đó (không ảnh hưởng test chạy song song):

```csharp
using (ClinicClock.Use(new DateTime(2026, 11, 29, 16, 55, 0))) { ... }
```

### Những chỗ cố ý giữ giờ thật

Phần bảo mật / hạ tầng vẫn chạy theo giờ thật để giờ giả không làm token hay OTP sống lâu hơn, hoặc hết hạn ngay:

- Hạn JWT: `JwtTokenGenerator`, `AuthService.IssueAuthResultAsync` (`expiresAt`).
- Refresh token: tạo / thu hồi / kiểm tra hạn trong `AuthService`, `UserRefreshTokenRepository`, `UserRefreshToken.IsExpired`, thu hồi token khi khoá tài khoản trong `PatientRepository`.
- Danh sách token bị thu hồi: `AccessTokenRevocationStore`.
- OTP và phiên tạm: đăng ký (`PendingRegistration`), quên mật khẩu, đổi số điện thoại trong `UserService`, thời gian chờ gửi lại OTP, `OtpSendLimiter`.
- Khoá tài khoản (`LockoutEnd`) khi đăng nhập / refresh.
- Rate limiter của ASP.NET Core, timeout request, cache TTL ở FE, hạn token phía FE (`sessionStore`).

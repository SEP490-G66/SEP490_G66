# Seed data — Services & Service Variants

Nguồn: `OZE.Persistence/Seed/SampleDataSeeder.cs` (`ServiceRows`, `VariantRows`) và danh mục dịch vụ Nha khoa OZE.

## Tổng quan

| Mục | Số lượng |
|---|---|
| Dịch vụ | 23 |
| Dịch vụ có variant | 10 |
| Dịch vụ không có variant | 13 |
| Biến thể (variant) | 36 |

> Dữ liệu giá, thời lượng và chu kỳ recall phục vụ demo đồ án, không phải bảng giá hoặc lịch điều trị chính thức của Nha khoa OZE. Giá gốc là giá tham chiếu; nếu chọn variant thì dùng giá và thời lượng của variant. Thời lượng là thời gian dự kiến cho một lượt hẹn, không phải toàn bộ liệu trình. `Recall = 0` nghĩa là không tạo nhắc tái khám định kỳ tự động cho dịch vụ đó.

## Danh sách dịch vụ

| Mã | Tên | Mô tả | Giá gốc (₫) | Phút | Loại phòng | Recall (tháng) |
|---|---|---|---:|---:|---|---:|
| DV001 | Khám tổng quát & tư vấn | Khám, tư vấn, lập kế hoạch điều trị | 0 | 30 | — | 6 |
| DV002 | Lấy cao răng | Làm sạch cao răng, đánh bóng | 150.000 | 30 | GeneralTreatment | 6 |
| DV003 | Điều trị tủy răng | Lấy tủy, làm sạch và trám bít ống tủy | 800.000 | 60 | GeneralTreatment | 6 |
| DV004 | Nhổ răng khôn | Nhổ răng khôn bằng phương pháp truyền thống hoặc kỹ thuật hỗ trợ Piezotome | 1.500.000 | 60 | MinorSurgery | 1 |
| DV005 | Trồng răng Implant (cấy ghép Implant) | Cấy ghép trụ Implant và phục hình răng mất | 18.000.000 | 90 | MinorSurgery | 6 |
| DV006 | Niềng răng thẩm mỹ | Chỉnh nha răng hô, móm, thưa, khấp khểnh | 18.000.000 | 60 | GeneralTreatment | 1 |
| DV007 | Chụp Panorama | Phim toàn cảnh hai hàm | 250.000 | 15 | XRay | 0 |
| DV008 | Scan răng iTero | Quét dấu răng kỹ thuật số | 800.000 | 30 | GeneralTreatment | 0 |
| DV009 | Trám răng (hàn răng) | Phục hồi răng sâu, răng mẻ bằng vật liệu trám hoặc phục hình gián tiếp | 400.000 | 30 | GeneralTreatment | 6 |
| DV010 | Tẩy trắng răng | Tẩy trắng tại phòng khám hoặc tại nhà | 2.500.000 | 60 | GeneralTreatment | 12 |
| DV011 | Chụp X-quang quanh chóp | Phim quanh chóp một răng | 100.000 | 15 | XRay | 0 |
| DV012 | Bọc răng sứ | Phục hình bằng mão răng sứ Katana, Cercon HT, Emax, Nacera, Emax Press hoặc Lava Esthetic | 2.500.000 | 90 | GeneralTreatment | 6 |
| DV013 | Dán sứ Veneer | Phục hình thẩm mỹ bằng mặt dán sứ Veneer | 5.500.000 | 90 | GeneralTreatment | 6 |
| DV014 | Niềng răng trẻ em | Chỉnh nha cho trẻ em bằng phương pháp chỉnh nha sớm, mắc cài hoặc khay trong | 12.000.000 | 60 | GeneralTreatment | 1 |
| DV015 | Nhổ răng thường | Nhổ răng không thuộc nhóm răng khôn theo chỉ định chuyên môn | 500.000 | 30 | MinorSurgery | 1 |
| DV016 | Đính đá vào răng | Đính đá trang trí lên bề mặt răng | 350.000 | 20 | GeneralTreatment | 0 |
| DV017 | Cầu răng sứ | Phục hình răng mất bằng cầu răng sứ | 7.500.000 | 90 | GeneralTreatment | 6 |
| DV018 | Hàm răng tháo lắp | Phục hình răng mất bằng hàm giả tháo lắp | 3.000.000 | 60 | GeneralTreatment | 6 |
| DV019 | Cắt lợi | Cắt lợi hoặc cắt nướu theo chỉ định điều trị | 1.800.000 | 45 | MinorSurgery | 1 |
| DV020 | Điều trị viêm lợi (viêm nướu) | Thăm khám và điều trị tình trạng viêm lợi, viêm nướu | 500.000 | 45 | GeneralTreatment | 3 |
| DV021 | Điều trị viêm nha chu | Thăm khám và điều trị bệnh lý nha chu, chăm sóc mô quanh răng | 1.500.000 | 60 | GeneralTreatment | 3 |
| DV022 | Phục hình sứ Inlay / Onlay / Overlay | Phục hình khuyết hổng mô răng bằng miếng sứ Inlay, Onlay hoặc Overlay | 2.500.000 | 60 | GeneralTreatment | 6 |
| DV023 | Phục hồi tủy nhân tạo | Phục hồi tủy nhân tạo theo chỉ định điều trị | 1.800.000 | 60 | GeneralTreatment | 3 |

> DV001 seed với `RequiredRoomType = null`: tự thêm qua `GeneralExamServiceCode` nhưng không chiếm phòng và không chặn dịch vụ chính.

## Variants theo dịch vụ

### DV001 — Khám tổng quát & tư vấn

*Không có variant.*

### DV002 — Lấy cao răng

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV002-01 | Một hàm | 150.000 | 20 | 1 | Lấy cao răng và đánh bóng một hàm. |
| DV002-02 | Toàn hàm | 300.000 | 30 | 2 | Lấy cao răng cả hai hàm, đánh bóng. |
| DV002-03 | Nửa hàm | 100.000 | 15 | 3 | Lấy cao răng nửa hàm; không tiếp nhận lịch hẹn mới. |

### DV003 — Điều trị tủy răng

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV003-01 | Răng một chân | 800.000 | 45 | 1 | Điều trị tủy răng cửa, răng nanh. |
| DV003-02 | Răng nhiều chân | 1.500.000 | 60 | 2 | Điều trị tủy răng hàm. |

### DV004 — Nhổ răng khôn

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV004-01 | Nhổ răng khôn truyền thống | 1.500.000 | 60 | 1 | Nhổ răng khôn bằng kỹ thuật truyền thống. |
| DV004-02 | Nhổ răng khôn bằng Piezotome | 2.500.000 | 75 | 2 | Nhổ răng khôn với hỗ trợ của máy Piezotome. |
| DV004-03 | Răng khôn mọc thẳng | 900.000 | 30 | 3 | Nhổ răng khôn mọc thẳng. |
| DV004-04 | Răng khôn mọc lệch nhẹ | 1.500.000 | 45 | 4 | Nhổ răng khôn mọc lệch nhẹ. |
| DV004-05 | Răng khôn mọc ngầm / mọc ngang | 2.800.000 | 90 | 5 | Nhổ răng khôn mọc ngầm hoặc mọc ngang. |
| DV004-06 | Răng khôn phức tạp / sát dây thần kinh | 4.500.000 | 120 | 6 | Nhổ răng khôn có độ khó cao hoặc nằm sát dây thần kinh. |

### DV005 — Trồng răng Implant (cấy ghép Implant)

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV005-01 | Phục hình răng | 18.000.000 | 90 | 1 | Cấy ghép Implant để phục hình răng mất. |
| DV005-02 | Phục hình một vài răng liền kề | 45.000.000 | 150 | 2 | Cấy ghép Implant để phục hình một vài răng liền kề. |
| DV005-03 | Phục hình toàn hàm | 120.000.000 | 210 | 3 | Cấy ghép Implant để phục hình toàn hàm. |

### DV006 — Niềng răng thẩm mỹ

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV006-01 | Mắc cài kim loại thường (truyền thống) | 18.000.000 | 60 | 1 | Chỉnh nha bằng mắc cài kim loại, sử dụng thun buộc cố định dây cung. |
| DV006-02 | Mắc cài sứ truyền thống | 30.000.000 | 60 | 2 | Chỉnh nha mắc cài sứ truyền thống, cố định dây cung bằng thun; tính thẩm mỹ cao. |
| DV006-03 | Niềng răng khay trong suốt | 45.000.000 | 30 | 3 | Chỉnh nha bằng khay trong suốt tháo lắp, bao gồm lựa chọn Invisalign. |
| DV006-04 | Mắc cài kim loại tự buộc | 23.000.000 | 60 | 4 | Mắc cài kim loại có chốt/nắp trượt giữ dây cung, không cần thun buộc. |
| DV006-05 | Mắc cài sứ tự buộc | 35.000.000 | 60 | 5 | Mắc cài sứ với cơ chế tự khóa để giữ dây cung. |

### DV007 — Chụp Panorama

*Không có variant.*

### DV008 — Scan răng iTero

*Không có variant.*

### DV009 — Trám răng

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV009-01 | Trám composite | 400.000 | 30 | 1 | Trám thẩm mỹ cùng màu răng. |
| DV009-02 | Trám GIC | 250.000 | 30 | 2 | Trám GIC cho răng sữa, cổ răng. |
| DV009-03 | Inlay / onlay sứ | 2.500.000 | 60 | 3 | Phục hình gián tiếp bằng miếng sứ Inlay hoặc Onlay. |

### DV010 — Tẩy trắng răng

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV010-01 | Tại phòng khám | 2.500.000 | 60 | 1 | Tẩy trắng bằng đèn tại phòng khám. |
| DV010-02 | Tại nhà (máng) | 1.500.000 | 30 | 2 | Máng tẩy trắng đeo tại nhà. |

### DV011 — Chụp X-quang quanh chóp

*Không có variant.*

### DV012 — Bọc răng sứ

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV012-01 | Răng sứ Katana | 2.500.000 | 75 | 1 | Phục hình bằng răng sứ Katana. |
| DV012-02 | Răng sứ Cercon HT | 4.000.000 | 75 | 2 | Phục hình bằng răng sứ Cercon HT. |
| DV012-03 | Răng sứ Emax | 5.500.000 | 90 | 3 | Phục hình bằng răng sứ Emax. |
| DV012-04 | Răng sứ Nacera | 4.500.000 | 75 | 4 | Phục hình bằng răng sứ Nacera. |
| DV012-05 | Răng sứ Emax Press | 6.500.000 | 90 | 5 | Phục hình bằng răng sứ Emax Press. |
| DV012-06 | Răng sứ Lava Esthetic | 8.000.000 | 90 | 6 | Phục hình bằng răng sứ Lava Esthetic. |

### DV013 — Dán sứ Veneer

*Không có variant.*

### DV014 — Niềng răng trẻ em

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV014-01 | Tiền chỉnh nha / chỉnh nha sớm | 12.000.000 | 45 | 1 | Chỉnh nha sớm dành cho trẻ em. |
| DV014-02 | Mắc cài kim loại cho trẻ em | 18.000.000 | 60 | 2 | Phương pháp chỉnh nha mắc cài kim loại, theo nhóm trẻ em. |
| DV014-03 | Khay trong cho trẻ em | 30.000.000 | 45 | 3 | Phương pháp chỉnh nha khay trong, theo nhóm trẻ em. |

### DV015 — Nhổ răng thường

*Không có variant.*

### DV016 — Đính đá vào răng

*Không có variant.*

### DV017 — Cầu răng sứ

*Không có variant.*

### DV018 — Hàm răng tháo lắp

*Không có variant.*

### DV019 — Cắt lợi

*Không có variant.*

### DV020 — Điều trị viêm lợi (viêm nướu)

*Không có variant.*

### DV021 — Điều trị viêm nha chu

*Không có variant.*

### DV022 — Phục hình sứ Inlay / Onlay / Overlay

| Mã variant | Tên | Giá (₫) | Phút | Thứ tự | Mô tả |
|---|---|---:|---:|---:|---|
| DV022-01 | Inlay | 2.500.000 | 60 | 1 | Phục hình gián tiếp bằng miếng sứ Inlay. |
| DV022-02 | Onlay | 3.000.000 | 75 | 2 | Phục hình gián tiếp bằng miếng sứ Onlay. |
| DV022-03 | Overlay | 3.500.000 | 90 | 3 | Phục hình gián tiếp bằng miếng sứ Overlay. |

### DV023 — Phục hồi tủy nhân tạo

*Không có variant.*

## Bảng tra nhanh: dịch vụ ↔ variant

| Dịch vụ | Có variant? | Các mã variant |
|---|:---:|---|
| DV001 | Không | — |
| DV002 | Có | DV002-01, DV002-02, DV002-03 |
| DV003 | Có | DV003-01, DV003-02 |
| DV004 | Có | DV004-01, DV004-02, DV004-03, DV004-04, DV004-05, DV004-06 |
| DV005 | Có | DV005-01, DV005-02, DV005-03 |
| DV006 | Có | DV006-01, DV006-02, DV006-03, DV006-04, DV006-05 |
| DV007 | Không | — |
| DV008 | Không | — |
| DV009 | Có | DV009-01, DV009-02, DV009-03 |
| DV010 | Có | DV010-01, DV010-02 |
| DV011 | Không | — |
| DV012 | Có | DV012-01, DV012-02, DV012-03, DV012-04, DV012-05, DV012-06 |
| DV013 | Không | — |
| DV014 | Có | DV014-01, DV014-02, DV014-03 |
| DV015 | Không | — |
| DV016 | Không | — |
| DV017 | Không | — |
| DV018 | Không | — |
| DV019 | Không | — |
| DV020 | Không | — |
| DV021 | Không | — |
| DV022 | Có | DV022-01, DV022-02, DV022-03 |
| DV023 | Không | — |

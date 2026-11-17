import doctor1 from "@/assets/mock/doctors/doctor-1.png";
import doctor2 from "@/assets/mock/doctors/doctor-2.png";
import doctor3 from "@/assets/mock/doctors/doctor-3.png";
import doctor4 from "@/assets/mock/doctors/doctor-4.png";
import doctor5 from "@/assets/mock/doctors/doctor-5.png";
import placeholderImage from "@/assets/placeholder/placeholder.svg";

export const DOCTORS_PAGE_INTRO =
    "Đội ngũ bác sĩ của Nha khoa Oze được đào tạo bài bản, có chứng chỉ hành nghề và nhiều năm kinh nghiệm trong các lĩnh vực chỉnh nha, cấy ghép Implant, phục hình răng sứ và nha khoa tổng quát. Mỗi khách hàng đều được bác sĩ trực tiếp thăm khám và tư vấn phương án phù hợp.";

const toCertificateImages = (fullName, images) =>
    images.map((imageUrl, index) => ({ imageUrl, alt: `Chứng chỉ ${index + 1} của ${fullName}` }));

const CERTIFICATE_PLACEHOLDERS = [placeholderImage, placeholderImage, placeholderImage, placeholderImage];

// Doctors from the BE sample data (SampleDataSeeder): id = staff id, name and license number match the database.
export const MOCK_DOCTORS = [
    {
        id: 12,
        fullName: "Trần Minh Khoa",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Trần Minh Khoa là bác sĩ Răng hàm mặt tại Nha khoa Oze, phụ trách thăm khám tổng quát, điều trị nội nha và tư vấn phục hình. Bác sĩ luôn giải thích rõ tình trạng răng miệng và các phương án điều trị để khách hàng an tâm lựa chọn.",
        certificateLines: [
            "Tốt nghiệp Bác sĩ Răng hàm mặt",
            "Chứng chỉ Nội nha và Phục hình răng sứ",
            "Thường xuyên tham gia các hội thảo chuyên ngành Răng hàm mặt",
            "Giấy phép hành nghề số 001234/HNO-CCHN",
        ],
        imageUrl: doctor1,
        certificateImages: toCertificateImages("Trần Minh Khoa", CERTIFICATE_PLACEHOLDERS),
    },
    {
        id: 15,
        fullName: "Lê Thu Hà",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Lê Thu Hà là bác sĩ Răng hàm mặt tại Nha khoa Oze, có nhiều kinh nghiệm trong điều trị nha chu, cấy ghép Implant và bọc răng sứ. Bác sĩ chú trọng xây dựng phác đồ phù hợp với tình trạng và nhu cầu của từng khách hàng.",
        certificateLines: [
            "Tốt nghiệp Bác sĩ Răng hàm mặt",
            "Chứng chỉ Cấy ghép Implant nha khoa",
            "Chứng chỉ Điều trị nha chu",
            "Giấy phép hành nghề số 002345/HNO-CCHN",
        ],
        imageUrl: doctor5,
        certificateImages: toCertificateImages("Lê Thu Hà", CERTIFICATE_PLACEHOLDERS),
    },
    {
        id: 18,
        fullName: "Ngô Văn Đức",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Ngô Văn Đức là bác sĩ Răng hàm mặt tại Nha khoa Oze, tập trung vào tiểu phẫu nhổ răng khôn và điều trị các bệnh lý răng miệng thường gặp. Bác sĩ luôn cẩn trọng trong từng bước thăm khám để quá trình điều trị nhẹ nhàng và an toàn.",
        certificateLines: [
            "Tốt nghiệp Bác sĩ Răng hàm mặt",
            "Chứng chỉ Phẫu thuật trong miệng",
            "Liên tục cập nhật kỹ thuật và phương pháp điều trị mới",
            "Giấy phép hành nghề số 003456/HNO-CCHN",
        ],
        imageUrl: doctor3,
        certificateImages: toCertificateImages("Ngô Văn Đức", CERTIFICATE_PLACEHOLDERS),
    },
    {
        id: 30,
        fullName: "Phan Ngọc Ánh",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Phan Ngọc Ánh là bác sĩ Răng hàm mặt tại Nha khoa Oze, theo đuổi lĩnh vực chỉnh nha và nha khoa thẩm mỹ. Bác sĩ luôn lắng nghe mong muốn của khách hàng để mang lại nụ cười hài hòa, tự nhiên.",
        certificateLines: [
            "Tốt nghiệp Bác sĩ Răng hàm mặt",
            "Chứng chỉ Chỉnh hình răng mặt",
            "Chứng chỉ Nha khoa thẩm mỹ",
            "Giấy phép hành nghề số 004567/HNO-CCHN",
        ],
        imageUrl: doctor2,
        certificateImages: toCertificateImages("Phan Ngọc Ánh", CERTIFICATE_PLACEHOLDERS),
    },
    {
        id: 39,
        fullName: "Đặng Quốc Huy",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Đặng Quốc Huy là bác sĩ Răng hàm mặt tại Nha khoa Oze, có kinh nghiệm khám và điều trị răng miệng cho cả người lớn và trẻ em. Bác sĩ đề cao sự tận tâm, giúp khách hàng thoải mái trong suốt quá trình điều trị.",
        certificateLines: [
            "Tốt nghiệp Bác sĩ Răng hàm mặt",
            "Chứng chỉ Răng trẻ em",
            "Thường xuyên tham gia các chương trình đào tạo chuyên ngành trong nước",
            "Giấy phép hành nghề số 005678/HNO-CCHN",
        ],
        imageUrl: doctor4,
        certificateImages: toCertificateImages("Đặng Quốc Huy", CERTIFICATE_PLACEHOLDERS),
    },
];

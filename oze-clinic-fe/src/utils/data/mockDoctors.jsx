import placeholderImage from "@/assets/placeholder/placeholder.svg";

const toCertificateImages = (fullName, images) =>
    images.map((imageUrl, index) => ({ imageUrl, alt: `Chứng chỉ ${index + 1} của ${fullName}` }));

export const MOCK_DOCTORS = [
    {
        id: 1,
        fullName: "Đinh Vạn Trung",
        displayTitle: "Phó Giáo sư – Tiến sĩ",
        position: "Giám đốc chuyên môn",
        introduction:
            "Trên cương vị Chủ tịch Hội đồng Chuyên môn Nha khoa Oze, PGS.TS Đinh Vạn Trung trực tiếp tham gia thăm khám, hội chẩn và định hướng phương án cho những trường hợp cần phối hợp chuyên sâu. Đồng thời, PGS.TS Đinh Vạn Trung còn dành nhiều tâm huyết cho việc xây dựng, đào tạo và hỗ trợ phát triển năng lực cho đội ngũ bác sĩ trẻ, góp phần duy trì chất lượng dịch vụ nhất quán tại Nha khoa Oze.",
        certificateLines: [
            "Tốt nghiệp Học viện Quân y, quân hàm Đại tá",
            "Chức danh Phó Giáo sư ngành Y học do Bộ Giáo dục và Đào tạo công nhận",
            "Học vị Tiến sĩ Y học do Bộ Giáo dục và Đào tạo công nhận",
            "Chứng nhận \"Bác sĩ cao cấp\" do Bộ Quốc phòng trao tặng",
        ],
        imageUrl: placeholderImage,
        certificateImages: toCertificateImages("Đinh Vạn Trung", [placeholderImage, placeholderImage, placeholderImage, placeholderImage]),
    },
    {
        id: 2,
        fullName: "Phạm Phương Anh",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "Với nền tảng chuyên môn được đào tạo bài bản cùng định hướng điều trị dựa trên tình trạng thực tế của từng khách hàng, BS. Phạm Phương Anh luôn hướng đến việc mang lại giải pháp phù hợp, tư vấn rõ ràng và trải nghiệm điều trị an tâm.",
        certificateLines: [
            "Tốt nghiệp Đại học Y",
            "Chứng chỉ Cấy ghép Implant Nha khoa do Viện Đào tạo Răng Hàm Mặt Đại Học Y Hà Nội",
            "Chứng chỉ Chỉnh hình răng mặt do Viện Đào tạo Răng Hàm Mặt Đại Học Y Hà Nội",
            "Giấy phép hành nghề Khám bệnh, chữa bệnh do Sở Y tế Thành phố Hà Nội cấp",
        ],
        imageUrl: placeholderImage,
        certificateImages: toCertificateImages("Phạm Phương Anh", [placeholderImage, placeholderImage, placeholderImage, placeholderImage]),
    },
    {
        id: 3,
        fullName: "Lê Thị Thảo",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "Với nền tảng chuyên môn vững vàng và sự tận tâm trong từng ca điều trị, bác sĩ Lê Thị Thảo luôn chú trọng xây dựng phác đồ cá nhân hóa, phù hợp với tình trạng và nhu cầu của mỗi khách hàng, hướng đến sự hài hòa giữa sức khỏe răng miệng, chức năng ăn nhai và thẩm mỹ.",
        certificateLines: [
            "Tốt nghiệp Đại học Y",
            "Chứng chỉ Implant Nha khoa cơ bản do Trường Đại học Y Dược, Đại học Quốc Gia Hà Nội cấp",
            "Chứng chỉ Chỉnh hình răng mặt cơ bản do Trường Đại học Y dược - Đại học Thái Nguyên cấp",
            "Giấy phép hành nghề Khám bệnh, chữa bệnh do Sở Y tế Thành phố Hà Nội cấp",
        ],
        imageUrl: placeholderImage,
        certificateImages: toCertificateImages("Lê Thị Thảo", [placeholderImage, placeholderImage, placeholderImage, placeholderImage]),
    },
    {
        id: 4,
        fullName: "Nguyễn Đài Trang",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "Với nền tảng được đào tạo chuyên sâu, BS. Nguyễn Đài Trang hiện đang là Bác sĩ chuyên môn tại Nha khoa Oze, với định hướng phát triển chuyên môn cùng sự cẩn trọng trong từng bước thăm khám và điều trị, BS. Nguyễn Đài Trang luôn chú trọng lắng nghe nhu cầu, đánh giá tình trạng thực tế và tư vấn giải pháp phù hợp cho từng khách hàng.",
        certificateLines: [
            "Tốt nghiệp Đại học Y Hà Nội",
            "Chứng chỉ Implant nha khoa cơ bản do Trường Đại học Y Dược, Đại học Quốc Gia Hà Nội cấp",
            "Chứng chỉ Chỉnh Hình Răng mặt do Viện Đào tạo Răng Hàm Mặt - Trường Đại học Y Hà Nội cấp",
            "Giấy phép hành nghề Khám bệnh, chữa bệnh do Sở Y tế Thành phố Hà Nội cấp",
        ],
        imageUrl: placeholderImage,
        certificateImages: toCertificateImages("Nguyễn Đài Trang", [placeholderImage, placeholderImage, placeholderImage, placeholderImage]),
    },
    {
        id: 5,
        fullName: "Nguyễn Thị Cẩm Vân",
        displayTitle: "Bác sĩ",
        position: "Bác sĩ chuyên môn",
        introduction:
            "BS. Nguyễn Thị Cẩm Vân hiện là Bác sĩ chuyên môn tại Nha khoa Oze, luôn chú trọng nâng cao kiến thức và cập nhật những phương pháp điều trị mới để mang đến trải nghiệm chăm sóc răng miệng ngày càng chất lượng cho khách hàng.",
        certificateLines: [
            "Tốt nghiệp Đại học Y",
            "Giấy phép hành nghề Khám bệnh, chữa bệnh do Sở Y tế Thành phố Hà Nội cấp",
            "Thường xuyên tham gia các hội thảo, chương trình đào tạo chuyên ngành Răng Hàm Mặt trong nước",
            "Liên tục cập nhật kiến thức, kỹ thuật và phương pháp điều trị mới nhằm nâng cao chất lượng chuyên môn",
        ],
        imageUrl: placeholderImage,
        certificateImages: toCertificateImages("Nguyễn Thị Cẩm Vân", [placeholderImage, placeholderImage]),
    },
];

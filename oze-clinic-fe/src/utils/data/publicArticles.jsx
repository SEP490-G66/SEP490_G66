export const ARTICLE_CATEGORIES = [
    { id: "boc-rang-su", label: "Bọc răng sứ" },
    { id: "nieng-rang", label: "Niềng răng" },
    { id: "tong-quat", label: "Tổng quát" },
    { id: "trong-rang", label: "Trồng răng" },
];

const paragraph = (text) => ({ type: "paragraph", text });
const heading = (text) => ({ type: "heading", text });
const list = (...items) => ({ type: "list", items });

export const PUBLIC_ARTICLES = [
    {
        id: 1,
        slug: "boc-rang-su-la-gi",
        categoryId: "boc-rang-su",
        title: "Bọc răng sứ là gì? Những điều cần biết trước khi thực hiện",
        imageUrl: "",
        publishedAt: "2026-11-12",
        content: [
            paragraph(
                "Bọc răng sứ là phương pháp mài bớt một lớp mô răng bên ngoài rồi gắn lên đó một mão sứ được chế tác riêng theo hình dáng và màu sắc phù hợp với hàm răng. Mão sứ bao phủ toàn bộ thân răng, giúp phục hồi răng bị hư tổn và cải thiện thẩm mỹ.",
            ),
            heading("Quy trình bọc răng sứ"),
            list(
                "Khám, chụp phim và tư vấn loại sứ phù hợp.",
                "Điều trị các bệnh lý đi kèm như sâu răng, viêm tủy, viêm nướu (nếu có).",
                "Mài cùi răng và lấy dấu hàm.",
                "Gắn răng tạm trong thời gian chế tác răng sứ.",
                "Thử và gắn cố định răng sứ, kiểm tra khớp cắn.",
            ),
            heading("Những điều cần biết trước khi thực hiện"),
            list(
                "Răng cần được khám kỹ để xác định có cần điều trị tủy trước hay không.",
                "Mỗi loại sứ có độ bền, độ trong và chi phí khác nhau; nên được bác sĩ tư vấn theo tình trạng răng của bạn.",
                "Sau khi bọc, răng có thể hơi ê buốt vài ngày đầu và sẽ giảm dần.",
                "Vệ sinh răng miệng đúng cách và khám định kỳ giúp răng sứ bền lâu hơn.",
            ),
        ],
    },
    {
        id: 2,
        slug: "rang-su-dung-duoc-bao-lau",
        categoryId: "boc-rang-su",
        title: "Răng sứ dùng được bao lâu và cách chăm sóc sau khi bọc",
        imageUrl: "",
        publishedAt: "2026-10-08",
        content: [
            paragraph(
                "Tuổi thọ của răng sứ phụ thuộc vào loại sứ, kỹ thuật thực hiện và thói quen chăm sóc của mỗi người. Răng sứ được chăm sóc tốt có thể sử dụng nhiều năm mà vẫn giữ được màu sắc và độ chắc chắn.",
            ),
            heading("Cách chăm sóc răng sau khi bọc sứ"),
            list(
                "Chải răng 2 lần mỗi ngày bằng bàn chải lông mềm, kết hợp chỉ nha khoa hoặc máy tăm nước.",
                "Hạn chế cắn vật cứng như đá lạnh, xương, vỏ cua.",
                "Hạn chế thực phẩm và đồ uống dễ bám màu như cà phê, trà đậm.",
                "Khám răng định kỳ 6 tháng một lần để kiểm tra mão sứ và nướu.",
            ),
        ],
    },
    {
        id: 3,
        slug: "so-sanh-boc-rang-su-va-dan-su-veneer",
        categoryId: "boc-rang-su",
        title: "So sánh bọc răng sứ và dán sứ Veneers",
        imageUrl: "",
        publishedAt: "2026-09-15",
        content: [
            paragraph(
                "Bọc răng sứ và dán sứ Veneers đều giúp cải thiện màu sắc và hình dáng răng, nhưng khác nhau ở mức độ mài răng và trường hợp áp dụng.",
            ),
            heading("Bọc răng sứ"),
            list(
                "Mão sứ bao phủ toàn bộ thân răng.",
                "Phù hợp với răng vỡ lớn, răng đã điều trị tủy, răng lệch nhẹ.",
                "Cần mài răng nhiều hơn so với dán sứ.",
            ),
            heading("Dán sứ Veneers"),
            list(
                "Miếng sứ mỏng dán ở mặt ngoài của răng.",
                "Phù hợp với răng xỉn màu, mẻ nhẹ, thưa nhẹ, răng còn chắc khỏe.",
                "Mài răng rất ít hoặc gần như không mài.",
            ),
            paragraph(
                "Bác sĩ sẽ dựa vào tình trạng răng thực tế để tư vấn phương pháp phù hợp nhất với bạn.",
            ),
        ],
    },
    {
        id: 4,
        slug: "truong-hop-nen-boc-rang-su",
        categoryId: "boc-rang-su",
        title: "Những trường hợp nên cân nhắc bọc răng sứ",
        imageUrl: "",
        publishedAt: "2026-08-20",
        content: [
            paragraph(
                "Bọc răng sứ thường được cân nhắc khi răng bị vỡ, mẻ lớn, răng đã điều trị tủy dễ giòn gãy, răng nhiễm màu nặng mà tẩy trắng không cải thiện, hoặc răng có hình dáng bất thường.",
            ),
            paragraph(
                "Với răng còn khỏe và chỉ cần cải thiện màu sắc nhẹ, bác sĩ có thể tư vấn các phương pháp ít xâm lấn hơn như tẩy trắng hoặc dán sứ.",
            ),
        ],
    },
    {
        id: 5,
        slug: "nieng-rang-mat-bao-lau",
        categoryId: "nieng-rang",
        title: "Niềng răng mất bao lâu? Các giai đoạn chỉnh nha",
        imageUrl: "",
        publishedAt: "2026-11-14",
        content: [
            paragraph(
                "Thời gian niềng răng thường kéo dài từ 18 đến 30 tháng, tùy mức độ lệch lạc của răng, độ tuổi và mức độ tuân thủ hướng dẫn của người niềng.",
            ),
            heading("Các giai đoạn chỉnh nha"),
            list(
                "Khám, chụp phim và lập kế hoạch điều trị.",
                "Gắn mắc cài hoặc bắt đầu đeo khay niềng.",
                "Sắp xếp răng đều và đóng khoảng trống.",
                "Điều chỉnh khớp cắn và hoàn thiện.",
                "Tháo niềng và đeo hàm duy trì để răng ổn định ở vị trí mới.",
            ),
            heading("Làm gì để rút ngắn thời gian niềng?"),
            list(
                "Tái khám đúng lịch hẹn của bác sĩ.",
                "Đeo thun liên hàm hoặc khay niềng đủ thời gian được hướng dẫn.",
                "Giữ mắc cài không bị bung, sút trong quá trình điều trị.",
            ),
        ],
    },
    {
        id: 6,
        slug: "mac-cai-kim-loai-hay-khay-trong-suot",
        categoryId: "nieng-rang",
        title: "Mắc cài kim loại hay khay trong suốt: nên chọn loại nào?",
        imageUrl: "",
        publishedAt: "2026-10-22",
        content: [
            paragraph(
                "Mắc cài kim loại có chi phí hợp lý và xử lý được nhiều trường hợp lệch lạc phức tạp, nhưng dễ nhìn thấy khi giao tiếp. Khay trong suốt có tính thẩm mỹ cao, tháo ra được khi ăn uống, nhưng cần tự giác đeo đủ thời gian mỗi ngày.",
            ),
            heading("Mắc cài kim loại phù hợp khi"),
            list("Răng lệch lạc nhiều hoặc khớp cắn phức tạp.", "Muốn tối ưu chi phí."),
            heading("Khay trong suốt phù hợp khi"),
            list(
                "Răng lệch lạc nhẹ đến trung bình.",
                "Cần thẩm mỹ cao trong học tập, công việc.",
                "Có thể đeo khay khoảng 20 đến 22 giờ mỗi ngày.",
            ),
        ],
    },
    {
        id: 7,
        slug: "ve-sinh-rang-mieng-khi-nieng-rang",
        categoryId: "nieng-rang",
        title: "Cách vệ sinh răng miệng khi đang niềng răng",
        imageUrl: "",
        publishedAt: "2026-09-03",
        content: [
            paragraph(
                "Mắc cài và dây cung khiến thức ăn dễ bám lại, vì vậy người niềng răng cần vệ sinh kỹ hơn bình thường để tránh sâu răng và viêm nướu.",
            ),
            list(
                "Dùng bàn chải chuyên dụng cho người niềng, chải sau mỗi bữa ăn.",
                "Dùng bàn chải kẽ để làm sạch quanh mắc cài và dưới dây cung.",
                "Dùng chỉ nha khoa hoặc máy tăm nước mỗi ngày.",
                "Súc miệng bằng nước súc miệng theo hướng dẫn của bác sĩ.",
                "Hạn chế đồ ăn dai, dính, cứng có thể làm bung mắc cài.",
            ),
        ],
    },
    {
        id: 8,
        slug: "do-tuoi-phu-hop-de-nieng-rang",
        categoryId: "nieng-rang",
        title: "Độ tuổi nào phù hợp để niềng răng?",
        imageUrl: "",
        publishedAt: "2026-08-12",
        content: [
            paragraph(
                "Giai đoạn từ 12 đến 16 tuổi thường được xem là thời điểm thuận lợi để niềng răng vì xương hàm đang phát triển, răng dịch chuyển nhanh và ổn định tốt sau điều trị.",
            ),
            paragraph(
                "Tuy vậy, người trưởng thành vẫn có thể niềng răng khi răng và nướu khỏe mạnh. Thời gian điều trị có thể dài hơn, và bác sĩ sẽ đánh giá cụ thể trước khi lập kế hoạch.",
            ),
        ],
    },
    {
        id: 9,
        slug: "kham-rang-dinh-ky-6-thang",
        categoryId: "tong-quat",
        title: "Vì sao nên khám răng định kỳ 6 tháng một lần?",
        imageUrl: "",
        publishedAt: "2026-11-10",
        content: [
            paragraph(
                "Nhiều bệnh lý răng miệng như sâu răng, viêm nướu tiến triển âm thầm và chỉ gây đau khi đã nặng. Khám định kỳ giúp phát hiện sớm và điều trị đơn giản, ít tốn kém hơn.",
            ),
            heading("Một lần khám định kỳ thường gồm"),
            list(
                "Kiểm tra tình trạng răng, nướu và khớp cắn.",
                "Lấy cao răng và đánh bóng răng.",
                "Chụp phim khi bác sĩ thấy cần thiết.",
                "Tư vấn cách chăm sóc răng miệng phù hợp.",
            ),
        ],
    },
    {
        id: 10,
        slug: "huong-dan-chai-rang-dung-cach",
        categoryId: "tong-quat",
        title: "Hướng dẫn chải răng đúng cách cho cả gia đình",
        imageUrl: "",
        publishedAt: "2026-10-15",
        content: [
            paragraph(
                "Chải răng đúng cách giúp loại bỏ mảng bám, phòng ngừa sâu răng và viêm nướu cho mọi thành viên trong gia đình.",
            ),
            heading("Các bước chải răng"),
            list(
                "Đặt bàn chải nghiêng khoảng 45 độ so với đường viền nướu.",
                "Chải nhẹ nhàng theo chuyển động tròn nhỏ, không chà ngang mạnh.",
                "Chải đủ mặt ngoài, mặt trong và mặt nhai của tất cả các răng.",
                "Chải nhẹ lưỡi để làm sạch vi khuẩn.",
                "Chải ít nhất 2 phút, 2 lần mỗi ngày.",
            ),
            heading("Lưu ý"),
            list(
                "Chọn bàn chải lông mềm và thay mới sau khoảng 3 tháng.",
                "Trẻ nhỏ cần người lớn hướng dẫn và kiểm tra lượng kem đánh răng phù hợp với độ tuổi.",
            ),
        ],
    },
    {
        id: 11,
        slug: "dau-hieu-sau-rang-som",
        categoryId: "tong-quat",
        title: "Dấu hiệu sâu răng sớm và cách phòng ngừa",
        imageUrl: "",
        publishedAt: "2026-09-24",
        content: [
            paragraph(
                "Sâu răng giai đoạn sớm thường có dấu hiệu là những đốm trắng đục hoặc nâu trên bề mặt răng, răng ê buốt khi ăn đồ ngọt, nóng hoặc lạnh, và thức ăn hay bị giắt ở một vị trí.",
            ),
            heading("Cách phòng ngừa"),
            list(
                "Chải răng với kem có fluoride 2 lần mỗi ngày.",
                "Dùng chỉ nha khoa để làm sạch kẽ răng.",
                "Hạn chế đồ ăn vặt và đồ uống nhiều đường.",
                "Khám răng định kỳ để phát hiện và xử lý sớm.",
            ),
        ],
    },
    {
        id: 12,
        slug: "cao-rang-hinh-thanh-nhu-the-nao",
        categoryId: "tong-quat",
        title: "Cao răng hình thành như thế nào?",
        imageUrl: "",
        publishedAt: "2026-08-28",
        content: [
            paragraph(
                "Cao răng hình thành khi mảng bám vi khuẩn không được làm sạch kịp thời, kết hợp với khoáng chất trong nước bọt và cứng lại theo thời gian. Cao răng thường bám ở cổ răng và mặt trong răng cửa hàm dưới.",
            ),
            paragraph(
                "Cao răng không thể loại bỏ bằng bàn chải thông thường. Lấy cao răng tại phòng khám khoảng 6 tháng một lần giúp phòng ngừa viêm nướu và hôi miệng.",
            ),
        ],
    },
    {
        id: 13,
        slug: "quy-trinh-trong-rang-implant",
        categoryId: "trong-rang",
        title: "Trồng răng Implant: quy trình và thời gian điều trị",
        imageUrl: "",
        publishedAt: "2026-11-06",
        content: [
            paragraph(
                "Trồng răng Implant là phương pháp đặt một trụ nhỏ vào xương hàm tại vị trí mất răng để thay thế chân răng, sau đó gắn mão sứ lên trên. Răng Implant có chức năng ăn nhai và thẩm mỹ gần giống răng thật.",
            ),
            heading("Quy trình trồng răng Implant"),
            list(
                "Khám, chụp phim để đánh giá xương hàm và sức khỏe tổng quát.",
                "Lập kế hoạch điều trị và tư vấn loại trụ phù hợp.",
                "Đặt trụ Implant vào xương hàm.",
                "Chờ trụ tích hợp với xương hàm.",
                "Lấy dấu và gắn mão sứ lên trụ.",
            ),
            heading("Thời gian điều trị"),
            paragraph(
                "Thời gian chờ trụ tích hợp với xương thường khoảng 3 đến 6 tháng. Trường hợp cần ghép xương, thời gian có thể kéo dài hơn. Bác sĩ sẽ thông báo lịch trình cụ thể sau khi thăm khám.",
            ),
        ],
    },
    {
        id: 14,
        slug: "mat-rang-lau-nam-anh-huong-suc-khoe",
        categoryId: "trong-rang",
        title: "Mất răng lâu năm ảnh hưởng thế nào đến sức khỏe?",
        imageUrl: "",
        publishedAt: "2026-10-01",
        content: [
            paragraph(
                "Khi mất răng lâu ngày, xương hàm tại vị trí đó dần bị tiêu đi, các răng bên cạnh có xu hướng xô lệch vào khoảng trống, và răng đối diện có thể trồi dài ra.",
            ),
            list(
                "Ăn nhai kém hiệu quả, ảnh hưởng đến tiêu hóa.",
                "Khớp cắn sai lệch, dễ mỏi hàm.",
                "Gương mặt có thể trông già hơn do tiêu xương.",
            ),
            paragraph("Vì vậy, nên phục hình răng mất càng sớm càng tốt theo tư vấn của bác sĩ."),
        ],
    },
    {
        id: 15,
        slug: "cau-rang-su-va-implant",
        categoryId: "trong-rang",
        title: "Cầu răng sứ và Implant: nên chọn phương pháp nào?",
        imageUrl: "",
        publishedAt: "2026-09-10",
        content: [
            paragraph(
                "Cầu răng sứ dùng hai răng bên cạnh làm trụ để nâng đỡ răng giả ở giữa, thời gian thực hiện nhanh nhưng phải mài các răng trụ và không ngăn được tiêu xương ở vị trí mất răng.",
            ),
            paragraph(
                "Implant thay thế cả chân răng nên không cần mài răng bên cạnh và giúp hạn chế tiêu xương, nhưng thời gian điều trị dài hơn và cần xương hàm đủ điều kiện. Bác sĩ sẽ tư vấn phương pháp phù hợp sau khi thăm khám.",
            ),
        ],
    },
    {
        id: 16,
        slug: "cham-soc-rang-implant-sau-cay-ghep",
        categoryId: "trong-rang",
        title: "Chăm sóc răng Implant sau khi cấy ghép",
        imageUrl: "",
        publishedAt: "2026-08-05",
        content: [
            paragraph(
                "Chăm sóc đúng cách sau khi cấy ghép giúp vết thương mau lành và trụ Implant tích hợp tốt với xương hàm.",
            ),
            heading("Những ngày đầu sau cấy ghép"),
            list(
                "Chườm lạnh bên ngoài má để giảm sưng.",
                "Ăn đồ mềm, nguội; tránh nhai ở vị trí vừa cấy ghép.",
                "Không hút thuốc, không dùng đồ uống có cồn.",
                "Dùng thuốc theo đúng đơn của bác sĩ.",
            ),
            heading("Về lâu dài"),
            list(
                "Vệ sinh răng Implant như răng thật, kết hợp chỉ nha khoa hoặc máy tăm nước.",
                "Tái khám theo lịch hẹn để kiểm tra trụ và nướu.",
            ),
        ],
    },
];

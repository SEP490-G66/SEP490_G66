import { CLINIC_ADDRESS, CLINIC_EMAIL, CLINIC_HOTLINE } from "./messages";

// Content of the privacy policy and terms of use pages. Keep it in line with what the system really collects and does.
export const LEGAL_UPDATED_AT = "21/11/2026";

const CONTACT_LINES = [
    `Phòng khám Nha khoa OZE, địa chỉ: ${CLINIC_ADDRESS}.`,
    `Hotline: ${CLINIC_HOTLINE.DISPLAY}.`,
    `Email: ${CLINIC_EMAIL}.`,
];

export const PRIVACY_POLICY = {
    title: "Chính sách bảo mật",
    intro: [
        "Chính sách này giải thích Nha khoa OZE thu thập, sử dụng, lưu trữ và bảo vệ thông tin cá nhân của bạn như thế nào khi bạn sử dụng website và hệ thống đặt lịch, khám và điều trị của phòng khám (gọi chung là \"Hệ thống OZE\").",
        "Khi tạo tài khoản, đặt lịch hoặc gửi yêu cầu tư vấn, bạn xác nhận đã đọc và đồng ý với chính sách này.",
    ],
    sections: [
        {
            title: "Thông tin chúng tôi thu thập",
            blocks: [
                {
                    intro: "Thông tin bạn cung cấp khi đăng ký, đặt lịch hoặc gửi yêu cầu tư vấn:",
                    items: ["Họ và tên, ngày sinh, giới tính.", "Số điện thoại, email, địa chỉ.", "Mật khẩu đăng nhập (chỉ lưu dạng đã mã hóa, phòng khám không đọc được).", "Ghi chú, triệu chứng hoặc lý do khám bạn tự nhập."],
                },
                {
                    intro: "Thông tin phát sinh trong quá trình khám và điều trị tại phòng khám:",
                    items: [
                        "Tiền sử bệnh, dị ứng, thuốc đang dùng.",
                        "Kết quả khám, tình trạng từng răng, chẩn đoán, đơn thuốc, ghi chú của bác sĩ.",
                        "Phim X-quang và hình ảnh chụp trong miệng.",
                        "Kế hoạch điều trị, tiến độ từng giai đoạn, lịch hẹn và lịch tái khám.",
                        "Hóa đơn, khoản thanh toán, công nợ, trả góp và yêu cầu hoàn tiền.",
                        "Tài liệu bạn tải lên theo yêu cầu của bác sĩ.",
                    ],
                },
                {
                    intro: "Thông tin kỹ thuật:",
                    items: ["Phiên đăng nhập được lưu trên trình duyệt của bạn để giữ trạng thái đăng nhập.", "Nhật ký các thao tác quan trọng của nhân viên (ai làm gì, lúc nào) để phục vụ kiểm tra và bảo mật."],
                },
            ],
        },
        {
            title: "Mục đích sử dụng",
            blocks: [
                {
                    items: [
                        "Tạo và quản lý tài khoản, xác minh số điện thoại hoặc email bằng mã OTP.",
                        "Đặt lịch, xác nhận, đổi hoặc hủy lịch hẹn; xếp hàng chờ và gọi khám.",
                        "Khám, chẩn đoán, lập và theo dõi kế hoạch điều trị.",
                        "Lập hóa đơn, ghi nhận thanh toán, theo dõi công nợ và xử lý hoàn tiền.",
                        "Gửi thông báo về lịch hẹn, kết quả, nhắc tái khám và nhắc thanh toán.",
                        "Trả lời yêu cầu tư vấn và hỗ trợ khách hàng.",
                    ],
                },
                "Chúng tôi không dùng thông tin của bạn để quảng cáo cho bên thứ ba và không bán thông tin cá nhân.",
            ],
        },
        {
            title: "Ai được xem thông tin của bạn",
            blocks: [
                {
                    items: [
                        "Nhân viên phòng khám được phân quyền theo vai trò: bác sĩ xem hồ sơ của bệnh nhân mình khám; lễ tân xem thông tin hành chính, lịch hẹn và thanh toán; kỹ thuật viên xem chỉ định chụp phim; quản lý xem số liệu vận hành và nhật ký hệ thống.",
                        "Bạn chỉ xem được hồ sơ, lịch hẹn và hóa đơn của chính mình sau khi đăng nhập.",
                        "Nhà cung cấp dịch vụ gửi tin nhắn SMS (eSMS) và dịch vụ gửi email, chỉ nhận số điện thoại hoặc email cùng nội dung tin cần gửi (ví dụ mã OTP, nhắc lịch hẹn).",
                        "Nhà cung cấp hạ tầng lưu trữ (máy chủ Microsoft Azure và Vercel) để vận hành hệ thống.",
                        "Cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.",
                    ],
                },
            ],
        },
        {
            title: "Lưu trữ và bảo mật",
            blocks: [
                {
                    items: [
                        "Dữ liệu được truyền qua kết nối mã hóa HTTPS và lưu trên máy chủ có kiểm soát truy cập.",
                        "Mật khẩu được mã hóa một chiều; mã OTP có thời hạn và giới hạn số lần nhập sai.",
                        "Hồ sơ khám sau khi bác sĩ hoàn tất sẽ bị khóa; mọi chỉnh sửa sau đó chỉ được ghi bổ sung và lưu lại dấu vết.",
                        "Hồ sơ bệnh án được lưu theo thời hạn pháp luật về khám bệnh, chữa bệnh quy định. Thông tin tài khoản được lưu trong thời gian bạn sử dụng dịch vụ.",
                    ],
                },
            ],
        },
        {
            title: "Quyền của bạn",
            blocks: [
                {
                    items: [
                        "Xem và cập nhật thông tin cá nhân trong trang Hồ sơ.",
                        "Xem lịch sử khám, kế hoạch điều trị, phim chụp đã được bác sĩ duyệt và lịch sử thanh toán của mình.",
                        "Yêu cầu bản sao hoặc bản tóm tắt hồ sơ bệnh án tại phòng khám.",
                        "Yêu cầu ngừng sử dụng hoặc xóa tài khoản. Hồ sơ bệnh án vẫn được phòng khám lưu theo thời hạn pháp luật quy định.",
                        "Rút lại sự đồng ý hoặc khiếu nại về việc xử lý dữ liệu qua thông tin liên hệ bên dưới.",
                    ],
                },
            ],
        },
        {
            title: "Thay đổi chính sách",
            blocks: ["Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang này. Nếu thay đổi quan trọng, chúng tôi sẽ thông báo trong ứng dụng."],
        },
        {
            title: "Liên hệ",
            blocks: [{ intro: "Mọi câu hỏi về dữ liệu cá nhân, vui lòng liên hệ:", items: CONTACT_LINES }],
        },
    ],
};

export const TERMS_OF_USE = {
    title: "Điều khoản sử dụng",
    intro: [
        "Điều khoản này áp dụng khi bạn truy cập website và sử dụng Hệ thống OZE của Nha khoa OZE để đặt lịch, theo dõi khám, điều trị và thanh toán.",
        "Khi tạo tài khoản hoặc đặt lịch, bạn đồng ý tuân thủ các điều khoản dưới đây.",
    ],
    sections: [
        {
            title: "Tài khoản",
            blocks: [
                {
                    items: [
                        "Bạn cung cấp thông tin đúng và chính xác về họ tên, ngày sinh, số điện thoại và email.",
                        "Mỗi tài khoản dùng cho một bệnh nhân. Bạn tự bảo quản mật khẩu và không chia sẻ mã OTP cho người khác.",
                        "Phòng khám có thể khóa tài khoản nếu phát hiện thông tin giả mạo hoặc sử dụng sai mục đích.",
                    ],
                },
            ],
        },
        {
            title: "Đặt lịch, đổi và hủy lịch",
            blocks: [
                {
                    items: [
                        "Lịch đặt trực tuyến chỉ có hiệu lực khi được phòng khám xác nhận.",
                        "Bạn có thể tự đổi hoặc hủy lịch trước thời hạn phòng khám quy định trong hệ thống. Sau thời hạn này, vui lòng gọi hotline.",
                        "Nếu đến muộn quá thời gian cho phép, lịch có thể được ghi nhận là không đến.",
                        "Thời gian chờ hiển thị là ước tính; thứ tự gọi khám có thể thay đổi theo tình trạng thực tế tại phòng khám.",
                    ],
                },
            ],
        },
        {
            title: "Thông tin y tế trên hệ thống",
            blocks: [
                {
                    items: [
                        "Thông tin khám, chẩn đoán, phim chụp và kế hoạch điều trị trên hệ thống chỉ để bạn tham khảo, không thay thế tư vấn trực tiếp của bác sĩ.",
                        "Kế hoạch điều trị được bác sĩ tư vấn và thống nhất với bạn tại phòng khám. Chi phí trong kế hoạch là dự kiến và có thể thay đổi theo tình trạng thực tế, bác sĩ sẽ trao đổi trước khi thực hiện.",
                        "Phim X-quang chụp theo chỉ định của bác sĩ phục vụ việc thăm khám. Nếu bạn muốn nhận bản phim in mang về, phòng khám thu phí theo bảng giá niêm yết.",
                    ],
                },
            ],
        },
        {
            title: "Thanh toán và hoàn tiền",
            blocks: [
                {
                    items: [
                        "Bạn thanh toán tại quầy bằng tiền mặt hoặc chuyển khoản. Khoản chuyển khoản chỉ được ghi nhận sau khi phòng khám xác nhận tiền đã về tài khoản.",
                        "Với điều trị nhiều giai đoạn, phòng khám có thể nhận đặt cọc hoặc thỏa thuận trả góp theo từng kỳ; số tiền và hạn trả được ghi trên hệ thống.",
                        "Yêu cầu hoàn tiền được quản lý phòng khám xem xét. Số tiền hoàn bằng số đã thanh toán trừ giá trị phần điều trị đã thực hiện.",
                    ],
                },
            ],
        },
        {
            title: "Hành vi không được phép",
            blocks: [
                {
                    items: [
                        "Đăng nhập hoặc tìm cách xem thông tin của người khác.",
                        "Đặt lịch giả, đặt nhiều lịch không có ý định đến khám.",
                        "Tải lên tài liệu có virus, nội dung giả mạo hoặc không liên quan đến việc khám.",
                        "Can thiệp, dò quét hoặc làm gián đoạn hệ thống.",
                    ],
                },
            ],
        },
        {
            title: "Giới hạn trách nhiệm",
            blocks: [
                "Phòng khám cố gắng duy trì hệ thống hoạt động ổn định nhưng không bảo đảm hệ thống không bao giờ gián đoạn. Khi hệ thống gặp sự cố, bạn vẫn có thể đặt lịch hoặc hỏi thông tin qua hotline.",
            ],
        },
        {
            title: "Thay đổi điều khoản",
            blocks: ["Phòng khám có thể cập nhật điều khoản này. Ngày cập nhật được ghi ở đầu trang; việc bạn tiếp tục sử dụng hệ thống sau ngày đó được hiểu là bạn đồng ý với nội dung mới."],
        },
        {
            title: "Liên hệ",
            blocks: [{ items: CONTACT_LINES }],
        },
    ],
};

using System.Net;
using System.Text;

namespace OZE.Application.Helpers
{
    /// <summary>
    /// HTML email bodies for patient notifications (Vietnamese). EmailSender already sends as HtmlBody.
    /// </summary>
    public static class PatientEmailTemplates
    {
        public const string BrandName = "Nha khoa OZE";
        public const string BrandSubtitle = "OZE Dental Clinic";

        /// <summary>CID for inline logo attached by <c>EmailSender</c> (MimeKit LinkedResources).</summary>
        public const string LogoContentId = "oze-brand-logo";

        public const string SubjectAppointmentRequest = "Nha khoa OZE - Đã nhận yêu cầu đặt lịch";
        public const string SubjectAppointmentConfirmed = "Nha khoa OZE - Xác nhận lịch hẹn";
        public const string SubjectFollowUpReminder = "Nha khoa OZE - Nhắc lịch tái khám";
        public const string SubjectPaymentReminder = "Nha khoa OZE - Nhắc thanh toán";

        public static string AppointmentRequest(string? patientName, string serviceNames, DateOnly date, TimeOnly? time)
        {
            var greeting = Greeting(patientName);
            var rows = DetailRows(
                ("Dịch vụ", serviceNames),
                ("Ngày khám", date.ToString("dd/MM/yyyy")),
                ("Giờ khám", FormatTime(time)));

            return Layout(
                title: "Đã nhận yêu cầu đặt lịch",
                intro: $"{greeting}Nha khoa OZE đã nhận yêu cầu đặt lịch khám của quý khách với thông tin như sau:",
                detailRowsHtml: rows,
                outro: "Lễ tân sẽ liên hệ qua điện thoại hoặc email để xác nhận lịch hẹn. Nếu cần hỗ trợ sớm hơn, quý khách vui lòng gọi hotline phòng khám.",
                note: "Đây là email tự động từ hệ thống Nha khoa OZE. Vui lòng không trả lời email này.");
        }

        public static string AppointmentConfirmed(string? patientName, string serviceNames, DateOnly date, TimeOnly? time)
        {
            var greeting = Greeting(patientName);
            var rows = DetailRows(
                ("Dịch vụ", serviceNames),
                ("Ngày khám", date.ToString("dd/MM/yyyy")),
                ("Giờ khám", FormatTime(time)));

            return Layout(
                title: "Lịch hẹn đã được xác nhận",
                intro: $"{greeting}Lịch hẹn của quý khách tại Nha khoa OZE đã được xác nhận với thông tin như sau:",
                detailRowsHtml: rows,
                outro: "Quý khách vui lòng đến đúng giờ. Nếu cần đổi lịch hoặc hủy, xin liên hệ lễ tân trước giờ khám.",
                note: "Đây là email tự động từ hệ thống Nha khoa OZE. Vui lòng không trả lời email này.");
        }

        public static string FollowUpReminder(string? patientName, string plainMessage)
        {
            var greeting = Greeting(patientName);
            return Layout(
                title: "Nhắc lịch tái khám",
                intro: $"{greeting}{WebUtility.HtmlEncode(plainMessage)}",
                detailRowsHtml: null,
                outro: "Quý khách vui lòng sắp xếp thời gian đến khám hoặc liên hệ phòng khám nếu cần điều chỉnh lịch.",
                note: "Đây là email tự động từ hệ thống Nha khoa OZE. Vui lòng không trả lời email này.");
        }

        public static string PaymentReminder(string? patientName, string plainMessage)
        {
            var greeting = Greeting(patientName);
            return Layout(
                title: "Nhắc thanh toán",
                intro: $"{greeting}{WebUtility.HtmlEncode(plainMessage)}",
                detailRowsHtml: null,
                outro: "Quý khách có thể thanh toán tại quầy lễ tân hoặc chuyển khoản theo hướng dẫn của phòng khám. Xin cảm ơn.",
                note: "Đây là email tự động từ hệ thống Nha khoa OZE. Vui lòng không trả lời email này.");
        }

        private static string Greeting(string? patientName)
        {
            if (string.IsNullOrWhiteSpace(patientName))
            {
                return "Kính gửi quý khách,<br/><br/>";
            }

            return $"Kính gửi <strong>{WebUtility.HtmlEncode(patientName.Trim())}</strong>,<br/><br/>";
        }

        private static string FormatTime(TimeOnly? time) =>
            time.HasValue ? time.Value.ToString("HH:mm") : "Sẽ thông báo khi xác nhận";

        private static string DetailRows(params (string Label, string Value)[] rows)
        {
            var sb = new StringBuilder();
            sb.Append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;margin:16px 0;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;\">");
            for (var i = 0; i < rows.Length; i++)
            {
                var (label, value) = rows[i];
                var bg = i % 2 == 0 ? "#F8FAFC" : "#FFFFFF";
                sb.Append("<tr>")
                    .Append($"<td style=\"padding:12px 16px;width:36%;font-size:13px;color:#64748B;background:{bg};border-bottom:1px solid #E2E8F0;\">{WebUtility.HtmlEncode(label)}</td>")
                    .Append($"<td style=\"padding:12px 16px;font-size:14px;color:#0F172A;font-weight:600;background:{bg};border-bottom:1px solid #E2E8F0;\">{WebUtility.HtmlEncode(value)}</td>")
                    .Append("</tr>");
            }

            sb.Append("</table>");
            return sb.ToString();
        }

        private static string Layout(string title, string intro, string? detailRowsHtml, string outro, string note)
        {
            return $"""
                <!DOCTYPE html>
                <html lang="vi">
                <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
                <body style="margin:0;padding:0;background:#F5F7FA;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#334155;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F7FA;padding:24px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
                        <tr>
                          <td style="background:#165CDD;padding:20px 28px;">
                            <img src="cid:{LogoContentId}" alt="{BrandName}" width="180" height="60"
                                 style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:180px;width:180px;" />
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:28px;">
                            <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;color:#0F172A;">{WebUtility.HtmlEncode(title)}</h1>
                            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#334155;">{intro}</p>
                            {detailRowsHtml ?? string.Empty}
                            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#334155;">{WebUtility.HtmlEncode(outro)}</p>
                            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#334155;">Trân trọng,<br/><strong>Nha khoa OZE</strong></p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:16px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:12px;line-height:1.5;color:#64748B;">
                            {WebUtility.HtmlEncode(note)}
                          </td>
                        </tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """;
        }
    }
}

namespace OZE.Application.Interfaces
{
    /// <summary>
    /// Cung cấp dịch vụ gửi email thông báo, xác thực OTP và xác nhận lịch hẹn qua SMTP.
    /// </summary>
    public interface IEmailSender
    {
        /// <summary>Gửi email bất đồng bộ đến địa chỉ nhận.</summary>
        Task SendEmailAsync(string toEmail, string subject, string message);

        /// <summary>
        /// Gửi thử một email kiểm tra cấu hình SMTP và trả về kết quả chi tiết mà không bắn ngoại lệ.
        /// </summary>
        Task<OZE.Common.Models.EmailSendResult> TrySendEmailAsync(string toEmail, string subject, string message);
    }
}


namespace OZE.Common.Constants
{
    // In-app notifications (bảng Notifications, F-CRM-03). Values must match the check constraints in NotificationConfiguration.
    public static class NotificationConstants
    {
        public const string TypeInApp = "InApp";
        public const string ChannelInApp = "InApp";
        public const string DeliverySent = "Sent";

        public const int DefaultPageSize = 20;
        public const int MaxPageSize = 50;

        // What a notification opens when clicked (ReferenceType + ReferenceId)
        public static class Reference
        {
            public const string Appointment = "Appointment";
            public const string ImagingRequest = "ImagingRequest";
            public const string DocumentRequest = "DocumentRequest";
            public const string Examination = "Examination";
            public const string TreatmentPlan = "TreatmentPlan";
            public const string Invoice = "Invoice";
            public const string Payment = "Payment";
            public const string RefundRequest = "RefundRequest";
            public const string LeaveRequest = "LeaveRequest";
            public const string ConsultationRequest = "ConsultationRequest";
            public const string CashSession = "CashSession";
            public const string WorkShift = "WorkShift";
        }

        // Texts shown to the user. {0}, {1}... are filled by the caller.
        public static class Text
        {
            // Patient
            public const string AppointmentConfirmedTitle = "Lịch hẹn đã được xác nhận";
            public const string AppointmentConfirmedMessage = "Lịch hẹn của bạn lúc {0} ngày {1} đã được phòng khám xác nhận.";
            public const string AppointmentBookedByClinicTitle = "Phòng khám đã đặt lịch cho bạn";
            public const string AppointmentBookedByClinicMessage = "Bạn có lịch hẹn lúc {0} ngày {1}. Lịch đã được xác nhận.";
            public const string AppointmentRescheduledTitle = "Lịch hẹn đã được đổi";
            public const string AppointmentRescheduledMessage = "Lịch hẹn của bạn đã được đổi sang {0} ngày {1}.";
            public const string AppointmentCancelledTitle = "Lịch hẹn đã bị hủy";
            public const string AppointmentCancelledMessage = "Lịch hẹn lúc {0} ngày {1} đã bị hủy. Lý do: {2}";
            public const string AppointmentShiftEndedTitle = "Lịch hẹn cần đổi giờ";
            public const string InvoiceCreatedTitle = "Có hóa đơn mới";
            public const string InvoiceCreatedMessage = "Hóa đơn {0} với số tiền {1} đã được lập.";
            public const string PaymentConfirmedTitle = "Đã nhận thanh toán";
            public const string PaymentConfirmedMessage = "Phòng khám đã nhận {0} cho hóa đơn {1}.";
            public const string PaymentReminderTitle = "Nhắc thanh toán";
            public const string FollowUpScheduledTitle = "Lịch hẹn tái khám";
            public const string FollowUpScheduledMessage = "Bạn có lịch hẹn tái khám lúc {0} ngày {1}.";
            public const string FollowUpReminderTitle = "Nhắc lịch tái khám";
            public const string YourTurnTitle = "Đến lượt bạn";
            public const string YourTurnMessage = "Số {0}, mời bạn vào {1}.";
            public const string YourTurnAtDeskMessage = "Số {0}, mời bạn đến quầy lễ tân để được chỉ phòng.";
            public const string MissedTurnTitle = "Bạn đã lỡ lượt gọi";
            public const string MissedTurnMessage = "Số {0} đã được gọi khi bạn vắng mặt. Bạn vẫn giữ số và sẽ được gọi lại.";
            public const string CheckedInTitle = "Check-in thành công";
            public const string CheckedInMessage = "Số thứ tự của bạn là {0}.";
            public const string CheckedInWithPlaceMessage = "Số thứ tự của bạn là {0}. Khám với {1}.";
            public const string MovedToDoctorTitle = "Bạn được chuyển bác sĩ";
            public const string MovedToDoctorMessage = "Bạn được chuyển sang khám với {0}. Số thứ tự của bạn vẫn là {1}.";
            public const string AppointmentReminderTitle = "Nhắc lịch hẹn ngày mai";
            public const string AppointmentReminderMessage = "Bạn có lịch hẹn lúc {0} ngày {1} tại Nha khoa OZE.";
            public const string ExaminationCompletedTitle = "Đã có phiếu khám";
            public const string ExaminationCompletedMessage = "Phiếu khám ngày {0} đã có trong Sổ khám bệnh.";
            public const string RefundApprovedTitle = "Yêu cầu hoàn tiền đã được duyệt";
            public const string RefundApprovedMessage = "Yêu cầu hoàn {0} cho hóa đơn {1} đã được duyệt. Phòng khám sẽ liên hệ để hoàn tiền cho bạn.";
            public const string RefundPaidOutTitle = "Đã hoàn tiền";
            public const string RefundPaidOutMessage = "Phòng khám đã hoàn {0} cho hóa đơn {1}.";
            public const string RefundRejectedTitle = "Yêu cầu hoàn tiền bị từ chối";
            public const string RefundRejectedMessage = "Yêu cầu hoàn tiền cho hóa đơn {0} bị từ chối. Lý do: {1}";
            public const string DocumentRequestedTitle = "Bác sĩ yêu cầu bổ sung tài liệu";
            public const string DocumentRequestCancelledTitle = "Bác sĩ đã huỷ yêu cầu bổ sung tài liệu";
            public const string DocumentRequestCancelledMessage = "{0} không cần bạn nộp \"{1}\" nữa.";
            public const string DocumentRequestedMessage = "{0} cần bạn nộp \"{1}\" cho lượt khám hôm nay. Vui lòng tải lên trong Sổ khám bệnh, mục Phim và tài liệu.";

            // Receptionist
            public const string NewOnlineBookingTitle = "Có lịch đặt mới chờ xác nhận";
            public const string NewOnlineBookingMessage = "{0} đặt lịch lúc {1} ngày {2}. Gọi bệnh nhân để xác nhận.";
            public const string PatientRescheduledTitle = "Bệnh nhân đổi lịch, chờ xác nhận lại";
            public const string PatientRescheduledMessage = "{0} đổi lịch sang {1} ngày {2}. Gọi bệnh nhân để xác nhận lại.";
            public const string PatientCancelledTitle = "Bệnh nhân tự hủy lịch";
            public const string PatientCancelledMessage = "{0} đã hủy lịch lúc {1} ngày {2}. Lý do: {3}";
            public const string NewConsultationTitle = "Có yêu cầu tư vấn mới";
            public const string NewConsultationMessage = "{0} ({1}) gửi yêu cầu tư vấn. Gọi lại cho khách.";
            public const string CashHandoverTitle = "Bạn được chọn nhận bàn giao ca";
            public const string CashHandoverMessage = "{0} đã đóng ca và bàn giao cho bạn. Tiền mặt đếm được: {1}.";
            public const string ShiftEndedReceptionTitle = "Bác sĩ kết thúc ca, còn bệnh nhân cần xử lý";
            public const string ShiftEndedReceptionMessage = "{0} đã kết thúc ca. Còn {1} bệnh nhân đang chờ hoặc có hẹn cần chuyển bác sĩ hoặc đổi lịch.";

            // Doctor
            public const string NewAppointmentForDoctorTitle = "Bạn có lịch hẹn mới";
            public const string NewAppointmentForDoctorMessage = "{0} có lịch hẹn với bạn lúc {1} ngày {2}.";
            public const string AppointmentMovedAwayTitle = "Lịch hẹn đã chuyển khỏi bạn";
            public const string AppointmentMovedAwayMessage = "Lịch hẹn của {0} lúc {1} ngày {2} đã được đổi hoặc chuyển cho bác sĩ khác.";
            public const string AppointmentCancelledForDoctorTitle = "Lịch hẹn của bạn bị hủy";
            public const string AppointmentCancelledForDoctorMessage = "Lịch hẹn của {0} lúc {1} ngày {2} đã bị hủy.";
            public const string PatientReassignedTitle = "Có bệnh nhân được chuyển sang bạn";
            public const string PatientReassignedMessage = "{0} đã được chuyển sang hàng chờ của bạn.";
            public const string ImagingCompletedTitle = "Đã có kết quả chụp phim";
            public const string ImagingCompletedMessage = "Phim {0} của {1} đã chụp xong.";
            public const string TreatmentPlanApprovedTitle = "Bệnh nhân đã đồng ý kế hoạch điều trị";
            public const string TreatmentPlanApprovedMessage = "{0} đã đồng ý kế hoạch \"{1}\". Có thể bắt đầu các giai đoạn điều trị.";
            public const string DocumentSubmittedTitle = "Bệnh nhân đã nộp tài liệu";
            public const string DocumentSubmittedMessage = "{0} đã nộp {1} file cho yêu cầu \"{2}\".";

            // Imaging technician
            public const string NewImagingRequestTitle = "Có chỉ định chụp phim mới";
            public const string NewImagingRequestMessage = "Chỉ định chụp {0} cho {1} vừa được gửi.";
            public const string ImagingCancelledTitle = "Chỉ định chụp phim đã bị hủy";
            public const string ImagingCancelledMessage = "Chỉ định chụp {0} cho {1} đã bị hủy. Lý do: {2}";

            // Clinic manager
            public const string NewLeaveRequestTitle = "Có đơn nghỉ phép chờ duyệt";
            public const string NewLeaveRequestMessage = "{0} xin nghỉ {1} ngày {2}. Lý do: {3}";
            public const string NewRefundRequestTitle = "Có yêu cầu hoàn tiền chờ duyệt";
            public const string NewRefundRequestMessage = "Yêu cầu hoàn {0} cho hóa đơn {1}. Lý do: {2}";
            public const string CashDifferenceTitle = "Bàn giao ca có chênh lệch tiền mặt";
            public const string CashDifferenceMessage = "Ca của {0} lệch {1} so với sổ sách. Ghi chú: {2}";

            // Staff
            public const string LeaveApprovedTitle = "Đơn nghỉ phép đã được duyệt";
            public const string LeaveApprovedMessage = "Đơn nghỉ {0} ngày {1} của bạn đã được duyệt.{2}";
            public const string LeaveSubstituteSuffix = " Người làm thay: {0}.";
            public const string SubstituteAssignedTitle = "Bạn được xếp làm thay ca";
            public const string SubstituteAssignedMessage = "Bạn làm thay ca của {0} {1} ngày {2}.";
            public const string LeaveRejectedTitle = "Đơn nghỉ phép bị từ chối";
            public const string LeaveRejectedMessage = "Đơn nghỉ {0} ngày {1} bị từ chối. Lý do: {2}";
            public const string RefundDecidedForRequesterTitle = "Yêu cầu hoàn tiền đã có kết quả";
            public const string RefundDecidedForRequesterMessage = "Yêu cầu hoàn tiền cho hóa đơn {0}: {1}.";
            public const string WorkShiftAssignedTitle = "Bạn được xếp ca làm";
            public const string WorkShiftAssignedMessage = "Ca {0}–{1} ngày {2}{3}.";
            public const string WorkShiftChangedTitle = "Ca làm của bạn đã thay đổi";
            public const string WorkShiftChangedMessage = "Ca ngày {0} đổi thành {1}–{2}{3}.";
            public const string WorkShiftRemovedTitle = "Ca làm của bạn đã bị xóa";
            public const string WorkShiftRemovedMessage = "Ca {0}–{1} ngày {2} đã bị xóa khỏi lịch của bạn.";
        }
    }
}

// Strip at the top of the doctor's "Hàng chờ" about the patient in the room: being examined ("Đang khám số 8 · …")
// or called and not in yet ("Đã gọi số 2 · …"), with the one action that goes on from there.
const QueueCurrentBanner = ({ title, text, action }) => (
    <div role="status" className="alert alert-warning flex-wrap items-center">
        <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{title}</p>
            <p className="text-caption">{text}</p>
        </div>
        {action}
    </div>
);

export default QueueCurrentBanner;

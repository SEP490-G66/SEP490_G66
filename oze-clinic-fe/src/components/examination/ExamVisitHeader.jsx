// Patient card at the top of every exam step (Figma): name + "Đang khám", the registered services, the step's buttons
// on the right, and the autosave status under them. services: [{ id, name }].
const ExamVisitHeader = ({ name, services = [], status, actions }) => (
    <section aria-label={`Bệnh nhân ${name}`} className="card-app flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-heading-3 text-ink">{name}</h2>
                <span className="badge badge-info">Đang khám</span>
            </div>
            {services.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption text-muted">Dịch vụ đăng ký</span>
                    <ul className="contents">
                        {services.map((service) => (
                            <li key={service.id ?? service.name} className="rounded-full border border-border bg-canvas px-2.5 py-0.5 text-caption font-medium text-ink">
                                {service.name}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
        <div className="flex flex-col items-end gap-1.5 max-sm:w-full max-sm:items-stretch">
            <div className="flex flex-wrap justify-end gap-2">{actions}</div>
            {status && (
                <p className="text-caption text-muted" aria-live="polite">
                    {status}
                </p>
            )}
        </div>
    </section>
);

export default ExamVisitHeader;

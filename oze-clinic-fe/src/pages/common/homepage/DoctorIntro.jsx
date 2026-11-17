import { Check, IdCard, Image as ImageIcon, User } from "lucide-react";
import { Link } from "react-router-dom";
import { PUBLIC_DOCTOR_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";

// One doctor: portrait, title and name, position, introduction, certificates and the buttons.
// headingLevel: 3 on the home page, 2 on /doctors. showMore: the "Xem thêm" link to /doctors (hidden on that page).
// live: announce the name when it changes (home page, where one card switches doctor).
// onOpenCertificate(index): when given, the certificate pictures are listed and open a large view.
const DoctorIntro = ({ doctor, ref, headingLevel = 3, showMore = true, live = true, onOpenCertificate }) => {
    const Heading = `h${headingLevel}`;
    const name = `${doctor.displayTitle} ${doctor.fullName}`;
    const pictures = onOpenCertificate ? (doctor.certificateImages ?? []) : [];

    return (
        <div ref={ref} className="card-public grid scroll-mt-20 overflow-hidden p-0 md:grid-cols-3">
            {/* From md the photo fills the column, so the card is as tall as its text, not the 2:3 photo */}
            <div className="relative bg-primary-soft">
                <img
                    src={doctor.imageUrl}
                    alt={doctor.fullName}
                    className="aspect-4/5 w-full object-cover object-top md:absolute md:inset-0 md:aspect-auto md:size-full"
                />
            </div>
            <div className="flex flex-col gap-5 p-6 md:col-span-2 md:p-8">
                <div aria-live={live ? "polite" : undefined} className="flex flex-col gap-2">
                    <Heading className="font-heading text-heading-1 font-bold uppercase text-primary lg:text-display-md">{name}</Heading>
                    <p className="flex items-center gap-2 text-title text-primary">
                        <User className="size-4 shrink-0" aria-hidden="true" />
                        {doctor.position}
                    </p>
                </div>
                <p className="text-body-md text-body">{doctor.introduction}</p>
                <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-title text-primary">
                        <IdCard className="size-4 shrink-0" aria-hidden="true" />
                        Chứng chỉ chuyên môn
                    </p>
                    <ul className="flex flex-col gap-3">
                        {doctor.certificateLines.map((line) => (
                            <li key={line} className="flex gap-3 text-body-md text-body">
                                <Check className="mt-0.5 size-5 shrink-0 text-success-solid" aria-hidden="true" />
                                <span>{line}</span>
                            </li>
                        ))}
                    </ul>
                    {pictures.length > 0 && (
                        <ul aria-label={TEXT.CERTIFICATES_OF(doctor.fullName)} className="grid grid-cols-4 gap-3">
                            {pictures.map((picture, index) => (
                                <li key={picture.imageUrl ?? index}>
                                    <button
                                        type="button"
                                        onClick={() => onOpenCertificate(index)}
                                        aria-label={TEXT.OPEN_CERTIFICATE(index + 1, doctor.fullName)}
                                        className="flex aspect-4/3 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted transition hover:border-primary"
                                    >
                                        {picture.imageUrl ? (
                                            <img src={picture.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                                        ) : (
                                            <ImageIcon className="size-6 text-placeholder" aria-hidden="true" />
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    {showMore && (
                        <Link to={ROUTES.DOCTORS} className="btn btn-secondary btn-lg rounded-full">
                            Xem thêm
                        </Link>
                    )}
                    <Link to={ROUTES.BOOK_APPOINTMENT} className="btn btn-cta">
                        Đặt lịch hẹn
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default DoctorIntro;

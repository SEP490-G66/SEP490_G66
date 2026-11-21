import { MapPin, Phone, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { FaFacebookF, FaTiktok, FaYoutube } from "react-icons/fa";
import LogoOze from "@/assets/logo/Logo.png";
import FooterConsultationForm from "@/components/contact/FooterConsultationForm";
import { getFooterServices } from "@/services/dentalService";
import { ROUTES, getServiceDetailRoute } from "@/utils/routes";

const LEGAL_LINKS = [
    { label: "Chính sách bảo mật", to: ROUTES.PRIVACY_POLICY },
    { label: "Điều khoản sử dụng", to: ROUTES.TERMS_OF_USE },
];

const CONTACTS = [
    { icon: MapPin, text: "Số nhà 55-59, tổ 4, quốc lộ 3, Đông Anh, Hà Nội" },
    { icon: Phone, text: "0866 866 010", href: "tel:0866866010" },
    { icon: Clock, text: "Mở cửa: Thứ 2 - Chủ Nhật" },
];

const SOCIALS = [
    { label: "Facebook Nha khoa Oze", href: "https://www.facebook.com/nhakhoaoze.vn", icon: FaFacebookF, tone: "text-brand-facebook" },
    { label: "TikTok Nha khoa Oze", href: "https://www.tiktok.com/@nhakhoaganday_", icon: FaTiktok, tone: "text-ink" },
    { label: "YouTube Nha khoa Oze", href: "https://www.youtube.com/@NhakhoaOze.official", icon: FaYoutube, tone: "text-brand-youtube" },
];

const HEADING = "font-heading text-heading-3 font-bold text-ink sm:text-heading-2";

const Footer = () => {
    return (
        <footer className="@container bg-canvas px-4 py-10 sm:px-6 sm:py-16">
            <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 @2xl:grid-cols-2 @5xl:grid-cols-8 @5xl:gap-12">
                <div className="flex flex-col gap-6 sm:gap-8 @5xl:col-span-3">
                    <img
                        src={LogoOze}
                        alt="Nha khoa Oze"
                        className="logo-on-light h-auto w-44 object-contain sm:w-56"
                    />
                    <ul className="flex flex-col gap-4">
                        {CONTACTS.map(({ icon: Icon, text, href }) => {
                            const content = (
                                <>
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft" aria-hidden="true">
                                        <Icon className="size-5 text-primary" />
                                    </span>
                                    <span className="min-w-0 pt-2 text-body group-hover:text-primary">{text}</span>
                                </>
                            );
                            return (
                                <li key={text}>
                                    {href ? (
                                        <a href={href} className="group flex items-start gap-4 rounded-md pointer-coarse:min-h-11">
                                            {content}
                                        </a>
                                    ) : (
                                        <div className="flex items-start gap-4">{content}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <nav aria-labelledby="footer-services-title" className="flex flex-col gap-4 sm:gap-6 @5xl:col-span-2">
                    <h3 id="footer-services-title" className={HEADING}>
                        Dịch vụ nha khoa
                    </h3>
                    {/* 2 columns × 3 rows, filled top-to-bottom; single column on narrow footers */}
                    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:gap-y-2 @md:grid-flow-col @md:grid-cols-2 @md:grid-rows-3">
                        {getFooterServices().map((service) => (
                            <li key={service.slug}>
                                <Link
                                    to={getServiceDetailRoute(service.slug)}
                                    className="group flex min-h-9 items-center gap-2 rounded-md py-1 pointer-coarse:min-h-11"
                                >
                                    <ChevronRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
                                    <span className="text-body-md text-body transition-colors group-hover:text-primary">{service.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="flex flex-col gap-8 @2xl:col-span-2 @2xl:grid @2xl:grid-cols-2 @2xl:gap-10 @5xl:col-span-3 @5xl:flex @5xl:gap-10">
                    <FooterConsultationForm headingClassName={HEADING} />

                    <div className="flex flex-col gap-4 sm:gap-5">
                        <h3 className={HEADING}>Theo dõi chúng tôi tại</h3>
                        <ul className="flex items-center gap-4">
                            {SOCIALS.map(({ label, href, icon: Icon, tone }) => (
                                <li key={label}>
                                    <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={label}
                                        title={label}
                                        className="flex size-11 items-center justify-center rounded-full bg-surface-muted shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                                    >
                                        <Icon className={`size-5 ${tone}`} aria-hidden="true" />
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="mx-auto mt-10 flex w-full max-w-7xl flex-col gap-3 border-t border-border pt-6 text-body-sm text-muted sm:flex-row sm:items-center sm:justify-between">
                <p>© {new Date().getFullYear()} Nha khoa OZE</p>
                <ul className="flex flex-wrap gap-x-6 gap-y-2">
                    {LEGAL_LINKS.map(({ label, to }) => (
                        <li key={to}>
                            <Link to={to} className="hover:text-primary hover:underline">
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </footer>
    );
};

export default Footer;

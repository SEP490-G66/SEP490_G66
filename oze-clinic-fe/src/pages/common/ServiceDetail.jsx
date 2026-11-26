import { useEffect, useState } from "react";
import { CalendarCheck, Clock, Image as ImageIcon, Layers, Wallet } from "lucide-react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import SectionHeading from "@/components/ui/SectionHeading";
import ImageCard from "@/components/ui/ImageCard";
import { getServiceBySlug, isMenuSlug, loadMenuService } from "@/services/dentalService";
import { formatCurrency } from "@/utils/format";
import { PUBLIC_SERVICE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getErrorRoute } from "@/utils/routes";

const SECTION_CLASS = "container-public flex flex-col gap-10 py-12 md:py-16";

const BENEFITS_TITLE_ID = "service-benefits-title";
const STEPS_TITLE_ID = "service-steps-title";
const TYPES_TITLE_ID = "service-types-title";

const typeColumns = (count) => {
    if (count % 4 === 0) return "sm:grid-cols-2 lg:grid-cols-4";
    if (count % 2 !== 0 && count % 3 === 0) return "sm:grid-cols-3";
    return "sm:grid-cols-2 lg:grid-cols-3";
};

const TypesSection = ({ types }) => (
    <section aria-labelledby={TYPES_TITLE_ID} className={SECTION_CLASS}>
        <SectionHeading id={TYPES_TITLE_ID}>{TEXT.TYPES_TITLE}</SectionHeading>
        <ul className={`grid grid-cols-1 gap-6 ${typeColumns(types.length)}`}>
            {types.map(({ id, name, description, imageUrl, price, minutes }) => (
                <li key={name} id={id ? `variant-${id}` : undefined} className="flex scroll-mt-24">
                    <ImageCard imageUrl={imageUrl} imageAlt={name} title={name} description={description} imageClassName="aspect-4/3" className="w-full" hideEmptyImage>
                        {(price > 0 || minutes) && (
                            <dl className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-label">
                                {price > 0 && (
                                    <div className="flex gap-1">
                                        <dt className="sr-only">{TEXT.PRICE}</dt>
                                        <dd className="num text-primary">{formatCurrency(price)}</dd>
                                    </div>
                                )}
                                {minutes && (
                                    <div className="flex gap-1">
                                        <dt className="sr-only">{TEXT.DURATION}</dt>
                                        <dd className="text-muted">{TEXT.MINUTES(minutes)}</dd>
                                    </div>
                                )}
                            </dl>
                        )}
                    </ImageCard>
                </li>
            ))}
        </ul>
    </section>
);

const BenefitsSection = ({ benefits }) => (
    <section aria-labelledby={BENEFITS_TITLE_ID} className={SECTION_CLASS}>
        <SectionHeading id={BENEFITS_TITLE_ID}>{TEXT.BENEFITS_TITLE}</SectionHeading>
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {benefits.map(({ icon: Icon, title, description }) => (
                <li key={title} className="card-public card-hover flex h-full overflow-hidden p-0">
                    <span className="flex w-20 shrink-0 items-center justify-center bg-primary-soft text-primary md:w-24">
                        <Icon className="size-8" aria-hidden="true" />
                    </span>
                    <div className="flex flex-1 flex-col justify-center gap-2 p-5 md:p-6">
                        <h3 className="card-title">{title}</h3>
                        <p className="text-body-sm text-body md:text-body-md">{description}</p>
                    </div>
                </li>
            ))}
        </ul>
    </section>
);

const StepsSection = ({ steps }) => (
    <section aria-labelledby={STEPS_TITLE_ID} className={SECTION_CLASS}>
        <SectionHeading id={STEPS_TITLE_ID}>{TEXT.STEPS_TITLE}</SectionHeading>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:flex lg:justify-center">
            {steps.map(({ icon: Icon, title }, index) => (
                <li key={title} className="relative flex flex-col items-center gap-4 lg:flex-1">
                    {index < steps.length - 1 && (
                        <span
                            aria-hidden="true"
                            className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-primary-soft lg:block"
                        />
                    )}
                    <span className="relative flex size-24 items-center justify-center rounded-full border-4 border-primary bg-canvas text-primary shadow-md">
                        <Icon className="size-10" aria-hidden="true" />
                        <span className="num absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-primary text-label text-on-primary">
                            {index + 1}
                        </span>
                    </span>
                    <div className="flex max-w-44 flex-col items-center gap-1 text-center">
                        <span className="text-label text-primary">{TEXT.STEP(index + 1)}</span>
                        <span className="text-title text-ink">{title}</span>
                    </div>
                </li>
            ))}
        </ol>
    </section>
);

// A service of the header menu is read from the database; the other pages keep the website content
const useService = (slug) => {
    const fromMenu = isMenuSlug(slug);
    const [loaded, setLoaded] = useState({ slug: null, service: null });

    useEffect(() => {
        if (!fromMenu) return undefined;
        let active = true;
        loadMenuService(slug).then((service) => active && setLoaded({ slug, service }));
        return () => {
            active = false;
        };
    }, [slug, fromMenu]);

    if (!fromMenu) return getServiceBySlug(slug);
    return loaded.slug === slug ? loaded.service : undefined;
};

// Price, time and number of variants of a service read from the database
const FactList = ({ service }) => {
    const prices = service.types.map((type) => type.price).filter((price) => price > 0);
    const price = prices.length ? Math.min(...prices) : service.price;
    const minutes = service.types.length ? Math.min(...service.types.map((type) => type.minutes ?? Infinity)) : service.minutes;
    const facts = [
        price > 0 && { icon: Wallet, label: prices.length > 1 ? TEXT.PRICE_FROM : TEXT.PRICE, value: formatCurrency(price) },
        Number.isFinite(minutes) && minutes > 0 && { icon: Clock, label: TEXT.DURATION, value: TEXT.MINUTES(minutes) },
        service.types.length > 0 && { icon: Layers, label: TEXT.TYPE_TOTAL, value: service.types.length },
    ].filter(Boolean);
    if (!facts.length) return null;

    return (
        <div className="flex flex-col gap-2">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {facts.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-surface-tint p-3">
                        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                        <div className="flex min-w-0 flex-col">
                            <dt className="text-label text-muted">{label}</dt>
                            <dd className="num text-title text-ink">{value}</dd>
                        </div>
                    </div>
                ))}
            </dl>
            {price > 0 && <p className="text-body-sm text-muted">{TEXT.PRICE_NOTE}</p>}
        </div>
    );
};

const ServiceDetail = () => {
    const { serviceSlug } = useParams();
    const service = useService(serviceSlug);
    const { hash } = useLocation();

    // A variant picked in the service bar opens the page at that variant
    useEffect(() => {
        if (service && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }, [service, hash]);

    if (service === undefined) {
        return (
            <div className="container-public py-16 text-center text-body" role="status">
                {TEXT.LOADING}
            </div>
        );
    }
    if (!service) return <Navigate to={getErrorRoute(404)} replace />;

    const breadcrumbItems = [
        { label: TEXT.HOME, href: ROUTES.HOME },
        { label: TEXT.SERVICES, href: ROUTES.SERVICES },
        { label: service.name },
    ];

    return (
        <div className="bg-canvas">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={breadcrumbItems} />
            </div>

            <section className="container-public flex flex-col gap-10 pb-12 md:pb-16">
                <h1 className="text-center font-heading text-display-md text-ink md:text-display-lg">{service.name}</h1>
                <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2 md:gap-12">
                    {service.imageUrl ? (
                        <img
                            src={service.imageUrl}
                            alt={service.name}
                            className="aspect-4/3 w-full rounded-2xl bg-surface-tint object-contain shadow-md"
                        />
                    ) : (
                        <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl bg-surface-muted shadow-md">
                            <ImageIcon className="size-12 text-placeholder" aria-hidden="true" />
                        </div>
                    )}
                    <div className="flex flex-col gap-5">
                        <p className="text-body-lg text-ink">{service.intro}</p>
                        {service.details && <p className="text-body-md text-body">{service.details}</p>}
                        <FactList service={service} />
                        <div className="flex flex-wrap gap-3">
                            <Link to={ROUTES.BOOK_APPOINTMENT} className="btn btn-primary">
                                <CalendarCheck className="size-4" aria-hidden="true" />
                                {TEXT.BOOK}
                            </Link>
                            {service.types.length > 0 && (
                                <a href="#service-types-title" className="btn btn-secondary">
                                    {TEXT.VIEW_TYPES}
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {service.types.length > 0 && (
                <div className="bg-surface-tint">
                    <TypesSection types={service.types} />
                </div>
            )}
            {service.benefits.length > 0 && <BenefitsSection benefits={service.benefits} />}
            {service.steps.length > 0 && (
                <div className="bg-surface-tint">
                    <StepsSection steps={service.steps} />
                </div>
            )}
        </div>
    );
};

export default ServiceDetail;

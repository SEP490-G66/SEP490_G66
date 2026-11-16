import { SearchX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import DoctorCompactCard from "@/components/public/DoctorCompactCard";
import ImageCard from "@/components/ui/ImageCard";
import SearchInput from "@/components/ui/SearchInput";
import { searchServices, toSearchText } from "@/services/dentalService";
import { searchDoctors } from "@/services/doctorService";
import { PUBLIC_SEARCH_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getDoctorSearchRoute, getServiceDetailRoute, getServiceSearchRoute } from "@/utils/routes";

const SEARCH_ID = "site-search";
const TITLE_ID = "search-title";
const SERVICES_ID = "search-services-title";
const DOCTORS_ID = "search-doctors-title";

const BREADCRUMB = [{ label: TEXT.HOME, href: ROUTES.HOME }, { label: TEXT.BREADCRUMB }];

const SectionHead = ({ id, title, count, to }) => (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-heading text-heading-1 text-ink">
            {title} <span className="num text-body-lg text-muted">({count})</span>
        </h2>
        {count > 0 && (
            <Link to={to} className="btn btn-link text-label">
                {TEXT.SEE_ALL}
            </Link>
        )}
    </div>
);

// /search?q= — the header search: matching services and doctors on one page (fixed content).
const SearchResults = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const keyword = searchParams.get("q") ?? "";
    const blank = !toSearchText(keyword);
    const services = blank ? [] : searchServices(keyword);
    const doctors = blank ? [] : searchDoctors(keyword);
    const shown = keyword.trim();

    const changeKeyword = (value) =>
        setSearchParams(
            (current) => {
                const next = new URLSearchParams(current);
                if (value) next.set("q", value);
                else next.delete("q");
                return next;
            },
            { replace: true },
        );

    return (
        <div className="bg-canvas">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={BREADCRUMB} />
            </div>

            <section aria-labelledby={TITLE_ID} className="container-public flex flex-col gap-10 pb-12 md:pb-16">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <h1 id={TITLE_ID} className="font-heading text-display-section text-ink">
                        {blank ? TEXT.TITLE : TEXT.TITLE_FOR(shown)}
                    </h1>
                    <SearchInput
                        id={SEARCH_ID}
                        label={TEXT.SEARCH_LABEL}
                        placeholder={TEXT.SEARCH_PLACEHOLDER}
                        value={keyword}
                        onChange={changeKeyword}
                        className="w-full md:max-w-sm"
                    />
                </div>

                {blank && <p className="text-body-lg text-body">{TEXT.ENTER_KEYWORD}</p>}

                {!blank && services.length === 0 && doctors.length === 0 && (
                    <div className="empty-state" role="status">
                        <SearchX className="empty-state-icon" aria-hidden="true" />
                        <p className="empty-state-title">{TEXT.NO_RESULT(shown)}</p>
                        <p className="empty-state-text">{TEXT.NO_RESULT_HINT}</p>
                    </div>
                )}

                {!blank && (services.length > 0 || doctors.length > 0) && (
                    <>
                        <section aria-labelledby={SERVICES_ID} className="flex flex-col gap-6">
                            <SectionHead id={SERVICES_ID} title={TEXT.SERVICES} count={services.length} to={getServiceSearchRoute(shown)} />
                            {services.length > 0 ? (
                                <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
                                    {services.map((service) => (
                                        <li key={service.slug} className="flex">
                                            <ImageCard
                                                imageUrl={service.imageUrl}
                                                imageAlt={service.name}
                                                title={service.name}
                                                description={service.summary}
                                                to={getServiceDetailRoute(service.slug)}
                                                className="w-full"
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-body-md text-muted">{TEXT.NO_SERVICE}</p>
                            )}
                        </section>

                        <section aria-labelledby={DOCTORS_ID} className="flex flex-col gap-6">
                            <SectionHead id={DOCTORS_ID} title={TEXT.DOCTORS} count={doctors.length} to={getDoctorSearchRoute(shown)} />
                            {doctors.length > 0 ? (
                                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                    {doctors.map((doctor) => (
                                        <li key={doctor.id}>
                                            <DoctorCompactCard doctor={doctor} to={getDoctorSearchRoute(doctor.fullName)} />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-body-md text-muted">{TEXT.NO_DOCTOR}</p>
                            )}
                        </section>
                    </>
                )}
            </section>
        </div>
    );
};

export default SearchResults;

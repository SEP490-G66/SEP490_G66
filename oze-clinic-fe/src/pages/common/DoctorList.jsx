import { useRef, useState } from "react";
import { SearchX } from "lucide-react";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import CertificateViewer from "@/components/doctor/CertificateViewer";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import usePublicList from "@/hooks/usePublicList";
import { getDoctorsPageIntro, searchDoctors } from "@/services/doctorService";
import { PUBLIC_DOCTOR_TEXT as TEXT } from "@/utils/messages";
import { ROUTES } from "@/utils/routes";
import DoctorIntro from "./homepage/DoctorIntro.jsx";

const PAGE_SIZE = 5;
const SEARCH_ID = "doctor-search";
const TITLE_ID = "doctor-list-title";

const BREADCRUMB = [{ label: TEXT.HOME, href: ROUTES.HOME }, { label: TEXT.TITLE }];

const DoctorList = () => {
    const listRef = useRef(null);
    const { keyword, page, totalPages, items: doctors, setKeyword, setPage } = usePublicList(searchDoctors, PAGE_SIZE);
    const [viewer, setViewer] = useState(null);

    const changePage = (target) => {
        setPage(target);
        listRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };

    return (
        <div className="bg-canvas">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={BREADCRUMB} />
            </div>

            <section aria-labelledby={TITLE_ID} className="container-public flex flex-col gap-8 pb-12 md:pb-16">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <h1 id={TITLE_ID} className="font-heading text-display-md text-ink md:text-display-lg">
                            {TEXT.TITLE}
                        </h1>
                        <SearchInput
                            id={SEARCH_ID}
                            label={TEXT.SEARCH_LABEL}
                            placeholder={TEXT.SEARCH_PLACEHOLDER}
                            value={keyword}
                            onChange={setKeyword}
                            className="w-full md:max-w-sm"
                        />
                    </div>
                    <p className="max-w-4xl text-body-lg text-body">{getDoctorsPageIntro()}</p>
                </div>

                {doctors.length > 0 ? (
                    <>
                        <ul ref={listRef} aria-label={TEXT.LIST_LABEL} className="flex scroll-mt-24 flex-col gap-8">
                            {doctors.map((doctor) => (
                                <li key={doctor.id}>
                                    <DoctorIntro
                                        doctor={doctor}
                                        headingLevel={2}
                                        showMore={false}
                                        live={false}
                                        onOpenCertificate={(index) => setViewer({ doctor, index })}
                                    />
                                </li>
                            ))}
                        </ul>
                        {totalPages > 1 && (
                            <div className="flex justify-center">
                                <Pagination page={page} totalPages={totalPages} onChange={changePage} label={TEXT.PAGINATION_LABEL} />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="empty-state" role="status">
                        <SearchX className="empty-state-icon" aria-hidden="true" />
                        <p className="empty-state-title">{TEXT.NO_RESULT(keyword.trim())}</p>
                        <button type="button" className="btn btn-secondary mt-4" onClick={() => setKeyword("")}>
                            {TEXT.CLEAR_SEARCH}
                        </button>
                    </div>
                )}
            </section>

            {viewer && (
                <CertificateViewer
                    doctorName={`${viewer.doctor.displayTitle} ${viewer.doctor.fullName}`}
                    images={viewer.doctor.certificateImages}
                    index={viewer.index}
                    onIndexChange={(index) => setViewer((current) => ({ ...current, index }))}
                    onClose={() => setViewer(null)}
                />
            )}
        </div>
    );
};

export default DoctorList;

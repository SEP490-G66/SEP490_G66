import Carousel from "@/components/ui/Carousel";
import ImageCard from "@/components/ui/ImageCard";
import SectionHeading from "@/components/ui/SectionHeading";
import { getMenuServices } from "@/services/dentalService";
import { getServiceDetailRoute } from "@/utils/routes";

const TITLE_ID = "home-services-title";

// Home page: every service shown in the menu (fixed content, see utils/data/publicServices.jsx).
// More than 4 so the carousel arrows have something to scroll on desktop.
const ServicesSection = () => {
    const services = getMenuServices();

    return (
        <section aria-labelledby={TITLE_ID} className="container-public flex flex-col gap-10 py-12 md:py-16">
            <SectionHeading id={TITLE_ID}>Dịch vụ</SectionHeading>
            <Carousel label="Danh sách dịch vụ" previousLabel="Dịch vụ trước" nextLabel="Dịch vụ tiếp theo">
                {services.map((service) => (
                    <ImageCard
                        key={service.slug}
                        imageUrl={service.imageUrl}
                        imageAlt={service.name}
                        title={service.name}
                        description={service.summary}
                        to={getServiceDetailRoute(service.slug)}
                        className="w-full"
                    />
                ))}
            </Carousel>
        </section>
    );
};

export default ServicesSection;

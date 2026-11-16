import { MOCK_HOME_HERO } from "@/utils/data/mockHomeHero";

const TITLE_ID = "home-hero-title";

const HeroSection = () => {
    return (
        <section aria-labelledby={TITLE_ID} className="container-public pt-6 md:pt-8">
            <h1 id={TITLE_ID} className="sr-only">
                {MOCK_HOME_HERO.title}
            </h1>
            {/* Natural ratio so the whole banner shows; width/height reserve the space before it loads */}
            <img
                src={MOCK_HOME_HERO.imageUrl}
                alt={MOCK_HOME_HERO.alt}
                width={MOCK_HOME_HERO.width}
                height={MOCK_HOME_HERO.height}
                fetchPriority="high"
                className="hero-image h-auto w-full"
            />
        </section>
    );
};

export default HeroSection;

import { Link } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { ROUTES } from "@/utils/routes";

// A text block is a paragraph; a block with items is a bullet list (intro text optional).
const Block = ({ block }) => {
    if (typeof block === "string") return <p className="mt-3 text-body-md text-body">{block}</p>;
    return (
        <>
            {block.intro && <p className="mt-3 text-body-md text-body">{block.intro}</p>}
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-6 text-body-md text-body">
                {block.items.map((item) => (
                    <li key={item}>{item}</li>
                ))}
            </ul>
        </>
    );
};

// Shared layout for the privacy policy and terms of use pages: title, last update, numbered sections, links to the other document.
const LegalDocument = ({ title, updatedAt, intro, sections, related }) => (
    <div className="bg-canvas">
        <div className="container-public pb-6 pt-3">
            <Breadcrumb items={[{ label: "Trang chủ", href: ROUTES.HOME }, { label: title }]} />
        </div>
        <article className="container-public max-w-3xl pb-12 md:pb-16">
            <h1 className="text-display-md">{title}</h1>
            <p className="mt-2 text-body-sm text-muted">Cập nhật lần cuối: {updatedAt}</p>
            {intro.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-body-md text-body">
                    {paragraph}
                </p>
            ))}

            {sections.map((section, index) => (
                <section key={section.title} className="mt-10">
                    <h2 className="text-heading-2">
                        {index + 1}. {section.title}
                    </h2>
                    {section.blocks.map((block, blockIndex) => (
                        <Block key={blockIndex} block={block} />
                    ))}
                </section>
            ))}

            {related && (
                <p className="mt-12 border-t border-border pt-6 text-body-md text-body">
                    Xem thêm:{" "}
                    <Link to={related.href} className="font-semibold text-primary hover:underline">
                        {related.label}
                    </Link>
                </p>
            )}
        </article>
    </div>
);

export default LegalDocument;

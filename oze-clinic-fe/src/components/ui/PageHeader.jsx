import { ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import Breadcrumb from "@/components/navigation/Breadcrumb";

// Page title block of the patient pages (Figma "Page header"): optional back button + breadcrumb,
// h1 with an optional status badge, a description line and buttons on the right.
// back: { to, label } — the parent page; its label is also the first breadcrumb item.
const PageHeader = ({ id, title, description, badge, back, crumb, actions, titleRef }) => (
    <div className="mb-6 flex flex-col gap-3">
        {back && (
            <div className="flex items-center gap-3">
                <Link to={back.to} className="btn btn-secondary btn-icon size-8 max-md:size-11" aria-label={`Quay lại ${back.label}`} title={`Quay lại ${back.label}`}>
                    <ChevronLeft className="size-4" aria-hidden="true" />
                </Link>
                <Breadcrumb items={[{ label: back.label, href: back.to }, { label: crumb ?? title }]} />
            </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 id={id} ref={titleRef} tabIndex={titleRef ? -1 : undefined} className="page-title outline-none">
                        {title}
                    </h1>
                    {badge}
                </div>
                {description && <p className="page-description">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    </div>
);

export default PageHeader;

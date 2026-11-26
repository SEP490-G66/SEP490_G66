import { Link } from "react-router-dom";
import { Image as ImageIcon } from "lucide-react";
import { cx } from "@/utils/cx";

const ImageCard = ({ imageUrl, imageAlt, title, description, className, to, imageClassName = "aspect-square", children }) => {
    const body = (
        <>
            <div className={cx("w-full shrink-0 bg-surface-tint", imageClassName)}>
                {imageUrl ? (
                    <img src={imageUrl} alt={imageAlt} loading="lazy" className="size-full object-contain" />
                ) : (
                    <div className="flex size-full items-center justify-center bg-surface-muted">
                        <ImageIcon className="size-8 text-placeholder" aria-hidden="true" />
                    </div>
                )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <h3 className={cx("card-title", to && "transition-colors group-hover:text-primary")}>{title}</h3>
                {description && <p className="line-clamp-3 text-body-sm text-body">{description}</p>}
                {children}
            </div>
        </>
    );

    if (to) {
        return (
            <Link to={to} className={cx("card-public card-hover group flex flex-col overflow-hidden p-0", className)}>
                {body}
            </Link>
        );
    }

    return <article className={cx("card-public flex flex-col overflow-hidden p-0", className)}>{body}</article>;
};

export default ImageCard;

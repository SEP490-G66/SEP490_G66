import { useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Navigate, useNavigationType, useParams } from "react-router-dom";
import ArticleContent from "@/components/article/ArticleContent";
import RecentArticles from "@/components/article/RecentArticles";
import Breadcrumb from "@/components/navigation/Breadcrumb";
import { getArticleBySlug, getRecentArticles } from "@/services/articleService";
import { formatDateShortDash } from "@/utils/format";
import { PUBLIC_ARTICLE_TEXT as TEXT } from "@/utils/messages";
import { ROUTES, getErrorRoute } from "@/utils/routes";

const BREADCRUMB_ITEMS = [{ label: TEXT.HOME, href: ROUTES.HOME }, { label: TEXT.KNOWLEDGE }];

const ArticleDetail = () => {
    const { articleSlug } = useParams();
    const navigationType = useNavigationType();
    const titleRef = useRef(null);
    const article = getArticleBySlug(articleSlug);

    useEffect(() => {
        if (navigationType === "POP") return;
        window.scrollTo(0, 0);
        titleRef.current?.focus({ preventScroll: true });
    }, [articleSlug, navigationType]);

    if (!article) return <Navigate to={getErrorRoute(404)} replace />;

    return (
        <div className="bg-canvas">
            <div className="container-public pb-6 pt-3">
                <Breadcrumb items={BREADCRUMB_ITEMS} />
            </div>

            <div className="container-public grid grid-cols-1 items-start gap-12 pb-12 md:pb-16 lg:grid-cols-3">
                <article className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    <div className="flex flex-col gap-3">
                        <h1
                            ref={titleRef}
                            tabIndex={-1}
                            className="break-words font-heading text-display-md text-ink outline-none md:text-display-lg"
                        >
                            {article.title}
                        </h1>
                        <p className="text-body-md text-muted">
                            {TEXT.PUBLISHED_AT} <time dateTime={article.publishedAt}>{formatDateShortDash(article.publishedAt)}</time>
                        </p>
                    </div>
                    {article.imageUrl ? (
                        <img
                            src={article.imageUrl}
                            alt={article.title}
                            className="aspect-video w-full rounded-2xl bg-surface-tint object-cover shadow-md"
                        />
                    ) : (
                        <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-surface-muted shadow-md">
                            <ImageIcon className="size-12 text-placeholder" aria-hidden="true" />
                        </div>
                    )}
                    <ArticleContent blocks={article.content} />
                </article>

                <RecentArticles articles={getRecentArticles(article.slug)} />
            </div>
        </div>
    );
};

export default ArticleDetail;

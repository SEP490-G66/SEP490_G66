import { Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { PUBLIC_ARTICLE_TEXT as TEXT } from "@/utils/messages";
import { getArticleDetailRoute } from "@/utils/routes";

const TITLE_ID = "recent-articles-title";

const RecentArticles = ({ articles }) => {
    if (articles.length === 0) return null;

    return (
        <aside aria-labelledby={TITLE_ID} className="flex flex-col gap-5">
            <h2 id={TITLE_ID} className="font-heading text-heading-1 text-ink">
                {TEXT.RECENT_TITLE}
            </h2>
            <ul className="flex flex-col gap-4">
                {articles.map((article) => (
                    <li key={article.id}>
                        <Link
                            to={getArticleDetailRoute(article.slug)}
                            className="group flex items-start gap-4 rounded-lg"
                        >
                            <div className="relative aspect-4/3 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                                {article.imageUrl ? (
                                    <img src={article.imageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                                ) : (
                                    <ImageIcon
                                        className="absolute top-1/2 left-1/2 size-6 -translate-1/2 text-placeholder"
                                        aria-hidden="true"
                                    />
                                )}
                            </div>
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="card-title line-clamp-2 transition-colors duration-150 group-hover:text-primary">
                                    {article.title}
                                </span>
                                <time dateTime={article.publishedAt} className="text-body-sm text-muted">
                                    {formatDate(article.publishedAt)}
                                </time>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </aside>
    );
};

export default RecentArticles;

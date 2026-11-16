import { ARTICLE_CATEGORIES, PUBLIC_ARTICLES } from "../utils/data/publicArticles";

const MOCK_DELAY_MS = 300;

const RECENT_LIMIT = 5;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getKnowledgeArticles = async () => {
    await wait(MOCK_DELAY_MS);

    return { success: true, message: null, data: { categories: ARTICLE_CATEGORIES, articles: PUBLIC_ARTICLES }, errors: null };
};

export const getArticleBySlug = (slug) => PUBLIC_ARTICLES.find((article) => article.slug === slug) ?? null;

const byNewest = (first, second) => second.publishedAt.localeCompare(first.publishedAt) || second.id - first.id;

export const getRecentArticles = (excludeSlug, limit = RECENT_LIMIT) =>
    PUBLIC_ARTICLES.filter((article) => article.slug !== excludeSlug)
        .sort(byNewest)
        .slice(0, limit);

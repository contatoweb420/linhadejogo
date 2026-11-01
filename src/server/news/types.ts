export type NewsRelevance = "alta" | "media" | "baixa";

export type NewsItem = {
  id: string;
  url: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceTermsUrl?: string;
  sourceLicenseNote?: string;
  publishedAt: string | null;
  collectedAt: string;
  teams: string[];
  competitions: string[];
  relevance: NewsRelevance;
  confirmed: false;
};

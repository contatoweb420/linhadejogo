import type { ArticleBlock, BlogCategory } from "@/content/articles";
import type { CoverScene } from "@/components/cover";
import type { EditorialImage } from "@/server/images/providers";

export const AGENT_STATUSES = ["rascunho", "em-revisao", "agendado", "publicado", "rejeitado"] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type AgentArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  blocks: ArticleBlock[];
  cover: CoverScene;
  coverImage?: EditorialImage;
  category: BlogCategory;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt?: string;
  publishOn: string;
  seoTitle: string;
  seoDescription: string;
  sources: { name: string; note: string }[];
  status: AgentStatus;
  reason: string;
  kind: "classificacao" | "comparacao";
  subject: string;
};

export type AgentConfig = {
  paused: boolean;
  maxPerWeek: number;
  autoPublish: boolean;
  intervalHours: number;
};

export type RunOrigin = "agenda" | "manual";

export type RunLog = {
  id: string;
  at: string;
  origin: RunOrigin;
  outcome: "rascunho" | "publicado" | "ignorado" | "erro" | "pausa" | "limite" | "espera";
  reason: string;
  articleId?: string;
};

export type StandingRow = {
  position: number;
  teamName: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type StandingFact = {
  competitionName: string;
  competitionCode: string;
  country: string;
  rows: StandingRow[];
};

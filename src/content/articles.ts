import type { CoverScene } from "@/components/cover";
import type { EditorialImage } from "@/server/images/providers";

export const BLOG_CATEGORIES = ["Antevisão dos jogos", "Análise estatística", "Campeonatos", "Notícias"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type ArticleStatus = "publicado" | "rascunho";

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type ArticleSource = {
  name: string;
  note: string;
};

export type Article = {
  title: string;
  slug: string;
  summary: string;
  blocks: ArticleBlock[];
  cover: CoverScene;
  coverImage?: EditorialImage;
  category: BlogCategory;
  author: string;
  publishedAt: string;
  updatedAt: string;
  status: ArticleStatus;
  sources: ArticleSource[];
  example: boolean;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[];
};

const exampleSource: ArticleSource = {
  name: "Redação de exemplo",
  note: "Texto didático escrito para a Linha de Jogo. Não cita um jogo, um resultado nem uma notícia reais.",
};

export const articles: Article[] = [
  {
    title: "Como ler uma estimativa de casa, empate e visita",
    slug: "como-ler-uma-estimativa",
    summary: "Uma percentagem descreve o modelo, não o futuro do jogo. Este texto de exemplo mostra como a ler sem a tratar como certeza.",
    cover: "analise",
    category: "Análise estatística",
    author: "Redação de exemplo",
    publishedAt: "2026-10-12",
    updatedAt: "2026-10-12",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. Não analisa um encontro marcado no calendário e não apresenta números de um jogo real." },
      { type: "h2", text: "Três resultados possíveis" },
      { type: "p", text: "A estimativa 1X2 reparte 100% por vitória da casa, empate e vitória da visita. Se uma opção tem 55%, as outras duas partilham os 45% restantes. Nenhuma delas fica garantida." },
      { type: "h2", text: "O que a percentagem não diz" },
      { type: "ul", items: ["Não diz que a equipa mais provável vai ganhar.", "Não mede a confiança de uma casa de apostas.", "Não substitui a amostra que o modelo usou."] },
      { type: "p", text: "Na Linha de Jogo, a estimativa só aparece quando o modelo tem dados suficientes. Sem essa amostra, a página diz «Não disponível»." },
    ],
  },
  {
    title: "Forma recente: o que os últimos jogos descrevem",
    slug: "forma-recente",
    summary: "A forma recente resume jogos já disputados. Serve de contexto e não entra, por si, na probabilidade do próximo jogo.",
    cover: "forma",
    category: "Antevisão dos jogos",
    author: "Redação de exemplo",
    publishedAt: "2026-10-10",
    updatedAt: "2026-10-10",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. As letras V, E e D são uma convenção de leitura, não a forma de uma equipa concreta." },
      { type: "h2", text: "Uma sequência é descritiva" },
      { type: "p", text: "Ver V V E D significa, do mais recente para trás ou no sentido indicado na página, vitórias, um empate e uma derrota. A ordem tem de estar escrita junto da série. Sem essa indicação, a sequência não se interpreta." },
      { type: "p", text: "Cinco jogos são uma amostra curta. Uma vitória contra um adversário fraco e uma derrota contra um adversário forte não pesam o mesmo, e esta página de exemplo não tenta atribuir esses pesos." },
    ],
  },
  {
    title: "Confrontos diretos e o cuidado com a amostra",
    slug: "confrontos-diretos",
    summary: "Os encontros entre as duas equipas contam o que já aconteceu entre elas. Poucos jogos tornam a leitura frágil.",
    cover: "confronto",
    category: "Análise estatística",
    author: "Redação de exemplo",
    publishedAt: "2026-10-08",
    updatedAt: "2026-10-08",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. Não lista um histórico real entre dois clubes." },
      { type: "h2", text: "O que um confronto direto mostra" },
      { type: "p", text: "Mostra resultados regulamentares anteriores entre as mesmas equipas, com a data e a competição quando esses dados existem. Prolongamento e penáltis não devem ser lidos como uma vitória no tempo regulamentar." },
      { type: "p", text: "Dois ou três jogos não chegam para concluir um domínio. A página da Linha de Jogo separa os confrontos da estimativa: descrevem o passado e não alteram as percentagens do modelo." },
    ],
  },
  {
    title: "Golos marcados e golos sofridos",
    slug: "golos-marcados-e-sofridos",
    summary: "Marcar muito e sofrer pouco são descrições diferentes. As duas médias precisam da mesma amostra para serem comparadas.",
    cover: "golos",
    category: "Análise estatística",
    author: "Redação de exemplo",
    publishedAt: "2026-10-06",
    updatedAt: "2026-10-06",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. Não atribui médias de golos a nenhuma equipa." },
      { type: "h2", text: "Duas médias, uma amostra" },
      { type: "p", text: "Golos marcados por jogo dizem quantos a equipa fez. Golos sofridos por jogo dizem quantos concedeu. Comparar 2,1 marcados em 30 jogos com 0,8 sofridos em 8 jogos mistura amostras diferentes." },
      { type: "ul", items: ["Confirma o número de jogos da média.", "Separa casa e fora quando a página o indicar.", "Não transformes a média passada na previsão do próximo resultado."] },
    ],
  },
  {
    title: "Porque o tamanho da amostra muda a leitura",
    slug: "tamanho-da-amostra",
    summary: "Uma percentagem sem o número de jogos por trás pode parecer mais sólida do que é. A amostra faz parte do resultado.",
    cover: "analise",
    category: "Notícias",
    author: "Redação de exemplo",
    publishedAt: "2026-10-04",
    updatedAt: "2026-10-04",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. Não comenta uma jornada nem uma decisão de um campeonato." },
      { type: "p", text: "Quatro vitórias em cinco jogos são 80%. Quarenta vitórias em cinquenta também são 80%. A segunda leitura assenta em mais observações. Por isso a Linha de Jogo mostra a amostra ao lado das contas descritivas." },
      { type: "p", text: "Quando a amostra não chega ao mínimo do modelo, a estimativa fica indisponível. Isso é uma ausência de cálculo, não um empate implícito." },
    ],
  },
  {
    title: "O que uma classificação deixa de fora",
    slug: "o-que-uma-classificacao-deixa-de-fora",
    summary: "A tabela ordena pontos. Não explica o calendário que ainda falta nem distingue, por si, o desempenho em casa e fora.",
    cover: "competicao",
    category: "Campeonatos",
    author: "Redação de exemplo",
    publishedAt: "2026-10-02",
    updatedAt: "2026-10-02",
    status: "publicado",
    sources: [exampleSource],
    example: true,
    blocks: [
      { type: "p", text: "Este artigo é de exemplo. Não publica a classificação de nenhuma competição." },
      { type: "h2", text: "Pontos não são o jogo seguinte" },
      { type: "p", text: "Uma equipa pode estar acima de outra e, ainda assim, ter um calendário diferente pela frente. A tabela total também pode não incluir as visões de casa e de fora. Se a origem não enviar essas tabelas, a Linha de Jogo mostra «Não disponível» em vez de as calcular à parte." },
    ],
  },
  {
    title: "Notas internas que não devem aparecer no site",
    slug: "notas-internas",
    summary: "Rascunho de exemplo para confirmar que os textos por publicar ficam fora da lista.",
    cover: "estadio",
    category: "Notícias",
    author: "Redação de exemplo",
    publishedAt: "2026-10-11",
    updatedAt: "2026-10-11",
    status: "rascunho",
    sources: [exampleSource],
    example: true,
    blocks: [{ type: "p", text: "Este rascunho não é um artigo publicado." }],
  },
];

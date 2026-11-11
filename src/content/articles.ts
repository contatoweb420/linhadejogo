import { tempestadeCharlesArticle } from "./tempestade-charles";
import { footballWeekArticles } from "./football-week-20261109";
import type { CoverScene } from "@/components/cover";
import type { ArticleImage } from "@/server/images/providers";

export const BLOG_CATEGORIES = ["Antevisão dos jogos", "Análise estatística", "Campeonatos", "Notícias", "Seleção Portuguesa", "Futebol feminino / Internacional"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
export type ArticleStatus = "publicado" | "rascunho";

export type ArticleBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] };

export type ArticleSource = {
  name: string;
  note: string;
  url?: string;
};

export type Article = {
  title: string;
  slug: string;
  summary: string;
  blocks: ArticleBlock[];
  cover: CoverScene;
  coverImage?: ArticleImage;
  editorialType?: "news";
  category: BlogCategory;
  author: string;
  publishedAt: string;
  updatedAt: string;
  status: ArticleStatus;
  sources: ArticleSource[];
  example: boolean;
  seoTitle?: string;
  seoDescription?: string;
  seoKeyword?: string;
  tags?: string[];
  /** Present only for newsroom articles whose sources were checked. */
  verifiedAt?: string;
  referencePeriod?: { start: string; end: string };
  relatedLinks?: { label: string; href: string }[];
};

const exampleSource: ArticleSource = {
  name: "Redação de exemplo",
  note: "Texto didático escrito para a Linha de Jogo. Não cita um jogo, um resultado nem uma notícia reais.",
};

export const articles: Article[] = [
  tempestadeCharlesArticle,
  ...footballWeekArticles,
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
  {
    title: "Cristiano Ronaldo despede-se de Portugal: chega ao fim uma era histórica",
    slug: "cristiano-ronaldo-despede-se-selecao-portuguesa",
    summary: "Depois de 23 anos ao serviço da Seleção Nacional, Cristiano Ronaldo anunciou que se despedirá de Portugal após a pausa internacional de novembro. À data do anúncio, o capitão soma 234 internacionalizações e 146 golos.",
    cover: "estadio",
    coverImage: {
      provider: "local-ai",
      imageUrl: "/ronaldo-portugal-despedida.png",
      alt: "Ilustração editorial gerada por IA de um futebolista com camisola vermelha inspirada na Seleção Portuguesa, num estádio iluminado.",
      caption: "Ilustração editorial gerada por IA que representa a despedida de Cristiano Ronaldo da Seleção Portuguesa.",
      width: 1672,
      height: 941,
      licenseVerified: false,
    },
    editorialType: "news",
    category: "Seleção Portuguesa",
    tags: ["Cristiano Ronaldo", "Portugal", "Seleção Nacional", "Al Nassr", "Futebol Internacional", "Euro 2016", "Liga das Nações"],
    author: "Redação Linha de Jogo",
    publishedAt: "2026-11-05",
    updatedAt: "2026-11-05",
    status: "publicado",
    example: false,
    seoTitle: "Cristiano Ronaldo anuncia despedida da Seleção Portuguesa | Linha de Jogo",
    seoKeyword: "Cristiano Ronaldo despedida da Seleção Portuguesa",
    seoDescription: "Cristiano Ronaldo anunciou a despedida de Portugal após a pausa internacional de novembro. Soma 234 jogos e 146 golos em 23 anos de seleção.",
    sources: [
      { name: "FIFA", url: "https://www.fifa.com/en/tournaments/mens/worldcup/articles/cristiano-ronaldo-portugal-retirement", note: "Anúncio da despedida, percurso internacional e continuidade no futebol de clubes." },
      { name: "Reuters", url: "https://www.reuters.com/sports/soccer/cristiano-ronaldo-announces-retirement-portuguese-national-team-2026-11-05/", note: "Notícia de 5 de novembro de 2026 sobre o anúncio da saída da seleção." },
      { name: "RTÉ / Reuters", url: "https://www.rte.ie/sport/soccer/2026/1105/1598096-ronaldo-to-retire-from-international-football-this-month/", note: "Cobertura atribuída à Reuters que situa a despedida após a pausa internacional de novembro." },
    ],
    blocks: [
      { type: "p", text: "Há decisões que marcam o futebol para sempre. Esta quinta-feira, 5 de novembro de 2026, Cristiano Ronaldo anunciou que vai terminar a sua carreira internacional pela Seleção Portuguesa após a pausa internacional de novembro, preparando o fim de uma das trajetórias mais marcantes da história do futebol." },
      { type: "p", text: "A decisão foi comunicada pelo próprio jogador através de uma mensagem nas redes sociais, na qual anunciou a intenção de passar a camisola número 7 às próximas gerações." },
      { type: "p", text: "Aos 41 anos, o capitão prepara-se para encerrar um percurso internacional de 23 anos, iniciado em agosto de 2003. Durante este período, tornou-se uma das maiores figuras da história do futebol mundial e um símbolo incontornável da Seleção Nacional." },
      { type: "h2", text: "Uma carreira feita de recordes" },
      { type: "p", text: "À data do anúncio, os números demonstram a dimensão da sua passagem pela equipa das quinas: 234 internacionalizações e 146 golos. Estes são os totais conhecidos no momento do anúncio, e não uma garantia dos números com que terminará a carreira internacional." },
      { type: "ul", items: ["23 anos de carreira internacional, desde agosto de 2003.", "234 internacionalizações por Portugal à data do anúncio.", "146 golos pela Seleção Nacional à data do anúncio.", "Campeão europeu em 2016 e vencedor da Liga das Nações em 2019 e 2025."] },
      { type: "p", text: "Cristiano Ronaldo é, à data do anúncio, o recordista mundial masculino de jogos e golos por uma seleção nacional." },
      { type: "p", text: "Mas o seu legado vai muito além das estatísticas. Foram mais de duas décadas de liderança, golos decisivos, momentos de emoção e uma ligação especial aos adeptos portugueses." },
      { type: "h2", text: "Euro 2016: o momento que mudou a história" },
      { type: "p", text: "Entre os momentos mais importantes da sua carreira internacional está a conquista do Campeonato da Europa de 2016, em França." },
      { type: "p", text: "Apesar de ter saído lesionado durante a final frente à seleção francesa, Ronaldo acompanhou e incentivou os seus companheiros até à conquista do primeiro grande título europeu de Portugal." },
      { type: "p", text: "A esse triunfo juntaram-se as conquistas da Liga das Nações, em 2019 e 2025. Três títulos internacionais que ajudaram a transformar a história do futebol português." },
      { type: "h2", text: "O adeus à Seleção não significa o fim da carreira" },
      { type: "p", text: "Cristiano Ronaldo não anunciou o fim da carreira como futebolista. O avançado continuará a representar o Al Nassr, na Arábia Saudita." },
      { type: "p", text: "O anúncio diz respeito exclusivamente à sua carreira internacional. A despedida está prevista para depois da pausa internacional de novembro; não significa que já tenha terminado a sua participação na Seleção Portuguesa." },
      { type: "h2", text: "Um legado que passa para as próximas gerações" },
      { type: "p", text: "A camisola número 7 ficará para o futuro, mas a história de Cristiano Ronaldo com Portugal permanecerá. Da estreia em 2003 aos títulos internacionais, dos recordes aos momentos de emoção, o capitão ajudou a escrever algumas das páginas mais importantes da história da Seleção." },
      { type: "p", text: "Portugal prepara-se para se despedir de um dos seus maiores símbolos dentro de campo. O futebol português fica com a memória de uma carreira extraordinária e com o desafio de preparar as próximas gerações." },
      { type: "p", text: "A camisola 7 passa para o futuro. O legado fica na história." },
      { type: "p", text: "Linha de Jogo — O futebol para além dos resultados." },
    ],
  },
];

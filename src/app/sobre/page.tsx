import { MODEL_LABEL } from "@/server/model/poisson";

export const metadata = { title: "Sobre", description: "Conheça a metodologia, as fontes e os limites das análises da Linha de Jogo." };

export default function AboutPage() {
  return (
    <article className="max-w-3xl space-y-4 text-sm leading-6">
      <h1 className="font-serif text-4xl">Sobre a Linha de Jogo</h1>
      <p>
        A Linha de Jogo organiza jogos, resultados e estimativas de futebol. A consulta é pública e não pede registo. A primeira origem em direto é o plano gratuito do football-data.org. A chave fica só no servidor. Os resultados de épocas anteriores, quando existem, vêm do OpenFootball, em domínio público (CC0). Esse histórico não substitui o jogo em direto e só se junta a uma equipa quando o nome está identificado de forma explícita.
      </p>
      <p>
        O modelo {MODEL_LABEL} estima os golos de cada equipa a partir da média da competição e da força ofensiva e defensiva, com um ajuste para os resultados com poucos golos. Quando há poucos jogos, as taxas aproximam-se da média da liga. A forma recente e os confrontos diretos aparecem na ficha do jogo, mas não mudam as percentagens desta versão.
      </p>
      <p>
        Quando a origem não envia um dado, a página mostra «Não disponível». Não há jogos, lesões, valores de mercado nem percentagens inventados.
      </p>
      <p>
        As análises são informativas. Um resultado desportivo é incerto. Uma probabilidade não é uma promessa de resultado nem de retorno financeiro.
      </p>
      <h2 className="font-serif text-2xl">Como executar</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Instala os programas Node.js e Docker.</li>
        <li>Na pasta <code>quadrante</code>, copia <code>.env.example</code> para <code>.env.local</code> e cria também o ficheiro <code>.env</code> com a palavra-passe local da base.</li>
        <li>Cria um acesso gratuito em football-data.org e cola o código em <code>FOOTBALL_DATA_API_KEY</code>, dentro do ficheiro <code>.env</code>.</li>
        <li>Executa <code>npm run db:up</code>, <code>npm run db:migrate</code>, <code>npm run import:history</code> e <code>npm run dev</code>.</li>
        <li>Abre o endereço http://localhost:3000 no navegador.</li>
      </ol>
    </article>
  );
}

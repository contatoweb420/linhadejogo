export const metadata = { title: "Privacidade", description: "Leia como a Linha de Jogo trata dados e protege a privacidade de quem visita o site." };

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-4 text-sm leading-6">
      <h1 className="font-serif text-4xl">Privacidade</h1>
      <p>Texto para revisão antes de qualquer lançamento público. Não substitui aconselhamento jurídico.</p>
      <p>
        A consulta dos jogos é pública. Não há conta nem lista de favoritos.
      </p>
      <p>Não há registo de utilizadores, boletim nem venda de dados.</p>
      <p>A chave da origem dos jogos fica apenas no servidor e não é enviada ao navegador.</p>
    </article>
  );
}

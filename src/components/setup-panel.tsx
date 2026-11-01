export function SetupPanel({ database }: { database: boolean }) {
  if (database) return null;
  return (
    <section className="rounded-lg border border-warn bg-card p-5">
      <h2 className="font-serif text-2xl">Base de dados em falta</h2>
      <p className="mt-3 text-sm leading-6">
        Na pasta <code>quadrante</code>, executa <code>npm run db:up</code> e depois <code>npm run db:migrate</code>.
      </p>
    </section>
  );
}

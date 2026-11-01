"use client";

export default function BlogError({ error, reset }: { error: Error; reset: () => void }) {
  void error;
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-4xl">Não foi possível mostrar os artigos</h1>
      <p className="text-sm">Volta a tentar. Se o problema continuar, a lista local não chegou a ser lida.</p>
      <button className="btn" type="button" onClick={() => reset()}>
        Tentar outra vez
      </button>
    </div>
  );
}

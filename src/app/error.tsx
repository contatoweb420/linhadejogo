"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  void error;
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-4xl">Não foi possível mostrar esta página</h1>
      <p className="text-sm">Confirma se a base de dados está a correr e volta a tentar.</p>
      <button className="btn" type="button" onClick={() => reset()}>
        Tentar outra vez
      </button>
    </div>
  );
}

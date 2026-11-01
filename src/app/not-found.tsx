import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-4xl">Página não encontrada</h1>
      <p className="text-sm">Este jogo, equipa ou competição não está na base.</p>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:text-primary-hover hover:underline">
        Voltar aos jogos
      </Link>
    </div>
  );
}

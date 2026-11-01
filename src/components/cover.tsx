export const COVER_SCENES = ["estadio", "analise", "forma", "confronto", "golos", "competicao"] as const;

export type CoverScene = (typeof COVER_SCENES)[number];

export function isCoverScene(value: string): value is CoverScene {
  return COVER_SCENES.some((scene) => scene === value);
}

export function Cover({ scene, label }: { scene: string; label: string }) {
  return (
    <div className="cover-plate relative aspect-[16/9] overflow-hidden" role="img" aria-label={label}>
      {isCoverScene(scene) ? <Scene scene={scene} /> : <Fallback label={label} />}
    </div>
  );
}

function Fallback({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center bg-raised px-4 text-center">
      <span className="font-serif text-2xl text-foreground">{label.slice(0, 1).toLocaleUpperCase("pt-PT")}</span>
    </div>
  );
}

function Scene({ scene }: { scene: CoverScene }) {
  return (
    <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden="true">
      <rect width="320" height="180" fill="var(--border)" />
      {scene === "estadio" ? <Stadium /> : null}
      {scene === "analise" ? <Analysis /> : null}
      {scene === "forma" ? <FormScene /> : null}
      {scene === "confronto" ? <Versus /> : null}
      {scene === "golos" ? <Goal /> : null}
      {scene === "competicao" ? <Trophy /> : null}
    </svg>
  );
}

function Stadium() {
  return (
    <>
      <path d="M24 132h272" stroke="currentColor" strokeWidth="3" />
      <path d="M48 132V78h224v54" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M48 96h224M160 78v54M88 78v54M232 78v54" stroke="currentColor" strokeWidth="1.5" opacity="0.7" />
      <circle cx="160" cy="114" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
    </>
  );
}

function Analysis() {
  return (
    <>
      <path d="M48 146h224" stroke="currentColor" strokeWidth="2" />
      <rect x="68" y="96" width="28" height="50" fill="currentColor" opacity="0.45" />
      <rect x="112" y="68" width="28" height="78" fill="currentColor" />
      <rect x="156" y="84" width="28" height="62" fill="currentColor" opacity="0.7" />
      <rect x="200" y="52" width="28" height="94" fill="currentColor" opacity="0.85" />
    </>
  );
}

function FormScene() {
  return (
    <>
      <circle cx="56" cy="90" r="16" fill="currentColor" />
      <circle cx="112" cy="90" r="16" fill="currentColor" opacity="0.75" />
      <circle cx="168" cy="90" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="224" cy="90" r="16" fill="currentColor" opacity="0.45" />
      <circle cx="280" cy="90" r="16" fill="currentColor" />
    </>
  );
}

function Versus() {
  return (
    <>
      <path d="M78 48h52l18 18v66H78z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M190 48h52l18 18v66h-70z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="3" />
    </>
  );
}

function Goal() {
  return (
    <>
      <path d="M70 48h180v84H70z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M70 48v84M250 48v84M70 48h180" stroke="currentColor" strokeWidth="3" />
      <path d="M100 48v84M160 48v84M220 48v84M70 76h180M70 104h180" stroke="currentColor" strokeWidth="1.2" opacity="0.65" />
    </>
  );
}

function Trophy() {
  return (
    <>
      <path d="M118 42h84v46a42 42 0 0 1-84 0z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M118 58H86v16a32 32 0 0 0 32 32M202 58h32v16a32 32 0 0 1-32 32" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M160 130v18M132 156h56" stroke="currentColor" strokeWidth="3" />
    </>
  );
}

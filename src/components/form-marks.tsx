const labels = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
} as const;

const tones = {
  V: "border-good text-good",
  E: "border-line text-muted",
  D: "border-bad text-bad",
} as const;

export function FormMarks({ marks, nowrap = false }: { marks: Array<"V" | "E" | "D">; nowrap?: boolean }) {
  if (marks.length === 0) return <span className="whitespace-nowrap">Não disponível</span>;

  return (
    <span className={`inline-flex gap-1 align-middle ${nowrap ? "flex-nowrap" : "flex-wrap"}`}>
      {marks.map((mark, index) => (
        <abbr
          key={`${mark}-${index}`}
          title={labels[mark]}
          className={`form-mark grid h-6 w-6 place-items-center rounded-md border text-xs font-semibold no-underline ${tones[mark]}`}
          style={{ animationDelay: `${index * 45}ms` }}
        >
          {mark}
        </abbr>
      ))}
    </span>
  );
}

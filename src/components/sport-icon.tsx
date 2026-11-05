export type IconName = "home" | "calendar" | "chart" | "trophy" | "teams" | "bars" | "info" | "more" | "collapse" | "expand" | "premium" | "news" | "feed";

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {name === "home" ? <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /> : null}
      {name === "calendar" ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="1" />
          <path d="M8 3.5V7M16 3.5V7M4 10h16" />
        </>
      ) : null}
      {name === "chart" ? <path d="M4 19h16M7 16V10M12 16V6M17 16v-4" /> : null}
      {name === "trophy" ? <path d="M8 4h8v6a4 4 0 0 1-8 0zM8 6H5v2a3 3 0 0 0 3 3M16 6h3v2a3 3 0 0 1-3 3M12 14v3M9 20h6" /> : null}
      {name === "teams" ? (
        <>
          <circle cx="9" cy="8" r="2.5" />
          <circle cx="16" cy="9" r="2" />
          <path d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 6.5-1.8" />
        </>
      ) : null}
      {name === "bars" ? <path d="M5 19V11M12 19V5M19 19v-7" /> : null}
      {name === "info" ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 11v5M12 8h.01" />
        </>
      ) : null}
      {name === "more" ? (
        <>
          <circle cx="6" cy="12" r="1" fill="currentColor" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
          <circle cx="18" cy="12" r="1" fill="currentColor" />
        </>
      ) : null}
      {name === "collapse" ? <path d="M15 6 9 12l6 6" /> : null}
      {name === "expand" ? <path d="m9 6 6 6-6 6" /> : null}
      {name === "premium" ? <path d="M12 3.5 19 7v5c0 4.2-2.8 6.8-7 8.5-4.2-1.7-7-4.3-7-8.5V7z" /> : null}
      {name === "feed" ? <path d="M5 18a2 2 0 1 0 0.01 0M5 12a7 7 0 0 1 7 7M5 6a13 13 0 0 1 13 13" /> : null}
      {name === "news" ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="1" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : null}
    </svg>
  );
}

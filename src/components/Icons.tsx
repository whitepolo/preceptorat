export function Icon({ name }: { name: "home" | "cards" | "chat" | "path" | "books" | "settings" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {name === "home" ? (
        <>
          <path {...common} d="M4 10.5 12 4l8 6.5" />
          <path {...common} d="M6.5 9.8V20h11V9.8" />
        </>
      ) : null}
      {name === "cards" ? (
        <>
          <rect {...common} x="3.5" y="5" width="12" height="15" rx="2" />
          <path {...common} d="M8.5 4h10a2 2 0 0 1 2 2v12" />
        </>
      ) : null}
      {name === "chat" ? (
        <path {...common} d="M5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 16.5H9l-4 3v-3H5A1.5 1.5 0 0 1 3.5 15V8A1.5 1.5 0 0 1 5 6.5Z" />
      ) : null}
      {name === "path" ? (
        <>
          <circle {...common} cx="6" cy="6" r="2" />
          <circle {...common} cx="17" cy="12" r="2" />
          <circle {...common} cx="8" cy="18" r="2" />
          <path {...common} d="M8 7.2c3 1 7 2.2 7.2 4.2M15.2 13.6c-2.2 1.2-4.6 2.6-5.4 3.2" />
        </>
      ) : null}
      {name === "books" ? (
        <>
          <path {...common} d="M5 5.5h5.5A2.5 2.5 0 0 1 13 8v11H7.2A2.2 2.2 0 0 0 5 21.2Z" />
          <path {...common} d="M19 5.5h-5.5A2.5 2.5 0 0 0 11 8v11h5.8A2.2 2.2 0 0 1 19 21.2Z" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <path {...common} d="M4 7h16M4 12h16M4 17h16" />
          <circle {...common} cx="8" cy="7" r="2.1" />
          <circle {...common} cx="15" cy="12" r="2.1" />
          <circle {...common} cx="10" cy="17" r="2.1" />
        </>
      ) : null}
    </svg>
  );
}

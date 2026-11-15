export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-lg"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(150deg, color-mix(in srgb, var(--primary) 90%, transparent), color-mix(in srgb, var(--accent) 85%, transparent))",
        boxShadow: "0 6px 18px -8px color-mix(in srgb, var(--primary) 80%, transparent)",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        stroke="#04060d"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 5l7 7-7 7" />
        <path d="M14 19h5" />
      </svg>
    </span>
  );
}

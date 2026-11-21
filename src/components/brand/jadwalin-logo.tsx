interface JadwalinLogoProps {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<JadwalinLogoProps["size"]>, string> = {
  sm: "h-10 w-10 p-1 rounded-[10px]",
  md: "h-12 w-12 p-1.5 rounded-xl",
  lg: "h-16 w-16 p-2 rounded-2xl",
};

/**
 * Logo resmi Jadwalin ("07 · The Overlap Calendar") dalam bentuk pure symbol.
 */
export function JadwalinLogo({
  size = "sm",
  showWordmark = false,
  className = "",
}: JadwalinLogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center border-2 border-border-ink bg-surface-card shadow-[2px_2px_0_var(--border-ink)] ${SIZE_CLASSES[size]}`}
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
        >
          <rect
            x="10"
            y="5"
            width="25"
            height="26"
            rx="5.5"
            fill="#FDE68A"
            stroke="#231F1B"
            strokeWidth="2"
          />
          <rect
            x="5"
            y="10"
            width="25"
            height="25"
            rx="5.5"
            fill="#FFFFFF"
            stroke="#231F1B"
            strokeWidth="2"
          />
          <path
            d="M5 15.5C5 12.4624 7.46243 10 10.5 10H24.5C27.5376 10 30 12.4624 30 15.5V17.5H5V15.5Z"
            fill="#4F46E5"
            stroke="#231F1B"
            strokeWidth="2"
          />
          <path d="M12.5 7.5V12.5" stroke="#231F1B" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M22.5 7.5V12.5" stroke="#231F1B" strokeWidth="2.4" strokeLinecap="round" />
          <rect x="9" y="21.5" width="6" height="4.5" rx="1.5" fill="#F59E0B" />
          <rect x="9" y="27.5" width="6" height="4" rx="1.5" fill="#CBD5E1" />
          <rect
            x="17"
            y="21.5"
            width="9.5"
            height="10"
            rx="2.5"
            fill="#10B981"
            stroke="#231F1B"
            strokeWidth="1.6"
          />
          <path
            d="M19.5 26.5L21.2 28.2L24.5 24.5"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight text-text-primary">Jadwalin</span>
        </span>
      ) : null}
    </span>
  );
}

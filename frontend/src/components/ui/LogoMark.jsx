import { useId } from "react";

/** FluxGrid mark: a rounded hexagon (grid node) holding a flowing load curve that flattens a peak. */
export default function LogoMark({ className = "h-9 w-9" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6d5dfc" />
          <stop offset="0.55" stopColor="#465fff" />
          <stop offset="1" stopColor="#12c2e9" />
        </linearGradient>
        <linearGradient id={`${id}-line`} x1="10" y1="0" x2="38" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
      </defs>
      <path d="M24 2.5 42.5 13v22L24 45.5 5.5 35V13z" fill={`url(#${id}-bg)`} stroke="#fff" strokeOpacity="0.25" strokeWidth="1" strokeLinejoin="round" />
      <path d="M11 29c4 0 4-9 8-9s3.5 11 7 11 3-15 6-15 3 8 5 8" fill="none" stroke={`url(#${id}-line)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="37" cy="24" r="2.6" fill="#fff" />
    </svg>
  );
}

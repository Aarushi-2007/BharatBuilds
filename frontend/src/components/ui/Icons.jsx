// Small inline SVG icons (no icon library needed)
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
const I = ({ d, className = "h-5 w-5", children }) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden="true">{d ? <path d={d} /> : children}</svg>
);
export const IconBolt = (p) => <I {...p} d="M13 2 4 14h7l-1 8 9-12h-7z" />;
export const IconGrid = (p) => (<I {...p}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></I>);
export const IconShuffle = (p) => <I {...p} d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />;
export const IconHome = (p) => <I {...p} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />;
export const IconLogout = (p) => <I {...p} d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />;
export const IconMenu = (p) => <I {...p} d="M4 6h16M4 12h10M4 18h16" />;
export const IconMoon = (p) => <I {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
export const IconSun = (p) => (<I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>);
export const IconCalendar = (p) => (<I {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></I>);
export const IconThermo = (p) => <I {...p} d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z" />;
export const IconAlert = (p) => <I {...p} d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />;
export const IconCheck = (p) => <I {...p} d="M20 6 9 17l-5-5" />;
export const IconClock = (p) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>);
export const IconArrowRight = (p) => <I {...p} d="M5 12h14M13 6l6 6-6 6" />;
export const IconTrendDown = (p) => <I {...p} d="M22 17l-8.5-8.5-5 5L2 7M16 17h6v-6" />;
export const IconChevron = (p) => <I {...p} d="m6 9 6 6 6-6" />;
export const IconInfo = (p) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></I>);
export const IconDatabase = (p) => (<I {...p}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></I>);
export const IconRefresh = (p) => <I {...p} d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />;
export const IconUpload = (p) => <I {...p} d="M12 16V4M7 9l5-5 5 5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />;
export const IconEnergy = (p) => (<I {...p}><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 11v2M11 9l-2 3h4l-2 3" /></I>);

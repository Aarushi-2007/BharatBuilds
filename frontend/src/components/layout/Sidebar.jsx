import { NavLink } from "react-router-dom";
import { IconDatabase, IconGrid, IconHome, IconLogout, IconShuffle } from "../ui/Icons.jsx";
import LogoMark from "../ui/LogoMark.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: IconGrid, hint: "Forecast & peak risk" },
  { to: "/optimization", label: "Optimization", icon: IconShuffle, hint: "Load-shifting plan" },
  { to: "/data", label: "Data", icon: IconDatabase, hint: "Live data & accuracy" },
];

export function Logo({ compact = false, light = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="h-10 w-10 drop-shadow-sm" />
      {!compact && (
        <span className="leading-none">
          <span className={`block text-xl font-bold tracking-tight ${light ? "text-white" : "text-ink dark:text-white"}`}>
            Flux<span className="bg-gradient-to-r from-brand-500 to-cyan-400 bg-clip-text text-transparent">Grid</span>
          </span>
          <span className={`mt-1 block text-[10px] font-medium uppercase tracking-[0.14em] ${light ? "text-brand-200" : "text-ink-faint"}`}>
            Smarter energy
          </span>
        </span>
      )}
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const link = ({ isActive }) =>
    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300"
        : "text-ink-soft hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-night-700"
    }`;

  return (
    <>
      {/* dark overlay on mobile */}
      <div onClick={onClose}
           className={`fixed inset-0 z-30 bg-black/40 transition lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-gray-200 bg-white px-5 transition-transform dark:border-night-700 dark:bg-night-800 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[76px] items-center"><Logo /></div>

        <p className="mb-3 mt-4 text-xs font-medium uppercase tracking-wider text-ink-faint">Menu</p>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={link} onClick={onClose}>
              <Icon className="h-5 w-5" /> {label}
            </NavLink>
          ))}
        </nav>

        <p className="mb-3 mt-8 text-xs font-medium uppercase tracking-wider text-ink-faint">Other</p>
        <nav className="flex flex-col gap-1">
          <NavLink to="/" className={link}><IconHome className="h-5 w-5" /> About FluxGrid</NavLink>
          <button onClick={logout} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-soft transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-night-700">
            <IconLogout className="h-5 w-5" /> Log out
          </button>
        </nav>

        <div className="mt-auto mb-6 rounded-2xl bg-brand-25 p-4 text-sm dark:bg-night-700">
          <p className="font-semibold text-ink dark:text-white">Live + replay</p>
          <p className="mt-1 text-ink-muted dark:text-gray-400">
            Today and future dates are live forecasts. Past dates replay history so you can check accuracy.
          </p>
        </div>
      </aside>
    </>
  );
}

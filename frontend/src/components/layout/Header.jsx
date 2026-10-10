import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useTheme } from "../../context/ThemeContext.jsx";
import { IconChevron, IconLogout, IconMenu, IconMoon, IconSun } from "../ui/Icons.jsx";

export default function Header({ onMenu }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const initials = (user?.name || user?.email || "?").split(/[\s@.]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");

  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur dark:border-night-700 dark:bg-night-800/90 md:px-6">
      <button onClick={onMenu} aria-label="Open menu"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 text-ink-muted hover:bg-gray-100 dark:border-night-600 dark:text-gray-400 dark:hover:bg-night-700 lg:hidden">
        <IconMenu />
      </button>
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-sm font-medium text-ink dark:text-white">All-India Grid · Peak-Demand Management</p>
        <p className="truncate text-xs text-ink-muted dark:text-gray-400">{user?.organization || "Grid Authority"}</p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button onClick={toggle} aria-label="Toggle dark mode"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-ink-muted hover:bg-gray-100 dark:border-night-600 dark:text-gray-400 dark:hover:bg-night-700">
          {dark ? <IconSun /> : <IconMoon />}
        </button>

        <div className="relative" ref={ref}>
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">{initials}</span>
            <span className="hidden text-left md:block">
              <span className="block text-sm font-medium text-ink dark:text-white">{user?.name || user?.email}</span>
              <span className="block text-xs capitalize text-ink-muted dark:text-gray-400">{user?.role}</span>
            </span>
            <IconChevron className={`h-4 w-4 text-ink-muted transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <div className="absolute right-0 mt-3 w-60 rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-night-700 dark:bg-night-800">
              <p className="px-2 text-sm font-medium text-ink dark:text-white">{user?.name}</p>
              <p className="truncate px-2 text-xs text-ink-muted dark:text-gray-400">{user?.email}</p>
              <hr className="my-3 border-gray-200 dark:border-night-700" />
              <button onClick={logout}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-ink-soft hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-night-700">
                <IconLogout className="h-5 w-5" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

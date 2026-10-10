import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Header from "./Header.jsx";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-[270px]">
        <Header onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1440px] p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

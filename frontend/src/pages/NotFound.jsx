import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-brand-500">404</p>
      <p className="text-ink-muted dark:text-gray-400">This page doesn't exist.</p>
      <Link to="/" className="btn-primary">Go home</Link>
    </div>
  );
}

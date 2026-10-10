import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";

// The selected date lives in the URL (?date=...), so Dashboard and Optimization share it.
// Data status (available dates, default date) comes from the backend.
export function useSelectedDate() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);

  const reloadStatus = useCallback(() => api.dataStatus()
    .then((s) => { setStatus(s); setStatusError(null); })
    .catch((e) => setStatusError(e.status === 404
      ? "The backend is an older version without /data/status. Update the backend folder and restart it."
      : e.message)), []);
  useEffect(() => { reloadStatus(); }, [reloadStatus]);

  const date = params.get("date") || status?.default_date || null;
  const setDate = (d) => setParams((p) => { const n = new URLSearchParams(p); n.set("date", d); return n; }, { replace: true });
  return { date, setDate, status, statusError, reloadStatus };
}

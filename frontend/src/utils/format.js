export const fmtMW = (v) => (v == null ? "—" : `${Math.round(v).toLocaleString("en-IN")} MW`);
export const fmtGW = (v, d = 1) => (v == null ? "—" : `${(v / 1000).toFixed(d)} GW`);
export const fmtNum = (v, d = 0) => (v == null ? "—" : Number(v).toLocaleString("en-IN", { maximumFractionDigits: d }));
export const fmtMWh = (v) => {
  if (v == null) return "—";
  return v >= 1000 ? `${(v / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} GWh` : `${Math.round(v)} MWh`;
};
export const fmtDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
export const fmtShortDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

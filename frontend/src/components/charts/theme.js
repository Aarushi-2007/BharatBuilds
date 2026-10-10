import { useTheme } from "../../context/ThemeContext.jsx";

// One place for chart colours (light + dark)
export const SERIES = {
  forecast: "#465fff",   // brand blue
  elevated: "#f5a50b",   // amber  (status: warning)
  peak: "#d03b3b",       // red    (status: critical)
  optimized: "#12a873",  // green-aqua
  orange: "#eb6834",
  limit: "#d03b3b",
  warning: "#f5a50b",
};

export function useChartTheme() {
  const { dark } = useTheme();
  return {
    dark,
    grid: dark ? "#273244" : "#eaecf0",
    axis: dark ? "#98a2b3" : "#667085",
    ink: dark ? "#e4e7ec" : "#101828",
    cursor: dark ? "rgba(255,255,255,0.05)" : "rgba(70,95,255,0.06)",
  };
}

export const riskColor = (risk) => (risk === "PEAK RISK" ? SERIES.peak : risk === "ELEVATED" ? SERIES.elevated : SERIES.forecast);
export function niceTicks(lo, hi) {
  const step = hi - lo > 30 ? 10 : 5;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}
export const gw = (v) => (v == null ? null : +(v / 1000).toFixed(2));

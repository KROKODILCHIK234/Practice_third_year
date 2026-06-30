"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { InfoTip, ScopeChip } from "@/components/InfoTip";

interface VegRow {
  year: number;
  [key: string]: number;
}

interface Props {
  data: VegRow[];
  period: "all" | "before" | "after";
  loading: boolean;
  fireYear?: number;
  scope?: string;
  scopeActive?: boolean;
}

const VEG_COLORS: Record<string, string> = {
  "Вечнозелёные хвойные леса":                      "#166534",
  "Листопадные хвойные леса":                        "#15803d",
  "Смешанные леса":                                  "#22c55e",
  "Листопадные широколиственные леса":               "#4ade80",
  "Вечнозелёные широколиственные леса":              "#86efac",
  "Открытые кустарники":                             "#a3e635",
  "Закрытые кустарники":                             "#84cc16",
  "Лесистые саванны":                                "#ca8a04",
  "Саванны":                                         "#d97706",
  "Луга и пастбища":                                 "#fbbf24",
  "Пашня":                                           "#fb923c",
  "Мозаика пашни и естественной растительности":     "#f97316",
  "Постоянные водно-болотные угодья":                "#38bdf8",
  "Водные объекты":                                  "#0ea5e9",
  "Городские и застроенные территории":              "#94a3b8",
  "Малопокрытые территории (песок, скалы, почва)":  "#78716c",
  "Постоянный снег и лёд":                           "#cbd5e1",
};

const SHORT: Record<string, string> = {
  "Вечнозелёные хвойные леса":                      "Хв. вечнозел.",
  "Листопадные хвойные леса":                        "Хв. листоп.",
  "Смешанные леса":                                  "Смешанные",
  "Листопадные широколиственные леса":               "Шир. листоп.",
  "Вечнозелёные широколиственные леса":              "Шир. вечнозел.",
  "Открытые кустарники":                             "Куст. откр.",
  "Закрытые кустарники":                             "Куст. закр.",
  "Лесистые саванны":                                "Лес. саванны",
  "Саванны":                                         "Саванны",
  "Луга и пастбища":                                 "Луга",
  "Пашня":                                           "Пашня",
  "Мозаика пашни и естественной растительности":     "Мозаика",
  "Постоянные водно-болотные угодья":                "Болота",
  "Водные объекты":                                  "Вода",
  "Городские и застроенные территории":              "Город",
  "Малопокрытые территории (песок, скалы, почва)":  "Малопокр.",
  "Постоянный снег и лёд":                           "Снег/лёд",
};

// Custom tooltip — renders above cursor, never clipped
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; fill: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => (p.value ?? 0) > 0);
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 11,
        maxHeight: 220,
        overflowY: "auto",
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
      }}
    >
      <p style={{ color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>
        {label} год
      </p>
      {nonZero.slice().reverse().map((p) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: 2,
              background: VEG_COLORS[p.dataKey] ?? "var(--text-dim)",
              flexShrink: 0,
            }}
          />
          <span style={{ color: "var(--text)" }}>
            {SHORT[p.dataKey] ?? p.dataKey}:
          </span>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>
            {Number(p.value).toFixed(0)} га
          </span>
        </div>
      ))}
    </div>
  );
}

export default function VegAreaChart({ data, period, loading, fireYear, scope, scopeActive }: Props) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-dim text-xs">Загрузка...</p>
      </div>
    );
  }
  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-dim text-xs">Нет данных</p>
      </div>
    );
  }

  const vegKeys = Object.keys(data[0]).filter(
    (k) => k !== "year" && k !== "fire_idx" && data.some((r) => (r[k] ?? 0) > 0)
  );

  const filtered = data.filter((d) => {
    if (!fireYear) return true;
    if (period === "before") return d.year < fireYear;
    if (period === "after")  return d.year >= fireYear;
    return true;
  });

  // Legend reflects the most recent year in view: value per type + share of the
  // total, sorted by area descending so the dominant covers sit on top. The
  // chart keeps its ecological stacking order (vegKeys); only the legend sorts.
  const latest = filtered.length ? filtered[filtered.length - 1] : null;
  const latestYear = latest?.year;
  const latestTotal = latest
    ? vegKeys.reduce((s, k) => s + (latest[k] ?? 0), 0)
    : 0;
  const legendKeys = [...vegKeys].sort(
    (a, b) => (latest?.[b] ?? 0) - (latest?.[a] ?? 0)
  );

  return (
    <div className="flex items-start gap-4 h-full">
      {/* Chart */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-xs font-semibold text-text truncate">Динамика растительного покрова</p>
            <InfoTip text="Площади типов растительного покрова (га) по годам, накопительно. Пунктирная линия — год пожара." />
            {scope && <ScopeChip label={scope} active={scopeActive} />}
          </div>
          <p className="text-[10px] text-text-muted shrink-0">площадь, га</p>
        </div>
        <div className="flex-1 min-h-0 overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              />
              <Tooltip
                content={<CustomTooltip />}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 100, overflow: "visible" }}
              />
              {fireYear && (
                <ReferenceLine x={fireYear} stroke="var(--warning)" strokeDasharray="4 3" strokeWidth={1.5} />
              )}
              {vegKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke="none"
                  fill={VEG_COLORS[key] ?? "var(--text-dim)"}
                  fillOpacity={0.88}
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Legend — vertical right side, sorted by area with values + share */}
      <div className="w-48 shrink-0 flex flex-col h-full pt-1">
        <div className="flex items-baseline justify-between mb-1.5 px-1 shrink-0">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Типы покрова
          </span>
          {latestYear != null && (
            <span className="text-[9px] text-text-dim tabular-nums">{latestYear}</span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-0.5 space-y-px">
          {legendKeys.map((key) => {
            const v = latest?.[key] ?? 0;
            const share = latestTotal > 0 ? (v / latestTotal) * 100 : 0;
            return (
              <div
                key={key}
                title={key}
                className={`group flex items-center gap-2 rounded px-1 py-1 transition-colors hover:bg-surface-hover ${
                  v === 0 ? "opacity-45" : ""
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-[3px] shrink-0 ring-1 ring-black/25"
                  style={{ background: VEG_COLORS[key] ?? "var(--text-dim)" }}
                />
                <span className="text-[10px] text-text-muted leading-tight truncate flex-1 min-w-0 group-hover:text-text">
                  {SHORT[key] ?? key}
                </span>
                <span className="text-[9.5px] text-text-dim tabular-nums shrink-0 text-right leading-tight">
                  {fmtArea(v)}
                  <span className="block text-[8px] text-text-dim/70">{share.toFixed(0)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Compact area formatter: 4720 → "4.7k", 735 → "735". */
function fmtArea(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return v.toFixed(0);
}

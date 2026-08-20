"use client";
import { useState } from "react";
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
  "Лесистые саванны":                                "Редколесье",
  "Саванны":                                         "Разреж. древостой",
  "Луга и пастбища":                                 "Луга",
  "Пашня":                                           "Пашня",
  "Мозаика пашни и естественной растительности":     "Мозаика",
  "Постоянные водно-болотные угодья":                "Болота",
  "Водные объекты":                                  "Вода",
  "Городские и застроенные территории":              "Город",
  "Малопокрытые территории (песок, скалы, почва)":  "Малопокр.",
  "Постоянный снег и лёд":                           "Снег/лёд",
};

// Corrected full names for the classes MODIS labels misleadingly (для Сибири
// "Саванны" — это разреженный древостой, "Лесистые саванны" — редколесье).
// Used for the hover title so the tooltip/legend read correctly.
const FULL_NAME: Record<string, string> = {
  "Саванны": "Разреженный древостой",
  "Лесистые саванны": "Редколесье",
};
const fullName = (key: string) => FULL_NAME[key] ?? key;

// Compact cursor tooltip — only the year + total area. The full per-type
// breakdown is shown in the always-visible legend on the right (which reacts to
// the hovered year), so the floating tooltip stays tiny and never runs off the
// bottom of the chart or needs its own scrollbar.
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { dataKey: string; value: number; fill: string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border-strong)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 11,
        boxShadow: "var(--shadow-lg)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label} год</span>
      <span style={{ color: "var(--text-dim)", margin: "0 6px" }}>·</span>
      <span style={{ color: "var(--text)", fontWeight: 600 }}>
        {Math.round(total).toLocaleString("ru-RU")} га
      </span>
      <div style={{ color: "var(--text-dim)", fontSize: 9, marginTop: 2 }}>
        разбивка по типам — справа →
      </div>
    </div>
  );
}

export default function VegAreaChart({ data, period, loading, fireYear, scope, scopeActive }: Props) {
  // Year the cursor is over; drives the right-side legend so the breakdown lives
  // in a stable panel instead of a cursor-following tooltip that runs off-screen.
  const [hoverYear, setHoverYear] = useState<number | null>(null);

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

  // Legend shows the hovered year (or, when not hovering, the most recent year
  // in view): value per type + share of the total. Sort order stays fixed to the
  // latest year so rows don't jump around while hovering — only values update.
  const latest = filtered.length ? filtered[filtered.length - 1] : null;
  const activeRow = (hoverYear != null && filtered.find((d) => d.year === hoverYear)) || latest;
  const activeYear = activeRow?.year;
  const isHovering = hoverYear != null && activeRow?.year === hoverYear;
  const activeTotal = activeRow
    ? vegKeys.reduce((s, k) => s + (activeRow[k] ?? 0), 0)
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
            <p className="text-xs font-semibold text-text truncate panel-title" style={{ ["--tab" as string]: "#22c55e" }}>Динамика растительного покрова</p>
            <InfoTip text="Площади типов растительного покрова (га) по годам, накопительно. Пунктирная линия — год пожара." />
            {scope && <ScopeChip label={scope} active={scopeActive} />}
          </div>
          <p className="text-[10px] text-text-muted shrink-0">площадь, га</p>
        </div>
        <div className="flex-1 min-h-0 overflow-visible">
          <ResponsiveContainer width="100%" height="100%" minHeight={160} initialDimension={{ width: 320, height: 200 }}>
            <AreaChart
              data={filtered}
              margin={{ top: 4, right: 8, left: -10, bottom: 0 }}
              onMouseMove={(s: { activeLabel?: string | number } | null) => {
                const y = s?.activeLabel != null ? Number(s.activeLabel) : null;
                setHoverYear(Number.isNaN(y as number) ? null : y);
              }}
              onMouseLeave={() => setHoverYear(null)}
            >
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
                allowEscapeViewBox={{ x: false, y: false }}
                position={{ y: 8 }}
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                wrapperStyle={{ zIndex: 100 }}
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

      {/* Legend — vertical right side; reflects the hovered year (fixed panel,
          so the full breakdown is always readable instead of a runaway tooltip). */}
      <div className="w-48 shrink-0 flex flex-col h-full pt-1">
        <div className="flex items-baseline justify-between mb-1.5 px-1 shrink-0">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            Типы покрова
          </span>
          {activeYear != null && (
            <span className={`text-[9px] tabular-nums font-semibold ${isHovering ? "text-accent" : "text-text-dim"}`}>
              {activeYear}{isHovering ? " ●" : ""}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-0.5 space-y-px">
          {legendKeys.map((key) => {
            const v = activeRow?.[key] ?? 0;
            const share = activeTotal > 0 ? (v / activeTotal) * 100 : 0;
            return (
              <div
                key={key}
                title={fullName(key)}
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

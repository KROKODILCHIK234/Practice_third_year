"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ReferenceDot, ResponsiveContainer,
} from "recharts";
import type { AggPoint } from "@/types";
import { InfoTip, ScopeChip } from "@/components/InfoTip";

interface Props {
  data: AggPoint[];
  index: string;
  period: "all" | "before" | "after";
  loading: boolean;
  scope?: string;
  scopeActive?: boolean;
}

const INDEX_COLOR: Record<string, string> = {
  NDVI: "#22c55e", EVI: "#16a34a", NBR: "#f97316",
  NBR2: "#fb923c", BAI: "#ef4444", NDWI: "#38bdf8", SAVI: "#a3e635",
};

export default function VIChart({ data, index, period, loading, scope, scopeActive }: Props) {
  const filtered = data.filter((d) => {
    if (period === "before") return d.years_since_fire < 0;
    if (period === "after")  return d.years_since_fire >= 0;
    return true;
  });

  const preAvg = (() => {
    const pre = data.filter((d) => d.years_since_fire < 0 && d.value !== null);
    return pre.length ? pre.reduce((s, d) => s + (d.value ?? 0), 0) / pre.length : null;
  })();

  const firePoint = data.find((d) => d.years_since_fire === 0);
  const deviation = firePoint?.value != null && preAvg && preAvg !== 0
    ? (((firePoint.value - preAvg) / Math.abs(preAvg)) * 100).toFixed(1)
    : null;

  const color = INDEX_COLOR[index] ?? "#22c55e";
  const minYsf = filtered.length ? Math.min(...filtered.map((d) => d.years_since_fire)) : 0;
  const hasPre = filtered.some((d) => d.years_since_fire < 0);
  const showFireDot = firePoint?.value != null && period !== "before";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-text">Динамика {index}</p>
            <InfoTip text={`Средний ${index} по годам относительно года пожара. Год 0 — год пожара: слева значения до, справа — после. Зона до пожара затенена.`} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {scope && <ScopeChip label={scope} active={scopeActive} />}
            <span className="text-[11px] text-text-muted">лет от пожара (−5 … +20)</span>
          </div>
        </div>
        {deviation !== null && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-md shrink-0 tabular-nums ${
            Number(deviation) < 0
              ? "bg-danger-soft text-danger"
              : "bg-accent-soft text-accent"
          }`}>
            {Number(deviation) > 0 ? "+" : ""}{deviation}% в год пожара
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-dim text-xs">
            Загрузка...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-dim text-xs">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered} margin={{ top: 6, right: 12, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="viFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              {/* Faint shade over the pre-fire years */}
              {hasPre && (
                <ReferenceArea x1={minYsf} x2={0} fill="var(--warning)" fillOpacity={0.05} stroke="none" />
              )}
              <XAxis
                dataKey="years_since_fire"
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                domain={["auto", "auto"]}
              />
              <Tooltip
                cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "var(--shadow-lg)",
                }}
                labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
                itemStyle={{ color }}
                labelFormatter={(v) => `${Number(v) >= 0 ? "+" : ""}${v} лет от пожара`}
                formatter={(v) => [Number(v).toFixed(4), index]}
              />
              {preAvg !== null && (
                <ReferenceLine
                  y={preAvg}
                  stroke="var(--border-strong)"
                  strokeDasharray="2 4"
                  label={{ value: "среднее до", position: "insideTopRight", fill: "var(--text-dim)", fontSize: 9 }}
                />
              )}
              <ReferenceLine
                x={0}
                stroke="var(--warning)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: "пожар", fill: "var(--warning)", fontSize: 9, position: "top" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill="url(#viFill)"
                dot={false}
                activeDot={{ r: 4, fill: color, stroke: "var(--surface-2)", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
              {showFireDot && (
                <ReferenceDot
                  x={0}
                  y={firePoint!.value as number}
                  r={4}
                  fill="var(--warning)"
                  stroke="var(--surface-2)"
                  strokeWidth={1.5}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

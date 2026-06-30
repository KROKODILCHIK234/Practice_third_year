"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer, Cell,
} from "recharts";
import type { AggPoint } from "@/types";
import { InfoTip, ScopeChip } from "@/components/InfoTip";

interface Props {
  data: AggPoint[];
  index: string;
  loading: boolean;
  scope?: string;
  scopeActive?: boolean;
}

export default function SensitivityChart({ data, index, loading, scope, scopeActive }: Props) {
  const preAvg = (() => {
    const pre = data.filter((d) => d.years_since_fire < 0 && d.value !== null);
    return pre.length ? pre.reduce((s, d) => s + (d.value ?? 0), 0) / pre.length : null;
  })();

  const chartData = preAvg !== null
    ? data
        .filter((d) => d.value !== null)
        .map((d) => ({
          ysf: d.years_since_fire,
          dev: preAvg !== 0 ? (((d.value ?? 0) - preAvg) / Math.abs(preAvg)) * 100 : 0,
        }))
    : [];

  const minDev = chartData.length ? Math.min(...chartData.map((d) => d.dev)) : 0;
  const maxDev = chartData.length ? Math.max(...chartData.map((d) => d.dev)) : 0;
  const minYsf = chartData.length ? Math.min(...chartData.map((d) => d.ysf)) : 0;
  const hasPre = chartData.some((d) => d.ysf < 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-text">Чувствительность {index}</p>
            <InfoTip text={`На сколько процентов ${index} в каждом году отклоняется от среднего за годы до пожара. Отрицательные (красные) — растительность пострадала, положительные (зелёные) — превышает допожарный уровень.`} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {scope && <ScopeChip label={scope} active={scopeActive} />}
            <span className="text-[11px] text-text-muted">% от допожарного среднего</span>
          </div>
        </div>
        {chartData.length > 0 && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-text-dim">min / max</p>
              <p className="text-xs font-semibold tabular-nums">
                <span className={minDev < 0 ? "text-danger" : "text-accent"}>
                  {minDev > 0 ? "+" : ""}{minDev.toFixed(1)}%
                </span>
                <span className="text-text-dim mx-1">/</span>
                <span className={maxDev < 0 ? "text-danger" : "text-accent"}>
                  {maxDev > 0 ? "+" : ""}{maxDev.toFixed(1)}%
                </span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-dim text-xs">
            Загрузка...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-dim text-xs">
            Нет данных
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 12, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="sensPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.5} />
                </linearGradient>
                <linearGradient id="sensNeg" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="var(--danger)" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              {hasPre && (
                <ReferenceArea x1={minYsf} x2={0} fill="var(--warning)" fillOpacity={0.05} stroke="none" />
              )}
              <XAxis
                dataKey="ysf"
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-hover)", fillOpacity: 0.4 }}
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "var(--shadow-lg)",
                }}
                labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
                formatter={(v) => [
                  `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`,
                  "Отклонение",
                ]}
                labelFormatter={(v) => `${Number(v) >= 0 ? "+" : ""}${v} лет от пожара`}
              />
              <ReferenceLine y={0} stroke="var(--border-strong)" />
              <ReferenceLine
                x={0}
                stroke="var(--warning)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{ value: "пожар", fill: "var(--warning)", fontSize: 9, position: "top" }}
              />
              <Bar dataKey="dev" radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive={false}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.dev >= 0 ? "url(#sensPos)" : "url(#sensNeg)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

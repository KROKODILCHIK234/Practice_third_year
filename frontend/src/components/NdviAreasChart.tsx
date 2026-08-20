"use client";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api } from "@/lib/api";
import { InfoTip } from "@/components/InfoTip";

interface Props {
  fireYear?: number;
}

// NDVI class → colour, low class (bare/burned) red → high class (dense veg) green.
function classColor(i: number, max: number): string {
  if (i === 0) return "#64748b"; // class 0 = нет данных / вода
  const t = max > 1 ? (i - 1) / (max - 1) : 1;
  const hue = 8 + t * 112; // 8° (red) → 120° (green)
  return `hsl(${hue.toFixed(0)}, 62%, 48%)`;
}

const classNum = (key: string): number => {
  const m = key.match(/^ndvi_class_(\d+)_ha$/);
  return m ? Number(m[1]) : -1;
};

export default function NdviAreasChart({ fireYear }: Props) {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getNdviAreas()
      .then((r) => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  const { data, classKeys, maxClass } = useMemo(() => {
    if (!rows || rows.length === 0) return { data: [], classKeys: [] as string[], maxClass: 0 };
    const keys = Object.keys(rows[0])
      .filter((k) => classNum(k) >= 0)
      .sort((a, b) => classNum(a) - classNum(b));
    const parsed = rows.map((r) => {
      const out: Record<string, number> = { year: Number(r.year) };
      for (const k of keys) out[k] = Number(r[k]) || 0;
      return out;
    }).sort((a, b) => a.year - b.year);
    const max = Math.max(...keys.map(classNum));
    return { data: parsed, classKeys: keys, maxClass: max };
  }, [rows]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-semibold text-text truncate panel-title" style={{ ["--tab" as string]: "#4a9d5b" }}>
            Состояние растительности по территории · классы NDVI
          </p>
          <InfoTip text="Площади (га) по классам NDVI за каждый год по всей территории исследования: от низких классов (гарь, открытая почва) к высоким (густая растительность). Данные dashboard_ndvi_areas.csv." />
        </div>
        <p className="text-[10px] text-text-muted shrink-0">площадь, га</p>
      </div>

      {rows === null ? (
        <div className="flex-1 flex items-center justify-center text-text-dim text-xs">Загрузка…</div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-text-dim text-xs">Нет данных</div>
      ) : (
        <div className="flex-1 flex gap-4 min-h-0">
          <div className="flex-1 min-w-0 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={180} initialDimension={{ width: 320, height: 200 }}>
              <AreaChart data={data} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fill: "var(--text-dim)", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
                <YAxis
                  tick={{ fill: "var(--text-dim)", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)} тыс.` : String(v))}
                />
                <Tooltip
                  contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11, boxShadow: "var(--shadow-lg)" }}
                  labelStyle={{ color: "var(--text-muted)", marginBottom: 4 }}
                  itemStyle={{ padding: 0 }}
                  formatter={(v, name) => [`${Math.round(Number(v)).toLocaleString("ru-RU")} га`, `Класс ${classNum(String(name))}`]}
                  labelFormatter={(l) => `${l} год`}
                />
                {fireYear && (
                  <ReferenceLine x={fireYear} stroke="var(--warning)" strokeDasharray="4 3" strokeWidth={1.5} />
                )}
                {classKeys.map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="1"
                    stroke="none"
                    fill={classColor(classNum(key), maxClass)}
                    fillOpacity={0.9}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Colourbar legend: low → high NDVI class */}
          <div className="w-32 shrink-0 flex flex-col justify-center gap-2 pt-1">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Класс NDVI</span>
            <div className="h-2.5 rounded-full ring-1 ring-border" style={{ background: "linear-gradient(to right, #d1495b, #e0b64a, #4a9d5b)" }} />
            <div className="flex justify-between text-[9px] text-text-dim">
              <span>ниже</span>
              <span>выше</span>
            </div>
            <p className="text-[9.5px] text-text-dim leading-snug">
              Ниже — гарь / открытая почва, выше — густая растительность.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

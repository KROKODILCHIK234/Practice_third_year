"use client";
import type { FireMeta, AggPoint } from "@/types";

const INDEX_COLOR: Record<string, string> = {
  NDVI: "#22c55e", EVI: "#16a34a", NBR: "#f97316",
  NBR2: "#fb923c", BAI: "#ef4444", NDWI: "#38bdf8", SAVI: "#a3e635",
};

interface Props {
  fires: FireMeta[];
  selectedFireIds: Set<string>;
  viData: AggPoint[];
  index: string;
}

/** One metric inside a group: small label on top, prominent value below. */
function Metric({
  label, value, sub, color, align = "left",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={`flex flex-col justify-center min-w-0 ${align === "right" ? "items-end text-right" : ""}`}>
      <p className="text-[9.5px] text-text-dim uppercase tracking-wider whitespace-nowrap leading-none mb-1.5">
        {label}
      </p>
      <p
        className="text-[17px] font-semibold leading-none tabular-nums truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-text-dim mt-1.5 leading-none truncate">{sub}</p>}
    </div>
  );
}

export default function StatsPanel({ fires, selectedFireIds, viData, index }: Props) {
  const active = selectedFireIds.size > 0
    ? fires.filter((f) => selectedFireIds.has(f.fire_id))
    : fires;

  const totalArea = active.reduce((s, f) => s + f.Area, 0);
  const avgArea = active.length > 0 ? totalArea / active.length : 0;

  const pre  = viData.filter((d) => d.years_since_fire < 0 && d.value !== null);
  const post = viData.filter((d) => d.years_since_fire > 0 && d.value !== null);
  const fire = viData.find((d)  => d.years_since_fire === 0);

  const avg = (arr: AggPoint[]) =>
    arr.length ? arr.reduce((s, d) => s + (d.value ?? 0), 0) / arr.length : null;

  const preAvg  = avg(pre);
  const postAvg = avg(post);

  const pct = (a: number | null, b: number | null) =>
    a !== null && b !== null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;

  const fireDevPct  = pct(fire?.value ?? null, preAvg);
  const recoveryPct = pct(postAvg, preAvg);

  const idxColor = INDEX_COLOR[index] ?? "var(--accent)";
  const hasSel = selectedFireIds.size > 0;

  const signed = (n: number, digits = 1) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
  const devColor = (n: number | null) =>
    n === null ? "var(--text)" : n < 0 ? "var(--danger)" : "var(--accent)";

  return (
    <div className="flex items-stretch gap-3 h-[88px]">
      {/* Group: fires */}
      <div className="metric-group flex-1 flex items-center gap-4 pl-4 pr-4" style={{ ["--rail" as string]: "var(--warning)" }}>
        <span className="text-[15px] leading-none select-none" aria-hidden>🔥</span>
        <Metric
          label="Пожаров"
          value={String(active.length)}
          sub={hasSel ? "выбрано" : "всего в базе"}
          color={hasSel ? "var(--warning)" : undefined}
        />
        <div className="w-px self-stretch my-2.5 bg-border" />
        <Metric
          label="Σ площадь"
          value={`${(totalArea / 1000).toFixed(1)}k`}
          sub="тыс. га"
        />
        <Metric
          label="⌀ площадь"
          value={avgArea.toFixed(0)}
          sub="га / гарь"
        />
      </div>

      {/* Group: VI before → after */}
      <div className="metric-group flex-1 flex items-center gap-3.5 pl-4 pr-4" style={{ ["--rail" as string]: idxColor }}>
        <span
          className="text-[10px] font-bold px-1.5 py-1 rounded-md tabular-nums leading-none"
          style={{ color: idxColor, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
        >
          {index}
        </span>
        <Metric label="До пожара" value={preAvg !== null ? preAvg.toFixed(3) : "—"} sub="доп. среднее" />
        <span className="text-text-dim text-sm leading-none" aria-hidden>→</span>
        <Metric
          label="После пожара"
          value={postAvg !== null ? postAvg.toFixed(3) : "—"}
          sub="среднее"
          color={idxColor}
        />
      </div>

      {/* Group: change */}
      <div
        className="metric-group flex-1 flex items-center justify-between gap-4 pl-4 pr-4"
        style={{ ["--rail" as string]: devColor(fireDevPct) }}
      >
        <Metric
          label="В год пожара"
          color={devColor(fireDevPct)}
          value={
            fireDevPct === null ? "—" : (
              <span className="inline-flex items-center gap-1">
                <span className="text-[11px]">{fireDevPct < 0 ? "▼" : "▲"}</span>
                {signed(fireDevPct)}
              </span>
            )
          }
          sub="к допожарному"
        />
        <div className="w-px self-stretch my-2.5 bg-border" />
        <Metric
          label="Восстановление"
          align="right"
          color={recoveryPct === null ? undefined : recoveryPct < -5 ? "var(--danger)" : "var(--accent)"}
          value={recoveryPct === null ? "—" : signed(recoveryPct)}
          sub="до → после"
        />
      </div>
    </div>
  );
}

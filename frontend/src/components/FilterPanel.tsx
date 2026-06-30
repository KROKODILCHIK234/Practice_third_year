"use client";
import { useState } from "react";
import type { FiltersConfig, FireMeta } from "@/types";

const VI_META: Record<string, { short: string; desc: string; color: string }> = {
  NDVI:  { short: "NDVI",  desc: "Вегетационный",         color: "#22c55e" },
  EVI:   { short: "EVI",   desc: "Улучшенный вег.",        color: "#16a34a" },
  NBR:   { short: "NBR",   desc: "Индекс горения",         color: "#f97316" },
  NBR2:  { short: "NBR2",  desc: "Горение v2",             color: "#fb923c" },
  BAI:   { short: "BAI",   desc: "Площадь ожога",          color: "#ef4444" },
  NDWI:  { short: "NDWI",  desc: "Водный стресс",          color: "#38bdf8" },
  SAVI:  { short: "SAVI",  desc: "С попр. на почву",       color: "#a3e635" },
};

interface Props {
  config: FiltersConfig | null;
  fires: FireMeta[];
  selectedFireIds: Set<string>;
  frname: string | null;
  areaMin: number;
  areaMax: number;
  vegType: string | null;
  index: string;
  agg: string;
  period: "all" | "before" | "after";
  onFireToggle: (id: string) => void;
  onFrnameChange: (v: string | null) => void;
  onAreaMinChange: (v: number) => void;
  onAreaMaxChange: (v: number) => void;
  onVegTypeChange: (v: string | null) => void;
  onIndexChange: (v: string) => void;
  onAggChange: (v: string) => void;
  onPeriodChange: (v: "all" | "before" | "after") => void;
  onClearFires: () => void;
  onResetAll: () => void;
}

type SectionId = "index" | "period" | "veg" | "area" | "forest" | "fires";

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <p className="text-[10px] font-semibold tracking-widest text-text-dim uppercase">
        {children}
      </p>
      {count !== undefined && count > 0 && (
        <span className="text-[10px] text-accent tabular-nums font-medium">
          {count}
        </span>
      )}
    </div>
  );
}

function Section({
  id,
  title,
  active,
  defaultOpen = true,
  children,
}: {
  id: SectionId;
  title: string;
  active: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left mb-2 group focus-ring rounded"
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1 h-3 rounded-full transition-colors ${
              active ? "bg-accent" : "bg-text-dim/40"
            }`}
          />
          <span className="text-xs font-semibold text-text uppercase tracking-wider">
            {title}
          </span>
        </span>
        <span
          className={`text-text-dim transition-transform duration-200 text-[10px] ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
      </button>
      {open && <div id={`section-${id}`}>{children}</div>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border my-3" />;
}

function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-surface-2 border border-border text-text rounded-lg pl-3 pr-8 py-2 text-sm hover:border-border-strong focus:outline-none focus:border-accent focus:bg-surface-hover transition-colors focus-ring"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim text-[10px]">
        ▼
      </span>
    </div>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 50,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return; // allow transient empty field while typing
          onChange(Math.max(min, Math.min(max, Number(raw))));
        }}
        className="w-full bg-surface-2 border border-border text-text rounded-lg pl-3 pr-7 py-2 text-sm tabular-nums hover:border-border-strong focus:outline-none focus:border-accent focus:bg-surface-hover transition-colors focus-ring"
      />
      <div className="absolute right-1 top-1 bottom-1 flex flex-col w-5">
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex-1 text-text-dim hover:text-text text-[8px] leading-none rounded-tr focus-ring"
          aria-label="Увеличить"
          tabIndex={-1}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex-1 text-text-dim hover:text-text text-[8px] leading-none rounded-br focus-ring"
          aria-label="Уменьшить"
          tabIndex={-1}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

export default function FilterPanel(props: Props) {
  const {
    config, fires, selectedFireIds, frname, areaMin, areaMax,
    vegType, index, agg, period,
    onFireToggle, onFrnameChange, onAreaMinChange, onAreaMaxChange,
    onVegTypeChange, onIndexChange, onAggChange, onPeriodChange,
    onClearFires, onResetAll,
  } = props;

  const absMin = config?.area.min ?? 0;
  const absMax = config?.area.max ?? 10000;

  // Compute active-filter counts for badges.
  const activeFires = selectedFireIds.size;
  const activeFilters = [
    vegType ? 1 : 0,
    frname ? 1 : 0,
    period !== "all" ? 1 : 0,
    agg !== "median" ? 1 : 0,
    areaMin > absMin || areaMax < absMax ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <aside className="w-[300px] shrink-0 flex flex-col h-full bg-surface border-r border-border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border shrink-0 bg-surface-2/40">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-accent pulse-glow shrink-0" />
            <h1 className="text-sm font-semibold text-text tracking-tight truncate">
              Фильтры
            </h1>
            {activeFilters > 0 && (
              <span className="text-[10px] text-accent bg-accent-soft px-1.5 py-0.5 rounded-full tabular-nums font-medium shrink-0">
                {activeFilters} активных
              </span>
            )}
          </div>
          {activeFilters > 0 && (
            <button
              onClick={onResetAll}
              className="text-[10px] text-text-dim hover:text-danger transition-colors shrink-0 focus-ring rounded px-1"
              title="Сбросить все фильтры"
            >
              сбросить
            </button>
          )}
        </div>
        <p className="text-[11px] text-text-muted pl-4 mt-0.5">
          {fires.length} {pluralize(fires.length, "пожар", "пожара", "пожаров")} в базе
        </p>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">

        {/* Vegetation index */}
        <Section id="index" title="Индекс" active={true}>
          <div className="grid grid-cols-2 gap-1.5">
            {(config?.indices ?? Object.keys(VI_META)).map((idx) => {
              const meta = VI_META[idx];
              const isActive = index === idx;
              return (
                <button
                  key={idx}
                  onClick={() => onIndexChange(idx)}
                  className={`rounded-lg px-2.5 py-2 text-left transition-all border focus-ring ${
                    isActive
                      ? "bg-surface-hover shadow-sm"
                      : "border-border bg-surface-2/50 hover:bg-surface-hover hover:border-border-strong"
                  }`}
                  style={isActive && meta ? {
                    borderColor: `color-mix(in srgb, ${meta.color} 55%, transparent)`,
                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 22%, transparent)`,
                  } : undefined}
                >
                  <span
                    className="block text-sm font-bold mb-0.5 tabular-nums"
                    style={{ color: isActive ? meta?.color : "var(--text-dim)" }}
                  >
                    {idx}
                  </span>
                  <span className="block text-[11px] leading-tight text-text-muted">
                    {meta?.desc ?? ""}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Divider />

        {/* Aggregation */}
        <SectionLabel>Агрегация по пикселям</SectionLabel>
        <div className="flex rounded-lg overflow-hidden border border-border mb-1">
          {["median", "max", "min"].map((a, i) => (
            <button
              key={a}
              onClick={() => onAggChange(a)}
              className={`flex-1 py-2 text-xs font-medium transition-colors focus-ring ${
                i > 0 ? "border-l border-border" : ""
              } ${
                agg === a
                  ? "bg-accent text-white"
                  : "bg-transparent text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-text-dim mb-0">
          median — устойчиво к выбросам
        </p>

        <Divider />

        {/* Period */}
        <Section id="period" title="Период" active={period !== "all"}>
          <div className="flex flex-col gap-1">
            {(["all", "before", "after"] as const).map((p) => {
              const labels = { all: "Весь период", before: "До пожара", after: "После пожара" };
              const icons = { all: "◈", before: "◀", after: "▶" };
              const isActive = period === p;
              return (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all border focus-ring ${
                    isActive
                      ? "border-warning/50 bg-warning-soft text-warning"
                      : "border-transparent text-text-muted hover:bg-surface-hover hover:text-text"
                  }`}
                >
                  <span className="text-[10px] opacity-60">{icons[p]}</span>
                  {labels[p]}
                </button>
              );
            })}
          </div>
        </Section>

        <Divider />

        {/* Vegetation type */}
        <Section id="veg" title="Тип растительности" active={!!vegType}>
          <CustomSelect
            value={vegType ?? ""}
            onChange={(v) => onVegTypeChange(v || null)}
            options={(config?.veg_types ?? []).map((v) => ({ value: v, label: v }))}
            placeholder="Все типы"
          />
        </Section>

        <Divider />

        {/* Area */}
        <Section id="area" title="Площадь гари, га" active={areaMin > absMin || areaMax < absMax}>
          <div className="flex gap-2 items-center mb-1.5">
            <NumberStepper
              value={areaMin}
              onChange={(v) => onAreaMinChange(Math.min(v, areaMax))}
              min={absMin}
              max={absMax}
              step={100}
            />
            <span className="text-text-dim shrink-0">—</span>
            <NumberStepper
              value={areaMax}
              onChange={(v) => onAreaMaxChange(Math.max(v, areaMin))}
              min={absMin}
              max={absMax}
              step={100}
            />
          </div>
          <p className="text-[10px] text-text-dim">
            Диапазон: {absMin.toFixed(0)} – {absMax.toFixed(0)} га
          </p>
        </Section>

        <Divider />

        {/* Forestry */}
        <Section id="forest" title="Лесничество" active={!!frname}>
          <CustomSelect
            value={frname ?? ""}
            onChange={(v) => onFrnameChange(v || null)}
            options={(config?.frnames ?? []).map((f) => ({ value: f, label: f }))}
            placeholder="Все лесничества"
          />
          {config && config.frnames.length <= 1 && (
            <p className="text-[10px] text-text-dim mt-1.5">
              В текущих данных одно лесничество — фильтр не меняет выборку.
            </p>
          )}
        </Section>

        <Divider />

        {/* Selected fires */}
        <Section id="fires" title="Выбранные пожары" active={activeFires > 0} defaultOpen={activeFires > 0}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-text-muted">
              кликните на полигон на карте, чтобы выбрать
            </span>
            {activeFires > 0 && (
              <button
                onClick={onClearFires}
                className="text-[10px] text-text-muted hover:text-danger transition-colors focus-ring rounded px-1"
              >
                сбросить
              </button>
            )}
          </div>

          {activeFires === 0 ? (
            <p className="text-[11px] text-text-dim leading-relaxed">
              Нет выбранных пожаров.
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
              {fires
                .filter((f) => selectedFireIds.has(f.fire_id))
                .map((f) => (
                  <div key={f.fire_id} className="flex items-center justify-between bg-surface-2 rounded-lg px-2.5 py-1.5 border border-border group">
                    <span className="text-xs text-text font-mono tabular-nums">#{f.fire_id}</span>
                    <span className="text-[11px] text-text-muted tabular-nums">{f.Area.toFixed(0)} га</span>
                    <button
                      onClick={() => onFireToggle(f.fire_id)}
                      className="text-text-dim hover:text-danger transition-colors ml-1 text-sm leading-none w-4 h-4 flex items-center justify-center rounded focus-ring"
                      aria-label="Убрать"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <div className="h-4" />
      </div>

      {/* Footer hint */}
      <div className="shrink-0 px-4 py-2.5 border-t border-border bg-surface-2/40 text-[10px] text-text-dim">
        Кликните на полигон на карте — графики обновятся.
      </div>
    </aside>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

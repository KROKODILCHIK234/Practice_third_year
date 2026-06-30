"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, type RasterEntry } from "@/lib/api";

const BANDS = ["NDVI", "EVI", "SAVI", "NBR", "NBR2", "BAI", "NDWI"] as const;
type Band = (typeof BANDS)[number];

// Per-index accent colour mirrors FilterPanel VI_META, so the same index is the
// same colour everywhere (filters, map overlay badge, this gallery).
const BAND_META: Record<Band, { color: string; gradient: string; desc: string; range: string }> = {
  NDVI:  { color: "#22c55e", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "Вегетационный",     range: "−1 … 1" },
  EVI:   { color: "#16a34a", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "Улучшенный вег.",   range: "−1 … 1" },
  SAVI:  { color: "#a3e635", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "С попр. на почву",  range: "−1 … 1" },
  NBR:   { color: "#f97316", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Индекс горения", range: "−1 … 1" },
  NBR2:  { color: "#fb923c", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Горение v2",      range: "−1 … 1" },
  BAI:   { color: "#ef4444", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Площадь ожога",   range: "0 … 100" },
  NDWI:  { color: "#38bdf8", gradient: "linear-gradient(to right, #3a4cc0, #f0f0f0, #b41e1e)", desc: "Водный стресс",     range: "−1 … 1" },
};

const SENSOR_LABEL: Record<string, string> = {
  landsat5: "Landsat-5", landsat57: "Landsat 5/7", sentinel2: "Sentinel-2",
};
const sensorLabel = (s?: string) => (s ? SENSOR_LABEL[s] ?? s : "");

interface Props {
  fireId: string | null;
  /** Fire year (e.g. 2005) — used to decide which rasters are pre/post-fire. */
  fireYear?: number;
}

export default function RasterGallery({ fireId, fireYear = 2005 }: Props) {
  const [entries, setEntries] = useState<RasterEntry[] | null>(null);
  const [activeBand, setActiveBand] = useState<Band>("NDVI");
  const [zoom, setZoom] = useState<{ year: number; band: Band } | null>(null);

  useEffect(() => {
    if (!fireId) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    setEntries(null);
    api.getRasterAvailable(fireId).then((r) => {
      if (!cancelled) setEntries(r);
    }).catch(() => {
      if (!cancelled) setEntries([]);
    });
    return () => { cancelled = true; };
  }, [fireId]);

  // Empty state: no fire selected yet
  if (!fireId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2.5">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent text-xl">
          ▦
        </div>
        <p className="text-sm text-text-muted max-w-xs">
          Выберите один пожар на карте, чтобы посмотреть снимки в цветах вегетационных индексов
        </p>
      </div>
    );
  }

  if (entries === null) {
    return (
      <div className="h-full grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4 p-1 content-start">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[3/2] rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-text-dim">
        Нет растров для этого пожара
      </div>
    );
  }

  // Dedupe by year (one PNG per year); keep a year→sensor map for labels.
  const sensorByYear = new Map<number, string>();
  for (const e of entries) if (!sensorByYear.has(e.year)) sensorByYear.set(e.year, e.sensor);
  const sortedYears = [...sensorByYear.keys()].sort((a, b) => a - b);
  const meta = BAND_META[activeBand];

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 flex items-baseline justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-accent text-base leading-none" aria-hidden>▦</span>
          <div>
            <p className="text-sm font-semibold text-text">Снимки гари в цветах VI</p>
            <p className="text-[11px] text-text-dim">
              Пожар #{fireId} · {sortedYears.length} {plural(sortedYears.length, "снимок", "снимка", "снимков")}
            </p>
          </div>
        </div>
        <span className="text-[11px] text-text-dim">клик по снимку — увеличить</span>
      </div>

      {/* Index tabs — colour-coded per index */}
      <div className="shrink-0 flex flex-wrap gap-2 mb-3.5">
        {BANDS.map((b) => {
          const bm = BAND_META[b];
          const active = activeBand === b;
          return (
            <button
              key={b}
              onClick={() => setActiveBand(b)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors focus-ring tabular-nums"
              style={active ? {
                color: bm.color,
                borderColor: `color-mix(in srgb, ${bm.color} 50%, transparent)`,
                background: `color-mix(in srgb, ${bm.color} 13%, transparent)`,
              } : {
                color: "var(--text-muted)",
                borderColor: "var(--border)",
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Colorbar for active band */}
      <div className="shrink-0 mb-4 max-w-2xl">
        <div className="flex items-center gap-2 text-[11px] mb-1.5">
          <span className="font-medium" style={{ color: meta.color }}>{meta.desc}</span>
          <span className="ml-auto text-text-dim tabular-nums">{meta.range}</span>
        </div>
        <div className="h-2.5 rounded-full ring-1 ring-border" style={{ background: meta.gradient }} />
      </div>

      {/* Thumbnails grid: one tile per year, only the active band visible.
          Larger tiles via auto-fill so each snapshot is comfortably readable. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4 pr-1 pb-1">
          {sortedYears.map((year) => {
            const isFireYear = year === fireYear;
            return (
              <button
                key={year}
                onClick={() => setZoom({ year, band: activeBand })}
                className="raster-tile group relative rounded-xl overflow-hidden border border-border bg-surface-2 focus-ring text-left"
                style={{ ["--ca" as string]: meta.color }}
              >
                <img
                  src={api.rasterUrl(fireId, year, activeBand)}
                  alt={`${activeBand} ${year}`}
                  loading="lazy"
                  className="w-full aspect-[3/2] object-cover bg-bg"
                />
                {isFireYear && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-warning/90 text-[9px] font-bold text-white tracking-wider shadow-sm">
                    ПОЖАР
                  </div>
                )}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-sm text-[9px] font-medium text-white/90 opacity-0 group-hover:opacity-100 transition-opacity">
                  увеличить
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-5 pb-2">
                  <div className="flex items-baseline justify-between gap-1.5">
                    <span className="text-base font-bold text-white tabular-nums">{year}</span>
                    <span className="text-[10px] text-white/65 truncate">{sensorLabel(sensorByYear.get(year))}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom modal — portalled to <body> so it sits above the Leaflet map
          (whose panes/controls reach z-index ~1000) instead of being trapped
          inside the bottom panel's stacking context. */}
      {zoom && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setZoom(null)}
        >
          <div
            className="bg-surface border border-border-strong rounded-2xl shadow-lg max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <span
                  className="text-sm font-bold px-2 py-1 rounded-md tabular-nums"
                  style={{ color: BAND_META[zoom.band].color, background: `color-mix(in srgb, ${BAND_META[zoom.band].color} 14%, transparent)` }}
                >
                  {zoom.band}
                </span>
                <div>
                  <p className="text-base font-semibold text-text leading-tight">{zoom.year} год</p>
                  <p className="text-xs text-text-dim">
                    {BAND_META[zoom.band].desc} · пожар #{fireId}
                    {sensorByYear.get(zoom.year) && <span> · {sensorLabel(sensorByYear.get(zoom.year))}</span>}
                    {zoom.year === fireYear && <span className="ml-1.5 text-warning">· год пожара</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setZoom(null)}
                className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-surface-hover text-text-muted hover:text-text flex items-center justify-center transition-colors focus-ring"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-5 flex flex-col items-center gap-4 bg-bg">
              <img
                src={api.rasterUrl(fireId, zoom.year, zoom.band)}
                alt={`${zoom.band} ${zoom.year}`}
                className="max-w-full max-h-[78vh] object-contain rounded-lg ring-1 ring-border"
              />
              <div className="w-full max-w-md">
                <div className="flex justify-between text-[10px] text-text-dim mb-1">
                  <span>низкие значения</span>
                  <span className="tabular-nums">{BAND_META[zoom.band].range}</span>
                  <span>высокие значения</span>
                </div>
                <div className="h-2.5 rounded-full ring-1 ring-border" style={{ background: BAND_META[zoom.band].gradient }} />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

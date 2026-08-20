"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api, type RasterEntry } from "@/lib/api";

// Per-index metadata: accent colour (mirrors FilterPanel VI_META), colourbar
// gradient, human name, value range, and — crucially — what LOW vs HIGH values
// mean, because indices differ: for NDVI/EVI/SAVI higher = healthier, while for
// NBR/BAI higher = stronger fire damage (teacher's note).
const BAND_META: Record<string, {
  color: string; gradient: string; desc: string; range: string;
  lowLabel: string; highLabel: string;
}> = {
  NDVI: { color: "#22c55e", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "Состояние растительности",            range: "−1 … 1", lowLabel: "повреждённая / гарь", highLabel: "здоровая растительность" },
  EVI:  { color: "#16a34a", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "Состояние густой растительности",      range: "−1 … 1", lowLabel: "разреженная",           highLabel: "густая растительность" },
  SAVI: { color: "#a3e635", gradient: "linear-gradient(to right, #a50026, #fdae61, #1a9850)", desc: "Состояние разреженной растительности", range: "−1 … 1", lowLabel: "почва / гарь",          highLabel: "растительность" },
  NBR:  { color: "#f97316", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Повреждение пожаром",     range: "−1 … 1", lowLabel: "слабое повреждение",   highLabel: "сильное повреждение" },
  NBR2: { color: "#fb923c", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Влажность после пожара",  range: "−1 … 1", lowLabel: "суше",                highLabel: "влажнее" },
  BAI:  { color: "#ef4444", gradient: "linear-gradient(to right, #0a0000, #b02800, #ffe55a, #fff7c8)", desc: "Признаки выгоревшей поверхности", range: "0 … 100", lowLabel: "не выгорело",   highLabel: "сильно выгорело" },
  NDWI: { color: "#38bdf8", gradient: "linear-gradient(to right, #3a4cc0, #f0f0f0, #b41e1e)", desc: "Влагосодержание растений", range: "−1 … 1", lowLabel: "суше",     highLabel: "влагонасыщено" },
};
const metaOf = (b: string) => BAND_META[b] ?? BAND_META.NDVI;

const SENSOR_LABEL: Record<string, string> = {
  landsat5: "Landsat-5", landsat57: "Landsat 5/7", sentinel2: "Sentinel-2",
};
const sensorLabel = (s?: string) => (s ? SENSOR_LABEL[s] ?? s : "");

interface Props {
  fireId: string | null;
  /** Vegetation index chosen in the left filter panel — the gallery follows it
      (no separate index picker here, per the teacher's note). */
  band: string;
  /** Fire year (e.g. 2005) — used to mark the burn-year snapshot. */
  fireYear?: number;
}

export default function RasterGallery({ fireId, band, fireYear = 2005 }: Props) {
  const [entries, setEntries] = useState<RasterEntry[] | null>(null);
  const [zoomYear, setZoomYear] = useState<number | null>(null);

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

  const meta = metaOf(band);

  if (!fireId) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-2.5">
        <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent text-xl">▦</div>
        <p className="text-sm text-text-muted max-w-xs">
          Выберите один пожар на карте, чтобы посмотреть снимки в цветах вегетационных индексов
        </p>
      </div>
    );
  }

  if (entries === null) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[200px] rounded-xl bg-surface-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-text-dim text-center px-6">
        Нет растров для этого пожара. Распакуйте архив со снимками в папку
        <code className="mx-1 text-text-muted">Data/fire_rasters/</code> и перезапустите бэкенд.
      </div>
    );
  }

  // One snapshot per year; keep a year→sensor map for labels.
  const sensorByYear = new Map<number, string>();
  for (const e of entries) if (!sensorByYear.has(e.year)) sensorByYear.set(e.year, e.sensor);
  const sortedYears = [...sensorByYear.keys()].sort((a, b) => a - b);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base font-bold px-2 py-1 rounded-md tabular-nums" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
            {band}
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Снимки гари · {meta.desc}</p>
            <p className="text-[11px] text-text-dim">
              Пожар #{fireId} · {sortedYears.length} {plural(sortedYears.length, "снимок", "снимка", "снимков")} по годам
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sortedYears.length >= 2 && (
            <a
              href={api.rasterGifUrl(fireId, band)}
              download={`fire${fireId}_${band}.gif`}
              className="lift sheen-hover flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border focus-ring"
              style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 50%, transparent)`, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}
              title="Скачать анимацию изменения по годам (GIF)"
            >
              <span aria-hidden>⬇</span> Скачать GIF
            </a>
          )}
          <span className="text-[11px] text-text-dim">клик по снимку — увеличить</span>
        </div>
      </div>

      {/* Colourbar with index-specific meaning of low / high */}
      <div className="shrink-0 mb-4 max-w-2xl">
        <div className="flex items-center justify-between text-[10px] text-text-dim mb-1">
          <span>{meta.lowLabel}</span>
          <span className="tabular-nums">{meta.range}</span>
          <span>{meta.highLabel}</span>
        </div>
        <div className="h-2.5 rounded-full ring-1 ring-border" style={{ background: meta.gradient }} />
      </div>

      {/* Thumbnails — FULL (uncropped) images so adjacent years are comparable. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 pr-1 pb-1">
          {sortedYears.map((year, i) => {
            const isFireYear = year === fireYear;
            return (
              <button
                key={year}
                onClick={() => setZoomYear(year)}
                className="raster-tile rise-in-stagger group relative rounded-xl overflow-hidden border border-border bg-bg focus-ring text-left"
                style={{ ["--ca" as string]: meta.color, ["--d" as string]: `${i * 55}ms` }}
              >
                <div className="w-full h-[190px] flex items-center justify-center p-1.5">
                  <img
                    src={api.rasterUrl(fireId, year, band)}
                    alt={`${band} ${year}`}
                    loading="lazy"
                    className="max-w-full max-h-full object-contain [image-rendering:pixelated]"
                  />
                </div>
                {isFireYear && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-warning/90 text-[9px] font-bold text-white tracking-wider shadow-sm">
                    ПОЖАР
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pt-5 pb-2">
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

      {/* Zoom modal — portalled to <body> so it sits above the Leaflet map. */}
      {zoomYear !== null && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setZoomYear(null)}>
          <div className="bg-surface border border-border-strong rounded-2xl shadow-lg w-[94vw] max-w-[1500px] max-h-[95vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold px-2 py-1 rounded-md tabular-nums" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>
                  {band}
                </span>
                <div>
                  <p className="text-base font-semibold text-text leading-tight">{zoomYear} год</p>
                  <p className="text-xs text-text-dim">
                    {meta.desc} · пожар #{fireId}
                    {sensorByYear.get(zoomYear) && <span> · {sensorLabel(sensorByYear.get(zoomYear))}</span>}
                    {zoomYear === fireYear && <span className="ml-1.5 text-warning">· год пожара</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => setZoomYear(null)} className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-surface-hover text-text-muted hover:text-text flex items-center justify-center transition-colors focus-ring" aria-label="Закрыть">✕</button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-5 flex flex-col items-center gap-4 bg-bg">
              <img src={api.rasterUrl(fireId, zoomYear, band)} alt={`${band} ${zoomYear}`} className="w-full flex-1 min-h-0 object-contain rounded-lg ring-1 ring-border [image-rendering:pixelated]" />
              <div className="w-full max-w-xl">
                <div className="flex justify-between text-[10px] text-text-dim mb-1">
                  <span>{meta.lowLabel}</span>
                  <span className="tabular-nums">{meta.range}</span>
                  <span>{meta.highLabel}</span>
                </div>
                <div className="h-2.5 rounded-full ring-1 ring-border" style={{ background: meta.gradient }} />
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

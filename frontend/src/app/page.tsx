"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import FilterPanel from "@/components/FilterPanel";
import VIChart from "@/components/VIChart";
import VegAreaChart from "@/components/VegAreaChart";
import SensitivityChart from "@/components/SensitivityChart";
import StatsPanel from "@/components/StatsPanel";
import RasterGallery from "@/components/RasterGallery";
import Header from "@/components/Header";
import { api } from "@/lib/api";
import type { AggPoint, FiltersConfig, FireMeta } from "@/types";

const FireMap = dynamic(() => import("@/components/FireMap"), { ssr: false });

type BottomTab = "veg" | "raster";

export default function Dashboard() {
  const [config, setConfig] = useState<FiltersConfig | null>(null);
  const [fires, setFires] = useState<FireMeta[]>([]);
  const [firesGeoJSON, setFiresGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);
  const [lesnGeoJSON, setLesnGeoJSON] = useState<GeoJSON.FeatureCollection | null>(null);

  const [selectedFireIds, setSelectedFireIds] = useState<Set<string>>(new Set());
  const [bottomTab, setBottomTab] = useState<BottomTab>("veg");
  const [apiOk, setApiOk] = useState(true);
  const [frname, setFrname] = useState<string | null>(null);
  const [areaMin, setAreaMin] = useState(0);
  const [areaMax, setAreaMax] = useState(10000);
  const [vegType, setVegType] = useState<string | null>(null);
  const [index, setIndex] = useState("NDVI");
  const [agg, setAgg] = useState("median");
  const [period, setPeriod] = useState<"all" | "before" | "after">("all");

  const [viData, setViData] = useState<AggPoint[]>([]);
  const [vegAreas, setVegAreas] = useState<{ year: number; [k: string]: number }[]>([]);
  const [viLoading, setViLoading] = useState(false);
  const [vegLoading, setVegLoading] = useState(false);

  // This dashboard is entirely client-driven (all data is fetched in effects),
  // so it has no meaningful server render. Gating the UI behind `mounted` makes
  // the server and first client render identical (a loader), which eliminates
  // hydration mismatches from interactive state / Fast-Refresh / extensions.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    api.getFilters().then((cfg) => {
      setConfig(cfg);
      setAreaMin(cfg.area.min);
      setAreaMax(cfg.area.max);
      setApiOk(true);
    }).catch(() => setApiOk(false));
    api.getLesnichestva().then(setLesnGeoJSON).catch(() => setApiOk(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = { frname: frname ?? undefined, area_min: areaMin, area_max: areaMax };
    Promise.all([api.getFires(params), api.getFiresMeta(params)])
      .then(([geo, meta]) => {
        if (cancelled) return;
        setApiOk(true);
        setFiresGeoJSON(geo);
        setFires(meta);
        setSelectedFireIds((prev) => {
          const validIds = new Set(meta.map((f) => f.fire_id));
          return new Set([...prev].filter((id) => validIds.has(id)));
        });
      })
      .catch(() => { if (!cancelled) setApiOk(false); });
    return () => { cancelled = true; };
  }, [frname, areaMin, areaMax]);

  useEffect(() => {
    let cancelled = false;
    setViLoading(true);
    const load =
      selectedFireIds.size > 0
        ? api.getVIMultiFire([...selectedFireIds], index, agg, vegType)
        : api.getVIAggregate(index, agg, vegType);
    load
      .then((d) => { if (!cancelled) setViData(d); })
      .catch(() => { if (!cancelled) { setViData([]); setApiOk(false); } })
      .finally(() => { if (!cancelled) setViLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFireIds, index, agg, vegType]);

  useEffect(() => {
    let cancelled = false;
    setVegLoading(true);
    const load = selectedFireIds.size === 1
      ? api.getVegAreasByFire([...selectedFireIds][0])
      : api.getVegAreasAggregate();
    load
      .then((rows) => { if (!cancelled) setVegAreas(rows.map((r) => ({ ...r, year: Number(r.year) }))); })
      .catch(() => { if (!cancelled) { setVegAreas([]); setApiOk(false); } })
      .finally(() => { if (!cancelled) setVegLoading(false); });
    return () => { cancelled = true; };
  }, [selectedFireIds]);

  const handleFireToggle = useCallback((id: string) => {
    setSelectedFireIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    setFrname(null);
    setVegType(null);
    setAgg("median");
    setPeriod("all");
    setSelectedFireIds(new Set());
    if (config) {
      setAreaMin(config.area.min);
      setAreaMax(config.area.max);
    }
  }, [config]);

  const singleFireId = selectedFireIds.size === 1 ? [...selectedFireIds][0] : null;

  // Real fire year of the single selected fire, parsed from its first-detection
  // date — falls back to 2005 (the only year currently in the dataset) when the
  // metadata isn't loaded yet. Avoids the previous hardcoded-2005 assumption so
  // the structure already works once fires from other years are added.
  const singleFire = singleFireId ? fires.find((f) => f.fire_id === singleFireId) : null;
  const fireYear = singleFire?.dt_first
    ? Number(singleFire.dt_first.slice(0, 4)) || 2005
    : 2005;

  // The raster tab only makes sense for exactly one fire. If the user selects a
  // second fire while on it, fall back to the vegetation tab automatically.
  useEffect(() => {
    if (bottomTab === "raster" && !singleFireId) setBottomTab("veg");
  }, [bottomTab, singleFireId]);

  // Scope labels tell the user which data each panel reflects right now. The VI
  // charts aggregate over the selected set; the veg chart only narrows to a
  // single fire (otherwise it shows the global aggregate), so it has its own.
  const n = selectedFireIds.size;
  const viScope =
    n === 0 ? { label: `Все гари · ${fires.length}`, active: false }
    : n === 1 ? { label: `Пожар #${singleFireId}`, active: true }
    : { label: `Выбрано гарей: ${n}`, active: true };
  const vegScope = singleFireId
    ? { label: `Пожар #${singleFireId}`, active: true }
    : { label: `Все гари · ${fires.length}`, active: false };

  // Server + first client render: identical loader → no hydration mismatch.
  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-3 text-text-dim text-sm">
        <span className="w-6 h-6 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        Загрузка дашборда…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen text-text">
      <Header
        totalFires={fires.length}
        selectedCount={selectedFireIds.size}
        apiOk={apiOk}
        yearRange={config ? `${config.years.min}–${config.years.max}` : undefined}
      />

      {/* min-h forces a usable layout height; on tall screens flex-1 fills the
          viewport, on short screens the page scrolls so the bottom stays reachable. */}
      <div className="flex flex-1 min-h-[1140px]">
      {/* Sidebar */}
      <FilterPanel
        config={config}
        fires={fires}
        selectedFireIds={selectedFireIds}
        frname={frname}
        areaMin={areaMin}
        areaMax={areaMax}
        vegType={vegType}
        index={index}
        agg={agg}
        period={period}
        onFireToggle={handleFireToggle}
        onFrnameChange={setFrname}
        onAreaMinChange={(v) => setAreaMin(Math.min(v, areaMax))}
        onAreaMaxChange={(v) => setAreaMax(Math.max(v, areaMin))}
        onVegTypeChange={setVegType}
        onIndexChange={setIndex}
        onAggChange={setAgg}
        onPeriodChange={setPeriod}
        onClearFires={() => setSelectedFireIds(new Set())}
        onResetAll={handleResetAll}
      />

      {/* Main content — spacious card-based layout */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-clip gap-3 p-3">

        {/* Stats strip */}
        <div className="shrink-0 rise-in">
          <StatsPanel fires={fires} selectedFireIds={selectedFireIds} viData={viData} index={index} />
        </div>

        {/* Centre: map + right charts */}
        <div className="flex-1 flex gap-3 min-h-[480px]">

          {/* Map card */}
          <div className="flex-1 relative min-w-0 rounded-2xl overflow-hidden border border-border shadow-md">
            <FireMap
              firesGeoJSON={firesGeoJSON}
              lesnichestvaGeoJSON={lesnGeoJSON}
              selectedFireIds={selectedFireIds}
              onFireClick={handleFireToggle}
              overlayFireId={singleFireId}
              overlayIndex={index}
              overlayFireYear={fireYear}
            />
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-surface/85 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-text-muted pointer-events-none select-none border border-border shadow-md max-w-[min(90%,420px)]">
              <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
              {selectedFireIds.size === 0
                ? "Кликните на гарь — все графики пересчитаются под неё"
                : "Повторный клик снимает выбор · можно выбрать несколько гарей"}
            </div>
          </div>

          {/* Right charts column — two stacked chart cards */}
          <div className="w-[470px] shrink-0 flex flex-col gap-3 min-h-0">
            <div className="flex-1 min-h-0 px-5 py-4 rounded-2xl border border-border bg-surface/40 shadow-sm flex flex-col">
              <VIChart data={viData} index={index} period={period} loading={viLoading} scope={viScope.label} scopeActive={viScope.active} />
            </div>
            <div className="flex-1 min-h-0 px-5 py-4 rounded-2xl border border-border bg-surface/40 shadow-sm flex flex-col">
              <SensitivityChart data={viData} index={index} loading={viLoading} scope={viScope.label} scopeActive={viScope.active} />
            </div>
          </div>
        </div>

        {/* Bottom: tabbed area card */}
        <div className="h-[520px] shrink-0 rounded-2xl border border-border bg-surface/40 shadow-sm flex flex-col relative z-10">
          {/* Tab header */}
          <div className="shrink-0 flex items-center gap-1 px-4 pt-2.5 pb-1 border-b border-border">
            <button
              onClick={() => setBottomTab("veg")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-ring ${
                bottomTab === "veg"
                  ? "bg-surface-hover text-text"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
            >
              Растительный покров
            </button>
            <button
              onClick={() => setBottomTab("raster")}
              disabled={!singleFireId}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 focus-ring disabled:opacity-40 disabled:cursor-not-allowed ${
                bottomTab === "raster"
                  ? "bg-surface-hover text-text"
                  : "text-text-muted hover:text-text hover:bg-surface-hover"
              }`}
              title={!singleFireId ? "Выберите один пожар, чтобы открыть снимки" : undefined}
            >
              Снимки гари в VI
              {!singleFireId && <span className="text-[9px] text-text-dim">· выберите 1 пожар</span>}
            </button>
            {bottomTab === "raster" && singleFireId && (
              <span className="ml-auto text-[10px] text-text-muted tabular-nums">
                пожар #{singleFireId} · год пожара {fireYear}
              </span>
            )}
          </div>
          <div className="flex-1 min-h-0 px-6 py-4 overflow-hidden">
            {bottomTab === "veg" ? (
              <VegAreaChart data={vegAreas} period={period} loading={vegLoading} fireYear={fireYear} scope={vegScope.label} scopeActive={vegScope.active} />
            ) : (
              <RasterGallery fireId={singleFireId} fireYear={fireYear} />
            )}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}

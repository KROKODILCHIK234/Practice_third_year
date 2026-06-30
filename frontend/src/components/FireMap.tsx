"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { api, type RasterEntry } from "@/lib/api";

interface Props {
  firesGeoJSON: GeoJSON.FeatureCollection | null;
  lesnichestvaGeoJSON: GeoJSON.FeatureCollection | null;
  selectedFireIds: Set<string>;
  onFireClick: (fireId: string) => void;
  /** When exactly one fire is selected, its id — enables the VI map overlay. */
  overlayFireId: string | null;
  /** Vegetation index currently chosen in the filter panel (NDVI/NBR/...). */
  overlayIndex: string;
  /** Real fire year, used to highlight the burn year in the overlay picker. */
  overlayFireYear: number;
}

// Centroid helper — works for Polygon / MultiPolygon without extra deps.
function featureCentroid(feature: GeoJSON.Feature): [number, number] | null {
  const g = feature.geometry;
  if (!g) return null;
  let ring: number[][] | null = null;
  if (g.type === "Polygon") ring = (g.coordinates as number[][][])[0];
  else if (g.type === "MultiPolygon") {
    const mp = g.coordinates as number[][][][];
    let best: number[][] | null = null;
    let bestArea = -1;
    for (const poly of mp) {
      const r = poly[0];
      // shoelace area (cheap, no need for accurate geodesic area)
      let a = 0;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
      }
      if (Math.abs(a) > bestArea) { bestArea = Math.abs(a); best = r; }
    }
    ring = best;
  }
  if (!ring || ring.length === 0) return null;
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sy / ring.length, sx / ring.length]; // [lat, lon] for leaflet
}

const BASE_STYLE = (selected: boolean) => ({
  color: selected ? "#f97316" : "#ef4444",
  weight: selected ? 2 : 1,
  fillColor: selected ? "#fb923c" : "#ef4444",
  fillOpacity: selected ? 0.55 : 0.28,
  dashArray: undefined as string | undefined,
});

const HOVER_STYLE = (selected: boolean) => ({
  color: "#fb923c",
  weight: 2.5,
  fillColor: "#fb923c",
  fillOpacity: selected ? 0.55 : 0.45,
});

export default function FireMap({
  firesGeoJSON,
  lesnichestvaGeoJSON,
  selectedFireIds,
  onFireClick,
  overlayFireId,
  overlayIndex,
  overlayFireYear,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Leaflet.Map | null>(null);
  const firesLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const lesnLayerRef = useRef<Leaflet.GeoJSON | null>(null);
  const overlayLayerRef = useRef<Leaflet.ImageOverlay | null>(null);

  // Init the map exactly once. Cancelled-flag pattern guards against React 19
  // StrictMode double-invoke and HMR remounts.
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      if (mapInstanceRef.current) return;
      const container = mapRef.current as HTMLElement & { _leaflet_id?: number };
      delete container._leaflet_id;

      const map = L.map(container, {
        center: [56.5, 105.0],
        zoom: 5,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(map);
      mapInstanceRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      firesLayerRef.current = null;
      lesnLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, []);

  // Lesnichestva layer
  useEffect(() => {
    if (!lesnichestvaGeoJSON) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (lesnLayerRef.current) {
        lesnLayerRef.current.remove();
        lesnLayerRef.current = null;
      }

      const layer = L.geoJSON(lesnichestvaGeoJSON, {
        style: {
          color: "#94a3b8",
          weight: 1,
          fillOpacity: 0,
          dashArray: "4 4",
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties?.frname) {
            layer.bindTooltip(feature.properties.frname, {
              sticky: true,
              className: "leaflet-tooltip-forest",
              direction: "center",
            });
          }
        },
      }).addTo(map);
      lesnLayerRef.current = layer;
    })();

    return () => {
      cancelled = true;
    };
  }, [lesnichestvaGeoJSON]);

  // Fires layer. Hover is applied via setStyle on the individual layer (cheap),
  // NOT by rebuilding the whole GeoJSON layer — so pointer movement stays smooth.
  useEffect(() => {
    if (!firesGeoJSON) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (firesLayerRef.current) {
        firesLayerRef.current.remove();
        firesLayerRef.current = null;
      }

      const layer = L.geoJSON(firesGeoJSON, {
        style: (feature) => {
          const fid = String(feature?.properties?.fire_id ?? "");
          return BASE_STYLE(selectedFireIds.has(fid));
        },
        onEachFeature: (feature, lyr) => {
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          const fid = String(props.fire_id ?? "");
          const area = Number(props.Area ?? 0).toFixed(0);
          const dt = String(props.dt_first ?? "").slice(0, 10);
          const frname = String(props.frname ?? "");
          lyr.bindTooltip(
            `<div style="font-family: var(--font-sans); font-size: 12px; line-height: 1.5;">` +
              `<div style="font-weight: 600; color: #f97316; margin-bottom: 2px;">Пожар #${fid}</div>` +
              `<div style="color: #e7eaf0;">Площадь: <b>${area}</b> га</div>` +
              (frname ? `<div style="color: #a0a8b8;">${frname}</div>` : "") +
              (dt ? `<div style="color: #6b7384; font-size: 10px;">${dt}</div>` : "") +
              `<div style="color: #6b7384; font-size: 10px; margin-top: 4px;">клик — выбрать</div>` +
            `</div>`,
            { sticky: true, className: "fire-tooltip", direction: "top" }
          );
          const pathLyr = lyr as Leaflet.Path;
          const path = (pathLyr as unknown as { getElement?: () => SVGPathElement | undefined }).getElement?.();
          if (path) {
            path.style.cursor = "pointer";
            path.style.transition = "fill-opacity 120ms ease, stroke-width 120ms ease";
          }
          lyr.on("mouseover", () => pathLyr.setStyle(HOVER_STYLE(selectedFireIds.has(fid))));
          lyr.on("mouseout", () => pathLyr.setStyle(BASE_STYLE(selectedFireIds.has(fid))));
          lyr.on("click", (e) => {
            (e.originalEvent as MouseEvent | undefined)?.stopPropagation?.();
            onFireClick(fid);
          });
        },
      }).addTo(map);
      firesLayerRef.current = layer;
    })();

    return () => {
      cancelled = true;
    };
  }, [firesGeoJSON, selectedFireIds, onFireClick]);

  // -----------------------------------------------------------------------
  // VI raster overlay — places the rendered index PNG on the map at its real
  // geographic bounds (the feature the teacher specifically asked for).
  // -----------------------------------------------------------------------
  const [overlayEntries, setOverlayEntries] = useState<RasterEntry[] | null>(null);
  const [overlayYear, setOverlayYear] = useState<number | null>(null);
  const [overlayOn, setOverlayOn] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.85);

  // Fetch the available rasters whenever the selected fire changes; pick a
  // sensible default year (the fire year if present, otherwise the latest) and
  // fly the map to the fire so the overlay is immediately visible.
  useEffect(() => {
    if (!overlayFireId) {
      setOverlayEntries(null);
      setOverlayYear(null);
      return;
    }
    let cancelled = false;
    setOverlayEntries(null);
    api.getRasterAvailable(overlayFireId)
      .then((entries) => {
        if (cancelled) return;
        const withBounds = entries.filter((e) => e.bounds);
        setOverlayEntries(withBounds);
        const years = withBounds.map((e) => e.year);
        const def = years.includes(overlayFireYear)
          ? overlayFireYear
          : (years.length ? Math.max(...years) : null);
        setOverlayYear(def);
        const first = withBounds.find((e) => e.year === def) ?? withBounds[0];
        if (first?.bounds) {
          const [w, s, e, n] = first.bounds;
          import("leaflet").then((L) => {
            if (cancelled) return;
            mapInstanceRef.current?.flyToBounds(
              L.latLngBounds([s, w], [n, e]) as Leaflet.LatLngBoundsExpression,
              { padding: [40, 40], duration: 0.6, maxZoom: 13 }
            );
          });
        }
      })
      .catch(() => { if (!cancelled) setOverlayEntries([]); });
    return () => { cancelled = true; };
  }, [overlayFireId, overlayFireYear]);

  // Create / update / remove the image overlay as state changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled) return;
      const map = mapInstanceRef.current;
      if (!map) return;

      const entry = overlayEntries?.find((e) => e.year === overlayYear);
      const shouldShow = overlayOn && overlayFireId && entry?.bounds;

      if (!shouldShow) {
        if (overlayLayerRef.current) {
          overlayLayerRef.current.remove();
          overlayLayerRef.current = null;
        }
        return;
      }

      const [w, s, e, n] = entry!.bounds!;
      const bounds = L.latLngBounds([s, w], [n, e]);
      const url = api.rasterUrl(overlayFireId!, overlayYear!, overlayIndex);

      if (overlayLayerRef.current) {
        overlayLayerRef.current.setBounds(bounds);
        overlayLayerRef.current.setUrl(url);
        overlayLayerRef.current.setOpacity(overlayOpacity);
      } else {
        overlayLayerRef.current = L.imageOverlay(url, bounds, {
          opacity: overlayOpacity,
          interactive: false,
          className: "vi-overlay",
        }).addTo(map);
      }
    })();
    return () => { cancelled = true; };
  }, [overlayEntries, overlayYear, overlayOn, overlayOpacity, overlayFireId, overlayIndex]);

  // Pulse overlay for selected fires — projects centroids to pixel coords each
  // animation frame. Only runs while something is selected (otherwise idle).
  const [pulses, setPulses] = useState<{ id: string; x: number; y: number }[]>([]);
  const selectedCentroids = useMemo(() => {
    if (!firesGeoJSON) return [] as { id: string; lat: number; lon: number }[];
    const out: { id: string; lat: number; lon: number }[] = [];
    for (const f of firesGeoJSON.features) {
      const fid = String((f.properties as Record<string, unknown>)?.fire_id ?? "");
      if (!selectedFireIds.has(fid)) continue;
      const c = featureCentroid(f);
      if (c) out.push({ id: fid, lat: c[0], lon: c[1] });
    }
    return out;
  }, [firesGeoJSON, selectedFireIds]);

  useEffect(() => {
    if (selectedCentroids.length === 0) {
      setPulses([]);
      return;
    }
    let raf = 0;
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      const map = mapInstanceRef.current;
      if (!map || !mapRef.current) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const next: { id: string; x: number; y: number }[] = [];
      for (const c of selectedCentroids) {
        const pt = map.latLngToContainerPoint([c.lat, c.lon]);
        next.push({ id: c.id, x: pt.x, y: pt.y });
      }
      setPulses(next);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [selectedCentroids]);

  const sortedYears = overlayEntries
    ? overlayEntries.map((e) => e.year).sort((a, b) => a - b)
    : [];

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* VI overlay control — only when a single fire is selected */}
      {overlayFireId && overlayEntries && overlayEntries.length > 0 && (
        <div className="absolute top-3 right-3 z-[500] w-56 bg-surface/90 backdrop-blur rounded-lg border border-border shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2/50">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text">
              <span className="text-accent text-[12px] leading-none" aria-hidden>▦</span>
              VI-снимок на карте
            </span>
            <button
              onClick={() => setOverlayOn((v) => !v)}
              className={`relative w-8 h-[18px] rounded-full transition-colors ${
                overlayOn ? "bg-accent" : "bg-surface-hover"
              }`}
              aria-pressed={overlayOn}
              aria-label="Показать слой"
            >
              <span
                className="absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all"
                style={{ left: overlayOn ? 16 : 2 }}
              />
            </button>
          </div>

          <div className={`px-3 py-2.5 space-y-2.5 transition-opacity ${overlayOn ? "" : "opacity-40 pointer-events-none"}`}>
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>Индекс</span>
              <span className="px-1.5 py-0.5 rounded bg-accent-soft text-accent font-semibold tabular-nums">
                {overlayIndex}
              </span>
            </div>

            <div>
              <p className="text-[10px] text-text-muted mb-1">Год снимка</p>
              <div className="flex flex-wrap gap-1">
                {sortedYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => setOverlayYear(y)}
                    className={`px-1.5 py-0.5 text-[10px] rounded tabular-nums border transition-colors ${
                      overlayYear === y
                        ? "bg-accent-soft border-accent/40 text-accent font-semibold"
                        : "border-border text-text-muted hover:text-text hover:border-border-strong"
                    }`}
                    title={y === overlayFireYear ? "год пожара" : undefined}
                  >
                    {y}
                    {y === overlayFireYear && <span className="ml-0.5 text-warning">●</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>Прозрачность</span>
                <span className="tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Pulse overlay for selected fires */}
      {pulses.map((p) => (
        <div
          key={p.id}
          className="absolute pointer-events-none"
          style={{
            left: p.x,
            top: p.y,
            transform: "translate(-50%, -50%)",
            width: 56,
            height: 56,
          }}
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(249,115,22,0.45) 0%, rgba(249,115,22,0) 70%)",
              animation: "fire-pulse 1.8s ease-out infinite",
            }}
          />
          <span
            className="absolute inset-0 rounded-full border-2"
            style={{
              borderColor: "rgba(249,115,22,0.85)",
              boxShadow: "0 0 12px rgba(249,115,22,0.5)",
            }}
          />
        </div>
      ))}
      <style jsx>{`
        @keyframes fire-pulse {
          0%   { transform: scale(0.5); opacity: 0.9; }
          80%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const BASE = "http://localhost:8000/api";

async function get<T>(path: string, params?: Record<string, string | number | null | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

/** WGS84 extent of a raster: [west, south, east, north]. */
export type Bounds = [number, number, number, number];
export type RasterEntry = { year: number; sensor: string; bounds?: Bounds | null };

export const api = {
  getFilters: () => get<import("@/types").FiltersConfig>("/filters"),

  getFires: (params?: { frname?: string; area_min?: number; area_max?: number }) =>
    get<GeoJSON.FeatureCollection>("/fires", params),

  getFiresMeta: (params?: { frname?: string; area_min?: number; area_max?: number }) =>
    get<import("@/types").FireMeta[]>("/fires/meta", params),

  getLesnichestva: () => get<GeoJSON.FeatureCollection>("/lesnichestva"),

  getVIAggregate: (index: string, agg: string, vegType?: string | null) =>
    get<import("@/types").AggPoint[]>("/vi/aggregate", { index, agg, veg_type: vegType }),

  getVIByFire: (fireId: string, index: string, agg: string, vegType?: string | null) =>
    get<import("@/types").VIPoint[]>(`/vi/by-fire/${fireId}`, { index, agg, veg_type: vegType }),

  getVIMultiFire: (fireIds: string[], index: string, agg: string, vegType?: string | null) =>
    get<import("@/types").AggPoint[]>("/vi/multi-fire", {
      fire_ids: fireIds.join(","),
      index,
      agg,
      veg_type: vegType,
    }),

  getVegAreasAggregate: () => get<import("@/types").VegAreaRow[]>("/veg-areas/aggregate"),

  getVegAreasByFire: (fireId: string) =>
    get<import("@/types").VegAreaRow[]>(`/veg-areas/by-fire/${fireId}`),

  // Raster gallery / map overlay — for one fire, list (year, sensor, bounds)
  // combos we have rasters for.
  getRasterAvailable: (fireId: string) =>
    get<RasterEntry[]>(`/raster/available`, { fire_id: fireId }),

  // Direct URL to the rendered PNG. Caller provides the band name (NDVI/EVI/...).
  rasterUrl: (fireId: string, year: number, band: string) =>
    `${BASE}/raster/${fireId}/${year}/${band}.png`,
};

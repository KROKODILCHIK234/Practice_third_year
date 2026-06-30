export interface FireMeta {
  fire_id: string;
  frname: string;
  Area: number;
  dt_first: string;
  dt_last: string;
}

export interface VIPoint {
  fire_id: string;
  year: number;
  years_since_fire: number;
  sensor: string;
  frname: string;
  veg_name: string;
  value: number | null;
  index: string;
  agg: string;
}

export interface AggPoint {
  years_since_fire: number;
  value: number | null;
  count: number;
}

export interface VegAreaRow {
  year: number;
  [key: string]: number;
}

export interface Filters {
  selectedFireIds: Set<string>;
  frname: string | null;
  areaMin: number;
  areaMax: number;
  vegType: string | null;
  index: string;
  agg: string;
  period: "all" | "before" | "after";
}

export interface FiltersConfig {
  indices: string[];
  aggregations: string[];
  veg_types: string[];
  frnames: string[];
  years_since_fire: { min: number; max: number };
  years: { min: number; max: number };
  area: { min: number; max: number };
}

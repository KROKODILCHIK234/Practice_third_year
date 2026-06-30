import json
import csv
import io
import re
from pathlib import Path
from typing import Optional
from functools import lru_cache
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

import numpy as np
import rasterio
from rasterio.warp import transform_bounds
from PIL import Image

from colormaps import COLORMAPS, INDEX_COLORMAP

app = FastAPI(title="Vegetation Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).parent.parent / "Data"
# SCALING POINT: the prototype reads a single year. To onboard more years, turn
# VI_DIR into a list of dataset directories and concatenate their CSVs in the
# get_* loaders below — the API contract stays the same. See README → Масштабирование.
VI_DIR = DATA_DIR / "Vegetation index by fires 2005"
RASTER_DIR = DATA_DIR / "fire_rasters" / "fire_rasters"

# Index names appear in the GeoTIFF as band descriptions in this exact order.
BAND_NAMES = ("NDVI", "NBR", "NBR2", "EVI", "SAVI", "BAI", "NDWI")

# Filename pattern: fire<id>_<year>_indices_<sensor>.tif
RASTER_RE = re.compile(r"^fire(\d+)_(\d{4})_indices_(landsat5|sentinel2)\.tif$")


def load_csv(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_json(path: Path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# Cache data at startup
_fires_geojson = None
_lesnichestva_geojson = None
_vi_long: list[dict] | None = None
_fires_meta: list[dict] | None = None
_veg_areas: list[dict] | None = None


def get_fires_geojson():
    global _fires_geojson
    if _fires_geojson is None:
        _fires_geojson = load_json(DATA_DIR / "fires_2005_vi.geojson")
    return _fires_geojson


def get_lesnichestva():
    global _lesnichestva_geojson
    if _lesnichestva_geojson is None:
        _lesnichestva_geojson = load_json(DATA_DIR / "lesnichestva.geojson")
    return _lesnichestva_geojson


def get_vi_long():
    global _vi_long
    if _vi_long is None:
        rows = load_csv(VI_DIR / "vi_long_format.csv")
        for r in rows:
            r["value"] = float(r["value"]) if r["value"] else None
            r["year"] = int(r["year"])
            r["years_since_fire"] = int(r["years_since_fire"])
        _vi_long = rows
    return _vi_long


def get_fires_meta():
    global _fires_meta
    if _fires_meta is None:
        rows = load_csv(VI_DIR / "dashboard_fires_metadata.csv")
        for r in rows:
            r["Area"] = float(r["Area"])
        _fires_meta = rows
    return _fires_meta


def get_veg_areas():
    global _veg_areas
    if _veg_areas is None:
        rows = load_csv(VI_DIR / "areas_vegetation_in_fires_2005.csv")
        for r in rows:
            for k, v in r.items():
                if k not in ("fire_idx", "year"):
                    r[k] = float(v) if v else 0.0
            if "year" in r:
                r["year"] = int(r["year"])
        _veg_areas = rows
    return _veg_areas


@app.get("/api/fires")
def get_fires(
    frname: str | None = None,
    area_min: float | None = None,
    area_max: float | None = None,
):
    geo = get_fires_geojson()
    features = geo["features"]

    if frname:
        features = [f for f in features if f["properties"].get("frname") == frname]
    if area_min is not None:
        features = [f for f in features if (f["properties"].get("Area") or 0) >= area_min]
    if area_max is not None:
        features = [f for f in features if (f["properties"].get("Area") or 0) <= area_max]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/lesnichestva")
def get_lesnichestva_route():
    return get_lesnichestva()


@app.get("/api/filters")
def get_filters():
    vi_data = get_vi_long()
    meta = get_fires_meta()
    return {
        "indices": sorted(set(r["index"] for r in vi_data)),
        "aggregations": ["median", "max", "min"],
        "veg_types": sorted(set(r["veg_name"] for r in vi_data if r["veg_name"])),
        "frnames": sorted(set(r["frname"] for r in meta if r["frname"])),
        "years_since_fire": {
            "min": min(r["years_since_fire"] for r in vi_data),
            "max": max(r["years_since_fire"] for r in vi_data),
        },
        "years": {
            "min": min(r["year"] for r in vi_data),
            "max": max(r["year"] for r in vi_data),
        },
        "area": {
            "min": min(r["Area"] for r in meta),
            "max": max(r["Area"] for r in meta),
        },
    }


@app.get("/api/vi/aggregate")
def get_vi_aggregate(
    index: str = "NDVI",
    agg: str = "median",
    veg_type: str | None = None,
):
    vi_data = get_vi_long()
    filtered = [
        r for r in vi_data
        if r["index"] == index and r["agg"] == agg
        and (veg_type is None or r["veg_name"] == veg_type)
    ]
    by_year_since = {}
    for r in filtered:
        key = r["years_since_fire"]
        if key not in by_year_since:
            by_year_since[key] = []
        if r["value"] is not None:
            by_year_since[key].append(r["value"])

    result = []
    for ysf in sorted(by_year_since.keys()):
        vals = by_year_since[ysf]
        result.append({
            "years_since_fire": ysf,
            "value": sum(vals) / len(vals) if vals else None,
            "count": len(vals),
        })
    return result


@app.get("/api/vi/by-fire/{fire_id}")
def get_vi_by_fire(
    fire_id: str,
    index: str = "NDVI",
    agg: str = "median",
    veg_type: str | None = None,
):
    vi_data = get_vi_long()
    filtered = [
        r for r in vi_data
        if r["fire_id"] == fire_id
        and r["index"] == index
        and r["agg"] == agg
        and (veg_type is None or r["veg_name"] == veg_type)
    ]
    return sorted(filtered, key=lambda r: r["years_since_fire"])


@app.get("/api/vi/multi-fire")
def get_vi_multi_fire(
    fire_ids: str = Query(..., description="Comma-separated fire IDs"),
    index: str = "NDVI",
    agg: str = "median",
    veg_type: str | None = None,
):
    ids = set(fire_ids.split(","))
    vi_data = get_vi_long()
    filtered = [
        r for r in vi_data
        if r["fire_id"] in ids
        and r["index"] == index
        and r["agg"] == agg
        and (veg_type is None or r["veg_name"] == veg_type)
    ]
    by_yfs = {}
    for r in filtered:
        key = r["years_since_fire"]
        if key not in by_yfs:
            by_yfs[key] = []
        if r["value"] is not None:
            by_yfs[key].append(r["value"])

    result = []
    for ysf in sorted(by_yfs.keys()):
        vals = by_yfs[ysf]
        result.append({
            "years_since_fire": ysf,
            "value": sum(vals) / len(vals) if vals else None,
            "count": len(vals),
        })
    return result


@app.get("/api/veg-areas/aggregate")
def get_veg_areas_aggregate():
    rows = get_veg_areas()
    veg_cols = [c for c in rows[0].keys() if c not in ("fire_idx", "year")]
    by_year = {}
    for r in rows:
        yr = r["year"]
        if yr not in by_year:
            by_year[yr] = {c: 0.0 for c in veg_cols}
        for c in veg_cols:
            by_year[yr][c] += r[c]

    result = []
    for yr in sorted(by_year.keys()):
        entry = {"year": yr}
        entry.update(by_year[yr])
        result.append(entry)
    return result


@app.get("/api/veg-areas/by-fire/{fire_id}")
def get_veg_areas_by_fire(fire_id: str):
    rows = get_veg_areas()
    filtered = [r for r in rows if str(r["fire_idx"]) == fire_id]
    return sorted(filtered, key=lambda r: r["year"])


@app.get("/api/ndvi-areas")
def get_ndvi_areas():
    rows = load_csv(VI_DIR / "dashboard_ndvi_areas.csv")
    return rows


@app.get("/api/vi/global-by-year")
def get_vi_global_by_year():
    rows = load_csv(VI_DIR / "dashboard_vi_by_year.csv")
    return rows


@app.get("/api/fires/meta")
def get_fires_meta_route(
    frname: str | None = None,
    area_min: float | None = None,
    area_max: float | None = None,
):
    meta = get_fires_meta()
    filtered = meta
    if frname:
        filtered = [r for r in filtered if r["frname"] == frname]
    if area_min is not None:
        filtered = [r for r in filtered if r["Area"] >= area_min]
    if area_max is not None:
        filtered = [r for r in filtered if r["Area"] <= area_max]
    return filtered


# ---------------------------------------------------------------------------
# Raster images
# ---------------------------------------------------------------------------

def _scan_rasters() -> dict[str, list[dict]]:
    """Index raster files by fire_id. Returns {fire_id: [{year, sensor, path}]}."""
    if not RASTER_DIR.exists():
        return {}
    out: dict[str, list[dict]] = {}
    for p in RASTER_DIR.iterdir():
        m = RASTER_RE.match(p.name)
        if not m:
            continue
        fid, year, sensor = m.group(1), int(m.group(2)), m.group(3)
        out.setdefault(fid, []).append({"year": year, "sensor": sensor, "path": str(p)})
    for entries in out.values():
        entries.sort(key=lambda r: (r["year"], r["sensor"]))
    return out


_RASTER_INDEX = _scan_rasters()


@lru_cache(maxsize=2048)
def _wgs84_bounds(raster_path_str: str, mtime_ns: int) -> tuple[float, float, float, float]:
    """Bounds reprojected to WGS84 (lon/lat) as [west, south, east, north].

    Leaflet's imageOverlay expects geographic coordinates, so we reproject from
    the raster's native CRS once and cache the result (keyed by mtime).
    """
    with rasterio.open(raster_path_str) as src:
        west, south, east, north = transform_bounds(src.crs, "EPSG:4326", *src.bounds)
    return (west, south, east, north)


def _entry_bounds(entry: dict) -> list[float] | None:
    p = Path(entry["path"])
    try:
        return list(_wgs84_bounds(str(p), p.stat().st_mtime_ns))
    except Exception:  # noqa: BLE001 — a corrupt TIF shouldn't break the listing
        return None


@app.get("/api/raster/available")
def get_raster_available(fire_id: Optional[str] = None):
    """List rasters available for a given fire (or for all fires if fire_id is None).

    Each entry carries WGS84 ``bounds`` ([west, south, east, north]) so the client
    can place the rendered PNG on the map as a georeferenced overlay.
    """
    if fire_id is None:
        return {
            fid: [{"year": e["year"], "sensor": e["sensor"]} for e in entries]
            for fid, entries in _RASTER_INDEX.items()
        }
    entries = _RASTER_INDEX.get(fire_id, [])
    return [
        {"year": e["year"], "sensor": e["sensor"], "bounds": _entry_bounds(e)}
        for e in entries
    ]


def _find_raster(fire_id: str, year: int) -> Path | None:
    for entries in _RASTER_INDEX.get(fire_id, []):
        if entries["year"] == year:
            return Path(entries["path"])
    return None


def _render_png(raster_path: Path, band_name: str) -> bytes:
    """Read the requested band from the GeoTIFF, apply colormap, return PNG bytes."""
    band_idx = BAND_NAMES.index(band_name) + 1  # rasterio is 1-indexed
    cmap_name, _reverse = INDEX_COLORMAP[band_name]
    lut = COLORMAPS[cmap_name]

    with rasterio.open(raster_path) as src:
        arr = src.read(band_idx).astype("float32")
        bounds = src.bounds  # for client-side overlay

    # NaN → transparent; valid pixels normalised against robust percentiles.
    nan_mask = np.isnan(arr)
    if not nan_mask.all():
        valid = arr[~nan_mask]
        # Robust normalisation: clip 2 / 98 percentiles, then rescale to [0, 1].
        lo, hi = np.percentile(valid, [2, 98])
        if hi <= lo:
            hi = lo + 1e-6
        norm = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
        norm[nan_mask] = 0.0
    else:
        norm = np.zeros_like(arr)

    # Apply LUT → RGBA.
    idx = (norm * 255).astype(np.uint8)
    rgb = np.empty((arr.shape[0], arr.shape[1], 3), dtype=np.uint8)
    lut_arr = np.asarray(lut, dtype=np.uint8)  # (256, 3)
    rgb[...] = lut_arr[idx]  # vectorised lookup
    alpha = np.where(nan_mask, 0, 230).astype(np.uint8)  # ~90 % opaque for valid

    rgba = np.dstack([rgb, alpha])
    img = Image.fromarray(rgba, mode="RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@lru_cache(maxsize=512)
def _render_png_cached(raster_path_str: str, mtime_ns: int, band_name: str) -> bytes:
    """Cached variant — key includes mtime so edits to the TIF invalidate."""
    return _render_png(Path(raster_path_str), band_name)


@app.get("/api/raster/{fire_id}/{year}/{band}.png")
def get_raster_png(fire_id: str, year: int, band: str):
    band = band.upper()
    if band not in BAND_NAMES:
        raise HTTPException(400, f"Unknown band '{band}'. Expected one of {BAND_NAMES}.")
    rp = _find_raster(fire_id, year)
    if rp is None or not rp.exists():
        raise HTTPException(404, f"No raster for fire_id={fire_id}, year={year}.")
    mtime_ns = rp.stat().st_mtime_ns
    try:
        png = _render_png_cached(str(rp), mtime_ns, band)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Failed to render raster: {exc}")
    west, south, east, north = _wgs84_bounds(str(rp), mtime_ns)
    headers = {
        "Cache-Control": "public, max-age=3600",
        # WGS84 extent (west,south,east,north) for client-side map overlays.
        "X-Bounds": f"{west},{south},{east},{north}",
        "Access-Control-Expose-Headers": "X-Bounds",
    }
    return Response(content=png, media_type="image/png", headers=headers)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

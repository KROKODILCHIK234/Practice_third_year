"""Hand-coded colormaps for raster visualisation.

We avoid matplotlib to keep the dependency surface small. Each map is a
256-entry RGB LUT indexed by a normalised value in [0, 1].

Three maps cover all our indices:
- ``rdylgn`` (red → yellow → green) for vegetation-good indices.
- ``hot_r`` (dark red → orange → yellow → white) for burn-severity indices.
- ``coolwarm`` (cool blue → warm red) for water-content indices.
"""

from __future__ import annotations


def _lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        round(a[0] + (b[0] - a[0]) * t),
        round(a[1] + (b[1] - a[1]) * t),
        round(a[2] + (b[2] - a[2]) * t),
    )


def _build(stops: list[tuple[float, tuple[int, int, int]]]) -> list[tuple[int, int, int]]:
    """stops: list of (position in [0,1], (R,G,B)). Stops must be sorted by position."""
    lut: list[tuple[int, int, int]] = []
    for i in range(256):
        x = i / 255.0
        # find surrounding stops
        for j in range(len(stops) - 1):
            p0, c0 = stops[j]
            p1, c1 = stops[j + 1]
            if p0 <= x <= p1:
                t = (x - p0) / (p1 - p0) if p1 > p0 else 0.0
                lut.append(_lerp(c0, c1, t))
                break
        else:
            lut.append(stops[-1][1])
    return lut


# Red-Yellow-Green (diverging, low=red → high=green)
_RDYLGN = _build([
    (0.00, (165,   0,  38)),   # dark red
    (0.25, (215,  48,  39)),
    (0.40, (244, 109,  67)),
    (0.50, (253, 174,  97)),   # orange
    (0.60, (254, 224, 139)),   # light yellow
    (0.75, (217, 239, 139)),
    (0.90, (102, 189,  99)),
    (1.00, ( 26, 152,  80)),   # deep green
])

# Hot reversed (low = white → high = dark red); we want the OPPOSITE — low
# (healthy) = light, high (burn severity) = dark red. So use hot forward.
_HOT_R = _build([
    (0.00, ( 10,   0,   0)),
    (0.20, ( 90,   0,   0)),
    (0.40, (180,  40,   0)),
    (0.55, (230,  85,  10)),
    (0.70, (255, 150,  40)),
    (0.85, (255, 220,  90)),
    (1.00, (255, 255, 200)),
])

# Cool-warm diverging (low = cool blue → mid = off-white → high = warm red)
_COOLWARM = _build([
    (0.00, ( 58,  76, 192)),   # cool blue
    (0.25, (124, 168, 224)),
    (0.50, (240, 240, 240)),   # neutral
    (0.75, (240, 128, 107)),
    (1.00, (180,  30,  30)),   # warm red
])


COLORMAPS: dict[str, list[tuple[int, int, int]]] = {
    "rdylgn": _RDYLGN,
    "hot_r": _HOT_R,
    "coolwarm": _COOLWARM,
}


# Index → colormap selection. ``reverse`` flips the mapping because some
# indices (BAI, NDWI) have a non-intuitive "high = bad" semantic.
INDEX_COLORMAP: dict[str, tuple[str, bool]] = {
    "NDVI": ("rdylgn", False),
    "EVI":  ("rdylgn", False),
    "SAVI": ("rdylgn", False),
    "NBR":  ("hot_r",  False),
    "NBR2": ("hot_r",  False),
    "BAI":  ("hot_r",  False),
    "NDWI": ("coolwarm", False),
}

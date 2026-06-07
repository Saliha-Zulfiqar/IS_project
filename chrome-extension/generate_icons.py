"""Generate PhishGuard extension toolbar and tab icons."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

PRIMARY = (52, 97, 255)
PRIMARY_DARK = (30, 70, 210)
WHITE = (255, 255, 255)
ACCENT = (34, 197, 94)

OUT_DIR = Path(__file__).parent
SIZES = (16, 32, 48, 128)


def draw_shield(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = max(1, size // 10)
    w, h = size, size

    # Shield polygon
    top = pad
    bottom = h - pad
    cx = w / 2
    shield = [
        (cx, top),
        (w - pad, top + (bottom - top) * 0.22),
        (w - pad, top + (bottom - top) * 0.58),
        (cx, bottom),
        (pad, top + (bottom - top) * 0.58),
        (pad, top + (bottom - top) * 0.22),
    ]
    draw.polygon(shield, fill=PRIMARY_DARK)
    inner = [
        (cx, top + pad * 0.4),
        (w - pad * 1.8, top + (bottom - top) * 0.24),
        (w - pad * 1.8, top + (bottom - top) * 0.55),
        (cx, bottom - pad * 0.8),
        (pad * 1.8, top + (bottom - top) * 0.55),
        (pad * 1.8, top + (bottom - top) * 0.24),
    ]
    draw.polygon(inner, fill=PRIMARY)

    # Checkmark
    stroke = max(1, size // 10)
    y1 = h * 0.46
    y2 = h * 0.58
    x1 = cx - size * 0.14
    x2 = cx - size * 0.02
    x3 = cx + size * 0.16
    draw.line([(x1, y1), (x2, y2), (x3, h * 0.36)], fill=WHITE, width=stroke, joint="curve")

    # Small security dot
    r = max(1, size // 14)
    draw.ellipse(
        (cx + size * 0.18, top + size * 0.14, cx + size * 0.18 + r * 2, top + size * 0.14 + r * 2),
        fill=ACCENT,
    )
    return img


def main() -> None:
    for size in SIZES:
        icon = draw_shield(size)
        name = f"icon{size}.png"
        icon.save(OUT_DIR / name, format="PNG")
        print(f"Wrote {name}")


if __name__ == "__main__":
    main()

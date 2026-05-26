"""Generate simple placeholder PNG icons for the Chrome extension."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "chrome-extension"
SIZES = (16, 48, 128)
# Shield blue matching extension theme
RGB = (26, 95, 180)


def _png_chunk(tag: bytes, data: bytes) -> bytes:
    chunk = tag + data
    return (
        struct.pack(">I", len(data))
        + chunk
        + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)
    )


def write_png(path: Path, size: int, rgb: tuple[int, int, int]) -> None:
    r, g, b = rgb
    row = bytes([0, r, g, b] * size)
    raw = row * size
    compressed = zlib.compress(raw, 9)

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n"
    png += _png_chunk(b"IHDR", ihdr)
    png += _png_chunk(b"IDAT", compressed)
    png += _png_chunk(b"IEND", b"")

    path.write_bytes(png)


def main() -> None:
    for size in SIZES:
        out = ROOT / f"icon{size}.png"
        write_png(out, size, RGB)
        print(f"Wrote {out}")


if __name__ == "__main__":
    main()

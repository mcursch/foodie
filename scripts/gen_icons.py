#!/usr/bin/env python3
"""Generate Foodie app icons with no third-party deps (stdlib zlib + struct).

Draws a white apple on a green background, anti-aliased via 3x3 supersampling.

Outputs:
  web/icons/*.png ............................ PWA icons (RGBA, rounded, transparent corners)
  ios/.../AppIcon.appiconset/icon-1024.png ... App Store icon (RGB, opaque, full square)

The App Store icon MUST be opaque with no alpha channel and a full square (iOS
applies the rounded-corner mask itself), so it is rendered separately.
"""
import os, zlib, struct, math

HERE = os.path.dirname(__file__)
WEB_ICONS = os.path.join(HERE, "..", "web", "icons")
APPICONSET = os.path.join(HERE, "..", "ios", "Foodie", "Assets.xcassets", "AppIcon.appiconset")

# Palette
BG_TOP = (0x22, 0xc5, 0x5e)   # brand-2
BG_BOT = (0x15, 0x80, 0x3d)   # deeper green
APPLE  = (0xff, 0xff, 0xff)
LEAF   = (0xd1, 0xfa, 0xe5)
STEM   = (0x8b, 0x5e, 0x34)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def inside_apple(x, y, S):
    cx, cy = 0.5 * S, 0.56 * S
    r = 0.235 * S
    dx = 0.135 * S

    def circ(ox, oy, rr):
        return (x - ox) ** 2 + (y - oy) ** 2 <= rr * rr

    body = circ(cx - dx, cy, r) or circ(cx + dx, cy, r) or circ(cx, cy + 0.06 * S, r)
    if not body:
        return False
    # top notch
    if (x - cx) ** 2 + (y - (cy - 0.24 * S)) ** 2 <= (0.11 * S) ** 2:
        return False
    return True


def inside_leaf(x, y, S):
    lx, ly = 0.60 * S, 0.30 * S
    ux, uy = (x - lx), (y - ly)
    a = math.radians(-40)
    rx = ux * math.cos(a) - uy * math.sin(a)
    ry = ux * math.sin(a) + uy * math.cos(a)
    return (rx / (0.11 * S)) ** 2 + (ry / (0.05 * S)) ** 2 <= 1.0


def inside_stem(x, y, S):
    return abs(x - 0.5 * S) <= 0.018 * S and (0.28 * S) <= y <= (0.36 * S)


def rounded(x, y, S, radius_frac, pad_frac=0.0):
    pad = pad_frac * S
    r = radius_frac * S
    lo, hi = pad, S - pad
    cx = min(max(x, lo + r), hi - r)
    cy = min(max(y, lo + r), hi - r)
    if x < lo or x > hi or y < lo or y > hi:
        return False
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r or (
        lo + r <= x <= hi - r or lo + r <= y <= hi - r
    )


def foreground_color(x, y, S):
    """Color of the apple artwork at a point, or the gradient background."""
    t = y / S
    if inside_stem(x, y, S):
        return STEM
    if inside_leaf(x, y, S):
        return LEAF
    if inside_apple(x, y, S):
        return APPLE
    return lerp(BG_TOP, BG_BOT, t)


def render(S, *, rounded_mask=True, maskable=False, opaque=False):
    """Render an icon.

    rounded_mask=True  -> transparent rounded-square (PWA)
    rounded_mask=False -> full opaque square (App Store)
    opaque=True        -> emit RGB (no alpha channel)
    """
    pad = 0.14 if maskable else 0.0
    SS = 3
    channels = 3 if opaque else 4
    raw = bytearray()
    for py in range(S):
        raw.append(0)  # PNG filter type 0
        for px in range(S):
            acc = [0.0] * channels
            n = SS * SS
            for sy in range(SS):
                for sx in range(SS):
                    x = px + (sx + 0.5) / SS
                    y = py + (sy + 0.5) / SS
                    if rounded_mask and not rounded(x, y, S, 0.225, pad):
                        if not opaque:
                            continue  # transparent outside
                        col = lerp(BG_TOP, BG_BOT, y / S)  # opaque bg fallback
                    else:
                        col = foreground_color(x, y, S)
                    acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]
                    if not opaque:
                        acc[3] += 255
            raw += bytes(int(acc[c] / n) for c in range(channels))
    return png_bytes(S, S, bytes(raw), color_type=(2 if opaque else 6))


def png_bytes(w, h, raw, color_type=6):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        c += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        return c
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print("wrote", os.path.relpath(path, os.path.join(HERE, "..")), len(data), "bytes")


def main():
    # PWA icons (transparent rounded square)
    write(os.path.join(WEB_ICONS, "icon-192.png"), render(192))
    write(os.path.join(WEB_ICONS, "icon-512.png"), render(512))
    write(os.path.join(WEB_ICONS, "icon-maskable-512.png"), render(512, maskable=True))
    write(os.path.join(WEB_ICONS, "apple-touch-icon.png"), render(180))
    # App Store icon (opaque, no alpha, full square)
    write(os.path.join(APPICONSET, "icon-1024.png"),
          render(1024, rounded_mask=False, opaque=True))


if __name__ == "__main__":
    main()

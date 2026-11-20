"""
Generate companion icons (16, 32, 48, 128px) for Confession Hover.
Matches Bible Hover's squircle + brushed-gold border + 5 bottom hover dots aesthetic,
rendered with a deep burgundy interior, warm gold open confessional book, and rose-coral dots.
"""
import os
from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "extension", "icons")
SIZES = [16, 32, 48, 128]
SCALE = 4


def create_icon(size: int) -> Image.Image:
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer squircle border (warm brushed gold)
    pad = max(2, int(s * 0.035))
    radius = int(s * 0.24)
    gold_outer = (205, 174, 114, 255)
    gold_inner_bevel = (166, 134, 78, 255)
    draw.rounded_rectangle([pad, pad, s - pad, s - pad], radius=radius, fill=gold_outer)

    bevel_pad = pad + max(2, int(s * 0.015))
    draw.rounded_rectangle([bevel_pad, bevel_pad, s - bevel_pad, s - bevel_pad], radius=int(radius * 0.94), fill=gold_inner_bevel)

    # Deep burgundy interior with subtle top-to-bottom vertical gradient
    inner_pad = pad + max(4, int(s * 0.055))
    inner_radius = max(4, radius - int(s * 0.04))

    mask = Image.new("L", (s, s), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([inner_pad, inner_pad, s - inner_pad, s - inner_pad], radius=inner_radius, fill=255)

    grad = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(grad)
    top_rgb = (88, 16, 38)     # #581026
    bot_rgb = (49, 7, 21)      # #310715
    span = max(1, (s - inner_pad) - inner_pad)
    for y in range(inner_pad, s - inner_pad + 1):
        t = (y - inner_pad) / span
        r = int(top_rgb[0] + (bot_rgb[0] - top_rgb[0]) * t)
        g = int(top_rgb[1] + (bot_rgb[1] - top_rgb[1]) * t)
        b = int(top_rgb[2] + (bot_rgb[2] - top_rgb[2]) * t)
        grad_draw.line([(inner_pad, y), (s - inner_pad, y)], fill=(r, g, b, 255))

    img = Image.composite(grad, img, mask)
    draw = ImageDraw.Draw(img)

    # Warm gold open confessional book centered in upper-middle area
    gold_main = (232, 195, 118, 255)
    gold_light = (246, 219, 156, 255)
    burgundy_ink = (64, 10, 27, 255)

    cx = s * 0.5
    book_top = s * 0.22
    book_bottom = s * 0.65
    book_half_w = s * 0.29
    spine_dip = s * 0.045
    spine_gap = max(2, s * 0.016)

    # Left page polygon (top-left -> top-center dip -> bottom-center dip -> bottom-left)
    left_page = [
        (cx - book_half_w, book_top),
        (cx - spine_gap * 0.5, book_top + spine_dip),
        (cx - spine_gap * 0.5, book_bottom),
        (cx - book_half_w, book_bottom - spine_dip),
    ]
    # Right page polygon
    right_page = [
        (cx + spine_gap * 0.5, book_top + spine_dip),
        (cx + book_half_w, book_top),
        (cx + book_half_w, book_bottom - spine_dip),
        (cx + spine_gap * 0.5, book_bottom),
    ]

    # Subtle outer cover under pages
    cover_pad_x = s * 0.025
    cover_pad_y = s * 0.025
    cover_poly = [
        (cx - book_half_w - cover_pad_x, book_top + cover_pad_y),
        (cx + book_half_w + cover_pad_x, book_top + cover_pad_y),
        (cx + book_half_w + cover_pad_x, book_bottom + cover_pad_y * 0.6),
        (cx - book_half_w - cover_pad_x, book_bottom + cover_pad_y * 0.6),
    ]
    draw.polygon(cover_poly, fill=gold_inner_bevel)

    draw.polygon(left_page, fill=gold_main)
    draw.polygon(right_page, fill=gold_light)

    # Center spine crease
    draw.line(
        [(cx, book_top + spine_dip * 0.8), (cx, book_bottom)],
        fill=burgundy_ink,
        width=max(2, int(s * 0.022))
    )

    # Crisp parchment text lines (omit or keep clean at 16px, readable at all sizes)
    if size >= 32:
        line_w = max(2, int(s * 0.022))
        margin_x = s * 0.048
        for i in range(3):
            y_off = book_top + spine_dip + s * (0.085 + i * 0.092)
            # Left page lines
            draw.line(
                [(cx - book_half_w + margin_x, y_off - s * 0.014), (cx - margin_x, y_off)],
                fill=burgundy_ink,
                width=line_w
            )
            # Right page lines
            draw.line(
                [(cx + margin_x, y_off), (cx + book_half_w - margin_x, y_off - s * 0.014)],
                fill=burgundy_ink,
                width=line_w
            )

    # Bookmark ribbon extending slightly from bottom center
    ribbon_w = s * 0.032
    ribbon_top = book_bottom - s * 0.01
    ribbon_bot = book_bottom + s * 0.065
    draw.polygon([
        (cx - ribbon_w, ribbon_top),
        (cx + ribbon_w, ribbon_top),
        (cx + ribbon_w, ribbon_bot),
        (cx, ribbon_bot - s * 0.022),
        (cx - ribbon_w, ribbon_bot),
    ], fill=gold_main)

    # 5 signature rose-coral hover dots across the bottom
    dot_color = (251, 113, 133, 255)  # #fb7185
    dot_y = s * 0.805
    dot_r = s * 0.036
    dot_spacing = s * 0.135
    start_x = cx - 2 * dot_spacing
    for i in range(5):
        dx = start_x + i * dot_spacing
        draw.ellipse([dx - dot_r, dot_y - dot_r, dx + dot_r, dot_y + dot_r], fill=dot_color)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        icon = create_icon(size)
        path = os.path.join(OUT_DIR, f"icon{size}.png")
        icon.save(path, format="PNG")
        print(f"Generated {path} ({size}x{size})")


if __name__ == "__main__":
    main()

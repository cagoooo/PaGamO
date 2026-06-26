from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

BLUE = "#2563eb"
INDIGO = "#4338ca"
SLATE = "#0f172a"
MUTED = "#64748b"
YELLOW = "#facc15"
WHITE = "#ffffff"


def font(size, bold=False):
    candidates = [
        "C:/Windows/Fonts/msjhbd.ttc" if bold else "C:/Windows/Fonts/msjh.ttc",
        "C:/Windows/Fonts/msjh.ttc",
        "C:/Windows/Fonts/NotoSansCJKtc-Regular.otf",
    ]
    for item in candidates:
        path = Path(item)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def rounded_rectangle(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_gamepad(draw, cx, cy, scale, fill):
    w = 180 * scale
    h = 112 * scale
    x = cx - w / 2
    y = cy - h / 2
    rounded_rectangle(draw, (x, y + 18 * scale, x + w, y + h), 34 * scale, fill)
    draw.ellipse((x + 22 * scale, y, x + 70 * scale, y + 48 * scale), fill=fill)
    draw.ellipse((x + w - 70 * scale, y, x + w - 22 * scale, y + 48 * scale), fill=fill)
    # D-pad
    draw.rounded_rectangle((x + 38 * scale, y + 54 * scale, x + 78 * scale, y + 68 * scale), radius=4 * scale, fill=WHITE)
    draw.rounded_rectangle((x + 51 * scale, y + 41 * scale, x + 65 * scale, y + 81 * scale), radius=4 * scale, fill=WHITE)
    # Buttons
    draw.ellipse((x + 116 * scale, y + 50 * scale, x + 138 * scale, y + 72 * scale), fill=YELLOW)
    draw.ellipse((x + 144 * scale, y + 38 * scale, x + 166 * scale, y + 60 * scale), fill="#93c5fd")


def make_og():
    img = Image.new("RGB", (1200, 630), "#eef4ff")
    draw = ImageDraw.Draw(img)

    for y in range(630):
        t = y / 629
        r = int(37 * (1 - t) + 67 * t)
        g = int(99 * (1 - t) + 56 * t)
        b = int(235 * (1 - t) + 202 * t)
        draw.line((0, y, 1200, y), fill=(r, g, b))

    rounded_rectangle(draw, (74, 58, 1126, 572), 36, (255, 255, 255), outline="#bfdbfe", width=3)
    rounded_rectangle(draw, (102, 86, 1098, 186), 28, "#eff6ff")
    draw_gamepad(draw, 176, 136, 0.56, BLUE)

    draw.text((245, 100), "石門國小 PaGamO", font=font(54, True), fill=SLATE)
    draw.text((247, 157), "115 學年度素養教材班級授權填報", font=font(30, True), fill=INDIGO)

    draw.text((116, 257), "校內老師快速填報", font=font(52, True), fill=SLATE)
    draw.text((116, 331), "3–6 年級｜中文、英文、數學｜每班最多 2 科", font=font(34, True), fill="#1d4ed8")
    draw.text((116, 386), "自動彙整班級、人數與申請老師，後台一鍵輸出教育局授權清冊", font=font(28), fill=MUTED)

    rounded_rectangle(draw, (116, 474, 422, 530), 28, BLUE)
    draw.text((148, 488), "桃園市石門國民小學", font=font(24, True), fill=WHITE)

    rounded_rectangle(draw, (448, 474, 674, 530), 28, "#fef3c7", outline="#fde68a", width=2)
    draw.text((484, 488), "學校代碼 034725", font=font(24, True), fill="#92400e")

    draw.text((820, 495), "cagoooo.github.io/PaGamO", font=font(22), fill="#475569")

    img.save(PUBLIC / "og-image.png", optimize=True)


def make_icon(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        rounded_rectangle(draw, (0, 0, size, size), 0, BLUE)
    else:
        rounded_rectangle(draw, (0, 0, size, size), int(size * 0.22), BLUE)
    pad = int(size * (0.16 if maskable else 0.10))
    rounded_rectangle(draw, (pad, pad, size - pad, size - pad), int(size * 0.18), "#eef4ff")
    draw_gamepad(draw, size / 2, size * 0.43, size / 480, INDIGO)
    draw.text((size * 0.23, size * 0.64), "Pa", font=font(int(size * 0.18), True), fill=BLUE)
    draw.text((size * 0.47, size * 0.64), "G", font=font(int(size * 0.18), True), fill="#16a34a")
    return img


def make_icons():
    for size in (192, 512):
        make_icon(size, False).save(PUBLIC / f"icon-{size}.png", optimize=True)
        make_icon(size, True).save(PUBLIC / f"icon-{size}-maskable.png", optimize=True)
    make_icon(180, False).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    make_icon(64, False).save(PUBLIC / "favicon-64.png", optimize=True)
    make_icon(32, False).save(PUBLIC / "favicon-32.png", optimize=True)
    make_icon(16, False).save(PUBLIC / "favicon-16.png", optimize=True)
    make_icon(64, False).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#2563eb"/>
  <rect x="8" y="8" width="48" height="48" rx="12" fill="#eff6ff"/>
  <path d="M18 27c0-6 4-10 10-10h8c6 0 10 4 10 10v9c0 4-3 7-7 7-3 0-5-2-6-4h-2c-1 2-3 4-6 4-4 0-7-3-7-7z" fill="#4338ca"/>
  <path d="M23 29h8M27 25v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
  <circle cx="39" cy="28" r="3" fill="#facc15"/>
  <circle cx="45" cy="24" r="3" fill="#93c5fd"/>
  <text x="15" y="54" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#2563eb">PaG</text>
</svg>"""
    (PUBLIC / "favicon.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    PUBLIC.mkdir(exist_ok=True)
    make_og()
    make_icons()
    print("generated social assets in", PUBLIC)

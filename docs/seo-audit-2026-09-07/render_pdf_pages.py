from pathlib import Path
import fitz
from PIL import Image, ImageOps, ImageDraw

base = Path(__file__).resolve().parent
pdf_path = base / "rendered-v4" / "SEO-strategy-EcoProgress-2026-09-07.pdf"
out_dir = base / "rendered-pages-v4"
out_dir.mkdir(exist_ok=True)

pdf = fitz.open(pdf_path)
page_paths = []
for index, page in enumerate(pdf):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False)
    target = out_dir / f"page-{index + 1:03d}.png"
    pix.save(target)
    page_paths.append(target)

thumb_w, thumb_h = 300, 388
per_sheet = 9
for sheet_index in range((len(page_paths) + per_sheet - 1) // per_sheet):
    subset = page_paths[sheet_index * per_sheet:(sheet_index + 1) * per_sheet]
    sheet = Image.new("RGB", (thumb_w * 3 + 80, thumb_h * 3 + 110), "#d9dedb")
    draw = ImageDraw.Draw(sheet)
    for local, page_path in enumerate(subset):
        im = Image.open(page_path).convert("RGB")
        im.thumbnail((thumb_w - 18, thumb_h - 30))
        x = 20 + (local % 3) * thumb_w
        y = 28 + (local // 3) * thumb_h
        framed = ImageOps.expand(im, border=1, fill="#738079")
        sheet.paste(framed, (x, y))
        draw.text((x, y - 18), f"Page {sheet_index * per_sheet + local + 1}", fill="#1a2420")
    sheet.save(out_dir / f"contact-{sheet_index + 1:02d}.png")

text = "\n".join(page.get_text() for page in pdf)
(out_dir / "extracted.txt").write_text(text, encoding="utf-8")
print(f"Rendered {len(page_paths)} pages and {(len(page_paths) + per_sheet - 1) // per_sheet} contact sheets")

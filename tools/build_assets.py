"""Build the web images in chaewon/img from the originals in source/.

    python3 tools/build_assets.py

source/ is git-ignored: it holds the original photos, the show-host PDF and
the Vision subject mask of the main photo (tools/liftmask.swift).
"""
import io, json, os, subprocess, sys, unicodedata
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "source")
OUT = os.path.join(ROOT, "chaewon", "img")
os.makedirs(OUT, exist_ok=True)

MAIN = os.path.join(SRC, "KakaoTalk_Image_2026-10-17-21-00-09_005.jpeg")
REF = {k: os.path.join(SRC, f"KakaoTalk_Image_2026-10-17-21-00-09_00{n}.jpeg")
       for k, n in (("lg", 1), ("polo", 2), ("galaxy", 3), ("satin", 4))}
OTF = os.path.join(SRC, "Pretendard-Black.otf")

# Crop shared by the cut-out and its wall shadow so the two layers line up (full-res px).
BOX = (860, 700, 2780, 4900)


def save_webp(im, name, q=82, **kw):
    path = os.path.join(OUT, name)
    im.save(path, "WEBP", quality=q, method=6, **kw)
    print(f"{name:28s} {im.size[0]}x{im.size[1]}  {os.path.getsize(path) // 1024} KB")


def hero_layers():
    half = os.path.join(SRC, "cut_005_half.png")
    subprocess.run([sys.executable, "-I", os.path.join(ROOT, "tools", "refine_cut.py"), MAIN,
                    os.path.join(SRC, "mask_005.png"), half, "0.5",
                    json.dumps([[2080, 2000, 2230, 2500], [2030, 950, 2135, 1065]])], check=True)
    cut = Image.open(half)
    s = 0.5
    box = tuple(int(v * s) for v in BOX)
    cut_c = cut.crop(box)
    save_webp(cut_c, "hero-cut.webp", q=84)
    save_webp(cut_c.resize((cut_c.width * 1300 // cut_c.height, 1300), Image.LANCZOS), "hero-cut-m.webp", q=84)

    # Wall shadow as a multiply layer: photo / lit wall colour, white where the wall is fully lit.
    src = Image.open(MAIN).convert("RGB")
    W, H = cut.size
    C = np.asarray(src.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
    a = np.asarray(cut, dtype=np.float32)[..., 3] / 255
    bg = (a < 0.02)
    lit = bg & (C[..., 1] > 0.49)

    def nconv(img, wgt, sig):
        num = ndi.gaussian_filter(img * wgt[..., None], (sig, sig, 0))
        den = ndi.gaussian_filter(wgt.astype(np.float32), sig)[..., None]
        return num / np.maximum(den, 1e-4)

    wall = nconv(C, lit.astype(np.float32), 60)
    ratio = np.clip(C / np.maximum(wall, 1e-3), 0, 1)
    # under the body, continue the shadow from the nearby wall; deep inside, no shadow at all
    fill = nconv(ratio, bg.astype(np.float32), 22)
    reach = ndi.gaussian_filter(bg.astype(np.float32), 22)[..., None]
    fill = fill * np.clip(reach / 0.08, 0, 1) + (1 - np.clip(reach / 0.08, 0, 1))
    ratio = np.where(bg[..., None], ratio, fill)
    ratio = ndi.gaussian_filter(ratio, (2.0, 2.0, 0))
    sh = Image.fromarray((ratio * 255 + 0.5).astype(np.uint8)).crop(box)
    # fade to white at the crop edges so the layer never shows a rectangle
    fw = 40
    yy, xx = np.mgrid[0:sh.height, 0:sh.width]
    edge = np.minimum.reduce([xx, yy, sh.width - 1 - xx, sh.height - 1 - yy]).astype(np.float32)
    f = np.clip(edge / fw, 0, 1)[..., None]
    sha = np.asarray(sh, dtype=np.float32) * f + 255 * (1 - f)
    sh = Image.fromarray(sha.astype(np.uint8))
    save_webp(sh, "hero-shadow.webp", q=70)
    save_webp(sh.resize((sh.width * 1300 // sh.height, 1300), Image.LANCZOS), "hero-shadow-m.webp", q=70)

    # Whole photo, for share cards and the no-WebGL fallback.
    save_webp(src.resize((src.width * 1600 // src.height, 1600), Image.LANCZOS), "main.webp", q=80)

    # Round avatar for the live-stream header.
    cx, cy, r = 1935, 1330, 300
    av = src.crop((cx - r, cy - r, cx + r, cy + r)).resize((160, 160), Image.LANCZOS)
    save_webp(av, "avatar.webp", q=84)
    return cut_c


def featured():
    for k, p in REF.items():
        im = Image.open(p).convert("RGB")
        if im.height > 1600:
            im = im.resize((im.width * 1600 // im.height, 1600), Image.LANCZOS)
        save_webp(im, f"f-{k}.webp", q=80)


def pdf_thumbs():
    import pymupdf
    pdf = [os.path.join(SRC, f) for f in os.listdir(SRC)
           if unicodedata.normalize("NFC", f).startswith("TalkFile_쇼호스트")][0]
    doc = pymupdf.open(pdf)
    names = {}
    for pi in range(2, 7):                      # PDF pages 3-7 hold four broadcast stills each
        page = doc[pi]
        imgs = []
        for img in page.get_images(full=True):
            rect = page.get_image_rects(img[0])[0]
            imgs.append((rect.x0, img[0]))
        for col, (_, xref) in enumerate(sorted(imgs)):
            data = doc.extract_image(xref)["image"]
            im = Image.open(io.BytesIO(data)).convert("RGB")
            name = f"t-p{pi + 1}-{col + 1}.webp"
            save_webp(im, name, q=82)
            names[(pi + 1, col + 1)] = name
    # Stills the user also sent as originals: use the sharper originals, cropped to the 5:8 card.
    for k, (page, col) in {"lg": (6, 1), "polo": (3, 3), "satin": (4, 1)}.items():
        im = Image.open(REF[k]).convert("RGB")
        w, h = im.size
        tw, th = (w, w * 8 // 5) if w * 8 // 5 <= h else (h * 5 // 8, h)
        top = {"lg": 120, "polo": 150, "satin": 0}[k]
        left = (w - tw) // 2
        im = im.crop((left, min(top, h - th), left + tw, min(top, h - th) + th)).resize((720, 1152), Image.LANCZOS)
        save_webp(im, f"t-p{page}-{col}.webp", q=80)


def og_image(cut_c):
    W, H = 1200, 630
    og = Image.new("RGB", (W, H), (254, 134, 170))
    sh = Image.open(os.path.join(OUT, "hero-shadow.webp")).convert("RGB")
    scale = 600 / sh.height
    sw = int(sh.width * scale)
    x0 = W - sw - 40
    shr = np.asarray(sh.resize((sw, 600), Image.LANCZOS), dtype=np.float32) / 255
    base = np.asarray(og, dtype=np.float32)
    base[30:630, x0:x0 + sw] *= shr
    og = Image.fromarray(base.astype(np.uint8))
    cr = cut_c.resize((sw, 600), Image.LANCZOS)
    og.paste(cr, (x0, 30), cr)
    d = ImageDraw.Draw(og)
    big = ImageFont.truetype(OTF, 112)
    mid = ImageFont.truetype(OTF, 30)
    d.rounded_rectangle((70, 120, 178, 162), 21, fill=(255, 45, 85))
    d.ellipse((86, 134, 100, 148), fill="white")
    d.text((108, 124), "LIVE", font=ImageFont.truetype(OTF, 30), fill="white")
    d.text((66, 190), "쇼호스트", font=big, fill=(34, 50, 79))
    d.text((66, 310), "이채원", font=big, fill="white")
    d.text((72, 452), "매출로 이어지는 진행,", font=mid, fill=(34, 50, 79))
    d.text((72, 494), "브랜드를 빛내는 소통", font=mid, fill=(34, 50, 79))
    path = os.path.join(ROOT, "chaewon", "og.jpg")
    og.save(path, "JPEG", quality=86, optimize=True, progressive=True)
    print("og.jpg", os.path.getsize(path) // 1024, "KB")


if __name__ == "__main__":
    cut = hero_layers()
    featured()
    pdf_thumbs()
    og_image(cut)

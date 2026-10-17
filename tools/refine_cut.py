"""Refine a Vision subject mask shot on a flat-colour backdrop.

- key backdrop holes the mask filled in, but only inside the given boxes
- tighten the edge, re-estimate alpha in a thin band from the colour line
  between the local backdrop and local subject colours, and remove spill
"""
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src_path, mask_path, out_path, scale = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
key_boxes = json.loads(sys.argv[5]) if len(sys.argv) > 5 else []   # [[x0,y0,x1,y1], ...] full-res px

src = Image.open(src_path).convert("RGB")
W, H = int(src.width * scale), int(src.height * scale)
C = np.asarray(src.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
m = np.asarray(Image.open(mask_path).convert("L").resize((W, H), Image.LANCZOS), dtype=np.float32) / 255

mx = C.max(2); mn = C.min(2); d = mx - mn + 1e-6
r, g, b = C[..., 0], C[..., 1], C[..., 2]
h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
s = d / (mx + 1e-6)
pink = ((h > 0.86) | (h < 0.02)) & (s > 0.40) & (mx > 0.30)
allow = np.zeros((H, W), bool)
for x0, y0, x1, y1 in key_boxes:
    allow[int(y0 * scale):int(y1 * scale), int(x0 * scale):int(x1 * scale)] = True
holes = ndi.gaussian_filter((pink & allow).astype(np.float32), 1.0)
a = m * (1 - np.clip(holes * 1.5, 0, 1))
a = np.clip((a - 0.28) / (0.92 - 0.28), 0, 1); a = a * a * (3 - 2 * a)

def nconv(img, wgt, sig):
    num = ndi.gaussian_filter(img * wgt[..., None], (sig, sig, 0))
    den = ndi.gaussian_filter(wgt, sig)[..., None]
    return num / np.maximum(den, 1e-4)

solid = a > 0.5
band = (ndi.distance_transform_edt(solid) <= 7 * scale * 2) & (ndi.distance_transform_edt(~solid) <= 3 * scale * 2)
B = nconv(C, (m < 0.02).astype(np.float32), 18)
F = nconv(C, ((a > 0.985) & ~band).astype(np.float32), 6)
FB = F - B
n2 = (FB ** 2).sum(2)
ac = np.clip(((C - B) * FB).sum(2) / np.maximum(n2, 1e-4), 0, 1)
ac = ndi.gaussian_filter(ac, 0.7)
use = band & (n2 > 0.30 ** 2)                         # skip skin, whose colour is too close to the backdrop
a = np.where(use, np.minimum(a, ac), a)

al = np.maximum(a, 1e-3)[..., None]
Fs = np.clip((C - (1 - al) * B) / al, 0, 1)
w = np.clip((a[..., None] - 0.15) / 0.6, 0, 1)
fix = ((a < 0.985) | band)[..., None]
out = np.where(fix, w * Fs + (1 - w) * F, C)

Image.fromarray((np.dstack([out, a]) * 255 + 0.5).astype(np.uint8), "RGBA").save(out_path)
ys, xs = np.where(a > 0.02)
print("saved", out_path, (W, H), "bbox", xs.min(), ys.min(), xs.max(), ys.max())

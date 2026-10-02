"""2D coordinate drawings of the BandFlow slim case. Run: python3 coordinate_drawing.py
  bandflow_coordinates_top_view.png   top view (looking at the screen)
  bandflow_coordinates_side_views.png port end view + toggle side view (z positions)"""
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, Circle, FancyArrowPatch

L, W, H, C, WALL = 77, 35, 14, 0.2, 1.2
O = C + WALL
SY = (W - 31) / 2                      # screen top edge, centred in y
PY, PZ = 16.5 - 5.14, -7.4 - 2.35        # port centre (y, z): spans y 6.22 .. 16.5
TX, TZ = 18 + 3.5, -5 - 1.9           # toggle centre (x, z)
LUG_OUT = 5.9
INK, BLUE, RED, GREEN, ORANGE, GREY = "#1a1a1a", "#1f5fbf", "#d62728", "#2a8f3a", "#e07b00", "#8a8a8a"

def dim(ax, p0, p1, text, off=(0, 0), color=INK, fs=9, **kw):
    ax.add_patch(FancyArrowPatch(p0, p1, arrowstyle="<->", mutation_scale=8, lw=1.0, color=color))
    ax.text((p0[0] + p1[0]) / 2 + off[0], (p0[1] + p1[1]) / 2 + off[1], text, color=color, fontsize=fs,
            ha="center", va="center", fontweight="bold", bbox=dict(fc="white", ec="none", pad=0.8), **kw)

# ============================ TOP VIEW ============================
fig, ax = plt.subplots(figsize=(15, 7.6))
ax.set_title("BandFlow slim case - TOP VIEW (looking at the screen)      origin (0,0) = top-left corner of the safe zone      x -> right, y -> down      mm",
             fontsize=11.5, loc="left", fontweight="bold")
for xc in (L / 2 - 12.5, L / 2 + 12.5):                       # strap lugs (long sides)
    for y0 in (-O - LUG_OUT, W + O):
        ax.add_patch(Rectangle((xc - 1.5, y0), 3, LUG_OUT, fc="#e4e4e4", ec="#bdbdbd", lw=0.8))
for sx in (L / 2 - 30, L / 2 + 30):                           # screw pads
    for top in (True, False):
        ax.add_patch(Rectangle((sx - 4, -O - 2.8 if top else W + O), 8, 2.8, fc="#efefef", ec="#bdbdbd", lw=0.8))
ax.add_patch(Rectangle((-O, -O), L + 2 * O, W + 2 * O, fc="#f6f6f6", ec=INK, lw=1.6))
ax.add_patch(Rectangle((0, 0), L, W, fc="white", ec=BLUE, lw=2.0))
ax.add_patch(Rectangle((8 - C, SY - C), 58 + 2 * C, 31 + 2 * C, fc="#dbe9ff", ec=RED, lw=1.6))
ax.add_patch(Rectangle((8, SY), 58, 31, fc="none", ec=RED, lw=0.9, ls=":"))
pw, tw = 10.28 + 2 * C, 7 + 2 * C
ax.add_patch(Rectangle((L, PY - pw / 2), O + 0.01, pw, fc=GREEN, ec=GREEN))
ax.add_patch(Rectangle((TX - tw / 2, W), tw, O + 0.01, fc=ORANGE, ec=ORANGE))
ax.plot([L], [16.5], "s", color="white", mec=GREEN, ms=7, mew=2, zorder=5); ax.plot([18], [W], "s", color="white", mec=ORANGE, ms=7, mew=2, zorder=5)
ax.plot([0], [0], "k+", ms=16, mew=2.2)
ax.annotate("(0, 0)", (0, 0), xytext=(-5, -5), fontsize=11, fontweight="bold", ha="right", va="bottom")

ax.text(37, 20, "SCREEN WINDOW\ntop-left corner (8, 2)\nsize 58 x 31 (centred in y)\n(cut opening 58.4 x 31.4)", color=RED, ha="center", va="center", fontsize=11, fontweight="bold")
dim(ax, (0, SY + 2), (8, SY + 2), "8", color=RED, off=(0, -1.2))
dim(ax, (3, 0), (3, SY), "2", color=RED, off=(-1.4, 0)); dim(ax, (3, SY + 31), (3, W), "2", color=RED, off=(-1.4, 0))
dim(ax, (8, 6.5), (66, 6.5), "58", color=RED)
dim(ax, (62, SY), (62, SY + 31), "31", color=RED)
ax.text(L - 0.8, W - 0.6, "safe zone 77 x 35", color=BLUE, fontsize=9.5, ha="right", va="bottom", fontweight="bold")

dim(ax, (0, -O - 8.5), (L, -O - 8.5), "77", color=BLUE)
dim(ax, (-O - 5, 0), (-O - 5, W), "35", color=BLUE)
for x in range(0, L + 1, 10): ax.text(x, -O - 11, str(x), ha="center", fontsize=7.5, color=GREY)
for y in range(0, W + 1, 5): ax.text(-O - 9.5, y, str(y), ha="right", va="center", fontsize=7.5, color=GREY)

dim(ax, (L + 9.5, 0), (L + 9.5, 16.5), "16.5", color=GREEN); dim(ax, (L + 3.5, 16.5 - 10.28), (L + 3.5, 16.5), "10.28", color=GREEN)
ax.text(L + 13, 16.5, "CHARGING PORT (right end face)\nmeasured point (77, 16.5, z -7.4) = one edge\n10.28 along y  (cut +0.4)\nspans y 6.22 -> 16.5", color=GREEN, fontsize=10.5, va="center", fontweight="bold")
dim(ax, (0, W + O + 5), (18, W + O + 5), "18", color=ORANGE, off=(0, -1.3)); dim(ax, (18, W + O + 5), (25, W + O + 5), "7", color=ORANGE, off=(0, -1.3))
ax.text(18, W + O + 8.5, "ON/OFF TOGGLE (bottom long face)\ntop-left corner (18, 35, z -5)   7 along x  (cut +0.4)\nspans x 18 -> 25", color=ORANGE, fontsize=10.5, ha="center", va="top", fontweight="bold")
ax.text(L / 2, -O - 14.5, "outer shell = safe zone + 0.2 clearance + 1.2 wall = 1.4 mm on every side.   Grey tabs = strap lugs and screw pads.", ha="center", fontsize=9, color=GREY)
ax.set_xlim(-18, L + 40); ax.set_ylim(W + 22, -17); ax.set_aspect("equal"); ax.axis("off")
fig.text(0.01, 0.01, "blue = safe zone (your measurements)    red = screen window    green = charging port    orange = toggle    black = outer shell", fontsize=9.5)
fig.savefig("bandflow_coordinates_top_view.png", dpi=120, bbox_inches="tight", facecolor="white"); plt.close(fig)

# ============================ SIDE VIEWS ============================
fig, (a1, a2) = plt.subplots(1, 2, figsize=(15, 5), gridspec_kw=dict(width_ratios=[W + 31, L + 31]))
def frame(a, span, title):
    a.set_title(title, fontsize=10.5, loc="left", fontweight="bold")
    a.add_patch(Rectangle((-O, -(C + 1.0)), span + 2 * O, H + 2 * C + 1.0 + 1.4, fc="#f6f6f6", ec=INK, lw=1.4))
    a.add_patch(Rectangle((0, 0), span, H, fc="white", ec=BLUE, lw=2.0))
    a.text(span + O + 0.8, 0, "z = 0 (screen face)", fontsize=8, color=BLUE, ha="left", va="center")
    a.text(span + O + 0.8, H, "z = -14 (back)", fontsize=8, color=BLUE, ha="left", va="center")
    dim(a, (0, -4), (span, -4), "%g" % span, color=BLUE)
    dim(a, (-5, 0), (-5, H), "14", color=BLUE)
    a.set_ylim(H + 5, -8); a.set_aspect("equal"); a.axis("off")
frame(a1, W, "RIGHT END FACE (x = 77) - charging port\ny -> right, z -> down")
a1.add_patch(Rectangle((PY - 5.14 - C, 7.4 - C), 10.28 + 2 * C, 4.7 + 2 * C, fc="#c8efd0", ec=GREEN, lw=1.8))
a1.plot([16.5], [7.4], "s", color="white", mec=GREEN, ms=7, mew=2)
a1.text(16.5 + 3, 5.0, "PORT 10.28 x 4.7\nspans y 6.22 -> 16.5\nand z -7.4 -> -12.1", color=GREEN, ha="left", va="center", fontsize=7.5, fontweight="bold")
dim(a1, (0, 15.2), (16.5, 15.2), "16.5", color=GREEN, off=(0, 1.2)); dim(a1, (3, 0), (3, 7.4), "7.4", color=GREEN, off=(2.0, 0))
a1.set_xlim(-9, W + 22)
frame(a2, L, "BOTTOM LONG FACE (y = 35) - toggle\nx -> right, z -> down")
a2.add_patch(Rectangle((18 - C, 5 - C), 7 + 2 * C, 3.8 + 2 * C, fc="#ffe2bd", ec=ORANGE, lw=1.8))
a2.plot([18], [5], "s", color="white", mec=ORANGE, ms=7, mew=2)
a2.text(26.5, 5 + 1.9, "TOGGLE 7 x 3.8   top-left (x 18, z -5)", color=ORANGE, va="center", fontsize=9, fontweight="bold")
dim(a2, (0, 10.8), (18, 10.8), "18", color=ORANGE, off=(0, 1.2)); dim(a2, (-2.8, 0), (-2.8, 5), "5", color=ORANGE, off=(-1.6, 0))
for xc in (L / 2 - 12.5, L / 2 + 12.5):
    a2.add_patch(Rectangle((xc - 1.5, H - 4.6), 3, 4.6, fc="#cfcfcf", ec=GREY, lw=0.9))
a2.text(L / 2 + 12.5 + 3, H - 2.3, "strap lugs (below the toggle level)", fontsize=8, color=GREY, ha="left", va="center")
a2.set_xlim(-9, L + 22)
fig.savefig("bandflow_coordinates_side_views.png", dpi=120, bbox_inches="tight", facecolor="white")
print("saved")

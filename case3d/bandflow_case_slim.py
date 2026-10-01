"""BandFlow SLIM watch case (CadQuery): thinnest practical FDM version, no styling.
Run: python3 bandflow_case_slim.py   (same coordinate system as bandflow_case.py)
Walls 1.2 mm (3 perimeters @0.4 nozzle), top plate 1.0, back plate 1.4, M1.6 screws in 4 small pads.
"""
import cadquery as cq, os

L, W, H = 77.0, 35.0, 15.0           # safe zone
C = 0.2                               # clearance per side
WALL = 1.2                            # all four side walls
TOP_T, BACK_T = 1.0, 1.4              # plate over the screen, back plate
R_PLAN = 2.0                          # small plan corner radius (max ~2.1 keeps corners >= 0.8 mm)
LUG_W, STRAP = 3.0, 22.0
PAD_X, PAD_OUT = 8.0, 4.0             # screw pad width, pad depth measured from the cavity edge
SCREW_DX = 30.0

cx, cy = L / 2, -W / 2
cav = (L + 2 * C, W + 2 * C)
z_top_cav, z_bot_cav = C, -H - C
z_top, z_back = z_top_cav + TOP_T, z_bot_cav
OW, OH = cav[0] + 2 * WALL, cav[1] + 2 * WALL

def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))

def outline(w, h, r, z0, z1):
    return cq.Workplane("XY").workplane(offset=z0).center(cx, cy).rect(w, h).extrude(z1 - z0).edges("|Z").fillet(r)

shell = outline(OW, OH, R_PLAN, z_back, z_top)

# screw pads (small local thickening of the long walls only)
screws = []
for sx in (-SCREW_DX, SCREW_DX):
    for sgn in (1, -1):
        px, py = cx + sx, cy + sgn * (cav[1] / 2 + PAD_OUT / 2)
        screws.append((px, py))
        y_in = cy + sgn * (cav[1] / 2)
        y_out = cy + sgn * (cav[1] / 2 + PAD_OUT)
        pad = box(px - PAD_X / 2, px + PAD_X / 2, min(y_in, y_out), max(y_in, y_out), z_back, -5.5).edges("|Z").fillet(1.0)
        shell = shell.union(pad)

# lugs on the two long sides (same shape as the styled case, thinner)
def lug(yc):
    prof = (cq.Workplane("XZ").workplane(offset=-(yc + LUG_W / 2))
            .moveTo(3.0, 0.6).spline([(-3.0, 0.4), (-8.0, -2.0), (-10.6, -5.0)], includeCurrent=True)
            .threePointArc((-11.0, -7.6), (-9.2, -10.2))
            .spline([(-5.0, -12.6), (3.0, -13.6)], includeCurrent=True).close().extrude(LUG_W))
    hole = cq.Workplane("XZ").workplane(offset=-(yc + LUG_W)).center(-7.2, -6.2).circle(0.9).extrude(LUG_W * 2)
    return prof.cut(hole)
off = STRAP / 2 + LUG_W / 2
base = None
for yc in (off, -off):
    l = lug(yc).translate((-OH / 2 + 3.2, 0, 0))
    base = l if base is None else base.union(l)
base = base.rotate((0, 0, 0), (0, 0, 1), 90).translate((cx, cy, 0))
shell = shell.union(base).union(base.mirror("XZ", basePointVector=(0, cy, 0)))

# cavity + screen window
shell = shell.cut(box(cx - cav[0] / 2, cx + cav[0] / 2, cy - cav[1] / 2, cy + cav[1] / 2, z_bot_cav, z_top_cav))
wx, wy = 58 + 2 * C, 31 + 2 * C
wcx, wcy = 8 + 58 / 2, -(3 + 31 / 2)
shell = shell.cut(box(wcx - wx / 2, wcx + wx / 2, wcy - wy / 2, wcy + wy / 2, z_top_cav - 0.1, z_top + 0.1))

# charging port (right end) and toggle (bottom long face), small 0.5 lead-in
pw, ph = 10.28 + 2 * C, 4.7 + 2 * C
x_out = cx + OW / 2
shell = shell.cut(box(L - 0.5, x_out + 1, -16.5 - pw / 2, -16.5 + pw / 2, -9 - ph / 2, -9 + ph / 2))
shell = shell.cut(cq.Workplane("YZ").workplane(offset=x_out - 0.5).center(-16.5, -9).rect(pw, ph)
                  .workplane(offset=0.5).rect(pw + 1, ph + 1).loft(combine=True))
tw, th = 7 + 2 * C, 3.8 + 2 * C
y_out = cy - OH / 2
shell = shell.cut(box(18 - tw / 2, 18 + tw / 2, y_out - 1, -W + 0.5, -5 - th / 2, -5 + th / 2))
shell = shell.cut(cq.Workplane("XZ").workplane(offset=-y_out - 0.5).center(18, -5).rect(tw, th)
                  .workplane(offset=0.5).rect(tw + 1, th + 1).loft(combine=True))

# M1.6 pilot holes (1.4 mm, 8 mm deep)
for (sx, sy) in screws:
    shell = shell.cut(cq.Workplane("XY").workplane(offset=z_back - 0.1).center(sx, sy).circle(0.7).extrude(8.1))

# ---------------- back plate ----------------
zb0 = z_back - BACK_T
back = outline(OW, OH, R_PLAN, zb0, z_back)
for sx in (-SCREW_DX, SCREW_DX):
    for sgn in (1, -1):
        px = cx + sx
        y_in = cy + sgn * (cav[1] / 2)
        y_out = cy + sgn * (cav[1] / 2 + PAD_OUT)
        back = back.union(box(px - PAD_X / 2, px + PAD_X / 2, min(y_in, y_out), max(y_in, y_out), zb0, z_back).edges("|Z").fillet(1.0))
for (sx, sy) in screws:
    back = back.cut(cq.Workplane("XY").workplane(offset=zb0 - 0.1).center(sx, sy).circle(0.9).extrude(BACK_T + 0.2))
    back = back.cut(cq.Workplane("XY").add(cq.Solid.makeCone(1.6, 0.9, 0.7, pnt=cq.Vector(sx, sy, zb0), dir=cq.Vector(0, 0, 1))))

# ---------------- verification ----------------
safe = box(0, L, -W, 0, -H, 0)
v = lambda s: s.val().Volume()
bb = shell.union(back).val().BoundingBox()
print("slim case: %.1f x %.1f x %.1f mm incl. lugs/pads  [old styled: 83.4 x 59.1 x 19.2]" % (bb.xlen, bb.ylen, bb.zlen))
print("body width without lugs/pads: %.1f, with pads: %.1f" % (OH, OH + 2 * (PAD_OUT - WALL)))
print("safe-zone overlap shell/back (must be 0): %.4f / %.4f" % (v(safe.intersect(shell)), v(safe.intersect(back))))
exact = [box(8, 66, -34, -3, 0, 5), box(L - 0.01, x_out + 2, -16.5 - 5.14, -16.5 + 5.14, -9 - 2.35, -9 + 2.35),
         box(18 - 3.5, 18 + 3.5, -W - 5, -W + 0.01, -5 - 1.9, -5 + 1.9)]
print("exact openings blocked (must be 0):", [round(v(o.intersect(shell)), 4) for o in exact])
print("valid: shell=%s back=%s  solids=%d/%d" % (shell.val().isValid(), back.val().isValid(), len(shell.solids().vals()), len(back.solids().vals())))

out = os.path.dirname(os.path.abspath(__file__))
tp = shell.rotate((0, 0, 0), (1, 0, 0), 180); tp = tp.translate((0, 0, -tp.val().BoundingBox().zmin))
bp = back.translate((0, 0, -back.val().BoundingBox().zmin))
kw = dict(tolerance=0.02, angularTolerance=0.1)
cq.exporters.export(tp, os.path.join(out, "bandflow_slim_top.stl"), **kw)
cq.exporters.export(bp, os.path.join(out, "bandflow_slim_back.stl"), **kw)
cq.exporters.export(shell.union(back), os.path.join(out, "bandflow_slim_assembled.stl"), **kw)
cq.exporters.export(shell, os.path.join(out, "bandflow_slim_top.step")); cq.exporters.export(back, os.path.join(out, "bandflow_slim_back.step"))

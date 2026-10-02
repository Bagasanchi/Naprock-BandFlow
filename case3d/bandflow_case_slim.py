"""BandFlow SLIM watch case (CadQuery): thinnest practical FDM version, no styling.
Run: python3 bandflow_case_slim.py   (same coordinate system as bandflow_case.py)
Walls 1.2 mm (3 perimeters @0.4 nozzle), top plate 1.0, back plate 1.4, M1.6 screws in 4 small pads.
"""
import cadquery as cq, os

L, W, H = 77.0, 35.0, 14.0           # safe zone
C = 0.2                               # clearance per side
WALL = 1.2                            # all four side walls
TOP_T, BACK_T = 1.0, 1.4              # plate over the screen, back plate
R_PLAN = 2.0                          # small plan corner radius (max ~2.1 keeps corners >= 0.8 mm)
LUG_W, STRAP = 3.0, 22.0
PAD_X, PAD_OUT = 8.0, 4.0             # screw pad width, pad depth measured from the cavity edge
SCREW_DX = 30.0

cx, cy = L / 2, -W / 2

# window positions. The measured (x, y, z) is the window's top-left corner (z measured down from the screen face).
SCREEN_TL, SCREEN_WH = (8.0, (W - 31.0) / 2), (58.0, 31.0)       # y centred in the 35 mm safe zone -> top edge at 2.0
PORT_TL, PORT_WH = (16.5, -9.0 + 1.6), (10.28, 4.7)      # z measured -9.0, moved up 1.6 -> -7.4                    # right end face: (y, z), (w along y, h along z)
                                                                 # port centre = measured y - 5.14 (shifted toward y = 0): spans y 6.22 .. 16.5
TOG_TL, TOG_WH = (18.0, -5.0), (7.0, 3.8)                        # bottom long face: (x, z), (w along x, h along z)
PORT_Y, PORT_Z = PORT_TL[0] - PORT_WH[0] / 2, PORT_TL[1] - PORT_WH[1] / 2     # centres
TOG_X, TOG_Z = TOG_TL[0] + TOG_WH[0] / 2, TOG_TL[1] - TOG_WH[1] / 2
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
        pad = box(px - PAD_X / 2, px + PAD_X / 2, min(y_in, y_out), max(y_in, y_out), z_back, -5.0).edges("|Z").fillet(1.0)
        shell = shell.union(pad)

# small strap lugs on the two long sides, kept BELOW the toggle window (top of the lug at z = -9.6, toggle window ends at -9.0)
LUG_R = 2.3
HOLE_Z = z_back + LUG_R
def lug(yc):
    cxh = -6.8                                           # hole centre, 3.6 mm beyond the wall (x relative to the end face)
    prof = (cq.Workplane("XZ").workplane(offset=-(yc + LUG_W / 2))
            .moveTo(3.0, HOLE_Z + LUG_R).lineTo(cxh, HOLE_Z + LUG_R)
            .threePointArc((cxh - LUG_R, HOLE_Z), (cxh, HOLE_Z - LUG_R))
            .lineTo(3.0, z_back).close().extrude(LUG_W))
    hole = cq.Workplane("XZ").workplane(offset=-(yc + LUG_W)).center(cxh, HOLE_Z).circle(0.9).extrude(LUG_W * 2)
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
wx, wy = SCREEN_WH[0] + 2 * C, SCREEN_WH[1] + 2 * C
wcx, wcy = SCREEN_TL[0] + SCREEN_WH[0] / 2, -(SCREEN_TL[1] + SCREEN_WH[1] / 2)
shell = shell.cut(box(wcx - wx / 2, wcx + wx / 2, wcy - wy / 2, wcy + wy / 2, z_top_cav - 0.1, z_top + 0.1))

# charging port (right end) and toggle (bottom long face), small 0.5 lead-in
pw, ph = PORT_WH[0] + 2 * C, PORT_WH[1] + 2 * C
x_out = cx + OW / 2
shell = shell.cut(box(L - 0.5, x_out + 1, -PORT_Y - pw / 2, -PORT_Y + pw / 2, PORT_Z - ph / 2, PORT_Z + ph / 2))
shell = shell.cut(cq.Workplane("YZ").workplane(offset=x_out - 0.5).center(-PORT_Y, PORT_Z).rect(pw, ph)
                  .workplane(offset=0.5).rect(pw + 1, ph + 1).loft(combine=True))
tw, th = TOG_WH[0] + 2 * C, TOG_WH[1] + 2 * C
y_out = cy - OH / 2
shell = shell.cut(box(TOG_X - tw / 2, TOG_X + tw / 2, y_out - 1, -W + 0.5, TOG_Z - th / 2, TOG_Z + th / 2))
shell = shell.cut(cq.Workplane("XZ").workplane(offset=-y_out - 0.5).center(TOG_X, TOG_Z).rect(tw, th)
                  .workplane(offset=0.5).rect(tw + 1, th + 1).loft(combine=True))

# M1.6 pilot holes (1.4 mm, 7 mm deep; use M1.6 x 6 mm screws)
for (sx, sy) in screws:
    shell = shell.cut(cq.Workplane("XY").workplane(offset=z_back - 0.1).center(sx, sy).circle(0.7).extrude(7.1))

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
exact = [box(SCREEN_TL[0], SCREEN_TL[0] + 58, -(SCREEN_TL[1] + 31), -SCREEN_TL[1], 0, 5),
         box(L - 0.01, x_out + 2, -PORT_Y - PORT_WH[0] / 2, -PORT_Y + PORT_WH[0] / 2, PORT_Z - PORT_WH[1] / 2, PORT_Z + PORT_WH[1] / 2),
         box(TOG_X - TOG_WH[0] / 2, TOG_X + TOG_WH[0] / 2, -W - 5, -W + 0.01, TOG_Z - TOG_WH[1] / 2, TOG_Z + TOG_WH[1] / 2)]
lugtop = HOLE_Z + LUG_R
print("lug top z=%.1f vs toggle window bottom z=%.1f (lug must be lower); toggle x %.1f..%.1f, lug x %.1f..%.1f" % (lugtop, TOG_Z - TOG_WH[1] / 2 - C, TOG_X - TOG_WH[0] / 2 - C, TOG_X + TOG_WH[0] / 2 + C, cx - STRAP / 2 - LUG_W, cx - STRAP / 2))
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

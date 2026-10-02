"""BandFlow watch case (CadQuery). Run: python3 bandflow_case.py
Coordinates: X right (0..77), Y UP in CAD = -y of the measurement sheet (screen y 0..35 downwards),
Z: screen face z=0, back z=-15. Safe zone = x 0..77, y -35..0, z -15..0.
"""
import cadquery as cq, math, os

# ---------------- parameters (mm) ----------------
L, W, H = 77.0, 35.0, 15.0           # safe zone
C = 0.2                               # clearance per side (change for your printer)
WALL_END, WALL_LONG = 3.0, 4.0        # end walls / long walls (long walls carry the screws)
TOP_T, BACK_T = 1.6, 2.2              # top plate over the screen, back plate thickness
R_PLAN = 7.0                          # plan-view corner radius
LUG_W, STRAP = 4.2, 22.0              # lug thickness, strap width

cx, cy = L / 2, -W / 2
cav = (L + 2 * C, W + 2 * C)
z_top_cav, z_bot_cav = C, -H - C
z_top, z_back = z_top_cav + TOP_T, z_bot_cav
OW, OH = cav[0] + 2 * WALL_END, cav[1] + 2 * WALL_LONG

def box(x0, x1, y0, y1, z0, z1):
    return cq.Workplane("XY").box(x1 - x0, y1 - y0, z1 - z0, centered=False).translate((x0, y0, z0))

def outline(w, h, r, z0, z1):
    return (cq.Workplane("XY").workplane(offset=z0).center(cx, cy).rect(w, h).extrude(z1 - z0)
            .edges("|Z").fillet(r))

# ---------------- top shell ----------------
shell = outline(OW, OH, R_PLAN, z_back, z_top).faces(">Z").edges().fillet(1.2)

# accent line around the side (0.4 deep) near the parting line
ring = outline(OW + 2, OH + 2, R_PLAN + 1, -14.2, -13.7).cut(outline(OW - 0.8, OH - 0.8, R_PLAN - 0.4, -14.3, -13.6))
shell = shell.cut(ring)

# sculpted integrated lugs (profile in XZ, built for an end face, then rotated), spring-bar holes
def lug(yc):
    prof = (cq.Workplane("XZ").workplane(offset=-(yc + LUG_W / 2))
            .moveTo(3.0, 1.0)
            .spline([(-3.0, 0.7), (-8.0, -1.8), (-10.6, -5.0)], includeCurrent=True)
            .threePointArc((-11.0, -7.6), (-9.2, -10.2))
            .spline([(-5.0, -12.6), (3.0, -13.6)], includeCurrent=True)
            .close().extrude(LUG_W))
    hole = cq.Workplane("XZ").workplane(offset=-(yc + LUG_W)).center(-7.2, -6.2).circle(0.9).extrude(LUG_W * 2)
    return prof.cut(hole)
off = STRAP / 2 + LUG_W / 2
# lugs sit on the two long sides (strap runs across the short axis, screen reads landscape)
shift = -OH / 2 - (-3.2)               # profile is drawn for an outer face at x=-3.2
base = None
for yc in (off, -off):
    l = lug(yc).translate((shift, 0, 0))
    base = l if base is None else base.union(l)
base = base.rotate((0, 0, 0), (0, 0, 1), 90).translate((cx, cy, 0))     # outer face -> bottom long side
other = base.mirror("XZ", basePointVector=(0, cy, 0))                   # top long side
shell = shell.union(base).union(other)

# cavity (safe zone + clearance)
shell = shell.cut(box(cx - cav[0] / 2, cx + cav[0] / 2, cy - cav[1] / 2, cy + cav[1] / 2, z_bot_cav, z_top_cav))

# screen window + chamfered bezel + floating groove
wx, wy = 58 + 2 * C, 31 + 2 * C
wcx, wcy = 8 + 58 / 2, -(3 + 31 / 2)
shell = shell.cut(box(wcx - wx / 2, wcx + wx / 2, wcy - wy / 2, wcy + wy / 2, z_top_cav - 0.1, z_top + 0.1))
bez = (cq.Workplane("XY").workplane(offset=z_top - 0.6).center(wcx, wcy).rect(wx, wy)
       .workplane(offset=0.6).rect(wx + 1.2, wy + 1.2).loft(combine=True))
shell = shell.cut(bez)
g_out, g_in = (wx + 5, wy + 5), (wx + 3.8, wy + 3.8)
groove = box(wcx - g_out[0] / 2, wcx + g_out[0] / 2, wcy - g_out[1] / 2, wcy + g_out[1] / 2, z_top - 0.4, z_top + 1)\
    .cut(box(wcx - g_in[0] / 2, wcx + g_in[0] / 2, wcy - g_in[1] / 2, wcy + g_in[1] / 2, z_top - 0.5, z_top + 2))
shell = shell.cut(groove)

# charging port (right end face, centre y=16.5 z=-9, 10.28 x 4.7) with lead-in chamfer
pw, ph = 10.28 + 2 * C, 4.7 + 2 * C
x_out = cx + OW / 2
shell = shell.cut(box(L - 0.5, x_out + 1, -16.5 - pw / 2, -16.5 + pw / 2, -9 - ph / 2, -9 + ph / 2))
shell = shell.cut(cq.Workplane("YZ").workplane(offset=x_out - 1.0).center(-16.5, -9).rect(pw, ph)
                  .workplane(offset=1.0).rect(pw + 2, ph + 2).loft(combine=True))

# on/off toggle (bottom long face y=35, centre x=18 z=-5, 7 x 3.8)
tw, th = 7 + 2 * C, 3.8 + 2 * C
y_out = cy - OH / 2
shell = shell.cut(box(18 - tw / 2, 18 + tw / 2, y_out - 1, -W + 0.5, -5 - th / 2, -5 + th / 2))
shell = shell.cut(cq.Workplane("XZ").workplane(offset=-y_out - 1.0).center(18, -5).rect(tw, th)
                  .workplane(offset=1.0).rect(tw + 2, th + 2).loft(combine=True))

# screw pilot holes (M2 self-tapping, 1.7 mm) in the long walls
screws = [(cx + sx, cy + sy) for sx in (-28, 28) for sy in (cav[1] / 2 + WALL_LONG / 2, -(cav[1] / 2 + WALL_LONG / 2))]
for (sx, sy) in screws:
    shell = shell.cut(cq.Workplane("XY").workplane(offset=z_back - 0.1).center(sx, sy).circle(0.85).extrude(9.1))

# ---------------- back plate ----------------
zb0 = z_back - BACK_T
back = outline(OW, OH, R_PLAN, zb0, z_back).faces("<Z").edges().chamfer(1.4)
for (sx, sy) in screws:
    back = back.cut(cq.Workplane("XY").workplane(offset=zb0 - 0.1).center(sx, sy).circle(1.15).extrude(BACK_T + 0.2))
    cone = cq.Solid.makeCone(2.1, 1.15, 0.95, pnt=cq.Vector(sx, sy, zb0), dir=cq.Vector(0, 0, 1))
    back = back.cut(cq.Workplane("XY").add(cone))
try:
    pl = cq.Plane(origin=(cx, cy, zb0), xDir=(1, 0, 0), normal=(0, 0, -1))
    txt = cq.Workplane(pl).text("BANDFLOW", 6, -0.4, kind="bold", halign="center", valign="center", combine=False)
    back = back.cut(txt)
except Exception as e:
    print("text skipped:", e)

# ---------------- verification ----------------
safe = box(0, L, -W, 0, -H, 0)
v = lambda s: s.val().Volume()
print("outer size: %.1f x %.1f x %.1f mm (lugs add ~11 on each long side)" % (OW, OH, z_top - zb0))
print("safe-zone overlap with shell (must be 0): %.4f mm3" % v(safe.intersect(shell)))
print("safe-zone overlap with back plate (must be 0): %.4f mm3" % v(safe.intersect(back)))
exact_openings = [box(8, 66, -34, -3, 0, 5),                       # screen
                  box(L - 0.01, x_out + 2, -16.5 - 5.14, -16.5 + 5.14, -9 - 2.35, -9 + 2.35),   # port exact
                  box(18 - 3.5, 18 + 3.5, -W - 5, -W + 0.01, -5 - 1.9, -5 + 1.9)]               # toggle exact
print("exact openings blocked by material (must be 0):", [round(v(o.intersect(shell)), 4) for o in exact_openings])
print("min cavity clearance per side: %.2f mm" % C)

# ---------------- export ----------------
out = os.path.dirname(os.path.abspath(__file__))
cq.exporters.export(shell, os.path.join(out, "bandflow_assembly_top.step"))
cq.exporters.export(back, os.path.join(out, "bandflow_assembly_back.step"))
top_print = shell.rotate((0, 0, 0), (1, 0, 0), 180)
bb = top_print.val().BoundingBox(); top_print = top_print.translate((0, 0, -bb.zmin))
bb2 = back.val().BoundingBox(); back_print = back.translate((0, 0, -bb2.zmin))
cq.exporters.export(top_print, os.path.join(out, "bandflow_top.stl"), tolerance=0.02, angularTolerance=0.1)
cq.exporters.export(back_print, os.path.join(out, "bandflow_back.stl"), tolerance=0.02, angularTolerance=0.1)
cq.exporters.export(shell.union(back), os.path.join(out, "bandflow_assembled.stl"), tolerance=0.02, angularTolerance=0.1)
print("exported")

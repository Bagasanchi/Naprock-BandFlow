"""BandFlow TPU strap (CadQuery). Run: python3 bandflow_strap.py
Two flat-printed parts (print flat, thin side down, 0.2 mm layers, TPU 95A):
  bandflow_strap_A.stl  buckle half  (tube end + frame with a snap post)
  bandflow_strap_B.stl  holed half   (tube end + adjustment holes)
Each strap end is a tube (bore 1.9 mm). A 1.75 mm filament / 1.5 mm steel rod goes through
lug hole -> strap tube -> lug hole and holds the strap on.
Local coords: u = along the strap (0 = tube centre), v = across the width, z = thickness (0 = bed).
"""
import cadquery as cq, os

LUG_GAP = 22.0                 # gap between the two lugs (STRAP in bandflow_case.py)
W = LUG_GAP - 0.4              # strap width 21.6 -> 0.2 mm free each side
T = 2.4                        # strap thickness
TUBE_R, TUBE_Z, BORE = 2.6, 2.0, 1.9
A_LEN = 55.0                   # tube centre -> frame (buckle half)
HOLE_D, HOLE_FIRST, HOLE_STEP, HOLE_N = 2.6, 55.0, 5.0, 9
B_TAIL = 18.0
B_LEN = HOLE_FIRST + HOLE_STEP * (HOLE_N - 1) + B_TAIL

def tube_end():
    t = cq.Workplane("XZ").workplane(offset=-W / 2).center(0, TUBE_Z).circle(TUBE_R).extrude(W)   # axis along Y
    t = t.intersect(cq.Workplane("XY").box(20, W, 10, centered=(True, True, False)))               # flat bottom at z=0
    bore = cq.Workplane("XZ").workplane(offset=-W / 2 - 1).center(0, TUBE_Z).circle(BORE / 2).extrude(W + 2)
    return t, bore

def strap_body(length):
    b = cq.Workplane("XY").box(length, W, T, centered=(False, True, False))
    return b.edges("|X").edges(">Z").fillet(0.6)

def center_line(x0, x1):
    return cq.Workplane("XY").box(x1 - x0, 1.2, 0.4, centered=(False, True, False)).translate((x0, 0, T - 0.4))

# ---------- part A: buckle half ----------
tube, bore = tube_end()
A = strap_body(A_LEN).union(tube)
f0, f1 = A_LEN - 1.0, A_LEN + 10.0                      # frame outer u range
frame = cq.Workplane("XY").box(f1 - f0, 27.6, T, centered=(False, True, False)).translate((f0, 0, 0))
frame = frame.edges("|Z").fillet(1.2)
slot = cq.Workplane("XY").box(3.6, 22.4, T + 2, centered=(False, True, False)).translate((f0 + 3.4, 0, -1))
A = A.union(frame).cut(slot)
post_u = f1 - 2.0
post = cq.Workplane("XY").workplane(offset=T).center(post_u, 0).circle(1.1).extrude(2.6)
head = (cq.Workplane("XY").workplane(offset=T + 2.6).center(post_u, 0).circle(1.7).workplane(offset=0.8).circle(1.1).loft())
A = A.union(post).union(head).cut(bore).cut(center_line(8, 45))

# ---------- part B: holed half ----------
tube, bore = tube_end()
B = cq.Workplane("XY").box(B_LEN, W, T, centered=(False, True, False))
B = B.faces(">X").edges("|Z").fillet(6.0)               # rounded tip
B = B.faces(">Z").edges().fillet(0.6)
B = B.union(tube).cut(bore).cut(center_line(8, 48))
for k in range(HOLE_N):
    B = B.cut(cq.Workplane("XY").workplane(offset=-1).center(HOLE_FIRST + HOLE_STEP * k, 0).circle(HOLE_D / 2).extrude(T + 2))

# ---------- checks + export ----------
out = os.path.dirname(os.path.abspath(__file__))
for name, s in (("A", A), ("B", B)):
    v = s.val(); bb = v.BoundingBox()
    print("strap %s: valid=%s solids=%d  %.1f x %.1f x %.1f mm  vol=%.0f mm3" %
          (name, v.isValid(), len(s.solids().vals()), bb.xlen, bb.ylen, bb.zlen, v.Volume()))
    cq.exporters.export(s, os.path.join(out, "bandflow_strap_%s.stl" % name), tolerance=0.02, angularTolerance=0.1)
    cq.exporters.export(s, os.path.join(out, "bandflow_strap_%s.step" % name))
# ---------- retaining pins (2 needed, one per strap end) ----------
PIN_D, PIN_L, HEAD_D, HEAD_T = 1.6, 28.6, 3.2, 0.8      # lug holes 1.8, tube bore 1.9, lug outer-to-outer 28.0 (+0.6 to melt/glue)
def pin(y):
    shaft = cq.Workplane("YZ").center(y, PIN_D / 2).circle(PIN_D / 2).extrude(PIN_L)
    head = cq.Workplane("YZ").workplane(offset=-HEAD_T).center(y, PIN_D / 2).circle(HEAD_D / 2).extrude(HEAD_T)
    return shaft.union(head)
pins = pin(0).union(pin(6))
cq.exporters.export(pins, os.path.join(out, "bandflow_pins_x2.stl"), tolerance=0.01, angularTolerance=0.05)
cq.exporters.export(pin(0), os.path.join(out, "bandflow_pin.stl"), tolerance=0.01, angularTolerance=0.05)
print("pin: %.1f mm shaft x %.1f dia + %.1f dia head (print 2, lying flat)" % (PIN_L, PIN_D, HEAD_D))
# closed-loop length range (tube centre to tube centre, approx): frame post + hole distance
print("closed loop length %.0f..%.0f mm -> wrist circumference roughly %.0f..%.0f mm" % (
    A_LEN + 9 + HOLE_FIRST - 9, A_LEN + 9 + HOLE_FIRST + HOLE_STEP * (HOLE_N - 1) - 9,
    A_LEN + HOLE_FIRST + 45.0 - 10, A_LEN + HOLE_FIRST + HOLE_STEP * (HOLE_N - 1) + 45.0 - 10))
print("tube length %.1f mm vs lug gap %.1f mm" % (W, LUG_GAP))

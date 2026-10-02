# BandFlow case - parts list and assembly (slim version)

| Part | File | Material | Qty |
|---|---|---|---|
| Top shell | `bandflow_slim_top.stl` | PLA/PETG, print screen-face down | 1 |
| Back plate | `bandflow_slim_back.stl` | PLA/PETG | 1 |
| Strap, buckle half | `bandflow_strap_A.stl` | TPU 95A, flat | 1 |
| Strap, holed half | `bandflow_strap_B.stl` | TPU 95A, flat | 1 |
| Strap pin | `bandflow_pin.stl` / `bandflow_pins_x2.stl` | PLA/PETG, lying flat | 2 |
| Back plate screw | M1.6 x 6 mm, countersunk (flat head), self-tapping or machine into plastic | steel | 4 |

Assembly
1. Put the electronics in the top shell (screen against the window), then place the back plate.
2. Drive the four M1.6 x 6 mm screws through the countersunk holes in the back plate into the pads (pilot holes are 1.4 mm).
3. For each strap half: line up the strap tube between the two lugs, push a pin through lug hole, strap tube, lug hole. The pin is 0.6 mm longer than the lug-to-lug distance; melt or glue the tip. A 1.5 mm steel rod or 1.75 mm filament works too.

Regenerate: `python3 bandflow_case_slim.py`, `python3 bandflow_strap.py`, `python3 coordinate_drawing.py` (needs `pip install cadquery matplotlib`).

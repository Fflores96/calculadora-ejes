# -*- coding: utf-8 -*-
# Pruebas del nucleo de ejes contra ejemplos resueltos de Shigley (9a ed.)
# y Philpot (4a ed.). Correr con:  python pruebas.py
import math
import sys

import ejes as ej

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # consola de Windows

IN = 25.4                 # mm por pulgada
LBF = 4.448222            # N por lbf
KPSI = 6.894757           # MPa por kpsi
HP = 745.6999             # W por hp

fallas = []


def chk(nombre, obtenido, esperado, tol_rel=0.01):
    ok = abs(obtenido - esperado) <= tol_rel * abs(esperado)
    print(("OK   " if ok else "FALLA") + "  %-58s %.4g (esperado %.4g)" % (nombre, obtenido, esperado))
    if not ok:
        fallas.append(nombre)


# 1) Shigley ej. 6-3: acero Sut = 520 MPa maquinado -> ka = 0.860
chk("Shigley 6-3: ka maquinado, Sut 520 MPa", ej.factor_ka(520, "maquinado"), 0.860, 0.002)

# 2) Shigley ej. 6-4: d = 32 mm -> kb rotativo 0.858, no rotativo 0.954
chk("Shigley 6-4: kb rotativo d=32 mm", ej.factor_kb(32, True)[0], 0.858, 0.002)
chk("Shigley 6-4: kb no rotativo (de = 0.37d)", ej.factor_kb(32, False)[0], 0.954, 0.002)

# 3) Shigley ej. 6-6: Sut 690 MPa, r = 3 mm, Kt = 1.65 -> sqrt(a) = 0.313 sqrt(mm), Kf = 1.55
chk("Shigley 6-6: sqrt(a) Neuber flexion [sqrt mm]", ej.raiz_a_neuber(690), 0.313, 0.01)
q = ej.sensibilidad_muesca(3, 690)
chk("Shigley 6-6: Kf = 1 + q(Kt - 1)", ej.factor_kf(1.65, q), 1.55, 0.005)

# 4) Shigley ej. 7-1 (unidades inglesas convertidas a SI)
d = 1.100 * IN
Sut, Sy = 105 * KPSI, 82 * KPSI
Ma, Tm = 1260 * LBF * IN, 1100 * LBF * IN       # N.mm
Kf, Kfs = 1.58, 1.37                            # del libro (q leido de las figuras 6-20 y 6-21)
m = ej.limite_fatiga(Sut, d, "maquinado", True, "flexion", 99)
chk("Shigley 7-1: ka = 0.787", m["ka"], 0.787, 0.005)
chk("Shigley 7-1: kb = 0.870", m["kb"], 0.870, 0.005)
chk("Shigley 7-1: Se = 29.3 kpsi", m["Se"] / KPSI, 29.3, 0.01)
Se = 29.3 * KPSI                                # Se del libro, para aislar los criterios
for crit, n_esp in (("goodman", 1.63), ("gerber", 1.87), ("asme", 1.88), ("soderberg", 1.56)):
    chk("Shigley 7-1: n " + crit, ej.n_fatiga(d, Se, Sut, Sy, Kf, Kfs, Ma, 0, 0, Tm, crit), n_esp, 0.006)
fl = ej.n_fluencia(d, Sy, Kf, Kfs, Ma, 0, 0, Tm)
chk("Shigley 7-1: sigma'max = 18 220 psi", fl["sigma_max_vm"] / KPSI * 1000, 18220, 0.003)
chk("Shigley 7-1: n_y = 4.50", fl["n_y"], 4.50, 0.005)

# 5) Diametro a fatiga: el d entregado debe dar exactamente el n pedido (con kb(d) iterado)
r = ej.diametro_fatiga(1.63, Sut, Sy, Kf, Kfs, Ma, 0, 0, Tm, "goodman", "maquinado", True, 99)
m2 = ej.limite_fatiga(Sut, r["d"], "maquinado", True, "flexion", 99)
chk("Diametro fatiga: n(d) = n pedido", ej.n_fatiga(r["d"], m2["Se"], Sut, Sy, Kf, Kfs, Ma, 0, 0, Tm), 1.63, 1e-4)
chk("Diametro fatiga Goodman ~ d del ej. 7-1 (27.94 mm)", r["d"], d, 0.01)

# 6) Philpot ej. 6.6: eje macizo 0.75 in, 7 hp a 3200 rpm -> T = 11.489 lb.ft, tau = 1664 psi
T = ej.torque_desde_potencia(7 * HP, 3200)
chk("Philpot 6.6: T = 11.489 lb.ft", T / (LBF * IN * 12), 11.489, 0.001)
t = ej.torsion(T, 1000, 0.75 * IN)
chk("Philpot 6.6: tau max = 1664 psi", t["tau"] / KPSI * 1000, 1664, 0.002)

# 7) Modo estatico: consistencia de teorias de falla
e = ej.estado_superficie(30, 0, 200000)                 # torsion pura
ns = ej.seguridad_estatica(e, 300)
chk("Torsion pura: n_Tresca / n_vonMises = sqrt(3)/2", ns["n_tresca"] / ns["n_von_mises"], math.sqrt(3) / 2, 1e-9)
e = ej.estado_superficie(30, 150000, 0)                 # flexion pura
chk("Flexion pura: von Mises = sigma = 32M/(pi d^3)", e["von_mises"], 32 * 150000 / (math.pi * 30 ** 3), 1e-9)
chk("Flexion pura: Tresca y von Mises coinciden",
    ej.seguridad_estatica(e, 300)["n_tresca"], ej.seguridad_estatica(e, 300)["n_von_mises"], 1e-9)
# Shigley 7-1 en modo estatico: von Mises con M y T totales = sigma'max de la ec. (7-15) con Kf = Kfs = 1
e = ej.estado_superficie(d, Ma, Tm)
chk("Estatico vs ec. (7-15) sin concentracion", e["von_mises"],
    ej.n_fluencia(d, Sy, 1, 1, Ma, 0, 0, Tm)["sigma_max_vm"], 1e-9)

# 8) Diametro estatico (con y sin axial): el d entregado da el n pedido
for F in (0.0, 20000.0):
    for crit in ("von_mises", "tresca"):
        dd = ej.diametro_estatico(150000, 200000, 400, 2.5, F, criterio=crit)
        nn = ej.seguridad_estatica(ej.estado_superficie(dd, 150000, 200000, F), 400)["n_" + crit]
        chk("Diametro estatico %s, F = %g N: n(d) = 2.5" % (crit, F), nn, 2.5, 1e-4)

print()
print("TODO OK" if not fallas else "FALLAN %d: %s" % (len(fallas), ", ".join(fallas)))

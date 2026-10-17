# ============================================================
#   NUCLEO DE CALCULO DE EJES (referencia)
#   Modo estatico (Philpot, Mechanics of Materials 4a ed.)
#   Modo fatiga   (Shigley, Diseno en ingenieria mecanica 9a ed.)
#   Unidades SI de trabajo: N, mm, MPa (N/mm2), N.mm
#   Compatible con MicroPython de la TI-Nspire CX II:
#   solo "math", sin f-strings ni librerias externas.
# ============================================================

import math

PI = math.pi

# ------------------------------------------------------------
# DATOS DE CATALOGO (cada uno con su fuente)
# ------------------------------------------------------------

# Shigley tabla 6-2 (Sut en MPa): acabado -> (a, b) de ka = a*Sut^b
ACABADOS = {
    "esmerilado": (1.58, -0.085),
    "maquinado": (4.51, -0.265),      # maquinado o laminado en frio
    "laminado_caliente": (57.7, -0.718),
    "forjado": (272.0, -0.995),       # como sale de la forja
}

# Shigley tabla 6-5: confiabilidad % -> ke
CONFIABILIDAD = {
    50: 1.000, 90: 0.897, 95: 0.868, 99: 0.814,
    99.9: 0.753, 99.99: 0.702, 99.999: 0.659, 99.9999: 0.620,
}

# Shigley ec. (6-26): factor de carga kc
FACTOR_CARGA = {"flexion": 1.0, "axial": 0.85, "torsion": 0.59}

# Shigley tabla 7-1: estimaciones de PRIMERA ITERACION de Kt y Kts.
# Solo para diseno inicial; no usar cuando ya se conocen las dimensiones.
KT_PRIMERA_ITERACION = {
    "hombro_agudo": (2.7, 2.2),        # r/d = 0.02
    "hombro_redondeado": (1.7, 1.5),   # r/d = 0.1
    "cunero_fresado": (2.14, 3.0),     # r/d = 0.02
    "anillo_retencion": (5.0, 3.0),
}

# Shigley tabla A-20 (valores minimos ASTM): clave -> (Sut, Sy) en MPa
MATERIALES = {
    "1018_HR": (400, 220), "1018_CD": (440, 370),
    "1020_HR": (380, 210), "1020_CD": (470, 390),
    "1030_HR": (470, 260), "1030_CD": (520, 440),
    "1035_HR": (500, 270), "1035_CD": (550, 460),
    "1040_HR": (520, 290), "1040_CD": (590, 490),
    "1045_HR": (570, 310), "1045_CD": (630, 530),
    "1050_HR": (620, 340), "1050_CD": (690, 580),
    "1060_HR": (680, 370), "1080_HR": (770, 420), "1095_HR": (830, 460),
}

# Shigley tabla A-5, acero al carbono
E_ACERO = 207000.0   # MPa
G_ACERO = 79300.0    # MPa


# ------------------------------------------------------------
# GEOMETRIA DE LA SECCION CIRCULAR (maciza o hueca)
# ------------------------------------------------------------

def seccion(d, di=0.0):
    """d, di en mm. Devuelve A [mm2], I [mm4], J [mm4], c [mm]."""
    A = PI * (d ** 2 - di ** 2) / 4.0
    I = PI * (d ** 4 - di ** 4) / 64.0
    J = PI * (d ** 4 - di ** 4) / 32.0
    return {"A": A, "I": I, "J": J, "c": d / 2.0}


# ------------------------------------------------------------
# TORSION Y POTENCIA (Philpot sec. 6.3, 6.5 y 6.8)
# ------------------------------------------------------------

def torque_desde_potencia(P_W, rpm):
    """P = T*omega (Philpot ec. 6.17). Devuelve T en N.mm."""
    omega = rpm * 2.0 * PI / 60.0          # rad/s
    return P_W / omega * 1000.0            # N.m -> N.mm


def torsion(T, L, d, di=0.0, G=G_ACERO):
    """tau = T*c/J (Philpot ec. 6.5) y phi = T*L/(J*G) (Philpot sec. 6.5).
    T en N.mm, L y d en mm, G en MPa. tau en MPa, phi en rad."""
    s = seccion(d, di)
    tau = T * s["c"] / s["J"]
    phi = T * L / (s["J"] * G)
    return {"tau": tau, "phi": phi, "J": s["J"]}


# ------------------------------------------------------------
# MODO ESTATICO: punto critico en la superficie (Philpot 15.4-15.5)
# ------------------------------------------------------------

def estado_superficie(d, M, T, F=0.0, Kt=1.0, Kts=1.0, di=0.0):
    """Esfuerzos en la fibra mas solicitada de un eje circular.
    M = momento flector resultante [N.mm], T = torque [N.mm],
    F = fuerza axial [N] (+ traccion). Kt/Kts multiplican los esfuerzos
    nominales de flexion/torsion (Philpot 6.10 y 8.9)."""
    s = seccion(d, di)
    sigma = F / s["A"] + Kt * M * s["c"] / s["I"]
    tau = Kts * T * s["c"] / s["J"]
    centro = sigma / 2.0
    R = math.sqrt(centro ** 2 + tau ** 2)
    s1 = centro + R
    s2 = centro - R
    # tercer esfuerzo principal = 0 (superficie libre, esfuerzo plano)
    tau_abs = max(abs(s1 - s2), abs(s1), abs(s2)) / 2.0
    vm = math.sqrt(s1 ** 2 - s1 * s2 + s2 ** 2)   # = sqrt(sigma^2 + 3 tau^2)
    return {"sigma": sigma, "tau": tau, "s1": s1, "s2": s2,
            "tau_max_plano": R, "tau_max_abs": tau_abs, "von_mises": vm}


def seguridad_estatica(e, Sy):
    """Tresca: falla cuando tau_abs = Sy/2. Von Mises: sigma' = Sy."""
    return {"n_tresca": Sy / (2.0 * e["tau_max_abs"]) if e["tau_max_abs"] > 0 else float("inf"),
            "n_von_mises": Sy / e["von_mises"] if e["von_mises"] > 0 else float("inf")}


def diametro_estatico(M, T, Sy, n, F=0.0, Kt=1.0, Kts=1.0, criterio="von_mises"):
    """Diametro minimo macizo para un factor n (iterando si hay carga axial)."""
    if criterio == "von_mises":
        d = (16.0 * n / (PI * Sy) * math.sqrt(4 * (Kt * M) ** 2 + 3 * (Kts * T) ** 2)) ** (1.0 / 3.0)
    else:
        d = (32.0 * n / (PI * Sy) * math.sqrt((Kt * M) ** 2 + (Kts * T) ** 2)) ** (1.0 / 3.0)
    if F == 0:
        return d
    lo, hi = d * 0.5, d * 3.0                 # con carga axial: biseccion sobre n(d)
    for _ in range(80):
        mid = (lo + hi) / 2.0
        ns = seguridad_estatica(estado_superficie(mid, M, T, F, Kt, Kts), Sy)
        if ns["n_" + criterio] < n:
            lo = mid
        else:
            hi = mid
    return hi


# ------------------------------------------------------------
# MODO FATIGA (Shigley cap. 6 y 7)
# ------------------------------------------------------------

def se_prima(Sut):
    """Shigley ec. (6-8), aceros. Sut en MPa."""
    return 0.5 * Sut if Sut <= 1400 else 700.0


def factor_ka(Sut, acabado):
    a, b = ACABADOS[acabado]
    return a * Sut ** b                      # Shigley ec. (6-19)


def factor_kb(d, rotativo=True, carga="flexion"):
    """Shigley ec. (6-20) a (6-24). d en mm. Devuelve (kb, aviso)."""
    if carga == "axial":
        return 1.0, ""                       # ec. (6-21)
    de = d if rotativo else 0.370 * d        # ec. (6-24)
    aviso = ""
    if de < 2.79 or de > 254:
        aviso = "d_e fuera del rango de la ec. (6-20) (2.79-254 mm)"
    if de <= 51:
        # Forma (d/7.62)^-0.107, la que usa el ej. 6-4; la forma 1.24 d^-0.107
        # del libro trae el coeficiente redondeado (7.62^0.107 = 1.2427).
        kb = (de / 7.62) ** -0.107
    else:
        kb = 1.51 * de ** -0.157
    return kb, aviso


def factor_kd(T_C):
    """Shigley ec. (6-27), valida para 70 <= T_F <= 1000 F."""
    TF = T_C * 9.0 / 5.0 + 32.0
    if TF < 70:
        return 1.0
    return (0.975 + 0.432e-3 * TF - 0.115e-5 * TF ** 2
            + 0.104e-8 * TF ** 3 - 0.595e-12 * TF ** 4)


def limite_fatiga(Sut, d, acabado="maquinado", rotativo=True, carga="flexion",
                  confiabilidad=50, T_C=20.0, kf_varios=1.0):
    """Ecuacion de Marin, Shigley ec. (6-18). Devuelve dict con cada factor."""
    Sep = se_prima(Sut)
    ka = factor_ka(Sut, acabado)
    kb, aviso = factor_kb(d, rotativo, carga)
    kc = FACTOR_CARGA[carga]
    kd = factor_kd(T_C)
    ke = CONFIABILIDAD[confiabilidad]
    Se = ka * kb * kc * kd * ke * kf_varios * Sep
    return {"Se_prima": Sep, "ka": ka, "kb": kb, "kc": kc, "kd": kd,
            "ke": ke, "kf": kf_varios, "Se": Se, "aviso": aviso}


def raiz_a_neuber(Sut, torsion=False):
    """Constante de Neuber sqrt(a) en sqrt(mm), Shigley ec. (6-35a/b).
    Las ecuaciones originales usan Sut en kpsi y dan sqrt(pulg)."""
    S = Sut / 6.894757                        # MPa -> kpsi
    if torsion:
        ra = 0.190 - 2.51e-3 * S + 1.35e-5 * S ** 2 - 2.67e-8 * S ** 3
    else:
        ra = 0.246 - 3.08e-3 * S + 1.51e-5 * S ** 2 - 2.67e-8 * S ** 3
    return ra * math.sqrt(25.4)


def sensibilidad_muesca(r, Sut, torsion=False):
    """q = 1/(1 + sqrt(a)/sqrt(r)), Shigley ec. (6-34). r en mm."""
    return 1.0 / (1.0 + raiz_a_neuber(Sut, torsion) / math.sqrt(r))


def factor_kf(Kt, q):
    """Kf = 1 + q(Kt - 1), Shigley ec. (6-32)."""
    return 1.0 + q * (Kt - 1.0)


def _A_B(Kf, Kfs, Ma, Mm, Ta, Tm):
    A = math.sqrt(4 * (Kf * Ma) ** 2 + 3 * (Kfs * Ta) ** 2)
    B = math.sqrt(4 * (Kf * Mm) ** 2 + 3 * (Kfs * Tm) ** 2)
    return A, B


def n_fatiga(d, Se, Sut, Sy, Kf, Kfs, Ma, Mm=0.0, Ta=0.0, Tm=0.0, criterio="goodman"):
    """Factor de seguridad a fatiga, Shigley ec. (7-7), (7-9), (7-11), (7-13).
    d en mm, esfuerzos en MPa, momentos en N.mm."""
    A, B = _A_B(Kf, Kfs, Ma, Mm, Ta, Tm)
    k = 16.0 / (PI * d ** 3)
    if criterio == "goodman":
        inv = k * (A / Se + B / Sut)
    elif criterio == "soderberg":
        inv = k * (A / Se + B / Sy)
    elif criterio == "gerber":
        if B == 0:
            inv = k * A / Se
        else:
            inv = 8.0 * A / (PI * d ** 3 * Se) * (1 + math.sqrt(1 + (2 * B * Se / (A * Sut)) ** 2))
    elif criterio == "asme":
        inv = k * math.sqrt(4 * (Kf * Ma / Se) ** 2 + 3 * (Kfs * Ta / Se) ** 2
                            + 4 * (Kf * Mm / Sy) ** 2 + 3 * (Kfs * Tm / Sy) ** 2)
    else:
        raise ValueError("criterio desconocido: " + criterio)
    return 1.0 / inv


def n_fluencia(d, Sy, Kf, Kfs, Ma, Mm=0.0, Ta=0.0, Tm=0.0):
    """Von Mises maximo, Shigley ec. (7-15) y (7-16)."""
    sig = 32.0 * Kf * (Mm + Ma) / (PI * d ** 3)
    tau = 16.0 * Kfs * (Tm + Ta) / (PI * d ** 3)
    smax = math.sqrt(sig ** 2 + 3 * tau ** 2)
    return {"sigma_max_vm": smax, "n_y": Sy / smax}


def diametro_fatiga(n, Sut, Sy, Kf, Kfs, Ma, Mm=0.0, Ta=0.0, Tm=0.0,
                    criterio="goodman", acabado="maquinado", rotativo=True,
                    confiabilidad=50, T_C=20.0, kf_varios=1.0, d0=25.0, tol=1e-4):
    """Diametro minimo a fatiga. Como kb depende de d, se itera:
    d -> Se(d) -> d nuevo (Shigley ec. 7-8 a 7-14 por biseccion sobre n)."""
    d = d0
    hist = []
    for _ in range(50):
        m = limite_fatiga(Sut, d, acabado, rotativo, "flexion", confiabilidad, T_C, kf_varios)
        lo, hi = 0.5, 2000.0
        for _ in range(100):
            mid = (lo + hi) / 2.0
            if n_fatiga(mid, m["Se"], Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, criterio) < n:
                lo = mid
            else:
                hi = mid
        hist.append((d, m["Se"], hi))
        if abs(hi - d) < tol:
            return {"d": hi, "Se": m["Se"], "iteraciones": len(hist), "historial": hist}
        d = hi
    return {"d": d, "Se": m["Se"], "iteraciones": len(hist), "historial": hist}

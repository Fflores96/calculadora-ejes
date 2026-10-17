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

# ============================================================
#   INTERFAZ TI-NSPIRE (patron de Piping.txt)
#   Entradas: mm, MPa, N.m, kW, rpm. Internamente N.mm.
# ============================================================

LINEAS_PANTALLA = 9
_contador_lineas = [0]


class Volver(Exception):
    pass


def out(texto=""):
    print(texto)
    _contador_lineas[0] += 1
    if _contador_lineas[0] >= LINEAS_PANTALLA:
        input("--mas--[Enter]")
        _contador_lineas[0] = 0


def out_final(texto=""):
    print(texto)


def menu_texto(*lineas):
    """Imprime un menu sin contar lineas para la auto-pausa,
    asi el Enter de '--mas--' no se lee como opcion."""
    for linea in lineas:
        print(linea)
    reset_contador()


def pausa_manual():
    input("  -- [Enter] continuar --")
    _contador_lineas[0] = 0


def reset_contador():
    _contador_lineas[0] = 0


def separador(titulo=""):
    if titulo:
        out("=== " + titulo + " ===")
    else:
        out("-" * 20)


def paso(n, desc, formula, resultado, unidad=""):
    out("[{}] {}".format(n, desc))
    out("  " + formula)
    out("  = {:.5f} {}".format(resultado, unidad))


def verificar(condicion, ok_msg, fail_msg):
    simbolo = "OK" if condicion else "FALLA"
    msg = ok_msg if condicion else fail_msg
    out("[{}] {}".format(simbolo, msg))
    return condicion


def pedir_float(msg, default=None):
    while True:
        if default is not None:
            s = input("{}[{}]: ".format(msg, default))
            if s.strip() == "":
                return default
        else:
            s = input(msg + ": ")
        # signo menos de la Nspire (U+2212) y coma decimal
        s = s.replace("−", "-").replace(",", ".")
        try:
            return float(s)
        except ValueError:
            out("Valor invalido, ingrese un numero")


def pedir_int(msg, opciones):
    while True:
        try:
            v = int(input(msg + ": "))
            if v in opciones:
                return v
        except:
            pass
        out("Opcion invalida: " + str(opciones))


def pedir_op(msg, opciones):
    """Como pedir_int, pero 0 siempre vuelve al menu principal."""
    v = pedir_int(msg, [0] + list(opciones))
    if v == 0:
        raise Volver()
    return v


# ------------------------------------------------------------
# ENTRADAS COMPARTIDAS
# ------------------------------------------------------------

ACEROS = [1018, 1020, 1030, 1035, 1040, 1045, 1050, 1060, 1080, 1095]


def pedir_material():
    """Acero de la tabla A-20 de Shigley o Sut/Sy a mano."""
    menu_texto("Material:",
               "  1) Acero AISI (Shigley A-20)",
               "  2) Ingresar Sut y Sy",
               "  0) Volver")
    op = pedir_op("Opcion", [1, 2])
    if op == 2:
        Sut = pedir_float("  Sut [MPa]")
        Sy = pedir_float("  Sy [MPa]")
        return Sut, Sy, "manual"
    menu_texto("AISI: 1018 1020 1030 1035",
               "  1040 1045 1050 1060 1080 1095")
    n = pedir_int("  Numero AISI", ACEROS)
    if n >= 1060:
        clave = str(n) + "_HR"
    else:
        menu_texto("  1) HR laminado caliente",
                   "  2) CD estirado en frio")
        clave = str(n) + ("_HR" if pedir_int("  Proceso", [1, 2]) == 1 else "_CD")
    Sut, Sy = MATERIALES[clave]
    out("AISI {}: Sut={} Sy={} MPa".format(clave, Sut, Sy))
    return float(Sut), float(Sy), clave


def pedir_concentracion(nombre_modulo):
    """Kf/Kfs (fatiga) o Kt/Kts (estatico)."""
    menu_texto("Concentracion de esfuerzos:",
               "  1) Calcular con M2",
               "  2) Ingresar factores",
               "  3) Sin concentracion (=1)",
               "  0) Volver")
    op = pedir_op("Opcion", [1, 2, 3])
    if op == 1:
        r = modulo_concentracion(True)
        if nombre_modulo == "estatico":
            return r["Kt"], r["Kts"]
        return r["Kf"], r["Kfs"]
    if op == 2:
        if nombre_modulo == "estatico":
            return pedir_float("  Kt flexion"), pedir_float("  Kts torsion")
        return pedir_float("  Kf flexion"), pedir_float("  Kfs torsion")
    return 1.0, 1.0


# ------------------------------------------------------------
# M1: TORSION Y POTENCIA (Philpot 6.3-6.8)
# ------------------------------------------------------------

def modulo_torsion():
    separador("M1: TORSION Y POTENCIA")
    menu_texto("Torque:",
               "  1) Ingresar T [N.m]",
               "  2) Desde potencia y rpm",
               "  0) Volver")
    op = pedir_op("Opcion", [1, 2])
    reset_contador()
    if op == 1:
        T = pedir_float("  T [N.m]") * 1000.0
    else:
        P = pedir_float("  Potencia P [kW]")
        rpm = pedir_float("  Velocidad n [rpm]")
    d = pedir_float("  Diametro ext. d [mm]")
    di = pedir_float("  Diametro int. di [mm]", 0.0)
    L = pedir_float("  Largo L [mm]", 1000.0)
    G = pedir_float("  G [GPa]", G_ACERO / 1000.0) * 1000.0
    reset_contador()
    k = 1
    if op == 2:
        w = rpm * 2 * PI / 60.0
        paso(k, "Velocidad angular", "w=2*pi*n/60", w, "rad/s")
        k += 1
        T = torque_desde_potencia(P * 1000.0, rpm)
        paso(k, "Torque (Philpot 6.17)", "T=P/w", T / 1000.0, "N.m")
        k += 1
    r = torsion(T, L, d, di, G)
    paso(k, "Momento polar", "J=pi(d^4-di^4)/32", r["J"], "mm4")
    paso(k + 1, "Esfuerzo cortante", "tau=T*c/J", r["tau"], "MPa")
    paso(k + 2, "Angulo de giro", "phi=T*L/(J*G)", r["phi"], "rad")
    out_final("phi = {:.4f} grados".format(r["phi"] * 180 / PI))
    return {"T": T, "tau": r["tau"], "phi": r["phi"]}


# ------------------------------------------------------------
# M2: CONCENTRACION DE ESFUERZOS (Shigley 6-10, tabla 7-1)
# ------------------------------------------------------------

def modulo_concentracion(desde_otro=False):
    if not desde_otro:
        separador("M2: CONCENTRACION Kt, Kf")
    menu_texto("Origen de Kt y Kts:",
               "  1) Tabla 7-1 (1a iteracion)",
               "  2) Ingresar (graficas A-15)",
               "  0) Volver")
    op = pedir_op("Opcion", [1, 2])
    if op == 1:
        menu_texto("  1) Hombro agudo r/d=0.02",
                   "  2) Hombro redondeado r/d=0.1",
                   "  3) Cunero fresado r/d=0.02",
                   "  4) Ranura anillo retencion")
        g = pedir_int("  Elemento", [1, 2, 3, 4])
        clave = ["hombro_agudo", "hombro_redondeado",
                 "cunero_fresado", "anillo_retencion"][g - 1]
        Kt, Kts = KT_PRIMERA_ITERACION[clave]
        out("(!) Solo para diseno inicial")
    else:
        Kt = pedir_float("  Kt flexion")
        Kts = pedir_float("  Kts torsion")
    menu_texto("Sensibilidad a la muesca:",
               "  1) Neuber: r y Sut",
               "  2) Ingresar q y qs",
               "  3) q=1 (Kf=Kt, conservador)",
               "  0) Volver")
    mq = pedir_op("Opcion", [1, 2, 3])
    reset_contador()
    if mq == 1:
        r = pedir_float("  Radio de muesca r [mm]")
        Sut = pedir_float("  Sut [MPa]")
        reset_contador()
        ra = raiz_a_neuber(Sut)
        ras = raiz_a_neuber(Sut, True)
        paso(1, "Neuber flexion (6-35a)", "sqrt(a)", ra, "mm^0.5")
        q = sensibilidad_muesca(r, Sut)
        qs = sensibilidad_muesca(r, Sut, True)
        paso(2, "q flexion (6-34)", "1/(1+sqrt(a/r))", q, "")
        paso(3, "Neuber torsion (6-35b)", "sqrt(a)", ras, "mm^0.5")
        paso(4, "q torsion", "1/(1+sqrt(a/r))", qs, "")
    elif mq == 2:
        q = pedir_float("  q flexion")
        qs = pedir_float("  qs torsion")
    else:
        q, qs = 1.0, 1.0
    Kf = factor_kf(Kt, q)
    Kfs = factor_kf(Kts, qs)
    paso(5, "Kf flexion (6-32)", "1+q(Kt-1)", Kf, "")
    paso(6, "Kfs torsion", "1+qs(Kts-1)", Kfs, "")
    if desde_otro:
        pausa_manual()
    return {"Kt": Kt, "Kts": Kts, "Kf": Kf, "Kfs": Kfs}


# ------------------------------------------------------------
# M3: PUNTO CRITICO ESTATICO (Philpot 15.4-15.5)
# ------------------------------------------------------------

def modulo_estatico():
    separador("M3: ESTATICO (Philpot)")
    menu_texto("Calcular:",
               "  1) Factor de seguridad n",
               "  2) Diametro minimo",
               "  0) Volver")
    modo = pedir_op("Opcion", [1, 2])
    Sut, Sy, _ = pedir_material()
    reset_contador()
    M = pedir_float("  Momento flector M [N.m]") * 1000.0
    T = pedir_float("  Torque T [N.m]") * 1000.0
    F = pedir_float("  Axial F [N] (+trac.)", 0.0)
    Kt, Kts = pedir_concentracion("estatico")
    reset_contador()
    if modo == 2:
        n = pedir_float("  Factor objetivo n", 2.0)
        dv = diametro_estatico(M, T, Sy, n, F, Kt, Kts, "von_mises")
        dt = diametro_estatico(M, T, Sy, n, F, Kt, Kts, "tresca")
        paso(1, "d min von Mises", "n=Sy/sigma'", dv, "mm")
        paso(2, "d min Tresca", "n=Sy/(2tau_max)", dt, "mm")
        out_final("Tresca es mas conservador")
        return {"d_vm": dv, "d_tresca": dt}
    d = pedir_float("  Diametro d [mm]")
    reset_contador()
    e = estado_superficie(d, M, T, F, Kt, Kts)
    ns = seguridad_estatica(e, Sy)
    paso(1, "Esfuerzo normal", "F/A+Kt*32M/(pi d^3)", e["sigma"], "MPa")
    paso(2, "Esfuerzo cortante", "Kts*16T/(pi d^3)", e["tau"], "MPa")
    paso(3, "Principal s1", "s/2+R", e["s1"], "MPa")
    paso(4, "Principal s2", "s/2-R", e["s2"], "MPa")
    paso(5, "Cortante max abs", "max dif./2", e["tau_max_abs"], "MPa")
    paso(6, "Von Mises", "sqrt(s1^2-s1s2+s2^2)", e["von_mises"], "MPa")
    paso(7, "n Tresca", "Sy/(2 tau_max)", ns["n_tresca"], "")
    paso(8, "n von Mises", "Sy/sigma'", ns["n_von_mises"], "")
    verificar(min(ns["n_tresca"], ns["n_von_mises"]) >= 1.0,
              "No fluye (n>=1)", "FLUYE: n<1")
    return {"estado": e, "n": ns}


# ------------------------------------------------------------
# M4: FATIGA EN UN PUNTO (Shigley 6-9, 7-4)
# ------------------------------------------------------------

CRITERIOS = ["goodman", "gerber", "asme", "soderberg"]
ACAB = ["esmerilado", "maquinado", "laminado_caliente", "forjado"]
CONF = [50, 90, 95, 99, 99.9, 99.99, 99.999, 99.9999]


def pedir_marin():
    menu_texto("Acabado superficial:",
               "  1) Esmerilado",
               "  2) Maquinado o lam. en frio",
               "  3) Laminado en caliente",
               "  4) Como sale de forja")
    acab = ACAB[pedir_int("  Acabado", [1, 2, 3, 4]) - 1]
    rot = pedir_int("  Eje gira? 1=Si 0=No", [0, 1]) == 1
    menu_texto("Confiabilidad %:",
               "  1)50 2)90 3)95 4)99",
               "  5)99.9 6)99.99 7)99.999",
               "  8)99.9999")
    conf = CONF[pedir_int("  Opcion", [1, 2, 3, 4, 5, 6, 7, 8]) - 1]
    TC = pedir_float("  Temperatura [C]", 20.0)
    kfv = pedir_float("  kf efectos varios", 1.0)
    return acab, rot, conf, TC, kfv


def mostrar_marin(m):
    paso(1, "S'e (6-8)", "0.5*Sut", m["Se_prima"], "MPa")
    paso(2, "ka superficie (6-19)", "a*Sut^b", m["ka"], "")
    paso(3, "kb tamano (6-20)", "(d/7.62)^-0.107", m["kb"], "")
    if m["aviso"]:
        out("(!) " + m["aviso"])
    out("  kc={:.3f} kd={:.4f}".format(m["kc"], m["kd"]))
    out("  ke={:.3f} kf={:.3f}".format(m["ke"], m["kf"]))
    paso(4, "Se Marin (6-18)", "ka*kb*kc*kd*ke*kf*S'e", m["Se"], "MPa")


def modulo_fatiga():
    separador("M4: FATIGA (Shigley)")
    menu_texto("Calcular:",
               "  1) Factor de seguridad n",
               "  2) Diametro minimo",
               "  0) Volver")
    modo = pedir_op("Opcion", [1, 2])
    Sut, Sy, _ = pedir_material()
    acab, rot, conf, TC, kfv = pedir_marin()
    Kf, Kfs = pedir_concentracion("fatiga")
    reset_contador()
    out("Momentos y torques [N.m]:")
    Ma = pedir_float("  Ma alternante", 0.0) * 1000.0
    Mm = pedir_float("  Mm medio", 0.0) * 1000.0
    Ta = pedir_float("  Ta alternante", 0.0) * 1000.0
    Tm = pedir_float("  Tm medio", 0.0) * 1000.0
    menu_texto("Criterio:",
               "  1) ED-Goodman (7-7)",
               "  2) ED-Gerber (7-9)",
               "  3) ED-ASME eliptico (7-11)",
               "  4) ED-Soderberg (7-13)",
               "  5) Los cuatro")
    c = pedir_int("  Criterio", [1, 2, 3, 4, 5])
    lista = CRITERIOS if c == 5 else [CRITERIOS[c - 1]]
    reset_contador()
    if modo == 2:
        n = pedir_float("  Factor objetivo n", 2.0)
        d0 = pedir_float("  d inicial [mm]", 25.0)
        reset_contador()
        res = {}
        for crit in lista:
            r = diametro_fatiga(n, Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, crit,
                                acab, rot, conf, TC, kfv, d0)
            out("{}: {} iter.".format(crit, r["iteraciones"]))
            out_final("  d = {:.3f} mm".format(r["d"]))
            res[crit] = r["d"]
        out("(kb se recalcula con cada d)")
        return res
    d = pedir_float("  Diametro d [mm]")
    reset_contador()
    m = limite_fatiga(Sut, d, acab, rot, "flexion", conf, TC, kfv)
    mostrar_marin(m)
    k = 5
    res = {"Se": m["Se"]}
    for crit in lista:
        nf = n_fatiga(d, m["Se"], Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, crit)
        paso(k, "n " + crit, "Shigley 7-4", nf, "")
        res[crit] = nf
        k += 1
    fl = n_fluencia(d, Sy, Kf, Kfs, Ma, Mm, Ta, Tm)
    paso(k, "Von Mises max (7-15)", "sigma'max", fl["sigma_max_vm"], "MPa")
    paso(k + 1, "n fluencia (7-16)", "Sy/sigma'max", fl["n_y"], "")
    verificar(min([res[c2] for c2 in lista] + [fl["n_y"]]) >= 1.0,
              "Cumple n>=1", "NO cumple: n<1")
    res["n_y"] = fl["n_y"]
    return res


# ------------------------------------------------------------
# MENU PRINCIPAL
# ------------------------------------------------------------

def menu_ejes():
    while True:
        menu_texto("=== EJES - MENU ===",
                   "  1) M1: Torsion y potencia",
                   "  2) M2: Concentracion Kt/Kf",
                   "  3) M3: Estatico (Philpot)",
                   "  4) M4: Fatiga (Shigley)",
                   "  0) Salir")
        op = pedir_int("Opcion", [0, 1, 2, 3, 4])
        if op == 0:
            out("Saliendo...")
            break
        try:
            [modulo_torsion, modulo_concentracion,
             modulo_estatico, modulo_fatiga][op - 1]()
        except Volver:
            reset_contador()
            continue
        pausa_manual()


menu_ejes()

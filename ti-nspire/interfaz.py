
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

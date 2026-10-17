// Núcleo de cálculo de ejes. Traducción directa de nucleo/ejes.py (las
// mismas pruebas pasan en ambos) más el análisis de viga del eje.
// Unidades internas: N, mm, MPa, N·mm.
window.EJES = window.EJES || {};

(function (E) {
  'use strict';
  var PI = Math.PI;

  // ---------- sección ----------
  function seccion(d, di) {
    di = di || 0;
    return { A: PI * (d * d - di * di) / 4, I: PI * (Math.pow(d, 4) - Math.pow(di, 4)) / 64,
             J: PI * (Math.pow(d, 4) - Math.pow(di, 4)) / 32, c: d / 2 };
  }

  // ---------- torsión y potencia (Philpot 6.3-6.8) ----------
  function torqueDesdePotencia(P_W, rpm) { return P_W / (rpm * 2 * PI / 60) * 1000; }
  function torsion(T, L, d, di, G) {
    var s = seccion(d, di); G = G || E.G_ACERO;
    return { tau: T * s.c / s.J, phi: T * L / (s.J * G), J: s.J };
  }

  // ---------- modo estático (Philpot 15.4-15.5) ----------
  function estadoSuperficie(d, M, T, F, Kt, Kts) {
    var s = seccion(d);
    var sigma = (F || 0) / s.A + (Kt || 1) * M * s.c / s.I;
    var tau = (Kts || 1) * T * s.c / s.J;
    var c = sigma / 2, R = Math.sqrt(c * c + tau * tau), s1 = c + R, s2 = c - R;
    return { sigma: sigma, tau: tau, s1: s1, s2: s2, tauMaxPlano: R,
             tauMaxAbs: Math.max(Math.abs(s1 - s2), Math.abs(s1), Math.abs(s2)) / 2,
             vonMises: Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2) };
  }
  function seguridadEstatica(e, Sy) {
    return { tresca: e.tauMaxAbs > 0 ? Sy / (2 * e.tauMaxAbs) : Infinity,
             vonMises: e.vonMises > 0 ? Sy / e.vonMises : Infinity };
  }
  function diametroEstatico(M, T, Sy, n, Kt, Kts, criterio) {
    Kt = Kt || 1; Kts = Kts || 1;
    if (criterio === 'tresca') return Math.cbrt(32 * n / (PI * Sy) * Math.sqrt(Math.pow(Kt * M, 2) + Math.pow(Kts * T, 2)));
    return Math.cbrt(16 * n / (PI * Sy) * Math.sqrt(4 * Math.pow(Kt * M, 2) + 3 * Math.pow(Kts * T, 2)));
  }

  // ---------- modo fatiga (Shigley cap. 6 y 7) ----------
  function sePrima(Sut) { return Sut <= 1400 ? 0.5 * Sut : 700; }
  function buscar(lista, id) { for (var i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i]; return null; }
  function factorKa(Sut, acabado) { var a = buscar(E.ACABADOS, acabado); return a.a * Math.pow(Sut, a.b); }
  function factorKb(d, rotativo) {
    var de = rotativo === false ? 0.370 * d : d;
    var aviso = (de < 2.79 || de > 254) ? 'd_e fuera del rango de la ec. (6-20) (2,79-254 mm)' : '';
    // (d/7.62)^-0.107 es la forma que usa el ej. 6-4 (1,24 está redondeado)
    return { kb: de <= 51 ? Math.pow(de / 7.62, -0.107) : 1.51 * Math.pow(de, -0.157), aviso: aviso };
  }
  function factorKd(T_C) {
    var TF = T_C * 9 / 5 + 32;
    if (TF < 70) return 1;
    return 0.975 + 0.432e-3 * TF - 0.115e-5 * TF * TF + 0.104e-8 * Math.pow(TF, 3) - 0.595e-12 * Math.pow(TF, 4);
  }
  function factorKe(conf) { for (var i = 0; i < E.CONFIABILIDAD.length; i++) if (E.CONFIABILIDAD[i][0] === Number(conf)) return E.CONFIABILIDAD[i][1]; return NaN; }
  function limiteFatiga(Sut, d, op) {
    op = op || {};
    var Sep = sePrima(Sut), ka = factorKa(Sut, op.acabado || 'maquinado'), kb = factorKb(d, op.rotativo !== false);
    var kc = 1, kd = factorKd(op.T_C === undefined ? 20 : op.T_C), ke = factorKe(op.confiabilidad || 50), kf = op.kfVarios || 1;
    return { SePrima: Sep, ka: ka, kb: kb.kb, kc: kc, kd: kd, ke: ke, kf: kf, Se: ka * kb.kb * kc * kd * ke * kf * Sep, aviso: kb.aviso };
  }
  function raizANeuber(Sut, torsion) {
    var S = Sut / 6.894757, ra = torsion
      ? 0.190 - 2.51e-3 * S + 1.35e-5 * S * S - 2.67e-8 * S * S * S
      : 0.246 - 3.08e-3 * S + 1.51e-5 * S * S - 2.67e-8 * S * S * S;
    return ra * Math.sqrt(25.4);
  }
  function sensibilidadMuesca(r, Sut, torsion) { return 1 / (1 + raizANeuber(Sut, torsion) / Math.sqrt(r)); }
  function factorKf(Kt, q) { return 1 + q * (Kt - 1); }

  function nFatiga(d, Se, Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, criterio) {
    Mm = Mm || 0; Ta = Ta || 0; Tm = Tm || 0;
    var A = Math.sqrt(4 * Math.pow(Kf * Ma, 2) + 3 * Math.pow(Kfs * Ta, 2));
    var B = Math.sqrt(4 * Math.pow(Kf * Mm, 2) + 3 * Math.pow(Kfs * Tm, 2));
    var k = 16 / (PI * Math.pow(d, 3)), inv;
    if (criterio === 'goodman') inv = k * (A / Se + B / Sut);
    else if (criterio === 'soderberg') inv = k * (A / Se + B / Sy);
    else if (criterio === 'gerber') inv = B === 0 ? k * A / Se : 8 * A / (PI * Math.pow(d, 3) * Se) * (1 + Math.sqrt(1 + Math.pow(2 * B * Se / (A * Sut), 2)));
    else if (criterio === 'asme') inv = k * Math.sqrt(4 * Math.pow(Kf * Ma / Se, 2) + 3 * Math.pow(Kfs * Ta / Se, 2) + 4 * Math.pow(Kf * Mm / Sy, 2) + 3 * Math.pow(Kfs * Tm / Sy, 2));
    else throw new Error('criterio desconocido: ' + criterio);
    return 1 / inv;
  }
  function nFluencia(d, Sy, Kf, Kfs, Ma, Mm, Ta, Tm) {
    var sig = 32 * Kf * ((Mm || 0) + Ma) / (PI * Math.pow(d, 3)), tau = 16 * Kfs * ((Tm || 0) + (Ta || 0)) / (PI * Math.pow(d, 3));
    var s = Math.sqrt(sig * sig + 3 * tau * tau);
    return { sigmaMaxVM: s, nY: Sy / s };
  }
  function diametroFatiga(n, Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, criterio, op, d0) {
    var d = d0 || 25, m;
    for (var it = 1; it <= 50; it++) {
      m = limiteFatiga(Sut, d, op);
      var lo = 0.5, hi = 2000;
      for (var k = 0; k < 100; k++) {
        var mid = (lo + hi) / 2;
        if (nFatiga(mid, m.Se, Sut, Sy, Kf, Kfs, Ma, Mm, Ta, Tm, criterio) < n) lo = mid; else hi = mid;
      }
      if (Math.abs(hi - d) < 1e-4) return { d: hi, Se: m.Se, iteraciones: it };
      d = hi;
    }
    return { d: d, Se: m.Se, iteraciones: 50 };
  }

  // ---------- análisis de viga del eje ----------
  // caso.geometria: [{L, d}] desde x = 0; caso.apoyos: [xA, xB];
  // caso.cargas: [{x, Fy, Fz, T}] (N y N·m; T según la regla de la mano derecha sobre +x)
  function largoTotal(geo) { return geo.reduce(function (s, t) { return s + Number(t.L); }, 0); }
  function bordes(geo) { var x = 0, b = [0]; geo.forEach(function (t) { x += Number(t.L); b.push(x); }); return b; }
  function diametroEn(geo, x) {
    var b = bordes(geo), dmin = Infinity;
    for (var i = 0; i < geo.length; i++) {
      if (x >= b[i] - 1e-9 && x <= b[i + 1] + 1e-9) dmin = Math.min(dmin, Number(geo[i].d));
    }
    return dmin;   // en un hombro devuelve el diámetro menor
  }

  function reacciones(caso) {
    var xA = Number(caso.apoyos[0]), xB = Number(caso.apoyos[1]), Lab = xB - xA, r = { y: [0, 0], z: [0, 0] };
    ['y', 'z'].forEach(function (p) {
      var SF = 0, SM = 0;
      caso.cargas.forEach(function (c) { var F = Number(c['F' + p]) || 0; SF += F; SM += F * (Number(c.x) - xA); });
      var RB = -SM / Lab;
      r[p] = [-SF - RB, RB];
    });
    return r;
  }

  function fuerzasPuntuales(caso, p) {
    var R = reacciones(caso), f = [{ x: Number(caso.apoyos[0]), F: R[p][0] }, { x: Number(caso.apoyos[1]), F: R[p][1] }];
    caso.cargas.forEach(function (c) { var F = Number(c['F' + p]) || 0; if (F) f.push({ x: Number(c.x), F: F }); });
    return f;
  }
  // Momento interno M(x) desde la izquierda: suma de F·(x − x_i) de las fuerzas a la izquierda.
  function momentoEn(f, x) { return f.reduce(function (s, q) { return q.x < x - 1e-9 ? s + q.F * (x - q.x) : s; }, 0); }
  function corteEn(f, x) { return f.reduce(function (s, q) { return q.x < x - 1e-9 ? s + q.F : s; }, 0); }
  function torqueEn(caso, x, lado) {
    // lado = -1: justo a la izquierda de x; +1: justo a la derecha
    var eps = lado > 0 ? 1e-6 : -1e-6;
    return caso.cargas.reduce(function (s, c) { return Number(c.x) < x + eps ? s + (Number(c.T) || 0) * 1000 : s; }, 0);
  }

  function analizarViga(caso, nPuntos) {
    nPuntos = nPuntos || 400;
    var L = largoTotal(caso.geometria), fy = fuerzasPuntuales(caso, 'y'), fz = fuerzasPuntuales(caso, 'z');
    var xs = [];
    for (var i = 0; i <= nPuntos; i++) xs.push(L * i / nPuntos);
    caso.cargas.forEach(function (c) { xs.push(Number(c.x)); });
    caso.apoyos.forEach(function (a) { xs.push(Number(a)); });
    bordes(caso.geometria).forEach(function (b) { xs.push(b); });
    xs = xs.filter(function (x) { return x >= 0 && x <= L; }).sort(function (a, b) { return a - b; });
    var pts = xs.map(function (x) {
      var My = momentoEn(fy, x), Mz = momentoEn(fz, x);
      return { x: x, Vy: corteEn(fy, x), Vz: corteEn(fz, x), My: My, Mz: Mz, M: Math.sqrt(My * My + Mz * Mz),
               T: Math.max(Math.abs(torqueEn(caso, x, -1)), Math.abs(torqueEn(caso, x, 1))) };
    });
    var sumaT = caso.cargas.reduce(function (s, c) { return s + (Number(c.T) || 0); }, 0);
    return { L: L, R: reacciones(caso), puntos: pts, sumaT: sumaT };
  }

  function solicitacionEn(caso, x) {
    var fy = fuerzasPuntuales(caso, 'y'), fz = fuerzasPuntuales(caso, 'z'), My = momentoEn(fy, x), Mz = momentoEn(fz, x);
    return { My: My, Mz: Mz, M: Math.sqrt(My * My + Mz * Mz),
             T: Math.max(Math.abs(torqueEn(caso, x, -1)), Math.abs(torqueEn(caso, x, 1))) };
  }

  E.nucleo = {
    seccion: seccion, torqueDesdePotencia: torqueDesdePotencia, torsion: torsion,
    estadoSuperficie: estadoSuperficie, seguridadEstatica: seguridadEstatica, diametroEstatico: diametroEstatico,
    sePrima: sePrima, factorKa: factorKa, factorKb: factorKb, factorKd: factorKd, factorKe: factorKe,
    limiteFatiga: limiteFatiga, raizANeuber: raizANeuber, sensibilidadMuesca: sensibilidadMuesca, factorKf: factorKf,
    nFatiga: nFatiga, nFluencia: nFluencia, diametroFatiga: diametroFatiga,
    largoTotal: largoTotal, bordes: bordes, diametroEn: diametroEn, reacciones: reacciones,
    analizarViga: analizarViga, solicitacionEn: solicitacionEn, buscar: buscar
  };
})(window.EJES);

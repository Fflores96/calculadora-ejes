// Evaluación completa de un caso: viga, puntos críticos (estático y fatiga),
// ángulo de giro y avisos. Sin interfaz.
window.EJES = window.EJES || {};

(function (E) {
  'use strict';
  var N = E.nucleo;
  var CRITERIOS = ['goodman', 'gerber', 'asme', 'soderberg'];

  function material(caso) {
    if (caso.material.manual) return { Sut: Number(caso.material.Sut), Sy: Number(caso.material.Sy), nombre: 'Ingresado a mano', fuente: null };
    return N.buscar(E.MATERIALES, caso.material.id);
  }

  function concentracion(p, Sut) {
    var Kt = 1, Kts = 1, origen = 'Sin concentración';
    if (p.tipo === 'tabla71') {
      var t = N.buscar(E.KT_TABLA71, p.ref);
      Kt = t.Kt; Kts = t.Kts; origen = t.nombre + ' (Shigley tabla 7-1, 1.ª iteración)';
    } else if (p.tipo === 'manual') {
      Kt = Number(p.Kt); Kts = Number(p.Kts); origen = 'K_t ingresado (gráficas A-15)';
    }
    var r = Number(p.r), q = 1, qs = 1;
    if (p.tipo !== 'liso' && r > 0) { q = N.sensibilidadMuesca(r, Sut); qs = N.sensibilidadMuesca(r, Sut, true); }
    return { Kt: Kt, Kts: Kts, q: q, qs: qs, Kf: N.factorKf(Kt, q), Kfs: N.factorKf(Kts, qs), origen: origen,
             qOrigen: p.tipo === 'liso' ? '—' : (r > 0 ? 'Neuber con r = ' + r + ' mm' : 'q = 1 (sin r: conservador)') };
  }

  function evaluar(caso) {
    var avisos = [], mat = material(caso);
    var L = N.largoTotal(caso.geometria);
    if (!(L > 0)) return { avisos: ['Define al menos un tramo con largo > 0.'], vacio: true };
    var xA = Number(caso.apoyos[0]), xB = Number(caso.apoyos[1]);
    if (!(xB > xA)) avisos.push('El apoyo B debe estar a la derecha del apoyo A.');
    if (xA < 0 || xB > L) avisos.push('Un apoyo está fuera del eje (largo total ' + L + ' mm).');
    caso.cargas.forEach(function (c) { if (Number(c.x) < 0 || Number(c.x) > L) avisos.push('La carga "' + c.nombre + '" está fuera del eje.'); });
    var viga = N.analizarViga(caso);
    if (Math.abs(viga.sumaT) > 1e-6) avisos.push('Los torques no se equilibran: ΣT = ' + viga.sumaT.toFixed(2).replace('.', ',') + ' N·m. En un eje que gira a velocidad constante, el torque que entra debe salir.');

    var f = caso.fatiga, op = { acabado: f.acabado, rotativo: f.rotativo, confiabilidad: f.confiabilidad, T_C: Number(f.T_C), kfVarios: Number(f.kfVarios) };
    var nObj = Number(caso.nObjetivo);
    var conTabla71 = [];
    var puntos = caso.puntos.map(function (p) {
      var x = Number(p.x), d = N.diametroEn(caso.geometria, x), s = N.solicitacionEn(caso, x), k = concentracion(p, mat.Sut);
      // Eje giratorio: flexión completamente invertida y torque constante (Shigley p. 353)
      var Ma = s.M, Mm = 0, Tm = s.T, Ta = s.T * (Number(f.TaPct) || 0) / 100;
      var e = N.estadoSuperficie(d, s.M, s.T, 0, caso.estatico.aplicarKt ? k.Kt : 1, caso.estatico.aplicarKt ? k.Kts : 1);
      var ne = N.seguridadEstatica(e, mat.Sy);
      var m = N.limiteFatiga(mat.Sut, d, op);
      var nf = {};
      CRITERIOS.forEach(function (c) { nf[c] = N.nFatiga(d, m.Se, mat.Sut, mat.Sy, k.Kf, k.Kfs, Ma, Mm, Ta, Tm, c); });
      var fl = N.nFluencia(d, mat.Sy, k.Kf, k.Kfs, Ma, Mm, Ta, Tm);
      var dF = (Ma > 0 || Tm > 0) ? N.diametroFatiga(nObj, mat.Sut, mat.Sy, k.Kf, k.Kfs, Ma, Mm, Ta, Tm, f.criterio, op, d) : { d: 0, iteraciones: 0 };
      var dE = N.diametroEstatico(s.M, s.T, mat.Sy, nObj, caso.estatico.aplicarKt ? k.Kt : 1, caso.estatico.aplicarKt ? k.Kts : 1, 'von_mises');
      if (m.aviso) avisos.push('Punto "' + p.nombre + '": ' + m.aviso + '.');
      if (p.tipo === 'tabla71') conTabla71.push(p.nombre);
      return { def: p, x: x, d: d, sol: s, k: k, Ma: Ma, Mm: Mm, Ta: Ta, Tm: Tm, est: e, nEst: ne, marin: m,
               nFat: nf, fluencia: fl, dMinFatiga: dF.d, dMinEstatico: dE };
    });
    if (conTabla71.length) avisos.push('K_t estimado con la tabla 7-1 (solo primera iteración) en: ' + conTabla71.join(', ') + '. Cuando definas los radios, reemplázalo por el de las gráficas A-15.');
    var critF = null, critE = null;
    puntos.forEach(function (p) {
      if (!critF || p.nFat[f.criterio] < critF.nFat[f.criterio]) critF = p;
      if (!critE || p.nEst.vonMises < critE.nEst.vonMises) critE = p;
    });
    if (critF && critF.nFat[f.criterio] < nObj) avisos.push('Fatiga: el punto "' + critF.def.nombre + '" tiene n = ' + critF.nFat[f.criterio].toFixed(2).replace('.', ',') + ', bajo el objetivo ' + nObj + '. Diámetro mínimo: ' + critF.dMinFatiga.toFixed(1).replace('.', ',') + ' mm.');
    if (critE && critE.nEst.vonMises < nObj) avisos.push('Estático: el punto "' + critE.def.nombre + '" tiene n = ' + critE.nEst.vonMises.toFixed(2).replace('.', ',') + ', bajo el objetivo ' + nObj + '.');

    // Ángulo de giro total: ∫ T(x) / (J(x)·G) dx
    var G = Number(caso.G) || E.G_ACERO, phi = 0, ps = viga.puntos;
    for (var i = 1; i < ps.length; i++) {
      var xm = (ps[i].x + ps[i - 1].x) / 2, dx = ps[i].x - ps[i - 1].x;
      var Tm2 = N.solicitacionEn(caso, xm).T, J = N.seccion(N.diametroEn(caso.geometria, xm)).J;
      phi += Tm2 * dx / (J * G);
    }
    if (!puntos.length) avisos.push('Agrega al menos un punto crítico en la pestaña 4.');
    return { mat: mat, viga: viga, puntos: puntos, critFatiga: critF, critEstatico: critE, phi: phi, avisos: avisos, criterio: f.criterio, nObj: nObj };
  }

  E.CRITERIOS = CRITERIOS;
  E.evaluar = evaluar;
})(window.EJES);

// Interfaz de la calculadora de ejes. Lee y escribe el "caso" (JSON) y llama
// a EJES.evaluar; no contiene fórmulas de ingeniería.
(function (E) {
  'use strict';
  var N = E.nucleo, CLAVE_LS = 'calc-ejes-caso-v1', caso, res;
  var CORTO = { goodman: 'Goodman', gerber: 'Gerber', asme: 'ASME', soderberg: 'Soderberg' };
  var NOMBRE_CRIT = { goodman: 'ED-Goodman', gerber: 'ED-Gerber', asme: 'ED-ASME elíptico', soderberg: 'ED-Soderberg' };

  // ---------- utilidades ----------
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(x, dec) {
    if (x === null || x === undefined || !isFinite(x)) return x === Infinity ? '∞' : '—';
    return Number(x).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function obtener(o, ruta) { return ruta.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function fijar(o, ruta, v) { var k = ruta.split('.'); for (var i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = v; }
  function opciones(lista, actual) {
    return lista.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(actual) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function num(ruta, et, u, extra) {
    var v = obtener(caso, ruta);
    return '<div class="campo"><label>' + et + '</label><input type="number" step="any" data-b="' + ruta + '" data-t="n" value="' + esc(v === undefined ? '' : v) + '"' + (extra || '') + '><span class="u">' + (u || '') + '</span></div>';
  }
  function chk(ruta, et) {
    return '<label class="check"><input type="checkbox" data-b="' + ruta + '" data-t="b"' + (obtener(caso, ruta) ? ' checked' : '') + '> ' + et + '</label>';
  }
  function guardarLocal() { try { localStorage.setItem(CLAVE_LS, JSON.stringify(caso)); } catch (e) { /* sin almacenamiento */ } }
  function casoValido(c) { return c && c.version === E.VERSION_CASO && Array.isArray(c.geometria) && Array.isArray(c.cargas) && Array.isArray(c.puntos) && c.material && c.fatiga; }
  function leerLocal() { try { var c = JSON.parse(localStorage.getItem(CLAVE_LS)); if (casoValido(c)) return c; } catch (e) { /* nada */ } return null; }
  function colores() {
    var s = getComputedStyle(document.documentElement);
    return { c1: s.getPropertyValue('--serie1').trim(), c2: s.getPropertyValue('--serie2').trim(), c3: s.getPropertyValue('--serie3').trim(), c4: s.getPropertyValue('--serie4').trim() };
  }

  // ---------- 1 · material y criterios ----------
  function renderMaterial() {
    var h = '<div class="dos"><div>';
    h += '<div class="tarjeta"><h2>Caso</h2><div class="campo ancho"><label>Nombre</label><input type="text" data-b="nombre" data-t="s" value="' + esc(caso.nombre) + '"></div></div>';
    h += '<div class="tarjeta"><h2>Material</h2>' + chk('material.manual', 'Ingresar S_ut y S_y a mano').replace('data-t="b"', 'data-t="b" data-re="1"');
    if (caso.material.manual) h += num('material.Sut', 'Resistencia última S_ut', 'MPa') + num('material.Sy', 'Fluencia S_y', 'MPa');
    else h += '<div class="campo ancho"><label>Acero</label><select data-b="material.id" data-t="s">' + opciones(E.MATERIALES.map(function (m) { return [m.id, m.nombre + ' — S_ut ' + m.Sut + ', S_y ' + m.Sy + ' MPa']; }), caso.material.id) + '</select></div><p class="fuente">' + esc(E.FUENTES.SH_A20.cita) + '</p>';
    h += num('G', 'Módulo de rigidez G', 'MPa') + '<p class="fuente">G = 79 300 MPa para acero al carbono (Shigley tabla A-5).</p></div>';
    h += '<div class="tarjeta"><h2>Objetivo</h2>' + num('nObjetivo', 'Factor de seguridad objetivo n', '') +
      '<p class="nota">Se usa para el diámetro mínimo y para marcar los puntos que no cumplen.</p></div>';
    h += '</div><div>';
    h += '<div class="tarjeta"><h2>Fatiga (Shigley)</h2>' +
      '<div class="campo ancho"><label>Criterio</label><select data-b="fatiga.criterio" data-t="s">' + opciones(E.CRITERIOS.map(function (c) { return [c, NOMBRE_CRIT[c]]; }), caso.fatiga.criterio) + '</select></div>' +
      '<div class="campo ancho"><label>Acabado (k_a)</label><select data-b="fatiga.acabado" data-t="s">' + opciones(E.ACABADOS.map(function (a) { return [a.id, a.nombre]; }), caso.fatiga.acabado) + '</select></div>' +
      chk('fatiga.rotativo', 'El eje gira (si no, k_b usa d_e = 0,370·d)') +
      '<div class="campo ancho"><label>Confiabilidad (k_e)</label><select data-b="fatiga.confiabilidad" data-t="n">' + opciones(E.CONFIABILIDAD.map(function (c) { return [c[0], c[0] + ' % → k_e = ' + c[1]]; }), caso.fatiga.confiabilidad) + '</select></div>' +
      num('fatiga.T_C', 'Temperatura de operación (k_d)', '°C') + num('fatiga.kfVarios', 'Factor de efectos varios k_f', '') +
      num('fatiga.TaPct', 'Torque alternante (% del torque)', '%') +
      '<p class="nota">Eje giratorio: la flexión se invierte por completo (M_a = M, M_m = 0) y el torque es constante (T_m = T), como plantea Shigley en la sec. 7-4. Si el torque fluctúa, indica su amplitud en %.</p></div>';
    h += '<div class="tarjeta"><h2>Estático (Philpot)</h2>' + chk('estatico.aplicarKt', 'Aplicar K_t al esfuerzo máximo (conservador)') +
      '<p class="nota">En materiales dúctiles con carga estática la concentración suele despreciarse porque el material fluye localmente; aplicarla deja el cálculo del lado seguro.</p></div>';
    h += '</div></div>';
    $('#p-material').innerHTML = h;
  }

  // ---------- esquema del eje ----------
  function esquemaEje(cont, conPuntos) {
    var W = 720, H = 210, m = 30, L = N.largoTotal(caso.geometria);
    if (!(L > 0)) { cont.innerHTML = ''; return; }
    var dmax = Math.max.apply(null, caso.geometria.map(function (t) { return Number(t.d) || 0; })) || 1;
    var X = function (x) { return m + x / L * (W - 2 * m); }, eje = 100, esc2 = 70 / dmax;
    var c = colores(), s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="grafico" role="img" aria-label="Esquema del eje">';
    var x0 = 0;
    caso.geometria.forEach(function (t) {
      var h = Number(t.d) * esc2;
      s += '<rect x="' + X(x0) + '" y="' + (eje - h / 2) + '" width="' + (X(x0 + Number(t.L)) - X(x0)) + '" height="' + h + '" fill="var(--acento-suave)" stroke="var(--acento)" stroke-width="1.5"/>';
      s += '<text x="' + (X(x0) + X(x0 + Number(t.L))) / 2 + '" y="' + (eje + 4) + '" text-anchor="middle">Ø' + fmt(Number(t.d), 0) + '</text>';
      x0 += Number(t.L);
    });
    s += '<line x1="' + (m - 10) + '" x2="' + (W - m + 10) + '" y1="' + eje + '" y2="' + eje + '" stroke="var(--suave)" stroke-dasharray="8 4 2 4"/>';
    caso.apoyos.forEach(function (a, i) {
      var xa = X(Number(a)), yb = eje + dmax * esc2 / 2 + 4;
      s += '<path d="M' + xa + ' ' + yb + ' l-9 16 h18 z" fill="var(--panel)" stroke="var(--texto)" stroke-width="1.5"/>';
      s += '<text x="' + xa + '" y="' + (yb + 30) + '" text-anchor="middle">' + 'AB'[i] + '</text>';
    });
    caso.cargas.forEach(function (q) {
      var xq = X(Number(q.x)), yt = eje - dmax * esc2 / 2 - 8;
      s += '<path d="M' + xq + ' ' + (yt - 34) + ' V' + yt + '" stroke="' + c.c2 + '" stroke-width="2.5"/><path d="M' + (xq - 5) + ' ' + (yt - 8) + ' l5 8 l5 -8 z" fill="' + c.c2 + '"/>';
      s += '<text x="' + xq + '" y="' + (yt - 40) + '" text-anchor="middle" style="fill:' + c.c2 + '">' + esc(q.nombre) + '</text>';
    });
    if (conPuntos) caso.puntos.forEach(function (p, i) {
      var xp = X(Number(p.x));
      s += '<circle cx="' + xp + '" cy="' + eje + '" r="7" fill="' + c.c4 + '"/><text x="' + xp + '" y="' + (eje + 4) + '" text-anchor="middle" style="fill:#fff;font-weight:700;font-size:10px">' + (i + 1) + '</text>';
    });
    s += '<text x="' + X(0) + '" y="' + (H - 6) + '" text-anchor="middle">0</text><text x="' + X(L) + '" y="' + (H - 6) + '" text-anchor="middle">' + fmt(L, 0) + ' mm</text></svg>';
    cont.innerHTML = s;
  }

  // ---------- 2 · geometría ----------
  function renderGeometria() {
    var h = '<div class="tarjeta"><h2>Esquema</h2><div id="esq-geo"></div><p class="nota">Las flechas marcan dónde actúan las cargas; los triángulos, los apoyos (cojinetes).</p></div>';
    h += '<div class="dos"><div class="tarjeta"><h2>Tramos (de izquierda a derecha)</h2><table><tr><th>#</th><th class="num">Largo L [mm]</th><th class="num">Diámetro d [mm]</th><th class="num">Desde x [mm]</th><th></th></tr>';
    var b = N.bordes(caso.geometria);
    caso.geometria.forEach(function (t, i) {
      h += '<tr><td>' + (i + 1) + '</td><td><input type="number" step="any" data-b="geometria.' + i + '.L" data-t="n" value="' + esc(t.L) + '"></td>' +
        '<td><input type="number" step="any" data-b="geometria.' + i + '.d" data-t="n" value="' + esc(t.d) + '"></td><td class="num">' + fmt(b[i], 0) + '</td>' +
        '<td><button class="btn chico quitar" data-accion="quitar-tramo" data-i="' + i + '">✕</button></td></tr>';
    });
    h += '</table><button class="btn chico" data-accion="agregar-tramo" style="margin-top:6px">+ Tramo</button></div>';
    h += '<div class="tarjeta"><h2>Apoyos</h2>' + num('apoyos.0', 'Apoyo A en x', 'mm') + num('apoyos.1', 'Apoyo B en x', 'mm') +
      '<p class="nota">Dos apoyos simples (cojinetes): el eje es estáticamente determinado. Las cargas pueden quedar entre los apoyos o en voladizo.</p></div></div>';
    $('#p-geometria').innerHTML = h;
  }

  // ---------- 3 · cargas ----------
  function renderCargas() {
    var h = '<div class="tarjeta"><h2>Cargas puntuales</h2><div class="tabla-scroll"><table><tr><th>Nombre</th><th class="num">x [mm]</th><th class="num">F_y [N]</th><th class="num">F_z [N]</th><th class="num">T [N·m]</th><th></th></tr>';
    caso.cargas.forEach(function (q, i) {
      var r = 'cargas.' + i + '.';
      h += '<tr><td><input type="text" data-b="' + r + 'nombre" data-t="s" value="' + esc(q.nombre) + '"></td>' +
        ['x', 'Fy', 'Fz', 'T'].map(function (k) { return '<td><input type="number" step="any" data-b="' + r + k + '" data-t="n" value="' + esc(q[k]) + '"></td>'; }).join('') +
        '<td><button class="btn chico quitar" data-accion="quitar-carga" data-i="' + i + '">✕</button></td></tr>';
    });
    h += '</table></div><button class="btn chico" data-accion="agregar-carga" style="margin-top:6px">+ Carga</button>' +
      '<p class="nota">F_y y F_z son las componentes en los dos planos perpendiculares al eje. T es el torque aplicado, con signo según la regla de la mano derecha sobre +x (Philpot 6.6): el que entra y el que sale deben sumar cero.</p></div>';
    h += '<div class="dos"><div class="tarjeta"><h2>Ayuda: fuerzas de un engrane recto</h2>' +
      '<div class="campo"><label>Torque T</label><input type="number" step="any" id="ay-T" value="150"><span class="u">N·m</span></div>' +
      '<div class="campo"><label>Diámetro de paso</label><input type="number" step="any" id="ay-d" value="75"><span class="u">mm</span></div>' +
      '<div class="campo"><label>Ángulo de presión</label><input type="number" step="any" id="ay-phi" value="20"><span class="u">°</span></div>' +
      '<p id="ay-res" class="nota"></p>' +
      '<p class="nota">Fuerza tangencial F_t = 2T/d y radial F_r = F_t·tan φ (conocimiento general de engranes rectos; no está en el corpus de estos ramos). Asigna tú los signos según la geometría del reductor.</p></div>';
    h += '<div class="tarjeta"><h2>Ayuda: torque desde la potencia</h2>' +
      '<div class="campo"><label>Potencia P</label><input type="number" step="any" id="ay-P" value="15"><span class="u">kW</span></div>' +
      '<div class="campo"><label>Velocidad</label><input type="number" step="any" id="ay-n" value="1000"><span class="u">rpm</span></div>' +
      '<p id="ay-res2" class="nota"></p><p class="fuente">P = T·ω (Philpot ec. 6.17).</p></div></div>';
    h += '<div class="tarjeta"><h2>Reacciones en los apoyos</h2><table id="res-reac"></table></div>';
    $('#p-cargas').innerHTML = h;
    ayudas();
  }
  function ayudas() {
    var T = Number(($('#ay-T') || {}).value), d = Number(($('#ay-d') || {}).value), ph = Number(($('#ay-phi') || {}).value);
    if ($('#ay-res')) { var Ft = 2 * T * 1000 / d; $('#ay-res').innerHTML = 'F_t = <b>' + fmt(Ft, 0) + ' N</b> · F_r = <b>' + fmt(Ft * Math.tan(ph * Math.PI / 180), 0) + ' N</b>'; }
    var P = Number(($('#ay-P') || {}).value), n = Number(($('#ay-n') || {}).value);
    if ($('#ay-res2')) $('#ay-res2').innerHTML = 'T = <b>' + fmt(N.torqueDesdePotencia(P * 1000, n) / 1000, 2) + ' N·m</b>';
  }

  // ---------- 5 · puntos críticos ----------
  function valorTipo(p) { return p.tipo === 'tabla71' ? 'tabla71:' + p.ref : p.tipo; }
  function renderPuntos() {
    var tipos = [['liso', 'Sin concentración (K = 1)']].concat(E.KT_TABLA71.map(function (t) { return ['tabla71:' + t.id, t.nombre + ' — tabla 7-1']; })).concat([['manual', 'K_t ingresado (gráficas A-15)']]);
    var h = '<div class="tarjeta"><h2>Ubicación de los puntos</h2><div id="esq-pts"></div></div>';
    h += '<div class="tarjeta"><h2>Puntos críticos</h2><div class="tabla-scroll"><table><tr><th>#</th><th>Nombre</th><th class="num">x [mm]</th><th>Concentración</th><th class="num">K_t</th><th class="num">K_ts</th><th class="num">r muesca [mm]</th><th></th></tr>';
    caso.puntos.forEach(function (p, i) {
      var r = 'puntos.' + i + '.', man = p.tipo === 'manual' ? '' : ' disabled';
      h += '<tr><td>' + (i + 1) + '</td><td><input type="text" data-b="' + r + 'nombre" data-t="s" value="' + esc(p.nombre) + '"></td>' +
        '<td><input type="number" step="any" data-b="' + r + 'x" data-t="n" value="' + esc(p.x) + '"></td>' +
        '<td><select data-tipo="' + i + '">' + opciones(tipos, valorTipo(p)) + '</select></td>' +
        '<td><input type="number" step="any" data-b="' + r + 'Kt" data-t="n" value="' + esc(p.Kt) + '"' + man + '></td>' +
        '<td><input type="number" step="any" data-b="' + r + 'Kts" data-t="n" value="' + esc(p.Kts) + '"' + man + '></td>' +
        '<td><input type="number" step="any" data-b="' + r + 'r" data-t="n" value="' + esc(p.r === null || p.r === undefined ? '' : p.r) + '"></td>' +
        '<td><button class="btn chico quitar" data-accion="quitar-punto" data-i="' + i + '">✕</button></td></tr>';
    });
    h += '</table></div><div class="no-imprimir" style="margin-top:6px"><button class="btn chico" data-accion="agregar-punto">+ Punto</button> ' +
      '<button class="btn chico" data-accion="auto-hombros">+ Agregar los hombros que falten</button></div>' +
      '<p class="nota">Con el radio de la muesca r se calcula q por Neuber (Shigley ec. 6-34); sin r se usa q = 1, que deja K_f = K_t (conservador). En un hombro se usa el diámetro menor.</p></div>';
    h += '<div class="tarjeta"><h2>Resultados por punto</h2><div class="tabla-scroll"><table id="res-puntos"></table></div><p class="nota" id="nota-puntos"></p></div>';
    $('#p-puntos').innerHTML = h;
  }

  // ---------- catálogo ----------
  function renderCatalogo() {
    var h = '<div class="rejilla"><div class="tarjeta"><h2>Aceros (tabla A-20)</h2><table><tr><th>Acero</th><th class="num">S_ut</th><th class="num">S_y</th></tr>';
    E.MATERIALES.forEach(function (m) { h += '<tr><td>' + m.nombre + '</td><td class="num">' + m.Sut + '</td><td class="num">' + m.Sy + '</td></tr>'; });
    h += '</table><p class="fuente">' + esc(E.FUENTES.SH_A20.cita) + ' Valores en MPa.</p></div><div>';
    h += '<div class="tarjeta"><h2>Factor de superficie k_a = a·S_ut^b</h2><table><tr><th>Acabado</th><th class="num">a [MPa]</th><th class="num">b</th></tr>';
    E.ACABADOS.forEach(function (a) { h += '<tr><td>' + a.nombre + '</td><td class="num">' + a.a + '</td><td class="num">' + a.b + '</td></tr>'; });
    h += '</table><p class="fuente">' + esc(E.FUENTES.SH_62.cita) + '</p></div>';
    h += '<div class="tarjeta"><h2>Estimaciones de K_t (tabla 7-1)</h2><table><tr><th>Elemento</th><th class="num">K_t</th><th class="num">K_ts</th></tr>';
    E.KT_TABLA71.forEach(function (t) { h += '<tr><td>' + t.nombre + '</td><td class="num">' + t.Kt + '</td><td class="num">' + t.Kts + '</td></tr>'; });
    h += '</table><p class="fuente">' + esc(E.FUENTES.SH_71.cita) + '</p></div></div></div>';
    h += '<div class="tarjeta"><h2>Fuentes</h2><ul>' + Object.keys(E.FUENTES).map(function (k) { return '<li>' + esc(E.FUENTES[k].cita) + '</li>'; }).join('') + '</ul>' +
      '<p class="nota">Las gráficas de K_t (Shigley A-15, Philpot 6.10 y 8.9) no se digitalizaron: léelas en el libro e ingresa el valor con la opción "K_t ingresado". Normas y catálogos cambian: verifica contra la edición vigente.</p></div>';
    $('#p-catalogo').innerHTML = h;
  }

  // ---------- resultados ----------
  function kpi(et, val, u, cl) { return '<div class="kpi ' + (cl || '') + '"><div class="et">' + et + '</div><div class="val">' + val + (u ? ' <small>' + u + '</small>' : '') + '</div></div>'; }
  function actualizarResumen() {
    var h = kpi('Material', esc(res.mat ? res.mat.nombre : '—'));
    if (res.critFatiga) {
      var nf = res.critFatiga.nFat[res.criterio], ne = res.critEstatico.nEst.vonMises;
      h += kpi('n fatiga mínimo (' + NOMBRE_CRIT[res.criterio] + ')', fmt(nf, 2) + ' <small>en ' + esc(res.critFatiga.def.nombre) + '</small>', '', nf >= res.nObj ? 'ok' : 'mal');
      h += kpi('n estático mínimo (von Mises)', fmt(ne, 2) + ' <small>en ' + esc(res.critEstatico.def.nombre) + '</small>', '', ne >= res.nObj ? 'ok' : 'mal');
      h += kpi('d mínimo en ese punto (fatiga)', fmt(res.critFatiga.dMinFatiga, 1), 'mm');
    }
    h += kpi('Ángulo de giro total', fmt(res.phi * 180 / Math.PI, 3), '°');
    $('#resumen').innerHTML = h;
    $('#avisos').innerHTML = res.avisos.map(function (a) { return '<div class="aviso">' + esc(a) + '</div>'; }).join('');
    $('#nombre-caso').textContent = caso.nombre;
  }

  function actualizarCargas() {
    var t = $('#res-reac'); if (!t || !res.viga) return;
    var R = res.viga.R;
    t.innerHTML = '<tr><th>Apoyo</th><th class="num">x [mm]</th><th class="num">R_y [N]</th><th class="num">R_z [N]</th><th class="num">Resultante [N]</th></tr>' +
      [0, 1].map(function (i) { return '<tr><td>' + 'AB'[i] + '</td><td class="num">' + fmt(Number(caso.apoyos[i]), 0) + '</td><td class="num">' + fmt(R.y[i], 1) + '</td><td class="num">' + fmt(R.z[i], 1) + '</td><td class="num">' + fmt(Math.hypot(R.y[i], R.z[i]), 1) + '</td></tr>'; }).join('');
  }

  function actualizarDiagramas() {
    var cont = $('#p-diagramas');
    if (!res.viga) { cont.innerHTML = ''; return; }
    if (!$('#g-m')) cont.innerHTML = '<div class="tarjeta"><h2>Momento flector</h2><div id="g-m"></div><p class="nota">M = √(M_y² + M_z²): en un eje redondo que gira, lo que importa es la resultante de los dos planos.</p></div>' +
      '<div class="dos"><div class="tarjeta"><h2>Torque</h2><div id="g-t"></div></div><div class="tarjeta"><h2>Corte</h2><div id="g-v"></div></div></div>';
    var c = colores(), p = res.viga.puntos, ptsCrit = res.puntos.map(function (q, i) { return { x: q.x, y: q.sol.M / 1000, texto: String(i + 1), color: c.c4 }; });
    E.graficoLineas($('#g-m'), { xLabel: 'Posición x [mm]', yLabel: 'M [N·m]', series: [
      { nombre: 'M resultante', pts: p.map(function (q) { return [q.x, q.M / 1000]; }), color: c.c1 },
      { nombre: 'M_y (plano xy)', pts: p.map(function (q) { return [q.x, q.My / 1000]; }), color: c.c2, guion: '6 4' },
      { nombre: 'M_z (plano xz)', pts: p.map(function (q) { return [q.x, q.Mz / 1000]; }), color: c.c3, guion: '6 4' }], marcadores: ptsCrit });
    E.graficoLineas($('#g-t'), { xLabel: 'Posición x [mm]', yLabel: 'T [N·m]', series: [{ nombre: 'Torque |T|', pts: p.map(function (q) { return [q.x, q.T / 1000]; }), color: c.c4 }] });
    E.graficoLineas($('#g-v'), { xLabel: 'Posición x [mm]', yLabel: 'V [N]', series: [
      { nombre: 'V_y', pts: p.map(function (q) { return [q.x, q.Vy]; }), color: c.c2 },
      { nombre: 'V_z', pts: p.map(function (q) { return [q.x, q.Vz]; }), color: c.c3 }] });
  }

  function claseN(n) { return n >= res.nObj ? '' : ' style="color:var(--error);font-weight:700"'; }
  function actualizarPuntos() {
    var t = $('#res-puntos'); if (!t) return;
    var cr = res.criterio, h = '<tr><th>#</th><th>Punto</th><th class="num">d [mm]</th><th class="num">M [N·m]</th><th class="num">T [N·m]</th><th class="num">K_f / K_fs</th><th class="num">n estático VM / Tresca</th><th class="num">n ' + NOMBRE_CRIT[cr] + '</th><th class="num">Otros criterios</th><th class="num">n_y</th><th class="num">d mín fatiga</th><th class="num">d mín estático</th></tr>';
    res.puntos.forEach(function (p, i) {
      var otros = E.CRITERIOS.filter(function (c) { return c !== cr; }).map(function (c) { return CORTO[c] + ' ' + fmt(p.nFat[c], 2); }).join(' · ');
      h += '<tr><td>' + (i + 1) + '</td><td>' + esc(p.def.nombre) + '</td><td class="num">' + fmt(p.d, 1) + '</td><td class="num">' + fmt(p.sol.M / 1000, 1) + '</td><td class="num">' + fmt(p.sol.T / 1000, 1) + '</td>' +
        '<td class="num">' + fmt(p.k.Kf, 2) + ' / ' + fmt(p.k.Kfs, 2) + '</td>' +
        '<td class="num"><span' + claseN(p.nEst.vonMises) + '>' + fmt(p.nEst.vonMises, 2) + '</span> / ' + fmt(p.nEst.tresca, 2) + '</td>' +
        '<td class="num"><b' + claseN(p.nFat[cr]) + '>' + fmt(p.nFat[cr], 2) + '</b></td><td class="num" style="font-size:12px">' + otros + '</td>' +
        '<td class="num"><span' + claseN(p.fluencia.nY) + '>' + fmt(p.fluencia.nY, 2) + '</span></td><td class="num">' + fmt(p.dMinFatiga, 1) + '</td><td class="num">' + fmt(p.dMinEstatico, 1) + '</td></tr>';
    });
    t.innerHTML = h;
    $('#nota-puntos').textContent = 'En rojo, los valores bajo el objetivo n = ' + fmt(res.nObj, 2) + '. El diámetro mínimo a fatiga se itera porque k_b depende de d.';
  }

  function fila(et, v, u) { return '<tr><td>' + et + '</td><td class="num"><b>' + v + '</b></td><td>' + (u || '') + '</td></tr>'; }
  function actualizarMemoria() {
    if (!res.viga) { $('#p-memoria').innerHTML = ''; return; }
    var h = '<div class="memoria"><div class="tarjeta"><h2>Memoria de cálculo: ' + esc(caso.nombre) + '</h2><p class="nota">Generada el ' + new Date().toLocaleString('es-CL') + '.</p><table>' +
      fila('Material', esc(res.mat.nombre) + ': S_ut = ' + fmt(res.mat.Sut, 0) + ' MPa, S_y = ' + fmt(res.mat.Sy, 0) + ' MPa') +
      fila('Criterio de fatiga; n objetivo', NOMBRE_CRIT[res.criterio] + '; ' + fmt(res.nObj, 2)) +
      fila('Largo; apoyos A y B', fmt(res.viga.L, 0) + ' mm; ' + caso.apoyos.join(' y ') + ' mm') +
      fila('Reacciones A (y, z)', fmt(res.viga.R.y[0], 1) + '; ' + fmt(res.viga.R.z[0], 1), 'N') +
      fila('Reacciones B (y, z)', fmt(res.viga.R.y[1], 1) + '; ' + fmt(res.viga.R.z[1], 1), 'N') +
      fila('Ángulo de giro total φ = ∫T/(JG) dx', fmt(res.phi, 5) + ' rad = ' + fmt(res.phi * 180 / Math.PI, 3) + '°') + '</table></div>';
    res.puntos.forEach(function (p, i) {
      var m = p.marin;
      h += '<div class="tarjeta"><h3>Punto ' + (i + 1) + ': ' + esc(p.def.nombre) + ' (x = ' + fmt(p.x, 0) + ' mm, d = ' + fmt(p.d, 1) + ' mm)</h3><table>' +
        fila('Solicitación: M_y; M_z; M; T', fmt(p.sol.My / 1000, 2) + '; ' + fmt(p.sol.Mz / 1000, 2) + '; ' + fmt(p.sol.M / 1000, 2) + '; ' + fmt(p.sol.T / 1000, 2), 'N·m') +
        fila('Concentración', esc(p.k.origen) + '. K_t = ' + fmt(p.k.Kt, 2) + ', K_ts = ' + fmt(p.k.Kts, 2)) +
        fila('Sensibilidad (Shigley ec. 6-34)', esc(p.k.qOrigen) + ': q = ' + fmt(p.k.q, 3) + ', q_s = ' + fmt(p.k.qs, 3)) +
        fila('K_f = 1 + q(K_t − 1); K_fs', fmt(p.k.Kf, 3) + '; ' + fmt(p.k.Kfs, 3)) +
        '<tr><td colspan="3"><b>Estático (Philpot 15.4-15.5)</b></td></tr>' +
        fila('σ = K_t·32M/(πd³); τ = K_ts·16T/(πd³)', fmt(p.est.sigma, 2) + '; ' + fmt(p.est.tau, 2), 'MPa') +
        fila('Principales σ₁; σ₂; τ_máx abs', fmt(p.est.s1, 2) + '; ' + fmt(p.est.s2, 2) + '; ' + fmt(p.est.tauMaxAbs, 2), 'MPa') +
        fila('Von Mises σ\' = √(σ₁² − σ₁σ₂ + σ₂²)', fmt(p.est.vonMises, 2), 'MPa') +
        fila('n von Mises = S_y/σ\'; n Tresca = S_y/(2τ_máx)', fmt(p.nEst.vonMises, 3) + '; ' + fmt(p.nEst.tresca, 3)) +
        '<tr><td colspan="3"><b>Fatiga (Shigley 6-9 y 7-4)</b></td></tr>' +
        fila('S\'e (6-8); k_a (6-19); k_b (6-20)', fmt(m.SePrima, 1) + ' MPa; ' + fmt(m.ka, 4) + '; ' + fmt(m.kb, 4)) +
        fila('k_c; k_d; k_e; k_f', fmt(m.kc, 2) + '; ' + fmt(m.kd, 4) + '; ' + fmt(m.ke, 3) + '; ' + fmt(m.kf, 3)) +
        fila('S_e = k_a k_b k_c k_d k_e k_f S\'e (6-18)', fmt(m.Se, 2), 'MPa') +
        fila('M_a; M_m; T_a; T_m', [p.Ma, p.Mm, p.Ta, p.Tm].map(function (v) { return fmt(v / 1000, 2); }).join('; '), 'N·m') +
        fila('n Goodman (7-7); Gerber (7-9)', fmt(p.nFat.goodman, 3) + '; ' + fmt(p.nFat.gerber, 3)) +
        fila('n ASME elíptico (7-11); Soderberg (7-13)', fmt(p.nFat.asme, 3) + '; ' + fmt(p.nFat.soderberg, 3)) +
        fila('σ\'máx (7-15); n_y (7-16)', fmt(p.fluencia.sigmaMaxVM, 2) + ' MPa; ' + fmt(p.fluencia.nY, 3)) +
        fila('d mínimo para n = ' + fmt(res.nObj, 2) + ': fatiga; estático', fmt(p.dMinFatiga, 2) + '; ' + fmt(p.dMinEstatico, 2), 'mm') + '</table></div>';
    });
    if (res.avisos.length) h += '<div class="tarjeta"><h3>Avisos</h3>' + res.avisos.map(function (a) { return '<div class="aviso">' + esc(a) + '</div>'; }).join('') + '</div>';
    h += '<div class="tarjeta"><h3>Fuentes</h3><ul>' + Object.keys(E.FUENTES).map(function (k) { return '<li>' + esc(E.FUENTES[k].cita) + '</li>'; }).join('') + '</ul></div></div>';
    $('#p-memoria').innerHTML = h;
  }

  function recalcular() {
    try { res = E.evaluar(caso); } catch (e) { $('#avisos').innerHTML = '<div class="aviso error">Error de cálculo: ' + esc(e.message) + '</div>'; return; }
    if (res.vacio) { $('#avisos').innerHTML = res.avisos.map(function (a) { return '<div class="aviso">' + esc(a) + '</div>'; }).join(''); return; }
    actualizarResumen(); actualizarCargas(); actualizarDiagramas(); actualizarPuntos(); actualizarMemoria();
    if ($('#esq-geo')) esquemaEje($('#esq-geo'), false);
    if ($('#esq-pts')) esquemaEje($('#esq-pts'), true);
    guardarLocal();
  }
  function renderFormularios() { renderMaterial(); renderGeometria(); renderCargas(); renderPuntos(); $('#p-diagramas').innerHTML = ''; }
  function cargar(c) { caso = E.copiarCaso(c); renderFormularios(); recalcular(); }

  // ---------- eventos ----------
  function manejarCampo(ev) {
    var t = ev.target;
    if (t.id && t.id.indexOf('ay-') === 0) { ayudas(); return; }
    if (t.hasAttribute && t.hasAttribute('data-tipo') && ev.type === 'change') {
      var p = caso.puntos[Number(t.getAttribute('data-tipo'))], v = t.value;
      if (v.indexOf('tabla71:') === 0) { var r = N.buscar(E.KT_TABLA71, v.slice(8)); p.tipo = 'tabla71'; p.ref = r.id; p.Kt = r.Kt; p.Kts = r.Kts; }
      else p.tipo = v;
      renderPuntos(); recalcular(); return;
    }
    var ruta = t.getAttribute && t.getAttribute('data-b');
    if (!ruta) return;
    if (ev.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return;
    var tipo = t.getAttribute('data-t'), val = tipo === 'b' ? t.checked : tipo === 'n' ? (t.value === '' ? '' : Number(t.value)) : t.value;
    fijar(caso, ruta, val);
    if (t.getAttribute('data-re')) renderFormularios();
    if (ruta.indexOf('geometria.') === 0 && ev.type === 'change') renderGeometria();
    recalcular();
  }
  document.addEventListener('input', manejarCampo);
  document.addEventListener('change', manejarCampo);

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-accion],[data-pestana]');
    if (!b) return;
    var pe = b.getAttribute('data-pestana');
    if (pe) return mostrarPestana(pe);
    var a = b.getAttribute('data-accion'), i = Number(b.getAttribute('data-i'));
    if (a === 'ejemplo') { if (confirm('¿Cargar el ejemplo del reductor? Se reemplaza el caso actual.')) cargar(E.EJEMPLOS.reductor); }
    else if (a === 'guardar') descargar();
    else if (a === 'abrir') $('#archivo').click();
    else if (a === 'imprimir') { mostrarPestana('memoria'); setTimeout(function () { window.print(); }, 50); }
    else if (a === 'agregar-tramo') { caso.geometria.push({ L: 50, d: caso.geometria.length ? caso.geometria[caso.geometria.length - 1].d : 30 }); renderGeometria(); recalcular(); }
    else if (a === 'quitar-tramo') { caso.geometria.splice(i, 1); renderGeometria(); recalcular(); }
    else if (a === 'agregar-carga') { caso.cargas.push({ nombre: 'Carga ' + (caso.cargas.length + 1), x: 0, Fy: 0, Fz: 0, T: 0 }); renderCargas(); recalcular(); }
    else if (a === 'quitar-carga') { caso.cargas.splice(i, 1); renderCargas(); recalcular(); }
    else if (a === 'agregar-punto') { caso.puntos.push({ nombre: 'Punto ' + (caso.puntos.length + 1), x: 0, tipo: 'liso', ref: '', Kt: 1, Kts: 1, r: '' }); renderPuntos(); recalcular(); }
    else if (a === 'quitar-punto') { caso.puntos.splice(i, 1); renderPuntos(); recalcular(); }
    else if (a === 'auto-hombros') {
      var bo = N.bordes(caso.geometria);
      for (var k = 1; k < caso.geometria.length; k++) {
        var d1 = Number(caso.geometria[k - 1].d), d2 = Number(caso.geometria[k].d), x = bo[k];
        if (d1 !== d2 && !caso.puntos.some(function (p) { return Math.abs(Number(p.x) - x) < 1e-6; })) {
          var dm = Math.min(d1, d2);
          caso.puntos.push({ nombre: 'Hombro ' + fmt(d1, 0) + '/' + fmt(d2, 0), x: x, tipo: 'tabla71', ref: 'hombro_redondeado', Kt: 1.7, Kts: 1.5, r: Math.round(dm * 0.1 * 10) / 10 });
        }
      }
      caso.puntos.sort(function (p, q) { return Number(p.x) - Number(q.x); });
      renderPuntos(); recalcular();
    }
  });

  function mostrarPestana(p) {
    document.querySelectorAll('nav.pestanas button').forEach(function (b) { b.classList.toggle('activa', b.getAttribute('data-pestana') === p); });
    document.querySelectorAll('.pestana').forEach(function (s) { s.classList.toggle('activa', s.id === 'p-' + p); });
    if (p === 'diagramas' || p === 'geometria' || p === 'puntos') recalcular();
    try { history.replaceState(null, '', '#' + p); } catch (e) { /* file:// */ }
  }

  function descargar() {
    var blob = new Blob([JSON.stringify(caso, null, 2)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (caso.nombre || 'eje').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().replace(/\s+/g, '_') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  $('#archivo').addEventListener('change', function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    var lec = new FileReader();
    lec.onload = function () {
      try { var c = JSON.parse(lec.result); if (!casoValido(c)) throw new Error('el archivo no es un caso de esta calculadora.'); cargar(c); }
      catch (e) { alert('No se pudo abrir: ' + e.message); }
      ev.target.value = '';
    };
    lec.readAsText(f);
  });

  renderCatalogo();
  cargar(leerLocal() || E.EJEMPLOS.reductor);
  var ini = location.hash.slice(1);
  if (document.getElementById('p-' + ini)) mostrarPestana(ini);
})(window.EJES);

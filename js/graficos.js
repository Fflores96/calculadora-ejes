// Gráficos SVG simples, sin librerías externas (funciona sin internet).
window.EJES = window.EJES || {};

(function (P) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(nombre, attrs, padre) {
    var e = document.createElementNS(NS, nombre);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(e);
    return e;
  }

  // Marcas "redondas" para un eje.
  function marcas(min, max, n) {
    var paso = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(paso))), r = paso / mag;
    paso = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
    var ini = Math.floor(min / paso) * paso, fin = Math.ceil(max / paso) * paso, out = [];
    for (var v = ini; v <= fin + paso * 1e-9; v += paso) out.push(Math.round(v / paso) * paso);
    return out;
  }

  function fmt(v) { return Math.abs(v) >= 1000 ? v.toFixed(0) : Number(v.toPrecision(4)).toString().replace('.', ','); }

  // opts: { xLabel, yLabel, series: [{nombre, pts, color, guion, puntos}], marcadores: [{x, y, texto, color}], vertical: [{x, texto}] }
  P.graficoLineas = function (contenedor, opts) {
    contenedor.innerHTML = '';
    var W = 640, H = 340, m = { i: 54, d: 16, s: 14, b: 42 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'grafico', role: 'img', 'aria-label': opts.titulo || '' }, contenedor);
    var xs = [], ys = [];
    opts.series.forEach(function (s) { s.pts.forEach(function (p) { if (isFinite(p[1])) { xs.push(p[0]); ys.push(p[1]); } }); });
    (opts.marcadores || []).forEach(function (p) { xs.push(p.x); ys.push(p.y); });
    if (!xs.length) return;
    var xmin = Math.min(0, Math.min.apply(null, xs)), xmax = Math.max.apply(null, xs);
    var ymin = Math.min(0, Math.min.apply(null, ys)), ymax = Math.max.apply(null, ys) * 1.08;
    if (xmax === xmin) xmax = xmin + 1;
    if (ymax === ymin) ymax = ymin + 1;
    var mx = marcas(xmin, xmax, 7), my = marcas(ymin, ymax, 6);
    xmin = mx[0]; xmax = mx[mx.length - 1]; ymin = my[0]; ymax = my[my.length - 1];
    var X = function (x) { return m.i + (x - xmin) / (xmax - xmin) * (W - m.i - m.d); };
    var Y = function (y) { return H - m.b - (y - ymin) / (ymax - ymin) * (H - m.s - m.b); };

    mx.forEach(function (v) {
      el('line', { x1: X(v), x2: X(v), y1: Y(ymin), y2: Y(ymax), class: 'rejilla-l' }, svg);
      el('text', { x: X(v), y: H - m.b + 15, 'text-anchor': 'middle' }, svg).textContent = fmt(v);
    });
    my.forEach(function (v) {
      el('line', { x1: X(xmin), x2: X(xmax), y1: Y(v), y2: Y(v), class: 'rejilla-l' }, svg);
      el('text', { x: m.i - 6, y: Y(v) + 4, 'text-anchor': 'end' }, svg).textContent = fmt(v);
    });
    el('line', { x1: X(xmin), x2: X(xmax), y1: Y(ymin), y2: Y(ymin), class: 'eje' }, svg);
    el('line', { x1: X(xmin), x2: X(xmin), y1: Y(ymin), y2: Y(ymax), class: 'eje' }, svg);
    el('text', { x: (m.i + W - m.d) / 2, y: H - 6, 'text-anchor': 'middle' }, svg).textContent = opts.xLabel;
    el('text', { x: 14, y: (m.s + H - m.b) / 2, 'text-anchor': 'middle', transform: 'rotate(-90 14 ' + (m.s + H - m.b) / 2 + ')' }, svg).textContent = opts.yLabel;

    (opts.vertical || []).forEach(function (v) {
      el('line', { x1: X(v.x), x2: X(v.x), y1: Y(ymin), y2: Y(ymax), stroke: 'currentColor', 'stroke-dasharray': '5 4', opacity: .35 }, svg);
      el('text', { x: X(v.x) + 4, y: m.s + 10 }, svg).textContent = v.texto;
    });

    opts.series.forEach(function (s) {
      var pts = s.pts.filter(function (p) { return isFinite(p[1]); });
      if (!pts.length) return;
      if (!s.soloPuntos) {
        var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ');
        el('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2.2, 'stroke-dasharray': s.guion || '' }, svg);
      }
      if (s.puntos || s.soloPuntos) pts.forEach(function (p) { el('circle', { cx: X(p[0]), cy: Y(p[1]), r: 3, fill: 'var(--panel)', stroke: s.color, 'stroke-width': 1.6 }, svg); });
    });

    (opts.marcadores || []).forEach(function (p) {
      el('circle', { cx: X(p.x), cy: Y(p.y), r: 5.5, fill: p.color, stroke: 'var(--panel)', 'stroke-width': 2 }, svg);
      var t = el('text', { x: X(p.x) + 9, y: Y(p.y) - 8, style: 'fill:' + p.color + ';font-weight:600' }, svg);
      t.textContent = p.texto;
      if (X(p.x) > W - 170) { t.setAttribute('text-anchor', 'end'); t.setAttribute('x', X(p.x) - 9); }
    });

    var ley = document.createElement('div');
    ley.className = 'leyenda';
    opts.series.forEach(function (s) {
      if (!s.nombre) return;
      var span = document.createElement('span');
      span.innerHTML = '<i style="background:' + s.color + (s.guion ? ';opacity:.6' : '') + '"></i>' + s.nombre;
      ley.appendChild(span);
    });
    contenedor.appendChild(ley);
  };

})(window.EJES);

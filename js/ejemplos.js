// Casos de ejemplo. "Guardar" descarga este mismo formato JSON.
window.EJES = window.EJES || {};
EJES.VERSION_CASO = 1;

EJES.EJEMPLOS = {
  // Eje intermedio de un reductor: engrane de entrada A (Ø75 mm) y de salida B (Ø150 mm),
  // ángulo de presión 20°, 150 N·m. Ft = T/r, Fr = Ft·tan 20°.
  reductor: {
    version: 1,
    nombre: 'Eje intermedio de reductor (2 engranes)',
    material: { id: '1050_CD', manual: false, Sut: 690, Sy: 580 },
    fatiga: { acabado: 'maquinado', rotativo: true, confiabilidad: 99, T_C: 20, kfVarios: 1, criterio: 'goodman', TaPct: 0 },
    estatico: { aplicarKt: true },
    nObjetivo: 2,
    G: 79300,
    geometria: [{ L: 30, d: 30 }, { L: 40, d: 35 }, { L: 120, d: 42 }, { L: 40, d: 35 }, { L: 30, d: 30 }],
    apoyos: [15, 245],
    cargas: [
      { nombre: 'Engrane A (entrada)', x: 50, Fy: -1456, Fz: -4000, T: 150 },
      { nombre: 'Engrane B (salida)', x: 210, Fy: -728, Fz: 2000, T: -150 }
    ],
    puntos: [
      { nombre: 'Hombro 30/35', x: 30, tipo: 'tabla71', ref: 'hombro_redondeado', Kt: 1.7, Kts: 1.5, r: 3 },
      { nombre: 'Cuñero engrane A', x: 50, tipo: 'tabla71', ref: 'cunero_fresado', Kt: 2.14, Kts: 3.0, r: 0.7 },
      { nombre: 'Hombro 35/42', x: 70, tipo: 'tabla71', ref: 'hombro_redondeado', Kt: 1.7, Kts: 1.5, r: 3.5 },
      { nombre: 'Hombro 42/35', x: 190, tipo: 'tabla71', ref: 'hombro_redondeado', Kt: 1.7, Kts: 1.5, r: 3.5 },
      { nombre: 'Cuñero engrane B', x: 210, tipo: 'tabla71', ref: 'cunero_fresado', Kt: 2.14, Kts: 3.0, r: 0.7 },
      { nombre: 'Hombro 35/30', x: 230, tipo: 'tabla71', ref: 'hombro_redondeado', Kt: 1.7, Kts: 1.5, r: 3 }
    ]
  }
};
EJES.EJEMPLOS.nuevo = EJES.EJEMPLOS.reductor;
EJES.copiarCaso = function (c) { return JSON.parse(JSON.stringify(c)); };

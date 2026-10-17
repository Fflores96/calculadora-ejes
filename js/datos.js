// Datos de catálogo y fuentes. Cada dato apunta a una clave de FUENTES.
// Para ampliar: copiar una entrada, cambiarla y abrir pruebas.html.
window.EJES = window.EJES || {};

EJES.FUENTES = {
  SH_620: { corta: 'Shigley ec. 6-20', cita: 'Budynas y Nisbett (2012). Diseño en ingeniería mecánica de Shigley, 9.ª ed. McGraw-Hill. Ec. (6-20) a (6-24), factor de tamaño k_b, p. 275.' },
  SH_62: { corta: 'Shigley tabla 6-2', cita: 'Shigley 9.ª ed., tabla 6-2, parámetros del factor de superficie k_a = a·S_ut^b, p. 274.' },
  SH_65: { corta: 'Shigley tabla 6-5', cita: 'Shigley 9.ª ed., tabla 6-5, factores de confiabilidad k_e, p. 279.' },
  SH_626: { corta: 'Shigley ec. 6-26', cita: 'Shigley 9.ª ed., ec. (6-26) factor de carga k_c y ec. (6-27) factor de temperatura k_d, p. 277.' },
  SH_68: { corta: 'Shigley ec. 6-8', cita: 'Shigley 9.ª ed., ec. (6-8), límite de resistencia a la fatiga S\'e de aceros, p. 270.' },
  SH_635: { corta: 'Shigley ec. 6-32 a 6-35', cita: 'Shigley 9.ª ed., K_f = 1 + q(K_t − 1) (6-32), q de Neuber (6-34) y √a (6-35a/b), p. 281-282.' },
  SH_7: { corta: 'Shigley ec. 7-7 a 7-16', cita: 'Shigley 9.ª ed., sec. 7-4: criterios ED-Goodman, ED-Gerber, ED-ASME elíptico y ED-Soderberg (7-7 a 7-14) y fluencia (7-15, 7-16), p. 351-353.' },
  SH_71: { corta: 'Shigley tabla 7-1', cita: 'Shigley 9.ª ed., tabla 7-1, estimaciones de primera iteración de K_t y K_ts, p. 356. Solo para diseño inicial.' },
  SH_A20: { corta: 'Shigley tabla A-20', cita: 'Shigley 9.ª ed., tabla A-20, resistencias mínimas ASTM de aceros HR y CD (tamaños de 18 a 32 mm), p. 1004.' },
  SH_A5: { corta: 'Shigley tabla A-5', cita: 'Shigley 9.ª ed., tabla A-5, acero al carbono: E = 207 GPa, G = 79,3 GPa.' },
  PH_6: { corta: 'Philpot sec. 6.3-6.8', cita: 'Philpot, T. A. (2017). Mechanics of Materials, 4.ª ed. Wiley. Torsión τ = Tc/J (6.5), ángulo de giro y potencia P = Tω (6.17).' },
  PH_15: { corta: 'Philpot sec. 15.4-15.5', cita: 'Philpot 4.ª ed., sec. 15.4 cargas combinadas y 15.5 teorías de falla (Tresca y von Mises).' }
};

EJES.ACABADOS = [
  { id: 'esmerilado', nombre: 'Esmerilado', a: 1.58, b: -0.085, fuente: 'SH_62' },
  { id: 'maquinado', nombre: 'Maquinado o laminado en frío', a: 4.51, b: -0.265, fuente: 'SH_62' },
  { id: 'laminado_caliente', nombre: 'Laminado en caliente', a: 57.7, b: -0.718, fuente: 'SH_62' },
  { id: 'forjado', nombre: 'Como sale de la forja', a: 272, b: -0.995, fuente: 'SH_62' }
];

EJES.CONFIABILIDAD = [
  [50, 1.000], [90, 0.897], [95, 0.868], [99, 0.814],
  [99.9, 0.753], [99.99, 0.702], [99.999, 0.659], [99.9999, 0.620]
];

// Tabla 7-1: [K_t flexión, K_ts torsión]
EJES.KT_TABLA71 = [
  { id: 'hombro_agudo', nombre: 'Hombro agudo (r/d = 0,02)', Kt: 2.7, Kts: 2.2, rd: 0.02 },
  { id: 'hombro_redondeado', nombre: 'Hombro bien redondeado (r/d = 0,1)', Kt: 1.7, Kts: 1.5, rd: 0.1 },
  { id: 'cunero_fresado', nombre: 'Cuñero fresado (r/d = 0,02)', Kt: 2.14, Kts: 3.0, rd: 0.02 },
  { id: 'anillo_retencion', nombre: 'Ranura para anillo de retención', Kt: 5.0, Kts: 3.0, rd: null }
];

// Tabla A-20: Sut, Sy en MPa
EJES.MATERIALES = [
  ['1018_HR', 'AISI 1018 HR', 400, 220], ['1018_CD', 'AISI 1018 CD', 440, 370],
  ['1020_HR', 'AISI 1020 HR', 380, 210], ['1020_CD', 'AISI 1020 CD', 470, 390],
  ['1030_HR', 'AISI 1030 HR', 470, 260], ['1030_CD', 'AISI 1030 CD', 520, 440],
  ['1035_HR', 'AISI 1035 HR', 500, 270], ['1035_CD', 'AISI 1035 CD', 550, 460],
  ['1040_HR', 'AISI 1040 HR', 520, 290], ['1040_CD', 'AISI 1040 CD', 590, 490],
  ['1045_HR', 'AISI 1045 HR', 570, 310], ['1045_CD', 'AISI 1045 CD', 630, 530],
  ['1050_HR', 'AISI 1050 HR', 620, 340], ['1050_CD', 'AISI 1050 CD', 690, 580],
  ['1060_HR', 'AISI 1060 HR', 680, 370], ['1080_HR', 'AISI 1080 HR', 770, 420],
  ['1095_HR', 'AISI 1095 HR', 830, 460]
].map(function (m) { return { id: m[0], nombre: m[1], Sut: m[2], Sy: m[3], fuente: 'SH_A20' }; });

EJES.G_ACERO = 79300;   // MPa, tabla A-5
EJES.E_ACERO = 207000;  // MPa, tabla A-5

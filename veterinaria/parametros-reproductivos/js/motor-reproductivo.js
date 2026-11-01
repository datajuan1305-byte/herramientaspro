// ═══════════════════════════════════════════════════════════════════════════
//  MOTOR REPRODUCTIVO BOVINO — HerramientasPro Colombia
//  Matemática pura (sin DOM). Validado contra scipy.
// ═══════════════════════════════════════════════════════════════════════════
const MR = {
  logGamma(z) {
    const c = [57.1562356658629235, -59.5979603554754912, 14.1360979747417471,
      -0.491913816097620199, 0.339946499848118887e-4, 0.465236289270485756e-4,
      -0.983744753048795646e-4, 0.158088703224912494e-3, -0.210264441724104883e-3,
      0.217439618115212643e-3, -0.164318106536763890e-3, 0.844182239838527433e-4,
      -0.261908384015814087e-4, 0.368991826595316234e-5];
    let y = z, x = z, tmp = x + 5.24218750000000000;
    tmp = (x + 0.5) * Math.log(tmp) - tmp;
    let ser = 0.999999999999997092;
    for (let j = 0; j < 14; j++) ser += c[j] / ++y;
    return tmp + Math.log(2.5066282746310005 * ser / x);
  },
  normCDF(x) {
    // erfc de alta precisión (Numerical Recipes erfcc Chebyshev)
    const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
      t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - r / 2 : r / 2;
  },
  invNormal(p) {
    let lo = -12, hi = 12;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (MR.normCDF(m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  betacf(a, b, x) {
    const FP = 1e-300; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d;
      const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  },
  betaInc(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    const bt = Math.exp(MR.logGamma(a + b) - MR.logGamma(a) - MR.logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * MR.betacf(a, b, x) / a : 1 - bt * MR.betacf(b, a, 1 - x) / b;
  },
  tCDF(t, nu) { const p = 0.5 * MR.betaInc(nu / (nu + t * t), nu / 2, 0.5); return t >= 0 ? 1 - p : p; },
  invT(p, nu) {
    let lo = -200, hi = 200;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (MR.tCDF(m, nu) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  // inversa de la beta incompleta por bisección
  invBeta(p, a, b) {
    if (p <= 0) return 0; if (p >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (MR.betaInc(m, a, b) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  },
  logChoose(n, k) { return MR.logGamma(n + 1) - MR.logGamma(k + 1) - MR.logGamma(n - k + 1); },
  binomPMF(k, n, p) {
    if (p <= 0) return k === 0 ? 1 : 0; if (p >= 1) return k === n ? 1 : 0;
    return Math.exp(MR.logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  },
  binomCDF(k, n, p) { let s = 0; for (let i = 0; i <= k; i++) s += MR.binomPMF(i, n, p); return Math.min(1, s); },

  // ── Intervalos para proporciones ──
  wilson(x, n, conf = 0.95) {
    const z = MR.invNormal(1 - (1 - conf) / 2), p = x / n, z2 = z * z;
    const den = 1 + z2 / n, c = (p + z2 / (2 * n)) / den;
    const h = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den;
    return { p, inf: Math.max(0, c - h), sup: Math.min(1, c + h) };
  },
  clopperPearson(x, n, conf = 0.95) {
    const a = 1 - conf;
    const inf = x === 0 ? 0 : MR.invBeta(a / 2, x, n - x + 1);
    const sup = x === n ? 1 : MR.invBeta(1 - a / 2, x + 1, n - x);
    return { p: x / n, inf, sup };
  },
  // Prueba binomial exacta (dos colas, método de probabilidades menores — igual a scipy.binomtest)
  binomTest(x, n, p0, alt = 'two-sided') {
    const pmf = MR.binomPMF(x, n, p0);
    if (alt === 'greater') { let s = 0; for (let i = x; i <= n; i++) s += MR.binomPMF(i, n, p0); return Math.min(1, s); }
    if (alt === 'less') return MR.binomCDF(x, n, p0);
    let s = 0; const tol = 1 + 1e-7;
    for (let i = 0; i <= n; i++) { const q = MR.binomPMF(i, n, p0); if (q <= pmf * tol) s += q; }
    return Math.min(1, s);
  },
  /** Evalúa un indicador de proporción contra una meta.
   *  direccion: 'mayor' (más es mejor, ej. % concepción) o 'menor' (menos es mejor, ej. pérdidas) */
  evaluarProporcion({ x, n, meta, direccion = 'mayor', conf = 0.95 }) {
    const w = MR.wilson(x, n, conf), cp = MR.clopperPearson(x, n, conf);
    const alt = direccion === 'mayor' ? 'less' : 'greater'; // evidencia de INCUMPLIR
    const pInc = MR.binomTest(x, n, meta, alt);
    const pDos = MR.binomTest(x, n, meta, 'two-sided');
    let estado;
    if (direccion === 'mayor') estado = w.inf >= meta ? 'cumple' : (w.sup < meta ? 'incumple' : 'no_concluyente');
    else estado = w.sup <= meta ? 'cumple' : (w.inf > meta ? 'incumple' : 'no_concluyente');
    return { x, n, p: x / n, meta, direccion, conf, wilson: w, cp, pDosColas: pDos, pIncumple: pInc, estado };
  },

  // ── Variables continuas ──
  media(a) { return a.reduce((s, v) => s + v, 0) / a.length; },
  desv(a) { const m = MR.media(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; },
  percentil(a, q) { // tipo 7
    const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  },
  resumenContinuo(a) {
    const n = a.length, m = MR.media(a), s = MR.desv(a);
    const q1 = MR.percentil(a, 0.25), q3 = MR.percentil(a, 0.75), iqr = q3 - q1;
    const li = q1 - 1.5 * iqr, ls = q3 + 1.5 * iqr;
    return { n, media: m, sd: s, cv: m !== 0 ? s / Math.abs(m) * 100 : NaN, min: Math.min(...a), max: Math.max(...a),
      mediana: MR.percentil(a, 0.5), q1, q3, outliers: a.filter(v => v < li || v > ls), limInf: li, limSup: ls };
  },
  /** t de una muestra: IC de la media y p-valor vs referencia */
  evaluarContinuo(a, ref, conf = 0.95) {
    const r = MR.resumenContinuo(a), n = r.n, df = n - 1;
    const se = r.sd / Math.sqrt(n), tc = MR.invT(1 - (1 - conf) / 2, df);
    const tst = (r.media - ref) / se;
    const p = 2 * (1 - MR.tCDF(Math.abs(tst), df));
    return { ...r, ref, df, se, ic: [r.media - tc * se, r.media + tc * se], t: tst, p };
  },
  welch(a, b, conf = 0.95) {
    const n1 = a.length, n2 = b.length, m1 = MR.media(a), m2 = MR.media(b), v1 = MR.desv(a) ** 2, v2 = MR.desv(b) ** 2;
    const se = Math.sqrt(v1 / n1 + v2 / n2), df = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
    const t = (m1 - m2) / se, p = 2 * (1 - MR.tCDF(Math.abs(t), df)), tc = MR.invT(1 - (1 - conf) / 2, df);
    return { n1, n2, m1, m2, dif: m1 - m2, se, df, t, p, ic: [m1 - m2 - tc * se, m1 - m2 + tc * se] };
  },

  // ── Dos proporciones ──
  fisherExacto(a, b, c, d) { // [[a,b],[c,d]], dos colas (prob <= observada)
    const r1 = a + b, r2 = c + d, c1 = a + c, N = r1 + r2;
    const lp = k => MR.logChoose(r1, k) + MR.logChoose(r2, c1 - k) - MR.logChoose(N, c1);
    const p0 = Math.exp(lp(a)); let s = 0;
    for (let k = Math.max(0, c1 - r2); k <= Math.min(r1, c1); k++) { const q = Math.exp(lp(k)); if (q <= p0 * (1 + 1e-7)) s += q; }
    return Math.min(1, s);
  },
  newcombeDif(x1, n1, x2, n2, conf = 0.95) {
    const w1 = MR.wilson(x1, n1, conf), w2 = MR.wilson(x2, n2, conf), d = w1.p - w2.p;
    return { p1: w1.p, p2: w2.p, dif: d,
      inf: d - Math.sqrt((w1.p - w1.inf) ** 2 + (w2.sup - w2.p) ** 2),
      sup: d + Math.sqrt((w1.sup - w1.p) ** 2 + (w2.p - w2.inf) ** 2) };
  },
  compararProporciones(x1, n1, x2, n2, conf = 0.95) {
    return { ...MR.newcombeDif(x1, n1, x2, n2, conf), pFisher: MR.fisherExacto(x1, n1 - x1, x2, n2 - x2), x1, n1, x2, n2 };
  },

  // ── Parseo y fechas ──
  parsearLista(txt) {
    const t = (txt || '').split(/[\s;]+/).map(s => s.trim().replace(',', '.')).filter(Boolean);
    const v = t.map(Number);
    return v.some(x => !isFinite(x)) || v.length === 0 ? null : v;
  },
  addDias(iso, d) { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); },
  addMeses(iso, m) { const x = new Date(iso + 'T12:00:00'); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); },
  difDias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); },

  /** Calendario tras un servicio efectivo (monta/IA). gest = días de gestación (def. 283) */
  calendarioServicio(fecha, gest = 283, diasVoluntarios = 60) {
    const parto = MR.addDias(fecha, gest);
    return {
      servicio: fecha,
      diagnosticoPalpacion: MR.addDias(fecha, 45),
      diagnosticoEco: MR.addDias(fecha, 30),
      repaso: MR.addDias(fecha, 90),
      secado: MR.addDias(parto, -60),
      partoEsperado: parto,
      primerCeloPosparto: MR.addDias(parto, 40),
      reinicioServicios: MR.addDias(parto, diasVoluntarios),
      metaNuevaPrenez: MR.addDias(parto, 85)
    };
  },
  calendarioNovilla(nacimiento, { edadServicioMeses = 24, gest = 283 } = {}) {
    const servicio = MR.addMeses(nacimiento, edadServicioMeses);
    return { nacimiento, pubertadAprox: MR.addMeses(nacimiento, 14), primerServicio: servicio, ...MR.calendarioServicio(servicio, gest),
      edadPrimerPartoMeses: Math.round((MR.difDias(nacimiento, MR.addDias(servicio, gest)) / 30.4375) * 10) / 10 };
  },

  // ── Macho ──
  /** Clasificación orientativa de circunferencia escrotal (cm) según edad (meses) y tipo de ganado. */
  evaluarMacho({ ce, edadMeses, tipo = 'taurino', ceMin24 = 34, ceCebu = 1 }) {
    // Mínimo escala con la edad: 24+ m = ceMin24; cada tramo de 3 m antes resta 1 cm. En cebú se descuentan 3 meses de edad y ceCebu cm.
    const e = tipo === 'cebu' ? edadMeses - 3 : edadMeses;
    let min = ceMin24 - (e < 15 ? 4 : e < 18 ? 3 : e < 21 ? 2 : e < 24 ? 1 : 0);
    if (tipo === 'cebu') min -= ceCebu;
    const estado = ce >= min + 2 ? 'optima' : ce >= min ? 'aceptable' : 'baja';
    return { ce, edadMeses, tipo, minimoEsperado: min, estado };
  },
  evaluarSeminal({ motilidad, morfNormal, conc, limMot = 60, limMorf = 70, limConc = 500 }) {
    const items = [];
    if (motilidad != null) items.push({ k: 'Motilidad', v: motilidad, ok: motilidad >= limMot, lim: limMot });
    if (morfNormal != null) items.push({ k: 'Morfología normal', v: morfNormal, ok: morfNormal >= limMorf, lim: limMorf });
    if (conc != null) items.push({ k: 'Concentración (x10⁶/mL)', v: conc, ok: conc >= limConc, lim: limConc });
    const fallas = items.filter(i => !i.ok).length;
    return { items, clasif: fallas === 0 ? 'satisfactorio' : fallas === 1 ? 'dudoso' : 'no_satisfactorio' };
  }
};
if (typeof module !== 'undefined') module.exports = MR;

// ═══════════════════════════════════════════════════════════════════════════
//  MOTOR DE ANOVA DE UN FACTOR — HerramientasPro Colombia
//  Análisis de varianza de un factor + comparaciones múltiples por pares
//  (t de Student con corrección de Bonferroni).
// ═══════════════════════════════════════════════════════════════════════════

const MA = {
  logGamma: function(z) {
    if (z <= 0) return NaN;
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
                -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let x = z, y = z, tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  },
  betacf: function(x, a, b) {
    const MAXIT = 200, EPS = 3e-9, FPMIN = 1e-30;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  },
  betaInc: function(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(MA.logGamma(a + b) - MA.logGamma(a) - MA.logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * MA.betacf(x, a, b) / a;
    return 1 - bt * MA.betacf(1 - x, b, a) / b;
  },
  tCDF: function(t, nu) {
    const x = nu / (nu + t * t);
    const p = 0.5 * MA.betaInc(x, nu / 2, 0.5);
    return t >= 0 ? 1 - p : p;
  },
  fCDF: function(f, d1, d2) {
    if (f <= 0) return 0;
    const x = (d1 * f) / (d1 * f + d2);
    return MA.betaInc(x, d1 / 2, d2 / 2);
  },
  invF: function(p, d1, d2) {
    let lo = 0, hi = 1000;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (MA.fCDF(mid, d1, d2) < p) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
};

function parsearGrupo(texto) {
  const partes = texto.split(/[,;\s\n]+/).map(s => s.trim()).filter(s => s.length > 0);
  const numeros = partes.map(Number);
  if (numeros.some(isNaN)) return null;
  return numeros;
}

/**
 * ANOVA de un factor.
 * @param {number[][]} grupos - arreglo de arreglos, cada uno los datos de un grupo/tratamiento
 */
function anovaUnFactor(grupos) {
  const k = grupos.length;
  const nGrupo = grupos.map(g => g.length);
  const N = nGrupo.reduce((a, b) => a + b, 0);
  const mediaGrupo = grupos.map(g => g.reduce((a, b) => a + b, 0) / g.length);
  const granMedia = grupos.flat().reduce((a, b) => a + b, 0) / N;

  let ssb = 0, ssw = 0;
  grupos.forEach((g, i) => {
    ssb += nGrupo[i] * (mediaGrupo[i] - granMedia) ** 2;
    g.forEach(x => { ssw += (x - mediaGrupo[i]) ** 2; });
  });
  const sst = ssb + ssw;
  const dfB = k - 1, dfW = N - k;
  const msb = ssb / dfB, msw = ssw / dfW;
  const f = msb / msw;
  const pF = 1 - MA.fCDF(f, dfB, dfW);
  const eta2 = ssb / sst;
  const fCritico005 = MA.invF(0.95, dfB, dfW);

  // Comparaciones múltiples por pares (t con corrección de Bonferroni)
  const numComparaciones = (k * (k - 1)) / 2;
  const comparaciones = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = mediaGrupo[i] - mediaGrupo[j];
      const se = Math.sqrt(msw * (1 / nGrupo[i] + 1 / nGrupo[j]));
      const t = diff / se;
      const pCrudo = 2 * (1 - MA.tCDF(Math.abs(t), dfW));
      const pAjustado = Math.min(1, pCrudo * numComparaciones);
      comparaciones.push({ i, j, diff, se, t, pCrudo, pAjustado, significativo: pAjustado < 0.05 });
    }
  }

  return {
    k, N, nGrupo, mediaGrupo, granMedia,
    anova: { ssb, ssw, sst, dfB, dfW, msb, msw, f, pF, fCritico005 },
    eta2, comparaciones, numComparaciones
  };
}

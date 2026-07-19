// ═══════════════════════════════════════════════════════════════════════════
//  MÓDULO DE INTERPRETACIÓN — ANOVA de un factor
// ═══════════════════════════════════════════════════════════════════════════

function fmtAn(v, dec = 4) {
  if (v === null || v === undefined) return 'N/A';
  if (typeof v === 'string') return v;
  if (isNaN(v) || !isFinite(v)) return '∞';
  return parseFloat(v.toFixed(dec)).toString();
}

function armarPayloadAnova(parametros, resultados, contexto, pregunta) {
  return { parametros, resultados, contexto, pregunta };
}

function interpretarEta2(eta2) {
  if (eta2 < 0.01) return 'muy pequeño';
  if (eta2 < 0.06) return 'pequeño';
  if (eta2 < 0.14) return 'mediano';
  return 'grande';
}

function generarResumenAnova(payload) {
  const { resultados: r, contexto } = payload;
  const partes = [];
  if (contexto && contexto.trim().length > 0) partes.push(`Con base en tu contexto ("${contexto.trim()}"):`);

  if (r.anova.pF < 0.05) {
    partes.push(`Con F(${r.anova.dfB},${r.anova.dfW}) = ${fmtAn(r.anova.f,3)} y p = ${fmtAn(r.anova.pF)} (menor a 0.05), se rechaza H₀: hay evidencia de que al menos una media de grupo es diferente de las demás.`);
    partes.push(`El tamaño del efecto (η² = ${fmtAn(r.eta2)}) es ${interpretarEta2(r.eta2)} — el ${fmtAn(r.eta2*100,1)}% de la variabilidad total se explica por las diferencias entre grupos.`);
    const sig = r.comparaciones.filter(c => c.significativo);
    if (sig.length > 0) {
      partes.push(`Las comparaciones por pares (con corrección de Bonferroni) muestran diferencias significativas entre: ${sig.map(c => `Grupo${c.i+1} y Grupo${c.j+1}`).join(', ')}.`);
    } else {
      partes.push('Sin embargo, ninguna comparación individual por pares resultó significativa después de la corrección de Bonferroni — esto puede pasar cuando la diferencia general existe pero está repartida entre varios pares, ninguno lo bastante grande por sí solo.');
    }
  } else {
    partes.push(`Con F(${r.anova.dfB},${r.anova.dfW}) = ${fmtAn(r.anova.f,3)} y p = ${fmtAn(r.anova.pF)} (no menor a 0.05), NO se rechaza H₀: no hay evidencia suficiente de que las medias de los grupos difieran entre sí.`);
  }
  return partes.join(' ');
}

function generarRespuestaAnova(payload) {
  const { pregunta, resultados: r, contexto } = payload;

  if (!pregunta || pregunta.trim().length === 0) return generarResumenAnova(payload);

  const q = pregunta.toLowerCase();
  const intro = contexto && contexto.trim().length > 0 ? `Tomando en cuenta tu contexto ("${contexto.trim()}"): ` : '';

  if (/cu[aá]l(es)? grupo|qu[eé] grupos|d[oó]nde est[aá] la diferencia|comparaci[oó]n/.test(q)) {
    const sig = r.comparaciones.filter(c => c.significativo);
    if (sig.length === 0) return intro + 'Ninguna comparación por pares resultó significativa después de la corrección de Bonferroni, aunque el ANOVA global haya sido significativo (o no). Revisa el resumen automático para más detalle.';
    return intro + `Los pares con diferencia estadísticamente significativa son: ${sig.map(c => `Grupo${c.i+1} vs Grupo${c.j+1} (diferencia=${fmtAn(c.diff,2)}, p ajustado=${fmtAn(c.pAjustado)})`).join('; ')}.`;
  }

  if (/bonferroni|correcci[oó]n|m[uú]ltiples comparaciones|tukey/.test(q)) {
    return intro + `Al hacer varias comparaciones por pares a la vez, la probabilidad de encontrar "por azar" al menos una diferencia significativa aumenta con cada comparación adicional. La corrección de Bonferroni ajusta esto multiplicando cada valor-p por el número de comparaciones realizadas (aquí, ${r.numComparaciones}), para mantener el error global bajo control. Es más conservadora que otras correcciones como Tukey HSD, pero más simple de calcular e igual de válida.`;
  }

  if (/eta|tama[nñ]o del efecto|qu[eé] tan importante/.test(q)) {
    return intro + `η² (eta cuadrado) = ${fmtAn(r.eta2)} es el tamaño del efecto: qué proporción de la variabilidad TOTAL de los datos se explica por pertenecer a un grupo u otro. Es ${interpretarEta2(r.eta2)} según las convenciones usuales (Cohen): <0.01 muy pequeño, 0.01-0.06 pequeño, 0.06-0.14 mediano, >0.14 grande. Un efecto puede ser estadísticamente significativo pero tener un tamaño de efecto pequeño, especialmente con muestras grandes — por eso vale la pena reportar ambos.`;
  }

  if (/supuesto|homogeneidad|normalidad|homoceda/.test(q)) {
    return intro + 'El ANOVA de un factor asume: (1) los grupos son independientes entre sí, (2) los datos dentro de cada grupo siguen aproximadamente una distribución normal, y (3) las varianzas de los grupos son homogéneas (homocedasticidad). Con grupos de tamaño similar, el ANOVA es razonablemente robusto ante violaciones moderadas de estos supuestos — pero con grupos muy desiguales en tamaño o varianza, conviene verificarlos (por ejemplo, con la prueba de Levene para homogeneidad de varianzas) antes de confiar plenamente en el resultado.';
  }

  if (/f\b|estad[ií]stico f|c[oó]mo se calcula/.test(q)) {
    return intro + `El estadístico F = ${fmtAn(r.anova.f,3)} es el cociente entre la variabilidad ENTRE grupos (MSB=${fmtAn(r.anova.msb,3)}) y la variabilidad DENTRO de los grupos (MSW=${fmtAn(r.anova.msw,3)}). Si los grupos tienen medias parecidas, F será cercano a 1; mientras más diferentes sean las medias entre grupos respecto a la variabilidad interna de cada uno, más grande será F, y más evidencia habrá contra H₀.`;
  }

  if (/qué significa|que significa|interpretar|explica|resumen/.test(q)) {
    return generarResumenAnova(payload);
  }

  return intro + 'Todavía no tengo una regla programada para responder exactamente esa pregunta. Por ahora puedo ayudarte con: cuáles grupos difieren entre sí, qué es la corrección de Bonferroni, qué es el tamaño del efecto (eta²), los supuestos del ANOVA, y cómo se calcula el estadístico F.';
}

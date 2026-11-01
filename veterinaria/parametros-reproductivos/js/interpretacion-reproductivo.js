// ═══════════════════════════════════════════════════════════════════════════
//  INTERPRETACIÓN (basada en reglas) — Parámetros reproductivos bovinos
//  Patrón payload: armarPayload() → generarTexto(). Reemplazable por IA.
// ═══════════════════════════════════════════════════════════════════════════
function fR(v, d = 1) { return (v === null || v === undefined || !isFinite(v)) ? 'N/A' : parseFloat(v.toFixed(d)).toString().replace('.', ','); }
function pct(v, d = 1) { return fR(v * 100, d) + '%'; }
function fP(p) { return !isFinite(p) ? '= no calculable (los datos no tienen variabilidad)' : p < 0.001 ? '< 0,001' : '= ' + fR(p, 3); }

const ESTADOS = {
  cumple: { icono: '🟢', etiqueta: 'Cumple la meta' },
  no_concluyente: { icono: '🟡', etiqueta: 'No concluyente' },
  incumple: { icono: '🔴', etiqueta: 'No cumple la meta' }
};

function interpretarProporcion(nombre, r) {
  const e = ESTADOS[r.estado], conf = Math.round(r.conf * 100);
  const sentido = r.direccion === 'mayor' ? 'al menos' : 'como máximo';
  let t = `${e.icono} ${nombre}: ${r.x} de ${r.n} animales (${pct(r.p)}). Con ${conf}% de confianza, el valor real del hato está entre ${pct(r.wilson.inf)} y ${pct(r.wilson.sup)}. La meta es ${sentido} ${pct(r.meta, 0)}. `;
  if (r.estado === 'cumple') t += 'Todo el intervalo está del lado favorable de la meta: hay evidencia de que el hato la cumple.';
  else if (r.estado === 'incumple') t += `Todo el intervalo está del lado desfavorable: hay evidencia de que el hato no alcanza la meta (valor p de la prueba exacta ${fP(r.pIncumple)}).`;
  else t += `La meta cae dentro del intervalo, así que con ${r.n} animales no se puede afirmar ni que la cumple ni que no. ${r.n < 30 ? 'La muestra es pequeña: registrar más servicios ayuda a decidir con más seguridad.' : 'Conviene seguir monitoreando.'}`;
  if (r.n < 20) t += ' ⚠ Con menos de 20 animales, interpreta con mucha cautela.';
  return t;
}

function interpretarContinuo(nombre, unidad, r, direccion, meta) {
  const conf = 95;
  let t = `${nombre}: promedio ${fR(r.media)} ${unidad} (DE ${fR(r.sd)}; mediana ${fR(r.mediana)}; n = ${r.n}). IC ${conf}% de la media: ${fR(r.ic[0])} a ${fR(r.ic[1])} ${unidad}. `;
  if (meta != null && isFinite(meta)) {
    const bueno = direccion === 'menor' ? r.ic[1] <= meta : r.ic[0] >= meta;
    const malo = direccion === 'menor' ? r.ic[0] > meta : r.ic[1] < meta;
    t += `Referencia ${fR(meta)} ${unidad} (${direccion === 'menor' ? 'menor es mejor' : 'mayor es mejor'}): ` +
      (bueno ? '🟢 el intervalo completo está del lado favorable.' : malo ? `🔴 el intervalo completo está del lado desfavorable (p ${fP(r.p)}).` : `🟡 la referencia cae dentro del intervalo; no hay diferencia concluyente (p ${fP(r.p)}).`) + ' ';
  }
  if (r.cv > 40) t += `La variabilidad es alta (CV ${fR(r.cv, 0)}%): el promedio puede ocultar vacas con problemas; mira la mediana y los casos extremos. `;
  if (r.outliers.length) t += `Valores atípicos detectados: ${r.outliers.map(v => fR(v)).join(', ')} — revisa si son errores de registro o animales que requieren atención.`;
  return t;
}

function interpretarComparacionProp(nombre, a, b, c) {
  const sig = c.pFisher < 0.05;
  return `${nombre}: ${a} ${pct(c.p1)} (${c.x1}/${c.n1}) vs ${b} ${pct(c.p2)} (${c.x2}/${c.n2}). Diferencia: ${fR(c.dif * 100)} puntos porcentuales (IC 95%: ${fR(c.inf * 100)} a ${fR(c.sup * 100)}). Prueba exacta de Fisher: p ${fP(c.pFisher)}. ` +
    (sig ? 'La diferencia es estadísticamente significativa al 5%: es poco probable que se deba solo al azar.' : 'No hay evidencia suficiente de una diferencia real; con grupos pequeños es normal que diferencias grandes aparentes no sean concluyentes.') +
    ' Recuerda que significancia estadística no es lo mismo que importancia económica, ni demuestra causa (puede haber otros factores como época, lote o tipo de vaca).';
}

function interpretarComparacionMedias(nombre, a, b, w, unidad) {
  const sig = w.p < 0.05;
  return `${nombre}: ${a} promedio ${fR(w.m1)} ${unidad} (n=${w.n1}) vs ${b} ${fR(w.m2)} ${unidad} (n=${w.n2}). Diferencia: ${fR(w.dif)} ${unidad} (IC 95%: ${fR(w.ic[0])} a ${fR(w.ic[1])}). Prueba t de Welch: p ${fP(w.p)}. ` +
    (sig ? 'Diferencia significativa al 5%.' : 'No hay evidencia suficiente de diferencia real entre los grupos.') + ' Esto describe asociación, no prueba la causa.';
}

function interpretarMacho(m, s) {
  let t = '';
  if (m) t += `Circunferencia escrotal ${fR(m.ce)} cm a los ${fR(m.edadMeses, 0)} meses (${m.tipo === 'cebu' ? 'Bos indicus' : 'Bos taurus'}): mínimo orientativo ${fR(m.minimoEsperado, 0)} cm → ` +
    (m.estado === 'optima' ? '🟢 por encima del mínimo; buen indicador de precocidad y producción espermática.' : m.estado === 'aceptable' ? '🟡 dentro del rango aceptable.' : '🔴 por debajo del mínimo orientativo; valorar con examen andrológico completo.') + ' ';
  if (s) {
    const c = { satisfactorio: '🟢 Satisfactorio', dudoso: '🟡 Dudoso (repetir examen)', no_satisfactorio: '🔴 No satisfactorio' }[s.clasif];
    t += `Calidad seminal: ${c}. ` + s.items.map(i => `${i.k}: ${fR(i.v, 0)} (${i.ok ? 'cumple' : 'bajo'} ≥ ${i.lim})`).join('; ') + '. ';
  }
  return t + 'Esta clasificación es orientativa y no reemplaza el examen de aptitud reproductiva del médico veterinario.';
}

const DESCARGO = 'Los valores de referencia son orientativos (varían según raza, sistema productivo, clima y manejo). Esta herramienta apoya, pero no reemplaza, el criterio del médico veterinario zootecnista.';

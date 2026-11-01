// ═══════════════════════════════════════════════════════════════════════════
//  GRÁFICAS DEL HATO — Chart.js. Depende de HATO, MH, MR, PR.
// ═══════════════════════════════════════════════════════════════════════════
const GRAF = (function () {
  const $ = id => document.getElementById(id);
  const V = '#1D9E75', VO = '#0f6e52', AM = '#d9a21b', RO = '#c2473a', GR = '#9db3ab', AZ = '#3b7ea1';
  const LISTA = [
    ['estado', 'Estado actual del hato'], ['ab', 'Distribución de días abiertos'], ['iep', 'Distribución del intervalo entre partos'], ['km', 'Curva de preñez posparto'],
    ['concmes', '% de concepción por mes de servicio'], ['partosmes', 'Partos por mes del año (estacionalidad)'], ['sc', 'Servicios por concepción'], ['epp', 'Edad al primer parto'], ['grupos', 'Comparar un indicador entre grupos']
  ];
  const IND = { conc: ['% concepción por servicio', 'p'], conc1: ['% concepción al 1.er servicio', 'p'], ab: ['Días abiertos (promedio)', 'c'], iep: ['Intervalo entre partos (promedio)', 'c'], sc: ['Servicios por concepción (promedio)', 'c'], dpps: ['Días al primer servicio (promedio)', 'c'] };
  const POR_P = { lote: 'Lote', raza: 'Raza', toro: 'Toro / pajilla', tipoServicio: 'Tipo de servicio', nParto: 'Número de parto', anio: 'Año del servicio' };
  const POR_C = { lote: 'Lote', raza: 'Raza', nParto: 'Número de parto', anio: 'Año del parto' };
  const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  let chart = null, notaTxt = '';

  const plugFondo = { id: 'fondoBlanco', beforeDraw(c) { const x = c.ctx; x.save(); x.globalCompositeOperation = 'destination-over'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.restore(); } };
  const plugIC = { id: 'barrasIC', afterDatasetsDraw(c) {
    c.data.datasets.forEach((ds, i) => {
      if (!ds.ic) return; const m = c.getDatasetMeta(i), y = c.scales.y, x = c.ctx; x.save(); x.strokeStyle = '#1c2a26'; x.lineWidth = 1.5;
      m.data.forEach((el, j) => { const ic = ds.ic[j]; if (!ic || !isFinite(ic[0]) || !isFinite(ic[1])) return; const px = el.x, a = y.getPixelForValue(ic[0]), b = y.getPixelForValue(ic[1]);
        x.beginPath(); x.moveTo(px, a); x.lineTo(px, b); x.moveTo(px - 5, a); x.lineTo(px + 5, a); x.moveTo(px - 5, b); x.lineTo(px + 5, b); x.stroke(); });
      x.restore();
    });
  } };
  const ejes = (xt, yt) => ({ x: { title: { display: !!xt, text: xt }, grid: { display: false } }, y: { beginAtZero: true, title: { display: !!yt, text: yt } } });
  const linea = (valor, n, color, etiqueta) => ({ type: 'line', label: etiqueta, data: new Array(n).fill(valor), borderColor: color, borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false, order: 0 });
  const num = (v, d = 1) => fR(v, d);

  function barrasHist(titulo, h, ref, yt, xt, unidad) {
    const col = h.bins.map(b => ref !== undefined && ref !== null && b >= ref ? RO : V);
    return { type: 'bar', data: { labels: h.etiquetas, datasets: [{ label: 'Número de vacas', data: h.cuentas, backgroundColor: col, borderRadius: 3 }] },
      options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: titulo + (ref ? ` — en rojo: ≥ ${num(ref, 0)} ${unidad} (referencia)` : '') }, legend: { display: false } }, scales: ejes(xt, yt) } };
  }
  function resumenCont(v, ref, unidad) {
    const s = MR.resumenContinuo(v), sobre = ref ? v.filter(x => x > ref).length : null;
    return `n = ${v.length} ciclos · media ${num(s.media)} · mediana ${num(s.mediana)} ${unidad} · rango ${num(s.min, 0)}–${num(s.max, 0)}` + (ref ? ` · ${num(sobre / v.length * 100, 0)} % supera la referencia (${num(ref, 0)})` : '') + (s.outliers.length ? ` · ${s.outliers.length} valores atípicos` : '');
  }

  function construir(id, r) {
    const { an, ind } = r, PRr = k => PR.get(k);
    if (id === 'estado') {
      const k = Object.keys(HATO.etqEstado).filter(e => ind.estados[e]), col = { gestante: V, seca: VO, servida: AZ, vacia: AM, novilla: GR, baja: '#6b6b6b' };
      const tot = k.reduce((s, e) => s + ind.estados[e], 0);
      notaTxt = 'Distribución actual: ' + k.map(e => `${HATO.etqEstado[e]} ${ind.estados[e]} (${num(ind.estados[e] / tot * 100, 0)} %)`).join(', ') + '. Un hato eficiente mantiene alta la proporción de vacas gestantes y baja la de vacas vacías con muchos días posparto.';
      return { type: 'doughnut', data: { labels: k.map(e => HATO.etqEstado[e]), datasets: [{ data: k.map(e => ind.estados[e]), backgroundColor: k.map(e => col[e]) }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Estado actual del hato (' + tot + ' animales)' }, legend: { position: 'right' } } } };
    }
    if (id === 'ab') {
      if (ind.ab.length < 3) { notaTxt = ''; return 'Se necesitan al menos 3 ciclos con concepción registrada para graficar los días abiertos.'; }
      const ref = PRr('ref_ab'), h = MH.histograma(ind.ab, 20, 0);
      notaTxt = resumenCont(ind.ab, ref, 'días') + '. Si la mediana es bastante menor que la media, pocas vacas muy abiertas están elevando el promedio: revisa esos casos en «Alertas». Solo incluye ciclos donde hubo concepción; las vacas aún abiertas se ven en la curva de preñez.';
      return barrasHist('Días abiertos (parto → concepción)', h, ref, 'Número de ciclos', 'Días abiertos', 'días');
    }
    if (id === 'iep') {
      if (ind.iep.length < 3) { notaTxt = ''; return 'Se necesitan al menos 3 intervalos entre partos para graficar.'; }
      const ref = PRr('ref_iep'), h = MH.histograma(ind.iep, 30, Math.floor(Math.min(...ind.iep) / 30) * 30);
      notaTxt = resumenCont(ind.iep, ref, 'días') + '. Intervalos muy largos (> 600 días) suelen indicar partos no registrados o problemas reproductivos serios; verifica los registros.';
      return barrasHist('Intervalo entre partos', h, ref, 'Número de intervalos', 'Días entre partos', 'días');
    }
    if (id === 'km') {
      const k = MH.curvaKM(an.ciclos); if (k.n < 3) { notaTxt = ''; return 'Se necesitan al menos 3 ciclos posparto para dibujar la curva.'; }
      const en = d => { let p = 0; k.puntos.forEach(q => { if (q.t <= d) p = q.prenada; }); return p * 100; };
      notaTxt = `n = ${k.n} ciclos posparto (${k.eventos} con concepción; el resto son vacas aún abiertas, tratadas como datos censurados). Mediana de días a la concepción: ${k.mediana === null ? 'aún no se alcanza el 50 %' : k.mediana + ' días'}. Preñadas a los 100 días: ${num(en(100), 0)} %; a los 150: ${num(en(150), 0)} %; a los 200: ${num(en(200), 0)} %. Una curva que sube rápido indica buena eficiencia; una meseta temprana indica un grupo de vacas que no logra preñarse.`;
      const pts = k.puntos.map(p => ({ x: p.t, y: p.prenada * 100 }));
      return { type: 'line', data: { datasets: [{ label: '% de vacas preñadas', data: pts, borderColor: V, backgroundColor: 'rgba(29,158,117,.15)', stepped: 'after', fill: true, pointRadius: 0, borderWidth: 2.5 }, { label: 'Referencia: días abiertos máx. (' + num(PRr('ref_ab'), 0) + ')', data: [{ x: PRr('ref_ab'), y: 0 }, { x: PRr('ref_ab'), y: 100 }], borderColor: RO, borderDash: [6, 4], pointRadius: 0, fill: false }] },
        options: { animation: false, responsive: true, maintainAspectRatio: false, parsing: false, plugins: { title: { display: true, text: 'Curva de preñez posparto (Kaplan-Meier)' } }, scales: { x: { type: 'linear', min: 0, title: { display: true, text: 'Días posparto' } }, y: { min: 0, max: 100, title: { display: true, text: '% acumulado de vacas preñadas' } } } } };
    }
    if (id === 'concmes') {
      const g = MH.propPorGrupo(an.servicios, 'mes').filter(x => x.n > 0).slice(-24); if (g.length < 2) { notaTxt = ''; return 'Se necesitan servicios con resultado en al menos 2 meses distintos.'; }
      const meta = PRr('meta_conc'), ult = g.slice(-6), ux = ult.reduce((s, o) => s + o.x, 0), un = ult.reduce((s, o) => s + o.n, 0);
      notaTxt = `Últimos ${ult.length} meses con datos: ${num(ux / un * 100)} % (${ux}/${un} servicios). La barra negra de cada punto es el IC 95 %: con pocos servicios por mes es muy ancha, así que no interpretes un mes aislado; busca tendencias sostenidas. Meta del perfil: ${num(meta, 0)} %.`;
      return { type: 'line', data: { labels: g.map(o => o.grupo), datasets: [{ label: '% concepción', data: g.map(o => o.p * 100), borderColor: V, backgroundColor: V, tension: .15, pointRadius: 5, ic: g.map(o => [o.inf * 100, o.sup * 100]), n: g.map(o => o.n), x: g.map(o => o.x) }, linea(meta, g.length, RO, 'Meta (' + num(meta, 0) + ' %)')],
        },
        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: '% de concepción por mes de servicio (con IC 95 %)' }, tooltip: { callbacks: { label: c => c.dataset.n ? `${num(c.parsed.y)} % (${c.dataset.x[c.dataIndex]}/${c.dataset.n[c.dataIndex]} servicios)` : `${c.dataset.label}` } } }, scales: { x: { title: { display: true, text: 'Mes del servicio' } }, y: { min: 0, max: 100, title: { display: true, text: '% concepción' } } } } };
    }
    if (id === 'partosmes') {
      const c = new Array(12).fill(0); an.ciclos.forEach(x => c[+x.fechaParto.slice(5, 7) - 1]++); const tot = c.reduce((a, b) => a + b, 0); if (tot < 6) { notaTxt = ''; return 'Se necesitan al menos 6 partos registrados.'; }
      const mx = c.indexOf(Math.max(...c));
      notaTxt = `${tot} partos. El mes con más partos es ${MES[mx]} (${num(c[mx] / tot * 100, 0)} %). Una concentración marcada indica estacionalidad (por lluvias, pasturas o manejo de la monta); distribuciones parejas indican servicio continuo.`;
      return { type: 'bar', data: { labels: MES, datasets: [{ label: 'Partos', data: c, backgroundColor: V, borderRadius: 3 }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Partos por mes del año (todos los años juntos)' }, legend: { display: false } }, scales: ejes('Mes', 'Número de partos') } };
    }
    if (id === 'sc') {
      const v = ind.sc; if (v.length < 3) { notaTxt = ''; return 'Se necesitan al menos 3 ciclos con concepción.'; }
      const cat = [1, 2, 3, 4].map(k => v.filter(x => k < 4 ? x === k : x >= 4).length), tot = v.length, ref = PRr('ref_sc');
      notaTxt = `n = ${tot} concepciones · promedio ${num(MR.media(v), 2)} servicios por concepción (referencia ≤ ${num(ref, 1)}). Con 3 o más servicios: ${cat[2] + cat[3]} vacas (${num((cat[2] + cat[3]) / tot * 100, 0)} %). Un porcentaje alto de vacas con 3+ servicios sugiere problemas de fertilidad, detección de celos o inseminación.`;
      return { type: 'bar', data: { labels: ['1', '2', '3', '4 o más'], datasets: [{ label: '% de vacas', data: cat.map(x => x / tot * 100), backgroundColor: [V, V, AM, RO], borderRadius: 3, n: cat }] }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Servicios necesarios para concebir' }, legend: { display: false }, tooltip: { callbacks: { label: c => `${num(c.parsed.y)} % (${c.dataset.n[c.dataIndex]} vacas)` } } }, scales: Object.assign(ejes('Número de servicios', '% de vacas'), { y: { beginAtZero: true, max: 100, title: { display: true, text: '% de vacas' } } }) } };
    }
    if (id === 'epp') {
      const v = ind.epp; if (v.length < 3) { notaTxt = ''; return 'Se necesitan al menos 3 animales con fecha de nacimiento y primer parto registrados.'; }
      const ref = PRr('ref_epp'), h = MH.histograma(v.map(x => Math.round(x * 10) / 10), 3, Math.floor(Math.min(...v) / 3) * 3);
      notaTxt = resumenCont(v, ref, 'meses').replace(/ciclos/, 'novillas') + '. Una edad al primer parto alta retrasa el retorno de la inversión en la novilla; revisa crecimiento, nutrición de la recría y edad al primer servicio.';
      return barrasHist('Edad al primer parto', h, ref, 'Número de vacas', 'Edad (meses)', 'meses');
    }
    // grupos
    const ind0 = $('g_ind').value, por = $('g_por').value, esP = IND[ind0][1] === 'p'; let datos, meta = null;
    if (esP) {
      let rec = an.servicios; if (ind0 === 'conc1') rec = rec.filter(s => s.nServ === 1 && s.nParto > 0);
      datos = MH.propPorGrupo(rec, por); meta = PRr(ind0 === 'conc' ? 'meta_conc' : 'meta_conc1');
    } else {
      const v = { ab: 'diasAbiertos', iep: 'iep', sc: 'sc', dpps: 'diasPrimerServ' }[ind0]; datos = MH.mediaPorGrupo(an.ciclos, v, por); meta = { ab: PRr('ref_ab'), iep: PRr('ref_iep'), sc: PRr('ref_sc') }[ind0] || null;
    }
    datos = datos.filter(d => d.n > 0);
    if (por === 'nParto') datos.sort((a, b) => (a.grupo === '4+' ? 9 : +a.grupo) - (b.grupo === '4+' ? 9 : +b.grupo));
    let recortado = false; if (datos.length > 12) { datos = datos.sort((a, b) => b.n - a.n).slice(0, 12).sort((a, b) => a.grupo < b.grupo ? -1 : 1); recortado = true; }
    if (datos.length < 2) { notaTxt = ''; return 'Hay un solo grupo con datos para esta combinación; elige otro «agrupar por» o carga más información.'; }
    const f = esP ? 100 : 1;
    let txt = datos.map(d => esP ? `${d.grupo}: ${num(d.p * 100)} % (${d.x}/${d.n})` : `${d.grupo}: ${num(d.media)} (n=${d.n})`).join(' · ') + '. ';
    if (recortado) txt += 'Se muestran los 12 grupos con más datos. ';
    const peq = datos.filter(d => d.n < 10).length; if (peq) txt += `${peq} grupo(s) con menos de 10 datos (en gris): sus intervalos son muy amplios. `;
    if (esP) {
      if (datos.length === 2) { const a = datos[0], b = datos[1], c = MR.compararProporciones(a.x, a.n, b.x, b.n); txt += interpretarComparacionProp(IND[ind0][0], a.grupo, b.grupo, c); }
      else { const c = MH.chi2Proporciones(datos.map(d => ({ x: d.x, n: d.n }))); txt += c ? `Prueba ji-cuadrado de homogeneidad entre los ${datos.length} grupos: χ² = ${num(c.chi2, 2)}, gl = ${c.df}, p ${fP(c.p)}. ` + (c.p < 0.05 ? 'Hay evidencia de diferencias entre grupos; el gráfico muestra cuáles se separan. ' : 'No hay evidencia suficiente de diferencias entre grupos. ') + (c.minEsperado < 5 ? '⚠ Algunos grupos tienen pocos datos (frecuencia esperada < 5): el resultado es aproximado.' : '') : 'No se pudo calcular la prueba (todos los resultados iguales).'; }
    } else {
      const ok = datos.filter(d => d.n >= 2);
      if (ok.length === 2) { const w = MR.welch(ok[0].valores, ok[1].valores); txt += interpretarComparacionMedias(IND[ind0][0], ok[0].grupo, ok[1].grupo, w, ''); }
      else if (ok.length > 2) { const a = MH.anovaUnaVia(ok.map(d => d.valores)); txt += a ? `ANOVA de un factor entre ${ok.length} grupos: F(${a.df1}, ${a.df2}) = ${num(a.F, 2)}, p ${fP(a.p)}, η² = ${num(a.eta2, 2)}. ` + (a.p < 0.05 ? 'Hay evidencia de diferencias entre promedios. ' : 'No hay evidencia suficiente de diferencias entre promedios. ') + 'Los datos reproductivos suelen ser asimétricos; si hay atípicos fuertes, interpreta con cautela.' : ''; }
    }
    txt += ' Asociación no implica causa: otros factores (época, edad, manejo) pueden explicar las diferencias.';
    notaTxt = txt;
    const dsBar = { type: 'bar', label: IND[ind0][0], data: datos.map(d => esP ? d.p * 100 : d.media), backgroundColor: datos.map(d => d.n < 10 ? GR : V), borderRadius: 3, ic: datos.map(d => esP ? [d.inf * 100, d.sup * 100] : [d.inf, d.sup]), order: 1 };
    const sets = [dsBar]; if (meta !== null && meta !== undefined) sets.push(linea(esP ? meta : meta, datos.length, RO, 'Meta / referencia (' + num(meta, esP ? 0 : 1) + ')'));
    return { type: 'bar', data: { labels: datos.map(d => d.grupo + ' (n=' + d.n + ')'), datasets: sets }, options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: IND[ind0][0] + ' según ' + (esP ? POR_P : POR_C)[por].toLowerCase() + ' (barras negras: IC 95 %)' } }, scales: { x: { title: { display: true, text: (esP ? POR_P : POR_C)[por] } }, y: { beginAtZero: true, max: esP ? 100 : undefined, title: { display: true, text: IND[ind0][0] } } } } };
  }

  function llenarPor() {
    const esP = IND[$('g_ind').value][1] === 'p', o = esP ? POR_P : POR_C, cur = $('g_por').value;
    $('g_por').innerHTML = Object.keys(o).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${o[k]}</option>`).join('');
  }
  function pintar() {
    if (!$('g_canvas')) return;
    const msgEl = $('g_msg'), box = $('g_caja'); if (chart) { chart.destroy(); chart = null; }
    if (!HATO.hayDatos()) { box.style.display = 'none'; $('g_nota').innerHTML = ''; msgEl.innerHTML = '<p class="hint">Aún no hay datos. Ve a «Mi hato» para cargar el ejemplo, importar un Excel o registrar animales.</p>'; CTX.graf = ''; return; }
    if (typeof Chart === 'undefined') { box.style.display = 'none'; msgEl.innerHTML = '<div class="aviso">No se pudo cargar la librería de gráficas (¿sin internet?). Recarga la página.</div>'; return; }
    const id = $('g_sel').value; $('g_grupos').style.display = id === 'grupos' ? 'grid' : 'none'; if (id === 'grupos') llenarPor();
    const cfg = construir(id, HATO.analisis(true));
    if (typeof cfg === 'string') { box.style.display = 'none'; $('g_nota').innerHTML = ''; msgEl.innerHTML = '<div class="aviso">' + HATO.esc(cfg) + '</div>'; CTX.graf = ''; return; }
    msgEl.innerHTML = ''; box.style.display = 'block'; cfg.plugins = (cfg.plugins || []).concat([plugFondo, plugIC]);
    chart = new Chart($('g_canvas').getContext('2d'), cfg);
    $('g_nota').innerHTML = '<strong>Qué observar:</strong> ' + HATO.esc(notaTxt); CTX.graf = 'Gráfica «' + (LISTA.find(x => x[0] === id) || [])[1] + '»: ' + notaTxt;
  }
  function png() { if (!chart) return; const a = document.createElement('a'); a.href = chart.toBase64Image('image/png', 1); a.download = 'grafica-' + $('g_sel').value + '-' + MH.hoyISO() + '.png'; document.body.appendChild(a); a.click(); a.remove(); }
  function iniciar() {
    $('g_sel').innerHTML = LISTA.map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
    $('g_ind').innerHTML = Object.keys(IND).map(k => `<option value="${k}">${IND[k][0]}</option>`).join('');
    llenarPor(); $('g_sel').onchange = pintar; $('g_ind').onchange = () => { llenarPor(); pintar(); }; $('g_por').onchange = pintar; $('g_png').onclick = png;
  }
  return { iniciar, pintar };
})();

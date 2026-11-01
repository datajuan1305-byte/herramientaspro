// ═══════════════════════════════════════════════════════════════════════════
//  HATO — almacenamiento en el navegador, registro, importación/exportación,
//  resumen de indicadores y alertas. Depende de MR, MH, PR, interpretacion-*.
// ═══════════════════════════════════════════════════════════════════════════
const HATO = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'hp_hatos_repro_v1';
  const ETQ_EVENTO = { parto: 'Parto', servicio: 'Servicio', dx_pos: 'Diagnóstico +', dx_neg: 'Diagnóstico −', aborto: 'Aborto', secado: 'Secado', celo: 'Celo', baja: 'Baja (venta/muerte)' };
  const ETQ_ESTADO = { gestante: 'Gestante', seca: 'Seca (gestante)', servida: 'Servida, por diagnosticar', vacia: 'Vacía / abierta', novilla: 'Novilla', baja: 'Baja' };
  let S = { hatos: {}, actual: 'Mi hato' }, memoriaSolo = false, cache = null, filtro = { lote: '', raza: '' }, problemas = [], detalle = null, pagina = 0, importacion = null;
  const listeners = [];

  // ── Almacenamiento ──
  function cargar() {
    try { const t = localStorage.getItem(KEY); if (t) S = JSON.parse(t); } catch (e) { memoriaSolo = true; }
    if (!S.hatos || !Object.keys(S.hatos).length) S = { hatos: { 'Mi hato': { animales: [], eventos: [] } }, actual: 'Mi hato' };
    if (!S.hatos[S.actual]) S.actual = Object.keys(S.hatos)[0];
  }
  function guardar() {
    cache = null;
    try { localStorage.setItem(KEY, JSON.stringify(S)); memoriaSolo = false; } catch (e) { memoriaSolo = true; }
    listeners.forEach(f => { try { f(); } catch (e) { } });
    avisoAlmacenamiento();
  }
  const hato = () => S.hatos[S.actual];
  function avisoAlmacenamiento() {
    const el = $('h_aviso'); if (!el) return;
    const kb = Math.round(JSON.stringify(S).length / 1024);
    el.innerHTML = memoriaSolo ? '⚠️ Este navegador no permite guardar datos: lo que registres se perderá al cerrar la pestaña. Descarga tu hato en Excel para conservarlo.' : (kb > 3500 ? '⚠️ El hato ocupa ' + kb + ' KB y se acerca al límite del navegador (≈5 MB). Exporta a Excel y respalda.' : '');
    el.style.display = el.innerHTML ? 'block' : 'none';
  }

  // ── Análisis con cache y filtros ──
  function subconjunto() {
    const h = hato();
    const an = h.animales.filter(a => (!filtro.lote || a.lote === filtro.lote) && (!filtro.raza || a.raza === filtro.raza));
    const ids = new Set(an.map(a => a.id));
    return { animales: an, eventos: h.eventos.filter(e => ids.has(e.animal)) };
  }
  function analisis(conFiltro) {
    const key = conFiltro ? 'f' + filtro.lote + '|' + filtro.raza : 'todo';
    if (cache && cache.key === key && cache.dia === MH.hoyISO()) return cache.v;
    const sub = conFiltro ? subconjunto() : hato();
    const an = MH.analizar(sub.animales, sub.eventos, { gest: PR ? PR.get('ref_ges') : 283 });
    an.ciclos.forEach(c => { c.anio = c.fechaParto.slice(0, 4); });
    const v = { an, ind: MH.indicadores(an), alertas: MH.alertas(an, { ref_ab: PR.get('ref_ab'), ref_eps: PR.get('ref_eps') }) };
    cache = { key, dia: MH.hoyISO(), v }; return v;
  }
  const hayDatos = () => hato().animales.length > 0;

  // ── Utilidades de archivos ──
  function descargar(nombre, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function parseCSV(txt) {
    txt = txt.replace(/^﻿/, ''); const prim = txt.split(/\r?\n/)[0] || '';
    const cnt = c => (prim.match(new RegExp('\\' + c, 'g')) || []).length, delim = cnt(';') >= cnt(',') && cnt(';') >= cnt('\t') ? ';' : (cnt('\t') > cnt(',') ? '\t' : ',');
    const filas = []; let f = [], c = '', q = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (q) { if (ch === '"') { if (txt[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true; else if (ch === delim) { f.push(c); c = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && txt[i + 1] === '\n') i++; f.push(c); c = ''; if (f.some(x => x !== '')) filas.push(f); f = []; }
      else c += ch;
    }
    f.push(c); if (f.some(x => x !== '')) filas.push(f);
    if (!filas.length) return [];
    const h = filas[0].map(x => x.trim());
    return filas.slice(1).map(r => { const o = {}; h.forEach((k, i) => o[k || 'col' + (i + 1)] = (r[i] || '').trim()); return o; });
  }
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const SINON = {
    id: ['id', 'animal', 'arete', 'numero', 'num', 'vaca', 'codigo', 'identificacion', 'chapeta', 'crotal', 'nombre'],
    raza: ['raza', 'breed'], lote: ['lote', 'grupo', 'potrero', 'hato', 'finca'], nacimiento: ['nacimiento', 'fecha nacimiento', 'fecha de nacimiento', 'fecha nac', 'f nac', 'birth'], sexo: ['sexo'],
    animal: ['animal', 'id', 'arete', 'vaca', 'numero', 'codigo', 'identificacion', 'chapeta'], fecha: ['fecha', 'date', 'fecha evento', 'fecha del evento'], tipo: ['tipo', 'evento', 'tipo evento', 'tipo de evento', 'actividad', 'novedad'],
    toro: ['toro', 'pajilla', 'semental', 'padre', 'reproductor'], tipoServicio: ['tipo servicio', 'tipo de servicio', 'metodo', 'ia monta', 'monta ia']
  };
  function autoMapa(cols, campos) {
    const m = {}, usados = new Set(), n = cols.map(norm);
    campos.forEach(c => { for (const s of SINON[c]) { const i = n.findIndex((x, k) => !usados.has(k) && x === s); if (i >= 0) { m[c] = cols[i]; usados.add(i); return; } } });
    campos.forEach(c => { if (m[c]) return; for (const s of SINON[c]) { const i = n.findIndex((x, k) => !usados.has(k) && x.includes(s)); if (i >= 0) { m[c] = cols[i]; usados.add(i); return; } } });
    return m;
  }

  // ── Plantilla y exportación ──
  function plantilla() {
    if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Revisa tu conexión a internet y recarga la página.'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['id', 'raza', 'lote', 'fecha_nacimiento', 'sexo'], ['V001', 'Holstein', 'Lote A', '2021-03-15', 'H'], ['V002', 'Cebú x Holstein', 'Lote B', '2020-08-02', 'H']]), 'Animales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['animal', 'fecha', 'tipo', 'toro', 'tipo_servicio'],
      ['V001', '2023-02-10', 'servicio', 'Toro 101', 'IA'], ['V001', '2023-03-28', 'dx_pos', '', ''], ['V001', '2023-11-20', 'parto', '', ''], ['V001', '2024-01-25', 'servicio', 'Toro 102', 'Monta'], ['V002', '2023-05-05', 'servicio', 'Pajilla X', 'IA'], ['V002', '2023-06-20', 'dx_neg', '', '']]), 'Eventos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['INSTRUCCIONES'], [''], ['Hoja "Animales": una fila por animal. Obligatorio: id. Opcionales: raza, lote, fecha_nacimiento, sexo.'], ['Hoja "Eventos": una fila por evento. Obligatorios: animal (mismo id), fecha, tipo.'], ['Fechas: AAAA-MM-DD o DD/MM/AAAA (día primero).'], [''], ['Tipos de evento válidos:'], ['parto'], ['servicio  (también: monta, inseminación, IA)'], ['dx_pos  (diagnóstico de gestación positivo / preñada)'], ['dx_neg  (diagnóstico negativo / vacía)'], ['aborto'], ['secado'], ['celo'], ['baja  (venta, descarte o muerte)'], [''], ['Puedes borrar las filas de ejemplo y pegar tus propios datos. Si tu archivo tiene otros nombres de columna, la herramienta te deja emparejarlos al importar.']]), 'Instrucciones');
    XLSX.writeFile(wb, 'plantilla-hato-reproductivo.xlsx');
  }
  function exportarExcel() {
    if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Recarga la página.'); return; }
    const h = hato(), r = analisis(false), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(h.animales.map(a => ({ id: a.id, raza: a.raza, lote: a.lote, fecha_nacimiento: a.nacimiento || '', sexo: a.sexo }))), 'Animales');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(h.eventos.map(e => ({ animal: e.animal, fecha: e.fecha, tipo: e.tipo, toro: e.toro, tipo_servicio: e.tipoServicio }))), 'Eventos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.an.animales.map(a => ({ id: a.id, lote: a.lote, raza: a.raza, estado: ETQ_ESTADO[a.estado], partos: a.nPartos, ultimo_parto: a.ultimoParto || '', dias_posparto: a.diasPosparto === null ? '' : a.diasPosparto, ultimo_servicio: a.ultimoServicio || '', parto_esperado: a.partoEsperado || '' }))), 'Estado actual');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.alertas.map(a => ({ animal: a.animal, lote: a.lote, tipo: a.tipo, alerta: a.texto }))), 'Alertas');
    XLSX.writeFile(wb, 'hato-' + S.actual.replace(/[^a-zA-Z0-9]+/g, '_') + '-' + MH.hoyISO() + '.xlsx');
  }
  function exportarCSVEventos() {
    const h = hato(), f = v => '"' + String(v || '').replace(/"/g, '""') + '"';
    const t = 'animal,fecha,tipo,toro,tipo_servicio\n' + h.eventos.map(e => [e.animal, e.fecha, e.tipo, e.toro, e.tipoServicio].map(f).join(',')).join('\n');
    descargar('eventos-' + MH.hoyISO() + '.csv', new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }));
  }

  // ── Importación con mapeo de columnas ──
  function leerArchivo(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase(), fr = new FileReader();
    fr.onerror = () => { $('h_import').innerHTML = '<div class="aviso">No se pudo leer el archivo.</div>'; };
    if (ext === 'csv' || ext === 'txt') {
      fr.onload = () => { const filas = parseCSV(fr.result); iniciarImportacion([{ nombre: file.name, filas }]); };
      fr.readAsText(file, 'UTF-8');
    } else {
      if (typeof XLSX === 'undefined') { $('h_import').innerHTML = '<div class="aviso">La librería de Excel no cargó. Recarga la página o usa un archivo CSV.</div>'; return; }
      fr.onload = () => {
        try {
          const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: false });
          iniciarImportacion(wb.SheetNames.map(n => ({ nombre: n, filas: XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: '', raw: true }) })).filter(h => h.filas.length && !/instruc/i.test(h.nombre)));
        } catch (e) { $('h_import').innerHTML = '<div class="aviso">No se pudo abrir el archivo de Excel (' + esc(e.message) + ').</div>'; }
      };
      fr.readAsArrayBuffer(file);
    }
  }
  function iniciarImportacion(hojas) {
    if (!hojas.length) { $('h_import').innerHTML = '<div class="aviso">El archivo no contiene datos en sus hojas.</div>'; return; }
    // Asignar hoja → rol
    const info = hojas.map(h => {
      const cols = Object.keys(h.filas[0] || {}), mE = autoMapa(cols, ['animal', 'fecha', 'tipo', 'toro', 'tipoServicio']), mA = autoMapa(cols, ['id', 'raza', 'lote', 'nacimiento', 'sexo']);
      const esEv = !!(mE.animal && mE.fecha && mE.tipo), esAn = !!(mA.id && !esEv);
      return Object.assign({}, h, { cols, rol: esEv ? 'eventos' : (esAn ? 'animales' : 'ignorar'), mE, mA });
    });
    importacion = info; pintarImportacion();
  }
  function pintarImportacion() {
    const opts = (cols, sel) => '<option value="">(no usar)</option>' + cols.map(c => `<option value="${esc(c)}" ${c === sel ? 'selected' : ''}>${esc(c)}</option>`).join('');
    const campoE = [['animal', 'Animal (id)*'], ['fecha', 'Fecha*'], ['tipo', 'Tipo de evento*'], ['toro', 'Toro / pajilla'], ['tipoServicio', 'Tipo de servicio']];
    const campoA = [['id', 'Id del animal*'], ['raza', 'Raza'], ['lote', 'Lote'], ['nacimiento', 'Fecha de nacimiento'], ['sexo', 'Sexo']];
    $('h_import').innerHTML = `<div class="card" style="border-color:var(--verde)"><h2>Importar datos: emparejar columnas</h2>
    <p class="hint">Revisa que cada campo apunte a la columna correcta de tu archivo. Los marcados con * son obligatorios.</p>
    ${importacion.map((h, i) => `<div style="border:1px solid var(--linea);border-radius:8px;padding:10px;margin-bottom:10px">
      <div class="row"><div><label>Hoja / archivo</label><strong>${esc(h.nombre)}</strong> <span class="hint">(${h.filas.length} filas)</span></div>
      <div><label>¿Qué contiene?</label><select data-i="${i}" class="imp-rol"><option value="eventos" ${h.rol === 'eventos' ? 'selected' : ''}>Eventos (una fila por evento)</option><option value="animales" ${h.rol === 'animales' ? 'selected' : ''}>Animales (una fila por animal)</option><option value="ignorar" ${h.rol === 'ignorar' ? 'selected' : ''}>Ignorar esta hoja</option></select></div></div>
      ${h.rol === 'ignorar' ? '' : `<div class="row">${(h.rol === 'eventos' ? campoE : campoA).map(([k, l]) => `<div><label>${l}</label><select data-i="${i}" data-k="${k}" class="imp-map">${opts(h.cols, (h.rol === 'eventos' ? h.mE : h.mA)[k])}</select></div>`).join('')}</div>`}
    </div>`).join('')}
    <div class="row"><div><label>¿Qué hacer con los datos actuales de este hato?</label><select id="imp_modo"><option value="agregar">Agregar a lo que ya existe</option><option value="reemplazar">Reemplazar todo el hato</option></select></div></div>
    <button class="go" id="imp_ok">Importar</button> <button class="sec" id="imp_cancel">Cancelar</button><div id="imp_msg" style="margin-top:8px"></div></div>`;
    document.querySelectorAll('.imp-rol').forEach(s => s.onchange = () => { importacion[+s.dataset.i].rol = s.value; pintarImportacion(); });
    document.querySelectorAll('.imp-map').forEach(s => s.onchange = () => { const h = importacion[+s.dataset.i]; (h.rol === 'eventos' ? h.mE : h.mA)[s.dataset.k] = s.value; });
    $('imp_cancel').onclick = () => { importacion = null; $('h_import').innerHTML = ''; };
    $('imp_ok').onclick = ejecutarImportacion;
  }
  function ejecutarImportacion() {
    const A = [], E = [];
    importacion.forEach(h => {
      if (h.rol === 'animales') h.filas.forEach(f => A.push({ id: f[h.mA.id], raza: h.mA.raza ? f[h.mA.raza] : '', lote: h.mA.lote ? f[h.mA.lote] : '', nacimiento: h.mA.nacimiento ? f[h.mA.nacimiento] : '', sexo: h.mA.sexo ? f[h.mA.sexo] : 'H' }));
      if (h.rol === 'eventos') {
        if (!h.mE.animal || !h.mE.fecha || !h.mE.tipo) return;
        h.filas.forEach(f => E.push({ animal: f[h.mE.animal], fecha: f[h.mE.fecha], tipo: f[h.mE.tipo], toro: h.mE.toro ? f[h.mE.toro] : '', tipoServicio: h.mE.tipoServicio ? f[h.mE.tipoServicio] : '' }));
      }
    });
    if (!A.length && !E.length) { $('imp_msg').innerHTML = '<div class="aviso">No hay datos para importar: revisa que hayas emparejado los campos obligatorios (*).</div>'; return; }
    let animales = A, eventos = E;
    if ($('imp_modo').value === 'agregar') { const h = hato(); animales = h.animales.concat(A); eventos = h.eventos.concat(E); }
    const L = MH.limpiar(animales, eventos); problemas = L.problemas;
    S.hatos[S.actual] = { animales: L.animales, eventos: L.eventos }; guardar();
    importacion = null; $('h_import').innerHTML = `<div class="card" style="border-color:var(--verde)"><strong>✅ Importación lista:</strong> ${L.animales.length} animales y ${L.eventos.length} eventos en «${esc(S.actual)}».` + resumenProblemas() + '</div>';
    pagina = 0; repintarTodo();
  }
  function resumenProblemas() {
    if (!problemas.length) return '';
    return `<details style="margin-top:8px"><summary>⚠️ ${problemas.length} observaciones sobre los datos (clic para ver)</summary><ul style="font-size:.85rem;max-height:220px;overflow:auto">${problemas.slice(0, 200).map(p => '<li>' + esc(p) + '</li>').join('')}${problemas.length > 200 ? '<li>… y ' + (problemas.length - 200) + ' más</li>' : ''}</ul></details>`;
  }

  // ── Panel Mi hato ──
  function pintarSelector() {
    const sel = $('h_sel'); if (!sel) return;
    sel.innerHTML = Object.keys(S.hatos).map(n => `<option value="${esc(n)}" ${n === S.actual ? 'selected' : ''}>${esc(n)}</option>`).join('');
    const h = hato(); $('h_info').textContent = `${h.animales.length} animales · ${h.eventos.length} eventos registrados`;
    $('h_vacio').style.display = h.animales.length ? 'none' : 'block';
  }
  function pintarTabla() {
    const box = $('h_tabla'); if (!box) return;
    const r = analisis(false), q = norm($('h_q') ? $('h_q').value : ''), est = $('h_est') ? $('h_est').value : '';
    let filas = r.an.animales.filter(a => (!q || norm(a.id + ' ' + a.lote + ' ' + a.raza).includes(q)) && (!est || a.estado === est));
    const total = filas.length, tp = 50, ini = Math.min(pagina, Math.max(0, Math.ceil(total / tp) - 1)) * tp;
    filas = filas.slice(ini, ini + tp);
    $('h_tabla').innerHTML = `<div style="overflow-x:auto"><table><tr><th>Id</th><th>Lote</th><th>Raza</th><th>Estado</th><th>Partos</th><th>Días posparto</th><th>Último servicio</th><th>Parto esperado</th></tr>
    ${filas.map(a => `<tr class="fila-an" data-id="${esc(a.id)}" style="cursor:pointer"><td><strong>${esc(a.id)}</strong></td><td>${esc(a.lote)}</td><td>${esc(a.raza)}</td><td>${ETQ_ESTADO[a.estado]}</td><td>${a.nPartos}</td><td>${a.diasPosparto === null ? '' : a.diasPosparto}</td><td>${a.ultimoServicio || ''}</td><td>${a.partoEsperado || ''}</td></tr>`).join('')}</table></div>
    <p class="hint">Mostrando ${total ? ini + 1 : 0}–${ini + filas.length} de ${total}. Haz clic en un animal para ver y editar su historial.
    ${total > tp ? ` <button class="sec" id="h_prev">◀</button> <button class="sec" id="h_next">▶</button>` : ''}</p>`;
    document.querySelectorAll('.fila-an').forEach(tr => tr.onclick = () => { detalle = tr.dataset.id; pintarDetalle(); });
    if ($('h_prev')) { $('h_prev').onclick = () => { pagina = Math.max(0, pagina - 1); pintarTabla(); }; $('h_next').onclick = () => { pagina = pagina + 1; pintarTabla(); }; }
  }
  function pintarDetalle() {
    const box = $('h_detalle'); if (!box) return; if (!detalle) { box.innerHTML = ''; return; }
    const h = hato(), a = h.animales.find(x => x.id === detalle); if (!a) { box.innerHTML = ''; return; }
    const ev = h.eventos.map((e, i) => Object.assign({ i }, e)).filter(e => e.animal === a.id).sort((x, y) => x.fecha < y.fecha ? -1 : 1);
    const an = analisis(false).an.animales.find(x => x.id === a.id);
    box.innerHTML = `<div class="card" style="border-color:var(--verde)"><h2>Animal ${esc(a.id)} <span class="hint">— ${esc(ETQ_ESTADO[an.estado])}</span></h2>
    <div class="row"><div><label>Raza</label><input id="d_raza" value="${esc(a.raza)}"></div><div><label>Lote</label><input id="d_lote" value="${esc(a.lote)}"></div><div><label>Nacimiento</label><input id="d_nac" type="date" value="${esc(a.nacimiento || '')}"></div></div>
    <button class="sec" id="d_guardar">Guardar cambios</button> <button class="sec" id="d_borrar">🗑 Eliminar animal y sus eventos</button> <button class="sec" id="d_cerrar">Cerrar</button>
    <h3 style="margin:12px 0 4px;font-size:.95rem">Historial (${ev.length} eventos)</h3>
    <table><tr><th>Fecha</th><th>Evento</th><th>Toro</th><th>Servicio</th><th></th></tr>${ev.map(e => `<tr><td>${e.fecha}</td><td>${ETQ_EVENTO[e.tipo]}</td><td>${esc(e.toro)}</td><td>${esc(e.tipoServicio)}</td><td><button class="sec ev-del" data-i="${e.i}" title="Eliminar evento">✕</button></td></tr>`).join('') || '<tr><td colspan="5">Sin eventos</td></tr>'}</table></div>`;
    $('d_guardar').onclick = () => { a.raza = $('d_raza').value.trim(); a.lote = $('d_lote').value.trim(); a.nacimiento = MH.iso($('d_nac').value) || null; guardar(); repintarTodo(); };
    $('d_borrar').onclick = () => { if (confirm('¿Eliminar el animal ' + a.id + ' y todos sus eventos?')) { h.animales = h.animales.filter(x => x.id !== a.id); h.eventos = h.eventos.filter(e => e.animal !== a.id); detalle = null; guardar(); repintarTodo(); } };
    $('d_cerrar').onclick = () => { detalle = null; pintarDetalle(); };
    document.querySelectorAll('.ev-del').forEach(b => b.onclick = () => { h.eventos.splice(+b.dataset.i, 1); guardar(); repintarTodo(); });
  }
  function pintarFormularios() {
    const h = hato(); $('h_dl').innerHTML = h.animales.map(a => `<option value="${esc(a.id)}">`).join('');
  }
  function agregarAnimal() {
    const id = $('a_id').value.trim(); if (!id) { msg('a_msg', 'Escribe la identificación del animal.'); return; }
    if (hato().animales.some(a => a.id === id)) { msg('a_msg', 'Ya existe un animal con ese id.'); return; }
    const nac = $('a_nac').value; hato().animales.push({ id, raza: $('a_raza').value.trim(), lote: $('a_lote').value.trim(), nacimiento: nac ? MH.iso(nac) : null, sexo: 'H', obs: '' });
    ['a_id', 'a_raza', 'a_nac'].forEach(i => $(i).value = ''); guardar(); repintarTodo(); msg('a_msg', '✔ Animal agregado.');
  }
  function agregarEvento() {
    const id = $('e_animal').value.trim(), f = MH.iso($('e_fecha').value), t = $('e_tipo').value;
    if (!id || !f) { msg('e_msg', 'Indica el animal y la fecha.'); return; }
    const h = hato(); if (!h.animales.some(a => a.id === id)) { if (!confirm('El animal ' + id + ' no existe. ¿Crearlo?')) return; h.animales.push({ id, raza: '', lote: '', nacimiento: null, sexo: 'H', obs: '' }); }
    if (h.eventos.some(e => e.animal === id && e.fecha === f && e.tipo === t)) { msg('e_msg', 'Ese evento ya está registrado.'); return; }
    h.eventos.push({ animal: id, fecha: f, tipo: t, toro: $('e_toro').value.trim(), tipoServicio: $('e_ts').value, obs: '' });
    guardar(); repintarTodo(); msg('e_msg', '✔ Evento registrado.'); detalle = id; pintarDetalle();
  }
  const msg = (id, t) => { const e = $(id); if (e) { e.textContent = t; setTimeout(() => { if (e.textContent === t) e.textContent = ''; }, 4000); } };

  // ── Filtros comunes (Resumen / Gráficas / Alertas) ──
  function pintarFiltros() {
    const h = hato(), lotes = [...new Set(h.animales.map(a => a.lote).filter(Boolean))].sort(), razas = [...new Set(h.animales.map(a => a.raza).filter(Boolean))].sort();
    if (filtro.lote && !lotes.includes(filtro.lote)) filtro.lote = ''; if (filtro.raza && !razas.includes(filtro.raza)) filtro.raza = '';
    document.querySelectorAll('.filtros-hato').forEach(box => {
      box.innerHTML = `<div class="row" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))"><div><label>Filtrar por lote</label><select class="f-lote"><option value="">Todos</option>${lotes.map(l => `<option ${l === filtro.lote ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
      <div><label>Filtrar por raza</label><select class="f-raza"><option value="">Todas</option>${razas.map(l => `<option ${l === filtro.raza ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div></div>`;
      box.querySelector('.f-lote').onchange = e => { filtro.lote = e.target.value; cache = null; repintarAnalisis(); };
      box.querySelector('.f-raza').onchange = e => { filtro.raza = e.target.value; cache = null; repintarAnalisis(); };
    });
  }

  // ── Resumen ──
  const colorEstado = { cumple: 'cumple', incumple: 'incumple', no_concluyente: 'no_concluyente' };
  function filaProp(nombre, o, meta, dir) {
    if (!o.n) return { nombre, valor: '—', ic: '', meta: pct(meta, 0), est: null, n: 0, texto: '' };
    const r = MR.evaluarProporcion({ x: o.x, n: o.n, meta, direccion: dir });
    return { nombre, valor: pct(r.p), ic: `${pct(r.wilson.inf)} – ${pct(r.wilson.sup)}`, meta: (dir === 'mayor' ? '≥ ' : '≤ ') + pct(meta, 0), est: r.estado, n: o.n, texto: interpretarProporcion(nombre, r) };
  }
  function filaCont(nombre, unidad, v, ref, dir) {
    if (v.length < 3) return { nombre, valor: v.length ? fR(MR.media(v)) + ' ' + unidad : '—', ic: v.length ? 'n muy pequeño' : '', meta: ref ? (dir === 'menor' ? '≤ ' : '≥ ') + fR(ref) : '', est: null, n: v.length, texto: '' };
    const r = MR.evaluarContinuo(v, ref || v[0]);
    const est = ref ? (dir === 'menor' ? (r.ic[1] <= ref ? 'cumple' : r.ic[0] > ref ? 'incumple' : 'no_concluyente') : (r.ic[0] >= ref ? 'cumple' : r.ic[1] < ref ? 'incumple' : 'no_concluyente')) : null;
    return { nombre, valor: fR(r.media) + ' ' + unidad, ic: `${fR(r.ic[0])} – ${fR(r.ic[1])}`, meta: ref ? (dir === 'menor' ? '≤ ' : '≥ ') + fR(ref) : '—', est, n: v.length, texto: interpretarContinuo(nombre, unidad, r, dir, ref || null), mediana: r.mediana };
  }
  function indicadoresResumen(ind) {
    const prenados = (ind.estados.gestante || 0) + (ind.estados.seca || 0), enProd = prenados + (ind.estados.vacia || 0) + (ind.estados.servida || 0);
    return [
      filaProp('Concepción por servicio', ind.conc, PR.get('meta_conc') / 100, 'mayor'),
      filaProp('Concepción al 1.er servicio posparto', ind.conc1, PR.get('meta_conc1') / 100, 'mayor'),
      filaProp('Preñez actual del hato (gestantes / vacas en producción)', { x: prenados, n: enProd }, PR.get('meta_prenez') / 100, 'mayor'),
      filaProp('Pérdidas fetales (abortos / preñeces)', ind.perd, PR.get('meta_perd') / 100, 'menor'),
      filaCont('Días abiertos', 'días', ind.ab, PR.get('ref_ab'), 'menor'),
      filaCont('Intervalo entre partos', 'días', ind.iep, PR.get('ref_iep'), 'menor'),
      filaCont('Servicios por concepción', 'serv.', ind.sc, PR.get('ref_sc'), 'menor'),
      filaCont('Días al primer servicio posparto', 'días', ind.dpps, null, 'menor'),
      filaCont('Edad al primer parto', 'meses', ind.epp, PR.get('ref_epp'), 'menor'),
      filaCont('Edad al primer servicio', 'meses', ind.eps, PR.get('ref_eps'), 'menor')
    ];
  }
  function pintarResumen() {
    const box = $('r_cuerpo'); if (!box) return;
    if (!hayDatos()) { box.innerHTML = '<p class="hint">Aún no hay datos. Ve a «Mi hato» para cargar el ejemplo, importar un Excel o registrar animales.</p>'; CTX.hato = ''; return; }
    const { an, ind, alertas } = analisis(true), filas = indicadoresResumen(ind), E = ind.estados;
    const ico = { cumple: '🟢', no_concluyente: '🟡', incumple: '🔴' };
    const chips = Object.keys(ETQ_ESTADO).map(k => E[k] ? `<span style="display:inline-block;background:#e6f6f0;border-radius:999px;padding:4px 12px;margin:2px;font-size:.85rem"><strong>${E[k]}</strong> ${ETQ_ESTADO[k]}</span>` : '').join('');
    box.innerHTML = `<p>${chips}</p><p class="hint">Perfil de referencia: <strong>${esc(PR.nombre())}</strong> · Datos al ${an.hoy} · ${an.animales.length} animales${filtro.lote || filtro.raza ? ' (filtrado)' : ''}</p>
    <div style="overflow-x:auto"><table><tr><th></th><th>Indicador</th><th>Valor</th><th>IC 95%</th><th>Meta</th><th>n</th></tr>${filas.map(f => `<tr><td>${f.est ? ico[f.est] : ''}</td><td>${esc(f.nombre)}</td><td><strong>${esc(f.valor)}</strong></td><td>${esc(f.ic)}</td><td>${esc(f.meta)}</td><td>${f.n}</td></tr>`).join('')}</table></div>
    <details style="margin-top:10px"><summary>Ver interpretación de cada indicador</summary>${filas.filter(f => f.texto).map(f => `<div class="sema ${f.est || ''}" style="margin-top:8px"><p>${esc(f.texto)}</p></div>`).join('')}</details>
    <p class="hint">Los indicadores se calculan solos con los eventos registrados. Un servicio sin diagnóstico ni nuevo servicio después de 60 días se excluye del % de concepción (resultado desconocido). ${DESCARGO}</p>`;
    // contexto para la IA
    CTX.hato = `HATO «${S.actual}» (${an.animales.length} animales${filtro.lote ? ', lote ' + filtro.lote : ''}${filtro.raza ? ', raza ' + filtro.raza : ''}). Estados: ` + Object.keys(E).map(k => ETQ_ESTADO[k] + ' ' + E[k]).join(', ') + '. Indicadores: ' + filas.map(f => `${f.nombre}: ${f.valor}${f.ic ? ' (IC ' + f.ic + ')' : ''}, meta ${f.meta}, n=${f.n}${f.est ? ', ' + f.est : ''}`).join('; ') + `. Alertas activas: ${alertas.length} (` + Object.entries(alertas.reduce((o, a) => (o[a.tipo] = (o[a.tipo] || 0) + 1, o), {})).map(([k, v]) => k + ' ' + v).join(', ') + '). Perfil de referencia: ' + PR.nombre() + '.';
  }

  // ── Alertas ──
  const ETQ_ALERTA = { abiertos: '🔴 Días abiertos excedidos', repetidora: '🔴 Vacas repetidoras', revisar: '🔴 Revisar registros', parto: '🟠 Partos próximos', diagnostico: '🟠 Diagnóstico de gestación pendiente', sin_servicio: '🟠 Sin servicio posparto', secado: '🟡 Secados próximos', novilla: '🟡 Novillas sin servicio' };
  function pintarAlertas() {
    const box = $('al_cuerpo'); if (!box) return;
    if (!hayDatos()) { box.innerHTML = '<p class="hint">Aún no hay datos en el hato.</p>'; return; }
    const al = analisis(true).alertas;
    if (!al.length) { box.innerHTML = '<p>✅ No hay alertas con los datos actuales.</p>'; return; }
    const g = {}; al.forEach(a => (g[a.tipo] = g[a.tipo] || []).push(a));
    box.innerHTML = `<p><strong>${al.length}</strong> alertas en <strong>${new Set(al.map(a => a.animal)).size}</strong> animales. <button class="sec" id="al_xls">⬇ Exportar alertas (CSV)</button></p>` +
      Object.keys(ETQ_ALERTA).filter(k => g[k]).map(k => `<details ${g[k].length <= 8 ? 'open' : ''}><summary>${ETQ_ALERTA[k]} (${g[k].length})</summary><table><tr><th>Animal</th><th>Lote</th><th>Detalle</th></tr>${g[k].map(a => `<tr><td><strong>${esc(a.animal)}</strong></td><td>${esc(a.lote)}</td><td>${esc(a.texto)}</td></tr>`).join('')}</table></details>`).join('') +
      '<p class="hint">Las alertas usan las referencias del perfil elegido (días abiertos máximos, edad al primer servicio) y una gestación de ' + PR.get('ref_ges') + ' días.</p>';
    $('al_xls').onclick = () => { const f = v => '"' + String(v || '').replace(/"/g, '""') + '"'; descargar('alertas-' + MH.hoyISO() + '.csv', new Blob(['﻿' + 'animal,lote,tipo,alerta\n' + al.map(a => [a.animal, a.lote, ETQ_ALERTA[a.tipo], a.texto].map(f).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })); };
  }

  // ── Conexión con las pestañas rápidas ──
  function valoresParaRapido() {
    const { an, ind } = analisis(false), E = ind.estados, pren = (E.gestante || 0) + (E.seca || 0), enProd = pren + (E.vacia || 0) + (E.servida || 0);
    const hace12 = MH.suma(an.hoy, -365), partos12 = an.ciclos.filter(c => c.fechaParto > hace12).length;
    return { prop: { conc: ind.conc, conc1: ind.conc1, perd: ind.perd, prenez: { x: pren, n: enProd }, nat: { x: partos12, n: enProd } }, cont: { iep: ind.iep, ab: ind.ab, sc: ind.sc, epp: ind.epp, eps: ind.eps } };
  }

  function repintarAnalisis() { pintarResumen(); pintarAlertas(); if (typeof GRAF !== 'undefined') GRAF.pintar(); }
  function repintarTodo() { pintarSelector(); pintarFormularios(); pintarTabla(); pintarDetalle(); pintarFiltros(); repintarAnalisis(); }

  function iniciar() {
    cargar();
    $('h_sel').onchange = e => { S.actual = e.target.value; detalle = null; cache = null; guardar(); repintarTodo(); };
    $('h_nuevo').onclick = () => { const n = (prompt('Nombre del nuevo hato o finca:', '') || '').trim(); if (!n) return; if (S.hatos[n]) { alert('Ya existe un hato con ese nombre.'); return; } S.hatos[n] = { animales: [], eventos: [] }; S.actual = n; detalle = null; guardar(); repintarTodo(); };
    $('h_del').onclick = () => { if (Object.keys(S.hatos).length < 2) { if (confirm('Este es tu único hato. ¿Vaciarlo (eliminar todos sus animales y eventos)?')) { S.hatos[S.actual] = { animales: [], eventos: [] }; guardar(); repintarTodo(); } return; } if (confirm('¿Eliminar el hato «' + S.actual + '» con todos sus datos?')) { delete S.hatos[S.actual]; S.actual = Object.keys(S.hatos)[0]; guardar(); repintarTodo(); } };
    $('h_ejemplo').onclick = () => { if (hayDatos() && !confirm('Se reemplazarán los datos de este hato por un hato de ejemplo SIMULADO. ¿Continuar?')) return; const e = MH.ejemplo(80, 7), L = MH.limpiar(e.animales, e.eventos); S.hatos[S.actual] = { animales: L.animales, eventos: L.eventos }; problemas = []; guardar(); repintarTodo(); };
    $('h_plantilla').onclick = plantilla; $('h_xls').onclick = exportarExcel; $('h_csv').onclick = exportarCSVEventos;
    $('h_file').onchange = e => { if (e.target.files[0]) leerArchivo(e.target.files[0]); e.target.value = ''; };
    $('a_add').onclick = agregarAnimal; $('e_add').onclick = agregarEvento;
    $('e_fecha').value = MH.hoyISO();
    $('h_q').oninput = () => { pagina = 0; pintarTabla(); }; $('h_est').onchange = () => { pagina = 0; pintarTabla(); };
    $('h_est').innerHTML = '<option value="">Todos los estados</option>' + Object.keys(ETQ_ESTADO).map(k => `<option value="${k}">${ETQ_ESTADO[k]}</option>`).join('');
    repintarTodo();
  }
  return { iniciar, recalcular: () => { cache = null; repintarAnalisis(); pintarTabla(); }, analisis, filtro: () => filtro, hayDatos, valoresParaRapido, repintar: repintarTodo, etqEstado: ETQ_ESTADO, onChange: f => listeners.push(f), nombre: () => S.actual, descargar, esc };
})();

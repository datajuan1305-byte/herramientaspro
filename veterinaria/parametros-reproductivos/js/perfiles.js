// ═══════════════════════════════════════════════════════════════════════════
//  PERFILES DE REFERENCIA — módulo genérico reutilizable (HerramientasPro)
//  Uso:
//    const PR = Perfiles.crear({
//      storageKey: 'hp_perfiles_xxx',      // clave única por herramienta
//      catalogo:   { id: {nombre, fuente, valores:{clave:valor}} },  // perfiles predefinidos
//      campos:     [{k:'clave', label:'...', unit:'%', grupo:'...', step:1}],
//      porDefecto: 'id',
//      onChange:   () => {...}             // se llama al cambiar de perfil o valores
//    });
//    PR.montar(document.getElementById('contenedor'));
//    PR.get('clave')  → valor vigente
//  Todo se guarda en el navegador del usuario (localStorage). Sin registro.
// ═══════════════════════════════════════════════════════════════════════════
const Perfiles = (function () {
  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function crear(cfg) {
    const st = { actual: cfg.porDefecto, propios: {}, ediciones: {} };
    try { st.propios = JSON.parse(safeGet(cfg.storageKey + '_propios') || '{}'); } catch (e) { st.propios = {}; }
    const previo = safeGet(cfg.storageKey + '_actual');
    if (previo && (cfg.catalogo[previo] || st.propios[previo])) st.actual = previo;

    const todos = () => Object.assign({}, cfg.catalogo, st.propios);
    const base = () => (todos()[st.actual] || cfg.catalogo[cfg.porDefecto]);
    const api = {
      get(k) { return k in st.ediciones ? st.ediciones[k] : base().valores[k]; },
      actual() { return st.actual; },
      nombre() { return base().nombre; },
      fuente() { return base().fuente || ''; },
      valoresVigentes() { const o = {}; cfg.campos.forEach(c => o[c.k] = api.get(c.k)); return o; },
      seleccionar(id) {
        if (!todos()[id]) return; st.actual = id; st.ediciones = {};
        safeSet(cfg.storageKey + '_actual', id); api.refrescar(true);
      },
      guardarComo(nombre) {
        nombre = (nombre || '').trim(); if (!nombre) return false;
        const id = 'u_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        st.propios[id] = { nombre, fuente: 'Perfil personalizado', propio: true, valores: api.valoresVigentes() };
        safeSet(cfg.storageKey + '_propios', JSON.stringify(st.propios));
        st.actual = id; st.ediciones = {}; safeSet(cfg.storageKey + '_actual', id); api.refrescar(true); return true;
      },
      eliminar() {
        if (!st.propios[st.actual]) return false;
        delete st.propios[st.actual]; safeSet(cfg.storageKey + '_propios', JSON.stringify(st.propios));
        st.actual = cfg.porDefecto; st.ediciones = {}; safeSet(cfg.storageKey + '_actual', st.actual); api.refrescar(true); return true;
      },
      exportar() { return JSON.stringify({ herramienta: cfg.storageKey, nombre: base().nombre, valores: api.valoresVigentes() }, null, 2); },
      importar(txt) {
        let o; try { o = JSON.parse(txt); } catch (e) { return false; }
        if (!o || typeof o.valores !== 'object') return false;
        const v = {}; cfg.campos.forEach(c => { const n = Number(o.valores[c.k]); v[c.k] = isFinite(n) ? n : base().valores[c.k]; });
        const nombre = (o.nombre || 'Perfil importado').toString().slice(0, 60);
        const id = 'u_' + nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
        st.propios[id] = { nombre, fuente: 'Perfil importado', propio: true, valores: v };
        safeSet(cfg.storageKey + '_propios', JSON.stringify(st.propios)); api.seleccionar(id); return true;
      },
      enlace() {
        const p = { n: base().nombre, v: api.valoresVigentes() };
        return location.origin + location.pathname + '#perfil=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(p)))));
      },
      _desdeHash() {
        const m = location.hash.match(/#perfil=([^&]+)/); if (!m) return;
        try {
          const p = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
          api.importar(JSON.stringify({ herramienta: cfg.storageKey, nombre: p.n, valores: p.v }));
        } catch (e) { /* enlace inválido: se ignora */ }
      },
      montar(el) { st.el = el; api._desdeHash(); api.refrescar(false); },
      refrescar(avisar) {
        if (st.el) api._pintar();
        if (avisar && cfg.onChange) cfg.onChange();
      },
      _pintar() {
        const el = st.el, t = todos(), grupos = {};
        cfg.campos.forEach(c => (grupos[c.grupo || 'Valores'] = grupos[c.grupo || 'Valores'] || []).push(c));
        const opts = Object.keys(t).map(id => `<option value="${id}" ${id === st.actual ? 'selected' : ''}>${esc(t[id].nombre)}${t[id].propio ? ' ★' : ''}</option>`).join('');
        el.innerHTML = `
        <div class="row" style="align-items:end">
          <div style="grid-column:span 2"><label>Perfil de referencia (sistema productivo / criterio)</label><select id="pf_sel">${opts}</select></div>
          <div><button class="sec" id="pf_save">💾 Guardar como…</button></div>
          <div><button class="sec" id="pf_del" ${base().propio ? '' : 'disabled style="opacity:.4"'}>🗑 Eliminar</button></div>
        </div>
        <p class="hint">Fuente: ${esc(base().fuente || '')}</p>
        <details><summary>Ver / ajustar los valores de este perfil</summary>
          ${Object.keys(grupos).map(g => `<h4 style="margin:10px 0 4px">${esc(g)}</h4><div class="row">${grupos[g].map(c => `<div><label>${esc(c.label)}${c.unit ? ' (' + esc(c.unit) + ')' : ''}</label><input type="number" data-k="${c.k}" step="${c.step || 'any'}" value="${api.get(c.k)}"></div>`).join('')}</div>`).join('')}
          <p class="hint">Los cambios aplican de inmediato a los cálculos. Usa «Guardar como…» para conservarlos en este navegador.</p>
        </details>
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
          <button class="sec" id="pf_exp">⬇ Exportar perfil</button>
          <button class="sec" id="pf_imp">⬆ Importar perfil</button>
          <button class="sec" id="pf_lnk">🔗 Copiar enlace</button>
          <span class="hint" id="pf_msg" style="align-self:center"></span>
        </div>
        <textarea id="pf_io" style="display:none;margin-top:8px" placeholder="Pega aquí el perfil exportado (JSON) y pulsa «Importar perfil» de nuevo"></textarea>`;
        const msg = m => { const x = el.querySelector('#pf_msg'); x.textContent = m; setTimeout(() => x.textContent = '', 4000); };
        el.querySelector('#pf_sel').onchange = e => api.seleccionar(e.target.value);
        el.querySelectorAll('input[data-k]').forEach(i => i.oninput = () => {
          const v = parseFloat(i.value); if (isFinite(v)) { st.ediciones[i.dataset.k] = v; if (cfg.onChange) cfg.onChange(); }
        });
        el.querySelector('#pf_save').onclick = () => {
          const n = prompt('Nombre para tu perfil (ej. Finca La Esperanza):', ''); if (n && api.guardarComo(n)) msg('Perfil guardado en este navegador.');
        };
        el.querySelector('#pf_del').onclick = () => { if (confirm('¿Eliminar este perfil personalizado?')) api.eliminar(); };
        el.querySelector('#pf_exp').onclick = () => {
          const blob = new Blob([api.exportar()], { type: 'application/json' }), a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = 'perfil-referencia.json'; a.click(); msg('Archivo descargado.');
        };
        el.querySelector('#pf_imp').onclick = () => {
          const ta = el.querySelector('#pf_io');
          if (ta.style.display === 'none') { ta.style.display = 'block'; return; }
          msg(api.importar(ta.value) ? 'Perfil importado.' : 'No se pudo leer el perfil.');
        };
        el.querySelector('#pf_lnk').onclick = () => {
          const u = api.enlace();
          (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => msg('Enlace copiado.')).catch(() => { prompt('Copia este enlace:', u); });
        };
      }
    };
    return api;
  }
  return { crear };
})();

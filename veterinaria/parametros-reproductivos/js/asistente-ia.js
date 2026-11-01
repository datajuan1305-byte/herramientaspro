// ═══════════════════════════════════════════════════════════════════════════
//  ASISTENTE IA — módulo genérico reutilizable (HerramientasPro)
//  Modo híbrido:
//    1) Llave propia del usuario (llamada directa a la API desde su navegador)
//    2) Cupo gratuito vía intermediario (cfg.endpoint) con límite diario
//    3) Respaldo sin IA: respuestas por reglas (cfg.reglas)
//  La IA solo INTERPRETA los resultados que entrega cfg.obtenerContexto();
//  nunca calcula. Todo cálculo lo hace el motor de la herramienta.
//
//  AsistenteIA.crear({
//    contenedor, storageKey, endpoint:'' , cupoDiario:5,
//    sistema:'...', obtenerContexto:()=>'texto con resultados',
//    sugerencias:['¿Qué reviso primero?', ...],
//    reglas:(pregunta, contexto)=>'respuesta'
//  })
// ═══════════════════════════════════════════════════════════════════════════
const AsistenteIA = (function () {
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sg = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const ss = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const hoy = () => new Date().toISOString().slice(0, 10);

  function crear(cfg) {
    const K = cfg.storageKey || 'hp_ia', LIM = cfg.cupoDiario || 5;
    const el = cfg.contenedor; let msgs = [], llaveSesion = '';
    const cupo = () => { try { const o = JSON.parse(sg(K + '_cupo') || '{}'); return o.f === hoy() ? o.n : 0; } catch (e) { return 0; } };
    const sumaCupo = () => ss(K + '_cupo', JSON.stringify({ f: hoy(), n: cupo() + 1 }));
    const llave = () => llaveSesion || sg(K + '_llave') || '';
    const modelo = () => sg(K + '_modelo') || 'claude-haiku-5-5';

    function modo() {
      if (llave()) return 'propia';
      if (cfg.endpoint) return cupo() < LIM ? 'cupo' : 'agotado';
      return 'reglas';
    }
    const ETIQ = {
      propia: '🟢 IA activa con tu llave propia',
      cupo: () => `🟢 IA con cupo gratuito (${LIM - cupo()} de ${LIM} consultas hoy)`,
      agotado: '🟡 Cupo gratuito de hoy agotado: usa tu llave propia o vuelve mañana (se muestran respuestas básicas)',
      reglas: '🟡 Modo básico (sin IA): respuestas por reglas. La IA se activa con tu llave propia o cuando el cupo gratuito esté disponible'
    };

    function pintar() {
      const m = modo(), et = typeof ETIQ[m] === 'function' ? ETIQ[m]() : ETIQ[m];
      el.innerHTML = `
      <p class="hint" id="ia_estado"><strong>${et}</strong></p>
      <div class="aviso" style="background:#eef7f3;border-color:#bfe3d4;color:#1c4a3b">La IA solo interpreta los resultados que ves en las otras pestañas; no hace los cálculos y no emite diagnósticos. Se envían al servicio de IA únicamente esos resultados (sin nombres ni datos personales). La decisión clínica es del médico veterinario.</div>
      <details style="margin-top:10px"><summary>Ver qué información recibirá la IA</summary><pre id="ia_ctx" style="white-space:pre-wrap;font-size:.8rem"></pre></details>
      <div style="margin:10px 0;display:flex;flex-wrap:wrap;gap:6px" id="ia_chips">${(cfg.sugerencias || []).map(s => `<button class="sec" type="button">${esc(s)}</button>`).join('')}</div>
      <div id="ia_chat" style="margin:8px 0"></div>
      <div class="row" style="grid-template-columns:1fr auto;align-items:end"><div><label>Tu pregunta sobre los resultados</label><textarea id="ia_q" style="min-height:56px" placeholder="Ej: ¿Qué podría explicar los días abiertos altos?"></textarea></div><div><button class="go" id="ia_send">Preguntar</button></div></div>
      <details style="margin-top:10px"><summary>⚙️ Usar mi propia llave de API (Anthropic)</summary>
        <div class="row"><div><label>Llave de API</label><input type="password" id="ia_key" placeholder="sk-ant-..." autocomplete="off"></div>
        <div><label>Modelo</label><input id="ia_mod" value="${esc(modelo())}"></div></div>
        <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="ia_rec" style="width:auto"> Recordar en este navegador (no recomendado en equipos compartidos)</label>
        <p class="hint">Tu llave se usa solo desde tu navegador para llamar directamente al servicio de IA; este sitio no la recibe ni la guarda en servidores. Tú asumes el costo de tus consultas.</p>
        <button class="sec" id="ia_ok" type="button">Usar esta llave</button> <button class="sec" id="ia_quit" type="button">Quitar llave</button></details>`;
      const chat = el.querySelector('#ia_chat');
      msgs.forEach(x => chat.insertAdjacentHTML('beforeend', burbuja(x)));
      el.querySelector('#ia_ctx').textContent = cfg.obtenerContexto() || '(Aún no hay resultados: realiza un cálculo en alguna pestaña.)';
      el.querySelectorAll('#ia_chips button').forEach(b => b.onclick = () => { el.querySelector('#ia_q').value = b.textContent; enviar(); });
      el.querySelector('#ia_send').onclick = enviar;
      el.querySelector('#ia_ok').onclick = () => {
        const k = el.querySelector('#ia_key').value.trim(); if (!k) return;
        llaveSesion = k; if (el.querySelector('#ia_rec').checked) ss(K + '_llave', k);
        ss(K + '_modelo', el.querySelector('#ia_mod').value.trim() || 'claude-haiku-5-5'); pintar();
      };
      el.querySelector('#ia_quit').onclick = () => { llaveSesion = ''; try { localStorage.removeItem(K + '_llave'); } catch (e) { } pintar(); };
    }
    const burbuja = x => `<div style="margin:6px 0;padding:9px 12px;border-radius:10px;background:${x.r === 'u' ? '#e6f6f0' : '#fff'};border:1px solid #dbe5e1"><strong>${x.r === 'u' ? 'Tú' : '🤖 Asistente'}:</strong><br>${esc(x.t).replace(/\n/g, '<br>')}</div>`;
    function agregar(r, t) { msgs.push({ r, t }); const c = el.querySelector('#ia_chat'); if (c) c.insertAdjacentHTML('beforeend', burbuja({ r, t })); }

    async function enviar() {
      const q = el.querySelector('#ia_q').value.trim(); if (!q) return;
      const ctx = cfg.obtenerContexto();
      if (!ctx) { agregar('u', q); agregar('a', 'Primero realiza un cálculo en alguna de las pestañas; así tendré resultados para interpretar.'); el.querySelector('#ia_q').value = ''; return; }
      agregar('u', q); el.querySelector('#ia_q').value = '';
      const m = modo(), btn = el.querySelector('#ia_send'); btn.disabled = true;
      const hist = msgs.slice(0, -1).slice(-6).map(x => ({ role: x.r === 'u' ? 'user' : 'assistant', content: x.t }));
      hist.push({ role: 'user', content: q });
      try {
        let resp;
        if (m === 'propia') {
          const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': llave(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: modelo(), max_tokens: 700, system: cfg.sistema + '\n\nRESULTADOS DE LA HERRAMIENTA:\n' + ctx, messages: hist }) });
          const d = await r.json(); if (!r.ok) throw new Error((d.error && d.error.message) || 'Error ' + r.status);
          resp = d.content.map(c => c.text || '').join('');
        } else if (m === 'cupo') {
          const r = await fetch(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sistema: cfg.sistema, contexto: ctx, mensajes: hist }) });
          if (r.status === 429) { ss(K + '_cupo', JSON.stringify({ f: hoy(), n: LIM })); throw new Error('Se alcanzó el cupo gratuito de hoy.'); }
          const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Error ' + r.status); resp = d.respuesta; sumaCupo();
        } else {
          resp = cfg.reglas(q, ctx);
        }
        agregar('a', resp);
      } catch (e) {
        agregar('a', 'No pude consultar la IA (' + e.message + '). Respuesta básica:\n\n' + cfg.reglas(q, ctx));
      }
      btn.disabled = false;
      const st = el.querySelector('#ia_estado'); if (st) { const mm = modo(); st.innerHTML = '<strong>' + (typeof ETIQ[mm] === 'function' ? ETIQ[mm]() : ETIQ[mm]) + '</strong>'; }
    }
    return { montar: pintar, refrescar: pintar };
  }
  return { crear };
})();

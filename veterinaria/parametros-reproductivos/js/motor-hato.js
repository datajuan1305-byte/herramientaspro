// ═══════════════════════════════════════════════════════════════════════════
//  MOTOR DEL HATO — HerramientasPro Colombia (Fase 2)
//  Matemática y lógica de datos, sin DOM. Depende de motor-reproductivo.js (MR).
//  Modelo: animales[{id, raza, lote, nacimiento, sexo, obs}]
//          eventos[{animal, fecha, tipo, toro, tipoServicio, obs}]
//  Tipos de evento: parto, servicio, dx_pos, dx_neg, aborto, secado, celo, baja
// ═══════════════════════════════════════════════════════════════════════════
const MH = (function () {
  const GEST = 283;

  // ── Fechas ──
  function iso(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) { if (isNaN(v)) return null; return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0'); }
    if (typeof v === 'number') { // serial de Excel
      if (v < 20000 || v > 80000) return null;
      const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim(); let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return chk(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/))) { let y = +m[3]; if (y < 100) y += y > 50 ? 1900 : 2000; return chk(y, +m[2], +m[1]); } // día/mes/año (Colombia)
    return null;
  }
  function chk(y, mo, d) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return null;
    const t = new Date(Date.UTC(y, mo - 1, d)); if (t.getUTCMonth() !== mo - 1) return null;
    return t.toISOString().slice(0, 10);
  }
  const ms = f => Date.parse(f + 'T12:00:00Z');
  const dias = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);
  const suma = (f, n) => new Date(ms(f) + n * 86400000).toISOString().slice(0, 10);
  const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  // ── Normalización de tipos de evento ──
  function normEvento(s) {
    if (s === null || s === undefined) return null;
    const t = String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (!t) return null;
    if (/aborto|perdida|abort/.test(t)) return 'aborto';
    if (/parto|pario|paricion|nacimiento de cria/.test(t)) return 'parto';
    if (/secado|seca\b|secar/.test(t)) return 'secado';
    if (/baja|descarte|venta|vendid|muert|murio|salida/.test(t)) return 'baja';
    if (/(dx|diagn|palpa|eco|prenez|gest).*(\+|pos|prenad|gestan|si\b)|^(positiv|prenad|gestante|preñ)/.test(t) || /^(p|pos|\+)$/.test(t)) return 'dx_pos';
    if (/(dx|diagn|palpa|eco|prenez|gest).*(\-|neg|vacia|no\b)|^(negativ|vacia)/.test(t) || /^(n|neg|-)$/.test(t)) return 'dx_neg';
    if (/servicio|monta|insemin|\bia\b|\bte\b|transfer|cubric/.test(t)) return 'servicio';
    if (/celo|estro/.test(t)) return 'celo';
    return null;
  }

  // ── Validación y limpieza ──
  function limpiar(animalesIn, eventosIn) {
    const problemas = [], animales = [], ids = new Set();
    animalesIn.forEach((a, i) => {
      const id = String(a.id === undefined || a.id === null ? '' : a.id).trim();
      if (!id) { problemas.push(`Animal fila ${i + 2}: sin identificación (omitido)`); return; }
      if (ids.has(id)) { problemas.push(`Animal ${id}: identificación repetida (se conserva la primera)`); return; }
      ids.add(id);
      const nac = iso(a.nacimiento);
      if (a.nacimiento && !nac) problemas.push(`Animal ${id}: fecha de nacimiento no válida`);
      animales.push({ id, raza: (a.raza || '').toString().trim(), lote: (a.lote || '').toString().trim(), nacimiento: nac, sexo: (a.sexo || 'H').toString().trim(), obs: a.obs || '' });
    });
    const eventos = [], dup = new Set();
    eventosIn.forEach((e, i) => {
      const id = String(e.animal === undefined || e.animal === null ? '' : e.animal).trim();
      const f = iso(e.fecha), t = e.tipo && ['parto', 'servicio', 'dx_pos', 'dx_neg', 'aborto', 'secado', 'celo', 'baja'].includes(e.tipo) ? e.tipo : normEvento(e.tipo);
      if (!id) { problemas.push(`Evento fila ${i + 2}: sin animal (omitido)`); return; }
      if (!f) { problemas.push(`Evento fila ${i + 2} (${id}): fecha no válida (omitido)`); return; }
      if (!t) { problemas.push(`Evento fila ${i + 2} (${id}): tipo de evento no reconocido "${e.tipo}" (omitido)`); return; }
      if (f > hoyISO()) problemas.push(`Evento ${t} de ${id} con fecha futura (${f}): se conserva, revisa`);
      const k = id + '|' + f + '|' + t; if (dup.has(k)) { problemas.push(`Evento repetido ${t} de ${id} el ${f} (omitido)`); return; } dup.add(k);
      if (!ids.has(id)) { ids.add(id); animales.push({ id, raza: '', lote: '', nacimiento: null, sexo: 'H', obs: '' }); problemas.push(`Animal ${id}: aparece en eventos pero no en animales (creado vacío)`); }
      eventos.push({ animal: id, fecha: f, tipo: t, toro: (e.toro || '').toString().trim(), tipoServicio: (e.tipoServicio || '').toString().trim(), obs: e.obs || '' });
    });
    return { animales, eventos, problemas };
  }

  // ── Análisis por animal ──
  function analizar(animales, eventos, opts) {
    opts = opts || {}; const hoy = opts.hoy || hoyISO(), gest = opts.gest || GEST;
    const porAnimal = {}; eventos.forEach(e => (porAnimal[e.animal] = porAnimal[e.animal] || []).push(e));
    const orden = { parto: 0, aborto: 1, secado: 2, dx_pos: 3, dx_neg: 3, celo: 4, servicio: 5, baja: 9 };
    const resultados = [], servicios = [], ciclos = [];
    animales.forEach(a => {
      const ev = (porAnimal[a.id] || []).slice().sort((x, y) => x.fecha < y.fecha ? -1 : x.fecha > y.fecha ? 1 : orden[x.tipo] - orden[y.tipo]);
      const partos = ev.filter(e => e.tipo === 'parto').map(e => e.fecha);
      const baja = ev.find(e => e.tipo === 'baja');
      const fin = baja ? baja.fecha : null;
      // Servicios y su resultado
      const sv = ev.filter(e => e.tipo === 'servicio');
      sv.forEach((s, i) => {
        const sig = sv[i + 1] ? sv[i + 1].fecha : null;
        const lim = sig || '9999-12-31';
        const dxp = ev.find(e => e.tipo === 'dx_pos' && e.fecha > s.fecha && e.fecha < lim) || ev.find(e => e.tipo === 'dx_pos' && e.fecha > s.fecha && e.fecha <= lim && !sig);
        const dxn = ev.find(e => e.tipo === 'dx_neg' && e.fecha > s.fecha && e.fecha < lim);
        const partoPost = partos.find(p => p > s.fecha && dias(s.fecha, p) >= 255 && dias(s.fecha, p) <= 305);
        let r;
        if (dxp || (partoPost && !dxn && (!sig || sig > partoPost))) r = 'exito';
        else if (dxn || sig) r = 'fallo';
        else if (dias(s.fecha, hoy) < 60 && !fin) r = 'pendiente';
        else r = 'sin_resultado';
        s._r = r;
      });
      // Ciclos: cada parto abre un ciclo; antes del primer parto es la etapa de novilla (ciclo 0)
      const marcas = [null].concat(partos);
      marcas.forEach((pf, idx) => {
        const ini = pf, sigP = marcas[idx + 1] || null;
        const sc = sv.filter(s => (ini === null || s.fecha > ini) && (sigP === null || s.fecha < sigP));
        const exito = sc.find(s => s._r === 'exito');
        if (idx === 0) { return; }
        const nP = idx; // número de parto de la vaca que abre este ciclo
        const abierto = !sigP && !exito;
        const censura = fin ? dias(ini, fin) : dias(ini, hoy);
        const cic = { animal: a.id, lote: a.lote, raza: a.raza, nParto: nP, fechaParto: ini, mesParto: ini.slice(0, 7),
          diasPrimerServ: sc.length ? dias(ini, sc[0].fecha) : null,
          concebido: !!exito, diasAbiertos: exito ? dias(ini, exito.fecha) : null,
          sc: exito ? sc.indexOf(exito) + 1 : null, nServicios: sc.length,
          iep: sigP ? dias(ini, sigP) : null, abierto, tiempoKM: exito ? dias(ini, exito.fecha) : Math.max(0, censura) };
        if (cic.diasAbiertos !== null && cic.diasAbiertos < 0) cic.diasAbiertos = null;
        ciclos.push(cic);
      });
      sv.forEach((s) => {
        const cicloIdx = partos.filter(p => p < s.fecha).length; // 0 = antes del 1.er parto
        const prev = sv.filter(x => x.fecha < s.fecha && (cicloIdx === 0 ? true : x.fecha > partos[cicloIdx - 1]));
        servicios.push({ animal: a.id, lote: a.lote, raza: a.raza, fecha: s.fecha, mes: s.fecha.slice(0, 7), anio: s.fecha.slice(0, 4), toro: s.toro || '(sin dato)', tipoServicio: s.tipoServicio || '(sin dato)', nParto: cicloIdx, nServ: prev.length + 1, resultado: s._r });
      });
      // Estado actual
      let estado = 'novilla', detalle = '', diasPos = null, partoEsp = null, ultimoServ = sv.length ? sv[sv.length - 1] : null;
      const ultParto = partos.length ? partos[partos.length - 1] : null;
      const ultAb = ev.filter(e => e.tipo === 'aborto').pop();
      const gestSv = sv.slice().reverse().find(s => s._r === 'exito' && (!ultParto || s.fecha > ultParto) && !(ultAb && ultAb.fecha > s.fecha));
      const secado = ultParto || true ? ev.filter(e => e.tipo === 'secado').pop() : null;
      if (baja) estado = 'baja';
      else if (gestSv && !partos.find(p => p > gestSv.fecha)) {
        partoEsp = suma(gestSv.fecha, gest);
        estado = secado && secado.fecha > gestSv.fecha ? 'seca' : 'gestante';
      } else if (ultParto) {
        diasPos = dias(ultParto, hoy);
        const pend = sv.filter(s => s.fecha > ultParto && s._r === 'pendiente').pop();
        const sinDx = ultimoServ && ultimoServ.fecha > ultParto && ultimoServ._r !== 'fallo' && ultimoServ._r !== 'exito' ? ultimoServ : null;
        estado = pend || (sinDx && dias(sinDx.fecha, hoy) < 90) ? 'servida' : 'vacia';
      } else if (ultimoServ) {
        estado = ultimoServ._r === 'pendiente' ? 'servida' : 'novilla';
      }
      if (ultParto && estado !== 'gestante' && estado !== 'seca' && estado !== 'baja') diasPos = dias(ultParto, hoy);
      const edadMeses = a.nacimiento ? dias(a.nacimiento, hoy) / 30.4375 : null;
      const epp = a.nacimiento && partos.length ? dias(a.nacimiento, partos[0]) / 30.4375 : null;
      const primerSvNov = a.nacimiento ? sv.find(s => !partos.length || s.fecha < partos[0]) : null;
      const eps = a.nacimiento && primerSvNov ? dias(a.nacimiento, primerSvNov.fecha) / 30.4375 : null;
      const abortos = ev.filter(e => e.tipo === 'aborto').length;
      resultados.push({ id: a.id, raza: a.raza, lote: a.lote, nacimiento: a.nacimiento, estado, nPartos: partos.length, ultimoParto: ultParto, diasPosparto: diasPos,
        ultimoServicio: ultimoServ ? ultimoServ.fecha : null, ultimoToro: ultimoServ ? ultimoServ.toro : '', partoEsperado: partoEsp,
        edadMeses, epp, eps, abortos, nServiciosTotal: sv.length, nEventos: ev.length, secado: secado ? secado.fecha : null });
    });
    // IEP por parto (a partir de partos consecutivos)
    return { animales: resultados, servicios, ciclos, hoy };
  }

  // ── Indicadores del hato ──
  function indicadores(an) {
    const sv = an.servicios.filter(s => s.resultado === 'exito' || s.resultado === 'fallo');
    const sv1 = sv.filter(s => s.nServ === 1 && s.nParto > 0);
    const cc = an.ciclos;
    const num = a => a.filter(v => v !== null && v !== undefined && isFinite(v));
    const preneces = an.servicios.filter(s => s.resultado === 'exito').length;
    const abortos = an.animales.reduce((s, a) => s + a.abortos, 0);
    return {
      conc: { x: sv.filter(s => s.resultado === 'exito').length, n: sv.length },
      conc1: { x: sv1.filter(s => s.resultado === 'exito').length, n: sv1.length },
      perd: { x: Math.min(abortos, preneces), n: preneces },
      iep: num(cc.map(c => c.iep)),
      ab: num(cc.filter(c => c.concebido).map(c => c.diasAbiertos)),
      sc: num(cc.map(c => c.sc)),
      epp: num(an.animales.map(a => a.epp)),
      eps: num(an.animales.map(a => a.eps)),
      dpps: num(cc.map(c => c.diasPrimerServ)),
      estados: an.animales.reduce((o, a) => (o[a.estado] = (o[a.estado] || 0) + 1, o), {})
    };
  }

  // ── Alertas ──
  function alertas(an, ref) {
    ref = ref || {}; const hoy = an.hoy, refAb = ref.ref_ab || 120, out = [];
    const add = (tipo, a, txt, prio) => out.push({ tipo, animal: a.id, lote: a.lote, texto: txt, prio });
    an.animales.forEach(a => {
      if (a.estado === 'vacia' && a.diasPosparto !== null) {
        if (a.diasPosparto > refAb) add('abiertos', a, `${a.diasPosparto} días posparto sin gestación confirmada (límite ${refAb})`, 1);
        else if (a.diasPosparto > 90 && !a.ultimoServicio) add('sin_servicio', a, `${a.diasPosparto} días posparto y sin servicio registrado`, 2);
        else if (a.diasPosparto > 90 && a.ultimoServicio && a.ultimoServicio < a.ultimoParto) add('sin_servicio', a, `${a.diasPosparto} días posparto y sin servicio registrado`, 2);
      }
      if (a.estado === 'servida' && a.ultimoServicio) {
        const d = dias(a.ultimoServicio, hoy);
        if (d >= 35 && d < 90) add('diagnostico', a, `Servida hace ${d} días: programar diagnóstico de gestación`, 2);
      }
      if ((a.estado === 'gestante' || a.estado === 'seca') && a.partoEsperado) {
        const f = dias(hoy, a.partoEsperado);
        if (f >= -15 && f <= 30) add('parto', a, f >= 0 ? `Parto esperado en ${f} días (${a.partoEsperado})` : `Parto esperado hace ${-f} días (${a.partoEsperado}): verificar`, f < 0 ? 1 : 2);
        if (f > 15 && f <= 75 && a.estado === 'gestante') { const sec = suma(a.partoEsperado, -60), fs = dias(hoy, sec); if (fs >= -7 && fs <= 15) add('secado', a, fs >= 0 ? `Secado sugerido en ${fs} días (${sec}) si es lechera` : `Secado sugerido vencido hace ${-fs} días`, 3); }
        if (f < -15) add('revisar', a, `Gestante con parto esperado ${a.partoEsperado} ya vencido hace ${-f} días: revisar registros`, 1);
      }
      if (a.nPartos === 0 && a.eps === null && a.edadMeses !== null && a.edadMeses > (ref.ref_eps || 24) && a.estado === 'novilla') add('novilla', a, `Novilla de ${Math.round(a.edadMeses)} meses sin servicio registrado (referencia ${ref.ref_eps || 24})`, 3);
    });
    const rep = {};
    an.ciclos.filter(c => c.abierto && c.nServicios >= 3).forEach(c => { rep[c.animal] = c; });
    Object.values(rep).forEach(c => { const a = an.animales.find(x => x.id === c.animal); if (a && a.estado !== 'baja') add('repetidora', a, `${c.nServicios} servicios en este ciclo sin gestación confirmada: evaluar causa`, 1); });
    return out.sort((x, y) => x.prio - y.prio || x.animal.localeCompare(y.animal));
  }

  // ── Estadística de grupos ──
  function agrupar(registros, campo) {
    const g = {}; registros.forEach(r => { let k = r[campo]; if (k === '' || k === undefined || k === null) k = '(sin dato)'; if (campo === 'nParto') k = k >= 4 ? '4+' : String(k); (g[k] = g[k] || []).push(r); });
    return g;
  }
  function propPorGrupo(registros, campo, conf) {
    const g = agrupar(registros.filter(s => s.resultado === 'exito' || s.resultado === 'fallo'), campo), out = [];
    Object.keys(g).sort().forEach(k => { const x = g[k].filter(s => s.resultado === 'exito').length, n = g[k].length, w = MR.wilson(x, n, conf || 0.95); out.push({ grupo: k, x, n, p: w.p, inf: w.inf, sup: w.sup }); });
    return out;
  }
  function mediaPorGrupo(registros, variable, campo, conf) {
    const g = agrupar(registros.filter(r => r[variable] !== null && r[variable] !== undefined && isFinite(r[variable])), campo), out = [];
    Object.keys(g).sort().forEach(k => {
      const v = g[k].map(r => r[variable]), n = v.length, m = MR.media(v), s = n > 1 ? MR.desv(v) : NaN;
      const tc = n > 1 ? MR.invT(1 - (1 - (conf || 0.95)) / 2, n - 1) : NaN, h = tc * s / Math.sqrt(n);
      out.push({ grupo: k, n, media: m, sd: s, inf: n > 1 ? m - h : NaN, sup: n > 1 ? m + h : NaN, valores: v });
    });
    return out;
  }
  function anovaUnaVia(grupos) { // grupos: arrays de números
    const gs = grupos.filter(g => g.length > 0), k = gs.length, N = gs.reduce((s, g) => s + g.length, 0);
    if (k < 2 || N - k < 1) return null;
    const gm = gs.reduce((s, g) => s + g.reduce((a, b) => a + b, 0), 0) / N;
    let ssb = 0, ssw = 0; gs.forEach(g => { const m = MR.media(g); ssb += g.length * (m - gm) ** 2; ssw += g.reduce((s, v) => s + (v - m) ** 2, 0); });
    const d1 = k - 1, d2 = N - k; if (ssw === 0) return { F: Infinity, df1: d1, df2: d2, p: 0, eta2: 1 };
    const F = (ssb / d1) / (ssw / d2), p = MR.betaInc(d2 / (d2 + d1 * F), d2 / 2, d1 / 2);
    return { F, df1: d1, df2: d2, p, eta2: ssb / (ssb + ssw) };
  }
  // ji-cuadrado de homogeneidad de proporciones (>2 grupos), p por gamma incompleta
  function gammaP(a, x) { // regularizada inferior
    if (x <= 0) return 0;
    if (x < a + 1) { let ap = a, del = 1 / a, sum = del; for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-14) break; } return sum * Math.exp(-x + a * Math.log(x) - MR.logGamma(a)); }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; for (let i = 1; i <= 500; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-14) break; }
    return 1 - Math.exp(-x + a * Math.log(x) - MR.logGamma(a)) * h;
  }
  function chi2Proporciones(grupos) { // [{x,n}]
    const g = grupos.filter(o => o.n > 0), X = g.reduce((s, o) => s + o.x, 0), N = g.reduce((s, o) => s + o.n, 0), p = X / N;
    if (g.length < 2 || p === 0 || p === 1) return null;
    let chi = 0, minE = Infinity; g.forEach(o => { [[o.x, o.n * p], [o.n - o.x, o.n * (1 - p)]].forEach(([ob, e]) => { chi += (ob - e) ** 2 / e; minE = Math.min(minE, e); }); });
    const df = g.length - 1; return { chi2: chi, df, p: 1 - gammaP(df / 2, chi / 2), minEsperado: minE };
  }

  // ── Curva de preñez posparto (Kaplan-Meier sobre "tiempo hasta concebir") ──
  function curvaKM(ciclos) {
    const dat = ciclos.filter(c => c.tiempoKM !== null && isFinite(c.tiempoKM) && c.tiempoKM >= 0).map(c => ({ t: c.tiempoKM, e: c.concebido ? 1 : 0 }));
    if (!dat.length) return { puntos: [], mediana: null, n: 0 };
    const tiempos = [...new Set(dat.filter(d => d.e).map(d => d.t))].sort((a, b) => a - b);
    let S = 1; const pts = [{ t: 0, abierta: 1, prenada: 0 }];
    tiempos.forEach(t => { const nRiesgo = dat.filter(d => d.t >= t).length, ev = dat.filter(d => d.t === t && d.e).length; S *= (1 - ev / nRiesgo); pts.push({ t, abierta: S, prenada: 1 - S, nRiesgo }); });
    const m = pts.find(p => p.abierta <= 0.5);
    return { puntos: pts, mediana: m ? m.t : null, n: dat.length, eventos: dat.filter(d => d.e).length };
  }

  // ── Histograma ──
  function histograma(v, ancho, min0) {
    if (!v.length) return { etiquetas: [], cuentas: [], bins: [] };
    const mn = min0 !== undefined ? min0 : Math.floor(Math.min(...v) / ancho) * ancho, mx = Math.max(...v);
    const nb = Math.max(1, Math.floor((mx - mn) / ancho) + 1), c = new Array(nb).fill(0);
    v.forEach(x => { c[Math.min(nb - 1, Math.floor((x - mn) / ancho))]++; });
    return { etiquetas: c.map((_, i) => `${mn + i * ancho}–${mn + (i + 1) * ancho - 1}`), cuentas: c, bins: c.map((_, i) => mn + i * ancho) };
  }

  // ── Datos de ejemplo (SIMULADOS) ──
  function ejemplo(n, semilla) {
    let s = semilla || 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const hoy = hoyISO(), razas = ['Holstein', 'Jersey', 'Cebú x Holstein', 'Normando'], lotes = ['Lote A', 'Lote B', 'Lote C'], toros = ['Toro 101', 'Toro 102', 'Toro 103', 'Pajilla X'];
    const animales = [], eventos = [];
    for (let i = 1; i <= (n || 60); i++) {
      const id = 'V' + String(i).padStart(3, '0'), lote = lotes[Math.floor(rnd() * 3)], raza = razas[Math.floor(rnd() * 4)];
      const edadDias = Math.round(900 + rnd() * 2600), nac = suma(hoy, -edadDias);
      animales.push({ id, raza, lote, nacimiento: nac, sexo: 'H' });
      let f = suma(nac, Math.round(24 * 30.4 + gauss() * 120)); // primer servicio ~24 m
      const pc = lote === 'Lote C' ? 0.38 : 0.52; let nPartosMax = 0;
      let cursor = f, primero = true, guard = 0;
      while (cursor < suma(hoy, -20) && guard++ < 40) {
        const toro = toros[Math.floor(rnd() * 4)]; eventos.push({ animal: id, fecha: cursor, tipo: 'servicio', toro, tipoServicio: toro.startsWith('Pajilla') || rnd() < .6 ? 'IA' : 'Monta' });
        const pasa = rnd() < (pc + (toro === 'Toro 103' ? -0.1 : 0));
        if (pasa) {
          const dx = suma(cursor, 45 + Math.round(rnd() * 10)); if (dx < hoy) eventos.push({ animal: id, fecha: dx, tipo: 'dx_pos' });
          if (rnd() < 0.04) { const fa = suma(cursor, 120 + Math.round(rnd() * 60)); if (fa >= hoy) break; eventos.push({ animal: id, fecha: fa, tipo: 'aborto' }); cursor = suma(cursor, 180 + Math.round(rnd() * 20)); continue; }
          const parto = suma(cursor, 283 + Math.round(gauss() * 5)); if (parto > hoy) break;
          eventos.push({ animal: id, fecha: parto, tipo: 'parto' }); nPartosMax++;
          const espera = Math.round(55 + Math.abs(gauss()) * 55 + (lote === 'Lote C' ? 25 : 0));
          cursor = suma(parto, espera);
        } else {
          const dx = suma(cursor, 45); if (dx < hoy && rnd() < .5) eventos.push({ animal: id, fecha: dx, tipo: 'dx_neg' });
          cursor = suma(cursor, 21 * (1 + Math.floor(rnd() * 2)));
        }
        primero = false;
      }
    }
    return { animales, eventos };
  }

  return { iso, dias, suma, hoyISO, normEvento, limpiar, analizar, indicadores, alertas, agrupar, propPorGrupo, mediaPorGrupo, anovaUnaVia, chi2Proporciones, curvaKM, histograma, ejemplo, GEST };
})();
if (typeof module !== 'undefined') module.exports = MH;

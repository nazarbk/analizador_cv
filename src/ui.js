(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const D = window.CVData, E = window.CVEngine, T = window.CVTemplate;
  const BUILD = window.CV_BUILD || 'artifact';
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem('cva:' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('cva:' + k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem('cva:' + k); } catch (e) { /* almacenamiento no disponible */ } }
  };
  const state = { text: '', meta: {}, r: null, edit: null, sample: true, tpl: { style: '', lang: '' }, trans: {}, dv: 'orig', match: null, versions: [], cmp: null, label: '' };
  const MAX_OFFERS = 5, MAX_VERSIONS = 6;
  const STATUS = { ok: 'Correcto', warn: 'Mejorable', bad: 'Crítico', info: 'Nota' };
  // Descargas: en la versión autoalojada con un enlace normal; en el artifact, mediante la capacidad «downloads» (el visitante confirma cada descarga)
  let DL = null;
  if (BUILD === 'selfhost') DL = async (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  else if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(d => {
      if (!d) return;
      DL = async (blob, name) => {
        try { await d.save({ filename: name, data: blob }); toast('Descarga lista'); }
        catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'Espera un momento y vuelve a intentarlo' : 'La descarga no está disponible aquí'); }
      };
      if (state.r) renderPlantilla();
    }).catch(() => {});
  }
  const VIEWS = ['resumen', 'ats', 'ofertas', 'pro', 'experiencia', 'formato', 'cambios', 'datos', 'plantilla', 'versiones', 'privacidad'];

  // ---------- utilidades de interfaz ----------
  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }
  function copyText(text, el) {
    const done = () => toast('Copiado');
    const fallback = () => {
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) { el.focus(); el.select(); }
      try { if (document.execCommand('copy')) { done(); return; } } catch (e) { /* sin execCommand */ }
      toast('Selecciona el texto y cópialo con Ctrl+C');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  function setStatus(msg, cls) { const s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (cls ? ' ' + cls : ''); }
  const checkLi = c => '<li class="check s-' + c.status + '"><span class="pill ' + c.status + '">' + STATUS[c.status] + '</span><div><strong>' + h(c.title) + '</strong>' + (c.detail ? '<p>' + h(c.detail) + '</p>' : '') + (c.fix && c.status !== 'ok' ? '<p class="fix">' + h(c.fix) + '</p>' : '') + '</div></li>';
  const checksOf = (cats, filter) => state.r.checks.filter(c => cats.includes(c.cat) && (!filter || filter(c)));
  const checkList = arr => arr.length ? '<ul class="checks">' + arr.sort((a, b) => ({ bad: 0, warn: 1, info: 2, ok: 3 }[a.status] - { bad: 0, warn: 1, info: 2, ok: 3 }[b.status])).map(checkLi).join('') + '</ul>' : '<p class="muted">Sin observaciones.</p>';
  const gradeWord = n => n >= 85 ? 'Muy sólido' : n >= 70 ? 'Competitivo' : n >= 55 ? 'Mejorable' : 'Necesita trabajo';
  const barCls = n => n >= 75 ? '' : n >= 50 ? 'mid' : 'low';

  // ---------- selectores ----------
  function fillSelects() {
    const cs = $('#country');
    const entries = Object.entries(D.COUNTRIES).sort((a, b) => a[0] === 'ES' ? -1 : b[0] === 'ES' ? 1 : a[1].name.localeCompare(b[1].name, 'es'));
    cs.innerHTML = entries.map(([k, v]) => '<option value="' + k + '">' + h(v.name) + ' (+' + v.dial + ')</option>').join('');
    $('#company').innerHTML = Object.entries(D.COMPANY_TYPES).map(([k, v]) => '<option value="' + k + '">' + h(v.name) + '</option>').join('');
    cs.value = D.COUNTRIES[store.get('country')] ? store.get('country') : 'ES';
    $('#company').value = D.COMPANY_TYPES[store.get('company')] ? store.get('company') : 'general';
  }

  // ---------- análisis ----------
  function getOffers() { return [$('#offer')].concat($$('#moreOffers textarea')).map(t => t.value.trim()).filter(v => v.length >= 60); }
  function currentOpts() { return { country: $('#country').value, company: $('#company').value, offer: getOffers()[0] || '' }; }
  function run(resetEdit) {
    const opts = currentOpts();
    state.r = E.analyze({ text: state.text, meta: state.meta, opts });
    const offers = getOffers();
    state.match = offers.length ? E.matchOffers(state.text, offers) : null;
    if (resetEdit || !state.edit) { state.edit = editFrom(state.r); state.trans = {}; state.dv = 'orig'; }
    if (state.trans[state.r.lang]) { delete state.trans[state.r.lang]; state.dv = 'orig'; }
    if (resetEdit || !state.tpl.style) state.tpl.style = state.r.templates.find(t => ['cronologico', 'resume_us', 'lebenslauf', 'europass', 'hibrido'].includes(t.key)).key;
    if (resetEdit || !state.tpl.lang) state.tpl.lang = ['es', 'en', 'de', 'fr', 'it', 'pt'].includes(state.r.lang) ? state.r.lang : 'es';
    render();
    scheduleSave();
  }
  function editFrom(r) {
    const d = r.data;
    const N = E._internals.norm;
    const listed = d.listedSkills.filter((x, i) => d.listedSkills.findIndex(y => N(y) === N(x)) === i);
    const skills = listed.concat(d.skills.filter(sk => !listed.some(l => N(l).includes(N(sk)) || N(sk).includes(N(l)))));
    return {
      name: d.name, headline: d.headline, email: d.email, phone: d.phone, location: d.location, linkedin: d.linkedin, web: d.github || d.links[0] || '',
      summary: d.summary, draft: d.draftSummary,
      exp: d.experience.map(e => ({ title: e.title, company: e.company, location: e.location, start: e.start, end: e.end, desc: e.bullets.map(b => '• ' + b).join('\n') })),
      edu: d.education.map(e => ({ degree: e.degree, institution: e.institution, location: e.location, start: e.start, end: e.end })),
      skills: skills.join(', '), soft: d.softSkills.join(', '),
      langs: d.languages.map(l => ({ name: l.name, level: l.level })),
      certs: d.certifications.join('\n'), courses: d.courses.join('\n'), interests: d.interests.join(', '), driving: d.driving,
      projects: (d.projects || []).map(p => ({ name: p.name || '', url: p.url || '', period: p.period || '', desc: p.desc || '', tools: p.tools || '' }))
    };
  }

  function render() {
    $('#sampleBanner').hidden = !state.sample;
    $('#notCvBanner').hidden = state.sample || !state.r || !state.r.doc || !['not_cv', 'doubt'].includes(state.r.doc.verdict);
    renderScore(); renderResumen(); renderAts(); renderOfertas(); renderExp(); renderFormato(); renderCambios(); renderDatos(); renderPlantilla(); renderVersiones(); renderPro();
    renderNav(); renderDoc();
  }
  // insignias del índice: puntuación del apartado o número de elementos
  function badge(view, text, cls, title) {
    const b = $('[data-badge="' + view + '"]'); if (!b) return;
    b.textContent = text == null ? '' : String(text); b.className = 'badge' + (cls ? ' ' + cls : ''); b.hidden = text == null || text === '';
    if (title) b.title = title; else b.removeAttribute('title');
  }
  const scoreCls = n => n >= 75 ? 'good' : n >= 50 ? 'mid' : 'low';
  function renderNav() {
    const r = state.r, sc = r.scores;
    const bad = r.checks.filter(c => c.status === 'bad').length;
    badge('resumen', bad || null, 'low', bad + ' problemas críticos');
    badge('ats', sc.ats, scoreCls(sc.ats), 'Puntuación ATS e IA');
    badge('experiencia', sc.content, scoreCls(sc.content), 'Puntuación de contenido');
    const fmt = Math.round((sc.structure + sc.coherence + sc.country + sc.contact) / 4);
    badge('formato', fmt, scoreCls(fmt), 'Estructura, coherencia, contacto y país');
    const pend = r.remove.length + r.add.length;
    badge('cambios', pend || null, 'n', pend + ' cambios sugeridos');
    badge('ofertas', state.match ? state.match.offers.length + (state.match.offers.length === 1 ? ' oferta' : ' ofertas') : null, 'n');
    badge('versiones', state.versions.length || null, 'n', state.versions.length + ' versiones');
    { const n = creditsLeft(); badge('pro', PRO.available ? (n ? n + (n === 1 ? ' informe' : ' informes') : PRO.price) : null, 'price', n ? 'Informes Pro disponibles' : 'Informe de pago'); }
    $('#offerCount').textContent = state.match ? state.match.offers.length : '';
    $('#offerCount').hidden = !state.match;
  }
  function renderDoc() {
    const m = state.r.meta;
    $('#docName').textContent = state.sample ? 'CV de ejemplo (ficticio)' : (m.fileName || state.label || 'Texto pegado');
    $('#docMeta').textContent = [m.fileType && m.fileType !== 'txt' ? m.fileType.toUpperCase() : (state.sample ? '' : 'Texto'), m.pages ? m.pages + (m.pages === 1 ? ' página' : ' páginas') : '', state.r.words + ' palabras'].filter(Boolean).join(' · ');
  }

  function renderScore() {
    const r = state.r;
    const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const bars = Object.keys(r.weights).map(k => '<span>' + h(r.scoreLabels[k]) + '</span><div class="bar" role="img" aria-label="' + h(r.scoreLabels[k]) + ': ' + r.scores[k] + ' de 100"><i class="' + barCls(r.scores[k]) + '" style="width:' + r.scores[k] + '%"></i></div><span class="n">' + r.scores[k] + '</span>').join('');
    const m = r.meta;
    const facts = [
      ['Experiencia', r.totalYears ? r.totalYears.toLocaleString('es-ES') + ' años' : '—'],
      ['Puestos', r.data.experience.length],
      ['Palabras', r.words],
      ['Páginas', m.pages || '—'],
      ['Idioma del CV', { es: 'Español', en: 'Inglés', de: 'Alemán', fr: 'Francés', it: 'Italiano', pt: 'Portugués' }[r.lang] || '—'],
      ['Perfil', r.familyLabel.charAt(0).toUpperCase() + r.familyLabel.slice(1)]
    ].map(([k, v]) => '<div class="fact"><span class="label">' + k + '</span><b>' + h(v) + '</b></div>').join('');
    const nb = r.checks.filter(c => c.status === 'bad').length, nw = r.checks.filter(c => c.status === 'warn').length;
    $('#scoreboard').innerHTML = '<span class="label">Puntuación global</span><div class="big num">' + r.total + '<small>/100</small></div><div class="word">' + gradeWord(r.total) + '</div>' +
      '<div class="meter" role="img" aria-label="' + r.total + ' de 100"><i class="' + barCls(r.total) + '" style="width:' + r.total + '%"></i></div>' +
      '<div class="counts"><span><b class="num">' + nb + '</b> críticos</span><span><b class="num">' + nw + '</b> mejorables</span></div>' +
      '<div class="ctx">' + h(r.country.name) + ' · ' + h(r.company.name) + (r.offer ? ' · con oferta' : '') + '<br>' + today + '</div>';
    state.summaryHtml = '<div class="sheet"><h3>Puntuación por categoría</h3><div class="bars">' + bars + '</div><div class="facts">' + facts + '</div></div>';
  }

  function renderResumen() {
    const r = state.r;
    const strong = r.strengths.slice(0, 9).map(s => '<li>' + h(s.text) + '</li>').join('') || '<li>Aún no se detectan puntos fuertes claros.</li>';
    const weak = r.weaknesses.slice(0, 9).map(c => '<li class="' + (c.status === 'warn' ? 'w' : '') + '">' + h(c.title) + '</li>').join('') || '<li>No se detectan problemas relevantes.</li>';
    const prio = r.weaknesses.filter(c => c.fix).slice(0, 5).map(c => '<li><div><strong>' + h(c.title) + '</strong><p>' + h(c.fix) + '</p></div></li>').join('');
    $('#v-resumen').innerHTML = state.summaryHtml +
      '<div class="cols"><div class="sheet"><h3>Puntos fuertes</h3><ul class="strong-list">' + strong + '</ul></div>' +
      '<div class="sheet"><h3>Puntos débiles</h3><ul class="strong-list weak">' + weak + '</ul>' + (r.weaknesses.length > 9 ? '<p class="small muted">Y ' + (r.weaknesses.length - 9) + ' más en las demás secciones.</p>' : '') + '</div></div>' +
      (prio ? '<div class="sheet"><h3>Por dónde empezar</h3><p class="lede">Los cambios con más impacto, en orden de prioridad.</p><ol class="prio">' + prio + '</ol></div>' : '');
  }

  function extractedPreview() {
    const keys = new Set();
    for (const arr of Object.values(D.SECTIONS)) arr.forEach(t => keys.add(t));
    const lines = state.text.replace(/\r/g, '').split('\n').filter(l => l.trim()).slice(0, 140);
    return lines.map(l => E._internals.headingOf(l.trim()) ? '<span class="h">' + h(l) + '</span>' : h(l)).join('\n');
  }

  function renderAts() {
    const r = state.r;
    let html = '<div class="sheet"><h3>Cómo lo leerá un filtro automático</h3><p class="lede">Los ATS (Workday, SuccessFactors, Taleo, Greenhouse…) extraen el texto, lo clasifican por secciones y lo comparan con la oferta. Los filtros con IA, además, evalúan la coherencia y el contexto de cada competencia. Esto es lo que encuentran en tu CV.</p>' + checkList(checksOf(['ats'])) + '</div>';
    if (r.offer) {
      const o = r.offer;
      const where = k => k.where.length ? '<small>' + k.where.map(w => ({ experience: 'exp.', skills: 'habil.', summary: 'perfil' }[w])).join(', ') + '</small>' : '';
      html += '<div class="sheet"><h3>Coincidencia con la oferta' + (o.title ? ': ' + h(o.title) : '') + '</h3><p class="lede">Resaltadas, las palabras clave que ya aparecen en tu CV (y dónde). Con borde discontinuo, las que faltan. Añade solo las que dominas de verdad.</p>' +
        '<div class="kw">' + o.keywords.map(k => '<span class="chip ' + (k.found ? 'hit' : 'miss') + '">' + h(k.term) + (k.found ? where(k) : '') + '</span>').join('') + '</div>' +
        checkList(checksOf(['offer'])) + '</div>';
    } else html += '<div class="sheet"><h3>Coincidencia con una oferta</h3><p class="lede">Pega una oferta en el panel de la izquierda y pulsa «Analizar CV» para ver qué palabras clave te faltan, si cumples los años de experiencia y los idiomas que pide.</p></div>';
    html += '<div class="sheet"><h3>Texto extraído</h3><p class="lede">Así ve tu CV un programa: texto sin formato. Si algo sale desordenado o falta aquí, un ATS tendrá el mismo problema. Los encabezados reconocidos aparecen en azul.</p><details><summary>Ver el texto extraído (' + r.lines + ' líneas)</summary><pre class="extract">' + extractedPreview() + '</pre></details></div>';
    $('#v-ats').innerHTML = html;
  }

  function renderExp() {
    const r = state.r;
    if (!r.expand.length) { $('#v-experiencia').innerHTML = '<div class="sheet"><h3>Experiencia</h3><p class="lede">No se han podido separar los puestos. Revisa que cada puesto tenga su título, la empresa y las fechas (MM/AAAA – MM/AAAA) en líneas propias, o pega el texto del CV.</p></div>'; return; }
    const html = r.expand.map(x => {
      const issues = x.issues.length ? '<ul class="checks">' + x.issues.map(i => '<li class="check s-' + i.s + '"><span class="pill ' + i.s + '">' + STATUS[i.s] + '</span><div><strong>' + h(i.t) + '</strong></div></li>').join('') + '</ul>' : '<p class="muted small">Puesto bien descrito: verbos de acción y cifras.</p>';
      if (x.old) return '<article class="job"><header><h4>' + h(x.title || 'Puesto') + '</h4><span class="meta">' + h(x.company) + ' · ' + h(x.period) + '</span></header>' + issues + '</article>';
      return '<article class="job"><header><h4>' + h(x.title || 'Puesto sin título') + '</h4><span class="meta">' + h([x.company, x.period].filter(Boolean).join(' · ')) + '</span><span class="tags">' + (x.current ? '<span class="pill ok">Actual</span>' : '') + '<span class="pill">' + h(x.famLabel) + '</span>' + (x.lead ? '<span class="pill">Gestión de equipos</span>' : '') + '</span></header>' + issues +
        '<div><span class="label">Preguntas para sacar cifras</span><ul class="plist small">' + x.prompts.map(p => '<li>' + h(p) + '</li>').join('') + '</ul></div>' +
        (x.rewrites.length ? '<div class="field"><span class="label">Reescritura sugerida</span>' + x.rewrites.map(w => '<div class="rw"><span class="before">' + h(w.before) + '</span><span>' + h(w.hint) + '</span></div>').join('') + '</div>' : '') +
        '<div><span class="label">Modelo de viñeta para este tipo de puesto</span><p class="example">' + h(x.example) + '</p></div>' +
        (x.offerMissing.length ? '<div><span class="label">De la oferta, podrías mostrarlo aquí si lo usaste</span><div class="kw">' + x.offerMissing.map(k => '<span class="chip miss">' + h(k) + '</span>').join('') + '</div></div>' : '') +
        '</article>';
    }).join('');
    $('#v-experiencia').innerHTML = '<div class="sheet"><h3>Cómo ampliar cada puesto</h3><p class="lede">Fórmula que funciona con personas y con filtros: verbo de acción + qué hiciste + resultado medible. Responde a las preguntas de cada puesto y convierte las respuestas en viñetas.</p></div>' + html;
  }

  function renderFormato() {
    const r = state.r, m = r.meta, c = r.country;
    const yn = v => v ? 'Sí' : 'No';
    const ruleWord = v => ({ no: 'No se incluye', opcional: 'Opcional', habitual: 'Habitual' }[v] || v);
    const kv = [
      ['Archivo', (m.fileName || 'Texto pegado') + (m.fileType ? ' · ' + m.fileType.toUpperCase() : '')],
      ['Páginas', m.pages || '—'], ['Tamaño de papel', m.pageSize || '—'], ['Palabras', r.words],
      ['Columnas', m.columns === 'native' ? 'Columnas nativas' : yn(m.columns)], ['Tablas', typeof m.tables === 'number' ? m.tables : '—'], ['Cuadros de texto', typeof m.textBoxes === 'number' ? m.textBoxes : '—'],
      ['Imágenes', (m.images || 0) + (m.photoLikely ? ' (posible foto)' : '')], ['Tipografías', m.fonts || '—'],
      ['Secciones', r.sectionsFound.map(k => D.SECTION_LABELS[k]).join(', ') || '—'],
      ['Formato de fechas', r.stats.dateFormats.join(', ') || '—']
    ].map(([k, v]) => '<dt>' + k + '</dt><dd>' + h(v) + '</dd>').join('');
    const countryKv = [
      ['Nombre del documento', c.doc], ['Foto', ruleWord(c.photo)], ['Fecha de nacimiento', ruleWord(c.dob)], ['Estado civil', ruleWord(c.marital)], ['Nacionalidad', ruleWord(c.nationality)],
      ['Extensión', 'Hasta ' + c.pages + (c.pages === 1 ? ' página' : ' páginas')], ['Papel', c.paper], ['Fechas', c.date], ['Teléfono', c.phone]
    ].map(([k, v]) => '<dt>' + k + '</dt><dd>' + h(v) + '</dd>').join('');
    const tpls = r.templates.map((t, i) => '<li class="tpl"><span class="pill' + (i === 0 ? ' ok' : '') + '">' + (i + 1) + '</span><div><strong>' + h(t.name) + '</strong><p class="small muted">' + h(t.why) + ' ' + h(t.desc) + '</p>' + (['cronologico', 'resume_us', 'lebenslauf', 'europass', 'hibrido'].includes(t.key) ? '<button class="btn small" type="button" data-usetpl="' + t.key + '">Usar en la plantilla</button>' : '') + '</div></li>').join('');
    const table = Object.entries(D.COUNTRIES).map(([k, v]) => '<tr' + (k === c.code ? ' class="here"' : '') + '><td>' + h(v.name) + '</td><td>' + h(v.doc) + '</td><td>' + ruleWord(v.photo) + '</td><td>' + ruleWord(v.dob) + '</td><td class="num">' + v.pages + '</td><td>' + v.paper + '</td><td class="num">' + h(v.phone) + '</td></tr>').join('');
    $('#v-formato').innerHTML =
      '<div class="cols"><div class="sheet"><h3>Ficha técnica del documento</h3><dl class="kv">' + kv + '</dl></div>' +
      '<div class="sheet"><h3>Convenciones en ' + h(c.name) + '</h3><dl class="kv">' + countryKv + '</dl><ul class="plist small">' + c.notes.map(n => '<li>' + h(n) + '</li>').join('') + '</ul></div></div>' +
      '<div class="sheet"><h3>Estructura y extensión</h3>' + checkList(checksOf(['structure'])) + '</div>' +
      '<div class="sheet"><h3>Coherencia</h3><p class="lede">Los filtros con IA cruzan fechas, cifras y titulares. Estas comprobaciones buscan contradicciones dentro del propio CV.</p>' + checkList(checksOf(['coherence'])) + '</div>' +
      '<div class="sheet"><h3>Adaptación a ' + h(c.name) + ' y datos personales</h3>' + checkList(checksOf(['country', 'contact'], x => x.status !== 'ok')) + '</div>' +
      (r.company.tips.length ? '<div class="sheet"><h3>Para ' + h(r.company.name.toLowerCase()) + '</h3><ul class="plist">' + r.company.tips.map(t => '<li>' + h(t) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="sheet"><h3>Formatos recomendados</h3><p class="lede">En orden de preferencia para tu destino y tu perfil.</p><ul class="plist" style="list-style:none;padding:0;gap:14px">' + tpls + '</ul></div>' +
      '<div class="sheet"><h3>Comparativa por país</h3><div class="tablewrap"><table><thead><tr><th>País</th><th>Documento</th><th>Foto</th><th>Edad</th><th>Págs.</th><th>Papel</th><th>Teléfono</th></tr></thead><tbody>' + table + '</tbody></table></div></div>';
    $$('[data-usetpl]').forEach(b => b.addEventListener('click', () => { state.tpl.style = b.dataset.usetpl; renderPlantilla(); go('plantilla'); }));
  }

  function renderCambios() {
    const r = state.r;
    const li = x => '<li class="check s-' + ({ alta: 'bad', media: 'warn', baja: 'info' }[x.prio]) + '"><span class="pill ' + x.prio + '" title="Prioridad ' + x.prio + '">' + x.prio.charAt(0).toUpperCase() + x.prio.slice(1) + '</span><div><strong>' + h(x.what) + '</strong><p>' + h(x.why) + '</p></div></li>';
    const ord = { alta: 0, media: 1, baja: 2 };
    $('#v-cambios').innerHTML =
      '<div class="sheet"><h3>Quitar</h3><p class="lede">Datos redundantes, irrelevantes o que pueden jugar en tu contra, ordenados por prioridad.</p>' + (r.remove.length ? '<ul class="checks">' + r.remove.slice().sort((a, b) => ord[a.prio] - ord[b.prio]).map(li).join('') + '</ul>' : '<p class="muted">No hay nada que sobre.</p>') + '</div>' +
      '<div class="sheet"><h3>Añadir</h3><p class="lede">Información que falta o que ayudaría a pasar filtros y a convencer, ordenada por prioridad.</p>' + (r.add.length ? '<ul class="checks">' + r.add.slice().sort((a, b) => ord[a.prio] - ord[b.prio]).map(li).join('') + '</ul>' : '<p class="muted">No falta nada importante.</p>') + '</div>';
  }

  // ---------- versiones en otro idioma ----------
  const TR = window.CVTranslate;
  const LNAME = { es: 'español', en: 'inglés', de: 'alemán', fr: 'francés', it: 'italiano', pt: 'portugués' };
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
  const origLang = () => state.r.lang in LNAME ? state.r.lang : 'es';
  const altLang = () => origLang() === 'en' ? 'es' : 'en';
  const dictFrom = () => origLang() === 'en' ? 'en' : 'es';
  function dEdit() { return state.dv !== 'orig' && state.trans[state.dv] ? state.trans[state.dv] : state.edit; }
  function tEdit() { return state.tpl.lang !== origLang() && state.trans[state.tpl.lang] ? state.trans[state.tpl.lang] : state.edit; }
  const allVersions = () => [state.edit].concat(Object.values(state.trans));
  function createTrans(lang) {
    if (!state.trans[lang]) state.trans[lang] = TR.create(state.edit, dictFrom(), lang);
    state.dv = lang; state.tpl.lang = lang; scheduleSave();
  }
  // datos que no se traducen: si cambian en una versión, cambian en todas
  const SHARED = /^(name|email|phone|linkedin|web|projects\.\d+\.(url|tools)|exp\.\d+\.company|edu\.\d+\.institution)$/;
  const getPath = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[isNaN(k) ? k : +k], o);

  // ---------- datos para copiar ----------
  let fid = 0, cfPending = new Map();
  const trFrom = () => state.dv === 'es' ? 'en' : 'es';
  const pendCount = n => n ? n + (n === 1 ? ' campo' : ' campos') + ' sin traducir' : 'Todo está traducido';
  function trNote(path, c) {
    if (!c) return '';
    const what = c.words.length ? 'Sin traducir: ' + c.words.slice(0, 6).map(w => '«' + h(w) + '»').join(', ') + (c.words.length > 6 ? ' y ' + (c.words.length - 6) + ' más' : '') : 'Sin traducir: sigue igual que el original';
    return '<span>' + what + '.</span> <button class="linkbtn" type="button" data-keep="' + path + '">Está bien así</button>';
  }
  function cf(label, path, value, opts = {}) {
    const id = 'f' + (++fid);
    const ctl = opts.area ? '<textarea id="' + id + '" rows="' + (opts.rows || 4) + '" data-path="' + path + '">' + h(value) + '</textarea>' : '<input type="text" id="' + id + '" data-path="' + path + '" value="' + h(value) + '">';
    const tr = state.dv !== 'orig' && state.trans[state.dv];
    const scan = tr && TR.scanFields(tr).includes(path);
    const orig = scan ? String(TR.origOf(state.edit, path) || '').trim() : '';
    const pc = scan && cfPending.get(path), pend = !!pc;
    if (scan) opts = Object.assign({}, opts, { after: (opts.after || '') + '<div class="trnote" data-trnote="' + path + '">' + trNote(path, pc) + '</div>' + (orig && (pend || E._internals.norm(orig) !== E._internals.norm(value)) ? '<details class="orig"><summary>Texto original</summary><p>' + h(orig).replace(/\n/g, '<br>') + '</p></details>' : '') });
    return '<div class="cf' + (pend ? ' pending' : '') + '"' + '' + '><label class="label" for="' + id + '">' + h(label) + (pend ? '<span class="pendtag">Sin traducir</span>' : '') + '</label>' + ctl + '<div class="side"><button class="btn small" type="button" data-copy="' + id + '">Copiar</button>' + (opts.count ? '<span class="cc num" data-cc="' + id + '"' + (opts.limit ? ' data-limit="' + opts.limit + '"' : '') + '>' + String(value || '').length + (opts.limit ? '/' + opts.limit : '') + '</span>' : '') + '</div>' + (opts.after || '') + '</div>';
  }
  function urlHint(v) {
    const u = String(v || '').trim();
    if (!u) return ['', 'Recomendable: un enlace que se pueda abrir y comprobar.'];
    if (/\s/.test(u) || !/^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(u)) return ['bad', 'No parece una dirección web válida. Ejemplo: github.com/usuario/proyecto'];
    if (/^(https?:\/\/)?(localhost|127\.|192\.168\.|10\.)/i.test(u)) return ['bad', 'Es una dirección local: nadie más podrá abrirla.'];
    if (/^http:\/\//i.test(u)) return ['', 'Usa https:// si la web lo admite; algunos navegadores avisan de las páginas http.'];
    return ['', 'Aparecerá como texto visible (lo que leen los ATS) y como enlace clicable en el PDF y el Word.'];
  }
  function projHtml(p, i, skills) {
    const [hc, ht] = urlHint(p.url);
    const used = String(p.tools || '').toLowerCase();
    const sug = skills.filter(x => !used.includes(x.toLowerCase())).slice(0, 8);
    return '<div class="proj" data-proj="' + i + '">' + ehead('projects', i, dEdit().projects.length, 'Proyecto ' + (i + 1)) +
      cf('Nombre', 'projects.' + i + '.name', p.name) +
      cf('Enlace', 'projects.' + i + '.url', p.url, { after: '<div class="urlhint ' + hc + '" data-hint="projects.' + i + '.url">' + h(ht) + '</div>' }) +
      cf('Fechas', 'projects.' + i + '.period', p.period) +
      cf('Descripción', 'projects.' + i + '.desc', p.desc, { area: true, rows: 3, count: true, limit: 300 }) +
      cf('Herramientas', 'projects.' + i + '.tools', p.tools, { after: sug.length ? '<div class="suggest" aria-label="Añadir herramienta">' + sug.map(x => '<button type="button" data-addtool="' + i + '" data-tool="' + h(x) + '">+ ' + h(x) + '</button>').join('') + '</div>' : '' }) +
      '</div>';
  }
  // cabecera de cada entrada editable: subir, bajar y quitar
  const BLANK = { exp: { title: '', company: '', location: '', start: '', end: '', desc: '' }, edu: { degree: '', institution: '', location: '', start: '', end: '' }, langs: { name: '', level: '' }, projects: { name: '', url: '', period: '', desc: '', tools: '' } };
  const NOUN = { exp: 'puesto', edu: 'estudio', langs: 'idioma', projects: 'proyecto' };
  function ehead(kind, i, n, label) {
    return '<div class="ehead"><span class="label">' + h(label) + '</span>' +
      (i > 0 ? '<button class="btn" type="button" data-move="' + kind + ':' + i + ':-1" aria-label="Subir ' + NOUN[kind] + ' ' + (i + 1) + '">Subir</button>' : '') +
      (i < n - 1 ? '<button class="btn" type="button" data-move="' + kind + ':' + i + ':1" aria-label="Bajar ' + NOUN[kind] + ' ' + (i + 1) + '">Bajar</button>' : '') +
      '<button class="btn" type="button" data-del="' + kind + ':' + i + '">Quitar ' + NOUN[kind] + '</button></div>';
  }
  const addBtn = (kind, text) => '<div class="toolbar"><button class="btn" type="button" data-add="' + kind + '">' + text + '</button></div>';
  function verBar() {
    const alt = altLang(), has = !!state.trans[alt], tr = state.dv !== 'orig' && state.trans[state.dv];
    let out = '<div class="verbar" role="group" aria-label="Versión del CV que estás editando"><span class="label">Versión</span>' +
      '<button type="button" class="seg" data-dv="orig" aria-pressed="' + (state.dv === 'orig') + '">' + cap(LNAME[origLang()]) + ' · original</button>' +
      '<button type="button" class="seg" data-dv="' + alt + '" aria-pressed="' + (state.dv === alt) + '">' + (has ? cap(LNAME[alt]) : '+ Crear versión en ' + LNAME[alt]) + '</button></div>';
    if (!tr) return out + (has ? '' : '<p class="small muted">Crea una copia en ' + LNAME[alt] + ' para generar el CV en ese idioma. La versión original no cambia.</p>');
    const n = cfPending.size;
    out += '<div class="trpanel"><p><strong id="trCount">' + pendCount(n) + '</strong>. ' +
      'Se han traducido solos los idiomas y niveles, las fechas, los lugares, las universidades y las titulaciones, puestos y competencias habituales. Cada campo que conserva palabras en ' + LNAME[trFrom()] + ' queda marcado e indica cuáles son. Si una palabra es un nombre propio que debe quedarse así, pulsa «Está bien así».</p>' +
      '<p class="small muted">Puedes traducir cada campo aquí mismo o copiar los textos pendientes, traducirlos con la herramienta que prefieras y pegar el resultado. Si usas un traductor o un asistente de IA, esos textos saldrán de este navegador hacia ese servicio.</p>' +
      '<div class="toolbar"><button class="btn" type="button" id="trCopy">Copiar textos para traducir</button><button class="btn" type="button" id="trCopyAll">Copiar todos los textos</button><button class="btn" type="button" id="trUse">Ver el CV en ' + LNAME[state.dv] + '</button><button class="btn" type="button" id="trDel">Borrar esta versión</button></div>' +
      '<details class="fold" id="trPaste"><summary>Pegar la traducción</summary><div class="foldbody"><textarea id="trText" rows="6" placeholder="Pega aquí el texto traducido, con las etiquetas [@...] tal cual"></textarea><div class="toolbar"><button class="btn primary" type="button" id="trApply">Aplicar traducción</button></div></div></details></div>';
    return out;
  }
  function renderDatos() {
    const e = dEdit(); fid = 0;
    cfPending = state.dv !== 'orig' && state.trans[state.dv] ? TR.pendingMap(state.edit, e, trFrom(), state.dv) : new Map();
    let html = '<div class="sheet"><h3>Datos listos para pegar en ofertas</h3><p class="lede">Todo lo extraído de tu CV, campo a campo, como lo piden InfoJobs, LinkedIn, Indeed o los portales de empleo de las empresas. Puedes corregir cualquier campo: los cambios se usan también en la plantilla.</p>' +
      verBar() +
      '<div class="toolbar"><button class="btn" type="button" id="copyAll">Copiar todo como texto</button><button class="btn" type="button" id="copyJson">Copiar como JSON Resume</button></div></div>';
    html += '<div class="sheet"><div class="group"><h4>Datos personales</h4>' + cf('Nombre', 'name', e.name) + cf('Titular', 'headline', e.headline, { count: true, limit: 220 }) + cf('Email', 'email', e.email) + cf('Teléfono', 'phone', e.phone) + cf('Ubicación', 'location', e.location) + cf('LinkedIn', 'linkedin', e.linkedin) + cf('Web / GitHub', 'web', e.web) + '</div>';
    html += '<div class="group"><h4>Perfil profesional</h4>' + cf('Tu perfil', 'summary', e.summary, { area: true, rows: 4, count: true, limit: 2600 }) + (e !== state.edit ? '</div>' : '') +
      (e !== state.edit ? '' : '<div class="cf draft">' + '<label class="label" for="fdraft">Borrador sugerido</label><textarea id="fdraft" rows="3" data-path="draft">' + h(e.draft) + '</textarea><div class="side"><button class="btn small" type="button" data-copy="fdraft">Copiar</button></div></div>' +
      '<p class="small muted">El borrador se genera con tus datos. Sustituye lo que va entre corchetes antes de usarlo. Si dejas vacío «Tu perfil», la plantilla usará el borrador.</p></div>');
    html += '<div class="group"><h4>Experiencia (' + e.exp.length + ')</h4><p class="small muted">Añade, quita o reordena puestos: el orden de aquí es el de la plantilla (pon primero el más reciente o el más relevante).</p>' + (e.exp.length ? e.exp.map((x, i) => '<div class="entry">' + ehead('exp', i, e.exp.length, 'Puesto ' + (i + 1)) + cf('Puesto', 'exp.' + i + '.title', x.title) + cf('Empresa', 'exp.' + i + '.company', x.company) + cf('Ubicación', 'exp.' + i + '.location', x.location) + cf('Inicio', 'exp.' + i + '.start', x.start) + cf('Fin', 'exp.' + i + '.end', x.end) + cf('Descripción', 'exp.' + i + '.desc', x.desc, { area: true, rows: Math.min(8, Math.max(3, x.desc.split('\n').length + 1)), count: true }) + '</div>').join('') : '<div class="empty">No hay puestos. Añade el primero con el botón de abajo.</div>') + addBtn('exp', 'Añadir puesto') + '</div>';
    const skillList = String(e.skills || '').split(',').map(x => x.trim()).filter(Boolean);
    html += '<div class="group" id="projGroup"><h4>Proyectos (' + e.projects.length + ')</h4><p class="small muted">Enlaza trabajos que demuestren lo que sabes hacer: repositorios, webs, portfolios, publicaciones o casos de estudio. Describe en 1–2 líneas qué hace y qué resultado tuvo, e indica las herramientas usadas.</p>' +
      (e.projects.length ? e.projects.map((p, i) => projHtml(p, i, skillList)).join('') : '<div class="empty">Aún no hay proyectos. Añade el primero con el botón de abajo; aparecerá en la plantilla del CV.</div>') +
      addBtn('projects', 'Añadir proyecto') + '</div>';
    html += '<div class="group"><h4>Formación (' + e.edu.length + ')</h4>' + (e.edu.length ? e.edu.map((x, i) => '<div class="entry">' + ehead('edu', i, e.edu.length, 'Estudio ' + (i + 1)) + cf('Titulación', 'edu.' + i + '.degree', x.degree) + cf('Centro', 'edu.' + i + '.institution', x.institution) + cf('Ubicación', 'edu.' + i + '.location', x.location) + cf('Inicio', 'edu.' + i + '.start', x.start) + cf('Fin', 'edu.' + i + '.end', x.end) + '</div>').join('') : '<div class="empty">No hay estudios. Añade el primero con el botón de abajo.</div>') + addBtn('edu', 'Añadir estudio') + '</div>';
    html += '<div class="group"><h4>Habilidades e idiomas</h4>' + cf('Técnicas', 'skills', e.skills, { area: true, rows: 3 }) + cf('Personales', 'soft', e.soft) +
      '</div><div class="group"><h4>Idiomas (' + e.langs.length + ')</h4>' +
      (e.langs.length ? e.langs.map((l, i) => '<div class="entry">' + ehead('langs', i, e.langs.length, 'Idioma ' + (i + 1)) + cf('Idioma', 'langs.' + i + '.name', l.name) + cf('Nivel', 'langs.' + i + '.level', l.level) + '</div>').join('') : '<div class="empty">No hay idiomas. Añade al menos tu lengua materna.</div>') +
      addBtn('langs', 'Añadir idioma') +
      '<p class="small muted">Nivel recomendado con el MCER: A1, A2, B1, B2, C1, C2 o «Nativo».</p></div>' +
      '<div class="group"><h4>Certificaciones y cursos</h4><p class="small muted">Uno por línea; para añadir, escribe una línea nueva y, para quitar, bórrala. Formato recomendado: Nombre — Entidad, año.</p>' + cf('Certificaciones', 'certs', e.certs, { area: true, rows: 4 }) + cf('Cursos', 'courses', e.courses, { area: true, rows: 3 }) + '</div></div>';
    $('#v-datos').innerHTML = html;
    $('#v-datos').onclick = ev => {
      const k = ev.target.closest('[data-keep]'); if (!k) return;
      const tr = state.trans[state.dv]; if (!tr) return;
      TR.keep(tr, k.dataset.keep); recheck(k.dataset.keep); scheduleSave();
      const inp = $('#v-datos [data-path="' + k.dataset.keep + '"]'); if (inp) inp.focus();
    };
    $$('#v-datos [data-path]').forEach(inp => inp.addEventListener('input', () => {
      if (SHARED.test(inp.dataset.path)) allVersions().forEach(v => { try { if (getPath(v, inp.dataset.path.replace(/\.[^.]+$/, '')) != null) setPath(v, inp.dataset.path, inp.value); } catch (er) { } });
      else setPath(dEdit(), inp.dataset.path, inp.value);
      recheck(inp.dataset.path);
      const cc = $('[data-cc="' + inp.id + '"]'); if (cc) cc.textContent = inp.value.length + (cc.dataset.limit ? '/' + cc.dataset.limit : '');
      if (cc && cc.dataset.limit) cc.style.color = inp.value.length > +cc.dataset.limit ? 'var(--bad)' : '';
      if (/^projects\.\d+\.url$/.test(inp.dataset.path)) {
        const hint = $('[data-hint="' + inp.dataset.path + '"]'); const [hc, ht] = urlHint(inp.value);
        if (hint) { hint.className = 'urlhint ' + hc; hint.textContent = ht; }
        const idx = +inp.dataset.path.split('.')[1], pr = dEdit().projects[idx];
        const nameInp = $('[data-path="projects.' + idx + '.name"]');
        if (pr && !pr.name && nameInp && !hc && inp.value.includes('/')) { const nm = E._internals.nameFromUrl(inp.value); if (nm) nameInp.placeholder = nm; }
      }
      schedulePreview();
    }));
    $$('#v-datos [data-path$=".name"]').forEach(inp => inp.addEventListener('focus', () => { if (!inp.value && inp.placeholder) { inp.value = inp.placeholder; setPath(dEdit(), inp.dataset.path, inp.value); schedulePreview(); } }));
    $$('#v-datos [data-add]').forEach(b => b.addEventListener('click', () => {
      const kind = b.dataset.add, n0 = dEdit()[kind].length;
      allVersions().forEach(v => { if (v === dEdit() || v[kind].length === n0) v[kind].push(Object.assign({}, BLANK[kind])); });
      renderDatos(); updatePreview(); scheduleSave();
      const first = { exp: 'title', edu: 'degree', langs: 'name', projects: 'name' }[kind];
      const n = $('[data-path="' + kind + '.' + (dEdit()[kind].length - 1) + '.' + first + '"]');
      if (n) { n.scrollIntoView({ block: 'center' }); n.focus(); }
    }));
    $$('#v-datos [data-del]').forEach(b => b.addEventListener('click', () => {
      const [kind, i] = b.dataset.del.split(':'), n0 = dEdit()[kind].length;
      allVersions().forEach(v => { if (v === dEdit() || v[kind].length === n0) v[kind].splice(+i, 1); });
      renderDatos(); updatePreview(); scheduleSave(); toast(NOUN[kind].charAt(0).toUpperCase() + NOUN[kind].slice(1) + ' quitado');
    }));
    $$('#v-datos [data-move]').forEach(b => b.addEventListener('click', () => {
      const [kind, i, d] = b.dataset.move.split(':'); const n0 = dEdit()[kind].length, k = +i, j = k + +d;
      if (j < 0 || j >= n0) return;
      allVersions().forEach(v => { const a = v[kind]; if (v === dEdit() || a.length === n0) [a[k], a[j]] = [a[j], a[k]]; });
      renderDatos(); updatePreview(); scheduleSave();
      const focusBtn = $('[data-move^="' + kind + ':' + j + ':' + d + '"]') || $('[data-del="' + kind + ':' + j + '"]'); if (focusBtn) focusBtn.focus();
    }));
    $$('#v-datos [data-addtool]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.addtool, inp = $('[data-path="projects.' + i + '.tools"]');
      inp.value = inp.value.trim() ? inp.value.replace(/[,\s]+$/, '') + ', ' + b.dataset.tool : b.dataset.tool;
      allVersions().forEach(v => { if (v.projects[i]) v.projects[i].tools = inp.value; }); b.remove(); schedulePreview();
    }));
    $$('#v-datos [data-copy]').forEach(b => b.addEventListener('click', () => { const el = document.getElementById(b.dataset.copy); copyText(el.value, el); }));
    $('#copyAll').addEventListener('click', () => copyText(allText()));
    $('#copyJson').addEventListener('click', () => copyText(JSON.stringify(T.toJsonResume(dEdit()), null, 2)));
    $$('#v-datos [data-dv]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.dv;
      if (v === 'orig') state.dv = 'orig'; else { const fresh = !state.trans[v]; createTrans(v); if (fresh) toast('Versión en ' + LNAME[v] + ' creada'); }
      renderDatos(); renderPlantilla(); scheduleSave();
      const nb = $('#v-datos [data-dv="' + v + '"]'); if (nb) nb.focus();
    }));
    if ($('#trCopy')) {
      const tr = state.trans[state.dv];
      $('#trCopy').addEventListener('click', () => { if (!cfPending.size) { toast('No quedan textos sin traducir'); return; } copyText(TR.exportText(state.edit, tr, state.dv, false)); toast(cfPending.size + (cfPending.size === 1 ? ' campo copiado' : ' campos copiados') + ' para traducir'); });
      $('#trCopyAll').addEventListener('click', () => copyText(TR.exportText(state.edit, tr, state.dv, true)));
      $('#trUse').addEventListener('click', () => { state.tpl.lang = state.dv; renderPlantilla(); go('plantilla'); });
      $('#trDel').addEventListener('click', () => { const l = state.dv; delete state.trans[l]; state.dv = 'orig'; if (state.tpl.lang === l) state.tpl.lang = origLang(); renderDatos(); renderPlantilla(); scheduleSave(); toast('Versión en ' + LNAME[l] + ' borrada'); });
      $('#trApply').addEventListener('click', () => {
        const n = TR.importText(tr, $('#trText').value);
        if (!n) { toast('No se ha encontrado ningún texto con etiquetas [@...]'); return; }
        renderDatos(); updatePreview(); scheduleSave(); toast(n + (n === 1 ? ' texto aplicado' : ' textos aplicados'));
      });
    }
  }
  // vuelve a revisar un campo de la versión traducida mientras se escribe
  function recheck(path) {
    const tr = state.dv !== 'orig' && state.trans[state.dv]; if (!tr || !TR.scanFields(tr).includes(path)) return;
    const c = TR.check(state.edit, tr, path, trFrom(), state.dv);
    if (c) cfPending.set(path, c); else cfPending.delete(path);
    const note = $('#v-datos [data-trnote="' + path + '"]'), wrap = note && note.closest('.cf');
    if (note) note.innerHTML = trNote(path, c);
    if (wrap) {
      wrap.classList.toggle('pending', !!c);
      const lab = wrap.querySelector('label'), tg = lab && lab.querySelector('.pendtag');
      if (c && !tg && lab) lab.insertAdjacentHTML('beforeend', '<span class="pendtag">Sin traducir</span>'); else if (!c && tg) tg.remove();
    }
    const cnt = $('#trCount'); if (cnt) cnt.textContent = pendCount(cfPending.size);
  }
  function setPath(obj, path, val) { const p = path.split('.'); let o = obj; for (let i = 0; i < p.length - 1; i++) o = o[isNaN(p[i]) ? p[i] : +p[i]]; o[p[p.length - 1]] = val; }
  function allText() {
    const e = dEdit(), L = [];
    if (state.dv === 'en') return allTextEn(e);
    L.push('DATOS PERSONALES', 'Nombre: ' + e.name, 'Titular: ' + e.headline, 'Email: ' + e.email, 'Teléfono: ' + e.phone, 'Ubicación: ' + e.location, 'LinkedIn: ' + e.linkedin, 'Web: ' + e.web, '', 'PERFIL', e.summary || e.draft, '', 'EXPERIENCIA');
    e.exp.forEach(x => L.push('', 'Puesto: ' + x.title, 'Empresa: ' + x.company, 'Ubicación: ' + x.location, 'Inicio: ' + x.start, 'Fin: ' + x.end, 'Descripción:', x.desc));
    if (e.projects.length) { L.push('', 'PROYECTOS'); e.projects.forEach(p => L.push('', 'Proyecto: ' + p.name, 'Enlace: ' + p.url, 'Fechas: ' + p.period, 'Descripción: ' + p.desc, 'Herramientas: ' + p.tools)); }
    L.push('', 'FORMACIÓN');
    e.edu.forEach(x => L.push('', 'Titulación: ' + x.degree, 'Centro: ' + x.institution, 'Inicio: ' + x.start, 'Fin: ' + x.end));
    L.push('', 'HABILIDADES', e.skills, e.soft ? 'Personales: ' + e.soft : '', '', 'IDIOMAS', ...e.langs.map(l => l.name + (l.level ? ': ' + l.level : '')), '', 'CERTIFICACIONES', e.certs, '', 'CURSOS', e.courses);
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  function allTextEn(e) {
    const L = ['PERSONAL DETAILS', 'Name: ' + e.name, 'Headline: ' + e.headline, 'Email: ' + e.email, 'Phone: ' + e.phone, 'Location: ' + e.location, 'LinkedIn: ' + e.linkedin, 'Website: ' + e.web, '', 'SUMMARY', e.summary, '', 'EXPERIENCE'];
    e.exp.forEach(x => L.push('', 'Job title: ' + x.title, 'Company: ' + x.company, 'Location: ' + x.location, 'Start: ' + x.start, 'End: ' + x.end, 'Description:', x.desc));
    if (e.projects.length) { L.push('', 'PROJECTS'); e.projects.forEach(p => L.push('', 'Project: ' + p.name, 'Link: ' + p.url, 'Dates: ' + p.period, 'Description: ' + p.desc, 'Tools: ' + p.tools)); }
    L.push('', 'EDUCATION');
    e.edu.forEach(x => L.push('', 'Degree: ' + x.degree, 'Institution: ' + x.institution, 'Start: ' + x.start, 'End: ' + x.end));
    L.push('', 'SKILLS', e.skills, e.soft ? 'Soft skills: ' + e.soft : '', '', 'LANGUAGES', ...e.langs.map(l => l.name + (l.level ? ': ' + l.level : '')), '', 'CERTIFICATIONS', e.certs, '', 'COURSES', e.courses);
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  // ---------- plantilla ----------
  let pvT = 0;
  function schedulePreview() { clearTimeout(pvT); pvT = setTimeout(updatePreview, 250); scheduleSave(); }
  function tplOpts() { return { style: state.tpl.style, lang: state.tpl.lang, country: state.r.country.code, paper: state.r.country.paper, driving: state.edit.driving && $('#tplDriving') ? $('#tplDriving').checked : false }; }
  function updatePreview() {
    const pv = $('#cvPreview'); if (!pv) return;
    const B = T.blocks(tEdit(), tplOpts());
    pv.innerHTML = T.toHtml(B); const ph = pv.querySelectorAll('.ph').length; $('#phNote').hidden = !ph;
    const sc = $('#tplScore');
    if (sc) { try { const r = E.analyze({ text: T.toText(B), meta: { fileType: 'pdf', fileName: 'CV.pdf', pages: 1 }, opts: currentOpts() }); sc.innerHTML = 'Puntuación estimada del CV generado: <strong class="num">' + r.total + '/100</strong> con el país y la empresa elegidos.'; } catch (er) { sc.textContent = ''; } }
  }
  function langNote() {
    const L = state.tpl.lang, o = origLang();
    if (L === o) return state.trans[altLang()] ? 'Muestra tu versión original. También tienes una versión en ' + LNAME[altLang()] + ': elígela en «Idioma del CV».' : '';
    const tr = state.trans[L];
    if (tr) { const n = TR.pending(state.edit, tr, o === 'en' ? 'en' : 'es', L).length; return 'Usa tu versión en ' + LNAME[L] + ' de «Datos para copiar».' + (n ? ' <span class="pendnote">Quedan ' + n + (n === 1 ? ' campo' : ' campos') + ' sin traducir.</span> <button class="btn small" type="button" data-gotrans="' + L + '">Terminar de traducir</button>' : ''); }
    if (L === altLang()) return 'Ahora solo se traducen los encabezados: el contenido sigue en ' + LNAME[o] + '. <button class="btn small" type="button" data-gotrans="' + L + '">Crear la versión en ' + LNAME[L] + '</button>';
    return 'Solo se traducen los encabezados; el contenido sigue en ' + LNAME[o] + '.';
  }
  function renderPlantilla() {
    const r = state.r;
    const styles = [['cronologico', 'Cronológico ATS (una columna)'], ['hibrido', 'Combinado (competencias + cronológico)'], ['resume_us', 'Résumé EE. UU.'], ['lebenslauf', 'Lebenslauf (Alemania, Austria, Suiza)'], ['europass', 'Tipo Europass']];
    const langs = [['es', 'Español'], ['en', 'Inglés'], ['de', 'Alemán'], ['fr', 'Francés'], ['it', 'Italiano'], ['pt', 'Portugués']];
    const selfhost = BUILD === 'selfhost';
    $('#v-plantilla').innerHTML = '<div class="sheet"><h3>Tu CV en formato compatible con ATS</h3><p class="lede">Generado con los datos de «Datos para copiar»: una columna, encabezados estándar, sin tablas ni iconos. Cópialo en Word o Google Docs y ajusta la tipografía si quieres; la estructura ya está pensada para los filtros.</p>' +
      '<div class="tplctl"><div class="field"><label class="label" for="tplStyle">Modelo</label><select id="tplStyle">' + styles.map(([k, v]) => '<option value="' + k + '"' + (k === state.tpl.style ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
      '<div class="field"><label class="label" for="tplLang">Idioma del CV</label><select id="tplLang">' + langs.map(([k, v]) => '<option value="' + k + '"' + (k === state.tpl.lang ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
      (state.edit.driving ? '<label class="field small" style="flex-direction:row;align-items:center;gap:8px;padding-top:20px"><input type="checkbox" id="tplDriving" checked> Incluir carnet de conducir</label>' : '') + '</div>' +
      '<div class="toolbar"><button class="btn" type="button" id="tplCopy">Copiar texto</button><button class="btn" type="button" id="tplRich">Copiar con formato</button>' +
      (DL ? '<button class="btn" type="button" id="tplPdf">Descargar PDF</button><button class="btn" type="button" id="tplDocx">Descargar Word (.docx)</button><button class="btn" type="button" id="tplTxt">Descargar .txt</button><button class="btn" type="button" id="tplJson">Descargar JSON</button>' : '') + (selfhost ? '<button class="btn" type="button" id="tplPrint">Imprimir o guardar PDF</button>' : '') + '</div>' +
      '<p class="small pendnote" id="phNote" hidden>Hay texto entre corchetes resaltado: complétalo antes de enviar el CV.</p>' +
      '<p class="small muted" id="langNote">' + langNote() + '</p>' +
      '<p class="small muted">Papel recomendado para ' + h(r.country.name) + ': ' + r.country.paper + '. <span id="tplScore"></span></p>' +
      '</div><div class="page-preview"><article class="cvpage" id="cvPreview" aria-label="Vista previa del CV"></article></div>';
    updatePreview();
    $('#tplStyle').addEventListener('change', e => { state.tpl.style = e.target.value; updatePreview(); });
    $('#tplLang').addEventListener('change', e => { state.tpl.lang = e.target.value; $('#langNote').innerHTML = langNote(); bindLangNote(); updatePreview(); scheduleSave(); });
    function bindLangNote() { $$('#langNote [data-gotrans]').forEach(b => b.addEventListener('click', () => { createTrans(b.dataset.gotrans); renderDatos(); renderPlantilla(); go('datos'); const p = $('#v-datos .trpanel'); if (p) p.scrollIntoView({ block: 'center' }); })); }
    bindLangNote();
    if ($('#tplDriving')) $('#tplDriving').addEventListener('change', updatePreview);
    $('#tplCopy').addEventListener('click', () => copyText(T.toText(T.blocks(tEdit(), tplOpts()))));
    $('#tplRich').addEventListener('click', () => {
      const B = T.blocks(tEdit(), tplOpts());
      const html = '<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">' + T.toHtml(B).replace(/<h1>/g, '<h1 style="font-size:20pt;margin:0">').replace(/<h2>/g, '<h2 style="font-size:12pt;text-transform:uppercase;border-bottom:1px solid #999;margin:14pt 0 6pt">') + '</div>';
      try {
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([T.toText(B)], { type: 'text/plain' }) })]).then(() => toast('Copiado con formato'), () => copyText(T.toText(B)));
        } else copyText(T.toText(B));
      } catch (e) { copyText(T.toText(B)); }
    });
    const fname = ext => ((state.edit.name || 'CV').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'CV') + '-CV' + (state.tpl.lang !== origLang() ? '-' + state.tpl.lang.toUpperCase() : '') + '.' + ext;
    if (DL) {
      $('#tplPdf').addEventListener('click', async () => {
        const btn = $('#tplPdf'); btn.disabled = true;
        try {
          if ($('#cvPreview .ph')) toast('Ojo: quedan textos entre corchetes por completar');
          const L = await window.CV_LIBS.pdflib();
          await DL(await T.toPdf(T.blocks(tEdit(), tplOpts()), tplOpts(), L), fname('pdf'));
        } catch (e) { console.error(e); toast('No se pudo generar el PDF'); }
        btn.disabled = false;
      });
      $('#tplDocx').addEventListener('click', async () => { try { const Z = await window.CV_LIBS.jszip(); await DL(await T.toDocx(T.blocks(tEdit(), tplOpts()), tplOpts(), Z), fname('docx')); } catch (e) { toast('No se pudo generar el Word'); } });
      $('#tplTxt').addEventListener('click', () => DL(new Blob([T.toText(T.blocks(tEdit(), tplOpts()))], { type: 'text/plain;charset=utf-8' }), fname('txt')));
      $('#tplJson').addEventListener('click', () => DL(new Blob([JSON.stringify(T.toJsonResume(tEdit()), null, 2)], { type: 'application/json' }), fname('json')));
    }
    if (selfhost) $('#tplPrint').addEventListener('click', () => { const pr = $('#printRoot'); pr.innerHTML = '<article class="cvpage">' + $('#cvPreview').innerHTML + '</article>'; window.print(); });
  }

  // ---------- Informe Pro (de pago) ----------
  // Modelo: cada compra (sesión de Stripe) da PRO.max informes durante 30 días. El navegador guarda:
  //  · pro-wallet: las compras de esta persona (código de pedido y lo que le queda; la fuente de verdad es Stripe, vía /api/estado)
  //  · pro-reports + pro-report:<id>: los informes generados, cada uno con la copia del CV y la oferta que se usaron
  //  · pro-pending: el CV y la oferta mientras se paga, para generar el informe al volver de Stripe
  // Así ningún informe pagado depende del CV que esté cargado en ese momento ni se pierde al borrar un informe,
  // y la compra se puede recuperar en otro navegador con su enlace.
  const PRO = { available: false, price: '4,99 €', max: 3, view: 'form', wallet: [], reports: [], rep: null, err: null, job: null, draft: null };
  const PRO_STEPS = ['Comprobando el pago', 'Leyendo la oferta y tu CV', 'Evaluando requisito a requisito', 'Reescribiendo tu CV para la oferta', 'Redactando la carta de presentación'];
  const SUPPORT = 'nazarblanco@gmail.com';
  const PRO_ERR = {
    pedido_no_valido: 'No encuentro ese pedido. Si has pagado, escríbeme a ' + SUPPORT + ' con el email de la compra y lo resuelvo.',
    pedido_no_encontrado: 'No encuentro ese pedido. Si has pagado, escríbeme a ' + SUPPORT + ' con el email de la compra y lo resuelvo.',
    pago_no_completado: 'El pago todavía no figura como completado. Espera unos segundos y pulsa «Reintentar».',
    pedido_caducado: 'Esta compra tiene más de 30 días y ya no permite generar informes.',
    limite_generaciones: 'Ya has usado los ' + PRO.max + ' informes incluidos en esta compra.',
    pedido_reembolsado: 'Esta compra se ha devuelto, así que ya no permite generar informes. Los informes que ya generaste siguen aquí.',
    ia_saturada: 'El servicio de IA está saturado en este momento. No se ha gastado ningún informe: pulsa «Reintentar» en un minuto.',
    ia_no_disponible: 'No se ha podido generar el informe. No se ha gastado ningún informe: pulsa «Reintentar».',
    stripe_no_disponible: 'No se ha podido conectar con la pasarela de pago. No se ha gastado ningún informe: inténtalo de nuevo en un momento.',
    generacion_en_curso: 'Ya se está generando otro informe con esta compra (quizá en otra pestaña). Espera a que termine y pulsa «Reintentar»; no se ha gastado ningún informe.',
    pagos_no_configurados: 'El Informe Pro no está activo todavía.',
    oferta_muy_corta: 'Pega la oferta completa: título, funciones y requisitos.',
    oferta_muy_larga: 'La oferta es demasiado larga. Pega solo el título, las funciones y los requisitos.',
    cv_muy_largo: 'El CV es demasiado largo para generar el informe. Recorta las descripciones más antiguas en «Datos para copiar».',
    red: 'Se ha perdido la conexión mientras se generaba el informe. Si no llegó a terminar, no se ha gastado: pulsa «Reintentar».'
  };
  // almacenamiento local del navegador (la misma base de datos que usa la página principal).
  // Si el navegador lo bloquea (modo privado, permisos) o no responde, se sigue en memoria durante la visita:
  // nada se rompe, solo se pierde al recargar. IDB_OK dice si funciona (lo comprueba proInit).
  const MEM = new Map(); let IDB_OK = null;
  function idb(mode, fn) {
    if (IDB_OK === false) return Promise.reject(new Error('idb_no_disponible'));   // ya sabemos que no funciona: no se espera otra vez
    return new Promise((resolve, reject) => {
      let done = false; const end = (f, v) => { if (!done) { done = true; clearTimeout(timer); if (f === reject) IDB_OK = false; f(v); } };
      const timer = setTimeout(() => end(reject, new Error('idb_timeout')), 5000);
      let req; try { req = indexedDB.open('cv-handoff', 1); } catch (e) { end(reject, e); return; }
      req.onupgradeneeded = () => { try { req.result.createObjectStore('f'); } catch (e) { } };
      req.onerror = () => end(reject, req.error);
      req.onblocked = () => end(reject, new Error('idb_blocked'));
      req.onsuccess = () => {
        try {
          const db = req.result, tx = db.transaction('f', mode), out = fn(tx.objectStore('f'));
          tx.oncomplete = () => { db.close(); end(resolve, out && 'result' in out ? out.result : undefined); };
          tx.onerror = tx.onabort = () => { db.close(); end(reject, tx.error); };
        } catch (e) { try { req.result.close(); } catch (x) { } end(reject, e); }
      };
    });
  }
  const idbGet = k => idb('readonly', st => st.get(k)).then(v => v === undefined && MEM.has(k) ? MEM.get(k) : v, () => MEM.has(k) ? MEM.get(k) : null);
  const idbSet = (k, v) => { MEM.set(k, v); return idb('readwrite', st => { st.put(v, k); }).then(() => { MEM.delete(k); return true; }, () => false); };
  const idbDel = k => { MEM.delete(k); return idb('readwrite', st => { st.delete(k); }).catch(() => null); };
  async function idbProbe() { if (IDB_OK === null) { IDB_OK = await idbSet('probe', 1); if (IDB_OK) await idbDel('probe'); } return IDB_OK; }

  // ---------- compras (monedero local, sincronizado con Stripe) ----------
  const shortId = id => '…' + String(id || '').slice(-8);
  const fmtDay = ms => ms ? new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
  const recoveryUrl = id => location.origin + location.pathname + '?pro=' + encodeURIComponent(id) + '#pro';
  async function walletSave() { await idbSet('pro-wallet', PRO.wallet); }
  async function walletAdd(id, estado) {
    if (!/^cs_(test|live)_/.test(id)) return null;
    let w = PRO.wallet.find(x => x.id === id);
    if (!w) { w = { id, at: Date.now(), estado: estado || 'pendiente', restantes: null, caduca: null }; PRO.wallet.push(w); await walletSave(); }
    return w;
  }
  async function walletRefresh(only) {
    const list = PRO.wallet.filter(w => (!only || w.id === only) && w.estado !== 'agotado' && w.estado !== 'caducado' && w.estado !== 'reembolsado');
    await Promise.all(list.map(async w => {
      try {
        const r = await fetch('/api/estado?session_id=' + encodeURIComponent(w.id), { headers: { accept: 'application/json' } });
        const d = await r.json();
        if (d.estado === 'no_existe') { w.estado = 'no_existe'; return; }
        if (d.estado) { w.estado = d.estado; w.restantes = d.restantes; w.caduca = d.caduca || w.caduca; }
      } catch (e) { /* sin conexión: se mantiene lo último conocido */ }
    }));
    // las sesiones que nunca se pagaron se olvidan pasado un día (Stripe las da por caducadas)
    PRO.wallet = PRO.wallet.filter(w => w.estado !== 'no_existe' && !(w.estado === 'pendiente' && Date.now() - w.at > 86400000));
    await walletSave();
  }
  const credit = () => PRO.wallet.filter(w => w.estado === 'pagado' && w.restantes > 0).sort((a, b) => a.at - b.at)[0] || null;
  const creditsLeft = () => PRO.wallet.reduce((n, w) => n + (w.estado === 'pagado' ? w.restantes || 0 : 0), 0);

  // ---------- informes guardados ----------
  async function reportsLoad() { PRO.reports = (await idbGet('pro-reports')) || []; }
  async function reportSave(rep) {
    await idbSet('pro-report:' + rep.rid, rep);
    const meta = { rid: rep.rid, session: rep.session, title: rep.title, lang: rep.lang, at: rep.at, cvName: rep.cvName };
    PRO.reports = [meta].concat(PRO.reports.filter(x => x.rid !== rep.rid)).slice(0, 30);
    await idbSet('pro-reports', PRO.reports); await idbSet('pro-current', rep.rid);
  }
  async function reportOpen(rid) { const r = await idbGet('pro-report:' + rid); if (r) { PRO.rep = r; PRO.view = 'report'; await idbSet('pro-current', rid); renderPro(); } }
  async function reportDelete(rid) {
    await idbDel('pro-report:' + rid); PRO.reports = PRO.reports.filter(x => x.rid !== rid); await idbSet('pro-reports', PRO.reports);
    if (PRO.rep && PRO.rep.rid === rid) { PRO.rep = null; PRO.view = 'form'; await idbDel('pro-current'); }
  }
  const offerTitle = o => (t => t.length > 90 ? t.slice(0, 88).replace(/\s+\S*$/, '') + '…' : t)(((o || '').split('\n').find(l => l.trim()) || 'Oferta sin título').trim());
  const cvLabel = () => state.label || (state.meta && state.meta.fileName) || 'tu CV';
  // copia del CV cargado ahora mismo: el informe se hace sobre ella aunque después se suba otro CV
  const cvSnapshot = () => ({ edit: JSON.parse(JSON.stringify(state.edit)), trans: JSON.parse(JSON.stringify(state.trans || {})), text: state.text, meta: state.meta, cvLang: origLang(), cvName: cvLabel(), country: $('#country').value, company: $('#company').value });

  const proLang = () => (PRO.draft && PRO.draft.lang) || (state.r && state.r.lang === 'en' ? 'en' : 'es');
  function proCvPayload(e) {
    // se envía lo imprescindible: sin nombre, email, teléfono, enlaces ni ubicación
    return {
      titular: e.headline || '', perfil: (e.summary || '').trim() || (e.draft || '').trim(),
      exp: e.exp.map((x, i) => ({ indice: i, puesto: x.title, empresa: x.company, inicio: x.start, fin: x.end, descripcion: x.desc })),
      proyectos: e.projects.map((p, i) => ({ indice: i, nombre: p.name, periodo: p.period, descripcion: p.desc, herramientas: p.tools })),
      formacion: e.edu.map(x => ({ titulacion: x.degree, centro: x.institution, fin: x.end })),
      habilidades: e.skills, competencias_personales: e.soft,
      idiomas: e.langs.map(l => (l.name || '') + (l.level ? ': ' + l.level : '')),
      certificaciones: e.certs, cursos: e.courses
    };
  }
  // CV completo con las partes reescritas por la IA (el resto sale de la copia del CV, o de su versión traducida si coincide el idioma)
  function proMerged(rep) {
    rep = rep || PRO.rep; const res = rep.result;
    const base = JSON.parse(JSON.stringify(rep.lang !== rep.cvLang && rep.trans && rep.trans[rep.lang] ? rep.trans[rep.lang] : rep.edit));
    const cv = res.cv || {};
    if (cv.titular) base.headline = cv.titular;
    if (cv.perfil) { base.summary = cv.perfil; base.draft = ''; }
    (cv.experiencia || []).forEach(x => { const t = base.exp[x.indice]; if (t) { if (x.puesto) t.title = x.puesto; if (x.descripcion) t.desc = x.descripcion; } });
    (cv.proyectos || []).forEach(x => { const t = base.projects[x.indice]; if (t && x.descripcion) t.desc = x.descripcion; });
    if (cv.habilidades) base.skills = cv.habilidades;
    return base;
  }
  function proTplOpts() { return Object.assign(tplOpts(), { lang: PRO.rep.lang }); }
  function proScores() {
    const rep = PRO.rep, base = { country: rep.country || $('#country').value, company: rep.company || $('#company').value };
    const opts = Object.assign({}, base, { offer: rep.offer });
    const before = E.analyze({ text: rep.text, meta: rep.meta || {}, opts });
    const general = E.analyze({ text: rep.text, meta: rep.meta || {}, opts: Object.assign({}, base, { offer: '' }) }).total;
    const after = E.analyze({ text: T.toText(T.blocks(proMerged(), proTplOpts())), meta: Object.assign({}, rep.meta || {}, { fileType: 'pdf', columns: false, tables: 0, textBoxes: 0, headerFooterContact: false, tinyText: 0, spaced: 0, fonts: 2 }), opts });
    return { general, before: { total: before.total, kw: before.offer ? before.offer.score : 0 }, after: { total: after.total, kw: after.offer ? after.offer.score : 0 } };
  }

  function renderPro() {
    const v = $('#v-pro'); if (!v) return;
    // reclamo en el resumen y en ofertas
    $$('.pro-promo').forEach(x => x.remove());
    if (PRO.available && !state.sample) {
      const left = creditsLeft();
      const promo = '<div class="pro-promo"><div><span class="label">Informe Pro · ' + (left ? (left === 1 ? 'te queda 1 informe' : 'te quedan ' + left + ' informes') : PRO.price) + '</span><strong>Adapta tu CV a una oferta concreta</strong><p>CV reescrito para esa oferta, carta de presentación y encaje requisito a requisito, con la puntuación ATS antes y después.</p></div><button class="btn primary" type="button" data-goto-pro>' + (left ? 'Usar el Informe Pro' : 'Ver el Informe Pro') + '</button></div>';
      const first = $('#v-resumen > *'); if (first) first.insertAdjacentHTML('afterend', promo);
      const of = $('#v-ofertas'); if (of && of.firstElementChild) of.insertAdjacentHTML('beforeend', promo);
      $$('[data-goto-pro]').forEach(b => b.addEventListener('click', () => go('pro')));
    }
    if (!PRO.available) { v.innerHTML = '<div class="sheet"><h3>Informe Pro</h3><p class="lede">El informe de pago no está disponible en esta versión.</p></div>'; return; }
    if (PRO.view === 'generating') return; // el panel de progreso ya está en pantalla
    if (PRO.view === 'error') { renderProError(v); return; }
    if (PRO.view === 'report' && PRO.rep) { renderProResult(v); return; }
    renderProForm(v);
  }
  // caja con la compra activa: lo que queda, hasta cuándo y el enlace para usarla en otro navegador
  function purchaseBox() {
    const act = PRO.wallet.filter(w => w.estado === 'pagado' && w.restantes > 0).sort((a, b) => a.at - b.at);
    const pend = PRO.wallet.filter(w => w.estado === 'pendiente');
    if (!act.length && !pend.length) return '';
    return '<div class="pro-wallet">' + act.map(w => '<div><strong>' + (w.restantes === 1 ? 'Te queda 1 informe' : 'Te quedan ' + w.restantes + ' informes') + '</strong> de tu compra del ' + fmtDay(w.at) + (w.caduca ? ', hasta el ' + fmtDay(w.caduca) : '') + ' <span class="small muted">· pedido ' + h(shortId(w.id)) + '</span>' +
      '<div class="small">Guarda tu <button class="linkbtn" type="button" data-recover="' + h(w.id) + '">enlace de la compra</button>: con él puedes usar los informes que te quedan en otro navegador o dispositivo. Es personal, no lo compartas.</div></div>').join('') +
      (pend.length && !act.length ? '<div class="small">Hay un pago iniciado que todavía no figura como completado. Si has pagado, espera unos segundos y <button class="linkbtn" type="button" id="proCheckPend">vuelve a comprobarlo</button>.</div>' : '') + '</div>';
  }
  function reportsList() {
    if (!PRO.reports.length) return '';
    return '<div class="sheet"><h3>Tus informes en este navegador</h3><ul class="pro-reports">' + PRO.reports.map(r => '<li><button class="linkbtn" type="button" data-open-rep="' + h(r.rid) + '">' + h(r.title) + '</button><span class="small muted">' + h(r.cvName || '') + ' · ' + (r.lang === 'en' ? 'inglés' : 'español') + ' · ' + new Date(r.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</span></li>').join('') + '</ul><p class="small muted">Se guardan solo en este navegador. Puedes borrarlos desde cada informe.</p></div>';
  }
  function bindCommon(v) {
    $$('[data-recover]', v).forEach(b => b.addEventListener('click', () => { copyText(recoveryUrl(b.dataset.recover)); toast('Enlace copiado: guárdalo en un lugar seguro'); }));
    $$('[data-open-rep]', v).forEach(b => b.addEventListener('click', () => reportOpen(b.dataset.openRep)));
    const cp = $('#proCheckPend', v); if (cp) cp.addEventListener('click', async () => { await walletRefresh(); renderPro(); renderNav(); });
  }
  function renderProForm(v) {
    const d = PRO.draft || (PRO.draft = {});
    const offer = d.offer != null ? d.offer : (getOffers()[0] || '');
    const lang = proLang(), cr = credit(), left = creditsLeft();
    const hero = cr ? '' : '<div class="sheet pro-hero"><span class="label">Informe Pro · pago único de ' + PRO.price + '</span><h3>Tu CV adaptado a la oferta que te interesa</h3>' +
      '<p class="lede">El análisis gratuito te dice qué falla en tu CV. El Informe Pro lo arregla para una oferta concreta: reescribe tu perfil y tus experiencias con las palabras clave que busca esa empresa, escribe la carta de presentación y te dice, requisito a requisito, cómo encajas.</p>' +
      '<div class="pro-feats">' +
      '<div><strong>CV reescrito para la oferta</strong><p>Perfil, titular, experiencias y habilidades adaptados. Descárgalo en PDF o Word, con enlaces clicables. No inventa nada: si falta un dato, te lo marca.</p></div>' +
      '<div><strong>Carta de presentación</strong><p>Personalizada con tus logros reales y lo que pide la oferta. Editable, en PDF o Word.</p></div>' +
      '<div><strong>Encaje y puntuación ATS</strong><p>Cada requisito, marcado como «cumple», «parcial» o «no cumple», con la puntuación ATS antes y después de adaptar el CV.</p></div></div>' +
      '<p class="small"><strong>Cada compra incluye ' + PRO.max + ' informes durante 30 días</strong>, para la misma oferta o para otras, con este CV o con otro.</p>' +
      '<div class="tablewrap"><table class="cmp pro-cmp"><thead><tr><th></th><th>Gratis</th><th>Informe Pro</th></tr></thead><tbody>' +
      [['Puntuación ATS, puntos fuertes y débiles', 1, 1], ['Coincidencia de palabras clave con ofertas', 1, 1], ['Datos para copiar y CV en formato ATS', 1, 1], ['Versión en inglés (traducción manual)', 1, 1], ['CV reescrito para una oferta concreta', 0, 1], ['Carta de presentación personalizada', 0, 1], ['Encaje requisito a requisito y ATS antes/después', 0, 1], ['Resultado en español o en inglés', 0, 1]]
        .map(([t, a, b]) => '<tr><td>' + t + '</td><td>' + (a ? '<span class="yes">Sí</span>' : '<span class="no">—</span>') + '</td><td>' + (b ? '<span class="yes">Sí</span>' : '—') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
    v.innerHTML = hero + '<div class="sheet"><h3>' + (cr ? 'Nuevo informe' : 'Prepara tu informe') + '</h3>' + purchaseBox() +
      (state.sample ? '<p class="banner">Primero sube tu CV con «Subir CV»: el informe se hace sobre tu currículum, no sobre el de ejemplo.</p>' : '<p class="small muted">Se usará el CV que tienes cargado ahora: <strong>' + h(cvLabel()) + '</strong>. Si quieres usar otro, súbelo antes con «Subir CV».</p>') +
      '<div class="field"><label class="label" for="proOffer">Oferta de trabajo</label><textarea id="proOffer" rows="8" placeholder="Pega la oferta completa: título del puesto, empresa, funciones y requisitos">' + h(offer) + '</textarea><span class="small muted" id="proOfferHint"></span></div>' +
      '<div class="field pro-lang"><label class="label" for="proLang">Idioma del informe</label><select id="proLang"><option value="es"' + (lang === 'es' ? ' selected' : '') + '>Español</option><option value="en"' + (lang === 'en' ? ' selected' : '') + '>Inglés</option></select></div>' +
      '<label class="toggle consent"><input type="checkbox" id="proC1"' + (d.c1 ? ' checked' : '') + '> <span>Acepto que el texto de mi CV (sin mi nombre ni mis datos de contacto) y la oferta se envíen a Anthropic, el proveedor de IA, solo para generar este informe. No se guardan en esta web. <a href="privacidad.html#informe-pro" target="_blank" rel="noopener">Más información</a></span></label>' +
      (cr ? '' : '<label class="toggle consent"><input type="checkbox" id="proC2"' + (d.c2 ? ' checked' : '') + '> <span>Quiero recibir el informe en cuanto pague y acepto que, una vez generado, pierdo el derecho de desistimiento. <a href="condiciones.html" target="_blank" rel="noopener">Condiciones de venta</a></span></label>') +
      '<div class="toolbar">' + (cr ? '<button class="btn primary" type="button" id="proUse" disabled>Generar el informe (usa 1 de ' + left + ')</button><span class="small muted">Ya está pagado: no se te cobrará nada.</span>'
        : '<button class="btn primary" type="button" id="proPay" disabled>Pagar ' + PRO.price + ' y generar el informe</button><span class="small muted">Pago seguro con Stripe · IVA incluido · ' + PRO.max + ' informes durante 30 días</span>') + '</div>' +
      (IDB_OK === false && !cr ? '<p class="small notice-storage">Tu navegador no deja guardar datos de esta web (modo privado o almacenamiento bloqueado). Puedes comprar igual, pero al volver del pago tendrás que subir de nuevo el CV y pegar la oferta, y si cierras la pestaña perderás el acceso: guarda el «enlace de la compra» que aparecerá.</p>' : '') +
      '<p class="small pro-why" id="proWhy" aria-live="polite"></p><p class="small" id="proMsg" role="status"></p>' +
      (cr ? '<p class="small muted">¿Quieres más informes? <button class="linkbtn" type="button" id="proBuyMore">Comprar otra compra de ' + PRO.max + ' (' + PRO.price + ')</button></p>' : '') + '</div>' +
      (PRO.rep ? '<p class="small"><button class="linkbtn" type="button" id="proBack">← Volver al último informe</button></p>' : '') + reportsList();
    const btn = $('#proUse') || $('#proPay');
    const upd = ev => {
      const t = $('#proOffer').value.trim(), c1 = $('#proC1').checked, c2 = cr ? true : $('#proC2').checked;
      if (ev) Object.assign(d, { offer: $('#proOffer').value, lang: $('#proLang').value, c1, c2: cr ? d.c2 : c2 });   // solo lo que escribe la persona
      $('#proOfferHint').textContent = t.length && t.length < 150 ? 'Pega la oferta completa (título, funciones y requisitos): faltan unos ' + (150 - t.length) + ' caracteres.' : '';
      // explica qué falta, en lugar de dejar el botón desactivado sin más
      const why = state.sample ? 'Para continuar, sube primero tu CV con «Subir CV».' : state.r && state.r.doc && state.r.doc.verdict === 'not_cv' ? 'El documento analizado no parece un CV. Sube tu CV con «Subir CV» para generar el Informe Pro.' : !t ? 'Para continuar, pega la oferta de trabajo.' : t.length < 150 ? 'Para continuar, pega la oferta completa.' : !c1 || !c2 ? (cr ? 'Para continuar, marca la casilla.' : 'Para continuar, marca las dos casillas.') : '';
      $('#proWhy').textContent = why; btn.disabled = !!why;
    };
    $('#proLang').addEventListener('change', upd);
    ['#proOffer', '#proC1', '#proC2'].forEach(s => { const el = $(s); if (el) { el.addEventListener('input', upd); el.addEventListener('change', upd); } });
    upd();
    if (cr) $('#proUse').addEventListener('click', () => { const job = Object.assign(cvSnapshot(), { session: cr.id, offer: $('#proOffer').value.trim(), lang: $('#proLang').value }); PRO.draft = null; proGenerate(job); });
    else $('#proPay').addEventListener('click', proCheckout);
    if ($('#proBuyMore')) $('#proBuyMore').addEventListener('click', () => { PRO.forceBuy = true; renderProBuy(v); });
    if ($('#proBack')) $('#proBack').addEventListener('click', () => { PRO.view = 'report'; renderPro(); });
    bindCommon(v);
  }
  // compra adicional aunque queden informes (formulario de pago con los mismos datos)
  function renderProBuy(v) {
    const keep = PRO.wallet; PRO.wallet = []; renderProForm(v); PRO.wallet = keep;
    const s = v.querySelector('.sheet:not(.pro-hero) h3'); if (s) s.textContent = 'Comprar ' + PRO.max + ' informes más';
  }
  async function proCheckout() {
    const btn = $('#proPay'), msg = $('#proMsg');
    btn.disabled = true; msg.className = 'small'; msg.textContent = 'Preparando el pago seguro…';
    const pending = Object.assign(cvSnapshot(), { label: state.label, tpl: state.tpl, offer: $('#proOffer').value.trim(), lang: $('#proLang').value, at: Date.now() });
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || 'stripe_no_disponible');
      // se apunta la compra antes de salir: si se cierra la pestaña tras pagar, al volver se recupera
      pending.checkoutId = d.id; await idbSet('pro-pending', pending); await walletAdd(d.id, 'pendiente');
      PRO.draft = null;
      location.href = d.url;
    } catch (e) {
      msg.className = 'small err'; msg.textContent = PRO_ERR[e.message] || PRO_ERR.stripe_no_disponible; btn.disabled = false;
    }
  }
  function restoreCv(p) {
    if (!p || !p.text) return;
    state.text = p.text; state.meta = p.meta || {}; state.label = p.label || p.cvName || ''; state.sample = false;
    state.edit = p.edit || null; state.trans = p.trans || {}; if (p.tpl) state.tpl = p.tpl;
    if (p.country && D.COUNTRIES[p.country]) $('#country').value = p.country;
    if (p.company && D.COMPANY_TYPES[p.company]) $('#company').value = p.company;
    run(false);
  }
  // al volver de Stripe (o al abrir el enlace de una compra)
  async function proReturn(param) {
    try { history.replaceState(null, '', location.pathname + '#pro'); } catch (e) { }
    const p = await idbGet('pro-pending');
    go('pro');
    if (param === 'cancelado') {
      restoreCv(p); PRO.draft = p ? { offer: p.offer, lang: p.lang } : null; PRO.view = 'form'; renderPro();
      toast('Pago cancelado: no se ha cobrado nada'); return;
    }
    await walletAdd(param, 'pendiente'); await walletRefresh(param); renderNav();
    const w = PRO.wallet.find(x => x.id === param);
    // vuelta directa del pago: se genera el informe con el CV y la oferta que se dejaron preparados
    if (p && p.checkoutId === param && !p.done) {
      restoreCv(p);
      await proGenerate(Object.assign({}, p, { session: param }), true);
      return;
    }
    // enlace de recuperación: la compra queda disponible en este navegador
    PRO.view = 'form'; renderPro();
    if (w && w.estado === 'pagado') toast(w.restantes ? 'Compra recuperada: ' + (w.restantes === 1 ? 'te queda 1 informe' : 'te quedan ' + w.restantes + ' informes') : 'Esta compra ya no tiene informes disponibles');
    else if (w && w.estado === 'pendiente') toast('El pago de este pedido todavía no figura como completado');
    else toast('No encuentro esa compra');
  }
  function proProgress(v) {
    v.innerHTML = '<div class="analyzing pro-gen"><div class="an-doc" aria-hidden="true">' + $('#analyzing .an-doc').innerHTML + '</div><div class="an-body"><span class="label">Informe Pro</span><strong>Generando tu informe</strong><div class="an-progress" aria-hidden="true"><i id="proBar"></i></div><ol class="an-steps" id="proSteps">' + PRO_STEPS.map(s => '<li>' + h(s) + '</li>').join('') + '</ol><p class="small muted">Suele tardar entre 30 y 90 segundos. No cierres esta pestaña.</p></div><p class="sr-only" id="proLive" role="status" aria-live="polite"></p></div>';
  }
  function proStep(i, pct) {
    $$('#proSteps li').forEach((li, k) => { li.className = k < i ? 'ok' : k === i ? 'on' : ''; });
    const bar = $('#proBar'); if (bar) bar.style.width = Math.max(4, Math.min(98, pct)) + '%';
    const live = $('#proLive'); if (live && PRO_STEPS[i] && live.textContent !== PRO_STEPS[i]) live.textContent = PRO_STEPS[i] + '…';
  }
  async function proGenerate(job, fromCheckout) {
    if (PRO.view === 'generating') return;
    PRO.view = 'generating'; PRO.job = job; PRO.err = null;
    const v = $('#v-pro'); proProgress(v); proStep(0, 4);
    let acc = '', txt = '', think = 0, step = 0, extra = null;
    try {
      const r = await fetch('/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session_id: job.session, offer: job.offer, lang: job.lang, country: (D.COUNTRIES[job.country] || {}).name || '', cv: proCvPayload(job.edit) }) });
      if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'ia_no_disponible'); }
      step = 1; proStep(1, 8);
      const reader = r.body.getReader(), dec = new TextDecoder(); let buf = '', ended = false, ev = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
          if (line.startsWith('event:')) { ev = line.slice(6).trim(); continue; }
          if (!line.startsWith('data:')) continue;
          let d; try { d = JSON.parse(line.slice(5)); } catch (e) { continue; }
          if (ev === 'informe_pro') extra = d;
          else if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'input_json_delta') acc += d.delta.partial_json || '';
          else if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'text_delta') txt += d.delta.text || '';
          else if (d.type === 'content_block_delta' && d.delta && d.delta.type === 'thinking_delta') think += (d.delta.thinking || '').length;
          else if (d.type === 'message_stop') ended = true;
          else if (d.type === 'error') throw new Error(d.error && /overload/i.test(d.error.type || '') ? 'ia_saturada' : 'ia_no_disponible');
        }
        const all = acc + txt;
        const ns = all.includes('"carta"') ? 4 : all.includes('"cv"') ? 3 : all.includes('"requisitos"') || think > 4000 ? 2 : 1;
        if (ns > step) step = ns;
        proStep(step, 8 + Math.min(22, think / 400) + Math.min(66, all.length / 120));
      }
      if (!ended) throw new Error('red');
      // normalmente llega como llamada a la herramienta; si el modelo respondió con el JSON en texto, se acepta también
      let res = null;
      try { res = JSON.parse(acc); } catch (e) { const a = txt.indexOf('{'), b = txt.lastIndexOf('}'); if (a >= 0 && b > a) { try { res = JSON.parse(txt.slice(a, b + 1)); } catch (x) { res = null; } } }
      if (!res || !res.cv || !res.carta || !res.encaje) throw new Error('ia_no_disponible');
      const rep = { rid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), session: job.session, title: offerTitle(job.offer), offer: job.offer, lang: job.lang, cvLang: job.cvLang, cvName: job.cvName, edit: job.edit, trans: job.trans, text: job.text, meta: job.meta, country: job.country, company: job.company, result: res, at: Date.now() };
      await reportSave(rep);
      const w = await walletAdd(job.session, 'pagado');
      if (w) { w.estado = 'pagado'; if (extra) { w.restantes = Math.max(0, (extra.max || PRO.max) - extra.generaciones); w.caduca = extra.caduca || w.caduca; if (!w.restantes) w.estado = 'agotado'; } await walletSave(); }
      if (fromCheckout) { const p = await idbGet('pro-pending'); if (p && p.checkoutId === job.session) await idbDel('pro-pending'); }
      proStep(5, 100);
      await wait(reduceMotion() ? 0 : 350);
      PRO.rep = rep; PRO.view = 'report'; PRO.job = null;
      renderPro(); renderNav();
      if (!reduceMotion()) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
      toast('Informe listo');
    } catch (e) {
      console.error(e);
      PRO.err = e && e.message in PRO_ERR ? e.message : (e && e.name === 'TypeError' ? 'red' : 'ia_no_disponible');
      PRO.view = 'error';
      // si el pedido ya no sirve, se actualiza el monedero para no ofrecerlo otra vez
      if (/limite_generaciones|pedido_caducado|pedido_reembolsado|pedido_no/.test(PRO.err)) await walletRefresh(job.session);
      renderPro(); renderNav();
    }
  }
  function renderProError(v) {
    const job = PRO.job, retry = !/limite_generaciones|pedido_caducado|pedido_reembolsado|pedido_no/.test(PRO.err) && job;
    v.innerHTML = '<div class="sheet"><h3>No se ha podido generar el informe</h3><p class="lede">' + h(PRO_ERR[PRO.err] || PRO_ERR.ia_no_disponible) + '</p>' +
      '<div class="toolbar">' + (retry ? '<button class="btn primary" type="button" id="proRetry">Reintentar</button>' : '') + '<button class="btn" type="button" id="proToForm">Volver</button><a class="btn" href="mailto:' + SUPPORT + '?subject=' + encodeURIComponent('Informe Pro · pedido ' + shortId(job && job.session)) + '">Escribir al soporte</a></div>' +
      (job ? '<p class="small muted">Pedido ' + h(shortId(job.session)) + ' · CV: ' + h(job.cvName || '') + '</p>' : '') + '</div>' + reportsList();
    bindCommon(v);
    if ($('#proRetry')) $('#proRetry').addEventListener('click', () => proGenerate(job));
    $('#proToForm').addEventListener('click', () => { PRO.view = PRO.rep ? 'report' : 'form'; if (job) PRO.draft = { offer: job.offer, lang: job.lang, c1: true }; renderPro(); });
  }
  const ST = { cumple: ['ok', 'Cumple'], parcial: ['warn', 'Parcial'], no_cumple: ['bad', 'No cumple'] };
  function renderProResult(v) {
    const rep = PRO.rep, res = rep.result, en = res.encaje || {}, sc = proScores(), m = proMerged(), letter = res.carta || {};
    const left = creditsLeft();
    const otherCv = !state.sample && state.text && state.text !== rep.text;
    const delta = (a, b, unit) => '<div class="delta"><span class="num">' + a + unit + '</span><span aria-hidden="true">→</span><b class="num">' + b + unit + '</b>' + (b > a ? '<em>+' + (b - a) + '</em>' : '') + '</div>';
    const reqs = (en.requisitos || []).map(r => '<li class="check s-' + (ST[r.estado] || ST.parcial)[0] + '"><span class="pill ' + (ST[r.estado] || ST.parcial)[0] + '">' + (ST[r.estado] || ST.parcial)[1] + '</span><div><strong>' + h(r.requisito) + (r.tipo === 'imprescindible' ? ' <span class="small muted">· imprescindible</span>' : '') + '</strong><p>' + h(r.evidencia) + '</p></div></li>').join('');
    const missing = (en.palabras_clave_faltan || []).map(k => '<span class="chip kw">' + h(k) + '</span>').join('');
    const tips = (en.consejos || []).map(t => '<li>' + h(t) + '</li>').join('');
    const warns = (res.avisos || []).map(t => '<li>' + h(t) + '</li>').join('');
    const cv = res.cv || {};
    const expEd = (cv.experiencia || []).map(x => { const o = m.exp[x.indice]; return o ? '<div class="cf"><label class="label" for="pe' + x.indice + '">' + h([o.title, o.company].filter(Boolean).join(' — ')) + '</label><textarea id="pe' + x.indice + '" rows="' + Math.min(8, Math.max(3, String(x.descripcion || '').split('\n').length + 1)) + '" data-pro="exp.' + x.indice + '">' + h(x.descripcion) + '</textarea><div class="side"><button class="btn small" type="button" data-copy="pe' + x.indice + '">Copiar</button></div></div>' : ''; }).join('');
    v.innerHTML = '<div class="sheet pro-head"><div><span class="label">Informe Pro · ' + (rep.lang === 'en' ? 'en inglés' : 'en español') + ' · ' + new Date(rep.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</span><h3>' + h(rep.title) + '</h3><p class="small muted">CV usado: <strong>' + h(rep.cvName || '') + '</strong>. Revisa todo antes de enviarlo: la IA puede equivocarse, y lo que va entre corchetes tienes que completarlo tú.</p></div>' +
      (otherCv ? '<p class="banner">Ahora tienes cargado otro CV (<strong>' + h(cvLabel()) + '</strong>). Este informe sigue siendo del CV anterior. ' + (left ? 'Para adaptar el nuevo, pulsa «Nuevo informe».' : '') + '</p>' : '') +
      '<div class="pro-actions"><button class="btn primary" type="button" id="proNew">' + (left ? 'Nuevo informe (te ' + (left === 1 ? 'queda 1' : 'quedan ' + left) + ')' : 'Comprar más informes') + '</button><button class="btn" type="button" id="proForget">Borrar este informe</button></div>' + purchaseBox() + '</div>' +
      '<div class="cols"><div class="sheet"><h3>Encaje con la oferta</h3><div class="pro-score"><div class="pro-ring" style="--v:' + (en.puntuacion || 0) + '"><b class="num">' + (en.puntuacion || 0) + '</b><small>/100</small></div><p>' + h(en.veredicto || '') + '</p></div>' +
      '<div class="pro-deltas"><div><span class="label">Palabras clave de la oferta</span>' + delta(sc.before.kw, sc.after.kw, ' %') + '</div><div><span class="label">Puntuación con esta oferta</span>' + delta(sc.before.total, sc.after.total, '') + '</div></div>' +
      '<p class="small muted">Antes: tu CV original. Después: el CV adaptado. Ambos medidos por el analizador frente a esta oferta.' + (sc.general !== sc.before.total ? ' Sin ninguna oferta, ese CV obtiene <b>' + sc.general + '/100</b> (la puntuación general); con esta oferta ' + (sc.before.total < sc.general ? 'baja' : 'cambia') + ' a ' + sc.before.total + ' porque se suma cuánto coincide con lo que pide.' : '') + '</p>' +
      (sc.after.kw < sc.before.kw ? '<p class="small muted">Las palabras clave han bajado: al reescribir se han quedado fuera términos que sí estaban en tu CV. Revisa el perfil, las experiencias y las habilidades, y recupera los que quieras mantener antes de descargarlo.</p>'
        : sc.after.kw === sc.before.kw ? '<p class="small muted">Las palabras clave no suben porque las que faltan no aparecen en tu experiencia, y el informe no las añade por ti. Si de verdad las dominas, inclúyelas tú: las tienes en «Antes de enviar».</p>' : '') + '</div>' +
      '<div class="sheet"><h3>Antes de enviar</h3>' + (tips ? '<ol class="prio">' + tips + '</ol>' : '') + (missing ? '<p class="label" style="margin-top:12px">Palabras de la oferta que no aparecen en tu CV</p><div class="chips">' + missing + '</div><p class="small muted">Añádelas solo si de verdad tienes esa experiencia.</p>' : '') + (warns ? '<div class="callout warn"><strong>Completa o comprueba</strong><ul>' + warns + '</ul></div>' : '') + '</div></div>' +
      '<div class="sheet"><h3>Requisito a requisito</h3><ul class="checks">' + (reqs || '<li>No se han identificado requisitos.</li>') + '</ul></div>' +
      '<div class="sheet"><h3>Tu CV adaptado</h3><p class="lede">Puedes retocar cualquier texto: las descargas usan lo que ves aquí. Formación, idiomas y contacto salen de tus datos.</p>' +
      '<div class="cf"><label class="label" for="pTit">Titular</label><input type="text" id="pTit" data-pro="titular" value="' + h(cv.titular || '') + '"><div class="side"><button class="btn small" type="button" data-copy="pTit">Copiar</button></div></div>' +
      '<div class="cf"><label class="label" for="pPer">Perfil</label><textarea id="pPer" rows="5" data-pro="perfil">' + h(cv.perfil || '') + '</textarea><div class="side"><button class="btn small" type="button" data-copy="pPer">Copiar</button></div></div>' + expEd +
      '<div class="cf"><label class="label" for="pHab">Habilidades</label><textarea id="pHab" rows="3" data-pro="habilidades">' + h(cv.habilidades || '') + '</textarea><div class="side"><button class="btn small" type="button" data-copy="pHab">Copiar</button></div></div>' +
      '<div class="toolbar">' + (DL ? '<button class="btn primary" type="button" id="proCvPdf">Descargar CV en PDF</button><button class="btn" type="button" id="proCvDocx">Descargar CV en Word</button>' : '') + '<button class="btn" type="button" id="proCvTxt">Copiar CV como texto</button></div></div>' +
      '<div class="sheet"><h3>Carta de presentación</h3>' +
      '<div class="cf"><label class="label" for="pAs">Asunto</label><input type="text" id="pAs" data-pro="carta.asunto" value="' + h(letter.asunto || '') + '"><div class="side"><button class="btn small" type="button" data-copy="pAs">Copiar</button></div></div>' +
      '<div class="cf"><label class="label" for="pCarta">Carta</label><textarea id="pCarta" rows="14" data-pro="carta.texto">' + h(proLetterText(letter)) + '</textarea><div class="side"><button class="btn small" type="button" data-copy="pCarta">Copiar</button></div></div>' +
      '<div class="toolbar">' + (DL ? '<button class="btn primary" type="button" id="proLetPdf">Descargar carta en PDF</button><button class="btn" type="button" id="proLetDocx">Descargar carta en Word</button>' : '') + '</div></div>' + reportsList();
    $$('#v-pro [data-pro]').forEach(inp => inp.addEventListener('input', () => { proApplyEdit(inp.dataset.pro, inp.value); proSaveSoon(); }));
    $$('#v-pro [data-copy]').forEach(b => b.addEventListener('click', () => { const el = document.getElementById(b.dataset.copy); copyText(el.value, el); }));
    $('#proNew').addEventListener('click', () => { PRO.view = 'form'; PRO.draft = { offer: '', lang: rep.lang }; renderPro(); const o = $('#proOffer'); if (o) { o.scrollIntoView({ block: 'center' }); o.focus(); } });
    $('#proForget').addEventListener('click', async () => {
      if (!confirm('Se borrará este informe de este navegador. Los informes que te queden de tu compra no se pierden. ¿Borrarlo?')) return;
      await reportDelete(rep.rid); renderPro(); toast('Informe borrado');
    });
    bindCommon(v);
    const base = (rep.edit.name || 'CV').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'CV';
    const sfx = rep.lang === 'en' ? '-EN' : '';
    $('#proCvTxt').addEventListener('click', () => copyText(T.toText(T.blocks(proMerged(), proTplOpts()))));
    if (DL) {
      $('#proCvPdf').addEventListener('click', async () => { try { const L = await window.CV_LIBS.pdflib(); await DL(await T.toPdf(T.blocks(proMerged(), proTplOpts()), proTplOpts(), L), base + '-CV-oferta' + sfx + '.pdf'); } catch (e) { console.error(e); toast('No se pudo generar el PDF'); } });
      $('#proCvDocx').addEventListener('click', async () => { try { const Z = await window.CV_LIBS.jszip(); await DL(await T.toDocx(T.blocks(proMerged(), proTplOpts()), proTplOpts(), Z), base + '-CV-oferta' + sfx + '.docx'); } catch (e) { toast('No se pudo generar el Word'); } });
      $('#proLetPdf').addEventListener('click', async () => { try { const L = await window.CV_LIBS.pdflib(); await DL(await T.toPdf(proLetterBlocks(), proTplOpts(), L), base + '-carta' + sfx + '.pdf'); } catch (e) { console.error(e); toast('No se pudo generar el PDF'); } });
      $('#proLetDocx').addEventListener('click', async () => { try { const Z = await window.CV_LIBS.jszip(); await DL(await T.toDocx(proLetterBlocks(), proTplOpts(), Z), base + '-carta' + sfx + '.docx'); } catch (e) { toast('No se pudo generar el Word'); } });
    }
  }
  const proLetterText = c => c.texto != null ? c.texto : [c.saludo, c.cuerpo, c.despedida, ((PRO.rep && PRO.rep.edit) || state.edit || {}).name].filter(Boolean).join('\n\n');
  function proLetterBlocks() {
    const e = PRO.rep.edit, c = PRO.rep.result.carta;
    const B = [{ t: 'name', text: e.name || '' }, { t: 'contact', text: [e.location, e.phone, e.email, e.linkedin, e.web].filter(Boolean).join('  ·  ') }];
    if (c.asunto) B.push({ t: 'h', text: c.asunto });
    proLetterText(c).split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).forEach(p => B.push({ t: 'p', text: p }));
    return B;
  }
  function proApplyEdit(path, val) {
    const r = PRO.rep.result, cv = r.cv;
    if (path === 'titular' || path === 'perfil' || path === 'habilidades') cv[path] = val;
    else if (path.startsWith('exp.')) { const i = +path.slice(4), x = (cv.experiencia || []).find(y => y.indice === i); if (x) x.descripcion = val; }
    else if (path === 'carta.asunto') r.carta.asunto = val;
    else if (path === 'carta.texto') r.carta.texto = val;
  }
  let proSaveT = 0;
  function proSaveSoon() { clearTimeout(proSaveT); proSaveT = setTimeout(() => { if (PRO.rep) idbSet('pro-report:' + PRO.rep.rid, PRO.rep); }, 600); }
  // migración de la primera versión (un solo informe por compra en pro-result:<sesión>)
  async function proMigrate() {
    const last = await idbGet('pro-last'); if (!last) return;
    const old = await idbGet('pro-result:' + last);
    if (old && old.result) {
      await walletAdd(last, 'pagado');
      await reportSave({ rid: 'm' + Date.now().toString(36), session: last, title: offerTitle(old.offer), offer: old.offer, lang: old.lang, cvLang: old.cvLang, cvName: (old.meta && old.meta.fileName) || 'tu CV', edit: old.edit, trans: old.trans, text: old.text, meta: old.meta, result: old.result, at: old.at || Date.now() });
    }
    await idbDel('pro-result:' + last); await idbDel('pro-last');
  }
  async function proInit() {
    if (BUILD !== 'selfhost') return;
    try {
      const r = await fetch('/api/estado', { headers: { accept: 'application/json' } });
      const d = r.ok ? await r.json() : null;
      PRO.available = !!(d && d.disponible);
    } catch (e) { PRO.available = false; }
    if (!PRO.available) { const navA = $('#tabs a[data-view="pro"]'); if (navA) navA.hidden = true; badge('pro', null); return; }
    await idbProbe();
    const navA = $('#tabs a[data-view="pro"]'); if (navA) navA.hidden = false;
    PRO.wallet = (await idbGet('pro-wallet')) || [];
    await proMigrate(); await reportsLoad();
    const cur = await idbGet('pro-current'), rep = cur && await idbGet('pro-report:' + cur);
    if (rep) { PRO.rep = rep; PRO.view = 'report'; }
    const q = new URLSearchParams(location.search).get('pro');
    if (q) { await proReturn(q); return; }
    // también recupera un pago que terminó con la pestaña cerrada
    await walletRefresh(); renderNav();
    const p = await idbGet('pro-pending');
    if (p && p.checkoutId && !p.done) { const w = PRO.wallet.find(x => x.id === p.checkoutId); if (w && w.estado === 'pagado' && w.restantes > 0) { PRO.draft = { offer: p.offer, lang: p.lang, c1: true }; if (!PRO.rep) PRO.view = 'form'; toast('Tienes un Informe Pro pagado pendiente de generar'); } }
    if (state.r) renderPro();
  }

  // ---------- navegación ----------
  function go(view, push) {
    if (!VIEWS.includes(view)) view = 'resumen';
    const prev = VIEWS.find(v => !$('#v-' + v).hidden);
    VIEWS.forEach(v => { $('#v-' + v).hidden = v !== view; });
    if (prev && prev !== view && !reduceMotion()) { const el = $('#v-' + view); el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
    $$('#tabs a').forEach(a => { if (a.dataset.view === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (push !== false && location.hash !== '#' + view) { try { history.replaceState(null, '', '#' + view); } catch (e) { location.hash = view; } }
  }

  // ---------- carga de archivos ----------
  // ---------- análisis en curso ----------
  const STEPS = {
    file: ['Leyendo el archivo', 'Detectando secciones, puestos y fechas', 'Comprobando filtros ATS e IA', 'Calculando puntuaciones y recomendaciones'],
    text: ['Leyendo el texto', 'Detectando secciones, puestos y fechas', 'Comprobando filtros ATS e IA', 'Calculando puntuaciones y recomendaciones'],
    offers: ['Leyendo las ofertas', 'Buscando palabras clave y requisitos', 'Comparando con tu CV', 'Actualizando el informe']
  };
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  let busy = false;
  // Muestra el panel de análisis mientras se ejecuta work(step) y luego descubre el informe con una transición.
  // minMs evita que el panel aparezca y desaparezca de golpe cuando el análisis es casi instantáneo.
  async function withLoading(kind, name, minMs, work) {
    if (busy) return false;
    busy = true;
    const steps = STEPS[kind], rm = reduceMotion(), t0 = performance.now(), box = $('#analyzing');
    $('#anKicker').textContent = kind === 'offers' ? 'Comparando con las ofertas' : 'Analizando tu CV';
    $('#anName').textContent = name;
    $('#anSteps').innerHTML = steps.map(s => '<li>' + h(s) + '</li>').join('');
    let cur = -1;
    const step = i => {
      if (i <= cur) return; cur = Math.min(i, steps.length - 1);
      $$('#anSteps li').forEach((li, k) => { li.className = k < cur ? 'ok' : k === cur ? 'on' : ''; });
      $('#anBar').style.width = Math.round((cur + .5) / steps.length * 100) + '%';
      $('#anLive').textContent = steps[cur] + '…';
    };
    document.body.classList.remove('cv-reveal');
    document.body.classList.add('is-loading'); $('.report').classList.add('is-loading'); $('.report').setAttribute('aria-busy', 'true');
    box.hidden = false; step(0);
    const r = box.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight - 120) box.scrollIntoView({ block: 'center', behavior: rm ? 'auto' : 'smooth' });
    let err = null;
    try { await work(step); } catch (e) { err = e; }
    if (!err) {
      // cada paso se ve al menos un momento: se reparten a lo largo de minMs (o enseguida si el análisis ya tardó)
      const min = rm ? 250 : minMs, until = ms => wait(Math.max(0, t0 + ms - performance.now()));
      for (let i = cur + 1; i < steps.length; i++) { await until(min * i / steps.length); step(i); }
      await until(min);
      $$('#anSteps li').forEach(li => { li.className = 'ok'; }); $('#anBar').style.width = '100%';
      await wait(rm ? 0 : 260);
    }
    box.hidden = true;
    document.body.classList.remove('is-loading'); $('.report').classList.remove('is-loading'); $('.report').removeAttribute('aria-busy');
    busy = false;
    if (err) throw err;
    if (!rm) { document.body.classList.add('cv-reveal'); countUp($('#scoreboard .big')); setTimeout(() => document.body.classList.remove('cv-reveal'), 1300); }
    return true;
  }
  // la puntuación global sube desde 0 hasta su valor
  function countUp(el) {
    const node = el && el.firstChild; if (!node || node.nodeType !== 3) return;
    const to = parseInt(node.nodeValue, 10); if (!(to > 0)) return;
    const t0 = performance.now(), dur = 850;
    const tick = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); node.nodeValue = String(Math.round(to * e)); if (p < 1) requestAnimationFrame(tick); };
    node.nodeValue = '0'; requestAnimationFrame(tick);
  }

  let queued = null, notCvPending = null;
  // Antes de analizar, comprueba que el documento parece un CV. Si no, pregunta en lugar de mostrar un informe sin sentido.
  const notCvSignal = { notCv: true };
  function cvGate(text, meta, label) {
    const doc = E.analyze({ text, meta, opts: currentOpts() }).doc;
    if (doc && (doc.verdict === 'not_cv' || doc.verdict === 'doubt')) { notCvPending = { text, meta, label, doc }; throw notCvSignal; }
  }
  function showNotCv() {
    const p = notCvPending; if (!p) return;
    const reasons = p.doc.why.filter(w => !/^parece /.test(w)).slice(0, 2);
    const msg = p.doc.verdict === 'not_cv'
      ? '«' + p.label + '» no parece un CV' + (p.doc.kind ? ': parece ' + p.doc.kind : '') + '. Sube tu currículum en PDF o Word para analizarlo.'
      : 'No estamos seguros de que «' + p.label + '» sea un CV' + (reasons.length ? ': ' + reasons.join(' y ') : '') + '. Si es tu currículum, puedes analizarlo igualmente.';
    $('#notCvMsg').textContent = msg;
    $('#notCvBox').hidden = false; setStatus('');
    const r = $('#notCvBox').getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) $('#notCvBox').scrollIntoView({ block: 'center' });
  }
  function hideNotCv() { notCvPending = null; $('#notCvBox').hidden = true; }
  function applyDoc(text, meta, label) {
    state.text = text; state.meta = meta; state.sample = false; state.label = label;
    run(true); addVersion(label); go('resumen');
  }
  async function forceNotCv() {
    const p = notCvPending; if (!p) return;
    hideNotCv();
    const ok = await withLoading(p.meta.fileType === 'txt' && !p.meta.fileName ? 'text' : 'file', p.label, 900, async () => { await frame(); applyDoc(p.text, p.meta, p.label); });
    if (ok) setStatus('«' + p.label + '» analizado aunque no parece un CV.');
  }
  async function handleFile(file) {
    if (!file) return;
    if (busy) { queued = file; return; }   // si llega otro archivo durante el análisis, se analiza al terminar
    hideNotCv();
    if (file.size > 15 * 1024 * 1024) { setStatus('El archivo supera 15 MB. Un CV no debería pesar tanto: expórtalo de nuevo comprimiendo las imágenes.', 'err'); return; }
    setStatus('Leyendo «' + file.name + '»…', 'busy');
    let res;
    try {
      await withLoading('file', file.name, 1300, async step => {
        res = await window.CVExtract.fromFile(file);
        step(1); await frame();
        cvGate(res.text, res.meta, file.name);
        applyDoc(res.text, res.meta, file.name);
      });
      setStatus(res.text.trim().length < 300 ? '«' + file.name + '» leído, pero casi sin texto: revisa la sección «ATS e IA».' : '«' + file.name + '» analizado. El archivo no ha salido de tu navegador.', res.text.trim().length < 300 ? 'err' : '');
    } catch (e) {
      if (e === notCvSignal) showNotCv();
      else {
        console.error(e);
        const msg = String(e && e.message || ''), nm = String(e && e.name || '');
        setStatus(/password|contraseña/i.test(msg) || nm === 'PasswordException' ? 'El PDF está protegido con contraseña. Quita la protección y súbelo de nuevo.'
          : /invalid pdf|InvalidPDF|bad xref|corrupt|end of central directory|zip/i.test(msg + ' ' + nm) ? 'El archivo está dañado o no es del tipo que indica su extensión. Expórtalo de nuevo desde tu editor (PDF o DOCX) o pega el texto.'
          : msg && /[áéíóúñ]|^(El|La|No|Este|Ese)\b/.test(msg) ? msg : 'No se ha podido leer el archivo. Prueba a exportarlo de nuevo como PDF o DOCX, o pega el texto.', 'err');
      }
    }
    if (queued) { const q = queued; queued = null; handleFile(q); }
  }

  function init() {
    fillSelects();
    const drop = $('#drop');
    $('#file').addEventListener('change', e => handleFile(e.target.files[0]));
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));
    $('#analyzePasted').addEventListener('click', () => {
      const t = $('#pasted').value.trim();
      if (t.length < 50) { setStatus('Pega el texto completo del CV (al menos unas líneas).', 'err'); return; }
      hideNotCv();
      withLoading('text', 'Texto pegado', 1000, async () => {
        await frame();
        const meta = { fileType: 'txt', fileName: '' };
        cvGate(t, meta, 'Texto pegado');
        applyDoc(t, meta, 'Texto pegado');
      }).then(ok => { if (ok) setStatus('Texto analizado.'); }, e => { if (e === notCvSignal) showNotCv(); else console.error(e); });
    });
    $('#analyze').addEventListener('click', () => {
      const n = getOffers().length;
      withLoading('offers', n ? (n === 1 ? '1 oferta' : n + ' ofertas') : 'Sin ofertas pegadas', 800, async () => { await frame(); run(false); go(n > 1 ? 'ofertas' : 'resumen'); })
        .then(ok => { if (ok) toast('Análisis actualizado'); });
    });
    $('#notCvForce').addEventListener('click', forceNotCv);
    $('#addOffer').addEventListener('click', () => { addOfferBox(''); const t = $$('#moreOffers textarea').pop(); if (t) t.focus(); });
    $('#offer').addEventListener('input', scheduleSave);
    initSave();
    $('#country').addEventListener('change', e => { store.set('country', e.target.value); state.tpl.style = ''; run(false); });
    $('#company').addEventListener('change', e => { store.set('company', e.target.value); run(false); });
    $$('#tabs a, [data-goto]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); go(a.dataset.view || a.dataset.goto);
      const rep = $('.report'); if (rep && rep.getBoundingClientRect().top < 0) rep.scrollIntoView({ block: 'start' });
    }));
    // soltar un archivo en cualquier parte de la página
    document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length && !e.defaultPrevented) { e.preventDefault(); handleFile(e.dataTransfer.files[0]); } });
    window.addEventListener('hashchange', () => go(location.hash.slice(1), false));
    if (BUILD === 'selfhost') {
      $('#cdnNote').textContent = 'Todas las librerías (pdf.js, JSZip y pdf-lib) se sirven desde este mismo sitio: tu navegador no se conecta a terceros.';
      const links = window.CV_LEGAL_LINKS || [];
      $('#footLinks').innerHTML += links.map(([t, u]) => '<a href="' + h(u) + '"' + (/^https?:/.test(u) ? ' rel="noopener"' : '') + '>' + h(t) + '</a>').join('');
      $('#handoffNote').hidden = false;
      const br = $('.brand'); if (br) br.outerHTML = '<a class="brand" href="./" title="Ir a la página principal"><img src="assets/icon.svg" alt=""><b>' + br.innerHTML + '</b></a>';
      const au = window.CV_AUTHOR;
      if (au) { $('#legalOwner').innerHTML = 'Responsable del sitio: ' + h(au.name) + ' (<a href="mailto:' + h(au.email) + '">' + h(au.email) + '</a>). Aviso legal, privacidad y términos de uso en el pie de página.'; $('#footLinks').insertAdjacentHTML('beforeend', '<span>Hecho por ' + h(au.name) + '</span>'); }
    }
    state.text = window.CV_SAMPLE.text; state.meta = window.CV_SAMPLE.meta; state.sample = true;
    run(true);
    go(location.hash.slice(1) || 'resumen', false);
    if (BUILD === 'selfhost') { if (!new URLSearchParams(location.search).get('pro')) takeHandoff(); proInit(); }
  }
  // CV subido desde la página principal: llega por IndexedDB y se borra en cuanto se lee
  function takeHandoff() {
    const fromHome = location.hash === '#subido';
    if (fromHome) { try { history.replaceState(null, '', location.pathname + location.search + '#resumen'); } catch (e) { } }
    let req;
    try { req = indexedDB.open('cv-handoff', 1); } catch (e) { if (fromHome) setStatus('No se ha podido recibir el archivo. Súbelo aquí con «Subir CV».', 'err'); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('f');
    req.onerror = () => { if (fromHome) setStatus('No se ha podido recibir el archivo. Súbelo aquí con «Subir CV».', 'err'); };
    req.onsuccess = () => {
      let db, tx, st, g;
      try { db = req.result; tx = db.transaction('f', 'readwrite'); st = tx.objectStore('f'); g = st.get('pending'); }
      catch (e) { try { db && db.close(); } catch (x) { } if (fromHome) setStatus('No se ha podido recibir el archivo. Súbelo aquí con «Subir CV».', 'err'); return; }
      g.onerror = () => { if (fromHome) setStatus('No se ha podido recibir el archivo. Súbelo aquí con «Subir CV».', 'err'); };
      g.onsuccess = () => {
        const rec = g.result; st.delete('pending');
        tx.oncomplete = () => db.close();
        if (rec && rec.blob && Date.now() - rec.at < 10 * 60 * 1000) handleFile(new File([rec.blob], rec.name || 'CV', { type: rec.type || rec.blob.type || '' }));
        else if (fromHome) setStatus('No se ha podido recibir el archivo. Súbelo aquí con «Subir CV».', 'err');
      };
    };
  }
  // ---------- varias ofertas ----------
  function addOfferBox(value) {
    const boxes = $$('#moreOffers .offer-item');
    if (boxes.length >= MAX_OFFERS - 1) { toast('Máximo ' + MAX_OFFERS + ' ofertas'); return; }
    const n = boxes.length + 2, id = 'offer' + n + '_' + Date.now();
    const div = document.createElement('div');
    div.className = 'field offer-item';
    div.innerHTML = '<div class="offer-head"><label class="label" for="' + id + '">Oferta ' + n + '</label><button class="btn small" type="button">Quitar</button></div><textarea id="' + id + '" rows="4" placeholder="Pega otra oferta"></textarea>';
    div.querySelector('textarea').value = value || '';
    div.querySelector('textarea').addEventListener('input', scheduleSave);
    div.querySelector('button').addEventListener('click', () => { div.remove(); renumberOffers(); scheduleSave(); });
    $('#moreOffers').appendChild(div);
    $('#addOffer').disabled = $$('#moreOffers .offer-item').length >= MAX_OFFERS - 1;
  }
  function renumberOffers() { $$('#moreOffers .offer-item .label').forEach((l, i) => (l.textContent = 'Oferta ' + (i + 2))); $('#addOffer').disabled = $$('#moreOffers .offer-item').length >= MAX_OFFERS - 1; }
  function allOfferBoxes() { return [$('#offer')].concat($$('#moreOffers textarea')); }
  function makePrimary(validIndex) {
    const boxes = allOfferBoxes().filter(t => t.value.trim().length >= 60);
    const target = boxes[validIndex];
    if (!target || target === $('#offer')) return;
    const tmp = $('#offer').value; $('#offer').value = target.value; target.value = tmp;
    run(false); go('ats'); toast('Oferta principal cambiada');
  }
  function renderOfertas() {
    const m = state.match;
    if (!m) {
      $('#v-ofertas').innerHTML = '<div class="sheet"><h3>Compara varias ofertas a la vez</h3><p class="lede">Pega hasta ' + MAX_OFFERS + ' ofertas en el panel «Ofertas de trabajo» y pulsa «Analizar CV». Verás qué palabras clave piden todas, cuáles ya tienes y cuáles te faltan. Es la forma más rápida de saber qué reforzar en el CV para un tipo de puesto, no solo para una oferta concreta.</p></div>';
      return;
    }
    const nO = m.offers.length;
    const cards = m.offers.map((o, i) => '<div class="ocard"><span class="label">Oferta ' + (o.index + 1) + (i === 0 ? ' · principal' : '') + '</span><strong>' + h(o.title) + '</strong><div class="oscore num ' + (o.score >= 70 ? 'ok' : o.score >= 45 ? 'mid' : 'low') + '">' + o.score + ' %</div><span class="small muted">' + [o.yearsReq ? o.yearsReq + ' años' : '', o.langsReq.map(l => l.name + (l.level ? ' ' + l.level.replace(/.*\((\w\d)\)/, '$1') : '')).join(', ')].filter(Boolean).join(' · ') + '</span>' + (i > 0 ? '<button class="btn small" type="button" data-primary="' + i + '">Analizar en detalle</button>' : '') + '</div>').join('');
    const callout = m.commonMissing.length ? '<div class="callout bad"><strong>Piden todas las ofertas y no aparecen en tu CV:</strong> ' + m.commonMissing.map(h).join(', ') + '. Si las dominas, inclúyelas dentro de un logro concreto.</div>'
      : m.mostMissing.length ? '<div class="callout warn"><strong>Piden la mayoría de las ofertas y no aparecen en tu CV:</strong> ' + m.mostMissing.slice(0, 8).map(h).join(', ') + '.</div>'
      : '<div class="callout ok">Tu CV cubre las palabras clave que se repiten en estas ofertas.</div>';
    const where = r => r.where && r.where.length ? ' (' + r.where.map(w => ({ experience: 'exp.', skills: 'habil.', summary: 'perfil' }[w])).join(', ') + ')' : '';
    const rows = m.rows.map(r => '<tr class="' + (r.found ? '' : 'miss') + '"><td>' + h(r.term) + (r.type !== 'skill' ? ' <small class="muted">' + r.type + '</small>' : '') + '</td><td>' + (r.found ? '<span class="yes">Sí</span><small class="muted">' + where(r) + '</small>' : '<span class="no">No</span>') + '</td>' + r.in.map(x => '<td class="c">' + (x ? '<span class="dot" aria-label="La pide">●</span>' : '<span class="muted" aria-label="No la pide">·</span>') + '</td>').join('') + '<td class="c num">' + r.count + '/' + nO + '</td></tr>').join('');
    $('#v-ofertas').innerHTML = '<div class="sheet"><h3>Coincidencia por oferta</h3><div class="ocards">' + cards + '</div>' + callout + '</div>' +
      '<div class="sheet"><h3>Matriz de palabras clave</h3><p class="lede">Ordenada por cuántas ofertas piden cada término. Las filas marcadas son las que faltan en tu CV.</p><div class="tablewrap"><table class="matrix"><thead><tr><th>Palabra clave</th><th>En tu CV</th>' + m.offers.map(o => '<th class="c" title="' + h(o.title) + '">O' + (o.index + 1) + '</th>').join('') + '<th class="c">Total</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
    $$('#v-ofertas [data-primary]').forEach(b => b.addEventListener('click', () => makePrimary(+b.dataset.primary)));
  }

  // ---------- versiones ----------
  function addVersion(label) {
    const n = state.versions.length + 1;
    state.versions.push({ label: 'V' + n + ' · ' + label, at: Date.now(), text: state.text, meta: state.meta });
    if (state.versions.length > MAX_VERSIONS) state.versions.shift();
    state.cmp = null;
    renderVersiones();
    renderNav();
    if (state.versions.length >= 2) toast('Versión guardada. Compárala en «Comparar versiones»');
    scheduleSave();
  }
  function snapshot(v) {
    const r = E.analyze({ text: v.text, meta: v.meta, opts: currentOpts() });
    const bullets = r.stats.bullets || 0;
    return { r, issues: new Map(r.checks.filter(c => c.status === 'bad' || c.status === 'warn').map(c => [c.key, c])),
      metrics: [['Puntuación global', r.total], ['Palabras', r.words], ['Puestos detectados', r.data.experience.length], ['Viñetas con cifras', bullets ? Math.round(r.stats.quant / bullets * 100) + ' %' : '—'], ['Viñetas con verbo de acción', bullets ? Math.round(r.stats.strong / bullets * 100) + ' %' : '—'], ['Competencias técnicas', r.data.skills.length], ['Problemas críticos', r.checks.filter(c => c.status === 'bad').length], ['Coincidencia con la oferta', r.offer ? r.offer.score + ' %' : '—']] };
  }
  function renderVersiones() {
    const V = state.versions;
    if (V.length < 2) {
      $('#v-versiones').innerHTML = '<div class="sheet"><h3>Compara versiones de tu CV</h3><p class="lede">' + (V.length ? 'Ya tienes una versión (' + h(V[0].label) + '). Corrige tu CV y vuelve a subirlo' : 'Sube tu CV, corrígelo siguiendo las recomendaciones y vuelve a subirlo') + ': verás qué problemas has resuelto, cuáles son nuevos y cómo ha cambiado cada puntuación, siempre con el mismo país y la misma oferta.</p><p class="small muted">Las versiones se guardan mientras la página esté abierta, o en este navegador si activas «Guardar mi trabajo».</p></div>';
      return;
    }
    if (!state.cmp || state.cmp.a >= V.length || state.cmp.b >= V.length) state.cmp = { a: V.length - 2, b: V.length - 1 };
    const A = snapshot(V[state.cmp.a]), B = snapshot(V[state.cmp.b]);
    const opt = sel => V.map((v, i) => '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + h(v.label) + ' · ' + new Date(v.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) + '</option>').join('');
    const delta = (a, b) => { const d = b - a; return '<span class="delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + (d > 0 ? '+' : '') + d + '</span>'; };
    const cats = Object.keys(B.r.weights).filter(k => k in A.r.scores);
    const scoreRows = '<tr class="tot"><td>Global</td><td class="num">' + A.r.total + '</td><td class="num">' + B.r.total + '</td><td>' + delta(A.r.total, B.r.total) + '</td></tr>' + cats.map(k => '<tr><td>' + h(B.r.scoreLabels[k]) + '</td><td class="num">' + A.r.scores[k] + '</td><td class="num">' + B.r.scores[k] + '</td><td>' + delta(A.r.scores[k], B.r.scores[k]) + '</td></tr>').join('');
    const resolved = [...A.issues.values()].filter(c => !B.issues.has(c.key));
    const added = [...B.issues.values()].filter(c => !A.issues.has(c.key));
    const pending = [...B.issues.values()].filter(c => A.issues.has(c.key));
    const list = (arr, empty) => arr.length ? '<ul class="mini">' + arr.map(c => '<li class="s-' + c.status + '"><span class="sr">' + STATUS[c.status] + ': </span>' + h(c.title) + '</li>').join('') + '</ul>' : '<p class="muted small">' + empty + '</p>';
    const metrics = A.metrics.map((m, i) => '<tr><td>' + m[0] + '</td><td class="num">' + m[1] + '</td><td class="num">' + B.metrics[i][1] + '</td></tr>').join('');
    $('#v-versiones').innerHTML = '<div class="sheet"><h3>Comparar versiones</h3><p class="lede">Ambas versiones se analizan con el mismo país, tipo de empresa y oferta, para que la comparación sea justa.</p>' +
      '<div class="tplctl"><div class="field"><label class="label" for="cmpA">Versión anterior</label><select id="cmpA">' + opt(state.cmp.a) + '</select></div><div class="field"><label class="label" for="cmpB">Versión nueva</label><select id="cmpB">' + opt(state.cmp.b) + '</select></div></div>' +
      '<div class="tablewrap"><table class="cmp"><thead><tr><th>Categoría</th><th>Anterior</th><th>Nueva</th><th>Cambio</th></tr></thead><tbody>' + scoreRows + '</tbody></table></div></div>' +
      '<div class="cols3"><div class="sheet"><h3>Resueltos (' + resolved.length + ')</h3>' + list(resolved, 'Ningún problema resuelto todavía.') + '</div><div class="sheet"><h3>Nuevos (' + added.length + ')</h3>' + list(added, 'No ha aparecido ningún problema nuevo.') + '</div><div class="sheet"><h3>Pendientes (' + pending.length + ')</h3>' + list(pending, 'No queda nada pendiente.') + '</div></div>' +
      '<div class="sheet"><h3>Indicadores</h3><div class="tablewrap"><table class="cmp"><thead><tr><th>Indicador</th><th>Anterior</th><th>Nueva</th></tr></thead><tbody>' + metrics + '</tbody></table></div>' +
      '<div class="toolbar"><span class="small muted">' + V.length + ' versiones guardadas (máximo ' + MAX_VERSIONS + ').</span><button class="btn small" type="button" id="clearVersions">Olvidar versiones anteriores</button></div></div>';
    $('#cmpA').addEventListener('change', e => { state.cmp.a = +e.target.value; renderVersiones(); });
    $('#cmpB').addEventListener('change', e => { state.cmp.b = +e.target.value; renderVersiones(); });
    $('#clearVersions').addEventListener('click', () => { state.versions = state.versions.slice(-1); state.cmp = null; renderVersiones(); render(); scheduleSave(); toast('Versiones anteriores olvidadas'); });
  }

  // ---------- guardado local opcional ----------
  let saveT = 0;
  const saveOn = () => store.get('save') === '1';
  function scheduleSave() { if (!saveOn() || state.sample) return; clearTimeout(saveT); saveT = setTimeout(saveNow, 700); }
  function saveNow() {
    if (!saveOn() || state.sample) return;
    const payload = { v: 1, at: Date.now(), text: state.text, meta: state.meta, label: state.label, edit: state.edit, offers: allOfferBoxes().map(t => t.value), country: $('#country').value, company: $('#company').value, tpl: state.tpl, trans: state.trans, dv: state.dv, versions: state.versions };
    const ok = store.set('draft', JSON.stringify(payload));
    $('#saveStatus').textContent = ok ? 'Guardado a las ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'No se ha podido guardar (sin espacio o almacenamiento bloqueado).';
  }
  function readDraft() { try { const d = JSON.parse(store.get('draft') || 'null'); return d && d.v === 1 && d.text ? d : null; } catch (e) { return null; } }
  function restore(d) {
    $('#country').value = D.COUNTRIES[d.country] ? d.country : 'ES';
    $('#company').value = D.COMPANY_TYPES[d.company] ? d.company : 'general';
    $('#offer').value = (d.offers || [])[0] || '';
    $('#moreOffers').innerHTML = ''; (d.offers || []).slice(1).forEach(o => addOfferBox(o));
    state.text = d.text; state.meta = d.meta || {}; state.label = d.label || ''; state.sample = false;
    state.versions = Array.isArray(d.versions) ? d.versions : [];
    state.edit = d.edit || null; state.tpl = d.tpl || { style: '', lang: '' }; state.trans = d.trans || {}; state.dv = d.dv && state.trans[d.dv] ? d.dv : 'orig';
    run(false);
    $('#restoreBanner').hidden = true;
    setStatus('Análisis recuperado de este navegador.');
    go('resumen');
  }
  function clearSaved(msg) { store.del('draft'); $('#saveStatus').textContent = ''; toast(msg || 'Datos borrados de este navegador'); }
  function initSave() {
    const cb = $('#saveLocal');
    cb.checked = saveOn();
    const st = () => { $('#saveState').textContent = cb.checked ? '· activado' : '· desactivado'; };
    st(); cb.addEventListener('change', st);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!store.set('save', '1')) { cb.checked = false; st(); $('#saveStatus').textContent = 'Tu navegador no deja guardar datos de esta web (modo privado o almacenamiento bloqueado). El análisis funciona igual, pero no se guardará al cerrar.'; return; }
        if (state.sample) $('#saveStatus').textContent = 'Se guardará cuando subas tu CV.'; else saveNow();
      }
      else { store.del('save'); clearSaved('Guardado desactivado y datos borrados'); }
    });
    $('#clearLocal').addEventListener('click', () => clearSaved());
    const d = saveOn() ? readDraft() : null;
    if (d) {
      $('#restoreDate').textContent = new Date(d.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      $('#restoreBanner').hidden = false;
      $('#restoreBtn').addEventListener('click', () => restore(readDraft() || d));
      $('#restoreDiscard').addEventListener('click', () => { clearSaved(); $('#restoreBanner').hidden = true; });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

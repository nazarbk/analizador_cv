/* Motor de análisis del Analizador de CV.
   Función pura: analyze({ text, meta, opts }) -> informe. Sin red, sin almacenamiento. */
(function (root) {
  'use strict';
  const D = root.CVData || (typeof require !== 'undefined' ? require('./data.js') : null);

  // ---------- utilidades ----------
  // Normaliza conservando la longitud (para poder mapear posiciones al texto original)
  function norm(s) {
    let out = '';
    for (const ch of String(s || '')) {
      let n = ch.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (n.length !== ch.length) n = n.length > ch.length ? n.slice(0, ch.length) : n.padEnd(ch.length, ' ');
      out += n;
    }
    return out;
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wc = s => (String(s).trim().match(/\S+/g) || []).length;
  const uniq = arr => [...new Set(arr)];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const BULLET_RE = /^\s*([•·▪●○◦■□►▸▹➢➤✓✔❖◆◇\-–—*>]|\d{1,2}[.)])\s*/;
  const BULLET_ONLY = /^\s*[•·▪●○◦■□►▸▹➢➤✓✔❖◆◇\-–—*]\s*$/;
  const isBullet = l => BULLET_RE.test(l) && !/^\s*\d{1,2}[.)/-]\d/.test(l) && !/^\s*-\s*\d{4}/.test(l);
  const stripBullet = l => l.replace(BULLET_RE, '').trim();
  // límites de palabra que admiten C++, C#, .NET, Node.js…
  const wordRe = (term, flags = 'g') => new RegExp('(?:^|[^a-z0-9+#])' + esc(term) + '(?=$|[^a-z0-9+#])', flags);

  // ---------- encabezados ----------
  const HEADINGS = [];
  for (const [key, arr] of Object.entries(D.SECTIONS)) for (const t of arr) HEADINGS.push([norm(t), key]);
  HEADINGS.sort((a, b) => b[0].length - a[0].length);

  function headingOf(line) {
    if (!line || line.length > 60 || /:\s*\S/.test(line) || /,/.test(line)) return null;
    const n = norm(line).replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n || /\d{3,}/.test(n)) return null;
    const words = n.split(' ');
    if (words.length > 6) return null;
    for (const [t, k] of HEADINGS) {
      if (n === t) return k;
      if (n.startsWith(t + ' ') && words.length - t.split(' ').length <= 2) return k;
    }
    return null;
  }

  // ---------- fechas ----------
  const MONTH_ALT = Object.keys(D.MONTHS).sort((a, b) => b.length - a.length).map(esc).join('|');
  const PRESENT_ALT = D.PRESENT.slice().sort((a, b) => b.length - a.length).map(esc).join('|');
  const TOKEN = `(?:(?<![a-z])(?:${MONTH_ALT})\\.?\\s*(?:de\\s+|del\\s+|')?(?:19|20)\\d{2}|(?<!\\d)(?:0?[1-9]|1[0-2])\\s*[\\/.\\-]\\s*(?:19|20)\\d{2}|(?<!\\d)(?:19|20)\\d{2}\\s*[\\/.\\-]\\s*(?:0?[1-9]|1[0-2])(?!\\d)|(?<!\\d)(?:19|20)\\d{2}(?!\\d))`;
  const SEP = `\\s*(?:-|–|—|−|‒|~|\\ba\\b|\\bal\\b|\\bhasta\\b|\\bto\\b|\\buntil\\b|\\btill\\b|\\bbis\\b|\\bau\\b|\\bate\\b|\\bthrough\\b|\\/(?=\\s))\\s*`;
  const RANGE_RE = new RegExp(`(${TOKEN})${SEP}(${TOKEN}|(?:${PRESENT_ALT})(?![a-z]))`, 'g');
  const SINCE_RE = new RegExp(`(?:desde|since|seit|depuis|dal|from)\\s+(${TOKEN})`, 'g');
  const TOKEN_RE = new RegExp(TOKEN, 'g');

  function parseToken(tok) {
    const t = tok.trim();
    if (new RegExp(`^(?:${PRESENT_ALT})$`).test(t)) return { present: true, fmt: 'present' };
    let m = t.match(new RegExp(`^(${MONTH_ALT})\\.?\\s*(?:de\\s+|del\\s+|')?((?:19|20)\\d{2})$`));
    if (m) return { y: +m[2], m: D.MONTHS[m[1]], fmt: 'mes-nombre' };
    m = t.match(/^(\d{1,2})\s*[/.\-]\s*((?:19|20)\d{2})$/);
    if (m) return { y: +m[2], m: +m[1], fmt: 'mm/aaaa' };
    m = t.match(/^((?:19|20)\d{2})\s*[/.\-]\s*(\d{1,2})$/);
    if (m) return { y: +m[1], m: +m[2], fmt: 'aaaa/mm' };
    m = t.match(/^((?:19|20)\d{2})$/);
    if (m) return { y: +m[1], m: null, fmt: 'aaaa' };
    return null;
  }
  function findRanges(line) {
    const n = norm(line), out = [];
    RANGE_RE.lastIndex = 0;
    let m;
    while ((m = RANGE_RE.exec(n))) {
      const a = parseToken(m[1]), b = parseToken(m[2]);
      if (a && b && !(b.y && a.y && b.y < a.y)) out.push({ start: a, end: b, index: m.index + (m[0].length - m[0].trimStart().length), length: m[0].trim().length });
    }
    if (!out.length) {
      SINCE_RE.lastIndex = 0;
      while ((m = SINCE_RE.exec(n))) {
        const a = parseToken(m[1]);
        if (a) out.push({ start: a, end: { present: true, fmt: 'present' }, index: m.index, length: m[0].length });
      }
    }
    return out;
  }
  function findTokens(line) {
    const n = norm(line), out = [];
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(n))) { const p = parseToken(m[0]); if (p) out.push(Object.assign(p, { index: m.index, length: m[0].length })); }
    return out;
  }
  function monthIdx(d, isEnd, now) {
    if (!d) return null;
    if (d.present) return now.getFullYear() * 12 + now.getMonth();
    return d.y * 12 + (d.m ? d.m - 1 : (isEnd ? 11 : 0));
  }
  function fmtDate(d, style = 'mm/aaaa') {
    if (!d) return '';
    if (d.present) return 'Actualidad';
    const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    if (!d.m) return String(d.y);
    if (style === 'mes') return MES[d.m - 1] + ' ' + d.y;
    return String(d.m).padStart(2, '0') + '/' + d.y;
  }
  function durationLabel(months) {
    if (months == null || months < 0) return '';
    const y = Math.floor(months / 12), m = months % 12;
    const parts = [];
    if (y) parts.push(y + (y === 1 ? ' año' : ' años'));
    if (m) parts.push(m + (m === 1 ? ' mes' : ' meses'));
    return parts.join(' y ') || 'menos de 1 mes';
  }

  // ---------- diccionarios precompilados ----------
  const SKILL_INDEX = D.SKILLS.map(([canon, fam, ...syn]) => ({
    canon, fam, res: uniq([canon, ...syn].map(s => norm(s))).map(s => wordRe(s))
  }));
  const LANG_INDEX = D.LANGUAGES.map(([canon, ...syn]) => ({ canon, re: new RegExp('(?:^|[^a-z])(' + uniq(syn.map(norm)).map(esc).join('|') + ')(?![a-z])') }));
  const CITY_WORDS = ['madrid', 'barcelona', 'valencia', 'sevilla', 'alicante', 'malaga', 'bilbao', 'zaragoza', 'murcia', 'palma', 'las palmas', 'valladolid', 'vigo', 'gijon', 'oviedo', 'granada', 'cordoba', 'a coruna', 'la coruna', 'pamplona', 'san sebastian', 'donostia', 'santander', 'toledo', 'salamanca', 'cadiz', 'elche', 'benidorm', 'castellon', 'tarragona', 'girona', 'lleida', 'burgos', 'leon', 'almeria', 'huelva', 'jaen', 'badajoz', 'caceres', 'logrono', 'vitoria', 'albacete', 'cartagena', 'tenerife', 'ibiza', 'mallorca', 'menorca', 'london', 'londres', 'paris', 'berlin', 'munich', 'munchen', 'hamburg', 'dublin', 'amsterdam', 'lisboa', 'lisbon', 'porto', 'roma', 'rome', 'milan', 'milano', 'new york', 'nueva york', 'ciudad de mexico', 'cdmx', 'guadalajara', 'monterrey', 'buenos aires', 'santiago', 'bogota', 'medellin', 'lima', 'miami', 'toronto', 'zurich', 'ginebra', 'geneva', 'dubai', 'tokyo', 'bruselas', 'brussels', 'viena', 'vienna', 'stuttgart', 'frankfurt', 'koln', 'cologne', 'dusseldorf', 'leipzig', 'dresden', 'hannover', 'nurnberg', 'lyon', 'marseille', 'toulouse', 'bordeaux', 'lille', 'nantes', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'bristol', 'leeds', 'sydney', 'melbourne', 'brisbane', 'perth', 'vancouver', 'montreal', 'ottawa', 'san francisco', 'los angeles', 'chicago', 'boston', 'austin', 'seattle', 'napoles', 'turin', 'torino', 'florencia', 'bolonia', 'bologna', 'coimbra', 'braga', 'rotterdam', 'utrecht', 'eindhoven', 'basilea', 'basel', 'berna', 'bern', 'lausana', 'abu dhabi', 'doha', 'osaka', 'espana', 'spain', 'reino unido', 'united kingdom', 'alemania', 'germany', 'francia', 'france', 'italia', 'italy', 'portugal', 'irlanda', 'ireland', 'estados unidos', 'usa', 'eeuu', 'mexico', 'argentina', 'colombia', 'chile', 'peru', 'remoto', 'remote', 'teletrabajo', 'hibrido', 'hybrid', 'en remoto'];
  const CITY_RE = new RegExp('(?:^|[^a-z])(' + CITY_WORDS.map(esc).join('|') + ')(?![a-z])');
  const COMPANY_MARK = /\b(s\.?l\.?u?|s\.?a\.?u?|s\.?l\.?l|s\.?coop|ltd|limited|gmbh|ag|inc|llc|plc|corp|group|grupo|holding|consulting|consultores|bank|banco|hotel|hospital|clinica|universidad|university|ayuntamiento|ministerio|fundacion|foundation|asociacion|ong|startup|labs?|technologies|tecnologias|solutions|soluciones|services|servicios|systems|sistemas|software|partners|abogados|agencia|agency|studio|estudio)\b/;
  const ROLE_WORDS = /\b(jefe|jefa|responsable|director|directora|gerente|tecnico|tecnica|analista|desarrollador|desarrolladora|developer|engineer|ingeniero|ingeniera|manager|consultor|consultora|consultant|asistente|assistant|auxiliar|administrativo|administrativa|comercial|dependiente|dependienta|camarero|camarera|cocinero|cocinera|chef|enfermero|enfermera|nurse|profesor|profesora|teacher|maestro|maestra|coordinador|coordinadora|coordinator|especialista|specialist|becario|becaria|intern|internship|practicas|trainee|lead|head|designer|disenador|disenadora|programador|programadora|recepcionista|receptionist|operario|operaria|mozo|conductor|conductora|driver|agente|agent|ejecutivo|ejecutiva|executive|asesor|asesora|advisor|contable|accountant|abogado|abogada|lawyer|arquitecto|arquitecta|architect|product|owner|scrum|officer|representative|supervisor|supervisora|encargado|encargada|delegado|delegada|vendedor|vendedora|cajero|cajera|administrador|administradora|socio|fundador|founder|ceo|cto|cfo|coo|cmo|vp|associate|executive|graduate|junior|senior|sr|jr|sales|marketing|account|fisioterapeuta|psicologo|psicologa|medico|medica|farmaceutico|farmaceutica|educador|educadora|monitor|monitora|tecnico superior|auditor|auditora|controller|tesorero|community|copywriter|redactor|redactora|periodista|investigador|investigadora|researcher|scientist|cientifico|cientifica)\b/;
  const ROLE_SUFFIX = /(manager(in)?|leiter(in)?|koordinator(in)?|berater(in)?|entwickler(in)?|ingenieur(in)?|referent(in)?|assistent(in)?|sachbearbeiter(in)?|verkaufer(in)?|kauffrau|kaufmann|developpeu(r|se)|charge(e)? de|chef de|directeur|directrice|stagiaire|analyste)\b/;
  const isRole = n => ROLE_WORDS.test(n) || ROLE_SUFFIX.test(n);
  const DEGREE_WORDS = /\b(grado|graduado|graduada|licenciatura|licenciado|licenciada|diplomatura|diplomado|diplomada|master|maestria|mba|doctorado|doctor|phd|ph\.d|bachelor|bsc|ba|msc|ma|degree|ingenieria|ingeniero tecnico|tecnico superior|tecnico en|ciclo formativo|cfgs|cfgm|fp|formacion profesional|bachillerato|eso|selectividad|ebau|evau|certificado de profesionalidad|postgrado|posgrado|experto universitario|especialista universitario|diploma|high school|a-levels|abitur|ausbildung|bts|dut|licence|laurea|curso|course|bootcamp)\b/;
  const INSTITUTION_WORDS = /\b(universidad|universitat|university|universite|universita|universidade|instituto|institut|institute|ies|escuela|escola|school|college|colegio|centro|academia|academy|hochschule|business school|uned|uoc|eoi|eae|esic|iese|ie|esade|icade|cesine|politecnica|politecnico|conservatorio|campus|fundacion)\b/;

  function looksLikeName(line) {
    const t = line.trim();
    if (t.length < 4 || t.length > 50 || /[@\d|/:]/.test(t) || headingOf(t)) return false;
    if (/^(curriculum|curr[ií]culum|cv|resume|r[ée]sum[ée]|hoja de vida|lebenslauf)\b/i.test(t)) return false;
    const words = t.split(/\s+/);
    if (words.length < 2 || words.length > 5) return false;
    return words.every(w => /^[A-ZÁÉÍÓÚÑÜÀÈÌÒÙÇÄÖ][\p{L}'’.-]*$/u.test(w) || /^(de|del|la|las|los|y|i|van|von|da|do|dos|di|le)$/i.test(w));
  }

  // ---------- extracción ----------
  // texto con letras separadas por espacios: «E X P E R I E N C I A  L A B O R A L»
  const SPACED_RE = /^(?:\S ){2,}\S(?: {2,}(?:\S ){1,}\S)*$/;
  const unspace = l => l.split(/ {2,}/).map(w => w.replace(/ /g, '')).join(' ');
  function toLines(text) {
    const raw = String(text || '').replace(/\r/g, '').replace(/ /g, ' ').replace(/\t/g, '  ').split('\n');
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      let l = raw[i].replace(/ {2,}/g, '  ').trim();
      if (!l) continue;
      if (SPACED_RE.test(l)) l = unspace(l);
      if (BULLET_ONLY.test(l) && i + 1 < raw.length) { // viñeta suelta en una línea
        let j = i + 1; while (j < raw.length && !raw[j].trim()) j++;
        if (j < raw.length) { out.push('• ' + raw[j].trim()); i = j; continue; }
      }
      out.push(l);
    }
    return out;
  }

  function segment(lines) {
    const sections = [];
    let cur = { key: 'header', title: '', lines: [], at: 0 };
    lines.forEach((l, i) => {
      let k = headingOf(l), rest = null;
      if (!k) {
        const m = l.match(/^([^:]{3,40}):\s*(.+)$/);
        if (m) {
          const k2 = headingOf(m[1]);
          if (k2 && ['languages', 'skills', 'interests', 'certifications', 'personal', 'contact', 'summary', 'other', 'courses'].includes(k2)) { k = k2; rest = m[2]; }
        }
      }
      if (k && rest != null && (cur.key === 'projects' || cur.key === 'experience') && k === 'skills') { cur.lines.push(l); return; }
      if (k && rest == null && k === cur.key) { cur.lines.push(l); return; }
      if (k && rest != null) {
        if (k === 'languages' && !LANG_INDEX.some(L => L.re.test(norm(rest)))) { cur.lines.push(l); return; }
        if (cur.key === 'header' || cur.key === k) { sections.push({ key: k, title: '', lines: [rest], at: i, inline: true }); return; }
        sections.push({ key: k, title: '', lines: [rest], at: i, inline: true }); return;
      }
      if (k) { sections.push(cur); cur = { key: k, title: l, lines: [], at: i }; }
      else cur.lines.push(l);
    });
    sections.push(cur);
    return sections;
  }

  function splitHeaderPieces(parts) {
    const pieces = [];
    for (const p of parts) {
      if (!p) continue;
      const cleaned = p.replace(/^[\s|•·,–—-]+|[\s|•·,–—-]+$/g, '');
      if (!cleaned) continue;
      let segs = cleaned.split(/\s+[|•·–—]\s+|\s+-\s+|\s+@\s+|\s{2,}|\s*\|\s*/).map(s => s.trim()).filter(Boolean);
      const out = [];
      for (const s of segs) {
        const m = s.match(/^(.{3,}?)\s+(?:en|at|chez|bei|presso|para|for)\s+((?:[A-ZÁÉÍÓÚÑ0-9][\p{L}0-9&.'’-]*\s?){1,6})$/u);
        if (m && ROLE_WORDS.test(norm(m[1]))) { out.push(m[1].trim(), m[2].trim()); continue; }
        const c = s.match(/^([^,]{3,}),\s+(.{2,})$/);
        if (c && !DEGREE_WORDS.test(norm(c[1])) && (isRole(norm(c[1])) || COMPANY_MARK.test(norm(c[2])) || CITY_RE.test(norm(c[2])))) { out.push(c[1].trim(), c[2].trim()); continue; }
        out.push(s);
      }
      pieces.push(...out);
    }
    return pieces;
  }

  function classifyExpHeader(pieces) {
    let title = '', company = '', location = '';
    const rest = [];
    for (const p of pieces) {
      const n = norm(p);
      if (!location && CITY_RE.test(n) && wc(p) <= 5 && !ROLE_WORDS.test(n)) {
        // "Empresa, Madrid": separar empresa de la ciudad
        const m = p.match(/^(.*?),\s*([^,]+)$/);
        if (m && CITY_RE.test(norm(m[2])) && !CITY_RE.test(norm(m[1]))) { rest.push(m[1]); location = m[2]; }
        else location = p;
        continue;
      }
      rest.push(p);
    }
    for (const p of rest) {
      const n = norm(p);
      if (!company && COMPANY_MARK.test(n) && !ROLE_WORDS.test(n)) { company = p; continue; }
      if (!title && isRole(n)) { title = p; continue; }
    }
    for (const p of rest) {
      if (p === title || p === company) continue;
      if (!title) title = p; else if (!company) company = p;
    }
    // "Empresa, Ciudad" dentro de la empresa
    if (company && !location) {
      const m = company.match(/^(.*?),\s*([^,]+)$/);
      if (m && CITY_RE.test(norm(m[2]))) { company = m[1]; location = m[2]; }
    }
    return { title: title.replace(/[,;]+$/, ''), company: company.replace(/[,;]+$/, ''), location };
  }

  function classifyEduHeader(pieces) {
    let degree = '', institution = '', location = '';
    for (const p of pieces) {
      const n = norm(p);
      if (!institution && INSTITUTION_WORDS.test(n) && !DEGREE_WORDS.test(n.replace(INSTITUTION_WORDS, ''))) { institution = p; continue; }
      if (!degree && DEGREE_WORDS.test(n)) { degree = p; continue; }
      if (!location && CITY_RE.test(n) && wc(p) <= 4) { location = p; continue; }
    }
    for (const p of pieces) {
      if (p === degree || p === institution || p === location) continue;
      if (!degree) degree = p; else if (!institution) institution = p;
    }
    if (institution && !location) {
      const m = institution.match(/^(.*?),\s*([^,]+)$/);
      if (m && CITY_RE.test(norm(m[2]))) { institution = m[1]; location = m[2]; }
    }
    return { degree, institution, location };
  }

  function removeSpan(line, index, length) {
    return (line.slice(0, index) + ' ' + line.slice(index + length)).replace(/\(\s*\)/g, ' ').replace(/\s{2,}/g, '  ').trim();
  }

  function parseEntries(lines, kind, now) {
    const marks = [];
    lines.forEach((l, i) => {
      if (isBullet(l) && wc(l) > 8) return; // fechas dentro de una viñeta larga no abren entrada
      const r = findRanges(l);
      if (r.length) { marks.push({ i, start: r[0].start, end: r[r.length - 1].end, index: r[0].index, length: r[0].length, ranges: r }); return; }
      if (kind === 'edu' || kind === 'loose') {
        const t = findTokens(l);
        if (t.length && wc(l) <= 14) marks.push({ i, start: t[0], end: t[0], single: true, index: t[0].index, length: t[0].length });
      }
    });
    const entries = [];
    let consumedUntil = -1;
    for (let k = 0; k < marks.length; k++) {
      const mk = marks[k];
      let restOnLine = lines[mk.i];
      (mk.ranges || [mk]).slice().sort((a, b) => b.index - a.index).forEach(rg => { restOnLine = removeSpan(restOnLine, rg.index, rg.length); });
      restOnLine = restOnLine.replace(/^[\s/|·•,y-]+$/, '').replace(/(^|\s)[/|](\s|$)/g, ' ').replace(/\s{2,}/g, '  ').trim();
      const pre = [];
      let j = mk.i - 1;
      const restPieces = restOnLine ? splitHeaderPieces([restOnLine]).length : 0;
      const maxPre = restPieces >= 2 ? 0 : restPieces === 1 ? 1 : 2;
      while (j > consumedUntil && pre.length < maxPre) {
        const l = lines[j];
        if (isBullet(l) || wc(l) > 12 || (/[.;]$/.test(l) && wc(l) > 8 && !COMPANY_MARK.test(norm(l))) || /^[a-zà-ÿ]/.test(l)) break;
        if (findRanges(l).length) break;
        pre.unshift(l); j--;
      }
      const headerStart = j + 1;
      if (entries.length) entries[entries.length - 1].descEnd = Math.min(entries[entries.length - 1].descEnd, headerStart);
      const nextMark = k + 1 < marks.length ? marks[k + 1].i : lines.length;
      const post = [];
      let p = mk.i + 1;
      const wantPost = Math.max(0, 2 - splitHeaderPieces([...pre, restOnLine]).length);
      while (p < nextMark && post.length < wantPost) {
        const l = lines[p];
        if (isBullet(l) || wc(l) > 10 || /[.;:]$/.test(l) || /^[a-zà-ÿ]/.test(l)) break;
        post.push(l); p++;
      }
      entries.push({ pre, rest: restOnLine, post, start: mk.start, end: mk.end, ranges: mk.ranges, single: !!mk.single, descStart: p, descEnd: nextMark, line: mk.i, headerStart });
      consumedUntil = p - 1;
    }
    return entries.map(e => {
      const pieces = splitHeaderPieces([...e.pre, e.rest, ...e.post]);
      const descLines = lines.slice(e.descStart, e.descEnd);
      const bullets = [];
      for (const l of descLines) {
        if (isBullet(l)) bullets.push(stripBullet(l));
        else if (bullets.length && (/^[a-zà-ÿ(]/.test(l) || !/[.;!?]$/.test(bullets[bullets.length - 1]) && wc(l) < 12 && !/^[A-ZÁÉÍÓÚ][^.]*:$/.test(l))) bullets[bullets.length - 1] += ' ' + l;
        else bullets.push(l);
      }
      // párrafos largos -> frases
      const statements = [];
      for (const b of bullets) {
        if (wc(b) > 45) b.split(/(?<=[.;])\s+(?=[A-ZÁÉÍÓÚÑ])/).forEach(s => s.trim() && statements.push(s.trim()));
        else statements.push(b);
      }
      const extra = [];
      if (kind === 'edu') {
        for (let bi = statements.length - 1; bi >= 0; bi--) if (DEGREE_WORDS.test(norm(statements[bi])) && wc(statements[bi]) <= 14 && !/[.]$/.test(statements[bi])) extra.unshift(statements.splice(bi, 1)[0]);
      }
      const head = kind === 'edu' ? classifyEduHeader(pieces) : classifyExpHeader(pieces);
      const s = monthIdx(e.start, false, now), en = monthIdx(e.end, true, now);
      const spans = (e.ranges && e.ranges.length > 1) ? e.ranges.map(rg => [monthIdx(rg.start, false, now), monthIdx(rg.end, true, now)]).filter(x => x[0] != null && x[1] != null) : null;
      return Object.assign(head, {
        start: e.start, end: e.end, current: !!(e.end && e.end.present), single: e.single, spans,
        periods: spans ? e.ranges.map(rg => fmtDate(rg.start) + ' – ' + fmtDate(rg.end)).join(' y ') : '',
        months: spans ? spans.reduce((a, x) => a + Math.max(1, x[1] - x[0] + 1), 0) : s != null && en != null ? Math.max(1, en - s + 1) : null, startIdx: s, endIdx: en,
        bullets: statements, paragraphStyle: bullets.length > 0 && descLines.every(l => !isBullet(l)), rawHeader: pieces, line: e.line, headerStart: e.headerStart, extra
      });
    }).flatMap(en => [en].concat((en.extra || []).map(x => Object.assign(classifyEduHeader(splitHeaderPieces([stripBullet(x)])), { start: null, end: null, bullets: [], startIdx: null, endIdx: null, months: null }))));
  }

  function mergeIntervals(list) {
    const iv = list.filter(e => e.startIdx != null && e.endIdx != null).flatMap(e => e.spans || [[e.startIdx, e.endIdx]]).sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const x of iv) { if (out.length && x[0] <= out[out.length - 1][1] + 1) out[out.length - 1][1] = Math.max(out[out.length - 1][1], x[1]); else out.push(x.slice()); }
    return out;
  }

  function findSkills(textNorm) {
    const found = [];
    for (const s of SKILL_INDEX) {
      let count = 0;
      for (const re of s.res) { re.lastIndex = 0; const m = textNorm.match(re); if (m) count += m.length; }
      if (count) found.push({ name: s.canon, fam: s.fam, count });
    }
    // términos ambiguos: solo cuentan con contexto profesional
    const CTX = {
      'R': /\b(rstudio|ggplot|tidyverse|shiny|cran|lenguaje r|python|sql|spss|stata|estadistica|statistics)\b/,
      'Go': /(golang|kubernetes|docker|microservicios|microservices|backend|grpc)/,
      'Spring Boot': /(java|kotlin|maven|gradle|hibernate|spring boot)/,
      'Express': /(node|javascript|typescript|express\.js)/,
      'Redes': /\b(cisco|tcp\/ip|vlan|router|switch|firewall|networking|ccna|lan|wan)\b/,
      'Sala': /(camarer|restaurante|hosteleria|cubiertos|comedor|maitre)/,
      'Cocina': /(cociner|chef|restaurante|hosteleria|cubiertos|ayudante de cocina|partida)/,
      'Recepción': /(hotel|huesped|check-in|check in|hosteleria|front desk|recepcionista)/,
      'Archivo': /(administrativ|documentacion|gestion documental|secretari)/
    };
    return found.filter(f => !CTX[f.name] || CTX[f.name].test(f.name === 'Redes' ? textNorm.replace(/redes sociales/g, '') : textNorm));
  }

  function parseLanguages(lines, fullNorm) {
    const out = [];
    const add = (canon, level, raw) => {
      const ex = out.find(o => o.name === canon);
      if (ex) { if (!ex.level && level) { ex.level = level.label; ex.rank = level.rank; } return; }
      out.push({ name: canon, level: level ? level.label : '', rank: level ? level.rank : 0, raw: raw.trim() });
    };
    const levelOf = s => { for (const [re, label, rank] of D.LEVELS) if (re.test(s)) return { label, rank }; return null; };
    const chunks = [];
    lines.forEach(l => l.split(/[,;|•·]|\s+-\s+|\s{2,}/).forEach(c => c.trim() && chunks.push(c.trim())));
    for (let i = 0; i < chunks.length; i++) {
      const n = norm(chunks[i]);
      const langs = LANG_INDEX.filter(L => L.re.test(n));
      if (!langs.length) continue;
      let lvl = levelOf(n);
      if (!lvl && i + 1 < chunks.length && !LANG_INDEX.some(L => L.re.test(norm(chunks[i + 1])))) lvl = levelOf(norm(chunks[i + 1]));
      langs.forEach(L => add(L.canon, lvl, chunks[i]));
    }
    if (!out.length) { // sin sección: buscar «inglés B2» en todo el texto
      for (const L of LANG_INDEX) {
        const m = fullNorm.match(new RegExp(L.re.source + '[^\\n]{0,25}'));
        if (m) { const lvl = levelOf(m[0]); if (lvl) add(L.canon, lvl, m[0]); }
      }
    }
    return out;
  }

  function splitList(lines) {
    const items = [];
    for (const l of lines) {
      const body = l.replace(/^[^:]{2,30}:\s*/, m => (wc(m) <= 4 ? '' : m));
      body.split(/[,;|•·]|\s+-\s+|\s{2,}|\s\/\s/).forEach(x => { const t = stripBullet(x).replace(/[.]$/, '').trim(); if (t && wc(t) <= 6 && t.length > 1) items.push(t); });
    }
    return uniq(items);
  }

  const CERT_RE = /(aws certified[\w .-]*|azure (?:fundamentals|administrator|developer|solutions architect)[\w .-]*|microsoft certified[\w .:-]*|google (?:cloud|analytics|ads)[\w ]*certif\w*|pmp|prince2[\w ]*|professional scrum master[\w ]*|scrum master[\w ]*|psm ?i{1,3}|\bcsm\b|itil[\w ]*|ccna|ccnp|comptia[\w+ ]*|hubspot[\w ]*certif\w*|\bcfa\b|\bacca\b|\bcpa\b|six sigma[\w ]*belt|toefl[\w ]*|ielts[\w .]*|cambridge (?:c1|c2|b2|first|advanced|proficiency)[\w ]*|first certificate[\w ]*|\bdele [abc][12]\b|goethe[\w -]*zertifikat[\w ]*|\bdelf\b[\w ]*|\bdalf\b[\w ]*|oracle certified[\w ]*|salesforce certified[\w ]*|cisp|cissp|ceh|iso 27001 lead[\w ]*)/gi;

  // ---------- proyectos ----------
  const URL_RE = /\b(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+(?:com|es|io|dev|me|net|org|app|ai|co|eu|design|art|page|site|tech|xyz|cat|pt|de|fr|it|uk|mx|ar|cl)(?:\/[^\s)|,]*)?/i;
  const TOOLS_RE = /^(tecnolog[ií]as|herramientas|stack|tools|technologies|tech stack|tech|built with|hecho con|tecnologias usadas|herramientas usadas)\s*:\s*/i;
  function nameFromUrl(u) {
    const m = String(u || '').replace(/^https?:\/\//, '').replace(/\/+$/, '').split('/');
    const slug = m.length > 2 ? m[m.length - 1] : m.length === 2 ? m[1] : m[0].split('.')[0];
    return slug ? cap(decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim()) : '';
  }
  function parseProjects(lines, now) {
    const out = [];
    let cur = null;
    const push = () => { if (cur && (cur.name || cur.url || cur.desc.length)) out.push(cur); };
    for (const raw of lines) {
      const bullet = isBullet(raw);
      let t = stripBullet(raw);
      if (!t) continue;
      if (TOOLS_RE.test(t)) { if (!cur) cur = { name: '', url: '', period: '', desc: [], tools: '' }; cur.tools = t.replace(TOOLS_RE, '').replace(/[.]$/, ''); continue; }
      const um = !t.includes('@') ? t.match(URL_RE) : null;
      const onlyUrl = um && t.replace(um[0], '').replace(/^[\s:|•·–—-]*(enlace|link|url|demo|repo|repositorio|web)?[\s:|•·–—-]*$/i, '').trim() === '';
      if (onlyUrl) { if (!cur || cur.url) { push(); cur = { name: '', url: '', period: '', desc: [], tools: '' }; } cur.url = um[0]; continue; }
      const title = !bullet && wc(t) <= 12 && !/[.;:]$/.test(t);
      if (title && (!cur || cur.desc.length || cur.url || cur.tools)) {
        push();
        cur = { name: '', url: '', period: '', desc: [], tools: '' };
        if (um) { cur.url = um[0]; t = t.replace(um[0], ' '); }
        const r = findRanges(t);
        if (r.length) { cur.period = fmtDate(r[0].start) + ' – ' + fmtDate(r[0].end); t = removeSpan(t, r[0].index, r[0].length); }
        else { const tk = findTokens(t); if (tk.length) { cur.period = fmtDate(tk[0]); t = removeSpan(t, tk[0].index, tk[0].length); } }
        const parts = t.split(/\s+[|•·–—-]\s+|\s{2,}|\s*\|\s*/).map(x => x.trim()).filter(Boolean);
        // «Nombre — subtítulo corto» es un único título, no nombre + descripción
        if (parts.length === 2 && /\s[–—]\s/.test(t) && wc(parts[1]) <= 8 && !/[,.;]/.test(parts[1])) parts.splice(0, 2, parts[0] + ' — ' + parts[1]);
        cur.name = (parts[0] || '').replace(/[,:–—-]+$/, '').replace(/\(\s*$/, '').trim();
        if ((cur.name.match(/\(/g) || []).length > (cur.name.match(/\)/g) || []).length) cur.name += ')';
        if (parts.length > 1) cur.desc.push(parts.slice(1).join(' · '));
        continue;
      }
      if (!cur) cur = { name: '', url: '', period: '', desc: [], tools: '' };
      if (um && !cur.url) { cur.url = um[0]; t = t.replace(um[0], '').replace(/\(\s*\)/g, '').trim(); }
      if (!t) continue;
      if (cur && !cur.period && !cur.desc.length && /^((\d{1,2}\/)?(19|20)\d{2})(\s*[–-]\s*((\d{1,2}\/)?(19|20)\d{2}|actualidad|present))?$/i.test(t)) { cur.period = t; continue; }
      // continuación de la línea anterior (texto partido al maquetar): se une en vez de crear otra viñeta
      const prev = cur.desc[cur.desc.length - 1];
      if (!bullet && prev && (/^[a-zà-ÿ(]/.test(t) || !/[.;:!?)]$/.test(prev))) cur.desc[cur.desc.length - 1] = prev + ' ' + t;
      else cur.desc.push(t);
    }
    push();
    return out.slice(0, 12).map(p => ({ name: p.name || nameFromUrl(p.url), url: p.url, period: p.period, desc: p.desc.join('\n'), tools: p.tools }));
  }

  // ---------- detecciones de datos personales ----------
  const PERSONAL = [
    { id: 'dni', re: /\b\d{8}\s?-?[A-HJ-NP-TV-Z]\b|\b[XYZ]\s?-?\d{7}\s?-?[A-Z]\b|\b(dni|nie|nif|pasaporte|passport|cedula|c[ée]dula|curp|rut)\s*[:nº.]/i, label: 'Número de documento de identidad (DNI/NIE/pasaporte)', sev: 'bad', why: 'No se pide al presentar una candidatura y te expone a suplantación de identidad si el CV circula.' },
    { id: 'ss', re: /(seguridad social|\bnuss\b|\bnaf\b|social security|\bssn\b)/i, label: 'Número de la Seguridad Social', sev: 'bad', why: 'Solo se facilita al formalizar el contrato.' },
    { id: 'dob', re: /(fecha de nacimiento|f\. ?nacimiento|nacid[oa] (el|en)|date of birth|\bdob\b|born on|geburtsdatum|n[ée]e? le|data di nascita|data de nascimento)|\bedad\s*:|\b(1[6-9]|[2-6]\d)\s+(años|years old|ans|jahre)\b(?!\s+(de|of|en|in|d'|im)\b)/i, label: 'Fecha de nacimiento o edad', sev: 'country', field: 'dob', why: 'Permite descartarte por edad. En la mayoría de países no se incluye.' },
    { id: 'marital', re: /(estado civil|\bsoltero\b|\bsoltera\b|\bcasado\b|\bcasada\b|divorciad[oa]|viud[oa]|marital status|\bmarried\b|familienstand|\bledig\b|verheiratet|stato civile|situation familiale)/i, label: 'Estado civil', sev: 'warn', why: 'No es relevante para el puesto y puede provocar sesgos.' },
    { id: 'children', re: /(\b\d+\s+hij[oa]s\b|\bsin hijos\b|\bchildren\s*:|\bkinder\s*:)/i, label: 'Hijos / situación familiar', sev: 'warn', why: 'Dato personal irrelevante para la selección.' },
    { id: 'nationality', re: /(nacionalidad|nationality|staatsangeh[oö]rigkeit|nationalit[ée]|nazionalit[àa])/i, label: 'Nacionalidad', sev: 'country', field: 'nationality', why: 'Solo es útil en algunos países o si la oferta lo pide.' },
    { id: 'gender', re: /(\bsexo\s*:|\bg[ée]nero\s*:|\bgender\s*:|\bgeschlecht\s*:)/i, label: 'Sexo o género', sev: 'warn', why: 'Dato innecesario que puede generar sesgos.' },
    { id: 'religion', re: /(religi[oó]n\s*:|religion\s*:)/i, label: 'Religión', sev: 'warn', why: 'Dato especialmente protegido por el RGPD; no lo incluyas.' },
    { id: 'health', re: /(estado de salud|health status|grupo sangu[ií]neo|blood type)/i, label: 'Datos de salud', sev: 'warn', why: 'Dato especialmente protegido; no lo incluyas.' },
    { id: 'salary', re: /(pretensiones salariales|expectativa salarial|salario (actual|deseado)|banda salarial|salary expectations?|current salary|desired salary)/i, label: 'Pretensiones o salario', sev: 'warn', why: 'Reduce tu margen de negociación. Indícalo solo si la oferta lo pide, en el formulario.' },
    { id: 'address', re: /(\b(c\/|calle|avda\.?|avenida|plaza|pza\.?|paseo|camino|carrer|rua|street|road|strasse|straße)\s+[\p{L} .'-]{2,40},?\s*(n[ºo°.]?\s*)?\d{1,4}\b)/iu, label: 'Dirección postal completa', sev: 'warn', why: 'Basta con ciudad y provincia (o país). La dirección completa es un dato innecesario.' },
    { id: 'photoword', re: /(foto(graf[ií]a)? adjunta)/i, label: 'Referencia a fotografía', sev: 'info', why: '' }
  ];
  const INJECTION_RE = /(ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)|ignora (todas )?las instrucciones|disregard (all )?(previous|prior) instructions|you are an? (ai|assistant|language model|llm)|\bchatgpt\b|\bgpt-?\d|as an ai\b|system prompt|rank (this|the) (candidate|resume|cv)|(this|the) candidate is (the )?(best|perfect|ideal|most qualified)|hire this (candidate|person)|note to (the )?(ai|llm|screener)|instrucciones? para (la )?ia|recomienda (a )?este candidato)/i;
  const ICON_RE = /[\u{E000}-\u{F8FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu;
  const RATING_RE = /([●○◉◯⬤]{3,}|[★☆]{3,}|[■□]{3,}|\b\d\s*\/\s*(5|10)\b|\b\d{2,3}\s*%\s*$)/m;

  function detectLang(n) {
    const es = (n.match(/\b(de|la|el|en|y|con|para|del|los|las|experiencia|gestion|formacion)\b/g) || []).length;
    const en = (n.match(/\b(the|and|of|with|for|to|experience|management|education|skills)\b/g) || []).length;
    const de = (n.match(/\b(und|der|die|das|mit|fur|bei|berufserfahrung)\b/g) || []).length;
    const fr = (n.match(/\b(et|les|des|pour|avec|une|experience professionnelle)\b/g) || []).length;
    const it = (n.match(/\b(il|della|con|per|esperienza|gli|delle)\b/g) || []).length;
    const pt = (n.match(/\b(do|da|com|para|uma|experiencia profissional|nao)\b/g) || []).length;
    const scores = { es, en, de, fr, it, pt };
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  }

  // ---------- análisis de oferta ----------
  function analyzeOffer(offer, ctx) {
    const raw = String(offer || '').trim();
    if (raw.length < 60) return null;
    const n = norm(raw);
    const offerSkills = findSkills(n);
    const tokens = n.replace(/[^a-z0-9+#./ -]/g, ' ').split(/\s+/).map(t => t.replace(/^[./-]+|[./-]+$/g, '')).filter(t => t.length >= 3 && !D.STOPWORDS.has(t) && !/^\d+$/.test(t));
    const freq = {};
    tokens.forEach(t => (freq[t] = (freq[t] || 0) + 1));
    const big = {};
    for (let i = 0; i + 1 < tokens.length; i++) { const b = tokens[i] + ' ' + tokens[i + 1]; big[b] = (big[b] || 0) + 1; }
    const skillWords = new Set(offerSkills.flatMap(s => { const e = D.SKILLS.find(x => x[0] === s.name) || [s.name]; return [e[0]].concat(e.slice(2)).flatMap(t => norm(t).split(/\s+/)); }));
    const kw = [];
    offerSkills.sort((a, b) => b.count - a.count).forEach(s => kw.push({ term: s.name, weight: 3, type: 'skill', fam: s.fam }));
    Object.entries(big).filter(([b, c]) => c >= 2 && !b.split(' ').some(w => skillWords.has(w))).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([b]) => kw.push({ term: b, weight: 2, type: 'frase' }));
    Object.entries(freq).filter(([t, c]) => c >= 2 && !skillWords.has(t) && !kw.some(k => k.term.includes(t))).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([t]) => kw.push({ term: t, weight: 1, type: 'palabra' }));
    const cvN = ctx.cvNorm;
    const sectionHas = (term, key) => (ctx.sectionNorm[key] || '').includes(term);
    let got = 0, total = 0;
    const results = kw.map(k => {
      let found = false, where = [];
      if (k.type === 'skill') {
        const s = SKILL_INDEX.find(x => x.canon === k.term);
        found = s.res.some(re => { re.lastIndex = 0; return re.test(cvN); });
        if (found) ['experience', 'skills', 'summary'].forEach(sec => { if (s.res.some(re => { re.lastIndex = 0; return re.test(ctx.sectionNorm[sec] || ''); })) where.push(sec); });
      } else {
        const t = norm(k.term);
        const stem = t.length >= 7 ? t.slice(0, t.length - 2) : t;
        found = new RegExp('(?:^|[^a-z])' + esc(stem)).test(cvN);
        if (found) ['experience', 'skills', 'summary'].forEach(sec => { if (sectionHas(stem, sec)) where.push(sec); });
      }
      total += k.weight; if (found) got += k.weight;
      return Object.assign({}, k, { found, where });
    });
    // años requeridos
    let yearsReq = null;
    const ym = [...n.matchAll(/(?:minimo|al menos|mas de|at least|minimum|over)?\s*(\d{1,2})\s*\+?\s*(?:anos|years|ans|jahre|yrs)/g)].map(m => +m[1]).filter(x => x > 0 && x < 30);
    if (ym.length) yearsReq = Math.max(...ym);
    const langsReq = [];
    for (const L of LANG_INDEX) {
      const m = n.match(new RegExp(L.re.source + '[^\\n.]{0,40}'));
      if (m) {
        let lvl = null; for (const [re, label, rank] of D.LEVELS) if (re.test(m[0])) { lvl = { label, rank }; break; }
        langsReq.push({ name: L.canon, level: lvl ? lvl.label : '', rank: lvl ? lvl.rank : 0 });
      }
    }
    const firstLine = raw.split('\n').map(s => s.trim()).find(Boolean) || '';
    const title = wc(firstLine) <= 10 ? firstLine.replace(/^(oferta|puesto|vacante|job title|position)\s*:\s*/i, '') : '';
    const lang = detectLang(n);
    return { score: pct(got, total), keywords: results, yearsReq, langsReq, title, lang, skills: offerSkills.map(s => s.name) };
  }

  // ---------- varias ofertas: matriz de palabras clave ----------
  function matchOffers(text, offers) {
    const lines = toLines(text);
    const cvNorm = norm(lines.join('\n'));
    const bySec = {};
    for (const sct of segment(lines)) (bySec[sct.key] = bySec[sct.key] || []).push(...sct.lines);
    const sectionNorm = {};
    for (const k in bySec) sectionNorm[k] = norm(bySec[k].join('\n'));
    const list = [];
    offers.forEach((o, i) => { const a = analyzeOffer(o, { cvNorm, sectionNorm }); if (a) list.push(Object.assign(a, { index: i, offerNorm: norm(o) })); });
    if (!list.length) return null;
    const terms = new Map();
    list.forEach(a => a.keywords.forEach(k => {
      const key = norm(k.term);
      const t = terms.get(key) || { term: k.term, type: k.type, weight: k.weight, fam: k.fam, found: k.found, where: k.where };
      t.weight = Math.max(t.weight, k.weight);
      terms.set(key, t);
    }));
    const presentIn = (t, on) => {
      if (t.type === 'skill') { const sk = SKILL_INDEX.find(x => x.canon === t.term); return !!sk && sk.res.some(re => { re.lastIndex = 0; return re.test(on); }); }
      const n = norm(t.term); const stem = n.length >= 7 ? n.slice(0, n.length - 2) : n;
      return new RegExp('(?:^|[^a-z])' + esc(stem)).test(on);
    };
    const rows = [...terms.values()].map(t => { t.in = list.map(a => presentIn(t, a.offerNorm)); t.count = t.in.filter(Boolean).length; return t; })
      .filter(r => r.type === 'skill' || r.count >= 2 || list.length === 1)
      .sort((a, b) => b.count - a.count || (a.found === b.found ? 0 : a.found ? 1 : -1) || b.weight - a.weight);
    return {
      offers: list.map(a => ({ index: a.index, title: a.title || 'Oferta ' + (a.index + 1), score: a.score, yearsReq: a.yearsReq, langsReq: a.langsReq, lang: a.lang })),
      rows: rows.slice(0, 45),
      commonMissing: list.length > 1 ? rows.filter(r => r.count === list.length && !r.found).map(r => r.term) : [],
      mostMissing: rows.filter(r => !r.found && r.count >= Math.max(2, Math.ceil(list.length / 2))).map(r => r.term)
    };
  }

  // ---------- análisis principal ----------

  // ¿Es un CV? Suma señales típicas de un currículum y resta las de otros documentos (facturas, contratos,
  // artículos, cartas, ofertas de empleo…). No bloquea nada por sí sola: la interfaz pregunta antes de analizar.
  const NOT_CV = [
    ['una factura o un recibo', /\b(factura|invoice|base imponible|importe total|total a pagar|subtotal|n\.?\s?de factura|fecha de vencimiento|forma de pago|iban|receipt|amount due|vat number|ticket)\b/g],
    ['un contrato o un documento legal', /\b(clausula|clausulas|las partes|en virtud de|contratante|arrendador|arrendatario|el presente contrato|reunidos|exponen|hereby|whereas|agreement|terms and conditions|jurisdiccion)\b/g],
    ['un artículo o un trabajo académico', /\b(abstract|resumen ejecutivo|palabras clave|keywords|introduccion|metodologia|methodology|conclusiones|conclusions|bibliografia|references|et al|doi|figura \d|figure \d|tabla \d|table \d|hipotesis)\b/g],
    ['una carta', /\b(estimado|estimada|estimados|atentamente|cordialmente|me dirijo|dear|sincerely|yours faithfully|kind regards|a quien corresponda)\b/g],
    ['una oferta de empleo', /\b(buscamos|ofrecemos|se valorara|valorable|requisitos minimos|incorporacion inmediata|what we offer|we are looking for|you will|responsibilities|requirements|nice to have|salario|banda salarial|tipo de contrato|jornada completa)\b/g],
    ['un temario, unos apuntes o un manual', /\b(tema \d+|capitulo \d+|chapter \d+|ejercicio \d+|exercise \d+|indice|leccion \d+|unidad \d+|apartado \d+)\b/g],
    ['una receta o un menú', /\b(ingredientes|ingredients|preparacion|cucharada|gramos de|al horno|minutos a fuego|precalienta)\b/g]
  ];
  function docCheck(x) {
    const why = [];
    let pos = 0;
    const strong = ['experience', 'education', 'skills', 'languages', 'summary', 'projects', 'certifications', 'courses'].filter(k => x.present.includes(k));
    pos += Math.min(6, strong.length * 2);
    if (x.email) pos += 2; if (x.phone) pos += 1; if (x.linkedin) pos += 2; if (x.name) pos += 1;
    if (x.experience.length) pos += 2; if (x.experience.length >= 2) pos += 1;
    if (x.education.length) pos += 1;
    if (x.dated >= 2) pos += 1;
    let neg = 0, kind = '';
    const per1k = 1000 / Math.max(200, x.words);
    for (const [label, re] of NOT_CV) {
      const n = (x.full.match(re) || []).length;
      if (n >= 3 || n * per1k >= 4) { const w = Math.min(6, n); if (w > neg) { neg = w; kind = label; } }
    }
    if (x.words > 3500) { neg += 3; why.push('es muy largo para un CV (' + x.words + ' palabras)'); }
    if (x.pages && x.pages > 6) { neg += 3; why.push('tiene ' + x.pages + ' páginas'); }
    if (x.words < 60) why.push('casi no tiene texto');
    if (!strong.length) why.push('no tiene secciones de CV (experiencia, formación, habilidades…)');
    if (!x.email && !x.phone && !x.linkedin) why.push('no tiene datos de contacto');
    if (kind) why.unshift('parece ' + kind);
    const score = pos - neg;
    // Menos de 5 puntos: no se parece a un CV. Un CV con texto (no escaneado) suele pasar de 9.
    const verdict = x.words < 60 ? 'empty' : score >= 5 ? 'cv' : score >= 2 ? 'doubt' : 'not_cv';
    return { verdict, score, positive: pos, negative: neg, kind, why };
  }

  function analyze(input) {
    const text = input.text || '';
    const meta = Object.assign({ fileType: 'txt', fileName: '', pages: null, columns: false, tables: false, textBoxes: false, images: 0, photoLikely: false, fonts: 0, headerFooterContact: false, tinyText: 0, pageSize: null }, input.meta || {});
    const opts = Object.assign({ country: 'ES', company: 'general', offer: '', now: new Date() }, input.opts || {});
    const now = opts.now instanceof Date ? opts.now : new Date(opts.now);
    const country = D.COUNTRIES[opts.country] || D.COUNTRIES.ES;
    const company = D.COMPANY_TYPES[opts.company] || D.COMPANY_TYPES.general;

    const lines = toLines(text);
    const fullNorm = norm(lines.join('\n'));
    const words = wc(text);
    const lang = detectLang(fullNorm);
    const sections = segment(lines);
    const bySec = {};
    for (const s of sections) { (bySec[s.key] = bySec[s.key] || { lines: [], titles: [] }).lines.push(...s.lines); if (s.title) bySec[s.key].titles.push(s.title); }
    const sectionNorm = {};
    for (const k in bySec) sectionNorm[k] = norm(bySec[k].lines.join('\n'));
    const present = Object.keys(bySec).filter(k => k !== 'header');

    // contacto
    const header = (bySec.header ? bySec.header.lines : []).slice(0, 12);
    const emailM = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    const email = emailM ? emailM[0] : '';
    let phone = '', phoneDial = '', phoneLocalGuess = '';
    const phoneCands = text.match(/(?:\+|00)\s?\d{1,3}[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?){2,5}\d{2,4}|(?<![\d/.-])(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?![\d/.-])/g) || [];
    for (const c of phoneCands) {
      const digits = c.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) continue;
      if (/^(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}$/.test(c.trim())) continue;
      if (/^\d{2}[/.-]\d{2}[/.-]\d{2,4}$/.test(c.trim())) continue;
      phone = c.trim();
      if (/^(\+|00)/.test(phone)) {
        const d = digits.replace(/^00/, '');
        const dials = Object.values(D.COUNTRIES).map(x => x.dial).sort((a, b) => b.length - a.length);
        phoneDial = dials.find(x => d.startsWith(x)) || '';
      } else if (/^[6789]\d{8}$/.test(digits)) phoneLocalGuess = '34';
      break;
    }
    const linkedin = (text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i) || [''])[0];
    const github = (text.match(/(?:https?:\/\/)?github\.com\/[A-Za-z0-9\-_]+/i) || [''])[0];
    const urls = uniq((text.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:com|es|io|dev|me|net|org|app|design|art|eu|co|pt|de|fr|it|uk|mx|ar|cl)(?:\/[\w\-./%]*)?/gi) || [])
      .filter(u => !/linkedin\.com|github\.com|@/.test(u) && !(email && email.toLowerCase().includes(u.toLowerCase().replace(/^https?:\/\//, '')))));
    const otherLinks = urls.filter(u => /behance|dribbble|portfolio|medium|kaggle|gitlab|orcid|scholar|researchgate|stackoverflow|wix|notion|vercel|netlify|carrd|about\.me|\.dev|\.io|\.me/i.test(u) || /^https?:/.test(u)).slice(0, 4);

    let name = '';
    if (meta.titleLine && looksLikeName(meta.titleLine.trim())) name = meta.titleLine.trim();
    if (!name) for (const l of lines.slice(0, 8)) if (looksLikeName(l) && !findSkills(norm(l)).length) { name = l; break; }
    let headline = '';
    if (name) {
      const idx = lines.indexOf(name);
      for (const l of lines.slice(idx + 1, idx + 4)) {
        if (/@|\d{3}|linkedin|http|www\./i.test(l) || headingOf(l) || wc(l) > 12 || findTokens(l).length) continue;
        headline = l.replace(/^[|•·\s-]+|[|•·\s-]+$/g, ''); break;
      }
    }
    let location = '';
    for (const l of header.concat(bySec.contact ? bySec.contact.lines : [], bySec.personal ? bySec.personal.lines : [])) {
      const parts = l.split(/\s*[|•·]\s*|\s{2,}/);
      for (const p of parts) {
        const n = norm(p);
        if (/@|linkedin|http|www\./.test(n) || /\d{6,}/.test(p.replace(/\s/g, ''))) continue;
        if ((CITY_RE.test(n) || /\b\d{5}\b/.test(n)) && wc(p) <= 6 && !ROLE_WORDS.test(n)) { location = p.replace(/^(ubicaci[oó]n|direcci[oó]n|location|address|residencia)\s*:\s*/i, '').trim(); break; }
      }
      if (location) break;
    }

    // experiencia
    let expLines = bySec.experience ? bySec.experience.lines : [];
    let experience = parseEntries(expLines, 'exp', now);
    const expSectionFound = !!bySec.experience;
    if (!experience.length && !expSectionFound) {
      // CV sin encabezados: usar rangos de fechas de todo el documento fuera de formación
      const eduSet = new Set((bySec.education ? bySec.education.lines : []));
      const loose = lines.filter(l => !eduSet.has(l));
      experience = parseEntries(loose, 'exp', now).filter(e => !DEGREE_WORDS.test(norm(e.title + ' ' + e.company)));
    }
    experience = experience.filter(e => (e.title || e.company || e.bullets.length));
    let education = parseEntries(bySec.education ? bySec.education.lines : [], 'edu', now);
    if (!education.length && bySec.education) {
      education = bySec.education.lines.filter(l => DEGREE_WORDS.test(norm(l))).map(l => Object.assign(classifyEduHeader(splitHeaderPieces([l])), { start: null, end: null, bullets: [] }));
    }
    const courses = bySec.courses ? splitList(bySec.courses.lines).filter(x => wc(x) >= 2).concat(parseEntries(bySec.courses.lines, 'edu', now).map(e => [e.degree, e.institution].filter(Boolean).join(' — '))).filter(Boolean) : [];

    const merged = mergeIntervals(experience);
    const totalMonths = merged.reduce((a, [s, e]) => a + (e - s + 1), 0);
    const totalYears = Math.round(totalMonths / 12 * 10) / 10;

    // habilidades
    const skillsFound = findSkills(fullNorm);
    const famCount = {};
    skillsFound.forEach(s => (famCount[s.fam] = (famCount[s.fam] || 0) + s.count));
    const titleNorm = norm(experience.map(e => e.title).join(' ') + ' ' + headline);
    const famFromTitle = [['sales', /comercial|ventas|sales|account|vendedor|desarrollo de negocio|business development|kam/], ['it', /desarrollador|developer|programador|software|devops|sistemas|frontend|backend|full ?stack|engineer|ingeniero de software|qa|cto/], ['data', /datos|data|analista de datos|bi\b|business intelligence|cientifico de datos/], ['mkt', /marketing|seo|sem|community|contenido|growth|brand/], ['fin', /contable|contabilidad|financ|controller|auditor|tesorer|fiscal/], ['hr', /rrhh|recursos humanos|talent|recruit|seleccion|people|nominas/], ['design', /disenador|designer|ux|ui|grafico|creativ/], ['log', /logistic|almacen|compras|supply|transporte|mozo|carretiller|operario de almacen/], ['cs', /atencion al cliente|customer|call center|teleoperador|soporte/], ['hosp', /camarer|cocin|chef|recepcion|hotel|hosteleria|barista|sala/], ['retail', /dependient|tienda|store|cajer|retail/], ['health', /enfermer|medic|auxiliar de enfermeria|fisioterapeut|farmac|tcae/], ['edu', /profesor|docente|maestr|teacher|formador|tutor/], ['legal', /abogad|legal|jurid|compliance|paralegal/], ['admin', /administrativ|recepcionista|secretari|office|auxiliar administrativo|asistente de direccion/], ['eng', /ingenier|mantenimiento|produccion|calidad|tecnico de|electric|mecanic|obra/], ['pm', /project|proyecto|product|scrum|pmo/]];
    famFromTitle.forEach(([f, re]) => { if (re.test(titleNorm)) famCount[f] = (famCount[f] || 0) + 4; });
    const family = Object.entries(famCount).sort((a, b) => b[1] - a[1])[0];
    const mainFamily = family ? family[0] : 'general';
    const listedSkills = bySec.skills ? splitList(bySec.skills.lines) : [];
    const softSkills = uniq(D.SOFT_SKILLS.filter(s => wordRe(s).test(fullNorm)).map(s => cap(s)));
    const languages = parseLanguages(bySec.languages ? bySec.languages.lines : [], fullNorm);
    let certs = uniq([...(bySec.certifications ? splitList(bySec.certifications.lines).concat(bySec.certifications.lines.filter(l => wc(l) > 6).map(stripBullet)) : []), ...((text.match(CERT_RE) || []).map(s => s.trim()))].map(s => s.replace(/\s+/g, ' '))).filter(s => s.length > 2).slice(0, 20);
    for (let i = certs.length - 1; i >= 0; i--) if (certs.some((c, j) => j !== i && norm(c).includes(norm(certs[i])) && c.length > certs[i].length)) certs.splice(i, 1);
    const projects = bySec.projects ? parseProjects(bySec.projects.lines, now) : [];
    const interests = bySec.interests ? splitList(bySec.interests.lines).filter(x => !/referencias|references|referees/i.test(x)) : [];
    const summary = bySec.summary ? bySec.summary.lines.join(' ').trim() : '';

    // ---------- métricas de contenido ----------
    const allBullets = experience.flatMap(e => e.bullets);
    const strongSet = new Set(D.STRONG_VERBS_ES.concat(D.STRONG_VERBS_EN));
    const firstWord = b => norm(b).replace(/^[^a-z]+/, '').split(/[^a-z]+/)[0] || '';
    // además del diccionario: pretérito en 1.ª persona en español («Validé», «Repuse») y pasado regular en inglés («Shipped»)
    const rawFirst = b => (String(b).replace(/^[^\p{L}]+/u, '').match(/^\p{L}+/u) || [''])[0];
    const isStrong = b => {
      if (strongSet.has(firstWord(b))) return true;
      if (isWeak(b)) return false;
      const w = rawFirst(b).toLowerCase();
      return (w.length >= 5 && /é$/.test(w)) || /^(repuse|hice|puse|traje|dije|conduje|obtuve|propuse|dispuse|compuse|introduje|traduje|produje)$/.test(w) || (lang === 'en' && w.length >= 5 && /ed$/.test(w));
    };
    const weakRe = new RegExp('^(' + D.WEAK_OPENERS.map(w => esc(norm(w))).join('|') + ')\\b');
    const isWeak = b => weakRe.test(norm(b).replace(/^[^a-z]+/, ''));
    const isQuant = b => /\d/.test(b.replace(/\b(19|20)\d{2}\b/g, '').replace(/\b[A-Z]{1,3}\d\b/g, '')) || /\b(doble|triple|duplic|tripl|mitad|double|tripled|doubled|half)\w*/i.test(b);
    const strongCount = allBullets.filter(isStrong).length;
    const weakBullets = allBullets.filter(isWeak);
    const quantCount = allBullets.filter(isQuant).length;
    const longBullets = allBullets.filter(b => wc(b) > 38);
    const cliches = uniq(D.CLICHES.filter(c => wordRe(norm(c)).test(fullNorm)));
    const firstPerson = lang === 'en' ? (fullNorm.match(/(?:^|[^a-z])(i|my|me)(?![a-z])/g) || []).length : (fullNorm.match(/(?:^|[^a-z])(yo|me considero|mi experiencia me)(?![a-z])/g) || []).length;

    // fechas: formatos usados
    const dateFormats = uniq(experience.flatMap(e => [e.start, e.end]).filter(d => d && !d.present).map(d => d.fmt));
    // orden cronológico inverso
    let chronoOk = true;
    for (let i = 1; i < experience.length; i++) if (experience[i].startIdx != null && experience[i - 1].startIdx != null && experience[i].startIdx > experience[i - 1].startIdx + 1) chronoOk = false;
    // huecos
    const gaps = [];
    for (let i = 1; i < merged.length; i++) { const g = merged[i][0] - merged[i - 1][1] - 1; if (g >= 6) gaps.push({ months: g, from: merged[i - 1][1], to: merged[i][0] }); }
    const nowIdx = now.getFullYear() * 12 + now.getMonth();
    if (merged.length && !experience.some(e => e.current)) { const g = nowIdx - merged[merged.length - 1][1]; if (g >= 6) gaps.push({ months: g, from: merged[merged.length - 1][1], to: null, current: true }); }
    const eduIv = mergeIntervals(education);
    gaps.forEach(g => { const to = g.to == null ? nowIdx : g.to; const ov = eduIv.reduce((a, [s2, e2]) => a + Math.max(0, Math.min(e2, to - 1) - Math.max(s2, g.from + 1) + 1), 0); g.study = ov >= g.months * 0.5; });
    const idxLabel = i => { const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return MES[i % 12] + ' ' + Math.floor(i / 12); };

    // personales
    const personalHits = PERSONAL.filter(p => p.re.test(text)).map(p => Object.assign({}, p));
    const injection = INJECTION_RE.test(text);
    const icons = (text.match(ICON_RE) || []).length;
    const ratings = RATING_RE.test(text);
    // relleno de palabras clave
    const tokFreq = {};
    // solo cuenta frases: los títulos de puesto, titulaciones, certificados y nombres de proyecto repiten términos de forma legítima
    const proseNorm = norm(lines.filter(l => { const x = stripBullet(String(l)).trim(); return wc(x) > 9 || /[.;]$/.test(x); }).join(' '));
    (proseNorm.match(/[a-z][a-z0-9+#.]{3,}/g) || []).forEach(t => { if (!D.STOPWORDS.has(t)) tokFreq[t] = (tokFreq[t] || 0) + 1; });
    const stuffed = Object.entries(tokFreq).filter(([t, c]) => c >= Math.max(9, words * 0.025) && !/^(gestion|desarrollo|cliente|clientes|proyecto|proyectos|equipo|ventas|management|development)$/.test(t)).map(([t]) => t);
    const rawSkillItems = bySec.skills ? bySec.skills.lines.flatMap(l => l.replace(/^[^:]{2,30}:\s*/, '').split(/[,;|•·]/).map(x => stripBullet(x).trim()).filter(Boolean)) : [];
    const skillDupes = rawSkillItems.filter((s, i) => rawSkillItems.findIndex(x => norm(x) === norm(s)) !== i);
    const cvHeading = lines.slice(0, 3).find(l => /^(curr[ií]culum( vitae)?|cv|resume|r[ée]sum[ée]|hoja de vida)$/i.test(l.trim()));
    const refsLine = lines.find(l => /(referencias (disponibles|a petici|bajo petici)|references (available )?(up)?on request|referencias:? a disposici)/i.test(l));
    const objective = bySec.summary && bySec.summary.titles.some(t => /objetivo|objective/i.test(t));
    const basicOffice = skillsFound.filter(s => ['Microsoft Office', 'Word', 'Outlook', 'PowerPoint'].includes(s.name)).map(s => s.name);
    const outdated = uniq((fullNorm.match(/\b(windows xp|windows 98|windows 7|office 2003|office 2007|ms-dos|msdos|flash|actionscript|frontpage|dreamweaver|visual basic 6|lotus notes|internet explorer)\b/g) || []));
    const basicSchool = (bySec.education ? bySec.education.lines : []).filter(l => /\b(eso|e\.s\.o|egb|educacion primaria|educacion secundaria obligatoria|graduado escolar|primary school)\b/.test(norm(l)));
    const hasHigher = education.some(e => /grado|licenci|master|mba|doctor|phd|bachelor|ingenier|diplomatura|tecnico superior|cfgs|university|universidad/.test(norm(e.degree + ' ' + e.institution)));
    const genericHobbies = interests.filter(i => /^(leer|lectura|viajar|viajes|cine|musica|deporte|deportes|reading|travel|travelling|traveling|music|movies|sports|salir con amigos|ir al gimnasio|gimnasio)$/i.test(norm(i).trim()));
    const oldEntries = experience.filter(e => e.endIdx != null && nowIdx - e.endIdx > 15 * 12);
    const driving = /(carnet de conducir|permiso de conducir|carn[eé] b\b|carnet tipo b|driving licen[cs]e|f[uü]hrerschein|permis b)/i.test(text);
    const disability = /(discapacidad|disability|minusval)/i.test(text);
    const hasItalyClause = /(autorizzo il trattamento|regolamento ue 2016\/679|d\.?\s?lgs\.?\s?196)/i.test(text);
    const hasReferees = /(referees?|referencias)\s*:?/i.test(text) && bySec.references;

    // oferta
    const offer = analyzeOffer(opts.offer, { cvNorm: fullNorm, sectionNorm });

    // ---------- checks ----------
    const checks = [];
    const keyOf = (cat, title) => cat + ':' + norm(title).replace(/\(.*?\)/g, '').replace(/:.*$/, '').replace(/[\d.,%]+/g, '').replace(/\s+/g, ' ').trim();
    const C = (cat, status, title, detail, fix, strength) => checks.push({ key: keyOf(cat, title), cat, status, title, detail: detail || '', fix: fix || '', strength: strength || '' });

    // ATS e IA
    if (text.trim().length < 300) C('ats', 'bad', 'Casi no hay texto legible', 'Solo se han podido extraer ' + text.trim().length + ' caracteres. Suele pasar con PDF escaneados, exportados como imagen o hechos en herramientas de diseño.', 'Exporta el CV desde Word, Google Docs o similar con «Guardar como PDF» (no «Imprimir como imagen») y comprueba que puedes seleccionar el texto.');
    else C('ats', 'ok', 'El texto se extrae correctamente', words + ' palabras legibles por un ATS.', '', 'Texto seleccionable y legible por sistemas de filtrado.');
    if (meta.fileType === 'image') C('ats', 'bad', 'El CV es una imagen', 'Un ATS no puede leer imágenes.', 'Sube el CV en PDF de texto o DOCX.');
    else if (meta.fileType === 'pdf' || meta.fileType === 'docx') C('ats', 'ok', 'Formato de archivo compatible (' + meta.fileType.toUpperCase() + ')', '', '', '');
    const core = ['experience', 'education', 'skills'].filter(k => present.includes(k));
    const missingCore = ['experience', 'education', 'skills'].filter(k => !present.includes(k)).map(k => D.SECTION_LABELS[k]);
    if (missingCore.length === 0) C('ats', 'ok', 'Encabezados de sección estándar', 'Detectados: ' + present.map(k => D.SECTION_LABELS[k]).join(', ') + '.', '', 'Secciones con nombres estándar que los ATS reconocen.');
    else C('ats', missingCore.length >= 2 ? 'bad' : 'warn', 'Faltan encabezados estándar: ' + missingCore.join(', '), 'Los ATS clasifican la información por encabezados. Si no los reconocen, la experiencia o la formación pueden quedar sin indexar.', 'Usa títulos literales y sencillos: «Experiencia profesional», «Formación», «Habilidades», «Idiomas».');
    if (meta.columns === 'native') C('ats', 'warn', 'Columnas nativas del procesador de textos', 'Las columnas creadas con la función «Columnas» de Word se leen mejor que las tablas, pero algunos ATS siguen mezclando el orden.', 'Para portales, usa una sola columna. Si mantienes columnas, que la experiencia vaya entera en una de ellas.');
    else if (meta.columns) C('ats', 'bad', 'Diseño a varias columnas o con barra lateral', 'El texto se lee en un orden distinto al visual: ' + (meta.columnsDetail || 'hay líneas con contenido en dos zonas separadas de la página') + '. Muchos ATS mezclan las columnas al leerlas.', 'Usa una sola columna. Si quieres conservar el diseño, ten dos versiones: la visual para enviar en mano y la de una columna para portales.');
    else if (meta.fileType === 'pdf' || meta.fileType === 'docx') C('ats', 'ok', 'Maquetación de una columna', '', '', 'Maquetación lineal que se lee en el orden correcto.');
    if (meta.tables) C('ats', 'warn', 'Contenido dentro de tablas', 'Se han encontrado ' + meta.tables + ' tabla(s). Algunos ATS leen las tablas celda a celda y desordenan fechas, puestos y empresas.', 'Sustituye las tablas por texto con tabulaciones o líneas separadas.');
    if (meta.textBoxes) C('ats', 'bad', 'Cuadros de texto', 'Hay ' + meta.textBoxes + ' cuadro(s) de texto. Su contenido suele ignorarse al leer el documento.', 'Pasa ese contenido al cuerpo del documento.');
    if (meta.headerFooterContact) C('ats', 'warn', 'Datos de contacto en el encabezado o pie de página', 'Varios ATS descartan encabezados y pies: podrías quedarte sin teléfono ni email en la ficha.', 'Mueve nombre, email y teléfono al cuerpo del documento, en las primeras líneas.');
    const spacedLines = (String(text).split('\n').filter(l => SPACED_RE.test(l.trim())).length) + (meta.spaced || 0);
    if (spacedLines) C('ats', 'warn', 'Letras separadas por espacios en el nombre o los encabezados', 'Hay ' + spacedLines + ' fragmento(s) escritos como «E X P E R I E N C I A». Un ATS lo lee como letras sueltas: no reconoce tu nombre ni el encabezado, y la sección puede quedar sin clasificar.', 'Escribe las palabras normales y, si quieres ese efecto, usa el espaciado entre caracteres del editor (en Canva: «Espaciado de letras»; en Word: Fuente › Avanzado › Espaciado).');
    if (icons > 0) C('ats', 'warn', 'Iconos o emojis en el texto (' + icons + ')', 'Los iconos de teléfono, email o ubicación se convierten en caracteres sin sentido al extraer el texto.', 'Escribe etiquetas de texto («Email:», «Tel.:») o deja el dato solo.');
    if (ratings) C('ats', 'warn', 'Niveles con barras, puntos o porcentajes', 'Un ATS no entiende «●●●○○» ni «80 %»; tampoco un reclutador sabe qué significa.', 'Indica el nivel con palabras (Avanzado, Intermedio) o con el MCER para idiomas (B2, C1).');
    if (meta.fonts > 4) C('ats', 'warn', 'Demasiadas fuentes (' + meta.fonts + ')', 'Más de 3–4 variantes tipográficas suele indicar un diseño recargado o texto incrustado desde otras herramientas.', 'Usa una o dos familias estándar (Calibri, Arial, Garamond, Helvetica, Lato…).');
    if (meta.tinyText > 0) C('ats', 'bad', 'Texto diminuto u oculto (' + meta.tinyText + ' fragmentos)', 'Hay texto con un tamaño inferior a 4 pt. Los filtros modernos lo detectan como intento de manipular el ranking.', 'Elimina cualquier texto oculto o en blanco: si se detecta, la candidatura se descarta.');
    if (injection) C('ats', 'bad', 'Instrucciones dirigidas a la IA dentro del CV', 'El CV contiene frases que intentan dar órdenes a un sistema de IA («ignora las instrucciones…», «este candidato es el mejor…»). Los filtros actuales lo marcan como manipulación.', 'Elimínalas. Además de descartarte, pueden figurar como mala praxis en el proceso.');
    if (stuffed.length) C('ats', 'warn', 'Posible relleno de palabras clave', 'Términos repetidos en exceso: ' + stuffed.slice(0, 6).join(', ') + '.', 'Usa cada palabra clave en contexto (dentro de un logro) una o dos veces; la repetición la penalizan los filtros con IA.');
    if (experience.length) {
      const withDates = experience.filter(e => e.startIdx != null).length;
      C('ats', withDates === experience.length ? 'ok' : 'warn', withDates === experience.length ? 'Fechas de experiencia legibles' : 'Puestos sin fechas reconocibles', withDates + ' de ' + experience.length + ' puestos con fechas.', 'Indica inicio y fin de cada puesto con mes y año (MM/AAAA).', withDates === experience.length ? 'Fechas claras en todos los puestos.' : '');
    } else if (expSectionFound) C('ats', 'warn', 'No se han podido separar los puestos', 'Hay sección de experiencia, pero no se reconocen fechas en formato estándar.', 'Pon cada puesto en su línea con «Puesto — Empresa» y debajo «MM/AAAA – MM/AAAA».');
    if (dateFormats.length > 1) C('ats', 'warn', 'Formatos de fecha mezclados', 'Se usan: ' + dateFormats.join(', ') + '.', 'Elige un formato y úsalo en todo el CV (p. ej. «03/2021 – 06/2024» o «mar 2021 – jun 2024»).');
    if (meta.fileName) {
      const fnN = norm(meta.fileName);
      const nameParts = norm(name).split(/\s+/).filter(p => p.length > 2);
      if (/^(cv|curriculum|curriculum vitae|resume|documento\d*|document\d*|sin titulo|untitled|scan|escaneo|img|image|nuevo|new|final)[ _.\-\d]*(\.(pdf|docx?|txt))?$/i.test(fnN) || (nameParts.length && !nameParts.some(p => fnN.includes(p)))) C('ats', 'warn', 'Nombre de archivo genérico', '«' + meta.fileName + '» no identifica al candidato cuando el reclutador lo descarga.', 'Renómbralo así: Nombre-Apellido-CV-Puesto.pdf');
      else C('ats', 'ok', 'Nombre de archivo identificable', '', '', '');
    }

    // Contenido
    if (summary) {
      const sw = wc(summary);
      if (sw < 25) C('content', 'warn', 'Perfil profesional muy breve', sw + ' palabras.', 'Amplía a 3–4 líneas: quién eres, años de experiencia, especialidad y un logro o valor diferencial.');
      else if (sw > 120) C('content', 'warn', 'Perfil profesional demasiado largo', sw + ' palabras: el reclutador lo leerá en diagonal.', 'Redúcelo a 50–90 palabras.');
      else C('content', 'ok', 'Perfil profesional bien dimensionado', sw + ' palabras.', '', 'Perfil profesional conciso al inicio del CV.');
    } else C('content', 'warn', 'Sin perfil profesional', 'El perfil es lo primero que lee un reclutador y donde un ATS espera el titular y las palabras clave.', 'Añade 3–4 líneas bajo tu nombre. En «Datos para copiar» tienes un borrador generado con tus datos.');
    if (experience.length) {
      const thin = experience.filter(e => e.bullets.length < 2 && !(e.endIdx != null && nowIdx - e.endIdx > 15 * 12));
      if (thin.length) C('content', 'warn', thin.length + ' puesto(s) con poca descripción', thin.map(e => e.title || e.company || 'Puesto sin título').slice(0, 4).join(' · '), 'Describe cada puesto relevante con 3–5 viñetas centradas en logros. Mira la sección «Experiencia».');
      else C('content', 'ok', 'Puestos bien descritos', 'Media de ' + (allBullets.length / experience.length).toFixed(1) + ' líneas por puesto.', '', 'Cada puesto tiene descripción suficiente.');
    }
    if (allBullets.length >= 3) {
      const sr = pct(strongCount, allBullets.length);
      if (sr >= 60) C('content', 'ok', 'Viñetas que empiezan con verbo de acción (' + sr + ' %)', '', '', 'Redacción orientada a la acción (' + sr + ' % de las viñetas empiezan con un verbo fuerte).');
      else C('content', sr >= 30 ? 'warn' : 'bad', 'Pocas viñetas con verbo de acción (' + sr + ' %)', weakBullets.length ? 'Empiezan de forma débil: «' + weakBullets.slice(0, 2).map(b => b.slice(0, 60)).join('», «') + '»' : 'Muchas viñetas son listas de tareas sin verbo.', 'Empieza cada viñeta con un verbo en pasado: gestioné, reduje, lancé, negocié, automaticé…');
      const qr = pct(quantCount, allBullets.length);
      if (qr >= 40) C('content', 'ok', 'Logros cuantificados (' + qr + ' %)', '', '', quantCount + ' logros con cifras concretas (' + qr + ' % de las viñetas).');
      else C('content', qr >= 15 ? 'warn' : 'bad', 'Pocos logros con cifras (' + qr + ' %)', 'Las cifras (%, €, número de clientes, plazos) son lo que más diferencia un CV, tanto para personas como para filtros con IA.', 'Apunta a que al menos 1 de cada 2 viñetas tenga un número. En «Experiencia» tienes preguntas para sacar esas cifras.');
      if (longBullets.length) C('content', 'warn', longBullets.length + ' viñeta(s) demasiado larga(s)', 'Más de 38 palabras por viñeta dificulta la lectura en diagonal.', 'Divide en dos o quita lo accesorio. Ideal: 1–2 líneas.');
    }
    if (cliches.length >= 3) C('content', 'warn', 'Frases hechas (' + cliches.length + ')', cliches.slice(0, 8).join(', ') + '.', 'Sustituye adjetivos por hechos: en vez de «proactivo», cuenta algo que pusiste en marcha por iniciativa propia.');
    else if (cliches.length) C('content', 'info', 'Alguna frase hecha', cliches.join(', ') + '.', 'Acompáñala de un ejemplo concreto o elimínala.');
    if (firstPerson > 2) C('content', 'warn', 'Redacción en primera persona', 'El CV usa «yo»/«I» varias veces.', 'Elimina el pronombre: «Gestioné…» en lugar de «Yo gestioné…».');
    const hard = skillsFound.filter(s => !['Microsoft Office', 'Word', 'Outlook', 'PowerPoint'].includes(s.name));
    if (hard.length >= 6) C('content', 'ok', hard.length + ' competencias técnicas identificables', hard.slice(0, 10).map(s => s.name).join(', ') + (hard.length > 10 ? '…' : ''), '', hard.length + ' competencias técnicas reconocibles por los filtros.');
    else C('content', hard.length >= 3 ? 'warn' : 'bad', 'Pocas competencias técnicas reconocibles (' + hard.length + ')', 'Los filtros buscan herramientas, metodologías y tecnologías concretas.', 'Añade una sección «Habilidades» con 8–12 competencias reales y concretas (programas, métodos, normas).');
    if (languages.length) {
      const noLvl = languages.filter(l => !l.level);
      if (noLvl.length) C('content', 'warn', 'Idiomas sin nivel: ' + noLvl.map(l => l.name).join(', '), 'Sin nivel, el filtro de idioma de los portales no te encuentra.', 'Usa el MCER (A1–C2) y, si tienes certificado, cítalo: «Inglés C1 (Cambridge Advanced)».');
      else C('content', 'ok', 'Idiomas con nivel indicado', languages.map(l => l.name + ' ' + l.level).join(', '), '', 'Idiomas con nivel claro: ' + languages.map(l => l.name + ' (' + l.level + ')').join(', ') + '.');
    } else C('content', 'info', 'No se detectan idiomas', '', 'Si hablas otros idiomas, añade una sección «Idiomas» con el nivel MCER.');
    if (certs.length) C('content', 'ok', certs.length + ' certificación(es) o acreditación(es)', '', '', 'Certificaciones verificables: ' + certs.slice(0, 4).join(', ') + '.');

    // Estructura
    if (experience.length > 1) C('structure', chronoOk ? 'ok' : 'warn', chronoOk ? 'Orden cronológico inverso' : 'La experiencia no está en orden cronológico inverso', '', 'Pon primero el puesto más reciente.', chronoOk ? 'Experiencia ordenada de la más reciente a la más antigua.' : '');
    if (words < 200) C('structure', 'bad', 'CV muy corto (' + words + ' palabras)', '', 'Desarrolla perfil, logros por puesto y habilidades. Un CV completo suele tener 350–800 palabras.');
    else if (words < 330) C('structure', 'warn', 'CV algo escaso (' + words + ' palabras)', '', 'Añade logros y contexto a cada puesto.');
    else if (words > 1100 && opts.company !== 'academico') C('structure', 'warn', 'CV extenso (' + words + ' palabras)', 'Un reclutador dedica de media menos de un minuto a la primera lectura.', 'Recorta puestos antiguos o poco relevantes y deja 3–5 viñetas en los recientes.');
    else C('structure', 'ok', 'Extensión adecuada (' + words + ' palabras)', '', '', '');
    const maxPages = country.pages + (opts.company === 'academico' ? 6 : 0);
    if (meta.pages) {
      if (meta.pages > maxPages) C('structure', 'warn', meta.pages + ' páginas: más de lo habitual en ' + country.name, 'Lo esperado es ' + country.pages + (country.pages === 1 ? ' página' : ' páginas como máximo') + '.', 'Condensa la experiencia de más de 10–15 años y elimina datos que no aporten.');
      else C('structure', 'ok', meta.pages + (meta.pages === 1 ? ' página' : ' páginas'), '', '', '');
      if (opts.country === 'US' && meta.pages > 1 && totalYears < 10) C('country', 'warn', 'En EE. UU. se espera una página con menos de 10 años de experiencia', '', 'Reduce a una página.');
    }
    gaps.forEach(g => g.study ? C('structure', 'info', 'Periodo sin experiencia ' + idxLabel(g.from) + ' – ' + (g.to == null ? 'hoy' : idxLabel(g.to)) + ' cubierto por formación', 'Coincide con tus estudios; no necesita explicación.', '') : C('structure', g.months >= 12 ? 'warn' : 'info', (g.current ? 'Sin empleo registrado desde ' + idxLabel(g.from) : 'Periodo sin experiencia: ' + idxLabel(g.from) + ' – ' + idxLabel(g.to)) + ' (' + durationLabel(g.months) + ')', 'Los huecos en sí no son un problema, pero un filtro o una persona pueden preguntar por ellos.', 'Si estudiaste, cuidaste de alguien, emprendiste o hiciste proyectos, añádelo en una línea. Si no, ten preparada una explicación breve para la entrevista.'));
    if (!present.includes('education')) C('structure', 'warn', 'No se detecta la sección de formación', '', 'Añade «Formación» con titulación, centro y año, aunque sea breve.');
    // Coherencia interna (los filtros con IA contrastan fechas, cifras y titulares)
    const mesLabel = e => (e.title || e.company || 'Puesto');
    experience.forEach(e => {
      if (e.startIdx != null && e.endIdx != null && !e.current && e.startIdx > e.endIdx) C('coherence', 'bad', 'Fechas invertidas en «' + mesLabel(e) + '»', 'La fecha de inicio es posterior a la de fin.', 'Revisa el orden: primero inicio, después fin.');
      if (e.start && !e.start.present && e.startIdx > nowIdx) C('coherence', 'warn', 'Fecha de inicio futura en «' + mesLabel(e) + '»', fmtDate(e.start) + ' todavía no ha llegado.', 'Si es un puesto ya firmado, indícalo («Incorporación en …»); si no, corrige la fecha.');
      else if (e.end && !e.end.present && e.endIdx > nowIdx + 1) C('coherence', 'warn', 'Fecha de fin futura en «' + mesLabel(e) + '»', fmtDate(e.end) + ' todavía no ha llegado.', 'Si sigues en el puesto, pon «Actualidad».');
    });
    const overlaps = [];
    for (let i = 0; i < experience.length; i++) for (let j = i + 1; j < experience.length; j++) {
      const a = experience[i], b = experience[j];
      if (a.startIdx == null || b.startIdx == null) continue;
      let ov = 0;
      for (const x of (a.spans || [[a.startIdx, a.endIdx]])) for (const y of (b.spans || [[b.startIdx, b.endIdx]])) ov += Math.max(0, Math.min(x[1], y[1]) - Math.max(x[0], y[0]) + 1);
      if (ov >= 3) overlaps.push(mesLabel(a) + ' y ' + mesLabel(b) + ' (' + durationLabel(ov) + ')');
    }
    if (overlaps.length) C('coherence', 'info', 'Puestos que coinciden en el tiempo', overlaps.slice(0, 3).join(' · ') + '.', 'Si fueron a la vez (media jornada, freelance, prácticas), indícalo en el puesto. Si no, revisa las fechas: los filtros cuentan los años y los solapes llaman la atención.');
    const dupJobs = experience.filter((e, i) => e.title && experience.findIndex(x => norm(x.title) === norm(e.title) && norm(x.company) === norm(e.company)) !== i);
    if (dupJobs.length) C('coherence', 'warn', 'Puesto repetido', dupJobs.map(mesLabel).join(' · '), 'Si son dos etapas en la misma empresa, agrúpalas bajo una sola entrada con ambas fechas.');
    const claimText = norm([headline, summary, ...header.slice(0, 6)].join(' '));
    const claimM = claimText.match(/(\d{1,2})\s*\+?\s*(?:anos|years|ans|jahre)\s+(?:de\s+|of\s+)?(?:experiencia|experience|trayectoria|experiencia profesional)/);
    if (claimM && experience.length && totalYears > 0) {
      const claimed = +claimM[1];
      if (claimed - totalYears >= 2) C('coherence', 'warn', 'El perfil dice ' + claimed + ' años de experiencia; las fechas suman ' + String(totalYears).replace('.', ','), 'Un filtro con IA o un reclutador lo detectará al cruzar los datos.', 'Ajusta la cifra o añade la experiencia que falta (prácticas, freelance, otros puestos) con sus fechas.');
      else if (totalYears - claimed >= 3) C('coherence', 'info', 'El perfil dice ' + claimed + ' años; las fechas suman ' + String(totalYears).replace('.', ','), 'Te estás quedando corto.', 'Si toda esa experiencia es relevante, actualiza la cifra del perfil.');
      else C('coherence', 'ok', 'Años de experiencia coherentes con las fechas', '', '', 'Los años que declaras cuadran con las fechas de tus puestos.');
    }
    const cur = experience.find(e => e.current) || experience[0];
    if (headline && cur && cur.title) {
      const sig = t => norm(t).split(/[^a-z0-9+#]+/).filter(w => w.length > 3 && !D.STOPWORDS.has(w) && !/^(senior|junior|lead|head|jefe|jefa)$/.test(w));
      const hw = sig(headline), tw = sig(cur.title);
      if (hw.length && tw.length && !hw.some(w => tw.some(x => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5))))) C('coherence', 'info', 'Tu titular no coincide con tu puesto ' + (cur.current ? 'actual' : 'más reciente'), 'Titular: «' + headline + '» · Puesto: «' + cur.title + '».', 'Es correcto si buscas un cambio de rol, pero la experiencia y el perfil deben justificar el titular.');
    }
    for (const L of LANG_INDEX) {
      const m = claimText.match(new RegExp('(bilingue|nativo|nativa|native|fluent|fluido|fluida)[^.]{0,25}' + L.re.source.replace('(?:^|[^a-z])', '') + '|' + L.re.source + '[^.]{0,25}(bilingue|nativo|nativa|native|fluent|fluido|fluida)'));
      const mine = languages.find(x => x.name === L.canon);
      if (m && mine && mine.rank && mine.rank <= 4) C('coherence', 'warn', L.canon + ': el perfil dice nivel alto y la sección de idiomas indica ' + mine.level, '', 'Usa el mismo nivel en todo el CV; si tienes certificado, cítalo.');
    }
    if (experience.filter(e => e.current).length > 2) C('coherence', 'info', experience.filter(e => e.current).length + ' puestos marcados como actuales', '', 'Si de verdad los compaginas, indica la dedicación (media jornada, freelance). Si no, cierra las fechas de los que terminaron.');
    if (oldEntries.length) C('structure', 'info', oldEntries.length + ' puesto(s) de hace más de 15 años', oldEntries.map(e => e.title || e.company).join(' · '), 'Resúmelos en una línea cada uno («Experiencia previa» con puesto, empresa y años) para ganar espacio.');

    // Contacto
    if (name) C('contact', 'ok', 'Nombre al principio del documento', name, '', ''); else C('contact', 'warn', 'No se reconoce el nombre en las primeras líneas', 'Puede estar dentro de una imagen, un cuadro de texto o el encabezado.', 'Escribe tu nombre completo como primera línea de texto del documento.');
    if (email) {
      const local = email.split('@')[0].toLowerCase();
      if (/(sexy|loc[oa]|chul[oa]|crazy|baby|princes|guap[oa]|hot|xx|666|69|lover|killer|kiss|cariñ|gord[oa]|frik)/.test(local) || (local.match(/\d/g) || []).length > 4) C('contact', 'warn', 'Email poco profesional', email, 'Crea una dirección del tipo nombre.apellido@… solo para candidaturas.');
      else C('contact', 'ok', 'Email visible', email, '', 'Datos de contacto completos y profesionales.');
    } else C('contact', 'bad', 'No se encuentra email', 'Sin email, un ATS no puede crear tu ficha correctamente.', 'Añade tu email en las primeras líneas, como texto.');
    if (phone) {
      const targetDial = country.dial;
      const dial = phoneDial || phoneLocalGuess;
      if (!phoneDial && opts.country !== 'ES' && phoneLocalGuess === '34') C('country', 'warn', 'Teléfono sin prefijo internacional', 'Aplicas a ' + country.name + ' con un número español sin «+34».', 'Escríbelo en formato internacional: +34 612 345 678. Si tienes número local en ' + country.name + ', añádelo (formato ' + country.phone + ').');
      else if (dial && dial !== targetDial) C('country', 'info', 'Teléfono de otro país (+' + dial + ')', 'Normal si aún no vives en ' + country.name + '; algunos reclutadores priorizan números locales.', 'Mantén el formato internacional y, si lo tienes, añade un número local (' + country.phone + ') o indica que estás disponible por videollamada o WhatsApp.');
      else C('contact', 'ok', 'Teléfono visible', phone, '', '');
    } else C('contact', 'bad', 'No se encuentra teléfono', '', 'Añade tu teléfono con prefijo internacional: ' + country.phone + '.');
    if (location) C('contact', 'ok', 'Ubicación indicada', location, '', ''); else C('contact', 'warn', 'Sin ciudad o ubicación', 'Muchos portales y ATS filtran por ubicación o distancia.', 'Indica ciudad y provincia (o país). No hace falta la dirección completa.');
    if (linkedin) C('contact', 'ok', 'Perfil de LinkedIn enlazado', linkedin, '', 'Perfil de LinkedIn enlazado para contrastar trayectoria.'); else C('contact', 'warn', 'Sin enlace a LinkedIn', 'Más del 80 % de reclutadores consultan LinkedIn antes de llamar.', 'Añade la URL personalizada: linkedin.com/in/nombre-apellido.');
    if (projects.length) {
      const noLink = projects.filter(p => !p.url).length, noDesc = projects.filter(p => !p.desc).length;
      if (noLink || noDesc) C('content', 'warn', 'Proyectos incompletos', [noLink ? noLink + ' sin enlace' : '', noDesc ? noDesc + ' sin descripción' : ''].filter(Boolean).join(' · ') + '.', 'Añade a cada proyecto un enlace visible como texto, 1–2 líneas de qué hace y qué resultado tuvo, y las herramientas usadas. Puedes completarlos en «Datos para copiar».');
      else C('content', 'ok', projects.length + ' proyecto(s) con enlace y descripción', '', '', 'Proyectos documentados con enlace verificable.');
    }
    if (['it', 'data', 'design'].includes(mainFamily) && !github && !otherLinks.length && !projects.some(p => p.url)) C('contact', 'warn', 'Sin portfolio ni repositorio', 'En perfiles de ' + D.FAMILY_LABELS[mainFamily] + ' se espera ver trabajo real.', mainFamily === 'design' ? 'Enlaza tu portfolio (Behance, web propia).' : 'Enlaza GitHub o un portfolio con proyectos.');

    // País
    const photoOn = meta.photoLikely;
    if (country.photo === 'no' && photoOn) C('country', 'bad', 'Foto en un CV para ' + country.name, country.photoNote, 'Quita la foto.');
    else if (country.photo === 'habitual' && !photoOn && (meta.fileType === 'pdf' || meta.fileType === 'docx')) C('country', 'info', 'Sin foto (habitual en ' + country.name + ')', country.photoNote, 'Opcional: una foto profesional, de fondo neutro, puede ayudar en empresas locales. En multinacionales no es necesaria.');
    else if (photoOn) C('country', 'info', 'Con foto', country.photoNote, 'Si la mantienes, que sea profesional y con fondo neutro. Para portales con ATS no aporta.');
    for (const p of personalHits) {
      if (p.id === 'photoword') continue;
      if (p.sev === 'country') {
        const rule = country[p.field];
        if (rule === 'no') C('country', 'warn', p.label + ': no se incluye en ' + country.name, p.why, 'Elimínalo.');
        else if (rule === 'opcional') C('country', 'info', p.label + ': opcional en ' + country.name, p.why, 'Valora quitarlo; si la oferta no lo pide, no aporta.');
      } else C('country', p.sev, p.label, p.why, 'Elimínalo del CV.');
    }
    if (meta.pageSize && meta.pageSize !== country.paper) C('country', 'warn', 'Tamaño de papel ' + meta.pageSize + ' (en ' + country.name + ' se usa ' + country.paper + ')', '', 'Cambia el tamaño de página a ' + country.paper + ' antes de exportar.');
    const targetLang = offer ? offer.lang : country.lang;
    if (lang && targetLang && lang !== targetLang && !(lang === 'es' && ['es'].includes(targetLang))) {
      const L = { es: 'español', en: 'inglés', de: 'alemán', fr: 'francés', it: 'italiano', pt: 'portugués' };
      C('country', 'warn', 'Idioma del CV: ' + L[lang] + '; ' + (offer ? 'la oferta está en ' : 'en ' + country.name + ' se espera ') + L[targetLang], '', 'Prepara una versión en ' + L[targetLang] + (offer ? ' (escribe el CV en el idioma de la oferta).' : ', salvo que la oferta esté en ' + L[lang] + '.'));
    }
    if (opts.country === 'IT' && !hasItalyClause) C('country', 'warn', 'Falta la cláusula de tratamiento de datos (Italia)', 'En Italia se espera al pie del CV.', 'Añade: «Autorizzo il trattamento dei dati personali contenuti nel mio curriculum vitae in base al Regolamento UE 2016/679 (GDPR)».');
    if (opts.country === 'AU' && !hasReferees) C('country', 'info', 'Sin referees (habitual en Australia)', '', 'Añade dos referees (nombre, cargo, relación y contacto) o «Referees available upon request».');
    if (opts.country === 'ES' && driving) C('country', 'ok', 'Carnet de conducir indicado', '', '', 'Carnet de conducir indicado (valorado en muchos puestos en España).');
    if (disability) C('country', 'info', 'Se menciona una discapacidad', 'Incluirla es decisión tuya. Puede ser relevante para ofertas de empleo con reserva de plazas o incentivos a la contratación.', 'Si la mantienes, basta con el porcentaje reconocido, sin detalles médicos.');

    // Oferta
    if (offer) {
      const missing = offer.keywords.filter(k => !k.found);
      const onlySkills = offer.keywords.filter(k => k.found && k.where.length && !k.where.includes('experience') && k.type === 'skill');
      C('offer', offer.score >= 70 ? 'ok' : offer.score >= 45 ? 'warn' : 'bad', 'Coincidencia con la oferta: ' + offer.score + ' %', missing.length ? 'Faltan: ' + missing.slice(0, 10).map(k => k.term).join(', ') + '.' : 'Cubres todas las palabras clave detectadas.', missing.length ? 'Incluye las que de verdad dominas, dentro de logros concretos (no solo en la lista de habilidades). Objetivo: 70 % o más.' : '', offer.score >= 70 ? 'Alta coincidencia con la oferta (' + offer.score + ' %).' : '');
      if (onlySkills.length) C('offer', 'info', 'Palabras clave solo en la lista de habilidades', onlySkills.map(k => k.term).join(', '), 'Muéstralas también en la experiencia: los filtros con IA valoran más una competencia usada en un logro que una lista.');
      if (offer.yearsReq) C('offer', totalYears >= offer.yearsReq ? 'ok' : 'warn', 'Experiencia pedida: ' + offer.yearsReq + ' años · la tuya: ' + totalYears + ' años', totalYears >= offer.yearsReq ? '' : 'Puede que el filtro te descarte por años.', totalYears >= offer.yearsReq ? '' : 'Si tienes experiencia relevante en prácticas, proyectos o voluntariado, inclúyela con fechas.', totalYears >= offer.yearsReq ? 'Cumples los años de experiencia que pide la oferta.' : '');
      for (const L of offer.langsReq) {
        const mine = languages.find(x => x.name === L.name);
        if (!mine) { if (L.name !== 'Español' || lang !== 'es') C('offer', 'warn', 'La oferta pide ' + L.name + (L.level ? ' ' + L.level : '') + ' y no aparece en tu CV', '', 'Si lo hablas, añádelo con su nivel MCER.'); }
        else if (L.rank && mine.rank && mine.rank < L.rank) C('offer', 'warn', L.name + ': la oferta pide ' + L.level + ' y tu CV indica ' + mine.level, '', 'Si tu nivel real es mayor, actualízalo o añade el certificado.');
      }
      if (offer.title) {
        const tw = norm(offer.title).split(/\s+/).filter(w => w.length > 3 && !D.STOPWORDS.has(w));
        const inHead = tw.filter(w => norm(headline + ' ' + (experience[0] ? experience[0].title : '') + ' ' + summary).includes(w.slice(0, -1)));
        if (tw.length && inHead.length < Math.ceil(tw.length / 2)) C('offer', 'warn', 'Tu titular no refleja el puesto de la oferta', 'Oferta: «' + offer.title + '». Tu titular: «' + (headline || 'sin titular') + '».', 'Pon bajo tu nombre un titular que use el mismo nombre de puesto (si encaja con tu experiencia).');
      }
    }

    // Puntuaciones
    const CAT = { ats: 'ATS e IA', content: 'Contenido', structure: 'Estructura', coherence: 'Coherencia', contact: 'Contacto', country: 'País y datos personales', offer: 'Coincidencia con la oferta' };
    const weights = offer ? { ats: 24, content: 24, structure: 10, coherence: 6, contact: 8, country: 8, offer: 20 } : { ats: 28, content: 28, structure: 13, coherence: 8, contact: 10, country: 13 };
    const val = { ok: 1, info: 1, warn: 0.5, bad: 0 };
    const scores = {};
    for (const cat of Object.keys(weights)) {
      const cs = checks.filter(c => c.cat === cat && c.status !== 'info');
      let s = cs.length ? Math.round(100 * cs.reduce((a, c) => a + val[c.status], 0) / cs.length) : 100;
      if (cat === 'offer' && offer) s = Math.round((s + offer.score) / 2);
      scores[cat] = s;
    }
    const total = Math.round(Object.entries(weights).reduce((a, [k, w]) => a + scores[k] * w, 0) / Object.values(weights).reduce((a, b) => a + b, 0));

    // Puntos fuertes y débiles
    const strengths = checks.filter(c => c.status === 'ok' && c.strength).map(c => ({ text: c.strength, cat: c.cat }));
    if (totalYears >= 1) strengths.unshift({ text: String(totalYears).replace('.', ',') + ' años de experiencia profesional acreditada en ' + experience.length + ' puesto(s).', cat: 'content' });
    if (languages.filter(l => l.rank >= 5).length >= 2) strengths.push({ text: 'Perfil multilingüe: ' + languages.filter(l => l.rank >= 5).map(l => l.name).join(', ') + ' a nivel avanzado o nativo.', cat: 'content' });
    if (experience.some(e => /\b(jefe|jefa|responsable|director|directora|manager|lead|head|coordinador|coordinadora|supervisor|supervisora|encargado|encargada)\b/.test(norm(e.title)))) strengths.push({ text: 'Experiencia en puestos de responsabilidad o coordinación de equipos.', cat: 'content' });
    const order = { bad: 0, warn: 1 };
    const weaknesses = checks.filter(c => c.status === 'bad' || c.status === 'warn').sort((a, b) => order[a.status] - order[b.status]);

    // Añadir / eliminar
    const remove = [], add = [];
    const R = (what, why, prio) => remove.push({ what, why, prio });
    const A = (what, why, prio) => add.push({ what, why, prio });
    personalHits.forEach(p => { if (p.id === 'photoword') return; if (p.sev !== 'country' || country[p.field] === 'no') R(p.label, p.why, p.sev === 'bad' ? 'alta' : 'media'); });
    if (country.photo === 'no' && photoOn) R('Fotografía', country.photoNote, 'alta');
    if (cvHeading) R('El título «' + cvHeading + '»', 'Es obvio que es un CV y ocupa la línea donde el ATS espera tu nombre.', 'media');
    if (refsLine && opts.country !== 'AU') R('«' + refsLine.slice(0, 60) + '»', 'Se da por hecho; ocupa espacio sin aportar.', 'baja');
    if (objective) R('Sección «Objetivo»', 'Formato antiguo centrado en lo que tú quieres. Sustitúyelo por un perfil centrado en lo que aportas.', 'media');
    if (basicSchool.length && hasHigher) R('Estudios básicos (' + basicSchool.map(s => s.slice(0, 40)).join(', ') + ')', 'Con estudios superiores, la ESO o la primaria no aportan.', 'media');
    if (basicOffice.length && ['it', 'data', 'design'].includes(mainFamily)) R('Ofimática básica (' + basicOffice.join(', ') + ')', 'En un perfil de ' + D.FAMILY_LABELS[mainFamily] + ' se da por supuesta y resta espacio a competencias diferenciales.', 'baja');
    if (outdated.length) R('Tecnologías obsoletas: ' + outdated.join(', '), 'Transmiten desactualización salvo que la oferta las pida.', 'media');
    if (genericHobbies.length >= 2) R('Aficiones genéricas (' + genericHobbies.join(', ') + ')', 'No te diferencian. Deja solo aficiones concretas que digan algo de ti (p. ej. «maratón de Valencia 2024», «voluntario en banco de alimentos»).', 'baja');
    if (skillDupes.length) R('Habilidades repetidas: ' + uniq(skillDupes).join(', '), 'Duplicar no mejora el filtrado y transmite descuido.', 'baja');
    if (cliches.length >= 2) R('Adjetivos genéricos: ' + cliches.slice(0, 5).join(', '), 'No son verificables; los filtros con IA los ignoran y los reclutadores los ven en todos los CV.', 'media');
    oldEntries.forEach(e => R('Detalle del puesto «' + (e.title || e.company) + '» (' + fmtDate(e.start) + '–' + fmtDate(e.end) + ')', 'Más de 15 años: resume en una línea.', 'baja'));
    if (icons) R('Iconos y emojis', 'Se convierten en símbolos ilegibles al extraer el texto.', 'media');
    if (ratings) R('Barras, estrellas o porcentajes de nivel', 'No son interpretables; usa palabras o el MCER.', 'media');

    if (!summary) A('Perfil profesional (3–4 líneas)', 'Es lo primero que se lee y donde se concentran las palabras clave.', 'alta');
    if (!headline) A('Titular bajo el nombre', 'Una línea con el puesto al que aspiras ayuda al ATS a clasificarte (p. ej. «Responsable de Marketing Digital»).', 'alta');
    if (!linkedin) A('URL de LinkedIn', 'Los reclutadores contrastan el CV con LinkedIn.', 'media');
    if (!location) A('Ciudad / provincia', 'Los portales filtran por ubicación.', 'media');
    if (allBullets.length && pct(quantCount, allBullets.length) < 40) A('Cifras en tus logros', 'Facturación, %, clientes, plazos, tamaño de equipo… (ver «Experiencia»).', 'alta');
    languages.filter(l => !l.level).forEach(l => A('Nivel de ' + l.name + ' (MCER)', 'Sin nivel no pasas el filtro de idioma.', 'alta'));
    if (!bySec.skills) A('Sección «Habilidades»', '8–12 competencias técnicas concretas; los ATS la usan para emparejar ofertas.', 'alta');
    if (!languages.length) A('Sección «Idiomas»', 'Aunque sea solo tu lengua materna y un idioma con nivel.', 'baja');
    if (['it', 'data', 'design', 'mkt'].includes(mainFamily) && !projects.length) A('Sección «Proyectos» con enlaces', 'Uno a tres proyectos con enlace, descripción breve y herramientas demuestran lo que sabes hacer. Puedes añadirlos en «Datos para copiar».', ['it', 'data', 'design'].includes(mainFamily) ? 'media' : 'baja');
    if (['it', 'data'].includes(mainFamily) && !github && !projects.some(p => p.url)) A('Enlace a GitHub o portfolio', 'Permite comprobar tu trabajo.', 'media');
    if (mainFamily === 'design' && !otherLinks.length) A('Enlace a portfolio', 'En diseño, el portfolio pesa más que el CV.', 'alta');
    if (opts.country === 'IT' && !hasItalyClause) A('Cláusula GDPR italiana al pie', 'Se espera en los CV en Italia.', 'media');
    if (opts.country === 'AU' && !hasReferees) A('Dos referees', 'Habitual en Australia.', 'media');
    if (opts.country === 'ES' && !driving && ['sales', 'log', 'eng'].includes(mainFamily)) A('Carnet de conducir (si lo tienes)', 'En perfiles comerciales, logísticos o técnicos se pide con frecuencia.', 'media');
    if (gaps.some(g => g.months >= 12 && !g.study)) A('Explicación breve de los periodos sin empleo', 'Formación, proyectos, cuidados o emprendimiento: una línea evita dudas.', 'baja');
    if (offer) offer.keywords.filter(k => !k.found).slice(0, 10).forEach(k => A('Palabra clave de la oferta: «' + k.term + '»', 'Solo si la dominas; inclúyela dentro de un logro concreto.', k.weight >= 3 ? 'alta' : 'media'));
    if (company.tips.length && opts.company === 'publico') A('Horas y fechas exactas de cada curso', 'En el sector público se baremanan.', 'media');

    // Ampliación por puesto
    const EXAMPLES = {
      sales: 'Aumenté la facturación de mi zona un [X] % en [periodo] captando [N] clientes nuevos mediante prospección en LinkedIn y ferias.',
      it: 'Reduje el tiempo de respuesta de la API de [X] ms a [Y] ms optimizando consultas SQL e introduciendo caché con Redis.',
      data: 'Automaticé el informe mensual de ventas con Python y Power BI, ahorrando [X] horas al mes a [N] personas del equipo comercial.',
      mkt: 'Lancé [N] campañas en Google Ads con un presupuesto de [X] €/mes y reduje el coste por lead un [Y] % en [periodo].',
      fin: 'Reduje el cierre contable mensual de [X] a [Y] días automatizando las conciliaciones bancarias con Excel y VBA.',
      hr: 'Cubrí [N] vacantes técnicas al año y reduje el time-to-hire de [X] a [Y] días rediseñando el proceso de cribado.',
      design: 'Rediseñé el flujo de registro en Figma, lo que aumentó la conversión un [X] % según test A/B con [N] usuarios.',
      eng: 'Implanté 5S y SMED en la línea [X], reduciendo los tiempos de cambio un [Y] % y aumentando el OEE del [A] % al [B] %.',
      pm: 'Coordiné un proyecto de [X] € con [N] personas de 3 departamentos y lo entregué [en plazo / con un desvío del Y %].',
      log: 'Reduje los errores de picking un [X] % reorganizando ubicaciones según rotación ABC en un almacén de [N] m².',
      cs: 'Atendí [N] consultas diarias con un CSAT del [X] % y una resolución en primer contacto del [Y] %.',
      hosp: 'Coordiné un equipo de [N] personas en sala atendiendo [X] cubiertos diarios con una valoración media de [Y]/5.',
      retail: 'Superé el objetivo de ventas de la tienda un [X] % en [periodo] mejorando el visual merchandising y la venta cruzada.',
      health: 'Atendí a [N] pacientes por turno en [unidad] e implanté un protocolo de [X] que redujo las incidencias un [Y] %.',
      edu: 'Diseñé el programa de [asignatura] para [N] alumnos, con un [X] % de aprobados (frente al [Y] % del curso anterior).',
      legal: 'Revisé y negocié [N] contratos mercantiles al año por un valor total de [X] €, reduciendo los plazos de firma un [Y] %.',
      admin: 'Digitalicé el archivo de facturas ([N] documentos/mes) y reduje el tiempo de búsqueda de [X] minutos a [Y].',
      general: '[Verbo de acción] + [qué hiciste] + [resultado medible]: «Reorganicé [proceso] y reduje [tiempo/coste/errores] un [X] % en [periodo]».'
    };
    const expand = experience.map((e, i) => {
      const t = norm(e.title + ' ' + e.company + ' ' + e.bullets.join(' '));
      const entrySkills = findSkills(t);
      const fc = {}; entrySkills.forEach(s => (fc[s.fam] = (fc[s.fam] || 0) + s.count));
      famFromTitle.forEach(([f, re]) => { if (re.test(norm(e.title))) fc[f] = (fc[f] || 0) + 4; });
      const fam = (Object.entries(fc).sort((a, b) => b[1] - a[1])[0] || [mainFamily])[0];
      const lead = /\b(jefe|jefa|responsable|director|directora|manager|lead|head|coordinador|coordinadora|supervisor|supervisora|encargado|encargada|gerente)\b/.test(norm(e.title));
      const issues = [];
      const old = e.endIdx != null && nowIdx - e.endIdx > 15 * 12;
      const q = e.bullets.filter(isQuant).length, s = e.bullets.filter(isStrong).length;
      if (old) issues.push({ s: 'info', t: 'Puesto antiguo: no lo amplíes, resúmelo en una línea.' });
      else {
        if (e.bullets.length === 0) issues.push({ s: 'bad', t: 'Sin descripción. Añade 3–5 viñetas con tus logros.' });
        else if (e.bullets.length < 3) issues.push({ s: 'warn', t: 'Solo ' + e.bullets.length + ' línea(s). Lo ideal son 3–5 en puestos recientes.' });
        if (e.bullets.length && q === 0) issues.push({ s: 'warn', t: 'Ninguna cifra. Añade al menos dos resultados medibles.' });
        if (e.bullets.length && s < e.bullets.length / 2) issues.push({ s: 'warn', t: 'Varias líneas no empiezan con verbo de acción.' });
        if (e.paragraphStyle && e.bullets.length >= 1 && e.bullets.some(b => wc(b) > 30)) issues.push({ s: 'info', t: 'Descripción en párrafo: pásala a viñetas cortas.' });
        if (!entrySkills.length && e.bullets.length) issues.push({ s: 'info', t: 'No se mencionan herramientas ni metodologías concretas.' });
        if (!e.company) issues.push({ s: 'warn', t: 'No se identifica la empresa.' });
        if (!e.start) issues.push({ s: 'warn', t: 'Sin fechas reconocibles.' });
      }
      const prompts = (lead ? D.METRIC_PROMPTS.lead : []).concat(D.METRIC_PROMPTS[fam] || D.METRIC_PROMPTS.general).slice(0, 5);
      const offerMissing = offer ? offer.keywords.filter(k => !k.found && k.type === 'skill' && (k.fam === fam || entrySkills.some(s2 => s2.fam === k.fam))).map(k => k.term).slice(0, 5) : [];
      const rewrites = e.bullets.filter(b => isWeak(b) || (!isQuant(b) && !isStrong(b))).slice(0, 2).map(b => ({ before: b, hint: rewriteHint(b) }));
      return { index: i, title: e.title, company: e.company, period: e.periods || (fmtDate(e.start, 'mes') + ' – ' + fmtDate(e.end, 'mes')).trim(), months: e.months, fam, famLabel: D.FAMILY_LABELS[fam] || 'general', lead, issues, prompts, example: EXAMPLES[fam] || EXAMPLES.general, offerMissing, rewrites, old, current: e.current, bulletCount: e.bullets.length, quant: q };
    });
    function rewriteHint(b) {
      const n = norm(b).replace(/^[^a-z]+/, '');
      const map = [[/^(responsable de|encargad[oa] de)\s+(la |el |los |las )?/, 'Gestioné '], [/^(realizacion de|realice)\s+/, 'Elaboré '], [/^(participe en|participacion en)\s+/, 'Contribuí a '], [/^(ayude a|ayude en|apoyo en|apoye en)\s+/, 'Colaboré en '], [/^(tareas de|funciones de)\s+/, 'Gestioné '], [/^(responsible for)\s+/, 'Managed '], [/^(helped|assisted with)\s+/, 'Supported '], [/^(worked on)\s+/, 'Built ']];
      for (const [re, v] of map) if (re.test(n)) return v + b.replace(/^[^\p{L}]*/u, '').replace(new RegExp('^.{' + (n.match(re)[0].length) + '}'), '') + ' → añade el resultado: «…, lo que [redujo/aumentó] [métrica] un [X] %».';
      return 'Empieza con un verbo en pasado y termina con el resultado: «[Verbo] + ' + b.charAt(0).toLowerCase() + b.slice(1, 70) + (b.length > 70 ? '…' : '') + ' + [resultado medible]».';
    }

    // Plantillas recomendadas
    const tplKeys = [];
    const pushTpl = (k, why) => { if (!tplKeys.some(t => t.key === k)) tplKeys.push({ key: k, name: D.TEMPLATES[k].name, desc: D.TEMPLATES[k].for, why }); };
    if (opts.company === 'academico') pushTpl('academico', 'Destino académico o de investigación.');
    if (opts.company === 'publico') pushTpl('europass', 'El sector público suele pedir Europass o el modelo de la convocatoria.');
    pushTpl(country.tpl, 'Estándar en ' + country.name + '.');
    if (totalYears >= 12 || (meta.columns && opts.company === 'creativo')) pushTpl('hibrido', totalYears >= 12 ? 'Con ' + totalYears + ' años de trayectoria conviene destacar competencias clave arriba.' : 'Te permite mantener un bloque de competencias sin columnas.');
    if (opts.company === 'creativo' || mainFamily === 'design') pushTpl('creativo', 'Sector creativo: diseño visual para envío directo y versión ATS para portales.');
    pushTpl('cronologico', 'Opción segura para cualquier portal con ATS.');

    // Datos estructurados para copiar
    const topSkills = (hard.length ? hard : skillsFound).sort((a, b) => b.count - a.count).slice(0, 4).map(s => s.name);
    const famLabel = D.FAMILY_LABELS[mainFamily];
    const langsAdv = languages.filter(l => l.rank >= 4 && l.name !== 'Español');
    const draftSummary = lang === 'en' ? [
      (headline || (experience[0] && experience[0].title) || 'Professional') + (totalYears >= 1 ? ' with ' + (totalYears >= 2 ? Math.floor(totalYears) + ' years' : 'over a year') + ' of experience' : '') + '.',
      topSkills.length ? 'Specialised in ' + topSkills.join(', ') + '.' : '',
      '[Add your strongest achievement with a number.]',
      langsAdv.length ? 'Languages: ' + langsAdv.map(l => ({ 'Inglés': 'English', 'Francés': 'French', 'Alemán': 'German', 'Italiano': 'Italian', 'Portugués': 'Portuguese' }[l.name] || l.name) + ' ' + l.level.replace(/.*\((\w\d)\)|Nativo \/ C2/, (m, g) => g || 'native')).join(', ') + '.' : ''
    ].filter(Boolean).join(' ') : [
      (headline || (experience[0] && experience[0].title) || 'Profesional') + (totalYears >= 1 ? ' con ' + (totalYears >= 2 ? Math.floor(totalYears) + ' años' : 'más de 1 año') + ' de experiencia' : '') + (famLabel ? ' en ' + famLabel : '') + '.',
      topSkills.length ? 'Especialización en ' + topSkills.join(', ') + '.' : '',
      '[Añade aquí tu logro más destacado con una cifra.]',
      langsAdv.length ? 'Idiomas: ' + langsAdv.map(l => l.name + ' ' + l.level.replace(/.*\((\w\d)\)|Nativo \/ C2/, (m, g) => g || 'nativo')).join(', ') + '.' : ''
    ].filter(Boolean).join(' ');

    const data = {
      name, headline, email, phone, location, linkedin, github, links: otherLinks,
      summary, draftSummary,
      experience: experience.map(e => ({ title: e.title, company: e.company, location: e.location, start: fmtDate(e.start), end: fmtDate(e.end), current: e.current, duration: durationLabel(e.months), bullets: e.bullets })),
      education: education.map(e => ({ degree: e.degree, institution: e.institution, location: e.location || '', start: e.single ? '' : fmtDate(e.start), end: fmtDate(e.end) })),
      skills: hard.map(s => s.name), listedSkills, softSkills, languages: languages.map(l => ({ name: l.name, level: l.level })), certifications: certs, courses: courses.slice(0, 15), projects, interests,
      driving
    };

    const dated = (text.match(/\b(19|20)\d{2}\b/g) || []).length;
    const doc = docCheck({ present, email, phone, linkedin, name, experience, education, words, pages: meta.pages, full: fullNorm, dated });
    return {
      version: '1.0', doc, lang, words, lines: lines.length, sectionsFound: present, sectionTitles: Object.fromEntries(Object.entries(bySec).filter(([k]) => k !== 'header').map(([k, v]) => [k, v.titles])),
      totalYears, mainFamily, familyLabel: famLabel || 'general', country: Object.assign({ code: opts.country }, country), company: Object.assign({ code: opts.company }, company),
      phoneDial: phoneDial || phoneLocalGuess, meta, data, checks, scores, scoreLabels: CAT, weights, total, strengths, weaknesses,
      remove, add, expand, templates: tplKeys, offer,
      stats: { bullets: allBullets.length, strong: strongCount, quant: quantCount, cliches, gaps: gaps.length, dateFormats }
    };
  }

  const api = { analyze, matchOffers, _internals: { norm, parseProjects, nameFromUrl, findRanges, findTokens, parseEntries, segment, headingOf, toLines, findSkills, parseLanguages, analyzeOffer, looksLikeName } };
  root.CVEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

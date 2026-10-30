/* Generador de CV en formato ATS a partir de los datos extraídos y editados.
   Un único modelo de bloques se pinta como HTML (vista previa), texto plano y DOCX. */
(function (root) {
  'use strict';
  const H = {
    es: { projects: 'Proyectos', tools: 'Herramientas', summary: 'Perfil profesional', exp: 'Experiencia profesional', edu: 'Formación', skills: 'Habilidades', key: 'Competencias clave', langs: 'Idiomas', certs: 'Certificaciones', courses: 'Formación complementaria', other: 'Otros datos', present: 'Actualidad', driving: 'Carnet de conducir B', personal: 'Información personal', work: 'Experiencia laboral', eduTr: 'Educación y formación', langSk: 'Competencias lingüísticas', mother: 'Lengua materna', others: 'Otros idiomas', digital: 'Competencias digitales', place: '[Ciudad], [fecha]' },
    en: { projects: 'Projects', tools: 'Tools', summary: 'Professional Summary', exp: 'Professional Experience', edu: 'Education', skills: 'Skills', key: 'Core Competencies', langs: 'Languages', certs: 'Certifications', courses: 'Training', other: 'Additional Information', present: 'Present', driving: 'Full driving licence', personal: 'Personal information', work: 'Work experience', eduTr: 'Education and training', langSk: 'Language skills', mother: 'Mother tongue', others: 'Other languages', digital: 'Digital skills', place: '[City], [date]' },
    de: { projects: 'Projekte', tools: 'Technologien', summary: 'Profil', exp: 'Berufserfahrung', edu: 'Ausbildung', skills: 'Kenntnisse', key: 'Kernkompetenzen', langs: 'Sprachkenntnisse', certs: 'Zertifikate', courses: 'Weiterbildung', other: 'Sonstiges', present: 'heute', driving: 'Führerschein Klasse B', personal: 'Persönliche Daten', work: 'Berufserfahrung', eduTr: 'Ausbildung', langSk: 'Sprachkenntnisse', mother: 'Muttersprache', others: 'Weitere Sprachen', digital: 'IT-Kenntnisse', place: '[Ort], [Datum]' },
    fr: { projects: 'Projets', tools: 'Outils', summary: 'Profil', exp: 'Expérience professionnelle', edu: 'Formation', skills: 'Compétences', key: 'Compétences clés', langs: 'Langues', certs: 'Certifications', courses: 'Formations complémentaires', other: 'Informations complémentaires', present: "aujourd'hui", driving: 'Permis B', personal: 'Informations personnelles', work: 'Expérience professionnelle', eduTr: 'Éducation et formation', langSk: 'Compétences linguistiques', mother: 'Langue maternelle', others: 'Autres langues', digital: 'Compétences numériques', place: '[Ville], [date]' },
    it: { projects: 'Progetti', tools: 'Strumenti', summary: 'Profilo', exp: 'Esperienza professionale', edu: 'Istruzione e formazione', skills: 'Competenze', key: 'Competenze chiave', langs: 'Lingue', certs: 'Certificazioni', courses: 'Corsi', other: 'Altre informazioni', present: 'Presente', driving: 'Patente B', personal: 'Informazioni personali', work: 'Esperienza lavorativa', eduTr: 'Istruzione e formazione', langSk: 'Competenze linguistiche', mother: 'Lingua madre', others: 'Altre lingue', digital: 'Competenze digitali', place: '[Città], [data]' },
    pt: { projects: 'Projetos', tools: 'Ferramentas', summary: 'Perfil', exp: 'Experiência profissional', edu: 'Formação académica', skills: 'Competências', key: 'Competências-chave', langs: 'Línguas', certs: 'Certificações', courses: 'Cursos', other: 'Outras informações', present: 'Presente', driving: 'Carta de condução B', personal: 'Informação pessoal', work: 'Experiência profissional', eduTr: 'Educação e formação', langSk: 'Competências linguísticas', mother: 'Língua materna', others: 'Outras línguas', digital: 'Competências digitais', place: '[Cidade], [data]' }
  };
  const LANG_NAMES = { en: { 'Español': 'Spanish', 'Inglés': 'English', 'Francés': 'French', 'Alemán': 'German', 'Italiano': 'Italian', 'Portugués': 'Portuguese', 'Catalán': 'Catalan', 'Valenciano': 'Valencian', 'Euskera': 'Basque', 'Gallego': 'Galician', 'Chino': 'Chinese', 'Árabe': 'Arabic', 'Ruso': 'Russian', 'Japonés': 'Japanese', 'Neerlandés': 'Dutch' }, de: { 'Español': 'Spanisch', 'Inglés': 'Englisch', 'Francés': 'Französisch', 'Alemán': 'Deutsch', 'Italiano': 'Italienisch', 'Portugués': 'Portugiesisch' }, fr: { 'Español': 'Espagnol', 'Inglés': 'Anglais', 'Francés': 'Français', 'Alemán': 'Allemand', 'Italiano': 'Italien', 'Portugués': 'Portugais' }, it: { 'Español': 'Spagnolo', 'Inglés': 'Inglese', 'Francés': 'Francese', 'Alemán': 'Tedesco', 'Italiano': 'Italiano', 'Portugués': 'Portoghese' }, pt: { 'Español': 'Espanhol', 'Inglés': 'Inglês', 'Francés': 'Francês', 'Alemán': 'Alemão', 'Italiano': 'Italiano', 'Portugués': 'Português' } };
  const LEVEL_NAMES = { en: { 'Nativo / C2': 'Native / C2', 'Avanzado (C1)': 'Advanced (C1)', 'Intermedio alto (B2)': 'Upper-intermediate (B2)', 'Intermedio (B1)': 'Intermediate (B1)', 'Básico (A2)': 'Elementary (A2)', 'Básico (A1)': 'Beginner (A1)' }, de: { 'Nativo / C2': 'Muttersprache / C2', 'Avanzado (C1)': 'Verhandlungssicher (C1)', 'Intermedio alto (B2)': 'Fließend (B2)', 'Intermedio (B1)': 'Gute Kenntnisse (B1)', 'Básico (A2)': 'Grundkenntnisse (A2)', 'Básico (A1)': 'Grundkenntnisse (A1)' } };
  const tr = (map, lang, v) => (map[lang] && map[lang][v]) || v;
  const lines = s => String(s || '').split('\n').map(x => x.replace(/^\s*[•·\-*]\s*/, '').trim()).filter(Boolean);
  const list = s => String(s || '').split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  const isPlaceholder = s => /\[[^\]]+\]/.test(s);
  // Enlaces: una «palabra» que es URL, dominio con ruta o email se convierte en enlace clicable.
  // El texto visible no cambia, así que los ATS leen exactamente lo mismo.
  const URL_FULL = /^(https?:\/\/\S+|[\w.+-]+@[\w-]+(\.[\w-]+)+|(www\.)?([a-z0-9-]+\.)+(com|es|io|dev|app|net|org|ai|eu|me|co|page|site|tech|xyz|ie|de|uk)(\/\S*)?)$/i;
  const trimUrl = w => w.replace(/[.,;:)\]]+$/, '');
  const hrefOf = w => /@/.test(w) && !/\//.test(w) ? 'mailto:' + w : /^https?:\/\//i.test(w) ? w : 'https://' + w;
  const isUrl = w => URL_FULL.test(trimUrl(w)) && !/^[\d.]+$/.test(trimUrl(w));

  function blocks(m, o) {
    const L = H[o.lang] || H.es;
    const B = [];
    const dates = (s, e) => [s, /actualidad|present/i.test(e || '') ? L.present : e].filter(Boolean).join(' – ');
    const contact = [m.location, m.phone, m.email, m.linkedin, m.web].filter(Boolean).join('  ·  ');
    const summary = (m.summary || '').trim() || (m.draft || '').trim();
    const skills = list(m.skills);
    const langs = (m.langs || []).filter(l => l.name);
    const exp = (m.exp || []).filter(e => e.title || e.company);
    const edu = (m.edu || []).filter(e => e.degree || e.institution);
    const certs = lines(m.certs), courses = lines(m.courses);
    B.push({ t: 'name', text: m.name || '[Nombre y apellidos]' });
    if (m.headline) B.push({ t: 'headline', text: m.headline });

    if (o.style === 'europass') {
      B.push({ t: 'h', text: L.personal });
      B.push({ t: 'p', text: contact });
    } else B.push({ t: 'contact', text: contact });

    const expBlock = heading => {
      if (!exp.length) return;
      B.push({ t: 'h', text: heading });
      exp.forEach(e => {
        if (o.style === 'lebenslauf') B.push({ t: 'lb', d: dates(e.start, e.end), main: [e.title, e.company].filter(Boolean).join(', '), sub: e.location, bullets: lines(e.desc) });
        else {
          B.push({ t: 'row', left: [e.title, e.company].filter(Boolean).join(' — '), right: dates(e.start, e.end) });
          if (e.location && o.style !== 'us') B.push({ t: 'sub', text: e.location });
          lines(e.desc).forEach(b => B.push({ t: 'bullet', text: b }));
        }
      });
    };
    const eduBlock = heading => {
      if (!edu.length) return;
      B.push({ t: 'h', text: heading });
      edu.forEach(e => {
        if (o.style === 'lebenslauf') B.push({ t: 'lb', d: dates(e.start, e.end), main: e.degree, sub: [e.institution, e.location].filter(Boolean).join(', '), bullets: [] });
        else { B.push({ t: 'row', left: e.degree || e.institution, right: dates(e.start, e.end) }); if (e.degree && e.institution) B.push({ t: 'sub', text: [e.institution, e.location].filter(Boolean).join(', ') }); }
      });
    };
    const projects = (m.projects || []).filter(p => p.name || p.url);
    const projBlock = () => {
      if (!projects.length) return;
      B.push({ t: 'h', text: L.projects });
      projects.forEach(p => {
        if (o.style === 'lebenslauf') { B.push({ t: 'lb', d: p.period || '', main: p.name || p.url, sub: p.name ? p.url : '', bullets: lines(p.desc).concat(p.tools ? [L.tools + ': ' + p.tools] : []) }); return; }
        B.push({ t: 'row', left: p.name || p.url, right: p.period || '' });
        if (p.name && p.url) B.push({ t: 'sub', text: p.url });
        lines(p.desc).forEach(x => B.push({ t: 'bullet', text: x }));
        if (p.tools) B.push({ t: 'tools', text: L.tools + ': ' + p.tools });
      });
    };
    const langLine = l => tr(LANG_NAMES, o.lang, l.name) + (l.level ? ': ' + tr(LEVEL_NAMES, o.lang, l.level) : '');

    if (summary && o.style !== 'europass') { B.push({ t: 'h', text: L.summary }); B.push({ t: 'p', text: summary }); }
    if (o.style === 'hibrido' && skills.length) { B.push({ t: 'h', text: L.key }); skills.slice(0, 8).forEach(s => B.push({ t: 'bullet', text: s })); }
    expBlock(o.style === 'europass' ? L.work : L.exp);
    if (o.style !== 'europass' && o.style !== 'lebenslauf') projBlock();
    eduBlock(o.style === 'europass' ? L.eduTr : L.edu);
    if (o.style === 'europass' || o.style === 'lebenslauf') projBlock();
    if (o.style === 'europass') {
      if (langs.length) {
        B.push({ t: 'h', text: L.langSk });
        const mother = langs.filter(l => /nativo|native|c2/i.test(l.level || ''));
        if (mother.length) B.push({ t: 'p', text: L.mother + ': ' + mother.map(l => tr(LANG_NAMES, o.lang, l.name)).join(', ') });
        const other = langs.filter(l => !mother.includes(l));
        if (other.length) B.push({ t: 'p', text: L.others + ': ' + other.map(langLine).join(' · ') });
      }
      if (skills.length) { B.push({ t: 'h', text: L.digital }); B.push({ t: 'p', text: skills.join(', ') }); }
    } else {
      if (skills.length && o.style !== 'hibrido') { B.push({ t: 'h', text: L.skills }); B.push({ t: 'p', text: skills.join(' · ') }); }
      if (skills.length > 8 && o.style === 'hibrido') { B.push({ t: 'h', text: L.skills }); B.push({ t: 'p', text: skills.slice(8).join(' · ') }); }
      if (langs.length) { B.push({ t: 'h', text: L.langs }); B.push({ t: 'p', text: langs.map(langLine).join(' · ') }); }
    }
    if (certs.length) { B.push({ t: 'h', text: L.certs }); certs.forEach(c => B.push({ t: 'bullet', text: c })); }
    if (courses.length && o.style !== 'us') { B.push({ t: 'h', text: L.courses }); courses.slice(0, 8).forEach(c => B.push({ t: 'bullet', text: c })); }
    if (o.driving && o.style !== 'us') { B.push({ t: 'h', text: L.other }); B.push({ t: 'p', text: L.driving }); }
    if (o.country === 'IT') B.push({ t: 'clause', text: 'Autorizzo il trattamento dei dati personali contenuti nel mio curriculum vitae in base al Regolamento UE 2016/679 (GDPR).' });
    if (o.style === 'lebenslauf') B.push({ t: 'clause', text: L.place });
    return B;
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mark = s => String(s == null ? '' : s).split(/(\s+)/).map(w => {
    if (w && !/^\s+$/.test(w) && isUrl(w)) { const u = trimUrl(w); return '<a href="' + esc(hrefOf(u)) + '" target="_blank" rel="noopener">' + esc(u) + '</a>' + esc(w.slice(u.length)); }
    return esc(w).replace(/\[[^\]]+\]/g, m => '<span class="ph">' + m + '</span>');
  }).join('');

  function toHtml(B) {
    let out = '', ul = false;
    const close = () => { if (ul) { out += '</ul>'; ul = false; } };
    for (const b of B) {
      if (b.t !== 'bullet') close();
      if (b.t === 'name') out += '<h1>' + mark(b.text) + '</h1>';
      else if (b.t === 'headline') out += '<div class="hl">' + mark(b.text) + '</div>';
      else if (b.t === 'contact') out += '<div class="ct">' + mark(b.text) + '</div>';
      else if (b.t === 'h') out += '<h2>' + esc(b.text) + '</h2>';
      else if (b.t === 'row') out += '<div class="row"><span>' + mark(b.left) + '</span><span>' + esc(b.right) + '</span></div>';
      else if (b.t === 'sub') out += '<div class="sub">' + mark(b.text) + '</div>';
      else if (b.t === 'p') out += '<p>' + mark(b.text) + '</p>';
      else if (b.t === 'bullet') { if (!ul) { out += '<ul>'; ul = true; } out += '<li>' + mark(b.text) + '</li>'; }
      else if (b.t === 'lb') out += '<div class="lb"><div class="d">' + esc(b.d) + '</div><div><strong>' + mark(b.main) + '</strong>' + (b.sub ? '<div class="sub">' + mark(b.sub) + '</div>' : '') + (b.bullets.length ? '<ul>' + b.bullets.map(x => '<li>' + mark(x) + '</li>').join('') + '</ul>' : '') + '</div></div>';
      else if (b.t === 'clause') out += '<p class="clause">' + mark(b.text) + '</p>';
      else if (b.t === 'tools') out += '<p class="tools">' + mark(b.text) + '</p>';
    }
    close();
    return out;
  }

  function toText(B) {
    const out = [];
    for (const b of B) {
      if (b.t === 'name') out.push(b.text.toUpperCase());
      else if (b.t === 'headline' || b.t === 'contact' || b.t === 'p' || b.t === 'sub' || b.t === 'clause' || b.t === 'tools') out.push(b.text);
      else if (b.t === 'h') out.push('', b.text.toUpperCase());
      else if (b.t === 'row') out.push(b.left + (b.right ? '  |  ' + b.right : ''));
      else if (b.t === 'bullet') out.push('• ' + b.text);
      else if (b.t === 'lb') { out.push(b.d + '   ' + b.main); if (b.sub) out.push('      ' + b.sub); b.bullets.forEach(x => out.push('      • ' + x)); }
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ---------- DOCX (solo en la versión autoalojada, donde se pueden descargar archivos) ----------
  const xe = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function run(text, o = {}) {
    const rpr = (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') + (o.caps ? '<w:caps/>' : '') + (o.sz ? '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>' : '') + (o.color ? '<w:color w:val="' + o.color + '"/>' : '') + (o.u ? '<w:u w:val="single"/>' : '');
    return '<w:r>' + (rpr ? '<w:rPr>' + rpr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + xe(text) + '</w:t></w:r>';
  }
  // texto con enlaces -> runs normales + <w:hyperlink> (relación externa por URL)
  function linkRuns(text, o, rels) {
    if (!rels) return run(text, o);
    let out = '', buf = '';
    for (const w of String(text == null ? '' : text).split(/(\s+)/)) {
      if (w && !/^\s+$/.test(w) && isUrl(w)) {
        const u = trimUrl(w);
        if (buf) { out += run(buf, o); buf = ''; }
        let id = rels.find(r => r.url === hrefOf(u)); if (!id) { id = { id: 'rIdL' + (rels.length + 1), url: hrefOf(u) }; rels.push(id); }
        out += '<w:hyperlink r:id="' + id.id + '" w:history="1">' + run(u, Object.assign({}, o, { color: '0F5E8C', u: true })) + '</w:hyperlink>';
        buf += w.slice(u.length);
      } else buf += w;
    }
    if (buf) out += run(buf, o);
    return out;
  }
  function para(runs, o = {}) {
    let ppr = '';
    if (o.tabs) ppr += '<w:tabs>' + o.tabs + '</w:tabs>';
    if (o.border) ppr += '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>';
    ppr += '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"/>';
    if (o.ind) ppr += '<w:ind w:left="' + o.ind[0] + '" w:hanging="' + o.ind[1] + '"/>';
    if (o.keepNext) ppr += '<w:keepNext/>';
    return '<w:p><w:pPr>' + ppr + '</w:pPr>' + runs + '</w:p>';
  }
  async function toDocx(B, o, JSZip) {
    const letter = o.paper === 'Letter';
    const pgW = letter ? 12240 : 11906, pgH = letter ? 15840 : 16838, mar = 1134, content = pgW - 2 * mar;
    const rightTab = '<w:tab w:val="right" w:pos="' + content + '"/>';
    let body = '';
    const rels = [];
    for (const b of B) {
      if (b.t === 'name') body += para(run(b.text, { b: true, sz: 40 }), { after: 40 });
      else if (b.t === 'headline') body += para(run(b.text, { sz: 24, color: '333333' }), { after: 40 });
      else if (b.t === 'contact') body += para(linkRuns(b.text, { sz: 19, color: '333333' }, rels), { after: 120 });
      else if (b.t === 'h') body += para(run(b.text, { b: true, caps: true, sz: 22 }), { border: true, before: 200, after: 100, keepNext: true });
      else if (b.t === 'row') body += para(run(b.left, { b: true }) + (b.right ? '<w:r><w:tab/></w:r>' + run(b.right) : ''), { tabs: rightTab, before: 80, after: 20, keepNext: true });
      else if (b.t === 'sub') body += para(linkRuns(b.text, { i: true, color: '333333' }, rels), { after: 40 });
      else if (b.t === 'p') body += para(linkRuns(b.text, {}, rels));
      else if (b.t === 'tools') body += para(linkRuns(b.text, { i: true, color: '333333' }, rels), { ind: [284, 0], after: 80 });
      else if (b.t === 'bullet') body += para(run('•') + '<w:r><w:tab/></w:r>' + linkRuns(b.text, {}, rels), { ind: [284, 284], tabs: '<w:tab w:val="left" w:pos="284"/>', after: 30 });
      else if (b.t === 'lb') {
        body += para(run(b.d, { color: '333333' }) + '<w:r><w:tab/></w:r>' + run(b.main, { b: true }), { tabs: '<w:tab w:val="left" w:pos="2268"/>', ind: [2268, 2268], before: 80, after: 20 });
        if (b.sub) body += para(linkRuns(b.sub, { i: true, color: '333333' }, rels), { ind: [2268, 0], after: 20 });
        b.bullets.forEach(x => (body += para(run('•') + '<w:r><w:tab/></w:r>' + run(x), { ind: [2552, 284], tabs: '<w:tab w:val="left" w:pos="2552"/>', after: 20 })));
      } else if (b.t === 'clause') body += para(run(b.text, { sz: 16, color: '444444' }), { before: 240 });
    }
    const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="' + pgW + '" w:h="' + pgH + '"/><w:pgMar w:top="' + mar + '" w:right="' + mar + '" w:bottom="' + mar + '" w:left="' + mar + '" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>';
    const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="' + ({ en: 'en-GB', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT' }[o.lang] || 'es-ES') + '"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>';
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + rels.map(r => '<Relationship Id="' + r.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="' + xe(r.url) + '" TargetMode="External"/>').join('') + '</Relationships>');
    zip.file('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>' + xe((B[0] && B[0].text) || 'CV') + ' — CV</dc:title><dc:creator>' + xe((B[0] && B[0].text) || '') + '</dc:creator></cp:coreProperties>');
    zip.file('word/document.xml', doc);
    zip.file('word/styles.xml', styles);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  // ---------- PDF (texto real, una columna, legible por ATS) ----------
  async function toPdf(B, o, PDFLib) {
    const { PDFDocument, StandardFonts, rgb, PDFString } = PDFLib;
    const doc = await PDFDocument.create();
    const F = { r: await doc.embedFont(StandardFonts.Helvetica), b: await doc.embedFont(StandardFonts.HelveticaBold), i: await doc.embedFont(StandardFonts.HelveticaOblique) };
    const letter = o.paper === 'Letter';
    const W = letter ? 612 : 595.28, Hh = letter ? 792 : 841.89, M = 54, CW = W - 2 * M;
    const INK = rgb(0.07, 0.07, 0.07), GREY = rgb(0.25, 0.25, 0.25), RULE = rgb(0.6, 0.6, 0.6);
    const cache = new Map();
    const SUB = { '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'", '…': '...', '→': '->', '≥': '>=', '≤': '<=', '−': '-', '‐': '-', '‑': '-', ' ': ' ', ' ': ' ', ' ': ' ', 'Ł': 'L', 'ł': 'l', 'Đ': 'D', 'đ': 'd', 'ı': 'i', 'Ħ': 'H', 'ħ': 'h', '✓': '', '✔': '', '★': '*', '☆': '*', '●': '*', '○': 'o', '▪': '-', '■': '-' };
    const safe = (font, str) => {
      let out = '';
      for (const ch of String(str == null ? '' : str).replace(/[\t\r\n]+/g, ' ')) {
        const k = font.name + ch;
        if (!cache.has(k)) {
          let rep = SUB[ch] != null ? SUB[ch] : ch;
          try { font.encodeText(rep); } catch (e) {
            const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
            try { font.encodeText(base); rep = base; } catch (e2) { rep = /\p{L}/u.test(ch) ? '?' : (ch.trim() ? '' : ' '); }
          }
          cache.set(k, rep);
        }
        out += cache.get(k);
      }
      return out;
    };
    const width = (t, f, sz) => f.widthOfTextAtSize(t, sz);
    const pieceOf = new Map(); // trozos de URLs largas partidas en varias líneas -> URL completa
    function wrap(text, f, sz, maxW) {
      const words = safe(f, text).split(/ +/).filter(Boolean), out = [];
      let line = '';
      for (let w of words) {
        while (width(w, f, sz) > maxW) { // palabra más larga que la línea (URL larga)
          let cut = w.length; while (cut > 1 && width(w.slice(0, cut), f, sz) > maxW) cut--;
          if (line) { out.push(line); line = ''; }
          pieceOf.set(w.slice(0, cut), pieceOf.get(w) || w); pieceOf.set(w.slice(cut), pieceOf.get(w) || w);
          out.push(w.slice(0, cut)); w = w.slice(cut);
        }
        const cand = line ? line + ' ' + w : w;
        if (width(cand, f, sz) <= maxW) line = cand; else { if (line) out.push(line); line = w; }
      }
      if (line) out.push(line);
      return out.length ? out : [''];
    }
    let page = doc.addPage([W, Hh]), y = Hh - M;
    const ensure = h => { if (y - h < M) { page = doc.addPage([W, Hh]); y = Hh - M; } };
    const text = (t, x, f, sz, color) => page.drawText(t, { x, y, size: sz, font: f, color: color || INK });
    // enlace clicable: anotación /Link sobre la palabra + subrayado fino; el texto no cambia
    const linkify = (line, x, f, sz) => {
      let off = 0;
      for (const w of line.split(/(\s+)/)) {
        if (w && !/^\s+$/.test(w)) {
          const full = pieceOf.get(w) || pieceOf.get(trimUrl(w));
          const u = full ? trimUrl(full) : trimUrl(w);
          if (isUrl(u)) {
            const x0 = x + width(line.slice(0, off), f, sz), ww = width(full ? w : trimUrl(w), f, sz);
            const annot = doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x0, y - 2.5, x0 + ww, y + sz * 0.85], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(hrefOf(u)) } });
            page.node.addAnnot(doc.context.register(annot));
            page.drawLine({ start: { x: x0, y: y - 1.2 }, end: { x: x0 + ww, y: y - 1.2 }, thickness: 0.4, color: LINK });
          }
        }
        off += w.length;
      }
    };
    const LINK = rgb(0.06, 0.37, 0.55);
    const para = (t, x, f, sz, maxW, lh, color, links) => { wrap(t, f, sz, maxW).forEach(l => { ensure(lh); text(l, x, f, sz, color); if (links) linkify(l, x, f, sz); y -= lh; }); };
    // la viñeta va en la misma línea de texto que su contenido (mejor extracción) y con sangría francesa
    const BUL = '• ', bw = width(BUL, F.r, 10);
    const bulletLines = (t, x, maxW) => wrap(t, F.r, 10, maxW - bw).forEach((l, i) => { ensure(13.5); if (i === 0) { text(BUL + l, x, F.r, 10); linkify(l, x + bw, F.r, 10); } else { text(l, x + bw, F.r, 10); linkify(l, x + bw, F.r, 10); } y -= 13.5; });
    for (let n = 0; n < B.length; n++) {
      const b = B[n];
      if (b.t === 'name') { y -= 4; para(b.text, M, F.b, 20, CW, 24); }
      else if (b.t === 'headline') para(b.text, M, F.r, 11.5, CW, 15, GREY);
      else if (b.t === 'contact') { para(b.text, M, F.r, 9.5, CW, 13, GREY, true); y -= 4; }
      else if (b.t === 'h') {
        ensure(48); y -= 12;
        text(safe(F.b, b.text.toUpperCase()), M, F.b, 10.5);
        page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.6, color: RULE });
        y -= 18;
      } else if (b.t === 'row') {
        const right = safe(F.r, b.right || ''), rw = right ? width(right, F.r, 10) + 12 : 0;
        const lines = wrap(b.left, F.b, 10.5, CW - rw);
        ensure(lines.length * 14 + 14); y -= 2;
        lines.forEach((l, i) => { text(l, M, F.b, 10.5); if (i === 0 && right) text(right, W - M - width(right, F.r, 10), F.r, 10, GREY); y -= 14; });
      } else if (b.t === 'sub') para(b.text, M, F.i, 9.5, CW, 13, GREY, true);
      else if (b.t === 'p') { para(b.text, M, F.r, 10, CW, 13.5, null, true); y -= 2; }
      else if (b.t === 'tools') { para(b.text, M + 3 + bw, F.i, 9.5, CW - 3 - bw, 13, GREY, true); y -= 4; }
      else if (b.t === 'bullet') {
        bulletLines(b.text, M + 3, CW - 3);
      } else if (b.t === 'lb') {
        const DX = 118;
        const main = wrap(b.main || '', F.b, 10.5, CW - DX);
        ensure(main.length * 14 + 14); y -= 2;
        if (b.d) text(safe(F.r, b.d), M, F.r, 9.5, GREY);
        main.forEach(l => { text(l, M + DX, F.b, 10.5); y -= 14; });
        if (b.sub) para(b.sub, M + DX, F.i, 9.5, CW - DX, 13, GREY, true);
        b.bullets.forEach(x => bulletLines(x, M + DX + 3, CW - DX - 3));
      } else if (b.t === 'clause') { y -= 10; para(b.text, M, F.r, 8, CW, 10.5, GREY); }
    }
    const nm = (B[0] && B[0].text) || 'CV';
    doc.setTitle(nm + ' — CV'); doc.setAuthor(nm); doc.setSubject('Curriculum vitae');
    doc.setCreator('Analizador de CV'); doc.setProducer('Analizador de CV');
    doc.setLanguage({ en: 'en-GB', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT' }[o.lang] || 'es-ES');
    const bytes = await doc.save();
    return new Blob([bytes], { type: 'application/pdf' });
  }

  // JSON Resume (jsonresume.org): formato abierto para reutilizar los datos en otras herramientas
  function toJsonResume(m) {
    return {
      basics: { name: m.name, label: m.headline, email: m.email, phone: m.phone, summary: m.summary || '', location: { city: m.location }, profiles: [m.linkedin && { network: 'LinkedIn', url: m.linkedin }, m.web && { network: 'Web', url: m.web }].filter(Boolean) },
      work: (m.exp || []).map(e => ({ name: e.company, position: e.title, location: e.location, startDate: e.start, endDate: /actualidad|present/i.test(e.end) ? '' : e.end, highlights: lines(e.desc) })),
      education: (m.edu || []).map(e => ({ institution: e.institution, studyType: e.degree, startDate: e.start, endDate: e.end })),
      skills: list(m.skills).map(name => ({ name })),
      languages: (m.langs || []).map(l => ({ language: l.name, fluency: l.level })),
      certificates: lines(m.certs).map(name => ({ name })),
      projects: (m.projects || []).filter(p => p.name || p.url).map(p => ({ name: p.name, url: p.url, description: lines(p.desc).join(' '), keywords: String(p.tools || '').split(',').map(x => x.trim()).filter(Boolean), startDate: p.period || '' }))
    };
  }

  root.CVTemplate = { H, blocks, toHtml, toText, toDocx, toPdf, toJsonResume, isPlaceholder };
  if (typeof module !== 'undefined') module.exports = root.CVTemplate;
})(typeof window !== 'undefined' ? window : globalThis);

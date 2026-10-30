/* Extracción de texto y metadatos de maquetación en el navegador (PDF, DOCX, ODT, TXT).
   Los archivos nunca salen del dispositivo. */
(function (root) {
  'use strict';
  const cfg = root.CV_LIBS || {};
  let pdfjsP = null, zipP = null;
  const getPdfjs = () => (pdfjsP = pdfjsP || cfg.pdfjs());
  const getZip = () => (zipP = zipP || cfg.jszip());

  const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
  const PHONE_RE = /(?:\+|00)\d[\d\s().-]{7,}\d|\b[6789]\d{2}[\s.]?\d{3}[\s.]?\d{3}\b/;

  // ---------- PDF ----------
  function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }

  async function fromPdf(buf) {
    const lib = await getPdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true }).promise;
    const meta = { fileType: 'pdf', pages: doc.numPages, images: 0, photoLikely: false, fonts: 0, tinyText: 0, columns: false, pageSize: null, headerFooterContact: false };
    const fontSet = new Set();
    const pageTexts = [];
    const bands = []; // textos de cabecera/pie por página
    let rowsTotal = 0;
    const allSegs = [];
    const OPS = lib.OPS || {};
    const IMG_OPS = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintJpegXObject, OPS.paintImageXObjectRepeat].filter(v => v != null));
    for (let p = 1; p <= Math.min(doc.numPages, 12); p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const W = vp.width, H = vp.height;
      if (p === 1) {
        const near = (a, b) => Math.abs(a - b) < 6;
        const w = Math.min(W, H), h = Math.max(W, H);
        meta.pageSize = near(w, 595) && near(h, 842) ? 'A4' : near(w, 612) && near(h, 792) ? 'Letter' : null;
      }
      // imágenes y su tamaño (para detectar foto)
      try {
        const ol = await page.getOperatorList();
        let ctm = [1, 0, 0, 1, 0, 0];
        const stack = [];
        for (let i = 0; i < ol.fnArray.length; i++) {
          const fn = ol.fnArray[i], args = ol.argsArray[i];
          if (fn === OPS.save) stack.push(ctm);
          else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
          else if (fn === OPS.transform && args) ctm = mul(ctm, args);
          else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (args && Array.isArray(args[0]) && args[0].length === 6) ctm = mul(ctm, args[0]); }
          else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
          else if (IMG_OPS.has(fn)) {
            const iw = Math.hypot(ctm[0], ctm[1]), ih = Math.hypot(ctm[2], ctm[3]);
            if (iw > 18 && ih > 18) meta.images++;
            const top = H - (ctm[5] + ih);
            if (p === 1 && iw >= 40 && iw <= 230 && ih >= 40 && ih <= 260 && ih / iw > 0.7 && ih / iw < 1.6 && top < H * 0.45) meta.photoLikely = true;
          }
        }
      } catch (e) { /* sin lista de operadores: seguimos */ }

      const tc = await page.getTextContent();
      const items = tc.items.filter(it => typeof it.str === 'string' && it.str.length);
      const rows = [];
      for (const it0 of items) {
        // «N A Z A R» -> «NAZAR»: letras separadas por espacios (el ATS las lee sueltas)
        const it = /^(?:\S ){2,}\S$/.test(it0.str) ? (meta.spaced = (meta.spaced || 0) + 1, Object.assign({}, it0, { str: it0.str.replace(/ /g, '') })) : it0;
        const x = it.transform[4], y = it.transform[5];
        const h = Math.abs(it.transform[3]) || it.height || 10;
        fontSet.add(it.fontName);
        if (it.str.trim() && h < 4) meta.tinyText++;
        let row = rows.find(r => Math.abs(r.y - y) <= Math.max(2, Math.min(h, r.h) * 0.45));
        if (!row) { row = { y, h, items: [] }; rows.push(row); }
        row.items.push({ x, w: it.width || it.str.length * h * 0.5, str: it.str, h });
      }
      rows.sort((a, b) => b.y - a.y);
      const built = rows.map(r => {
        r.items.sort((a, b) => a.x - b.x);
        const segs = [];
        let cur = null;
        for (const it of r.items) {
          if (!it.str.trim() && cur) { cur.text += ' '; continue; }
          const gap = cur ? it.x - cur.end : 0;
          if (!cur || gap > W * 0.06) { cur = { x0: it.x, end: it.x + it.w, text: it.str }; segs.push(cur); }
          else { cur.text += (gap > it.h * 0.18 && !/\s$/.test(cur.text) && !/^\s/.test(it.str) ? ' ' : '') + it.str; cur.end = Math.max(cur.end, it.x + it.w); }
        }
        segs.forEach(s => (s.text = s.text.replace(/\s+/g, ' ').trim()));
        return { y: r.y, segs: segs.filter(s => s.text) };
      }).filter(r => r.segs.length);
      for (const r of built) {
        rowsTotal++;
        for (const sg of r.segs) allSegs.push({ x: sg.x0 / W, y: r.y / H, p, date: /\b(19|20)\d{2}\b|actualidad|present|heute/i.test(sg.text) && sg.text.split(' ').length <= 6 });
      }
      // cabeceras y pies (franjas superior e inferior)
      const topBand = built.filter(r => r.y > H * 0.94).map(r => r.segs.map(s => s.text).join(' ')).join(' ');
      const botBand = built.filter(r => r.y < H * 0.06).map(r => r.segs.map(s => s.text).join(' ')).join(' ');
      bands.push({ top: topBand, bot: botBand });
      if (p === 1) {
        let big = null;
        for (const r of rows) { const t = r.items.map(i => i.str).join('').trim(); if (t.length > 3 && (!big || r.h > big.h)) big = { h: r.h, t: r.items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(), x: r.items[0].x / W }; }
        if (big) { meta.titleLine = big.t; meta.titleX = big.x; }
      }
      pageTexts.push({ W, built });
    }
    // ¿maquetación a dos columnas? Buscamos dos grupos de márgenes izquierdos separados,
    // ambos con contenido a lo largo de la página (no una simple columna de fechas).
    let boundary = null;
    if (rowsTotal >= 8) {
      const xs = allSegs.filter(sg => !sg.date).map(sg => sg.x).sort((a, b) => a - b);
      let best = null;
      for (let i = 1; i < xs.length; i++) {
        const gap = xs[i] - xs[i - 1], mid = (xs[i] + xs[i - 1]) / 2;
        if (gap < 0.12 || mid < 0.15 || mid > 0.75) continue;
        const left = allSegs.filter(sg => sg.x < mid), right = allSegs.filter(sg => sg.x >= mid);
        if (left.length < allSegs.length * 0.15 || right.length < allSegs.length * 0.15) continue;
        const span = arr => Math.max(...arr.map(a => a.y)) - Math.min(...arr.map(a => a.y));
        const leftDates = left.filter(sg => sg.date).length / left.length;
        const lo = Math.max(Math.min(...left.map(a => a.y)), Math.min(...right.map(a => a.y))), hi = Math.min(Math.max(...left.map(a => a.y)), Math.max(...right.map(a => a.y)));
        if (span(left) < 0.2 || span(right) < 0.2 || hi - lo < 0.15 || leftDates > 0.5) continue;
        if (!best || gap > best.gap) best = { gap, mid, left: left.length, right: right.length };
      }
      if (best) { boundary = best.mid; meta.columns = true; meta.columnsDetail = 'hay un bloque de texto a la izquierda (' + best.left + ' fragmentos) y otro a la derecha (' + best.right + ') que ocupan la misma altura'; }
    }
    // Reconstruir orden de lectura: por columnas si las hay
    const out = [];
    for (const pg of pageTexts) {
      if (boundary != null) {
        const bx = boundary * pg.W - 4;
        const left = [], right = [];
        for (const r of pg.built) {
          const l = r.segs.filter(s => s.x0 < bx).map(s => s.text).join('  ');
          const rr = r.segs.filter(s => s.x0 >= bx).map(s => s.text).join('  ');
          if (l) left.push(l); if (rr) right.push(rr);
        }
        // la columna estrecha suele ser la barra lateral: va primero si está a la izquierda
        if (meta.titleX != null && meta.titleX >= boundary && pg === pageTexts[0]) out.push(...right, ...left); else out.push(...left, ...right);
      } else for (const r of pg.built) out.push(r.segs.map(s => s.text).join('  '));
      out.push('');
    }
    meta.fonts = fontSet.size;
    if (doc.numPages > 1) {
      const rep = k => bands.map(b => b[k]).filter(Boolean);
      const tops = rep('top'), bots = rep('bot');
      const repeated = arr => arr.length >= 2 && arr.every(t => t.replace(/\d+/g, '') === arr[0].replace(/\d+/g, ''));
      if ((repeated(tops) && (EMAIL_RE.test(tops[0]) || PHONE_RE.test(tops[0]))) || (repeated(bots) && (EMAIL_RE.test(bots[0]) || PHONE_RE.test(bots[0])))) meta.headerFooterContact = true;
    }
    try { await doc.destroy(); } catch (e) { }
    return { text: out.join('\n'), meta };
  }

  // ---------- DOCX ----------
  const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  function xml(str) { return new DOMParser().parseFromString(str, 'application/xml'); }
  const byTag = (el, tag) => Array.from(el.getElementsByTagName(tag));
  const attr = (el, name) => el && (el.getAttribute(name) || el.getAttributeNS(W_NS, name.replace(/^w:/, '')));
  const inside = (el, tag, stop) => { for (let a = el.parentNode; a && a !== stop; a = a.parentNode) if (a.nodeName === tag) return true; return false; };

  function paraText(p) {
    let s = '';
    const walk = n => {
      for (const c of Array.from(n.childNodes)) {
        if (c.nodeType !== 1) continue;
        const nm = c.nodeName;
        if (nm === 'w:txbxContent' || nm === 'mc:Fallback' || nm === 'w:delText') continue;
        if (nm === 'w:t') s += c.textContent;
        else if (nm === 'w:tab') s += '  ';
        else if (nm === 'w:br' || nm === 'w:cr') s += '\n';
        else walk(c);
      }
    };
    walk(p);
    const isList = byTag(p, 'w:numPr').some(n => !inside(n, 'w:txbxContent', p));
    return (isList && s.trim() ? '• ' : '') + s;
  }

  async function fromDocx(buf) {
    const JSZip = await getZip();
    const zip = await JSZip.loadAsync(buf);
    const read = async name => (zip.file(name) ? zip.file(name).async('string') : '');
    const docXml = await read('word/document.xml');
    if (!docXml) throw new Error('El archivo no parece un DOCX válido.');
    const d = xml(docXml);
    const body = d.getElementsByTagName('w:body')[0];
    const meta = { fileType: 'docx', pages: null, images: 0, photoLikely: false, fonts: 0, tinyText: 0, columns: false, tables: 0, textBoxes: 0, pageSize: null, headerFooterContact: false };
    const lines = [];
    const handlePara = p => { paraText(p).split('\n').forEach(l => lines.push(l)); };
    const handleTable = tbl => {
      meta.tables++;
      const rows = Array.from(tbl.childNodes).filter(n => n.nodeName === 'w:tr');
      const cellsOf = tr => Array.from(tr.childNodes).filter(n => n.nodeName === 'w:tc');
      const layout = rows.some(tr => cellsOf(tr).some(tc => Array.from(tc.childNodes).filter(n => n.nodeName === 'w:p').length > 3));
      if (layout) { // tabla de maquetación: leer celda a celda (columna izquierda, luego derecha)
        const maxC = Math.max(...rows.map(r => cellsOf(r).length));
        for (let c = 0; c < maxC; c++) rows.forEach(tr => { const tc = cellsOf(tr)[c]; if (tc) Array.from(tc.childNodes).forEach(n => n.nodeName === 'w:p' ? handlePara(n) : n.nodeName === 'w:tbl' ? handleTable(n) : 0); });
      } else rows.forEach(tr => lines.push(cellsOf(tr).map(tc => byTag(tc, 'w:p').map(paraText).join(' ').trim()).filter(Boolean).join('   ')));
    };
    Array.from(body.childNodes).forEach(n => { if (n.nodeName === 'w:p') handlePara(n); else if (n.nodeName === 'w:tbl') handleTable(n); else if (n.nodeName === 'w:sdt') byTag(n, 'w:p').forEach(handlePara); });
    // cuadros de texto (sin duplicar los de mc:Fallback)
    const boxes = byTag(d, 'w:txbxContent').filter(b => !inside(b, 'mc:Fallback'));
    meta.textBoxes = boxes.filter(b => b.textContent.trim()).length;
    if (meta.textBoxes) {
      lines.push('');
      const owner = p => { let a = p.parentNode; while (a && a.nodeName !== 'w:txbxContent') a = a.parentNode; return a; };
      boxes.forEach(b => byTag(b, 'w:p').filter(p => owner(p) === b).forEach(p => lines.push(paraText(p))));
    }
    // columnas nativas, tamaño de página
    byTag(d, 'w:cols').forEach(c => { if (+attr(c, 'w:num') > 1) meta.columns = 'native'; });
    const pg = byTag(d, 'w:pgSz')[0];
    if (pg) { const w = +attr(pg, 'w:w'), h = +attr(pg, 'w:h'); const near = (a, b) => Math.abs(a - b) < 120; meta.pageSize = near(Math.min(w, h), 11906) && near(Math.max(w, h), 16838) ? 'A4' : near(Math.min(w, h), 12240) && near(Math.max(w, h), 15840) ? 'Letter' : null; }
    // texto oculto, diminuto o en blanco
    byTag(d, 'w:r').forEach(r => {
      const t = byTag(r, 'w:t').map(x => x.textContent).join('');
      if (!t.trim()) return;
      const rpr = r.getElementsByTagName('w:rPr')[0];
      if (!rpr) return;
      const sz = rpr.getElementsByTagName('w:sz')[0];
      const col = rpr.getElementsByTagName('w:color')[0];
      if (rpr.getElementsByTagName('w:vanish')[0] || (sz && +attr(sz, 'w:val') < 8) || (col && /^(FFFFFF|FEFEFE|FDFDFD)$/i.test(attr(col, 'w:val') || ''))) meta.tinyText++;
    });
    // fuentes
    const fonts = new Set();
    byTag(d, 'w:rFonts').forEach(f => { const v = attr(f, 'w:ascii') || attr(f, 'w:hAnsi'); if (v) fonts.add(v); });
    const styles = await read('word/styles.xml');
    if (styles) byTag(xml(styles), 'w:rFonts').slice(0, 3).forEach(f => { const v = attr(f, 'w:ascii'); if (v) fonts.add(v); });
    meta.fonts = fonts.size;
    // imágenes: tamaño en EMU -> pt
    const EMU = 12700;
    byTag(d, 'wp:extent').forEach(ex => {
      const w = +ex.getAttribute('cx') / EMU, h = +ex.getAttribute('cy') / EMU;
      const host = ex.parentNode;
      if (!host || !byTag(host, 'a:blip').length) return;
      if (w > 18 && h > 18) meta.images++;
      if (w >= 40 && w <= 230 && h >= 40 && h <= 260 && h / w > 0.7 && h / w < 1.6) meta.photoLikely = true;
    });
    // cabeceras y pies
    const hf = Object.keys(zip.files).filter(n => /^word\/(header|footer)\d*\.xml$/.test(n));
    const hfText = [];
    for (const n of hf) { const t = byTag(xml(await read(n)), 'w:p').map(paraText).join('\n').trim(); if (t) hfText.push(t); }
    if (hfText.some(t => EMAIL_RE.test(t) || PHONE_RE.test(t))) meta.headerFooterContact = true;
    // páginas (según la última vez que se guardó en Word)
    const app = await read('docProps/app.xml');
    const pm = app && app.match(/<Pages>(\d+)<\/Pages>/);
    if (pm) meta.pages = +pm[1];
    const hfLines = hfText.filter(t => EMAIL_RE.test(t) || PHONE_RE.test(t) || t.split(/\s+/).length > 2).join('\n');
    return { text: (hfLines ? hfLines + '\n' : '') + lines.join('\n'), meta };
  }

  // ---------- ODT (LibreOffice) ----------
  async function fromOdt(buf) {
    const JSZip = await getZip();
    const zip = await JSZip.loadAsync(buf);
    const c = zip.file('content.xml');
    if (!c) throw new Error('El archivo no parece un ODT válido.');
    const d = xml(await c.async('string'));
    const lines = [];
    const meta = { fileType: 'docx', pages: null, images: byTag(d, 'draw:image').length, photoLikely: false, fonts: byTag(d, 'style:font-face').length, tinyText: 0, columns: byTag(d, 'style:columns').some(x => +x.getAttribute('fo:column-count') > 1) ? 'native' : false, tables: byTag(d, 'table:table').length, textBoxes: byTag(d, 'draw:text-box').length, pageSize: null, headerFooterContact: false };
    const walk = n => {
      for (const ch of Array.from(n.childNodes)) {
        if (ch.nodeType !== 1) continue;
        if (ch.nodeName === 'text:p' || ch.nodeName === 'text:h') lines.push((inside(ch, 'text:list-item') ? '• ' : '') + ch.textContent);
        else walk(ch);
      }
    };
    walk(d.documentElement);
    meta.fileType = 'odt';
    return { text: lines.join('\n'), meta };
  }

  async function fromFile(file) {
    const name = file.name || 'cv';
    const ext = (name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    let res;
    if (ext === 'pdf' || file.type === 'application/pdf') res = await fromPdf(buf);
    else if (ext === 'docx') res = await fromDocx(buf);
    else if (ext === 'odt') res = await fromOdt(buf);
    else if (ext === 'txt' || ext === 'md' || file.type.startsWith('text/')) res = { text: new TextDecoder().decode(buf), meta: { fileType: 'txt' } };
    else if (/^(png|jpe?g|webp|heic|gif|bmp|tiff?)$/.test(ext)) res = { text: '', meta: { fileType: 'image' } };
    else if (ext === 'doc' || ext === 'rtf' || ext === 'pages') throw new Error('Los archivos .' + ext + ' no se pueden leer en el navegador. Guárdalo como PDF o DOCX y súbelo de nuevo.');
    else throw new Error('Formato no admitido (.' + ext + '). Usa PDF, DOCX, ODT o TXT.');
    res.meta.fileName = name;
    res.meta.fileSize = file.size;
    if (res.text.length > 60000) res.text = res.text.slice(0, 60000);
    return res;
  }

  root.CVExtract = { fromFile, fromPdf, fromDocx, fromOdt };
})(window);

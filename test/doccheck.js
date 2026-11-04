// Comprueba que el analizador distingue un CV de otros documentos: node test/doccheck.js
const E = require('../src/engine.js'), fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'docs'); let bad = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const r = E.analyze({ text: fs.readFileSync(path.join(dir, f), 'utf8'), meta: { fileType: 'pdf', pages: 1 }, opts: { now: new Date('2026-11-04') } });
  const want = f.startsWith('cv_') ? 'cv' : 'not_cv';
  const ok = want === 'cv' ? r.doc.verdict === 'cv' : r.doc.verdict !== 'cv';
  if (!ok) bad++;
  console.log((ok ? 'OK   ' : 'FALLO') + ' ' + f.padEnd(26) + r.doc.verdict.padEnd(7) + ' +' + r.doc.positive + ' -' + r.doc.negative + ' ' + (r.doc.kind || '') + ' | ' + r.doc.why.join('; '));
}
console.log(bad ? bad + ' fallos' : 'errors []'); process.exit(bad ? 1 : 0);

// Página principal: «Sube tu CV» pasa el archivo al analizador sin salir del navegador.
// El archivo se deja un momento en IndexedDB (almacenamiento local de este sitio) y el analizador lo borra al abrirlo.
(function () {
  'use strict';
  var MAX = 15 * 1024 * 1024, OK = /\.(pdf|docx|odt|txt)$/i;
  var input = document.getElementById('cvFile'), status = document.getElementById('cvStatus'), overlay = document.getElementById('dropOverlay');
  function say(msg, err) { status.textContent = msg; status.className = 'lp-status' + (err ? ' err' : ''); }
  function store(file) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { reject(new Error('timeout')); }, 5000);   // algunos navegadores en modo privado no responden
      try {
        var req = indexedDB.open('cv-handoff', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('f'); };
        req.onerror = function () { reject(req.error); };
        req.onsuccess = function () {
          try {
            var db = req.result, tx = db.transaction('f', 'readwrite');
            tx.objectStore('f').put({ blob: file, name: file.name, type: file.type, at: Date.now() }, 'pending');
            tx.oncomplete = function () { db.close(); resolve(); };
            tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
          } catch (e) { reject(e); }
        };
      } catch (e) { reject(e); }
    });
  }
  function open(file) {
    if (!file) return;
    if (!OK.test(file.name)) { say('Ese formato no se puede leer. Usa PDF, DOCX, ODT o TXT.', true); return; }
    if (file.size > MAX) { say('El archivo supera 15 MB. Expórtalo de nuevo comprimiendo las imágenes.', true); return; }
    say('Abriendo el analizador…');
    store(file).then(function () { location.href = 'analizador.html#subido'; }, function () {
      say('Tu navegador no deja pasar el archivo entre páginas (puede pasar en modo privado). Abre el analizador y súbelo allí.', true);
      var a = document.createElement('a'); a.href = 'analizador.html'; a.textContent = ' Abrir el analizador'; status.appendChild(a);
    });
  }
  input.addEventListener('change', function () { open(input.files[0]); input.value = ''; });
  // arrastrar y soltar en cualquier parte de la página
  var depth = 0;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1; }
  document.addEventListener('dragenter', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth++; overlay.hidden = false; });
  document.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) overlay.hidden = true; });
  document.addEventListener('drop', function (e) { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; overlay.hidden = true; open(e.dataTransfer.files[0]); });
})();

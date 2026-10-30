/* Versión del CV en otro idioma (español <-> inglés).
   Sin servicios externos: traduce lo que es seguro traducir con un diccionario
   (idiomas, niveles, fechas, lugares, titulaciones y competencias habituales) y deja
   el texto libre (perfil, puestos, descripciones) marcado para que lo traduzca la persona,
   a mano o pegando la traducción de la herramienta que prefiera. */
(function (root) {
  'use strict';
  const N = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const wc = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
  const LANG_NAMES = { es: 'español', en: 'inglés' };

  // pares [español, inglés]
  const LANGS = [['Español', 'Spanish'], ['Castellano', 'Spanish'], ['Inglés', 'English'], ['Francés', 'French'], ['Alemán', 'German'], ['Italiano', 'Italian'], ['Portugués', 'Portuguese'], ['Catalán', 'Catalan'], ['Valenciano', 'Valencian'], ['Gallego', 'Galician'], ['Euskera', 'Basque'], ['Chino', 'Chinese'], ['Chino mandarín', 'Mandarin Chinese'], ['Japonés', 'Japanese'], ['Coreano', 'Korean'], ['Árabe', 'Arabic'], ['Ruso', 'Russian'], ['Ucraniano', 'Ukrainian'], ['Polaco', 'Polish'], ['Rumano', 'Romanian'], ['Neerlandés', 'Dutch'], ['Holandés', 'Dutch'], ['Sueco', 'Swedish'], ['Noruego', 'Norwegian'], ['Danés', 'Danish'], ['Finés', 'Finnish'], ['Griego', 'Greek'], ['Turco', 'Turkish'], ['Hindi', 'Hindi'], ['Lengua de signos española', 'Spanish Sign Language']];
  const LEVELS = [['Lengua materna', 'Native'], ['Nativo', 'Native'], ['Nativa', 'Native'], ['Bilingüe', 'Bilingual'], ['Intermedio alto', 'Upper intermediate'], ['Intermedio-alto', 'Upper intermediate'], ['Intermedio bajo', 'Lower intermediate'], ['Intermedio', 'Intermediate'], ['Avanzado', 'Advanced'], ['Básico', 'Basic'], ['Elemental', 'Elementary'], ['Fluido', 'Fluent'], ['Competencia profesional', 'Professional working proficiency'], ['Profesional', 'Professional'], ['Alto', 'High'], ['Medio', 'Intermediate'], ['Bajo', 'Basic'], ['sin certificado', 'not certified'], ['certificado', 'certified']];
  const PLACES = [['España', 'Spain'], ['Alemania', 'Germany'], ['Irlanda', 'Ireland'], ['Francia', 'France'], ['Italia', 'Italy'], ['Reino Unido', 'United Kingdom'], ['Inglaterra', 'England'], ['Escocia', 'Scotland'], ['Estados Unidos', 'United States'], ['EE. UU.', 'USA'], ['Países Bajos', 'Netherlands'], ['Holanda', 'Netherlands'], ['Bélgica', 'Belgium'], ['Suiza', 'Switzerland'], ['Suecia', 'Sweden'], ['Noruega', 'Norway'], ['Dinamarca', 'Denmark'], ['Finlandia', 'Finland'], ['Polonia', 'Poland'], ['Grecia', 'Greece'], ['Rumanía', 'Romania'], ['Japón', 'Japan'], ['México', 'Mexico'], ['Perú', 'Peru'], ['Brasil', 'Brazil'], ['Canadá', 'Canada'], ['Colonia', 'Cologne'], ['Múnich', 'Munich'], ['Fráncfort', 'Frankfurt'], ['Londres', 'London'], ['Dublín', 'Dublin'], ['Lisboa', 'Lisbon'], ['Milán', 'Milan'], ['Roma', 'Rome'], ['Bruselas', 'Brussels'], ['Ginebra', 'Geneva'], ['Zúrich', 'Zurich'], ['Viena', 'Vienna'], ['Varsovia', 'Warsaw'], ['Praga', 'Prague'], ['Copenhague', 'Copenhagen'], ['Estocolmo', 'Stockholm'], ['Nueva York', 'New York'], ['La Coruña', 'A Coruña'], ['Castilla y León', 'Castile and León'], ['Andalucía', 'Andalusia'], ['Cataluña', 'Catalonia'], ['Comunidad Valenciana', 'Valencian Community'], ['País Vasco', 'Basque Country'], ['Islas Canarias', 'Canary Islands'], ['Canarias', 'Canary Islands'], ['Islas Baleares', 'Balearic Islands'], ['Baleares', 'Balearic Islands'], ['Aragón', 'Aragon'], ['Comunidad de Madrid', 'Community of Madrid'], ['Navarra', 'Navarre'], ['Castilla-La Mancha', 'Castilla–La Mancha'], ['Sevilla', 'Seville'], ['Remoto', 'Remote'], ['remoto', 'Remote'], ['En remoto', 'Remote'], ['Teletrabajo', 'Remote'], ['Híbrido', 'Hybrid'], ['Presencial', 'On-site']];
  const SUBJECTS = [['Ingeniería Multimedia', 'Multimedia Engineering'], ['Ingeniería Informática', 'Computer Engineering'], ['Ingeniería de Software', 'Software Engineering'], ['Ingeniería del Software', 'Software Engineering'], ['Ingeniería de Telecomunicación', 'Telecommunications Engineering'], ['Ingeniería de Tecnologías de Telecomunicación', 'Telecommunications Technology Engineering'], ['Ingeniería Industrial', 'Industrial Engineering'], ['Ingeniería Mecánica', 'Mechanical Engineering'], ['Ingeniería Eléctrica', 'Electrical Engineering'], ['Ingeniería Electrónica', 'Electronic Engineering'], ['Ingeniería Civil', 'Civil Engineering'], ['Ingeniería Química', 'Chemical Engineering'], ['Ingeniería Biomédica', 'Biomedical Engineering'], ['Ingeniería Aeroespacial', 'Aerospace Engineering'], ['Arquitectura', 'Architecture'], ['Computación Cuántica', 'Quantum Computing'], ['Tecnologías Cuánticas', 'Quantum Technologies'], ['Ciencia de Datos', 'Data Science'], ['Inteligencia Artificial', 'Artificial Intelligence'], ['Ciberseguridad', 'Cybersecurity'], ['Matemáticas', 'Mathematics'], ['Física', 'Physics'], ['Química', 'Chemistry'], ['Biología', 'Biology'], ['Biotecnología', 'Biotechnology'], ['Estadística', 'Statistics'], ['Administración y Dirección de Empresas', 'Business Administration'], ['Economía', 'Economics'], ['Finanzas', 'Finance'], ['Contabilidad', 'Accounting'], ['Marketing', 'Marketing'], ['Marketing Digital', 'Digital Marketing'], ['Derecho', 'Law'], ['Psicología', 'Psychology'], ['Medicina', 'Medicine'], ['Enfermería', 'Nursing'], ['Farmacia', 'Pharmacy'], ['Fisioterapia', 'Physiotherapy'], ['Periodismo', 'Journalism'], ['Publicidad y Relaciones Públicas', 'Advertising and Public Relations'], ['Comunicación Audiovisual', 'Audiovisual Communication'], ['Diseño Gráfico', 'Graphic Design'], ['Diseño', 'Design'], ['Bellas Artes', 'Fine Arts'], ['Traducción e Interpretación', 'Translation and Interpreting'], ['Filología Inglesa', 'English Studies'], ['Estudios Ingleses', 'English Studies'], ['Magisterio de Educación Primaria', 'Primary Education Teaching'], ['Educación Primaria', 'Primary Education'], ['Educación Infantil', 'Early Childhood Education'], ['Turismo', 'Tourism'], ['Recursos Humanos', 'Human Resources'], ['Relaciones Laborales y Recursos Humanos', 'Labour Relations and Human Resources'], ['Desarrollo de Aplicaciones Web', 'Web Application Development'], ['Desarrollo de Aplicaciones Multiplataforma', 'Multiplatform Application Development'], ['Administración de Sistemas Informáticos en Red', 'Network Computer Systems Administration'], ['Desarrollo de Videojuegos', 'Video Game Development'], ['Animación 3D, Juegos y Entornos Interactivos', '3D Animation, Games and Interactive Environments']];
  const SKILLS = [['Gestión de proyectos', 'Project management'], ['Control de calidad', 'Quality control'], ['Mantenimiento preventivo', 'Preventive maintenance'], ['Estadística', 'Statistics'], ['IA generativa', 'Generative AI'], ['Aprendizaje automático', 'Machine learning'], ['Ciberseguridad', 'Cybersecurity'], ['Redes', 'Networking'], ['Arquitectura de software', 'Software architecture'], ['Bases de datos', 'Databases'], ['Desarrollo web', 'Web development'], ['Diseño web', 'Web design'], ['Diseño gráfico', 'Graphic design'], ['Diseño UX/UI', 'UX/UI design'], ['Fotografía', 'Photography'], ['Edición de vídeo', 'Video editing'], ['Redes sociales', 'Social media'], ['Marketing digital', 'Digital marketing'], ['Atención al cliente', 'Customer service'], ['Ventas', 'Sales'], ['Contabilidad', 'Accounting'], ['Recursos humanos', 'Human resources'], ['Logística', 'Logistics'], ['Primeros auxilios', 'First aid'], ['Enfermería', 'Nursing'], ['Docencia', 'Teaching'], ['Derecho mercantil', 'Corporate law'], ['Derecho laboral', 'Employment law'], ['RGPD', 'GDPR'], ['Cumplimiento normativo', 'Compliance'], ['Gestión administrativa', 'Office management'], ['Mecanografía', 'Typing'], ['Secretariado', 'Secretarial work'], ['Contratación mercantil', 'Contract drafting'], ['Soldadura', 'Welding'], ['Electricidad', 'Electrical work'], ['Obra civil', 'Civil works'], ['Programación didáctica', 'Lesson planning'], ['Historia clínica electrónica', 'Electronic health records'], ['Computación cuántica', 'Quantum computing'], ['Algoritmos cuánticos', 'Quantum algorithms'], ['Control de versiones', 'Version control'], ['Metodologías ágiles', 'Agile methodologies'], ['Pruebas unitarias', 'Unit testing'], ['Análisis de datos', 'Data analysis'], ['Visualización de datos', 'Data visualisation'],
    // competencias personales
    ['Trabajo en equipo', 'Teamwork'], ['Comunicación', 'Communication'], ['Liderazgo', 'Leadership'], ['Resolución de problemas', 'Problem solving'], ['Pensamiento crítico', 'Critical thinking'], ['Gestión del tiempo', 'Time management'], ['Organización', 'Organisation'], ['Adaptabilidad', 'Adaptability'], ['Creatividad', 'Creativity'], ['Empatía', 'Empathy'], ['Orientación al cliente', 'Customer focus'], ['Toma de decisiones', 'Decision-making'], ['Inteligencia emocional', 'Emotional intelligence'], ['Negociación', 'Negotiation'], ['Proactividad', 'Proactivity'], ['Autonomía', 'Autonomy'], ['Atención al detalle', 'Attention to detail'], ['Planificación', 'Planning'], ['Oratoria', 'Public speaking'], ['Presentaciones', 'Presentations'], ['Responsabilidad', 'Responsibility'], ['Flexibilidad', 'Flexibility'], ['Aprendizaje continuo', 'Continuous learning'], ['Capacidad de aprendizaje', 'Quick learner'], ['Curiosidad', 'Curiosity'], ['Mentoría', 'Mentoring']];
  const TITLES = [['Desarrollador Frontend', 'Frontend Developer'], ['Desarrolladora Frontend', 'Frontend Developer'], ['Desarrollador Backend', 'Backend Developer'], ['Desarrolladora Backend', 'Backend Developer'], ['Desarrollador Full Stack', 'Full Stack Developer'], ['Desarrolladora Full Stack', 'Full Stack Developer'], ['Desarrollador de software', 'Software Developer'], ['Desarrolladora de software', 'Software Developer'], ['Ingeniero de software', 'Software Engineer'], ['Ingeniera de software', 'Software Engineer'], ['Programador', 'Programmer'], ['Programadora', 'Programmer'], ['Diseñador gráfico', 'Graphic Designer'], ['Diseñadora gráfica', 'Graphic Designer'], ['Analista de datos', 'Data Analyst'], ['Científico de datos', 'Data Scientist'], ['Científica de datos', 'Data Scientist'], ['Jefe de proyecto', 'Project Manager'], ['Jefa de proyecto', 'Project Manager'], ['Administrativo', 'Administrative Assistant'], ['Administrativa', 'Administrative Assistant'], ['Dependiente', 'Sales Assistant'], ['Dependienta', 'Sales Assistant'], ['Camarero', 'Waiter'], ['Camarera', 'Waitress'], ['Recepcionista', 'Receptionist'], ['Profesor', 'Teacher'], ['Profesora', 'Teacher'], ['Enfermero', 'Nurse'], ['Enfermera', 'Nurse'], ['Comercial', 'Sales Representative'], ['Contable', 'Accountant'], ['Becario', 'Intern'], ['Becaria', 'Intern'], ['Investigador', 'Researcher'], ['Investigadora', 'Researcher'], ['Investigador en prácticas', 'Research Intern'], ['Investigadora en prácticas', 'Research Intern'], ['Desarrollador web', 'Web Developer'], ['Desarrolladora web', 'Web Developer'], ['Diseñador web', 'Web Designer'], ['Diseñadora web', 'Web Designer'], ['Diseñador UX/UI', 'UX/UI Designer'], ['Diseñadora UX/UI', 'UX/UI Designer'], ['Ingeniero cuántico', 'Quantum Engineer'], ['Ingeniera cuántica', 'Quantum Engineer'], ['Ingeniero de datos', 'Data Engineer'], ['Ingeniera de datos', 'Data Engineer'], ['Técnico de soporte', 'IT Support Technician'], ['Técnica de soporte', 'IT Support Technician'], ['Community manager', 'Community Manager'], ['Prácticas', 'Internship'], ['Desarrollador de videojuegos', 'Game Developer'], ['Desarrolladora de videojuegos', 'Game Developer'], ['Desarrollador móvil', 'Mobile Developer'], ['Desarrolladora móvil', 'Mobile Developer']];
  const MONTHS = { es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  const MONTHS_LONG = { es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };

  // diccionario dirigido según el sentido de la traducción
  function dict(pairs, from) { const m = new Map(); pairs.forEach(([es, en]) => { const [a, b] = from === 'es' ? [es, en] : [en, es]; if (!m.has(N(a))) m.set(N(a), b); }); return m; }
  const keepCase = (src, out) => /^[A-ZÁÉÍÓÚÑ]/.test(src) ? out.charAt(0).toUpperCase() + out.slice(1) : out.charAt(0).toLowerCase() + out.slice(1);
  function exact(pairs, from, s) { const v = dict(pairs, from).get(N(s)); return v == null ? null : v; }

  function list(pairs, from, s) {
    // lista separada por comas, punto y coma o puntos medios: traduce cada elemento conocido
    return String(s || '').split(/(\s*[,;·|]\s*)/).map(part => { if (/^\s*[,;·|]\s*$/.test(part) || !part.trim()) return part; const t = exact(pairs, from, part.trim()); return t ? part.replace(part.trim(), t) : part; }).join('');
  }
  function phrases(pairs, from, s) {
    let out = String(s || '');
    const sorted = pairs.map(([es, en]) => from === 'es' ? [es, en] : [en, es]).sort((a, b) => b[0].length - a[0].length);
    const seen = new Set();
    for (const [a, b] of sorted) {
      if (seen.has(N(a))) continue; seen.add(N(a));
      const re = new RegExp('(^|[^\\p{L}])(' + a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\p{L}])', 'giu');
      out = out.replace(re, (m, pre, word) => pre + keepCase(word, b));
    }
    return out;
  }
  function date(s, from, to) {
    let out = String(s || '');
    if (/^\s*(actualidad|presente|hoy|present|current|now|today)\s*$/i.test(out)) return to === 'en' ? 'Present' : 'Actualidad';
    MONTHS_LONG[from].forEach((m, i) => { out = out.replace(new RegExp('\\b' + m + '\\b', 'gi'), MONTHS_LONG[to][i]); });
    MONTHS[from].forEach((m, i) => { out = out.replace(new RegExp('\\b' + m + '\\.?(?=\\s|$|/)', 'gi'), MONTHS[to][i]); });
    out = to === 'en' ? out.replace(/\s+y\s+/g, ' and ').replace(/\s+(hasta|a)\s+/g, ' – ') : out.replace(/\s+and\s+/gi, ' y ').replace(/\s+(to|until)\s+/gi, ' – ');
    return out.replace(/\b(actualidad|presente)\b/gi, to === 'en' ? 'Present' : 'Actualidad').replace(/\bpresent\b/gi, to === 'en' ? 'Present' : 'Actualidad');
  }
  function degree(s, from) {
    const t = String(s || '').trim(); if (!t) return t;
    const whole = exact(SUBJECTS, from, t); if (whole) return whole;
    const subj = x => exact(SUBJECTS, from, x.replace(/^(la|el|los|las)\s+/i, ''));
    let m;
    if (from === 'es') {
      if ((m = t.match(/^(?:Grado|Licenciatura|Diplomatura|Graduad[oa])\s+(?:Universitari[oa]\s+)?en\s+(.+)$/i)) && subj(m[1])) return "Bachelor's Degree in " + subj(m[1]);
      if ((m = t.match(/^M[áa]ster\s+(?:Universitario\s+|Oficial\s+)?(?:en|de)\s+(.+)$/i)) && subj(m[1])) return "Master's Degree in " + subj(m[1]);
      if ((m = t.match(/^Doctorado\s+en\s+(.+)$/i)) && subj(m[1])) return 'PhD in ' + subj(m[1]);
      if ((m = t.match(/^(?:CFGS|Ciclo Formativo de Grado Superior|T[ée]cnico Superior)\s+(?:en\s+)?(.+)$/i)) && subj(m[1])) return 'Higher Vocational Training in ' + subj(m[1]);
      if ((m = t.match(/^(?:CFGM|Ciclo Formativo de Grado Medio|T[ée]cnico)\s+(?:en\s+)?(.+)$/i)) && subj(m[1])) return 'Vocational Training in ' + subj(m[1]);
      if (/^Bachillerato\b/i.test(t)) return 'Upper Secondary Education (Bachillerato)';
    } else {
      if ((m = t.match(/^(?:Bachelor'?s(?:\s+Degree)?|BSc|BA|BEng|B\.Sc\.|B\.A\.)\s+(?:\(Hons\)\s+)?in\s+(.+)$/i)) && subj(m[1])) return 'Grado en ' + subj(m[1]);
      if ((m = t.match(/^(?:Master'?s(?:\s+Degree)?|MSc|MA|MEng|M\.Sc\.|M\.A\.)\s+in\s+(.+)$/i)) && subj(m[1])) return 'Máster en ' + subj(m[1]);
      if ((m = t.match(/^(?:PhD|Ph\.D\.|Doctorate)\s+in\s+(.+)$/i)) && subj(m[1])) return 'Doctorado en ' + subj(m[1]);
    }
    return t;
  }
  const CERT_WORDS = [['insignia', 'badge'], ['insignias', 'badges'], ['certificado', 'certificate'], ['certificación', 'certification'], ['curso', 'course'], ['cursos', 'courses'], ['horas', 'hours'], ['en curso', 'in progress'], ['actualidad', 'present']];
  const capFirst = x => x.charAt(0).toUpperCase() + x.slice(1);
  function title(s, from) {
    const t = String(s || '').trim(); if (!t) return t;
    const ex = exact(TITLES, from, t); if (ex) return ex;
    const known = x => exact(TITLES, from, x) || exact(SUBJECTS, from, x) || exact(SKILLS, from, x);
    let m;
    if (from === 'es') {
      if ((m = t.match(/^(.+?)\s+(junior|senior|jr\.?|sr\.?)$/i)) && exact(TITLES, from, m[1])) return capFirst(m[2].toLowerCase()) + ' ' + exact(TITLES, from, m[1]);
      if ((m = t.match(/^(junior|senior)\s+(.+)$/i)) && exact(TITLES, from, m[2])) return capFirst(m[1].toLowerCase()) + ' ' + exact(TITLES, from, m[2]);
      if ((m = t.match(/^(.+?)\s+(?:en\s+pr[áa]cticas|\(pr[áa]cticas\)|becari[oa])$/i)) && exact(TITLES, from, m[1])) return exact(TITLES, from, m[1]) + ' Intern';
      if ((m = t.match(/^(?:Pr[áa]cticas|Becari[oa])\s+(?:de|en)\s+(.+)$/i)) && known(m[1])) return known(m[1]) + ' Intern';
    } else {
      if ((m = t.match(/^(junior|senior)\s+(.+)$/i)) && exact(TITLES, from, m[2])) return exact(TITLES, from, m[2]) + ' ' + m[1].toLowerCase();
      if ((m = t.match(/^(.+?)\s+intern$/i)) && known(m[1])) return known(m[1]) + ' en prácticas';
    }
    return t;
  }
  function school(s, from) {
    const t = String(s || '').trim(); let m;
    if (from !== 'es' || !t) return t;
    const rest = x => place(x, from);
    if ((m = t.match(/^Universidad Polit[ée]cnica de (.+)$/i))) return 'Polytechnic University of ' + rest(m[1]);
    if ((m = t.match(/^Universidad Aut[óo]noma de (.+)$/i))) return 'Autonomous University of ' + rest(m[1]);
    if ((m = t.match(/^Universidad Internacional de (.+)$/i))) return 'International University of ' + rest(m[1]);
    if ((m = t.match(/^Universidad Complutense de (.+)$/i))) return 'Complutense University of ' + rest(m[1]);
    if ((m = t.match(/^Universidad Carlos III de (.+)$/i))) return 'Carlos III University of ' + rest(m[1]);
    if ((m = t.match(/^Universidad de (.+)$/i))) return 'University of ' + rest(m[1]);
    return t;
  }
  function place(s, from) { return String(s || '').split(/(\s*[,(/)]\s*)/).map(p => { const t = exact(PLACES, from, p.trim()); return t && p.trim() ? p.replace(p.trim(), t) : p; }).join(''); }

  // campos de texto libre que hay que traducir a mano (o con un traductor)
  function freeFields(e) {
    const f = ['headline', 'summary'];
    (e.exp || []).forEach((x, i) => f.push('exp.' + i + '.title', 'exp.' + i + '.desc'));
    (e.edu || []).forEach((x, i) => f.push('edu.' + i + '.degree'));
    (e.projects || []).forEach((x, i) => f.push('projects.' + i + '.desc'));
    (e.langs || []).forEach((x, i) => { if (wc(x.level) > 4) f.push('langs.' + i + '.level'); });
    f.push('soft', 'interests');
    return f;
  }
  // todos los campos que pueden contener texto en el idioma de origen (no se revisan contacto, enlaces, empresas ni herramientas)
  function scanFields(e) {
    const f = ['headline', 'summary', 'location'];
    (e.exp || []).forEach((x, i) => f.push('exp.' + i + '.title', 'exp.' + i + '.location', 'exp.' + i + '.start', 'exp.' + i + '.end', 'exp.' + i + '.desc'));
    (e.projects || []).forEach((x, i) => f.push('projects.' + i + '.name', 'projects.' + i + '.period', 'projects.' + i + '.desc'));
    (e.edu || []).forEach((x, i) => f.push('edu.' + i + '.degree', 'edu.' + i + '.institution', 'edu.' + i + '.location', 'edu.' + i + '.start', 'edu.' + i + '.end'));
    f.push('skills', 'soft');
    (e.langs || []).forEach((x, i) => f.push('langs.' + i + '.name', 'langs.' + i + '.level'));
    f.push('certs', 'courses', 'interests');
    return f;
  }
  const get = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[isNaN(k) ? k : +k], o);
  function set(o, path, v) { const p = path.split('.'); let x = o; for (let i = 0; i < p.length - 1; i++) x = x[isNaN(p[i]) ? p[i] : +p[i]]; x[p[p.length - 1]] = v; }

  // ---------- detección de texto sin traducir ----------
  // Señales del idioma de origen: palabras funcionales, acentos propios, vocabulario típico de CV y terminaciones.
  const SIG = {
    es: {
      stop: new Set('de del la las los el y e en con para por que una un unos unas al su sus se lo como sin entre sobre desde hasta durante mediante tras hacia segun según cada muy pero mis nuestro nuestra este esta estos estas donde cuando tambien también'.split(' ')),
      vocab: new Set(('insignia certificado certificados curso cursos horas proyecto proyectos desarrollo desarrollador desarrolladora programador programadora gestion equipo equipos empresa empresas practicas becario becaria grado ingenieria ingeniero ingeniera simulador protocolo generacion mapas algoritmos algoritmo herramientas herramienta aplicacion aplicaciones investigador investigadora trabajo trabajos experiencia formacion idiomas idioma nivel nativo nativa intermedio avanzado basico actualidad presente anos meses responsable tienda almacen ventas clientes cliente usuarios usuario datos sistema sistemas redes juego juegos publicaciones imagenes cuantica cuantico cuanticos cuanticas logros tareas funciones puesto puestos remoto presencial hibrido diseno disenador disenadora titulo universidad escuela instituto colegio master maestria doctorado ciclo superior medio tecnico tecnica licenciatura diplomatura aprendizaje mejora mejoras resultados calidad atencion espanol ingles frances aleman italiano portugues catalan valenciano gallego euskera chino japones arabe ruso lengua materna bilingue fluido conocimientos manejo pagina paginas cartel carteleria rotulos fotografias fotos publicidad redes clases alumnos voluntariado intereses lectura deporte viajes musica cine').split(' ')),
      chars: /[áéíóúñ¿¡]/i,
      suffix: w => w.length >= 6 && /(cion|ciones|mente|iendo|aron|ieron|abamos|amente)$/.test(w) || w.length >= 7 && /(ando|idad|idades|ados|adas)$/.test(w)
    },
    en: {
      stop: new Set('the and of with for to on by from at is was were an my our their which that this these into using while within across over under through'.split(' ')),
      vocab: new Set('badge certificate course hours project projects developer engineer engineering intern internship researcher research skills tools team company degree university school master bachelor native fluent intermediate advanced basic present current languages language english spanish french german remote hybrid onsite years months'.split(' ')),
      chars: /(?!)/,
      loan: new Set('marketing software hardware frontend backend fullstack branding testing hosting coaching feedback streaming startup startups email online offline marketplace dashboard workshop meeting manager freelance blockchain machine learning deep big data cloud devops scrum agile design web app apps junior senior community influencer engagement networking benchmarking briefing copywriting podcast ranking'.split(' ')),
      suffix: w => w.length >= 6 && /(ing|tion|tions|ness|ment|ments)$/.test(w) || w.length >= 6 && /[^e]ed$/.test(w)
    }
  };
  // nombres propios que no se traducen: empresas, nombre de la persona, herramientas y lugares ya traducidos
  function properNames(tr, to) {
    const out = [tr.name];
    (tr.exp || []).forEach(x => out.push(x.company));
    (tr.projects || []).forEach(x => String(x.tools || '').split(',').forEach(t => out.push(t)));
    PLACES.forEach(([es, en]) => out.push(to === 'en' ? en : es));
    return out.map(x => String(x || '').trim()).filter(x => x.length >= 2).sort((a, b) => b.length - a.length);
  }
  const ESC = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // devuelve las palabras que delatan el idioma de origen (vacío = parece traducido)
  function sourceWords(text, from, proper) {
    let t = String(text || '');
    for (const p of proper || []) t = t.replace(new RegExp('(^|[^\\p{L}])' + ESC(p) + '(?![\\p{L}])', 'giu'), '$1 ');
    t = t.replace(/https?:\/\/\S+|\b[\w.-]+\.(com|es|io|dev|app|org|net)\S*/gi, ' ');
    const S = SIG[from], words = t.match(/[\p{L}][\p{L}'’-]*/gu) || [];
    const strong = [], stops = [];
    words.forEach(w => {
      const n = N(w).replace(/['’-]/g, '');
      const lw = w.toLowerCase().replace(/['’-]/g, '');
      if (S.loan && S.loan.has(lw)) return;
      if (S.stop.has(n) || S.stop.has(lw)) stops.push(w);
      // en inglés no se quitan los acentos: «máster» es español, «master» no
      else if (S.chars.test(w) || S.vocab.has(from === 'en' ? lw : n) || S.suffix(from === 'en' ? lw : n)) strong.push(w);
    });
    const many = wc(t) <= 8 ? 1 : 2;
    const hits = strong.length ? strong.concat(stops) : stops.length >= many ? stops : [];
    return [...new Set(hits.map(w => w.toLowerCase()))];
  }
  // texto original de un campo (el perfil vacío se sustituye por el borrador, como en la plantilla)
  const origOf = (orig, p) => p === 'summary' ? (orig.summary || orig.draft || '') : get(orig, p);
  const TARGET_HINT = { en: /\b(engineer|developer|manager|assistant|intern|researcher|designer|analyst|consultant|specialist|technician|software|frontend|backend|full[- ]?stack|junior|senior|lead|head|officer|degree|bachelor|master)\b/i, es: /\b(ingenier[oa]|desarrollador[a]?|responsable|t[ée]cnic[oa]|analista|dise[ñn]ador[a]?|investigador[a]?|becari[oa]|grado|m[áa]ster|licenciatura)\b/i };
  // estado de un campo: null si está bien; si no, { words: palabras en el idioma de origen, same: sigue igual que el original }
  function check(orig, tr, p, from, to, proper) {
    const v = String(get(tr, p) || '').trim();
    if (!v || !/\p{L}/u.test(v)) return null;
    const keep = tr._keep && tr._keep[p];
    if (keep != null && keep === N(v)) return null;
    const words = sourceWords(v, from, proper || properNames(tr, to));
    if (words.length) return { words, same: N(v) === N(origOf(orig, p)) };
    // títulos cortos sin señales claras («Dependiente», «Camarero»): si siguen igual que el original, se revisan
    if (/^(headline|exp\.\d+\.title|edu\.\d+\.degree)$/.test(p) && N(v) === N(origOf(orig, p)) && !TARGET_HINT[to].test(v)) return { words: [], same: true };
    return null;
  }
  function pendingMap(orig, tr, from, to) {
    const proper = properNames(tr, to), out = new Map();
    scanFields(tr).forEach(p => { const c = check(orig, tr, p, from, to, proper); if (c) out.set(p, c); });
    return out;
  }
  function pending(orig, tr, from, to) { return [...pendingMap(orig, tr, from || (to === 'es' ? 'en' : 'es'), to || 'en').keys()]; }
  function keep(tr, p) { tr._keep = tr._keep || {}; tr._keep[p] = N(get(tr, p)); }

  function create(orig, from, to) {
    const e = JSON.parse(JSON.stringify(orig));
    if (!e.summary && e.draft) e.summary = e.draft;
    e.draft = ''; e._keep = {};
    e.location = place(e.location, from);
    e.headline = list(TITLES.concat(SUBJECTS, SKILLS), from, String(e.headline || '').split(/(\s*[·|,]\s*)/).map(x => /^\s*[·|,]\s*$/.test(x) ? x : title(x, from)).join(''));
    (e.exp || []).forEach(x => { x.title = title(x.title, from); x.location = place(x.location, from); x.start = date(x.start, from, to); x.end = date(x.end, from, to); });
    (e.edu || []).forEach(x => { x.degree = degree(x.degree, from); x.institution = school(x.institution, from); x.location = place(x.location, from); x.start = date(x.start, from, to); x.end = date(x.end, from, to); });
    (e.projects || []).forEach(x => { x.period = date(x.period, from, to); });
    (e.langs || []).forEach(l => { l.name = exact(LANGS, from, l.name) || l.name; if (wc(l.level) <= 4) l.level = phrases(LEVELS, from, l.level); });
    e.skills = list(SKILLS, from, e.skills);
    e.soft = list(SKILLS, from, e.soft);
    e.certs = phrases(CERT_WORDS, from, e.certs);
    e.courses = phrases(CERT_WORDS, from, e.courses);
    return e;
  }
  function exportText(orig, tr, to, all) {
    const from = to === 'es' ? 'en' : 'es';
    const paths = all ? scanFields(tr).filter(p => /\p{L}{2}/u.test(String(get(tr, p) || ''))) : pending(orig, tr, from, to);
    const head = to === 'en'
      ? 'Translate the following CV texts from Spanish into natural, professional English (British or American, but consistent). Keep every line that starts with [@...] exactly as it is, keep the bullet points (•) and line breaks, keep company names, product names, links and technologies unchanged, and do not add comments, notes or extra text. Use action verbs in the past tense for finished jobs and do not use "I".'
      : 'Traduce al español los siguientes textos de un CV, con un tono natural y profesional. Mantén exactamente igual cada línea que empieza por [@...], conserva las viñetas (•) y los saltos de línea, no cambies nombres de empresas, productos, enlaces ni tecnologías, y no añadas comentarios ni texto adicional. Usa verbos de acción en pasado para los trabajos terminados y no uses «yo».';
    return head + '\n\n' + paths.map(p => '[@' + p + ']\n' + String(get(tr, p) || '').trim()).join('\n\n') + '\n';
  }
  function importText(tr, text) {
    const re = /^\s*\[@([a-z]+(?:\.\d+\.[a-z]+)?)\]\s*$/i;
    const ok = new Set(scanFields(tr));
    let cur = null, buf = [], n = 0;
    const flush = () => { if (cur && ok.has(cur)) { const v = buf.join('\n').replace(/^\s+|\s+$/g, ''); if (v) { set(tr, cur, v); n++; } } buf = []; };
    String(text || '').replace(/\r/g, '').split('\n').forEach(l => { const m = l.match(re); if (m) { flush(); cur = m[1]; } else if (cur) buf.push(l.replace(/^```\w*$/, '')); });
    flush();
    return n;
  }
  root.CVTranslate = { create, pending, pendingMap, check, keep, scanFields, origOf, exportText, importText, freeFields, sourceWords, LANG_NAMES, _t: { degree, date, place, phrases, list, LEVELS, SKILLS } };
})(typeof window !== 'undefined' ? window : globalThis);
if (typeof module !== 'undefined') module.exports = (typeof window !== 'undefined' ? window : globalThis).CVTranslate;

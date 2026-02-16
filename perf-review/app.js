// ============================================================
// State
// ============================================================

const STATE_KEY = 'perf-review-state';

let state = loadState();

function defaultState() {
  return {
    files: [],
    extractedContext: '',
    qa: [
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
      { question: '', answer: '' },
    ],
    profile: { name: '', role: '', company: '', manager: '' },
    reviewType: 'mid-year',
    history: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultState(), ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
  return defaultState();
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

// ============================================================
// DOM refs
// ============================================================

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const fileList = document.getElementById('file-list');
const fileCount = document.getElementById('file-count');

const extractedContext = document.getElementById('extracted-context');
const clearContextBtn = document.getElementById('clear-context-btn');

const qaQuestions = document.querySelectorAll('.qa-question');
const qaAnswers = document.querySelectorAll('.qa-answer');
const resetQaBtn = document.getElementById('reset-qa-btn');

const toggleBtns = document.querySelectorAll('.toggle-btn');
const profileName = document.getElementById('profile-name');
const profileRole = document.getElementById('profile-role');
const profileCompany = document.getElementById('profile-company');
const profileManager = document.getElementById('profile-manager');
const generateBtn = document.getElementById('generate-btn');
const outputArea = document.getElementById('output-area');
const outputText = document.getElementById('output-text');
const copyBtn = document.getElementById('copy-btn');

const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// ============================================================
// Init UI from state
// ============================================================

function initUI() {
  // Context
  extractedContext.value = state.extractedContext;

  // QA
  state.qa.forEach((qa, i) => {
    if (qaQuestions[i]) qaQuestions[i].value = qa.question;
    if (qaAnswers[i]) qaAnswers[i].value = qa.answer;
  });

  // Profile
  profileName.value = state.profile.name;
  profileRole.value = state.profile.role;
  profileCompany.value = state.profile.company;
  profileManager.value = state.profile.manager;

  // Review type
  toggleBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === state.reviewType);
  });

  // Files
  renderFileList();
  renderHistory();
}

// ============================================================
// File handling
// ============================================================

browseBtn.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('click', (e) => {
  if (e.target !== browseBtn) fileInput.click();
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

async function handleFiles(filesList) {
  for (const file of filesList) {
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'txt', 'md', 'csv', 'json'];
    if (!allowed.includes(ext)) {
      toast(`Format non supporte: .${ext}`);
      continue;
    }

    const fileEntry = {
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      ext,
      status: 'parsing',
      text: '',
    };

    state.files.push(fileEntry);
    renderFileList();

    try {
      if (ext === 'pdf') {
        fileEntry.text = await parsePDF(file);
      } else {
        fileEntry.text = await file.text();
      }
      fileEntry.status = 'done';
    } catch (err) {
      console.error('Parse error:', err);
      fileEntry.status = 'error';
      fileEntry.text = `[Erreur de lecture: ${err.message}]`;
    }

    renderFileList();
    updateExtractedContext();
    saveState();
  }
}

async function parsePDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `\n--- Page ${i} ---\n${pageText}\n`;
  }

  return fullText.trim();
}

function deleteFile(id) {
  state.files = state.files.filter(f => f.id !== id);
  renderFileList();
  updateExtractedContext();
  saveState();
}

function updateExtractedContext() {
  const texts = state.files
    .filter(f => f.status === 'done' && f.text)
    .map(f => `## ${f.name}\n\n${f.text}`)
    .join('\n\n---\n\n');

  state.extractedContext = texts;
  extractedContext.value = texts;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function renderFileList() {
  fileCount.textContent = `${state.files.length} fichier(s)`;

  if (state.files.length === 0) {
    fileList.innerHTML = '';
    return;
  }

  fileList.innerHTML = state.files
    .map(f => `
      <div class="file-item">
        <div class="file-item-info">
          <div class="file-icon">${f.ext.toUpperCase()}</div>
          <span class="file-name">${escapeHtml(f.name)}</span>
          <span class="file-size">${formatSize(f.size)}</span>
          <span class="file-status ${f.status}">${
            f.status === 'parsing' ? 'Lecture...' :
            f.status === 'done' ? 'OK' : 'Erreur'
          }</span>
        </div>
        <button class="file-delete" onclick="deleteFile(${f.id})" title="Supprimer">&times;</button>
      </div>
    `)
    .join('');
}

// ============================================================
// Context
// ============================================================

extractedContext.addEventListener('input', () => {
  state.extractedContext = extractedContext.value;
  saveState();
});

clearContextBtn.addEventListener('click', () => {
  state.extractedContext = '';
  extractedContext.value = '';
  saveState();
  toast('Contexte vide');
});

// ============================================================
// Q&A
// ============================================================

qaQuestions.forEach(input => {
  input.addEventListener('input', () => {
    const i = parseInt(input.dataset.index);
    state.qa[i].question = input.value;
    saveState();
  });
});

qaAnswers.forEach(textarea => {
  textarea.addEventListener('input', () => {
    const i = parseInt(textarea.dataset.index);
    state.qa[i].answer = textarea.value;
    saveState();
  });
});

resetQaBtn.addEventListener('click', () => {
  state.qa = defaultState().qa;
  qaQuestions.forEach(q => q.value = '');
  qaAnswers.forEach(a => a.value = '');
  saveState();
  toast('Questions/reponses reinitialises');
});

// ============================================================
// Profile & review type
// ============================================================

profileName.addEventListener('input', () => { state.profile.name = profileName.value; saveState(); });
profileRole.addEventListener('input', () => { state.profile.role = profileRole.value; saveState(); });
profileCompany.addEventListener('input', () => { state.profile.company = profileCompany.value; saveState(); });
profileManager.addEventListener('input', () => { state.profile.manager = profileManager.value; saveState(); });

toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.reviewType = btn.dataset.type;
    toggleBtns.forEach(b => b.classList.toggle('active', b === btn));
    saveState();
  });
});

// ============================================================
// Generate
// ============================================================

generateBtn.addEventListener('click', () => {
  const prompt = buildPrompt();
  outputText.textContent = prompt;
  outputArea.classList.remove('hidden');

  // Save to history
  state.history.unshift({
    id: Date.now(),
    type: state.reviewType,
    date: new Date().toISOString(),
    prompt,
  });

  // Keep last 10
  if (state.history.length > 10) state.history = state.history.slice(0, 10);

  saveState();
  renderHistory();

  outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function buildPrompt() {
  const p = state.profile;
  const type = state.reviewType === 'mid-year' ? 'Mid-year' : 'Annual';
  const now = new Date();
  const year = now.getFullYear();
  const period = state.reviewType === 'mid-year'
    ? `Janvier - Juin ${year}`
    : `Janvier - Decembre ${year}`;

  let prompt = `Tu es un assistant specialise dans la generation de performance reviews professionnelles.

Genere une ${type} performance review avec les informations ci-dessous.

---

# Informations

**Collaborateur** : ${p.name || '[Prenom Nom]'}
**Role** : ${p.role || '[Role]'} @ ${p.company || '[Entreprise]'}
**Manager** : ${p.manager || '[Manager]'}
**Periode** : ${period}
**Type** : ${type} review

---

# Contexte extrait des documents de reference

${state.extractedContext || '[Aucun document fourni]'}

---

# Questions / Reponses

`;

  state.qa.forEach((qa, i) => {
    if (qa.question || qa.answer) {
      prompt += `Q${i + 1}: ${qa.question || '(pas de question)'}\n`;
      prompt += `R${i + 1}: ${qa.answer || '(pas de reponse)'}\n\n`;
    }
  });

  prompt += `---

# Instructions de redaction

- Ton direct et professionnel, pas de jargon corporate creux
- Privilegier les donnees et resultats concrets aux formulations vagues
- Pas de phrases comme "a demontre une capacite a" ou "a su faire preuve de" - aller droit au fait
- Style concis : si une phrase peut etre plus courte en gardant le meme sens, la raccourcir
- Pas d'emojis
- Paragraphes courts, pas de bullet points sauf dans les objectifs SMART
- Adapter la longueur au contenu reel (pas de remplissage)

`;

  if (state.reviewType === 'mid-year') {
    prompt += `# Format attendu

# Mid-year performance review - ${p.name || '[Prenom Nom]'}
**Periode** : ${period}
**Role** : ${p.role || '[Role]'} @ ${p.company || '[Entreprise]'}
**Manager** : ${p.manager || '[Manager]'}

## Resume de la periode
[2-3 paragraphes max]

## Objectifs et progression
### Objectif 1 - [Nom]
**Statut** : [On track / Ahead / Behind / Completed]
[3-4 phrases max avec donnees chiffrees]

### Objectif 2 - [Nom]
[Idem]

### Objectif 3 - [Nom]
[Idem]

## Points forts de la periode
[2-3 realisations marquantes avec impact mesurable]

## Axes d'amelioration
[2-3 axes concrets avec suggestions actionnables]

## Objectifs ajustes pour le S2
[Ajustements si pertinent]

## Auto-evaluation
[Base sur les reponses Q&R]`;
  } else {
    prompt += `# Format attendu

# Annual performance review - ${p.name || '[Prenom Nom]'}
**Periode** : ${period}
**Role** : ${p.role || '[Role]'} @ ${p.company || '[Entreprise]'}
**Manager** : ${p.manager || '[Manager]'}

## Vue d'ensemble de l'annee
[3-4 paragraphes]

## Resultats par objectif
### Objectif 1 - [Nom]
**Resultat** : [Exceeded / Met / Partially met / Not met]
**Score** : [X/5]
[Paragraphe avec contexte et donnees]

### Objectif 2 - [Nom]
[Idem]

### Objectif 3 - [Nom]
[Idem]

## Realisations majeures
[3-5 accomplissements chiffres]

## Competences et developpement
### Competences techniques
### Competences transverses
### Developpement professionnel

## Axes d'amelioration et plan de developpement
[3 axes : constat, action, resultat attendu]

## Objectifs proposes pour l'annee suivante
[3-4 objectifs SMART]

## Auto-evaluation
[Base sur les reponses Q&R]`;
  }

  return prompt;
}

// ============================================================
// Copy
// ============================================================

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outputText.textContent);
    copyBtn.textContent = 'Copie !';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copier';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (e) {
    // Fallback
    const range = document.createRange();
    range.selectNodeContents(outputText);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    sel.removeAllRanges();
    copyBtn.textContent = 'Copie !';
    setTimeout(() => copyBtn.textContent = 'Copier', 2000);
  }
});

// ============================================================
// History
// ============================================================

function renderHistory() {
  if (state.history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">Aucune review generee pour le moment.</p>';
    return;
  }

  historyList.innerHTML = state.history
    .map(h => {
      const date = new Date(h.date);
      const formatted = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      return `
        <div class="history-item">
          <div class="history-item-info">
            <span class="history-item-type">${h.type === 'mid-year' ? 'Mid-year' : 'Annual'} review</span>
            <span class="history-item-date">${formatted}</span>
          </div>
          <div class="history-item-actions">
            <button class="btn btn-sm" onclick="viewHistory(${h.id})">Voir</button>
            <button class="btn btn-sm" onclick="copyHistory(${h.id})">Copier</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function viewHistory(id) {
  const entry = state.history.find(h => h.id === id);
  if (entry) {
    outputText.textContent = entry.prompt;
    outputArea.classList.remove('hidden');
    outputArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function copyHistory(id) {
  const entry = state.history.find(h => h.id === id);
  if (entry) {
    try {
      await navigator.clipboard.writeText(entry.prompt);
      toast('Copie dans le presse-papier');
    } catch (e) {
      toast('Erreur de copie');
    }
  }
}

clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  saveState();
  renderHistory();
  toast('Historique vide');
});

// ============================================================
// Toast
// ============================================================

function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ============================================================
// Utils
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Boot
// ============================================================

initUI();

const STORAGE_KEY = 'krachttraining_data_v1';
const SETTINGS_KEY = 'krachttraining_settings_v1';
const KG_TO_LBS = 2.20462;

const MUSCLE_GROUPS = ['Borst', 'Rug', 'Benen', 'Schouders', 'Biceps', 'Triceps', 'Buik', 'Overig'];

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { exercises: [], logs: [] };
    const parsed = JSON.parse(raw);
    parsed.exercises.forEach(e => { if (!e.muscleGroup) e.muscleGroup = 'Overig'; });
    return parsed;
  } catch (e) {
    return { exercises: [], logs: [] };
  }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { unit: 'kg' };
    return JSON.parse(raw);
  } catch (e) {
    return { unit: 'kg' };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function estimated1RM(weightKg, reps) {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

function kgToDisplay(kg) {
  const val = settings.unit === 'lbs' ? kg * KG_TO_LBS : kg;
  return Math.round(val * 10) / 10;
}

function displayToKg(value) {
  return settings.unit === 'lbs' ? value / KG_TO_LBS : value;
}

const state = loadData();
const settings = loadSettings();
let selectedExerciseId = state.exercises[0]?.id || null;
let activeTab = 'log';

const exerciseListEl = document.getElementById('exercise-list');
const emptyStateEl = document.getElementById('empty-state');
const exerciseViewEl = document.getElementById('exercise-view');
const exerciseTitleEl = document.getElementById('exercise-title');
const exerciseMuscleTagEl = document.getElementById('exercise-muscle-tag');
const setsContainerEl = document.getElementById('sets-container');
const logDateEl = document.getElementById('log-date');
const historyListEl = document.getElementById('history-list');
const chartContainerEl = document.getElementById('chart-container');
const chartEmptyEl = document.getElementById('chart-empty');
const newExerciseMuscleEl = document.getElementById('new-exercise-muscle');
const volumeListEl = document.getElementById('volume-list');
const logTabEl = document.getElementById('log-tab');
const volumeTabEl = document.getElementById('volume-tab');

MUSCLE_GROUPS.forEach(group => {
  const opt = document.createElement('option');
  opt.value = group;
  opt.textContent = group;
  newExerciseMuscleEl.appendChild(opt);
});

// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    logTabEl.classList.toggle('hidden', activeTab !== 'log');
    volumeTabEl.classList.toggle('hidden', activeTab !== 'volume');
    if (activeTab === 'volume') renderVolume();
  });
});

// --- Unit toggle ---
document.querySelectorAll('.unit-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.unit = btn.dataset.unit;
    saveSettings();
    document.querySelectorAll('.unit-btn').forEach(b => b.classList.toggle('active', b === btn));
    updateWeightPlaceholders();
    render();
  });
});

function updateWeightPlaceholders() {
  document.querySelectorAll('.weight-input').forEach(input => {
    input.placeholder = settings.unit;
  });
}

// --- Exercises ---
document.getElementById('add-exercise-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('new-exercise-name');
  const name = input.value.trim();
  if (!name) return;
  const exercise = { id: uid(), name, muscleGroup: newExerciseMuscleEl.value };
  state.exercises.push(exercise);
  saveData();
  input.value = '';
  selectedExerciseId = exercise.id;
  render();
});

document.getElementById('delete-exercise-btn').addEventListener('click', () => {
  if (!selectedExerciseId) return;
  const exercise = state.exercises.find(e => e.id === selectedExerciseId);
  if (!exercise) return;
  if (!confirm(`Oefening "${exercise.name}" en alle bijbehorende geschiedenis verwijderen?`)) return;
  state.exercises = state.exercises.filter(e => e.id !== selectedExerciseId);
  state.logs = state.logs.filter(l => l.exerciseId !== selectedExerciseId);
  selectedExerciseId = state.exercises[0]?.id || null;
  saveData();
  render();
});

document.getElementById('add-set-btn').addEventListener('click', () => {
  addSetRow();
});

document.getElementById('log-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selectedExerciseId) return;
  const date = logDateEl.value;
  const rows = setsContainerEl.querySelectorAll('.set-row');
  const sets = [];
  rows.forEach(row => {
    const reps = parseFloat(row.querySelector('.reps-input').value);
    const weightDisplay = parseFloat(row.querySelector('.weight-input').value);
    if (!isNaN(reps) && !isNaN(weightDisplay) && reps > 0) {
      sets.push({ reps, weight: displayToKg(weightDisplay) });
    }
  });
  if (sets.length === 0) return;
  state.logs.push({ id: uid(), exerciseId: selectedExerciseId, date, sets });
  saveData();
  resetLogForm();
  render();
});

function addSetRow(reps = '', weightDisplay = '') {
  const index = setsContainerEl.children.length + 1;
  const row = document.createElement('div');
  row.className = 'set-row';
  row.innerHTML = `
    <span class="set-index">${index}</span>
    <input type="number" class="reps-input" placeholder="reps" min="1" step="1" value="${reps}">
    <input type="number" class="weight-input" placeholder="${settings.unit}" min="0" step="0.5" value="${weightDisplay}">
    <button type="button" class="remove-set-btn" title="Verwijder set">✕</button>
  `;
  row.querySelector('.remove-set-btn').addEventListener('click', () => {
    row.remove();
    renumberSetRows();
  });
  setsContainerEl.appendChild(row);
}

function renumberSetRows() {
  setsContainerEl.querySelectorAll('.set-row').forEach((row, i) => {
    row.querySelector('.set-index').textContent = i + 1;
  });
}

function resetLogForm() {
  setsContainerEl.innerHTML = '';
  logDateEl.value = todayStr();
  addSetRow();
}

function selectExercise(id) {
  selectedExerciseId = id;
  resetTimer();
  render();
}

function renderExerciseList() {
  exerciseListEl.innerHTML = '';
  state.exercises.forEach(exercise => {
    const li = document.createElement('li');
    li.innerHTML = `${exercise.name}<span class="muscle-hint">${exercise.muscleGroup}</span>`;
    if (exercise.id === selectedExerciseId) li.classList.add('active');
    li.addEventListener('click', () => selectExercise(exercise.id));
    exerciseListEl.appendChild(li);
  });
}

function getLogsForExercise(exerciseId) {
  return state.logs
    .filter(l => l.exerciseId === exerciseId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderHistory(logs) {
  historyListEl.innerHTML = '';
  if (logs.length === 0) {
    historyListEl.innerHTML = '<p class="muted">Nog geen sessies gelogd.</p>';
    return;
  }
  [...logs].reverse().forEach(log => {
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    const chips = log.sets.map(s => `<span class="history-set-chip">${s.reps} × ${kgToDisplay(s.weight)}${settings.unit}</span>`).join('');
    entry.innerHTML = `
      <div class="history-entry-header">
        <span class="date">${formatDate(log.date)}</span>
        <button data-log-id="${log.id}">Verwijder</button>
      </div>
      <div class="history-sets">${chips}</div>
    `;
    entry.querySelector('button').addEventListener('click', () => {
      state.logs = state.logs.filter(l => l.id !== log.id);
      saveData();
      render();
    });
    historyListEl.appendChild(entry);
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderChart(logs) {
  chartContainerEl.querySelectorAll('svg').forEach(el => el.remove());
  if (logs.length === 0) {
    chartEmptyEl.classList.remove('hidden');
    return;
  }
  chartEmptyEl.classList.add('hidden');

  const points = logs.map(log => {
    const bestKg = Math.max(...log.sets.map(s => estimated1RM(s.weight, s.reps)));
    return { date: log.date, value: kgToDisplay(bestKg) };
  });

  const width = Math.max(500, points.length * 70);
  const height = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const values = points.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = Math.max(0, minVal - range * 0.15);
  const yMax = maxVal + range * 0.15;

  const xStep = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  function xFor(i) {
    return paddingLeft + (points.length > 1 ? i * xStep : plotWidth / 2);
  }
  function yFor(v) {
    return paddingTop + plotHeight - ((v - yMin) / (yMax - yMin)) * plotHeight;
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const gridColor = '#2e333d';
  for (let i = 0; i <= 3; i++) {
    const y = paddingTop + (plotHeight / 3) * i;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', paddingLeft);
    line.setAttribute('x2', width - paddingRight);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    line.setAttribute('stroke', gridColor);
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);

    const val = yMax - ((yMax - yMin) / 3) * i;
    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', paddingLeft - 8);
    label.setAttribute('y', y + 4);
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('fill', '#8a8f9a');
    label.setAttribute('font-size', '11');
    label.textContent = Math.round(val);
    svg.appendChild(label);
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(p.value)}`).join(' ');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#ff5a3c');
  path.setAttribute('stroke-width', '2.5');
  svg.appendChild(path);

  points.forEach((p, i) => {
    const cx = xFor(i);
    const cy = yFor(p.value);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#ff5a3c');
    svg.appendChild(circle);

    const title = document.createElementNS(svgNS, 'title');
    title.textContent = `${formatDate(p.date)}: ${Math.round(p.value)}${settings.unit} geschat 1RM`;
    circle.appendChild(title);

    const label = document.createElementNS(svgNS, 'text');
    label.setAttribute('x', cx);
    label.setAttribute('y', height - paddingBottom + 20);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8a8f9a');
    label.setAttribute('font-size', '11');
    label.textContent = formatDate(p.date).replace(/ \d{4}$/, '');
    svg.appendChild(label);
  });

  chartContainerEl.appendChild(svg);
}

// --- Rest timer ---
const timerDisplayEl = document.getElementById('timer-display');
const timerStartBtn = document.getElementById('timer-start');
const timerPauseBtn = document.getElementById('timer-pause');
const timerResetBtn = document.getElementById('timer-reset');
let timerDurationSeconds = 90;
let timerRemaining = timerDurationSeconds;
let timerInterval = null;
let audioCtx = null;

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  timerDisplayEl.textContent = formatTime(timerRemaining);
  timerDisplayEl.classList.toggle('done', timerRemaining === 0);
}

function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) { /* audio not available */ }
}

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.toggle('active', b === btn));
    timerDurationSeconds = parseInt(btn.dataset.seconds, 10);
    resetTimer();
  });
});

timerStartBtn.addEventListener('click', () => {
  if (timerInterval) return;
  if (timerRemaining === 0) timerRemaining = timerDurationSeconds;
  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    updateTimerDisplay();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      playBeep();
      setTimeout(playBeep, 300);
      setTimeout(playBeep, 600);
    }
  }, 1000);
});

timerPauseBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerInterval = null;
});

timerResetBtn.addEventListener('click', resetTimer);

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRemaining = timerDurationSeconds;
  updateTimerDisplay();
}

// --- Volume overview (hypertrophy) ---
function renderVolume() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const counts = {};
  MUSCLE_GROUPS.forEach(g => { counts[g] = 0; });

  state.logs.forEach(log => {
    if (log.date < cutoffStr) return;
    const exercise = state.exercises.find(e => e.id === log.exerciseId);
    if (!exercise) return;
    counts[exercise.muscleGroup] = (counts[exercise.muscleGroup] || 0) + log.sets.length;
  });

  volumeListEl.innerHTML = '';
  const maxScale = 20;
  MUSCLE_GROUPS.forEach(group => {
    const count = counts[group] || 0;
    const pct = Math.min(100, (count / maxScale) * 100);
    let fillClass = 'low';
    if (count >= 10 && count <= 20) fillClass = 'optimal';
    else if (count > 20) fillClass = '';

    const row = document.createElement('div');
    row.className = 'volume-row';
    row.innerHTML = `
      <div class="volume-row-header">
        <span>${group}</span>
        <span class="count">${count} sets</span>
      </div>
      <div class="volume-bar-track">
        <div class="volume-bar-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
    `;
    volumeListEl.appendChild(row);
  });
}

// --- Main render ---
function render() {
  renderExerciseList();

  if (!selectedExerciseId) {
    emptyStateEl.classList.remove('hidden');
    exerciseViewEl.classList.add('hidden');
    return;
  }

  const exercise = state.exercises.find(e => e.id === selectedExerciseId);
  if (!exercise) {
    selectedExerciseId = state.exercises[0]?.id || null;
    render();
    return;
  }

  emptyStateEl.classList.add('hidden');
  exerciseViewEl.classList.remove('hidden');
  exerciseTitleEl.textContent = exercise.name;
  exerciseMuscleTagEl.textContent = exercise.muscleGroup;

  const logs = getLogsForExercise(selectedExerciseId);
  renderHistory(logs);
  renderChart(logs);
}

document.querySelectorAll('.unit-btn').forEach(btn => {
  if (btn.dataset.unit === settings.unit) btn.classList.add('active');
  else btn.classList.remove('active');
});

resetLogForm();
updateWeightPlaceholders();
updateTimerDisplay();
render();

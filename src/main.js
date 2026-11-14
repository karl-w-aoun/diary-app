import { Preferences } from '@capacitor/preferences';
import './style.css';

const KEY = 'daymark-entries-v1';
const PICKS_KEY = 'daymark-photo-picks-v1';
const FONT_KEY = 'daymark-font-v1';
const moods = [
  { value: 'bright', label: 'Bright', icon: 'SUN' },
  { value: 'steady', label: 'Steady', icon: 'CALM' },
  { value: 'heavy', label: 'Heavy', icon: 'LOW' },
  { value: 'tender', label: 'Tender', icon: 'HEART' }
];
const periods = ['day', 'week', 'month', 'year'];
const periodLabels = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' };
const markerColors = ['none', 'sun', 'sea', 'rose', 'moss'];
const fontOptions = { manrope: 'Soft Sans', serif: 'Book Serif', mono: 'Typewriter', rounded: 'Rounded', pixel: 'Pixelated' };
const prompts = ['What felt lighter than expected today?', 'What is one small thing you want to remember?', 'Where did you feel most like yourself?', 'What are you carrying that you can set down?', 'Describe one detail that made today yours.', 'What would you tell your morning self?', 'What deserves a little more space in your life?'];

let entries = [];
let photoPicks = { day: null, week: null, month: null, year: null };
let query = '';
let activeFilter = 'all';
let editingId = null;
let view = 'diary';
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let pendingPhoto = '';
let selectedPickPeriod = 'day';
let fontChoice = 'manrope';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const dateKey = (date = new Date()) => { const local = new Date(date); return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`; };
const prettyDate = (date) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

async function loadData() {
  const stored = await Preferences.get({ key: KEY });
  const picks = await Preferences.get({ key: PICKS_KEY });
  const font = await Preferences.get({ key: FONT_KEY });
  entries = stored.value ? JSON.parse(stored.value) : [];
  photoPicks = picks.value ? { ...photoPicks, ...JSON.parse(picks.value) } : photoPicks;
  fontChoice = fontOptions[font.value] ? font.value : 'manrope';
  applyFont();
}
async function saveEntries() { await Preferences.set({ key: KEY, value: JSON.stringify(entries) }); }
async function savePicks() { await Preferences.set({ key: PICKS_KEY, value: JSON.stringify(photoPicks) }); }
async function saveFont() { await Preferences.set({ key: FONT_KEY, value: fontChoice }); }
function applyFont() { document.documentElement.dataset.font = fontChoice; }
function selectedMood(value) { return moods.find((mood) => mood.value === value) || moods[1]; }
function dailyPrompt() { return prompts[Math.floor(new Date(`${dateKey()}T12:00:00`).getTime() / 86400000) % prompts.length]; }
function entryStats(entry) { const words = entry.body.trim().split(/\s+/).filter(Boolean).length; return { words, minutes: Math.max(1, Math.ceil(words / 180)) }; }
function streakCount() { const dates = new Set(entries.map((entry) => entry.date)); let cursor = new Date(`${dateKey()}T12:00:00`); let streak = 0; while (dates.has(dateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); } return streak; }
function weekCount() { const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const startKey = dateKey(start); return entries.filter((entry) => entry.date >= startKey).length; }
function filteredEntries() { const normalized = query.trim().toLowerCase(); return [...entries].filter((entry) => activeFilter === 'all' || entry.mood === activeFilter).filter((entry) => !normalized || `${entry.title} ${entry.body} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(normalized)).sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.date.localeCompare(a.date)); }

function render() {
  const todayEntry = entries.find((entry) => entry.date === dateKey());
  document.querySelector('#app').innerHTML = `<section class="shell"><header class="topbar"><div><span class="eyebrow">YOUR QUIET PLACE</span><h1>Daymark</h1></div><button class="icon-button" id="new-entry" aria-label="New entry">+</button></header><div class="content">${view === 'calendar' ? calendarView() : diaryView(todayEntry)}</div><nav class="bottom-nav"><button class="nav-item ${view === 'diary' ? 'active' : ''}" id="diary-nav"><span>BOOK</span>Notebook</button><button class="nav-item ${view === 'calendar' ? 'active' : ''}" id="calendar-nav"><span>DATE</span>Calendar</button><button class="nav-item" id="insight-button"><span>STATS</span>Insights</button><button class="nav-item" id="settings-button"><span>MORE</span>More</button></nav></section><div class="sheet hidden" id="sheet"></div>`;
  bindEvents();
}

function diaryView(todayEntry) {
  const list = filteredEntries();
  return `<section class="hero-card"><div class="hero-copy"><span class="eyebrow">${todayEntry ? 'TODAY IS SAVED' : 'A MOMENT FOR YOU'}</span><h2>${todayEntry ? 'You showed up today.' : 'How are you, really?'}</h2><p>${todayEntry ? 'Keep the thread going, or revisit something you wrote.' : 'A few honest lines are enough.'}</p></div><button class="hero-action" id="hero-action">${todayEntry ? 'Open today' : 'Write today'} <span>OPEN</span></button></section><div class="dashboard-strip"><div><strong>${streakCount()}</strong><span>day streak</span></div><div><strong>${weekCount()}/5</strong><span>weekly goal</span></div><div><strong>${entries.filter((entry) => entry.photo).length}</strong><span>photos</span></div></div><section class="prompt-card"><span class="eyebrow">TODAY'S SPARK</span><p>${dailyPrompt()}</p><button id="use-prompt">Write from this <span>+</span></button></section><div class="section-heading"><div><span class="eyebrow">YOUR PAGES</span><h3>Recent reflections</h3></div><span class="entry-count">${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</span></div><div class="tools"><label class="search"><span>FIND</span><input id="search" value="${escapeHtml(query)}" placeholder="Search your diary" /></label><button class="filter-button" id="filter-button">${activeFilter === 'all' ? 'All moods' : `${selectedMood(activeFilter).icon} ${selectedMood(activeFilter).label}`}</button></div><div class="entry-list">${list.length ? list.map(entryCard).join('') : '<div class="empty"><div class="empty-mark">+</div><h3>No pages here yet</h3><p>Start with one small detail from today.</p></div>'}</div>`;
}

function entryCard(entry) {
  const mood = selectedMood(entry.mood);
  const reminder = entry.reminder?.date ? `<span class="plan-tag">Plan ${escapeHtml(entry.reminder.date)} ${escapeHtml(entry.reminder.time || '')}</span>` : '';
  const photo = entry.photo ? `<img class="entry-photo" src="${escapeHtml(entry.photo)}" alt="Photo from ${escapeHtml(entry.date)}" />` : '';
  const stats = entryStats(entry);
  return `<article class="entry-card marker-${entry.marker || 'none'}" data-id="${entry.id}">${entry.pinned ? '<span class="pin-badge">PINNED</span>' : ''}${photo}<div class="entry-meta"><span>${prettyDate(entry.date)}</span><span class="mood-tag mood-${mood.value}">${mood.icon} ${mood.label}</span></div><h3>${escapeHtml(entry.title || 'Untitled moment')}</h3><p>${escapeHtml(entry.body)}</p><div class="entry-stats">${stats.words} words <span>/</span> ${stats.minutes} min read</div>${entry.tags?.length ? `<div class="tags">${entry.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('')}</div>` : ''}${reminder}<button class="share-entry" data-share-id="${entry.id}" aria-label="Share entry">SHARE</button><button class="card-arrow" aria-label="Edit entry">OPEN</button></article>`;
}

function calendarView() {
  const year = calendarMonth.getFullYear(); const month = calendarMonth.getMonth();
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(calendarMonth);
  const firstDay = new Date(year, month, 1).getDay(); const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + days }, (_, index) => { if (index < firstDay) return '<span class="calendar-day blank"></span>'; const day = index - firstDay + 1; const key = dateKey(new Date(year, month, day)); const entry = entries.find((item) => item.date === key); return `<button class="calendar-day ${key === dateKey() ? 'today' : ''} ${entry ? 'has-entry' : ''}" data-date="${key}"><strong>${day}</strong>${entry ? `<span>${entry.photo ? 'PHOTO' : 'PAGE'}</span>` : ''}</button>`; }).join('');
  return `<div class="calendar-head"><div><span class="eyebrow">YOUR NOTEBOOK</span><h2>Calendar</h2><p>Every day has a page waiting for you.</p></div><button class="hero-action" id="calendar-new">New page</button></div><section class="calendar-card"><div class="calendar-toolbar"><button class="small-button" id="prev-month">PREV</button><h3>${monthName}</h3><button class="small-button" id="next-month">NEXT</button></div><div class="weekdays">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells}</div></section>`;
}

function openEditor(entry = null, initialDate = dateKey()) {
  editingId = entry?.id || null; const draft = entry || { date: initialDate, title: '', body: '', mood: 'steady', tags: [], reminder: {} }; pendingPhoto = draft.photo || '';
  const sheet = document.querySelector('#sheet'); sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-panel"><div class="sheet-top"><button class="close-button" id="close-sheet">X</button><span class="eyebrow">${entry ? 'EDIT REFLECTION' : 'NEW REFLECTION'}</span><button class="save-button" id="save-entry">Save</button></div><div class="editor-date">${prettyDate(draft.date)}</div><input class="title-input" id="entry-title" placeholder="Give this moment a name" value="${escapeHtml(draft.title)}" /><textarea id="entry-body" placeholder="What is on your mind?\n\nThere is no right way to write here.">${escapeHtml(draft.body)}</textarea><div class="mood-picker"><span class="eyebrow">HOW DOES IT FEEL?</span><div class="mood-options">${moods.map((mood) => `<button class="mood-option ${draft.mood === mood.value ? 'selected' : ''}" data-mood="${mood.value}"><span>${mood.icon}</span>${mood.label}</button>`).join('')}</div></div><div class="page-markers"><label class="pin-toggle"><input id="entry-pinned" type="checkbox" ${draft.pinned ? 'checked' : ''} /> <span>Pin this page</span></label><span class="eyebrow">PAGE MARKER</span><div class="marker-options">${markerColors.map((marker) => `<button type="button" class="marker-option marker-${marker} ${draft.marker === marker ? 'selected' : ''}" data-marker="${marker}" aria-label="${marker} marker"></button>`).join('')}</div></div><div class="photo-picker"><div><span class="eyebrow">A PAGE WITH A PICTURE</span><p>Add a photo to remember this day.</p></div><input id="entry-photo" type="file" accept="image/*" /><div id="photo-preview">${pendingPhoto ? `<img src="${escapeHtml(pendingPhoto)}" alt="Selected photo" /><button id="remove-photo" type="button">Remove</button>` : ''}</div></div><div class="planning"><span class="eyebrow">PLAN A REMINDER</span><div class="plan-fields"><input id="reminder-date" type="date" value="${escapeHtml(draft.reminder?.date || '')}" /><input id="reminder-time" type="time" value="${escapeHtml(draft.reminder?.time || '')}" /></div><p>We will remind you on this device.</p></div><input class="tags-input" id="entry-tags" placeholder="Add tags, separated by commas" value="${escapeHtml((draft.tags || []).join(', '))}" />${entry ? '<button class="delete-entry" id="delete-entry">Delete this entry</button>' : ''}</div>`;
  document.querySelector('#entry-body').focus();
  document.querySelectorAll('.mood-option').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.mood-option').forEach((item) => item.classList.remove('selected')); button.classList.add('selected'); }));
  document.querySelectorAll('.marker-option').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.marker-option').forEach((item) => item.classList.remove('selected')); button.classList.add('selected'); }));
  document.querySelector('#entry-photo').addEventListener('change', async (event) => { if (event.target.files[0]) { pendingPhoto = await compressPhoto(event.target.files[0]); renderPhotoPreview(); } });
  document.querySelector('#remove-photo')?.addEventListener('click', () => { pendingPhoto = ''; renderPhotoPreview(); });
  document.querySelector('#close-sheet').addEventListener('click', closeEditor); document.querySelector('#save-entry').addEventListener('click', saveEditor); document.querySelector('#delete-entry')?.addEventListener('click', deleteEditor);
}

function renderPhotoPreview() { const preview = document.querySelector('#photo-preview'); if (preview) preview.innerHTML = pendingPhoto ? `<img src="${escapeHtml(pendingPhoto)}" alt="Selected photo" /><button id="remove-photo" type="button">Remove</button>` : ''; document.querySelector('#remove-photo')?.addEventListener('click', () => { pendingPhoto = ''; renderPhotoPreview(); }); }
function compressPhoto(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => { const image = new Image(); image.onload = () => { const scale = Math.min(1, 1200 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.78)); }; image.onerror = reject; image.src = reader.result; }; reader.onerror = reject; reader.readAsDataURL(file); }); }
function closeEditor() { document.querySelector('#sheet').className = 'sheet hidden'; }

async function saveEditor() {
  const title = document.querySelector('#entry-title').value.trim(); const body = document.querySelector('#entry-body').value.trim(); if (!body) return document.querySelector('#entry-body').focus();
  const existing = entries.find((entry) => entry.id === editingId); const reminderDate = document.querySelector('#reminder-date').value; const reminderTime = document.querySelector('#reminder-time').value;
  const next = { id: editingId || uid(), date: existing?.date || dateKey(), title, body, mood: document.querySelector('.mood-option.selected').dataset.mood, tags: document.querySelector('#entry-tags').value.split(',').map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean).slice(0, 8), photo: pendingPhoto, pinned: document.querySelector('#entry-pinned').checked, marker: document.querySelector('.marker-option.selected')?.dataset.marker || 'none', reminder: reminderDate ? { date: reminderDate, time: reminderTime || '09:00' } : null, updatedAt: Date.now() };
  entries = [next, ...entries.filter((entry) => entry.id !== next.id)]; await saveEntries(); await scheduleReminder(next); closeEditor(); render();
}
function notificationId(id) { return [...id].reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0) & 0x7fffffff; }
async function scheduleReminder(entry) {
  const id = notificationId(entry.id); const native = globalThis.Capacitor?.Plugins?.LocalNotifications;
  if (native) { await native.cancel({ notifications: [{ id }] }).catch(() => {}); if (!entry.reminder?.date) return; const at = new Date(`${entry.reminder.date}T${entry.reminder.time || '09:00'}:00`); if (at <= new Date()) return; const permission = await native.checkPermissions(); if (permission.display !== 'granted') await native.requestPermissions(); await native.schedule({ notifications: [{ id, title: entry.title || 'Daymark reminder', body: 'A page is waiting in your notebook.', schedule: { at, allowWhileIdle: true } }] }); }
  else if (entry.reminder?.date && 'Notification' in window) { const at = new Date(`${entry.reminder.date}T${entry.reminder.time || '09:00'}:00`).getTime() - Date.now(); if (at > 0 && at < 2147483647) { if (Notification.permission === 'default') await Notification.requestPermission(); if (Notification.permission === 'granted') window.setTimeout(() => new Notification(entry.title || 'Daymark reminder', { body: 'A page is waiting in your notebook.' }), at); } }
}
async function deleteEditor() { const removed = entries.find((entry) => entry.id === editingId); entries = entries.filter((entry) => entry.id !== editingId); await saveEntries(); if (removed) await scheduleReminder({ ...removed, reminder: null }); closeEditor(); render(); }

function showFilter() { const sheet = document.querySelector('#sheet'); sheet.className = 'sheet'; sheet.innerHTML = `<div class="sheet-panel compact"><div class="sheet-top"><button class="close-button" id="close-sheet">X</button><span class="eyebrow">FILTER BY MOOD</span><span></span></div><button class="filter-option ${activeFilter === 'all' ? 'selected' : ''}" data-filter="all">All moods <span>${entries.length}</span></button>${moods.map((mood) => `<button class="filter-option ${activeFilter === mood.value ? 'selected' : ''}" data-filter="${mood.value}">${mood.icon} ${mood.label}<span>${entries.filter((entry) => entry.mood === mood.value).length}</span></button>`).join('')}</div>`; document.querySelector('#close-sheet').addEventListener('click', closeEditor); document.querySelectorAll('.filter-option').forEach((button) => button.addEventListener('click', () => { activeFilter = button.dataset.filter; closeEditor(); render(); })); }

function showSettings() {
  const sheet = document.querySelector('#sheet'); sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-panel compact"><div class="sheet-top"><button class="close-button" id="close-sheet">X</button><span class="eyebrow">DAYMARK TOOLKIT</span><span></span></div><div class="settings-intro"><h2>Keep your pages yours.</h2><p>Back up your notebook as one portable file, or bring it to another device.</p></div><div class="font-settings"><span class="eyebrow">NOTEBOOK TYPE</span><p>Choose how your pages feel to read.</p><div class="font-options">${Object.entries(fontOptions).map(([value, label]) => `<button class="font-option font-${value} ${fontChoice === value ? 'selected' : ''}" data-font="${value}">${label}<span>A page of your story</span></button>`).join('')}</div></div><div class="backup-card"><div><span class="eyebrow">PRIVATE BACKUP</span><h3>${entries.length} pages, ${entries.filter((entry) => entry.photo).length} photos</h3><p>The <strong>.mynotebook</strong> file includes entries, pictures, markers, reminders, and photo collections.</p></div><button class="primary-wide" id="export-notebook">Export notebook</button><label class="secondary-wide">Import notebook<input id="import-notebook" type="file" accept=".mynotebook,application/json" /></label></div><div class="settings-list"><button id="settings-tips">How Daymark works <span>+</span></button><button id="settings-clear-search">Clear search and filters <span>+</span></button></div><p class="insight-note">Your notebook stays on this device unless you choose to export or share it.</p></div>`;
  document.querySelector('#close-sheet').addEventListener('click', closeEditor);
  document.querySelector('#export-notebook').addEventListener('click', exportNotebook);
  document.querySelector('#import-notebook').addEventListener('change', (event) => importNotebook(event.target.files[0]));
  document.querySelectorAll('.font-option').forEach((button) => button.addEventListener('click', async () => { fontChoice = button.dataset.font; await saveFont(); applyFont(); showSettings(); }));
  document.querySelector('#settings-tips').addEventListener('click', () => alert('Pin important pages, choose a colored marker, attach a photo, and set a reminder while writing.'));
  document.querySelector('#settings-clear-search').addEventListener('click', () => { query = ''; activeFilter = 'all'; closeEditor(); render(); });
}

function notebookData() { return { format: 'mynotebook', version: 1, app: 'Daymark', exportedAt: new Date().toISOString(), entries, photoPicks, fontChoice }; }
function blobDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
async function exportNotebook() {
  const filename = `daymark-${dateKey()}.mynotebook`; const blob = new Blob([JSON.stringify(notebookData(), null, 2)], { type: 'application/x-mynotebook+json' });
  const nativeFs = globalThis.Capacitor?.Plugins?.Filesystem;
  if (nativeFs) { try { const permissions = await nativeFs.checkPermissions?.(); if (permissions?.publicStorage && permissions.publicStorage !== 'granted') await nativeFs.requestPermissions(); await nativeFs.writeFile({ path: filename, data: await blobDataUrl(blob), directory: 'DOCUMENTS', recursive: true }); closeEditor(); alert(`Saved ${filename} in your Documents folder.`); return; } catch (error) { console.warn('Native export failed, using browser download.', error); } }
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ title: 'Daymark notebook', files: [file] }); return; } catch (error) { if (error.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeImportedEntry(entry) { if (!entry || typeof entry !== 'object' || typeof entry.body !== 'string' || typeof entry.date !== 'string') return null; return { id: typeof entry.id === 'string' ? entry.id : uid(), date: /^\d{4}-\d{2}-\d{2}$/.test(entry.date) ? entry.date : dateKey(), title: typeof entry.title === 'string' ? entry.title : '', body: entry.body, mood: moods.some((mood) => mood.value === entry.mood) ? entry.mood : 'steady', tags: Array.isArray(entry.tags) ? entry.tags.filter((tag) => typeof tag === 'string').slice(0, 8) : [], photo: typeof entry.photo === 'string' && entry.photo.startsWith('data:image/') ? entry.photo : '', pinned: Boolean(entry.pinned), marker: markerColors.includes(entry.marker) ? entry.marker : 'none', reminder: entry.reminder?.date ? { date: entry.reminder.date, time: entry.reminder.time || '09:00' } : null, updatedAt: Number(entry.updatedAt) || Date.now() }; }
async function importNotebook(file) {
  if (!file) return; try { const data = JSON.parse(await file.text()); if (data.format !== 'mynotebook' || !Array.isArray(data.entries)) throw new Error('This is not a Daymark notebook file.'); const imported = data.entries.map(normalizeImportedEntry).filter(Boolean); const replace = window.confirm(`Import ${imported.length} pages and replace the current notebook? Choose Cancel to merge instead.`); if (replace) entries = imported; else { const existing = new Set(entries.map((entry) => entry.id)); entries = [...entries, ...imported.filter((entry) => !existing.has(entry.id))]; } photoPicks = { ...photoPicks, ...(data.photoPicks || {}) }; if (fontOptions[data.fontChoice]) { fontChoice = data.fontChoice; await saveFont(); applyFont(); } await saveEntries(); await savePicks(); closeEditor(); render(); alert(`Imported ${imported.length} pages successfully.`); } catch (error) { alert(`Could not import notebook: ${error.message}`); } }

async function shareEntry(entry) { const text = `${entry.title || 'A Daymark page'}\n\n${entry.body}\n\n${prettyDate(entry.date)} - written in Daymark`; if (navigator.share) { try { await navigator.share({ title: entry.title || 'Daymark page', text }); return; } catch (error) { if (error.name === 'AbortError') return; } } await navigator.clipboard?.writeText(text); alert('Page copied to your clipboard.'); }

function showInsights() {
  const words = entries.reduce((sum, entry) => sum + entry.body.split(/\s+/).filter(Boolean).length, 0); const photos = entries.filter((entry) => entry.photo); const picked = entries.find((entry) => entry.id === photoPicks[selectedPickPeriod]); const sheet = document.querySelector('#sheet'); sheet.className = 'sheet';
  const trend = Array.from({ length: 7 }, (_, index) => { const day = new Date(); day.setDate(day.getDate() - (6 - index)); const entry = entries.find((item) => item.date === dateKey(day)); return `<span class="trend-${entry?.mood || 'empty'}" title="${dateKey(day)}"></span>`; }).join('');
  sheet.innerHTML = `<div class="sheet-panel compact"><div class="sheet-top"><button class="close-button" id="close-sheet">X</button><span class="eyebrow">YOUR INSIGHTS</span><span></span></div><div class="insight-number">${entries.length}</div><p class="insight-label">moments captured</p><div class="insight-grid"><div><strong>${words}</strong><span>words written</span></div><div><strong>${photos.length}</strong><span>photos saved</span></div><div><strong>${streakCount()}</strong><span>day streak</span></div><div><strong>${weekCount()}/5</strong><span>weekly goal</span></div></div><div class="trend-card"><span class="eyebrow">SEVEN DAY MOOD</span><div class="mood-trend">${trend}</div><div class="trend-labels"><span>6 days ago</span><span>today</span></div></div><div class="collection"><span class="eyebrow">PHOTO COLLECTIONS</span><p>Choose a favorite picture for each rhythm of your life.</p><div class="period-tabs">${periods.map((period) => `<button class="period-tab ${selectedPickPeriod === period ? 'selected' : ''}" data-period="${period}">${periodLabels[period]}</button>`).join('')}</div><div class="pick-preview">${picked ? `<img src="${escapeHtml(picked.photo)}" alt="${periodLabels[selectedPickPeriod]} photo" />` : `<span>Choose a photo below for your ${periodLabels[selectedPickPeriod].toLowerCase()}</span>`}</div><div class="photo-choices">${photos.length ? photos.map((entry) => `<button class="photo-choice" data-entry-id="${entry.id}"><img src="${escapeHtml(entry.photo)}" alt="${escapeHtml(entry.title || entry.date)}" /><span>${escapeHtml(entry.date)}</span></button>`).join('') : '<p>Add a photo to a notebook page first.</p>'}</div></div><p class="insight-note">Your diary is private on this device. Keep writing in the way that feels honest.</p></div>`;
  document.querySelector('#close-sheet').addEventListener('click', closeEditor); document.querySelectorAll('.period-tab').forEach((button) => button.addEventListener('click', () => { selectedPickPeriod = button.dataset.period; showInsights(); })); document.querySelectorAll('.photo-choice').forEach((button) => button.addEventListener('click', async () => { photoPicks[selectedPickPeriod] = button.dataset.entryId; await savePicks(); showInsights(); }));
}

function bindEvents() {
  document.querySelector('#new-entry').addEventListener('click', () => openEditor()); document.querySelector('#diary-nav').addEventListener('click', () => { view = 'diary'; render(); }); document.querySelector('#calendar-nav').addEventListener('click', () => { view = 'calendar'; render(); }); document.querySelector('#insight-button').addEventListener('click', showInsights); document.querySelector('#settings-button').addEventListener('click', showSettings);
  if (view === 'diary') { document.querySelector('#hero-action').addEventListener('click', () => openEditor(entries.find((entry) => entry.date === dateKey()) || null)); document.querySelector('#use-prompt').addEventListener('click', () => { openEditor(); document.querySelector('#entry-title').value = 'Daily reflection'; document.querySelector('#entry-body').value = `${dailyPrompt()}\n\n`; }); document.querySelector('#search').addEventListener('input', (event) => { query = event.target.value; render(); document.querySelector('#search').focus(); }); document.querySelector('#filter-button').addEventListener('click', showFilter); document.querySelectorAll('.entry-card').forEach((card) => card.addEventListener('click', () => openEditor(entries.find((entry) => entry.id === card.dataset.id)))); document.querySelectorAll('.share-entry').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); shareEntry(entries.find((entry) => entry.id === button.dataset.shareId)); })); }
  else { document.querySelector('#calendar-new').addEventListener('click', () => openEditor(null, dateKey())); document.querySelector('#prev-month').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1); render(); }); document.querySelector('#next-month').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1); render(); }); document.querySelectorAll('.calendar-day:not(.blank)').forEach((button) => button.addEventListener('click', () => openEditor(entries.find((entry) => entry.date === button.dataset.date) || null, button.dataset.date))); }
}

await loadData();
render();

// ── STATE MANAGEMENT ──
const state = {
  activeTab: 'overview',
  tracker: [],
  pipeline: { pending: [], processed: [] },
  cvContent: '',
  profileRaw: '',
  consoleActive: false
};

// ── DOM ELEMENTS ──
const elements = {
  navItems: document.querySelectorAll('.nav-item'),
  tabViews: document.querySelectorAll('.tab-view'),
  tabTitle: document.getElementById('current-tab-title'),
  tabSubtitle: document.getElementById('current-tab-subtitle'),
  
  // Stats
  statTotalEval: document.getElementById('stat-total-eval'),
  statTotalApplied: document.getElementById('stat-total-applied'),
  statAvgScore: document.getElementById('stat-avg-score'),
  statTotalPending: document.getElementById('stat-total-pending'),
  topMatchesList: document.getElementById('top-matches-list'),
  funnelStats: document.getElementById('funnel-stats'),
  
  // Tracker
  trackerList: document.getElementById('tracker-list'),
  trackerSearch: document.getElementById('tracker-search'),
  trackerFilterStatus: document.getElementById('tracker-filter-status'),
  
  // Pipeline
  pipelinePendingList: document.getElementById('pipeline-pending-list'),
  pipelineProcessedList: document.getElementById('pipeline-processed-list'),
  subTabButtons: document.querySelectorAll('.sub-tab-btn'),
  subTabViews: document.querySelectorAll('.sub-tab-view'),
  
  // Editors
  cvEditorTextarea: document.getElementById('cv-editor-textarea'),
  btnSaveCv: document.getElementById('btn-save-cv'),
  profileEditorTextarea: document.getElementById('profile-editor-textarea'),
  btnSaveProfile: document.getElementById('btn-save-profile'),
  
  // Console
  consoleOutput: document.getElementById('console-output'),
  consoleStatusDot: document.getElementById('console-status-dot'),
  btnClearConsole: document.getElementById('btn-clear-console'),
  btnToggleConsole: document.getElementById('btn-toggle-console'),
  consolePanel: document.querySelector('.console-panel'),
  
  // Modals
  btnTriggerScan: document.getElementById('btn-trigger-scan'),
  btnEvalCustom: document.getElementById('btn-eval-custom'),
  modalEvalCustom: document.getElementById('modal-eval-custom'),
  modalEvalClose: document.getElementById('modal-eval-close'),
  modalEvalCancel: document.getElementById('modal-eval-cancel'),
  modalEvalSubmit: document.getElementById('modal-eval-submit'),
  evalUrlInput: document.getElementById('eval-url-input'),
  evalTextInput: document.getElementById('eval-text-input'),
  
  // Report Viewer
  modalReportViewer: document.getElementById('modal-report-viewer'),
  modalReportClose: document.getElementById('modal-report-close'),
  reportViewerTitle: document.getElementById('report-viewer-title'),
  reportViewerContent: document.getElementById('report-viewer-content')
};

// Tab Meta Info
const tabMeta = {
  overview: { title: 'Dashboard Overview', subtitle: 'Summary of your current job search progress' },
  tracker: { title: 'Job Tracker', subtitle: 'Manage your evaluated and applied positions' },
  pipeline: { title: 'Job Inbox (Pipeline)', subtitle: 'Jobs discovered by the scanner waiting for evaluation' },
  cv: { title: 'Edit Resume (cv.md)', subtitle: 'Markdown source of truth for evaluations and PDFs' },
  profile: { title: 'Profile Settings (profile.yml)', subtitle: 'Personal details and target archetypes for job scoring' }
};

// ── INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupEventListeners();
  loadAllData();
});

// ── NAVIGATION & TAB HANDLERS ──
function setupNavigation() {
  elements.navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;
      
      // Update sidebar state
      elements.navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Update views
      elements.tabViews.forEach(view => view.classList.remove('active'));
      document.getElementById(`tab-${targetTab}`).classList.add('active');
      
      // Update titles
      elements.tabTitle.textContent = tabMeta[targetTab].title;
      elements.tabSubtitle.textContent = tabMeta[targetTab].subtitle;
      
      state.activeTab = targetTab;
      
      // Load specific tab data
      if (targetTab === 'cv') loadCv();
      if (targetTab === 'profile') loadProfile();
      if (targetTab === 'tracker') loadTracker();
      if (targetTab === 'pipeline') loadPipeline();
    });
  });
  
  // Pipeline Subtabs
  elements.subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSubtab = btn.dataset.subtab;
      
      elements.subTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      elements.subTabViews.forEach(v => v.classList.remove('active'));
      document.getElementById(`subtab-${targetSubtab}`).classList.add('active');
    });
  });
}

// ── EVENTS SETUP ──
function setupEventListeners() {
  // Clear / Minimize Console
  elements.btnClearConsole.addEventListener('click', () => {
    elements.consoleOutput.innerHTML = '';
  });
  
  elements.btnToggleConsole.addEventListener('click', () => {
    elements.consolePanel.classList.toggle('minimized');
    const isMinimized = elements.consolePanel.classList.contains('minimized');
    elements.btnToggleConsole.textContent = isMinimized ? '🗖' : '🗕';
  });
  
  // Save CV & Profile
  elements.btnSaveCv.addEventListener('click', saveCv);
  elements.btnSaveProfile.addEventListener('click', saveProfile);
  
  // Scan Trigger
  elements.btnTriggerScan.addEventListener('click', triggerPortalScan);
  
  // Modal URL Evaluation
  elements.btnEvalCustom.addEventListener('click', () => {
    elements.evalUrlInput.value = '';
    elements.evalTextInput.value = '';
    elements.modalEvalCustom.classList.add('active');
  });
  
  const closeModal = () => elements.modalEvalCustom.classList.remove('active');
  elements.modalEvalClose.addEventListener('click', closeModal);
  elements.modalEvalCancel.addEventListener('click', closeModal);
  elements.modalEvalSubmit.addEventListener('click', handleCustomEvaluation);
  
  // Report Viewer modal close
  elements.modalReportClose.addEventListener('click', () => {
    elements.modalReportViewer.classList.remove('active');
  });

  // Filters / Search
  elements.trackerSearch.addEventListener('input', renderTrackerTable);
  elements.trackerFilterStatus.addEventListener('change', renderTrackerTable);
}

// ── DATA FETCHING ──
async function loadAllData() {
  await Promise.all([
    loadTracker(),
    loadPipeline()
  ]);
  renderOverviewStats();
}

async function loadTracker() {
  try {
    const res = await fetch('/api/tracker');
    state.tracker = await res.json();
    renderTrackerTable();
    renderOverviewStats();
  } catch (err) {
    console.error('Error fetching tracker:', err);
  }
}

async function loadPipeline() {
  try {
    const res = await fetch('/api/pipeline');
    state.pipeline = await res.json();
    renderPipelineTables();
    renderOverviewStats();
  } catch (err) {
    console.error('Error fetching pipeline:', err);
  }
}

async function loadCv() {
  try {
    const res = await fetch('/api/cv');
    const data = await res.json();
    state.cvContent = data.content;
    elements.cvEditorTextarea.value = data.content;
  } catch (err) {
    console.error('Error fetching CV:', err);
  }
}

async function saveCv() {
  const content = elements.cvEditorTextarea.value;
  elements.btnSaveCv.disabled = true;
  elements.btnSaveCv.textContent = 'Saving...';
  
  try {
    const res = await fetch('/api/cv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const result = await res.json();
    if (result.success) {
      logConsoleOutput('System: cv.md saved successfully!\n');
    } else {
      alert('Error saving CV: ' + result.error);
    }
  } catch (err) {
    console.error('Error saving CV:', err);
  } finally {
    elements.btnSaveCv.disabled = false;
    elements.btnSaveCv.textContent = 'Save Changes';
  }
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    state.profileRaw = data.raw;
    elements.profileEditorTextarea.value = data.raw;
  } catch (err) {
    console.error('Error fetching profile:', err);
  }
}

async function saveProfile() {
  const raw = elements.profileEditorTextarea.value;
  elements.btnSaveProfile.disabled = true;
  elements.btnSaveProfile.textContent = 'Saving...';
  
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw })
    });
    const result = await res.json();
    if (result.success) {
      logConsoleOutput('System: profile.yml saved successfully!\n');
    } else {
      alert('Error: ' + result.error);
    }
  } catch (err) {
    console.error('Error saving profile:', err);
  } finally {
    elements.btnSaveProfile.disabled = false;
    elements.btnSaveProfile.textContent = 'Save Configuration';
  }
}

// ── RENDERERS ──

// Render Overview Statistics & Top Matches
function renderOverviewStats() {
  elements.statTotalPending.textContent = state.pipeline.pending.length;
  elements.statTotalEval.textContent = state.tracker.length;
  
  const appliedCount = state.tracker.filter(item => {
    const status = item.status.toLowerCase().replace(/\*\*/g, '').trim();
    return ['applied', 'aplicado', 'enviada', 'aplicada', 'sent'].includes(status);
  }).length;
  elements.statTotalApplied.textContent = appliedCount;
  
  // Calculate average score
  let totalScore = 0;
  let scoreCount = 0;
  state.tracker.forEach(item => {
    const match = item.score.match(/^(\d+\.?\d*)\/5/);
    if (match) {
      totalScore += parseFloat(match[1]);
      scoreCount++;
    }
  });
  elements.statAvgScore.textContent = scoreCount > 0 ? (totalScore / scoreCount).toFixed(2) : '0.0';

  // Render Top matches
  elements.topMatchesList.innerHTML = '';
  const topMatches = state.tracker
    .filter(item => {
      const match = item.score.match(/^(\d+\.?\d*)\/5/);
      return match && parseFloat(match[1]) >= 4.0;
    })
    .sort((a, b) => {
      const scoreA = parseFloat(a.score.match(/^(\d+\.?\d*)\/5/)[1]);
      const scoreB = parseFloat(b.score.match(/^(\d+\.?\d*)\/5/)[1]);
      return scoreB - scoreA;
    });

  if (topMatches.length === 0) {
    elements.topMatchesList.innerHTML = `<tr><td colspan="5" class="text-center">No matches with score >= 4.0 found. Run a portal scan!</td></tr>`;
  } else {
    topMatches.forEach(item => {
      const tr = document.createElement('tr');
      const scoreVal = parseFloat(item.score.match(/^(\d+\.?\d*)\/5/)[1]);
      
      tr.innerHTML = `
        <td><strong>${item.company}</strong></td>
        <td>${item.role}</td>
        <td><span class="score-badge high">${item.score}</span></td>
        <td><span class="badge badge-${getBadgeClass(item.status)}">${item.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-small" onclick="viewReport('${item.reportLink}')">📄 View Report</button>
        </td>
      `;
      elements.topMatchesList.appendChild(tr);
    });
  }

  // Render Status Funnel
  const funnelContainers = {
    evaluated: 0,
    applied: 0,
    responded: 0,
    interview: 0,
    offer: 0,
    rejected: 0
  };

  state.tracker.forEach(item => {
    const rawStatus = item.status.toLowerCase().replace(/\*\*/g, '').trim();
    let norm = 'evaluated';
    if (['applied', 'aplicado', 'enviada', 'aplicada', 'sent'].includes(rawStatus)) norm = 'applied';
    else if (['responded', 'respondido'].includes(rawStatus)) norm = 'responded';
    else if (['interview', 'entrevista'].includes(rawStatus)) norm = 'interview';
    else if (['offer', 'oferta'].includes(rawStatus)) norm = 'offer';
    else if (['rejected', 'rechazado', 'rechazada'].includes(rawStatus)) norm = 'rejected';
    
    if (funnelContainers[norm] !== undefined) {
      funnelContainers[norm]++;
    }
  });

  const maxVal = Math.max(...Object.values(funnelContainers), 1);
  elements.funnelStats.innerHTML = '';
  
  const funnelColors = {
    evaluated: 'var(--color-secondary)',
    applied: 'var(--color-primary)',
    responded: 'hsl(200, 75%, 45%)',
    interview: 'var(--color-warning)',
    offer: 'var(--color-success)',
    rejected: 'var(--color-danger)'
  };

  Object.entries(funnelContainers).forEach(([key, count]) => {
    const pct = ((count / maxVal) * 100).toFixed(0);
    const div = document.createElement('div');
    div.className = 'funnel-row';
    div.innerHTML = `
      <span class="funnel-label"><span class="status-dot" style="background-color:${funnelColors[key]}"></span> ${key.charAt(0).toUpperCase() + key.slice(1)}</span>
      <div class="funnel-bar-container">
        <div class="funnel-bar" style="width:${pct}%; background-color:${funnelColors[key]}"></div>
      </div>
      <span class="funnel-count">${count}</span>
    `;
    elements.funnelStats.appendChild(div);
  });
}

// Render Job Tracker Table
function renderTrackerTable() {
  const searchQuery = elements.trackerSearch.value.toLowerCase();
  const statusFilter = elements.trackerFilterStatus.value;
  elements.trackerList.innerHTML = '';

  const filtered = state.tracker.filter(item => {
    const matchesSearch = item.company.toLowerCase().includes(searchQuery) || item.role.toLowerCase().includes(searchQuery);
    
    const rawStatus = item.status.toLowerCase().replace(/\*\*/g, '').trim();
    let normStatus = 'evaluated';
    if (['applied', 'aplicado', 'enviada', 'aplicada', 'sent'].includes(rawStatus)) normStatus = 'applied';
    else if (['responded', 'respondido'].includes(rawStatus)) normStatus = 'responded';
    else if (['interview', 'entrevista'].includes(rawStatus)) normStatus = 'interview';
    else if (['offer', 'oferta'].includes(rawStatus)) normStatus = 'offer';
    else if (['rejected', 'rechazado', 'rechazada'].includes(rawStatus)) normStatus = 'rejected';
    else if (['discarded', 'descartado', 'descartada'].includes(rawStatus)) normStatus = 'discarded';
    else if (['skip', 'no aplicar'].includes(rawStatus)) normStatus = 'skip';

    const matchesStatus = statusFilter === 'all' || normStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    elements.trackerList.innerHTML = `<tr><td colspan="9" class="text-center">No applications found matching the criteria.</td></tr>`;
    return;
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    
    // Score styling
    const scoreMatch = item.score.match(/^(\d+\.?\d*)\/5/);
    let scoreClass = 'low';
    if (scoreMatch) {
      const scoreVal = parseFloat(scoreMatch[1]);
      if (scoreVal >= 4.0) scoreClass = 'high';
      else if (scoreVal >= 3.0) scoreClass = 'medium';
    }
    
    // PDF symbol
    const pdfIcon = item.pdf.includes('✅') ? '📄 PDF' : '❌';
    const pdfBtn = item.pdf.includes('✅') 
      ? `<button class="btn btn-secondary btn-small" onclick="downloadPdf('cv-candidate-${item.company.toLowerCase().replace(/\s+/g, '-')}-${item.date}.pdf')">📥 PDF</button>` 
      : `❌`;

    tr.innerHTML = `
      <td>${item.id}</td>
      <td style="white-space: nowrap">${item.date}</td>
      <td><strong>${item.company}</strong></td>
      <td>${item.role}</td>
      <td><span class="score-badge ${scoreClass}">${item.score}</span></td>
      <td>
        <select class="form-select form-select-small" style="min-width:120px" onchange="updateApplicationStatus('${item.id}', this.value)">
          <option value="Evaluada" ${item.status === 'Evaluada' ? 'selected' : ''}>Evaluada</option>
          <option value="Applied" ${item.status === 'Applied' || item.status === 'Aplicado' ? 'selected' : ''}>Applied</option>
          <option value="Responded" ${item.status === 'Responded' || item.status === 'Respondido' ? 'selected' : ''}>Responded</option>
          <option value="Interview" ${item.status === 'Interview' || item.status === 'Entrevista' ? 'selected' : ''}>Interview</option>
          <option value="Offer" ${item.status === 'Offer' || item.status === 'Oferta' ? 'selected' : ''}>Offer</option>
          <option value="Rejected" ${item.status === 'Rejected' || item.status === 'Rechazado' ? 'selected' : ''}>Rejected</option>
          <option value="Discarded" ${item.status === 'Discarded' || item.status === 'Descartado' ? 'selected' : ''}>Discarded</option>
          <option value="Skip" ${item.status === 'Skip' || item.status === 'No aplicar' ? 'selected' : ''}>Skip</option>
        </select>
      </td>
      <td>${pdfBtn}</td>
      <td>
        <button class="btn btn-secondary btn-small" onclick="viewReport('${item.reportLink}')">📄 View Report</button>
      </td>
      <td>
        <input type="text" class="form-input form-input-small" value="${escapeHtml(item.notes)}" onchange="updateApplicationNotes('${item.id}', this.value)" placeholder="Add notes...">
      </td>
    `;
    elements.trackerList.appendChild(tr);
  });
}

// Render Pipeline Pending and Processed Tables
function renderPipelineTables() {
  // 1. Pending table
  elements.pipelinePendingList.innerHTML = '';
  if (state.pipeline.pending.length === 0) {
    elements.pipelinePendingList.innerHTML = `<tr><td colspan="4" class="text-center">Your pipeline inbox is empty! Run a portal scan to find postings.</td></tr>`;
  } else {
    state.pipeline.pending.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.company}</strong></td>
        <td>${item.role}</td>
        <td><a href="${item.url}" target="_blank" class="job-link">${item.url.substring(0, 50)}... 🔗</a></td>
        <td>
          <button class="btn btn-primary btn-small" onclick="evaluatePipelineUrl('${item.url}')">⚙️ Evaluate</button>
        </td>
      `;
      elements.pipelinePendingList.appendChild(tr);
    });
  }

  // 2. Processed table
  elements.pipelineProcessedList.innerHTML = '';
  if (state.pipeline.processed.length === 0) {
    elements.pipelineProcessedList.innerHTML = `<tr><td colspan="6" class="text-center">No processed listings found.</td></tr>`;
  } else {
    state.pipeline.processed.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.id}</td>
        <td><strong>${item.company}</strong></td>
        <td>${item.role}</td>
        <td><span class="score-badge">${item.score}</span></td>
        <td>${item.pdf}</td>
        <td><a href="${item.url}" target="_blank" class="job-link">View Original 🔗</a></td>
      `;
      elements.pipelineProcessedList.appendChild(tr);
    });
  }
}

// Helper to match status class
function getBadgeClass(status) {
  const norm = status.toLowerCase().replace(/\*\*/g, '').trim();
  if (['applied', 'aplicado', 'enviada', 'aplicada', 'sent'].includes(norm)) return 'applied';
  if (['responded', 'respondido'].includes(norm)) return 'responded';
  if (['interview', 'entrevista'].includes(norm)) return 'interview';
  if (['offer', 'oferta'].includes(norm)) return 'offer';
  if (['rejected', 'rechazado', 'rechazada'].includes(norm)) return 'rejected';
  if (['discarded', 'descartado', 'descartada'].includes(norm)) return 'discarded';
  if (['skip', 'no aplicar'].includes(norm)) return 'skip';
  return 'evaluated';
}

// ── TASK TRIGGERS (STREAMING SSE LOGS) ──

// Trigger Portal Scanner
function triggerPortalScan() {
  elements.consolePanel.classList.remove('minimized');
  elements.consoleOutput.innerHTML = '';
  updateConsoleStatus('running');
  
  logConsoleOutput('Starting background portal scan...\n');
  
  const eventSource = new EventSource('/api/scan/stream');
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'stdout') {
      logConsoleOutput(data.text);
    } else if (data.type === 'stderr') {
      logConsoleOutput('[ERROR] ' + data.text, 'red');
    } else if (data.type === 'close') {
      eventSource.close();
      updateConsoleStatus('success');
      logConsoleOutput(`Scan process completed with code ${data.code}.\n`);
      loadAllData(); // Reload results
    }
  };
  
  eventSource.onerror = (err) => {
    eventSource.close();
    updateConsoleStatus('error');
    logConsoleOutput('[CONNECTION ERROR] Failed to connect to server streaming API.\n', 'red');
  };
}

// Trigger Single Job Evaluation
function evaluatePipelineUrl(url) {
  elements.consolePanel.classList.remove('minimized');
  elements.consoleOutput.innerHTML = '';
  updateConsoleStatus('running');
  
  logConsoleOutput(`Starting background evaluation for URL: ${url}...\n`);
  
  const eventSource = new EventSource(`/api/evaluate/stream?url=${encodeURIComponent(url)}`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'stdout') {
      logConsoleOutput(data.text);
    } else if (data.type === 'stderr') {
      logConsoleOutput('[ERROR] ' + data.text, 'red');
    } else if (data.type === 'close') {
      eventSource.close();
      updateConsoleStatus('success');
      logConsoleOutput(`Evaluation completed with code ${data.code}.\n`);
      loadAllData(); // Reload tracker & overview
    }
  };
  
  eventSource.onerror = (err) => {
    eventSource.close();
    updateConsoleStatus('error');
    logConsoleOutput('[CONNECTION ERROR] Failed to connect to server streaming API.\n', 'red');
  };
}

// Handle Custom Evaluation Submission (URL or text)
async function handleCustomEvaluation() {
  const url = elements.evalUrlInput.value.trim();
  const text = elements.evalTextInput.value.trim();
  
  if (!url && !text) {
    alert('Please enter a URL or paste the job description text.');
    return;
  }
  
  elements.modalEvalCustom.classList.remove('active');
  
  if (url) {
    // If it's a URL, evaluate via stream
    evaluatePipelineUrl(url);
  } else {
    // If it's raw text, we write it to a temporary file first and evaluate it
    elements.consolePanel.classList.remove('minimized');
    elements.consoleOutput.innerHTML = '';
    updateConsoleStatus('running');
    logConsoleOutput('Saving custom text for evaluation on the server...\n');
    
    try {
      const fileRes = await fetch('/api/jd/temp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const fileResult = await fileRes.json();
      if (fileResult.success) {
        logConsoleOutput('Custom text saved! Starting evaluation...\n');
        evaluatePipelineUrl('--file jds/temp-eval.txt');
      } else {
        logConsoleOutput('[ERROR] Failed to save custom text on the server: ' + fileResult.error + '\n', 'red');
        updateConsoleStatus('error');
      }
    } catch (err) {
      console.error(err);
      logConsoleOutput('[ERROR] Exception occurred saving custom text.\n', 'red');
      updateConsoleStatus('error');
    }
  }
}

// ── TRACKER IN-LINE UPDATES ──
async function updateApplicationStatus(id, newStatus) {
  try {
    const res = await fetch('/api/tracker/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus })
    });
    const result = await res.json();
    if (result.success) {
      logConsoleOutput(`Tracker: Application #${id} status updated to "${newStatus}"\n`);
      loadAllData();
    } else {
      alert('Failed to update status: ' + result.error);
    }
  } catch (err) {
    console.error('Error updating status:', err);
  }
}

async function updateApplicationNotes(id, newNotes) {
  try {
    const res = await fetch('/api/tracker/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes: newNotes })
    });
    const result = await res.json();
    if (result.success) {
      logConsoleOutput(`Tracker: Application #${id} notes updated.\n`);
    } else {
      console.error('Failed to update notes: ' + result.error);
    }
  } catch (err) {
    console.error('Error updating notes:', err);
  }
}

// ── REPORT VIEWER ──
async function viewReport(reportLink) {
  if (!reportLink) {
    alert('Report link not found.');
    return;
  }
  // Extract filename. reportLink is relative e.g., "../reports/001-unknown-2026-06-06.md"
  const filename = reportLink.substring(reportLink.lastIndexOf('/') + 1);
  
  elements.reportViewerTitle.textContent = `Report: ${filename.replace('.md', '')}`;
  elements.reportViewerContent.innerHTML = 'Loading report...';
  elements.modalReportViewer.classList.add('active');
  
  try {
    const res = await fetch(`/api/reports/${filename}`);
    const data = await res.json();
    if (data.content) {
      // Parse markdown to HTML using marked.js
      elements.reportViewerContent.innerHTML = marked.parse(data.content);
    } else {
      elements.reportViewerContent.innerHTML = `Error: ${data.error}`;
    }
  } catch (err) {
    elements.reportViewerContent.innerHTML = 'Failed to load report.';
    console.error('Error loading report:', err);
  }
}

// Download PDF
function downloadPdf(pdfName) {
  window.open(`/api/pdf/${pdfName}`, '_blank');
}

// ── CONSOLE LOGGING HELPERS ──
function logConsoleOutput(text, color = '') {
  const span = document.createElement('span');
  if (color) span.style.color = color;
  span.textContent = text;
  elements.consoleOutput.appendChild(span);
  elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
}

function updateConsoleStatus(status) {
  elements.consoleStatusDot.className = `pulse-dot ${status}`;
}

// HTML Escaper helper
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

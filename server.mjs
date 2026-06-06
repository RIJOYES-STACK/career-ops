import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname);
const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(projectRoot, 'public')));

const APPS_FILE = join(projectRoot, 'data', 'applications.md');
const PIPELINE_FILE = join(projectRoot, 'data', 'pipeline.md');
const CV_FILE = join(projectRoot, 'cv.md');
const PROFILE_FILE = join(projectRoot, 'config', 'profile.yml');
const REPORTS_DIR = join(projectRoot, 'reports');

// Helper to ensure files exist
function initFile(filePath, defaultContent = '') {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    // Should already be created by doctor, but double safe
    mkdirSync(dir, { recursive: true });
  }
  if (!existsSync(filePath)) {
    writeFileSync(filePath, defaultContent, 'utf-8');
  }
}

// Ensure files are present
if (!existsSync(join(projectRoot, 'data'))) {
  const fs = await import('fs');
  fs.mkdirSync(join(projectRoot, 'data'), { recursive: true });
}
if (!existsSync(APPS_FILE)) {
  writeFileSync(APPS_FILE, '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|------|---------|------|-------|--------|-----|--------|-------|\n', 'utf-8');
}
if (!existsSync(PIPELINE_FILE)) {
  writeFileSync(PIPELINE_FILE, '## Pending\n\n## Processed\n', 'utf-8');
}

// ── GET /api/tracker ──────────────────────────────────────────────────────────
app.get('/api/tracker', (req, res) => {
  try {
    if (!existsSync(APPS_FILE)) {
      return res.json([]);
    }
    const content = readFileSync(APPS_FILE, 'utf-8');
    const lines = content.split('\n');
    const entries = [];

    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 10) continue;
      // Skip header and separator lines
      if (parts[1] === '#' || parts[1].includes('---')) continue;
      
      const num = parts[1];
      if (!num) continue;

      // Extract report link if it is a markdown link [001](../reports/...)
      let reportName = parts[8];
      let reportLink = '';
      const reportMatch = parts[8].match(/\[(.*?)\]\((.*?)\)/);
      if (reportMatch) {
        reportName = reportMatch[1];
        reportLink = reportMatch[2];
      }

      entries.push({
        id: num,
        date: parts[2],
        company: parts[3],
        role: parts[4],
        score: parts[5],
        status: parts[6],
        pdf: parts[7],
        report: reportName,
        reportLink: reportLink,
        notes: parts[9] || ''
      });
    }
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── POST /api/tracker/update ──────────────────────────────────────────────────
app.post('/api/tracker/update', (req, res) => {
  const { id, status, notes } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' });
  }

  try {
    const content = readFileSync(APPS_FILE, 'utf-8');
    const lines = content.split('\n');
    let updated = false;

    const newLines = lines.map(line => {
      if (!line.startsWith('|')) return line;
      const parts = line.split('|').map(s => s.trim());
      if (parts.length < 10) return line;
      if (parts[1] === id) {
        updated = true;
        // Keep everything else, update status and notes
        if (status !== undefined) parts[6] = status;
        if (notes !== undefined) parts[9] = notes;
        return `| ${parts.slice(1, -1).join(' | ')} |`;
      }
      return line;
    });

    if (!updated) {
      return res.status(404).json({ error: `Application #${id} not found` });
    }

    writeFileSync(APPS_FILE, newLines.join('\n'), 'utf-8');
    res.json({ success: true, message: `Application #${id} updated successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/pipeline ─────────────────────────────────────────────────────────
app.get('/api/pipeline', (req, res) => {
  try {
    if (!existsSync(PIPELINE_FILE)) {
      return res.json({ pending: [], processed: [] });
    }
    const content = readFileSync(PIPELINE_FILE, 'utf-8');
    const lines = content.split('\n');
    
    const pending = [];
    const processed = [];
    
    let currentSection = ''; // 'pending' or 'processed'

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('##')) {
        const title = trimmed.toLowerCase();
        if (title.includes('pending') || title.includes('pendientes') || title.includes('очікуючі') || title.includes('bekleyenler') || title.includes('未処理')) {
          currentSection = 'pending';
        } else if (title.includes('processed') || title.includes('procesadas') || title.includes('опрацьовані') || title.includes('tamamlanan') || title.includes('処理済')) {
          currentSection = 'processed';
        }
        continue;
      }

      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [!]')) {
        const isError = trimmed.startsWith('- [!]');
        const text = trimmed.slice(5).trim();
        const parts = text.split('|').map(s => s.trim());
        
        pending.push({
          url: parts[0] || '',
          company: parts[1] || 'Unknown',
          role: parts[2] || 'Unknown',
          isError,
          rawLine: trimmed
        });
      } else if (trimmed.startsWith('- [x]')) {
        const text = trimmed.slice(5).trim();
        const parts = text.split('|').map(s => s.trim());
        
        processed.push({
          id: parts[0] || '',
          url: parts[1] || '',
          company: parts[2] || 'Unknown',
          role: parts[3] || 'Unknown',
          score: parts[4] || '',
          pdf: parts[5] || '',
          rawLine: trimmed
        });
      }
    }

    res.json({ pending, processed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET/POST /api/cv ──────────────────────────────────────────────────────────
app.get('/api/cv', (req, res) => {
  try {
    if (!existsSync(CV_FILE)) {
      return res.status(404).json({ error: 'cv.md not found' });
    }
    const content = readFileSync(CV_FILE, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cv', (req, res) => {
  const { content } = req.body;
  if (content === undefined) {
    return res.status(400).json({ error: 'Missing content parameter' });
  }
  try {
    writeFileSync(CV_FILE, content, 'utf-8');
    res.json({ success: true, message: 'cv.md saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET/POST /api/profile ─────────────────────────────────────────────────────
app.get('/api/profile', (req, res) => {
  try {
    if (!existsSync(PROFILE_FILE)) {
      return res.status(404).json({ error: 'profile.yml not found' });
    }
    const content = readFileSync(PROFILE_FILE, 'utf-8');
    const parsed = yaml.load(content);
    res.json({ raw: content, parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profile', (req, res) => {
  const { raw } = req.body;
  if (raw === undefined) {
    return res.status(400).json({ error: 'Missing raw yml content' });
  }
  try {
    // Validate it is correct YAML first
    yaml.load(raw);
    writeFileSync(PROFILE_FILE, raw, 'utf-8');
    res.json({ success: true, message: 'profile.yml saved successfully' });
  } catch (error) {
    res.status(400).json({ error: 'Invalid YAML format: ' + error.message });
  }
});

// ── POST /api/jd/temp ─────────────────────────────────────────────────────────
app.post('/api/jd/temp', (req, res) => {
  const { text } = req.body;
  if (text === undefined) {
    return res.status(400).json({ error: 'Missing text parameter' });
  }
  try {
    const jdsDir = join(projectRoot, 'jds');
    if (!existsSync(jdsDir)) {
      mkdirSync(jdsDir, { recursive: true });
    }
    writeFileSync(join(jdsDir, 'temp-eval.txt'), text, 'utf-8');
    res.json({ success: true, message: 'Custom JD saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/reports/:filename ─────────────────────────────────────────────────
app.get('/api/reports/:filename', (req, res) => {
  const filename = req.params.filename;
  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const reportPath = join(REPORTS_DIR, filename);
  try {
    if (!existsSync(reportPath)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const content = readFileSync(reportPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET /api/pdf/:filename ─────────────────────────────────────────────────────
app.get('/api/pdf/:filename', (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const pdfPath = join(projectRoot, 'output', filename);
  try {
    if (!existsSync(pdfPath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    res.sendFile(pdfPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── SSE: GET /api/evaluate/stream ─────────────────────────────────────────────
app.get('/api/evaluate/stream', (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).write('data: {"type": "error", "text": "Missing url parameter"}\n\n');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'stdout', text: `Starting evaluation for: ${url}\n` })}\n\n`);

  const child = spawn('node', ['gemini-eval.mjs', url], { cwd: projectRoot });

  child.stdout.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stdout', text: data.toString() })}\n\n`);
  });

  child.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stderr', text: data.toString() })}\n\n`);
  });

  child.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
    res.end();
  });
});

// ── SSE: GET /api/scan/stream ─────────────────────────────────────────────────
app.get('/api/scan/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'stdout', text: `Starting portal scan...\n` })}\n\n`);

  const child = spawn('npm', ['run', 'scan'], { cwd: projectRoot, shell: true });

  child.stdout.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stdout', text: data.toString() })}\n\n`);
  });

  child.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({ type: 'stderr', text: data.toString() })}\n\n`);
  });

  child.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
    res.end();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Web Dashboard Server running locally at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 Share on Wi-Fi using your local network IP (e.g. http://192.168.x.x:${PORT})`);
});

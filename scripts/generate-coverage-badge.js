#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readSummary() {
  const p = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return j?.total?.lines?.pct ?? null;
  } catch {
    return null;
  }
}

function color(pct) {
  if (pct >= 90) return '#2ecc71';
  if (pct >= 70) return '#ffb000';
  return '#e74c3c';
}

function svg(pct) {
  const pctText = `${pct.toFixed(0)}%`;
  const leftText = 'coverage';
  // simple fixed-size badge
  const leftWidth = 72; // approx for text
  const rightWidth = 56; // approx for text
  const total = leftWidth + rightWidth;
  const c = color(pct);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="coverage: ${pctText}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <rect rx="3" width="${total}" height="20" fill="#555"/>
  <rect rx="3" x="${leftWidth}" width="${rightWidth}" height="20" fill="${c}"/>
  <rect rx="3" width="${total}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftWidth/2}" y="15">${leftText}</text>
    <text x="${leftWidth + rightWidth/2}" y="15">${pctText}</text>
  </g>
  </svg>`;
}

function main() {
  const pct = readSummary();
  const outDir = path.join(process.cwd(), 'badges');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'coverage.svg');
  if (pct == null) {
    fs.writeFileSync(outFile, svg(0));
    console.log('Wrote placeholder badge: 0%');
  } else {
    fs.writeFileSync(outFile, svg(pct));
    console.log(`Wrote coverage badge: ${pct.toFixed(0)}%`);
  }
}

main();


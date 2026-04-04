/**
 * IC Deal Review Deck — Section Renderer
 *
 * Renders IC Deck template sections to HTML for preview and PDF generation.
 * Handles all block types: heading, text, bullet_list, metric_grid, table, chart, image.
 * Table tokens (JSON objects/arrays) are rendered as structured HTML tables.
 * Charts are rendered as data tables in v1 (native charts deferred to PPTX/v2).
 */

import { formatTokenValue } from '@shared/document-builder/format-helpers';
import type { ResolvedTokenEntry } from '@shared/document-builder/format-helpers';

type ResolvedTokenMap = Record<string, string | number | null | object>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveTokenInText(
  text: string,
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>
): string {
  return text.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (match, tokenName) => {
    const entry = formatted[tokenName];
    if (entry && entry.isResolved) {
      return `<span class="token-value" data-token="${tokenName}">${escapeHtml(entry.formatted)}</span>`;
    }
    const raw = resolved[tokenName];
    if (raw !== null && raw !== undefined && typeof raw !== 'object') {
      return `<span class="token-value" data-token="${tokenName}">${escapeHtml(String(raw))}</span>`;
    }
    return `<span class="token-unresolved">{{${tokenName}}}</span>`;
  });
}

function getTokenValue(tokenName: string, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const entry = formatted[tokenName];
  if (entry && entry.isResolved) return entry.formatted;
  const raw = resolved[tokenName];
  if (raw !== null && raw !== undefined && typeof raw !== 'object') return String(raw);
  return `{{${tokenName}}}`;
}

function getTokenRaw(tokenName: string, resolved: ResolvedTokenMap): any {
  return resolved[tokenName] ?? null;
}

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function fmtPercent(val: number | null): string {
  if (val === null || val === undefined) return '—';
  const pct = val > 1 ? val : val * 100;
  return `${pct.toFixed(1)}%`;
}

function fmtNumber(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(val);
}

// ─── Block Renderers ────────────────────────────────────────────────────────

function renderHeading(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const level = block.config?.level || 1;
  const text = resolveTokenInText(block.config?.text || '', resolved, formatted);
  return `<h${level}>${text}</h${level}>`;
}

function renderText(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const token = block.config?.token;
  let text = '';
  if (token) {
    const raw = getTokenRaw(token, resolved);
    text = raw !== null ? String(raw) : `{{${token}}}`;
  } else {
    text = block.config?.text || '';
  }
  text = resolveTokenInText(text, resolved, formatted);
  const style = block.config?.bold ? 'font-weight: 700;' : '';
  return `<p style="${style}">${text}</p>`;
}

function renderBulletList(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const token = block.config?.token;
  let bullets: string[] = [];
  if (token) {
    const raw = getTokenRaw(token, resolved);
    if (Array.isArray(raw)) {
      bullets = raw.map(b => typeof b === 'string' ? b : JSON.stringify(b));
    } else if (typeof raw === 'string') {
      bullets = raw.split('\n').filter(Boolean);
    }
  }
  if (bullets.length === 0) {
    return `<p class="token-unresolved">{{${token || 'BULLETS'}}}</p>`;
  }
  return `<ul>${bullets.map(b => `<li>${resolveTokenInText(b, resolved, formatted)}</li>`).join('')}</ul>`;
}

function renderMetricGrid(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const title = config.title ? resolveTokenInText(config.title, resolved, formatted) : '';
  const metrics = config.metrics || [];

  let html = title ? `<h2>${title}</h2>` : '';
  html += '<div class="metric-grid">';

  for (const m of metrics) {
    let value = '';
    if (m.tokens && Array.isArray(m.tokens)) {
      // Pair display (e.g., IRR Gross / Net)
      const vals = m.tokens.map((t: string) => getTokenValue(t, resolved, formatted));
      value = vals.join(' / ');
    } else if (m.token) {
      value = getTokenValue(m.token, resolved, formatted);
    }
    html += `<div class="metric-item">
      <div class="metric-label">${escapeHtml(m.label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
    </div>`;
  }

  html += '</div>';
  return html;
}

function renderTable(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const style = config.style || 'generic';
  const title = config.title ? resolveTokenInText(config.title, resolved, formatted) : '';
  const token = config.token;

  let html = title ? `<h2 style="font-size: 14px; color: #1B365D; margin: 16px 0 8px;">${title}</h2>` : '';

  // Key-value tables (term sheet, ground leases, etc.)
  if (style === 'key_value' || style === 'term_sheet') {
    const rows = config.rows || [];
    html += '<table>';
    if (config.headerRow) {
      html += '<tr>';
      for (const h of config.headerRow) {
        const val = resolveTokenInText(h.label || '', resolved, formatted);
        html += `<th colspan="2">${val}</th>`;
      }
      html += '</tr>';
    }
    for (const row of rows) {
      const value = row.token ? getTokenValue(row.token, resolved, formatted) : '';
      const labelStyle = row.bold ? 'font-weight: 700;' : '';
      const valStyle = row.italic ? 'font-style: italic;' : '';
      html += `<tr><td style="${labelStyle}">${escapeHtml(row.label)}</td><td style="${valStyle}">${escapeHtml(value)}</td></tr>`;
    }
    html += '</table>';
    return html;
  }

  // Data-driven tables from token JSON
  if (token) {
    const data = getTokenRaw(token, resolved);

    if (style === 'sources_uses' && data && typeof data === 'object' && !Array.isArray(data)) {
      const su = data as any;
      html += '<div style="display: flex; gap: 24px;">';
      // Uses
      html += '<div style="flex: 1;"><table><tr><th colspan="2">Uses</th></tr>';
      for (const row of (su.uses || [])) {
        const fw = row.isTotal ? 'font-weight: 700; border-top: 2px solid #1B365D;' : '';
        html += `<tr><td style="${fw}">${escapeHtml(row.label)}</td><td style="${fw} text-align: right;">${fmtCurrency(row.amount)}</td></tr>`;
      }
      html += '</table></div>';
      // Sources
      html += '<div style="flex: 1;"><table><tr><th colspan="2">Sources</th></tr>';
      for (const row of (su.sources || [])) {
        const fw = row.isTotal ? 'font-weight: 700; border-top: 2px solid #1B365D;' : '';
        html += `<tr><td style="${fw}">${escapeHtml(row.label)}</td><td style="${fw} text-align: right;">${fmtCurrency(row.amount)}</td></tr>`;
      }
      html += '</table></div></div>';
      return html;
    }

    if (style === 'sensitivity' && Array.isArray(data)) {
      const columns = config.columns || ['Scenario', 'CAGR', 'IRR (Gross)'];
      html += '<table>';
      html += '<tr>' + columns.map((c: string) => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';
      for (const row of data) {
        const cls = (row as any).isBaseCase ? ' class="base-case"' : '';
        html += `<tr${cls}>`;
        html += `<td>${escapeHtml(String((row as any).scenario || ''))}</td>`;
        html += `<td>${fmtPercent((row as any).cagr)}</td>`;
        html += `<td>${(row as any).irrGross !== null ? fmtPercent((row as any).irrGross) : '—'}</td>`;
        html += '</tr>';
      }
      html += '</table>';
      return html;
    }

    if (Array.isArray(data) && data.length > 0) {
      // Generic data table from array of objects
      const columns = config.columns || Object.keys(data[0]);
      const keys = Object.keys(data[0]);
      html += '<table>';
      html += '<tr>' + columns.map((c: string) => `<th>${escapeHtml(c)}</th>`).join('') + '</tr>';
      for (const row of data) {
        html += '<tr>';
        for (const key of keys) {
          const val = (row as any)[key];
          const display = typeof val === 'number'
            ? (Math.abs(val) >= 1000 ? fmtCurrency(val) : fmtNumber(val))
            : String(val ?? '—');
          html += `<td>${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';
      return html;
    }

    // Unresolved table token
    html += `<p class="token-unresolved">{{${token}}}</p>`;
    return html;
  }

  return html;
}

function renderChart(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const title = config.title || 'Chart';
  const token = config.token;

  let html = `<h2 style="font-size: 14px; color: #1B365D; margin: 16px 0 8px;">${escapeHtml(title)}</h2>`;

  // v1: Render charts as data tables
  if (token) {
    const data = getTokenRaw(token, resolved);
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      html += '<table>';
      html += '<tr>' + keys.map(k => `<th>${escapeHtml(k)}</th>`).join('') + '</tr>';
      for (const row of data) {
        html += '<tr>';
        for (const key of keys) {
          const val = (row as any)[key];
          const display = typeof val === 'number' ? fmtNumber(val) : String(val ?? '—');
          html += `<td>${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }
      html += '</table>';
    } else {
      html += `<p class="token-unresolved">Chart data: {{${token}}}</p>`;
    }
  } else {
    html += '<p style="color: #999; font-style: italic;">Chart placeholder — no data token bound</p>';
  }

  return html;
}

function renderImage(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};

  // Gallery layout — 3-photo grid (1 large left, 2 stacked right)
  if (config.layout === 'gallery_3up' && config.images) {
    const gap = config.gap || 12;
    const radius = config.borderRadius || 4;
    const images = config.images.map((img: any) => {
      const raw = getTokenRaw(img.token, resolved);
      return { ...img, url: raw && typeof raw === 'string' ? raw : null };
    });

    const renderImg = (img: any, style: string) => {
      if (img.url) {
        return `<img src="${escapeHtml(img.url)}" style="${style} object-fit: cover; border-radius: ${radius}px;" alt="Property photo" />`;
      }
      return `<div style="${style} background: #E5E7EB; border-radius: ${radius}px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">Photo</div>`;
    };

    return `<div style="display: flex; gap: ${gap}px; margin: 16px 0; height: 420px;">
      <div style="flex: 0 0 60%;">${renderImg(images[0] || {}, 'width: 100%; height: 100%;')}</div>
      <div style="flex: 1; display: flex; flex-direction: column; gap: ${gap}px;">
        <div style="flex: 1;">${renderImg(images[1] || {}, 'width: 100%; height: 100%;')}</div>
        <div style="flex: 1;">${renderImg(images[2] || {}, 'width: 100%; height: 100%;')}</div>
      </div>
    </div>`;
  }

  // Single image
  const token = config.token;
  let url: string | null = null;

  if (token) {
    const raw = getTokenRaw(token, resolved);
    if (raw && typeof raw === 'string') url = raw;
  }

  if (url) {
    const caption = config.caption ? `<p style="font-size: 10px; color: #666; text-align: center;">${escapeHtml(config.caption)}</p>` : '';
    return `<div style="text-align: center; margin: 16px 0;">
      <img src="${escapeHtml(url)}" style="max-width: 100%; max-height: 400px; border-radius: 4px;" alt="${escapeHtml(config.caption || 'Image')}" />
      ${caption}
    </div>`;
  }

  // Placeholder
  const label = token || 'IMAGE';
  return `<div style="background: #E5E7EB; border-radius: 4px; padding: 40px; text-align: center; color: #666; margin: 16px 0;">
    <p style="font-size: 13px;">Image placeholder: {{${label}}}</p>
  </div>`;
}

// ─── Section Renderer ───────────────────────────────────────────────────────

function renderBlock(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  switch (block.type) {
    case 'heading': return renderHeading(block, resolved, formatted);
    case 'text': return renderText(block, resolved, formatted);
    case 'bullet_list': return renderBulletList(block, resolved, formatted);
    case 'metric_grid': return renderMetricGrid(block, resolved, formatted);
    case 'table': return renderTable(block, resolved, formatted);
    case 'chart': return renderChart(block, resolved, formatted);
    case 'image': return renderImage(block, resolved, formatted);
    default: return `<!-- unknown block type: ${block.type} -->`;
  }
}

/**
 * Render a single IC Deck template section to HTML.
 */
export function renderICDeckToHtml(
  section: any,
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>
): string {
  const isCover = section.key === 'ic_cover';
  const slideClass = isCover ? 'slide cover-slide' : 'slide';

  let html = `<div class="${slideClass}" data-section="${escapeHtml(section.key)}">`;

  for (const block of (section.blocks || [])) {
    html += renderBlock(block, resolved, formatted);
  }

  html += `<div class="section-footer">PROPRIETARY AND CONFIDENTIAL</div>`;
  html += '</div>';
  return html;
}

/**
 * Offering Memorandum — Section Renderer
 *
 * Renders OM template sections to HTML for preview and PDF generation.
 * Portrait layout (8.5" x 11") with warm cream/gold/navy brand identity.
 * Handles all block types: divider, heading, text, image, metric_grid, table, chart, bullet_list.
 * Table tokens (JSON objects) are rendered as styled HTML tables.
 * Charts rendered as data tables in v1 (native charts deferred to v2).
 */

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

function isTokenResolved(tokenName: string, resolved: ResolvedTokenMap): boolean {
  const val = resolved[tokenName];
  return val !== null && val !== undefined;
}

// ─── Section Divider ────────────────────────────────────────────────────────

function renderSectionDivider(block: any): string {
  const num = block.config?.sectionNumber || '';
  const title = block.config?.sectionTitle || '';
  return `<div class="section-divider">
    <div class="divider-content">
      <div class="section-number">${escapeHtml(String(num))}</div>
      <div class="section-title">${escapeHtml(title)}</div>
    </div>
    <div class="wave-motif">
      <svg viewBox="0 0 800 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,30 C200,60 400,0 600,30 C700,45 800,15 800,30 L800,60 L0,60 Z" fill="#B8976A" opacity="0.15"/>
        <path d="M0,40 C150,55 350,10 550,40 C650,50 800,25 800,40 L800,60 L0,60 Z" fill="#1B365D" opacity="0.08"/>
      </svg>
    </div>
  </div>`;
}

// ─── Heading ────────────────────────────────────────────────────────────────

function renderHeading(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const level = block.config?.level || 2;
  const text = resolveTokenInText(block.config?.text || '', resolved, formatted);
  const color = block.config?.color || '#B8976A';
  return `<h${level} style="color: ${color}; font-family: 'Playfair Display', Georgia, serif;">${text}</h${level}>`;
}

// ─── Text ───────────────────────────────────────────────────────────────────

function renderText(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const token = block.config?.token;
  const style = block.config?.style;
  let text = '';

  if (token) {
    const raw = getTokenRaw(token, resolved);
    text = raw !== null ? String(raw) : `{{${token}}}`;
  } else {
    text = block.config?.text || '';
  }
  text = resolveTokenInText(text, resolved, formatted);

  let cssClass = 'om-text';
  let inlineStyle = '';
  if (style === 'disclaimer') {
    cssClass = 'om-disclaimer';
    inlineStyle = 'font-size: 8px; font-style: italic; color: #999;';
  } else if (style === 'footnotes') {
    cssClass = 'om-footnotes';
    inlineStyle = 'font-size: 9px; color: #666;';
  }
  if (block.config?.italic) inlineStyle += ' font-style: italic;';
  if (block.config?.size) inlineStyle += ` font-size: ${block.config.size};`;

  return `<p class="${cssClass}" style="${inlineStyle}">${text}</p>`;
}

// ─── Image ──────────────────────────────────────────────────────────────────

function renderImage(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const token = block.config?.token;
  const layout = block.config?.layout;
  let url: string | null = null;

  if (token) {
    const raw = getTokenRaw(token, resolved);
    if (raw && typeof raw === 'string') url = raw;
  }

  if (url) {
    const caption = block.config?.caption
      ? `<p class="om-caption">${escapeHtml(block.config.caption)}</p>`
      : '';
    if (layout === 'collage_3') {
      return `<div class="om-hero-collage">
        <img src="${escapeHtml(url)}" class="om-hero-img" alt="Property Hero" />
        ${caption}
      </div>`;
    }
    return `<div class="om-image">
      <img src="${escapeHtml(url)}" style="max-width: 100%; border-radius: 4px;" alt="${escapeHtml(block.config?.caption || 'Image')}" />
      ${caption}
    </div>`;
  }

  // Placeholder
  const label = block.config?.caption || token || 'IMAGE';
  return `<div class="om-image-placeholder">
    <span>Upload ${escapeHtml(label)}</span>
  </div>`;
}

// ─── Metric Grid ────────────────────────────────────────────────────────────

function renderMetricGrid(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const style = config.style || 'default';
  const title = config.title ? resolveTokenInText(config.title, resolved, formatted) : '';
  const columns = config.columns || 2;

  // Token-driven grids (highlights, opportunities, tourism facts, broker team)
  if (config.token) {
    const raw = getTokenRaw(config.token, resolved);

    if (style === 'om_highlights_4grid') {
      return renderHighlights4Grid(raw, config, resolved, formatted);
    }
    if (style === 'om_stat_callouts') {
      return renderStatCallouts(raw);
    }
    if (style === 'om_broker_cards') {
      return renderBrokerCards(raw, config);
    }
    if (style === 'om_opportunity_cards') {
      return renderOpportunityCards(raw);
    }

    // Generic array grid
    if (Array.isArray(raw)) {
      let html = title ? `<h3 class="om-subheading">${title}</h3>` : '';
      html += `<div class="om-metric-grid" style="grid-template-columns: repeat(${columns}, 1fr);">`;
      for (const item of raw) {
        if (typeof item === 'object' && item !== null) {
          const label = (item as any).label || (item as any).title || '';
          const value = (item as any).value || (item as any).stat || '';
          html += `<div class="om-metric-item"><div class="om-metric-label">${escapeHtml(label)}</div><div class="om-metric-value">${escapeHtml(String(value))}</div></div>`;
        }
      }
      html += '</div>';
      return html;
    }

    if (!raw) {
      return `<p class="token-unresolved">{{${config.token}}}</p>`;
    }
  }

  // Static metrics array (offering terms, offering summary)
  if (config.metrics) {
    if (style === 'om_offering_terms') {
      return renderOfferingTerms(config, resolved, formatted);
    }
    if (style === 'om_offering_summary') {
      return renderOfferingSummary(config, resolved, formatted);
    }
    if (style === 'om_demographics_3ring') {
      return renderDemographics3Ring(config, resolved, formatted);
    }

    // Default metric grid
    let html = title ? `<h3 class="om-subheading">${title}</h3>` : '';
    html += `<div class="om-metric-grid" style="grid-template-columns: repeat(${columns}, 1fr);">`;
    for (const m of config.metrics) {
      let value = '';
      if (m.tokens && Array.isArray(m.tokens)) {
        value = m.tokens.map((t: string) => getTokenValue(t, resolved, formatted)).join(' / ');
      } else if (m.token) {
        value = getTokenValue(m.token, resolved, formatted);
      }
      html += `<div class="om-metric-item"><div class="om-metric-label">${escapeHtml(m.label)}</div><div class="om-metric-value">${escapeHtml(value)}</div></div>`;
    }
    html += '</div>';
    return html;
  }

  return '';
}

function renderOfferingTerms(config: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const title = config.title || 'OFFERING TERMS';
  let html = `<div class="om-callout-box">
    <h3 class="om-callout-title">${escapeHtml(title)}</h3>
    <div class="om-callout-grid">`;

  for (const m of (config.metrics || [])) {
    let value = '';
    if (m.tokens && Array.isArray(m.tokens)) {
      const vals = m.tokens.map((t: string) => getTokenValue(t, resolved, formatted));
      value = vals.join('<br/>');
    } else if (m.token) {
      value = getTokenValue(m.token, resolved, formatted);
    }
    html += `<div class="om-callout-item">
      <div class="om-callout-label">${escapeHtml(m.label)}</div>
      <div class="om-callout-value">${value}</div>
    </div>`;
  }

  html += '</div></div>';
  return html;
}

function renderOfferingSummary(config: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const title = config.title || 'OFFERING SUMMARY';
  let html = `<div class="om-summary-box">
    <h3 class="om-summary-title">${escapeHtml(title)}</h3>
    <table class="om-summary-table">`;

  for (const m of (config.metrics || [])) {
    const value = m.token ? getTokenValue(m.token, resolved, formatted) : '';
    html += `<tr><td class="om-summary-label">${escapeHtml(m.label)}</td><td class="om-summary-value">${escapeHtml(value)}</td></tr>`;
  }

  html += '</table></div>';
  return html;
}

function renderHighlights4Grid(raw: any, config: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  let html = '<div class="om-highlights-grid">';

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const title = typeof item === 'string' ? item : ((item as any).title || '');
      const desc = typeof item === 'object' ? ((item as any).description || '') : '';
      html += `<div class="om-highlight-card">
        <h4>${escapeHtml(title)}</h4>
        ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
      </div>`;
    }
  } else if (typeof raw === 'string') {
    const items = raw.split('\n').filter(Boolean);
    for (const item of items) {
      html += `<div class="om-highlight-card"><h4>${escapeHtml(item)}</h4></div>`;
    }
  } else {
    html += `<div class="token-unresolved">{{${config.token || 'INVESTMENT_HIGHLIGHTS'}}}</div>`;
  }

  html += '</div>';
  return html;
}

function renderStatCallouts(raw: any): string {
  let html = '<div class="om-stat-callouts">';
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const stat = (item as any).stat || '';
      const label = (item as any).label || '';
      html += `<div class="om-stat-card">
        <div class="om-stat-number">${escapeHtml(String(stat))}</div>
        <div class="om-stat-label">${escapeHtml(label)}</div>
      </div>`;
    }
  }
  html += '</div>';
  return html;
}

function renderBrokerCards(raw: any, config: any): string {
  let html = '<div class="om-broker-cards">';
  if (Array.isArray(raw)) {
    for (const broker of raw) {
      html += `<div class="om-broker-card">
        <div class="om-broker-name">${escapeHtml((broker as any).name || '')}</div>
        <div class="om-broker-title">${escapeHtml((broker as any).title || '')}</div>
        <div class="om-broker-contact">${escapeHtml((broker as any).phone || '')}</div>
        <div class="om-broker-contact">${escapeHtml((broker as any).email || '')}</div>
      </div>`;
    }
  } else if (raw && typeof raw === 'string') {
    html += `<p>${escapeHtml(raw)}</p>`;
  } else {
    html += `<p class="token-unresolved">{{BROKER_TEAM}}</p>`;
  }
  html += '</div>';
  return html;
}

function renderOpportunityCards(raw: any): string {
  let html = '<div class="om-opportunity-cards">';
  if (Array.isArray(raw)) {
    for (const opp of raw) {
      const title = typeof opp === 'string' ? opp : ((opp as any).title || '');
      const desc = typeof opp === 'object' ? ((opp as any).description || '') : '';
      html += `<div class="om-opportunity-card">
        <h4>${escapeHtml(title)}</h4>
        ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
      </div>`;
    }
  }
  html += '</div>';
  return html;
}

function renderDemographics3Ring(config: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const rings = config.rings || ['5 Miles', '10 Miles', '25 Miles'];
  const title = config.title || 'Demographics';

  let html = `<h3 class="om-subheading">${escapeHtml(title)}</h3>`;
  html += '<div class="om-demographics-panel">';

  // Header row
  html += '<div class="om-demo-row om-demo-header"><div class="om-demo-label"></div>';
  for (const ring of rings) {
    html += `<div class="om-demo-ring">${escapeHtml(ring)}</div>`;
  }
  html += '</div>';

  for (const m of (config.metrics || [])) {
    html += `<div class="om-demo-row"><div class="om-demo-label">${escapeHtml(m.label)}</div>`;
    if (m.tokens && Array.isArray(m.tokens)) {
      for (let i = 0; i < rings.length; i++) {
        const token = m.tokens[i];
        const val = token ? getTokenValue(token, resolved, formatted) : '—';
        html += `<div class="om-demo-value">${escapeHtml(val)}</div>`;
      }
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ─── Table ──────────────────────────────────────────────────────────────────

function renderTable(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const style = config.style || 'generic';
  const title = config.title ? resolveTokenInText(config.title, resolved, formatted) : '';
  const subtitle = config.subtitle ? resolveTokenInText(config.subtitle, resolved, formatted) : '';
  const token = config.token;

  let html = '';
  if (title) {
    html += `<h3 class="om-table-title">${title}</h3>`;
    if (subtitle) html += `<p class="om-table-subtitle">${subtitle}</p>`;
  }

  // Key-value / property details / lease panel tables
  if (style === 'om_property_details' || style === 'key_value' || style === 'om_lease_panel') {
    return html + renderKeyValueTable(config, resolved, formatted, style);
  }

  // Amenities checklist
  if (style === 'om_amenities_checklist') {
    return html + renderAmenitiesChecklist(config, resolved);
  }

  // TOC numbered
  if (style === 'toc_numbered') {
    return html + renderTocNumbered(config);
  }

  // Token-driven structured tables (OM_NOI_TABLE, OM_PROFORMA_TABLE, etc.)
  if (token) {
    const data = getTokenRaw(token, resolved);

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const tableData = data as any;

      // Structured table with sections
      if (tableData.headers && (tableData.sections || tableData.rows)) {
        return html + renderStructuredTable(tableData, style);
      }
    }

    // Rate tables / vessel tables — array data
    if (Array.isArray(data) && data.length > 0) {
      const columns = config.columns || Object.keys(data[0]);
      const keys = Object.keys(data[0]);
      html += `<table class="om-table om-${style}">`;
      html += '<thead><tr>';
      for (const col of columns) {
        html += `<th>${escapeHtml(col)}</th>`;
      }
      html += '</tr></thead><tbody>';
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
      html += '</tbody></table>';
      return html;
    }

    // Unresolved token
    if (!data) {
      html += `<p class="token-unresolved">{{${token}}}</p>`;
      return html;
    }
  }

  return html;
}

function renderKeyValueTable(config: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>, style: string): string {
  const rows = config.rows || [];
  const isLeasePanel = style === 'om_lease_panel';

  // For lease panels, check if all tokens are null — if so, hide
  if (isLeasePanel) {
    const allNull = rows.every((r: any) => !r.token || !isTokenResolved(r.token, resolved));
    if (allNull) return '';
  }

  let html = `<table class="om-table om-kv-table ${isLeasePanel ? 'om-lease-panel' : ''}">`;
  html += '<tbody>';
  for (const row of rows) {
    const value = row.token ? getTokenValue(row.token, resolved, formatted) : (row.value || '');
    html += `<tr>
      <td class="om-kv-label">${escapeHtml(row.label)}</td>
      <td class="om-kv-value">${escapeHtml(value)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  return html;
}

function renderAmenitiesChecklist(config: any, resolved: ResolvedTokenMap): string {
  const rows = config.rows || [];
  let html = '<div class="om-amenities-grid">';

  for (const row of rows) {
    const token = row.token;
    let checkmark = '—';
    if (token) {
      const val = getTokenRaw(token, resolved);
      if (val === true || val === 'true' || val === 'Yes' || val === 'yes' || val === 1) {
        checkmark = '&#10003;'; // ✓
      } else if (val && typeof val === 'string' && val !== 'false' && val !== 'No' && val !== 'no') {
        checkmark = escapeHtml(val); // e.g., "10,000 SF"
      }
    }
    html += `<div class="om-amenity-item">
      <span class="om-amenity-check">${checkmark}</span>
      <span class="om-amenity-label">${escapeHtml(row.label)}</span>
    </div>`;
  }

  html += '</div>';
  return html;
}

function renderTocNumbered(config: any): string {
  const entries = config.entries || [];
  let html = '<div class="om-toc">';
  for (const entry of entries) {
    html += `<div class="om-toc-entry">
      <span class="om-toc-number">${escapeHtml(String(entry.number))}</span>
      <span class="om-toc-title">${escapeHtml(entry.title)}</span>
    </div>`;
  }
  html += '</div>';
  return html;
}

function renderStructuredTable(tableData: any, style: string): string {
  const headers = tableData.headers || [];
  let html = `<table class="om-table om-structured om-${style}">`;

  // Header row
  html += '<thead><tr>';
  for (const h of headers) {
    html += `<th>${escapeHtml(String(h))}</th>`;
  }
  html += '</tr></thead><tbody>';

  // Sections with subtotals
  if (tableData.sections) {
    for (const section of tableData.sections) {
      // Section header
      html += `<tr class="om-section-header"><td colspan="${headers.length}" class="om-section-title">${escapeHtml(section.title)}</td></tr>`;

      for (const row of (section.rows || [])) {
        html += '<tr>';
        for (const h of headers) {
          const val = row[h];
          const display = typeof val === 'number' ? fmtCurrency(val) : String(val ?? '—');
          html += `<td>${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }

      if (section.subtotal) {
        html += '<tr class="om-subtotal">';
        for (const h of headers) {
          const val = section.subtotal[h];
          const display = typeof val === 'number' ? fmtCurrency(val) : String(val ?? '');
          html += `<td>${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }
    }
  }

  // Flat rows (no sections)
  if (tableData.rows && !tableData.sections) {
    for (const row of tableData.rows) {
      html += '<tr>';
      for (const h of headers) {
        const val = row[h];
        const display = typeof val === 'number' ? fmtCurrency(val) : String(val ?? '—');
        html += `<td>${escapeHtml(display)}</td>`;
      }
      html += '</tr>';
    }
  }

  // Totals row
  if (tableData.totals) {
    html += '<tr class="om-totals">';
    for (const h of headers) {
      const val = tableData.totals[h];
      const display = typeof val === 'number' ? fmtCurrency(val) : String(val ?? '');
      html += `<td>${escapeHtml(display)}</td>`;
    }
    html += '</tr>';
  }

  // Footnotes
  if (tableData.footnotes && Array.isArray(tableData.footnotes)) {
    html += '</tbody></table>';
    html += '<div class="om-footnotes">';
    for (const fn of tableData.footnotes) {
      html += `<p>${escapeHtml(fn)}</p>`;
    }
    html += '</div>';
    return html;
  }

  html += '</tbody></table>';
  return html;
}

// ─── Chart (v1: data table) ─────────────────────────────────────────────────

function renderChart(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  const config = block.config || {};
  const title = config.title || 'Chart';
  const token = config.token;

  let html = `<h3 class="om-subheading">${escapeHtml(title)}</h3>`;

  if (token) {
    const data = getTokenRaw(token, resolved);
    if (Array.isArray(data) && data.length > 0) {
      const keys = Object.keys(data[0]);
      html += '<table class="om-table om-chart-table">';
      html += '<thead><tr>' + keys.map(k => `<th>${escapeHtml(k)}</th>`).join('') + '</tr></thead>';
      html += '<tbody>';
      for (const row of data) {
        html += '<tr>';
        for (const key of keys) {
          const val = (row as any)[key];
          const display = typeof val === 'number' ? fmtNumber(val) : String(val ?? '—');
          html += `<td>${escapeHtml(display)}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
    } else {
      html += `<p class="token-unresolved">{{${token}}}</p>`;
    }
  } else {
    html += '<p style="color: #999; font-style: italic;">Chart placeholder</p>';
  }

  return html;
}

// ─── Bullet List ────────────────────────────────────────────────────────────

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

  return `<ul class="om-bullet-list">${bullets.map(b => `<li>${resolveTokenInText(b, resolved, formatted)}</li>`).join('')}</ul>`;
}

// ─── Block Dispatcher ───────────────────────────────────────────────────────

function renderBlock(block: any, resolved: ResolvedTokenMap, formatted: Record<string, ResolvedTokenEntry>): string {
  switch (block.type) {
    case 'divider': return renderSectionDivider(block);
    case 'heading': return renderHeading(block, resolved, formatted);
    case 'text': return renderText(block, resolved, formatted);
    case 'image': return renderImage(block, resolved, formatted);
    case 'metric_grid': return renderMetricGrid(block, resolved, formatted);
    case 'table': return renderTable(block, resolved, formatted);
    case 'chart': return renderChart(block, resolved, formatted);
    case 'bullet_list': return renderBulletList(block, resolved, formatted);
    default: return `<!-- unknown block type: ${block.type} -->`;
  }
}

// ─── Section Renderer ───────────────────────────────────────────────────────

/**
 * Render a single OM template section to HTML.
 */
export function renderOMSectionToHtml(
  section: any,
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>
): string {
  const isCover = section.key === 'om_cover';
  const isBackCover = section.key === 'om_back_cover';
  const pageClass = isCover ? 'om-page om-cover' : isBackCover ? 'om-page om-back-cover' : 'om-page';

  let html = `<div class="${pageClass}" data-section="${escapeHtml(section.key)}">`;

  for (const block of (section.blocks || [])) {
    html += renderBlock(block, resolved, formatted);
  }

  html += '</div>';
  return html;
}

/**
 * Render the full OM document as a complete HTML page.
 */
export function renderFullOMDocument(
  sections: any[],
  resolved: ResolvedTokenMap,
  formatted: Record<string, ResolvedTokenEntry>,
  options?: {
    watermark?: string;
    confidentialFooter?: boolean;
    waveMotif?: boolean;
    includePageNumbers?: boolean;
  }
): string {
  const renderedSections = sections.map(s => renderOMSectionToHtml(s, resolved, formatted));

  const watermarkHtml = options?.watermark
    ? `<div class="om-watermark">${escapeHtml(options.watermark)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Offering Memorandum</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Sans+Pro:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  /* ─── Page Setup ─── */
  @page { size: 8.5in 11in; margin: 50px 60px 60px 60px; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #E8E4DC; color: #2D2D2D; font-family: 'Source Sans Pro', 'Helvetica Neue', sans-serif; font-size: 11px; line-height: 1.6; }

  /* ─── Page Container ─── */
  .om-page { width: 8.5in; min-height: 11in; margin: 20px auto; background: #F5F0E8; box-shadow: 0 2px 16px rgba(0,0,0,0.15); padding: 50px 60px 60px 60px; position: relative; page-break-after: always; overflow: hidden; }

  /* ─── Cover ─── */
  .om-cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .om-cover h1 { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; font-size: 42px; margin: 24px 0 8px; }
  .om-cover p { color: #B8976A; font-size: 18px; letter-spacing: 0.05em; }

  /* ─── Back Cover ─── */
  .om-back-cover { display: flex; flex-direction: column; justify-content: center; }

  /* ─── Section Divider ─── */
  .section-divider { page-break-before: always; height: 100%; min-height: 10in; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; position: relative; margin: -50px -60px -60px -60px; padding: 60px; background: linear-gradient(180deg, #F5F0E8 0%, #EDE8DC 100%); }
  .divider-content { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .section-number { font-size: 120px; font-family: 'Playfair Display', Georgia, serif; color: #B8976A; line-height: 1; margin-bottom: 16px; }
  .section-title { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; color: #1B365D; letter-spacing: 0.15em; text-transform: uppercase; }
  .wave-motif { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; }
  .wave-motif svg { width: 100%; height: 100%; }

  /* ─── Typography ─── */
  h1, h2, h3, h4 { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; }
  h2 { font-size: 16px; margin: 24px 0 12px; letter-spacing: 0.1em; text-transform: uppercase; border-bottom: 1px solid #B8976A; padding-bottom: 6px; }
  h3 { font-size: 14px; margin: 16px 0 8px; }
  .om-subheading { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; font-size: 14px; margin: 16px 0 10px; }
  .om-text { margin: 8px 0; line-height: 1.7; }
  .om-caption { font-size: 9px; color: #666; text-align: center; margin-top: 4px; }
  .om-disclaimer { font-size: 8px; font-style: italic; color: #999; margin-top: 32px; line-height: 1.5; }
  .om-footnotes p { font-size: 9px; color: #666; margin: 2px 0; }

  /* ─── Hero / Images ─── */
  .om-hero-collage { text-align: center; margin: 16px 0; }
  .om-hero-img { width: 100%; max-height: 400px; object-fit: cover; border-radius: 4px; }
  .om-image { text-align: center; margin: 16px 0; }
  .om-image img { max-height: 350px; }
  .om-image-placeholder { background: #E5E1D8; border: 2px dashed #C4BFB2; border-radius: 4px; padding: 48px; text-align: center; color: #999; margin: 16px 0; font-size: 12px; }

  /* ─── Tables ─── */
  .om-table { width: 100%; border-collapse: collapse; font-size: 10px; margin: 12px 0; }
  .om-table th { background: #1B365D; color: #FFF; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
  .om-table td { padding: 6px 10px; border-bottom: 1px solid #DDD8CE; }
  .om-table tbody tr:nth-child(even) td { background: #FAFAF5; }
  .om-section-header td { background: #B8976A !important; color: #FFF; font-weight: 700; font-size: 10px; text-transform: uppercase; padding: 6px 10px; }
  .om-subtotal td { font-weight: 700; border-top: 1px solid #1B365D; background: #F0EDE5 !important; }
  .om-totals td { font-weight: 700; border-top: 2px solid #1B365D; background: #E8E3D8 !important; font-size: 11px; }

  /* ─── Key-Value Tables ─── */
  .om-kv-table { max-width: 500px; }
  .om-kv-label { font-weight: 600; color: #1B365D; width: 40%; }
  .om-kv-value { color: #2D2D2D; }
  .om-lease-panel { max-width: 400px; margin: 8px 0 16px; border: 1px solid #DDD8CE; border-radius: 4px; overflow: hidden; }
  .om-lease-panel td { padding: 8px 12px; }

  /* ─── Amenities Checklist ─── */
  .om-amenities-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 12px 0; }
  .om-amenity-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid #EDE8DC; font-size: 10px; }
  .om-amenity-check { color: #2DD4BF; font-weight: 700; min-width: 20px; text-align: center; }
  .om-amenity-label { color: #2D2D2D; }

  /* ─── TOC ─── */
  .om-toc { padding: 24px; background: #1B365D; color: #FFF; border-radius: 4px; margin: 16px 0; }
  .om-toc-entry { display: flex; align-items: baseline; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.15); }
  .om-toc-entry:last-child { border-bottom: none; }
  .om-toc-number { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; color: #B8976A; min-width: 30px; }
  .om-toc-title { font-size: 14px; letter-spacing: 0.1em; }

  /* ─── Metric Grids ─── */
  .om-metric-grid { display: grid; gap: 12px; margin: 12px 0; }
  .om-metric-item { background: #FAFAF5; padding: 12px; border-radius: 4px; border-left: 3px solid #B8976A; }
  .om-metric-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .om-metric-value { font-size: 16px; font-weight: 700; color: #1B365D; font-family: 'Roboto Mono', monospace; }

  /* ─── Callout Box (Offering Terms) ─── */
  .om-callout-box { background: rgba(27,54,93,0.85); color: #FFF; padding: 24px; border-radius: 4px; margin: 16px 0; }
  .om-callout-title { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; font-size: 16px; margin-bottom: 16px; }
  .om-callout-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .om-callout-item { }
  .om-callout-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
  .om-callout-value { font-size: 14px; font-weight: 600; }

  /* ─── Summary Box (Offering Summary) ─── */
  .om-summary-box { background: #FAFAF5; border: 1px solid #DDD8CE; border-radius: 4px; padding: 20px; margin: 16px 0; }
  .om-summary-title { font-family: 'Playfair Display', Georgia, serif; color: #B8976A; font-size: 14px; margin-bottom: 12px; }
  .om-summary-table { width: 100%; }
  .om-summary-table td { padding: 6px 0; border-bottom: 1px solid #EDE8DC; font-size: 11px; }
  .om-summary-label { font-weight: 600; color: #1B365D; }
  .om-summary-value { text-align: right; font-family: 'Roboto Mono', monospace; }

  /* ─── Highlights Grid ─── */
  .om-highlights-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
  .om-highlight-card { background: rgba(27,54,93,0.85); color: #FFF; padding: 16px; border-radius: 4px; }
  .om-highlight-card h4 { color: #B8976A; font-size: 13px; margin-bottom: 6px; }
  .om-highlight-card p { font-size: 10px; color: rgba(255,255,255,0.85); }

  /* ─── Stat Callouts ─── */
  .om-stat-callouts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .om-stat-card { background: #1B365D; color: #FFF; padding: 16px; border-radius: 4px; text-align: center; }
  .om-stat-number { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; color: #B8976A; margin-bottom: 4px; }
  .om-stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.8); }

  /* ─── Broker Cards ─── */
  .om-broker-cards { display: flex; flex-direction: column; gap: 16px; margin: 16px 0; }
  .om-broker-card { border-left: 3px solid #B8976A; padding: 12px 16px; background: #FAFAF5; border-radius: 0 4px 4px 0; }
  .om-broker-name { font-weight: 700; color: #1B365D; font-size: 14px; }
  .om-broker-title { font-size: 11px; color: #666; margin-bottom: 4px; }
  .om-broker-contact { font-size: 10px; color: #4A6D8C; }

  /* ─── Opportunity Cards ─── */
  .om-opportunity-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 12px 0; }
  .om-opportunity-card { background: #FAFAF5; border: 1px solid #DDD8CE; border-radius: 4px; padding: 16px; }
  .om-opportunity-card h4 { color: #1B365D; font-size: 12px; margin-bottom: 6px; }
  .om-opportunity-card p { font-size: 10px; color: #666; }

  /* ─── Demographics Panel ─── */
  .om-demographics-panel { margin: 12px 0; border: 1px solid #DDD8CE; border-radius: 4px; overflow: hidden; }
  .om-demo-row { display: grid; grid-template-columns: 200px repeat(3, 1fr); border-bottom: 1px solid #EDE8DC; }
  .om-demo-row:last-child { border-bottom: none; }
  .om-demo-header { background: #1B365D; color: #FFF; font-weight: 600; font-size: 10px; }
  .om-demo-header .om-demo-ring { padding: 8px 12px; text-align: center; }
  .om-demo-label { padding: 8px 12px; font-weight: 600; color: #1B365D; font-size: 10px; background: #FAFAF5; }
  .om-demo-value { padding: 8px 12px; text-align: center; font-family: 'Roboto Mono', monospace; font-size: 10px; }

  /* ─── Bullet List ─── */
  .om-bullet-list { margin: 8px 0; padding-left: 20px; }
  .om-bullet-list li { margin: 4px 0; font-size: 11px; }
  .om-bullet-list li::marker { color: #B8976A; }

  /* ─── Token States ─── */
  .token-value { border-bottom: 1px solid #2DD4BF; }
  .token-unresolved { background: #FEF3CD; color: #856404; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 10px; }

  /* ─── Watermark ─── */
  .om-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80px; color: rgba(0,0,0,0.06); font-family: 'Playfair Display', Georgia, serif; letter-spacing: 0.2em; pointer-events: none; z-index: 1000; }

  /* ─── Page Numbers ─── */
  @media print {
    .om-page { box-shadow: none; margin: 0; }
    @page { @bottom-center { content: counter(page); font-size: 9px; color: #999; } }
  }
</style>
</head>
<body>
${watermarkHtml}
${renderedSections.join('\n')}
</body>
</html>`;
}

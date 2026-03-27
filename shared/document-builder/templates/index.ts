/**
 * Document Studio Template Registry
 * Central export for all professional document templates.
 */

export { IC_DEAL_REVIEW_DECK_TEMPLATE } from './ic-deal-review-deck';
export { OFFERING_MEMORANDUM_TEMPLATE } from './offering-memorandum';
export { MASTER_TOKEN_MAP, getTokensForTemplate, getLiveTokens, getManualTokens, getToken, TOKEN_SUMMARY } from './token-map';
export type { TokenDefinition, TokenSource } from './token-map';

import { IC_DEAL_REVIEW_DECK_TEMPLATE } from './ic-deal-review-deck';
import { OFFERING_MEMORANDUM_TEMPLATE } from './offering-memorandum';

/**
 * All registered templates available in Document Studio.
 * Add new templates here to make them available in the template gallery.
 */
export const DOCUMENT_STUDIO_TEMPLATES = [
  IC_DEAL_REVIEW_DECK_TEMPLATE,
  OFFERING_MEMORANDUM_TEMPLATE,
] as const;

/**
 * Get a template by ID
 */
export function getTemplateById(id: string) {
  return DOCUMENT_STUDIO_TEMPLATES.find(t => t.id === id);
}

/**
 * Get templates by document type
 */
export function getTemplatesByType(documentType: string) {
  return DOCUMENT_STUDIO_TEMPLATES.filter(t => t.documentType === documentType);
}

/**
 * Get templates by asset class
 */
export function getTemplatesByAssetClass(assetClass: string) {
  return DOCUMENT_STUDIO_TEMPLATES.filter(t => t.assetClass === assetClass);
}

/**
 * Template registry summary for API responses
 */
export const TEMPLATE_REGISTRY = DOCUMENT_STUDIO_TEMPLATES.map(t => ({
  id: t.id,
  name: t.name,
  description: t.description,
  category: t.category,
  documentType: t.documentType,
  assetClass: t.assetClass,
  audience: t.audience,
  estimatedPages: t.estimatedPages,
  defaultExportFormat: t.defaultExportFormat,
  supportedExportFormats: t.supportedExportFormats,
  sectionCount: t.sections.length,
  requiredTokenCount: t.requiredTokens.length,
  optionalTokenCount: t.optionalTokens.length,
}));

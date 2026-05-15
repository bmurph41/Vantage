/**
 * Tests for the canonical assumption store hash helper.
 *
 * Regression coverage for the replacer-array misuse bug surfaced during
 * Day 2 dual-write smoke testing: JSON.stringify(payload, keys.sort())
 * treats the array as a key allowlist applied at every nesting level,
 * stripping all nested content — payloads differing only at nested
 * levels hashed identically. The existing governance test only
 * exercised top-level scalars, which is why the bug shipped past CI.
 */

import { describe, it, expect } from 'vitest';
import { hashAssumptionsPayload } from '../canonical-assumption-store';

describe('hashAssumptionsPayload', () => {
  it('generates consistent hashes for the same payload', () => {
    const payload = { growthRates: { wet_slips: 0.1 } };
    expect(hashAssumptionsPayload(payload)).toBe(hashAssumptionsPayload(payload));
  });

  it('produces 16-char hex hashes', () => {
    const hash = hashAssumptionsPayload({ growthRates: { wet_slips: 0.1 } });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles empty and null/undefined payloads', () => {
    expect(hashAssumptionsPayload({})).toHaveLength(16);
    expect(hashAssumptionsPayload(null)).toHaveLength(16);
    expect(hashAssumptionsPayload(undefined)).toHaveLength(16);
  });

  it('produces different hashes for payloads that differ only at nested levels', () => {
    const p1 = { growthRates: { wet_slips: 0.1 }, propertyTax: {} };
    const p2 = { growthRates: { wet_slips: 0.2 }, propertyTax: {} };
    expect(hashAssumptionsPayload(p1)).not.toBe(hashAssumptionsPayload(p2));
  });

  it('produces stable hashes regardless of key insertion order', () => {
    const p1 = { growthRates: { wet_slips: 0.1, dry_storage: 0.2 } };
    const p2 = { growthRates: { dry_storage: 0.2, wet_slips: 0.1 } };
    expect(hashAssumptionsPayload(p1)).toBe(hashAssumptionsPayload(p2));
  });
});

/**
 * Re-export shim — the department-inference module was relocated to
 * shared/coa/department-mapping.ts in WS4 Piece A (it has zero server deps).
 *
 * This shim is kept so the ~8 server importers and the test harnesses
 * (tests/department-inference-golden.mjs, tests/department-mapping-baseline.mjs)
 * keep resolving `server/utils/department-mapping` without simultaneous path edits.
 * Relative path is intentional — robust under tsx without tsconfig path aliases.
 */
export * from '../../shared/coa/department-mapping';

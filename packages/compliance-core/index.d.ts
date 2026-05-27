/**
 * Public TypeScript surface for `.attestly/detectors.ts` (docs:
 * /docs/scanner/custom-detectors). Intentionally minimal — the schema
 * here mirrors the Zod schema used by the scanner so that any value
 * that type-checks against {@link Detector} is also accepted at scan
 * time (and vice versa).
 */

export type FindingKind =
  | "ai_subprocessor"
  | "subprocessor"
  | "personal_data"
  | "special_category_data"
  | "license"
  | "data_residency"
  | "cookie"
  | "analytics"
  | "auth_provider"
  | "payment_provider";

export type RiskClass = "minimal" | "limited" | "high" | "unacceptable";

/**
 * A custom detector definition. At least one of `packages`, `imports`,
 * or `sourcePatterns` should be set — otherwise the detector will never
 * fire.
 */
export interface Detector {
  /** Globally unique within your tenant. Use prefixes like `internal-` or `vendor-`. */
  key: string;

  /** Human-readable label (defaults to `key`). */
  label?: string;

  /**
   * What kind of finding this detector emits. Most internal services
   * are `subprocessor`; AI services should use `ai_subprocessor`.
   * Defaults to `subprocessor` when omitted.
   */
  kind?: FindingKind;

  /** Legal entity name surfaced in generated documents. */
  legalEntity?: string;

  /** Short description, e.g. "Internal payment processing". */
  purpose?: string;

  /** Country / region the vendor operates in (free text). */
  location?: string;

  /** Public URL for the vendor — shown next to the row in the dashboard. */
  websiteUrl?: string;

  /** Mark the detector as an AI system (controls EU AI Act treatment). */
  isAi?: boolean;

  /** Risk class hint — only meaningful when `isAi: true`. */
  riskClass?: RiskClass;

  /** Package names matched against manifest dependency lists. */
  packages?: string[];

  /**
   * Regular expressions matched against the full module specifier of
   * `import` / `require` statements (and Python/Go/Rust import sweeps).
   */
  imports?: RegExp[];

  /** Same as {@link imports} but as string regex bodies. */
  importPatterns?: string[];

  /**
   * Regular expressions matched against the body of source files. Use
   * sparingly — these are slow and noisy compared to `packages` and
   * `imports`.
   */
  sourcePatterns?: RegExp[];

  /** Default data-category labels seeded into generated documents. */
  dataCategoriesByDefault?: string[];
}

/**
 * Disable a built-in detector that's misfiring (e.g. you imported the
 * SDK for type definitions only). The audit log records the disable so
 * future auditors can see what was hidden and why.
 */
export interface DisabledDetector {
  key: string;
  disabled: true;
  /** Optional human-readable reason recorded in the audit log. */
  reason?: string;
}

export type DetectorEntry = Detector | DisabledDetector;

/**
 * Identity helper that gives you full typed editor support inside
 * `.attestly/detectors.ts`. Attestly never executes this file —
 * detectors are parsed statically, so the function must remain pure.
 */
export declare function defineDetectors<T extends readonly DetectorEntry[]>(
  detectors: T,
): T;

export default defineDetectors;

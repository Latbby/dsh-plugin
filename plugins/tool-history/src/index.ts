/**
 * Web tool-history plugin, node half.
 *
 * Deliberately no Loader wiring. The browser half derives the Tool History
 * view from the session event stream itself; the node half publishes the pure
 * usage model plus the classification rules (`classifyTool` is reused by the
 * browser fold) as one typed home for the vocabulary.
 */

export * from './usage-tracker.ts'

/** Host plugin body — reserved; the tool-history surface is client-derived. */
export function apply(): void {}

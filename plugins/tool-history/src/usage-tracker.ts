/**
 * Pure per-session, per-round tool-usage model for the web tool-history strip.
 *
 * This module owns no runtime wiring: it folds plain records into round
 * summaries and classifies tool names. The live adaptation that feeds it (a
 * scoped `tools/result` listener, or the client's own turn-indexed tool-call
 * nodes) is deliberately left outside this file — see the package README for
 * the two candidate data channels and their open questions.
 */

/** Which family a tool-call name belongs to in the usage strip. */
export type ToolUsageKind = 'skill' | 'mcp' | 'tool'

/** One round's tool-usage summary. Arrays preserve first-call order. */
export interface RoundUsage {
  readonly round: number
  readonly skill: readonly string[]
  readonly mcp: readonly string[]
  readonly tool: readonly string[]
}

/**
 * A deployment's registered tool names, matched exactly against a wire name.
 * The model ships with the skill-loading tool name; deployments with extra
 * skill carriers extend the set at construction time.
 */
export const DEFAULT_SKILL_TOOLS: ReadonlySet<string> = new Set(['skill'])

/** MCP tools arrive under the `mcp__<server>__<tool>` wire-name prefix. */
const MCP_PREFIX = 'mcp__'

/** Classify one wire tool name into its usage family. */
export function classifyTool(name: string, skillTools: ReadonlySet<string> = DEFAULT_SKILL_TOOLS): ToolUsageKind {
  if (name.startsWith(MCP_PREFIX)) return 'mcp'
  if (skillTools.has(name)) return 'skill'
  return 'tool'
}

function emptySummary(round: number): RoundUsage {
  return { round, skill: [], mcp: [], tool: [] }
}

function snapshot(summary: RoundUsage): RoundUsage {
  return { round: summary.round, skill: [...summary.skill], mcp: [...summary.mcp], tool: [...summary.tool] }
}

/**
 * Accumulates per-session, per-round tool-usage records.
 * All methods return plain JSON-compatible data.
 */
export class UsageTracker {
  private readonly sessions = new Map<string, Map<number, RoundUsage>>()

  /** Record one call and return the updated summary of its round. */
  record(sessionId: string, round: number, tool: string): RoundUsage {
    let rounds = this.sessions.get(sessionId)
    if (rounds === undefined) {
      rounds = new Map()
      this.sessions.set(sessionId, rounds)
    }
    let summary = rounds.get(round)
    if (summary === undefined) {
      summary = emptySummary(round)
      rounds.set(round, summary)
    }
    // Summary families are readonly in the public type; mutate through a
    // local mutable alias before the next snapshot hides the change.
    const bucket = summary[classifyTool(tool)] as string[]
    if (!bucket.includes(tool)) bucket.push(tool)
    return snapshot(summary)
  }

  /** Round summaries for one session, ascending by round. */
  rounds(sessionId: string): readonly RoundUsage[] {
    const rounds = this.sessions.get(sessionId)
    if (rounds === undefined) return []
    return [...rounds.values()].sort((a, b) => a.round - b.round).map(snapshot)
  }

  /** Drop all state for one session. */
  reset(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}

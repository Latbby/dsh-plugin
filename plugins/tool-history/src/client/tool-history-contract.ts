/**
 * Target envelope and snapshot vocabulary for the Tool History conversation
 * view: one record per root tool call, folded from `tool/call` and settled by
 * its correlated `tool/result`. Client-only and model-free: names, arguments,
 * and error text come verbatim from session events.
 */
import type { ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolUsageKind } from '../usage-tracker.ts'

/** Completion of one recorded tool call, correlated by `callId`. */
export type ToolCallStatus = 'success' | 'error' | 'running' | 'interrupted'

/**
 * One root tool call of a Session.
 *
 * `seq` is the `tool/call` event sequence — the stable in-turn order of the
 * list. `args` keeps the model-produced `arguments` JSON string verbatim; the
 * display layer derives and truncates the summary. `errorMessage`, when an
 * error result settled the call, carries the model-facing error text verbatim.
 */
export interface ToolCallRecord {
  readonly callId: string
  readonly name: string
  readonly kind: ToolUsageKind
  readonly turn: number
  readonly step: number
  readonly seq: number
  readonly args: string
  readonly status: ToolCallStatus
  readonly errorMessage?: string
  /** Result text blocks joined verbatim; absent when the result carried none. */
  readonly output?: string
  /** Whether `output` was capped at the Definition's retention limit. */
  readonly outputTruncated?: boolean
  /** Whether `args` was capped at the Definition's retention limit. */
  readonly argsTruncated?: boolean
  /** `tool/call` event time (epoch ms). */
  readonly startedAt: number
  /** `tool/result` event time (epoch ms); absent while unresolved. */
  readonly endedAt?: number
  /** `endedAt - startedAt`, derived when the result settled the call. */
  readonly durationMs?: number
}

/** One settled Turn boundary, which interrupts that Turn's unresolved calls. */
export interface ToolHistoryTurnRecord {
  readonly turn: number
  /** `turn/end` event time (epoch ms). */
  readonly endedAt: number
}

/** One contribution to the Tool History view target. */
export type ToolHistoryContribution = {
  readonly kind: 'call'
  readonly call: ToolCallRecord
} | {
  readonly kind: 'turn'
  readonly turn: ToolHistoryTurnRecord
}

/** Target envelope consumed by the Tool History snapshot builder. */
export interface ToolHistoryConversationViewNode extends ConversationViewNode {
  readonly target: 'toolHistory'
  /** `tool/call` sequence; contributions order by it. */
  readonly anchorSeq: number
  readonly data: ToolHistoryContribution
}

/** Tool calls assembled from the resident event window, in call order. */
export interface ToolHistorySnapshot {
  /** Calls sorted ascending by `seq` (event order). */
  readonly calls: readonly ToolCallRecord[]
}

/** Selector hook over the current Conversation binding's Tool History target. */
export type UseToolHistory = SnapshotSelectorHook<ToolHistorySnapshot>

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationViewSnapshotMap {
    /** Per-turn tool call ledger assembled for the Tool History view. */
    toolHistory: ToolHistorySnapshot
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SessionStandardProps {
    /** Selector hook over the current Conversation binding's Tool History target. */
    useToolHistory: UseToolHistory
  }
}

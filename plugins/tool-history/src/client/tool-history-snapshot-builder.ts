/**
 * Tool History view target: keeps a keyed ledger of call contributions and
 * derives the ordered snapshot the view renders. Contributions arrive in event
 * order through the assembler; `anchorSeq` (the call's `tool/call` sequence)
 * both keys the ledger ordering and keeps a settled call in its original
 * position when only its status changes.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {
  ConversationViewBuilder, ConversationViewDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  ToolCallRecord, ToolHistoryConversationViewNode, ToolHistorySnapshot,
} from './tool-history-contract.ts'

const EMPTY_LIST: readonly never[] = []

/** Stable empty target used until a Session assembles Tool History records. */
export const EMPTY_TOOL_HISTORY_SNAPSHOT: ToolHistorySnapshot = {
  calls: EMPTY_LIST,
}

/** Keyed adapter over the call ledger that mirrors the Trajectory builder's stage layout. */
export class ToolHistorySnapshotBuilder
implements ConversationViewBuilder<ToolHistoryConversationViewNode, ToolHistorySnapshot> {
  private readonly nodes = new Map<string, ToolHistoryConversationViewNode>()
  private contributions: ToolHistoryConversationViewNode[] = []
  readonly empty = EMPTY_TOOL_HISTORY_SNAPSHOT

  replace(input: {
    readonly nodes: readonly ToolHistoryConversationViewNode[]
  }): ToolHistorySnapshot {
    this.nodes.clear()
    for (const node of input.nodes) this.nodes.set(node.key, node)
    this.rebuildContributions()
    return this.snapshot()
  }

  apply(input: {
    readonly upserts: readonly ToolHistoryConversationViewNode[]
  }): ToolHistorySnapshot {
    let structural = false
    for (const node of input.upserts) {
      const previous = this.nodes.get(node.key)
      this.nodes.set(node.key, node)
      if (previous === undefined || previous.anchorSeq !== node.anchorSeq) {
        structural = true
        continue
      }
      const position = this.positions.get(node.key)
      if (position === undefined) structural = true
      else this.contributions[position] = node
    }
    if (structural) this.rebuildContributions()
    return this.snapshot()
  }

  private readonly positions = new Map<string, number>()

  private snapshot(): ToolHistorySnapshot {
    const endedTurns = new Set<number>()
    for (const node of this.contributions) {
      if (node.data.kind === 'turn') endedTurns.add(node.data.turn.turn)
    }
    const calls: ToolCallRecord[] = []
    for (const node of this.contributions) {
      if (node.data.kind !== 'call') continue
      const call = node.data.call
      // A Turn boundary settles whatever its Turn left unresolved: the loop
      // owes no result for a call it abandoned (interrupt, compaction, stop).
      calls.push(call.status === 'running' && endedTurns.has(call.turn)
        ? { ...call, status: 'interrupted' }
        : call)
    }
    return { calls }
  }

  private rebuildContributions(): void {
    this.contributions = [...this.nodes.values()]
      .sort((left, right) => left.anchorSeq - right.anchorSeq || left.key.localeCompare(right.key))
    this.positions.clear()
    for (const [index, contribution] of this.contributions.entries()) {
      this.positions.set(contribution.key, index)
    }
  }
}

/** Tool History target factory. */
export const toolHistoryViewDefinition: ConversationViewDefinition<
  ToolHistoryConversationViewNode,
  ToolHistorySnapshot
> = {
  target: 'toolHistory',
  create: () => new ToolHistorySnapshotBuilder(),
}

/**
 * Register the Tool History view target builder.
 * @param ctx - Plugin context receiving the view Definition.
 */
export function registerToolHistoryConversationView(ctx: Context): void {
  ctx.uiConversation.views.register(toolHistoryViewDefinition)
}

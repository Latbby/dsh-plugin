/**
 * Tool-call lifecycle Definition for the Tool History view target.
 *
 * One Context owns one root call: `tool/call` starts it (`status: running`),
 * the correlated `tool/result` (matched by `message.source.callId`) settles it
 * as success or error. The Definition contributes one view node per call, so
 * the assembled list records every root tool call of the resident window —
 * skill, MCP, and ordinary host tools alike — without host-side state.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {
  ConversationNodeContext, ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEventMap } from '@deepseek-ai/dsh-session/types'
import { classifyTool } from '../usage-tracker.ts'
import type {
  ToolCallRecord, ToolHistoryContribution, ToolHistoryConversationViewNode, ToolHistoryTurnRecord,
} from './tool-history-contract.ts'

/** Internal state of one call Context; the Definition always returns copies. */
interface ToolCallState extends ToolCallRecord {}

/** The model-facing blocks of a `tool/result` payload. */
type ResultBlock = SessionEventMap['tool/result']['message']['content'][number]

/** Result characters retained verbatim before the ledger marks the output truncated. */
const OUTPUT_MAX = 200_000

/** Argument characters retained verbatim before the ledger marks the input truncated. */
const ARGS_MAX = 100_000

/**
 * Text blocks of one result payload, joined verbatim for the error message.
 * @param content - result content blocks.
 * @returns the joined text, or undefined when the result carried none.
 */
function textOf(content: readonly unknown[]): string | undefined {
  const parts: string[] = []
  for (const block of content) {
    const text = (block as { text?: unknown }).text
    if (typeof text === 'string' && text.trim() !== '') parts.push(text)
  }
  const joined = parts.join('\n').trim()
  return joined === '' ? undefined : joined
}

/**
 * Settle a running call from its `tool/result` payload: record the result text
 * (for the expandable output) and, on an error result, its error message.
 * @param call - current call state.
 * @param payload - `tool/result` event data.
 * @returns the settled call state.
 */
function settle(
  call: ToolCallState,
  event: { readonly data: SessionEventMap['tool/result']; readonly time: number },
): ToolCallState {
  const payload = event.data
  const block: ResultBlock | undefined = payload.message.content[0]
  const text = block === undefined ? undefined : textOf(block.content)
  const settled: ToolCallState = {
    ...call,
    ...(text === undefined ? {} : { output: text.length > OUTPUT_MAX ? text.slice(0, OUTPUT_MAX) : text }),
    ...(text !== undefined && text.length > OUTPUT_MAX ? { outputTruncated: true } : {}),
    endedAt: event.time,
    durationMs: event.time - call.startedAt,
  }
  if (block === undefined || block.isError !== true) return { ...settled, status: 'success' }
  if (text !== undefined) return { ...settled, status: 'error', errorMessage: text }
  const identity = payload.error
  return {
    ...settled,
    status: 'error',
    ...(identity === undefined ? {} : { errorMessage: identity.name }),
  }
}

/** Wrap one contribution in the target envelope. */
function toolHistoryNode(
  context: ConversationNodeContext<ToolCallState>,
  call: ToolCallRecord,
): ToolHistoryConversationViewNode {
  const contribution: ToolHistoryContribution = { kind: 'call', call }
  return {
    key: context.key,
    kind: context.kind,
    id: context.id,
    target: 'toolHistory',
    anchorSeq: call.seq,
    data: contribution,
  }
}

/** Tool History-owned root tool-call lifecycle. */
export const toolHistoryCallDefinition: ConversationNodeDefinition<ToolCallState> = {
  kind: 'tool-history-call',
  target: 'toolHistory',
  match: (event) => {
    if (event.type === 'tool/call') return { id: String(event.data.callId), role: 'start' }
    if (event.type === 'tool/result') {
      return { id: String(event.data.message.source.callId), role: 'update' }
    }
    return null
  },
  start: (_context, match) => {
    if (match.event.type !== 'tool/call') {
      throw new Error('tool-history-call start requires tool/call')
    }
    const call = match.event.data
    const args = call.arguments.length > ARGS_MAX ? call.arguments.slice(0, ARGS_MAX) : call.arguments
    return {
      callId: String(call.callId),
      name: call.name,
      kind: classifyTool(call.name),
      turn: call.turn,
      step: call.step,
      seq: match.event.seq,
      args,
      ...(call.arguments.length > ARGS_MAX ? { argsTruncated: true } : {}),
      startedAt: match.event.time,
      status: 'running',
    }
  },
  update: (context, match) => match.event.type !== 'tool/result'
    ? context.state
    : settle(context.state, match.event),
  buildViewNode: (context) => {
    if (context.state === undefined) return null
    return toolHistoryNode(context, context.state)
  },
}

/** Internal state of one settled Turn boundary. */
interface ToolTurnState extends ToolHistoryTurnRecord {
  /** `turn/end` event sequence, which orders the contribution. */
  readonly seq: number
}

/**
 * Tool History-owned Turn boundaries, anchored at `turn/end` (the trajectory
 * precedent): a boundary is what tells the builder that its Turn left nothing
 * unresolved, so any still-running call of that Turn is an interrupted one.
 */
export const toolHistoryTurnDefinition: ConversationNodeDefinition<ToolTurnState> = {
  kind: 'tool-history-turn',
  target: 'toolHistory',
  match: event => event.type === 'turn/end'
    ? { id: String(event.seq), role: 'start' }
    : null,
  start: (_context, match) => {
    if (match.event.type !== 'turn/end') {
      throw new Error('tool-history-turn start requires turn/end')
    }
    return {
      turn: match.event.data.turn,
      endedAt: match.event.time,
      seq: match.event.seq,
    }
  },
  // A boundary is complete the moment it starts; later events belong to other
  // Contexts, so the state never changes.
  update: context => context.state,
  buildViewNode: (context) => {
    if (context.state === undefined) return null
    const contribution: ToolHistoryContribution = {
      kind: 'turn',
      turn: { turn: context.state.turn, endedAt: context.state.endedAt },
    }
    return {
      key: context.key,
      kind: context.kind,
      id: context.id,
      target: 'toolHistory',
      anchorSeq: context.state.seq,
      data: contribution,
    }
  },
}

/**
 * Register the Tool History call lifecycle and its Turn boundaries.
 * @param ctx - Plugin context receiving the Definitions.
 */
export function registerToolHistoryCallDefinition(ctx: Context): void {
  ctx.uiConversation.events.register(toolHistoryCallDefinition)
  ctx.uiConversation.events.register(toolHistoryTurnDefinition)
}

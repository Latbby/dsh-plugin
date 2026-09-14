/**
 * Browser Tool History plugin contributing one conversation view tab
 * ("Tool History" beside Chat/Trajectory): a Conversation Definition folds
 * each root tool call and its correlated result into view nodes, a registered
 * view target assembles the per-Session snapshot, and the tab renders the
 * calls grouped by Turn. Export discipline: packages/client/AGENTS.md.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
// Type-only: pulls the locale, conversation slot/engine, renderer, and
// session-standard merges the registration and standard hooks need.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { en, NS, zh } from './locales.ts'
import { registerToolHistoryCallDefinition } from './tool-history-definition.ts'
import {
  EMPTY_TOOL_HISTORY_SNAPSHOT, registerToolHistoryConversationView,
} from './tool-history-snapshot-builder.ts'
import type { ToolHistorySnapshot } from './tool-history-contract.ts'
import { ToolHistoryView } from './ToolHistoryView.tsx'
import { installToolHistoryViewStyles } from './view-styles.ts'

export type { ToolHistoryKey } from './locales.ts'
export type {
  ToolCallRecord, ToolCallStatus, ToolHistorySnapshot, UseToolHistory,
} from './tool-history-contract.ts'

/** Required services: Slot registry, locale dictionaries, session hook binding, and the Conversation engine. */
export const inject = ['slots', 'locale', 'uiSession', 'uiConversation']

/**
 * Client plugin body: register the dictionaries, the Tool History Definition
 * and view target, the per-Session snapshot source, and the view tab.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const toolHistorySources = new WeakMap<SessionBinding, ObservableSnapshot<ToolHistorySnapshot>>()
  const toolHistorySource = (binding: SessionBinding): ObservableSnapshot<ToolHistorySnapshot> => {
    let source = toolHistorySources.get(binding)
    if (source === undefined) {
      const target = ctx.uiConversation.binding(binding).target('toolHistory')
      source = {
        getSnapshot: () => target.getSnapshot() ?? EMPTY_TOOL_HISTORY_SNAPSHOT,
        subscribe: listener => target.subscribe(listener),
      }
      toolHistorySources.set(binding, source)
    }
    return source
  }
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tool-history: dictionaries')
  // The tab hides the resident composer and width handles for its own View;
  // the stylesheet is fiber-owned and disappears with the plugin.
  installToolHistoryViewStyles(ctx)
  // Registration-time text (the view tab label) reads through the bound
  // translate as a thunk, so it follows the active locale without
  // re-registration.
  const t = ctx.locale.bind(NS)
  registerToolHistoryCallDefinition(ctx)
  registerToolHistoryConversationView(ctx)
  ctx.uiSession.provide({
    hooks: ['toolHistory'],
    resolve: binding => ({ hooks: { toolHistory: toolHistorySource(binding) } }),
  })
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'toolHistory',
    order: 1000,
    // The ledger is read-only: while this View is active the resident
    // composer is hidden instead of sharing the scrollport with it.
    noComposer: true,
    // No transcript content column to size — keep the product's width
    // handles (col-resize strips) off this View.
    contentColumn: false,
    locale: NS,
    label: () => t('view.title'),
  }, ToolHistoryView))
}

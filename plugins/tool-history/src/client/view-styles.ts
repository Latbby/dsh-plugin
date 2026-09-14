/**
 * View-scoped style injection for the Tool History tab.
 *
 * The product keeps the composer seat and the transcript width handles
 * resident for every Session View, with no per-View switch a plugin can set
 * (`noComposer` / `contentColumn` exist only on hosts that carry them). This
 * plugin therefore hides both for its own View the way other third-party Views
 * do: one stylesheet scoped by the View root's `data-tool-history-view`
 * attribute.
 *
 * A pending interaction keeps the composer seat visible (approval, question,
 * plan review), so hiding the seat can never hide a surface the user must
 * answer.
 */
import type { Context } from '@deepseek-ai/cordis'

/** `data-plugin-css` identity of the injected stylesheet. */
const STYLE_ID = 'tool-history/base.css'

/** Rules applied only while the Tool History View is mounted on screen. */
export const VIEW_STYLE = [
  '[data-conversation-scroll]:has([data-tool-history-view])',
  ' > [data-composer-seat]:not(:has([data-approval-key],[data-question-key],[data-plan-review-key])),',
  '[data-conversation-scroll]:has([data-tool-history-view])',
  ' ~ [data-width-handle] { display: none }',
].join('')

/**
 * Install the View-scoped stylesheet on the plugin's fiber: unloading the
 * plugin removes the tag again, so a stopped or updated Package leaves no
 * global style behind.
 * @param ctx - client plugin context owning the effect.
 */
export function installToolHistoryViewStyles(ctx: Context): void {
  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    const tag = document.createElement('style')
    tag.dataset.plugin = 'tool-history'
    tag.dataset.pluginCss = STYLE_ID
    tag.textContent = VIEW_STYLE
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'ui-tool-history: view styles')
}

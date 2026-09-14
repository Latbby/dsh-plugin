/** Tool History view: one ledger entry per root tool call, grouped by Turn. */

import { useMemo, useState, type CSSProperties } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolUsageKind } from '../usage-tracker.ts'
import type {
  ToolCallRecord, ToolCallStatus, ToolHistorySnapshot,
} from './tool-history-contract.ts'
import type { NS, ToolHistoryKey, ToolHistoryTranslate } from './locales.ts'

/** Characters of the visible argument/error summary before the ellipsis. */
const VISIBLE_MAX = 120
/** Kept visible until a payload this large is summarized away from its raw text. */
const TITLE_MAX = 16_000

/** Turn group projected from the ordered call ledger. */
interface TurnGroup {
  readonly turn: number
  readonly calls: readonly ToolCallRecord[]
}

/** One row's argument summary: visible text plus the full raw payload in the title. */
interface ArgsView {
  readonly text: string
  readonly title?: string
}

/** Active kind filter; `all` keeps every family. */
type KindFilter = 'all' | ToolUsageKind

const KIND_FILTERS: readonly KindFilter[] = ['all', 'skill', 'mcp', 'tool']

const kindLabelKey: Readonly<Record<ToolCallRecord['kind'], ToolHistoryKey>> = {
  skill: 'kind.skill',
  mcp: 'kind.mcp',
  tool: 'kind.tool',
}

const kindFilterKey: Readonly<Record<KindFilter, ToolHistoryKey>> = {
  all: 'toolbar.kind.all',
  skill: 'kind.skill',
  mcp: 'kind.mcp',
  tool: 'kind.tool',
}

const statusLabelKey: Readonly<Record<ToolCallStatus, ToolHistoryKey>> = {
  success: 'status.success',
  error: 'status.error',
  running: 'status.running',
  interrupted: 'status.interrupted',
}

/** Semantic status accent, mirrored by the pill text and its dot. */
function accentOf(status: ToolCallStatus): string {
  switch (status) {
    case 'success': return 'var(--dsw-alias-state-success-primary, #1f883d)'
    case 'error': return 'var(--dsw-alias-state-error-primary, #cf222e)'
    case 'running': return 'var(--dsw-alias-label-secondary, #59636e)'
    case 'interrupted': return 'var(--dsw-alias-state-warning-primary, #9a6700)'
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Top-level scalar arguments as `key=value`, keeping object insertion order. */
function scalarParts(args: Readonly<Record<string, unknown>>): readonly string[] {
  const parts: string[] = []
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      parts.push(`${key}=${JSON.stringify(value)}`)
    }
  }
  return parts
}

function withEllipsis(text: string, t: ToolHistoryTranslate): string {
  return text.length <= VISIBLE_MAX ? text : `${text.slice(0, VISIBLE_MAX)}${t('args.more')}`
}

/**
 * One call's argument summary for display. Parsable objects show their
 * top-level scalar arguments; anything else falls back to the raw JSON text
 * with whitespace collapsed. Long summaries truncate at {@link VISIBLE_MAX},
 * keeping the full raw payload on the row `title`.
 * @param raw - verbatim `arguments` JSON string from the session event.
 * @param t - namespace-bound translator.
 * @returns display text plus the full payload title when the text omits it.
 */
function argsView(raw: string, t: ToolHistoryTranslate): ArgsView {
  const collapsed = collapseWhitespace(raw)
  if (collapsed === '') return { text: t('args.empty') }
  let preferred = collapsed
  try {
    const parsed: unknown = JSON.parse(collapsed)
    if (isRecord(parsed)) {
      const parts = scalarParts(parsed)
      if (parts.length > 0) preferred = parts.join(' ')
    }
  } catch {
    // Malformed arguments keep the raw text as their summary.
  }
  const text = withEllipsis(preferred, t)
  if (preferred.length <= VISIBLE_MAX) return { text }
  if (collapsed.length <= TITLE_MAX) return { text, title: collapsed }
  return { text, title: `${collapsed.slice(0, TITLE_MAX)}${t('args.more')}` }
}

/** One call's visible error message (the full error text stays on the row `title`). */
function errorText(error: string, t: ToolHistoryTranslate): string {
  return error.length <= VISIBLE_MAX ? error : withEllipsis(error, t)
}

/** Pretty-printed JSON when the payload parses, else the raw text verbatim. */
function prettyPayload(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2) ?? raw
  } catch {
    return raw
  }
}

/**
 * Human-readable call duration: milliseconds below one second, seconds with
 * one decimal above it. The unit copy rides the locale dictionary.
 * @param ms - derived duration in milliseconds.
 * @param t - namespace-bound translator.
 * @returns display text.
 */
function formatDuration(ms: number, t: ToolHistoryTranslate): string {
  return ms < 1000
    ? `${String(Math.round(ms))}${t('unit.ms')}`
    : `${(ms / 1000).toFixed(1)}${t('unit.s')}`
}

/** Shared column track of one ledger row: chevron, family, name+args group, status. */
const GRID_COLUMNS = '14px 52px minmax(0, 1fr) auto'

const rowStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: GRID_COLUMNS, columnGap: 8, rowGap: 2,
  padding: '6px 10px',
  borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))',
}

const kindChipStyle: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.1))',
  borderRadius: 4, padding: '0 6px', fontSize: 11, lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary, #59636e)',
  textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
}

/** Name and argument summary sit side by side, left-aligned in one group. */
const middleStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
}

const nameStyle: CSSProperties = {
  fontFamily: 'var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: 12, color: 'var(--dsw-alias-label-primary, #1f2328)',
  flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
}

const argsStyle: CSSProperties = {
  fontSize: 12, color: 'var(--dsw-alias-label-secondary, #59636e)', minWidth: 0,
  flex: '1 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
}

const rightStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flex: 'none',
}

const durationStyle: CSSProperties = {
  fontSize: 11, color: 'var(--dsw-alias-label-secondary, #59636e)', whiteSpace: 'nowrap',
}

function statusPillStyle(status: ToolCallStatus): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: accentOf(status),
    flex: 'none',
  }
}

const dotStyle: CSSProperties = { width: 6, height: 6, borderRadius: 999 }

function dotOf(status: ToolCallStatus): CSSProperties {
  return { ...dotStyle, background: accentOf(status) }
}

const errorLineStyle: CSSProperties = {
  gridColumn: '3 / -1', fontSize: 12, color: 'var(--dsw-alias-state-error-primary, #cf222e)',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
  cursor: 'default',
}

const callButtonStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: GRID_COLUMNS, alignItems: 'center', columnGap: 8,
  gridColumn: '1 / -1', minWidth: 0, width: '100%', background: 'none', border: 0,
  padding: 0, margin: 0, font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer',
}

const chevronStyle: CSSProperties = {
  fontSize: 10, color: 'var(--dsw-alias-label-secondary, #59636e)',
}

const detailStyle: CSSProperties = {
  gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 2px 4px',
}

const detailSectionStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}

const detailLabelStyle: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--dsw-alias-label-secondary, #59636e)',
}

const preStyle: CSSProperties = {
  margin: 0, padding: '8px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.5,
  fontFamily: 'var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace)',
  background: 'var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08))',
  color: 'var(--dsw-alias-label-primary, #1f2328)',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowX: 'auto', maxHeight: 320,
}

/** Presentation props of one call row. */
interface ToolCallRowProps {
  readonly call: ToolCallRecord
  readonly t: ToolHistoryTranslate
}

/**
 * Render one tool call line; clicking the line expands formatted input and
 * output. The header stays one line (family, wire name, argument summary,
 * duration, status), so the ledger scans quickly while details remain one
 * click away. Payload formatting runs only while a row is expanded.
 */
function ToolCallRow({ call, t }: ToolCallRowProps) {
  const [open, setOpen] = useState(false)
  const args = argsView(call.args, t)
  const status = t(statusLabelKey[call.status])
  const title = args.title
  const inputText = useMemo(
    () => (open ? (call.args.trim() === '' ? t('args.empty') : prettyPayload(call.args)) : ''),
    [open, call.args, t],
  )
  const outputText = useMemo(
    () => (open ? (call.output === undefined ? t('result.empty') : prettyPayload(call.output)) : ''),
    [open, call.output, t],
  )
  return (
    <div style={rowStyle} data-tool-history-call>
      <button
        type="button"
        style={callButtonStyle}
        aria-expanded={open}
        aria-label={open ? t('row.collapse') : t('row.expand')}
        title={title}
        onClick={() => { setOpen(current => !current) }}
      >
        <span style={chevronStyle} aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span style={kindChipStyle}>{t(kindLabelKey[call.kind])}</span>
        <span style={middleStyle}>
          <span style={nameStyle}>{call.name}</span>
          <span style={argsStyle}>{args.text}</span>
        </span>
        <span style={rightStyle}>
          {call.durationMs === undefined ? null : (
            <span style={durationStyle}>{formatDuration(call.durationMs, t)}</span>
          )}
          <span style={statusPillStyle(call.status)} aria-label={status}>
            <span style={dotOf(call.status)} aria-hidden="true" />
            {status}
          </span>
        </span>
      </button>
      {call.status === 'error' && call.errorMessage !== undefined && (
        <span style={errorLineStyle} title={call.errorMessage} data-tool-history-error>
          {errorText(call.errorMessage, t)}
        </span>
      )}
      {open && (
        <div style={detailStyle} data-tool-history-detail>
          <div style={detailSectionStyle}>
            <span style={detailLabelStyle}>
              {t('args.title')}
              {call.argsTruncated === true ? ` ${t('args.truncated')}` : ''}
            </span>
            <pre style={preStyle}>{inputText}</pre>
          </div>
          <div style={detailSectionStyle}>
            <span style={detailLabelStyle}>
              {t('result.title')}
              {call.outputTruncated === true ? ` ${t('result.truncated')}` : ''}
            </span>
            <pre style={preStyle}>{outputText}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

/** Group one ordered call ledger into ascending Turns, preserving event order. */
function groupCalls(calls: readonly ToolCallRecord[]): readonly TurnGroup[] {
  const groups: { turn: number; calls: ToolCallRecord[] }[] = []
  for (const call of calls) {
    const current = groups.at(-1)
    if (current === undefined || current.turn !== call.turn) {
      groups.push({ turn: call.turn, calls: [call] })
    } else {
      current.calls.push(call)
    }
  }
  return groups.map(group => ({ turn: group.turn, calls: group.calls }))
}

const viewRootStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 18, padding: '16px 20px 32px', maxWidth: 980,
}

const toolbarStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
}

/** Filter and statistics header: floats above the scrolling ledger. */
const headerBarStyle: CSSProperties = {
  position: 'sticky', top: 0, zIndex: 5,
  display: 'flex', flexDirection: 'column', gap: 8,
  padding: '8px 10px 10px', borderRadius: 8,
  background: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.08))',
  backdropFilter: 'blur(8px)',
  boxShadow: '0 1px 6px var(--dsw-alias-shadow-l1, rgba(0,0,0,0.08))',
}

const filterButtonStyle: CSSProperties = {
  background: 'none', border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.3))',
  borderRadius: 999, padding: '1px 10px', fontSize: 12, lineHeight: '20px', cursor: 'pointer',
  color: 'var(--dsw-alias-label-secondary, #59636e)',
}

function filterButtonActiveStyle(active: boolean): CSSProperties {
  return active
    ? { borderColor: 'var(--dsw-alias-state-business-primary, #0969da)', color: 'var(--dsw-alias-state-business-primary, #0969da)' }
    : {}
}

const searchStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.3))', borderRadius: 6,
  padding: '2px 8px', fontSize: 12, minWidth: 160, background: 'transparent',
  color: 'var(--dsw-alias-label-primary, #1f2328)',
}

const statsStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 12,
  color: 'var(--dsw-alias-label-secondary, #59636e)',
}

const emptyStyle: CSSProperties = {
  padding: '40px 20px', color: 'var(--dsw-alias-label-secondary, #59636e)', fontSize: 13,
}

const turnStyle: CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 6px', paddingLeft: 10,
  fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary, #1f2328)',
}

const turnCountStyle: CSSProperties = {
  fontWeight: 400, fontSize: 12, color: 'var(--dsw-alias-label-secondary, #59636e)',
}

const callListStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))',
  borderRadius: 8, overflow: 'hidden', background: 'var(--dsw-alias-bg-layer-1, transparent)',
}

/** Full props of the Tool History conversation view entry. */
export type ToolHistoryViewProps = ConvViewProps & PropsLocale<typeof NS>

/**
 * Render the Session's root tool calls grouped by Turn, with a floating filter
 * toolbar and a statistics strip over the filtered set. Each row expands into
 * formatted input and output.
 * @param props - conversation view standard hooks and the locale seat.
 * @returns the Tool History ledger, or an empty-state notice.
 */
export function ToolHistoryView({ useToolHistory, t }: ToolHistoryViewProps) {
  const snapshot: ToolHistorySnapshot = useToolHistory(value => value)
  const [kind, setKind] = useState<KindFilter>('all')
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return snapshot.calls.filter((call) => {
      if (kind !== 'all' && call.kind !== kind) return false
      if (onlyFailed && call.status !== 'error') return false
      if (needle !== '' && !call.name.toLowerCase().includes(needle)) return false
      return true
    })
  }, [snapshot.calls, kind, onlyFailed, query])

  const turns = useMemo(() => groupCalls(filtered), [filtered])

  const stats = useMemo(() => {
    let failed = 0
    let skill = 0
    let mcp = 0
    let duration = 0
    for (const call of filtered) {
      if (call.status === 'error') failed += 1
      if (call.kind === 'skill') skill += 1
      if (call.kind === 'mcp') mcp += 1
      duration += call.durationMs ?? 0
    }
    return { total: filtered.length, failed, skill, mcp, duration }
  }, [filtered])

  if (snapshot.calls.length === 0) {
    return <div style={emptyStyle} data-tool-history-empty>{t('empty.noCalls')}</div>
  }

  return (
    <div style={viewRootStyle} data-tool-history-view>
      <div style={headerBarStyle} data-tool-history-header>
        <div style={toolbarStyle} data-tool-history-toolbar>
          {KIND_FILTERS.map(candidate => (
            <button
              key={candidate}
              type="button"
              style={{ ...filterButtonStyle, ...filterButtonActiveStyle(candidate === kind) }}
              aria-pressed={candidate === kind}
              onClick={() => { setKind(candidate) }}
            >
              {t(kindFilterKey[candidate])}
            </button>
          ))}
          <button
            type="button"
            style={{ ...filterButtonStyle, ...filterButtonActiveStyle(onlyFailed) }}
            aria-pressed={onlyFailed}
            onClick={() => { setOnlyFailed(current => !current) }}
          >
            {t('toolbar.onlyFailed')}
          </button>
          <input
            type="search"
            style={searchStyle}
            placeholder={t('toolbar.searchPlaceholder')}
            aria-label={t('toolbar.searchPlaceholder')}
            value={query}
            onChange={(event) => { setQuery(event.target.value) }}
          />
        </div>
        <div style={statsStyle} data-tool-history-stats>
          <span>{t('stats.calls', { count: String(stats.total) })}</span>
          <span>{t('stats.failed', { count: String(stats.failed) })}</span>
          <span>{t('stats.skill', { count: String(stats.skill) })}</span>
          <span>{t('stats.mcp', { count: String(stats.mcp) })}</span>
          <span>{t('stats.duration', { value: formatDuration(stats.duration, t) })}</span>
        </div>
      </div>
      {turns.length === 0
        ? <div style={emptyStyle} data-tool-history-filtered-empty>{t('filter.empty')}</div>
        : turns.map(group => (
          <section key={group.turn}>
            <h2 style={turnStyle}>
              {t('turn.label', { turn: String(group.turn) })}
              <span style={turnCountStyle}>{t('turn.calls', { count: String(group.calls.length) })}</span>
            </h2>
            <div style={callListStyle}>
              {group.calls.map(call => (
                <ToolCallRow key={call.callId} call={call} t={t} />
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}

/** `toolHistory` namespace dictionaries for the Tool History conversation view. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'toolHistory'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'view.title': '工具记录',
  'kind.skill': '技能',
  'kind.mcp': 'MCP',
  'kind.tool': '工具',
  'turn.label': '第 {turn} 轮',
  'turn.calls': '{count} 次调用',
  'status.success': '成功',
  'status.error': '失败',
  'status.running': '进行中',
  'status.interrupted': '已中断',
  'args.empty': '（无参数）',
  'args.more': '…',
  'args.title': '输入',
  'args.truncated': '（已截断）',
  'result.title': '输出',
  'result.empty': '（无输出）',
  'result.truncated': '（已截断）',
  'row.expand': '展开',
  'row.collapse': '收起',
  'toolbar.kind.all': '全部',
  'toolbar.onlyFailed': '只看失败',
  'toolbar.searchPlaceholder': '搜索工具名',
  'stats.calls': '调用 {count}',
  'stats.failed': '失败 {count}',
  'stats.skill': '技能 {count}',
  'stats.mcp': 'MCP {count}',
  'stats.duration': '总耗时 {value}',
  'filter.empty': '没有符合筛选条件的记录',
  'unit.ms': 'ms',
  'unit.s': 's',
  'empty.noCalls': '本会话还没有工具调用',
} as const

/** The Tool History dictionary key union. */
export type ToolHistoryKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Third conversation view: per-turn tool call ledger copy. */
    toolHistory: ToolHistoryKey
  }
}

/** Namespace-bound translator threaded through Tool History presentation code. */
export type ToolHistoryTranslate =
  import('@deepseek-ai/dsh-client-ui-slots').TranslateNS<typeof NS>

/** English dictionary, checked complete against the Chinese source of truth. */
export const en: Record<ToolHistoryKey, string> = {
  'view.title': 'Tool History',
  'kind.skill': 'Skill',
  'kind.mcp': 'MCP',
  'kind.tool': 'Tool',
  'turn.label': 'Turn {turn}',
  'turn.calls': '{count} calls',
  'status.success': 'Success',
  'status.error': 'Failed',
  'status.running': 'Running',
  'status.interrupted': 'Interrupted',
  'args.empty': '(no args)',
  'args.more': '…',
  'args.title': 'Input',
  'args.truncated': '(truncated)',
  'result.title': 'Output',
  'result.empty': '(no output)',
  'result.truncated': '(truncated)',
  'row.expand': 'Expand',
  'row.collapse': 'Collapse',
  'toolbar.kind.all': 'All',
  'toolbar.onlyFailed': 'Failures only',
  'toolbar.searchPlaceholder': 'Search tool name',
  'stats.calls': '{count} calls',
  'stats.failed': '{count} failed',
  'stats.skill': '{count} skill',
  'stats.mcp': '{count} MCP',
  'stats.duration': '{value} total',
  'filter.empty': 'No records match the filters',
  'unit.ms': 'ms',
  'unit.s': 's',
  'empty.noCalls': 'No tool calls in this session yet',
}

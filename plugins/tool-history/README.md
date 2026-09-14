# dsh-client-ui-tool-history

DeepSeek Harness 的 Web 插件：在会话头部新增「工具记录」视图（与 对话 / 轨迹 同排），按轮次列出该会话的**全部工具调用**——skill、MCP 与普通工具——每条记录可展开查看格式化的**输入与输出**，并显示耗时、成功/失败/已中断状态；顶部提供悬浮的筛选条（类别 / 只看失败 / 名称搜索）与统计条。

## 安装

### 从 GitHub 安装（源码安装，子目录）

默认安装默认分支的最新提交：

```sh
# 用引号包住 spec：`&` 在 PowerShell / cmd / bash 里是控制字符
dsh plugin --profile web add "github:<账号>/<仓库>#path:plugins/tool-history"
```

`&path:` 指向本插件在多插件仓库中的子目录（pnpm 的子目录 git spec，已实测可用）。需要内容不可变时再钉 commit：

```sh
dsh plugin --profile web add "github:<账号>/<仓库>#<commit-sha>&path:plugins/tool-history"
```

pnpm ≥10 默认拒绝执行 git 依赖的 `prepare` 脚本，因此**第一次安装会失败**并提示包键。把该键写进 **该 profile 的** `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-client-ui-tool-history: true
```

然后重新执行上面的 `add`。

> `allowBuilds` 等于允许该包在**安装时于你的机器上执行代码**（在 agent 沙箱之外）。请先审阅源码；默认跟踪最新提交会随上游更新，长期使用建议改为钉定 commit。

### 从 tarball 安装（推荐分发方式）

```sh
cd plugins/tool-history
pnpm pack                     # 产出 dsh-client-ui-tool-history-0.1.0.tgz
dsh plugin --profile web add ./dsh-client-ui-tool-history-0.1.0.tgz
```

包内声明了 `dsh.bundle`，安装后组合层会自动激活，**无需手工编辑 cordis.patch.yml**。

## 开发

```sh
pnpm install     # 仓库根执行；安装 esbuild，各插件的 prepare 会自动构建一次
pnpm run build   # 仓库根执行；构建全部插件
node scripts/build-plugin.mjs plugins/tool-history   # 只构建本插件
```

构建由仓库根的 `scripts/build-plugin.mjs` 完成：客户端入口打成 CJS 后包进 DSH 期望的

```js
window.__ModuleLoader__.load({ id, factory: (require) => module.exports })
```

外壳；node 半区打成 ESM。源码中对 DSH 包的导入都是 type-only，因此独立构建不需要它们作为运行依赖。

## 结构

```
src/index.ts                        node 半区（纯模型：UsageTracker / classifyTool）
src/client/index.ts                 插件装配：字典、两个 Definition、视图 target、tab 注册
src/client/tool-history-definition.ts    tool/call + tool/result + turn/end 折叠
src/client/tool-history-snapshot-builder.ts  视图 target 的 builder（含中断判定）
src/client/ToolHistoryView.tsx      纯展示：悬浮筛选条、统计条、按轮次分组的可展开行
src/client/tool-history-contract.ts 快照与节点契约、声明合并
src/client/locales.ts               zh/en 字典
cordis.patch.yml                    组合层：插入本插件行
```

## 已知限制

- **三项产品增强依赖 DSH 侧改动**：tab 排到最后、该视图隐藏输入框、不显示调宽（col-resize）把手，分别依赖 `conversation.view` 的排序与 `noComposer` / `contentColumn` 选项。官方 DSH 尚未包含它们时，插件基础功能正常，但这三项不生效。
- 仅记录 **root** 工具调用（Code Dispatch 子调用不入账）。
- 只采集结果的**文本块**；纯图片结果会显示"（无输出）"。
- 参数超过 100k 字符、输出超过 200k 字符会被截断并标注。
- 只覆盖会话当前已加载的事件窗；本插件不提供"加载更早"控件。
- 无法从记录跳回对话中的对应卡片（上报视图未消费 focus 请求）。
- 尚无单元测试；样式为内联样式（未迁移到 CSS Modules / `--dsw-*` token）。

## 许可

MIT

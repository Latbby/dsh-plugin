# DSH 插件集

DeepSeek Harness 插件的单一代码仓库：`plugins/` 下每个子目录都是一个**可独立安装**的插件包（各自声明 `dsh.client` + `dsh.bundle`），构建与产物格式由根级 `scripts/build-plugin.mjs` 统一负责。

## 插件清单

| 插件 | 包名 | 说明 |
|---|---|---|
| [tool-history](plugins/tool-history/README.md) | `dsh-client-ui-tool-history` | 会话头部的「工具记录」视图：按轮次列出全部工具调用（skill / MCP / 普通），可展开查看格式化输入与输出，含耗时、状态、筛选与统计 |

## 仓库结构

```
.
├─ scripts/build-plugin.mjs     共享构建器（DSH 客户端产物格式的唯一出处）
├─ plugins/
│   └─ tool-history/            每个插件一个独立包
│       ├─ src/                 浏览器半区 src/client/ + node 半区 src/
│       ├─ cordis.patch.yml     该插件的组合层（安装后自动激活）
│       ├─ package.json         dsh.client + dsh.bundle + build/prepare
│       └─ README.md
├─ pnpm-workspace.yaml
└─ package.json                 私有根：workspace 与聚合脚本
```

## 开发

```sh
pnpm install                 # 安装 esbuild 等开发依赖（各插件的 prepare 会自动构建一次）
pnpm run build               # 构建全部插件（等价于逐个执行各自的 build）
node scripts/build-plugin.mjs plugins/tool-history   # 只构建指定插件
```

每个插件的构建产出：

- `lib/client.js` —— 浏览器半区，`window.__ModuleLoader__.load({ id, factory })` 形态；
- `lib/index.js` —— node 半区（ESM）。

`lib/` 是构建产物，已加入 `.gitignore`，不随仓库分发源码提交。

## 新增一个插件

1. `plugins/<name>/` 建目录，放 `src/`（浏览器半区放 `src/client/`）、`cordis.patch.yml`、`README.md`；
2. `package.json` 声明：`name`（必须与 `cordis.patch.yml` 里的 `name` 及产物 `id` 一致）、`type: module`、`exports`（`.` 与 `./client`）、
   `"dsh": { "client": { "platform": "web" }, "bundle": { "patch": "./cordis.patch.yml" } }`、
   `scripts: { "build": "node ../../scripts/build-plugin.mjs .", "prepare": "node ../../scripts/build-plugin.mjs ." }`；
3. `cordis.patch.yml` 写入 `insert` 行（`id` 自取，`name` 用包名）；
4. 在根 README 的插件清单里加一行。

## 安装插件（给使用者）

**从 tarball（推荐）**

```sh
cd plugins/tool-history && pnpm pack
dsh plugin --profile web add ./dsh-client-ui-tool-history-0.1.0.tgz
```

**从 GitHub 源码**（子目录安装，默认取默认分支最新提交）

```sh
# 用引号包住 spec：`&` 在 PowerShell / cmd / bash 里是控制字符
dsh plugin --profile web add "github:<账号>/<仓库>#path:plugins/tool-history"
```

需要内容不可变时（推荐用于第三方代码）再钉 commit：

```sh
dsh plugin --profile web add "github:<账号>/<仓库>#<commit-sha>&path:plugins/tool-history"
```

因为包声明了 `dsh.bundle`，安装成功即自动激活组合层，无需手改 `cordis.patch.yml`。pnpm ≥10 默认拒绝执行 git 依赖的 `prepare`，首次安装会失败并提示包键；把该键写入**该 profile** 的 `pnpm-workspace.yaml`：

```yaml
allowBuilds:
  dsh-client-ui-tool-history: true
```

再重跑安装命令。`allowBuilds` 等于允许该包在安装时于本机执行代码，请先审源码；默认跟踪最新提交会随上游更新，长期使用建议改为钉定 commit。

## 许可

MIT

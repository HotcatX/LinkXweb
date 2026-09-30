# LinkX 极链行网站

纽约 / 新泽西拼车服务的公开网站，以及不在公开导航展示的独立管理后台。公开站保留中文、英文和本地语言记忆，默认明亮主题，可切换并记住深色模式。

## 入口与行为

- `/`：拼车主视觉、方向筛选、参考价格卡、司机发布引导、拼车介绍、二手 / 转租与微信小程序入口。
- `/admin/`：独立管理员登录、批量发布二手 / 转租、修改本批次已发布内容、文字模板、替换群二维码与公告配置。
- 小程序正式名称：**极链行服务**。使用用户提供的 `#小程序://极链行服务/VGD7QITnczTep0F` 分享串。按钮复制完整分享串，引导粘贴到微信聊天后点击打开；另保留名称搜索引导。该分享串不是普通网页 URL，不作为 href。
- 管理员入口隐藏仅指不出现在公开网站导航。所有管理操作仍由服务端验证独立账户和 Bearer 会话，隐藏路径不充当访问控制。

## 本地开发与构建

Node.js >= 22.13。保留原有 Vinext 工程，新增不依赖 Worker 的腾讯云静态构建。公开页在构建时预渲染为完整 HTML，`/admin/index.html` 独立生成，不依赖 SPA fallback。

```sh
npm install
npm --prefix admin install
npm run dev:cloudbase
npm run build:cloudbase
npm run test:cloudbase
npx tsc --noEmit -p tsconfig.cloudbase.json
```

`dev:cloudbase` 默认 `http://127.0.0.1:5174/`。本地后台可单独在 `admin` 运行 `npm run dev`；生产 API 默认只允许正式测试域名，所以本地后台不能直接连接生产 API。不要为方便调试把 CORS 改成 `*`。

产物目录 `dist-cloudbase/` 包含公开页面、图片、主题脚本与 `/admin/`。该目录及依赖不入 Git。原有 `npm run dev`、`npm run build`、`npm test` 保留 Vinext 构建能力；CloudBase 部署使用 `build:cloudbase`。

## 腾讯云托管

静态网站沿用已有云环境 `cloud1-7gmtcu4s3aebce27`，地域 `ap-shanghai`。管理 API 已于 2026-09-30 切换到腾讯云服务器上的业务后端，PostgreSQL 是唯一业务主库；不使用原 Sites 工程的 ChatGPT 登录。

- 静态测试域名：`https://cloud1-7gmtcu4s3aebce27-1383643768.tcloudbaseapp.com/`
- 后台：同域名 `/admin/`
- 管理 API：`https://collect.linkx.ink/api/v1/admin/*`，由相邻小程序仓库 `../wx/services/backend` 实现；后台操作使用独立管理员账户，不接受微信旧六位码或小程序管理令牌。
- 原云函数域名下的 `/admin-api/public-api` 与 `/webHouseShare` 仍保留公开只读用途，分别由 `marketApi` 和 `webHouseShare` 转发到同一 PostgreSQL 后端；旧 `/admin-api` 不再承接管理登录或写入。公开 Worker 继续使用原公开地址。
- 当前配置见 [admin/public/admin-config.js](admin/public/admin-config.js)：`mode: 'backend'`，`backendOrigin: 'https://collect.linkx.ink'`。不存密码、腾讯云密钥或访问令牌。

发布前完成构建与测试。静态上传仅增加 / 更新本站产物，不删除远端未列出的文件，保留 `__auth/`、`adminportal/`、`cloud-admin/` 等现有目录。

```sh
tcb hosting deploy ./dist-cloudbase / -e cloud1-7gmtcu4s3aebce27 -r ap-shanghai --json
```

目前管理站使用 CloudBase 默认托管域名。以后绑定自己的域名后，需同步更新 PostgreSQL `admin_origins` 中的精确 HTTPS origin，并重建 API 配置（若 API 域名也变更）。不要带 `/admin/` 路径或尾斜杠。

## 参考价格

`app/pricing.ts` 使用 2026-09-10 按司机发布记录核验的美元 / 人参考快照：Fort Lee → 哥大 $8–10，哥大 → Fort Lee $8–10，Fort Lee → 法拉盛 $10–15。卡片显示最低参考价；筛选仅筛选这些方向，余座和实际预订仍在小程序内确认。机场整车报价不混入人均价格。

每个方向有 `validUntil`。静态 HTML 不固化数字报价；浏览器确认时间后显示有效参考价，到期显示“查看最新报价”。更新快照时必须重新核验来源，同时调整日期说明和有效期。

## 日常管理

### 批量发布

填写商品 / 转租资料、联系人、区域、日期和图片，再加入待发布列表。最多 50 条、每条最多 6 张图。图片自动压缩并生成缩略图。确认发布后才在小程序展示。

网络异常时保留原批次重试，服务端按账号与请求编号去重。结果尚未确认的记录不能直接改内容或删除，以免重新创建重复商品；确认成功后使用“编辑已发布内容”更新原记录。编辑带版本校验，避免覆盖其他更新。登录失效时保留当前标签页的草稿，重新登录可继续；刷新 / 关闭页签前会提示未保存内容。草稿不长期写入浏览器存储。

网页使用地址和可选经纬度，替代小程序原 `wx.chooseLocation` 选点。未填写坐标时不会伪造位置。常用模板只保留文字与联系人，每次重新选择图片。

### 换群码、改公告

在“群码与公告”上传群二维码原图（JPG/PNG/WebP，2 MB 以内），填写真实到期时间，预览后保存。时间按当前设备时区输入，服务端存带时区的时间。

群码与公告与小程序共用 PostgreSQL `community_configs` 中的 `main` 配置。自动弹窗当前关闭；手动入口仍可查看公告。可热更正文、图片、开启时间、每台设备展示上限与两次间隔。换公告编号才重置次数；单纯修改图片或文字不重置。上一版保存到 `community_revisions`，原图片保留供恢复。

## 账户与安全

管理员密码的初始交付文件由维护者保存在仓库外，不能上传至静态目录或 Git。账号使用 scrypt 摘要；会话 8 小时，仅在 `sessionStorage` 保存随机令牌，服务器只保存其哈希。禁用账号或递增 `credential_version` 可撤销所有现有会话。

数据库配置、账户、会话、限流、审计和历史记录均禁止普通客户端直接读写。`admin_origins` 仅允许准确站点来源；上传检查文件类型、大小和所属账号，发布 / 改公告有审计记录。

更换密码必须由具备业务数据库管理权限的维护者生成新 scrypt 摘要并递增 `credential_version`。前端没有注册入口、密码恢复接口或内置万能密码。

## 设计参考与图片授权

- [BlaBlaCar Belgique](https://www.fr.blablacar.be/)：宽幅主视觉、悬浮方向筛选条、路线图片价格卡与司机介绍的内容顺序。本站实际拼车流程仍由微信小程序承接。
- [NAF Digital / Awwwards Honorable Mention](https://www.awwwards.com/sites/naf-digital)：交通主题摄影与克制的单一强调色。
- [INSULAE / CSS Design Awards Website of the Day](https://www.cssdesignawards.com/sites/insulae/49196/)：简洁排版与分区节奏。未复制其品牌、文案或动画素材。
- `public/bridge.jpg`：[George Washington Bridge from Englewood Basin NJ2](https://commons.wikimedia.org/wiki/File:George_Washington_Bridge_from_Englewood_Basin_NJ2.jpg)，作者 **Acroterion**，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)。使用 Wikimedia 1280px 缩略图，文件未编辑、页面按容器裁切展示；页面页脚链接至完整图片署名与来源页。许可仅适用于该图片，不改变本站源代码的许可。

- `public/columbia.jpg`：Bitterteayen 的 Low Library 校园照片，CC BY-SA 4.0。
- `public/flushing.jpg`：Yanping Nora Soong 的法拉盛街景，CC BY-SA 3.0。
- `public/carpool-hero.png`：为 LinkX 生成的拼车场景示意，不代表真实用户或地点。
- 完整图片来源、作者、许可链接见 `public/image-credits.html`。

原 `.openai/hosting.json` 保留，未创建或发布新的 Sites 项目。当前发布目标以腾讯云 CLI 实际部署与验证结果为准。

## 本次上线验证（2026-09-10）

首版 20 个静态文件上传成功；公开首页、后台入口、脚本和桥景图片均返回 HTTP 200。真实管理 API 已通过未登录拒绝、来源限制、登录、会话、配置读取、登出与失效令牌检查；浏览器预检 OPTIONS 204，原群二维码读取为 HTTP 200 / JPEG。未创建测试商品、未修改已有群码。

原托管目录的 8 个文件保持原 ETag。新网站默认测试地址已开放；生产域名待后续绑定。

### 第二版构建状态

第二版已完成主视觉、方向筛选、路线参考价、LinkX 品牌和小程序分享串交接。静态构建、Vinext 构建、scoped TypeScript、后台 7 项测试及公开页 7 项测试通过。未进行浏览器视觉验收。

第二版已上传成功，24 个线上静态文件与本地产物逐一 SHA-256 一致，使用默认测试域名。

用户将 catx.eu.org 迁移到同一腾讯云账号后，DNSPod 分配了新的 brick.dnspod.net / database.dnspod.net；EU.org 已提交并确认 Nameservers 修改。已添加 CloudBase 归属验证 TXT，并补回迁移前 @ / www → 47.122.47.185、TTL 600。用户确认域名未备案，并决定暂时继续使用腾讯云默认测试域名。暂停自定义域名绑定与 Cloudflare Pages 迁移；未创建 Cloudflare 项目、未申请证书、未新增 API allowedOrigins。EU.org 的 Nameservers 修改已提交，DNS 委派仍需传播。


## 管理后台服务器适配

业务数据和管理员账号已迁移，站点 Origin 已授权；当前源码与线上配置均为 `mode: 'backend'`，`backendOrigin` 为 `https://collect.linkx.ink`（仅 origin，不带路径）。CSP 已允许该域名。目录读 `/api/v1/locations` 的市场地区树，其余请求读写 `/api/v1/admin/*`。不同模式、地址和账号的会话及待发布草稿隔离；旧标签页需刷新并重新登录。

2026-09-30 已按资源文件、配置、HTML 的顺序发布 6 个管理站文件，普通线上 URL 的 SHA-256 与构建产物一致；CORS 预检通过，34 项管理测试通过（含真实隔离 PostgreSQL，零跳过）。本次切换尚未使用生产管理员密码验证成功登录，不能用旧版登录记录替代这项验收。

生产构建为管理配置生成带内容摘要的文件名，并更新 `/admin/index.html` 的引用。托管服务会长时间缓存 JavaScript，不能只覆盖旧的 `admin-config.js` 来切换数据源。先上传新配置和其他静态资源，最后上传引用它们的 HTML；核验正常 URL 返回的 HTML 与配置摘要，旧标签页需重新加载。

后台模式包含商品/转租批次发布、已发布内容版本编辑、文字模板、群码公告版本保存、原始图片上传及 5 分钟签名图片链接更新。待发布快照在发请求之前存入本地；失去响应时保留原行 ID、版本、操作编号和请求内容，刷新页面后可继续核对。保存操作无隐式重试，未知结果不能修改请求后直接重发。原图/缩略图只保存文件 UUID；签名 URL 仅在内存中用于展示，提前刷新并在回到页面或加载失败时更新。浏览器本地存储不可用时阻止新写入，避免丢失重试编号。

旧接口转换和传输仅在 `admin/src/compat/`。它不是网络错误时的自动降级路径。新服务器成为唯一写入方后，不能仅改回 CloudBase 模式就向旧库写入；回退必须先确保旧入口也指向同一个写入方。新版本稳定、旧批次和上传引用完成核对后再删除该目录与 CloudBase 配置。

管理测试：`npm --prefix admin test`；后端联调另需 Node.js 24、相邻后端源码和专用本地 PostgreSQL：

```sh
BACKEND_SOURCE_DIR=/path/to/wx/services/backend \
BACKEND_TEST_DATABASE_URL=postgresql://localhost/test_database \
npm --prefix admin test
```

联调会创建随机测试 schema 并清理，使用合成管理员和内存图片存储，不访问生产 CloudBase、服务器或 COS。未提供上述变量时，联调测试明确标记跳过，不能把它视为实际后端验证。正式部署前仍需核对实际站点 CORS/CSP、管理员登录和数据迁移完成状态。

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

沿用已有个人版云环境 `cloud1-7gmtcu4s3aebce27`，地域 `ap-shanghai`。不新建云函数、不使用原 Sites 工程的 ChatGPT 登录，也不需要常驻服务器。

- 静态测试域名：`https://cloud1-7gmtcu4s3aebce27-1383643768.tcloudbaseapp.com/`
- 后台：同域名 `/admin/`
- 管理 API：`https://cloud1-7gmtcu4s3aebce27-1383643768.ap-shanghai.app.tcloudbase.com/admin-api`
- 处理函数：相邻小程序仓库 `../wx/cloudfunctions/marketApi`。HTTP 路由仅转发到该函数；后台操作不接受微信旧六位码或小程序管理令牌。
- API 地址位于 `admin/public/admin-config.js`。不存密码、腾讯云密钥或访问令牌。

发布前完成构建与测试。静态上传仅增加 / 更新本站产物，不删除远端未列出的文件，保留 `__auth/`、`adminportal/`、`cloud-admin/` 等现有目录。

```sh
tcb hosting deploy ./dist-cloudbase / -e cloud1-7gmtcu4s3aebce27 -r ap-shanghai --json
```

CloudBase 默认域名用于测试。以后绑定自己的域名后，需同步更新 `WebAdminSettings/main.allowedOrigins` 中的精确 HTTPS origin，并重建 API 配置（若 API 域名也变更）。不要带 `/admin/` 路径或尾斜杠。

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

群码与公告复用小程序 `community_config/main`。自动弹窗当前关闭；手动入口仍可查看公告。可热更正文、图片、开启时间、每台设备展示上限与两次间隔。换公告编号才重置次数；单纯修改图片或文字不重置。上一版保存到 `CommunityConfigHistory`，原图片保留供恢复。

## 账户与安全

管理员密码的初始交付文件由维护者保存在仓库外，不能上传至静态目录或 Git。账号使用 scrypt 摘要；会话 8 小时，仅在 `sessionStorage` 保存随机令牌，服务器只保存其哈希。禁用账号或递增 `passwordVersion` 可撤销所有现有会话。

数据库配置、账户、会话、限流、审计和历史记录集合均禁止普通客户端直接读写。`WebAdminSettings/main.allowedOrigins` 仅允许准确站点来源；上传检查文件类型、大小和所属账号，发布 / 改公告有审计记录。

更换密码必须由具备云环境管理权限的维护者生成新 scrypt 摘要并递增 `passwordVersion`。前端没有注册入口、密码恢复接口或内置万能密码。

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

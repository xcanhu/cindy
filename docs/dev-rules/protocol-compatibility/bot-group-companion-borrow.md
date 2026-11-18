# 伙伴群聊借用别人的伙伴（`cindy.companion-borrow` v1）

> 通用规则与 Review 清单见[跨端协议兼容](../protocol-compatibility.md)；本文件只记录这一项能力的协议约定。
> 产品规则见[伙伴群聊](../../product-rules/bot-group-chat.md) §14。

服务端 schema、接口、权限与 relay 均不变。借用请求与回复都是现有 `POST /conversations/:room/messages`
／执行 `complete` 的 `content` 里的单个 `card` 块，`namespace: "cindy.companion-borrow"`、`schemaRevision: 1`，
构造与严格解析只在 `packages/maker-shared/src/botGroupChat.ts` 一处。

- 请求：真人本人发出，`data: { type: "request" }`，`mentions` 只有被借的伙伴 actor；`fallback` 是请求方语言的一句话，
  旧客户端与旧版伙伴主人电脑按普通点名处理（只聊天回复）。识别要求作者是 `human`、`origin` 为空或 `user`、整条消息只有这一张卡、
  不在话题里，且作者就是执行的 `requester_id`。
- 回复：伙伴身份发出，`data` 为 `{ type: "offer", requesterId, link, expiresAt }`（`link` 必须是 `https://…/provider-share/join#…`，
  `expiresAt` 可解析）或 `{ type: "unavailable", requesterId, reason }`，`reason ∈ own | not-allowed | not-shareable | unavailable`，
  未知原因按 `unavailable` 读。真人发的同形卡片不算回复。执行完成体带 `continueDiscussion: false`。
- 读取：`BotGroupMessageView` 追加可选 `companionBorrow: { forMe, link, expiresAt, reason }`；`link` 只投影给 `requesterId` 本人，
  其他人为 `null`。正文仍是卡片 fallback。旧渲染层与手机忽略新字段，只见 fallback。
- IPC：新增 `maker:chat-server:borrowCompanion`（`{ groupId, actorId }` → `{ ok, messageId } | { ok: false, errorCode }`），
  仅本机受信窗口；不进设备互联 allowlist（供应商分享只能在电脑上申请）。新错误码 `BORROW_NOT_ALLOWED`（伙伴没开工具授权）。
- 链接本身沿用供应商分享的一次性邀请与申请／审批合同（`docs/provider-sharing-contract.md`），不新增字段。

// 测试价值 (bot-group-chat.md §14 借来单聊)
// - 生产入口与可观察结果：createCompanionBorrowLink 返回的链接或原因，决定群里那张卡写什么。
// - 规则依据：§14「只借出这台电脑上的供应商；分享没开时说明原因，不当作临时故障」。
// - 现有覆盖缺口：chatServer.test.ts 只用注入的结果，不覆盖选哪条路由和错误归类。
// - 最小失败输入：模型链第一条在另一台电脑上（agentDeviceId），或 create-link 抛 PRECONDITION_FAILED。
// - tier：unit。
import { describe, expect, it, vi } from 'vitest';
import { createIpcError } from '../../../shared/ipc-errors.js';
import { createCompanionBorrowLink } from '../companionBorrow.js';
import type { BotModelRoute } from '../../../shared/botModelChain.js';

const route = (providerId: string, agentDeviceId?: string): BotModelRoute => ({ harness: 'claude', providerId, model: 'm', effort: '', fastMode: false, ...(agentDeviceId ? { agentDeviceId } : {}) });

describe('createCompanionBorrowLink', () => {
  it('lends the first provider on this computer, skipping routes that run elsewhere', async () => {
    const createLink = vi.fn(async () => ({ link: 'https://x/provider-share/join#t', expiresAt: '2026-10-03T00:05:00Z' }));
    const borrow = createCompanionBorrowLink({ readChain: async () => [route('remote', 'other-mac'), route('local')], createLink });
    expect(await borrow({ botId: 'b', assertCurrent: () => {} })).toEqual({ ok: true, link: 'https://x/provider-share/join#t', expiresAt: '2026-10-03T00:05:00Z' });
    expect(createLink).toHaveBeenCalledWith('local', expect.any(Function));
  });

  it.each([
    ['no local provider', [route('remote', 'other-mac')], undefined, 'not-shareable'],
    ['sharing is off', [route('local')], createIpcError('PRECONDITION_FAILED', 'Remote invocation is off'), 'not-shareable'],
    ['the share service fails', [route('local')], createIpcError('DEVICE_LINK_NOT_CONNECTED', 'offline'), 'unavailable'],
  ] as const)('explains why it cannot lend when %s', async (_case, chain, error, reason) => {
    const createLink = vi.fn(async () => { throw error; });
    const borrow = createCompanionBorrowLink({ readChain: async () => [...chain], createLink });
    expect(await borrow({ botId: 'b', assertCurrent: () => {} })).toEqual({ ok: false, reason });
  });

  it('reports a model chain it cannot read as a temporary failure', async () => {
    const createLink = vi.fn();
    const borrow = createCompanionBorrowLink({ readChain: async () => { throw new Error('db busy'); }, createLink });
    expect(await borrow({ botId: 'b', assertCurrent: () => {} })).toEqual({ ok: false, reason: 'unavailable' });
    expect(createLink).not.toHaveBeenCalled();
  });

  it('stops instead of answering when the turn went stale while the link was made', async () => {
    let stale = false;
    const borrow = createCompanionBorrowLink({ readChain: async () => [route('local')],
      createLink: async () => { stale = true; throw new Error('network'); } });
    await expect(borrow({ botId: 'b', assertCurrent: () => { if (stale) throw new Error('STALE_EXECUTOR'); } })).rejects.toThrow('STALE_EXECUTOR');
  });
});

/**
 * 借来单聊 (bot-group-chat.md §14) on the companion's home computer: when a member the owner lets use
 * this companion's tools asks to borrow it, create a provider-share link for the provider the
 * companion runs on. It is the owner's ordinary 分享 link, so the member still has to apply and the
 * owner still confirms the pairing code; the task then runs on the member's computer with the
 * owner's model and quota (provider-sharing.md §1). Nothing here grants access by itself.
 */
import type { BotModelRoute } from '../../shared/botModelChain.js';

export type CompanionBorrowLinkResult =
  | { ok: true; link: string; expiresAt: string }
  | { ok: false; reason: 'not-shareable' | 'unavailable' };

export interface CompanionBorrowLinkDeps {
  /** The companion's effective model chain, first route first. */
  readChain(botId: string): Promise<BotModelRoute[]>;
  /** The owner's own 分享 link for this provider; throws `PRECONDITION_FAILED` while sharing is off. */
  createLink(providerId: string, assertCurrent: () => void): Promise<{ link: string; expiresAt: string }>;
}

const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;

export function createCompanionBorrowLink(deps: CompanionBorrowLinkDeps) {
  return async ({ botId, assertCurrent }: { botId: string; assertCurrent: () => void }): Promise<CompanionBorrowLinkResult> => {
    const chain = await deps.readChain(botId).catch(() => []);
    assertCurrent();
    // Only a provider on this computer can be shared from here: a route that already runs on another
    // computer (or on someone else's share) is not this owner's to lend from this machine.
    const route = chain.find(item => !item.agentDeviceId && !!item.providerId);
    if (!route?.providerId) return { ok: false, reason: 'not-shareable' };
    try {
      const created = await deps.createLink(route.providerId, assertCurrent);
      assertCurrent();
      return { ok: true, link: created.link, expiresAt: created.expiresAt };
    } catch (error) {
      // A turn that went stale must stop, not answer.
      assertCurrent();
      return { ok: false, reason: errorCode(error) === 'PRECONDITION_FAILED' ? 'not-shareable' : 'unavailable' };
    }
  };
}

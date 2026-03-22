import { createAuthScaffold } from "./auth.js";
import { ILinkClient } from "./client.js";
import { describeCryptoScaffold } from "./crypto.js";
import { createMediaScaffold } from "./media.js";
import { createPollingScaffold } from "./polling.js";
import { createSendScaffold } from "./send.js";
import { createSessionScaffold } from "./session.js";
import { createStoreScaffold } from "./store.js";

export * from "./auth.js";
export * from "./client.js";
export * from "./crypto.js";
export * from "./media.js";
export * from "./polling.js";
export * from "./send.js";
export * from "./session.js";
export * from "./store.js";
export * from "./types.js";

export function createCoreScaffold() {
  return {
    client: new ILinkClient().describe(),
    auth: createAuthScaffold(),
    polling: createPollingScaffold(),
    send: createSendScaffold(),
    media: createMediaScaffold(),
    crypto: describeCryptoScaffold(),
    session: createSessionScaffold(),
    store: createStoreScaffold()
  };
}

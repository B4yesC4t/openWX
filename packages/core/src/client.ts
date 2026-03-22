import { createScaffoldModule, type ScaffoldModule } from "./types.js";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";

export interface ILinkClientOptions {
  readonly baseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly token?: string;
}

export class ILinkClient {
  readonly packageName = "@openwx/core";
  readonly options: Required<ILinkClientOptions>;

  constructor(options: ILinkClientOptions = {}) {
    this.options = {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      cdnBaseUrl: options.cdnBaseUrl ?? DEFAULT_CDN_BASE_URL,
      token: options.token ?? ""
    };
  }

  describe(): ScaffoldModule {
    return createScaffoldModule(this.packageName, [
      "HTTP transport and auth flow land in follow-up issues.",
      `Default API base: ${this.options.baseUrl}`,
      `Default CDN base: ${this.options.cdnBaseUrl}`
    ]);
  }
}

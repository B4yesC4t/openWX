import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

export interface HttpProxyConnectorOptions {
  readonly url: string;
}

export function createHttpProxyConnector(
  options: HttpProxyConnectorOptions
): Connector {
  return {
    id: "@openwx/connector-http-proxy",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      return {
        text: `[http-proxy:${options.url}] ${request.text}`
      };
    }
  };
}

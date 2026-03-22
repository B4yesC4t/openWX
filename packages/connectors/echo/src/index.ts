import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

export function createEchoConnector(): Connector {
  return {
    id: "@openwx/connector-echo",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      return {
        text: `Echo: ${request.text}`
      };
    }
  };
}

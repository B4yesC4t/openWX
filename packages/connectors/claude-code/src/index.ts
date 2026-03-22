import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

export interface ClaudeCodeConnectorOptions {
  readonly systemPrompt?: string;
}

export function createClaudeCodeConnector(
  options: ClaudeCodeConnectorOptions = {}
): Connector {
  return {
    id: "@openwx/connector-claude-code",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      const prefix = options.systemPrompt ? `[${options.systemPrompt}] ` : "";

      return {
        text: `${prefix}${request.text}`
      };
    }
  };
}

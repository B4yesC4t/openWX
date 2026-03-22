# @openwx/hub

Routing and configuration scaffold for multi-application openWX deployments.

## Install

```bash
pnpm add @openwx/hub
```

## API

- `defineHubConfig(config)`: type-safe route declaration helper
- `createRouter(config)`: returns a lightweight router scaffold summary
- `createHubScaffold(config)`: bundles config and router metadata

## Example

```ts
import { createHubScaffold, defineHubConfig } from "@openwx/hub";

const config = defineHubConfig({
  routes: [
    {
      prefix: "/ops",
      target: { type: "http", url: "https://example.internal/openwx" }
    }
  ],
  defaultRoute: { type: "connector", name: "@openwx/connector-echo" }
});

const hub = createHubScaffold(config);
console.log(hub.router.routeCount);
```

## Route Targets

- `connector`: send traffic to a named connector package
- `http`: send traffic to an upstream HTTP endpoint
- `command`: send traffic to a local command runner

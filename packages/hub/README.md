# @openwx/hub

Routing and configuration runtime for multi-application openWX deployments.

## Install

```bash
pnpm add @openwx/hub
```

## API

- `defineHubConfig(config)`: type-safe route declaration helper
- `createRouter(config)`: builds the ordered route matcher
- `describeHub(config)`: returns config plus router metadata for inspection
- `createHub(config)`: creates the runnable hub runtime

`createHub()` loads connector packages by `handler` name using the convention
`@openwx/connector-${handler}`. Those packages must be installed in the app
that runs the hub.

## Example

```ts
import { defineHubConfig, describeHub } from "@openwx/hub";

const config = defineHubConfig({
  routes: [
    {
      prefix: "/ops",
      handler: "http-proxy",
      config: { endpoint: "https://example.internal/openwx" }
    }
  ]
});

const hub = describeHub(config);
console.log(hub.router.routeCount);
```

## Route Matchers

- `prefix`: match a leading command and optionally strip it before dispatch
- `keywords`: match when any configured keyword is present
- `users`: pin specific WeChat user IDs to one handler
- `pattern`: match a validated regular expression
- `default`: fallback route when nothing else matches

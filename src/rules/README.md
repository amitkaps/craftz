# Rules

The checks and fixes of [the rules](../../docs/rules.md), one module for each part of them. [rules.ts](../rules.ts) joins them in the doc's order, and [shared.ts](shared.ts) holds what more than one of them writes with. A rule is in the module of the part its id starts with, like `versions-node` in [versions.ts](versions.ts).

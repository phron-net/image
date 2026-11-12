/**
 * The napi-rs addon, loaded through the generated `native.cjs` (it picks the platform package,
 * `@phron/image-<platform>`, or a local `.node` file in development). The addon is generated at
 * build time and is not in version control.
 */
import { createRequire } from "node:module";
import type * as Native from "../native.d.cts";

const require = createRequire(import.meta.url);

export const native: typeof Native = require("../native.cjs");

export * from "./packet";
export * from "./parser";
export * from "./client";

import { shellMain } from "./shell";

if (require.main === module) {
	shellMain().then(() => process.exit(0));
}
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
			{ find: "@tenex/types/events", replacement: fileURLToPath(new URL("../packages/types/src/events", import.meta.url)) },
			{ find: "@tenex/types", replacement: fileURLToPath(new URL("../packages/types/src", import.meta.url)) },
			{ find: "@tenex/shared", replacement: fileURLToPath(new URL("../shared/src", import.meta.url)) },
		],
	},
	optimizeDeps: {
		exclude: ["@nostr-dev-kit/ndk-cache-sqlite-wasm"],
	},
	server: {
		fs: {
			allow: [".."],
		},
	},
});

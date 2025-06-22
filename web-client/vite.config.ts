import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: [
			{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
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

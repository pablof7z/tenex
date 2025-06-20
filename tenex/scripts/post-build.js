#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Create the bin directory if it doesn't exist
const binDir = path.join(projectRoot, "bin");
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir);
}

// Create the Node.js compatible CLI entry point
const cliContent = `#!/usr/bin/env node
import '../dist/cli.js';
`;

fs.writeFileSync(path.join(binDir, "tenex.js"), cliContent, { mode: 0o755 });

console.log("✅ Created Node.js CLI entry point");

// Copy package.json to dist for proper module resolution
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

// Remove scripts and devDependencies for the published version
packageJson.scripts = undefined;
packageJson.devDependencies = undefined;

// Update paths for workspace dependencies if they're published separately
// For now, we'll keep them as is but you may want to publish them separately
fs.writeFileSync(
    path.join(projectRoot, "dist", "package.json"),
    JSON.stringify(packageJson, null, 2)
);

console.log("✅ Copied package.json to dist");

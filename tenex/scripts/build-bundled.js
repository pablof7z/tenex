#!/usr/bin/env bun

/**
 * build-bundled.js - Creates a bundled build of TENEX CLI for npm publishing
 *
 * This is the primary build script used for creating the npm package.
 * It bundles all workspace dependencies (@tenex/*) into a single output file
 * while keeping external npm dependencies as runtime requirements.
 *
 * Key features:
 * - Bundles all @tenex/* workspace packages into the output
 * - Keeps external npm dependencies as external (not bundled)
 * - Removes workspace dependencies from the published package.json
 * - Creates a standalone package that doesn't require workspace setup
 *
 * Usage: bun scripts/build-bundled.js (or npm run build)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { $ } from "bun";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Clean dist directory
const distDir = path.join(projectRoot, "dist");
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

console.log("🔨 Building TENEX CLI with bundled dependencies...");

// Build with Bun, bundling workspace dependencies
try {
    // Create a list of external dependencies (only non-workspace ones)
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    const externalDeps = Object.keys(packageJson.dependencies || {})
        .filter(
            (dep) =>
                !dep.startsWith("@tenex/") && !packageJson.dependencies[dep].startsWith("file:")
        )
        .join(",");

    // Bundle the CLI with workspace dependencies included
    await $`bun build ${projectRoot}/src/tenex.ts --outdir ${distDir} --target node --format esm --external ${externalDeps}`;

    // Build browser-compatible exports
    await $`bun build ${projectRoot}/src/browser.ts --outdir ${distDir} --target browser --format esm --external @nostr-dev-kit/ndk`;
    console.log("✅ Built CLI with bundled workspace dependencies");
} catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
}

// Rename output file
if (fs.existsSync(path.join(distDir, "tenex.js"))) {
    fs.renameSync(path.join(distDir, "tenex.js"), path.join(distDir, "index.js"));
}

// Create type definitions (best effort)
try {
    await $`tsc -p ${projectRoot}/tsconfig.build.json --emitDeclarationOnly || true`;
    console.log("✅ Generated type definitions (partial)");
} catch {
    console.log("⚠️  Could not generate complete type definitions");
}

// Create package.json for dist (without workspace dependencies)
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));

// Filter out workspace dependencies
const filteredDependencies = {};
for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
    if (!version.startsWith("file:") && !name.startsWith("@tenex/")) {
        filteredDependencies[name] = version;
    }
}

// Create a minimal package.json for publishing
const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: "./index.js",
    type: "module",
    bin: {
        tenex: "./cli.js",
    },
    dependencies: filteredDependencies,
    engines: packageJson.engines,
    publishConfig: packageJson.publishConfig,
    keywords: ["tenex", "cli", "ai", "development", "nostr"],
    author: packageJson.author || "",
    license: packageJson.license || "MIT",
    repository: packageJson.repository || {
        type: "git",
        url: "https://github.com/pablolibre/tenex",
    },
};

fs.writeFileSync(path.join(distDir, "package.json"), JSON.stringify(distPackageJson, null, 2));

// Create the CLI wrapper with proper Node.js shebang
const cliWrapperContent = `#!/usr/bin/env node
import './index.js';
`;

fs.writeFileSync(path.join(distDir, "cli.js"), cliWrapperContent, { mode: 0o755 });

console.log("✅ Created CLI wrapper");

// Copy README if it exists
const readmePath = path.join(projectRoot, "README.md");
if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, path.join(distDir, "README.md"));
    console.log("✅ Copied README.md");
}

// Create a basic README if none exists
if (!fs.existsSync(readmePath)) {
    const basicReadme = `# @tenex/cli

TENEX Command Line Interface - A context-first development environment that orchestrates multiple AI agents to build software collaboratively.

## Installation

\`\`\`bash
npm install -g @tenex/cli
# or
npx @tenex/cli
\`\`\`

## Usage

\`\`\`bash
# Start the daemon
tenex daemon

# Initialize a project
tenex project init <path> <naddr>

# Run a project
tenex project run
\`\`\`

For more information, visit https://github.com/pablolibre/tenex
`;

    fs.writeFileSync(path.join(distDir, "README.md"), basicReadme);
    console.log("✅ Created README.md");
}

console.log("\n📦 Build complete! Package ready in ./dist");
console.log("\nWorkspace dependencies have been bundled into the output.");
console.log("\nTo publish:");
console.log("  cd dist");
console.log("  npm publish");

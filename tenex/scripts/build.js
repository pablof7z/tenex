#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Clean dist directory
const distDir = path.join(projectRoot, "dist");
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir);

// Build the CLI
await esbuild.build({
  entryPoints: [path.join(projectRoot, "src/cli.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: path.join(distDir, "cli.js"),
  packages: "external",
  loader: {
    ".ts": "ts",
  },
  sourcemap: true,
  minify: false,
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
`,
  },
});

console.log("✅ Built CLI entry point");

// Create type definitions (best effort, ignore errors)
try {
  const { execSync } = await import("child_process");
  execSync("tsc -p tsconfig.build.json --emitDeclarationOnly", { stdio: "inherit" });
  console.log("✅ Generated type definitions");
} catch (error) {
  console.log("⚠️  Could not generate type definitions (this is okay for npm publishing)");
}

// Copy package.json (without scripts and devDependencies)
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
delete packageJson.scripts;
delete packageJson.devDependencies;

// Update bin path to compiled version
packageJson.bin = {
  tenex: "./bin/tenex.js",
};

fs.writeFileSync(path.join(distDir, "package.json"), JSON.stringify(packageJson, null, 2));

console.log("✅ Created dist/package.json");

// Create the bin directory and CLI wrapper
const binDir = path.join(projectRoot, "bin");
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
}

const cliWrapperContent = `#!/usr/bin/env node
import '../dist/cli.js';
`;

fs.writeFileSync(path.join(binDir, "tenex.js"), cliWrapperContent, { mode: 0o755 });

console.log("✅ Created bin/tenex.js wrapper");

// Copy README if it exists
const readmePath = path.join(projectRoot, "README.md");
if (fs.existsSync(readmePath)) {
  fs.copyFileSync(readmePath, path.join(distDir, "README.md"));
  console.log("✅ Copied README.md");
}

console.log("\n📦 Build complete! Package is ready for publishing.");

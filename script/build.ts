import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

const allowlist = [
  "@anthropic-ai/sdk",
  "@neondatabase/serverless",
  "drizzle-orm",
  "drizzle-zod",
  "exceljs",
  "express",
  "nanoid",
  "ws",
  "zod",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  const commonOptions = {
    platform: "node" as const,
    bundle: true,
    define: {
      "import.meta.url": "importMetaUrl",
    },
    banner: {
      js: `const importMetaUrl = require("url").pathToFileURL(__filename).href;`,
    },
    minify: true,
    external: externals,
    logLevel: "info" as const,
  };

  await esbuild({
    ...commonOptions,
    entryPoints: ["server/index.ts"],
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      ...commonOptions.define,
      "process.env.NODE_ENV": '"production"',
    },
  });

  // Build Vercel serverless API function (pre-bundled so Vercel doesn't compile TS)
  console.log("building api function...");
  await esbuild({
    ...commonOptions,
    entryPoints: ["server/api-handler.ts"],
    format: "esm",
    outfile: "api/index.mjs",
    banner: { js: "" },
    define: {
      "import.meta.url": "import.meta.url",
    },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

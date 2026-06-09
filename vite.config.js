import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));
const ignoredDirs = new Set(["node_modules", "dist", ".git", ".vscode"]);

function collectHtmlFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        collectHtmlFiles(join(dir, entry.name), found);
      }
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      found.push(join(dir, entry.name));
    }
  }

  return found;
}

function collectBuiltHtmlFiles(dir, found = []) {
  if (!existsSync(dir)) return found;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const entryPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      collectBuiltHtmlFiles(entryPath, found);
      continue;
    }

    if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      found.push(entryPath);
    }
  }

  return found;
}

function restoreLegacyStylesheetOrder() {
  for (const filePath of collectBuiltHtmlFiles(resolve(rootDir, "dist"))) {
    const html = readFileSync(filePath, "utf8");
    const sideBarLinks = html.match(
      /\s*<link[^>]+href="\/assets\/sideBar-[^"]+\.css"[^>]*>\s*/g
    );

    if (!sideBarLinks || sideBarLinks.length === 0) continue;

    let nextHtml = html;
    for (const link of sideBarLinks) {
      nextHtml = nextHtml.replace(link, "\n");
    }

    const firstInlineStyleIndex = nextHtml.indexOf("    <style>");
    if (firstInlineStyleIndex === -1) {
      nextHtml = nextHtml.replace("</head>", `${sideBarLinks.join("")}</head>`);
    } else {
      nextHtml =
        nextHtml.slice(0, firstInlineStyleIndex) +
        sideBarLinks.join("") +
        nextHtml.slice(firstInlineStyleIndex);
    }

    writeFileSync(filePath, nextHtml, "utf8");
  }
}

const htmlEntries = Object.fromEntries(
  collectHtmlFiles(rootDir).map((filePath) => [
    relative(rootDir, filePath).replace(/\\/g, "/").replace(/\.html$/i, ""),
    filePath,
  ])
);

const staticRuntimePaths = [
  "img",
  "shared",
  "pages/general_files",
  "pages/installer_pages/css_files",
  "pages/admin_pages/css_files",
  "pages/customer_pages/css_files",
  "enroll/course-images",
  "Steqyy_model.2048",
  "Steqyy_model.cdi3.json",
  "Steqyy_model.moc3",
  "Steqyy_model.model3.json",
];

export default defineConfig({
  plugins: [
    {
      name: "copy-static-runtime-files",
      closeBundle() {
        for (const runtimePath of staticRuntimePaths) {
          const source = resolve(rootDir, runtimePath);
          const target = resolve(rootDir, "dist", runtimePath);

          if (existsSync(source)) {
            rmSync(target, { recursive: true, force: true });
            cpSync(source, target, { recursive: true });
          }
        }

        restoreLegacyStylesheetOrder();
      },
    },
  ],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: "dist",
    target: "esnext",
    rollupOptions: {
      input: htmlEntries,
    },
  },
  resolve: {
    alias: {
      "@": resolve(rootDir),
    },
  },
});

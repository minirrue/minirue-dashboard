#!/usr/bin/env node
// story-sync-selfcheck.mjs — RULEBOOK §29, vendored INTO each code repo (not run from {project}-us).
//
// This is the root-kill: it diffs THIS repo's own real routes against THIS repo's own committed
// story-manifest.json (emitted by {project}-us's generate-vault.ts and committed alongside code).
// No cross-repo checkout is required to verify — the story's shadow travels with the code. Copy
// this file (and keep it in sync) into each code repo's scripts/ dir; wire it into that repo's
// package.json + pre-push hook + CI workflow (see _main/_templates/ci/story-sync.code-repo.yml and
// _main/_templates/hooks/pre-push).
//
// Zero-dependency for a Next.js-shaped app (page.tsx/route.ts walk is plain regex/fs). For a
// backend-shaped app (src/**/*.controller.ts), dynamically imports this repo's OWN `typescript`
// devDependency — never installs one itself. If a repo is both shapes (rare), both are checked.
//
// Usage: node scripts/story-sync-selfcheck.mjs
// Exit codes: 0 = clean (or fully allowlisted). 1 = MISSING and/or STALE found, or manifest missing.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const appName = path.basename(repoRoot);

function normalizeParams(p) {
  return p.split("/").map((seg) => (seg.startsWith(":") ? ":param" : seg)).join("/");
}

function joinPath(...parts) {
  const joined = parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return "/" + joined;
}

function walkFiles(dir, matcher, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, matcher, out);
    else if (matcher(entry.name)) out.push(full);
  }
  return out;
}

// ---- backend (AST via this repo's own `typescript` dep) ----------------------------------------

async function enumerateBackendRoutes() {
  const srcDir = path.join(repoRoot, "src");
  if (!fs.existsSync(srcDir)) return new Set();
  const controllerFiles = walkFiles(srcDir, (f) => f.endsWith(".controller.ts"));
  if (controllerFiles.length === 0) return new Set();

  let ts;
  try {
    ({ default: ts } = await import("typescript"));
  } catch {
    console.warn("story-sync-selfcheck: *.controller.ts files found but `typescript` is not installed — skipping backend route enumeration.");
    return new Set();
  }

  const mainTs = path.join(srcDir, "main.ts");
  let prefix = "";
  if (fs.existsSync(mainTs)) {
    const content = fs.readFileSync(mainTs, "utf8");
    // Two real NestJS prefix mechanisms seen in the wild — check both, prefer whichever is present:
    const explicit = content.match(/setGlobalPrefix\(\s*['"]([^'"]+)['"]/);
    if (explicit) prefix = explicit[1];
    else {
      const versioned = content.match(/enableVersioning\([\s\S]*?defaultVersion:\s*['"]([^'"]+)['"]/);
      if (versioned) prefix = `v${versioned[1]}`;
    }
  }

  const HTTP_METHOD_DECORATORS = new Set(["Get", "Post", "Put", "Patch", "Delete", "All"]);
  const tokens = new Set();

  function firstStringLiteralArg(node) {
    if (!ts.isCallExpression(node.expression)) return "";
    const arg = node.expression.arguments[0];
    if (!arg) return "";
    if (ts.isStringLiteral(arg)) return arg.text;
    return null;
  }
  function decoratorName(node) {
    const expr = node.expression;
    const callee = ts.isCallExpression(expr) ? expr.expression : expr;
    return ts.isIdentifier(callee) ? callee.text : null;
  }

  for (const file of controllerFiles) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isClassDeclaration(node)) {
        const classDecorators = ts.getDecorators?.(node) ?? [];
        // undefined = no @Controller on this class (not a controller, skip). null = @Controller
        // present but arg isn't a string literal (unresolvable, skip). string = resolvable base.
        let base;
        for (const d of classDecorators) {
          if (decoratorName(d) === "Controller") base = firstStringLiteralArg(d);
        }
        if (base === undefined || base === null) return;
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member)) continue;
          const methodDecorators = ts.getDecorators?.(member) ?? [];
          for (const d of methodDecorators) {
            const name = decoratorName(d);
            if (!name || !HTTP_METHOD_DECORATORS.has(name)) continue;
            const methodPath = firstStringLiteralArg(d);
            if (methodPath === null) continue;
            const fullPath = normalizeParams(joinPath(prefix, base, methodPath));
            const httpMethod = name === "All" ? "ALL" : name.toUpperCase();
            tokens.add(`${appName} ${httpMethod} ${fullPath}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return tokens;
}

// ---- Next.js App Router (zero-dep) ---------------------------------------------------------------

const HTTP_METHOD_EXPORT_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*[=:]/g;

function fileRouteToPath(relFile) {
  const noFile = relFile.replace(/(^|\/)(page|route)\.tsx?$/, "");
  const segments = noFile
    .split("/")
    .filter((seg) => seg && !/^\(.*\)$/.test(seg))
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg) || /^\[\[\.\.\..+\]\]$/.test(seg)) return ":param";
      if (/^\[.+\]$/.test(seg)) return ":param";
      return seg;
    });
  return segments.length ? "/" + segments.join("/") : "/";
}

function enumeratePageRoutes() {
  const appRouterDir = path.join(repoRoot, "app");
  const tokens = new Set();
  if (!fs.existsSync(appRouterDir)) return tokens;
  for (const file of walkFiles(appRouterDir, (f) => f === "page.tsx" || f === "page.ts")) {
    const rel = path.relative(appRouterDir, file).replace(/\\/g, "/");
    tokens.add(`${appName} PAGE ${fileRouteToPath(rel)}`);
  }
  for (const file of walkFiles(appRouterDir, (f) => f === "route.ts" || f === "route.tsx")) {
    const rel = path.relative(appRouterDir, file).replace(/\\/g, "/");
    const routePath = fileRouteToPath(rel);
    const content = fs.readFileSync(file, "utf8");
    const methods = new Set();
    let m;
    HTTP_METHOD_EXPORT_RE.lastIndex = 0;
    while ((m = HTTP_METHOD_EXPORT_RE.exec(content)) !== null) methods.add(m[1] ?? m[2]);
    if (methods.size === 0) tokens.add(`${appName} PAGE ${routePath}`);
    else for (const method of methods) tokens.add(`${appName} ${method} ${routePath}`);
  }
  return tokens;
}

// ---- manifest + allowlist ------------------------------------------------------------------------

const manifestPath = path.join(repoRoot, "story-manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`story-sync-selfcheck FAILED: no story-manifest.json at repo root. Run {project}-us's ` +
    `generate-vault.ts to emit it (RULEBOOK §29), then commit it alongside this repo's code.`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const storyRoutes = new Set();
const storyByRoute = new Map();
for (const entry of manifest) {
  for (const token of entry.routes ?? []) {
    storyRoutes.add(token);
    if (!storyByRoute.has(token)) storyByRoute.set(token, []);
    storyByRoute.get(token).push(entry.id);
  }
}

const allowlistPath = path.join(repoRoot, "story-sync.allowlist.txt");
const allowlist = new Set(
  fs.existsSync(allowlistPath)
    ? fs.readFileSync(allowlistPath, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    : []
);

const realRoutes = new Set([...(await enumerateBackendRoutes()), ...enumeratePageRoutes()]);

const missing = [...realRoutes].filter((r) => !storyRoutes.has(r) && !allowlist.has(r)).sort();
const stale = [...storyRoutes].filter((r) => !realRoutes.has(r) && !allowlist.has(r)).sort();

console.log(`story-sync-selfcheck (${appName}): ${realRoutes.size} real route(s), ${storyRoutes.size} manifest route(s), ${allowlist.size} allowlisted.`);

if (missing.length > 0) {
  console.error(`\nMISSING — real route(s) with no citing story (${missing.length}):`);
  for (const r of missing) console.error(`  - ${r}`);
}
if (stale.length > 0) {
  console.error(`\nSTALE — manifest route(s) with no matching real route (${stale.length}):`);
  for (const r of stale) console.error(`  - ${r}  (cited by: ${storyByRoute.get(r).join(", ")})`);
}

if (missing.length > 0 || stale.length > 0) {
  console.error(
    `\nstory-sync-selfcheck FAILED. Fix: update the citing story in {project}-us and regenerate ` +
      `this manifest, or add a reviewed line to story-sync.allowlist.txt (§29) if intentional.`
  );
  process.exit(1);
}

console.log("story-sync-selfcheck: clean.");

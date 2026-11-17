#!/usr/bin/env node
// Content diff between two versions of index.html:  node tools/content-diff.mjs <A> [B]
// Each arg is a file path or git ref (git show <ref>:index.html). Default B = index.html.
// Exit 0 = no content changes, 1 = differences found (or error).
import { readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

const A = process.argv[2], B = process.argv[3] || "index.html";
if (!A) { console.error("usage: node tools/content-diff.mjs <A> [B]"); process.exit(2); }

function loadHtml(ref) {
  if (existsSync(ref)) return readFileSync(ref, "utf8");
  try {
    return execFileSync("git", ["show", `${ref}:index.html`], { maxBuffer: 64e6 }).toString("utf8");
  } catch (e) { console.error(`ERROR: cannot load "${ref}" (not a file, git show failed)`); process.exit(2); }
}

// Boot one version headless with a minimal DOM stub (same approach as check.mjs).
function boot(html, label) {
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) { console.error(`ERROR: no inline <script> found in ${label}`); process.exit(2); }
  const el = () => new Proxy({ style: {}, classList: { add() {}, remove() {}, toggle() {} } },
    { get: (t, k) => k in t ? t[k] : (typeof k === "string" && /^(add|remove|set|get|focus|scroll|click|append|insert)/.test(k) ? () => null : undefined),
      set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ctx = {
    console, Math, Date, JSON, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    location: { hash: "" },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), createElement: () => el(), addEventListener() {}, body: el(), documentElement: el() },
    addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: "node" },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const expose = `;globalThis.__D={};["LESSONS","CASES","CARDS","FIGCARDS","SPICK","SRC","ATLAS","MODULES","OLD"].forEach(function(k){try{globalThis.__D[k]=eval(k)}catch(e){}});`;
  try { vm.runInContext(m[1] + expose, ctx, { filename: label }); }
  catch (e) { console.error(`RUNTIME ERROR at boot (${label}):`, e.stack.split("\n").slice(0, 3).join("\n")); process.exit(2); }
  return ctx.__D;
}

const DA = boot(loadHtml(A), A);
const DB = boot(loadHtml(B), B);

// JSON-serialise so the comparison is over plain data (functions/undefined dropped).
const norm = v => JSON.parse(JSON.stringify(v ?? null));

// Collect differing leaf paths (e.g. blocks[3].p, check[0].o[2]).
function leafPaths(a, b, prefix, out) {
  if (a === b) return;
  const oa = a !== null && typeof a === "object", ob = b !== null && typeof b === "object";
  if (!oa || !ob) { out.push(prefix); return; }
  const ia = Array.isArray(a), ib = Array.isArray(b);
  if (ia !== ib) { out.push(prefix); return; }
  if (ia) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const p = `${prefix}[${i}]`;
      if (i >= a.length || i >= b.length) out.push(p); else leafPaths(a[i], b[i], p, out);
    }
  } else {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (!(k in a) || !(k in b)) out.push(p); else leafPaths(a[k], b[k], p, out);
    }
  }
}

const fmt = v => {
  if (v === undefined) return "<missing>";
  let s;
  try { s = typeof v === "string" ? v : JSON.stringify(v); } catch { s = String(v); }
  s = s.replace(/\s+/g, " ");
  return s.length > 200 ? s.slice(0, 197) + "…" : s;
};

const cardsOf = D => [...D.CARDS, ...D.FIGCARDS.filter(f => !D.CARDS.includes(f))];
const groups = [
  ["lesson", DA.LESSONS, DB.LESSONS, x => x.id],
  ["case",   DA.CASES,   DB.CASES,   x => x.id],
  ["card",   cardsOf(DA), cardsOf(DB), x => x.id],
  ["spick",  DA.SPICK,   DB.SPICK,   x => x.mod + "|" + x.h],
  ["atlas",  DA.ATLAS,   DB.ATLAS,   x => x.id],
  ["src",    DA.SRC ?? {}, DB.SRC ?? {}, null],
  ["old",    DA.OLD ?? {}, DB.OLD ?? {}, null],
  ["module", DA.MODULES, DB.MODULES, x => x.n],
];

let added = 0, removed = 0, changed = 0;
for (const [name, arrA, arrB, keyOf] of groups) {
  const isObj = !Array.isArray(arrA);
  const itemsA = isObj ? Object.entries(arrA) : arrA.map((v, i) => [keyOf(v), norm(v)]);
  const itemsB = isObj ? Object.entries(arrB) : arrB.map((v, i) => [keyOf(v), norm(v)]);
  const mapA = new Map(itemsA.map(([k, v]) => [k, norm(v)]));
  const mapB = new Map(itemsB.map(([k, v]) => [k, norm(v)]));
  for (const [k] of itemsA) {
    if (!mapB.has(k)) { console.log(`- removed ${name} ${k}`); removed++; continue; }
    const paths = []; leafPaths(mapA.get(k), mapB.get(k), "", paths);
    if (paths.length) {
      changed++;
      console.log(`~ changed ${name} ${k}: ${paths.join(", ")}`);
      for (const p of paths) {
        console.log(`    A: ${fmt(getAt(mapA.get(k), p))}`);
        console.log(`    B: ${fmt(getAt(mapB.get(k), p))}`);
      }
    }
  }
  for (const [k] of itemsB) if (!mapA.has(k)) { console.log(`+ added ${name} ${k}`); added++; }
}

// Read a value at a leaf path like t2 / blocks[3].p / check[0].o[2] (for A:/B: lines).
function getAt(obj, path) {
  let cur = obj;
  const m0 = path.match(/^[^.[]+/); // leading bare key (e.g. "t2")
  if (m0 && m0[0]) { cur = cur?.[m0[0]]; if (cur === undefined) return undefined; }
  for (const part of path.matchAll(/\.([^.[\]]+)|\[([^\]]+)\]/g)) {
    cur = part[1] !== undefined ? cur?.[part[1]] : cur?.[part[2]];
    if (cur === undefined) return undefined;
  }
  return cur;
}

if (added || removed || changed) { console.log(`content-diff: ${added} added, ${removed} removed, ${changed} changed`); process.exit(1); }
console.log("content-diff: no content changes");
process.exit(0);

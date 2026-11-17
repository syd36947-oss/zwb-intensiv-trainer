#!/usr/bin/env node
// Integrity check for index.html — run after EVERY change:  node tools/check.mjs
// Exit code 0 = OK, 1 = errors found. Warnings do not fail the check.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2] || new URL("../index.html", import.meta.url);
const html = readFileSync(file, "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("ERROR: no inline <script> found"); process.exit(1); }

const errors = [], warns = [];
const err = s => errors.push(s), warn = s => warns.push(s);

// --- 1. Syntax ---------------------------------------------------------------
try { new vm.Script(m[1], { filename: "index.html<script>" }); }
catch (e) { console.error("SYNTAX ERROR:", e.message); process.exit(1); }

// --- 2. Run the app headless with a minimal DOM stub ---------------------------
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
const expose = `;globalThis.__D={LESSONS,CASES,CARDS,FIGCARDS,SPICK,SRC,MODULES,ATLAS,RPIMG,EKGIMG,FG,
  vLesson,vCase,vLessons,vCases,vCards,vSpick,vMock,vAtlas,vStart,vSuche};`;
try { vm.runInContext(m[1] + expose, ctx, { filename: "index.html<script>" }); }
catch (e) { console.error("RUNTIME ERROR at boot:", e.stack.split("\n").slice(0, 3).join("\n")); process.exit(1); }
const D = ctx.__D;

// --- 3. Referential integrity ------------------------------------------------
const mods = new Set(D.MODULES.map(x => x.n));
const allCards = [...D.CARDS, ...D.FIGCARDS.filter(f => !D.CARDS.includes(f))];
const ids = new Map();
const reg = (id, where) => { if (!id) return err(`${where}: missing id`); if (ids.has(id)) err(`duplicate id "${id}" (${ids.get(id)} and ${where})`); else ids.set(id, where); };
D.LESSONS.forEach(l => reg(l.id, "LESSONS"));
D.CASES.forEach(c => reg(c.id, "CASES"));
allCards.forEach(c => reg(c.id, "CARDS"));
D.ATLAS.forEach(a => { if (ids.has("atlas:" + a.id)) err(`duplicate atlas id ${a.id}`); ids.set("atlas:" + a.id, "ATLAS"); });

for (const [arr, name] of [[D.LESSONS, "lesson"], [D.CASES, "case"], [allCards, "card"], [D.SPICK, "spick"], [D.ATLAS, "atlas"]])
  arr.forEach(x => { if (!mods.has(x.mod)) err(`${name} ${x.id || x.h}: unknown module ${x.mod}`); });

D.LESSONS.forEach(l => {
  if (!Array.isArray(l.blocks) || !l.blocks.length) err(`lesson ${l.id}: no blocks`);
  if (!Array.isArray(l.check)) err(`lesson ${l.id}: missing check[] (Kontrollfragen)`);
  (l.blocks || []).forEach((b, i) => { if (b.fig && !D.FG[b.fig]) err(`lesson ${l.id} block ${i}: unknown figure "${b.fig}"`); });
});
D.CASES.forEach(c => {
  if (!Array.isArray(c.steps) || !c.steps.length) err(`case ${c.id}: no steps`);
  (c.steps || []).forEach((s, i) => {
    if (!s.q || !s.a) err(`case ${c.id} step ${i}: needs q and a`);
    if (s.ekg && !D.EKGIMG[s.ekg]) err(`case ${c.id} step ${i}: unknown ekg "${s.ekg}"`);
  });
});
allCards.forEach(c => {
  if (!c.q || !c.a) err(`card ${c.id}: needs q and a`);
  if (c.fig && !D.FG[c.fig]) err(`card ${c.id}: unknown figure "${c.fig}"`);
  if (c.rimg && !D.RPIMG[c.rimg]) err(`card ${c.id}: unknown Radiopaedia image "${c.rimg}"`);
});

// --- 4. Source markers -------------------------------------------------------
// Scan the content data only (not code, not the base64 image blobs).
const content = JSON.stringify([D.LESSONS, D.CASES, allCards, D.SPICK, D.ATLAS]);
const markers = [...content.matchAll(/\[([A-Z][A-Z0-9]*)\]/g)].map(x => x[1]);
const unknown = [...new Set(markers.filter(k => !D.SRC[k] && k !== "P"))];
if (unknown.length) err(`source markers without SRC entry: ${unknown.map(k => "[" + k + "]").join(" ")}`);
const nL = markers.filter(k => k === "L").length;
if (nL) warn(`${nL} unresolved [L] markers (not yet checked against sources)`);
Object.entries(D.SRC).forEach(([k, v]) => { if (!v.t) err(`SRC.${k}: missing title t`); if (!v.u) warn(`SRC.${k}: no URL`); });
[["RPIMG", D.RPIMG], ["EKGIMG", D.EKGIMG]].forEach(([n, o]) => Object.entries(o).forEach(([k, v]) => {
  if (!v.d || !v.d.startsWith("data:image/")) err(`${n}.${k}: not an embedded data: image`);
}));

// --- 5. Render every view (catches runtime errors in templates) --------------
const tryR = (label, f) => { try { const h = f(); if (typeof h !== "string" || !h.length) err(`${label}: empty render`); } catch (e) { err(`${label}: ${e.message}`); } };
D.LESSONS.forEach(l => tryR(`render lesson ${l.id}`, () => D.vLesson(l)));
D.CASES.forEach(c => tryR(`render case ${c.id}`, () => D.vCase(c)));
for (const v of ["vStart", "vLessons", "vCases", "vCards", "vSpick", "vMock", "vAtlas", "vSuche"]) tryR(`render ${v}`, () => D[v]());

// --- Report ------------------------------------------------------------------
console.log(`Inhalt: ${D.LESSONS.length} Lektionen, ${D.CASES.length} Fälle, ${allCards.length} Karten, ` +
  `${D.SPICK.length} Spick-Blöcke, ${D.ATLAS.length} Atlas-Themen, ${Object.keys(D.SRC).length} Quellen, ` +
  `${Object.keys(D.FG).length} Abbildungen, ${Object.keys(D.RPIMG).length} Radiopaedia-Bilder, ${Object.keys(D.EKGIMG).length} EKGs`);
warns.forEach(w => console.log("WARN ", w));
errors.forEach(e => console.log("ERROR", e));
console.log(errors.length ? `\n✗ ${errors.length} error(s)` : "\n✓ check passed");
process.exit(errors.length ? 1 : 0);

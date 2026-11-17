# AGENTS.md – ZWB Intensiv-Trainer

Instructions for every agent working in this repo: the **orchestrator** (Claude Opus) and the **workers** (local Qwen via LM Studio). Read this whole file at the start of every session.

## 1. What this is

A German learning platform for the **Zusatzbezeichnung Intensivmedizin** exam (Germany, Landesärztekammer Baden-Württemberg / Bezirksärztekammer Südbaden). Owner: Sabi Dimitrov, Facharzt für Anästhesiologie. Target exam date: autumn 2027 (`ST.exam = "2027-10-01"`).

Current state: 13 modules, 71 lessons, 45 cases, 350 cards, 27 cheat-sheet blocks, 12 radiology atlas topics, 106 sources. Run `node tools/check.mjs` for live numbers.

Change history: `CHANGELOG.md` (German, "Änderungsprotokoll"). Open items are listed at the end of it.

## 2. Hard rules (never break these)

1. **All user-facing text is German.** Medical German, addressed formally ("Sie"), the way a German exam board talks. Code, comments and commit messages may be in English.
2. **Medical content is written or changed by the orchestrator only.** That covers lessons, cases, cards, cheat sheets, check questions, answers, numbers, doses, cut-offs, and source markers. Workers must **never** invent, reword or "improve" medical statements. If a worker task needs new medical text, stop and ask the orchestrator.
3. **Every medical statement carries a source marker** `[KEY]`, where `KEY` is an entry in `SRC`:
   - `[A1]` … = AWMF guidelines, `[ESC]`, `[DAS]` etc. = specific sources. Recommendation numbers follow the marker (`[A1] E8`).
   - `[P]` = textbook or physiology knowledge, checked, without a single citation.
   - `[L]` = not yet checked. **Target: zero `[L]`.** Never add new `[L]` markers without telling the user.
   - A new source gets a new `SRC` entry: `{t:"full citation with version/date", u:"URL", a:1 if AWMF}`. Mark guidelines past their validity date in `OLD` (`x` = expired, `o` = older than 5 years).
4. **Source hierarchy:** WBO catalogue (structure) → AWMF guidelines, DAS, BÄK, DIVI, ESC/AHA, landmark trials (facts) → Deranged Physiology, LITFL, EMCrit (explanations only).
5. **No AMBOSS content.** AMBOSS's terms (§ 14.3, § 15) forbid automated reading and feeding it into AI. Never fetch, paste or paraphrase AMBOSS text. The user reads AMBOSS personally and reports discrepancies.
6. **Image licences:**
   - Radiopaedia: CC BY-NC-SA 3.0. Each image needs the author, Radiopaedia.org, an rID DOI link and the licence. On cards, leave out the case title so the diagnosis isn't given away.
   - LITFL ECGs: CC BY-NC-SA 4.0 (Burns E, Buttner R), labelled "Beispiel-EKG, nicht vom Fallpatienten".
   - **The platform is non-commercial.** Don't add anything that would change that.
   - CICMWrecks: don't use it (no licence stated).
7. **Don't break learners' saved progress.** Progress lives in `localStorage` under `KEY = "zwb-trainer-v1"`. Never change that key, and never rename or reuse existing `id`s of lessons, cases or cards: progress and spaced-repetition data are stored by id. New items get new ids.
8. **The platform stays one self-contained `index.html`** (works offline, published as a Claude artifact). No build step, no npm dependencies at runtime, no external scripts. The only external resource allowed is Google Fonts.
9. **`node tools/check.mjs` must pass before any commit.**

## 3. Roles

### Orchestrator (Claude Opus 5.5)
- Plans the work, splits it into small tasks for workers (one per branch), and writes the task spec (see §7).
- Writes and reviews **all medical content** and checks facts against guidelines and primary sources.
- Reviews every worker diff before it is merged (`git diff main...task/xyz`), and checks for unintended content changes.
- Keeps `CHANGELOG.md` up to date (German, newest entry first under today's date).

### Workers (Qwen via LM Studio)
Allowed: UI and CSS, layout, rendering functions, search, spaced-repetition logic, accessibility, mobile fixes, refactors, `tools/` scripts, tests, mechanically converting data the orchestrator supplies (e.g. turning a table into `CARDS` entries **word for word**).

Not allowed: changing medical wording, adding or removing source markers, editing `SRC`, touching image data, changing `KEY` or ids, deleting content.

If something is unclear: **stop and report back.** Don't guess.

## 4. Working with the file (important for small context windows)

`index.html` is ~1.7 MB and ~3,300 lines, but **two lines hold ~1.2 MB of base64 images** (`const RPIMG=` and `const EKGIMG=`). Never read those lines, and never `cat` the whole file.

- Find things by name, not line number (line numbers move): `grep -n "^const LESSONS" index.html`
- Read only slices: `sed -n '328,360p' index.html | cut -c1-400`
- Find one item: `grep -n 'id:"m7l1"' index.html`
- Make small, targeted edits (exact string replacement). **Never regenerate or rewrite the whole file.**

### Layout of the `<script>` (in order)

| Name | Contents |
|---|---|
| `<style>` (top of file) | CSS, design tokens in `:root`, dark mode via `prefers-color-scheme` |
| `SRC`, `OLD`, `OLDTXT` | Source register, outdated-guideline flags |
| `s`, `S()`, `oldWarn` | `S(text)` turns `[KEY]` markers into source badges. Run all content through `S()` |
| `MODULES` | 13 modules: `{n, t, w: WBO numbers, live}` |
| `LESSONS` | Lessons (biggest block) |
| `CASES` | Case scenarios |
| `CARDS` | Flashcards (`FIGCARDS` and radiology cards are merged in) |
| `SPICK` | Cheat-sheet tables |
| `FG`, `FIGINS`, `figHTML`, plot helpers, `ECG` | Self-made SVG figures (ventilator curves, ROTEM, …) |
| `FIGCARDS` | Picture-reading cards |
| `ATLAS`, `vAtlas` | Radiology atlas |
| `RPIMG` ⚠ / `EKGIMG` ⚠ | Embedded base64 images. **Do not read** |
| IIFE after `EKGIMG` | Inserts ECG steps and BGA boxes into cases (`ins()`, `B()`) |
| `KEY`, `ST`, `load`, `save` | Saved state |
| `W`, `review`, `ivl` … | FSRS spaced-repetition scheduler |
| `block()` | Renders lesson blocks |
| `QMAP`, `qBlock`, `bindQuiz` | Check questions, list of wrong answers |
| `v*()` / `bind*()` | Views and their event binding (`vStart`, `vLesson`, `vCase`, `vCards`, `vLearn`, `vSpick`, `vMock`, `vFehler`, `vQuiz`, `vSuche`, `vAtlas`) |
| `render()` | Hash router: `#start`, `#lektionen`, `#<lessonId>`, `#faelle`, `#<caseId>`, `#karten`, `#karten-lernen`, `#spick`, `#atlas`, `#mock`, `#fehler`, `#quiz`, `#suche` |

## 5. Data shapes

```js
// Lesson
{id:"m7l1", mod:7, wbo:"39, 53", t:"Titel", min:6, sub:"Untertitel",
 blocks:[ /* one key per block: */
   {h:"Zwischenüberschrift"}, {p:"Absatz"}, {lead:"Einstieg"},
   {kern:`<strong class="l">Prüfungsfalle</strong>…`}, {dum:"Einfach gesagt …"},
   {calc:"Rechenweg"}, {list:["…"]}, {ol:["…"]}, {twg:[["Kopf","Text"],…]},
   {table:[["Kopf1","Kopf2"],["Zeile","…"]]}, {fig:"FG-key", cap:"Bildunterschrift"} ],
 check:[ /* Kontrollfragen, options shuffled when shown */
   {q:"Frage", o:["Option 0","Option 1","Option 2","Option 3"], a:2 /* index of correct option */, e:"Erklärung"} ]}

// Case: steps run in order; optional ECG image or BGA box per step
{id:"m7f1", mod:7, t:"Titel", tag:"NIV", intro:"…",
 steps:[{p:"neue Information (optional)", q:"Frage", a:"Musterantwort [A1]", ekg:"EKGIMG-key", bga:B(title,[[param,value,unit],…])}]}

// Card
{id:"c701", mod:7, g:"Gruppe", q:"Frage", a:"Antwort (HTML allowed) [P]", fig:"FG-key"?, rimg:"RPIMG-key"?}

// Cheat sheet
{mod:7, h:"Überschrift", rows:[["Begriff","Wert","[A1]"],…]}
```

Id conventions: lessons `m<mod>l<n>`, cases `m<mod>f<n>`, cards `c<mod><nn>`, picture cards `cb…`, radiology cards `cr…`. Check the next free id with `grep`.

HTML in content: escape `<` as `&lt;` (e.g. `pH &lt; 7,35`). Use German number format (decimal comma) and Unicode subscripts (PaO₂, HCO₃⁻).

Shuffling note: in check questions the correct answer must **not** be noticeably longer than the wrong options. This was deliberately evened out, so keep it that way.

## 6. Workflow

1. `git switch main && git pull`
2. `git switch -c task/<short-name>` (one branch per task)
3. Make small edits → `node tools/check.mjs` → open `index.html` in a browser and test on a phone-width window too
4. Commit (English, imperative, e.g. `Add search highlighting in card view`)
5. The orchestrator reviews the diff **and runs `node tools/content-diff.mjs main HEAD`** (lists every added/removed/changed lesson, case, card, Spick block, source). For a worker branch the expected output is `content-diff: no content changes`. A PR is opened; the user merges on GitHub
6. Medical changes → entry in `CHANGELOG.md`
7. To publish: the user re-uploads `index.html` to the Claude artifact (or GitHub Pages). Agents don't publish.

## 7. Task spec template (orchestrator → worker)

```
TASK: <one sentence>
BRANCH: task/<name>
FILES/AREAS: <function names / const names to touch>
DO NOT TOUCH: medical text, SRC, RPIMG/EKGIMG, ids, KEY
ACCEPTANCE: <observable result>; node tools/check.mjs passes
REPORT BACK: diff summary + anything unclear
```

## 8. Open items (from the changelog, Nov 2026)

- Missing image for the MCA infarct (Radiopaedia rID 17816 wouldn't decode)
- Weighting by exam relevance: real exam reports (e.g. MEDI-LEARN) still missing
- Confirm the BW wording of the WBO catalogue and the exam procedure with the Bezirksärztekammer Südbaden
- Topics without their own case yet: endocarditis/heart failure, pleural/ascites tap, polytrauma ICU phase
- Some old guidelines are flagged as expired (DAS 2020, kardiogener Schock 2019, SHT 2015, herzchirurgische Intensivmedizin 2018): watch for updates

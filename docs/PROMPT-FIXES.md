# OpenCode prompt: fix the issues found in the REVCA review

Paste everything below the line as the message. Preconditions: the project is open at its root with `AGENTS.md` and `DECISOES.md`; Chromium for Puppeteer is installed (`npx puppeteer browsers install chrome`) so that screenshots and export tests can run.

---

## Role and goal

You are a senior TypeScript/React engineer. An external review of the REVCA repo (React client, Express server, JSON campaigns, SQLite users, Puppeteer export) found a set of problems. **Fix exactly those, in the phases below.** This is a corrective pass: no new features, no redesign, no refactor beyond what each fix needs.

## Hard rules

1. Work on a new branch `fix/review`. **Never push, never force-push, never rewrite git history, never delete branches.** The owner does those steps manually (Phase 1 only produces instructions).
2. Do not change the data model, API contracts, auth rules or the exported PDF artwork. The only allowed edits to `src/shared/render.ts` are the ones stated in Phase 3.
3. UI strings stay in Brazilian Portuguese; identifiers in English (existing domain keys unchanged).
4. No new dependencies unless unavoidable; if so, log the reason in `DECISOES.md` first.
5. Phase 0 first: record the **baseline** (`npm run typecheck`, `npm run build`, `npm test`, listing exactly which tests fail and why). Never finish a phase with more failures than the baseline minus what that phase fixes. Do not claim something works unless you ran it.
6. One commit per phase, message in Portuguese. After each phase, report in max 5 lines: done / how verified / pending.
7. Make small edits; do not rewrite whole files to change a few lines. Do not stop to ask questions unless blocked; record assumptions in `DECISOES.md`.

## Phase 0: Baseline

Create the branch, run the baseline, and save the output summary in `DECISOES.md` under a heading "Baseline pré-correções". Run `scripts/screenshots.mjs` and keep the "before" images in `tmp/screens/before/` (gitignored).
**Done when:** baseline is recorded and the before-screenshots exist.

## Phase 1: Repository hygiene (privacy)

Problem: `referencia/` is versioned and contains an internal PDF ("INTERNO"), ~250 brand PNGs and 46 `Thumbs.db`. The `.git` is ~37 MB.
Do:
1. Add to `.gitignore`: `referencia/`, `Thumbs.db`, `*.Zone.Identifier`, `.DS_Store`.
2. Run `git rm -r --cached referencia` and remove every tracked `Thumbs.db` (`git rm --cached`). **Do not delete the files from disk.**
3. Check whether anything in code, scripts or tests reads from `referencia/` (for example `scripts/extract-assets.mjs`). If so, make that script fail with a clear Portuguese message when the folder is absent, and make sure **no test or build step depends on it**.
4. Keep `data/logos/` tracked (the app needs it), and list in the report which files there are company brand assets so the owner can decide on repo visibility.
5. Write `docs/LIMPEZA-REPO.md` (Portuguese) with step-by-step instructions for the owner to purge `referencia/` from **history** using `git filter-repo`, what to do afterwards (force-push, notify collaborators, delete forks/caches), and the alternative "make the repo private". Do not run any of it.
**Done when:** `git ls-files | grep -iE "thumbs\.db|^referencia/"` prints nothing, the app builds, and tests are unchanged versus baseline.

## Phase 2: Tests that work on a fresh clone

Problems: `tests/schema.test.ts` and `tests/campanha-referencia.test.ts` read `data/campanhas/exemplo.json`, which is gitignored and only exists after `npm run build` + `npm run seed`; and the reference test expects the 19-page / 25-card campaign, which the seed (4 pages) does not produce. Export tests fail when Chromium is missing.
Do:
1. Create `tests/helpers/fixtures.ts` that builds, **in code**, (a) a small valid campaign matching the seed shape and (b) a **synthetic** 19-page / 25-card campaign with the same distribution of models as the reference (`residencial`, `duplo`, `loteamentos`, `aviso`) and generic placeholder text. No real commercial content in the repo.
2. Point `schema.test.ts` and `campanha-referencia.test.ts` at those fixtures. Tests must not read `data/campanhas/`.
3. `npm test` must pass on a fresh clone after only `npm ci` (add whatever pre-step is needed, such as building into a temp dir, inside the test setup, not as a manual step).
4. Export tests: detect Chromium once (`puppeteer.executablePath()` exists). If missing, **skip** them with the reason "Chromium não instalado (npx puppeteer browsers install chrome)"; if present, they must run and pass.
5. Add a short "Como rodar os testes" section to `README.md`.
**Done when:** in a clean copy of the repo (`git clone` into a temp dir, `npm ci`, `npm test`) there are 0 failures; with Chromium installed, the export tests run (not skipped) and pass.

## Phase 3: Canvas fixes (`src/client/componentes/Canvas.tsx`, `ZoomBar.tsx`, related CSS)

Problems found in review:
1. **Zoom:** the page frame keeps the unscaled 924×1308 layout box (`transform: scale` on an element with fixed size), so the frame does not follow the zoom, and the repo history shows many patch commits on this.
2. **Selected-block highlight** is applied by mutating the DOM after render (outline and a created tag element), so it disappears when the HTML is re-rendered after an edit. The tag says "Bloco 1" instead of the block's type name.
3. **Overflow detection** (`medirEstouros`) is only called once on mount (effect with `[]` dependencies), so editing content until a page overflows may never update the warning. The message uses an emoji and does not say which card caused the overflow.
Do:
1. **Zoom:** wrap each page in an outer box sized `924×zoom` by `1308×zoom` (explicit width/height from the zoom value), and put the scaled page inside with `transform-origin: top left`. The frame must follow the zoom without overflow glitches; the canvas scrolls inside its own container; the zoom bar stays centered and fixed. Keep zoom range 25–200%, "Ajustar à tela", Ctrl+wheel and the `+`, `-`, `0` shortcuts.
2. **Highlight without DOM mutation:** in `render.ts`, add only a `data-bloco-nome="<block type name>"` attribute next to the existing `data-bloco`. In the editor, inject a scoped `<style>` rule (`.arte [data-bloco="<selected id>"]`) that draws the 2px `--primary` outline and a `::before` tag with `content: attr(data-bloco-nome)`. The rule exists only in the editor, never in `render.ts` output, so the exported PDF is unchanged (add a test comparing the rendered markup with and without the new attribute, ignoring it, and one proving export HTML contains no outline style).
3. **Overflow measurement:** re-measure after every render that changes content (layout effect keyed on the campaign revision / rendered HTML), after `document.fonts.ready`, and on zoom changes only if needed. Compute **which card** extends past 1308 px. Show the warning with an icon component (no emoji) naming the card, clickable to select that card. The "Cabe na página" status in the zoom bar must reflect the real result.
4. Replace the direct `estado.pagSelecionada = i` mutation in the frame's `onClick` with the store's existing action or add a small one.
**Done when:**
- unit tests cover zoom clamping and the box-size calculation;
- a Puppeteer check (script in `scripts/`, run it and report the result) opens the editor, sets zoom to 50% and 150% and asserts the frame's size equals page size × zoom; selects a block by clicking the preview, types text, and asserts the outline is still present; adds text until the page overflows and asserts the warning appears and names the card, then removes it and asserts it disappears;
- screenshots at 50%, 100% and 150% look correct (look at them).

## Phase 4: Finish the redesign (what Phase 6 of the earlier plan left undone)

1. **Brand rename in docs:** `README.md`, `AGENTS.md` and code comments say "Parcelamento Matriz" for the product; change to REVCA. Do **not** touch campaign titles/content or the in-page art.
2. **Update stale docs:** `AGENTS.md` §2, §3 and §11 still say "no database, no framework, no login". Rewrite them to match reality (React client, SQLite for users, roles admin/editor/leitor, session cookies) and add a "Design system" section (tokens, `src/client/ui/` components, icon rules with `lucide-react`). Keep the rest of `AGENTS.md` intact.
3. **`DECISOES.md`:** verify it is valid UTF-8 and has no literal `\uXXXX` sequences or control characters (found in an earlier version); fix any you find.
4. **Dependencies:** list packages in `package.json` that no source file imports (for example session or bcrypt-related leftovers). Remove only those that are truly unused, then run build and tests.
5. **Accessibility pass:** walk every screen by keyboard only (tab order, visible focus ring, dialogs trap and restore focus, Esc closes), ensure every icon-only button has an `aria-label`, text contrast ≥ 4.5:1 in both themes, `prefers-reduced-motion` respected, no emoji used as icons.
6. **Responsive:** the editor works at 1280 px and 1100 px wide (side panels become collapsible below 1280).
**Done when:** `grep -rn "Parcelamento Matriz" README.md AGENTS.md src` returns only campaign-content occurrences; build and tests pass; screenshots of Login, Home, Editor and Usuários in dark and light, at 1280 and 1100 px, look consistent.

## Final deliverable

Reply with: (1) what was fixed per phase, (2) how each fix was verified (commands and results), (3) anything still failing or deviating, with the reason, (4) the manual steps left for the owner (history purge, repo visibility, Chromium install), and (5) the exact commands to run the app and the tests.

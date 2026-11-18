# OpenCode prompt: apply the REVCA UI/UX redesign

Paste everything below the line as the message. Preconditions: the existing project is open at its root, `AGENTS.md` and `DECISOES.md` are present, and `referencia/design/` holds `revca-logo-dark.svg`, `revca-logo-light.svg`, `revca-mark.svg` (and screenshots of the approved mockup, if available; treat any PNG there as the visual target).

---

## Role and goal

You are a senior front-end engineer. The product, now named **REVCA** (previously "Parcelamento Matriz"), is a working local app: React client, Express server, JSON campaigns, SQLite users, PDF/PNG export. **Redesign the front-end** to the approved design described below: new brand, a consistent design system, icons everywhere, and a more comfortable editor. This is a **UI change, not a rewrite**.

## Scope rules (hard)

1. **Do not change** the data model, schema, storage, auth rules, export pipeline or API contracts. Exceptions, each explicitly allowed below: (a) adding `data-bloco` attributes in `src/shared/render.ts` (Phase 4); (b) two small admin endpoints (Phase 5).
2. **Artwork is untouchable**: the rendered PDF page (`render.ts` output, 924×1308) must look identical. The app chrome is what changes.
3. The brand rename applies to the **product** (header, login, page title, favicon, README, docs). The campaign title *content* ("Parcelamento Matriz - BLACK FRIDAY" and the in-page art) is **not** renamed.
4. UI strings stay in **Brazilian Portuguese**. Code identifiers in English, existing domain keys stay as they are.
5. Plain CSS with CSS variables (as the project does now). No Tailwind or component libraries. Allowed new dependencies: `lucide-react` (icons) and `@fontsource/inter` (UI font, local, offline). Log both in `DECISOES.md`.
6. Everything must keep working offline.

## Working method

- Phase 0 first: read the repo, then write a short plan in `DECISOES.md` (components found, what each phase touches). Run `npm run typecheck` and `npm test` and record the **baseline** (known: some `export.test.ts` tests need Chromium; note exactly which fail before you start).
- One commit per phase. After each phase: typecheck + tests, then a max-5-line report (done / how verified / pending).
- Never advance with a regression versus the baseline. Do not claim something works unless you ran it.
- Create `scripts/screenshots.mjs` (Puppeteer, already a dependency): logs in, then captures 1440×900 PNGs of Login, Home, Editor (with a block selected) and Usuários, in **dark and light** themes, into `tmp/screens/` (gitignored). **Look at these images** after each visual phase and fix what is off, instead of assuming the CSS is right.
- Make small, incremental edits. Do not rewrite whole files to change a few lines.
- Do not stop to ask questions unless blocked; record assumptions in `DECISOES.md`.

## Design system

**Colors (dark theme, default).** Define as CSS variables on `:root`; keep the existing light theme working by deriving equivalents with text contrast ≥ 4.5:1.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#141519` | app background |
| `--canvas` | `#0f1013` | editor canvas area |
| `--surface` | `#1f2127` | top bars, cards, panels |
| `--surface-2` | `#2a2d36` | buttons |
| `--field` | `#141519` | inputs, selects, textareas |
| `--border` | `#33363f` | all borders |
| `--text` | `#e8e9ee` | main text |
| `--muted` | `#9aa0ac` | secondary text |
| `--primary` | `#4d79ff` | primary buttons (text on it: `#0b1020`) |
| `--primary-text` | `#7f9bff` | section headings, links, blue accents |
| `--selected` | `#252a3d` | selected rows |
| `--green` | `#66cc00` | brand green |
| `--ok` | `#8bd43a` | success text |
| `--danger` | `#ff7a7a` | destructive text/icons |

**Bug to fix everywhere:** form controls are currently white on the dark theme. Inputs, selects and textareas must use `--field` / `--text` / `--border` in both themes.

**Type and shape.** Inter, 13px base, 700 for emphasis. Radius 8 for controls, 12 for cards and panels. Spacing on an 8px grid. Interactive targets at least 40px high. Icons: `lucide-react`, 18px, stroke 2. Visible focus ring on every interactive element (2px `--primary-text`). Respect `prefers-reduced-motion`. Icon-only buttons need `aria-label`.

**Components** (create in `src/client/ui/`): `Button` (variants default, primary, danger; optional leading icon), `IconButton`, `Field` (label + input/select/textarea), `SearchField` (icon inside), `Segmented`, `Card`/`Section` (heading with icon), `Chip`, `Badge`, `Avatar` (initial), `Toast`, `ConfirmDialog`, `Logo`, `Mark`. Replace ad-hoc markup with these.

**Logo.** Components `Logo` (mark + wordmark) and `Mark` (icon only), from this SVG (the wordmark uses the Anton font already bundled locally; `RE` in `#6f93ff` on dark / `#1447ff` on light, `VCA` in `#66cc00` on dark / `#3f9a00` on light):

```svg
<svg viewBox="0 0 124 32" role="img" aria-label="REVCA">
  <rect width="32" height="32" rx="8" fill="#1447ff"/>
  <path d="M8 23l5-14h4l-5 14z" fill="#fff"/>
  <path d="M15 23l5-14h4l-5 14z" fill="#66cc00"/>
  <text x="40" y="25" font-family="Anton, Impact, sans-serif" font-size="26" letter-spacing="1">RE<tspan>VCA</tspan></text>
</svg>
```
Use `Logo` (height ~29px) in the Home and Login headers, `Mark` (32px) in the Editor and Usuários headers, and build the favicon from the mark. Replace the old "Parcelamento Matriz" header wordmark and set the document title to "REVCA".

**Icons by place (lucide names).** Back `ArrowLeft`; open `ArrowRight`; undo/redo `Undo2`/`Redo2`; download `Download`; dropdown `ChevronDown`; add `Plus`; zoom `Minus`/`Plus`, fit `Maximize`; search `Search`; theme `Sun`/`Moon`; users `Users`; logout `LogOut`; saved `CircleCheck`; month `Calendar`; campaign title `FileText`; sections `Layers`; selected block `Pencil`; block title `Type`; color buttons `Droplet` (blue / red) and `X` (no color); hide/show block `EyeOff`/`Eye`; reorder `GripVertical`; width `RectangleHorizontal` (2 colunas) and a half-width variant (1 coluna); duplicate `Copy`; duplicate to another month `CopyPlus`; delete `Trash2`; roles `Shield` (admin), `Eye` (leitor), `Pencil` (editor); reset password `KeyRound`; deactivate `Power`; new user `UserPlus`.

## Screen specs

**Login.** Centered card (~360px) on `--bg`: `Logo`, subtitle "Entre com sua conta para gerenciar as campanhas.", E-mail, Senha, full-width primary "Entrar".

**Home (campaign list).**
- Top bar (56px, `--surface`): `Logo` left; right side: shield icon + user name, theme toggle, "Usuários" (admin only), "Sair".
- Content padding 28/40. Row: heading "Campanhas", `SearchField` (max 360px, "Buscar por título ou mês"), filter chips ("Todas" + the months that exist, selected chip uses `--selected` and `--primary` border), spacer, primary "Nova campanha".
- Grid of cards (300px wide): real thumbnail of page 1 (200px tall), meta line with calendar icon (`NOVEMBRO · 19 páginas`, `--primary-text`, 12px bold), **full title that wraps (no ellipsis)**, "Editado em …" muted, then actions: primary "Abrir" (flex 1, arrow icon) + icon buttons Duplicar and Excluir (danger color, `ConfirmDialog` before deleting).
- Last tile, dashed border: "Criar a partir da campanha anterior (duplicar para outro mês)" (`CopyPlus`), opening the existing duplicate flow.
- Empty state when there are no campaigns, with the same call to action.

**Editor** (layout: top bar 56px, then left rail 272px | canvas flex | right panel 360px; target width ≥ 1280px, below that the side panels become collapsible).
- *Top bar:* `Mark`; "← Campanhas"; campaign title field with file icon (≈300px); month select with calendar icon; save status (`CircleCheck` + "Tudo salvo", green); spacer; Undo, Redo (icon buttons); "Exportar ▾" (opens the existing export dialog); primary "Baixar PDF" (download icon, one-click export with the last-used settings).
- *Left rail:* `SearchField` "Buscar página (N)"; page items ≈ 64px: 34×48 thumbnail, `"n · <empreendimento name>"` in bold with the model label muted below (**not** the strip text, which is identical across pages), grip handle on the right; selected item = `--selected` background + 1px `--primary` border; keep the existing drag-and-drop; dashed "+ Página" button at the bottom.
- *Canvas:* page centered on `--canvas`, below it a zoom bar: minus, percentage, plus, "Ajustar à tela", and a page status ("✓ Cabe na página"). The selected block shows a 2px `--primary` outline (offset 4px) with a small name tag at its top-left.
- *Right panel* (stack of `Section` cards, gap 12):
  1. **Cartão N**: empreendimento select; "Faixa verde" as **two full-width inputs** (line 1 and line 2); this fixes the current cramped fields.
  2. **Bloco selecionado** (border `--primary`): chip with the block type name; **one** color toolbar for the whole textarea (buttons "Azul", "Vermelho", "Sem cor" acting on the current text selection using the existing `[[ ]]`/`(( ))` logic, plus an icon-only hide/show); textarea ≥ 5 rows, auto-growing, no inner scrollbar until ~12 rows; `Segmented` "2 colunas | 1 coluna"; a collapsed title row (`Type` icon, current title, "Alterar ▾") that expands to the existing title controls (ready-made title list, free text, title color) only when opened.
  3. **Outros blocos**: one compact row per block (grip, bold name, first line of text in muted ellipsis, eye toggle). Clicking a row selects it and expands it in the section above. Dashed "Adicionar bloco".
- Remove the duplicated campaign title block from the right panel (the top bar owns it); move "Rodapé" and "Duplicar para outro mês" into a "Campanha" popover or a section collapsed by default.

**Usuários.** Header with `Mark`, "← Campanhas", title. Two columns: left `Section` "Cadastrados (N)" with rows (avatar initial, name + "(você)", muted e-mail, role badge for admin or a role select for others, "● Ativo", "Redefinir senha" with key icon, "Desativar" with power icon in danger color); right 360px `Section` "Novo usuário": Nome, E-mail, Senha (mín. 6 caracteres), two radio cards (Leitor: "Só visualiza e exporta."; Editor: "Cria e edita campanhas."), primary "Cadastrar usuário" with `UserPlus`. Fields must **not** span the full page width.

## Phases

**Phase 0: Audit and baseline.** As described in "Working method". Also create `scripts/screenshots.mjs` and capture the **before** screenshots.
*Done when:* `DECISOES.md` has the plan, baseline results are recorded, before-screenshots exist.

**Phase 1: Tokens and base components.** Variables for both themes, fonts (`@fontsource/inter` imported locally), all components in `src/client/ui/`, the input-contrast fix, `Logo`/`Mark`, favicon, document title.
*Done when:* typecheck/tests match baseline; dark and light screenshots show correctly themed controls; no white inputs on dark.

**Phase 2: Login, Home, Usuários (visual only).** Rebuild these three screens from the specs using the components. No new behavior except `ConfirmDialog` on delete and the empty state.
*Done when:* screenshots of the three screens match the specs in both themes; every icon-only button has an `aria-label`.

**Phase 3: Editor layout (visual only).** New top bar, left rail, canvas frame with zoom bar, right panel restructured as specified. Keep every existing editor behavior working (autosave, 409 handling, drag and drop, color by selection, export dialog).
*Done when:* editor screenshots match the spec; existing editor-related tests pass; manually verify (describe how) that editing text still autosaves and the preview updates.

**Phase 4: Editor behaviors.**
1. **Click-to-select:** add a `data-bloco="<id>"` attribute to each block wrapper in `src/shared/render.ts` (the only allowed change there; update render snapshots and add a test proving the visual markup is otherwise unchanged and the exported PDF still has the same page count). Clicking a block in the preview selects it and scrolls/focuses it in the right panel.
2. **Zoom:** 25–200%, default "fit to screen", Ctrl+wheel, keys `+`, `-`, `0`.
3. **Undo/redo:** history of the campaign state (typing grouped with a short debounce, cap 100); Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y; buttons disabled when empty; autosave keeps working and conflicts (409) clear the history.
4. **Overflow detail:** when a page overflows, the status turns amber ("Passou do limite") and names the card responsible; clicking it selects that card.
5. **Save status states:** "Salvando…", "Tudo salvo", "Erro ao salvar" (with retry), "Conflito" (with reload).
6. **Toasts** for export finished, campaign duplicated, campaign deleted.
*Done when:* unit tests cover undo/redo and zoom clamping; a scripted browser check (Puppeteer) selects a block by clicking the preview, types text, undoes it, and asserts the result; describe the run in the report.

**Phase 5: Usuários admin actions (backend, small).** Admin-only `PATCH /api/auth/usuarios/:id` (change `papel`) and `POST /api/auth/usuarios/:id/redefinir-senha` (set a new password, min 6 characters). Rules: an admin cannot demote or deactivate themselves, and the last active admin can never be removed. Wire them into the Usuários screen. Do **not** change anything else in auth.
*Done when:* server tests cover success, 403 for non-admins, the self-demotion and last-admin rules, and password validation; the UI uses the endpoints.

**Phase 6: Polish and documentation.** Accessibility pass (keyboard-only walkthrough of every screen, focus order, contrast ≥ 4.5:1 for text in both themes, `prefers-reduced-motion`), responsive check at 1280 and 1100 px, replace remaining "Parcelamento Matriz" product mentions in `README.md`, `AGENTS.md` and code comments with REVCA (not the campaign title), add a "Design system" section to `AGENTS.md` (tokens, components, icon rules), final before/after screenshots.
*Done when:* typecheck/tests at or above baseline; screenshots in both themes look consistent with the specs; the report lists anything that still deviates from the design.

## Final deliverable

Reply with: (1) what was done per phase, (2) deviations from the spec and why, (3) how each behavior was verified, (4) the list of new dependencies and endpoints, (5) the exact commands to run the app and the tests.

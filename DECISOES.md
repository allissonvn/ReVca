# Decisões do projeto

## Infra
- Node.js 22 LTS instalado na máquina (o projeto exige Node 20+; nenhuma versão do Node estava presente).
- Puppeteer com Chromium próprio do pacote (canal padrão); Poppler só como utilitário de dev (fora do app).
- Git instalado para versionar as fases (`feat: phase N - <resumo>`).
- `.gitignore` também exclui `data/campanhas/` (dados do usuário gerados em runtime); catálogos ficam versionados.

## Domínio / dados
- Marcadores de cor: `[[azul]]` abre azul e fecha com `[[/]]`; `((vermelho))` abre vermelho e fecha com `((/))` — fechadores curtos e sem ambiguidade (AGENTS.md não define o fechador).
- Bloco de 2 colunas no protótipo (`textos[0]`/`textos[1]`) migra para dois blocos de largura 1 consecutivos, conforme a grade de 2 colunas do §5.
- `documentacao` e `avista` têm largura padrão 1 (como o protótipo); os demais tipos, largura 2.
- Logos e marca d'água são **PNGs extraídos do PDF original** (via `pdfimages`, com alfa recomposto pela smask), não SVGs redesenhados — maior fidelidade. O editor mostra placeholder tracejado quando o arquivo não existe.
- A marca d'água raster é posicionada em left -114 / top -117 com 1148×1624 px, medida por correlação com a página 1 de referência (`scripts/alinhamento.mjs`).
- Grade do cartão: colunas de 50%/50% com chips centrados na própria coluna; o PDF original tinha posições manuais no Canva — ficou ligeiramente diferente (registrado como diferença visual conhecida).
- Fontes: subconjunto `latin` do @fontsource (cobre os acentos do pt-BR), copiado para `dist/client/fonts` no build.

## Ferramentas de dev (scripts/, fora do app)
- `scripts/extract-assets.mjs`: extrai logos do PDF (usa `pdfimages` do Poppler).
- `scripts/alinhamento.mjs`: mede o offset da marca d'água.
- `scripts/preview.ts` + `scripts/shot.mjs`: gera prévia HTML e captura PNGs com Puppeteer para conferência visual.

## Cliente (editor)
- Bundle do servidor precisa de banner `createRequire` no esbuild: dependências CJS (express) empacotadas em ESM não conseguem `require` builtins — "Dynamic require of path".
- O aviso de estouro mede o **conteúdo em fluxo** (ignora a marca d'água, que é absoluta e sai da página de propósito), corrigido pela escala da moldura (`getBoundingClientRect` / 924).
- Notificação de mudança: um único canal — observadores de `estado.ts` (`aoMudar` para conteúdo/prévia, `aoStatus` para o indicador). `marcarSujo` notifica os dois; a prévia se atualiza de forma síncrona a cada tecla, e os badges ⚠ da lista vêm logo depois (registrados após a prévia em `main.ts`).
- O painel só é reconstruído em mudanças estruturais (ligar/desligar bloco, largura, ordem, modelo); digitação nunca reconstrói — foco preservado. Reconstruções restauram o foco pelo `dataset` do elemento ativo.



## Exportação (fase 4)
- O exportador usa page.setContent (HTML gerado por render.ts), que roda em about:blank: URLs relativas (/logos, /assets/fonts) quebram. Solução: injetar <base href> com a URL do servidor (app.locals.urlBase, definida após listen).
- Puppeteer 24: setContent não aceita networkidle0 — usa-se domcontentloaded + waitForNetworkIdle({ idleTime: 300 }) + document.fonts.ready.
- PNG: deviceScaleFactor: 2 no viewport; saída 1848×2616. Exportar PNG sem pagina=n devolve dica JSON (baixar um por vez); com pagina=n (1-based) sai filename com sufixo -pagN.png.
- nomeArquivo() colapsa hífens consecutivos: "Parcelamento Matriz - Teste" → parcelamento-matriz-teste.pdf (não três hífens).
- O exportador é criado em criarApp e fechado no encerramento do servidor (SIGINT/SIGTERM); injetável nos testes.
- temp/ (artefatos de verificação visual) entra no .gitignore.

## Inicialização (fase 5)
- iniciar.bat/iniciar.sh: instalam dependências só se node_modules faltar, constroem só se dist/server/index.js faltar, abrem o navegador e sobem o servidor. O usuário final não usa terminal.
- No .bat, npm é invocado com "call" (para o errorlevel voltar ao script); a porta é fixa em 8080, igual ao link aberto no navegador (HOST/PORT por variável de ambiente continuam disponíveis).
- Teste de clone novo: com dist/ apagado, iniciar.bat reconstruiu e serviu o cliente (/, /api/campanhas 200).

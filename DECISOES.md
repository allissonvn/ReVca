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

## Update v1.2 (front-end em React)
- Motivação: telas mais reativas e familiares para o usuário final (layout estilo Canva: páginas à esquerda, arte ao centro, propriedades à direita). A edição manual de DOM (delegação de eventos + restauração de foco) crescia demais para as novidades de UI.
- Escolha: **React 19 + esbuild existente** (bundle ~45 KB gzip, irrelevante em localhost). Next.js descartado (exigiria segundo servidor/SSR sem ganho em app local offline); Angular descartado (peso e cerimônia contra a simplicidade exigida em §10). Sem biblioteca de componentes — o design system é CSS próprio (~250 linhas com tokens claro/escuro).
- Peso: +3 pacotes npm (react, react-dom, types). Nenhuma dependência nova em runtime de servidor.
- Arquitetura do cliente: `store.tsx` mantém o estado mutável único (como o antigo `estado.ts`) + `notificar()`; componentes assinam via `useSyncExternalStore` com contador de versão. Escolhido em vez de reducer/contexto para manter a lógica de autosave/409/debounce idêntica à que já estava testada.
- O canvas renderiza `renderCampanha()` com `dangerouslySetInnerHTML`: o React não reconcilia a arte (ela é string de `render.ts`, que escapa todo texto do usuário). Nenhuma duplicação de arte.
- Campos coloráveis (`CampoCor`) guardam faixas em `useRef` por foco (antes: WeakMap + focusin/focusout globais) e reusam as primitivas puras de `markup.ts` (extrair/ajustar/pintar/montar), que continuam testadas.
- `npm run dev` implementado: servidor Express + esbuild watch (cliente e servidor; o processo do servidor reinicia quando o bundle dele muda).
- Lição reforçada: `tests/render.test.ts` usava `data/campanhas/exemplo.json` (mutável pelo usuário) e quebrou quando a campanha foi editada pela interface. Agora o fixture é inline no teste — testes nunca leem dados editáveis.
- Chips preservam o que o usuário digita: `white-space: pre-wrap` (espaços internos aparecem) + `overflow-wrap: anywhere` (palavra longa quebra em vez de estourar o chip); espaços das pontas são aparados no `render.ts` (não descentralizam um chip centralizado).
- Miniaturas reais na lista de páginas: HTML do `renderCampanha` memoizado por `JSON.stringify(pag)` — o React só troca o DOM da miniatura quando o conteúdo da página muda (digitar num campo não reconstrui as outras).
- Reordenação por arrastar-e-soltar (HTML5 DnD, sem dependência): páginas arrastam pelo item inteiro; blocos só pela alça ⠿ (item todo draggable rouba a seleção de texto dos campos). Setas ▲▼ mantidas para teclado/acessibilidade. Ao mover páginas, a seleção acompanha a página movida (pelo `id`).
- O canvas mede o estouro e reporta o mapa (id → altura) ao Editor via `aoEstouro`; o badge ⚠ da lista passa a mostrar também os px. A comparação por assinatura evita laço de re-render (só notifica quando o mapa muda).
- Tamanho padrão para logos de empreendimento: caixa fixa de altura `--logo` (por modelo) × largura 1,5× com `object-fit: contain` — logos com proporções muito diferentes (0,70 a 1,40) passam a ocupar o mesmo espaço, sem distorção nem estouro. O placeholder tracejado usa a mesma caixa (o cartão não "pula" ao carregar/trocar a logo).

## Update v1.1 (cores Canva, home com miniaturas, exportação com opções)
- Markup ganhou cor livre: `[[#rrggbb]]` abre, `[[/]]` fecha (só aceita # + 6 hex — nada de HTML injetado); `[[azul]]` e `((vermelho))` continuam válidos. `montarMarcado` prefere o token nomeado quando a cor é a canônica.
- Edição "estilo Canva": o campo mostra o TEXTO PURO (sem marcadores); as cores vivem em faixas na memória (`cores.ts`, WeakMap por elemento) e viram markup no estado a cada tecla (prévia e autosave continuam markup). Faixas nunca cruzam quebra de linha; digitação dentro de texto colorido estende a cor (`ajustarRanges` com diff por prefixo/sufixo comum).
- Sem seleção, a paleta pinta o campo todo (comportamento do Canva); com seleção, pinta só o trecho. "Sem cor" tira as cores do trecho/campo.
- A paleta tem amostras fixas + `<input type="color">` (RGB do sistema). Hexes canônicos viram token nomeado (#1447ff→azul, #ff3b3b→vermelho).
- Em páginas quase vazias o PDF rasterizado pode ficar MAIOR que o vetorial; a comprimida vale principalmente para conteúdo rico (no seed real: 1.050 KB → 275 KB).
- JPEG do Puppeteer descartado: o encoder do Chromium duplica o conteúdo colorido nessa arte (marca d'água absoluta saindo da página); PNG sai limpo em qualquer dsf. Raster comprimido = PNG 1× (924×1308).
- Nova dependência: `pdf-lib` — monta o PDF comprimido a partir das páginas rasterizadas (justificativa: Puppeteer não junta imagens em PDF; sem ela seria preciso escrever PDF à mão).
- Home nova: grade de cartões com miniatura real da 1ª página (mesmo `render.ts`), busca por título/mês, badge de mês, ações abrir/duplicar/excluir. Cliente lê todas as campanhas de uma vez (poucas, servidor local).
- Exportação detalhada: modal com formato (PDF/PNG) × páginas (todas/só a atual) × qualidade (alta/comprimida). PNG sempre um arquivo por página (o cliente baixa em série quando "todas"). PDF "só a atual" usa `pageRanges`; comprimida rasteriza com pdf-lib.
- `#paleta-cor` e `#modal-export` precisam de `[hidden] { display: none }` explícito (o `display: flex` da classe sobrepõe o estilo padrão do atributo hidden).

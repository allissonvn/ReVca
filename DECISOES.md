# Decisões do projeto

## Update v2 (autenticação, usuários e banco de dados)
- Motivação: permitir múltiplos usuários com papéis e persistência de usuários/sessões em banco, saindo do modelo de "um único usuário local" do v1.
- Banco: **SQLite** (`data/vca.db`) via `better-sqlite3` — arquivo único, zero-config, sem servidor separado, ideal para software local offline. Campanhas continuam em JSON (`data/campanhas/`) por simplicidade e histórico de versões.
- Autenticação: sessão própria via **cookie HTTP-only `connect.sid`** (sem `express-session` — desnecessário para um app local) + **`bcryptjs`** para hash de senha (o `bcrypt` nativo não compila/roda bem como ESM no Windows do dono; `bcryptjs` é puro e suficiente). O token vive só no cookie — nunca no corpo da resposta, em headers ou na URL.
- Papéis: `admin` (gerencia usuários + tudo do editor), `editor` (cria/edita/exclui campanhas) e `leitor` (apenas visualiza).
- Sessões **persistidas na tabela `sessoes`** do SQLite: reiniciar o servidor não desloga ninguém; expiração (7 dias) validada a cada requisição, com limpeza de sessões expiradas no login.
- Primeiro usuário (bootstrap): `POST /api/auth/usuarios` é aberto enquanto o banco não tem usuários — e força papel `admin`. Só permitido com o servidor em endereço local (HOST de loopback); com `HOST=0.0.0.0`, retorna 403.
- Campanhas ganharam campo `usuarioId` (vinculação ao dono, sempre definido pelo servidor). Todos os usuários autenticados visualizam todas as campanhas; a escrita é do admin/editor. O `PUT` ignora o `usuarioId` do corpo (dono vem do disco).
- Cookie: `httpOnly`, `SameSite=Lax`, `Max-Age` em segundos (604800 = 7 dias).
- Limite de tentativas de login: 5 erros por e-mail bloqueiam 15 minutos (429); acerto zera a contagem.
- `.gitignore` exclui `data/vca.db*` (banco com hashes de senha, não versionado nem para compartilhar em zip).
- Testes: hash de senha, login/logout, proteção de rota (401), papéis (403 em escrita), cadastro de usuário, vínculo campanha-usuário, token só no cookie, bloqueio por tentativas, sessão reconhecida por nova instância do servidor.

## Infra
- Node.js 22 LTS instalado na máquina (o projeto exige Node 20+; nenhuma versão do Node estava presente).
- Puppeteer com Chromium próprio do pacote (canal padrão); Poppler só como utilitário de dev (fora do app).
- Git instalado para versionar as fases.
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
- Compartilhamento do projeto: **não** enviar o zip com `data/vca.db` (tem hashes de senha) nem com `node_modules` (binários compilados para a plataforma de origem — no destino, rodar `npm install` de novo).

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
- Miniaturas reais na lista de páginas: HTML do `renderCampanha` memoizado por `JSON.stringify(pag)` — o React só troca o DOM da miniatura quando o conteúdo da página muda (digitar num campo não reconstrói as outras).
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

## Update v2 (autenticação no front-end)
- Gate de login no cliente: App.tsx consulta /api/auth/me no boot (fase "verificando" evita piscar o formulário) e, sem usuário, renderiza só telas/Login.tsx. Nenhuma rota nova (sem react-router); o gate é um if no App.
- Sessão vive em store.tsx (estado.usuario), junto do resto do estado mutável. deslogar() também limpa campanha/catálogos para não vazar dados entre sessões.
- 401 centralizado: api.ts expõe definirAoReceber401(fn); o App registra deslogar. Qualquer chamada que receba 401 (sessão expirada) devolve ao login sem laço de requisições.
- Papel no cliente: podeEditar() esconde ações de escrita (nova, duplicar, excluir) para leitor; a proteção real continua no servidor (requerEditor).
- "Sair" chama POST /api/auth/logout e recarrega a página (limpa estado local de uma vez).
- fetch usa credentials: "same-origin" em todas as chamadas, para o cookie HttpOnly connect.sid acompanhar tudo.
- Removido console.log de DEBUG em requerSessao (imprimia token/cookie — vazamento em log).

## Update v2.1 (papel admin e gestão de usuários)
- Novo papel **admin** (acima do editor): administra usuários e faz tudo o que o editor faz. Hierarquia: admin > editor > leitor. Editor e admin são diferentes de propósito — não fundir.
- PapelSchema = admin | editor | leitor. requerEditor e storage.podeEditar aceitam admin e editor; novo requerAdmin protege a gestão de usuários.
- Migração do SQLite: o CHECK antigo não aceitava 'admin' e SQLite não altera CHECK; db.ts recria a tabela quando o CREATE existente não menciona 'admin' e promove o **primeiro** usuário (dono) a admin — por isso admin@vca.com virou admin sem ação manual.
- Bootstrap: POST /api/auth/usuarios sem usuários no banco é aberto e força papel admin; depois disso, só admin cadastra (403 para os demais). Formulário do cliente só oferece editor/leitor — novo admin não se cria pela tela.
- E-mail duplicado responde 409 (antes deixava estourar o erro bruto do SQLite).
- Tela telas/Usuarios.tsx em /?tela=usuarios: lista com nome/e-mail/papel/situação + formulário de cadastro com erros amigáveis (409/422/403). Não-admin que abre a URL cai na home; a proteção real é o middleware no servidor.
- Bug corrigido de passagem: criarAutenticacao() abria sempre o banco real (data/vca.db) mesmo nos testes — usuários de teste vazavam para a produção (mesma lição do render.test). Agora recebe raizDados e os testes rodam isolados.

## Update v2.2 (leitor vê tudo + ativo/inativo)
- Bug do leitor: a listagem/leitura de campanhas filtrava por dono quando o papel era leitor — um leitor novo (sem campanhas próprias) via lista vazia e não conseguia abrir nada. Correção: **qualquer usuário autenticado visualiza todas as campanhas** (leitor incluído); a escrita continua bloqueada (requerEditor + 403 no PUT/DELETE). storage.listar() perdeu os parâmetros de filtro.
- Ativo/inativo: PATCH /api/auth/usuarios/:id (só admin) com { ativo: boolean }. Regras: admin não altera o próprio status (400, evita se trancar fora) e usuário inexistente dá 404. Login de desativado é negado (401) e a sessão ativa morre na próxima validação (validarSessao exige ativo = 1). Não há exclusão de usuário — desativar substitui apagar (mantém histórico de autoria das campanhas).
- Tela de usuários: coluna "Situação" com badge verde/vermelho, botão Ativar/Desativar (desabilitado na linha do próprio admin, marcada "(você)"), linhas inativas esmaecidas.
- Testes novos: leitor vê todas as campanhas (lista + leitura de campanha alheia), leitor não cria/edita, ciclo completo de desativação/reativação (sessão antiga morre, login negado, volta), autoproteção do admin (400), 404 e 403.

## Update v2.3 (leitor no editor: somente leitura visual)
- O servidor já bloqueava a escrita do leitor (403), mas a interface do editor mostrava todos os campos como editáveis — a edição do leitor "ia pro ar" e falhava no autosave. Regra de UI: se não pode gravar, o campo nem aparece editável.
- Modo leitor no Editor (podeEditar() === false):
  - Coluna da direita (PainelPropriedades) **não renderiza**; grade do editor vira 2 colunas (.editor-corpo.leitor).
  - Painel de páginas mantido, mas só para **selecionar**: sem subir/descer, duplicar, excluir, arrastar (item deixa de ser draggable) e sem "+ Página". "Ver todas" continua (não altera dados).
  - Título da topbar readOnly e mês disabled.
  - Exportação continua disponível (leitor pode exportar: é leitura).
- Verificação automatizada com Puppeteer (temp/verifica-leitor.mjs): admin vê 3 colunas + ações; leitor vê 2 colunas, sem painel/ações, páginas clicáveis, exportação ativa.

## Update v2.4 (revisão de segurança e correção de documentação)
- **Token só no cookie**: o login não devolve mais token no corpo nem no header `x-auth-token`; `?token=` e `Authorization: Bearer` deixaram de ser aceitos (trocados por cookie `connect.sid` nos testes). Motivo: token em URL/corpo acaba em logs e no histórico do navegador, anulando o cookie HttpOnly.
- **Max-Age do cookie em segundos** (604800 = 7 dias): antes estava em milissegundos (~19 anos), divergindo da expiração real da sessão no servidor.
- **Sessões persistidas no SQLite** (tabela `sessoes`, criada desde o v2.1 mas sem uso): reiniciar o servidor não desloga mais ninguém; Map em memória removido. Sessões expiradas são apagadas no login.
- **Limite de tentativas de login**: 5 erros por e-mail → 429 por 15 minutos (Map em memória por instância de auth; acerto zera).
- **Bootstrap protegido fora do localhost**: com `HOST=0.0.0.0` (ou outro não-loopback), o cadastro do primeiro usuário responde 403 — em rede aberta, um estranho não pode criar o admin.
- **PUT não troca o dono**: `usuarioId` do corpo é ignorado e sobrescrito pelo do disco — editor não consegue reatribuir a autoria de uma campanha.
- **Lógica de permissão simplificada**: `podeVerCampanha` (sempre verdadeiro, com mensagens de "não é dono" enganosas) foi removida — qualquer autenticado visualiza; `storage.podeEditar(papel)` ficou só com a regra real (admin/editor editam; leitor nunca chega à rota de escrita por causa do requerEditor).
- **Dependências fantasma removidas**: `express-session`, `@types/express-session` e `@types/bcrypt` estavam no package.json sem uso (a sessão é própria e o hash é bcryptjs).
- **Documentação realinhada**: AGENTS.md, README.md e este arquivo agora descrevem o sistema atual (React no cliente, SQLite para usuários, autenticação e papéis); este arquivo foi regravado em UTF-8 limpo (as seções v2 haviam sido anexadas com encoding quebrado, com códigos de escape literais no lugar dos acentos).

## Update v3 (redesenho UI/UX — REVCA)
- Fonte do plano: `referencia/PROMPT-UI.md` (OpenCode prompt). Redesenho do front-end sem alterar data model, schema, storage, auth, export ou API. Arte do PDF intocável (`render.ts`).
- Marca: renomeia produto para **REVCA** (header, login, title, favicon, docs). Título da campanha ("Parcelamento Matriz") não é renomeado.
- Novas deps permitidas: `lucide-react` (ícones) e `@fontsource/inter` (fonte UI, local/offline). Log em `DECISOES.md` quando instaladas.
- CSS puro com variáveis. Tema escuro padrão (prefers-color-scheme respeitado). Tokens: `--bg`, `--canvas`, `--surface`, `--surface-2`, `--field`, `--border`, `--text`, `--muted`, `--primary`, `--primary-text`, `--selected`, `--green`, `--ok`, `--danger`.
- Componentes em `src/client/ui/`: `Button`, `IconButton`, `Field`, `SearchField`, `Segmented`, `Card`/`Section`, `Chip`, `Badge`, `Avatar`, `Toast`, `ConfirmDialog`, `Logo`, `Mark`.
- SVGs da marca: estão em `referencia/` (não em `referencia/design/` como o prompt diz): `revca-logo-dark.svg`, `revca-logo-light.svg`, `revca-mark.svg`.
- Favicon construído do `Mark`. `Logo` (~29px) em Home e Login; `Mark` (32px) em Editor e Usuários.

### Phase 0 — Audit e baseline (concluída)
- `DECISOES.md`: este plano adicionado (esta seção).
- Repositório lido: clientes em `src/client/` (App, Login, Home, Editor, Usuarios, exportar, store, api, main, Canvas, PainelPaginas, PainelPropriedades, CampoCor, ModalExportar).
- Baseline: `npm run typecheck` ✓ (0 erros); `npm test` ✓ (125/125 passando, incluindo os 6 de exportação com Chromium).
- Scripts de dev existentes: `scripts/extract-assets.mjs`, `scripts/alinhamento.mjs`, `scripts/preview.ts`, `scripts/shot.mjs`.
- Novo script criado: `scripts/screenshots.mjs` (Puppeteer): faz login, captura Login/Home/Editor/Usuários em dark e light, 1440×900, em `tmp/screens/` (gitignorado).
- Antes-screenshots: capturados com o script acima.
- Um commit por fase. Após cada fase: typecheck + tests + relatório de até 5 linhas. Nunca avançar com regressão vs baseline.

### Phase 1 — Tokens e componentes base (concluída)
- `src/client/estilos/tokens.css`: tokens CSS para tema claro e escuro (cores, tipografia Inter, raios, focus ring, componentes base). Importado via `@import` no `styles.css`.
- `@fontsource/inter` instalado (fonte UI local/offline, subconjunto latin).
- `lucide-react` instalado (ícones: 18px, stroke 2).
- `src/client/ui/`: `Button`, `IconButton`, `Field`, `SearchField`, `Segmented`, `Card`/`Section`, `Chip`, `Badge`, `Avatar`, `Toast`, `ConfirmDialog`, `Logo`, `Mark` + `index.ts` (barrel).
- `Login.tsx`: reescrito com `Logo`, `Button`, `Field` (tokens do design system). Marca REVCA no cabeçalho.
- `Home.tsx`: reescrito com `Logo`, `Button`, `SearchField`, `Chip` (filtros de mês), `ConfirmDialog` (exclusão), `Avatar` (iniciais do usuário). Top bar com `Logo` à esquerda, ações à direita.
- `index.html`: título alterado para "REVCA — Editor de Condições Comerciais".
- `styles.css`: `@import "./estilos/tokens.css"` no topo; tokens legados mantidos para compatibilidade.
- Inputs/selects/textarea usam `--field` / `--text` / `--border` em ambos os temas (corrigido problema de inputs brancos no dark).
- Focus ring visível (2px `--primary-text`) em todos elementos interativos.
- `prefers-reduced-motion` respeitado.
- Verificação: `npm run typecheck` ✓ (0 erros); `npm test` ✓ (125/125); `npm run build` ✓.

# AGENTS.md — Editor de Condições Comerciais (VCA)

Leia este arquivo inteiro antes de qualquer tarefa. Ele vale para todo o projeto.

## 1. Objetivo

Software **local** para montar e editar o PDF mensal "REVCA" (condições comerciais de empreendimentos). A **arte é fixa**; o usuário altera só o **conteúdo** (textos, títulos de blocos, empreendimento, mês). Saídas: **PDF** (uma página por página da campanha) e **PNG** por página (para WhatsApp).

Referências na pasta `referencia/`:
- `MATRIZ_-_PARC__INTERNO_01_11_26.pdf`: o PDF original feito no Canva (19 páginas, 25 cartões). É a fonte da verdade visual.
- `prototipo-multipaginas.html`: protótipo funcional do editor. Serve de referência de **comportamento**. Não copie o código às cegas: veja a seção 12.

## 2. Stack (fixa, não troque sem pedir)

- Node.js 20+ e TypeScript em modo `strict`, ES modules, npm.
- Servidor: Express. Validação: Zod.
- Front-end: React 19 (JSX + `useSyncExternalStore`), empacotado com esbuild. Sem biblioteca de componentes nem CSS-in-JS.
- Persistência: **SQLite** em `data/vca.db` (arquivo único, sem servidor separado) + JSON em `data/campanhas/` para campanhas.
- Exportação: Puppeteer (Chromium headless).
- Fontes: pacotes `@fontsource/anton`, `@fontsource/oswald`, `@fontsource/open-sans` (nada de Google Fonts online; o app roda offline).
- Testes: Vitest.
- Não instale outras dependências sem justificar em `DECISOES.md`.
- Sem Docker no v1.
- Autenticação: sessão própria via cookie HTTP-only (sessões persistidas no SQLite) + bcryptjs para senhas. Papéis: `admin`, `editor` e `leitor` (admin ≠ editor: só o admin gerencia usuários). O token de sessão trafega **só** no cookie — nunca na URL, corpo ou headers.

## 3. Estrutura de pastas

```
AGENTS.md  PROMPT.md  DECISOES.md  package.json  tsconfig.json
docs/            LIMPEZA-REPO.md (roteiro de limpeza do historico, nao executado)
data/
  campanhas/           um arquivo JSON por campanha (gitignored, criado pelo seed)
  catalogos/           empreendimentos.json  titulos.json  tipos-bloco.json  modelos.json
  logos/               logo-vca.png, watermark.png e logos dos empreendimentos (PNGs)
  historico/           cópias antigas das campanhas (gitignored)
src/shared/            tipos Zod, markup, layout, render (usado por cliente E servidor)
src/server/            index.ts, rotas, storage, export
src/client/            index.html, main.tsx, store.tsx, telas/, componentes/, ui/, estilos
tests/                 Vitest (fixtures em tests/helpers/)
iniciar.bat  iniciar.sh
```

## 4. Modelo de dados

Idioma: chaves de dados e termos do domínio em **português** (iguais ao protótipo); nomes de funções e código genérico em **inglês**.

```ts
Campanha { versao: 1; id; usuarioId; titulo; mes; rodape?: string; paginas: Pagina[]; revisao: number; atualizadoEm: string }
Pagina   { id; modelo: ModeloId; faixa?: string; cartoes: Cartao[] }          // faixa = faixa azul da página
Cartao   { id; empreendimentoId: string | null; faixa?: string;               // faixa só nos modelos com faixa por cartão
           titulo: string[];                                                  // faixa verde, 1 ou 2 linhas
           blocos: Bloco[] }
Bloco    { id; tipo: TipoBlocoId; ativo: boolean; largura: 1 | 2;
           titulo: string; tituloCor: "preto" | "vermelho";                   // título aceita markup de cor
           texto: string }                                                    // uma linha = um chip; aceita markup de cor
```

- `mes` é um dos 12 meses em maiúsculas. `titulo` da campanha vale para o PDF inteiro.
- `usuarioId` vincula a campanha ao usuário que a criou — definido pelo servidor na criação; o PUT ignora o `usuarioId` do corpo (não dá para trocar o dono). Todos os usuários autenticados visualizam todas as campanhas; criar/editar/excluir é papel de `admin`/`editor`.
- Validação com Zod em `src/shared/schema.ts`. Todo arquivo lido do disco ou recebido pela API passa pelo schema.
- `versao` existe para migrações futuras. `revisao` sobe a cada gravação (controle de concorrência).
- Senhas são armazenadas com hash bcryptjs (never plain text).

### Catálogos (JSON editado à mão pelo dono; sem tela de edição no v1)

- `modelos.json`: `{ id, nome, minCartoes, maxCartoes, faixaPorCartao, escala, alturaLogo, paddingCartao, espacoBlocos }`. Modelos iniciais:
  - `residencial` (1 cartão, escala 1, logo 86)
  - `duplo` (2 cartões, faixa em cada, escala 0.92, logo 66)
  - `loteamentos` (1 a 3 cartões, escala 0.8, logo 42)
  - `aviso` (1 cartão, escala 1.15, logo 86)
- `tipos-bloco.json`: blocos prontos com defaults `{ id, nome, tituloPadrao, tituloCor, largura }`. Tipos: financiamento, facilita, documentacao (largura 1), observacao, prosoluto, promocao, investidor, avista (largura 1), texto.
- `titulos.json`: títulos prontos `{ texto, cor }`. Inclui os do PDF: FINANCIAMENTO CEF, PARCELAMENTO FACILITA, CONDIÇÃO INVESTIDOR, PLANO INVESTIDOR, DOCUMENTAÇÃO:, OBSERVAÇÃO (vermelho), PROMOÇÃO (vermelho), PARA UNIDADES 2/4: (vermelho), UNIDADES 2/4 (1º ANDAR), UNIDADES 2/4 (TÉRREO), UNIDADES 3/4 (TÉRREO e 1º ANDAR).
- `empreendimentos.json`: `{ id, nome: string[], faixa, logo: string | null }`. `logo` é um arquivo em `data/logos/`; se faltar, a arte mostra um marcador tracejado com o nome.

O tipo do bloco só dá **defaults** (título, cor, largura). O usuário pode mudar título (lista pronta ou texto livre), cor e largura de qualquer bloco.

## 5.5. Design system (interface do editor)

A interface do editor usa tokens CSS em `src/client/estilos/tokens.css` e componentes UI reutilizáveis em `src/client/ui/` (`Button`, `IconButton`, `Field`, `Card`, `Chip`, `Badge`, `Avatar`, `Mark`, `Logo`, `SearchField`, `Segmented`, `Toast`, `ConfirmDialog`).

- **Tokens** (variáveis CSS): cores primárias (`--primario`, `--primario-texto`), superfícies (`--superficie`, `--superficie-2`), bordas (`--borda`), sombras (`--sombra`), raio (`--raio`), estados de feedback (`--ok` verde, `--danger` vermelho).
- **Ícones**: usam `lucide-react`. Todo botão apenas com ícone deve ter `aria-label`. Não usar emoji como ícone nem como texto de status (usar componente de ícone + texto).
- **Tema claro/escuro** só no painel do editor; a página da arte é sempre clara (`document.documentElement.dataset.theme` controlado pela store).
- **Acessabilidade básica**: `label`/`aria-label` em todo controle, foco visível (`--focus-ring`), navegação por teclado, `prefers-reduced-motion` respeitado, diálogos prendem e devolvem o foco, Esc fecha.

## 5. Regras de renderização (a arte)

Tudo em um único módulo `src/shared/render.ts`, que gera **HTML como string** e é usado pelo editor (prévia) e pelo exportador. Nunca duplique a arte em dois lugares.

- Página: **924 × 1308 px** (proporção A4 do Canva), fundo branco, marca d'água (`watermark.svg`; se ausente, formas CSS cinza). Renderize em px fixos. A prévia do editor reduz com `transform: scale()`. **Não** use container queries nem `calc` em unidades relativas.
- Cabeçalho: aba verde (x 0–140, y 52–132, canto inferior direito arredondado 34px); título em Anton 36px, verde, em x=155; mês logo abaixo em Oswald 300 36px, azul, maiúsculas; logo VCA à direita (`logo-vca.svg`).
- Faixa azul: largura total com margens 33/34, altura 46, texto Oswald 300 36px, branco, maiúsculas. Nos modelos com `faixaPorCartao`, uma faixa menor (altura 40, fonte 28) acima de cada cartão.
- Cartão: largura 738, centralizado. Faixa verde (Open Sans 700 17px, branco, maiúsculas, 1–2 linhas) + corpo `#f4f4f6` com borda `#8fa2ff` e cantos inferiores 8px.
- Cores: verde `#66cc00`, azul `#1447ff`, vermelho `#ff3b3b`, chip `#dfe3f3`, borda da faixa verde `#3b5bff`, marca d'água `#ececec`.
- **Chips**: cada linha de `texto` vira um chip (fundo `#dfe3f3`, raio 7, padding 2×13, Open Sans 700 15.5px, centralizado). Linhas vazias são ignoradas. O título do bloco é um chip acima, maior (20px; 22px se vermelho).
- **Grade do cartão**: matriz fixa de **2 colunas**. `largura: 2` ocupa a linha toda; `largura: 1` ocupa metade. Fluxo sequencial (como CSS grid): dois blocos de largura 1 seguidos formam uma linha. Se sobrar um bloco de largura 1 sozinho, ele fica à esquerda (fiel ao PDF; configurável em `modelos.json` com `celulaSolitaria: "esquerda" | "centro"`).
- Blocos com `ativo: false` não aparecem.
- Rodapé opcional da campanha (`rodape`): texto pequeno no pé de cada página, só se preenchido.

### Cor por seleção (markup)

O usuário escolhe a cor selecionando um trecho; **não existe cor automática**. Armazenamento em texto com marcadores:
`[[azul]]` e `((vermelho))`, aninháveis. Em `texto` **e** em `titulo` (no PDF há títulos com partes coloridas, como "UNIDADES **2/4** (1º ANDAR)").

Parser em `src/shared/markup.ts`, função pura, com testes:
- processa **linha por linha** (marcador não atravessa linha);
- fechamento sem abertura vira texto literal; abertura sem fechamento vai até o fim da linha;
- **escapa HTML sempre** (nunca injete texto do usuário sem escapar);
- no editor, botões Azul / Vermelho / Sem cor atuam na seleção do `textarea` (remove marcadores dentro da seleção e reaplica por linha).

## 6. API REST (Express, escuta em 127.0.0.1; `HOST`/`PORT` por variável de ambiente)

### Autenticação
- `POST /api/auth/login` — autentica usuário (email + senha), cria sessão (cookie HTTP-only).
- `POST /api/auth/logout` — encerra a sessão.
- `GET /api/auth/me` — devolve o usuário logado (ou 401 se não autenticado).
- `POST /api/auth/usuarios` — cadastra novo usuário. Sem usuários no banco, é aberto (bootstrap) e o papel é forçado para `admin`; depois, só o `admin` chama (cria `editor` e `leitor`). `GET /api/auth/usuarios` lista os usuários (só `admin`); `PATCH /api/auth/usuarios/:id` ativa/desativa (só `admin`; não vale para o próprio admin).

### Campanhas (exigem autenticação)
- `GET /api/campanhas` lista campanhas do usuário logado (`id, titulo, mes, atualizadoEm, nPaginas`).
- `POST /api/campanhas` cria em branco, ou `{ duplicarDe, mes }` para duplicar para outro mês.
- `GET /api/campanhas/:id` · `DELETE /api/campanhas/:id` (move para lixeira, não apaga).
- `PUT /api/campanhas/:id` grava. Exige a `revisao` que o cliente viu: se diferente da do disco, responde **409** com a versão atual. Falha de schema responde **422** com os erros do Zod.
- Usuários com papel `leitor` só podem `GET` (listar e visualizar **todas** as campanhas); `editor` e `admin` podem tudo de campanhas; só `admin` gerencia usuários.
- Somente o dono da campanha (ou admin) pode editar/excluir.

### Catálogos e render (mesmo do v1)
- `GET /api/catalogos` devolve os 4 catálogos (lidos do disco a cada requisição).
- `GET /render/:id` HTML com todas as páginas empilhadas (usado pelo exportador e pela visualização).
- `POST /api/campanhas/:id/exportar?formato=pdf|png[&pagina=n]` devolve o arquivo.
- `GET /logos/*` serve `data/logos`.

### Persistência (`src/server/storage.ts`)
- Usuários e sessões ficam em **SQLite** (`data/vca.db`).
- Campanhas continuam em **arquivos JSON** em `data/campanhas/` (escrita atômica, histórico com as 20 versões mais recentes, lixeira).
- `id` e nomes de arquivo sanitizados (sem `..`, sem barras).

## 7. Editor (src/client)

Layout: painel de edição à esquerda, prévia à direita (em tela estreita, empilhado).
- Campanha: título, mês (lista), rodapé opcional, botão duplicar para outro mês.
- Lista de páginas: selecionar, subir, descer, excluir, duplicar, adicionar escolhendo o modelo; opção "ver todas" na prévia.
- Página: modelo (ajusta o nº de cartões respeitando `minCartoes`/`maxCartoes`) e faixa azul.
- Cartão: empreendimento (lista do catálogo; ao escolher, preenche faixa e faixa verde com os dados do catálogo), campos de faixa, blocos.
- Bloco: liga/desliga, lista de títulos prontos + campo de texto livre do título + cor do título, largura (1 ou 2 colunas), subir/descer/remover, textarea com botões de cor. Adicionar bloco escolhendo o tipo.
- **Salvamento automático** com debounce de ~800 ms e indicador "salvo / salvando / erro / conflito". Em 409, oferecer recarregar.
- **Aviso de estouro**: se o conteúdo de uma página ultrapassar 1308 px de altura, mostrar aviso na página (a arte corta silenciosamente; o usuário precisa ser avisado).
- Estado central em `store.tsx` (mutável + `notificar()`); componentes React assinam com `useEstado()` (`useSyncExternalStore` por versão). Digitação altera o objeto e notifica — o React re-renderiza só o que mudou e o foco nunca é perdido (campos controlados mostram texto puro; o markup vive no modelo).
- Acessibilidade básica: `label`/`aria-label` em todo controle, navegação por teclado.
- Interface em pt-BR. Tema claro/escuro só no painel; a **página (arte) é sempre clara**.

## 8. Exportação (src/server/export.ts)

- Puppeteer abre `/render/:id` com viewport 924×1308, espera `document.fonts.ready` e as imagens.
- PDF: `width: 924px`, `height: 1308px`, `printBackground: true`, sem margens, quebra de página entre páginas.
- PNG: screenshot de cada `.page` com `deviceScaleFactor: 2`.
- O nome do arquivo segue `<titulo>-<mes>.pdf` sanitizado.
- Reutilize a mesma instância do navegador entre exportações; feche ao encerrar o servidor.

## 9. Comandos (package.json)

`npm run dev` (servidor + watch do cliente) · `npm run build` · `npm start` · `npm test` · `npm run typecheck` · `npm run seed` (cria `data/campanhas/` de exemplo).
Scripts `iniciar.bat` e `iniciar.sh` instalam o que faltar, constroem se preciso, sobem o servidor e abrem o navegador. O usuário final **não usa terminal**.

## 10. Convenções de código

- Código **simples e legível**: o responsável é estudante e vai manter. Funções pequenas, sem abstração desnecessária.
- Comentários em português explicando o **porquê** de decisões não óbvias.
- TypeScript `strict`, sem `any`, sem `// @ts-ignore`.
- Toda entrada externa (arquivo, API) é validada com Zod.
- Todo texto do usuário é escapado antes de virar HTML.
- Testes (Vitest) obrigatórios para: markup, schema, migração, storage atômico, conflito de revisão (409), contagem de páginas do PDF exportado.
- Commits pequenos, mensagem em português, um por etapa do PROMPT.md.

## 11. Fora do escopo do v2 (não implemente)

Tela de edição dos catálogos · edição com cor visível dentro do campo (WYSIWYG) · desfazer estrutural · colaboração em tempo real · importar o PDF automaticamente · verificação automática de inconsistências de texto (ex.: "R$ 3.000,00" vs "R$3.000,00") · Docker · empacotar como app de desktop.

## 12. Lições do protótipo (o que NÃO repetir)

O protótipo é um único HTML. Ao portar, corrija:
- Fontes vinham do Google → agora locais (`@fontsource`).
- Escala com `cqw`/`calc` → agora px fixos + `transform: scale()`.
- Logos eram SVGs improvisados → arquivos reais em `data/logos/` com marcador de reserva.
- Estado em `localStorage` → arquivos JSON com `revisao`, histórico e 409.
- Lógica da arte duplicada/misturada com o editor → `src/shared/render.ts` único.
- O painel era reconstruído inteiro em mudanças estruturais → atualizar só o necessário.
- `textos: string[]` com um só item, `span`, `estilo` → `texto: string`, `largura`, `tituloCor`.
- Título sem cor parcial → título aceita o mesmo markup de cor.
- Estouro da página era silencioso → aviso visível.
- Estado antigo do protótipo: o JSON que o protótipo exporta (campos `modelo`, `cartoes[].blocos[]` com `span`, `estilo`, `textos[0]`) deve ser importável por `src/shared/migrate.ts` (testado).

## 13. Suposições (anote em DECISOES.md se mudar alguma)

1. A stack é Node/TypeScript/Express (software local). Campanhas em JSON em arquivos; usuários e sessões em SQLite (`data/vca.db`). Cliente em React.
2. Um único usuário por vez é o caso normal; mais de um editando a mesma campanha é raro e tratado só por `revisao` + 409.
3. Célula solitária de largura 1 fica à esquerda.
4. O catálogo é editado à mão pelo dono do projeto.
5. O servidor escuta só em 127.0.0.1 por padrão.

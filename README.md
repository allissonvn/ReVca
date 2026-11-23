# Editor de Condições Comerciais (VCA)

Aplicativo **local** para montar e editar o PDF mensal "Parcelamento Matriz" (condições comerciais de empreendimentos). A arte é fixa; você altera só o conteúdo: textos, títulos de blocos, empreendimento, mês. Saídas: **PDF** (uma página por página da campanha) e **PNG** por página (para WhatsApp).

## Como usar (usuário final)

1. Instale o **Node.js** (versão 20 ou maior): https://nodejs.org — só uma vez.
2. Dê **dois cliques** em `iniciar.bat` (Windows) ou execute `./iniciar.sh` (Linux/macOS).
   - Na primeira vez, ele instala dependências e constrói o aplicativo (pode demorar alguns minutos).
   - Depois, o navegador abre em `http://127.0.0.1:8080`.
3. Para encerrar, feche a janela preta (ou `Ctrl+C`).

## O que dá para fazer

- **Campanhas**: grade com miniatura da 1ª página, busca por título/mês; criar, duplicar para outro mês, excluir (vai para a lixeira).
- **Páginas**: adicionar escolhendo o modelo (residencial, duplo, loteamentos, aviso), subir/descer, duplicar, excluir; "ver todas" na prévia.
- **Cartões**: escolher empreendimento do catálogo (preenche faixas e logo), editar faixa azul e faixa verde.
- **Blocos**: ligar/desligar, título pronto ou livre, largura (1 ou 2 colunas), ordem; cada linha do texto vira um chip.
- **Cores por seleção (estilo Canva)**: selecione um trecho no campo e clique **🎨 Cor** — escolha uma amostra ou uma cor RGB personalizada; **Sem cor** tira as cores do trecho. O campo mostra o texto limpo, sem códigos (funciona no texto e nos títulos).
- **Salvamento automático**: ~800 ms após parar de digitar; indicador "salvo / salvando / erro / conflito".
- **Aviso de estouro**: se o conteúdo passar da altura da página, um aviso aparece na prévia.
- **Exportar**: botão **⬇ PDF** (todas as páginas, qualidade alta) ou **⚙ Opções de exportação…** — escolha formato (PDF/PNG), páginas (todas ou só a atual) e qualidade (**Alta** — vetorial/2×, ou **Comprimida** — rasterizada, arquivo menor, boa para WhatsApp).

## Dados

- **Campanhas** ficam em arquivos JSON na pasta `data/campanhas/`; **usuários e sessões** ficam em SQLite (`data/vca.db`).
- Login por e-mail/senha com papel (`admin`, `editor` ou `leitor`); a sessão fica em cookie e dura 7 dias. O primeiro acesso cadastra o administrador.
- O `leitor` visualiza todas as campanhas e exporta, mas não edita (a interface esconde os campos de edição).
- A cada gravação, a versão anterior vai para `data/historico/` (20 mais recentes).
- Excluir campanha move para `data/lixeira/` (não apaga).
- Catálogos (empreendimentos, títulos prontos, modelos) ficam em `data/catalogos/` e podem ser editados à mão.

## Compartilhando o projeto

- **Não** envie o `data/vca.db` no zip (tem os hashes das senhas) nem o `node_modules` (binários compilados para o seu sistema). Envie o projeto sem esses itens; quem receber roda `npm install` no destino.

## Para quem desenvolve

```bash
npm install        # dependências
npm run dev        # servidor + rebuild do cliente ao salvar
npm run build      # constrói em dist/
npm start          # roda o build (node dist/server/index.js)
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run seed       # cria uma campanha de exemplo em data/campanhas/
```

- Stack: Node 20+, TypeScript strict, Express, Zod, React 19 (esbuild), SQLite (usuários/sessões), bcryptjs (senhas), Puppeteer (exportação), Vitest. Sem framework de componentes no cliente.
- A arte (layout das páginas) vive **só** em `src/shared/render.ts` — usada pela prévia do editor e pelo exportador.
- `HOST` e `PORT` podem ser trocados por variáveis de ambiente (padrão `127.0.0.1:8080`).

### Como rodar os testes

```bash
npm test           # suíte completa (Vitest)
npm test -- render # só um arquivo (nome parcial do arquivo)
```

- **Não precisa de servidor, banco nem de `npm run seed`.** Cada teste sobe o seu próprio
  servidor em porta efêmera, com os dados numa pasta temporária do sistema.
- **Não depende de `data/campanhas/`** (que é gitignored e só existe depois do seed): as
  campanhas usadas nos testes são construídas em código, em `tests/helpers/fixtures.ts`.
  Os catálogos em `data/catalogos/` são versionados e podem ser lidos normalmente.
- **Os testes de exportação usam o Chromium do Puppeteer** (é eles que contam as páginas do
  PDF). Se o Chromium não estiver instalado, **esses testes são pulados** e os demais rodam
  normalmente. Para instalar: `npx puppeteer browsers install chrome`.
- `npm run typecheck` (`tsc --noEmit`) e `npm run build` são separados do `npm test`.
- Esperado hoje: **127 testes em 8 arquivos, todos passando**.

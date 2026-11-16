# Editor de Condições Comerciais (VCA)

Aplicativo **local** para montar e editar o PDF mensal "Parcelamento Matriz" (condições comerciais de empreendimentos). A arte é fixa; você altera só o conteúdo: textos, títulos de blocos, empreendimento, mês. Saídas: **PDF** (uma página por página da campanha) e **PNG** por página (para WhatsApp).

## Como usar (usuário final)

1. Instale o **Node.js** (versão 20 ou maior): https://nodejs.org — só uma vez.
2. Dê **dois cliques** em `iniciar.bat` (Windows) ou execute `./iniciar.sh` (Linux/macOS).
   - Na primeira vez, ele instala dependências e constrói o aplicativo (pode demorar alguns minutos).
   - Depois, o navegador abre em `http://127.0.0.1:8080`.
3. Para encerrar, feche a janela preta (ou `Ctrl+C`).

## O que dá para fazer

- **Campanhas**: criar, duplicar para outro mês, excluir (vai para a lixeira).
- **Páginas**: adicionar escolhendo o modelo (residencial, duplo, loteamentos, aviso), subir/descer, duplicar, excluir; "ver todas" na prévia.
- **Cartões**: escolher empreendimento do catálogo (preenche faixas e logo), editar faixa azul e faixa verde.
- **Blocos**: ligar/desligar, título pronto ou livre, largura (1 ou 2 colunas), ordem; cada linha do texto vira um chip.
- **Cores por seleção**: selecione um trecho no campo e clique **Azul** ou **Vermelho** (funciona no texto e nos títulos).
- **Salvamento automático**: ~800 ms após parar de digitar; indicador "salvo / salvando / erro / conflito".
- **Aviso de estouro**: se o conteúdo passar da altura da página, um aviso aparece na prévia.
- **Exportar**: botões **⬇ PDF** (todas as páginas) e **⬇ PNG desta página** (a página selecionada da prévia; em "ver todas", consulte o PDF).

## Dados

- Tudo fica em arquivos JSON na pasta `data/` (sem banco de dados).
- A cada gravação, a versão anterior vai para `data/historico/` (20 mais recentes).
- Excluir campanha move para `data/lixeira/` (não apaga).
- Catálogos (empreendimentos, títulos prontos, modelos) ficam em `data/catalogos/` e podem ser editados à mão.

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

- Stack: Node 20+, TypeScript strict, Express, Zod, esbuild, Puppeteer (exportação), Vitest. Sem banco, sem framework front-end.
- A arte (layout das páginas) vive **só** em `src/shared/render.ts` — usada pela prévia do editor e pelo exportador.
- `HOST` e `PORT` podem ser trocados por variáveis de ambiente (padrão `127.0.0.1:8080`).
- Decisões de projeto em `DECISOES.md`; especificação completa em `AGENTS.md`.

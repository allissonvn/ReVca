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


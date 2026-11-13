# Decisões do projeto

- Node.js 22 LTS instalado na máquina (o projeto exige Node 20+; nenhuma versão do Node estava presente).
- Puppeteer será inicializado com `headless: true` e canal padrão (Chromium baixado pelo próprio pacote).
- Git instalado para versionar as fases (`feat: phase N - <resumo>`).
- `.gitignore` também exclui `data/campanhas/` (dados do usuário gerados em runtime); catálogos ficam versionados.

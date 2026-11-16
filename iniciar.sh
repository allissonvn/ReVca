#!/usr/bin/env bash
# Inicia o Editor de Condições Comerciais (VCA) para o usuário final.
# Instala o que faltar, constrói se preciso, sobe o servidor e abre o navegador.
set -e
cd "$(dirname "$0")"

echo "=== Editor VCA ==="

if ! command -v node >/dev/null 2>&1; then
  echo "[ERRO] Node.js não encontrado. Instale em https://nodejs.org (versão 20 ou maior) e execute este script de novo."
  exit 1
fi

# Instala dependências apenas se faltar (primeira vez)
if [ ! -d node_modules ]; then
  echo "Instalando dependências... (só na primeira vez)"
  npm install
fi

# Constrói apenas se faltar
if [ ! -f dist/server/index.js ]; then
  echo "Construindo o aplicativo..."
  npm run build
fi

# Abre o navegador (best-effort; Linux/macOS)
( xdg-open http://127.0.0.1:8080 2>/dev/null || open http://127.0.0.1:8080 2>/dev/null ) &

echo "Servidor iniciando em http://127.0.0.1:8080 ..."
echo "Feche com Ctrl+C para encerrar o editor."
node dist/server/index.js

@echo off
rem Inicia o Editor de Condicoes Comerciais (VCA) para o usuario final.
rem Instala o que faltar, constroi se preciso, sobe o servidor e abre o navegador.
setlocal
cd /d "%~dp0"

echo === Editor VCA ===

rem ---- Node.js presente? ----
where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org ^(versao 20 ou maior^) e execute este arquivo de novo.
  pause
  exit /b 1
)

rem ---- Instala dependencias apenas se faltar (primeira vez) ----
if not exist "node_modules\" (
  echo Instalando dependencias... ^(so na primeira vez^)
  call npm install
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

rem ---- Constroi apenas se faltar (primeira vez ou apos atualizacao manual) ----
if not exist "dist\server\index.js" (
  echo Construindo o aplicativo...
  call npm run build
  if errorlevel 1 (
    echo [ERRO] Falha na construcao.
    pause
    exit /b 1
  )
)

rem ---- Abre o navegador em quanto o servidor sobe ----
start "" http://127.0.0.1:8080

echo Servidor iniciando em http://127.0.0.1:8080 ...
echo Feche esta janela para encerrar o editor.
node dist\server\index.js
pause

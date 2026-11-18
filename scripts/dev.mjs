// Modo desenvolvimento: servidor Express + esbuild em watch (cliente e
// servidor). Reconstrói dist/ ao salvar e reinicia o processo do servidor
// quando o bundle dele muda. Roda com `npm run dev`.
import { context } from "esbuild";
import { spawn } from "node:child_process";
import { copyFileSync } from "node:fs";
import { createConnection } from "node:net";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url))); // raiz do projeto
const PORT = process.env.PORT ?? "8080";

let servidor = null;
let reiniciando = false;

/** true se algo já está escutando na porta (ex.: servidor esquecido de outra sessão). */
function portaEmUso(porta) {
  return new Promise((resolve) => {
    const sock = createConnection({ host: "127.0.0.1", port: Number(porta) });
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("error", () => resolve(false));
  });
}

function subirServidor() {
  servidor = spawn(process.execPath, [join(root, "dist/server/index.js")], {
    env: { ...process.env, PORT },
    stdio: "inherit",
  });
  servidor.on("exit", (code) => {
    servidor = null;
    if (code !== null && code !== 0 && !reiniciando) process.exit(code);
  });
}

function matarServidor() {
  if (servidor) { servidor.kill(); servidor = null; }
}

// reconstrução do servidor: mata e sobe de novo quando o bundle muda
async function vigiarServidor() {
  const ctx = await context({
    entryPoints: [join(root, "src/server/index.ts")],
    outfile: join(root, "dist/server/index.js"),
    bundle: true,
    platform: "node",
    format: "esm",
    sourcemap: true,
    external: ["puppeteer"],
    banner: { js: `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);` },
    logLevel: "warning",
    plugins: [{
      name: "reiniciar-servidor",
      setup(build) {
        build.onEnd(() => {
          reiniciando = true;
          matarServidor();
          subirServidor();
          reiniciando = false;
        });
      },
    }],
  });
  await ctx.watch();
}

// cliente: só watch (o Express serve dist/client)
async function vigiarCliente() {
  const ctx = await context({
    entryPoints: [join(root, "src/client/main.tsx")],
    outdir: join(root, "dist/client"),
    bundle: true,
    format: "iife",
    jsx: "automatic",
    sourcemap: true,
    logLevel: "warning",
  });
  await ctx.watch();
}

// CSS: bundle com os tokens e a fonte Inter (mesmo passo do build.mjs).
// Sem isso o dev servia só o styles.css "cru" e o @import de
// ./estilos/tokens.css dava 404 — o editor abria sem layout.
async function vigiarCss() {
  const ctx = await context({
    entryPoints: [join(root, "src/client/styles.css")],
    outfile: join(root, "dist/client/styles.css"),
    bundle: true,
    loader: { ".woff2": "file", ".woff": "file", ".ttf": "file" },
    assetNames: "fonts/[name]-[hash]",
    logLevel: "warning",
  });
  await ctx.watch();
}

// porta ocupada (ex.: servidor de outra sessão ainda de pé): aviso claro
// em vez do stack trace de EADDRINUSE
if (await portaEmUso(PORT)) {
  console.error(`dev: a porta ${PORT} já está em uso.`);
  console.error("Feche o outro Editor VCA (ou encerre os processos node) e rode `npm run dev` de novo.");
  process.exit(1);
}

copyFileSync(join(root, "src/client/index.html"), join(root, "dist/client/index.html"));
subirServidor();
await Promise.all([vigiarServidor(), vigiarCliente(), vigiarCss()]);
console.log(`dev: pronto em http://127.0.0.1:${PORT} (Ctrl+C para sair)`);
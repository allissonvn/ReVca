// Dev: mede o deslocamento (offset) da marca d'água correlacionando o raster
// extraído do PDF com a página de referência rasterizada em 924×1308.
// Só compara as áreas SEM conteúdo (molduras: topo acima do cabeçalho, base,
// laterais fora do cartão), para o cartão/texto não atrapalhar a medição.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "./extract-assets.mjs";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const ref = process.argv[2] ?? join(raiz, "temp", "ref-01.png");
const wm = process.argv[3] ?? join(raiz, "data", "logos", "watermark.png");

const pagina = decodePng(readFileSync(ref));
const marca = decodePng(readFileSync(wm));

const escW = 924 / 595.5;
const larguraNaPagina = Math.round((1274 / 124) * 72 * escW);
const alturaNaPagina = Math.round((1802 / 124) * 72 * escW);

// reduz a marca ao tamanho na página (nearest neighbor, canal R)
const reduzida = Buffer.alloc(larguraNaPagina * alturaNaPagina);
for (let y = 0; y < alturaNaPagina; y++) {
  const sy = Math.min(marca.height - 1, Math.floor((y * marca.height) / alturaNaPagina));
  for (let x = 0; x < larguraNaPagina; x++) {
    const sx = Math.min(marca.width - 1, Math.floor((x * marca.width) / larguraNaPagina));
    reduzida[y * larguraNaPagina + x] = marca.px[(sy * marca.width + sx) * marca.channels];
  }
}

const pgW = pagina.width, pgH = pagina.height, ch = pagina.channels;
const cinza = Buffer.alloc(pgW * pgH);
for (let i = 0; i < pgW * pgH; i++) {
  const b = i * ch;
  cinza[i] = (pagina.px[b] + pagina.px[b + 1] + pagina.px[b + 2]) / 3;
}

// máscara de áreas livres de conteúdo: tudo fora do cabeçalho e do cartão
const livre = Buffer.alloc(pgW * pgH);
for (let y = 0; y < pgH; y++) {
  for (let x = 0; x < pgW; x++) {
    const dentroCartao = x >= 90 && x <= 835 && y >= 250 && y <= 880;
    const dentroCabecalho = y <= 140;
    livre[y * pgW + x] = !dentroCartao && !dentroCabecalho ? 1 : 0;
  }
}

let melhor = { diff: Infinity, ox: 0, oy: 0 };
let faixaX = [-(larguraNaPagina - pgW), 0];
let faixaY = [-(alturaNaPagina - pgH), 0];
for (const passo of [16, 4, 1]) {
  for (let oy = faixaY[0]; oy <= faixaY[1]; oy += passo) {
    for (let ox = faixaX[0]; ox <= faixaX[1]; ox += passo) {
      let diff = 0, n = 0;
      for (let y = 0; y < pgH; y += 2) {
        const wy = y - oy;
        if (wy < 0 || wy >= alturaNaPagina) continue;
        for (let x = 0; x < pgW; x += 2) {
          if (!livre[y * pgW + x]) continue;
          const wx = x - ox;
          if (wx < 0 || wx >= larguraNaPagina) { diff += Math.abs(cinza[y * pgW + x] - 255); n++; continue; }
          diff += Math.abs(reduzida[wy * larguraNaPagina + wx] - cinza[y * pgW + x]);
          n++;
        }
      }
      const med = diff / n;
      if (med < melhor.diff) melhor = { diff: med, ox, oy };
    }
  }
  faixaX = [melhor.ox - passo, melhor.ox + passo];
  faixaY = [melhor.oy - passo, melhor.oy + passo];
}
console.log("melhor offset: left", melhor.ox, "top", melhor.oy, "(diff médio", melhor.diff.toFixed(2) + ")");

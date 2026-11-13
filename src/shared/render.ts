// Arte fixa em um único módulo (AGENTS.md §5): usado pela prévia do editor E pelo exportador.
// Gera HTML como string. Nada de framework, px fixos, todo texto do usuário escapado.
import { renderLinha, escapeHtml } from "./markup.js";
import {
  Bloco, Campanha, Catalogos, Cartao, Empreendimento, Modelo, Pagina,
} from "./schema.js";
import * as L from "./layout.js";

type Barra = { largura: number; esquerda: number; topo: number; alturaPct: number; inclinacao: number };

export type RenderCtx = {
  campanha: Campanha;
  catalogos: Catalogos;
};

export function modeloPorId(catalogos: Catalogos, modeloId: string): Modelo | undefined {
  return catalogos.modelos.find((m) => m.id === modeloId);
}

export function empreendimentoPorId(catalogos: Catalogos, id: string | null): Empreendimento | undefined {
  if (id === null) return undefined;
  return catalogos.empreendimentos.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// CSS da arte (estático): @font-face locais + classes fixas.
// Tamanhos que dependem do modelo entram por variáveis (--esc, --logo, --pad, --gap).
// ---------------------------------------------------------------------------

export function artCss(): string {
  return `
@font-face{font-family:"Anton";font-style:normal;font-weight:400;src:url("/assets/fonts/anton-latin-400-normal.woff2") format("woff2")}
@font-face{font-family:"Oswald";font-style:normal;font-weight:300;src:url("/assets/fonts/oswald-latin-300-normal.woff2") format("woff2")}
@font-face{font-family:"Open Sans";font-style:normal;font-weight:400;src:url("/assets/fonts/open-sans-latin-400-normal.woff2") format("woff2")}
@font-face{font-family:"Open Sans";font-style:normal;font-weight:600;src:url("/assets/fonts/open-sans-latin-600-normal.woff2") format("woff2")}
@font-face{font-family:"Open Sans";font-style:normal;font-weight:700;src:url("/assets/fonts/open-sans-latin-700-normal.woff2") format("woff2")}
*{box-sizing:border-box;margin:0}
.pagina{position:relative;width:${L.PAGINA_LARGURA}px;height:${L.PAGINA_ALTURA}px;overflow:hidden;background:#fff;color:${L.CORES.texto};font-family:'Open Sans',Arial,sans-serif}
.wm-forma{position:absolute;background:${L.CORES.marca};z-index:0}
.wm-disco{position:absolute;border-radius:50%;background:#f3f3f3;z-index:0}
.wm-img{position:absolute;left:${L.MARCA_RASTER.esquerda}px;top:${L.MARCA_RASTER.topo}px;width:${L.MARCA_RASTER.largura}px;height:${L.MARCA_RASTER.altura}px;z-index:0}
.cabecalho{position:relative;z-index:1;height:150px}
.aba{position:absolute;left:${L.ABA.x}px;top:${L.ABA.y}px;width:${L.ABA.largura}px;height:${L.ABA.altura}px;background:${L.CORES.verde};border-radius:0 0 ${L.ABA.raio}px 0}
.titulo-campanha{position:absolute;left:${L.TITULO_X}px;top:${L.TITULO_Y}px;font-family:Anton,Impact,sans-serif;font-weight:400;font-size:${L.TITULO_TAM}px;line-height:1.1;color:${L.CORES.verde}}
.titulo-campanha .mes{display:block;font-family:Oswald,Impact,sans-serif;font-weight:300;color:${L.CORES.azul};text-transform:uppercase}
.logo-vca{position:absolute;right:${L.LOGO_VCA.direita}px;top:${L.LOGO_VCA.topo}px;width:${L.LOGO_VCA.largura}px;height:${L.LOGO_VCA.altura}px}
.faixa-azul{position:relative;z-index:1;margin:0 ${L.FAIXA.margemDir}px 0 ${L.FAIXA.margemEsq}px;background:${L.CORES.azul};color:#fff;text-align:center;font-family:Oswald,Impact,sans-serif;font-weight:300;font-size:${L.FAIXA.fonte}px;line-height:${L.FAIXA.altura}px;height:${L.FAIXA.altura}px;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.faixa-azul.mini{font-size:${L.FAIXA_MINI.fonte}px;line-height:${L.FAIXA_MINI.altura}px;height:${L.FAIXA_MINI.altura}px}
.pilha{position:relative;z-index:1;display:flex;flex-direction:column;gap:${L.GAP_LINHA_BLOCOS}px}
.cartao{min-width:0}
.logo-area{display:flex;justify-content:center;align-items:center;margin:10px auto;height:var(--logo)}
.logo-area img{height:100%}
.logo-ph{border:2px dashed #9aa4d8;color:#6a74b8;font-weight:700;font-size:13px;padding:6px 14px;border-radius:6px}
.caixa{margin:0 auto;width:${L.CARTAO_LARGURA}px}
.faixa-verde{background:${L.CORES.verde};border:${L.FAIXA_VERDE.borda}px solid ${L.CORES.bordaFaixaVerde};color:#fff;text-align:center;font-size:calc(${L.FAIXA_VERDE.fonte}px * var(--esc));line-height:1.3;font-weight:700;padding:${L.FAIXA_VERDE.padding}px 0;text-transform:uppercase}
.corpo{background:${L.CORES.cartao};border:${L.CARTAO_CORPO.borda}px solid ${L.CORES.bordaCartao};border-top:0;border-radius:0 0 ${L.CARTAO_CORPO.raio}px ${L.CARTAO_CORPO.raio}px;padding:var(--pad) ${L.CARTAO_CORPO.paddingLateral}px;display:flex;flex-direction:column;align-items:center;gap:var(--gap);min-height:${L.CARTAO_CORPO.minAltura}px}
.linha-blocos{display:flex;justify-content:space-between;width:100%}
.linha-blocos.centro{justify-content:center}
.bloco-col{display:flex;flex-direction:column;align-items:center;gap:${L.GAP_CHIP}px;min-width:0}
.chip{display:table;background:${L.CORES.chip};border-radius:${L.CHIP.raio}px;padding:${L.CHIP.paddingY}px ${L.CHIP.paddingX}px;font-weight:700;font-size:calc(${L.CHIP.fonte}px * var(--esc));line-height:${L.CHIP.linha};text-align:center}
.chip-titulo{display:table;background:${L.CORES.chip};border-radius:${L.CHIP.raio}px;font-weight:700;text-align:center;font-size:calc(${L.CHIP_TITULO.fonte}px * var(--esc));padding:${L.CHIP_TITULO.paddingY}px ${L.CHIP_TITULO.paddingX}px}
.chip-titulo.vermelho{color:${L.CORES.vermelho};font-size:calc(${L.CHIP_TITULO_VERMELHO.fonte}px * var(--esc));padding:${L.CHIP_TITULO_VERMELHO.paddingY}px ${L.CHIP_TITULO_VERMELHO.paddingX}px}
.cor-azul{color:${L.CORES.azul}}
.cor-vermelho{color:${L.CORES.vermelho}}
.rodape{position:relative;z-index:1;text-align:center;font-size:12px;color:#555;padding:0 34px;margin-top:6px}
`;
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function renderCampanha(campanha: Campanha, catalogos: Catalogos): string {
  return campanha.paginas.map((p) => renderPagina(p, { campanha, catalogos })).join("\n");
}

/** Documento HTML completo (usado por /render/:id e pelo exportador). */
export function renderDocumento(campanha: Campanha, catalogos: Catalogos): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(campanha.titulo)} - ${escapeHtml(campanha.mes)}</title>
<style>body{background:#888}${artCss()}</style>
</head>
<body>
${renderCampanha(campanha, catalogos)}
</body>
</html>`;
}

export function renderPagina(pagina: Pagina, ctx: RenderCtx): string {
  const { campanha, catalogos } = ctx;
  const modelo = modeloPorId(catalogos, pagina.modelo);
  if (!modelo) throw new Error(`Modelo desconhecido: ${pagina.modelo}`);
  const vars = `--esc:${modelo.escala};--logo:${modelo.alturaLogo}px;--pad:${modelo.paddingCartao}px;--gap:${modelo.espacoBlocos}px`;
  const faixaPagina = modelo.faixaPorCartao
    ? ""
    : `<div class="faixa-azul">${escapeHtml(pagina.faixa ?? "")}</div>`;
  const cartoes = pagina.cartoes
    .map((c) => renderCartao(c, modelo, ctx))
    .join("\n");
  const rodape = campanha.rodape
    ? `<div class="rodape">${escapeHtml(campanha.rodape)}</div>`
    : "";
  return `<div class="pagina" style="${vars}" data-pagina="${escapeHtml(pagina.id)}">
${marcaDagua()}
<header class="cabecalho">
<div class="aba"></div>
<div class="titulo-campanha">${escapeHtml(campanha.titulo)}<span class="mes">${escapeHtml(campanha.mes)}</span></div>
<img class="logo-vca" src="/logos/logo-vca.png" alt="VCA">
</header>
${faixaPagina}
<div class="pilha">
${cartoes}
</div>
${rodape}
</div>`;
}

/** Marca d'água: formas CSS de reserva + imagem raster por cima (se existir). */
function marcaDagua(): string {
  const f = L.MARCA_FORMAS;
  const forma = (b: Barra) =>
    `<div class="wm-forma" style="width:${b.largura}px;left:${b.esquerda}px;top:${b.topo}px;height:${b.alturaPct}%;transform:skewX(${b.inclinacao}deg)"></div>`;
  const d = f.disco;
  return `${forma(f.barra1)}
${forma(f.barra2)}
<div class="wm-disco" style="width:${d.tamanho}px;height:${d.tamanho}px;left:${d.esquerda}px;top:${d.topo}px"></div>
<img class="wm-img" src="/logos/watermark.png" alt="">`;
}

// ---------------------------------------------------------------------------
// Cartão
// ---------------------------------------------------------------------------

function renderCartao(cartao: Cartao, modelo: Modelo, ctx: RenderCtx): string {
  const emp = empreendimentoPorId(ctx.catalogos, cartao.empreendimentoId);
  const faixaMini = modelo.faixaPorCartao
    ? `<div class="faixa-azul mini">${escapeHtml(cartao.faixa ?? "")}</div>`
    : "";
  const logo = renderLogo(emp);
  const linhasFaixaVerde = cartao.titulo.filter((l) => l.trim().length > 0).map(escapeHtml).join("<br>");
  const blocosHtml = renderBlocos(cartao, modelo);
  return `<div class="cartao" data-cartao="${escapeHtml(cartao.id)}">
${faixaMini}
<div class="logo-area">${logo}</div>
<section class="caixa">
<h2 class="faixa-verde">${linhasFaixaVerde}</h2>
<div class="corpo">
${blocosHtml}
</div>
</section>
</div>`;
}

function renderLogo(emp: Empreendimento | undefined): string {
  if (emp && emp.logo) {
    return `<img src="/logos/${encodeURIComponent(emp.logo)}" alt="${escapeHtml(emp.nome[0] ?? "")}">`;
  }
  // Sem logo (não cadastrado ou arquivo faltando): marcador tracejado com o nome
  const nome = emp ? emp.nome[0] ?? "empreendimento" : "empreendimento";
  return `<div class="logo-ph">logo: ${escapeHtml(nome)}</div>`;
}

// ---------------------------------------------------------------------------
// Blocos: grade fixa de 2 colunas, fluxo sequencial (AGENTS.md §5)
// ---------------------------------------------------------------------------

type BlocoAtivo = Bloco;

/** Agrupa blocos ativos: cada grupo é uma linha da grade. */
function linhasDaGrade(blocos: BlocoAtivo[]): { blocos: BlocoAtivo[]; solitaria: boolean }[] {
  const ativos = blocos.filter((b) => b.ativo);
  const linhas: { blocos: BlocoAtivo[]; solitaria: boolean }[] = [];
  let acumulado: BlocoAtivo[] = [];
  for (const b of ativos) {
    if (b.largura === 2) {
      if (acumulado.length > 0) {
        descarregarLinha(linhas, acumulado);
        acumulado = [];
      }
      linhas.push({ blocos: [b], solitaria: false });
    } else {
      acumulado.push(b);
      if (acumulado.length === 2) {
        descarregarLinha(linhas, acumulado);
        acumulado = [];
      }
    }
  }
  if (acumulado.length > 0) descarregarLinha(linhas, acumulado);
  return linhas;
}

function descarregarLinha(
  linhas: { blocos: BlocoAtivo[]; solitaria: boolean }[],
  grupo: BlocoAtivo[],
): void {
  for (let i = 0; i < grupo.length; i += 2) {
    const pedaco = grupo.slice(i, i + 2);
    linhas.push({ blocos: pedaco, solitaria: pedaco.length === 1 });
  }
}

function renderBlocos(cartao: Cartao, modelo: Modelo): string {
  const linhas = linhasDaGrade(cartao.blocos);
  return linhas
    .map(({ blocos, solitaria }) => {
      const classe = solitaria && modelo.celulaSolitaria === "centro" ? " linha-blocos centro" : " linha-blocos";
      const cols = blocos.map((b) => renderBloco(b)).join("\n");
      return `<div class="${classe.trim()}">
${cols}
</div>`;
    })
    .join("\n");
}

function renderBloco(bloco: BlocoAtivo): string {
  const largura = bloco.largura === 2 ? "100%" : "50%";
  const tituloChip = bloco.titulo.trim().length > 0
    ? `<div class="chip-titulo${bloco.tituloCor === "vermelho" ? " vermelho" : ""}">${renderLinha(bloco.titulo)}</div>`
    : "";
  const chips = bloco.texto
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => `<div class="chip">${renderLinha(l)}</div>`)
    .join("\n");
  return `<div class="bloco-col" style="width:${largura}" data-bloco="${escapeHtml(bloco.id)}">
${tituloChip}
${chips}
</div>`;
}

// Arte fixa em um único módulo (AGENTS.md §5): usado pela prévia do editor E pelo exportador.
// Gera HTML como string. Nada de framework, px fixos, todo texto do usuário escapado.
import { renderLinha, escapeHtml } from "./markup.js";
import {
  Bloco, Campanha, Catalogos, Cartao, Empreendimento, Modelo, Pagina, Tabela,
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
.faixa-azul.verde{background:${L.CORES.verde};border:${L.FAIXA_VERDE.borda}px solid ${L.CORES.bordaFaixaVerde}}
.faixa-azul.mini{font-size:${L.FAIXA_MINI.fonte}px;line-height:${L.FAIXA_MINI.altura}px;height:${L.FAIXA_MINI.altura}px}
.pilha{position:relative;z-index:1;display:flex;flex-direction:column;gap:${L.GAP_LINHA_BLOCOS}px}
.cartao{min-width:0}
.logo-area{display:flex;justify-content:center;align-items:center;margin:10px auto;height:var(--logo)}
/* Caixa padrão: toda logo ocupa o MESMO espaço (altura do modelo × 1,5 de
 * largura), sem distorção — logos com proporções diferentes (0,7 a 1,4 nos
 * catálogos atuais) ficam uniformes entre cartões */
.logo-area img{height:100%;width:calc(var(--logo) * 1.5);object-fit:contain}
.logo-ph{box-sizing:border-box;border:2px dashed #9aa4d8;color:#6a74b8;font-weight:700;font-size:13px;padding:6px 14px;border-radius:6px;height:var(--logo);width:calc(var(--logo) * 1.5);display:flex;align-items:center;justify-content:center;overflow:hidden}
.caixa{margin:0 auto;width:var(--largura-cartao,${L.CARTAO_LARGURA}px)}
.faixa-verde{background:${L.CORES.verde};border:${L.FAIXA_VERDE.borda}px solid ${L.CORES.bordaFaixaVerde};color:#fff;text-align:center;font-size:calc(${L.FAIXA_VERDE.fonte}px * var(--esc));line-height:1.3;font-weight:700;padding:${L.FAIXA_VERDE.padding}px 0;text-transform:uppercase}
.corpo{background:${L.CORES.cartao};border:${L.CARTAO_CORPO.borda}px solid ${L.CORES.bordaCartao};border-top:0;border-radius:0 0 ${L.CARTAO_CORPO.raio}px ${L.CARTAO_CORPO.raio}px;padding:var(--pad) ${L.CARTAO_CORPO.paddingLateral}px;display:flex;flex-direction:column;align-items:center;gap:var(--gap);min-height:${L.CARTAO_CORPO.minAltura}px}
/* Modelos de tabela: a tabela fica direto na página, sem a caixa do cartão. */
.corpo.sem-caixa{background:transparent;border:0;border-radius:0;padding:var(--pad) 0;min-height:0;gap:0}
.linha-blocos{display:flex;justify-content:space-between;width:100%}
.linha-blocos.centro{justify-content:center}
.bloco-col{display:flex;flex-direction:column;align-items:center;gap:${L.GAP_CHIP}px;min-width:0}
.chip{display:table;background:${L.CORES.chip};border-radius:${L.CHIP.raio}px;padding:${L.CHIP.paddingY}px ${L.CHIP.paddingX}px;font-weight:700;font-size:calc(${L.CHIP.fonte}px * var(--esc));line-height:${L.CHIP.linha};text-align:center;color:#111}
.chip-titulo{display:table;background:${L.CORES.chip};border-radius:${L.CHIP.raio}px;font-weight:700;text-align:center;font-size:calc(${L.CHIP_TITULO.fonte}px * var(--esc));padding:${L.CHIP_TITULO.paddingY}px ${L.CHIP_TITULO.paddingX}px;color:#111}
/* o que o usuário digita é o que aparece: espaços internos preservados e
   palavras longas quebram em vez de estourar o chip (AGENTS.md §5) */
.chip,.chip-titulo{white-space:pre-wrap;overflow-wrap:anywhere}
.chip-titulo.vermelho{color:${L.CORES.vermelho};font-size:calc(${L.CHIP_TITULO_VERMELHO.fonte}px * var(--esc));padding:${L.CHIP_TITULO_VERMELHO.paddingY}px ${L.CHIP_TITULO_VERMELHO.paddingX}px}
.cor-azul{color:${L.CORES.azul}}
.cor-vermelho{color:${L.CORES.vermelho}}
/* Tabela de valores: largura automática (acompanha o conteúdo, como no PDF),
   cabeçalho e linhas de seção escuras, dados alternando branco/cinza. */
.tabela{border-collapse:collapse;table-layout:auto;width:auto;max-width:100%;margin:0 auto}
.tabela th,.tabela td{border:1px solid #111;padding:9px 12px;text-align:center;vertical-align:middle;font-size:calc(15.5px * var(--esc));line-height:1.25;font-weight:400;color:#111;background:#fff;white-space:normal;overflow-wrap:anywhere}
.tabela th{background:#3f3f3f;color:#fff;font-weight:700;text-transform:uppercase}
.tabela tr.secao td{background:#3f3f3f;color:#fff;font-weight:700;text-transform:uppercase}
.tabela tr.destaque td{background:#3f3f3f;color:#fff;font-weight:700;text-transform:uppercase}
.tabela tr.dados.par td{background:#d9d9d9}
.rodape{position:relative;z-index:1;text-align:center;font-size:12px;color:#555;padding:0 34px;margin-top:6px}
`;
}

/**
 * O mesmo CSS da arte, com TODOS os seletores aninhados dentro de `escopo`
 * (ex.: ".arte"). O editor injeta a arte (página inteira e miniaturas) dentro
 * de containers da própria UI; sem o escopo, classes genéricas da arte vazam
 * para fora — ".cabecalho" dava 150px de altura nos títulos das seções e
 * ".faixa-verde" pintava de verde os campos do painel direito.
 * @font-face fica intacto (não tem seletor e vale para a página inteira).
 * Observação: só existem @font-face no topo; um @media futuro seria escopado
 * recursivamente pela mesma rotina.
 */
export function artCssEscopo(escopo: string): string {
  // comentários saem: eles ficam entre regras e atrapalham o pedaço por blocos
  const css = artCss().replace(/\/\*[\s\S]*?\*\//g, "");
  return escoparBlocos(css, escopo);
}

/** Percorre blocos `seletor{corpo}` e prefixa cada seletor com o escopo. */
function escoparBlocos(css: string, escopo: string): string {
  let saida = "";
  let i = 0;
  while (i < css.length) {
    const abre = css.indexOf("{", i);
    if (abre < 0) break;
    // acha o } que fecha ESTE bloco (chaves aninhadas contam)
    let nivel = 1;
    let j = abre + 1;
    while (j < css.length && nivel > 0) {
      if (css[j] === "{") nivel++;
      else if (css[j] === "}") nivel--;
      j++;
    }
    const preludio = css.slice(i, abre).trim();
    const corpo = css.slice(abre + 1, j - 1);
    if (preludio.startsWith("@")) {
      // regra sem seletor (@font-face) fica como está; uma com bloco interno
      // (@media) repassa o corpo para a mesma rotina
      const inner = corpo.includes("{") ? escoparBlocos(corpo, escopo) : corpo;
      saida += `${preludio}{${inner}}`;
    } else {
      const seletores = preludio
        .split(",")
        .map((s) => `${escopo} ${s.trim()}`)
        .join(",");
      saida += `${seletores}{${corpo}}`;
    }
    i = j;
  }
  return saida;
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
  const vars = `--esc:${modelo.escala};--logo:${modelo.alturaLogo}px;--pad:${modelo.paddingCartao}px;--gap:${modelo.espacoBlocos}px;--largura-cartao:${modelo.larguraCartao ?? L.CARTAO_LARGURA}px`;
  // Faixa da página: agora depende do CONTEÚDO (não do modelo). Assim um modelo
  // com faixa por cartão também pode ter uma faixa de página (ex.: "1ª ETAPA"
  // acima da logo e outra por tabela).
  const textoFaixaPagina = (pagina.faixa ?? "").trim();
  const faixaPagina = textoFaixaPagina.length === 0
    ? ""
    : `<div class="faixa-azul${pagina.faixaCor === "verde" ? " verde" : ""}">${escapeHtml(pagina.faixa ?? "")}</div>`;
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
<div class="titulo-campanha">${renderLinha(campanha.titulo)}<span class="mes">${escapeHtml(campanha.mes)}</span></div>
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
  // Faixa do cartão: só nos modelos com faixaPorCartao e quando há texto
  // (faixa vazia não desenha a barra). Tamanho mini por padrão; os modelos de
  // tabela usam a faixa grande (faixaMini: false), como no PDF de valores.
  const faixa = cartao.faixa ?? "";
  const temFaixa = modelo.faixaPorCartao && faixa.trim().length > 0;
  const classeMini = modelo.faixaMini === false ? "" : " mini";
  const classeCorFaixa = cartao.faixaCor === "verde" ? " verde" : "";
  const faixaHtml = temFaixa
    ? `<div class="faixa-azul${classeMini}${classeCorFaixa}">${escapeHtml(faixa)}</div>`
    : "";
  // A faixa pode ficar acima da logo (variação do PDF de valores) ou abaixo.
  const faixaAcima = cartao.faixaPosicao === "acima-logo" ? faixaHtml : "";
  const faixaAbaixo = cartao.faixaPosicao === "acima-logo" ? "" : faixaHtml;
  const logo = cartao.mostrarLogo === false
    ? ""
    : `<div class="logo-area">${renderLogo(emp)}</div>`;
  const linhasFaixaVerde = cartao.titulo
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const faixaVerde = linhasFaixaVerde.length === 0
    ? ""
    : `<h2 class="faixa-verde">${linhasFaixaVerde.map(renderLinha).join("<br>")}</h2>`;
  const blocosHtml = renderBlocos(cartao, modelo, ctx);
  const tabelasHtml = renderTabelas(cartao, modelo, ctx);
  const classeCorpo = modelo.semCaixa ? "corpo sem-caixa" : "corpo";
  return `<div class="cartao" data-cartao="${escapeHtml(cartao.id)}">
${faixaAcima}
${logo}
${faixaAbaixo}
<section class="caixa">
${faixaVerde}
<div class="${classeCorpo}">
${blocosHtml}
${tabelasHtml}
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

function renderBlocos(cartao: Cartao, modelo: Modelo, ctx: RenderCtx): string {
  const linhas = linhasDaGrade(cartao.blocos);
  return linhas
    .map(({ blocos, solitaria }) => {
      const classe = solitaria && modelo.celulaSolitaria === "centro" ? " linha-blocos centro" : " linha-blocos";
      const cols = blocos.map((b) => renderBloco(b, ctx)).join("\n");
      return `<div class="${classe.trim()}">
${cols}
</div>`;
    })
    .join("\n");
}

function renderTabelas(cartao: Cartao, modelo: Modelo, ctx: RenderCtx): string {
  const tabelas = cartao.tabelas ?? [];
  if (tabelas.length === 0) return "";
  return tabelas
    .filter((t) => t.ativo)
    .map((t) => renderTabela(t, ctx))
    .join("\n");
}

function renderBloco(bloco: BlocoAtivo, ctx: RenderCtx): string {
  if (bloco.tabela) return renderBlocoTabela(bloco, ctx);
  const tituloChip = bloco.titulo.trim().length > 0
    ? `<div class="chip-titulo${bloco.tituloCor === "vermelho" ? " vermelho" : ""}">${renderLinha(bloco.titulo.trim())}</div>`
    : "";
  const chips = bloco.texto
    .split("\n")
    // espaços das pontas não afetam um chip centralizado; os internos são preservados (pre-wrap)
    .filter((l) => l.trim().length > 0)
    .map((l) => `<div class="chip">${renderLinha(l.trim())}</div>`)
    .join("\n");
  const larguraPct = bloco.largura === 2 ? "100%" : "50%";
  // data-bloco-nome: atributo puro de metadados (nome do tipo, vindo do catálogo).
  // Só é usado pelo editor para o destaque do bloco selecionado; nunca altera a
  // arte do PDF (o exportador não injeta a regra de outline).
  const nomeTipo = ctx.catalogos.tiposBloco.find((t) => t.id === bloco.tipo)?.nome ?? bloco.tipo;
  return `<div class="bloco-col" style="width:${larguraPct}" data-bloco="${escapeHtml(bloco.id)}" data-bloco-nome="${escapeHtml(nomeTipo)}">
${tituloChip}
${chips}
</div>`;
}

/**
 * Bloco de tabela: cabeçalho escuro + linhas de seção (colspan) + dados
 * alternando branco/cinza. A largura é automática (acompanha o conteúdo) e
 * limitada pela largura do cartão; as células aceitam o mesmo markup de cor
 * dos chips.
 */
function renderBlocoTabela(bloco: BlocoAtivo, ctx: RenderCtx): string {
  const tabela = bloco.tabela;
  if (!tabela) return "";
  const colunas = tabela.cabecalho.length;
  const cabecalho = tabela.cabecalho
    .map((c) => `<th>${renderLinha(c.trim())}</th>`)
    .join("");
  let dados = 0;
  const linhas = tabela.linhas
    .map((linha) => {
      if (linha.secao) {
        return `<tr class="secao"><td colspan="${colunas}">${renderLinha((linha.celulas[0] ?? "").trim())}</td></tr>`;
      }
      // `par` só conta linhas de dados (linhas de seção não entram na conta)
      const par = dados % 2 === 1;
      dados += 1;
      const celulas = linha.celulas.map((c) => `<td>${renderLinha(c.trim())}</td>`).join("");
      const classe = linha.destaque ? "destaque" : `dados${par ? " par" : ""}`;
      return `<tr class="${classe}">${celulas}</tr>`;
    })
    .join("\n");
  const tituloChip = bloco.titulo.trim().length > 0
    ? `<div class="chip-titulo${bloco.tituloCor === "vermelho" ? " vermelho" : ""}">${renderLinha(bloco.titulo.trim())}</div>`
    : "";
  const nomeTipo = ctx.catalogos.tiposBloco.find((t) => t.id === bloco.tipo)?.nome ?? bloco.tipo;
  const larguraPct = bloco.largura === 2 ? "100%" : "50%";
  return `<div class="bloco-col tabela-col" style="width:${larguraPct}" data-bloco="${escapeHtml(bloco.id)}" data-bloco-nome="${escapeHtml(nomeTipo)}">
${tituloChip}
<table class="tabela">
<thead><tr>${cabecalho}</tr></thead>
<tbody>
${linhas}
</tbody>
</table>
</div>`;
}

/**
 * Renderiza uma Tabela (entidade separada, não é bloco).
 * Semelhante a renderBlocoTabela, mas com seus próprios atributos (id, largura, tituloCor).
 */
function renderTabela(tabela: Tabela, ctx: RenderCtx): string {
  const t = tabela.tabela;
  const colunas = t.cabecalho.length;
  const cabecalho = t.cabecalho
    .map((c) => `<th>${renderLinha(c.trim())}</th>`)
    .join("");
  let dados = 0;
  const linhas = t.linhas
    .map((linha) => {
      if (linha.secao) {
        return `<tr class="secao"><td colspan="${colunas}">${renderLinha((linha.celulas[0] ?? "").trim())}</td></tr>`;
      }
      const par = dados % 2 === 1;
      dados += 1;
      const celulas = linha.celulas.map((c) => `<td>${renderLinha(c.trim())}</td>`).join("");
      const classe = linha.destaque ? "destaque" : `dados${par ? " par" : ""}`;
      return `<tr class="${classe}">${celulas}</tr>`;
    })
    .join("\n");
  const tituloChip = tabela.titulo.trim().length > 0
    ? `<div class="chip-titulo${tabela.tituloCor === "vermelho" ? " vermelho" : ""}">${renderLinha(tabela.titulo.trim())}</div>`
    : "";
  const larguraPct = tabela.largura === 2 ? "100%" : "50%";
  return `<div class="bloco-col tabela-col" style="width:${larguraPct}" data-tabela="${escapeHtml(tabela.id)}">
${tituloChip}
<table class="tabela">
<thead><tr>${cabecalho}</tr></thead>
<tbody>
${linhas}
</tbody>
</table>
</div>`;
}

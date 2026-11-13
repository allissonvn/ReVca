// Medidas e cores fixas da arte (AGENTS.md §5). Valores em px da página 924×1308.

export const PAGINA_LARGURA = 924;
export const PAGINA_ALTURA = 1308;
export const CARTAO_LARGURA = 738;

// Cabeçalho fixo
export const ABA = { x: 0, y: 52, largura: 140, altura: 80, raio: 34 };
export const TITULO_X = 155;
export const TITULO_Y = 50;
export const TITULO_TAM = 36;
export const LOGO_VCA = { direita: 34, topo: 58, largura: 146, altura: 50 };

// Faixa azul da página
export const FAIXA = { margemEsq: 33, margemDir: 34, altura: 46, fonte: 36 };
// Faixa azul mini (por cartão)
export const FAIXA_MINI = { altura: 40, fonte: 28 };

// Cartão
export const FAIXA_VERDE = { borda: 1.5, fonte: 17, padding: 9, raioTopo: 0 };
export const CARTAO_CORPO = { borda: 1.5, raio: 8, paddingLateral: 20, minAltura: 90 };
export const CHIP = { raio: 7, paddingY: 2, paddingX: 13, fonte: 15.5, linha: 1.35 };
export const CHIP_TITULO = { fonte: 20, paddingY: 5, paddingX: 15 };
export const CHIP_TITULO_VERMELHO = { fonte: 22, paddingY: 4, paddingX: 15 };
export const GAP_LINHA_BLOCOS = 8; // entre cartões no empilhamento
export const GAP_CHIP = 3;

export const CORES = {
  verde: "#66cc00",
  azul: "#1447ff",
  vermelho: "#ff3b3b",
  chip: "#dfe3f3",
  cartao: "#f4f4f6",
  bordaCartao: "#8fa2ff",
  bordaFaixaVerde: "#3b5bff",
  marca: "#ececec",
  texto: "#111111",
} as const;

// Fallback da marca d'água quando o arquivo watermark.png não existir
export const MARCA_FORMAS = {
  barra1: { largura: 150, esquerda: 330, topo: -131, alturaPct: 140, inclinacao: -24 },
  barra2: { largura: 110, esquerda: 80, topo: -65, alturaPct: 60, inclinacao: -24 },
  disco: { tamanho: 520, esquerda: 200, topo: 330 },
} as const;

// Marca d'água raster (extraída do PDF original): posição e tamanho na página,
// medidos por correlação com a página 1 de referência (scripts/alinhamento.mjs).
export const MARCA_RASTER = { esquerda: -114, topo: -157, largura: 1148, altura: 1624 } as const;

// Tamanho da moldura da página no editor, em função do zoom.
// A arte tem tamanho fixo 924×1308 px; a moldura é o "espaço reservado" que
// o wrapper ocupa no layout (aplicar scale() sozinho não muda o layout, o que
// deixava espaço morto em zooms baixos). Função pura para poder testar.
export const LARGURA_PAGINA = 924;
export const ALTURA_PAGINA = 1308;

/** Limita o zoom à faixa suportada pela barra (25%–200%). */
export function limitarZoom(zoom: number): number {
  return Math.max(0.25, Math.min(2, zoom));
}

/** Tamanho da moldura (já escalado) para um dado zoom. */
export function tamanhoMoldura(zoom: number): { w: number; h: number } {
  const z = limitarZoom(zoom);
  return { w: LARGURA_PAGINA * z, h: ALTURA_PAGINA * z };
}

// Exportação (chamada ao POST /api/campanhas/:id/exportar) e nome de arquivo
// igual às regras do servidor (src/server/export.ts) para a dica do modal.
import { Campanha } from "../shared/schema.js";
import { salvarAgora, estado } from "./store.js";

export type OpcoesExport = {
  formato: "pdf" | "png";
  qualidade: "alta" | "comprimida";
  pagina: "todas" | number;
};

// Evita exportações simultâneas que poderiam gerar downloads duplicados.
let exportando = false;

export function estaExportando(): boolean {
  return exportando;
}

/** Exporta chamando POST /api/campanhas/:id/exportar. PNG sempre sai uma
 * página por arquivo; PDF sai completo (todas as páginas) em um único arquivo. */
export async function exportar(opcoes: OpcoesExport, aoStatus: (s: string) => void): Promise<void> {
  if (exportando) return; // já está exportando, ignora chamadas duplicadas
  const c = estado.campanha;
  if (!c) return;
  exportando = true;
  try {
    await salvarAgora(); // exporta o que está na tela

    // PDF com "todas" as páginas: o servidor já retorna um único PDF com
    // todas as páginas quando nao especifica pagina. Faz so uma requisicao.
    // PNG com "todas": gera um arquivo por pagina, entao faz requisicao por pagina.
    const alvo = opcoes.pagina === "todas" ? c.paginas.map((_, i) => i + 1) : [opcoes.pagina];
    let ok = 0;
    try {
      for (const n of alvo) {
        // PDF: so uma requisicao para todas as pagina. PNG: uma requisicao por pagina.
        if (opcoes.formato === "pdf" && ok > 0) break;
        aoStatus(alvo.length > 1 ? `Gerando… (${ok + 1}/${alvo.length})` : "Gerando…");
        let url = `/api/campanhas/${encodeURIComponent(c.id)}/exportar?formato=${opcoes.formato}&qualidade=${opcoes.qualidade}`;
        if (opcoes.formato === "png" && alvo.length === 1) url += `&pagina=${n}`;
        const resp = await fetch(url, { method: "POST" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const disp = resp.headers.get("content-disposition") ?? "";
        a.download = /filename="([^"]+)"/.exec(disp)?.[1] ?? `${c.titulo}.${opcoes.formato}`;
        a.click();
        URL.revokeObjectURL(a.href);
        ok++;
      }
      aoStatus(alvo.length > 1 ? `${ok} arquivo(s) gerado(s)` : "Arquivo gerado");
    } catch (e) {
      aoStatus(`Erro ao exportar: ${e instanceof Error ? e.message : String(e)}`);
    }
  } finally {
    exportando = false;
  }
}

/** Nome do arquivo que sai, igual às regras do servidor. */
export function nomeExportacao(c: Campanha, formato: string, pagina: "todas" | number): string {
  const bruto = `${c.titulo}-${c.mes}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const nome = `${bruto}.${formato}`;
  return pagina === "todas" ? nome : nome.replace(/(\.[a-z0-9]+)$/, `-pag${pagina}$1`);
}

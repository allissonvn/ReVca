// Lê os 4 catálogos do disco a cada requisição (AGENTS.md §6).
// Logo cujo arquivo não existe vira null (a arte mostra o marcador tracejado).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  Catalogos, Empreendimento, EmpreendimentoSchema, Modelo, ModeloSchema,
  TipoBloco, TipoBlocoSchema, TituloPronto, TituloProntoSchema,
} from "../shared/schema.js";

export function lerCatalogos(raizDados: string): Catalogos {
  const dir = join(raizDados, "catalogos");
  const ler = <T>(arquivo: string, schema: { parse: (d: unknown) => T }): T[] => {
    const dados = JSON.parse(readFileSync(join(dir, arquivo), "utf8"));
    if (!Array.isArray(dados)) throw new Error(`catálogo inválido: ${arquivo}`);
    return dados.map((d) => schema.parse(d));
  };
  const modelos = ler<Modelo>("modelos.json", ModeloSchema);
  const tiposBloco = ler<TipoBloco>("tipos-bloco.json", TipoBlocoSchema);
  const titulos = ler<TituloPronto>("titulos.json", TituloProntoSchema);
  const logosDir = join(raizDados, "logos");
  const empreendimentos = ler<Empreendimento>("empreendimentos.json", EmpreendimentoSchema).map((e) => ({
    ...e,
    logo: e.logo && existsSync(join(logosDir, e.logo)) ? e.logo : null,
  }));
  return { modelos, tiposBloco, titulos, empreendimentos };
}

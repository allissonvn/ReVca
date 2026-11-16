import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CampanhaSchema } from "../src/shared/schema.js";

describe("campanha gerada do PDF de referência", () => {
  const campanha = CampanhaSchema.parse(
    JSON.parse(readFileSync(join("data", "campanhas", "exemplo.json"), "utf8"))
  );

  it("é válida contra o schema", () => {
    expect(campanha).toBeDefined();
  });

  it("tem 19 páginas (igual ao PDF de referência)", () => {
    expect(campanha.paginas.length).toBe(19);
  });

  it("tem 25 cartões no total", () => {
    const total = campanha.paginas.reduce((n, p) => n + p.cartoes.length, 0);
    expect(total).toBe(25);
  });

  it("usa os 4 modelos da arte", () => {
    const modelos = [...new Set(campanha.paginas.map((p) => p.modelo))];
    expect(modelos.sort()).toEqual(["aviso", "duplo", "loteamentos", "residencial"]);
  });

  it("está no mês NOVEMBRO com título BLACK FRIDAY", () => {
    expect(campanha.mes).toBe("NOVEMBRO");
    expect(campanha.titulo).toBe("Parcelamento Matriz - BLACK FRIDAY");
  });

  it("usa apenas empreendimentos presentes no catálogo", () => {
    const cat = JSON.parse(readFileSync(join("data", "catalogos", "empreendimentos.json"), "utf8")) as { id: string }[];
    const idsCatalogo = new Set(cat.map((e) => e.id));
    const idsCampanha = new Set(campanha.paginas.flatMap((p) => p.cartoes).map((c) => c.empreendimentoId).filter((id): id is string => id !== null));
    for (const id of idsCampanha) expect(idsCatalogo.has(id)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { limitarZoom, tamanhoMoldura } from "../src/client/componentes/tamanhoMoldura.js";

describe("tamanhoMoldura", () => {
  it("100%: moldura tem o tamanho da arte (924×1308)", () => {
    expect(tamanhoMoldura(1)).toEqual({ w: 924, h: 1308 });
  });

  it("50%: metade da arte (462×654)", () => {
    expect(tamanhoMoldura(0.5)).toEqual({ w: 462, h: 654 });
  });

  it("150%: uma vez e meia (1386×1962)", () => {
    expect(tamanhoMoldura(1.5)).toEqual({ w: 1386, h: 1962 });
  });

  it("200%: dobro da arte (1848×2616)", () => {
    expect(tamanhoMoldura(2)).toEqual({ w: 1848, h: 2616 });
  });

  it("clamp inferior: zoom abaixo de 25% vira 25%", () => {
    expect(limitarZoom(0.1)).toBe(0.25);
    expect(tamanhoMoldura(0.1)).toEqual(tamanhoMoldura(0.25));
  });

  it("clamp superior: zoom acima de 200% vira 200%", () => {
    expect(limitarZoom(5)).toBe(2);
    expect(tamanhoMoldura(5)).toEqual(tamanhoMoldura(2));
  });
});

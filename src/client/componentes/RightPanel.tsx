// Painel direito reestruturado (Phase 3): stack de Section cards, gap 12.
// 1. Cartão N: empreendimento select; "Faixa verde" como dois inputs full-width.
// 2. Bloco selecionado: chip com tipo; color toolbar (Azul/Vermelho/Sem cor);
//    textarea ≥ 5 rows auto-growing; Segmented "2 colunas | 1 coluna";
//    título colapsável (Type icon, título atual, "Alterar ▾").
// 3. Outros blocos: linha compacta por bloco (grip, nome, primeira linha,
//    eye toggle). Clicar seleciona e expande acima.
// 4. "Rodapé" e "Duplicar para outro mês" em seção "Campanha" colapsada por
//    default.
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { BlocoSchema } from "../../shared/schema.js";
import { empreendimentoDe, modeloDe, tipoBlocoDe, estado, useEstado, marcarSujo } from "../store.js";
import { Section } from "../ui/Card.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Segmented } from "../ui/Segmented.js";
import { Chip } from "../ui/Chip.js";
import { CampoCor } from "./CampoCor.js";
import {
  Shield,
  Eye,
  EyeOff,
  Pencil,
  Type,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
} from "lucide-react";

type BlocoSel = { ci: number; bi: number };

type Props = {
  onDuplicar: () => void;
};

export function RightPanel({ onDuplicar }: Props): JSX.Element | null {
  const e = useEstado();
  const c = e.campanha;
  if (!c || !e.catalogos) return <aside className="right-panel" />;
  const pag = c.paginas[e.pagSelecionada];
  if (!pag) return <aside className="right-panel" />;
  const modelo = modeloDe(pag.modelo);
  const faixaPorCartao = modelo?.faixaPorCartao === true;

  // Estado do bloco selecionado no right panel
  const [blocoSel, setBlocoSel] = useState<BlocoSel | null>(null);
  const [campanhaColapsada, setCampanhaColapsada] = useState(true);
  const [tituloExpandido, setTituloExpandido] = useState(false);

  const cartaoIndex = blocoSel ? blocoSel.ci : 0;
  const car = pag.cartoes[cartaoIndex];
  if (!car) return <aside className="right-panel" />;
  const carAtual = car;

  function pintarBloco(cor: "preto" | "vermelho"): void {
    if (!blocoSel) return;
    const bloco = carAtual!.blocos[blocoSel.bi]!;
    if (!bloco) return;
    bloco.tituloCor = cor;
    marcarSujo();
  }

  function corTituloAtual(): "preto" | "vermelho" {
    if (!blocoSel) return "preto";
    const bloco = carAtual!.blocos[blocoSel.bi]!;
    if (!bloco) return "preto";
    return bloco.tituloCor === "vermelho" ? "vermelho" : "preto";
  }

  return (
    <aside className="right-panel">
      {/* ---- Seção Campanha (colapsada por padrão) ---- */}
      <Section titulo="Campanha" icon={Shield} className={campanhaColapsada ? "secao-colapsada" : ""}>
        <button
          className="btn fantasma"
          type="button"
          onClick={() => setCampanhaColapsada((a) => !a)}
          aria-label={campanhaColapsada ? "Expandir seção Campanha" : "Colapsar seção Campanha"}
        >
          {campanhaColapsada ? <ChevronRight size={14} strokeWidth={2} /> : <ChevronDown size={14} strokeWidth={2} />}
          {campanhaColapsada ? "Mostrar opções da campanha" : "Esconder opções da campanha"}
        </button>
        {!campanhaColapsada && (
          <div className="secao-conteudo">
            <label>Rodapé (opcional)
              <input
                value={c.rodape ?? ""}
                placeholder="Ex.: Validade: 30/11"
                aria-label="Rodapé das páginas"
                onChange={(ev) => { if (ev.target.value) c.rodape = ev.target.value; else delete c.rodape; marcarSujo(); }}
              />
            </label>
            <Button variant="ghost" block onClick={onDuplicar} title="Cria uma cópia desta campanha para outro mês">
              Duplicar para outro mês
            </Button>
          </div>
        )}
      </Section>

      {/* ---- Seção Cartão ---- */}
      <Section titulo={`Cartão ${cartaoIndex + 1}`} icon={Shield}>
        <div className="secao-conteudo">
          <label>Empreendimento
            <select
              value={carAtual!.empreendimentoId ?? ""}
              aria-label={`Empreendimento do cartão ${cartaoIndex + 1}`}
              onChange={(ev) => {
                carAtual!.empreendimentoId = ev.target.value || null;
                const escolhido = empreendimentoDe(carAtual!.empreendimentoId);
                if (escolhido) {
                  carAtual!.titulo = [...escolhido.nome];
                  if (escolhido.faixa) {
                    const pagAtual = estado.campanha?.paginas[estado.pagSelecionada];
                    if (modeloDe(pagAtual?.modelo ?? "")?.faixaPorCartao) carAtual!.faixa = escolhido.faixa;
                    else if (pagAtual) pagAtual.faixa = escolhido.faixa;
                  }
                }
                marcarSujo();
              }}
            >
              <option value="">(sem catálogo)</option>
              {e.catalogos.empreendimentos.map((x) => (
                <option key={x.id} value={x.id}>{x.nome[0] ?? x.id}</option>
              ))}
            </select>
          </label>

          {faixaPorCartao && (
            <label>Faixa azul do cartão
              <input
                value={carAtual!.faixa ?? ""}
                aria-label={`Faixa azul do cartão ${cartaoIndex + 1}`}
                onChange={(ev) => { carAtual!.faixa = ev.target.value; marcarSujo(); }}
              />
            </label>
          )}

          {/* Faixa verde: duas entradas full-width */}
          <div className="faixa-verde">
            <label>Faixa verde, linha 1
              <CampoCor
                marcado={carAtual!.titulo[0] ?? ""}
                aria={`Faixa verde linha 1 do cartão ${cartaoIndex + 1}`}
                aoMudar={(m) => { carAtual!.titulo[0] = m; marcarSujo(); }}
              />
            </label>
            <label>Faixa verde, linha 2
              <CampoCor
                marcado={carAtual!.titulo[1] ?? ""}
                aria={`Faixa verde linha 2 do cartão ${cartaoIndex + 1}`}
                aoMudar={(m) => { if (m) carAtual!.titulo[1] = m; else carAtual!.titulo = [carAtual!.titulo[0] ?? ""]; marcarSujo(); }}
              />
            </label>
          </div>
        </div>
      </Section>

      {/* ---- Seção Bloco selecionado ---- */}
      {blocoSel && (
        <Section
          titulo="Bloco selecionado"
          icon={Pencil}
          className="secao-bloque-selecionado"
        >
          <div className="secao-conteudo">
            <div className="bloco-cabecalho">
              <Chip>
                {tipoBlocoDe(carAtual!.blocos[blocoSel.bi]!.tipo)?.nome ?? carAtual!.blocos[blocoSel.bi]!.tipo}
              </Chip>
              <div className="bloco-cor-toolbar">
                <button
                  className={`btn fantasma ${corTituloAtual() === "preto" ? "ativo" : ""}`}
                  type="button"
                  title="Azul"
                  onClick={() => pintarBloco("preto")}
                  aria-label="Pintar de azul"
                >
                  Azul
                </button>
                <button
                  className={`btn fantasma ${corTituloAtual() === "vermelho" ? "ativo" : ""}`}
                  type="button"
                  title="Vermelho"
                  onClick={() => pintarBloco("vermelho")}
                  aria-label="Pintar de vermelho"
                >
                  Vermelho
                </button>
                <button
                  className={`btn fantasma ${corTituloAtual() === "preto" ? "ativo" : ""}`}
                  type="button"
                  title="Sem cor"
                  onClick={() => pintarBloco("preto")}
                  aria-label="Sem cor"
                >
                  Sem cor
                </button>
                <IconButton
                  icon={carAtual!.blocos[blocoSel.bi]!.ativo ? EyeOff : Eye}
                  cor="muted"
                  aria-label={carAtual!.blocos[blocoSel.bi]!.ativo ? "Ocultar bloco" : "Exibir bloco"}
                  onClick={() => {
                    carAtual!.blocos[blocoSel.bi]!.ativo = !carAtual!.blocos[blocoSel.bi]!.ativo;
                    marcarSujo();
                  }}
                />
              </div>
            </div>

            <label>Texto (uma linha = um chip)
              <CampoCor
                marcado={carAtual!.blocos[blocoSel.bi]!.texto}
                multilinea
                aria={`Texto do bloco selecionado`}
                aoMudar={(m: string) => { carAtual!.blocos[blocoSel.bi]!.texto = m; marcarSujo(); }}
              />
            </label>

            <div className="bloco-largura">
              <label>Largura
                <Segmented
                  opcoes={[
                    { valor: "2", rotulo: "2 colunas" },
                    { valor: "1", rotulo: "1 coluna" },
                  ]}
                  valor={carAtual!.blocos[blocoSel.bi]!.largura.toString()}
                  onMudar={(v: string) => { carAtual!.blocos[blocoSel.bi]!.largura = Number(v) as 1 | 2; marcarSujo(); }}
                />
              </label>
            </div>

            {/* Título colapsável */}
            <div className="bloco-titulo-row" onClick={() => setTituloExpandido((a) => !a)}>
              <Type size={16} strokeWidth={2} aria-hidden="true" />
              <span className="bloco-titulo-texto">{carAtual!.blocos[blocoSel.bi]!.titulo || "(sem título)"}</span>
              <span className="bloco-titulo-acao">Alterar ▾</span>
            </div>
            {tituloExpandido && (
              <div className="bloco-titulo-expandido">
                <label>Cor do título
                  <select
                    value={carAtual!.blocos[blocoSel.bi]!.tituloCor}
                    aria-label="Cor do título do bloco"
                    onChange={(ev) => {
                      if (ev.target.value === "preto" || ev.target.value === "vermelho") {
                        carAtual!.blocos[blocoSel.bi]!.tituloCor = ev.target.value;
                        marcarSujo();
                      }
                    }}
                  >
                    <option value="preto">Preto</option>
                    <option value="vermelho">Vermelho</option>
                  </select>
                </label>
                <label>Título (texto livre)
                  <CampoCor
                    marcado={carAtual!.blocos[blocoSel.bi]!.titulo}
                    aria={`Título do bloco selecionado`}
                    aoMudar={(m: string) => { carAtual!.blocos[blocoSel.bi]!.titulo = m; marcarSujo(); }}
                  />
                </label>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ---- Outros blocos ---- */}
      <Section titulo="Outros blocos" icon={Layers}>
        <div className="secao-conteudo">
          {carAtual!.blocos.map((b, bi) => {
            if (blocoSel && blocoSel.ci === cartaoIndex && blocoSel.bi === bi) return null;
            const tipo = tipoBlocoDe(b.tipo);
            const primeiraLinha = b.texto.split("\n")[0] || "";
            return (
              <div
                key={b.id}
                className={`bloco-linha${b.ativo ? "" : " inativo"}`}
                onClick={() => setBlocoSel({ ci: cartaoIndex, bi })}
              >
                <div className="bloco-linha-grip">
                  <GripVertical size={14} strokeWidth={2} />
                </div>
                <div className="bloco-linha-info">
                  <div className="bloco-linha-nome">{tipo?.nome ?? b.tipo}</div>
                  <div className="bloco-linha-texto">{primeiraLinha}</div>
                </div>
                <IconButton
                  icon={b.ativo ? Eye : EyeOff}
                  cor="muted"
                  aria-label={b.ativo ? "Ocultar bloco" : "Exibir bloco"}
                  onClick={() => {
                    b.ativo = !b.ativo;
                    marcarSujo();
                  }}
                />
              </div>
            );
          })}
          <div className="bloco-adicionar">
            <button
              className="btn fantasma bloco"
              type="button"
              onClick={() => {
                const tipoId = "texto";
                const tipo = tipoBlocoDe(tipoId);
                carAtual!.blocos.push(BlocoSchema.parse({
                  id: crypto.randomUUID().slice(0, 8),
                  tipo: tipoId,
                  ativo: true,
                  largura: tipo?.largura ?? 2,
                  titulo: tipo?.tituloPadrao ?? "",
                  tituloCor: tipo?.tituloCor ?? "preto",
                  texto: "",
                }));
                marcarSujo();
              }}
            >
              + Adicionar bloco
            </button>
          </div>
        </div>
      </Section>
    </aside>
  );
}

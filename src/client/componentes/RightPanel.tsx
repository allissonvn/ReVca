// Painel direito reestruturado (Phase 3): stack de Section cards, gap 12.
// 1. Campanha (colapsada): rodapé, duplicar
// 2. Página: modelo, faixa da página, cor da faixa
// 3. Cartão N: empreendimento select; faixa do cartão (cor, posição, mostrar logo);
//    faixa verde como dois inputs full-width
// 4. Bloco/Tabela selecionado: editor específico
// 5. Outros blocos: linha compacta por bloco (grip, nome, primeira linha, eye toggle)
// 6. Tabelas: linha compacta por tabela (grip, título, eye toggle)
// 7. "Rodapé" e "Duplicar para outro mês" em seção "Campanha" colapsada por default.
import type { JSX } from "react";
import { useState } from "react";
import { Cartao, CartaoSchema, Tabela } from "../../shared/schema.js";
import { extrairRanges } from "../../shared/markup.js";
import { empreendimentoDe, modeloDe, tipoBlocoDe, estado, useEstado, marcarSujo, selecionarBloco, selecionarTabela } from "../store.js";
import { novoBloco } from "../blocos.js";
import { Section } from "../ui/Card.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Segmented } from "../ui/Segmented.js";
import { Chip } from "../ui/Chip.js";
import { CampoCor } from "./CampoCor.js";
import { TabelaEditor } from "./TabelaEditor.js";
import { Field } from "../ui/Field.js";
import {
  Shield,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Type,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers,
  FileText,
  Table,
} from "lucide-react";

type BlocoSel = { ci: number; bi: number; tipo: "bloco" } | { ci: number; ti: number; tipo: "tabela" };

function isBlocoSel(sel: BlocoSel | null): sel is { ci: number; bi: number; tipo: "bloco" } {
  return sel !== null && sel.tipo === "bloco";
}

function isTabelaSel(sel: BlocoSel | null): sel is { ci: number; ti: number; tipo: "tabela" } {
  return sel !== null && sel.tipo === "tabela";
}

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

  // Seleção unificada: bloco OU tabela
  const selBruto = e.blocoSelecionado;
  let blocoSel: BlocoSel | null = null;
  if (selBruto) {
    if (selBruto.tipo === "bloco" && pag.cartoes[selBruto.ci]?.blocos[selBruto.bi]) {
      blocoSel = selBruto;
    } else if (selBruto.tipo === "tabela" && pag.cartoes[selBruto.ci]?.tabelas?.[selBruto.ti]) {
      blocoSel = selBruto;
    }
  }
  const [campanhaColapsada, setCampanhaColapsada] = useState(true);
  const [tituloExpandido, setTituloExpandido] = useState(false);

  const cartaoIndex = blocoSel ? blocoSel.ci : 0;
  const car = pag.cartoes[cartaoIndex];
  if (!car) return <aside className="right-panel" />;
  const carAtual = car;
  const ehTabela = blocoSel?.tipo === "tabela";

  // Guardas para evitar "possibly undefined" no JSX
  const tabelaSel = isTabelaSel(blocoSel) && carAtual!.tabelas?.[blocoSel.ti];
  const blocoSelObj = isBlocoSel(blocoSel) && carAtual!.blocos?.[blocoSel.bi];

  function pintarBloco(cor: "preto" | "vermelho"): void {
    if (!isBlocoSel(blocoSel)) return;
    const bloco = carAtual!.blocos[blocoSel.bi]!;
    if (!bloco) return;
    bloco.tituloCor = cor;
    marcarSujo();
  }

  function corTituloAtual(): "preto" | "vermelho" {
    if (!isBlocoSel(blocoSel)) return "preto";
    const bloco = carAtual!.blocos[blocoSel.bi]!;
    if (!bloco) return "preto";
    return bloco.tituloCor;
  }

  function tituloProntoAtual() {
    if (!isBlocoSel(blocoSel)) return null;
    const bloco = carAtual!.blocos[blocoSel.bi]!;
    if (!bloco) return null;
    return e.catalogos?.titulos.find((t) => t.texto === bloco.titulo && t.cor === bloco.tituloCor) ?? null;
  }

  function textoPuro(marcado: string): string {
    return extrairRanges(marcado).plain;
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
            <Field
              id="rodape-campanha"
              label="Rodapé (opcional)"
              value={c.rodape ?? ""}
              placeholder="Ex.: Validade: 30/11"
              onChange={(ev) => { if (ev.target.value) c.rodape = ev.target.value; else delete c.rodape; marcarSujo(); }}
            />
            <Button variant="ghost" block onClick={onDuplicar} title="Cria uma cópia desta campanha para outro mês">
              Duplicar para outro mês
            </Button>
          </div>
        )}
      </Section>

      {/* ---- Seção Página ---- */}
      <Section titulo={`Página ${e.pagSelecionada + 1}`} icon={FileText}>
        <div className="secao-conteudo">
          <Field
            id="modelo-pagina"
            label="Modelo"
            select
            value={pag.modelo}
            opcoes={e.catalogos.modelos.map((m) => ({ valor: m.id, rotulo: m.nome }))}
            onChange={(ev) => {
              const novo = modeloDe(ev.target.value);
              if (!novo) return;
              pag.modelo = novo.id;
              while (pag.cartoes.length > novo.maxCartoes) pag.cartoes.pop();
              while (pag.cartoes.length < novo.minCartoes) pag.cartoes.push(cartaoEmBranco());
              marcarSujo();
            }}
          />
          <Field
            id="faixa-pagina"
            label="Faixa da página"
            value={pag.faixa ?? ""}
            placeholder="Ex.: EMPREENDIMENTOS - VITÓRIA DA CONQUISTA"
            onChange={(ev) => {
              if (ev.target.value) pag.faixa = ev.target.value;
              else delete pag.faixa;
              marcarSujo();
            }}
          />
          <Field
            id="faixa-cor-pagina"
            label="Cor da faixa da página"
            select
            value={pag.faixaCor ?? "azul"}
            opcoes={[
              { valor: "azul", rotulo: "Azul" },
              { valor: "verde", rotulo: "Verde" },
            ]}
            onChange={(ev) => {
              pag.faixaCor = ev.target.value === "verde" ? "verde" : "azul";
              marcarSujo();
            }}
          />
        </div>
      </Section>

      {/* ---- Seção Cartão ---- */}
      <Section titulo={`Cartão ${cartaoIndex + 1}`} icon={Layers}>
        <div className="secao-conteudo">
          <Field
            id={`empreendimento-${cartaoIndex}`}
            label="Empreendimento"
            select
            value={carAtual!.empreendimentoId ?? ""}
            opcoes={[{ valor: "", rotulo: "(nenhum)" }, ...e.catalogos.empreendimentos.map((emp) => ({ valor: emp.id, rotulo: emp.nome[0] ?? emp.id }))]}
            onChange={(ev) => {
              carAtual!.empreendimentoId = ev.target.value || null;
              if (ev.target.value) {
                const emp = empreendimentoDe(ev.target.value);
                if (emp && !carAtual!.faixa) carAtual!.faixa = emp.faixa;
              }
              marcarSujo();
            }}
          />
          <label className="inline">
            <input
              type="checkbox"
              checked={carAtual!.mostrarLogo !== false}
              aria-label="Mostrar logo do cartão"
              onChange={(ev) => { carAtual!.mostrarLogo = ev.target.checked; marcarSujo(); }}
            />
            Mostrar logo
          </label>

          {faixaPorCartao && (
            <>
              <Field
                id={`faixa-cartao-${cartaoIndex}`}
                label="Faixa do cartão"
                value={carAtual!.faixa ?? ""}
                placeholder="Ex.: 1ª ETAPA"
                onChange={(ev) => {
                  if (ev.target.value) carAtual!.faixa = ev.target.value;
                  else delete carAtual!.faixa;
                  marcarSujo();
                }}
              />
              {(carAtual!.faixa ?? "").trim() !== "" && (
                <>
                  <Field
                    id={`faixa-cor-cartao-${cartaoIndex}`}
                    label="Cor da faixa"
                    select
                    value={carAtual!.faixaCor ?? "azul"}
                    opcoes={[
                      { valor: "azul", rotulo: "Azul" },
                      { valor: "verde", rotulo: "Verde" },
                    ]}
                    onChange={(ev) => {
                      carAtual!.faixaCor = ev.target.value === "verde" ? "verde" : "azul";
                      marcarSujo();
                    }}
                  />
                  <Field
                    id={`faixa-posicao-cartao-${cartaoIndex}`}
                    label="Posição da faixa"
                    select
                    value={carAtual!.faixaPosicao ?? "abaixo-logo"}
                    opcoes={[
                      { valor: "abaixo-logo", rotulo: "Abaixo da logo" },
                      { valor: "acima-logo", rotulo: "Acima da logo" },
                    ]}
                    onChange={(ev) => {
                      carAtual!.faixaPosicao = ev.target.value === "acima-logo" ? "acima-logo" : "abaixo-logo";
                      marcarSujo();
                    }}
                  />
                </>
              )}
            </>
          )}

          {/* Faixa verde: duas entradas full-width */}
          <div className="faixa-verde">
            <div className="field">
              <label>
                Faixa verde, linha 1
                <CampoCor
                  marcado={carAtual!.titulo[0] ?? ""}
                  aria={`Faixa verde linha 1 do cartão ${cartaoIndex + 1}`}
                  aoMudar={(m) => { carAtual!.titulo[0] = m; marcarSujo(); }}
                />
              </label>
            </div>
            <div className="field">
              <label>
                Faixa verde, linha 2
                <CampoCor
                  marcado={carAtual!.titulo[1] ?? ""}
                  aria={`Faixa verde linha 2 do cartão ${cartaoIndex + 1}`}
                  aoMudar={(m) => { if (m) carAtual!.titulo[1] = m; else carAtual!.titulo = [carAtual!.titulo[0] ?? ""]; marcarSujo(); }}
                />
              </label>
            </div>
          </div>
        </div>
      </Section>

      {/* ---- Seção Bloco/Tabela selecionado ---- */}
      {blocoSel && (
        <Section
          titulo={ehTabela ? "Tabela selecionada" : "Bloco selecionado"}
          icon={ehTabela ? Table : Pencil}
          className="secao-bloque-selecionado"
        >
          <div className="secao-conteudo">
            <div className="bloco-cabecalho">
              <Chip>
                {ehTabela
                  ? "Tabela de valores"
                  : isBlocoSel(blocoSel) ? tipoBlocoDe(carAtual!.blocos[blocoSel.bi]!.tipo)?.nome ?? carAtual!.blocos[blocoSel.bi]!.tipo : ""}
              </Chip>
              <div className="bloco-cor-toolbar">
                {!ehTabela && (
                  <>
                    <button
                      className={`btn fantasma ${corTituloAtual() === "preto" ? "ativo" : ""}`}
                      type="button"
                      title="Título preto"
                      onClick={() => pintarBloco("preto")}
                      aria-label="Título preto"
                    >
                      Preto
                    </button>
                    <button
                      className={`btn fantasma ${corTituloAtual() === "vermelho" ? "ativo" : ""}`}
                      type="button"
                      title="Título vermelho"
                      onClick={() => pintarBloco("vermelho")}
                      aria-label="Título vermelho"
                    >
                      Vermelho
                    </button>
                  </>
                )}
                <IconButton
                  icon={tabelaSel
                    ? (tabelaSel.ativo ? EyeOff : Eye)
                    : blocoSelObj
                      ? (blocoSelObj.ativo ? EyeOff : Eye)
                      : Eye}
                  cor="muted"
                  aria-label={tabelaSel
                    ? (tabelaSel.ativo ? "Ocultar tabela" : "Exibir tabela")
                    : blocoSelObj
                      ? (blocoSelObj.ativo ? "Ocultar bloco" : "Exibir bloco")
                      : ""}
                  onClick={() => {
                    if (tabelaSel) {
                      tabelaSel.ativo = !tabelaSel.ativo;
                    } else if (blocoSelObj) {
                      blocoSelObj.ativo = !blocoSelObj.ativo;
                    }
                    marcarSujo();
                  }}
                />
                <IconButton
                  icon={Trash2}
                  cor="danger"
                  aria-label={tabelaSel ? "Excluir tabela" : "Excluir bloco"}
                  onClick={() => {
                    const sel = blocoSel;
                    if (!sel || !carAtual) return;
                    if (tabelaSel && isTabelaSel(sel) && carAtual.tabelas) {
                      carAtual.tabelas.splice(sel.ti, 1);
                    } else if (blocoSelObj && isBlocoSel(sel)) {
                      carAtual.blocos.splice(sel.bi, 1);
                    }
                    estado.blocoSelecionado = null;
                    marcarSujo();
                  }}
                />
              </div>
            </div>

            {tabelaSel ? (
              <TabelaEditor tabela={tabelaSel} />
            ) : blocoSelObj ? (
              <>
                <div className="field">
                  <label>
                    Texto (uma linha = um chip)
                    <CampoCor
                      marcado={blocoSelObj.texto}
                      multilinea
                      aria={`Texto do bloco selecionado`}
                      aoMudar={(m: string) => { blocoSelObj.texto = m; marcarSujo(); }}
                    />
                  </label>
                </div>

                <div className="bloco-largura field">
                  <label>
                    Largura
                    <Segmented
                      opcoes={[
                        { valor: "2", rotulo: "2 colunas" },
                        { valor: "1", rotulo: "1 coluna" },
                      ]}
                      valor={blocoSelObj.largura.toString()}
                      onMudar={(v: string) => { blocoSelObj.largura = Number(v) as 1 | 2; marcarSujo(); }}
                    />
                  </label>
                </div>

                <div className="bloco-titulo field">
                  <label>
                    Cor do título
                    <select
                      value={blocoSelObj.tituloCor}
                      onChange={(ev) => {
                        if (ev.target.value === "preto" || ev.target.value === "vermelho") {
                          blocoSelObj.tituloCor = ev.target.value;
                          marcarSujo();
                        }
                      }}
                    >
                      <option value="preto">Preto</option>
                      <option value="vermelho">Vermelho</option>
                    </select>
                  </label>
                </div>

                {/* TÍTULO PRONTO: seleção do catálogo */}
                <div className="field">
                  <label>
                    Título pronto
                    <select
                      id="titulo-pronto-bloco"
                      value={tituloProntoAtual()?.texto ?? ""}
                      aria-label="Título pronto do bloco"
                      onChange={(ev) => {
                        const p = e.catalogos?.titulos.find((x) => x.texto === ev.target.value);
                        if (p) {
                          blocoSelObj.titulo = p.texto;
                          blocoSelObj.tituloCor = p.cor;
                          marcarSujo();
                        }
                      }}
                    >
                      <option value="">(sem título pronto)</option>
                      {e.catalogos.titulos.map((t) => (
                        <option key={t.texto} value={t.texto}>{t.texto}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="field">
                  <label>
                    Título (texto livre)
                    <CampoCor
                      marcado={blocoSelObj.titulo}
                      aria={`Título do bloco selecionado`}
                      aoMudar={(m: string) => { blocoSelObj.titulo = m; marcarSujo(); }}
                    />
                  </label>
                </div>
              </>
            ) : null}
          </div>
        </Section>
      )}

      {/* ---- Outros blocos (exclui tipo "tabela") ---- */}
      <Section titulo="Blocos" icon={Layers}>
        <div className="secao-conteudo">
          {carAtual!.blocos
            .filter((b) => b.tipo !== "tabela")
            .map((b, bi) => {
              const tipo = tipoBlocoDe(b.tipo);
              const resumo = textoPuro(b.texto).split("\n")[0] || "";
              return (
                <div
                  key={b.id}
                  className={`bloco-linha${b.ativo ? "" : " inativo"}`}
                  onClick={() => selecionarBloco(cartaoIndex, bi)}
                >
                  <div className="bloco-linha-grip">
                    <GripVertical size={14} strokeWidth={2} />
                  </div>
                  <div className="bloco-linha-info">
                    <div className="bloco-linha-nome">{tipo?.nome ?? b.tipo}</div>
                    <div className="bloco-linha-texto">{resumo}</div>
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
            <div className="field">
              <label>
                Tipo do novo bloco
                <select
                  id="tipo-novo-bloco"
                  aria-label="Tipo do novo bloco"
                  defaultValue="texto"
                >
                  {e.catalogos.tiposBloco
                    .filter((t) => t.id !== "tabela")
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                </select>
              </label>
            </div>
            <button
              className="btn fantasma bloco"
              type="button"
              onClick={() => {
                const select = document.getElementById("tipo-novo-bloco") as HTMLSelectElement | null;
                const tipoId = select?.value ?? "texto";
                carAtual!.blocos.push(novoBloco(tipoId, tipoBlocoDe(tipoId)));
                marcarSujo();
              }}
            >
              + Adicionar bloco
            </button>
          </div>
        </div>
      </Section>

      {/* ---- Tabelas (nova seção separada) ---- */}
      <Section titulo="Tabelas" icon={Table}>
        <div className="secao-conteudo">
          {(carAtual!.tabelas ?? []).map((t, ti) => (
            <div
              key={t.id}
              className={`bloco-linha${t.ativo ? "" : " inativo"}`}
              onClick={() => selecionarTabela(cartaoIndex, ti)}
            >
              <div className="bloco-linha-grip">
                <GripVertical size={14} strokeWidth={2} />
              </div>
              <div className="bloco-linha-info">
                <div className="bloco-linha-nome">Tabela de valores</div>
                <div className="bloco-linha-texto">{t.titulo || t.tabela.cabecalho.join(" · ")}</div>
              </div>
              <IconButton
                icon={t.ativo ? Eye : EyeOff}
                cor="muted"
                aria-label={t.ativo ? "Ocultar tabela" : "Exibir tabela"}
                onClick={() => {
                  t.ativo = !t.ativo;
                  marcarSujo();
                }}
              />
            </div>
          ))}
          <button
            className="btn fantasma bloco"
            type="button"
            onClick={() => {
              const novaTabela: Tabela = {
                id: crypto.randomUUID().slice(0, 8),
                ativo: true,
                largura: 2,
                titulo: "",
                tituloCor: "preto",
                tabela: {
                  cabecalho: ["COLUNA 1", "COLUNA 2", "COLUNA 3"],
                  linhas: [],
                },
              };
              if (!carAtual!.tabelas) carAtual!.tabelas = [];
              carAtual!.tabelas.push(novaTabela);
              marcarSujo();
            }}
          >
            + Adicionar tabela
          </button>
        </div>
      </Section>
    </aside>
  );
}

/** Cartão em branco ao trocar para um modelo com mais cartões. */
function cartaoEmBranco(): Cartao {
  return CartaoSchema.parse({
    id: crypto.randomUUID().slice(0, 8),
    empreendimentoId: null,
    titulo: ["Condições para o ..."],
    blocos: [novoBloco("texto", tipoBlocoDe("texto"))],
    tabelas: [],
  });
}
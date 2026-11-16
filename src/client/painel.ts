// Painel de edição (AGENTS.md §7). O painel inteiro só é reconstruído em
// mudanças estruturais; digitação atualiza o estado e a prévia sem reconstruir,
// para nunca perder o foco do campo.
import { Bloco, Cartao, Campanha, MesSchema, Pagina, PaginaSchema, CartaoSchema, BlocoSchema } from "../shared/schema.js";
import { aplicarCorNoCampo } from "./cores.js";
import { estado, modeloDe, empreendimentoDe, tipoBlocoDe, aoStatus, marcarSujo, salvarAgora, notificarConteudo } from "./estado.js";
import { criarCampanha, lerCampanha } from "./api.js";

export type EstouroFn = () => Map<string, number>;

let raiz: HTMLElement;
let calcularEstouros: EstouroFn = () => new Map();

export function iniciarPainel(container: HTMLElement, estouros: EstouroFn): void {
  raiz = container;
  calcularEstouros = estouros;
  renderPainel();
  // eventos por delegação: um listener para o painel todo
  raiz.addEventListener("input", aoDigitar);
  raiz.addEventListener("change", aoTrocar);
  raiz.addEventListener("click", aoClicar);
  // o indicador de status atualiza sem reconstruir o painel
  aoStatus(() => atualizarStatus());
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

export function renderPainel(): void {
  const { campanha, catalogos } = estado;
  if (!campanha || !catalogos) {
    raiz.innerHTML = `<p class="dica">Carregando…</p>`;
    return;
  }
  // foco preservado entre reconstruções estruturais
  const focado = document.activeElement as HTMLElement | null;
  const focoData = focado?.dataset ? { f: focado.dataset.f ?? "", car: focado.dataset.car ?? "", blo: focado.dataset.blo ?? "" } : null;

  const pag = campanha.paginas[estado.pagSelecionada];
  raiz.innerHTML = `
  ${barraStatus()}
  <h1>Editor de Condições</h1>
  <fieldset><legend hidden>Campanha</legend>
    <h2>Campanha (vale para todas as páginas)</h2>
    <label>Título
      <input type="text" data-f="titulo-campanha" value="${esc(campanha.titulo)}" aria-label="Título da campanha">
    </label>
    <div class="linha">
      <label style="flex:1">Mês
        <select data-f="mes" aria-label="Mês da campanha">${opcoesMeses(campanha.mes)}</select>
      </label>
      <label style="flex:1">Duplicar para
        <select id="dup-mes" aria-label="Mês para duplicar">${opcoesMeses("")}</select>
      </label>
    </div>
    <button data-act="dup-campanha" title="Cria uma cópia desta campanha para outro mês">Duplicar para outro mês</button>
    <label>Rodapé (opcional)
      <input type="text" data-f="rodape" value="${esc(campanha.rodape ?? "")}" placeholder="Ex.: Validade: 30/11" aria-label="Rodapé das páginas">
    </label>
    <div class="linha">
      <button data-act="abrir-home">Voltar às campanhas</button>
      <button data-act="tema" title="Alternar tema do painel (a arte é sempre clara)">${estado.tema === "escuro" ? "☀ Tema claro" : "🌙 Tema escuro"}</button>
    </div>
  </fieldset>
  <fieldset><legend hidden>Páginas</legend>
    <h2>Páginas (${campanha.paginas.length})</h2>
    <div class="pag-lista">${campanha.paginas.map((p, i) => listaPagina(p, i, campanha.paginas.length)).join("")}</div>
    <div class="linha">
      <select id="novo-modelo" aria-label="Modelo da nova página">${catalogos.modelos.map((m) => `<option value="${esc(m.id)}">${esc(m.nome)}</option>`).join("")}</select>
      <button data-act="pag-add">+ Página</button>
    </div>
    <label class="inline"><input type="checkbox" data-f="ver-todas" ${estado.verTodas ? "checked" : ""}> Ver todas as páginas na prévia</label>
  </fieldset>
  ${pag ? editorPagina(pag) : `<p class="dica">Nenhuma página. Adicione uma acima.</p>`}
  `;

  restaurarFoco(focoData);
  atualizarStatus();
  atualizarAvisos();
}

function barraStatus(): string {
  return `<div class="status" role="status">
    <span class="indicador" id="status-indicador"></span>
    <button data-act="recarregar" id="btn-recarregar" hidden>Recarregar versão do disco</button>
  </div>`;
}

function listaPagina(p: Pagina, i: number, total: number): string {
  const atual = i === estado.pagSelecionada;
  const modelo = modeloDe(p.modelo);
  return `<div class="pag-item${atual ? " atual" : ""}">
    <button class="nome" data-act="pag-sel" data-pag="${i}" title="Abrir página ${i + 1}">
      ${i + 1}. ${esc(p.faixa || p.cartoes[0]?.faixa || "Sem faixa")}
      <small>${esc(modelo?.nome ?? p.modelo)} · ${p.cartoes.length} cartão(ões)</small>
    </button>
    <span class="aviso" data-aviso-pag="${esc(p.id)}" hidden title="">⚠</span>
    <button class="icone" data-act="pag-up" data-pag="${i}" aria-label="Subir página" ${i === 0 ? "disabled" : ""}>▲</button>
    <button class="icone" data-act="pag-down" data-pag="${i}" aria-label="Descer página" ${i === total - 1 ? "disabled" : ""}>▼</button>
    <button class="icone" data-act="pag-dup" data-pag="${i}" aria-label="Duplicar página">⧉</button>
    <button class="icone" data-act="pag-del" data-pag="${i}" aria-label="Excluir página">✕</button>
  </div>`;
}

function editorPagina(pag: Pagina): string {
  const modelo = modeloDe(pag.modelo);
  if (!modelo) return `<p class="dica">Modelo desconhecido: ${esc(pag.modelo)}</p>`;
  return `<fieldset><legend hidden>Página</legend>
    <h2>Página ${estado.pagSelecionada + 1}</h2>
    <div class="linha">
      <label style="flex:1">Modelo
        <select data-f="pag-modelo" aria-label="Modelo da página">${estado.catalogos!.modelos.map((m) => `<option value="${esc(m.id)}" ${m.id === pag.modelo ? "selected" : ""}>${esc(m.nome)}</option>`).join("")}</select>
      </label>
      <label style="flex:1">Faixa azul
        <input type="text" data-f="pag-faixa" value="${esc(pag.faixa ?? "")}" ${modelo.faixaPorCartao ? "disabled" : ""} aria-label="Faixa azul da página">
      </label>
    </div>
    ${modelo.faixaPorCartao ? `<p class="dica">Neste modelo cada cartão tem a própria faixa azul.</p>` : ""}
  </fieldset>
  ${pag.cartoes.map((c, i) => editorCartao(c, i, modelo.faixaPorCartao)).join("")}`;
}

function editorCartao(cartao: Cartao, ci: number, faixaPorCartao: boolean): string {
  const emp = empreendimentoDe(cartao.empreendimentoId);
  const empIdAtual = cartao.empreendimentoId ?? "";
  return `<fieldset data-car="${ci}"><legend hidden>Cartão ${ci + 1}</legend>
    <h2>Cartão ${ci + 1}${emp ? ` — ${esc(emp.nome[0] ?? "")}` : ""}</h2>
    <label>Empreendimento
      <select data-f="car-emp" data-car="${ci}" aria-label="Empreendimento do cartão ${ci + 1}">
        <option value="" ${empIdAtual === "" ? "selected" : ""}>(sem catálogo)</option>
        ${estado.catalogos!.empreendimentos.map((e) => `<option value="${esc(e.id)}" ${e.id === cartao.empreendimentoId ? "selected" : ""}>${esc(e.nome[0] ?? e.id)}</option>`).join("")}
      </select>
    </label>
    ${faixaPorCartao ? `<label>Faixa azul do cartão
      <input type="text" data-f="car-faixa" data-car="${ci}" value="${esc(cartao.faixa ?? "")}" aria-label="Faixa azul do cartão ${ci + 1}">
    </label>` : ""}
    <div class="linha">
      <label style="flex:2">Faixa verde, linha 1
        <input type="text" data-f="car-titulo0" data-car="${ci}" value="${esc(cartao.titulo[0] ?? "")}" aria-label="Faixa verde linha 1 do cartão ${ci + 1}">
      </label>
      <label style="flex:2">linha 2
        <input type="text" data-f="car-titulo1" data-car="${ci}" value="${esc(cartao.titulo[1] ?? "")}" aria-label="Faixa verde linha 2 do cartão ${ci + 1}">
      </label>
    </div>
    <div class="blocos">${cartao.blocos.map((b, bi) => editorBloco(b, ci, bi)).join("")}</div>
    <div class="linha">
      <select data-f="novo-bloco-tipo" data-car="${ci}" aria-label="Tipo do novo bloco">
        ${estado.catalogos!.tiposBloco.map((t) => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join("")}
      </select>
      <button data-act="blo-add" data-car="${ci}">+ Bloco</button>
    </div>
  </fieldset>`;
}

function editorBloco(b: Bloco, ci: number, bi: number): string {
  const tipo = tipoBlocoDe(b.tipo);
  const pronto = estado.catalogos!.titulos.find((t) => t.texto === b.titulo);
  return `<div class="bloco-item${b.ativo ? "" : " desligado"}" data-blo="${bi}">
    <div class="topo">
      <label class="inline"><input type="checkbox" data-f="blo-ativo" data-car="${ci}" data-blo="${bi}" ${b.ativo ? "checked" : ""} aria-label="Bloco ligado/desligado"> ${esc(tipo?.nome ?? b.tipo)}</label>
      <button class="icone" data-act="blo-up" data-car="${ci}" data-blo="${bi}" aria-label="Subir bloco">▲</button>
      <button class="icone" data-act="blo-down" data-car="${ci}" data-blo="${bi}" aria-label="Descer bloco">▼</button>
      <button class="icone" data-act="blo-del" data-car="${ci}" data-blo="${bi}" aria-label="Remover bloco">✕</button>
    </div>
    <div class="linha">
      <label style="flex:2">Título pronto
        <select data-f="blo-titulo-pronto" data-car="${ci}" data-blo="${bi}" aria-label="Título pronto do bloco">
          <option value="" ${b.titulo === "" ? "selected" : ""}>(sem título)</option>
          ${estado.catalogos!.titulos.map((t) => `<option value="${esc(t.texto)}" ${t.texto === b.titulo ? "selected" : ""}>${esc(t.texto)}</option>`).join("")}
          <option value="…" ${!pronto && b.titulo !== "" ? "selected" : ""}>(personalizado)</option>
        </select>
      </label>
      <label style="flex:1">Cor do título
        <select data-f="blo-titulo-cor" data-car="${ci}" data-blo="${bi}" aria-label="Cor do título do bloco">
          <option value="preto" ${b.tituloCor === "preto" ? "selected" : ""}>Preto</option>
          <option value="vermelho" ${b.tituloCor === "vermelho" ? "selected" : ""}>Vermelho</option>
        </select>
      </label>
      <label style="flex:2">Título (texto livre)
        <input type="text" data-f="blo-titulo" data-car="${ci}" data-blo="${bi}" value="${esc(b.titulo)}" aria-label="Título do bloco">
      </label>
    </div>
    <div class="cor-wrap">
      <label>Texto (uma linha = um chip)
        <textarea data-f="blo-texto" data-car="${ci}" data-blo="${bi}" rows="3" aria-label="Texto do bloco">${esc(b.texto)}</textarea>
      </label>
      <div class="botoes-cor">
        <button type="button" class="btn-azul" data-act="cor-azul" title="Azul no trecho selecionado">Azul</button>
        <button type="button" class="btn-vermelho" data-act="cor-vermelho" title="Vermelho no trecho selecionado">Vermelho</button>
        <button type="button" class="btn-sem" data-act="cor-sem" title="Remover cor do trecho selecionado">Sem cor</button>
      </div>
    </div>
    <div class="linha">
      <label style="flex:1">Largura
        <select data-f="blo-largura" data-car="${ci}" data-blo="${bi}" aria-label="Largura do bloco">
          <option value="2" ${b.largura === 2 ? "selected" : ""}>Linha inteira</option>
          <option value="1" ${b.largura === 1 ? "selected" : ""}>Meia coluna</option>
        </select>
      </label>
      <div class="cor-wrap" style="flex:2">
        <div class="dica">No título: selecione no campo acima e clique em</div>
        <div class="botoes-cor">
          <button type="button" class="btn-azul" data-act="cor-azul" data-alvo="titulo" title="Aplicar azul no trecho selecionado do título">Azul</button>
          <button type="button" class="btn-vermelho" data-act="cor-vermelho" data-alvo="titulo" title="Aplicar vermelho no trecho selecionado do título">Vermelho</button>
          <button type="button" class="btn-sem" data-act="cor-sem" data-alvo="titulo" title="Remover cor do trecho selecionado do título">Sem cor</button>
        </div>
      </div>
    </div>
  </div>`;
}

function opcoesMeses(selecionado: string): string {
  return [...MesSchema.options].map((m) => `<option ${m === selecionado ? "selected" : ""}>${m}</option>`).join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Estado ← eventos
// ---------------------------------------------------------------------------

// campos e controles do painel: todos têm .value (input/select/textarea)
type Alvo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function pagAtual(): Pagina | undefined {
  return estado.campanha?.paginas[estado.pagSelecionada];
}

function cartaoAtual(d: DOMStringMap): Cartao | undefined {
  return pagAtual()?.cartoes[Number(d.car ?? -1)];
}

function blocoAtual(d: DOMStringMap): Bloco | undefined {
  return cartaoAtual(d)?.blocos[Number(d.blo ?? -1)];
}

function conteudoMudou(): void {
  // marcarSujo já notifica a prévia (sincrono) e agenda o salvamento
  marcarSujo();
}

function aoDigitar(ev: Event): void {
  const t = ev.target as Alvo;
  const d = t.dataset;
  const c = estado.campanha;
  if (!d.f || !c) return;
  const valor = t.value;
  const pag = pagAtual();
  switch (d.f) {
    case "titulo-campanha": c.titulo = valor; break;
    case "rodape": if (valor) c.rodape = valor; else delete c.rodape; break;
    case "pag-faixa": if (pag) pag.faixa = valor; break;
    case "car-faixa": { const car = cartaoAtual(d); if (car) car.faixa = valor; break; }
    case "car-titulo0": { const car = cartaoAtual(d); if (car) car.titulo[0] = valor; break; }
    case "car-titulo1": { const car = cartaoAtual(d); if (car) { if (valor) car.titulo[1] = valor; else car.titulo = [car.titulo[0] ?? ""]; } break; }
    case "blo-texto": { const b = blocoAtual(d); if (b) b.texto = valor; break; }
    case "blo-titulo": { const b = blocoAtual(d); if (b) b.titulo = valor; break; }
    default: return; // campo desconhecido: não marca sujo
  }
  conteudoMudou();
}

function aoTrocar(ev: Event): void {
  const t = ev.target as Alvo;
  const d = t.dataset;
  const c = estado.campanha;
  if (!d.f || !c) return;
  const pag = pagAtual();
  switch (d.f) {
    case "mes": {
      const mes = t.value as Campanha["mes"];
      if (MesSchema.safeParse(mes).success) { c.mes = mes; conteudoMudou(); }
      break;
    }
    case "ver-todas": estado.verTodas = (t as HTMLInputElement).checked; notificarConteudo(); break;
    case "blo-ativo": {
      const b = blocoAtual(d);
      if (b) { b.ativo = (t as HTMLInputElement).checked; reconstruir(); conteudoMudou(); }
      break;
    }
    case "blo-largura": {
      const b = blocoAtual(d);
      const larg = Number(t.value);
      if (b && (larg === 1 || larg === 2)) { b.largura = larg; reconstruir(); conteudoMudou(); }
      break;
    }
    case "blo-titulo-cor": {
      const b = blocoAtual(d);
      if (b && (t.value === "preto" || t.value === "vermelho")) { b.tituloCor = t.value; reconstruir(); conteudoMudou(); }
      break;
    }
    case "blo-titulo-pronto": {
      const b = blocoAtual(d);
      const pronto = estado.catalogos?.titulos.find((x) => x.texto === t.value);
      if (b && pronto) {
        b.titulo = pronto.texto;
        b.tituloCor = pronto.cor;
        reconstruir(); conteudoMudou();
      }
      break;
    }
    case "car-emp": {
      const car = cartaoAtual(d);
      const emp = empreendimentoDe(t.value || null);
      if (car) {
        car.empreendimentoId = t.value || null;
        if (emp) {
          car.titulo = [...emp.nome];
          // a faixa azul acompanha o empreendimento (do cartão ou da página)
          if (emp.faixa) {
            if (modeloDe(pag?.modelo ?? "")?.faixaPorCartao) car.faixa = emp.faixa;
            else if (pag) pag.faixa = emp.faixa;
          }
        }
        reconstruir(); conteudoMudou();
      }
      break;
    }
    case "pag-modelo": {
      if (pag) {
        const novo = modeloDe(t.value);
        if (novo && PaginaSchema.safeParse({ ...pag, modelo: novo.id }).success) {
          pag.modelo = novo.id;
          // ajusta a quantidade de cartões respeitando min/max do modelo
          while (pag.cartoes.length > novo.maxCartoes) pag.cartoes.pop();
          while (pag.cartoes.length < novo.minCartoes) pag.cartoes.push(cartaoEmBranco());
          reconstruir(); conteudoMudou();
        }
      }
      break;
    }
  }
}

async function aoClicar(ev: MouseEvent): Promise<void> {
  const alvo = (ev.target as HTMLElement).closest<HTMLElement>("[data-act]");
  if (!alvo) return;
  const d = alvo.dataset;
  const c = estado.campanha;
  if (!c) return;
  const ps = c.paginas;
  const i = Number(d.pag ?? -1);
  switch (d.act) {
    case "pag-sel": estado.pagSelecionada = i; reconstruir(); break;
    case "pag-up": if (i > 0) { const a = ps[i - 1] as Pagina, b = ps[i] as Pagina; ps[i - 1] = b; ps[i] = a; if (estado.pagSelecionada === i) estado.pagSelecionada = i - 1; reconstruir(); marcarSujo(); } break;
    case "pag-down": if (i >= 0 && i < ps.length - 1) { const a = ps[i] as Pagina, b = ps[i + 1] as Pagina; ps[i] = b; ps[i + 1] = a; if (estado.pagSelecionada === i) estado.pagSelecionada = i + 1; reconstruir(); marcarSujo(); } break;
    case "pag-dup": if (i >= 0 && ps[i]) { ps.splice(i + 1, 0, copiaPagina(ps[i] as Pagina)); estado.pagSelecionada = i + 1; reconstruir(); marcarSujo(); } break;
    case "pag-del": if (i >= 0) { ps.splice(i, 1); estado.pagSelecionada = Math.min(estado.pagSelecionada, Math.max(0, ps.length - 1)); reconstruir(); marcarSujo(); } break;
    case "pag-add": {
      const modelo = raiz.querySelector<HTMLSelectElement>("#novo-modelo")?.value ?? "residencial";
      ps.push(paginaNova(modelo));
      estado.pagSelecionada = ps.length - 1;
      reconstruir(); marcarSujo();
      break;
    }
    case "blo-up": { const car = cartaoAtual(d); const b = Number(d.blo); if (car && b > 0) { const a = car.blocos[b - 1] as Bloco, x = car.blocos[b] as Bloco; car.blocos[b - 1] = x; car.blocos[b] = a; reconstruir(); marcarSujo(); } break; }
    case "blo-down": { const car = cartaoAtual(d); const b = Number(d.blo); if (car && b < car.blocos.length - 1) { const a = car.blocos[b] as Bloco, x = car.blocos[b + 1] as Bloco; car.blocos[b] = x; car.blocos[b + 1] = a; reconstruir(); marcarSujo(); } break; }
    case "blo-del": { const car = cartaoAtual(d); const b = Number(d.blo); if (car) { car.blocos.splice(b, 1); reconstruir(); marcarSujo(); } break; }
    case "blo-add": {
      const car = cartaoAtual(d);
      const tipoId = raiz.querySelector<HTMLSelectElement>(`select[data-f="novo-bloco-tipo"][data-car="${d.car}"]`)?.value ?? "texto";
      const tipo = tipoBlocoDe(tipoId);
      if (car) {
        car.blocos.push(BlocoSchema.parse({
          id: crypto.randomUUID().slice(0, 8),
          tipo: tipoId,
          ativo: true,
          largura: tipo?.largura ?? 2,
          titulo: tipo?.tituloPadrao ?? "",
          tituloCor: tipo?.tituloCor ?? "preto",
          texto: "",
        }));
        reconstruir(); marcarSujo();
      }
      break;
    }
    case "cor-azul": case "cor-vermelho": case "cor-sem": {
      const campo = campoDoBotao(alvo);
      if (campo) {
        const cor: "azul" | "vermelho" | "sem" = d.act === "cor-azul" ? "azul" : d.act === "cor-vermelho" ? "vermelho" : "sem";
        aplicarCorNoCampo(campo, cor);
        conteudoMudou();
      }
      break;
    }
    case "dup-campanha": {
      const mes = raiz.querySelector<HTMLSelectElement>("#dup-mes")?.value;
      const nova = await criarCampanha({ duplicarDe: c.id, mes });
      await salvarAgora();
      window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
      break;
    }
    case "abrir-home": await salvarAgora(); window.location.href = "/"; break;
    case "tema": {
      estado.tema = estado.tema === "escuro" ? "claro" : "escuro";
      localStorage.setItem("vca-tema", estado.tema);
      aplicarTema();
      renderPainel();
      break;
    }
    case "recarregar": {
      const nova = await lerCampanha(c.id);
      estado.campanha = nova;
      estado.conflito = false;
      estado.status = "salvo";
      reconstruir();
      notificarConteudo();
      break;
    }
  }
}

/** Campo de texto sobre o qual o botão de cor age (textarea do bloco ou título). */
function campoDoBotao(botao: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  const wrap = botao.closest(".cor-wrap");
  if (!wrap) return null;
  const alvoTitulo = botao.dataset.alvo === "titulo";
  if (alvoTitulo) {
    // o título fica no fieldset do bloco (fora do .cor-wrap), identificado pelo bloco
    const blocoDiv = botao.closest(".bloco-item");
    return blocoDiv?.querySelector<HTMLInputElement>('input[data-f="blo-titulo"]') ?? null;
  }
  return wrap.querySelector<HTMLTextAreaElement>("textarea");
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

function cartaoEmBranco(): Cartao {
  return CartaoSchema.parse({
    id: crypto.randomUUID().slice(0, 8),
    empreendimentoId: null,
    titulo: ["Condições para o ..."],
    blocos: [{ id: crypto.randomUUID().slice(0, 8), tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "" }],
  });
}

function paginaNova(modeloId: string): Pagina {
  const modelo = modeloDe(modeloId);
  const n = Math.max(modelo?.minCartoes ?? 1, 1);
  const faixa = modelo?.faixaPorCartao ? undefined : "Nova faixa";
  return PaginaSchema.parse({
    id: crypto.randomUUID().slice(0, 8),
    modelo: modeloId,
    ...(faixa !== undefined ? { faixa } : {}),
    cartoes: Array.from({ length: n }, () => cartaoEmBranco()),
  });
}

function copiaPagina(p: Pagina): Pagina {
  return JSON.parse(JSON.stringify(p)) as Pagina;
}

export function reconstruir(): void {
  renderPainel();
}

function restaurarFoco(data: { f: string; car: string; blo: string } | null): void {
  if (!data || !data.f) return;
  const partes = [`[data-f="${data.f}"]`];
  if (data.car) partes.push(`[data-car="${data.car}"]`);
  if (data.blo) partes.push(`[data-blo="${data.blo}"]`);
  const el = raiz.querySelector<HTMLElement>(partes.join(""));
  if (el) {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.setSelectionRange(el.value.length, el.value.length);
  }
}

function atualizarStatus(): void {
  const el = raiz.querySelector("#status-indicador");
  if (!el) return;
  const textos: Record<string, string> = {
    salvo: "✓ Tudo salvo",
    salvando: "… Salvando",
    sujo: "● Alterações pendentes",
    erro: "✗ Erro ao salvar",
    conflito: "✗ Conflito: a campanha mudou em outro lugar",
  };
  el.textContent = textos[estado.status] ?? "";
  el.className = `indicador ${estado.status}`;
  const btn = raiz.querySelector<HTMLButtonElement>("#btn-recarregar");
  if (btn) btn.hidden = estado.status !== "conflito";
}

/** Marca ⚠ na lista de páginas das páginas com estouro (sem reconstruir o painel). */
export function atualizarAvisos(): void {
  const mapa = calcularEstouros();
  raiz.querySelectorAll<HTMLElement>("[data-aviso-pag]").forEach((el) => {
    const id = el.dataset.avisoPag ?? "";
    el.hidden = !mapa.has(id);
    el.title = mapa.has(id) ? `Conteúdo maior que a página (${mapa.get(id)}px)` : "";
  });
}

export function aplicarTema(): void {
  document.documentElement.dataset.theme = estado.tema;
}

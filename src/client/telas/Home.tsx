import type { JSX } from "react";
// Tela inicial: grade de campanhas com miniatura real da 1ª página (mesmo
// render.ts), busca e ações (abrir, duplicar, excluir).
import { useEffect, useMemo, useState } from "react";
import { artCss, renderCampanha } from "../../shared/render.js";
import { Campanha, Catalogos } from "../../shared/schema.js";
import { CampanhaResumo, listarCampanhas, lerCampanha, lerCatalogos, criarCampanha, excluirCampanha, logout } from "../api.js";
import { estado, alternarTema, useEstado, podeEditar, ehAdmin } from "../store.js";

const LARGURA_MINI = 220;

type Item = { resumo: CampanhaResumo; dados: Campanha };

export function Home(): JSX.Element {
  useEstado(); // re-render quando o tema muda
  // Home só é renderizada com usuário autenticado (gate no App)
  const editor = podeEditar();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    // injeta o CSS da arte uma vez (miniaturas usam as mesmas classes)
    const style = document.createElement("style");
    style.textContent = artCss();
    document.head.appendChild(style);
    void (async () => {
      try {
        const [resumos, catalogos] = await Promise.all([listarCampanhas(), lerCatalogos()]);
        setCatalogos(catalogos);
        // poucas campanhas, servidor local: ler tudo de uma vez é ok
        const lidos = await Promise.all(resumos.map(async (r) => ({ resumo: r, dados: await lerCampanha(r.id) })));
        lidos.sort((a, b) => b.resumo.atualizadoEm.localeCompare(a.resumo.atualizadoEm));
        setItens(lidos);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const filtrados = useMemo(() => {
    if (!itens) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(({ resumo: r }) =>
      r.titulo.toLowerCase().includes(q) || r.mes.toLowerCase().includes(q));
  }, [itens, busca]);

  async function nova(): Promise<void> {
    const nova = await criarCampanha();
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  }

  async function sair(): Promise<void> {
    await logout();
    // força recarga completa: limpa estado local e volta ao login
    window.location.href = "/";
  }

  return (
    <div className="home">
      <header className="topbar">
        <div className="topbar-marca">
          <span className="marca-aba" aria-hidden>Parcelamento</span>
          <h1>Matriz</h1>
        </div>
        <input
          type="search"
          className="campo-busca"
          placeholder="Buscar por título ou mês…"
          aria-label="Buscar campanha"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="topbar-acoes">
          {estado.usuario !== null && (
            <span className="dica" title={`Conectado como ${estado.usuario.email}`}>
              {estado.usuario.nome} ({estado.usuario.papel})
            </span>
          )}
          <button className="btn fantasma" onClick={alternarTema} title="Alternar tema do painel (a arte é sempre clara)">
            {estado.tema === "escuro" ? "☀ Claro" : "🌙 Escuro"}
          </button>
          {ehAdmin() && (
            <button className="btn fantasma" onClick={() => { window.location.href = "/?tela=usuarios"; }} title="Cadastrar e consultar usuários">
              Usuários
            </button>
          )}
          {editor && <button className="btn primario" onClick={() => void nova()}>+ Nova campanha</button>}
          <button className="btn" onClick={() => void sair()} title="Encerrar a sessão">Sair</button>
        </div>
      </header>

      <main className="home-conteudo">
        {erro !== "" && <p className="dica erro">Erro ao carregar: {erro}</p>}
        {itens === null && !erro && <p className="dica">Carregando…</p>}
        {itens !== null && itens.length === 0 && (
          <p className="dica">{editor ? "Nenhuma campanha ainda. Clique em \u201c+ Nova campanha\u201d." : "Nenhuma campanha ainda."}</p>
        )}
        <div className="grade">
          {filtrados.map(({ resumo: r, dados }) => (
            <CartaoCampanha key={r.id} resumo={r} dados={dados} catalogos={catalogos} editor={editor} />
          ))}
        </div>
      </main>
    </div>
  );
}

function CartaoCampanha({ resumo: r, dados, catalogos, editor }: { resumo: CampanhaResumo; dados: Campanha; catalogos: Catalogos | null; editor: boolean }): JSX.Element {
  const data = new Date(r.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const escala = LARGURA_MINI / 924;
  const primeira = dados.paginas[0];

  async function duplicar(): Promise<void> {
    const mes = window.prompt("Duplicar para qual mês? (em maiúsculas, ex.: DEZEMBRO)", "DEZEMBRO");
    if (!mes) return;
    const nova = await criarCampanha({ duplicarDe: r.id, mes });
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  }

  async function excluir(): Promise<void> {
    if (!window.confirm("Mover esta campanha para a lixeira?")) return;
    await excluirCampanha(r.id);
    window.location.reload();
  }

  return (
    <article className="cam-card" data-id={r.id} onClick={() => { window.location.href = `/?campanha=${encodeURIComponent(r.id)}`; }}>
      <div className="cam-mini" style={{ '--cam-mini-w': LARGURA_MINI, '--cam-mini-h': Math.round(1308 * escala) } as React.CSSProperties}>
        {primeira && catalogos ? (
          <div
            className="cam-mini-escala"
            style={{ transform: `scale(${escala})`, width: LARGURA_MINI, height: Math.round(1308 * escala) }}
            // render.ts escapa todo texto do usuário; o HTML é seguro por construção
            dangerouslySetInnerHTML={{ __html: renderCampanha({ ...dados, paginas: [primeira] }, catalogos) }}
          />
        ) : (
          <div className="cam-mini cam-mini-vazia">sem prévia</div>
        )}
      </div>
      <div className="cam-info">
        <div className="cam-linha1">
          <span className="badge-mes">{r.mes}</span>
          <small>{r.nPaginas} pág. · {data}</small>
        </div>
        <b className="cam-titulo">{r.titulo}</b>
      </div>
      <div className="cam-acoes" onClick={(e) => e.stopPropagation()}>
        <button className="btn pequeno" onClick={() => { window.location.href = `/?campanha=${encodeURIComponent(r.id)}`; }}>Abrir</button>
        {editor && <button className="btn pequeno fantasma" onClick={() => void duplicar()}>Duplicar</button>}
        {editor && <button className="btn pequeno perigo" aria-label={`Excluir ${r.titulo}`} onClick={() => void excluir()}>✕</button>}
      </div>
    </article>
  );
}

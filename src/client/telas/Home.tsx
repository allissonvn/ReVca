// Tela inicial: grade de campanhas com miniatura real da 1ª página (mesmo
// render.ts), busca e ações (abrir, duplicar, excluir).
// UI: design system REVCA (Phase 1).
import { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { artCss, renderCampanha } from "../../shared/render.js";
import { Campanha, Catalogos } from "../../shared/schema.js";
import {
  CampanhaResumo,
  listarCampanhas,
  lerCampanha,
  lerCatalogos,
  criarCampanha,
  excluirCampanha,
  logout,
} from "../api.js";
import { estado, alternarTema, useEstado, podeEditar, ehAdmin } from "../store.js";
import { Logo } from "../ui/Logo.js";
import { Button } from "../ui/Button.js";
import { SearchField } from "../ui/SearchField.js";
import { Badge } from "../ui/Badge.js";
import { Chip } from "../ui/Chip.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.js";
import {
  Calendar,
  CopyPlus,
  Trash2,
  Shield,
  Sun,
  Moon,
  LogOut,
  ArrowRight,
} from "lucide-react";

const LARGURA_MINI = 300;

type Item = { resumo: CampanhaResumo; dados: Campanha };

export function Home(): JSX.Element {
  useEstado(); // re-render quando o tema muda
  // Home só é renderizada com usuário autenticado (gate no App)
  const editor = podeEditar();
  const [itens, setItens] = useState<Item[] | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [mesFiltro, setMesFiltro] = useState("Todas");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [excluindoTitulo, setExcluindoTitulo] = useState("");

  // meses que existem nas campanhas
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    if (itens) {
      for (const { resumo } of itens) set.add(resumo.mes);
    }
    return ["Todas", ...Array.from(set).sort()];
  }, [itens]);

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
        const lidos = await Promise.all(
          resumos.map(async (r) => ({ resumo: r, dados: await lerCampanha(r.id) })),
        );
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
    const m = mesFiltro === "Todas" ? "" : mesFiltro;
    return itens.filter(({ resumo: r }) =>
      r.titulo.toLowerCase().includes(q) ||
      r.mes.toLowerCase().includes(q) ||
      (m && r.mes === m),
    );
  }, [itens, busca, mesFiltro]);

  async function nova(): Promise<void> {
    const nova = await criarCampanha();
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  }

  async function sair(): Promise<void> {
    await logout();
    // força recarga completa: limpa estado local e volta ao login
    window.location.href = "/";
  }

  async function duplicar(id: string): Promise<void> {
    const mes = window.prompt("Duplicar para qual mês? (em maiúsculas, ex.: DEZEMBRO)", "DEZEMBRO");
    if (!mes) return;
    const nova = await criarCampanha({ duplicarDe: id, mes });
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  }

  async function confirmarExclusao(): Promise<void> {
    if (!excluindoId) return;
    await excluirCampanha(excluindoId);
    setExcluindoId(null);
    setExcluindoTitulo("");
    window.location.reload();
  }

  function cancelarExclusao(): void {
    setExcluindoId(null);
    setExcluindoTitulo("");
  }

  const usuario = estado.usuario;
  const iniciais = usuario?.nome
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="home">
      <header className="topbar">
        <Logo altura={24} aria-label="REVCA — Home" />
        <div className="topbar-acoes">
          {usuario !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="avatar"
                style={{ width: 32, height: 32, fontSize: 14 }}
                aria-label={`Conectado como ${usuario.email}`}
                aria-hidden="false"
              >
                {iniciais}
              </span>
              <span className="dica" title={`Conectado como ${usuario.email}`}>
                {usuario.nome} ({usuario.papel})
              </span>
            </div>
          )}
          <button
            className="btn btn icon-only text-muted"
            type="button"
            aria-label="Alternar tema do painel (a arte é sempre clara)"
            onClick={alternarTema}
          >
            <svg className="btn-icone" aria-hidden="true" {...(estado.tema === "escuro" ? <Sun /> : <Moon />)} />
          </button>
          {ehAdmin() && (
            <Button variant="ghost" onClick={() => { window.location.href = "/?tela=usuarios"; }}>
              Usuários
            </Button>
          )}
          {editor && <Button variant="primary" onClick={() => void nova()}>+ Nova campanha</Button>}
          <button
            className="btn btn icon-only text-muted"
            type="button"
            title="Encerrar a sessão"
            onClick={() => void sair()}
          >
            <svg className="btn-icone" aria-hidden="true"><LogOut /></svg>
          </button>
        </div>
      </header>

      <main className="home-conteudo">
        {erro !== "" && <p className="dica erro">Erro ao carregar: {erro}</p>}
        {itens === null && !erro && <p className="dica">Carregando…</p>}

        <div className="home-cabeca">
          <div className="home-titulo">
            <h1>Campanhas</h1>
            <p className="dica">Gerencie as campanhas de condições comerciais.</p>
          </div>
          <div className="home-busca-filtros">
            <SearchField
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título ou mês…"
            />
            <div className="filtro-chips">
              {mesesDisponiveis.map((m) => (
                <Chip
                  key={m}
                  selecionado={mesFiltro === m}
                  onClick={() => setMesFiltro(m)}
                >
                  {m}
                </Chip>
              ))}
            </div>
          </div>
          {editor && <Button variant="primary" onClick={() => void nova()}>+ Nova campanha</Button>}
        </div>

        {filtrados.length === 0 && itens !== null && (
          <div className="home-vazio">
            <p className="dica">{editor ? "Nenhuma campanha ainda. Clique em “+ Nova campanha”." : "Nenhuma campanha ainda."}</p>
            {editor && <Button variant="primary" onClick={() => void nova()}>+ Nova campanha</Button>}
          </div>
        )}

        <div className="grade">
          {filtrados.map(({ resumo: r, dados }) => (
            <CartaoCampanha
              key={r.id}
              resumo={r}
              dados={dados}
              catalogos={catalogos}
              editor={editor}
              onDuplicar={() => duplicar(r.id)}
              onExcluir={() => { setExcluindoId(r.id); setExcluindoTitulo(r.titulo); }}
            />
          ))}
          {editor && (
            <article className="cam-card cam-card-vazio">
              <div className="cam-mini cam-mini-vazia">
                <svg className="btn-icone" aria-hidden="true" style={{ width: 32, height: 32, color: "#9aa0ac" }}><CopyPlus /></svg>
              </div>
              <div className="cam-info">
                <h3>Criar a partir da anterior</h3>
                <p className="dica">Duplicar a última campanha para outro mês.</p>
              </div>
            </article>
          )}
        </div>

        {excluindoId && (
          <ConfirmDialog
            aberto={true}
            titulo="Excluir campanha?"
            mensagem={`Tem certeza que deseja mover “${excluindoTitulo}” para a lixeira?`}
            confirmarRotulo="Excluir"
            cancelarRotulo="Cancelar"
            aoConfirmar={confirmarExclusao}
            aoCancelar={cancelarExclusao}
          />
        )}
      </main>
    </div>
  );
}

function CartaoCampanha({
  resumo: r,
  dados,
  catalogos,
  editor,
  onDuplicar,
  onExcluir,
}: {
  resumo: CampanhaResumo;
  dados: Campanha;
  catalogos: Catalogos | null;
  editor: boolean;
  onDuplicar: () => void;
  onExcluir: () => void;
}): JSX.Element {
  const data = new Date(r.atualizadoEm).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const escala = LARGURA_MINI / 924;
  const primeira = dados.paginas[0];

  return (
    <article
      className="cam-card"
      data-id={r.id}
      onClick={() => { window.location.href = `/?campanha=${encodeURIComponent(r.id)}`; }}
    >
      <div className="cam-mini" style={{ '--cam-mini-w': LARGURA_MINI, '--cam-mini-h': Math.round(1308 * escala) } as React.CSSProperties}>
        {primeira && catalogos ? (
          <div
            className="cam-mini-escala"
            style={{ transform: `scale(${escala})`, width: LARGURA_MINI, height: Math.round(1308 * escala) }}
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
        <h3 className="cam-titulo">{r.titulo}</h3>
        <p className="dica">Editado em {data}</p>
      </div>
      <div className="cam-acoes" onClick={(e) => e.stopPropagation()}>
        <Button variant="primary" onClick={() => { window.location.href = `/?campanha=${encodeURIComponent(r.id)}`; }}>
          Abrir <ArrowRight size={14} strokeWidth={2} />
        </Button>
        {editor && (
          <button
            className="btn btn icon-only text-muted"
            type="button"
            aria-label={`Duplicar ${r.titulo}`}
            onClick={onDuplicar}
          >
            <svg className="btn-icone" aria-hidden="true"><CopyPlus /></svg>
          </button>
        )}
        {editor && (
          <button
            className="btn btn icon-only text-danger"
            type="button"
            aria-label={`Excluir ${r.titulo}`}
            onClick={onExcluir}
          >
            <svg className="btn-icone" aria-hidden="true"><Trash2 /></svg>
          </button>
        )}
      </div>
    </article>
  );
}

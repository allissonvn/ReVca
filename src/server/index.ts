// Servidor Express (AGENTS.md §6): API REST + /render + estáticos.
// Escuta em 127.0.0.1 por padrão (HOST/PORT por variável de ambiente).
// v2: autenticação via cookie HTTP-only + papéis editor/leitor.
import express, { Express, Request, Response, NextFunction } from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { ZodError } from "zod";
import {
  Campanha, CampanhaSchema, MESES, AlterarUsuarioSchema, UsuarioResumo,
} from "../shared/schema.js";
import { renderDocumento } from "../shared/render.js";
import { criarStorage, Storage, IdInvalidoError, NaoEncontradoError, ConflitoRevisaoError } from "./storage.js";
import { lerCatalogos } from "./catalogos.js";
import { criarExportador, Exportador, nomeArquivo } from "./export.js";
import { acharRaiz } from "../shared/raiz.js";
import { getDb, fecharDb } from "./db.js";
import { criarAutenticacao } from "./auth.js";

export type OpcoesServidor = {
  raizDados?: string;   // onde ficam campanhas/catálogos/logos (padrão: <projeto>/data)
  raizProjeto?: string; // para servir dist/client (padrão: raiz do projeto)
  storage?: Storage;    // injetável (testes)
  exportador?: Exportador; // injetável (testes)
  autenticacao?: ReturnType<typeof criarAutenticacao>; // injetável (testes)
};

const COOKIE_NOME = "connect.sid";

export function criarApp(opcoes: OpcoesServidor = {}): Express {
  const raiz = opcoes.raizProjeto ?? acharRaiz();
  const raizDados = opcoes.raizDados ?? join(raiz, "data");
  const storage = opcoes.storage ?? criarStorage(raizDados);
  const auth = opcoes.autenticacao ?? criarAutenticacao(raizDados);

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  // guardado para o encerramento fechar o Chromium e o SQLite (AGENTS.md §8)
  const exportador = opcoes.exportador ?? criarExportador({ urlBase: () => (app.locals.urlBase as string | undefined) ?? "http://127.0.0.1:8080" });
  app.locals.exportador = exportador;

  // ---- Middleware de autenticação ----
  type ReqComUsuario = Request & { usuario?: UsuarioResumo };

  /** Extrai o token do cookie HTTP-only connect.sid (único canal de sessão:
   *  nada de token na URL ou em headers, que acabam em logs/histórico). */
  function lerToken(req: Request): string | undefined {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;
    for (const p of cookie.split(";").map((c) => c.trim())) {
      if (p.startsWith(`${COOKIE_NOME}=`)) {
        return p.slice(COOKIE_NOME.length + 1);
      }
    }
    return undefined;
  }

  /** Define o cookie de sessão na resposta (Max-Age é em SEGUNDOS: 7 dias). */
  function definirCookieSessao(res: Response, token: string): void {
    res.setHeader("Set-Cookie", `${COOKIE_NOME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  }

  /** Limpa o cookie de sessão. */
  function limparCookieSessao(res: Response): void {
    res.setHeader("Set-Cookie", `${COOKIE_NOME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  }

  const requerSessao = (req: ReqComUsuario, res: Response, next: NextFunction): void => {
    const token = lerToken(req);
    if (!token) {
      res.status(401).json({ erro: "não autenticado" });
      return;
    }
    const usuario = auth.validarSessao(token);
    if (!usuario) {
      res.status(401).json({ erro: "sessão expirada ou inválida" });
      return;
    }
    req.usuario = auth.usuarioResumo(usuario);
    next();
  };

  const requerEditor = (req: ReqComUsuario, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ erro: "não autenticado" });
      return;
    }
    if (req.usuario.papel !== "editor" && req.usuario.papel !== "admin") {
      res.status(403).json({ erro: "apenas editores podem criar/editar/excluir campanhas" });
      return;
    }
    next();
  };

  /** Admin gerencia usuários; editor/leitor não. */
  const requerAdmin = (req: ReqComUsuario, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ erro: "não autenticado" });
      return;
    }
    if (req.usuario.papel !== "admin") {
      res.status(403).json({ erro: "apenas o administrador pode gerenciar usuários" });
      return;
    }
    next();
  };

  /** Bootstrap (primeiro usuário) só faz sentido em endereço local: se alguém
   *  subir com HOST=0.0.0.0, um estranho da rede não pode criar o admin. */
  const hostLocal = (): boolean => {
    const host = (process.env.HOST ?? "127.0.0.1").toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  };

  // ---- Auth ----
  app.post("/api/auth/login", (req, res) => {
    try {
      const { usuario, token } = auth.login(req.body);
      // token sai SÓ no cookie HTTP-only: não vai no corpo nem em headers
      definirCookieSessao(res, token);
      res.status(200).json({ usuario });
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ erro: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/auth/logout", requerSessao, (req, res) => {
    const token = lerToken(req);
    if (token) auth.logout(token);
    limparCookieSessao(res);
    res.status(204).end();
  });

  app.get("/api/auth/me", requerSessao, (req: ReqComUsuario, res) => {
    res.json({ usuario: req.usuario });
  });

  app.post("/api/auth/usuarios", (req, res) => {
    // Regras: sem usuários no banco, o cadastro é aberto (bootstrap) e o papel
    // é sempre admin — mas só com o servidor em endereço local; depois disso,
    // só o admin cadastra (editor ou leitor).
    const primeiro = auth.totalUsuarios() === 0;
    if (primeiro) {
      if (!hostLocal()) {
        res.status(403).json({ erro: "cadastro do primeiro usuário só é permitido com o servidor em endereço local (HOST=127.0.0.1)" });
        return;
      }
      req.body = { ...(req.body as object), papel: "admin" };
    } else {
      const token = lerToken(req);
      const usuario = token ? auth.validarSessao(token) : null;
      if (!usuario || usuario.papel !== "admin") {
        res.status(403).json({ erro: "apenas o administrador pode cadastrar usuários" });
        return;
      }
    }
    try {
      const usuario = auth.cadastrarUsuario(req.body);
      res.status(201).json(usuario);
    } catch (e) {
      const status = (e as { status?: number }).status ?? 500;
      res.status(status).json({ erro: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/auth/usuarios", requerSessao, requerAdmin, (_req: ReqComUsuario, res) => {
    res.json(auth.listarUsuarios());
  });

  app.patch("/api/auth/usuarios/:id", requerSessao, requerAdmin, (req: ReqComUsuario, res) => {
    const id = req.params.id!;
    if (id === req.usuario!.id) {
      res.status(400).json({ erro: "não é possível alterar o próprio usuário" });
      return;
    }
    try {
      const { ativo, papel, senha } = AlterarUsuarioSchema.parse(req.body);
      let usuario;
      if (senha !== undefined) {
        usuario = auth.redefinirSenha(id);
      } else if (papel !== undefined) {
        usuario = auth.alterarPapel(id, papel);
      } else if (ativo !== undefined) {
        usuario = auth.definirAtivo(id, ativo);
      } else {
        res.status(400).json({ erro: "é necessário informar 'ativo', 'papel' ou 'senha'" });
        return;
      }
      if (!usuario) {
        res.status(404).json({ erro: "usuário não encontrado" });
        return;
      }
      res.json(usuario);
    } catch (e) {
      tratarErro(e, res);
    }
  });

  // ---- Campanhas (exigem autenticação) ----
  app.get("/api/campanhas", requerSessao, (req: ReqComUsuario, res) => {
    res.json(storage.listar());
  });

  app.post("/api/campanhas", requerSessao, requerEditor, (req: ReqComUsuario, res) => {
    const usuario = req.usuario!;
    const corpo = (req.body ?? {}) as { duplicarDe?: string; mes?: string };
    const mes = corpo.mes && (MESES as readonly string[]).includes(corpo.mes)
      ? corpo.mes
      : MESES[new Date().getMonth()] as string;
    try {
      if (corpo.duplicarDe) {
        const origem = storage.ler(corpo.duplicarDe);
        const nova: Campanha = {
          ...origem,
          id: novoId(),
          usuarioId: usuario.id,
          mes: mes as Campanha["mes"],
          revisao: 1,
          atualizadoEm: new Date().toISOString(),
        };
        res.status(201).json(storage.criar(CampanhaSchema.parse(nova)));
      } else {
        const nova = campanhaEmBranco(mes, usuario.id);
        res.status(201).json(storage.criar(CampanhaSchema.parse(nova)));
      }
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.get("/api/campanhas/:id", requerSessao, (req: ReqComUsuario, res) => {
    try {
      // qualquer usuário autenticado lê qualquer campanha (leitor incluído)
      res.json(storage.ler(req.params.id!));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.put("/api/campanhas/:id", requerSessao, requerEditor, (req: ReqComUsuario, res) => {
    try {
      const entrada = CampanhaSchema.parse(req.body);
      if (entrada.id !== req.params.id) {
        res.status(422).json({ erro: "id do corpo difere do id da URL" });
        return;
      }
      const atual = storage.ler(entrada.id);
      // dono vem do disco, nunca do corpo: editor não pode trocar o autor
      entrada.usuarioId = atual.usuarioId;
      if (!storage.podeEditar(req.usuario!.papel)) {
        res.status(403).json({ erro: "não é dono desta campanha" });
        return;
      }
      res.json(storage.gravar(entrada));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.delete("/api/campanhas/:id", requerSessao, requerEditor, (req: ReqComUsuario, res) => {
    try {
      const atual = storage.ler(req.params.id!);
      if (!storage.podeEditar(req.usuario!.papel)) {
        res.status(403).json({ erro: "não é dono desta campanha" });
        return;
      }
      storage.duplicarParaLixeira(req.params.id!);
      res.status(204).end();
    } catch (e) {
      tratarErro(e, res);
    }
  });

  // ---- Catálogos e render (mesmo do v1, exigem sessão) ----
  app.get("/api/catalogos", requerSessao, (_req, res) => {
    try {
      res.json(lerCatalogos(raizDados));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.get("/render/:id", requerSessao, (req: ReqComUsuario, res) => {
    try {
      const c = storage.ler(req.params.id!);
      res.type("html").send(renderDocumento(c, lerCatalogos(raizDados)));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  // ---- Exportação (AGENTS.md §8): exige sessão ----
  app.post("/api/campanhas/:id/exportar", requerSessao, async (req: ReqComUsuario, res) => {
    try {
      const c = storage.ler(req.params.id!);
      const formato = req.query.formato === "png" ? "png" : "pdf";
      const comprimida = req.query.qualidade === "comprimida";
      const paginaStr = typeof req.query.pagina === "string" ? Number(req.query.pagina) : undefined;
      const catalogos = lerCatalogos(raizDados);
      const opcoes = { comprimida, ...(paginaStr !== undefined ? { pagina: paginaStr } : {}) };
      if (formato === "pdf") {
        const pdf = await exportador.exportarPdf(c, catalogos, opcoes);
        res
          .status(200)
          .type("pdf")
          .set("content-disposition", `attachment; filename="${nomeArquivo(c, "pdf")}"`)
          .send(pdf);
      } else {
        const pngs = await exportador.exportarPng(c, catalogos, opcoes);
        if (pngs.length === 1) {
          const primeiro = pngs[0];
          if (primeiro) {
            const base = nomeArquivo(c, "png");
            const nomeUnico =
              paginaStr !== undefined ? base.replace(/(\.[a-z0-9]+)$/, `-pag${paginaStr}$1`) : base;
            res
              .status(200)
              .type("png")
              .set("content-disposition", `attachment; filename="${nomeUnico}"`)
              .send(primeiro);
          }
        } else {
          res
            .status(200)
            .type("json")
            .send({ aviso: "várias páginas: use ?pagina=n para baixar imagens individuais" });
        }
      }
    } catch (e) {
      tratarErro(e, res);
    }
  });

  // ---- Estáticos ----
  app.use("/logos", express.static(join(raizDados, "logos")));
  const clienteDir = join(raiz, "dist", "client");
  app.use("/assets", express.static(clienteDir));
  app.get("/", (_req, res) => {
    res.sendFile(join(clienteDir, "index.html"));
  });

  return app;
}

// Erros de domínio → respostas HTTP (422 = falha de schema do Zod)
export function tratarErro(e: unknown, res: Response): void {
  if (e instanceof IdInvalidoError) {
    res.status(400).json({ erro: e.message });
  } else if (e instanceof NaoEncontradoError) {
    res.status(404).json({ erro: e.message });
  } else if (e instanceof ConflitoRevisaoError) {
    res.status(409).json({ erro: "revisão desatualizada", campanha: e.campanhaAtual });
  } else if (e instanceof ZodError) {
    res.status(422).json({
      erro: "dados inválidos",
      erros: e.issues.map((i) => ({ caminho: i.path.join("."), mensagem: i.message })),
    });
  } else {
    res.status(500).json({ erro: e instanceof Error ? e.message : String(e) });
  }
}

function novoId(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  const aleatorio = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, "0");
  return `campanha-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${aleatorio}`;
}

/** Campanha nova com uma página residencial em branco (para a prévia já funcionar). */
function campanhaEmBranco(mes: string, usuarioId: string): Campanha {
  return CampanhaSchema.parse({
    versao: 1,
    id: novoId(),
    usuarioId,
    titulo: "Parcelamento Matriz",
    mes,
    paginas: [
      {
        id: "pag-1",
        modelo: "residencial",
        faixa: "Nova faixa",
        cartoes: [
          {
            id: "car-1",
            empreendimentoId: null,
            titulo: ["Condições para o ..."],
            blocos: [{ id: "blo-1", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "" }],
          },
        ],
      },
    ],
    revisao: 1,
    atualizadoEm: new Date().toISOString(),
  });
}

// ---- Execução direta: node dist/server/index.js ----
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  const raiz = acharRaiz();
  const raizDados = join(raiz, "data");
  mkdirSync(join(raizDados, "campanhas"), { recursive: true });
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? 8080);
  const app = criarApp({ raizDados, raizProjeto: raiz });
  const server = app.listen(port, host, () => {
    console.log(`Editor VCA em http://${host}:${port}`);
    app.locals.urlBase = `http://${host}:${port}`;
  });
  // encerra o Chromium, o SQLite e o servidor
  const encerrar = () => {
    void (app.locals.exportador as Exportador).fechar().then(() => {
      fecharDb();
      server.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", encerrar);
  process.on("SIGTERM", encerrar);
}




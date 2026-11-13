// Servidor Express (AGENTS.md §6): API REST + /render + estáticos.
// Escuta em 127.0.0.1 por padrão (HOST/PORT por variável de ambiente).
import express, { Express, Request, Response, NextFunction } from "express";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { ZodError } from "zod";
import { Campanha, CampanhaSchema, MESES } from "../shared/schema.js";
import { renderDocumento } from "../shared/render.js";
import { criarStorage, Storage, IdInvalidoError, NaoEncontradoError, ConflitoRevisaoError } from "./storage.js";
import { lerCatalogos } from "./catalogos.js";
import { acharRaiz } from "../shared/raiz.js";

export type OpcoesServidor = {
  raizDados?: string;   // onde ficam campanhas/catálogos/logos (padrão: <projeto>/data)
  raizProjeto?: string; // para servir dist/client (padrão: raiz do projeto)
  storage?: Storage;    // injetável (testes)
};

export function criarApp(opcoes: OpcoesServidor = {}): Express {
  const raiz = opcoes.raizProjeto ?? acharRaiz();
  const raizDados = opcoes.raizDados ?? join(raiz, "data");
  const storage = opcoes.storage ?? criarStorage(raizDados);

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const lerOuNada = (req: Request, res: Response): Campanha | null => {
    try {
      return storage.ler(req.params.id ?? "");
    } catch (e) {
      tratarErro(e, res);
      return null;
    }
  };

  // ---- API ----
  app.get("/api/campanhas", (_req, res) => {
    res.json(storage.listar());
  });

  app.post("/api/campanhas", (req, res) => {
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
          mes: mes as Campanha["mes"],
          revisao: 1,
          atualizadoEm: new Date().toISOString(),
        };
        res.status(201).json(storage.criar(CampanhaSchema.parse(nova)));
      } else {
        res.status(201).json(storage.criar(campanhaEmBranco(mes)));
      }
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.get("/api/campanhas/:id", (req, res) => {
    const c = lerOuNada(req, res);
    if (c) res.json(c);
  });

  app.put("/api/campanhas/:id", (req, res) => {
    try {
      const entrada = CampanhaSchema.parse(req.body);
      if (entrada.id !== req.params.id) {
        res.status(422).json({ erro: "id do corpo difere do id da URL" });
        return;
      }
      res.json(storage.gravar(entrada));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.delete("/api/campanhas/:id", (req, res) => {
    try {
      storage.ler(req.params.id); // 404 se não existe
      storage.duplicarParaLixeira(req.params.id);
      res.status(204).end();
    } catch (e) {
      tratarErro(e, res);
    }
  });

  app.get("/api/catalogos", (_req, res) => {
    try {
      res.json(lerCatalogos(raizDados));
    } catch (e) {
      tratarErro(e, res);
    }
  });

  // ---- Render (usado pelo exportador e pela visualização) ----
  app.get("/render/:id", (req, res) => {
    const c = lerOuNada(req, res);
    if (c) {
      res.type("html").send(renderDocumento(c, lerCatalogos(raizDados)));
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
function campanhaEmBranco(mes: string): Campanha {
  return CampanhaSchema.parse({
    versao: 1,
    id: novoId(),
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
  app.listen(port, host, () => {
    console.log(`Editor VCA em http://${host}:${port}`);
  });
}

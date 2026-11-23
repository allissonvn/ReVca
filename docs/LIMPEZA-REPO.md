# Limpeza do repositório — remover `referencia/` do histórico

> **Nada deste documento foi executado.** É um roteiro manual para o dono do projeto.
> O objetivo é tirar do **histórico** do Git a pasta `referencia/` (PDF interno
> "INTERNO", ~250 PNGs de marcas de empreendimentos e 46 `Thumbs.db`), que ainda
> existe em commits antigos e pesa ~37 MB no `.git`.

## Situação atual (após a Phase 1)

- `referencia/` e `Thumbs.db` **não são mais versionados** (removidos do índice com
  `git rm --cached`) e estão no `.gitignore`.
- O build e os testes **não dependem** de `referencia/`.
- `referencia/PROMPT-FIXES.md` continua versionado (é o plano de correção, sem conteúdo interno).
- **O histórico continua com os arquivos.** Apagar do índice não apaga dos commits antigos —
  por isso os passos abaixo.

## Antes de começar

1. **Backup:** clone limpo do repositório em outro lugar.
   ```powershell
   git clone https://github.com/allissonvn/ReVca.git C:\backup\ReVca-antes-da-limpeza
   ```
2. **Confirme quem mais tem cópia:** fork, outro colaborador, máquina de notebook/desktop.
   Reescrever histórico invalida os commits de todo mundo.
3. **Decida a estratégia:** opção A (purga) ou opção B (repositório privado).

---

## Opção A — Apagar do histórico com `git filter-repo`

### A1. Instalar o `git-filter-repo` (uma vez)

```powershell
python -m pip install git-filter-repo
# ou, se usar scoop:
scoop install git-filter-repo
```

> `git filter-repo` exige um clone **sem** remoto (ele recusa rodar num clone normal).
> É de propósito: evita um force-push acidental.

### A2. Fazer o clone limpo para trabalhar

```powershell
cd C:\
git clone --mirror https://github.com/allissonvn/ReVca.git ReVca-purga.git
cd ReVca-purga.git
```

`--mirror` clona tudo (todos os refs) — é o formato que o `filter-repo` espera.

### A3. Rodar a purga

```powershell
git filter-repo --invert-paths --path referencia --force
```

- `--invert-paths --path referencia` = **mantém tudo menos** `referencia/`.
- `--force` é necessário porque é um clone `--mirror`.

Para varrer também os `Thumbs.db` espalhados em qualquer pasta do projeto:

```powershell
git filter-repo --invert-paths --path referencia --path-glob '**/Thumbs.db' --force
```

**Confira o resultado antes de seguir:**

```powershell
git log --all --oneline -- referencia
# deve voltar vazio
git rev-list --objects --all | Select-String "referencia/"
# deve voltar vazio
```

### A4. Verificar que o código continua inteiro

```powershell
cd C:\Users\allissonviana\Documents\Projetos\Rev-Vca
# apontar para o clone purgado temporariamente, só para conferir
```

Ou, mais simples: conferir que o clone purgado contém os arquivos do projeto:

```powershell
cd C:\ReVca-purga.git
git ls-tree -r HEAD --name-only | Select-String "^(src|tests|scripts)/"
git ls-tree -r HEAD --name-only | Select-String "^data/logos/"
```

### A5. Reapontar o GitHub (force-push)

> ⚠️ **Isto reescreve o histórico remoto.** Todo mundo com uma cópia antiga precisa clonar de novo.

```powershell
cd C:\ReVca-purga.git
git remote set-url origin https://github.com/allissonvn/ReVca.git
git push --force --mirror origin
```

### A6. Depois do force-push — obrigatório

1. **Colaboradores:** avisar para **não** dar `pull`/`merge` num clone antigo (ele re-introduz os
   arquivos). Cada um deve clonar de novo:
   ```powershell
   Remove-Item -Recurse C:\caminho\antigo\ReVca
   git clone https://github.com/allissonvn/ReVca.git
   ```
2. **Forks:** se existir fork, ele continua com o histórico velho. Ou deletar o fork, ou
   `git fetch origin && git reset --hard origin/master` nele.
3. **Caches do GitHub:** abrir uma Issue/Discussion nova ou tocar num commit para o GitHub
   reconstruir; caches de PR antigos podem levar minutos para sumir.
4. **GPG/assinaturas:** commits assinados deixam de validar depois da reescrita — esperado.
5. **Reconfirmar:**
   ```powershell
   git ls-files | Select-String -Pattern "(?i)thumbs\.db|^referencia/"
   # deve voltar vazio
   ```

### A7. O que continua no seu disco

A pasta `referencia/` **no seu computador não é apagada pelo `filter-repo`** (ele mexe só no
clone `--mirror`). Mantenha o seu backup local dela fora do repositório — o `.gitignore` já
impede que ela volte a ser versionada.

---

## Opção B — Simplesmente deixar o repositório privado

Se o histórico não precisa ser reescrito (ninguém mais tem cópia, ou o conteúdo não é crítico):

1. No GitHub: **Settings → General → Danger Zone → Change repository visibility → Private**.
2. Avisar os colaboradores: eles continuam com acesso **se** forem adicionados em
   **Settings → Collaborators**.
3. Vantagem: nenhuma reescrita, nenhum force-push, nenhum risco de perder commits.
4. Desvantagem: o `.git` local continua com 37 MB e o conteúdo interno continua no histórico
   (só que num lugar menos exposto).

> **Recomendação:** fazer a **Opção B primeiro** (5 segundos, risco zero) e depois a **Opção A**
> quando houver uma janela de manutenção. Assim o material interno fica privado imediatamente.

---

## Referências

- `git-filter-repo`: <https://github.com/newren/git-filter-repo>
- Documentação de reescrita de histórico: <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>
- Estado do índice após a Phase 1: ver `DECISOES.md` → "Baseline pré-correções".

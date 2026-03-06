# AI Orchestration Factory (`kconecta-app`)

Local, reproducible AI orchestration for semi-autonomous development using:

- `Ollama` (local LLMs only)
- `Aider` (automatic file editing)
- `git` branches/worktrees for agent isolation
- `gh` CLI for draft PR workflow
- local `MCP` adapters (tool servers)
- local `RAG` retrieval over repository context
- reusable `Skills` per agent

This scaffold is designed to run entirely on a developer machine.

## Architecture

```text
orchestrator.py
  -> preflight checks (git + ollama + models + tools)
  -> skill loading (agent defaults + task-specific skills)
  -> optional MCP calls for runtime/tool context
  -> local RAG context retrieval
  -> branch/worktree bootstrap
  -> task assignment to agent
  -> local LLM planning/proposal
  -> aider applies edits in agent worktree
  -> semantic commit on agent branch
  -> draft PR creation
  -> human approval gate
  -> merge validation + merge
```

Agents implemented:

1. `ArchitectAgent`
2. `BackendAgent`
3. `MobileAgent` (default stack: React Native with TypeScript)
4. `QAAgent`
5. `DevOpsAgent`

## Directory layout

```text
ai-orchestration/
  orchestrator.py
  README.md
  requirements.txt
  mcp/
    servers.yaml
  rag/
    config.yaml
  skills/
    *.yaml
  tasks/
    sample_*.json
  ai_orchestration/
    constants.py
    models.py
    orchestrator_app.py
    agents/
    services/
  logs/
  state/
```

## Prerequisites

- Python launcher available (`py`)
- Ollama running locally on `http://localhost:11434`
- Models installed:
  - `deepseek-coder:6.7b`
  - `llama3.1:8b`
  - `mistral`
- `aider-chat` installed (`aider` in PATH or `py -m aider.main`)
- Optional but recommended: GitHub CLI (`gh`) authenticated
- Optional for tracking: Jira Cloud project + API token

Install optional dependencies:

```powershell
py -m pip install -r ai-orchestration/requirements.txt
```

Jira environment template:

```powershell
Copy-Item ai-orchestration/jira.env.example ai-orchestration/.env.jira
# Fill values in ai-orchestration/.env.jira and export env vars in your shell
```

## Commands

Run from repository root (`D:\still\kconecta-app`):

### 1) Preflight

```powershell
py ai-orchestration/orchestrator.py preflight
```

Auto-pull missing required models:

```powershell
py ai-orchestration/orchestrator.py preflight --fix-models
```

### 2) Bootstrap branches + worktrees

```powershell
py ai-orchestration/orchestrator.py bootstrap-branches --base main
```

Creates branches:

- `agent/architect`
- `agent/backend`
- `agent/mobile`
- `agent/qa`
- `agent/devops`

And worktrees under:

- `.ai-worktrees/architect`
- `.ai-worktrees/backend`
- `.ai-worktrees/mobile`
- `.ai-worktrees/qa`
- `.ai-worktrees/devops`

### 3) Run agent task

Dry-run:

```powershell
py ai-orchestration/orchestrator.py run-task --agent architect --task-file ai-orchestration/tasks/sample_architect_task.json --dry-run
```

Apply mode (uses Aider + commit):

```powershell
py ai-orchestration/orchestrator.py run-task --agent mobile --task-file ai-orchestration/tasks/sample_mobile_task.json
```

### 4) Create draft PR

```powershell
py ai-orchestration/orchestrator.py create-pr --agent mobile --base main
```

### 5) Human approval gate

```powershell
py ai-orchestration/orchestrator.py approve-merge --pr 123
```

### 6) Merge approved PR

```powershell
py ai-orchestration/orchestrator.py merge-pr --pr 123
```

Optional bypass checks:

```powershell
py ai-orchestration/orchestrator.py merge-pr --pr 123 --skip-checks
```

### 7) List local skills

```powershell
py ai-orchestration/orchestrator.py skills-list
```

Filter by agent:

```powershell
py ai-orchestration/orchestrator.py skills-list --agent mobile
```

### 8) Local RAG search

```powershell
py ai-orchestration/orchestrator.py rag-search --query "React Native TypeScript navigation" --top-k 4
```

Optional scope:

```powershell
py ai-orchestration/orchestrator.py rag-search --query "API boundary" --scope ai-orchestration/README.md ai-orchestration/skills
```

### 9) Local MCP tools

List MCP servers/actions:

```powershell
py ai-orchestration/orchestrator.py mcp-list
```

Call MCP action:

```powershell
py ai-orchestration/orchestrator.py mcp-call --server filesystem --action read_text --params '{"path":"ai-orchestration/README.md","max_chars":1200}'
```

If your shell escapes JSON poorly, use `--params-file`:

```powershell
@'
{"path":"ai-orchestration/README.md","max_chars":1200}
'@ | Out-File -Encoding utf8 ai-orchestration/mcp/tmp-params.json

py ai-orchestration/orchestrator.py mcp-call --server filesystem --action read_text --params-file ai-orchestration/mcp/tmp-params.json
```

### 10) Jira integration (optional)

Validate Jira configuration and project access:

```powershell
py ai-orchestration/orchestrator.py jira-preflight
```

Create Jira issue from a task file:

```powershell
py ai-orchestration/orchestrator.py jira-create-from-task --task-file ai-orchestration/tasks/sample_mobile_task.json --issue-type Story --labels mobile v1
```

List Jira issues (project-wide or filtered by agent):

```powershell
py ai-orchestration/orchestrator.py jira-list --status open --max-results 20
py ai-orchestration/orchestrator.py jira-list --agent mobile --status open --max-results 20
```

Link PR to Jira issue:

```powershell
py ai-orchestration/orchestrator.py jira-link-pr --issue KCON-12 --pr 3
```

Add manual comment:

```powershell
py ai-orchestration/orchestrator.py jira-comment --issue KCON-12 --text "Validation complete in local QA environment."
```

Transition issue:

```powershell
py ai-orchestration/orchestrator.py jira-transition --issue KCON-12 --to "In Review"
```

## Task contract

Task file supports JSON or YAML with fields:

- `id` (required)
- `title` (required)
- `description` (required)
- `agent` (required)
- `priority` (optional, default: `medium`)
- `files_scope` (optional but required for non-dry-run safety)
- `acceptance_criteria` (optional)
- `commit_type` (`feat|fix|refactor|test|docs`)
- `metadata` (optional object)

`metadata` v1 extensions:

- `skills`: array of skill IDs
- `rag`:
  - `enabled` (bool)
  - `query` (string, optional override)
  - `top_k` (int)
  - `scope` (array of paths)
- `mcp_requests`: array of MCP calls:
  - `server`
  - `action`
  - `params` (object)

## Agent output contract

Each agent produces:

- `plan_summary`
- `proposed_changes`
- `target_files`
- `validation_steps`
- `commit_message`

## Branch and commit safety

- Each agent can only commit to its own branch.
- Commit messages must use semantic prefixes:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `test:`
  - `docs:`
- Merge requires explicit human approval via `approve-merge`.

## MCP / RAG / Skills v1

- **MCP v1**: read-only local tool adapters (`git`, `filesystem`, `ollama`, `docker`) configured in `ai-orchestration/mcp/servers.yaml`.
- **RAG v1**: local lexical retrieval with configurable scope/extensions in `ai-orchestration/rag/config.yaml`.
- **Skills v1**: reusable agent instructions/checklists in `ai-orchestration/skills/*.yaml` (auto-loads `<agent>-core`).
- **Jira v1**: optional tracking bridge for issue creation/comments/transitions using Jira REST API and local CLI commands.

## Database guidance for this CRM

For production architecture:

- Mobile apps should consume the same business data source as CRM,
- but always via backend/API, never direct DB access from mobile.
- Keep isolated DBs for `dev/staging/test`.

The orchestration scaffold itself does not modify database data.

## Troubleshooting

- `Aider not found`:
  - Use `py -m aider.main` fallback (already supported).
- `main branch missing`:
  - Create initial commit and set/rename branch to `main`.
- `origin not configured`:
  - Add remote before PR operations.
- `PR merge blocked`:
  - Ensure PR is not draft, is approved, and checks are green.

## Reproducibility notes

- Local inference only (`Ollama` API).
- No external model APIs.
- Runtime artifacts are logged in:
  - `ai-orchestration/logs/audit.jsonl`
  - `ai-orchestration/logs/transcripts/`

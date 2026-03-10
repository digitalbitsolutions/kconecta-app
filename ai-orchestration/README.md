# AI Orchestration Factory (`kconecta-app`)

Local, reproducible AI orchestration for semi-autonomous development using:

- `Ollama` (local fallback/default)
- `Google Antigravity/AG` (optional, when configured)
- `OpenClaw` (primary coding executor for file modifications)
- `Aider` (fallback executor when OpenClaw is unavailable or fails)
- `Windsurf` (deprecated; compatibility parsing only)
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
  -> executor selection (openclaw -> aider fallback)
  -> skill loading (agent defaults + task-specific skills)
  -> optional MCP calls for runtime/tool context
  -> local RAG context retrieval
  -> LLM routing by phase (planning -> Google AG, proposal -> Ollama, review -> Ollama)
  -> branch/worktree bootstrap
  -> task assignment to agent
  -> planning/proposal/review execution
  -> executor applies edits in agent worktree
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
- `OpenClaw` installed (`openclaw` in PATH) or `aider-chat` fallback (`aider` or `py -m aider.main`)
- Optional but recommended: GitHub CLI (`gh`) authenticated
- Optional for tracking: Jira Cloud project + API token
- Optional external LLM credentials:
  - `GOOGLE_AG_API_KEY`
  - `WINDSURF_*` only if you need legacy compatibility parsing (deprecated)

Install optional dependencies:

```powershell
py -m pip install -r ai-orchestration/requirements.txt
```

Jira environment template:

```powershell
Copy-Item ai-orchestration/jira.env.example ai-orchestration/.env.jira
# Fill values in ai-orchestration/.env.jira (the orchestrator loads this file automatically)
```

Optional LLM providers template:

```powershell
Copy-Item ai-orchestration/llm.providers.env.example ai-orchestration/.env.llm
# Fill credentials; orchestrator auto-loads this file
```

Executor environment variables:

- `AI_EXECUTOR=auto|openclaw|aider|opencode` (default: `auto`)
- `opencode` is accepted as a compatibility alias of `openclaw`
- `AI_MAX_DIFF_FILES` (default: `25`)
- `AI_MAX_DIFF_LINES` (default: `1200`)
- `AI_ALLOW_LARGE_DIFF=true|false` (default: `false`)
- `AI_ALLOW_HOST_PHP=true|false` (default: `false`, host PHP/XAMPP blocked)
- `CRM_BACKEND_ROOT` (optional): absolute path to CRM Laravel backend root for Docker test runs

## Commands

Run from repository root (`D:\still\kconecta-app`):

### 1) Preflight

```powershell
py ai-orchestration/orchestrator.py preflight
```

`preflight` now exposes `checks.llm_routing.providers.*.error` for provider diagnostics
(for example: AG quota limits, endpoint DNS/connectivity issues).
It also reports executor diagnostics:
- `opencode_available`
- `openclaw_available`
- `aider_available`
- `selected_executor`
- `ollama_available`
- `google_ag_available`

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

Apply mode (uses executor + commit):

```powershell
py ai-orchestration/orchestrator.py run-task --agent mobile --task-file ai-orchestration/tasks/sample_mobile_task.json
```

External routing examples:

```powershell
# Default policy:
# planning -> Google AG, proposal -> Ollama, review -> Ollama
py ai-orchestration/orchestrator.py run-task --agent mobile --task-file ai-orchestration/tasks/sample_windsurf_small_task.json --dry-run

# Keep default policy and pin planning model to Google AG
py ai-orchestration/orchestrator.py run-task --agent architect --task-file ai-orchestration/tasks/sample_google_ag_task.json --dry-run
```

### 4) Create draft PR

```powershell
py ai-orchestration/orchestrator.py create-pr --agent mobile --base main
```

Include Jira key in PR title (recommended for automatic Jira Code linking):

```powershell
py ai-orchestration/orchestrator.py create-pr --agent mobile --base main --issue DEV-76
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

Run backend Laravel tests through MCP (Docker-only, no XAMPP):

```powershell
py ai-orchestration/orchestrator.py mcp-call --server docker --action run_backend_tests --params '{"backend_root":"D:\\still\\kconecta.com\\web","filter":"AuthenticationTest"}'
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

### 11) Backend tests via Docker (no XAMPP)

Use this to run Laravel tests from the original CRM backend containerized stack:

```powershell
py ai-orchestration/orchestrator.py backend-test-docker
```

Optional flags:

```powershell
# Custom backend path
py ai-orchestration/orchestrator.py backend-test-docker --backend-root D:\still\kconecta.com\web

# Run only selected tests
py ai-orchestration/orchestrator.py backend-test-docker --filter AuthenticationTest

# Skip automatic .env bootstrap inside container
py ai-orchestration/orchestrator.py backend-test-docker --skip-ensure-env
```

What it does:

- starts `app` and `mysql` in Docker (`docker compose up -d app mysql`)
- ensures `.env` exists inside the `app` container (unless skipped)
- runs `php artisan test` with `testing` env overrides (`sqlite :memory:` and array drivers)
- if the selected backend root has no PHP app service (for example infra-only compose files),
  it automatically falls back to a detected CRM backend root with `app|php|backend`.

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
- `llm_provider`: `auto|ollama|google_ag|windsurf` (`windsurf` is deprecated and maps to local review)
- `llm_model`: optional global model override (recommended with explicit `llm_provider`)
- `planning_model`: optional planning-only model override
- `proposal_model`: optional proposal-only model override
- `review_model`: optional review-only model override
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
- `review_notes`
- `target_files`
- `validation_steps`
- `commit_message`
- `model_trace` (provider/model used for planning, proposal, and review)

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

- `OpenClaw not found`:
  - Install OpenClaw CLI and ensure `openclaw` is in PATH.
  - Or set `AI_EXECUTOR=aider` to force fallback executor.
- `OpenClaw detected but unsupported`:
  - This orchestrator requires `openclaw run ...` support.
  - If `openclaw run --help` fails, you likely installed a different OpenClaw CLI variant.
  - Keep fallback executor (`aider`) until the coding-agent OpenClaw distribution is installed.
- `Aider not found`:
  - Install `aider-chat` or use `py -m aider.main` fallback path.
- `Aider timed out on long tasks`:
  - The runner now applies prompt compaction, timeout budget control, and optional file batching.
  - Tune with env vars:
    - `AIDER_EXEC_TIMEOUT_SECONDS` (per attempt, default `420`)
    - `AIDER_TOTAL_TIMEOUT_SECONDS` (overall budget across model variants)
    - `AIDER_BATCH_MODE=true|false` (default `true`)
    - `AIDER_BATCH_SIZE` (default `2`)
    - `AIDER_PROMPT_MAX_CHARS` (default `3200`)
- `Host PHP or XAMPP command blocked`:
  - This is intentional policy.
  - Use `backend-test-docker` or MCP `docker.run_backend_tests`.
- `Large uncontrolled diff blocked`:
  - Reduce file scope or split the task.
  - Only if intentional, set `AI_ALLOW_LARGE_DIFF=true`.
- `Windsurf settings still present`:
  - Windsurf is deprecated in active routing; `review` now runs on Ollama.
  - Old task metadata (`review_model: swe-1`) remains accepted for compatibility.
- `main branch missing`:
  - Create initial commit and set/rename branch to `main`.
- `origin not configured`:
  - Add remote before PR operations.
- `PR merge blocked`:
  - Ensure PR is not draft, is approved, and checks are green.

## Reproducibility notes

- Default inference is local (`Ollama` API).
- External providers are optional and only used when explicitly configured.
- Runtime artifacts are logged in:
  - `ai-orchestration/logs/audit.jsonl`
  - `ai-orchestration/logs/transcripts/`

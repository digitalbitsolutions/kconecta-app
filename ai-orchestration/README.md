# AI Orchestration Factory (`kconecta-app`)

Local, reproducible AI orchestration for semi-autonomous development using:

- `Ollama` (local LLMs only)
- `Aider` (automatic file editing)
- `git` branches/worktrees for agent isolation
- `gh` CLI for draft PR workflow

This scaffold is designed to run entirely on a developer machine.

## Architecture

```text
orchestrator.py
  -> preflight checks (git + ollama + models + tools)
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

Install optional dependencies:

```powershell
py -m pip install -r ai-orchestration/requirements.txt
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

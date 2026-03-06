from __future__ import annotations

from pathlib import Path

DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_BASE_BRANCH = "main"
DEFAULT_WORKTREE_DIRNAME = ".ai-worktrees"
DEFAULT_MOBILE_STACK = "React Native with TypeScript"

REQUIRED_OLLAMA_MODELS = (
    "deepseek-coder:6.7b",
    "llama3.1:8b",
    "mistral",
)

MODEL_ROUTING = {
    "coding": "deepseek-coder:6.7b",
    "planning": "llama3.1:8b",
    "lightweight": "mistral",
}

SEMANTIC_COMMIT_PREFIXES = ("feat", "fix", "refactor", "test", "docs")

AGENT_BRANCHES = {
    "architect": "agent/architect",
    "backend": "agent/backend",
    "mobile": "agent/mobile",
    "qa": "agent/qa",
    "devops": "agent/devops",
}

LOG_FILE = Path("ai-orchestration/logs/audit.jsonl")
APPROVAL_STORE_FILE = Path("ai-orchestration/state/approvals.json")
SKILLS_DIR = Path("ai-orchestration/skills")
MCP_CONFIG_FILE = Path("ai-orchestration/mcp/servers.yaml")
RAG_CONFIG_FILE = Path("ai-orchestration/rag/config.yaml")

DEFAULT_RAG_TOP_K = 4
DEFAULT_RAG_MAX_SNIPPET_CHARS = 480

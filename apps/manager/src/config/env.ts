type RuntimeEnv = {
  apiBaseUrl: string;
  mobileApiToken: string;
  requestTimeoutMs: number;
  stage: "local" | "staging" | "production";
  diagnosticsEnabled: boolean;
  bootstrapEmail: string;
  bootstrapPassword: string;
};

type ProcessLike = {
  env?: Record<string, string | undefined>;
};

function readEnv(key: string): string | undefined {
  const processLike = (globalThis as { process?: ProcessLike }).process;
  const value = processLike?.env?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function resolveStage(): RuntimeEnv["stage"] {
  const raw = readEnv("EXPO_PUBLIC_APP_STAGE")?.toLowerCase();
  if (raw === "production") {
    return "production";
  }
  if (raw === "staging") {
    return "staging";
  }
  return "local";
}

function resolveDiagnostics(stage: RuntimeEnv["stage"]): boolean {
  const configured = readEnv("EXPO_PUBLIC_SHOW_ENV_DIAGNOSTICS");
  if (configured === "1" || configured?.toLowerCase() === "true") {
    return true;
  }
  if (configured === "0" || configured?.toLowerCase() === "false") {
    return false;
  }
  return stage !== "production";
}

function resolveTimeoutMs(): number {
  const raw = readEnv("EXPO_PUBLIC_API_TIMEOUT_MS");
  if (!raw) {
    return 12000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return 12000;
  }

  return parsed;
}

const stage = resolveStage();

function resolveBootstrapEmail(): string {
  return readEnv("EXPO_PUBLIC_BOOTSTRAP_EMAIL") ?? "";
}

function resolveBootstrapPassword(): string {
  return readEnv("EXPO_PUBLIC_BOOTSTRAP_PASSWORD") ?? "";
}

export const managerEnv: RuntimeEnv = {
  apiBaseUrl: readEnv("EXPO_PUBLIC_API_URL") ?? "http://10.0.2.2:8000/api",
  mobileApiToken: readEnv("EXPO_PUBLIC_MOBILE_API_TOKEN") ?? "kconecta-dev-token",
  requestTimeoutMs: resolveTimeoutMs(),
  stage,
  diagnosticsEnabled: resolveDiagnostics(stage),
  bootstrapEmail: resolveBootstrapEmail(),
  bootstrapPassword: resolveBootstrapPassword(),
};

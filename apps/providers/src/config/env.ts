type RuntimeEnv = {
  apiBaseUrl: string;
  mobileApiToken: string;
  requestTimeoutMs: number;
  stage: "local" | "staging" | "production";
  diagnosticsEnabled: boolean;
  bootstrapProviderId: string | null;
  bootstrapRole: "provider" | "manager" | "admin";
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

function resolveBootstrapProviderId(): string | null {
  const raw = readEnv("EXPO_PUBLIC_PROVIDER_ID");
  if (!raw) {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveBootstrapRole(): RuntimeEnv["bootstrapRole"] {
  const raw = readEnv("EXPO_PUBLIC_PROVIDER_ROLE")?.toLowerCase();
  if (raw === "admin") {
    return "admin";
  }
  if (raw === "manager") {
    return "manager";
  }
  return "provider";
}

function resolveBootstrapEmail(): string {
  return readEnv("EXPO_PUBLIC_BOOTSTRAP_EMAIL") ?? "provider1@provider.local";
}

function resolveBootstrapPassword(): string {
  return readEnv("EXPO_PUBLIC_BOOTSTRAP_PASSWORD") ?? "kconecta-dev-password";
}

const stage = resolveStage();

export const providerEnv: RuntimeEnv = {
  apiBaseUrl: readEnv("EXPO_PUBLIC_API_URL") ?? "http://10.0.2.2:8000/api",
  mobileApiToken: readEnv("EXPO_PUBLIC_MOBILE_API_TOKEN") ?? "kconecta-dev-token",
  requestTimeoutMs: resolveTimeoutMs(),
  stage,
  diagnosticsEnabled: resolveDiagnostics(stage),
  bootstrapProviderId: resolveBootstrapProviderId(),
  bootstrapRole: resolveBootstrapRole(),
  bootstrapEmail: resolveBootstrapEmail(),
  bootstrapPassword: resolveBootstrapPassword(),
};

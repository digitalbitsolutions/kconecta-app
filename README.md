# kconecta-app

Repositorio base para el desarrollo de apps nativas (React Native + TypeScript) y la capa de orquestacion AI local.

## Docker local (DB compartida de desarrollo)

Este repo incluye `docker-compose.yml` para levantar una base MySQL local y Adminer usando el volumen persistente:

- `kconecta-app`

### 1) Configurar variables

```powershell
Copy-Item .env.docker.example .env
```

### 2) Levantar infraestructura

```powershell
docker compose up -d
```

### 3) Verificar estado

```powershell
docker compose ps
docker volume inspect kconecta-app
```

### Accesos

- MySQL host: `127.0.0.1`
- MySQL port: `3307` (o `KC_DB_PORT`)
- Adminer: `http://localhost:8086` (o `KC_ADMINER_PORT`)

### Backend API Data Source (v0.2.0 bootstrap)

Los endpoints `/api/providers` y `/api/properties` usan modo `DB-first` con fallback seguro.

Variables relevantes:

- `KC_PROVIDER_DATA_SOURCE` y `KC_PROPERTY_DATA_SOURCE`
  - `auto` (default): intenta DB y cae a dataset en memoria si no hay tabla/disponibilidad.
  - `database`: fuerza lectura DB (si falla, retorna colecciones vacias).
  - `seed`: fuerza dataset en memoria.
- `KC_PROVIDER_TABLE` y `KC_PROPERTY_TABLE`
  - Permiten mapear nombres de tabla del CRM origen sin tocar codigo.

## AI Orchestration

La fabrica local AI esta documentada en:

- [ai-orchestration/README.md](ai-orchestration/README.md)
- [docs/roadmap/ai-orchestration-roadmap.md](docs/roadmap/ai-orchestration-roadmap.md)
- [docs/operations/orchestration-log-2026-03-06.md](docs/operations/orchestration-log-2026-03-06.md)
- [docs/release-notes/native-mobile-v0.1.0.md](docs/release-notes/native-mobile-v0.1.0.md)
- [docs/release-notes/native-mobile-v0.2.0-draft.md](docs/release-notes/native-mobile-v0.2.0-draft.md)

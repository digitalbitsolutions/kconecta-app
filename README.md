# kconecta-app

Repositorio base para el desarrollo de apps nativas (React Native + TypeScript) y la capa de orquestacion AI local.

## Apps nativas (manager/providers)

Este repo ya incluye scaffold React Native (Expo + TypeScript) para:

- `apps/manager`
- `apps/providers`

### 1) Instalar dependencias

```powershell
npm install
```

### 2) Configurar variables por app

```powershell
Copy-Item apps/manager/.env.example apps/manager/.env
Copy-Item apps/providers/.env.example apps/providers/.env
```

### 3) Arrancar en emulador Android

Manager app:

```powershell
npm run manager:android
```

Providers app:

```powershell
npm run provider:android
```

Comandos utiles:

```powershell
npm run manager:start
npm run provider:start
npm run mobile:typecheck
npm run mobile:doctor
```

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

## Backend tests (Docker-only, sin XAMPP)

Este repo **no** debe ejecutar `php artisan test` en el host.  
El comando correcto para pruebas Laravel del CRM es:

```powershell
npm run backend:test:docker
```

Internamente ejecuta:

```powershell
py ai-orchestration/orchestrator.py backend-test-docker
```

El orquestador resuelve el backend CRM y corre `artisan test` dentro de contenedor Docker (`app/php`), evitando dependencias de XAMPP o PHP local.

## AI Orchestration

La fabrica local AI esta documentada en:

- [ai-orchestration/README.md](ai-orchestration/README.md)
- [docs/roadmap/ai-orchestration-roadmap.md](docs/roadmap/ai-orchestration-roadmap.md)
- [docs/operations/orchestration-log-2026-03-06.md](docs/operations/orchestration-log-2026-03-06.md)
- [docs/release-notes/native-mobile-v0.1.0.md](docs/release-notes/native-mobile-v0.1.0.md)

Ruteo de LLM soportado:

- `Ollama` (fallback local por defecto)
- `Google Antigravity/AG` (si `GOOGLE_AG_API_KEY` esta configurado)
- `Windsurf` (`swe-1`) para tareas de revision corta (si `WINDSURF_API_KEY` esta configurado)

# Docker Usage

## 1. Overview

The app ships with multi-stage Dockerfiles for both `frontend/` and `backend/`, plus two Compose files:

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | Development — hot reload, source bind-mounted into containers |
| `docker-compose.prod.yml` | Production — self-contained built images, no bind mounts |
| `backend/Dockerfile` | Stages: `base` → `dev` → `build` → `production` |
| `frontend/Dockerfile` | Stages: `base` → `dev` → `build` → `production` (nginx) |
| `frontend/nginx.conf` | SPA fallback routing for the production nginx image |

MongoDB is Atlas-hosted (no local Mongo container needed) — the backend just needs outbound internet access, which Docker's default bridge network already allows.

## 2. Prerequisites

- Docker Engine + Compose v2 (`docker compose version`)
- `backend/.env` and `frontend/.env` filled in locally (see root `README.md` → Local Setup). These are never baked into images — they're gitignored and only injected at container runtime via `env_file`.

## 3. Development (hot reload)

```bash
docker compose up --build
```

- `--build` is only needed the **first time**, or after changing a `package.json`/lockfile. After that, just leave it running.
- `./backend` and `./frontend` are bind-mounted straight into their containers, so edits on your host are picked up immediately:
  - Backend: `tsx watch` restarts the server on file changes.
  - Frontend: Vite's dev server + HMR reloads the browser on file changes.
- **You never need to re-run `docker compose up` or rebuild for source changes** — that's the whole point of the bind mount. Rebuild only when dependencies change.
- Each service also gets an anonymous volume on `/app/node_modules`, so the container's own `npm ci` output isn't clobbered by whatever (or however empty) `node_modules` looks like on your host.

Ports (host-side): frontend on `http://localhost:3001`, backend on `http://localhost:8001`. These are Docker port *bindings* only — inside the containers the apps still listen on their normal ports (3000 for Vite, 8000 for the backend); Compose just maps them to 3001/8001 on the host. `CLIENT_URL` and `VITE_API_BASE_URL` are overridden accordingly via `environment:` in `docker-compose.yml` (not in `backend/.env`/`frontend/.env`, so native `npm run dev` outside Docker is unaffected and still uses 3000/8000).

Stop everything:
```bash
docker compose down
```

Reset node_modules (e.g. after a messy dependency change):
```bash
docker compose down -v   # -v also drops the node_modules volumes
docker compose up --build
```

## 4. Production

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

- Backend runs the compiled `dist/server.js` as a non-root user, with only production dependencies installed.
- Frontend is a static Vite build served by nginx, with SPA fallback (`try_files ... /index.html`) so client-side routes work on refresh.
- `VITE_API_BASE_URL` is baked into the frontend bundle at **build time** (Vite inlines `VITE_*` vars into the JS), passed as a Compose build arg rather than read from a `.env` file inside the image:
  ```bash
  VITE_API_BASE_URL=https://api.yourdomain.com/api \
    docker compose -f docker-compose.prod.yml up --build -d
  ```
  If unset, it falls back to `http://localhost:8001/api` (matching the prod backend's host-side port binding below).

## 5. Environment variables and the `env_file` `$` gotcha

Both dev and prod backend services load `backend/.env` via `env_file`. Compose performs shell-style interpolation on `env_file` contents — a raw `$SOMETHING` in a value is treated as a variable reference, not a literal dollar sign, and silently resolves to an empty string if that variable isn't set.

If any secret value legitimately contains a `$`, escape it as `$$` in the `.env` file so Compose passes through a literal `$`:

```env
# wrong — Compose reads $ASKFJ as an undefined variable and strips it
JWT_SECRET=abc$ASKFJxyz

# correct — resolves to a literal single $
JWT_SECRET=abc$$ASKFJxyz
```

Note this only matters for the Docker path. Running the backend directly (`npm run dev`, no Docker) uses the plain `dotenv` package, which does zero interpolation — it reads `$$` literally as two dollar signs. So a value escaped for Docker will look slightly different if you switch between Docker and native `npm run dev`; the secret is arbitrary either way (nothing else depends on its exact bytes), but be aware if you swap between the two, any JWT cookies issued under the previous value will stop validating and you'll need to log in again.

## 6. Useful commands

```bash
# Tail logs
docker compose logs -f backend
docker compose logs -f frontend

# Shell into a running container
docker compose exec backend sh
docker compose exec frontend sh

# Rebuild a single service
docker compose build backend

# Verify how Compose resolves your compose files + env (no daemon needed)
docker compose config
```

## 7. Troubleshooting

- **Port already in use**: something else on your host is already bound to `3001` or `8001` — stop it or change the `ports:` mapping in `docker-compose.yml`.
- **Frontend container starts but `localhost:3001` doesn't respond**: check `frontend/vite.config.ts` has `server.host: true`. Without it, Vite binds to `localhost` *inside* the container, which the port mapping can't reach from the host.
- **Changes to `package.json` not reflected**: bind mounts don't touch installed `node_modules` — run `docker compose up --build` to reinstall.
- **`Cannot connect to the Docker daemon`**: usually means Docker Desktop isn't running, or your Docker CLI context points at a socket (e.g. `~/.docker/desktop/docker.sock`) that isn't live — check `docker context ls` and `docker context use <name>`.

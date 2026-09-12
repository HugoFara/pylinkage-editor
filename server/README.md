# pylinkage-editor server

The Python backend of [pylinkage-editor](../README.md). It exposes
[pylinkage](https://github.com/HugoFara/pylinkage) over HTTP so the browser
frontend can simulate mechanisms, run synthesis, and export results.

The frontend's dev server proxies `/api` to this process on port 8000.

## Run

```bash
cd server
uv sync
uv run pylinkage-editor-server
```

Or from the repository root, `npm run server`. Then start the frontend with
`npm run dev` in another terminal.

The server answers on `http://localhost:8000`. Interactive route
documentation is at `http://localhost:8000/docs`.

## Configure

Settings are read from environment variables prefixed `PYLINKAGE_`, or from
a `.env` file in the working directory:

| Variable | Default | Meaning |
|---|---|---|
| `PYLINKAGE_HOST` | `0.0.0.0` | Bind address |
| `PYLINKAGE_PORT` | `8000` | Bind port |
| `PYLINKAGE_DEBUG` | `false` | Reload on code change |
| `PYLINKAGE_CORS_ORIGINS` | Vite dev origins | JSON list of allowed origins |

## Optional: DXF and STEP export

```bash
uv sync --extra cad
```

Without it, `/api/export/dxf` and `/api/export/step` answer `501`.

## Routes

| Family | Routes |
|---|---|
| Mechanisms | `GET/POST /api/mechanisms`, `GET/PUT/DELETE /api/mechanisms/{id}` |
| Simulation | `POST /api/mechanisms/{id}/simulate`, `/trajectory`, `GET .../rotation-period` |
| Streaming | `WS /api/ws/simulation/{id}`, `/api/ws/simulation-fast/{id}` |
| Examples | `GET /api/examples`, `GET /api/examples/{name}`, `POST /api/examples/{name}/load` |
| Synthesis | `POST /api/synthesis/{path,function,motion,topology}-generation` |
| Export | `POST /api/export/{python,svg,dxf,step}` |

Mechanisms are held in memory; they do not survive a restart.

## Test

```bash
uv run pytest
```

The tests drive every route family through the real pylinkage code, so a
pylinkage release that breaks the backend fails here rather than in the
browser.

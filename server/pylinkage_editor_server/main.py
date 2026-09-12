"""FastAPI application serving the pylinkage-editor frontend."""

from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import examples, export, mechanisms, optimization, simulation, synthesis, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    yield
    # Shutdown


__version__ = version("pylinkage-editor-server")

app = FastAPI(
    title="pylinkage-editor server",
    description="Simulation, synthesis and export backend for pylinkage-editor",
    version=__version__,
    lifespan=lifespan,
)

# CORS middleware for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(mechanisms.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")
app.include_router(examples.router, prefix="/api")
app.include_router(synthesis.router, prefix="/api")
app.include_router(optimization.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api")
def api_info() -> dict[str, str | list[str]]:
    """API information."""
    return {
        "name": "pylinkage-editor server",
        "version": __version__,
        "endpoints": [
            "/api/mechanisms",
            "/api/mechanisms/{id}",
            "/api/mechanisms/{id}/simulate",
            "/api/mechanisms/{id}/trajectory",
            "/api/examples",
            "/api/examples/{name}",
            "/api/synthesis/path-generation",
            "/api/synthesis/function-generation",
            "/api/synthesis/motion-generation",
            "/api/synthesis/topology-generation",
            "/api/optimization",
            "/api/ws/simulation/{id}",
            "/api/ws/simulation-fast/{id}",
            "/api/export/python",
            "/api/export/svg",
            "/api/export/dxf",
            "/api/export/step",
        ],
    }


def run() -> None:
    """Start the server. Entry point of the ``pylinkage-editor-server`` command."""
    import uvicorn

    uvicorn.run(
        "pylinkage_editor_server.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

"""Dump the example library, with simulations, for the static demo build.

The GitHub Pages deployment has no backend, so the frontend ships this file
(``src/data/examples.json``) and serves the examples from it when ``/api`` does
not answer. Re-run after changing ``routers/examples.py``; the server test
suite fails when the file is stale::

    cd server && uv run python scripts/dump_examples.py
"""

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

from pylinkage_editor_server.main import app

OUTPUT = Path(__file__).resolve().parents[2] / "src" / "data" / "examples.json"


def dump_examples() -> dict:
    """Return ``{name: {info, mechanism, simulation}}`` straight from the API."""
    bundle = {}
    with TestClient(app) as client:
        for info in client.get("/api/examples").json():
            name = info["name"]
            mechanism = client.get(f"/api/examples/{name}").json()
            loaded = client.post(f"/api/examples/{name}/load")
            loaded.raise_for_status()
            simulated = client.post(
                f"/api/mechanisms/{loaded.json()['id']}/simulate", json={"dt": 1.0}
            )
            simulated.raise_for_status()
            bundle[name] = {
                "info": info,
                "mechanism": _canonical_mechanism(mechanism),
                "is_buildable": loaded.json()["is_buildable"],
                "rotation_period": loaded.json()["rotation_period"],
                "simulation": _canonical_simulation(simulated.json()),
            }
    return bundle


# ``mechanism_to_dict`` walks the mechanism's joint set, whose order changes
# between processes. The frontend looks joints up by id, so sort everything by
# id to keep the dump reproducible (and ``--check`` meaningful).
def _canonical_mechanism(mechanism: dict) -> dict:
    return {
        **mechanism,
        "joints": sorted(mechanism["joints"], key=lambda j: j["id"]),
        "links": sorted(mechanism["links"], key=lambda link: link["id"]),
    }


def _canonical_simulation(simulation: dict) -> dict:
    names = simulation["joint_names"]
    order = sorted(range(len(names)), key=lambda i: names[i])
    return {
        "joint_names": [names[i] for i in order],
        "frames": [
            {"step": frame["step"], "positions": [frame["positions"][i] for i in order]}
            for frame in simulation["frames"]
        ],
        "is_complete": simulation["is_complete"],
    }


def render(bundle: dict) -> str:
    return json.dumps(bundle, indent=1, sort_keys=True) + "\n"


if __name__ == "__main__":
    text = render(dump_examples())
    if "--check" in sys.argv:
        sys.exit(0 if OUTPUT.read_text() == text else 1)
    OUTPUT.write_text(text)
    print(f"wrote {OUTPUT}")

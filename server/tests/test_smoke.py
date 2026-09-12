"""End-to-end smoke test: every route family answers over the HTTP interface.

These run the real pylinkage code behind each route, so a pylinkage release
that breaks the editor's backend fails here rather than in the browser.
"""

import pytest
from fastapi.testclient import TestClient

from pylinkage_editor_server.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as client:
        yield client


def test_health(client):
    assert client.get("/health").json() == {"status": "healthy"}


def test_examples_load_and_simulate(client):
    examples = client.get("/api/examples").json()
    assert examples, "example library is empty"

    loaded = client.post(f"/api/examples/{examples[0]['name']}/load")
    assert loaded.status_code == 200, loaded.text
    mechanism_id = loaded.json()["id"]

    simulated = client.post(
        f"/api/mechanisms/{mechanism_id}/simulate", json={"iterations": 12}
    )
    assert simulated.status_code == 200, simulated.text
    assert simulated.json()["frames"]


def test_mechanism_crud(client):
    example = client.get("/api/examples").json()[0]["name"]
    created = client.post(f"/api/examples/{example}/load").json()
    mechanism_id = created["id"]

    assert client.get(f"/api/mechanisms/{mechanism_id}").status_code == 200
    assert any(m["id"] == mechanism_id for m in client.get("/api/mechanisms").json())
    assert client.delete(f"/api/mechanisms/{mechanism_id}").status_code == 204
    assert client.get(f"/api/mechanisms/{mechanism_id}").status_code == 404


def test_path_generation(client):
    response = client.post(
        "/api/synthesis/path-generation",
        json={
            "precision_points": [
                {"x": 0.0, "y": 0.0},
                {"x": 1.0, "y": 0.5},
                {"x": 2.0, "y": 0.0},
            ],
            "max_solutions": 3,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["solutions"], "path generation found no four-bar"
    assert len(body["mechanism_dicts"]) == len(body["solutions"])


def test_export_python(client):
    example = client.get("/api/examples").json()[0]["name"]
    mechanism = client.post(f"/api/examples/{example}/load").json()

    response = client.post("/api/export/python", json=mechanism)
    assert response.status_code == 200, response.text
    assert "from pylinkage" in response.text

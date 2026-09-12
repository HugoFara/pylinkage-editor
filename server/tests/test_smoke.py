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

    simulated = client.post(f"/api/mechanisms/{mechanism_id}/simulate", json={"iterations": 12})
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


def _x_extent(simulation, joint_id):
    index = simulation["joint_names"].index(joint_id)
    xs = [frame["positions"][index]["x"] for frame in simulation["frames"]]
    return max(xs) - min(xs)


def test_optimization_changes_the_mechanism(client):
    """Every algorithm returns previews whose geometry differs from the input."""
    mechanism = client.get("/api/examples/four-bar").json()
    # joint_index counts the mechanism dict's joints; aim at the coupler-rocker pin
    joint_id = "coupler.1_rocker.0"
    joint_index = [joint["id"] for joint in mechanism["joints"]].index(joint_id)
    baseline = client.post("/api/mechanisms/simulate", json={"mechanism": mechanism}).json()
    baseline_extent = _x_extent(baseline, joint_id)

    algorithms = [
        {"algorithm": "pso", "n_particles": 8, "iterations": 8},
        {
            "algorithm": "differential_evolution",
            "max_iterations": 5,
            "population_size": 5,
            "seed": 1,
        },
        {"algorithm": "nelder_mead", "max_iterations": 40},
        {"algorithm": "grid_search", "divisions": 3, "n_results": 2},
    ]
    for algorithm in algorithms:
        response = client.post(
            "/api/optimization",
            json={
                "mechanism": mechanism,
                "objective": {"type": "x_extent", "joint_index": joint_index},
                "algorithm": algorithm,
                "bounds_factor": 2.0,
            },
        )
        assert response.status_code == 200, (algorithm, response.text)
        body = response.json()
        # Link order follows the mechanism's, which is not stable between builds
        assert sorted(body["constraint_names"]) == [
            "coupler (length)",
            "crank (radius)",
            "rocker (length)",
        ]
        assert body["results"], algorithm
        best = body["results"][0]
        assert best["mechanism_dict"] is not None, (algorithm, body["warnings"])

        # The preview carries the optimized dimensions and simulates to a wider stroke
        preview = client.post(
            "/api/mechanisms/simulate", json={"mechanism": best["mechanism_dict"]}
        ).json()
        assert preview["is_complete"], (algorithm, preview["error"])
        assert _x_extent(preview, joint_id) > baseline_extent, algorithm
        # Same geometry, sampled from a slightly different start pose
        assert _x_extent(preview, joint_id) == pytest.approx(best["score"], rel=1e-2), algorithm


def test_optimization_rejects_bad_joint_index(client):
    mechanism = client.get("/api/examples/four-bar").json()
    response = client.post(
        "/api/optimization",
        json={"mechanism": mechanism, "objective": {"type": "x_extent", "joint_index": 99}},
    )
    assert response.status_code == 400
    assert "out of range" in response.json()["detail"]

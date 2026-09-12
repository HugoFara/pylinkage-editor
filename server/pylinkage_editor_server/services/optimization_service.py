"""Service layer for optimization endpoints.

Builds a ``Mechanism`` from the request, an objective function from the
frontend specification, runs one of pylinkage's optimizers on it, and returns
every result as a mechanism dict the editor can preview and load.
"""

from __future__ import annotations

import logging
import math
from typing import Any

import numpy as np
from pylinkage.exceptions import UnbuildableError
from pylinkage.linkage import bounding_box
from pylinkage.mechanism import (
    ArcDriverLink,
    DriverLink,
    GroundLink,
    Mechanism,
    mechanism_from_dict,
    mechanism_to_dict,
)
from pylinkage.optimization import (
    differential_evolution_optimization,
    generate_bounds,
    minimize_linkage,
    particle_swarm_optimization,
    trials_and_errors_optimization,
)
from pylinkage.population import Ensemble, Member

from ..models.optimization_schemas import (
    ObjectiveSpec,
    OptimizationRequest,
    OptimizationResponse,
    OptimizationResultDTO,
)

logger = logging.getLogger(__name__)


# --- Objective function builders ---


def _path_length(loci: tuple[tuple[Any, ...], ...], joint_index: int) -> float:
    """Total path length of a joint."""
    total = 0.0
    for i in range(1, len(loci)):
        prev = loci[i - 1][joint_index]
        curr = loci[i][joint_index]
        if prev is None or curr is None:
            continue
        dx = curr[0] - prev[0]
        dy = curr[1] - prev[1]
        total += math.sqrt(dx * dx + dy * dy)
    return total


def _bounding_box_area(loci: tuple[tuple[Any, ...], ...], joint_index: int) -> float:
    """Bounding box area of a joint's path."""
    points = [step[joint_index] for step in loci if step[joint_index] is not None]
    if len(points) < 2:
        return 0.0
    y_min, x_max, y_max, x_min = bounding_box(points)
    return (x_max - x_min) * (y_max - y_min)


def _x_extent(loci: tuple[tuple[Any, ...], ...], joint_index: int) -> float:
    """Horizontal extent of a joint's path."""
    points = [step[joint_index] for step in loci if step[joint_index] is not None]
    if len(points) < 2:
        return 0.0
    xs = [p[0] for p in points]
    return max(xs) - min(xs)


def _y_extent(loci: tuple[tuple[Any, ...], ...], joint_index: int) -> float:
    """Vertical extent of a joint's path."""
    points = [step[joint_index] for step in loci if step[joint_index] is not None]
    if len(points) < 2:
        return 0.0
    ys = [p[1] for p in points]
    return max(ys) - min(ys)


def _target_path_distance(
    loci: tuple[tuple[Any, ...], ...],
    joint_index: int,
    target_points: list[list[float]],
) -> float:
    """Sum of minimum distances from each target point to the joint's path."""
    path = [step[joint_index] for step in loci if step[joint_index] is not None]
    if not path:
        return float("inf")
    total = 0.0
    for tx, ty in target_points:
        min_dist = float("inf")
        for px, py in path:
            d = math.sqrt((px - tx) ** 2 + (py - ty) ** 2)
            if d < min_dist:
                min_dist = d
        total += min_dist
    return total


def _build_eval_func(objective: ObjectiveSpec, minimize: bool) -> Any:
    """Build an evaluation function from an objective specification.

    Returns a fitness function with pylinkage's optimizer signature,
    ``(mechanism, constraints, initial_positions) -> float``. An unbuildable
    candidate scores the worst possible value for the chosen direction.
    """
    error_penalty = float("inf") if minimize else -float("inf")

    def eval_func(mechanism: Mechanism, params: Any, init_pos: Any) -> float:
        if init_pos is not None:
            mechanism.set_coords([tuple(p) for p in init_pos])
        mechanism.set_constraints(list(params))
        try:
            # One full rotation of the slowest driver, at the resolution the
            # simulate endpoint uses, so the objective sees the whole coupler curve.
            loci = tuple(mechanism.step())
        except UnbuildableError:
            return error_penalty
        if any(pos is None or pos[0] is None for step in loci for pos in step):
            return error_penalty

        joint_index = objective.joint_index

        if objective.type == "path_length":
            return _path_length(loci, joint_index)
        if objective.type == "bounding_box_area":
            return _bounding_box_area(loci, joint_index)
        if objective.type == "x_extent":
            return _x_extent(loci, joint_index)
        if objective.type == "y_extent":
            return _y_extent(loci, joint_index)
        if objective.type == "target_path":
            return _target_path_distance(loci, joint_index, objective.target_points)
        return error_penalty

    return eval_func


def _constraint_names(mechanism: Mechanism) -> list[str]:
    """Names of the constraint vector entries, in ``get_constraints()`` order."""
    names: list[str] = []
    for link in mechanism.links:
        if isinstance(link, GroundLink):
            continue
        if isinstance(link, (DriverLink, ArcDriverLink)):
            if link.radius is not None:
                names.append(f"{link.name} (radius)")
        elif link.length is not None:
            names.append(f"{link.name} (length)")
    return names


def _member_to_result(
    member: Member, mechanism_dict: dict[str, Any], warnings: list[str]
) -> OptimizationResultDTO:
    """Convert one optimizer result to a DTO with the re-dimensioned mechanism dict.

    The mechanism dict carries geometry as joint positions only, so the
    candidate is rebuilt, given the optimized constraints, and solved once
    without advancing the drivers (``dt=0``) to get a consistent pose.
    """
    dims = [float(d) for d in np.asarray(member.dimensions).flat]
    result: dict[str, Any] | None = None
    try:
        mechanism = mechanism_from_dict(mechanism_dict)
        mechanism.set_coords([tuple(p) for p in member.initial_positions])
        mechanism.set_constraints(dims)
        next(mechanism.step(iterations=1, dt=0.0))
        result = mechanism_to_dict(mechanism)
    except UnbuildableError as exc:
        warnings.append(
            f"Result with score {member.score:.4g} cannot be assembled ({exc}); no preview."
        )
    except Exception as exc:  # pragma: no cover - defensive, surfaced to the UI
        logger.exception("Could not rebuild an optimization result")
        warnings.append(f"Result with score {member.score:.4g} could not be rebuilt: {exc}")

    return OptimizationResultDTO(score=member.score, constraints=dims, mechanism_dict=result)


def _run_algorithm(
    request: OptimizationRequest,
    mechanism: Mechanism,
    eval_func: Any,
    center: list[float],
    bounds: tuple[Any, Any],
) -> Ensemble:
    order_relation = min if request.minimize else max
    params = request.algorithm

    if params.algorithm == "pso":
        return particle_swarm_optimization(
            eval_func,
            mechanism,
            center=center,
            n_particles=params.n_particles,
            leader=params.leader,
            follower=params.follower,
            inertia=params.inertia,
            neighbors=min(params.neighbors, params.n_particles),
            iterations=params.iterations,
            bounds=bounds,
            order_relation=order_relation,
            verbose=False,
        )
    if params.algorithm == "differential_evolution":
        mutation = tuple(params.mutation) if len(params.mutation) > 1 else params.mutation[0]
        return differential_evolution_optimization(
            eval_func,
            mechanism,
            bounds=bounds,
            order_relation=order_relation,
            strategy=params.strategy,
            maxiter=params.max_iterations,
            popsize=params.population_size,
            tol=params.tolerance,
            mutation=mutation,
            recombination=params.recombination,
            seed=params.seed,
            verbose=False,
        )
    if params.algorithm == "nelder_mead":
        return minimize_linkage(
            eval_func,
            mechanism,
            x0=center,
            bounds=bounds,
            order_relation=order_relation,
            method="Nelder-Mead",
            maxiter=params.max_iterations,
            tol=params.tolerance,
            verbose=False,
        )
    if params.algorithm == "grid_search":
        return trials_and_errors_optimization(
            eval_func,
            mechanism,
            parameters=center,
            n_results=params.n_results,
            divisions=params.divisions,
            bounds=bounds,
            order_relation=order_relation,
            verbose=False,
        )
    raise ValueError(f"Unknown algorithm {params.algorithm!r}")


def run_optimization(request: OptimizationRequest) -> OptimizationResponse:
    """Optimize a mechanism's link lengths and driver radii for an objective.

    Every result is returned with its constraint vector and, when the
    optimized geometry can be assembled, a mechanism dict for preview.
    """
    mechanism = mechanism_from_dict(request.mechanism)
    if not 0 <= request.objective.joint_index < len(mechanism.joints):
        raise ValueError(
            f"joint_index {request.objective.joint_index} out of range for a mechanism "
            f"with {len(mechanism.joints)} joints"
        )
    center = list(mechanism.get_constraints())
    if not center:
        raise ValueError("Mechanism has no optimizable dimension (no driver or binary link)")
    constraint_names = _constraint_names(mechanism)

    eval_func = _build_eval_func(request.objective, request.minimize)
    bounds = generate_bounds(
        center, min_ratio=request.bounds_factor, max_factor=request.bounds_factor
    )
    ensemble = _run_algorithm(request, mechanism, eval_func, center, bounds)

    warnings: list[str] = []
    results = [_member_to_result(member, request.mechanism, warnings) for member in ensemble]
    scores = [r.score for r in results if math.isfinite(r.score)]
    if not scores:
        warnings.append("No candidate could be assembled; try a smaller bounds factor.")
    best_score = (min(scores) if request.minimize else max(scores)) if scores else None

    return OptimizationResponse(
        results=results,
        best_score=best_score,
        constraint_names=constraint_names,
        warnings=warnings,
    )

from __future__ import annotations

import math

from dataclasses import asdict, dataclass
from typing import Dict, List

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


@dataclass
class ComponentDefinition:
    """Definition of an optical component that can be added to the workspace."""

    label: str
    description: str
    parameters: Dict[str, Dict[str, float]]


COMPONENT_LIBRARY: Dict[str, ComponentDefinition] = {
    "free_space": ComponentDefinition(
        label="Free Space",
        description="Propagation through free space by a distance L.",
        parameters={
            "length": {"default": 100.0, "min": 0.0, "step": 1.0},
        },
    ),
    "positive_lens": ComponentDefinition(
        label="Positive Lens",
        description="Thin lens with positive focal length f.",
        parameters={
            "focal_length": {"default": 50.0, "min": 1.0, "step": 1.0},
        },
    ),
    "negative_lens": ComponentDefinition(
        label="Negative Lens",
        description="Thin lens with negative focal length f.",
        parameters={
            "focal_length": {"default": -50.0, "min": -500.0, "max": -1.0, "step": 1.0},
        },
    ),
    "prism": ComponentDefinition(
        label="Prism",
        description="Prism introducing an angular deviation.",
        parameters={
            "angle_offset": {"default": 2.0, "min": -30.0, "max": 30.0, "step": 0.1},
        },
    ),
    "grating": ComponentDefinition(
        label="Diffraction Grating",
        description="Grating described by spatial frequency (lines/mm); renders first-order diffraction.",
        parameters={
            "spatial_frequency": {"default": 600.0, "min": 50.0, "max": 2400.0, "step": 10.0},
        },
    ),
    "mirror": ComponentDefinition(
        label="Mirror",
        description="Planar mirror reflecting the ray angle.",
        parameters={
            "flip_orientation": {"default": 1.0, "min": -1.0, "max": 1.0, "step": 2.0},
        },
    ),
}


@app.route("/")
def index() -> str:
    """Render the main ray-tracing interface."""

    return render_template(
        "index.html",
        component_library={key: asdict(value) for key, value in COMPONENT_LIBRARY.items()},
    )


@app.route("/api/components", methods=["GET"])
def list_components() -> str:
    """Return metadata about available optical components."""

    return jsonify({key: asdict(value) for key, value in COMPONENT_LIBRARY.items()})


@app.route("/api/trace", methods=["POST"])
def api_trace() -> str:
    """Compute ray tracing results for a list of components and rays."""

    data = request.get_json(force=True)
    components: List[Dict[str, float]] = data.get("components", [])
    rays: List[Dict[str, float]] = data.get("rays", [])

    results = compute_optical_path(components, rays)
    return jsonify(results)


def compute_optical_path(components: List[Dict[str, float]], rays: List[Dict[str, float]]) -> Dict[str, List]:
    """Compute the ABCD matrices and resulting rays.

    Each component contributes an ABCD matrix (2x2) and may introduce a
    deterministic angular offset. Rays are 2-element vectors [height, angle].
    """

    matrices: List[List[List[float]]] = []
    offsets: List[List[float]] = []

    for component in components:
        c_type = component.get("type")
        params = component.get("params", {})
        matrix, offset = calculate_matrix(c_type, params)
        matrices.append(matrix)
        offsets.append(offset)

    total_matrix = [[1.0, 0.0], [0.0, 1.0]]
    total_offset = [0.0, 0.0]

    for matrix, offset in zip(matrices, offsets):
        total_matrix = multiply_matrices(matrix, total_matrix)
        total_offset = combine_offsets(matrix, total_offset, offset)

    propagated_rays = []
    for ray in rays:
        vec = [ray.get("height", 0.0), ray.get("angle", 0.0)]
        for matrix, offset in zip(matrices, offsets):
            vec = apply_component(matrix, offset, vec)
        propagated_rays.append({"height": vec[0], "angle": vec[1]})

    return {
        "matrices": matrices,
        "offsets": offsets,
        "total_matrix": total_matrix,
        "total_offset": total_offset,
        "propagated_rays": propagated_rays,
    }


def calculate_matrix(component_type: str, params: Dict[str, float]):
    """Return the ABCD matrix and offset for a component type."""

    if component_type == "free_space":
        length = float(params.get("length", 0.0))
        return [[1.0, length], [0.0, 1.0]], [0.0, 0.0]

    if component_type == "positive_lens":
        focal = float(params.get("focal_length", 50.0))
        focal = max(focal, 1e-6)
        return [[1.0, 0.0], [-1.0 / focal, 1.0]], [0.0, 0.0]

    if component_type == "negative_lens":
        focal = float(params.get("focal_length", -50.0))
        focal = min(focal, -1e-6)
        return [[1.0, 0.0], [-1.0 / focal, 1.0]], [0.0, 0.0]

    if component_type == "prism":
        angle = float(params.get("angle_offset", 0.0))
        return [[1.0, 0.0], [0.0, 1.0]], [0.0, angle]

    if component_type == "grating":
        spatial_frequency = float(params.get("spatial_frequency", 600.0))
        spatial_frequency = max(spatial_frequency, 0.0)
        wavelength_mm = 0.00055  # 550 nm representative wavelength
        argument = spatial_frequency * wavelength_mm
        argument = max(min(argument, 1.0), -1.0)
        angle_rad = math.asin(argument)  # First-order diffraction (m = 1)
        angle_deg = math.degrees(angle_rad)
        return [[1.0, 0.0], [0.0, 1.0]], [0.0, angle_deg]

    if component_type == "mirror":
        orientation = float(params.get("flip_orientation", 1.0))
        orientation = 1.0 if orientation >= 0 else -1.0
        return [[1.0, 0.0], [0.0, -orientation]], [0.0, 0.0]

    return [[1.0, 0.0], [0.0, 1.0]], [0.0, 0.0]


def multiply_matrices(a: List[List[float]], b: List[List[float]]):
    """Multiply two 2x2 matrices."""

    return [
        [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
        [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
    ]


def combine_offsets(matrix: List[List[float]], existing_offset: List[float], new_offset: List[float]):
    """Propagate offsets through chained components."""

    propagated = [
        matrix[0][0] * existing_offset[0] + matrix[0][1] * existing_offset[1],
        matrix[1][0] * existing_offset[0] + matrix[1][1] * existing_offset[1],
    ]
    return [propagated[0] + new_offset[0], propagated[1] + new_offset[1]]


def apply_component(matrix: List[List[float]], offset: List[float], vec: List[float]):
    """Apply a component transform to a ray vector."""

    height = matrix[0][0] * vec[0] + matrix[0][1] * vec[1] + offset[0]
    angle = matrix[1][0] * vec[0] + matrix[1][1] * vec[1] + offset[1]
    return [height, angle]


if __name__ == "__main__":
    app.run(debug=True)

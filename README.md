# Interactive ABCD Matrix Ray Tracer

A Flask-powered interface for experimenting with paraxial ray tracing using ABCD matrices. Drag optical elements into the rail, tune their parameters, and inspect how reference rays propagate through the system.

## Features

- Drag-and-drop optical rail with reorderable components.
- Configurable library covering free space, lenses, prisms, gratings, and mirrors.
- Live ABCD matrix products, offsets, and propagated ray summaries.
- Context menus to adjust or remove components and to edit each reference ray.
- **Clear All** control that resets the rail and restores the default rays.

## Setup

- Python 3.9+
- Install dependencies:
  ```bash
  pip install -r requirements.txt
  ```

## Run

```bash
python3 app.py
```

The interface is available at <http://127.0.0.1:5000/>.

## Usage Tips

- Drag components from the toolbox into the rail and reorder them as needed.
- Right-click a component or ray legend entry to configure or remove it.
- Use **Clear All** to quickly reset the workspace and start a new design.

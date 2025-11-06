# Interactive ABCD Matrix Ray Tracer

This project provides a Python-powered web interface for experimenting with ray tracing using ABCD matrices. Users can drag and drop optical components, configure their parameters, and visualise how three configurable test rays propagate through the system.

## Features

- Drag-and-drop optical rail with reorderable components.
- Right-click context menu to configure or remove components.
- Support for free-space propagation, positive/negative lenses, prisms, gratings, and mirrors.
- Live ABCD matrix calculation for every component and for the combined system.
- Three editable test rays with instant propagation results.

## Getting Started

### Requirements

- Python 3.9+
- [Pipenv](https://pipenv.pypa.io) or pip

### Installation

```bash
pip install -r requirements.txt
```

If you prefer Pipenv:

```bash
pipenv install
```

### Running the Application

```bash
flask --app app run
```

or with Pipenv:

```bash
pipenv run flask --app app run
```

The application will be available at <http://127.0.0.1:5000/>.

### Development Notes

- Drag components from the left toolbox onto the optical rail.
- Right click a component to access the context menu for configuration or removal.
- Use the inputs in the Test Rays panel to adjust initial ray height (mm) and angle (mrad).
- The results panel lists all component matrices, offsets, and the propagated ray values.

## Testing

The project currently has no automated tests. Manual testing can be done by running the application and interacting with the UI.

"""Start the Electricity Department API on its assigned host/port.

Local development: the host/port in the repo-root ports.json (use this, or
start-all.js at the repo root, instead of typing a --port by hand, so this
service can never end up on another service's port).
Cloud: PORT (set by the platform) and optional HOST win; with PORT set it
listens on 0.0.0.0.
"""
import json
import os
from pathlib import Path

import uvicorn


def _ports():
    try:
        return json.loads((Path(__file__).resolve().parent.parent / "ports.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"host": "127.0.0.1", "services": {"electricity": {"port": 8001}}}


if __name__ == "__main__":
    ports = _ports()
    port = int(os.environ.get("PORT") or ports["services"]["electricity"]["port"])
    host = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else ports["host"])
    uvicorn.run("app.main:app", host=host, port=port)

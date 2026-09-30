import os
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("APP_DB_PATH", "/tmp/weiguang-community.db")
os.environ.setdefault("APP_COOKIE_SECURE", "true")

from backend.app.main import app  # noqa: E402,F401

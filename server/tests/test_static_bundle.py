"""The static demo ships a dump of the example library; keep it current."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import dump_examples  # noqa: E402


def test_bundled_examples_are_up_to_date():
    expected = dump_examples.render(dump_examples.dump_examples())
    assert dump_examples.OUTPUT.read_text() == expected, (
        "src/data/examples.json is stale; run `uv run python scripts/dump_examples.py`"
    )

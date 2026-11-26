"""Generate the Rust and browser tables together. --check never writes."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TABLES = json.loads((ROOT / "economy/economy.json").read_text())
PAIRS = {"CHARTER_MATERIAL", "SHOP_PRICE", "GEAR_SHOP_PRICE", "GATHER_TILES"}
SCALAR_TYPES = {"HEAT_CAP": "u16", "HEAT_IDLE_SECS": "i64"}
HEADER = "// GENERATED from economy/economy.json by economy/codegen/generate.py.\n"


def rust_constant(name, value):
    if name in PAIRS:
        item_type = "(u16, u16)" if name == "GATHER_TILES" else "(u16, u64)"
        value_type = f"[{item_type}; {len(value)}]"
        literals = ", ".join(f"({a}, {b})" for a, b in value)
        literal = f"[{literals}]"
    elif isinstance(value, list):
        value_type = f"[u64; {len(value)}]"
        literal = json.dumps(value)
    else:
        value_type = SCALAR_TYPES.get(name, "u64")
        literal = str(value)
    return f"pub const {name}: {value_type} = {literal};\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    check = parser.parse_args().check
    rust = "".join(rust_constant(name, value) for name, value in TABLES.items())
    ts = "".join(f"export const {name} = {json.dumps(value)} as const;\n"
                 for name, value in TABLES.items())
    for relative, body in [("programs/sunhoard/src/constants.rs", rust),
                           ("client/src/gen/economy.ts", ts)]:
        path = ROOT / relative
        if check:
            if not path.exists() or path.read_text() != HEADER + body:
                raise SystemExit(f"Regenerate {relative}")
        else:
            path.write_text(HEADER + body)


if __name__ == "__main__":
    main()

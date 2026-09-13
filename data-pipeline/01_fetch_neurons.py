import os

import pandas as pd
from dotenv import load_dotenv
from neuprint_raw import fetch_custom

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")

load_dotenv(os.path.join(HERE, ".env"))

QUERY = """
MATCH (n:Neuron)
WHERE n.status = "Traced" AND n.somaLocation IS NOT NULL
RETURN n.bodyId AS bodyId,
       n.type AS type,
       n.superclass AS superclass,
       n.somaLocation AS loc
"""


def main():
    print("Fetching traced+positioned neurons...")
    df = fetch_custom(QUERY)
    print(f"Raw rows: {len(df)}")

    def coords(loc):
        if loc is None:
            return None, None, None
        c = loc.get("coordinates") if isinstance(loc, dict) else None
        if c is None:
            return None, None, None
        return c[0], c[1], c[2]

    xyz = df["loc"].apply(coords)
    df["posX"] = xyz.apply(lambda t: t[0])
    df["posY"] = xyz.apply(lambda t: t[1])
    df["posZ"] = xyz.apply(lambda t: t[2])
    df = df.drop(columns=["loc"]).dropna(subset=["posX", "posY", "posZ"])

    os.makedirs(CACHE_DIR, exist_ok=True)
    out_path = os.path.join(CACHE_DIR, "neurons.parquet")
    df.to_parquet(out_path)
    print(f"Wrote {out_path} ({len(df)} neurons)")


if __name__ == "__main__":
    main()

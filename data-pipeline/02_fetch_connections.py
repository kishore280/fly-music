import os

from dotenv import load_dotenv
from neuprint_raw import fetch_custom

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")

load_dotenv(os.path.join(HERE, ".env"))

TOP_N = 60000

QUERY = f"""
MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron)
WHERE a.status = "Traced" AND b.status = "Traced"
RETURN a.bodyId AS bodyId_pre, b.bodyId AS bodyId_post, c.weight AS weight
ORDER BY c.weight DESC
LIMIT {TOP_N}
"""


def main():
    print(f"Fetching top {TOP_N} globally-strongest connections...")
    df = fetch_custom(QUERY)
    print(f"Rows: {len(df)}, max weight: {df['weight'].max()}, min weight: {df['weight'].min()}")

    os.makedirs(CACHE_DIR, exist_ok=True)
    out_path = os.path.join(CACHE_DIR, "connections.parquet")
    df.to_parquet(out_path)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()

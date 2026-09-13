import json
import os

from dotenv import load_dotenv
from neuprint_raw import fetch_custom

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")

load_dotenv(os.path.join(HERE, ".env"))

QUERY = """
MATCH (n:Neuron)
WHERE n.type STARTS WITH "JO-" AND n.status = "Traced"
RETURN DISTINCT n.type AS type
"""


def main():
    print("Fetching JO neuron type strings...")
    df = fetch_custom(QUERY)
    jo_types = sorted(df["type"].dropna().tolist())
    print(f"Found {len(jo_types)} JO subtypes: {jo_types}")

    os.makedirs(CACHE_DIR, exist_ok=True)
    out_path = os.path.join(CACHE_DIR, "jo_types.json")
    with open(out_path, "w") as f:
        json.dump({"joTypes": jo_types}, f)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()

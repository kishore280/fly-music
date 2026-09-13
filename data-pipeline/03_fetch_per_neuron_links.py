import os
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
from dotenv import load_dotenv
from neuprint_raw import fetch_custom

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")
BATCH_SIZE = 2000
WORKERS = 10

load_dotenv(os.path.join(HERE, ".env"))


def fetch_batch(body_ids):
    ids_str = ",".join(str(b) for b in body_ids)
    query = f"""
    UNWIND [{ids_str}] AS bid
    MATCH (a:Neuron {{bodyId: bid}})
    CALL {{
        WITH a
        MATCH (a)-[c:ConnectsTo]-(b:Neuron)
        WHERE b.status = "Traced"
        RETURN a.bodyId AS bodyId_pre, b.bodyId AS bodyId_post, c.weight AS weight,
               startNode(c).bodyId AS srcId
        ORDER BY c.weight DESC
        LIMIT 3
    }}
    RETURN bodyId_pre, bodyId_post, weight, srcId
    """
    return fetch_custom(query)


def main():
    neurons = pd.read_parquet(os.path.join(CACHE_DIR, "neurons.parquet"))
    body_ids = neurons["bodyId"].tolist()
    batches = [body_ids[i : i + BATCH_SIZE] for i in range(0, len(body_ids), BATCH_SIZE)]
    print(f"Fetching per-neuron top-3 links for {len(body_ids)} neurons in {len(batches)} batches...")

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch_batch, b): i for i, b in enumerate(batches)}
        done = 0
        for fut in as_completed(futures):
            results.append(fut.result())
            done += 1
            if done % 10 == 0:
                print(f"  {done}/{len(batches)} batches")

    df = pd.concat(results, ignore_index=True)
    is_forward = df["srcId"] == df["bodyId_pre"]
    df["src"] = df["bodyId_pre"].where(is_forward, df["bodyId_post"])
    df["dst"] = df["bodyId_post"].where(is_forward, df["bodyId_pre"])
    df = df[["src", "dst", "weight"]].drop_duplicates()

    os.makedirs(CACHE_DIR, exist_ok=True)
    out_path = os.path.join(CACHE_DIR, "per_neuron_links.parquet")
    df.to_parquet(out_path)
    print(f"Wrote {out_path} ({len(df)} rows)")


if __name__ == "__main__":
    main()

import os
import time

import pandas as pd
import requests

SERVER = "https://neuprint.janelia.org"
DATASET = "male-cns:v1.0"


def fetch_custom(query, token=None, timeout=120, retries=3):
    token = token or os.environ["NEUPRINT_TOKEN"]
    last_err = None
    for attempt in range(retries):
        try:
            resp = requests.post(
                f"{SERVER}/api/custom/custom",
                json={"cypher": query, "dataset": DATASET},
                headers={"Authorization": f"Bearer {token}"},
                timeout=timeout,
            )
            resp.raise_for_status()
            payload = resp.json()
            return pd.DataFrame(payload["data"], columns=payload["columns"])
        except (requests.exceptions.ConnectionError, requests.exceptions.ChunkedEncodingError, requests.exceptions.ReadTimeout) as e:
            last_err = e
            wait = 5 * (attempt + 1)
            print(f"    (fetch_custom attempt {attempt + 1}/{retries} failed: {e}; retrying in {wait}s)")
            time.sleep(wait)
    raise last_err

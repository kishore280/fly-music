import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")
PUBLIC_DATA_DIR = os.path.join(HERE, "..", "public", "data")


def normalize_positions(df):
    raw_y = df["posY"].copy()
    raw_z = df["posZ"].copy()
    df["posY"] = -raw_z
    df["posZ"] = raw_y

    coords = df[["posX", "posY", "posZ"]].to_numpy(dtype=np.float64)
    center = coords.mean(axis=0)
    coords -= center
    max_extent = np.abs(coords).max()
    coords /= max_extent
    df["posX"], df["posY"], df["posZ"] = coords[:, 0], coords[:, 1], coords[:, 2]
    return df, {"center": center.tolist(), "maxExtent": float(max_extent)}


def main():
    neurons = pd.read_parquet(os.path.join(CACHE_DIR, "neurons.parquet"))
    connections = pd.read_parquet(os.path.join(CACHE_DIR, "connections.parquet"))
    per_neuron_links = pd.read_parquet(os.path.join(CACHE_DIR, "per_neuron_links.parquet"))

    neurons, norm = normalize_positions(neurons)
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, "normalization.json"), "w") as f:
        json.dump(norm, f)

    neurons = neurons.reset_index(drop=True)
    bodyid_to_idx = {bid: i for i, bid in enumerate(neurons["bodyId"].tolist())}

    types = sorted(neurons["type"].dropna().unique().tolist())
    type_to_idx = {t: i for i, t in enumerate(types)}
    neurons["typeIndex"] = neurons["type"].map(lambda t: type_to_idx.get(t, -1))

    regions = sorted(neurons["superclass"].dropna().unique().tolist())
    region_to_idx = {r: i for i, r in enumerate(regions)}
    neurons["regionIndex"] = neurons["superclass"].map(lambda r: region_to_idx.get(r, -1))

    def build_edges(df, pre_col, post_col):
        edges = df.copy()
        edges["srcIdx"] = edges[pre_col].map(bodyid_to_idx)
        edges["tgtIdx"] = edges[post_col].map(bodyid_to_idx)
        edges = edges.dropna(subset=["srcIdx", "tgtIdx"])
        edges["srcIdx"] = edges["srcIdx"].astype(int)
        edges["tgtIdx"] = edges["tgtIdx"].astype(int)
        max_weight = edges["weight"].max()
        edges["weightNorm"] = np.log1p(edges["weight"]) / np.log1p(max_weight)
        return edges

    edges = build_edges(connections, "bodyId_pre", "bodyId_post")
    edges = edges.sort_values("weight", ascending=False)
    pick_links = build_edges(per_neuron_links, "src", "dst")

    payload = {
        "meta": {
            "dataset": "male-cns:v1.0",
            "neuronCount": len(neurons),
            "edgeCount": len(edges),
        },
        "types": types,
        "regions": regions,
        "neurons": {
            "bodyId": neurons["bodyId"].astype(int).tolist(),
            "typeIndex": neurons["typeIndex"].tolist(),
            "regionIndex": neurons["regionIndex"].tolist(),
            "posX": [round(v, 5) for v in neurons["posX"].tolist()],
            "posY": [round(v, 5) for v in neurons["posY"].tolist()],
            "posZ": [round(v, 5) for v in neurons["posZ"].tolist()],
        },
        "edges": {
            "source": edges["srcIdx"].tolist(),
            "target": edges["tgtIdx"].tolist(),
            "weight": [round(v, 5) for v in edges["weightNorm"].tolist()],
        },
        "pickLinks": {
            "source": pick_links["srcIdx"].tolist(),
            "target": pick_links["tgtIdx"].tolist(),
            "weight": [round(v, 5) for v in pick_links["weightNorm"].tolist()],
        },
    }

    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    out_path = os.path.join(PUBLIC_DATA_DIR, "connectome-subset.json")
    with open(out_path, "w") as f:
        json.dump(payload, f)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Written {out_path} ({size_kb:.1f} KB)")
    print(f"neurons={len(neurons)} edges={len(edges)} pickLinks={len(pick_links)}")


if __name__ == "__main__":
    main()

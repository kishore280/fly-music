import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")
PUBLIC_DATA_DIR = os.path.join(HERE, "..", "public", "data")

REGION_JO = "JO"
REGION_DOPAMINE = "DOPAMINE"
REGION_BRIDGE = "BRIDGE"
REGION_PARTNER = "PARTNER"


def main():
    jo_types = set(json.load(open(os.path.join(CACHE_DIR, "jo_types.json")))["joTypes"])
    bridge_ids = set(json.load(open(os.path.join(CACHE_DIR, "jo_bridge_ids.json")))["bridgeIds"])
    norm = json.load(open(os.path.join(CACHE_DIR, "normalization.json")))

    neurons_all = pd.read_parquet(os.path.join(CACHE_DIR, "jo_wired_neurons.parquet"))
    edges_raw_all = pd.read_parquet(os.path.join(CACHE_DIR, "jo_intra_conn.parquet"))

    STRONG_EDGE_MIN_WEIGHT = 50
    edges_raw = edges_raw_all[edges_raw_all["weight"] >= STRONG_EDGE_MIN_WEIGHT].copy()
    wired_ids = set(edges_raw["bodyId_pre"]) | set(edges_raw["bodyId_post"])

    is_jo = neurons_all["type"].isin(jo_types)
    is_dopamine = neurons_all["type"].str.startswith(("PAM", "PPL1"), na=False)
    required_ids = set(neurons_all.loc[is_jo | is_dopamine, "bodyId"])
    wired_ids |= required_ids

    neurons = neurons_all[neurons_all["bodyId"].isin(wired_ids)].copy()

    neurons = neurons.dropna(subset=["posX", "posY", "posZ"]).reset_index(drop=True)
    print(f"Wired neurons with position (weight>={STRONG_EDGE_MIN_WEIGHT} filter, JO/dopamine always kept): {len(neurons)} (was {len(neurons_all)})")
    print(f"Edges after weight filter: {len(edges_raw)} (was {len(edges_raw_all)})")

    raw_y = neurons["posY"].copy()
    raw_z = neurons["posZ"].copy()
    neurons["posY"] = -raw_z
    neurons["posZ"] = raw_y

    center = np.array(norm["center"])
    max_extent = norm["maxExtent"]
    coords = neurons[["posX", "posY", "posZ"]].to_numpy(dtype=np.float64)
    coords = (coords - center) / max_extent
    neurons["posX"], neurons["posY"], neurons["posZ"] = coords[:, 0], coords[:, 1], coords[:, 2]

    def assign_region(row):
        t = row["type"]
        if t in jo_types:
            return REGION_JO
        if isinstance(t, str) and (t.startswith("PAM") or t.startswith("PPL1")):
            return REGION_DOPAMINE
        if row["bodyId"] in bridge_ids:
            return REGION_BRIDGE
        return REGION_PARTNER

    neurons["region"] = neurons.apply(assign_region, axis=1)
    neurons["isDopamine"] = (neurons["region"] == REGION_DOPAMINE).astype(int)

    bodyid_to_idx = {bid: i for i, bid in enumerate(neurons["bodyId"].tolist())}

    edges = edges_raw.copy()
    edges["srcIdx"] = edges["bodyId_pre"].map(bodyid_to_idx)
    edges["tgtIdx"] = edges["bodyId_post"].map(bodyid_to_idx)
    edges = edges.dropna(subset=["srcIdx", "tgtIdx"])
    edges["srcIdx"] = edges["srcIdx"].astype(int)
    edges["tgtIdx"] = edges["tgtIdx"].astype(int)

    max_weight = edges["weight"].max()
    edges["weightNorm"] = np.log1p(edges["weight"]) / np.log1p(max_weight)
    print(f"Edges: {len(edges)} (max raw weight {max_weight})")

    jo_rows = neurons[neurons["region"] == REGION_JO]
    band_names = ["low", "mid", "high"]
    sorted_jo_types = sorted(jo_types)
    type_to_band = {t: band_names[i % 3] for i, t in enumerate(sorted_jo_types)}
    injection = {b: [] for b in band_names}
    for _, row in jo_rows.iterrows():
        band = type_to_band.get(row["type"])
        if band:
            injection[band].append(int(row.name))

    dopamine_indices = neurons.index[neurons["region"] == REGION_DOPAMINE].tolist()

    payload = {
        "meta": {
            "dataset": "male-cns:v1.0",
            "neuronCount": len(neurons),
            "edgeCount": len(edges),
            "joTypes": sorted_jo_types,
            "note": "Curated real subgraph (JO auditory afferents -> real "
            "downstream partners -> real bridge neurons -> PAM/PPL1 dopamine "
            "clusters) for the live audio-reactive activation simulation. "
            "Positions share the exact normalization of connectome-subset.json "
            "so this overlays the full structure spatially. Audio-band-to-"
            "JO-subtype mapping is a stylized simplification; the wiring "
            "itself is real MaleCNS v1.0 connectivity.",
        },
        "neurons": {
            "isDopamine": neurons["isDopamine"].tolist(),
            "posX": [round(v, 5) for v in neurons["posX"].tolist()],
            "posY": [round(v, 5) for v in neurons["posY"].tolist()],
            "posZ": [round(v, 5) for v in neurons["posZ"].tolist()],
        },
        "edges": {
            "source": edges["srcIdx"].tolist(),
            "target": edges["tgtIdx"].tolist(),
            "weight": [round(v, 5) for v in edges["weightNorm"].tolist()],
        },
        "joInjectionSites": injection,
        "dopamineIndices": dopamine_indices,
    }

    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    out_path = os.path.join(PUBLIC_DATA_DIR, "activation-subgraph.json")
    with open(out_path, "w") as f:
        json.dump(payload, f)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"\nWritten {out_path} ({size_kb:.1f} KB)")
    print(f"neurons={len(neurons)} edges={len(edges)} dopamine={len(dopamine_indices)}")
    print({b: len(v) for b, v in injection.items()})


if __name__ == "__main__":
    main()

import json
import os

import pandas as pd
from dotenv import load_dotenv
from neuprint_raw import fetch_custom

HERE = os.path.dirname(__file__)
CACHE_DIR = os.path.join(HERE, "cache")
FIRST_HOP_MIN_WEIGHT = 15

load_dotenv(os.path.join(HERE, ".env"))


def fetch_partners(jo_ids, min_weight):
    ids_str = ",".join(str(b) for b in jo_ids)
    query = f"""
    UNWIND [{ids_str}] AS bid
    MATCH (a:Neuron {{bodyId: bid}})-[c:ConnectsTo]->(b:Neuron)
    WHERE c.weight >= {min_weight} AND b.status = "Traced"
    RETURN DISTINCT b.bodyId AS bodyId, b.type AS type
    """
    return fetch_custom(query)


def fetch_two_hop_downstream(ids, batch_size=20):
    result = set()
    batches = [ids[i : i + batch_size] for i in range(0, len(ids), batch_size)]
    for i, batch in enumerate(batches):
        ids_str = ",".join(str(b) for b in batch)
        query = f"""
        UNWIND [{ids_str}] AS bid
        MATCH (a:Neuron {{bodyId: bid}})-[:ConnectsTo]->()-[:ConnectsTo]->(b:Neuron)
        WHERE b.status = "Traced"
        RETURN DISTINCT b.bodyId AS bodyId
        """
        result.update(fetch_custom(query, timeout=300)["bodyId"].tolist())
        print(f"    two-hop batch {i + 1}/{len(batches)}, {len(result)} unique so far")
    return result


def fetch_one_hop_upstream(ids):
    ids_str = ",".join(str(b) for b in ids)
    query = f"""
    UNWIND [{ids_str}] AS bid
    MATCH (a:Neuron)-[:ConnectsTo]->(b:Neuron {{bodyId: bid}})
    WHERE a.status = "Traced"
    RETURN DISTINCT a.bodyId AS bodyId
    """
    return set(fetch_custom(query)["bodyId"].tolist())


def fetch_dopamine_neurons():
    query = """
    MATCH (n:Neuron)
    WHERE (n.type STARTS WITH "PAM" OR n.type STARTS WITH "PPL1") AND n.status = "Traced"
    RETURN n.bodyId AS bodyId, n.type AS type
    """
    return fetch_custom(query)


def fetch_neuron_rows(ids):
    ids_str = ",".join(str(b) for b in ids)
    query = f"""
    UNWIND [{ids_str}] AS bid
    MATCH (n:Neuron {{bodyId: bid}})
    RETURN n.bodyId AS bodyId, n.type AS type, n.somaLocation AS loc
    """
    df = fetch_custom(query)

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
    return df.drop(columns=["loc"])


def fill_missing_positions_via_synapses(df):
    missing_ids = df.loc[df["posX"].isna(), "bodyId"].tolist()
    if not missing_ids:
        return df
    print(f"  {len(missing_ids)} neurons missing somaLocation - using synapse centroid fallback")
    ids_str = ",".join(str(b) for b in missing_ids)
    query = f"""
    UNWIND [{ids_str}] AS bid
    MATCH (n:Neuron {{bodyId: bid}})-[:Contains]->(:SynapseSet)-[:Contains]->(s:Synapse)
    WITH bid, avg(s.location.x) AS x, avg(s.location.y) AS y, avg(s.location.z) AS z
    RETURN bid AS bodyId, x AS posX, y AS posY, z AS posZ
    """
    centroids = fetch_custom(query).set_index("bodyId")
    filled = df.set_index("bodyId")
    for col in ("posX", "posY", "posZ"):
        filled.loc[centroids.index, col] = centroids[col]
    return filled.reset_index()


def main():
    jo_types = json.load(open(os.path.join(CACHE_DIR, "jo_types.json")))["joTypes"]
    jo_types_str = ",".join(f'"{t}"' for t in jo_types)
    jo_query = f"""
    MATCH (n:Neuron)
    WHERE n.type IN [{jo_types_str}] AND n.status = "Traced"
    RETURN n.bodyId AS bodyId, n.type AS type
    """
    print("Fetching JO neurons...")
    jo_neurons = fetch_custom(jo_query)
    jo_ids = jo_neurons["bodyId"].tolist()
    print(f"  {len(jo_ids)} JO neurons")

    print("Fetching first-hop partners (weight >= 15)...")
    partners = fetch_partners(jo_ids, FIRST_HOP_MIN_WEIGHT)
    partner_ids = partners["bodyId"].tolist()
    print(f"  {len(partner_ids)} partners")

    print("Fetching dopamine (PAM/PPL1) neurons...")
    dopamine = fetch_dopamine_neurons()
    dopamine_ids = dopamine["bodyId"].tolist()
    print(f"  {len(dopamine_ids)} dopamine neurons")

    print("Finding bridge neurons (2-hop downstream of JO partners AND 1-hop upstream of dopamine)...")
    two_hop = fetch_two_hop_downstream(partner_ids)
    one_hop_up_dopamine = fetch_one_hop_upstream(dopamine_ids)
    bridge_ids = sorted(two_hop & one_hop_up_dopamine)
    print(f"  {len(bridge_ids)} bridge neurons")

    all_ids = sorted(set(jo_ids) | set(partner_ids) | set(bridge_ids) | set(dopamine_ids))
    print(f"Total wired subset: {len(all_ids)} neurons")

    print("Fetching neuron rows (type + position)...")
    neurons = fetch_neuron_rows(all_ids)
    neurons = fill_missing_positions_via_synapses(neurons)
    neurons = neurons.dropna(subset=["posX", "posY", "posZ"]).reset_index(drop=True)

    print("Fetching intra-subset connection weights...")
    all_ids_str = ",".join(str(b) for b in neurons["bodyId"].tolist())
    conn_query = f"""
    MATCH (a:Neuron)-[c:ConnectsTo]->(b:Neuron)
    WHERE a.bodyId IN [{all_ids_str}] AND b.bodyId IN [{all_ids_str}] AND c.weight >= 5
    RETURN a.bodyId AS bodyId_pre, b.bodyId AS bodyId_post, c.weight AS weight
    """
    intra_conn = fetch_custom(conn_query)
    print(f"  {len(intra_conn)} intra-subset edges (weight >= 5)")

    os.makedirs(CACHE_DIR, exist_ok=True)
    neurons.to_parquet(os.path.join(CACHE_DIR, "jo_wired_neurons.parquet"))
    intra_conn.to_parquet(os.path.join(CACHE_DIR, "jo_intra_conn.parquet"))
    with open(os.path.join(CACHE_DIR, "jo_bridge_ids.json"), "w") as f:
        json.dump({"bridgeIds": [int(b) for b in bridge_ids]}, f)

    print("Wrote jo_wired_neurons.parquet, jo_intra_conn.parquet, jo_bridge_ids.json")


if __name__ == "__main__":
    main()

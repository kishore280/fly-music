# Fly Brain — Live Connectome + Music

A real MaleCNS v1.0 fruit-fly brain (140,024 neurons) with a live leaky
integrate-and-fire spiking simulation over a curated JO → dopamine
subgraph, driven by audio playback. A real anatomical fly body renders
alongside it and reacts to the same activity.

## Run

```sh
npm install
npm run dev
```

Open the printed local URL. Pick a preset track or upload your own audio.

## Regenerating the data

The bundled `public/data/*.json` files are pre-built. To regenerate them
from neuPrint (requires a free account and API token from
[neuprint.janelia.org](https://neuprint.janelia.org)):

```sh
cd data-pipeline
python -m venv .venv
.venv/bin/pip install neuprint-python pandas numpy pyarrow python-dotenv
echo "NEUPRINT_TOKEN=your_token_here" > .env
python 01_fetch_neurons.py
python 02_fetch_connections.py
python 03_fetch_per_neuron_links.py
python 04_build_json.py
python 05_fetch_jo_types.py
python 06_fetch_jo_subgraph.py
python 07_build_activation_json.py
```

## Tests

```sh
npm test
```

## Data and attribution

- **MaleCNS v1.0 connectome** — CC BY 4.0, FlyEM / HHMI Janelia and
  collaborators.
- **Flybody anatomical mesh** (`public/data/flybody/`) — Apache 2.0,
  TuragaLab. See `public/data/flybody/NOTICE.md`.
- **Preset audio tracks** (`public/audio/`) — CC BY-ND 3.0. See
  `public/audio/ATTRIBUTION.md`.

## License

MIT — see [LICENSE](LICENSE). Bundled third-party data keeps its own
license as noted above.

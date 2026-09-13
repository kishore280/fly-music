export const DATA_URL = '/data/connectome-subset.json';
export const ACTIVATION_DATA_URL = '/data/activation-subgraph.json';

export const PRESET_TRACKS = [
  { label: 'Symphony No 40 — Dreamworld', url: '/audio/Dreamworld_ex-darkEternity_-_symphony_no_40.mp3' },
  { label: 'Intro — Dreamworld', url: '/audio/Dreamworld_ex-darkEternity_-_intro.mp3' },
  { label: "Fedot's Boogie — Dickey F", url: '/audio/Dickey_F_-_Fedots_Boogie.mp3' },
  { label: 'Madnours first vision — Raoul Chipaud', url: '/audio/Raoul_Chipaud_-_Madnours_first_vision.mp3' },
  { label: 'Virus Beethoven — MuzaOla', url: '/audio/MuzaOla_-_Virus_Beethoven.mp3' },
];

export const FIXED_SIM_DT = 0.02;
export const MAX_SIM_STEPS_PER_FRAME = 5;

export const SIM_TAU_S = 0.1;
export const SIM_LEAK = Math.exp(-FIXED_SIM_DT / SIM_TAU_S);
export const SIM_BG = 0.08;
export const SIM_GAIN = 1.6;
export const SIM_THRESHOLD = 1.0;
export const SIM_NOISE_SIGMA = 0.06;
export const INJECTION_CURRENT_GAIN = 0.6;
export const DOPAMINE_EMA_SECONDS = 1.0;

export const DOPAMINE_PANEL_MAX = 0.15;

export const BASE_POINT_SIZE = 2.0;

export const CONNECTION_DENSITY_OPTIONS = [3000, 10000, 30000, 'all'];

export const BASE_GRAY = [0.44, 0.44, 0.42];
export const MUTED_GRAY = [0.75, 0.75, 0.74];
export const ACCENT_COLOR = [1.0, 0.35, 0.21];

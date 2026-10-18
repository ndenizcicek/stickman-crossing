// All tunable game data lives here: grid size, vehicles, cities, pacing.

export const APP_VERSION = '1.0.0';

export const GRID_COLS = 9;
/** Default number of off-screen cells on each side of a lane where vehicles wrap around. */
export const LANE_MARGIN = 4;

export const COLORS = {
  paper: '#f5f8fa',
  grid: '#d6e3ec',
  ink: '#23366b',
  red: '#d23c3c',
  roadLine: '#f5f8fa',
  bike: '#d7ead9',
  marker: '#f2c14e',
} as const;

/** Shirt colours for people you pick up. */
export const PEOPLE_COLORS = ['#ffd36e', '#9fd8ff', '#b8f0a8', '#ffb3c7', '#d9c2ff', '#ffcf9e'];

export type VehicleKind =
  | 'car' | 'truck' | 'moto' | 'dolmus' | 'bus' | 'bike' | 'taxi' | 'fire' | 'kei'
  | 'plow' | 'tram' | 'decker' | 'minibus' | 'colectivo';

export interface VehicleSpec {
  /** Length in grid cells. */
  len: number;
  /** Width in grid cells (drawn height on screen). */
  h: number;
  /** Speed range in cells per second, before difficulty scaling. */
  speed: [number, number];
  colors: string[];
  /** Game-over headline when this vehicle hits the player. */
  deathText: string;
  /** Stops suddenly every few seconds (dolmuş, minibus taxi). */
  stops?: boolean;
}

export const VEHICLES: Record<VehicleKind, VehicleSpec> = {
  car:       { len: 1.3, h: .62, speed: [1.6, 2.6], colors: ['#e86a5c', '#5b8def', '#6cc08b', '#b07cd8', '#f29a4e'], deathText: 'Hit by a car!' },
  truck:     { len: 2.8, h: .74, speed: [1.0, 1.5], colors: ['#9aa1ab'], deathText: 'Bumped by a truck!' },
  moto:      { len: .75, h: .34, speed: [3.2, 4.2], colors: ['#ff8a3d'], deathText: 'The courier didn’t stop!' },
  dolmus:    { len: 1.6, h: .66, speed: [2.0, 2.6], colors: ['#f5c518'], deathText: 'The dolmuş didn’t stop!', stops: true },
  bus:       { len: 3.2, h: .76, speed: [1.3, 1.8], colors: ['#3f7cc9'], deathText: 'Caught by the bus!' },
  bike:      { len: .7,  h: .30, speed: [0.9, 1.3], colors: ['#2e9e6b'], deathText: 'Knocked over by a cyclist!' },
  taxi:      { len: 1.35, h: .62, speed: [2.3, 3.2], colors: ['#f7c600'], deathText: 'The taxi didn’t even honk!' },
  fire:      { len: 3.0, h: .76, speed: [2.6, 3.4], colors: ['#d83a2e'], deathText: 'Fire truck coming through!' },
  kei:       { len: 1.0, h: .56, speed: [1.6, 2.4], colors: ['#f4f4f4', '#bfe3f0', '#f6d7a7', '#cfe8c4'], deathText: 'Bonked by a tiny car!' },
  plow:      { len: 2.2, h: .80, speed: [0.9, 1.3], colors: ['#f08a24'], deathText: 'Buried by a snowplow!' },
  tram:      { len: 4.6, h: .80, speed: [4.4, 5.4], colors: ['#f2c200'], deathText: 'The tram rang once. Only once.' },
  decker:    { len: 3.3, h: .78, speed: [1.3, 1.8], colors: ['#3aa655', '#8a4fbf'], deathText: 'Double-decker, double trouble!' },
  minibus:   { len: 1.7, h: .68, speed: [2.2, 3.0], colors: ['#f4f4f4'], deathText: 'The minibus taxi didn’t wait!', stops: true },
  colectivo: { len: 3.0, h: .76, speed: [1.8, 2.4], colors: ['#e5484d', '#2f9e8f', '#f29a4e', '#5b6ee8', '#d9a400'], deathText: 'Flattened by a colectivo!' },
};

export type ObstacleKind =
  | 'tree' | 'cat' | 'simit' | 'hydrant' | 'manhole' | 'vending'
  | 'snowbank' | 'litfass' | 'busstop' | 'palm' | 'jacaranda' | 'coconut';

export type CityId =
  | 'istanbul' | 'newyork' | 'tokyo' | 'moscow' | 'berlin' | 'singapore' | 'capetown' | 'buenosaires' | 'rio';

export type SidewalkStyle = 'grid' | 'snow' | 'waves';

/** How a locked city is opened: reach a score in the city before it on the map, or watch rewarded ads. */
export interface UnlockRule {
  score: number;
  ads: number;
}

export interface CityConfig {
  name: string;
  tagline: string;
  /** The vehicle drawn inside this city's circle on the map. */
  badge: VehicleKind;
  /** Missing = open from the start. */
  unlock?: UnlockRule;
  /** Which side of the road traffic keeps to. Decides lane directions on multi-lane roads. */
  traffic: 'right' | 'left';
  /** Weighted vehicle mix for normal lanes. */
  mix: [VehicleKind, number][];
  /** Chance that a road lane is a bike lane instead. */
  bikeLaneChance: number;
  /** Chance that a road lane is a tram line. */
  tramChance?: number;
  /** Roads are two lanes wider than usual. */
  wideRoads?: boolean;
  /** Snow falls over the whole screen. */
  snowfall?: boolean;
  /** City-specific paint jobs. */
  paint?: Partial<Record<VehicleKind, string[]>>;
  obstacles: ObstacleKind[];
  sidewalk: SidewalkStyle;
  roadColor: string;
}

/**
 * Default rule for locked cities. Change per city by giving it its own `unlock` object.
 * Istanbul, New York and Tokyo are open from the start.
 */
const STANDARD_UNLOCK: UnlockRule = { score: 100, ads: 5 };

export const CITIES: Record<CityId, CityConfig> = {
  istanbul: {
    name: 'Istanbul', tagline: 'Dolmuşes stop without warning', traffic: 'right',
    badge: 'dolmus',
    mix: [['car', .38], ['truck', .13], ['moto', .15], ['dolmus', .24], ['bus', .10]],
    bikeLaneChance: .06, obstacles: ['tree', 'cat', 'simit'], sidewalk: 'grid', roadColor: '#d5d8dd',
  },
  newyork: {
    name: 'New York', tagline: 'Taxis never slow down', traffic: 'right',
    badge: 'taxi',
    mix: [['taxi', .40], ['car', .22], ['truck', .12], ['bus', .12], ['fire', .08], ['moto', .06]],
    bikeLaneChance: .06, obstacles: ['hydrant', 'manhole', 'tree'], sidewalk: 'grid', roadColor: '#cfd1d6',
  },
  tokyo: {
    name: 'Tokyo', tagline: 'Traffic drives on the left!', traffic: 'left',
    badge: 'kei',
    mix: [['kei', .42], ['car', .18], ['truck', .12], ['bus', .12], ['moto', .16]],
    bikeLaneChance: .2, obstacles: ['vending', 'tree'], sidewalk: 'grid', roadColor: '#d8dbe0',
  },
  moscow: {
    name: 'Moscow', tagline: 'Huge boulevards in the snow', traffic: 'right',
    badge: 'plow', unlock: STANDARD_UNLOCK,
    mix: [['car', .45], ['taxi', .13], ['bus', .13], ['truck', .12], ['plow', .12], ['moto', .05]],
    bikeLaneChance: 0, wideRoads: true, snowfall: true,
    paint: { bus: ['#4f8a3c'], car: ['#ffffff', '#3d3d3d', '#8b1e1e', '#5b8def', '#c9ccd1'] },
    obstacles: ['snowbank', 'tree'], sidewalk: 'snow', roadColor: '#dde3ea',
  },
  berlin: {
    name: 'Berlin', tagline: 'Trams don’t stop for anyone', traffic: 'right',
    badge: 'tram', unlock: STANDARD_UNLOCK,
    mix: [['car', .45], ['bus', .2], ['taxi', .15], ['truck', .12], ['moto', .08]],
    bikeLaneChance: .25, tramChance: .18,
    paint: { bus: ['#f2c200'], taxi: ['#efe6c8'] },
    obstacles: ['litfass', 'tree'], sidewalk: 'grid', roadColor: '#d3d6db',
  },
  singapore: {
    name: 'Singapore', tagline: 'Double-deckers on the left', traffic: 'left',
    badge: 'decker', unlock: STANDARD_UNLOCK,
    mix: [['car', .35], ['decker', .25], ['taxi', .2], ['truck', .1], ['moto', .1]],
    bikeLaneChance: .08,
    paint: { taxi: ['#2f6fd6', '#2f6fd6', '#d83a2e'] },
    obstacles: ['tree', 'busstop'], sidewalk: 'grid', roadColor: '#d4d8de',
  },
  capetown: {
    name: 'Cape Town', tagline: 'Minibus taxis stop anywhere', traffic: 'left',
    badge: 'minibus', unlock: STANDARD_UNLOCK,
    mix: [['car', .4], ['minibus', .3], ['truck', .12], ['bus', .1], ['moto', .08]],
    bikeLaneChance: .04,
    obstacles: ['palm', 'tree'], sidewalk: 'grid', roadColor: '#d6d8d9',
  },
  buenosaires: {
    name: 'Buenos Aires', tagline: 'The widest avenues ever', traffic: 'right',
    badge: 'colectivo', unlock: STANDARD_UNLOCK,
    mix: [['car', .35], ['colectivo', .3], ['taxi', .25], ['truck', .1]],
    bikeLaneChance: .06, wideRoads: true,
    paint: { taxi: ['#2b2b2b'] },
    obstacles: ['jacaranda', 'tree'], sidewalk: 'grid', roadColor: '#d3d5d9',
  },
  rio: {
    name: 'Rio', tagline: 'Wavy sidewalks, fast buses', traffic: 'right',
    badge: 'bus', unlock: STANDARD_UNLOCK,
    mix: [['car', .38], ['bus', .25], ['moto', .2], ['taxi', .12], ['truck', .05]],
    bikeLaneChance: .06,
    paint: { bus: ['#e8b130', '#3f7cc9', '#e5484d', '#2f9e8f'] },
    obstacles: ['palm', 'coconut'], sidewalk: 'waves', roadColor: '#d6d8dc',
  },
};

/**
 * Order of the circles on the city map (top to bottom, zigzagging left and right).
 * To add a city: add its id to CityId, its entry to CITIES, and its id here. The map, unlock chain and
 * saved progress all follow this list, so nothing else needs to change.
 */
export const CITY_ORDER: CityId[] = [
  'istanbul', 'newyork', 'tokyo', 'moscow', 'berlin', 'singapore', 'capetown', 'buenosaires', 'rio',
];

/** Pacing knobs. */
export const TUNING = {
  hopSeconds: .11,
  /** Rows per second the camera creeps up on its own, at the start and at most. */
  scrollBase: .2,
  scrollMaxExtra: .45,
  scrollRampRows: 350,
  /** Rows of difficulty until lanes reach full speed and density. */
  difficultyRows: 160,
  /** Seconds of invulnerability after a revive. */
  reviveShield: 2,
  /** Interstitial ads: at least this much play time and this many rounds since the last ad. */
  adBreakSeconds: 90,
  adBreakRounds: 2,
} as const;

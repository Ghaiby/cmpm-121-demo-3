// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import { Board, Cell } from "./board.ts";
import { redrawInventory } from "./main.ts";

// define constants
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;

const STORAGE_KEYS = {
  PLAYER_LOCATION: "geocoin_player_location",
  INVENTORY: "geocoin_inventory",
};

type location = {
  lat: number;
  lng: number;
};

interface Coin {
  cell: Cell;
  serial: number;
  isCollected: boolean;
}
export interface gameState {
  currentLocation: location;
  leafletMap: leaflet.Map;
  momentos: Map<Cell, string>;
  board: Board;
  inventory: Coin[];
}

export function createGamestate(loc: location) {
  return {
    currentLocation: loc,
    leafletMap: createLeafletMap(loc),
    momentos: new Map<Cell, string>(),
    board: new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE),
    inventory: [] as Coin[],
  };
}

function createLeafletMap(loc: location) {
  // Create the leaflet map instance
  const leafletMap = leaflet.map(document.getElementById("map")!, {
    center: loc,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  // Populate the map with a background tile layer
  leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    .addTo(leafletMap);
  return leafletMap;
}

export function saveGameState(state: gameState) {
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_LOCATION,
    JSON.stringify(state.currentLocation),
  );

  localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(state.inventory));
}

// Load the entire game state from localStorage
export function loadGameState(state: gameState) {
  const savedLocation = localStorage.getItem(STORAGE_KEYS.PLAYER_LOCATION);
  if (savedLocation) {
    state.currentLocation = JSON.parse(savedLocation);
  }

  const savedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  if (savedInventory) {
    const savedCoins: Coin[] = JSON.parse(savedInventory);
    redrawInventory(savedCoins);
  }
}

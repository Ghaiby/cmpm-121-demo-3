// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import luck from "./luck.ts";

import { Cell } from "./board.ts";
import {
  createGamestate,
  gameState,
  loadGameState,
  saveGameState,
} from "./gamestate.ts";
// define constants
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_SPAWN_PROBABILITY = 0.1;

const app = document.querySelector<HTMLDivElement>("#app")!;

// App Title
const title = document.createElement("h1");
title.textContent = "Geocoin Carrier";

// controlPanel
const controlPanel = document.createElement("div");
controlPanel.id = "control-panel";

// Define buttons
const controlButtons = [
  { text: "Start Position Tracking", id: "startTracking" },
  { text: "Stop Position Tracking", id: "stopTracking" },
  { text: "Move Up", id: "up" },
  { text: "Move Down", id: "down" },
  { text: "Move Left", id: "left" },
  { text: "Move Right", id: "right" },
  { text: "Reset State", id: "resetState" },
];

// create UI buttons
controlButtons.forEach((buttonConfig) => {
  const button = document.createElement("button");
  button.textContent = buttonConfig.text;
  button.id = buttonConfig.id;
  controlPanel.appendChild(button);
});

// Create Map Container
const mapContainer = document.createElement("div");
mapContainer.id = "map";

// Create Inventory Panel
const inventoryPanel = document.createElement("div");
inventoryPanel.id = "inventory";
const inventoryTitle = document.createElement("h2");
inventoryTitle.textContent = "Inventory";
const inventoryList = document.createElement("ol");

inventoryPanel.appendChild(inventoryTitle);
inventoryPanel.appendChild(inventoryList);

// Append elements to app
app.appendChild(title);
app.appendChild(mapContainer);
app.appendChild(controlPanel);
app.appendChild(inventoryPanel);

//Anchor map at Oaks class
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);
const state: gameState = createGamestate({ ...OAKES_CLASSROOM });

type location = {
  lat: number;
  lng: number;
};

interface Coin {
  cell: Cell;
  serial: number;
  isCollected: boolean;
}

// Map interface to hide leaflet
interface Map {
  addMarker(lat: number, lng: number): leaflet.Marker;
  addPlayerCircle(lat: number, lng: number): void;
  UI: leaflet.Map;
  markers: leaflet.LayerGroup;
}

const map: Map = {
  UI: state.leafletMap,
  markers: leaflet.layerGroup().addTo(state.leafletMap),
  addMarker(lat: number, lng: number) {
    const marker = leaflet.marker([lat, lng]).addTo(map.markers);
    return marker;
  },
  addPlayerCircle(lat: number, lng: number) {
    leaflet
      .circle([lat, lng], {
        color: "white",
        fillColor: "red",
        fillOpacity: 1,
        radius: 2,
      })
      .addTo(map.markers);
  },
};

interface Geocache {
  cell: Cell;
  toMomento(): string;
  fromMomento(momento: string): void;
  coins: Coin[];
  displayCoins(coinDisplayList: HTMLOListElement): void;
}

function createGeocache(cell: Cell): Geocache {
  return {
    coins: [],
    cell: cell,
    toMomento() {
      let momento = "";
      this.coins.forEach((coin) => {
        momento += coin.cell.i + ":" + coin.cell.j + "#" + coin.serial + "X";
        if (coin.isCollected) {
          momento += "1";
        } else {
          momento += "0";
        }
        momento += ",";
      });
      momento = momento.replace(/,$/, "");
      return momento;
    },
    fromMomento(momento: string) {
      momento.split(",").forEach((coinString) => {
        const i: number = parseInt(
          coinString.slice(0, coinString.indexOf(":")),
        );
        const colonIndex = coinString.indexOf(":") + 1;
        const hashtagIndex = coinString.indexOf("#");
        const j: number = parseInt(coinString.slice(colonIndex, hashtagIndex));
        const s: number = parseInt(
          coinString.slice(coinString.indexOf("#") + 1),
          coinString.indexOf("X"),
        );
        let isCollected = false;
        if (coinString.slice(coinString.indexOf("X") + 1) === "1") {
          isCollected = true;
        }
        this.coins.push({
          cell: { i, j },
          serial: s,
          isCollected: isCollected,
        });
      });
    },
    displayCoins(coinDisplayList: HTMLOListElement) {
      this.coins.forEach((coin) => {
        const coinItem = document.createElement("li");
        coinItem.textContent = `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;

        createCollectButton(coin, coinDisplayList, coinItem);

        coinDisplayList.appendChild(coinItem);
      });
    },
  };
}

//Place a cache at about 10% of the grid cells that are within 8 cell-steps away
const generateCacheLocations = (playerLocation: location): location[] => {
  const point = new leaflet.LatLng(playerLocation.lat, playerLocation.lng);
  const nearbyCells = state.board.getCellsNearPoint(point);

  const cacheLocations: location[] = [];

  nearbyCells.forEach((cell) => {
    const cellKey = [cell.i, cell.j].toString();
    if (luck(cellKey) < CACHE_SPAWN_PROBABILITY) {
      const bounds = state.board.getCellBounds(cell);
      const center = bounds.getCenter();
      cacheLocations.push({ lat: center.lat, lng: center.lng });
    }
  });

  return cacheLocations;
};
//Collect coin into inventory
function collectCoin(coinItem: HTMLElement, coin: Coin) {
  state.inventory.push(coin);
  coinItem.setAttribute("collected", "true");
  coin.isCollected = true;
  const inventoryItem = document.createElement("li");
  inventoryItem.textContent = `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;

  inventoryItem.addEventListener("click", () => {
    const bounds = state.board.getCellBounds(coin.cell);
    const center = bounds.getCenter();
    map.UI.setView([center.lat, center.lng], GAMEPLAY_ZOOM_LEVEL);
  });

  inventoryList.appendChild(inventoryItem);
  saveGameState(state);
}

//Deposit coin into cache
function depositCoin(
  coin: Coin,
  inventoryItem: HTMLElement,
  targetCoinList: HTMLElement,
) {
  // Add the coin to the cache's coin list
  const coinItem = document.createElement("li");
  coinItem.textContent = `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
  targetCoinList.appendChild(coinItem);
  createCollectButton(coin, targetCoinList, coinItem);

  inventoryItem.remove();
  const RemoveIndex = state.inventory.indexOf(coin, 0);
  if (RemoveIndex > -1) {
    state.inventory.splice(RemoveIndex, 1);
  }

  saveGameState(state);
}

//Add the deposit buttons when a cache is clicked
function showDepositButtons(targetCoinList: HTMLElement) {
  const inventoryItems = document.querySelectorAll("#inventory ol li");
  inventoryItems.forEach((item, index) => {
    if (!item.querySelector(".deposit-button")) {
      const depositButton = document.createElement("button");
      depositButton.textContent = "Deposit";
      depositButton.classList.add("deposit-button");
      const coin = state.inventory[index];
      depositButton.onclick = () =>
        depositCoin(coin, item as HTMLElement, targetCoinList);
      item.appendChild(depositButton);
    }
  });
}

function hideDepositButtons() {
  const depositButtons = document.querySelectorAll(".deposit-button");
  depositButtons.forEach((button) => button.remove());
}

function movePlayer(direction: "up" | "down" | "left" | "right") {
  const step = TILE_DEGREES;
  switch (direction) {
    case "up":
      state.currentLocation.lat += step;
      break;
    case "down":
      state.currentLocation.lat -= step;
      break;
    case "left":
      state.currentLocation.lng -= step;
      break;
    case "right":
      state.currentLocation.lng += step;
      break;
  }
  map.UI.setView(
    [state.currentLocation.lat, state.currentLocation.lng],
    GAMEPLAY_ZOOM_LEVEL,
  );
  dispatchCacheGeneration(state.currentLocation);
}

function generateNewCoins(geocache: Geocache) {
  const coinsAvailable = Math.floor(Math.random() * 10) + 1;
  for (let i = 0; i < coinsAvailable; i++) {
    const coin = { cell: geocache.cell, serial: i, isCollected: false };
    geocache.coins.push(coin);
  }
}

// Add cache and popups when player moves.
const playerMoved = (event: CustomEvent, map: Map) => {
  map.markers.clearLayers();

  const playerLocation: location = event.detail.playerLocation;
  const cacheLocations = generateCacheLocations(playerLocation);
  map.addPlayerCircle(playerLocation.lat, playerLocation.lng);

  updatePolyLine(playerLocation);

  saveGameState(state);
  // Display caches on the map
  DisplayGeocaches(cacheLocations);
};

function DisplayGeocaches(cacheLocations: location[]) {
  cacheLocations.forEach((location) => {
    const cell = state.board.getCellForPoint(location);
    const geocache = createGeocache(cell);
    if (state.momentos.has(cell)) {
      geocache.fromMomento(state.momentos.get(cell) as string);
    }
    const marker = map.addMarker(location.lat, location.lng);
    const popupContainer = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Cache Location";
    popupContainer.appendChild(title);

    if (geocache.coins.length == 0) {
      generateNewCoins(geocache);
    }
    const coinDisplayList = document.createElement("ol");
    geocache.displayCoins(coinDisplayList);
    popupContainer.appendChild(coinDisplayList);

    //Listeners for deposit buttons
    marker.on("popupopen", () => {
      showDepositButtons(coinDisplayList);
    });

    marker.on("popupclose", () => {
      state.momentos.set(cell, geocache.toMomento());
      const collectedCoins = coinDisplayList.querySelectorAll(
        'li[collected="true"]',
      );
      collectedCoins.forEach((coin) => {
        coin.remove();
      });
      hideDepositButtons();
    });

    marker.bindPopup(popupContainer);
  });
}

function createCollectButton(
  coin: Coin,
  coinList: HTMLElement,
  coinItem: HTMLElement,
) {
  const collectButton = document.createElement("button");
  collectButton.textContent = "Collect";
  if (coin.isCollected) {
    collectButton.disabled = true;
  }
  collectButton.onclick = () => {
    collectCoin(coinItem, coin), showDepositButtons(coinList);
    collectButton.disabled = true;
  };
  coinItem.appendChild(collectButton);
}

//handle moving event
const dispatchCacheGeneration = (playerLocation: location) => {
  const playerMovedEvent = new CustomEvent("playerMoved", {
    detail: { playerLocation },
  });
  document.dispatchEvent(playerMovedEvent as Event);
};

document.addEventListener("playerMoved", (event) => {
  playerMoved(event as CustomEvent, map);
});

//Event listeners for moving buttons
const directions: string[] = ["up", "down", "left", "right"];
directions.forEach((direction) => {
  document.getElementById(direction)?.addEventListener("click", () => {
    movePlayer(direction as "up" | "down" | "left" | "right");
  });
});

// Events for location tracking

let watchId: number | null = null;

document.getElementById("startTracking")?.addEventListener("click", () => {
  const event = new CustomEvent("startTracking");
  document.dispatchEvent(event);
});

document.getElementById("stopTracking")?.addEventListener("click", () => {
  const event = new CustomEvent("stopTracking");
  document.dispatchEvent(event);
});

document.addEventListener("startTracking", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      state.currentLocation.lat = latitude;
      state.currentLocation.lng = longitude;
      map.UI.setView([latitude, longitude], GAMEPLAY_ZOOM_LEVEL);
      dispatchCacheGeneration(state.currentLocation);
    },
    (error) => {
      console.error("Error getting geolocation:", error);
      alert("Unable to track your location.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
    },
  );
});

// Stop Tracking Event Handler
document.addEventListener("stopTracking", () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
});

export function redrawInventory(savedCoins: Coin[]) {
  state.inventory.push(...savedCoins);

  savedCoins.forEach((coin) => {
    const inventoryItem = document.createElement("li");
    const i = coin.cell.i;
    const j = coin.cell.j;
    inventoryItem.textContent = `${i}:${j}#${coin.serial}`;
    inventoryList.appendChild(inventoryItem);
  });
}

//Movement poly line
const movementHistory: [number, number][] = [
  [state.currentLocation.lat, state.currentLocation.lng],
];
const movementPolyline = leaflet
  .polyline(movementHistory, { color: "red" })
  .addTo(map.UI);

function updatePolyLine(playerLocation: location) {
  movementHistory.push([playerLocation.lat, playerLocation.lng]);
  movementPolyline.setLatLngs(movementHistory);
}

//reset functionality
document.getElementById("resetState")?.addEventListener("click", () => {
  const event = new CustomEvent("resetState");
  document.dispatchEvent(event);
});
document.addEventListener("resetState", () => {
  const confirmation = prompt("want to reset? Type 'yes' to confirm.");
  if (confirmation?.toLowerCase() === "yes") {
    state.currentLocation = { ...OAKES_CLASSROOM };

    // Clear movement history and polyline
    movementHistory.length = 0;
    movementPolyline.setLatLngs([]);

    map.markers.clearLayers();

    map.UI.setView(
      [OAKES_CLASSROOM.lat, OAKES_CLASSROOM.lng],
      GAMEPLAY_ZOOM_LEVEL,
    );
    state.inventory.length = 0;
    inventoryList.innerHTML = "";
    localStorage.clear();

    document.dispatchEvent(new CustomEvent("stopTracking"));
    dispatchCacheGeneration(state.currentLocation);
  }
});

//Genetate caches for original locaition
loadGameState(state);
map.UI.setView(
  [state.currentLocation.lat, state.currentLocation.lng],
  GAMEPLAY_ZOOM_LEVEL,
);
dispatchCacheGeneration(state.currentLocation);

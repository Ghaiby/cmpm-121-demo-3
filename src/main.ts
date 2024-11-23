// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import luck from "./luck.ts";

import { Board, Cell } from "./board.ts";

// define constants
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
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

let currentLocation: location = { ...OAKES_CLASSROOM };

// Create the leaflet map instance
const leafletMap = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
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
  UI: leafletMap,
  markers: leaflet.layerGroup().addTo(leafletMap),
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
          coinString.slice(0, coinString.indexOf(":"))
        );
        const j: number = parseInt(
          coinString.slice(coinString.indexOf(":") + 1, coinString.indexOf("#"))
        );
        const s: number = parseInt(
          coinString.slice(coinString.indexOf("#") + 1),
          coinString.indexOf("X")
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

const momentos = new Map<Cell, string>();

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

//Place a cache at about 10% of the grid cells that are within 8 cell-steps away
const generateCacheLocations = (playerLocation: location): location[] => {
  const point = new leaflet.LatLng(playerLocation.lat, playerLocation.lng);
  const nearbyCells = board.getCellsNearPoint(point);

  const cacheLocations: location[] = [];

  nearbyCells.forEach((cell) => {
    const cellKey = [cell.i, cell.j].toString();
    if (luck(cellKey) < CACHE_SPAWN_PROBABILITY) {
      const bounds = board.getCellBounds(cell);
      const center = bounds.getCenter();
      cacheLocations.push({ lat: center.lat, lng: center.lng });
    }
  });

  return cacheLocations;
};

const inventory: Coin[] = [];

//Collect coin into inventory
function collectCoin(coinItem: HTMLElement, coin: Coin) {
  inventory.push(coin);
  coinItem.setAttribute("collected", "true");
  coin.isCollected = true;
  const inventoryItem = document.createElement("li");
  inventoryItem.textContent = `${coin.cell.i}:${coin.cell.j}#${coin.serial}`;
  inventoryList.appendChild(inventoryItem);
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
  const RemoveIndex = inventory.indexOf(coin, 0);
  if (RemoveIndex > -1) {
    inventory.splice(RemoveIndex, 1);
  }
}

//Add the deposit buttons when a cache is clicked
function showDepositButtons(targetCoinList: HTMLElement) {
  const inventoryItems = document.querySelectorAll("#inventory ol li");
  inventoryItems.forEach((item, index) => {
    if (!item.querySelector(".deposit-button")) {
      const depositButton = document.createElement("button");
      depositButton.textContent = "Deposit";
      depositButton.classList.add("deposit-button");
      const coin = inventory[index];
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
      currentLocation.lat += step;
      break;
    case "down":
      currentLocation.lat -= step;
      break;
    case "left":
      currentLocation.lng -= step;
      break;
    case "right":
      currentLocation.lng += step;
      break;
  }
  map.UI.setView(
    [currentLocation.lat, currentLocation.lng],
    GAMEPLAY_ZOOM_LEVEL
  );
  dispatchCacheGeneration(currentLocation);
}

// Add cache and popups when player moves.
const playerMoved = (event: CustomEvent, map: Map) => {
  map.markers.clearLayers();

  const playerLocation: location = event.detail.playerLocation;
  const cacheLocations = generateCacheLocations(playerLocation);

  map.addPlayerCircle(playerLocation.lat, playerLocation.lng);

  // Display caches on the map
  cacheLocations.forEach((location) => {
    const cell = board.getCellForPoint(location);
    const geocache = createGeocache(cell);
    if (momentos.has(cell)) {
      geocache.fromMomento(momentos.get(cell) as string);
    }
    const marker = map.addMarker(location.lat, location.lng);
    const popupContainer = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Cache Location";
    popupContainer.appendChild(title);

    if (geocache.coins.length == 0) {
      const coinsAvailable = Math.floor(Math.random() * 10) + 1;
      for (let i = 0; i < coinsAvailable; i++) {
        const coin = { cell, serial: i, isCollected: false };
        geocache.coins.push(coin);
      }
    }
    const coinDisplayList = document.createElement("ol");
    geocache.displayCoins(coinDisplayList);
    popupContainer.appendChild(coinDisplayList);

    //Listeners for deposit buttons
    marker.on("popupopen", () => {
      showDepositButtons(coinDisplayList);
    });

    marker.on("popupclose", () => {
      momentos.set(cell, geocache.toMomento());
      const collectedCoins = coinDisplayList.querySelectorAll(
        'li[collected="true"]'
      );
      collectedCoins.forEach((coin) => {
        coin.remove();
      });

      hideDepositButtons();
    });

    marker.bindPopup(popupContainer);
  });
};

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

const dispatchCacheGeneration = (playerLocation: location) => {
  const playerMovedEvent = new CustomEvent("playerMoved", {
    detail: { playerLocation },
  });
  document.dispatchEvent(playerMovedEvent as Event);
};

document.addEventListener("playerMoved", (event) => {
  playerMoved(event as CustomEvent, map);
});

//Genetate caches for original locaition
dispatchCacheGeneration(currentLocation);

//Event listeners for moving buttons
const directions: string[] = ["up", "down", "left", "right"];
directions.forEach((direction) => {
  document.getElementById(direction)?.addEventListener("click", () => {
    movePlayer(direction as "up" | "down" | "left" | "right");
  });
});

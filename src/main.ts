// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

import luck from "./luck.ts";

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
  { text: "Move Up", id: "moveUp" },
  { text: "Move Down", id: "moveDown" },
  { text: "Move Left", id: "moveLeft" },
  { text: "Move Right", id: "moveRight" },
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
const inventoryList = document.createElement("ul");

inventoryPanel.appendChild(inventoryTitle);
inventoryPanel.appendChild(inventoryList);

// Append elements to app
app.appendChild(title);
app.appendChild(mapContainer);
app.appendChild(controlPanel);
app.appendChild(inventoryPanel);

//Anchor map at Oaks class
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

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

interface Cell {
  i: number; // Row
  j: number; // Column
}

// Map interface to hide leaflet
interface Map {
  addMarker(lat: number, lng: number): leaflet.Marker;
  addPlayerCircle(lat: number, lng: number): void;
  UI: leaflet.Map;
}

const map: Map = {
  UI: leafletMap,
  addMarker(lat: number, lng: number) {
    const marker = leaflet.marker([lat, lng]).addTo(map.UI);
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
      .addTo(map.UI);
  },
};

// Map Math Functions
const getCellFromLatLng = (lat: number, lng: number): Cell => {
  const i = Math.floor(lat / TILE_DEGREES);
  const j = Math.floor(lng / TILE_DEGREES);
  return { i, j };
};

const getLatLngFromCell = (cell: Cell): location => {
  const lat = cell.i * TILE_DEGREES;
  const lng = cell.j * TILE_DEGREES;
  return { lat, lng };
};

//Place a cache at about 10% of the grid cells that are within 8 cell-steps away
const generateCacheLocations = (playerLocation: location): location[] => {
  const playerCell = getCellFromLatLng(playerLocation.lat, playerLocation.lng);

  const cacheLocations: location[] = [];

  for (let di = -NEIGHBORHOOD_SIZE; di <= NEIGHBORHOOD_SIZE; di++) {
    for (let dj = -NEIGHBORHOOD_SIZE; dj <= NEIGHBORHOOD_SIZE; dj++) {
      const neighborCell: Cell = { i: playerCell.i + di, j: playerCell.j + dj };

      if (
        luck([neighborCell.i, neighborCell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
        const cacheLatLng = getLatLngFromCell(neighborCell);
        cacheLocations.push(cacheLatLng);
      }
    }
  }

  return cacheLocations;
};
// Store coins as ints for now
let inventory: number[] = [];

//Collect coin into inventory
function collectCoin(index: number, coinItem: HTMLElement) {
  inventory.push(index);
  coinItem.setAttribute("collected", "true");
  const inventoryItem = document.createElement("li");
  inventoryItem.textContent = `Coin ${index}`;
  inventoryList.appendChild(inventoryItem);
}

//Deposit coin into cache
function depositCoin(index: number, inventoryItem: HTMLElement, targetCoinList: HTMLElement) {
  inventoryItem.remove();
  inventory = inventory.filter((num) => num !== index);

  // Add the coin to the cache's coin list
  const coinItem = document.createElement("li");
  coinItem.textContent = `Coin ${index} `;
  targetCoinList.appendChild(coinItem);
  createCollectButton(index, targetCoinList, coinItem);
}

//Add the deposit buttons when a cache is clicked
function showDepositButtons(targetCoinList: HTMLElement) {
  const inventoryItems = document.querySelectorAll("#inventory ul li");
  inventoryItems.forEach((item, index) => {
    if (!item.querySelector(".deposit-button")) {
      const depositButton = document.createElement("button");
      depositButton.textContent = "Deposit";
      depositButton.classList.add("deposit-button");
      depositButton.onclick = () =>
        depositCoin(index, item as HTMLElement, targetCoinList);
      item.appendChild(depositButton);
    }
  });
}

function hideDepositButtons() {
  const depositButtons = document.querySelectorAll(".deposit-button");
  depositButtons.forEach((button) => button.remove());
}

// Add cache and popups when player moves.
const playerMoved = (event: CustomEvent, map: Map) => {
  const playerLocation: location = event.detail.playerLocation;
  const cacheLocations = generateCacheLocations(playerLocation);

  map.addPlayerCircle(playerLocation.lat, playerLocation.lng);

  // Display caches on the map
  cacheLocations.forEach((location) => {
    const marker = map.addMarker(location.lat, location.lng);

    const popupContainer = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = "Cache Location";
    popupContainer.appendChild(title);

    const coinList = document.createElement("ul");
    const coinsAvailable = Math.floor(Math.random() * 10) + 1;

    // Display coins list
    for (let i = 0; i < coinsAvailable; i++) {
      const coinItem = document.createElement("li");
      coinItem.textContent = `Coin ${i} `;

      createCollectButton(i, coinList, coinItem);

      coinList.appendChild(coinItem);
    }
    popupContainer.appendChild(coinList);

    //Listeners for deposit buttons
    marker.on("popupopen", () => {
      showDepositButtons(coinList);
    });

    marker.on("popupclose", () => {
      const collectedCoins = coinList.querySelectorAll('li[collected="true"]');
      collectedCoins.forEach((coin) => {
        coin.remove();
      });

      hideDepositButtons();
    });

    marker.bindPopup(popupContainer);
  });
};

function createCollectButton(i: number, coinList: HTMLElement, coinItem: HTMLElement) {
  const collectButton = document.createElement("button");
  collectButton.textContent = "Collect";
  collectButton.id = `collectCoin${i}`;
  collectButton.onclick = () => {
    collectCoin(i, coinItem), showDepositButtons(coinList);
    collectButton.disabled = true;
  };
  coinItem.appendChild(collectButton);
}

const dispatchCacheGeneration = (playerLocation: location) => {
  const event = new CustomEvent("playerMoved", {
    detail: { playerLocation },
  });
  document.dispatchEvent(event as Event);
};

document.addEventListener("playerMoved", (event) => {
  playerMoved(event as CustomEvent, map);
});

dispatchCacheGeneration(OAKES_CLASSROOM);

// ===========================================================================
// AVOR Infotainment — state engine
// ------------------------------------------------------------------------
//  [01]  State
//  [02]  View definitions
//  [03]  View helpers
//  [04]  Navigation
//  [05]  Input
//  [06]  Map transforms
//  [07]  Actions
//  [08]  Render
//  [09]  Clock
//  [10]  Mouse fallback
//  [11]  Map drag
//  [12]  Scale-to-fit
//  [13]  Init
// ===========================================================================


// === [01] STATE ============================================================
const state = {
  view: "splash",
  subTab: null,
  history: [], // [{ view, subTab }]
  zoneIndex: 0, // which zone has focus on current view
  itemIndex: 0, // which item within that zone
  focusVisible: false,
  playing: false,
  playingSubTab: null,
  shuffle: false,
  repeat: "off",
  scrubberSelected: false,
  scrubberProgress: {
    radio: 0,
    media: 0,
    bluetooth: 0,
  },
  selectedTrack: {
    radio: { index: 0, title: "Radio Station 1" },
    media: { index: 0, title: "AVOR — Future is an attitude" },
    bluetooth: { index: 0, title: "Melo — Drift Theory" },
  },
  dialNumber: "",
  mapZoom: 1,
  mapPan: { x: 0, y: 0 },
  navigationRoute: {
    destination: "",
    type: "",
    distance: "",
    loading: false,
    active: false,
  },
  routeExpanded: false,
  address: "",
  keyboardMode: "letters",
  activeCall: {
    label: "",
    active: false,
    phase: "idle",
    connectedAt: null,
    subTab: "dial",
    returnView: "phone",
    returnSubTab: "dial",
    muted: false,
    fromDial: false,
  },
};

const MAP_BASE_W = 2000;
const MAP_BASE_H = 1400;
const MAP_ZOOM_MIN = 0.5;
const MAP_ZOOM_MAX = 3;
const NAVIGATION_ROUTE_DELAY = 900;
const LETTER_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBER_KEYS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "+", "-", "/", "*", "=", "@",
  "#", "%", "&", "(", ")", ":", ";", "!", "?", "_",
];
const SCRUBBER_TICK = 200;
const CALL_DIALING_DELAY = 2000;
let scrubberInterval = null;
let callConnectTimer = null;
let callDurationTimer = null;
let navigationRouteTimer = null;
let lastScrolledRow = null;

function getTrackDuration(sub) {
  const listViewName = {
    radio: "radiolist",
    media: "medialist",
    bluetooth: "playlist",
  }[sub];
  if (!listViewName) return 174;
  const listViewEl = document.querySelector(
    `.view[data-view="${listViewName}"]`,
  );
  const tracks = listViewEl?.querySelectorAll(".track");
  const index = state.selectedTrack[sub]?.index ?? 0;
  const timeEl = tracks?.[index]?.querySelector(".track-time");
  if (!timeEl) return 174;
  const parts = timeEl.textContent.trim().split(":");
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function startScrubber() {
  stopScrubber();
  if (state.playingSubTab === "radio") return;
  scrubberInterval = setInterval(() => {
    if (!state.playing || !state.playingSubTab) {
      stopScrubber();
      return;
    }
    const sub = state.playingSubTab;
    const dur = getTrackDuration(sub);
    state.scrubberProgress[sub] += (SCRUBBER_TICK / (dur * 1000)) * 100;
    if (state.scrubberProgress[sub] >= 100) {
      advanceTrack();
    }
    render();
  }, SCRUBBER_TICK);
}

function stopScrubber() {
  if (scrubberInterval) {
    clearInterval(scrubberInterval);
    scrubberInterval = null;
  }
}

function formatCallDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function stopCallTimers() {
  if (callConnectTimer) {
    clearTimeout(callConnectTimer);
    callConnectTimer = null;
  }
  if (callDurationTimer) {
    clearInterval(callDurationTimer);
    callDurationTimer = null;
  }
}

function connectCall() {
  if (!state.activeCall.active || state.activeCall.phase !== "dialing") return;
  state.activeCall.phase = "connected";
  state.activeCall.connectedAt = Date.now();
  render();
  callDurationTimer = setInterval(render, 1000);
}

function startCallTimers() {
  stopCallTimers();
  callConnectTimer = setTimeout(() => {
    callConnectTimer = null;
    connectCall();
  }, CALL_DIALING_DELAY);
}

function getCallStatusText() {
  if (!state.activeCall.active) return "";
  if (state.activeCall.phase !== "connected" || !state.activeCall.connectedAt) {
    return "Dialing";
  }
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - state.activeCall.connectedAt) / 1000),
  );
  return formatCallDuration(elapsed);
}

function advanceTrack() {
  const sub = state.playingSubTab;
  if (!sub) return;
  state.scrubberProgress[sub] = 0;
  if (state.repeat === "one") return;
  const listViewName = {
    radio: "radiolist",
    media: "medialist",
    bluetooth: "playlist",
  }[sub];
  const listViewEl = listViewName
    ? document.querySelector(`.view[data-view="${listViewName}"]`)
    : null;
  const tracks = listViewEl
    ? Array.from(listViewEl.querySelectorAll(".track"))
    : [];
  if (!tracks.length) return;
  const current = state.selectedTrack[sub] ?? { index: 0 };
  let nextIndex;
  if (state.shuffle && tracks.length > 1) {
    do {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } while (nextIndex === current.index);
  } else {
    nextIndex = (current.index + 1) % tracks.length;
    if (
      state.repeat === "off" &&
      nextIndex === 0 &&
      current.index === tracks.length - 1
    ) {
      const title =
        tracks[0].querySelector(".track-title")?.textContent?.trim() ?? "";
      state.selectedTrack[sub] = { index: 0, title };
      resetPlayback();
      return;
    }
  }
  const title =
    tracks[nextIndex].querySelector(".track-title")?.textContent?.trim() ?? "";
  state.selectedTrack[sub] = { index: nextIndex, title };
}

function collapseRouteCard() {
  state.routeExpanded = false;
  const card = document.querySelector(".navigation-route-card");
  if (card) card.style.height = "";
}

function resetControls() {
  state.scrubberSelected = false;
  collapseRouteCard();
}

function resetPlayback() {
  state.playing = false;
  state.playingSubTab = null;
  stopScrubber();
}

function isPhoneSurface(viewName) {
  return viewName === "phone" || viewName === "call";
}

// === [02] VIEW DEFINITIONS =================================================
const views = {
  splash: {
    zones: [],
    onEnter() {
      setTimeout(() => {
        if (state.view === "splash") goto("menu");
      }, 2200);
    },
  },
  menu: {
    zones: ["tiles"],
  },
  media: {
    subTabs: ["radio", "media", "bluetooth"],
    defaultSubTab: "radio",
    zonesBySubTab: {
      radio: ["cover", "controls"],
      media: ["cover", "scrubber", "controls"],
      bluetooth: ["cover", "scrubber", "controls"],
    },
  },
  radiolist: {
    subTabs: ["radio", "media", "bluetooth"],
    defaultSubTab: "radio",
    zonesBySubTab: {
      radio: ["tracks"],
      media: [],
      bluetooth: [],
    },
  },
  medialist: {
    subTabs: ["radio", "media", "bluetooth"],
    defaultSubTab: "media",
    zonesBySubTab: {
      radio: [],
      media: ["tracks"],
      bluetooth: [],
    },
  },
  playlist: {
    subTabs: ["radio", "media", "bluetooth"],
    defaultSubTab: "bluetooth",
    zonesBySubTab: {
      radio: [],
      media: [],
      bluetooth: ["tracks"],
    },
  },
  navigation: {
    subTabs: ["map", "search", "favorites"],
    defaultSubTab: "map",
    zonesBySubTab: {
      map: ["map-canvas", "route-actions"],
      search: ["keyboard"],
      favorites: ["navigation-favorites"],
    },
    onEnter() {
      applyMapTransform();
    },
  },
  phone: {
    subTabs: ["recent", "contacts", "dial"],
    defaultSubTab: "recent",
    zonesBySubTab: {
      recent: ["rows"],
      contacts: ["rows"],
      dial: ["dialpad", "call"],
    },
  },
  call: {
    subTabs: ["recent", "contacts", "dial"],
    defaultSubTab: "dial",
    zonesBySubTab: {
      recent: ["call-actions"],
      contacts: ["call-actions"],
      dial: ["call-actions"],
    },
  },
  weather: {
    subTabs: ["today", "week", "month"],
    defaultSubTab: "today",
  },
  calendar: {
    subTabs: ["today", "week", "month"],
    defaultSubTab: "today",
  },
  vehicle: {
    subTabs: ["system", "assistance", "service"],
    defaultSubTab: "system",
  },
  apps: {
    subTabs: ["vehicle", "phone", "store"],
    defaultSubTab: "vehicle",
  },
  settings: {
    subTabs: ["general", "display", "software"],
    defaultSubTab: "general",
  },
};

// list views that are sub-pages of media
const LIST_VIEWS = new Set(["radiolist", "medialist", "playlist"]);

// === [03] VIEW HELPERS =====================================================
function getViewDef() {
  const def = views[state.view];
  if (!def) return { zones: [] };
  if (def.zonesBySubTab && state.subTab) {
    return { ...def, zones: def.zonesBySubTab[state.subTab] || [] };
  }
  return { ...def, zones: def.zones || [] };
}

function getViewEl() {
  return document.querySelector(`.view[data-view="${state.view}"]`);
}

function getZoneEl(zoneName) {
  const viewEl = getViewEl();
  if (!viewEl) return null;

  if (state.subTab) {
    const subtabEl = viewEl.querySelector(
      `[data-subtab-content="${state.subTab}"]`,
    );
    if (subtabEl) {
      return subtabEl.querySelector(`[data-zone="${zoneName}"]`) ?? null;
    }
  }

  return viewEl.querySelector(`[data-zone="${zoneName}"]`) ?? null;
}

function getZoneItems(zoneName) {
  const el = getZoneEl(zoneName);
  if (!el) return [];

  const selectors = {
    tracks: ".track",
    "navigation-favorites": ".navigation-favorite-row",
    rows: ".row",
    tiles: ".tile",
    controls: ".control",
    "call-actions": ".call-action",
    "route-actions": state.routeExpanded ? ".route-action" : null,
    dialpad: ".dialpad-key",
    keyboard: ".key",
  };

  const sel = selectors[zoneName];
  if (sel === null) return [];
  if (sel) return Array.from(el.querySelectorAll(sel));
  return [el]; // single-element zone
}

function getCurrentZone() {
  return getViewDef().zones[state.zoneIndex] ?? null;
}

function getCurrentItems() {
  const zone = getCurrentZone();
  return zone ? getZoneItems(zone) : [];
}

// === [04] NAVIGATION =======================================================
function goto(viewName) {
  const targetView =
    viewName === "phone" && state.activeCall.active ? "call" : viewName;
  const def = views[targetView];
  if (!def) return;

  state.history.push({ view: state.view, subTab: state.subTab });
  state.view = targetView;
  state.subTab = getEntrySubTab(targetView, def);
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = false;
  resetControls();

  render();
  def.onEnter?.();
}

function getEntrySubTab(viewName, def) {
  if (viewName === "call") return state.activeCall.subTab;
  if (
    viewName === "media" &&
    state.playing &&
    def.subTabs?.includes(state.playingSubTab)
  ) {
    return state.playingSubTab;
  }
  return def.defaultSubTab ?? null;
}

function goBack() {
  if (state.view === "call" && state.activeCall.active) {
    let prev = state.history.pop();
    while (prev && (prev.view === "phone" || prev.view === "call")) {
      prev = state.history.pop();
    }
    if (!prev) return;

    state.view = prev.view;
    state.subTab = prev.subTab;
    state.zoneIndex = 0;
    state.itemIndex = 0;
    state.focusVisible = false;
    resetControls();
    render();
    return;
  }

  const prev = state.history.pop();
  if (!prev) return;

  state.view = prev.view;
  state.subTab = prev.subTab;
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = false;
  resetControls();

  render();
}

function addRecentCall(label) {
  const list = document.querySelector(
    '[data-subtab-content="recent"] [data-zone="rows"]',
  );
  if (!list) return;
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const row = document.createElement("li");
  row.className = "row";
  row.innerHTML =
    `<span class="row-name">${label}</span>` +
    `<span class="row-day">Today</span>` +
    `<span class="row-time">${h}:${m} ${ampm}</span>`;
  list.prepend(row);
}

function startCall(label) {
  if (state.activeCall.active) {
    state.view = "call";
    state.subTab = state.activeCall.subTab;
    state.zoneIndex = 0;
    state.itemIndex = 0;
    state.focusVisible = false;
    render();
    return;
  }

  const callLabel = label?.trim();
  if (!callLabel) {
    render();
    return;
  }

  addRecentCall(callLabel);

  const returnView = state.view;
  const returnSubTab = state.subTab;
  const sourceSubTab = state.view === "phone" ? state.subTab || "dial" : "dial";
  state.activeCall = {
    label: callLabel,
    active: true,
    phase: "dialing",
    connectedAt: null,
    subTab: sourceSubTab,
    returnView,
    returnSubTab,
    muted: false,
    fromDial: sourceSubTab === "dial",
  };
  state.history.push({ view: state.view, subTab: state.subTab });
  state.view = "call";
  state.subTab = sourceSubTab;
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = false;
  resetControls();
  render();
  startCallTimers();
}

function endCall() {
  const returnView = state.activeCall.returnView || "phone";
  const returnSubTab =
    state.activeCall.returnSubTab || state.activeCall.subTab || "recent";
  const clearDialNumber = state.activeCall.fromDial;
  stopCallTimers();
  state.activeCall = {
    label: "",
    active: false,
    phase: "idle",
    connectedAt: null,
    subTab: returnSubTab,
    returnView,
    returnSubTab,
    muted: false,
    fromDial: false,
  };

  if (clearDialNumber) {
    state.dialNumber = "";
  }

  const top = state.history[state.history.length - 1];
  if (top?.view === returnView && top?.subTab === returnSubTab) {
    state.history.pop();
  }

  state.view = returnView;
  state.subTab = returnSubTab;
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = false;
  resetControls();
  render();
}

function setSubTab(nextSubTab) {
  const previousView = state.view;
  const previousSubTab = state.subTab;

  if (LIST_VIEWS.has(state.view)) {
    const top = state.history[state.history.length - 1];
    if (top?.view === "media") state.history.pop();
    state.view = "media";
  }

  if (state.view === "call") {
    if (state.activeCall.active) {
      return;
    }

    const top = state.history[state.history.length - 1];
    if (top?.view === "phone") state.history.pop();
    state.view = "phone";
  }

  if (
    isPhoneSurface(state.view) &&
    state.subTab === "dial" &&
    nextSubTab !== "dial"
  ) {
    state.dialNumber = "";
  }

  if (
    (previousView === "media" || LIST_VIEWS.has(previousView)) &&
    nextSubTab !== previousSubTab
  ) {
    resetPlayback();
    state.shuffle = false;
    state.repeat = "off";
  }

  state.subTab = nextSubTab;
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = false;
  resetControls();

  render();
}

function cycleSubTab() {
  const { subTabs } = getViewDef();
  if (!subTabs?.length) return;
  const next = subTabs[(subTabs.indexOf(state.subTab) + 1) % subTabs.length];
  setSubTab(next);
}

// === [05] INPUT ============================================================

const VERTICAL_ZONES = new Set([
  "tracks",
  "navigation-favorites",
  "rows",
]);
const GRID_ZONES = { tiles: 4, dialpad: 3, keyboard: 9 }; // zone -> column count

function handleKey(e) {
  if (e.key === "Tab") {
    e.preventDefault();
    cycleSubTab();
    return;
  }

  if (state.view === "splash") {
    goto("menu");
    return;
  }

  const zone = getCurrentZone();

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      if (state.scrubberSelected) return;
      if (zone === "route-actions") {
        collapseRouteCard();
        moveZone(-1);
      } else if (zone === "keyboard") moveKeyboardRow(-1);
      else if (GRID_ZONES[zone]) moveGridRow(GRID_ZONES[zone], -1);
      else if (VERTICAL_ZONES.has(zone)) moveItem(-1);
      else moveZone(-1);
      break;

    case "ArrowDown":
      e.preventDefault();
      if (state.scrubberSelected) return;
      if (zone === "map-canvas" && state.navigationRoute.active) moveZone(1);
      else if (zone === "keyboard") moveKeyboardRow(1);
      else if (GRID_ZONES[zone]) moveGridRow(GRID_ZONES[zone], 1);
      else if (VERTICAL_ZONES.has(zone)) moveItem(1);
      else moveZone(1);
      break;

    case "ArrowLeft":
      e.preventDefault();
      if (state.scrubberSelected) adjustScrubber(-5);
      else moveItem(-1);
      break;

    case "ArrowRight":
      e.preventDefault();
      if (state.scrubberSelected) adjustScrubber(5);
      else moveItem(1);
      break;

    case "Enter":
      e.preventDefault();
      activate();
      break;

    case "Escape":
      e.preventDefault();
      escapeAction();
      break;

    case "+":
    case "=":
      if (zone === "map-canvas") {
        e.preventDefault();
        zoomMap(1.25);
      }
      break;

    case "-":
      if (zone === "map-canvas") {
        e.preventDefault();
        zoomMap(0.8);
      }
      break;
  }
}

function moveZone(delta) {
  const { zones } = getViewDef();
  if (!zones.length) return;
  if (!state.focusVisible) {
    state.focusVisible = true;
    render();
    return;
  }
  state.scrubberSelected = false;
  state.zoneIndex = (state.zoneIndex + delta + zones.length) % zones.length;
  state.itemIndex = 0;

  // entering a grid zone from below: land on the bottom row, middle column
  const newZone = zones[state.zoneIndex];
  const cols = GRID_ZONES[newZone];
  if (cols && delta < 0) {
    const items = getCurrentItems();
    const lastRowStart = Math.floor((items.length - 1) / cols) * cols;
    state.itemIndex = Math.min(
      lastRowStart + Math.floor(cols / 2),
      items.length - 1,
    );
  }

  render();
}

function moveItem(delta) {
  const items = getCurrentItems();
  if (!items.length) return;
  if (!state.focusVisible) {
    state.focusVisible = true;
    render();
    return;
  }
  state.scrubberSelected = false;
  state.itemIndex = (state.itemIndex + delta + items.length) % items.length;
  render();
}

function moveGridRow(cols, delta) {
  const items = getCurrentItems();
  if (!items.length) return;
  if (!state.focusVisible) {
    state.focusVisible = true;
    render();
    return;
  }
  state.scrubberSelected = false;
  const next = state.itemIndex + cols * delta;
  if (next >= 0 && next < items.length) {
    state.itemIndex = next;
    render();
    return;
  }
  // off the bottom: advance to the next zone (e.g. dialpad → call)
  if (next >= items.length) {
    const { zones } = getViewDef();
    if (state.zoneIndex < zones.length - 1) moveZone(1);
  }
  // off the top: stay put — don't wrap into the call zone
}

function getKeyboardSlot(item, index) {
  const key = item.dataset.key;
  if (index < 27) {
    return {
      row: Math.floor(index / 9),
      col: (index % 9) + 1,
      center: (index % 9) + 1,
    };
  }

  const bottomSlots = {
    ".": { row: 3, col: 1, center: 1 },
    ",": { row: 3, col: 2, center: 2 },
    search: { row: 3, col: 3, center: 5 },
    space: { row: 3, col: 8, center: 8 },
    back: { row: 3, col: 9, center: 9 },
  };

  return (
    bottomSlots[key] ?? {
      row: Math.floor(index / 9),
      col: (index % 9) + 1,
      center: (index % 9) + 1,
    }
  );
}

function moveKeyboardRow(delta) {
  const items = getCurrentItems();
  if (!items.length) return;
  if (!state.focusVisible) {
    state.focusVisible = true;
    render();
    return;
  }
  state.scrubberSelected = false;

  const current = getKeyboardSlot(items[state.itemIndex], state.itemIndex);
  const targetRow = current.row + delta;
  const slots = items.map((item, index) => ({
    item,
    index,
    ...getKeyboardSlot(item, index),
  }));
  const candidates = slots.filter((slot) => slot.row === targetRow);
  if (!candidates.length) return;

  candidates.sort(
    (a, b) =>
      Math.abs(a.center - current.center) - Math.abs(b.center - current.center),
  );
  state.itemIndex = candidates[0].index;
  render();
}

// === [06] MAP TRANSFORMS ===================================================
function clampPan() {
  const el = getZoneEl("map-canvas");
  if (!el) return;
  const maxX = Math.max(0, (MAP_BASE_W * state.mapZoom - el.clientWidth) / 2);
  const maxY = Math.max(0, (MAP_BASE_H * state.mapZoom - el.clientHeight) / 2);
  state.mapPan.x = Math.max(-maxX, Math.min(maxX, state.mapPan.x));
  state.mapPan.y = Math.max(-maxY, Math.min(maxY, state.mapPan.y));
}

function applyMapTransform() {
  const el = getZoneEl("map-canvas");
  if (!el) return;
  const tile = el.querySelector(".map-tile");
  if (!tile) return;
  tile.style.transform = `translate(${state.mapPan.x}px, ${state.mapPan.y}px) scale(${state.mapZoom})`;
}

function zoomMap(factor) {
  const el = getZoneEl("map-canvas");
  if (!el) return;

  const oldZoom = state.mapZoom;
  const newZoom = Math.max(
    MAP_ZOOM_MIN,
    Math.min(MAP_ZOOM_MAX, oldZoom * factor),
  );
  if (newZoom === oldZoom) return;

  state.mapZoom = newZoom;
  clampPan();

  const tile = el.querySelector(".map-tile");
  if (tile) {
    tile.style.transition = "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)";
    tile.addEventListener(
      "transitionend",
      () => {
        tile.style.transition = "";
      },
      { once: true },
    );
  }

  applyMapTransform();

  state.focusVisible = true;
  render();
}

// === [07] ACTIONS ==========================================================
function adjustScrubber(delta) {
  if (!state.subTab || state.scrubberProgress[state.subTab] === undefined)
    return;
  state.scrubberProgress[state.subTab] = Math.max(
    0,
    Math.min(100, state.scrubberProgress[state.subTab] + delta),
  );
  render();
}

function previewFavoriteRoute(item) {
  const destination =
    item.querySelector(".navigation-favorite-name")?.textContent?.trim() ?? "";
  const type =
    item.querySelector(".navigation-favorite-type")?.textContent?.trim() ?? "";
  const distance =
    item.querySelector(".navigation-favorite-distance")?.textContent?.trim() ??
    "";
  if (!destination) return;
  if (navigationRouteTimer) clearTimeout(navigationRouteTimer);

  state.navigationRoute = {
    destination,
    type,
    distance,
    loading: true,
    active: false,
  };
  state.subTab = "map";
  state.zoneIndex = 0;
  state.itemIndex = 0;
  state.focusVisible = true;
  resetControls();

  render();

  state.mapPan = { x: 0, y: 0 };
  applyMapTransform();

  navigationRouteTimer = setTimeout(() => {
    if (state.navigationRoute.destination !== destination) return;
    state.navigationRoute.loading = false;
    state.navigationRoute.active = true;
    render();
  }, NAVIGATION_ROUTE_DELAY);
}

function activate() {
  if (!state.focusVisible) return;

  const zone = getCurrentZone();
  const items = getCurrentItems();
  const item = items[state.itemIndex];

  // collapsed route card — lock height and expand on enter
  if (
    zone === "route-actions" &&
    !state.routeExpanded &&
    state.navigationRoute.active
  ) {
    const card = document.querySelector(".navigation-route-card");
    if (card) card.style.height = card.offsetHeight + "px";
    state.routeExpanded = true;
    state.itemIndex = 0;
    render();
    return;
  }

  if (!item) return;

  switch (zone) {
    case "tiles":
      if (item.dataset.target) goto(item.dataset.target);
      break;

    case "cover":
      if (item.dataset.target) goto(item.dataset.target);
      break;

    case "tracks": {
      const item = items[state.itemIndex];
      if (!item) {
        goBack();
        break;
      }

      // read track title from the DOM
      const titleEl = item.querySelector(".track-title");
      const title = titleEl?.textContent?.trim() ?? "";
      const index = state.itemIndex;

      if (state.subTab) {
        state.selectedTrack[state.subTab] = { index, title };
        state.scrubberProgress[state.subTab] = 0;
        state.playing = true;
        state.playingSubTab = state.subTab;
        startScrubber();
      }

      goBack();
      break;
    }

    case "controls": {
      const action = item.dataset.action;
      if (action === "play") {
        const isCurrentPlaying =
          state.playing && state.playingSubTab === state.subTab;
        state.playing = !isCurrentPlaying;
        state.playingSubTab = state.playing ? state.subTab : null;
        if (state.playing) startScrubber();
        else stopScrubber();
      }
      if (action === "shuffle") state.shuffle = !state.shuffle;
      if (action === "repeat") {
        const modes = ["off", "all", "one"];
        state.repeat = modes[(modes.indexOf(state.repeat) + 1) % modes.length];
      }
      if ((action === "next" || action === "prev") && state.subTab) {
        const listViewName = {
          radio: "radiolist",
          media: "medialist",
          bluetooth: "playlist",
        }[state.subTab];
        const listViewEl = listViewName
          ? document.querySelector(`.view[data-view="${listViewName}"]`)
          : null;
        const tracks = listViewEl
          ? Array.from(listViewEl.querySelectorAll(".track"))
          : [];
        if (tracks.length) {
          const current = state.selectedTrack[state.subTab] ?? { index: 0 };
          let nextIndex;
          if (state.shuffle && tracks.length > 1) {
            do {
              nextIndex = Math.floor(Math.random() * tracks.length);
            } while (nextIndex === current.index);
          } else {
            const delta = action === "next" ? 1 : -1;
            nextIndex = (current.index + delta + tracks.length) % tracks.length;
          }
          const title =
            tracks[nextIndex]
              .querySelector(".track-title")
              ?.textContent?.trim() ?? "";
          state.selectedTrack[state.subTab] = { index: nextIndex, title };
        }
        state.scrubberProgress[state.subTab] = 0;
      }
      render();
      break;
    }

    case "scrubber":
      state.scrubberSelected = !state.scrubberSelected;
      render();
      break;

    case "navigation-favorites":
      previewFavoriteRoute(item);
      break;

    case "route-actions": {
      if (!state.routeExpanded) {
        state.routeExpanded = true;
        state.itemIndex = 0;
        render();
        break;
      }
      const action = item.dataset.action;
      if (action === "end-route") {
        if (navigationRouteTimer) {
          clearTimeout(navigationRouteTimer);
          navigationRouteTimer = null;
        }
        state.navigationRoute = {
          destination: "",
          type: "",
          distance: "",
          loading: false,
          active: false,
        };
        collapseRouteCard();
        state.zoneIndex = 0;
        state.itemIndex = 0;
      }
      render();
      break;
    }

    case "rows": {
      const name = item.querySelector(".row-name")?.textContent?.trim();
      startCall(name);
      break;
    }

    case "call-actions": {
      const action = item.dataset.action;
      if (action === "end") endCall();
      else if (action === "mute") {
        state.activeCall.muted = !state.activeCall.muted;
        render();
      } else render();
      break;
    }

    case "dialpad": {
      const key = item.dataset.key;
      if (key === "back") state.dialNumber = state.dialNumber.slice(0, -1);
      else if (key) state.dialNumber += key;
      render();
      break;
    }

    case "call":
      if (!state.dialNumber) {
        render();
        break;
      }
      startCall(state.dialNumber);
      break;

    case "keyboard": {
      const key = item.dataset.key;
      if (key === "back") state.address = state.address.slice(0, -1);
      else if (key === "space") state.address += " ";
      else if (key === "mode")
        state.keyboardMode =
          state.keyboardMode === "letters" ? "numbers" : "letters";
      else if (key === "search") state.focusVisible = true;
      else if (key) state.address += key;
      render();
      break;
    }
  }
}

// === [08] RENDER ===========================================================
function render() {
  const viewEl = getViewEl();

  // show / hide views
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.toggle("active", v.dataset.view === state.view);
  });

  // clear all focus
  document
    .querySelectorAll(".focused")
    .forEach((el) => el.classList.remove("focused"));
  document
    .querySelectorAll(".selected")
    .forEach((el) => el.classList.remove("selected"));

  // apply focus to current item
  if (state.focusVisible) {
    getCurrentItems()[state.itemIndex]?.classList.add("focused");
  }

  if (state.scrubberSelected && getCurrentZone() === "scrubber") {
    getCurrentItems()[state.itemIndex]?.classList.add("selected");
  }

  // sub-tab tabs + content
  if (viewEl && state.subTab) {
    viewEl.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.subtab === state.subTab);
    });
    viewEl.querySelectorAll("[data-subtab-content]").forEach((el) => {
      el.classList.toggle("active", el.dataset.subtabContent === state.subTab);
    });
  }

  // reset all control buttons to default everywhere
  document.querySelectorAll('[data-action="play"]').forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-label", "Play");
    b.setAttribute("aria-pressed", "false");
  });
  document
    .querySelectorAll('[data-action="shuffle"], [data-action="repeat"]')
    .forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
      delete b.dataset.mode;
    });

  // apply state to the active subtab scope only
  const scope = viewEl?.querySelector("[data-subtab-content].active") ?? viewEl;
  if (scope) {
    const playBtn = scope.querySelector('[data-action="play"]');
    const shuffleBtn = scope.querySelector('[data-action="shuffle"]');
    const repeatBtn = scope.querySelector('[data-action="repeat"]');
    const isCurrentSubTabPlaying =
      state.playing && state.playingSubTab === state.subTab;

    if (playBtn) {
      playBtn.classList.toggle("active", isCurrentSubTabPlaying);
      playBtn.setAttribute("aria-label", isCurrentSubTabPlaying ? "Pause" : "Play");
      playBtn.setAttribute("aria-pressed", String(isCurrentSubTabPlaying));
    }
    if (shuffleBtn) {
      shuffleBtn.classList.toggle("active", state.shuffle);
      shuffleBtn.setAttribute("aria-pressed", String(state.shuffle));
    }
    if (repeatBtn) {
      const repeatActive = state.repeat !== "off";
      const repeatLabel = state.repeat === "one" ? "Repeat track" : "Repeat list";
      repeatBtn.classList.toggle("active", repeatActive);
      repeatBtn.setAttribute("aria-label", repeatActive ? repeatLabel : "Repeat");
      repeatBtn.setAttribute("aria-pressed", String(repeatActive));
      repeatBtn.dataset.mode = state.repeat;
    }
  }

  if (scope && state.subTab) {
    const trackDisplay = scope.querySelector(".player-track");
    const selected = state.selectedTrack?.[state.subTab];
    if (trackDisplay && selected) {
      trackDisplay.textContent = selected.title;
    }
  }

  document
    .querySelectorAll('.view[data-view="media"] [data-subtab-content]')
    .forEach((subtabEl) => {
      const progress = state.scrubberProgress[subtabEl.dataset.subtabContent];
      const fill = subtabEl.querySelector(".scrubber-fill");
      if (fill && progress !== undefined) fill.style.width = `${progress}%`;

      const timesEl = subtabEl.querySelector(".scrubber-times");
      if (timesEl && progress !== undefined) {
        const sub = subtabEl.dataset.subtabContent;
        const total = getTrackDuration(sub);
        const elapsed = Math.round((total * progress) / 100);
        const remaining = total - elapsed;
        const fmt = (s) =>
          `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        timesEl.querySelector(".scrubber-elapsed").textContent = fmt(elapsed);
        timesEl.querySelector(".scrubber-remaining").textContent =
          `-${fmt(remaining)}`;
      }
    });

  // dial display
  const dialDisplay = document.querySelector(".dial-display");
  if (dialDisplay) dialDisplay.textContent = state.dialNumber;

  // address display
  const addressDisplay = document.querySelector(".address-display");
  if (addressDisplay) addressDisplay.textContent = state.address;

  // call display
  const callName = document.querySelector(".call-name");
  const callStatus = document.querySelector(".call-status");
  if (state.view === "call" || state.activeCall.active) {
    if (callName) callName.textContent = state.activeCall.label;
    if (callStatus) callStatus.textContent = getCallStatusText();
  }
  document
    .querySelector(".chrome-call-icon")
    ?.classList.toggle("active", state.activeCall.active);
  document.querySelectorAll('[data-action="mute"]').forEach((btn) => {
    btn.classList.toggle("is-muted", state.activeCall.muted);
  });

  // keyboard labels
  const keyboardKeys =
    state.keyboardMode === "letters" ? LETTER_KEYS : NUMBER_KEYS;
  document.querySelectorAll(".keyboard-input").forEach((keyEl, index) => {
    const key = keyboardKeys[index] ?? "";
    keyEl.dataset.key = key;
    keyEl.textContent = key;
  });
  document.querySelectorAll(".keyboard-mode").forEach((keyEl) => {
    keyEl.textContent = state.keyboardMode === "letters" ? "123" : "ABC";
  });

  // navigation route card
  const routeCard = document.querySelector(".navigation-route-card");
  if (routeCard) {
    routeCard.classList.toggle("expanded", state.routeExpanded);
    routeCard.classList.toggle(
      "focused",
      getCurrentZone() === "route-actions" && !state.routeExpanded,
    );
  }

  // navigation route preview
  const route = state.navigationRoute;
  const mapContainer = document.querySelector(".content-container.is-map");
  mapContainer?.classList.toggle("has-route", Boolean(route.destination));
  mapContainer?.classList.toggle("route-loading", route.loading);
  mapContainer?.classList.toggle("route-active", route.active);
  document.querySelectorAll(".navigation-route-destination").forEach((el) => {
    el.textContent = route.destination || "";
  });
  document.querySelectorAll(".navigation-route-meta").forEach((el) => {
    el.textContent = [route.type, route.distance].filter(Boolean).join(" · ");
  });

  // scroll focused track/list row into view — only when focus moves,
  // so periodic re-renders (e.g. scrubber tick) don't fight manual scroll
  const focusedRow = document.querySelector(
    ".track.focused, .row.focused, .navigation-favorite-row.focused",
  );
  if (focusedRow && focusedRow !== lastScrolledRow) {
    focusedRow.scrollIntoView({ block: "nearest" });
  }
  lastScrolledRow = focusedRow;

  document
    .querySelectorAll(".track.playing")
    .forEach((t) => t.classList.remove("playing"));

  if (state.subTab && state.selectedTrack?.[state.subTab] !== undefined) {
    const activeListView = {
      radio: "radiolist",
      media: "medialist",
      bluetooth: "playlist",
    }[state.subTab];

    if (activeListView) {
      const listViewEl = document.querySelector(
        `.view[data-view="${activeListView}"]`,
      );
      const tracks = listViewEl?.querySelectorAll(".track");
      const selectedIndex = state.selectedTrack[state.subTab]?.index;
      if (tracks && selectedIndex !== undefined) {
        tracks[selectedIndex]?.classList.add("playing");
      }
    }
  }
}

// === [09] CLOCK ============================================================
function updateClock() {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() >= 12 ? "PM" : "AM";
  const day = now.toLocaleDateString("en-US", { weekday: "short" });
  const date = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const el = document.getElementById("clock");
  if (!el) return;
  el.querySelector(".clock-time").textContent = `${h}:${m} ${ampm}`;
  el.querySelector(".clock-date").textContent = `${day}, ${date}`;
}

// === [10] MOUSE FALLBACK ===================================================
// Esc / back — shared by the keyboard Escape key and the right-click gesture
function escapeAction() {
  if (state.routeExpanded) {
    collapseRouteCard();
    state.zoneIndex = 0;
    state.itemIndex = 0;
    render();
    return;
  }
  if (state.scrubberSelected) {
    state.scrubberSelected = false;
    render();
    return;
  }
  goBack();
}

function initMouseFallback() {
  // right-click anywhere = back (mouse equivalent of Esc)
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    escapeAction();
  });

  document.addEventListener("click", (e) => {
    // tabs work from anywhere — they're not part of zone navigation
    const tabBtn = e.target.closest(".tab");
    if (tabBtn?.dataset.subtab) {
      setSubTab(tabBtn.dataset.subtab);
      return;
    }

    const zoneEl = e.target.closest("[data-zone]");
    if (!zoneEl) return;

    const zoneName = zoneEl.dataset.zone;
    const { zones } = getViewDef();
    const zIdx = zones.indexOf(zoneName);
    if (zIdx < 0) return;

    const items = getZoneItems(zoneName);
    const item = e.target.closest(
      ".tile, .track, .row, .navigation-favorite-row, .control, .call-action, .route-action, .dialpad-key, .key, .player-cover, [data-zone]",
    );
    const iIdx = item ? Math.max(items.indexOf(item), 0) : 0;

    state.focusVisible = true;
    state.zoneIndex = zIdx;
    state.itemIndex = iIdx;

    render();
    activate();
  });
}

// === [11] MAP DRAG =========================================================
function initMapDrag() {
  const el = document.querySelector('[data-zone="map-canvas"]');
  if (!el) return;
  let dragging = false;
  let startX, startY, panX, panY;

  el.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    panX = state.mapPan.x;
    panY = state.mapPan.y;
    el.style.cursor = "grabbing";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    state.mapPan.x = panX + (e.clientX - startX);
    state.mapPan.y = panY + (e.clientY - startY);
    clampPan();
    applyMapTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    el.style.cursor = "";
  });

  // mouse wheel over the map = zoom (matches the +/- keys)
  el.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomMap(e.deltaY < 0 ? 1.25 : 0.8);
    },
    { passive: false },
  );
}

// === [12] SCALE-TO-FIT =====================================================
// The prototype is a fixed 16:9 "screen" designed at a native resolution. Rather
// than reflow it (it's a car HMI, not a web layout), scale the whole stage
// uniformly so the entire composition stays intact and never clips on smaller
// viewports. offsetWidth/Height report the untransformed layout size, so this
// stays stable across repeated calls.
// Measured once: the vertical room the caption needs when fully open. Reserved
// on BOTH sides of the screen so the screen stays centred and the caption
// (absolute, below it) always has room to expand into — no reflow on toggle.
let captionReserve = 0;
function measureCaptionReserve() {
  const caption = document.querySelector(".stage-caption");
  if (!caption) return;
  const wasOpen = caption.open;
  caption.open = true; // expand to measure full height (no paint between sync ops)
  const marginTop = parseFloat(getComputedStyle(caption).marginTop) || 0;
  captionReserve = caption.offsetHeight + marginTop;
  caption.open = wasOpen;
}

function fitScreen() {
  const stage = document.querySelector(".stage");
  if (!stage) return;
  const margin = 24; // breathing room around the device
  const w = stage.offsetWidth;
  const h = stage.offsetHeight; // screen only — the caption is absolute
  if (!w || !h) return;
  const scale = Math.min(
    (window.innerWidth - margin) / w,
    (window.innerHeight - margin) / (h + 2 * captionReserve),
    1 // never upscale past native
  );
  stage.style.setProperty("--screen-scale", scale);
}

// === [13] INIT =============================================================
function init() {
  document.addEventListener("keydown", handleKey);
  initMouseFallback();
  initMapDrag();
  updateClock();
  setInterval(updateClock, 10000);
  measureCaptionReserve();
  fitScreen();
  window.addEventListener("resize", fitScreen);
  window.addEventListener("load", () => {
    measureCaptionReserve(); // re-measure once fonts settle
    fitScreen();
  });
  render();
  views.splash.onEnter?.();
}

init();

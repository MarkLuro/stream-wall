const appContainer = document.getElementById('app-container');
const gridContainer = document.getElementById('grid-container');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const resetButton = document.getElementById('reset');
const toggleSidebar = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const muteAllBtn = document.getElementById('mute-all');
// ---> NUEVO: Referencias a los nuevos elementos de la UI <---
const wallNameInput = document.getElementById('wall-name-input');
const saveWallBtn = document.getElementById('save-wall-btn');
const savedWallsList = document.getElementById('saved-walls-list');

let sortableInstance = null;

// ---> NUEVO: Objeto de configuración de Layouts <---
const LAYOUTS = {
  'grid-1': { count: 1, name: '1 Stream' },
  'grid-4': { count: 4, name: '4 Streams' },
  'grid-9': { count: 9, name: '9 Streams' },
  'grid-16': { count: 16, name: '16 Streams' },
  '1-plus-3': { count: 4, name: '1 Principal + 3' }
};

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

let youtubeApiReady = loadYouTubeAPI();
const debouncedSave = debounce(saveCurrentState, 500);

toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
  appContainer.classList.toggle('sidebar-closed');
});

muteAllBtn.addEventListener('click', () => {
  const cells = document.querySelectorAll('.stream-cell');
  const shouldMute = Array.from(cells).some(cell => cell.playerInstance && !cell.playerInstance.isMuted());

  muteAllBtn.textContent = shouldMute ? 'Quitar Silencio' : 'Silenciar Todos';

  cells.forEach(cell => {
    if (cell.playerInstance) {
      cell.playerInstance.setMuted(shouldMute);
      const muteBtn = cell.querySelector('.mute-btn');
      const slider = cell.querySelector('.volume-slider');
      muteBtn.innerHTML = shouldMute ? '🔇' : '🔊';
      if (shouldMute) {
        slider.value = 0;
      } else if(cell.playerInstance.getVolume) {
        slider.value = cell.playerInstance.getVolume();
      }
    }
  });
  saveCurrentState();
});

window.addEventListener('load', () => {
  // ---> CAMBIO: Lógica de carga completamente nueva <---
  populateWallList();
  const lastActiveWallName = localStorage.getItem('stream-wall-last-active');
  const allWalls = getSavedWalls();

  if (lastActiveWallName && allWalls[lastActiveWallName]) {
    const wallData = allWalls[lastActiveWallName];
    generateGrid(wallData.layout, wallData.items);
  } else if (Object.keys(allWalls).length > 0) {
    // Si no hay último activo, carga el primero que encuentre
    const firstWallName = Object.keys(allWalls)[0];
    const wallData = allWalls[firstWallName];
    generateGrid(wallData.layout, wallData.items);
  } else {
    // Si no hay nada guardado, carga un layout por defecto
    generateGrid('grid-4');
  }
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // ---> CAMBIO: Usa data-layout en lugar de data-count <---
    const layout = btn.dataset.layout;
    const currentItems = getCurrentItemsState();
    generateGrid(layout, currentItems);
  });
});

resetButton.onclick = () => {
  // ---> CAMBIO: Limpia los nuevos items de localStorage <---
  localStorage.removeItem('stream-wall-presets');
  localStorage.removeItem('stream-wall-last-active');
  location.reload();
};

// ---> NUEVO: Event listeners para guardar, cargar y borrar walls <---
saveWallBtn.addEventListener('click', () => {
  const wallName = wallNameInput.value.trim();
  if (!wallName) {
    alert('Por favor, introduce un nombre para el wall.');
    return;
  }

  const allWalls = getSavedWalls();
  const currentState = {
    layout: getCurrentLayout(),
    items: getCurrentItemsState()
  };
  
  allWalls[wallName] = currentState;
  localStorage.setItem('stream-wall-presets', JSON.stringify(allWalls));
  localStorage.setItem('stream-wall-last-active', wallName); // El que guardas es ahora el activo

  wallNameInput.value = '';
  populateWallList(); // Actualiza la lista en la UI
});

// Usamos delegación de eventos para los botones de la lista
savedWallsList.addEventListener('click', (e) => {
    const target = e.target;
    const wallItem = target.closest('.saved-wall-item');
    if (!wallItem) return;

    const wallName = wallItem.dataset.name;
    const allWalls = getSavedWalls();

    if (target.classList.contains('delete-wall-btn')) {
        // --- BORRAR WALL ---
        if (confirm(`¿Seguro que quieres borrar el wall "${wallName}"?`)) {
            delete allWalls[wallName];
            localStorage.setItem('stream-wall-presets', JSON.stringify(allWalls));
            
            if (localStorage.getItem('stream-wall-last-active') === wallName) {
                localStorage.removeItem('stream-wall-last-active');
            }
            populateWallList();
        }
    } else {
        // --- CARGAR WALL ---
        if (allWalls[wallName]) {
            const wallData = allWalls[wallName];
            generateGrid(wallData.layout, wallData.items);
            localStorage.setItem('stream-wall-last-active', wallName);
        }
    }
});

function generateGrid(layout = 'grid-4', savedItems = []) {
  gridContainer.innerHTML = '';

  const layoutConfig = LAYOUTS[layout];
  if (!layoutConfig) {
      console.error(`Layout desconocido: ${layout}`);
      return;
  }
  const count = layoutConfig.count;

  // ---> CAMBIO: Control de layout por clases CSS en lugar de JS inline style <---
  gridContainer.className = ''; // Limpia clases de layout anteriores
  gridContainer.classList.add(`layout--${layout}`);
  
  if (layout.startsWith('grid-')) {
    const cols = Math.ceil(Math.sqrt(count));
    gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  } else {
    gridContainer.style.gridTemplateColumns = ''; // Dejamos que el CSS lo maneje
  }
  
  for (let i = 0; i < count; i++) {
    const itemData = savedItems[i] || { url: '', volume: 0.5, muted: true };

    const cell = document.createElement('div');
    cell.className = 'stream-cell';
    cell.id = `cell-${i}`;

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '&#x2630;';
    dragHandle.title = 'Arrastrar para reordenar';
    cell.appendChild(dragHandle);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cell-content-wrapper';

    const streamContainer = document.createElement('div');
    streamContainer.className = 'stream-content';
    streamContainer.id = `player-container-${i}`;

    const inputOverlay = document.createElement('div');
    inputOverlay.className = 'input-overlay';

    const input = document.createElement('input');
    input.placeholder = 'URL del stream...';
    input.value = itemData.url;

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '▶';

    const loadAndSave = () => {
      if (!input.value.trim()) {
        streamContainer.innerHTML = '<p class="error-msg">Introduce una URL válida</p>';
        return;
      }
      loadStream(input.value.trim(), cell);
      saveCurrentState();
    };

    loadBtn.onclick = loadAndSave;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadAndSave();
    });
    input.addEventListener('input', debouncedSave);

    inputOverlay.appendChild(input);
    inputOverlay.appendChild(loadBtn);

    const controlsOverlay = document.createElement('div');
    controlsOverlay.className = 'controls-overlay';

    const muteBtn = document.createElement('button');
    muteBtn.className = 'mute-btn';
    muteBtn.innerHTML = itemData.muted ? '🔇' : '🔊';
    muteBtn.onclick = () => {
      const player = cell.playerInstance;
      if (player) {
          const isMuted = player.isMuted();
          player.setMuted(!isMuted);
          muteBtn.innerHTML = !isMuted ? '🔇' : '🔊';
          if (!isMuted === false && player.getVolume) {
            volumeSlider.value = player.getVolume();
          }
      }
      saveCurrentState();
    };

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.className = 'volume-slider';
    volumeSlider.min = 0;
    volumeSlider.max = 1;
    volumeSlider.step = 0.05;
    volumeSlider.value = itemData.muted ? 0 : itemData.volume;

    volumeSlider.addEventListener('input', () => {
      const player = cell.playerInstance;
      if (player) {
          player.setVolume(parseFloat(volumeSlider.value));
          if (volumeSlider.value > 0) {
              player.setMuted(false);
              muteBtn.innerHTML = '🔊';
          }
      }
      debouncedSave();
    });

    controlsOverlay.appendChild(muteBtn);
    controlsOverlay.appendChild(volumeSlider);

    contentWrapper.appendChild(streamContainer);
    contentWrapper.appendChild(inputOverlay);
    contentWrapper.appendChild(controlsOverlay);
    cell.appendChild(contentWrapper);
    gridContainer.appendChild(cell);

    if (itemData.url) {
      loadStream(itemData.url, cell);
    } else {
        controlsOverlay.classList.add('visible');
    }
  }

  saveCurrentState();

  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(gridContainer, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    handle: '.drag-handle',
    onStart: () => document.body.classList.add('is-dragging'),
    onEnd: () => {
      document.body.classList.remove('is-dragging');
      saveCurrentState();
    }
  });
}

function getCurrentItemsState() {
  return Array.from(document.querySelectorAll('.stream-cell')).map(cell => {
    const input = cell.querySelector('.input-overlay input');
    const slider = cell.querySelector('.volume-slider');
    const muteBtn = cell.querySelector('.mute-btn');
    return {
      url: input.value.trim(),
      volume: parseFloat(slider.value),
      muted: muteBtn.innerHTML === '🔇'
    };
  });
}

// ---> NUEVO: Helper para obtener el layout actual <---
function getCurrentLayout() {
    for (const className of gridContainer.classList) {
        if (className.startsWith('layout--')) {
            return className.replace('layout--', '');
        }
    }
    return 'grid-4'; // Fallback
}

// ---> CAMBIO: La función de guardado ahora actualiza el "wall activo" <---
function saveCurrentState() {
  const layout = getCurrentLayout();
  const items = getCurrentItemsState();
  const lastActiveWallName = localStorage.getItem('stream-wall-last-active');
  
  if (lastActiveWallName) {
      const allWalls = getSavedWalls();
      if (allWalls[lastActiveWallName]) {
          allWalls[lastActiveWallName] = { layout, items };
          localStorage.setItem('stream-wall-presets', JSON.stringify(allWalls));
      }
  }
}

// ---> NUEVO: Funciones para manejar los presets guardados <---
function getSavedWalls() {
    try {
        const walls = localStorage.getItem('stream-wall-presets');
        return walls ? JSON.parse(walls) : {};
    } catch (e) {
        console.error("Error al leer los walls guardados:", e);
        return {};
    }
}

function populateWallList() {
    const allWalls = getSavedWalls();
    savedWallsList.innerHTML = ''; // Limpia la lista actual
    
    for (const wallName in allWalls) {
        const li = document.createElement('li');
        li.className = 'saved-wall-item';
        li.dataset.name = wallName;
        
        const span = document.createElement('span');
        span.textContent = wallName;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-wall-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Borrar este wall';

        li.appendChild(span);
        li.appendChild(deleteBtn);
        savedWallsList.appendChild(li);
    }
}

async function loadStream(url, cell) {
  const container = cell.querySelector('.stream-content');
  const controls = cell.querySelector('.controls-overlay');

  container.innerHTML = '<div class="loader"></div>';
  controls.style.display = 'none';

  if (!url) {
    container.innerHTML = '';
    return;
  }

  if (cell.playerInstance && typeof cell.playerInstance.destroy === 'function') {
      cell.playerInstance.destroy();
  }
  cell.playerInstance = null;

  const playerContainerId = container.id;
  const itemData = getCurrentItemsState()[Array.from(gridContainer.children).indexOf(cell)];

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const id = extractYouTubeID(url);
    if (id) {
      await youtubeApiReady;
      const player = new YT.Player(playerContainerId, {
        height: '100%',
        width: '100%',
        videoId: id,
        playerVars: { 'autoplay': 1, 'mute': 1, 'playsinline': 1, 'controls': 1 },
        events: {
          'onReady': (event) => onPlayerReady(event, cell, itemData, controls)
        }
      });
      cell.playerInstance = {
        setVolume: (vol) => player.setVolume(vol * 100),
        getVolume: () => player.getVolume() / 100,
        setMuted: (muted) => muted ? player.mute() : player.unMute(),
        isMuted: () => player.isMuted(),
        destroy: () => player.destroy()
      };
    } else {
      container.innerHTML = '<p class="error-msg">URL de YouTube inválida</p>';
    }
  } else if (url.includes('twitch.tv')) {
    const channel = extractTwitchChannel(url);
    if (channel) {
      const parentDomain = location.hostname || 'localhost';
      const embed = new Twitch.Embed(playerContainerId, {
        width: "100%",
        height: "100%",
        channel: channel,
        parent: [parentDomain],
        autoplay: true,
        muted: true,
        layout: "video"
      });
      embed.addEventListener(Twitch.Embed.READY, () => {
        const loader = container.querySelector('.loader');
        if (loader) loader.remove();
        const player = embed.getPlayer();
        cell.playerInstance = {
          setVolume: (vol) => player.setVolume(vol),
          getVolume: () => player.getVolume(),
          setMuted: (muted) => player.setMuted(muted),
          isMuted: () => player.getMuted(),
          destroy: () => container.innerHTML = ''
        };
        onPlayerReady({target: player}, cell, itemData, controls);
      });
    } else {
      container.innerHTML = '<p class="error-msg">URL de Twitch inválida</p>';
    }
  } else if (url.endsWith('.m3u8')) {
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsinline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(video);
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      cell.playerInstance = {
        setVolume: (vol) => video.volume = vol,
        getVolume: () => video.volume,
        setMuted: (muted) => video.muted = muted,
        isMuted: () => video.muted,
        destroy: () => hls.destroy()
      };
      onPlayerReady({target: video}, cell, itemData, controls);
    } else {
      container.innerHTML = '<p class="error-msg">Navegador no soporta HLS</p>';
    }
  } else {
    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = "fullscreen; autoplay;";
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.frameBorder = '0';
    container.innerHTML = '';
    container.appendChild(iframe);
  }
}

function onPlayerReady(event, cell, itemData, controls) {
    const player = cell.playerInstance;
    if (!player) return;

    if (player.setVolume) player.setVolume(itemData.volume);
    if (player.setMuted) player.setMuted(itemData.muted);

    const muteBtn = cell.querySelector('.mute-btn');
    const slider = cell.querySelector('.volume-slider');
    
    if (player.isMuted) {
      const isMuted = player.isMuted();
      muteBtn.innerHTML = isMuted ? '🔇' : '🔊';
      slider.value = isMuted ? 0 : (player.getVolume ? player.getVolume() : itemData.volume);
    }

    controls.style.display = 'flex';
}

function extractYouTubeID(url) {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function extractTwitchChannel(url) {
  const match = url.match(/twitch\.tv\/([^/?]+)/);
  return match ? match[1] : null;
}
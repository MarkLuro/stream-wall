const appContainer = document.getElementById('app-container');
const gridContainer = document.getElementById('grid-container');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const resetButton = document.getElementById('reset');
const toggleSidebar = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
// ---> NUEVO: Referencia al botón de mute global <---
const muteAllBtn = document.getElementById('mute-all');

let sortableInstance = null;

// ---> NUEVO: Función de utilidad Debounce <---
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
// ---> NUEVO: Versión debounced de la función de guardado <---
const debouncedSave = debounce(saveCurrentState, 500);

toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
  appContainer.classList.toggle('sidebar-closed');
});

// ---> NUEVO: Event listener para el botón de Mute All <---
muteAllBtn.addEventListener('click', () => {
  const cells = document.querySelectorAll('.stream-cell');
  // Determina si la acción será mutear o desmutear
  // Si al menos uno está con sonido, la acción será mutear a todos.
  const shouldMute = Array.from(cells).some(cell => cell.playerInstance && !cell.playerInstance.isMuted());

  muteAllBtn.textContent = shouldMute ? 'Quitar Silencio' : 'Silenciar Todos';

  cells.forEach(cell => {
    if (cell.playerInstance) {
      cell.playerInstance.setMuted(shouldMute);
      // Actualizar la UI de cada celda
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
  saveCurrentState(); // Guarda el nuevo estado de todos
});

window.addEventListener('load', () => {
  try {
    const saved = JSON.parse(localStorage.getItem('stream-wall'));
    if (saved && saved.count && saved.items) {
      generateGrid(saved.count, saved.items);
    } else {
      generateGrid(4);
    }
  } catch (e) {
    console.error('Error cargando estado guardado:', e);
    generateGrid(4);
  }
});

presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const count = parseInt(btn.dataset.count);
    const currentItems = getCurrentItemsState();
    generateGrid(count, currentItems);
  });
});

resetButton.onclick = () => {
  localStorage.removeItem('stream-wall');
  location.reload();
};

function generateGrid(count, savedItems = []) {
  gridContainer.innerHTML = '';
  const cols = Math.ceil(Math.sqrt(count));
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

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
    // ---> CAMBIO: Usamos la versión debounced para el guardado en input <---
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
      // ---> CAMBIO: Usamos la versión debounced para el guardado en slider <---
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

function saveCurrentState() {
  const items = getCurrentItemsState();
  const count = items.length;
  localStorage.setItem('stream-wall', JSON.stringify({ count, items }));
}

async function loadStream(url, cell) {
  const container = cell.querySelector('.stream-content');
  const controls = cell.querySelector('.controls-overlay');

  // ---> CAMBIO: Añadimos el indicador de carga <---
  container.innerHTML = '<div class="loader"></div>';

  controls.style.display = 'none';

  if (!url) {
    container.innerHTML = ''; // Limpiamos el loader si no hay URL
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
        // ---> ¡AQUÍ ESTÁ LA CORRECCIÓN! <---
        // Elimina explícitamente el loader para Twitch
        const loader = container.querySelector('.loader');
        if (loader) loader.remove();
        // --------------------------------------------------------------------

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
    container.innerHTML = ''; // Limpiamos el loader antes de añadir el video
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
    container.innerHTML = ''; // Limpiamos el loader
    container.appendChild(iframe);
  }
}

function onPlayerReady(event, cell, itemData, controls) {
    const player = cell.playerInstance;
    if (!player) return;

    // A veces onPlayerReady puede tardar, así que aplicamos el estado de nuevo
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
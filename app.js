const appContainer = document.getElementById('app-container');
const gridContainer = document.getElementById('grid-container');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const resetButton = document.getElementById('reset');
const toggleSidebar = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');

let sortableInstance = null;

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

toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
  appContainer.classList.toggle('sidebar-closed');
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
    input.addEventListener('input', saveCurrentState);

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
          if (!isMuted === false) {
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
      saveCurrentState();
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
  container.innerHTML = '';
  controls.style.display = 'none';
  
  if (!url) return;

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
        // ========= CAMBIO AQUÍ =========
        playerVars: { 'autoplay': 1, 'mute': 1, 'playsinline': 1, 'controls': 1 },
        // ===============================
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
        muted: true
      });
      embed.addEventListener(Twitch.Embed.READY, () => {
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
    container.appendChild(iframe);
  }
}

function onPlayerReady(event, cell, itemData, controls) {
    const player = cell.playerInstance;
    if (!player) return;

    player.setVolume(itemData.volume);
    player.setMuted(itemData.muted);
    
    const muteBtn = cell.querySelector('.mute-btn');
    const slider = cell.querySelector('.volume-slider');
    muteBtn.innerHTML = player.isMuted() ? '🔇' : '🔊';
    slider.value = player.isMuted() ? 0 : player.getVolume();
    
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
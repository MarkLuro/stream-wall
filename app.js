const appContainer = document.getElementById('app-container');
const gridContainer = document.getElementById('grid-container');
const presetButtons = document.querySelectorAll('.preset-buttons button');
const resetButton = document.getElementById('reset');
const toggleSidebar = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');

// Variable para guardar la instancia de Sortable
let sortableInstance = null;

// Mostrar/Ocular sidebar
toggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('closed');
  appContainer.classList.toggle('sidebar-closed');
});

// Cargar desde localStorage al inicio
window.addEventListener('load', () => {
  try {
    const saved = JSON.parse(localStorage.getItem('stream-wall'));
    if (saved && saved.count && saved.urls) {
      generateGrid(saved.count, saved.urls);
    } else {
      generateGrid(4); // Valor por defecto
    }
  } catch (e) {
    console.error('Error cargando estado guardado:', e);
    generateGrid(4);
  }
});

// Cambiar layout y mantener URLs
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const count = parseInt(btn.dataset.count);
    const currentInputs = Array.from(document.querySelectorAll('.input-overlay input'))
      .map(input => input.value);
    generateGrid(count, currentInputs);
  });
});

resetButton.onclick = () => {
  localStorage.removeItem('stream-wall');
  location.reload();
};

function generateGrid(count, savedUrls = []) {
  gridContainer.innerHTML = '';
  const cols = Math.ceil(Math.sqrt(count));
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let i = 0; i < count; i++) {
    const cell = document.createElement('div');
    cell.className = 'stream-cell';

    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '&#x2630;'; // Icono de menú (hamburguesa)
    dragHandle.title = 'Arrastrar para reordenar';
    cell.appendChild(dragHandle);

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cell-content-wrapper';

    const streamContainer = document.createElement('div');
    streamContainer.className = 'stream-content';

    const inputOverlay = document.createElement('div');
    inputOverlay.className = 'input-overlay';

    const input = document.createElement('input');
    input.placeholder = 'URL del stream...';
    if (savedUrls[i]) input.value = savedUrls[i];

    const loadBtn = document.createElement('button');
    loadBtn.textContent = '▶';

    const loadAndSave = () => {
      if (!input.value.trim()) {
        streamContainer.innerHTML = '<p class="error-msg">Introduce una URL válida</p>';
        return;
      }
      loadStream(input.value.trim(), streamContainer);
      saveCurrentState();
    };

    loadBtn.onclick = loadAndSave;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') loadAndSave();
    });
    input.addEventListener('input', saveCurrentState);

    inputOverlay.appendChild(input);
    inputOverlay.appendChild(loadBtn);
    contentWrapper.appendChild(streamContainer);
    contentWrapper.appendChild(inputOverlay);
    cell.appendChild(contentWrapper);
    gridContainer.appendChild(cell);

    if (savedUrls[i]) {
      loadStream(savedUrls[i], streamContainer);
    }
  }

  saveCurrentState();

  // Si ya existe una instancia de Sortable, la destruimos antes de crear una nueva
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  // Creamos la nueva instancia y la guardamos en la variable
  sortableInstance = new Sortable(gridContainer, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    handle: '.drag-handle', // Especificamos el mango de arrastre
    onStart: function () {
      document.body.classList.add('is-dragging');
    },
    onEnd: function () {
      document.body.classList.remove('is-dragging');
      saveCurrentState();
    }
  });
}

function saveCurrentState() {
  const currentCount = document.querySelectorAll('.stream-cell').length;
  const currentUrls = Array.from(document.querySelectorAll('.input-overlay input'))
    .map(input => input.value.trim());
  saveState(currentCount, currentUrls);
}

function saveState(count, urls) {
  localStorage.setItem('stream-wall', JSON.stringify({ count, urls }));
}

function loadStream(url, container) {
  container.innerHTML = '';
  if (!url) return;

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const id = extractYouTubeID(url);
    if (id) {
      const iframe = createStreamIframe(`https://www.youtube.com/embed/${id}?autoplay=1&mute=1`);
      container.appendChild(iframe);
    } else {
      container.innerHTML = '<p class="error-msg">URL de YouTube inválida</p>';
    }
  } else if (url.includes('twitch.tv')) {
    const channel = extractTwitchChannel(url);
    if (channel) {
      const parentDomain = location.hostname || 'localhost';
      const iframe = createStreamIframe(`https://player.twitch.tv/?channel=${channel}&parent=${parentDomain}&autoplay=true&muted=true`);
      container.appendChild(iframe);
    } else {
      container.innerHTML = '<p class="error-msg">URL de Twitch inválida</p>';
    }
  } else if (url.endsWith('.m3u8')) {
    const video = document.createElement('video');
    video.controls = true;
    video.autoplay = true;
    video.muted = true;
    video.setAttribute("playsinline", "");
    container.appendChild(video);
    loadHLS(url, video);
  } else {
    const iframe = createStreamIframe(url);
    container.appendChild(iframe);
  }
}

function createStreamIframe(src) {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.allowFullscreen = true;
  iframe.setAttribute("allow", "fullscreen; autoplay;");
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.frameBorder = '0';
  return iframe;
}

function extractYouTubeID(url) {
  const regex = /(?:youtube\.com\/.*v=|youtu\.be\/)([^&#?/]+)/;
  const match = url.match(regex);
  return match ? match[1] : '';
}

function extractTwitchChannel(url) {
  const match = url.match(/twitch\.tv\/([^/?]+)/);
  return match ? match[1] : '';
}

function loadHLS(url, video) {
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
  } else {
    video.outerHTML = '<p class="error-msg">Este navegador no soporta HLS</p>';
  }
}
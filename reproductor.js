class ReproductorPlaylist extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const template = document.getElementById('reproductor-template');
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.vincularEventos();
    this.initIndexedDB();
  }

  // --- INICIALIZACION DE BASE DE DATOS ---
  initIndexedDB() {
    const request = indexedDB.open('ReproductorDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('temas')) {
        const temasStore = db.createObjectStore('temas', { keyPath: 'id', autoIncrement: true });
        temasStore.createIndex('playlistId', 'playlistId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      this.db = event.target.result;
      this.cargarPlaylists();
    };
  }

  // --- LOGICA DE PLAYLISTS ---
  agregarPlaylist() {
    const nombre = prompt("Ingresa el nombre de la nueva Playlist:");
    if (!nombre || nombre.trim() === "") return;

    const autor = prompt("Ingresa el autor o creador:") || "Desconocido";
    const genero = prompt("Ingresa el genero musical:") || "Variado";

    const transaction = this.db.transaction(['playlists'], 'readwrite');
    const store = transaction.objectStore('playlists');
    
    store.add({ nombre: nombre.trim(), autor: autor.trim(), genero: genero.trim() }).onsuccess = () => {
      this.cargarPlaylists(); 
    };
  }

  cargarPlaylists() {
    const transaction = this.db.transaction(['playlists'], 'readonly');
    const store = transaction.objectStore('playlists');
    
    store.getAll().onsuccess = (event) => {
      const playlists = event.target.result;
      const shadow = this.shadowRoot;
      const listaUL = shadow.getElementById('playlist-list');
      const selector = shadow.getElementById('playlist-selector');
      
      listaUL.innerHTML = '';
      selector.innerHTML = '<option value="">Seleccionar Playlist...</option>';

      playlists.forEach(pl => {
        const li = document.createElement('li');
        
        const infoContenedor = document.createElement('div');
        infoContenedor.style.display = 'flex';
        infoContenedor.style.flexDirection = 'column';
        infoContenedor.style.flexGrow = '1';
        infoContenedor.style.cursor = 'pointer';
        infoContenedor.style.overflow = 'hidden';
        
        infoContenedor.innerHTML = `
          <span style="font-weight: bold; font-size: 1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pl.nombre}
          </span>
          <span style="font-size: 0.8em; color: #b3b3b3; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${pl.genero || 'Variado'} • ${pl.autor || 'Desconocido'}
          </span>
        `;
        
        infoContenedor.addEventListener('click', () => this.cargarTemas(pl.id, false));

        const btnPlay = document.createElement('button');
        btnPlay.textContent = '▶️';
        btnPlay.title = "Reproducir Playlist";
        btnPlay.style.fontSize = '1.5em';
        btnPlay.style.marginLeft = '10px';
        
        btnPlay.addEventListener('click', (e) => {
          e.stopPropagation();
          this.cargarTemas(pl.id, true);
        });

        li.appendChild(infoContenedor);
        li.appendChild(btnPlay);
        listaUL.appendChild(li);

        const option = document.createElement('option');
        option.value = pl.id;
        option.textContent = pl.nombre;
        selector.appendChild(option);
      });
      
      const ultima = localStorage.getItem('ultimaPlaylist');
      if (ultima && playlists.some(p => p.id === parseInt(ultima))) {
        this.cargarTemas(parseInt(ultima), false);
      }
    };
  }

  eliminarPlaylist() {
    if (!this.playlistActivaId) {
      alert("Selecciona una playlist de la lista antes de borrarla.");
      return;
    }

    const confirmacion = confirm("Estas seguro de eliminar esta playlist y sus canciones? Esta accion no se puede deshacer.");
    if (!confirmacion) return;

    const transaction = this.db.transaction(['playlists', 'temas'], 'readwrite');
    const storePlaylists = transaction.objectStore('playlists');
    const storeTemas = transaction.objectStore('temas');

    storePlaylists.delete(this.playlistActivaId);

    const indexTemas = storeTemas.index('playlistId');
    indexTemas.getAllKeys(this.playlistActivaId).onsuccess = (event) => {
      event.target.result.forEach(key => storeTemas.delete(key));
    };

    transaction.oncomplete = () => {
      const shadow = this.shadowRoot;
      this.playlistActivaId = null;
      this.temasActuales = [];
      shadow.getElementById('track-list').innerHTML = '';
      
      const audioPlayer = shadow.getElementById('audio-player');
      audioPlayer.pause();
      audioPlayer.src = '';
      
      shadow.getElementById('tema-display').value = '';
      shadow.getElementById('artista-display').value = '';
      shadow.getElementById('genero-display').value = '';
      shadow.getElementById('play-pause-btn').textContent = '▶';

      this.cargarPlaylists();
    };
  }
  
  editarPlaylist() {
    if (!this.playlistActivaId) {
      alert("Selecciona una playlist antes de editarla.");
      return;
    }

    const transaction = this.db.transaction(['playlists'], 'readwrite');
    const store = transaction.objectStore('playlists');
    
    store.get(this.playlistActivaId).onsuccess = (event) => {
      const playlist = event.target.result;
      if (!playlist) return;

      const nuevoNombre = prompt("Nuevo nombre de la Playlist:", playlist.nombre);
      if (!nuevoNombre || nuevoNombre.trim() === "") return;

      const nuevoAutor = prompt("Nuevo autor:", playlist.autor || "Desconocido");
      const nuevoGenero = prompt("Nuevo genero:", playlist.genero || "Variado");

      playlist.nombre = nuevoNombre.trim();
      playlist.autor = nuevoAutor.trim();
      playlist.genero = nuevoGenero.trim();

      store.put(playlist).onsuccess = () => this.cargarPlaylists();
    };
  }

  // --- LOGICA DE TEMAS ---
  procesarArchivos(files) { 
    if (files.length === 0) return;

    const shadow = this.shadowRoot;
    const playlistId = parseInt(shadow.getElementById('playlist-selector').value);

    if (!playlistId || isNaN(playlistId)) {
      alert("Selecciona una playlist en el menu desplegable primero."); 
      return;
    }

    const temasProcesados = [];
    for (let file of files) {
      const nombreSugerido = file.name.replace(/\.[^/.]+$/, "");
      
      let titulo = prompt(`Archivo: "${file.name}"\nIngresa el nombre de la cancion:`, nombreSugerido);
      if (titulo === null) continue; 
      if (titulo.trim() === "") titulo = nombreSugerido;

      let artista = prompt(`Ingresa el Artista para "${titulo}":`, "Desconocido");
      if (artista === null) artista = "Desconocido";

      let genero = prompt(`Ingresa el Genero para "${titulo}":`, "Variado");
      if (genero === null) genero = "Variado";

      temasProcesados.push({
        playlistId: playlistId,
        nombre: titulo.trim(),
        ruta: file,
        genero: genero.trim(),
        artista: artista.trim()
      });
    }

    if (temasProcesados.length === 0) return; 

    const transaction = this.db.transaction(['temas'], 'readwrite');
    const store = transaction.objectStore('temas');
    
    store.index('playlistId').getAll(playlistId).onsuccess = (event) => {
      const temasExistentes = event.target.result.map(t => t.nombre);
      let agregados = 0, duplicados = 0;

      temasProcesados.forEach(tema => {
        if (temasExistentes.includes(tema.nombre)) {
          duplicados++;
        } else {
          store.add(tema);
          agregados++;
        }
      });

      transaction.oncomplete = () => {
        if (agregados > 0) this.cargarTemas(playlistId);
        if (duplicados > 0) alert(`Se omitieron ${duplicados} canciones repetidas.`);
        shadow.getElementById('file-input').value = '';
      };
    };
  }
  
  cargarTemas(playlistId, autoPlay = false) {
    const transaction = this.db.transaction(['temas'], 'readonly');
    const store = transaction.objectStore('temas');
    
    store.index('playlistId').getAll(playlistId).onsuccess = (event) => {
      const temas = event.target.result;
      const shadow = this.shadowRoot;
      const trackList = shadow.getElementById('track-list');

      trackList.innerHTML = ''; 
      this.temasActuales = temas; 
      this.playlistActivaId = playlistId;

      if (temas.length === 0) {
        trackList.innerHTML = '<li style="color: #b3b3b3; padding: 10px;">No hay temas en esta playlist.</li>';
        if (autoPlay) alert("La playlist esta vacia. Agrega canciones primero.");
        return;
      }

      temas.forEach((tema, index) => {
        const li = document.createElement('li');
        li.dataset.busqueda = `${tema.nombre} ${tema.artista} ${tema.genero}`.toLowerCase();
        
        const infoContenedor = document.createElement('div');
        infoContenedor.style.display = 'flex';
        infoContenedor.style.flexDirection = 'column';
        infoContenedor.style.cursor = 'pointer';
        infoContenedor.style.overflow = 'hidden';
        infoContenedor.style.flexGrow = '1';

        infoContenedor.innerHTML = `
          <span style="font-weight: bold; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            🎵 ${tema.nombre}
          </span>
          <span style="font-size: 0.75em; color: #b3b3b3; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${tema.artista || 'Desconocido'} • ${tema.genero || 'Desconocido'}
          </span>
        `;
        
        infoContenedor.addEventListener('click', () => this.reproducirTema(index));

        const btnEliminar = document.createElement('button');
        btnEliminar.textContent = '❌'; 
        btnEliminar.style.fontSize = '1.1em';
        btnEliminar.addEventListener('click', (evento) => {
          evento.stopPropagation(); 
          this.eliminarTema(tema.id, playlistId);
        });

        li.appendChild(infoContenedor);
        li.appendChild(btnEliminar);
        trackList.appendChild(li);
      });

      if (autoPlay) this.reproducirTema(0);
    };
    
    localStorage.setItem('ultimaPlaylist', playlistId);
  }

  eliminarTema(idTema, playlistId) {
    const confirmacion = confirm("Estas seguro de eliminar esta cancion?");
    if (!confirmacion) return;

    const transaction = this.db.transaction(['temas'], 'readwrite');
    transaction.objectStore('temas').delete(idTema).onsuccess = () => {
      this.cargarTemas(playlistId); 
    };
  }

  editarTema() {
    if (this.indiceActual === undefined || !this.temasActuales || !this.temasActuales[this.indiceActual]) {
      alert("Dale a Play a una cancion de la lista para poder editarla.");
      return;
    }

    const tema = this.temasActuales[this.indiceActual];
    const playlistId = this.playlistActivaId;

    const nuevoNombre = prompt("Nombre de la cancion:", tema.nombre);
    if (!nuevoNombre || nuevoNombre.trim() === "") return;

    const nuevoArtista = prompt("Artista:", tema.artista || "Desconocido");
    const nuevoGenero = prompt("Genero:", tema.genero || "Desconocido");

    const transaction = this.db.transaction(['temas'], 'readwrite');
    
    tema.nombre = nuevoNombre.trim();
    tema.artista = nuevoArtista.trim();
    tema.genero = nuevoGenero.trim();

    transaction.objectStore('temas').put(tema).onsuccess = () => {
      this.cargarTemas(playlistId); 
      const shadow = this.shadowRoot;
      shadow.getElementById('tema-display').value = tema.nombre;
      shadow.getElementById('artista-display').value = tema.artista;
      shadow.getElementById('genero-display').value = tema.genero;
    };
  }

  // --- LOGICA DEL REPRODUCTOR ---
  reproducirTema(index) {
    const shadow = this.shadowRoot;
    const tema = this.temasActuales[index];
    this.indiceActual = index; 

    const audioPlayer = shadow.getElementById('audio-player');
    
    if (audioPlayer.src) URL.revokeObjectURL(audioPlayer.src);

    const fileURL = URL.createObjectURL(tema.ruta);
    audioPlayer.src = fileURL;
    audioPlayer.play();
    shadow.getElementById('play-pause-btn').textContent = '⏸';

    shadow.getElementById('tema-display').value = tema.nombre;
    shadow.getElementById('artista-display').value = tema.artista;
    shadow.getElementById('genero-display').value = tema.genero;
  }

  reproducirSiguiente() {
    if (!this.temasActuales || this.temasActuales.length === 0) return;
    this.indiceActual++;
    if (this.indiceActual >= this.temasActuales.length) this.indiceActual = 0; 
    this.reproducirTema(this.indiceActual);
  }

  reproducirAnterior() {
    if (!this.temasActuales || this.temasActuales.length === 0) return;
    this.indiceActual--;
    if (this.indiceActual < 0) this.indiceActual = this.temasActuales.length - 1; 
    this.reproducirTema(this.indiceActual);
  }

  // --- VINCULACION DE EVENTOS ---
  vincularEventos() {
    const shadow = this.shadowRoot;
    
    shadow.getElementById('add-playlist-btn').addEventListener('click', () => this.agregarPlaylist());
    shadow.getElementById('delete-playlist-btn').addEventListener('click', () => this.eliminarPlaylist());
    shadow.getElementById('edit-playlist-btn').addEventListener('click', () => this.editarPlaylist());
    shadow.getElementById('trigger-file-btn').addEventListener('click', () => shadow.getElementById('file-input').click());
    shadow.getElementById('edit-tema-btn').addEventListener('click', () => this.editarTema());

    shadow.getElementById('file-input').addEventListener('change', (e) => this.procesarArchivos(e.target.files));

    const audio = shadow.getElementById('audio-player');
    const playPauseBtn = shadow.getElementById('play-pause-btn');
    const repeatBtn = shadow.getElementById('repeat-btn');
    this.isRepetir = false;

    playPauseBtn.addEventListener('click', () => {
      if (!audio.src) return; 
      if (audio.paused) {
        audio.play();
        playPauseBtn.textContent = '⏸'; 
      } else {
        audio.pause();
        playPauseBtn.textContent = '▶'; 
      }
    });

    shadow.getElementById('stop-btn').addEventListener('click', () => {
      if (!audio.src) return;
      audio.currentTime = 0; 
      audio.pause(); 
      playPauseBtn.textContent = '▶'; 
    });

    repeatBtn.addEventListener('click', () => {
      this.isRepetir = !this.isRepetir; 
      if (this.isRepetir) {
        repeatBtn.classList.add('activo');
        repeatBtn.textContent = '🔂'; 
      } else {
        repeatBtn.classList.remove('activo');
        repeatBtn.textContent = '🔁'; 
      }
    });

    shadow.getElementById('prev-btn').addEventListener('click', () => this.reproducirAnterior());
    shadow.getElementById('next-btn').addEventListener('click', () => this.reproducirSiguiente());
    
    audio.addEventListener('ended', () => {
      if (this.isRepetir) {
        audio.currentTime = 0;
        audio.play();
      } else {
        this.reproducirSiguiente();
      }
    });

    const progressBar = shadow.getElementById('progress-bar');
    const currentTimeDisplay = shadow.getElementById('current-time');
    const totalTimeDisplay = shadow.getElementById('total-time');

    const formatTime = (time) => {
      if (isNaN(time)) return "0:00";
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; 
    };

    audio.addEventListener('loadedmetadata', () => {
      totalTimeDisplay.textContent = formatTime(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        progressBar.value = (audio.currentTime / audio.duration) * 100;
        currentTimeDisplay.textContent = formatTime(audio.currentTime);
      }
    });

    progressBar.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration;
    });

    const volumeBar = shadow.getElementById('volume-bar');
    const muteBtn = shadow.getElementById('mute-btn');

    volumeBar.addEventListener('input', (e) => {
      audio.volume = e.target.value;
      muteBtn.textContent = audio.volume == 0 ? '🔇' : '🔊';
    });
    
    muteBtn.addEventListener('click', () => {
      audio.muted = !audio.muted;
      muteBtn.textContent = audio.muted ? '🔇' : (audio.volume == 0 ? '🔇' : '🔊');
    });

    shadow.getElementById('search-playlist').addEventListener('input', (e) => {
      const termino = e.target.value.toLowerCase();
      shadow.querySelectorAll('#playlist-list li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(termino) ? 'flex' : 'none'; 
      });
    });

    shadow.getElementById('search-tema').addEventListener('input', (e) => {
      const termino = e.target.value.toLowerCase().trim();
      shadow.querySelectorAll('#track-list li').forEach(li => {
        li.style.display = li.dataset.busqueda.includes(termino) ? 'flex' : 'none'; 
      });
    });
  }
}

customElements.define('reproductor-playlist', ReproductorPlaylist);
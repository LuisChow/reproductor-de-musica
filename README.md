# Reproductor de Música y Gestor de Playlists
> **Demo en vivo:** https://luischow.github.io/reproductor-de-musica/

Aplicación web para reproducir música y administrar playlists, construida en JavaScript puro como un **Web Component** reutilizable. Permite crear playlists, agregar canciones desde el equipo del usuario y reproducirlas, con toda la información guardada localmente mediante IndexedDB.

## Características

- **Gestión de playlists** — crear, editar, eliminar y buscar playlists, cada una con nombre, autor y género.
- **Gestión de canciones** — agregar temas a una playlist cargando archivos de audio, además de editarlos y eliminarlos.
- **Reproductor completo** — reproducir/pausar, canción siguiente y anterior, barra de progreso, tiempo transcurrido y repetición automática al terminar.
- **Metadatos** — visualización del tema, artista y género de la canción en reproducción.
- **Persistencia local** — playlists y canciones se guardan en IndexedDB, por lo que no se pierden al recargar la página.

## Stack tecnológico

- **JavaScript (ES6+)**
- **Web Components** — el reproductor está encapsulado en un *custom element* (`<reproductor-playlist>`) con **Shadow DOM** y `<template>`, lo que lo hace reutilizable y aislado del resto de la página.
- **IndexedDB** — base de datos del navegador para la persistencia de playlists y canciones.
- **HTML5 Audio** — reproducción mediante el elemento `<audio>` nativo.
- **CSS3** — estilos de la interfaz.

## Arquitectura

Toda la lógica vive en la clase `ReproductorPlaylist`, que extiende `HTMLElement`:

- El componente crea su propio **Shadow DOM** a partir de un `<template>`, encapsulando estructura y estilos.
- IndexedDB se organiza en dos *object stores*: `playlists` y `temas` (canciones), enlazados por un índice `playlistId`.
- Los archivos de audio cargados por el usuario se reproducen generando URLs temporales con `URL.createObjectURL`, liberadas con `revokeObjectURL` para no acumular memoria.

## Uso

No requiere instalación ni dependencias.

1. Clona el repositorio.
2. Abre `index.html` en un navegador moderno.

> Para evitar restricciones del navegador al cargar recursos locales, se recomienda servir la carpeta con un servidor estático (por ejemplo, la extensión *Live Server* de VS Code).

## Estructura del proyecto

```
.
├── index.html         # Estructura y template del Web Component
├── reproductor.css    # Estilos del reproductor
├── reproductor.js     # Clase ReproductorPlaylist (lógica completa)
└── Canciones/         # Archivos de audio de ejemplo
```

## Autor

**Luis Fernando Chunwa Chow Cheung**
Estudiante de Ingeniería en Computación — Universidad Rafael Urdaneta
GitHub: [@LuisChow](https://github.com/LuisChow)

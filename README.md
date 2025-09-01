# Stream Wall

Una sencilla pero potente aplicación web para visualizar múltiples streams de vídeo en una parrilla personalizable. Soporta YouTube, Twitch, HLS (.m3u8) y URLs genéricas que puedan ser embebidas en un `<iframe>`.

## Características

-   **Layouts Predefinidos:** Cambia fácilmente entre parrillas de 1, 4, 9 o 16 streams.
-   **Reordenación por Arrastre:** Arrastra y suelta los reproductores para organizar tu vista ideal.
-   **Persistencia de Sesión:** Tu configuración (número de streams y URLs) se guarda automáticamente en tu navegador.
-   **Soporte Multi-plataforma:**
    -   YouTube
    -   Twitch
    -   HLS (.m3u8)
    -   Cualquier otra URL que permita ser embebida.

## Uso

Este es un proyecto puramente estático (HTML, CSS, JavaScript) y no requiere un proceso de construcción ni dependencias de Node.js.

### Opción 1: Abrir Directamente (Recomendado)

1.  Clona o descarga este repositorio.
2.  Abre el archivo `index.html` en tu navegador web preferido (Chrome, Firefox, etc.).

### Opción 2: Usar un Servidor Local

Si prefieres servir los archivos desde un servidor local (útil para evitar posibles problemas con políticas de navegador `file:///`):

1.  Asegúrate de tener Node.js instalado.
2.  Instala un servidor estático simple globalmente:
    ```bash
    npm install -g serve
    ```
3.  Navega hasta el directorio del proyecto en tu terminal.
4.  Inicia el servidor:
    ```bash
    serve .
    ```
5.  Abre la URL que te indique la terminal (normalmente `http://localhost:3000`).

## Licencia

MIT
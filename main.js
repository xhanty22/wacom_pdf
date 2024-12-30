const { app, BrowserWindow, screen } = require("electron");
const path = require("path");

// Habilitar recarga automática
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
});

let mainWindow;

app.whenReady().then(() => {
  // Obtén todas las pantallas conectadas
  const displays = screen.getAllDisplays();

  // Busca la pantalla que corresponde a la Wacom (ajusta las propiedades según sea necesario)
  const wacomDisplay = displays.find((display) => {
    // Ajusta las propiedades según las características de tu Wacom
    return display.label.includes("Wacom");
  });

  // Si no encuentra la Wacom, usará la pantalla principal
  const displayToUse = wacomDisplay || screen.getPrimaryDisplay();

  // Crea la ventana en la posición de la pantalla detectada
  mainWindow = new BrowserWindow({
    autoHideMenuBar: false, // Oculta la barra de menú
    x: displayToUse.bounds.x, // Coordenada X de la pantalla
    y: displayToUse.bounds.y, // Coordenada Y de la pantalla
    width: displayToUse.bounds.width,
    height: displayToUse.bounds.height,
  });

  // FullScreen
  mainWindow.setFullScreen(true);

  // Carga el archivo HTML principal
  mainWindow.loadFile("firma.html");

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

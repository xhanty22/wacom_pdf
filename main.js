const { app, BrowserWindow, screen, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

let mainWindow;
let isMonitoring = false;
let isClosing = false; // Flag para evitar múltiples cierres

// Valida si la tablet Wacom está conectada
function isTabletConnected() {
  const displays = screen.getAllDisplays();
  const wacomDisplay = displays.find(
    (display) => display.size.width === 1280 && display.size.height === 800
  );
  return !!wacomDisplay;
}

// Muestra mensaje de error y cierra la app
function handleTabletDisconnected() {
  // Evitar múltiples ejecuciones
  if (isClosing) return;
  isClosing = true;

  // Remover listeners para evitar que se disparen más eventos
  screen.removeAllListeners('display-added');
  screen.removeAllListeners('display-removed');
  screen.removeAllListeners('display-metrics-changed');
  isMonitoring = false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showMessageBoxSync(mainWindow, {
      type: "error",
      title: "Tablet desconectada",
      message: "No se detectó una tablet conectada.",
      detail: "La aplicación se cerrará. Por favor, conecte la tablet y abra la aplicación nuevamente.",
      buttons: ["Aceptar"]
    });
  }
  app.quit();
}

// Configura listeners para monitorear cambios en las pantallas
function setupDisplayMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;

  // Detecta cuando se agrega o remueve una pantalla
  screen.on('display-added', () => {
    // Si se agrega una pantalla, verificar si es la tablet
    // No hacemos nada si se conecta, solo monitoreamos desconexión
  });

  screen.on('display-removed', () => {
    // Si se remueve una pantalla, verificar si era la tablet
    if (!isClosing && !isTabletConnected() && mainWindow && !mainWindow.isDestroyed()) {
      handleTabletDisconnected();
    }
  });

  // Detecta cambios en métricas de pantallas (movimiento, cambio de resolución, etc.)
  screen.on('display-metrics-changed', () => {
    // Verificar si la tablet sigue conectada después del cambio
    if (!isClosing && !isTabletConnected() && mainWindow && !mainWindow.isDestroyed()) {
      handleTabletDisconnected();
    }
  });
}

function createMainWindow() {
  // Valida que la tablet esté conectada antes de crear la ventana
  if (!isTabletConnected()) {
    dialog.showMessageBoxSync({
      type: "error",
      title: "Tablet no detectada",
      message: "No se detectó una tablet conectada.",
      detail: "Por favor, conecte una tablet y abra la aplicación manualmente.",
      buttons: ["Aceptar"]
    });
    app.quit();
    return;
  }

  // Detecta pantallas
  const displays = screen.getAllDisplays();

  // Si quieres detectar una Wacom de 1280x800
  const wacomDisplay = displays.find(
    (display) => display.size.width === 1280 && display.size.height === 800
  );

  const displayToUse = wacomDisplay || screen.getPrimaryDisplay();

  // Crea ventana en la pantalla detectada
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    x: displayToUse.bounds.x,
    y: displayToUse.bounds.y,
    title: "Complementos Humanos",
    width: displayToUse.bounds.width,
    height: displayToUse.bounds.height,
    icon: path.join(__dirname, "assets/icon.ico"),
    webPreferences: {
      // añade preload si más adelante lo necesitas
      contextIsolation: true
    }
  });

  mainWindow.setFullScreen(true);
  mainWindow.loadFile("index.html");

  // Inicia el monitoreo de pantallas después de crear la ventana
  setupDisplayMonitoring();

  // mainWindow.webContents.openDevTools();


  // ---------- Auto-Update SOLO en build empaquetada ----------
  if (app.isPackaged) {
    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Consulta y (si hay) descarga + notifica
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on("checking-for-update", () => log.info("checking-for-update"));
    autoUpdater.on("update-available", (info) => log.info("update-available", info.version));
    autoUpdater.on("update-not-available", () => log.info("update-not-available"));
    autoUpdater.on("download-progress", (p) => log.info(`progress ${Math.round(p.percent)}%`));
    autoUpdater.on("error", (err) => log.error("updater error", err));

    autoUpdater.on("update-downloaded", () => {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "question",
        buttons: ["Reiniciar ahora", "Luego"],
        defaultId: 0,
        message: "Actualización lista",
        detail: "Se instalará al reiniciar la aplicación."
      });
      if (choice === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  }
  // -----------------------------------------------------------
}

app.whenReady().then(() => {

  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,       // arranca oculto si quieres
    });
  }

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Valida la tablet también cuando se activa manualmente
      if (isTabletConnected()) {
        createMainWindow();
      } else {
        dialog.showMessageBoxSync({
          type: "error",
          title: "Tablet no detectada",
          message: "No se detectó una tablet conectada.",
          detail: "Por favor, conecte una tablet e intente nuevamente.",
          buttons: ["Aceptar"]
        });
        app.quit();
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

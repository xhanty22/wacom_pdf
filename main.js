const { app, BrowserWindow, screen, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");

let mainWindow;

function createMainWindow() {
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

  mainWindow.webContents.openDevTools();


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
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

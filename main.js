const { app, BrowserWindow, screen, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const os = require("os");
const fs = require("fs");

// ============================================================================
// CONFIGURACIÓN PRINCIPAL
// ============================================================================
const VALIDATE_TABLET_CONNECTION = true; // Activa/desactiva validación de tablet Wacom (1280x800)

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================
let mainWindow;
let isMonitoring = false;
let isClosing = false;
let updateDownloaded = false;
let updaterListenersSetup = false;
let periodicCheckInterval = null;
let userCheckInterval = null;
let appIsRunning = false; // Diferencia entre inicio inicial vs desconexión durante ejecución
let metricsChangedTimeout = null;
let isManualStart = true; // true = apertura manual, false = reinicio automático
let initialUsername = null;
let focusLossTimeout = null;
let closedByUserSwitch = false;

// Constantes de configuración
const PERIODIC_CHECK_INTERVAL = 15000; // Intervalo verificación periódica (desactivada actualmente)
const METRICS_CHANGE_DEBOUNCE = 5000; // Delay antes de verificar después de display-metrics-changed
const USER_CHECK_INTERVAL = 3000; // Intervalo verificación cambio de usuario
const FOCUS_LOSS_TIMEOUT = 10000; // Tiempo sin foco para asumir cambio de usuario
const USER_SWITCH_FLAG_FILE = path.join(app.getPath('userData'), '.user_switch_flag');

// ============================================================================
// FUNCIONES DE UTILIDAD
// ============================================================================

// Obtiene el usuario actual de Windows
function getCurrentUsername() {
  try {
    return process.env.USERNAME || os.userInfo().username || null;
  } catch (error) {
    log.error("Error obteniendo usuario:", error);
    return null;
  }
}

// Valida si la tablet Wacom está conectada (busca pantalla 1280x800)
function isTabletConnected() {
  const displays = screen.getAllDisplays();
  const wacomDisplay = displays.find(
    (display) => display.size.width === 1280 && display.size.height === 800
  );
  return !!wacomDisplay;
}

// Gestión de flag persistente para cambio de usuario (evita mostrar mensajes confusos)
function setUserSwitchFlag() {
  try {
    fs.writeFileSync(USER_SWITCH_FLAG_FILE, '1', 'utf8');
  } catch (error) {
    log.error('Error guardando flag de cambio de usuario:', error);
  }
}

function getUserSwitchFlag() {
  try {
    if (fs.existsSync(USER_SWITCH_FLAG_FILE)) {
      const content = fs.readFileSync(USER_SWITCH_FLAG_FILE, 'utf8');
      return content.trim() === '1';
    }
  } catch (error) {
    log.error('Error leyendo flag de cambio de usuario:', error);
  }
  return false;
}

function clearUserSwitchFlag() {
  try {
    if (fs.existsSync(USER_SWITCH_FLAG_FILE)) {
      fs.unlinkSync(USER_SWITCH_FLAG_FILE);
    }
  } catch (error) {
    log.error('Error eliminando flag de cambio de usuario:', error);
  }
}

// ============================================================================
// GESTIÓN DE CIERRE DE APLICACIÓN
// ============================================================================

// Cierra la app sin mensaje cuando se detecta cambio de usuario
function closeAppSilently() {
  if (isClosing) return;
  isClosing = true;

  // Guardar flag persistente para evitar mensajes al volver
  setUserSwitchFlag();
  closedByUserSwitch = true;

  // Limpiar todos los intervalos y timeouts
  if (periodicCheckInterval) clearInterval(periodicCheckInterval);
  if (userCheckInterval) clearInterval(userCheckInterval);
  if (metricsChangedTimeout) clearTimeout(metricsChangedTimeout);
  if (focusLossTimeout) clearTimeout(focusLossTimeout);
  
  periodicCheckInterval = null;
  userCheckInterval = null;
  metricsChangedTimeout = null;
  focusLossTimeout = null;

  // Remover listeners de pantallas
  screen.removeAllListeners('display-added');
  screen.removeAllListeners('display-removed');
  screen.removeAllListeners('display-metrics-changed');
  isMonitoring = false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  app.quit();
}

// Cierra la app cuando se desconecta físicamente la tablet
// No reinicia, no monitorea - el usuario debe abrirla manualmente al reconectar
function handleTabletDisconnected() {
  if (isClosing) return;
  isClosing = true;

  // Limpiar todos los intervalos y timeouts
  if (periodicCheckInterval) clearInterval(periodicCheckInterval);
  if (userCheckInterval) clearInterval(userCheckInterval);
  if (metricsChangedTimeout) clearTimeout(metricsChangedTimeout);
  if (focusLossTimeout) clearTimeout(focusLossTimeout);
  
  periodicCheckInterval = null;
  userCheckInterval = null;
  metricsChangedTimeout = null;
  focusLossTimeout = null;

  screen.removeAllListeners('display-added');
  screen.removeAllListeners('display-removed');
  screen.removeAllListeners('display-metrics-changed');
  isMonitoring = false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }

  app.quit();
}

// Verificación periódica desactivada - solo se valida al abrir la app manualmente
function startPeriodicTabletCheck() {
  // Desactivado: no monitoreamos constantemente para evitar consumo de recursos
}

// ============================================================================
// MONITOREO DE PANTALLAS Y CAMBIOS DE USUARIO
// ============================================================================

// Configura listeners para detectar desconexión de tablet y cambio de usuario
function setupDisplayMonitoring() {
  if (isMonitoring) return;
  isMonitoring = true;

  // Cuando se remueve una pantalla - verificar si era la tablet
  screen.on('display-removed', () => {
    if (VALIDATE_TABLET_CONNECTION && !isClosing && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        if (!isTabletConnected() && !isClosing && mainWindow && !mainWindow.isDestroyed()) {
          handleTabletDisconnected();
        }
      }, 500);
    }
  });

  // display-metrics-changed se dispara durante cambio de usuario
  // Usar debounce para evitar falsos positivos
  screen.on('display-metrics-changed', () => {
    if (VALIDATE_TABLET_CONNECTION && !isClosing && mainWindow && !mainWindow.isDestroyed()) {
      if (metricsChangedTimeout) {
        clearTimeout(metricsChangedTimeout);
        metricsChangedTimeout = null;
      }

      metricsChangedTimeout = setTimeout(() => {
        metricsChangedTimeout = null;
        if (!isTabletConnected() && !isClosing && mainWindow && !mainWindow.isDestroyed()) {
          closeAppSilently();
        }
      }, METRICS_CHANGE_DEBOUNCE);
    }
  });

  startPeriodicTabletCheck();
  startUserCheck();
}

// Verifica periódicamente si cambió el usuario de Windows
function startUserCheck() {
  if (process.platform !== 'win32') return;
  
  if (userCheckInterval) {
    clearInterval(userCheckInterval);
  }

  if (!initialUsername) {
    initialUsername = getCurrentUsername();
    log.info(`Usuario inicial detectado: ${initialUsername}`);
  }

  userCheckInterval = setInterval(() => {
    if (isClosing || !mainWindow || mainWindow.isDestroyed()) {
      return;
    }

    const currentUser = getCurrentUsername();
    if (currentUser && initialUsername && currentUser !== initialUsername) {
      log.info(`Cambio de usuario detectado: ${initialUsername} -> ${currentUser}. Cerrando aplicación.`);
      closeAppSilently();
    }
  }, USER_CHECK_INTERVAL);
}

// Detecta cambio de usuario mediante pérdida de foco permanente
function setupFocusMonitoring() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  // Si pierde foco y no lo recupera en X segundos → cambio de usuario
  mainWindow.on('blur', () => {
    if (focusLossTimeout) {
      clearTimeout(focusLossTimeout);
      focusLossTimeout = null;
    }

    focusLossTimeout = setTimeout(() => {
      if (!isClosing && mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isFocused() && !mainWindow.isVisible()) {
          log.info('Pérdida de foco permanente detectada. Probable cambio de usuario. Cerrando aplicación.');
          closeAppSilently();
        }
      }
      focusLossTimeout = null;
    }, FOCUS_LOSS_TIMEOUT);
  });

  mainWindow.on('focus', () => {
    if (focusLossTimeout) {
      clearTimeout(focusLossTimeout);
      focusLossTimeout = null;
    }
  });

  // Si la ventana se oculta sin minimizar → cambio de usuario
  mainWindow.on('hide', () => {
    if (!mainWindow.isMinimized()) {
      setTimeout(() => {
        if (!isClosing && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible() && !mainWindow.isMinimized()) {
          log.info('Ventana oculta sin minimizar. Probable cambio de usuario. Cerrando aplicación.');
          closeAppSilently();
        }
      }, 2000);
    }
  });
}

// Configura y verifica actualizaciones antes de crear la ventana
function setupAutoUpdater() {
  return new Promise((resolve) => {
    if (!app.isPackaged) {
      // Si no está empaquetada, no hay actualizaciones que verificar
      resolve();
      return;
    }

    log.transports.file.level = "info";
    autoUpdater.logger = log;

    // Configurar listeners solo una vez
    if (!updaterListenersSetup) {
      updaterListenersSetup = true;

      // Eventos del auto-updater
      autoUpdater.on("checking-for-update", () => log.info("checking-for-update"));
      autoUpdater.on("update-available", (info) => log.info("update-available", info.version));
      autoUpdater.on("download-progress", (p) => log.info(`progress ${Math.round(p.percent)}%`));
      autoUpdater.on("error", (err) => {
        log.error("updater error", err);
      });

      autoUpdater.on("update-downloaded", () => {
        log.info("update-downloaded");
        updateDownloaded = true;
        // Si la ventana ya existe, mostrar el diálogo inmediatamente
        if (mainWindow && !mainWindow.isDestroyed()) {
          showUpdateDialog();
        }
      });
    }

    // Si ya hay una actualización descargada, resolver inmediatamente
    if (updateDownloaded) {
      resolve();
      return;
    }

    let resolved = false;
    let timeout;

    const checkResolve = () => {
      if (!resolved) {
        resolved = true;
        if (timeout) clearTimeout(timeout);
        autoUpdater.removeListener("update-not-available", onUpdateNotAvailable);
        resolve();
      }
    };

    // Listener temporal para esta verificación específica
    const onUpdateNotAvailable = () => {
      log.info("update-not-available");
      checkResolve();
    };

    autoUpdater.once("update-not-available", onUpdateNotAvailable);

    // Timeout de seguridad: si no hay respuesta en 3 segundos, continuar
    timeout = setTimeout(() => {
      checkResolve();
    }, 3000);

    // Consulta y (si hay) descarga + notifica
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.error("Error checking for updates", err);
      checkResolve();
    });
  });
}

function showUpdateDialog() {
  if (mainWindow && !mainWindow.isDestroyed()) {
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
  }
}

// ============================================================================
// CREACIÓN Y GESTIÓN DE VENTANA PRINCIPAL
// ============================================================================

// Valida tablet y crea ventana. Maneja diferentes escenarios:
// - Apertura manual sin tablet → muestra mensaje
// - Cambio de usuario → cierra sin mensaje
// - Desconexión física → cierra sin mensaje
function createMainWindow() {
  const wasClosedByUserSwitch = getUserSwitchFlag();
  
  if (VALIDATE_TABLET_CONNECTION && !isTabletConnected()) {
    // Si fue cambio de usuario o reinicio automático → cerrar sin mensaje
    if (wasClosedByUserSwitch || !isManualStart) {
      if (wasClosedByUserSwitch) {
        clearUserSwitchFlag();
        closedByUserSwitch = false;
      }
      app.quit();
      return;
    }

    // Solo en apertura manual real → mostrar mensaje después de delay
    if (isManualStart && !appIsRunning) {
      setTimeout(() => {
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
        createMainWindowInternal();
      }, 3000);
      return;
    }
    
    app.quit();
    return;
  }

  // Tablet detectada → crear ventana normalmente
  if (wasClosedByUserSwitch) {
    clearUserSwitchFlag();
  }
  closedByUserSwitch = false;
  createMainWindowInternal();
}

// Crea la ventana principal en la pantalla de la tablet o pantalla primaria
function createMainWindowInternal() {
  const displays = screen.getAllDisplays();
  const wacomDisplay = displays.find(
    (display) => display.size.width === 1280 && display.size.height === 800
  );
  const displayToUse = wacomDisplay || screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    x: displayToUse.bounds.x,
    y: displayToUse.bounds.y,
    title: "Complementos Humanos",
    width: displayToUse.bounds.width,
    height: displayToUse.bounds.height,
    icon: path.join(__dirname, "assets/icon.ico"),
    webPreferences: {
      contextIsolation: true
    }
  });

  mainWindow.setFullScreen(true);
  mainWindow.loadFile("index.html");

  appIsRunning = true;
  isManualStart = false;
  
  if (!initialUsername && process.platform === 'win32') {
    initialUsername = getCurrentUsername();
    log.info(`Usuario inicial guardado: ${initialUsername}`);
  }

  setupFocusMonitoring();

  if (VALIDATE_TABLET_CONNECTION) {
    setupDisplayMonitoring();
  }

  //mainWindow.webContents.openDevTools();

  if (app.isPackaged && updateDownloaded) {
    showUpdateDialog();
  }
}

// ============================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================================

function focusMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.show();
  }
}

// Bloqueo de instancia única - evita múltiples instancias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
  });
}

app.whenReady().then(async () => {
  // Configurar inicio automático en Windows
  if (app.isPackaged && process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
    });
  }

  await setupAutoUpdater();
  createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await setupAutoUpdater();
      
      if (VALIDATE_TABLET_CONNECTION) {
        if (isTabletConnected()) {
          createMainWindow();
        } else {
          const wasClosedByUserSwitch = getUserSwitchFlag();
          // Solo mostrar mensaje si es apertura manual (no cambio de usuario)
          if (!wasClosedByUserSwitch && isManualStart) {
            dialog.showMessageBoxSync({
              type: "error",
              title: "Tablet no detectada",
              message: "No se detectó una tablet conectada.",
              detail: "Por favor, conecte una tablet e intente nuevamente.",
              buttons: ["Aceptar"]
            });
          } else {
            if (wasClosedByUserSwitch) {
              clearUserSwitchFlag();
            }
          }
          closedByUserSwitch = false;
          app.quit();
        }
      } else {
        createMainWindow();
      }
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

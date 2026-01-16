const { app, BrowserWindow, screen, dialog, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const os = require("os");
const fs = require("fs");

// Leer versión del package.json
const packageJson = require("./package.json");
const APP_VERSION = packageJson.version;

// ============================================================================
// CONFIGURACIÓN DE VARIABLES DE ENTORNO
// ============================================================================
let appConfig = {};
let envFile = '';

// Lógica de carga de configuración
let isDevelopment;

if (!app.isPackaged) {
  // No empaquetado → siempre desarrollo (ignorar app.config.json si existe)
  isDevelopment = true;
  envFile = 'config.development.json';
} else {
  // Empaquetado → intentar cargar app.config.json primero (si existe, fue copiado durante el build)
  const appConfigPath = path.join(__dirname, 'app.config.json');
  if (fs.existsSync(appConfigPath)) {
    try {
      appConfig = require('./app.config.json');
      envFile = 'app.config.json';
    } catch (error) {
      log.error(`Error leyendo app.config.json:`, error);
    }
  }
  
  // Si no existe app.config.json o no se pudo cargar, usar la lógica de detección por appId
  if (!appConfig || Object.keys(appConfig).length === 0) {
    const currentAppId = packageJson.build?.appId || '';
    isDevelopment = currentAppId.includes('_stage');
    envFile = isDevelopment ? 'config.development.json' : 'config.production.json';
  }
}

// Si aún no hay configuración, cargar desde el archivo detectado
if (!appConfig || Object.keys(appConfig).length === 0) {
  try {
    appConfig = require(`./${envFile}`);
  } catch (error) {
    log.error(`Error cargando configuración desde ${envFile}:`, error);
    // Marcar error para mostrar mensaje cuando app esté lista
    app.once('ready', () => {
      dialog.showMessageBoxSync({
        type: "error",
        title: "Error de Configuración",
        message: `No se pudo cargar la configuración desde ${envFile}.`,
        detail: error.message || "La aplicación no puede continuar sin la configuración.",
        buttons: ["Aceptar"]
      });
      app.quit();
    });
    appConfig = null;
  }
}

// Validar que la configuración tenga los campos necesarios (sin valores por defecto)
if (appConfig && Object.keys(appConfig).length > 0) {
  if (!appConfig.socket || !appConfig.socket.ip) {
    log.error(`Error: La configuración en ${envFile || 'app.config.json'} no tiene socket.ip definido`);
    // Marcar error para mostrar mensaje cuando app esté lista
    app.once('ready', () => {
      dialog.showMessageBoxSync({
        type: "error",
        title: "Error de Configuración",
        message: `La configuración en ${envFile || 'app.config.json'} no tiene socket.ip definido.`,
        detail: "La aplicación no puede continuar sin la configuración correcta.",
        buttons: ["Aceptar"]
      });
      app.quit();
    });
    // No continuar con la inicialización
    appConfig = null;
  }
} else {
  log.error(`Error: No se pudo cargar ninguna configuración`);
  app.once('ready', () => {
    dialog.showMessageBoxSync({
      type: "error",
      title: "Error de Configuración",
      message: `No se pudo cargar la configuración de la aplicación.`,
      detail: "La aplicación no puede continuar sin la configuración.",
      buttons: ["Aceptar"]
    });
    app.quit();
  });
  appConfig = null;
}

// Configurar URL de actualizaciones
if (appConfig && app.isPackaged && appConfig.updateUrl) {
  autoUpdater.setFeedURL({
    provider: 'generic',
    url: appConfig.updateUrl
  });
}

// ============================================================================
// CONFIGURACIÓN PRINCIPAL
// ============================================================================
const VALIDATE_TABLET_CONNECTION = false;
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
        // Reiniciar automáticamente sin diálogo
        log.info("Reiniciando aplicación para instalar actualización...");
        setTimeout(() => {
          autoUpdater.quitAndInstall();
        }, 1000); // Pequeño delay para asegurar que todo esté listo
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


// ============================================================================
// CREACIÓN Y GESTIÓN DE VENTANA PRINCIPAL
// ============================================================================

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
    frame: false,
    fullscreen: true,
    kiosk: true,
    focusable: true,
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

  // Inyectar versión y configuración después de que se carga el HTML
  mainWindow.webContents.once('did-finish-load', () => {
    if (!appConfig) {
      log.error('No hay configuración disponible para inyectar');
      return;
    }

    mainWindow.webContents.executeJavaScript(`
      const versionElement = document.querySelector('.version-indicator__text');
      if (versionElement) {
        versionElement.textContent = 'v${APP_VERSION}';
      }
      
      // Exponer configuración al renderer (SOLO desde archivos de configuración, sin valores por defecto)
      window.appConfig = ${JSON.stringify(appConfig)};
    `).catch(err => log.error('Error inyectando versión/config:', err));
  });

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

  // Si hay actualización pendiente al iniciar, reiniciar automáticamente
  if (app.isPackaged && updateDownloaded) {
    log.info("Actualización pendiente detectada al iniciar, reiniciando...");
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000); // Delay para que la ventana se cargue completamente
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
  // Si no hay configuración válida, no continuar
  if (!appConfig) {
    return; // El mensaje de error ya se mostró en el catch/validación
  }

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

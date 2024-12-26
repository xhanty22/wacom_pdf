const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let mainWindow;

app.whenReady().then(() => {
    // Obtén todas las pantallas conectadas
    const displays = screen.getAllDisplays();

    // Busca la pantalla que corresponde a la Wacom (ajusta las propiedades según sea necesario)
    const wacomDisplay = displays.find(display => {
        // Ajusta las propiedades según las características de tu Wacom
        return display.label.includes('Wacom');
    });

    // Si no encuentra la Wacom, usará la pantalla principal
    const displayToUse = wacomDisplay || screen.getPrimaryDisplay();

    // Crea la ventana en la posición de la pantalla detectada
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        x: displayToUse.bounds.x, // Coordenada X de la pantalla
        y: displayToUse.bounds.y, // Coordenada Y de la pantalla
        width: displayToUse.bounds.width,
        height: displayToUse.bounds.height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // FullScreen
    mainWindow.setFullScreen(true);

    // Carga el archivo HTML principal
    mainWindow.loadFile('index.html');

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

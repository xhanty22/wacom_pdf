import { io } from "./SocketClient_IO.js";

/**
* initSocketManager
* Inicializa el cliente Socket.IO para la tablet y conecta los listeners 
*/
const initSocketManager = async () => {
  const statusIndicator = document.querySelector(".status-indicator__circle");

  // === CONFIGURACIÓN SOCKET ===
  // Usar SOLO valores de los archivos de configuración (sin valores por defecto)
  const config = window.appConfig;
  if (!config || !config.socket) {
    console.error("Error: No se encontró configuración de socket en window.appConfig");
    return;
  }
  
  const socketConfig = config.socket;
  
  // Validar que existan los campos necesarios en la configuración
  if (!socketConfig.ip) {
    console.error("Error: socket.ip no está definido en la configuración");
    return;
  }
  
  // Prioridad: localStorage puede sobrescribir, pero si no existe, usar SOLO de config (sin valores por defecto)
  let IP = localStorage.getItem("socket.ip") || socketConfig.ip;
  const PORT = localStorage.getItem("socket.port") !== null ? localStorage.getItem("socket.port") : socketConfig.port;
  const SOCKET_PATH = socketConfig.path;
  
  // Validar que IP existe (después de intentar localStorage)
  if (!IP) {
    console.error("Error: No se encontró IP de socket en la configuración");
    return;
  }
  
  // Validar que SOCKET_PATH existe
  if (!SOCKET_PATH) {
    console.error("Error: socket.path no está definido en la configuración");
    return;
  }
  
  // Construir la URL del socket correctamente
  let SOCKET_URL;
  let baseUrl = IP;
  let protocol = "http";
  
  // Si IP ya incluye protocolo, extraerlo y el dominio
  if (IP.startsWith("http://")) {
    protocol = "http";
    baseUrl = IP.replace("http://", "");
  } else if (IP.startsWith("https://")) {
    protocol = "https";
    baseUrl = IP.replace("https://", "");
  } else {
    // Si no tiene protocolo, determinar según si hay puerto
    // Si hay puerto (y no es cadena vacía), usar http (desarrollo local)
    // Si no hay puerto, usar https (producción)
    const hasPort = PORT && PORT.trim() !== "";
    protocol = hasPort ? "http" : "https";
  }
  
  // Construir la URL final: protocolo + dominio + puerto (si existe)
  if (PORT && PORT.trim() !== "") {
    SOCKET_URL = `${protocol}://${baseUrl}:${PORT}`;
  } else {
    SOCKET_URL = `${protocol}://${baseUrl}`;
  }

  const user = JSON.parse(localStorage.getItem("tabletUser")) || {};
  if (!user?.id) return; // sin usuario no conecta

  const userId = String(user.id).trim();
  const projectId = String(user.projectId ?? user.project ?? 1).trim();
  const tabletName = String(user.name || "").trim();

  const deviceId =
    localStorage.getItem("tabletDeviceId") ||
    (crypto?.randomUUID?.() || String(Date.now()));
  localStorage.setItem("tabletDeviceId", deviceId);
  
  const socket = io(SOCKET_URL, {
    auth: { role: "tablet", name: tabletName, projectId, userId, asigTo: userId, deviceId },
    transports: ["websocket", "polling"],
    path: SOCKET_PATH,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on("connect", () => { if (statusIndicator) statusIndicator.style.backgroundColor = "green"; });
  socket.on("disconnect", () => { if (statusIndicator) statusIndicator.style.backgroundColor = "red"; });

  // Cambiar vista de documentos
  const handleViewer = (data) => {
    const docs = Array.isArray(data?.docs) ? data.docs : [];
    if (window.app?.changeComponent) {
      const next = window.app.currentComponent === "home" || window.app.currentComponent === "files" ? "files" : window.app.currentComponent;
      window.app.changeComponent(next, docs);
    }
  };

  socket.on("getDocuments", handleViewer);


  // Guardar configuración recibida
  socket.on("setConfig", (data) => {
    if (data?.config) {
      localStorage.setItem("config", JSON.stringify(data.config));
      if (window.app?.changeComponent) window.app.changeComponent(window.app.currentComponent);
    }
  });

  // Presencia de la web
  socket.on("webPresence", ({ connected, count }) => {
    // La app escucha y actualiza la UI
  });


  window.socket = socket;


  // Apagado limpio
  if (typeof process !== "undefined" && process.on) {
    process.on("SIGINT", () => { try { socket.close(); } finally { process.exit(0); } });
    process.on("SIGTERM", () => { try { socket.close(); } finally { process.exit(0); } });
  }
};

export { initSocketManager };

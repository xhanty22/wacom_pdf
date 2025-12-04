// =========================
// File: SocketManager.js (tablet)
// =========================
// Propósito: Inicializar y manejar la conexión del cliente Socket.IO en la tablet.
// - Autentica con identificadores de sesión/dispositivo
// - Maneja reconexión y estado de presencia
// - Escucha eventos de contrato/configuración y actualiza la app Vue

import { io } from "./SocketClient_IO.js";

/**
* initSocketManager
* Inicializa el cliente Socket.IO para la tablet y conecta los listeners principales.
* Efectos:
* - Expone el socket en window.socket
* - Actualiza el indicador de conexión si existe
*/
const initSocketManager = async () => {
  const statusIndicator = document.querySelector(".status-indicator__circle");

  // === CONFIGURACIÓN SOCKET ===
  // Puede ser sobrescrito con localStorage (socket.ip, socket.port)
  const IP = localStorage.getItem("socket.ip") || "172.29.110.238";
  // const IP = localStorage.getItem("socket.ip") || "172.29.110.83";
  const PORT = localStorage.getItem("socket.port") || "8594";
  const SOCKET_URL = `http://${IP}:${PORT}`;

  // === USUARIO LOCAL ===
  const user = JSON.parse(localStorage.getItem("tabletUser")) || {};
  if (!user?.id) return; // sin usuario no conecta

  // Normalizar datos de sesión
  const userId = String(user.id).trim();
  const projectId = String(user.projectId ?? user.project ?? 1).trim();
  const tabletName = String(user.name || "").trim();

  // Identificador de dispositivo estable
  const deviceId =
    localStorage.getItem("tabletDeviceId") ||
    (crypto?.randomUUID?.() || String(Date.now()));
  localStorage.setItem("tabletDeviceId", deviceId);

  // === CONEXIÓN ===
  const socket = io(SOCKET_URL, {
    auth: { role: "tablet", name: tabletName, projectId, userId, asigTo: userId, deviceId },
    transports: ["websocket", "polling"],
    path: "/socket.io",
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // === ESTADO BÁSICO ===
  socket.on("connect", () => { if (statusIndicator) statusIndicator.style.backgroundColor = "green"; });
  socket.on("disconnect", () => { if (statusIndicator) statusIndicator.style.backgroundColor = "red"; });

  // === EVENTOS DE NEGOCIO ===
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


  // Apagado limpio (opcional en entornos Node/Electron)
  if (typeof process !== "undefined" && process.on) {
    process.on("SIGINT", () => { try { socket.close(); } finally { process.exit(0); } });
    process.on("SIGTERM", () => { try { socket.close(); } finally { process.exit(0); } });
  }
};

export { initSocketManager };

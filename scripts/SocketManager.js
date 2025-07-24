import { io } from "./SocketClient_IO.js";

const initSocketManager = async () => {

  const statusLabel = document.querySelector(".status-indicator__text");
  const statusIndicator = document.querySelector(".status-indicator__circle");

  // SOCKETS
  // const IP = "172.29.110.238";
  const IP = "127.0.0.1";
  // const PORT = "8594";
  const PORT = "9800";

  // Conectar al servidor WebSocket
  const socket = io(`http://${IP}:${PORT}`, {
    auth: {
      name: "Tablet local",
      asigTo: "1007446942",
    }
  });

  socket.on("connect", () => {
    statusLabel.textContent = "Conectado";
    statusIndicator.style.backgroundColor = "green";
  });

  socket.on("disconnect", () => {
    statusLabel.textContent = "Desconectado";
    statusIndicator.style.backgroundColor = "red";
  });

  socket.on("showContract", (e) => {
    console.log(e);

    document.querySelector("form").style.display = "none";
    const contrato = document.querySelector(".contrato");
    contrato.style.display = "block";
    contrato.querySelector("p").textContent = e;
  })

  socket.on("viewerContract", (data) => {
    if (window.app && typeof window.app.cambiarComponente === 'function') {
      window.app.cambiarComponente('archivos', data.docs);
    } else {
      console.warn("Vue app no está disponible o no tiene método cambiarComponente");
    }
  });


  window.socket = socket;

};

export { initSocketManager };

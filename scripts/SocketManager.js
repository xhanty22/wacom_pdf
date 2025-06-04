import { io } from "./SocketClient_IO.js";

document.addEventListener("DOMContentLoaded", () => {
  initSocketManager();
});

const initSocketManager = async () => {

  const statusLabel = document.querySelector(".status-indicator__text");
  const statusIndicator = document.querySelector(".status-indicator__circle");

  // SOCKETS
  const IP = "172.29.110.238";
  // const IP = "127.0.0.1";
  const PORT = "8594";
  // const PORT = "9800";

  // Conectar al servidor WebSocket
  const socket = io(`http://${IP}:${PORT}`, {
    auth:{
      name: "Tablet Topaz",
      asigTo: "1004163783",
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
    window.location.href = 'firma.html'
  });


  window.socket = socket;

};

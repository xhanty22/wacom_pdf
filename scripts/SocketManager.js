import { io } from "./SocketClient_IO.js";

const initSocketManager = async () => {

  const statusIndicator = document.querySelector(".status-indicator__circle");

  // SOCKETS
  // const IP = "172.29.110.238";
  // const PORT = "8594";
  const IP = "127.0.0.1";
  const PORT = "9800";

  // Conectar al servidor WebSocket
  const user = JSON.parse(localStorage.getItem('tabletUser')) || {};

  const socket = io(`http://${IP}:${PORT}`, {
    auth: {
      name: user.name,
      asigTo: user.id,
    }
  });

  socket.on("connect", () => {
    statusIndicator.style.backgroundColor = "green";
  });

  socket.on("disconnect", () => {
    statusIndicator.style.backgroundColor = "red";
  });

  socket.on("showContract", (e) => {
    console.log(e);

    document.querySelector("form").style.display = "none";
    const contrato = document.querySelector(".contrato");
    contrato.style.display = "block";
    contrato.querySelector("p").textContent = e;
  })

  socket.on("setConfig", (data) => {
    localStorage.setItem("config", JSON.stringify(data.config));
    window.app.changeComponent(window.app.currentComponent);
  });

  socket.on("viewerContract", (data) => {

    if (window.app && typeof window.app.changeComponent === 'function') {
      if (window.app.currentComponent == 'home' || window.app.currentComponent == 'files') {
        window.app.changeComponent('files', data.docs);
      } else {
        window.app.changeComponent(window.app.currentComponent, data.docs);
      }
    } else {
      console.warn("Vue app no está disponible o no tiene método changeComponent");
    }
  });


  window.socket = socket;

};

export { initSocketManager };

import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";

let isSocketReady = false;

document.addEventListener("DOMContentLoaded", () => {initSocketManager()
  demoController();
});

const initSocketManager = async () => {
  // SOCKETS
  const IP = "127.0.0.1";
  const PORT = "8080";

   const socket = io(`ws://${IP}:${PORT}`);

   socket.on("connect", () => {
     console.log('CONNET USING IO');
   });

   const demoController = () => {
     const btn = document.querySelector("button");
     const input = document.querySelector("input");
   
     btn.addEventListener("click", () => {
        socket.emit("hello", { message: input.value });
     });
   };
};


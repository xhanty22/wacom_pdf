import { initSocketManager } from "./scripts/SocketManager.js";

window.app = new Vue({
  el: '#app',
  data: {
    documentos: [],
    seleccionados: [],
    componenteActual: '',
    canvas: null,
    ctx: null,
    isDrawing: false,
    todosFirmados: false
  },
  async mounted() {
    await initSocketManager();

    this.cambiarComponente('inicio');
  },
  computed: {
    todosSeleccionados() {
      const noFirmados = this.documentos.filter(doc => !doc.signed);
      return this.seleccionados.length === noFirmados.length;
    }
  },
  methods: {
    toggleSeleccionTodos(event) {
      const noFirmados = this.documentos.filter(doc => !doc.signed);

      if (this.seleccionados.length === noFirmados.length) {
        this.seleccionados = [];
      } else {
        this.seleccionados = noFirmados;
      }
    },
    cambiarComponente(nombre, docs = []) {
      if (docs.length) {
        this.documentos = docs;
        if (docs.length) {
          this.documentos = docs.map(doc => {
            const base64str = doc.base64.includes(",") ? doc.base64.split(",")[1] : doc.base64;
            const decodedHtml = this.decodeBase64Utf8(base64str);
            const cleanHtml = decodedHtml.replaceAll('@@firma-0', '<span style="display:none;">@@firma-0</span>');
            return { ...doc, html: cleanHtml };
          });
        }
      }
      fetch(`./components/${nombre}.html?vs=${Date.now()}`)
        .then(resp => resp.text())
        .then(html => {
          Vue.component(nombre, { template: html });
          this.componenteActual = nombre;

          this.$nextTick(() => {
            if (nombre === 'firmar') {
              this.inicializarFirma();
            } else if (nombre === 'inicio') {
              this.documentos = [];
              this.isDrawing = false;
              this.todosFirmados = false;
              const images = document.querySelectorAll(".carousel img");
              let current = 0;

              setInterval(() => {
                images[current].classList.remove("active");
                current = (current + 1) % images.length;
                images[current].classList.add("active");
              }, 4000);
            }
          });

        })
        .catch(err => console.error('Error al cargar vista:', err));
    },

    inicializarFirma() {
      this.canvas = document.getElementById("draw-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#000";

      this.canvas.addEventListener('mousedown', this.inicioDibujo);
      this.canvas.addEventListener('mousemove', this.dibujar);
      this.canvas.addEventListener('mouseup', this.finDibujo);
      this.canvas.addEventListener('mouseleave', this.finDibujo);

      this.canvas.addEventListener('touchstart', this.inicioTactil, { passive: false });
      this.canvas.addEventListener('touchmove', this.dibujarTactil, { passive: false });
      this.canvas.addEventListener('touchend', this.finDibujo, { passive: false });

      document.getElementById("search").addEventListener("keyup", (event) => {
        const valueTxt = event.target.value;
        if (valueTxt.length >= 4) {
          this.searchText();
        } else {
          this.clearHighlights();
          document.getElementById("search-text").innerHTML = "0/0";
        }
      });

      const content = document.querySelector(".content");
      if (content) {
        content.style.zoom = "130%";
      }
    },

    inicioDibujo(e) {
      this.isDrawing = true;
      this.ctx.beginPath();
      this.ctx.moveTo(e.offsetX, e.offsetY);
    },

    dibujar(e) {
      if (!this.isDrawing) return;
      this.ctx.lineTo(e.offsetX, e.offsetY);
      this.ctx.stroke();
    },

    finDibujo() {
      this.isDrawing = false;
    },

    getCanvasPos(touch) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    },

    inicioTactil(e) {
      if (e.touches.length > 1) return;
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.getCanvasPos(e.touches[0]);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    },

    dibujarTactil(e) {
      if (!this.isDrawing || e.touches.length > 1) return;
      e.preventDefault();
      const pos = this.getCanvasPos(e.touches[0]);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    },

    clearCanvas() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    back() {
      Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro de que desea salir? Los cambios no se guardarán.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#d41717',
        cancelButtonText: 'No'
      }).then(result => {
        if (result.isConfirmed) {
          this.cambiarComponente('archivos');
        }
      });
    },

    async search() {
      await this.clearHighlights();
      document.getElementById("up-search").style.display = "block";
      document.getElementById("down-search").style.display = "block";
      document.getElementById("btn-search").style.display = "none";
      document.getElementById("btn-close").style.display = "block";
      document.getElementById("search-text").style.display = "flex";
      document.getElementById("search-text").innerHTML = "0/0";
      document.getElementById("search").style.display = "block";
      document.getElementById("search").focus();
    },

    async searchText() {
      await this.clearHighlights();
      let valueTxt = document.getElementById("search").value.toLowerCase();
      let content = document.getElementsByClassName("content")[0];
      let innerHTML = content.innerHTML;
      let index = innerHTML.toLowerCase().indexOf(valueTxt);
      let newInnerHTML = "";
      let lastIndex = 0;
      let isFirst = true;

      if (index >= 0) {
        document.getElementById("search-text").innerHTML = "1/" + (innerHTML.toLowerCase().split(valueTxt).length - 1);
      } else {
        document.getElementById("search-text").innerHTML = "0/0";
      }

      while (index >= 0) {
        newInnerHTML += innerHTML.substring(lastIndex, index) + `<span class='highlight${isFirst ? ' current' : ''}'>` + innerHTML.substring(index, index + valueTxt.length) + "</span>";
        lastIndex = index + valueTxt.length;
        index = innerHTML.toLowerCase().indexOf(valueTxt, lastIndex);
        isFirst = false;
      }
      newInnerHTML += innerHTML.substring(lastIndex);
      content.innerHTML = newInnerHTML;
    },

    async clearHighlights() {
      let content = document.getElementsByClassName("content")[0];
      let innerHTML = content.innerHTML;
      innerHTML = innerHTML.replace(/<span class="highlight">(.*?)<\/span>/g, "$1");
      innerHTML = innerHTML.replace(/<span class="highlight current">(.*?)<\/span>/g, "$1");
      content.innerHTML = innerHTML;
    },

    async closeSearch() {
      await this.clearHighlights();
      document.getElementById("search").value = "";
      document.getElementById("search").style.display = "none";
      document.getElementById("up-search").style.display = "none";
      document.getElementById("down-search").style.display = "none";
      document.getElementById("btn-search").style.display = "block";
      document.getElementById("btn-close").style.display = "none";
      document.getElementById("search-text").style.display = "none";
    },

    async upSearch() {
      let highlights = document.getElementsByClassName("highlight");
      let current = document.getElementsByClassName("current")[0];
      let index = 0;

      if (current) {
        index = Array.from(highlights).indexOf(current);
        current.classList.remove("current");
      }

      if (index > 0) {
        highlights[index - 1].classList.add("current");
        document.getElementById("search-text").innerHTML = (index) + "/" + highlights.length;
      } else {
        highlights[highlights.length - 1].classList.add("current");
        document.getElementById("search-text").innerHTML = highlights.length + "/" + highlights.length;
      }

      highlights[index - 1].scrollIntoView({ behavior: "smooth", block: "center" });
    },

    async downSearch() {
      let highlights = document.getElementsByClassName("highlight");
      let current = document.getElementsByClassName("current")[0];
      let index = 0;

      if (current) {
        index = Array.from(highlights).indexOf(current);
        current.classList.remove("current");
      }

      if (index < highlights.length - 1) {
        highlights[index + 1].classList.add("current");
        document.getElementById("search-text").innerHTML = (index + 2) + "/" + highlights.length;
      } else {
        highlights[0].classList.add("current");
        document.getElementById("search-text").innerHTML = "1/" + highlights.length;
      }

      highlights[index + 1].scrollIntoView({ behavior: "smooth", block: "center" });
    },

    async addZoom() {
      let content = document.getElementsByClassName("content")[0];
      let currentZoom = parseInt(content.style.zoom) || 100;
      content.style.zoom = currentZoom + 10 + "%";
      if (currentZoom >= 150) {
        content.style.zoom = "150%";
      }
    },

    async lessZoom() {
      let content = document.getElementsByClassName("content")[0];
      let currentZoom = parseInt(content.style.zoom) || 100;
      content.style.zoom = currentZoom - 10 + "%";
      if (currentZoom <= 100) {
        content.style.zoom = "100%";
      }
    },

    async save() {
      if (!this.isCanvasEmpty()) {
        Swal.fire({
          title: '¡Alerta!',
          text: '¿Está seguro de que desea guardar la firma?',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          confirmButtonColor: '#d41717',
          cancelButtonText: 'No'
        }).then((result) => {
          if (result.isConfirmed) {
            Swal.fire('¡Alerta!', 'Guardado con éxito', 'success');

            if (window.socket) {
              const signatureData = this.canvas.toDataURL("image/png").split(',')[1];
              this.documentos.forEach(doc => {
                const estaSeleccionado = this.seleccionados.includes(doc);
                if (estaSeleccionado) {
                  doc.signature = signatureData;
                  doc.signed = true;
                  doc.status = "Firmado";

                  const restoredHtml = doc.html.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');
                  console.log(restoredHtml);

                  const newBase64 = btoa(restoredHtml);
                  doc.base64 = "data:text/html;base64," + newBase64;
                }
              });
              this.seleccionados = [];
              this.todosFirmados = this.documentos.every(doc => doc.signed === true);

              this.cambiarComponente('archivos');
            }
          }
        });
      } else {
        Swal.fire({
          title: '¡Error!',
          text: 'Debe dibujar una firma antes de guardar.',
          icon: 'error',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d41717'
        });
      }
    },

    firmarSeleccionados() {

      if (this.seleccionados.length === 0) {
        Swal.fire({
          title: '¡Alerta!',
          text: 'Selecciona al menos un documento para firmar.',
          icon: 'warning',
          confirmButtonText: 'Ok',
          confirmButtonColor: '#d41717',
        }).then(result => {
        });
        return;
      }

      this.$root.documentosSeleccionados = this.seleccionados;
      this.$root.cambiarComponente('firmar');
    },

    enviarDocumentos() {
      this.todosFirmados = this.documentos.every(doc => doc.signed === true);

      if (!this.todosFirmados) {
        Swal.fire('Faltan documentos por firmar', 'Debes firmar todos los documentos antes de continuar.', 'warning');
        return;
      } else {
        window.socket.emit("saveSignature", {
          documentsSigned: this.documentos,
          asigTo: "1007446942"
        });
        Swal.fire('Todos los documentos han sido firmados', '', 'success');
        this.$root.cambiarComponente('inicio');
      }
    },
    decodeBase64Utf8(base64str) {
      const binary = Uint8Array.from(atob(base64str), c => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(binary);
    },
    isCanvasEmpty() {
      const blankCanvas = document.createElement('canvas');
      blankCanvas.width = this.canvas.width;
      blankCanvas.height = this.canvas.height;

      const blank = blankCanvas.getContext('2d').getImageData(0, 0, this.canvas.width, this.canvas.height).data;
      const actual = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;

      for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== blank[i]) {
          return false; // Hay alguna diferencia
        }
      }
      return true; // Es idéntico al canvas vacío
    }
  }
});


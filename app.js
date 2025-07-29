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
    todosFirmados: false,
    firmaPendiente: '',
    user: {
      nombre: '',
      documento: '',
    }
  },
  async mounted() {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        Swal.fire({
          title: '¡Alerta!',
          text: '¿Está seguro que desea eliminar el storage?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          confirmButtonColor: '#d41717',
          cancelButtonText: 'No'
        }).then(result => {
          if (result.isConfirmed) {
            localStorage.clear();
            Swal.fire('LocalStorage limpiado', '', 'success');
            location.reload();
          }
        });
      }
    });
    this.validUser();
    await initSocketManager();
  },
  computed: {
    todosSeleccionados() {
      const noFirmados = this.documentos.filter(doc => !doc.signed);
      return this.seleccionados.length === noFirmados.length;
    }
  },
  methods: {
    // Valida si hay un usiario registrado para el uso, sino redirecciona al login
    validUser() {
      const user = JSON.parse(localStorage.getItem('tabletUser'));

      if (user == null) {
        this.cambiarComponente("login");
      } else {
        this.user = user;
        this.cambiarComponente('inicio');
      }

    },
    // Selecciona o deseleciona todos los documentos
    toggleSeleccionTodos(event) {
      const noFirmados = this.documentos.filter(doc => !doc.signed);

      if (this.seleccionados.length === noFirmados.length) {
        this.seleccionados = [];
      } else {
        this.seleccionados = noFirmados;
      }
    },
    // Alterna entre los componentes recibiendo el nombre del html
    cambiarComponente(nombre, docs = []) {
      if (docs.length) {
        this.documentos = docs.map(doc => {
          const base64str = doc.base64.includes(",") ? doc.base64.split(",")[1] : doc.base64;
          const decodedHtml = this.decodeBase64Utf8(base64str);
          const cleanHtml = decodedHtml.replaceAll('@@firma-0', '<span style="display:none;">@@firma-0</span>');
          return { ...doc, html: cleanHtml };
        });
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
            } else if (nombre === 'archivos') {
              this.seleccionados = [];
            }
          });

        })
        .catch(err => console.error('Error al cargar vista:', err));
    },
    // Inicializa el canva para la firma
    inicializarFirma() {
      this.canvas = document.getElementById("draw-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.configurarCanvas();

      const content = document.querySelector(".content");
      if (content) {
        content.style.zoom = "100%";
      }

      if (this.firmaPendiente) {
        const img = new Image();
        img.src = this.firmaPendiente;

        img.onload = () => {
          this.clearCanvas(); // limpia antes si quieres
          this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };

        this.firmaPendiente = null;
      }
    },
    
    configurarCanvas() {
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
        text: '¿Está seguro que desea salir? Los cambios no se guardarán.',
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

    addZoom() {
      this.ajustarZoom(10);
    },
    lessZoom() {
      this.ajustarZoom(-10);
    },

    ajustarZoom(valor) {
      const content = document.getElementsByClassName("page-signature")[0];
      let currentZoom = parseInt(content.style.zoom) || 100;
      currentZoom = Math.max(100, Math.min(150, currentZoom + valor));
      content.style.zoom = currentZoom + "%";
    },

    async save() {
      if (!this.isCanvasEmpty()) {
        Swal.fire({
          title: '¡Alerta!',
          text: '¿Está seguro que desea guardar la firma?',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          confirmButtonColor: '#d41717',
          cancelButtonText: 'No'
        }).then((result) => {
          if (result.isConfirmed) {
            if (window.socket) {
              const signatureData = this.canvas.toDataURL("image/png").split(',')[1];
              this.documentos.forEach(doc => {
                const estaSeleccionado = this.seleccionados.some(s => s.id === doc.id);
                if (estaSeleccionado) {
                  doc.signature = signatureData;
                  doc.signed = true;
                  doc.status = 1;

                  const restoredHtml = doc.html.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');
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
        });
        return;
      }

      this.$root.documentosSeleccionados = this.seleccionados;
      this.$root.cambiarComponente('firmar');
    },
    // Emite un evento con los documentos ya firmados
    enviarDocumentos() {
      this.todosFirmados = this.documentos.every(doc => doc.signed === true);

      if (!this.todosFirmados) {
        Swal.fire('Faltan documentos por firmar', 'Debes firmar todos los documentos antes de continuar.', 'warning');
        return;
      } else {
        window.socket.emit("saveSignature", {
          documentsSigned: this.documentos,
          asigTo: this.user.documento
        });
        Swal.fire({
          title: 'Todos los documentos han sido firmados',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
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
    },
    // Remueve la firma de un documento para firmarlo nuevamente
    volverFirmar(doc) {
      Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro que desea firmar el documento nuevamente?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#d41717',
        cancelButtonText: 'No'
      }).then(async result => {
        if (result.isConfirmed) {
          const documento = this.documentos.find(d => d.id === doc.id);
          if (documento) {
            documento.signed = false;
            documento.status = 0;
            this.seleccionados = [doc];
            this.todosFirmados = false;
            this.firmaPendiente = 'data:image/png;base64,' + documento.signature;
            this.cambiarComponente('firmar', this.documentos);
          }
        }
      });
    },

    loginForm() {
      if (this.user.nombre.trim() == "" || this.user.documento.trim() == "") {
        Swal.fire({
          title: '¡Alerta!',
          text: 'Complete los campos del formulario para continuar',
          icon: 'warning',
          showCancelButton: false,
          confirmButtonText: 'OK',
          confirmButtonColor: '#d41717',
        });
      } else {
        Swal.fire("Registro exitoso", '', "success");
        localStorage.setItem('tabletUser', JSON.stringify(this.user));
        setTimeout(() => {
          location.reload();
        }, 2000);
      }
    },
  }
});


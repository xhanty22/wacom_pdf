const moduleUrl = `./scripts/SocketManager.js?v=${Date.now()}`;
const { initSocketManager } = await import(moduleUrl);

window.app = new Vue({
  el: '#app',
  data: {
    documents: [],
    selected: [],
    currentComponent: '',
    canvas: null,
    ctx: null,
    isDrawing: false,
    allSigned: false,
    signaturePending: '',
    user: {
      name: '',
      id: '',
    },
    configProject: {},
    current: 0,
    intervalId: null,
    decisionTmp: {}
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
    this.validateUser();
    await initSocketManager();
    this.intervalId = setInterval(() => {
      const total = this.configProject.carrusel.length;
      if (total > 0) {
        this.current = (this.current + 1) % total;
      }
    }, 4000);
  },
  beforeDestroy() {
    clearInterval(this.intervalId);
  },
  computed: {
    allSelected() {
      const unsigned = this.documents.filter(doc => !doc.signed);
      return this.selected.length === unsigned.length;
    }
  },
  methods: {
    setDecision(docId, val) {
      this.$set(this.decisionTmp, docId, val);
    },
    // Valida si hay un usiario registrado para el uso, sino redirecciona al login
    validateUser() {
      const user = JSON.parse(localStorage.getItem('tabletUser'));

      if (user == null) {
        this.changeComponent("login");
      } else {
        this.user = user;
        this.changeComponent('home');
      }

    },
    // Selecciona o deseleciona todos los documentos
    toggleSelectAll(event) {
      const unsigned = this.documents.filter(doc => !doc.signed);

      if (this.selected.length === unsigned.length) {
        this.selected = [];
      } else {
        this.selected = unsigned;
      }
    },
    // Alterna entre los componentes recibiendo el nombre del html
    changeComponent(name, docs = []) {
      if (docs.length) {
        this.allSigned = false;
        this.documents = docs.map(doc => {
          const base64str = doc.base64.includes(",") ? doc.base64.split(",")[1] : doc.base64;
          const decodedHtml = this.decodeBase64Utf8(base64str);
          const cleanHtml = decodedHtml.replaceAll('@@firma-0', '<span style="display:none;">@@firma-0</span>');

          const docExisting = this.documents.find(d => d.id === doc.id);

          return {
            ...doc,
            html: docExisting?.html || cleanHtml,
            signed: docExisting?.signed || false,
            status: docExisting?.status || false,
            signature: docExisting?.signature || '',
          };
        });
      }
      fetch(`./components/${name}.html?vs=${Date.now()}`)
        .then(resp => resp.text())
        .then(html => {
          Vue.component(name, { template: html });
          this.currentComponent = name;

          this.$nextTick(() => {
            this.configProject = JSON.parse(localStorage.getItem("config") || "{}");
            if (name === 'signature') {
              this.initializeSignature();
            } else if (name === 'home') {

              this.documents = [];
              this.isDrawing = false;
              this.allSigned = false;


            } else if (name === 'files') {
              this.selected = [];
            }
          });

        })
        .catch(err => console.error('Error al cargar vista:', err));
    },
    // Inicializa el canva para la firma
    initializeSignature() {
      this.canvas = document.getElementById("draw-canvas");
      this.ctx = this.canvas.getContext("2d");
      this.configureCanvas();

      const content = document.querySelector(".content");
      if (content) {
        content.style.zoom = "100%";
      }

      if (this.signaturePending) {
        const img = new Image();
        img.src = this.signaturePending;

        img.onload = () => {
          this.clearCanvas(); // limpia antes si quieres
          this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };

        this.signaturePending = null;
      }
    },

    configureCanvas() {
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "#000";

      this.canvas.addEventListener('mousedown', this.initializeDrawing);
      this.canvas.addEventListener('mousemove', this.draw);
      this.canvas.addEventListener('mouseup', this.endDrawing);
      this.canvas.addEventListener('mouseleave', this.endDrawing);

      this.canvas.addEventListener('touchstart', this.startTouch, { passive: false });
      this.canvas.addEventListener('touchmove', this.drawTouch, { passive: false });
      this.canvas.addEventListener('touchend', this.endDrawing, { passive: false });
    },

    initializeDrawing(e) {
      this.isDrawing = true;
      this.ctx.beginPath();
      this.ctx.moveTo(e.offsetX, e.offsetY);
    },

    draw(e) {
      if (!this.isDrawing) return;
      this.ctx.lineTo(e.offsetX, e.offsetY);
      this.ctx.stroke();
    },

    endDrawing() {
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

    startTouch(e) {
      if (e.touches.length > 1) return;
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.getCanvasPos(e.touches[0]);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    },

    drawTouch(e) {
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
          this.changeComponent('files');
        }
      });
    },

    addZoom() {
      this.ajustZoom(10);
    },
    lessZoom() {
      this.ajustZoom(-10);
    },

    ajustZoom(valor) {
      const content = document.getElementsByClassName("page-signature")[0];
      let currentZoom = parseInt(content.style.zoom) || 100;
      currentZoom = Math.max(100, Math.min(150, currentZoom + valor));
      content.style.zoom = currentZoom + "%";
    },

    async save() {
      if (this.isCanvasEmpty()) {
        await Swal.fire({ title: '¡Error!', text: 'Debe dibujar una firma antes de guardar.', icon: 'error', confirmButtonText: 'Aceptar', confirmButtonColor: '#d41717' });
        return;
      }

      // 1) Validar decisiones requeridas
      const missing = (this.selected || []).filter(d =>
        d.requireDecision && ![true, false].includes(this.decisionTmp?.[d.id])
      );
      if (missing.length) {
        await Swal.fire({
          title: 'Faltan decisiones',
          text: `Selecciona Aprobar o Rechazar de: ${missing.map(f => f.name).join(', ')}`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#d41717'
        });
        return;
      }

      const confirm = await Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro que desea guardar la firma?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#d41717',
        cancelButtonText: 'No'
      });
      if (!confirm.isConfirmed) return;

      const signatureData = this.canvas.toDataURL("image/png").split(',')[1];

      this.selected.forEach(sel => {
        const doc = this.documents.find(d => d.id === sel.id);
        if (!doc) return;

        doc.signature = signatureData;
        doc.signed = true;
        doc.status = 1;

        // decisión si aplica
        if (doc.requireDecision) {
          const val = this.decisionTmp?.[doc.id];
          if ([true, false].includes(val)) {
            doc.decision = val;
            doc.decisionAt = new Date().toISOString();
          } else {
            doc.decision = null;
          }
        }

        let restoredHtml = doc.html.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');

        if (doc.requireDecision && [true, false].includes(doc.decision)) {
          restoredHtml = this.injectBadgeIntoFirstDiv(restoredHtml, doc);
        }

        const utf8 = new TextEncoder().encode(restoredHtml);
        let bin = '';
        utf8.forEach(b => bin += String.fromCharCode(b));
        const newBase64 = btoa(bin);
        doc.base64 = "data:text/html;base64," + newBase64;
      });

      this.selected = [];
      this.allSigned = this.documents.every(doc => doc.signed === true);

      this.changeComponent('files');
    },

    injectBadgeIntoFirstDiv(html, doc) {
      // Evitar duplicados si ya existe
      if (/data-badge-estado="1"/i.test(html)) return html;

      const aprobado = !!doc.decision;
      const etiqueta = aprobado ? 'APROBADO' : 'RECHAZADO';
      const color = aprobado ? '#1b5e20' : '#b71c1c';
      const fecha = this.formatDate(doc.decisionAt) || '';

      const badge = `
        <div data-badge-estado="1" style="
          position:absolute;top: 1.5rem; transform: rotate(-45deg);
            left: 3rem; z-index:9999;
          font-family:Arial,sans-serif;text-transform:uppercase;pointer-events:none;
        ">
          <div style="
            display:inline-block;padding:6px 10px;border-radius:6px;
            font-weight:700;letter-spacing:.5px;color:#fff;
            background:${color};box-shadow:0 1px 2px rgba(0,0,0,.15);
          ">${etiqueta}</div>
          <div style="margin-top:4px;font-size:10pt;color:#333;">${fecha}</div>
        </div>`.trim();

      try {
        // Parsear como documento HTML
        const parser = new DOMParser();
        const docHtml = parser.parseFromString(html, 'text/html');

        // Buscar el PRIMER div del body
        let firstDiv = docHtml.body.querySelector('div');
        if (!firstDiv) {
          // Si no hay <div>, creamos uno y metemos el contenido original dentro
          firstDiv = docHtml.createElement('div');
          firstDiv.style.position = 'relative';
          firstDiv.innerHTML = html;  // preserva el contenido original
          docHtml.body.innerHTML = '';
          docHtml.body.appendChild(firstDiv);
        } else {
          // Asegurar posicionamiento relativo en el primer div
          const pos = (firstDiv.getAttribute('style') || '');
          if (!/position\s*:\s*relative/i.test(pos)) {
            firstDiv.setAttribute('style', (pos ? pos.replace(/;?$/, ';') : '') + 'position:relative;');
          }
        }

        // Insertar el badge como primer hijo del primer div
        firstDiv.insertAdjacentHTML('afterbegin', badge);

        // Devolver el HTML resultante (solo el body)
        return docHtml.body.innerHTML;
      } catch (e) {
        // Fallback con regex si DOMParser falla
        return html.replace(/<div\b([^>]*)>/i, (m, attrs) => {
          // asegurar position:relative en style
          if (/style\s*=/.test(attrs)) {
            attrs = attrs.replace(/style\s*=\s*(['"])(.*?)\1/i, (s, q, css) => {
              if (!/position\s*:\s*relative/i.test(css)) css = css.replace(/;?$/, ';') + 'position:relative;';
              return `style=${q}${css}${q}`;
            });
          } else {
            attrs = `${attrs} style="position:relative;"`;
          }
          return `<div${attrs}>${badge}`;
        });
      }
    },

    formatDate(iso) {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
      } catch { return ''; }
    },


    signSelected() {

      if (this.selected.length === 0) {
        Swal.fire({
          title: '¡Alerta!',
          text: 'Selecciona al menos un documento para firmar.',
          icon: 'warning',
          confirmButtonText: 'Ok',
          confirmButtonColor: '#d41717',
        });
        return;
      }

      this.$root.allSelected = this.selected;
      this.$root.changeComponent('signature');
    },
    // Emite un evento con los documentos ya firmados
    sendDocuments() {
      this.allSigned = this.documents.every(doc => doc.signed === true);

      if (!this.allSigned) {
        Swal.fire('Faltan documentos por firmar', 'Debes firmar todos los documentos antes de continuar.', 'warning');
        return;
      } else {
        window.socket.emit("saveSignature", {
          documentsSigned: this.documents,
          asigTo: this.user.id
        });
        Swal.fire({
          title: 'Todos los documentos han sido firmados',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.$root.changeComponent('home');
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
    signAgain(doc) {
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
          const documento = this.documents.find(d => d.id === doc.id);
          if (documento) {
            documento.signed = false;
            documento.status = 0;
            this.selected = [doc];
            this.allSigned = false;
            this.signaturePending = 'data:image/png;base64,' + documento.signature;
            this.changeComponent('signature', this.documents);
          }
        }
      });
    },

    loginForm() {
      if (this.user.name.trim() == "" || this.user.id.trim() == "") {
        Swal.fire({
          title: '¡Alerta!',
          text: 'Complete los campos del formulario para continuar',
          icon: 'warning',
          showCancelButton: false,
          confirmButtonText: 'OK',
          confirmButtonColor: '#d41717',
        });
      } else {
        Swal.fire("Vinculación exitosa", '', "success");
        localStorage.setItem('tabletUser', JSON.stringify(this.user));
        setTimeout(() => {
          location.reload();
        }, 2000);
      }
    },
  }
});


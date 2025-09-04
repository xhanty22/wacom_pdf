// Carga dinámica del SocketManager (mantiene caché-busting por versión)
const moduleUrl = `./scripts/SocketManager.js?v=${Date.now()}`;
const { initSocketManager } = await import(moduleUrl);

window.app = new Vue({
  el: '#app',
  data: {
    // Estado principal
    documents: [],
    selected: [],
    currentComponent: '',

    // Canvas firma
    canvas: null,
    ctx: null,
    isDrawing: false,
    signaturePending: '',

    // Progreso y usuario
    allSigned: false,
    user: { project: '', name: '', id: '' },

    // Opciones fijas
    optionsProject: [
      { value: 1, label: 'SIAMO', imageDefault: 'https://web.caris.com.co/assets/img/loginCover.jpg' },
      { value: 2, label: 'SIRHU', imageDefault: 'assets/img/home/one.jpg' }
    ],

    // UI/Config
    selectOpen: false,
    configProject: {},
    current: 0,
    intervalId: null,

    // Decisiones por documento
    decisionTmp: {},

    // Presencia web
    webPresence: { connected: null, count: 0, lastTs: 0, offline: true },
    _onWebPresence: null,
    _webPresenceTimer: null,

    // Otros flags internos
    _submitting: false,
    _blankCache: { width: 0, height: 0, data: null },
  },

  // Al montar: hotkey limpieza, validar sesión, iniciar socket y carrusel
  async mounted() {
    // Hotkey debug: Ctrl+Shift+D para limpiar sesión local
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        Swal.fire({
          title: '¡Alerta!',
          text: '¿Está seguro que desea eliminar la sesión?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          confirmButtonColor: '#f44336',
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

    // Carrusel seguro (no truena si falta config)
    this.intervalId = setInterval(() => {
      const total = this?.configProject?.carrusel?.length || 0;
      if (total > 0) this.current = (this.current + 1) % total;
    }, 4000);
  },

  // Antes de destruir: liberar timers y listeners
  beforeDestroy() {
    if (this._webPresenceTimer) clearTimeout(this._webPresenceTimer);
    if (this._onWebPresence && window?.socket) {
      window.socket.off('webPresence', this._onWebPresence);
    }
    clearInterval(this.intervalId);
    this.teardownSignatureListeners();
  },

  computed: {
    // Retorna true si todos los no firmados están seleccionados
    allSelected() {
      const unsigned = this.documents.filter(doc => !doc.signed);
      return this.selected.length === unsigned.length;
    },
    // Etiqueta amigable del proyecto seleccionado
    selectedLabel() {
      const opt = this.optionsProject.find(o => o.value === this.user.project);
      return opt ? opt.label : '';
    },
    imageDefaultByProject() {
      const id = Number(this.$root.user.projectId); // por si viene como string
      const opt = this.$root.optionsProject.find(o => o.value === id);
      return opt ? opt.imageDefault : 'assets/img/default.jpg'; // fallback
    }
  },

  methods: {
    // Valida conexión con la web y detecta desconexión prolongada
    validateConnection() {
      this._onWebPresence = ({ connected, count }) => {
        this.webPresence.connected = !!connected;
        this.webPresence.count = count ?? 0;

        if (connected) {
          if (this._webPresenceTimer) {
            clearTimeout(this._webPresenceTimer);
            this._webPresenceTimer = null;
          }
          if (this.webPresence.offline) this.webPresence.offline = false;
        } else {
          // Inicia temporizador para cambio a "offline"
          if (this.currentComponent !== 'home' && this.currentComponent !== 'login') {
            if (!this._webPresenceTimer) {
              this._webPresenceTimer = setTimeout(() => {
                if (!this.webPresence.connected && !this.webPresence.offline) {
                  this.webPresence.offline = true;
                  this.onWebDisconnectedLong();
                }
                this._webPresenceTimer = null;
              }, 4000);
            }
          }
        }
      };
      window.socket.on('webPresence', this._onWebPresence);
    },

    // Muestra modal de reconexión con cuenta regresiva
    onWebDisconnectedLong() {
      let tick;
      Swal.fire({
        title: 'Conexión con la web perdida',
        html: 'Reintentando… <b>3</b> s',
        icon: 'warning',
        timer: 5000,
        timerProgressBar: true,
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading();
          const b = Swal.getHtmlContainer().querySelector('b');
          const upd = () => {
            const ms = Swal.getTimerLeft();
            b.textContent = ms ? Math.ceil(ms / 1000) : 0;
          };
          upd();
          tick = setInterval(upd, 100);
        },
        willClose: () => clearInterval(tick),
      }).then(() => {
        if (this.webPresence.connected) return;
        this.handleWebLossAction();
      });
    },

    // Aplica fallback de UI si no vuelve la conexión
    handleWebLossAction() {
      try {
        this.selected = [];
        this.allSigned = this.documents.every(d => d.signed === true);
        if (this.currentComponent !== 'files') this.changeComponent('files');
        Swal.fire({
          icon: 'info',
          title: 'Sin conexión',
          text: 'No se pudo restablecer la conexión.',
          timer: 2000,
          showConfirmButton: false
        });
        this.changeComponent('home');
      } catch (e) {
        // Silencioso en producción
      }
    },

    // Registra decisión temporal (acepto/no acepto) por documento
    setDecision(docId, val) {
      this.$set(this.decisionTmp, docId, val);
    },

    // Verifica sesión: si no hay usuario, abre login; si hay, va a home
    async validateUser() {
      const user = JSON.parse(localStorage.getItem('tabletUser'));
      if (!user) {
        this.changeComponent('login');
      } else {
        this.user = user;

        this.changeComponent('home');
        await initSocketManager();
        this.validateConnection();
      }
    },

    // Selecciona/deselecciona todos los documentos sin firmar
    toggleSelectAll() {
      const unsigned = this.documents.filter(doc => !doc.signed);
      this.selected = (this.selected.length === unsigned.length) ? [] : unsigned;
    },

    // Cambia de componente y normaliza documentos recibidos
    changeComponent(name, docs = []) {

      fetch(`./components/${name}.html?vs=${Date.now()}`)
        .then(resp => resp.text())
        .then(html => {
          Vue.component(name, { template: html });

          const prev = this.currentComponent;
          this.currentComponent = name;

          // Limpia listeners al salir de la vista de firma
          if (prev === 'signature' && name !== 'signature') this.teardownSignatureListeners();

          this.$nextTick(() => {
            this.configProject = JSON.parse(localStorage.getItem('config') || '{}');

            if (name === 'signature') {
              this.decisionTmp = {};
              this.initializeSignature();
            } else if (name === 'home') {
              this.selected = [];
              this.documents = [];
              this.isDrawing = false;
              this.allSigned = false;
            } else if (name === 'files') {
              if (docs.length) {
                const prevDocs = this.documents || [];

                this.documents = docs.map(doc => {
                  const base64str = doc.base64.includes(',') ? doc.base64.split(',')[1] : doc.base64;
                  const decodedHtml = this.decodeBase64Utf8(base64str);
                  const cleanHtml = decodedHtml.replaceAll('@@firma-0', '<span style="display:none;">@@firma-0</span>');

                  const existing = prevDocs.find(d => d.id === doc.id);
                  if (existing) {
                    const prevB64 =
                      existing.base64Str
                      ?? (existing.base64?.includes(',') ? existing.base64.split(',')[1] : existing.base64)
                      ?? '';
                    if (prevB64 && base64str && prevB64 === base64str) {
                      return existing;
                    } else {
                      this.allSigned = false;
                    }
                  }

                  return {
                    ...doc,
                    html: cleanHtml,
                    signed: false,
                    status: false,
                    signature: '',
                    base64Str: base64str,
                    base64: doc.base64,
                  };
                });
              }
              this.selected = [];
            }
          });
        })
        .catch(() => Swal.fire('Error', 'No fue posible cargar la vista.', 'error'));
    },

    // Prepara el canvas y restaura previsualización de firma si existe
    initializeSignature() {
      this.canvas = document.getElementById('draw-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.configureCanvas();

      const content = document.querySelector('.content');
      if (content) content.style.zoom = '100%';

      if (this.signaturePending) {
        const img = new Image();
        img.src = this.signaturePending;
        img.onload = () => {
          this.clearCanvas();
          this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
        };
        this.signaturePending = null;
      }
    },

    // Quita listeners del canvas para evitar duplicados/memoria
    teardownSignatureListeners() {
      if (!this.canvas) return;
      this.canvas.removeEventListener('mousedown', this.initializeDrawing);
      this.canvas.removeEventListener('mousemove', this.draw);
      this.canvas.removeEventListener('mouseup', this.endDrawing);
      this.canvas.removeEventListener('mouseleave', this.endDrawing);
      this.canvas.removeEventListener('touchstart', this.startTouch, { passive: false });
      this.canvas.removeEventListener('touchmove', this.drawTouch, { passive: false });
      this.canvas.removeEventListener('touchend', this.endDrawing, { passive: false });
    },

    // Configura estilos del canvas y listeners de dibujo
    configureCanvas() {
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = '#000';

      this.canvas.addEventListener('mousedown', this.initializeDrawing);
      this.canvas.addEventListener('mousemove', this.draw);
      this.canvas.addEventListener('mouseup', this.endDrawing);
      this.canvas.addEventListener('mouseleave', this.endDrawing);

      this.canvas.addEventListener('touchstart', this.startTouch, { passive: false });
      this.canvas.addEventListener('touchmove', this.drawTouch, { passive: false });
      this.canvas.addEventListener('touchend', this.endDrawing, { passive: false });

      // Reset de caché del canvas en blanco (para isCanvasEmpty)
      this._blankCache = { width: this.canvas.width, height: this.canvas.height, data: null };
    },

    // Inicia un trazo con mouse
    initializeDrawing(e) {
      this.isDrawing = true;
      this.ctx.beginPath();
      this.ctx.moveTo(e.offsetX, e.offsetY);
    },

    // Dibuja mientras el mouse está presionado
    draw(e) {
      if (!this.isDrawing) return;
      this.ctx.lineTo(e.offsetX, e.offsetY);
      this.ctx.stroke();
    },

    // Finaliza un trazo
    endDrawing() {
      this.isDrawing = false;
    },

    // Convierte coordenadas touch a coordenadas de canvas (con escala)
    getCanvasPos(touch) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    },

    // Inicia un trazo con touch
    startTouch(e) {
      if (e.touches.length > 1) return;
      e.preventDefault();
      this.isDrawing = true;
      const pos = this.getCanvasPos(e.touches[0]);
      this.ctx.beginPath();
      this.ctx.moveTo(pos.x, pos.y);
    },

    // Dibuja con touch mientras hay un único dedo
    drawTouch(e) {
      if (!this.isDrawing || e.touches.length > 1) return;
      e.preventDefault();
      const pos = this.getCanvasPos(e.touches[0]);
      this.ctx.lineTo(pos.x, pos.y);
      this.ctx.stroke();
    },

    // Limpia el canvas y la caché de "en blanco"
    clearCanvas() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._blankCache.data = null;
    },

    // Confirma y vuelve a la lista de archivos desde la vista de firma
    back() {
      Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro que desea salir? Los cambios no se guardarán.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#f44336',
        cancelButtonText: 'No'
      }).then(result => { if (result.isConfirmed) this.changeComponent('files'); });
    },

    // Aumenta/Reduce/Ajusta zoom de la vista de firma
    addZoom() { this.ajustZoom(10); },
    lessZoom() { this.ajustZoom(-10); },
    ajustZoom(valor) {
      const content = document.getElementsByClassName('page-signature')[0];
      if (!content) return;
      let currentZoom = parseInt(content.style.zoom) || 100;
      currentZoom = Math.max(100, Math.min(150, currentZoom + valor));
      content.style.zoom = currentZoom + '%';
    },

    // Guarda firma(s) en los documentos seleccionados y regresa a la lista
    async save() {
      if (this.isCanvasEmpty()) {
        await Swal.fire({ title: '¡Error!', text: 'Debe firmar antes de guardar.', icon: 'error', confirmButtonText: 'Aceptar', confirmButtonColor: '#f44336' });
        return;
      }

      // Validar decisiones requeridas
      const missing = (this.selected || []).filter(d =>
        d.requireDecision && ![true, false].includes(this.decisionTmp?.[d.id])
      );
      if (missing.length) {
        await Swal.fire({
          title: 'Warning',
          text: `Selecciona acepto o no acepto en: ${missing.map(f => f.name).join(', ')}`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#f44336'
        });
        return;
      }

      // Confirmación de guardado
      const confirm = await Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro que desea guardar la firma?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#f44336',
        cancelButtonText: 'No'
      });
      if (!confirm.isConfirmed) return;

      const signatureData = this.canvas.toDataURL('image/png').split(',')[1];

      this.selected.forEach(sel => {
        const doc = this.documents.find(d => d.id === sel.id);
        if (!doc) return;

        // Marca firma y estado
        doc.signature = signatureData;
        doc.signed = true;
        doc.status = 1;

        // Guarda decisión si aplica
        if (doc.requireDecision) {
          const val = this.decisionTmp?.[doc.id];
          if ([true, false].includes(val)) {
            doc.decision = val;
            doc.decisionAt = new Date().toISOString();
          } else {
            doc.decision = null;
          }
        }

        // Restaura placeholder y agrega badge si aplica
        let restoredHtml = doc.html.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');
        if (doc.requireDecision && [true, false].includes(doc.decision)) {
          const aceptado = !!doc.decision;
          const etiqueta = aceptado ? 'ACEPTADO' : 'NO ACEPTADO';
          const color = aceptado ? '#4caf50' : '#f44336';
          const fecha = this.formatDate(doc.decisionAt) || '';
          doc.badge = {
            'label': etiqueta,
            'color': color,
            'date': fecha,
          };
        }

        // Re-encode a base64 en UTF-8
        const utf8 = new TextEncoder().encode(restoredHtml);
        let bin = '';
        utf8.forEach(b => (bin += String.fromCharCode(b)));
        const newBase64 = btoa(bin);
        doc.base64 = 'data:text/html;base64,' + newBase64;
      });

      this.selected = [];
      this.allSigned = this.documents.every(doc => doc.signed === true);
      this.changeComponent('files');
    },

    // Formatea fecha ISO a es-CO
    formatDate(iso) {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleString('es-CO', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit'
        });
      } catch { return ''; }
    },

    // Va a la vista de firma con la selección actual
    signSelected() {
      if (this.selected.length === 0) {
        Swal.fire({
          title: '¡Alerta!',
          text: 'Selecciona al menos un documento para firmar.',
          icon: 'warning',
          confirmButtonText: 'Ok',
          confirmButtonColor: '#f44336',
        });
        return;
      }
      this.$root.allSelected = this.selected;
      this.$root.changeComponent('signature');
    },

    // Verifica si el canvas está en blanco (usa caché por rendimiento)
    isCanvasEmpty() {
      if (!this.canvas) return true;
      const { width, height } = this.canvas;

      if (!this._blankCache.data || this._blankCache.width !== width || this._blankCache.height !== height) {
        const blank = document.createElement('canvas');
        blank.width = width; blank.height = height;
        this._blankCache = {
          width, height,
          data: blank.getContext('2d').getImageData(0, 0, width, height).data
        };
      }

      const actual = this.ctx.getImageData(0, 0, width, height).data;
      const blankData = this._blankCache.data;
      for (let i = 0; i < actual.length; i++) {
        if (actual[i] !== blankData[i]) return false;
      }
      return true;
    },

    // Permite re-firmar un documento y precarga la firma anterior como guía
    signAgain(doc) {
      Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro que desea firmar el documento nuevamente?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#f44336',
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

    // Decodifica base64 (UTF-8 safe) a texto plano
    decodeBase64Utf8(base64str) {
      const binary = Uint8Array.from(atob(base64str), c => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(binary);
    },

    // Envía todos los documentos firmados al servidor vía socket
    sendDocuments() {
      this.allSigned = this.documents.every(doc => doc.signed === true);
      if (!this.allSigned) {
        Swal.fire('Faltan documentos por firmar', 'Debes firmar todos los documentos antes de continuar.', 'warning');
        return;
      }
      window.socket.emit('saveSignature', {
        documentsSigned: this.documents,
        session: { projectId: this.user.projectId, userId: this.user.id },
        asigTo: this.user.id
      });
      Swal.fire({ title: 'Todos los documentos han sido firmados', icon: 'success', timer: 2000, showConfirmButton: false });
      this.$root.changeComponent('home');
    },

    async loginForm() {
      if (this._submitting) return;
      this._submitting = true;

      const projectId = String(this.user?.project ?? '').trim();
      const name = String(this.user?.name ?? '').trim();
      const idRaw = this.user?.id;
      const id = String(idRaw ?? '').trim();

      const missing = [];
      if (!projectId) missing.push('Plataforma');
      if (!name) missing.push('Nombre completo');
      if (!id) missing.push('Número de documento');

      if (missing.length) {
        await Swal.fire({
          title: 'Campos incompletos',
          html: `Revise: <b>${missing.join(', ')}</b>`,
          icon: 'warning',
          allowOutsideClick: false,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#f44336',
        });
        this._submitting = false;
        return;
      }

      const tabletUser = {
        projectId,
        name,
        id,
        createdAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem('tabletUser', JSON.stringify(tabletUser));

        await Swal.fire({
          title: 'Vinculación exitosa',
          icon: 'success',
          timer: 1600,
          showConfirmButton: false,
          allowOutsideClick: false,
        });

        location.reload();
      } catch (e) {
        await Swal.fire({
          title: 'No se pudo guardar la sesión',
          text: 'Verifique permisos del navegador o intente de nuevo.',
          icon: 'error',
          allowOutsideClick: false,
        });
      } finally {
        this._submitting = false;
      }
    },
    toggleSelect() {
      this.selectOpen = !this.selectOpen;
    },
    chooseOption(opt) {
      this.user.project = opt.value;
      this.selectOpen = false;
    },

  }
});

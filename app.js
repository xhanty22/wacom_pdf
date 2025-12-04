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
    canvaIsNull: true,
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
    groupDecision: null,

    // Presencia web
    webPresence: { connected: null, count: 0, lastTs: 0, offline: true },
    _onWebPresence: null,
    _webPresenceTimer: null,

    // Otros flags internos
    _submitting: false,
    _blankCache: { width: 0, height: 0, data: null },

    zoom: 1,
  },

  // Al montar: hotkey limpieza, validar sesión, iniciar socket y carrusel
  async mounted() {
    // Hotkey debug: Ctrl+Shift+D para limpiar sesión local
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
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
  watch: {
    zoom() {
      this.$nextTick(this.syncScrollArea);
    }
  },
  computed: {
    syncScrollArea() {
      const scaled = document.querySelector('.viewer-scale');
      const spacer = document.querySelector('.scroll-spacer');
      if (!scaled || !spacer) return;

      const rect = scaled.getBoundingClientRect();
      spacer.style.width = `${Math.ceil(rect.width)}px`;
    },
    viewerStyle() {
      return { transform: `scale(${this.zoom})` };
    },
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
    },
    // ... lo que ya tienes
    hasGroupDecision() {
      // ¿Hay exactamente un batch con decisionScope='group' dentro de la selección?
      const batches = Array.from(new Set(
        (this.selected || [])
          .filter(d => d.requireDecision && d.decisionScope === 'group')
          .map(d => d.batchId)
      ));
      return batches.length === 1;
    },
    groupDecisionBatchId() {
      if (!this.hasGroupDecision) return null;
      return (this.selected || [])
        .find(d => d.requireDecision && d.decisionScope === 'group')?.batchId || null;
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
              }, 500);
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
        timer: 3000,
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
      this.changeComponent('home');
      // try {
      //   this.selected = [];
      //   this.allSigned = this.documents.every(d => d.signed === true);
      //   if (this.currentComponent !== 'files') this.changeComponent('files');
      //   Swal.fire({
      //     icon: 'info',
      //     title: 'Sin conexión',
      //     text: 'No se pudo restablecer la conexión.',
      //     timer: 2000,
      //     showConfirmButton: false
      //   });
      //   this.changeComponent('home');
      // } catch (e) {
      // }
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

      // Si ya están todos, deselecciona todos los NO locked
      if (this.selected.length === unsigned.length) {
        const locked = new Set(this.documents.filter(d => d.locked).map(d => d.id));
        this.selected = this.selected.filter(s => locked.has(s.id));
        return;
      }

      // Seleccionar todos: incluye grupos completos y docs sueltos
      const batchesSeen = new Set();
      const next = [];

      for (const d of unsigned) {
        if (d.signingScope === 'group') {
          if (batchesSeen.has(d.batchId)) continue;
          batchesSeen.add(d.batchId);
          next.push(...this.documents.filter(x => x.batchId === d.batchId));
        } else {
          next.push(d);
        }
      }

      // Unicos por id
      const uniq = new Map(next.map(d => [d.id, d]));
      this.selected = Array.from(uniq.values());
      this.syncLockedSelection();
    },
    preselectGroupDocs() {
      // agrega a "selected" todos los docs cuyo signingScope sea 'group' (por batch completo)
      const setSel = new Map((this.selected || []).map(d => [d.id, d]));

      // agrupa por batchId los que son de grupo
      const groupBatches = Array.from(new Set(
        (this.documents || [])
          .filter(d => d.signingScope === 'group')
          .map(d => d.batchId)
      ));

      groupBatches.forEach(batchId => {
        this.documents
          .filter(d => d.batchId === batchId)
          .forEach(d => setSel.set(d.id, d));
      });

      this.selected = Array.from(setSel.values());
      this.syncLockedSelection?.(); // respeta locked
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
              this.zoom = 1;
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

                    batchId: doc.batchId || 'consentimientos',
                    decisionScope: doc.decisionScope || 'per-doc',
                    signingScope: doc.signingScope || 'per-doc',
                    editScope: doc.editScope || 'per-doc',
                    locked: !!doc.locked,
                    html: cleanHtml,
                    signed: false,
                    status: false,
                    signature: '',
                    base64Str: base64str,
                    base64: doc.base64,
                    editable: doc.editable,
                  };
                });
              }
              this.selected = [];
              this.preselectGroupDocs();
              this.syncLockedSelection?.();
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
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.ctx.beginPath();
      this.ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    },
    draw(e) {
      if (!this.isDrawing) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
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
      this.validateCanvas();
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
    addZoom() { this.setZoom(this.zoom + 0.1); },
    lessZoom() { this.setZoom(this.zoom - 0.1); },

    setZoom(z) {
      const prev = this.zoom || 1;
      const clamped = Math.max(0.75, Math.min(1.5, Number(z) || 1));
      const next = Number(clamped.toFixed(1));
      if (next === prev) return;
      if (next >= 1) {
        this.zoom = next;
      }
    },

    // Guarda firma(s) en los documentos seleccionados y regresa a la lista
    async save() {
      // ---- NUEVO: Validaciones de decisión ----
      const selected = this.selected || [];

      // 1) Si hay grupo, la decisión grupal debe estar definida
      if (this.hasGroupDecision && ![true, false].includes(this.groupDecision)) {
        await Swal.fire({
          title: 'Falta decisión del grupo',
          text: 'Selecciona Acepto / No acepto para el grupo.',
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#f44336'
        });
        return;
      }

      // 2) Verificar decisiones faltantes SOLO para docs per-doc
      const missingPerDoc = selected.filter(d =>
        d.requireDecision &&
        d.decisionScope !== 'group' &&
        ![true, false].includes(this.decisionTmp?.[d.id])
      );

      if (missingPerDoc.length) {
        await Swal.fire({
          title: '¡Alerta!',
          text: `Debe aceptar o rechazar el documento: ${missingPerDoc.map(f => f.name).join(', ')}`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#f44336'
        });
        return;
      }

      if (this.isCanvasEmpty()) {
        await Swal.fire({ title: '¡Error!', text: 'Debe firmar antes de guardar.', icon: 'error', confirmButtonText: 'Aceptar', confirmButtonColor: '#f44336' });
        return;
      }

      // Confirmación de guardado (igual que ya tenías)
      const confirm = await Swal.fire({
        title: '¡Confirmación!',
        text: this.documents.every(d => d.editable === false) ? '¿Está seguro que desea guardar? Al guardar su decisión no podrá modificarla.' : '¿Está seguro que desea guardar?',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#f44336',
        cancelButtonText: 'No'
      });
      if (!confirm.isConfirmed) return;

      const signatureData = this.canvas.toDataURL('image/png').split(',')[1];

      // ---- Aplicar firma + decisión a cada doc seleccionado ----
      const nowIso = new Date().toISOString();
      const groupBatch = this.groupDecisionBatchId;

      this.selected.forEach(sel => {
        const doc = this.documents.find(d => d.id === sel.id);
        if (!doc) return;

        // Firma
        doc.signature = signatureData;
        doc.signed = true;
        doc.status = 1;

        // Decisión
        if (doc.requireDecision) {
          let val = null;
          if (this.hasGroupDecision && groupBatch && doc.decisionScope === 'group' && doc.batchId === groupBatch) {
            // usar la decisión grupal
            val = this.groupDecision;
          } else {
            // usar la decisión individual
            val = this.decisionTmp?.[doc.id];
          }

          if ([true, false].includes(val)) {
            doc.decision = val;
            doc.decisionAt = nowIso;
          } else {
            doc.decision = null;
          }
        }

        // Restaura placeholder y agrega badge si aplica (igual que ya tenías)
        let restoredHtml = doc.html.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');
        if (doc.requireDecision && [true, false].includes(doc.decision)) {
          const aceptado = !!doc.decision;
          const etiqueta = aceptado ? 'ACEPTADO' : 'NO ACEPTADO';
          const color = aceptado ? '#4caf50' : '#f44336';
          const fecha = this.formatDate(doc.decisionAt) || '';
          doc.badge = { label: etiqueta, color, date: fecha };
        }

        // Re-encode a base64 en UTF-8 (igual que ya tenías)
        const utf8 = new TextEncoder().encode(restoredHtml);
        let bin = '';
        utf8.forEach(b => (bin += String.fromCharCode(b)));
        const newBase64 = btoa(bin);
        doc.base64 = 'data:text/html;base64,' + newBase64;
      });

      // Limpieza y salida (igual)
      this.selected = [];
      this.groupDecision = null;            // <- reset decisión de grupo
      this.allSigned = this.documents.every(doc => doc.signed === true);

      if (this.documents.every(d => d.editable === false)) this.sendDocuments(); return;
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

      // Máximo 1 grupo a la vez
      const groups = Array.from(new Set(
        this.selected.filter(d => d.signingScope === 'group').map(d => d.batchId)
      ));
      if (groups.length > 1) {
        Swal.fire('Atención', 'Solo puedes firmar un grupo a la vez.', 'warning');
        return;
      }
      this.$root.allSelected = this.selected;
      this.$root.changeComponent('signature');
    },

    validateCanvas() {
      if (this.isCanvasEmpty()) {
        this.canvaIsNull = true;
      } else {
        this.canvaIsNull = false;
      }
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

    editSelectedGroup() {
      const groups = Array.from(new Set(
        this.selected.filter(d => d.editScope === 'group').map(d => d.batchId)
      ));
      if (groups.length !== 1) {
        Swal.fire('Atención', 'Selecciona exactamente un grupo para editar.', 'info');
        return;
      }
      const batchId = groups[0];
      const docs = this.documents.filter(d => d.batchId === batchId);
      docs.forEach(doc => {
        doc.signed = false;
        doc.status = 0;
        this.signaturePending = 'data:image/png;base64,' + doc.signature;
      });
      this.selected = docs;
      this.allSigned = false;
      this.changeComponent('signature', this.documents);

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
    // Mantener locked siempre seleccionados
    syncLockedSelection() {
      const lockedDocs = (this.documents || []).filter(d => d.locked);
      const lockedIds = new Set(lockedDocs.map(d => d.id));
      const keep = new Map((this.selected || []).map(d => [d.id, d]));
      lockedDocs.forEach(d => keep.set(d.id, d));

      // Limpia seleccionados que ya no existan
      const validIds = new Set((this.documents || []).map(d => d.id));
      this.selected = Array.from(keep.values()).filter(d => validIds.has(d.id));
    },

    // ¿Es doc de grupo en alguna dimensión?
    isGroupDoc(doc) {
      return (
        doc?.signingScope === 'group' ||
        doc?.decisionScope === 'group' ||
        doc?.editScope === 'group'
      );
    },

    // Checked/Disabled del checkbox
    isChecked(doc) {
      return doc.locked || !!this.selected.find(x => x.id === doc.id);
    },
    isDisabled(doc) {
      if (doc.locked) return true;              // locked no se toca
      if (doc.signingScope === 'group') return true; // bloquea selección individual de grupos
      return false;
    },

    // Toggle de un checkbox
    onToggle(doc, ev) {
      if (this.isDisabled(doc)) { ev.preventDefault(); return; }

      const checked = ev.target.checked;

      if (this.isGroupDoc(doc)) {
        // Si es de grupo, selecciona/deselecciona TODO su batch
        const batch = doc.batchId;
        const groupDocs = this.documents.filter(d => d.batchId === batch);
        if (checked) {
          const setSel = new Map(this.selected.map(d => [d.id, d]));
          groupDocs.forEach(d => setSel.set(d.id, d));
          this.selected = Array.from(setSel.values());
        } else {
          // quita todos los del grupo excepto locked
          const groupIds = new Set(groupDocs.map(d => d.id));
          this.selected = this.selected.filter(s => !groupIds.has(s.id) || s.locked);
        }
        this.syncLockedSelection();
        return;
      }

      // Individual
      if (checked) {
        if (!this.selected.find(s => s.id === doc.id)) this.selected.push(doc);
      } else {
        if (!doc.locked) this.selected = this.selected.filter(s => s.id !== doc.id);
      }
    },
    toggleSelect() {
      this.selectOpen = !this.selectOpen;
    },
    chooseOption(opt) {
      this.user.project = opt.value;
      this.selectOpen = false;
    },

    getScrollEl() {
      // Prioridad a ref si existe en el DOM
      return document.querySelector('.viewer')
        || document.querySelector('.page-signature')
        || document.querySelector('.content-page')
        || document.scrollingElement;
    },
    // Paso hacia abajo/arriba: dir = 1 (abajo) o -1 (arriba)
    scrollStep(dir = 1) {
      const el = this.getScrollEl();
      if (!el) return;
      const base = Math.max(200, Math.floor(el.clientHeight * 0.5));
      const step = base / (this.zoom || 1);
      el.scrollBy({ top: dir * step, behavior: 'smooth' });
    }
  }
});

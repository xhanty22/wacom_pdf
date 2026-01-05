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
    // Canvas responsable (segunda firma)
    canvasResponsable: null,
    ctxResponsable: null,
    isDrawingResponsable: false,
    signaturePendingResponsable: '',
    canvaResponsableIsNull: true,
    _blankCacheResponsable: { width: 0, height: 0, data: null },

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
    // const demo = [{
    //   "id": 10,
    //   "name": "Tratamiento de datos personales",
    //   "base64": "data:text/html;base64,PGRpdiBzdHlsZT0idGV4dC1hbGlnbjogY2VudGVyOyBtYXJnaW4tdG9wOiAyZW07Ij48aW1nIHNyYz0iZGF0YTppbWFnZS9wbmc7YmFzZTY0LGlWQk9SdzBLR2dvQUFBQU5TVWhFVWdBQUFSUUFBQUJYQ0FJQUFBQktxUzFZQUFBUUFFbEVRVlI0QWV5ZERZeFhWWGJBLzdYcUFoVllrWTBNeWhpQlpNWUIyejhRMlRwREN0MkZaSFFWRTZTTGl6VXJzYU5yeTFLVG1USW1iRFJ1U3RLaG1OaVIxRjFJQTQzQ3JpdGo0NndmcEROYTJNeE15eGh3R3BnUkVoalRRUmphZ3BSWlZxanUxMi9teU4zTCs3anZ2ZnMrNW9ObkR0Znp6ajMzZk4xejdyM3Z2Zi8vUDlmOEp2OHZqMEFlQWFzSVhGUEkvOHNqa0VmQUtnSjU4VmlGTFIrVVI2QlF5SXNuejRJOEFwWVJ5SXZITW5ENXNERVhnY2dPNWNVVE9XVDVnRHdDRW9HOGVDUU9lWnRISUhJRTh1S0pITEo4UUI0QmlVQmVQQktIdk0wakVEa0MyUlhQbnI3K3pWMUhnRmVQOVoyNDhHbGtTL01CZVFRaVJTQjk1aXlLcCtQMG1ZVzdXOWE4MS9sODExSGdxYllQdUh5bTgzRDYzdVVhOGdpa0dJSFVpNGZLZVhCUHUzdXIyZFp6bkNwSzBiTmNkQjZCbENPUWJ2RU1mUFk1RzQ2ZkM1emZBTC9lbkQ2Mkk4RFVjNGJYZ1lOOTl5Zm5SNUhYNlJiUE8zMzkxSThoSE50NmVnMjllZGNZanNCUGpwM2dESzhENit6UzVyMmNVMFpMQ2FWYlBPN1RtaU1ia2dyVHhZSHpyOVd2Zlc3KzdVL1BuZ0kwM3IvNFFOTXVoNjc4Y2xSRWdIUCtYN2Q5NERaMUJGTFNMWjd1VHdZeThQblVoNGMyTFNsU0xaU1FxSU5DTFFGeW1iZWpLd0lzcVpUUXlMYzUzZUtaTTJWUzJpR2dZTFk5dkp6V3JZaHlhbTFzY05QdEtHeG9kZ1B6VVJZUnlJdW5VRGx0cWpsdzFhVWxab2JBWGlyRXMzSmtJTVZqNkJXZXZNMGpZQmVCZEhjZWlnY3dXRlpYTERQMGh1bnFhWDNIek5iLzRTRXpROTZiUjhBdUF1a1dEelp0LzlyQ09WTW1nN2poaFVYei9McmN6TmFVM3YzdDFtUHpnYWxGWUN3SVRyMTRKbDEvM2V2VlZUVVZzMEJVd05pT21xcXJWczB1VlpUMGtKSTc1cVluUEpkc0hRSFdUZExBRDJiY01NRmFjbVlEVXk4ZVBLRnN2cjl3N3RIVjk3WXVYMExOZ05BU05icml3L1NLTzgxQ3B0OFJ3R0FlbnZlbUZBRlNnalR3ZzJ3VzFwaXVwVnM4dkVYbW5WZkpqamNFZUg3UG14OXFLYWJSK3ZDcWJ6OHhmcEwzc1JDMkJRK3V2dkhXTFBZM2RPVnd0VVVncmVJWitPeHp5dWFwdGc4NlRwOVJNZVg1UFpTRnUxc29La1dNaVZBYjkyM1k2Q21FUGNldnk1TS9leUpMeVo3TEh6Ym4vVG9SQTBEa1F5dUVEb1pFckVJVU1VZnNNNTJIVWFHQTZZQUl3TURzSktJclN5SEVCOHV4SHlCdXlpOHVBV0ticWxOcEZjK0tQZTE0NVJsSEhHYk9FaXdodHBkMVA5MDM4NnVMbERyMm9xWHI2bXQyTm9NbzRzaEJtRkdTbUFnQVRMbDhSSVdaSm1JQWlGQklCUmdBbUFtYWhmMklRajdiUHFLSU9XSzM5UnhIaFFJcUNpSUF3OUxtdldXNzNvWWZZbVJkMmdEV1RmU1N1eUlUN1RxZ1duanAxZW1DNHl3RGhjSFE2Z0ZFRHZZREtFVzRBSmNBdm9oVCtFNnZRYUJkVnlyRlEvUnh6MndRMllCTGVJNjNaczR3dld3eWorOXNmdmJnUjdRQUNNVXpBaXNIWjNHWkdTV0ppVUFZMTJDRG1hd2lYT0JoaHNDRElvYVFQWkdTUnZJZVJWUlJtQ1JHa1E3TU85NHhGcjNrTGpZRXBvRStIQndIR1lnQjRKNkFRRlJFQ2lCT1lSZ21FUkFRVDdGMnhPU0xCMXZ4UDZRMXhKZFlBQ0FoaHhqWXFCYjJIOERBTTF4ZGhJV2NpT01wRTAvUzBBYTZ3RTZGSWhJeGtOT1BBV3VaUk5TUnJINDhPaDJycUJrY1RHUWVrZVpwUFBXTVNkWXFrSW1GUkFidmRPT3Q4ZVNMWjJ2UGNheU1aQkRod0NYV2hxZ0RJMmtaUm1abWkzTXNPUkhUQnVRdy9XWTVNTEJUeFZRa3c2a2N6S2FWUzgrV0tTT2hVWXB0bmd4MlJQZUdpUXJxMlU2YVBvcGt1MnQzaTlrcG5kK0FKMXc4UkhDYjdiY01pQmNiS3pGaVBnd1dqN291WWhLWWdwR2NJa1IrOWNQYTdOY1ZTWVZpeG5nV05WcEYwUkZTa01xaDFZbUo0T2MvKzF5WFkzQlpad3VKNDQ3QnFaQkNZRXU0ZUxiMkhNY3k1Rm9EY3k4bEZGT090UUdKRDJTZUVrOHZrc2t0azBVbmtiVzVVQ2pvUVVBczA2cFRCTWNBRm9VTXBvbFZsYXdRcFVtMU9NV0xrNWpTa2l3ZTRyak5kdHR4dUVHdzJGdFpSNUhwNkJwZGw3akFPU0VObTkxem4wYmxpT1h1YVdWZXNxa2NET0FXampaeG9DWmpUazJTeGJPNTZ5Z3hUY3BKUkpFTklVdm8xSWVIMnJhLzlGcjkyb1lseGFlSHZnLzMzUHpidWV6ZDM1YVVQUlp5Y01HZGRoWnlQSWV3OExQRXFDNTA2WmVLN2tiMHo4V0UvQlFNd2trMVhSU2xDMUducElTamwxM0NMQnd2VnMwdXJTMldLYWd1TFFuekxwNEVNMHMyOXlaV1BIaVkxSDJxYmpFemhJZVVrQ016TGc2YzcyNTVxN1d4WWV2RHk2bVd4dnNYdjdseHc0R21YZWMrN3BQaE1IQkpMM1NoWk45dURYZUlaZTVyS21hOXNHaGVVM1VWTFRpVU1OWnUwL2I1ZC9yNnpVT1FpZkQrUngrUUQwbWhDK2hjdWV6bzZudWgwMnNlZmxqN2RZR08wMmZJYVROL1VyMTcrazRiUkZFaDI3KzJFQzl3b2E1WXJnRGkreXVYMVFaOVpoOUh5RnVEZkhOWFlzVkRpcHMxeGVtbGhEamxjeSswNWQvYXR0Y05iaTlzTEM4LytRakZFN2kzc0NNTlYvM295ZTNuL3ZjWHptWHVhVms3SzZkTnBRV0hFamp4Q0dUekFVQ0Fmejk5bHRZUHFBMXFCdUZ1QnZJUE9yMGc3bDVGNmRhK0ZKenFYQ3VOZ2h6V2lsWW9lbHRUTVpOTlJxY29ISGZxaXVXMVFmVVRaeFZJcG5nb1g4Zk9vSHhJRUVITHh2ODYrOHowZVc5Y21uRDBGNFd6Vnp5UE1lbWhmZ0pyekRUZXFvOVpvZWJOUTFrdmF5cG1lZkxVRmN2cDllelNpV3JEdVh2YVRiWGF1ZVZLdkF4UkpKTSswSUhUVzFNeDAwSFVMNVV2bENzTHR0N2xoeU96Y3RwVWh5V1VzUisvSngxMW5uUWh6dlg1dG92MDBqNSs1Y2Y1b1RpZ1cxc1VIRjJCbDhrVVQ1WkwwUytuVFAzb08vVmRmMUYvNE9ieW41MHJkRjhvblB6L3dxVmZCM2g2NFBVZkIzQWszVzArYjZDdHBtSVdTejZJSDlEcnQ2eXFJV3JEZ2JsT083YzRjSkpZRFltSnZIcnNSS0FFeW9aeTVVRFlWRjNsc0NScThaaDFCUnFESmE5WFY5SDZ5V0ZGOXVzS3BDZFFQQjJuejd4NjdJczdqVUI5U1RGY21sWGUvNWYxd01uUzh1T2ZGanJQRnc0T0ZFRDhxaWo3bllld21KME44eTFham5DMS92c0pYWGRQdThtc0pXUXZHOHRQUWxRRjBnTDk0b0VFOXhzVU04eHBBOXM3NTNtTU55akNIc3FZdXlEQzVZWnZ6cDVoR0d2dVNxQjRzdHgySE01SUNmM3ZRNCt4SFYzNDFlQVdSQW45OTJjT3JzRkxIaVR3Q0dFUXkrUWYwMmxlMGxiTkxqVXNoOHBHMXVrNi8vMUV1aFN6TlVJOThLN1RiTEFJeHkvek9RcW5TRk5hNGMrZ1plSEdlQjVXWVp0QkhYdTRoTXZSTWhHR1VlYXV1TVZEM0FHempyUjdMOXkxNk1TR3Y2ZEYwUzkvVStCMnlMTitzdHg4RGh0dmM3RXpxUjBEVVJaQW5UQnJwQjNMTm85aEh0emo4WHZJbm1JRC9hcXBtRW5CZTQ2MUk3SnZCQTdFSGQ0RmxlMTZlMm56M3MxZFI5aU96SVVVS0RBa1E5emlHY1p0eCtFaCs0L1VEM1RPYjFRUmlBNzlIMmIzMC9KTXA2N2FqVmNHL2E2UWU4anZLQkV4aktGT1NDK0toRklwMmZFR0xUaVZBNTNlOFBMTTJ3NXk0aXprREhkRHBFQmhIZ201NXIxT0Nna2ZRZGlSSWpub05zQkFpVlU4bERnTG1FRjZ4bDFuSC9nVzV6ZVVVams4UlFEUm9YZC9kcjhFRWpoaHlTN1B1cHNLSjVNb0dISUlvRTVJSXlZcjBEQTEzQk54Zk9UTXdZTlRnSU1ZODNMVmJNdDdFandsUDFVRVFBaElUR01jdzJNVkR3WTV4QTN2NWEvSFQvaDA3bnl4NGF6cnpxZDNXRDl0SUZaSk95Zm9BYXV3V2JjVUNSc0xaeGdLaGh5eWx1TWUrUEdGaTI2aW9pUmVPVWdtVnZGM000SkFLQWdJNndoSVVvYzYrK0tKdXVNVGlBemdGM1BuaVJhZUh3aWl0NmRHeG0rNFRiNytPdDJxWkhGV05DcUgra2xXckVnakN3WEpzdVdSWTFKbGlmM0U1NjdkTFpSUWZCZnNpNGZEWlh6MUdVdm8vWS9oL0toYjJzNnlvTEs0SnBJV2Fac2FTVDdQN3BKOWdrZWdLQ0dXR0pCSWxqaVlMWXRuWkc0N0R0L2NsLzFIdXQzRVlhY2taUUFKWVhlczUyakU2azZDSm1WSjRuS3drSGRIa1I0ZUJOckE1cnhpVDN1YytyRXBIdlF4VDRIR0RRdkR0Wjk4OFdNOU4veStoLzZSYzl2allWdzhFamZIckdqaFpiQ2M4K3JqaFVYek9sY3VhMTIrcENib1l5emhKYWZFaWNGTlF4K2NUZW9JaDUyc05adTdqb0xZZ1UzeGJBMzNZV0U3ZzJLT212aitGNC9VYnY2U2g2U01YNVY2V0RCRTR1UTk5UDhrbXpETEdmbkh6YmNVakx4MDV6TEJYRXpTSHg5WkdFeTE0d0tWNzhNU2pjd3AxM282SWhjUDI4NDI3WlB3MFN4Tm1YdkM0WVBqamg5QnliaHJDamRmei84OUlKdk54L3hJd0hxMlBQd1pJckdDQnNxc0xaWng4aUh0eUwvUlZUQkRMbDdSNEFLSFRPb2ZkOWd6T2RSZDBSM3h3anFmSXhmUDFwRzY3VngvcXU4clAvNG40bmJ0N3hVcWJpalFncnNobTFlbGdkTVptT3R1eXcwVTlkbHFQeDZTcks1WXpzN2p4ekFhNmJoREZYRzN4ckZUdnFlRW0xQ2lMZzBkMnU5eVJvcER0T0labWRzTzl6bVV6UzNQUDN2TnhVOXZ1cTZ3Y0hMQjg0Wkg0dEtiK3F2U1FUMkI4MmM5WVlQU1hmL1VaNnRkUFlNRThna1l4SXovMkw0TS9XU3FvWGNrZExGZzRTYjF3N2tPcUMyV0JjNkNtRzEyWEhnODIyakZ3OEdhK3ZFVWxEMlJROXBOYi94b3hzYS9BVzU0djQyajJoOU5MTXp4MzNQRXd0NU1YcFV5YmVac0MvekNnbGdic2pXLytQL203RkF2NlR1TVg2ZWJrLzRmK1hNNHkrYTh1ZXVJQVdCd0RGR1h4TCt1V0U0SlVVdm1pVkJETEpBSXhZT3RrWjduV0ZnVE9JUk5adExQL3ZYbTdTL2VYcnVHRmh3S28yNGJYNWcvcVRENVd0Qmd5T1pWcWZsN1dqd2NJNTdCdGc1eEVIWnlpUGNTYmxqelhpY3M1clhUZkFQR2NJQTFFWk5BL0NDTUVMK3hkblRpdzd0RUEzU0VPRzZ0bWwxcS9qNlBuVzB5S2tMeDRJYU15YjdWTnhsMkd5NlZEVisrZHZDY2R0czQzNXNjeGFtUWJGNlZWcGRPVXhvOUViWnhUN3BPSktkNTcvbFUyd2NFbjF4eGc4N3NoNXYzSlJtMU9laUo3WnlVUDFJa1p1aXRlZldCMDN4WWhVRUF5eWtod1pOdHd4WVBzOGo2bDZ4dXN6UzJGRFlXdGhmSEpxTkc4VWlnN0E4S2Z6aXh3SUZORWNNZzJid3FyUTc2YzZ1czlPYVFFblBlNHBsM2xlcWhFdVdVWW5BODhJaUlHVHl4TlVpZ3F6TERqNEdqRGdnOGJtRTJ1eE9jZ1VBa0RUeUJpdnpHaGkyZXdDOXkrQ21JU3VkWk0zc0x0ekVBaUw3SjZLSnUrZExnaHVQM1BGcm5kT1BSYm52YzQ4TlJTR2pXUERNdld3cjdqK2ZVVWxwM2hmaFYySHVHU2hSZEJrVWttYUVDS1J2TU1BeW5xM3BJQzBqR0VGaXhuRm9ENndmZnpVOGpBN2M0UDYvREZnOEhCajhSOGVuTS9SMy9jNEpONXJidi9WWEpQemF3NGJEdCtJbmxTUm9QQm1aTmlIQk9jNGpLN0ZWcGpmRW5OY1FxY3BjaUlRazJkeDBoeTdta25CYnVib0hpV1ZReVNscE9JN0pxbXFzVU9TdjJ0Q05jUmtsTHprRkJFZXFFWW1pdHZ4ZGdrQm1teSt3WEVpZ01qcldFRG5lNGRBQ080eU8rZ3ppNjlNdnFvZDFicDRURXd4YVBkWFVhN0tpY05sVWUwdk5VNUwzMWE1KytmNW1rZ3Q4UXptblVUUGdIQTM1eW9HZXorWkRjckF1b013TlR5ejdEWFEwN0FLbE0vWGltZ2x0STdlWGZWYW9NK2lVRFZDQmN2Z1pIdGdrQ0pZd2lNcmg2bUhhZU1Lc1ByaEU2Vm9HeVhXL3JEMVJ3RXdvK3d1QU9uVTZ4OWk1czhSQkJYWjgxVGpLUlV2SjZ1R25vRC8wcXlRL1YxZS9jdCsvdVAvbmQzNmpTdGZBQ2g3TGh0S1lUcmZGc1hwVmlIbzlLYWRPQW1vcFpCRk1rTS8wS0Y0cGZTN1d3V3Z2MWV0Slo0RHpwR1JCeEN0ZENLcUpJT2s2ZlVSRFNUYklSTFNGVk9OakNGZzhLMkNnY2c4TmZNcFk1NEUwd213ejVSRVE4TjVtdnpDaDkvbCthTjcveWNrbHBxUkxPcjI1MGF3QUFDWXBKUkVGVTh3RE9hYnpBQVZIRW1FaHZKcTlLTVJMSHlYS1FaSUVWeC9Iak8yb1hTbFlSWW5FaFdabVJwSkUybnFrU1NZZ2ZNNUtSNzljYlNBOWJQQWhDRGNwQVFnTDFSbGw3YmpKbUNaWDNmT09WZmZzZVcxOFAyMjNqQng4TWhIeUJBMzhnQ0VOdkpxOUtSUmR4STljRlQ2UmxGdjVoMFR4YVhScWhUanpMa1ZsWExOZTFaSStUUlRpYmtsNlMweEhHU0lvaUZBOFpRQjRFS29PdHRsZ1d1TW1ZclJ3L2FmSmo5ZlZ2L1dmWG55NzJQc1daaDRmcHplWlZxVmpDZTdyS2hCNzFFbitrRVdTUnJMZWtnaWRkNXdtUE00bWNFY0x6cDhmSk9RVkxjRHhCRlVnalhERW5KVUx4WURwTEVUUG5Wb2twZE9IaDBkWDNValoxeGZKRVp2SEdXMHNmMzluOFp3MWJxQ1cwSnd2WnZDb1ZtNGxQVTNWVjdlWDdleUZhdEVTVjhOSjZqa1VMcytQWDZ6bkVrOGhpajdWMXhXSGVjM1RieUs1RVhCT1psZE9tRWtacVVpNnQyMmpGZ3hybWhzaktyVXR0c1l5OUNEdW9HU29IRDVrL2VKS0ZCUSt1WHIrM2E5R2FKNU1WbTgyclV0M211bUk1c1dMbWRHSkluTUJLcU1sc3d4RFlVRkZiTEFNeHNQbDFNYm5NSTVOclo2U2YyRVRvMkNhdW1TTmcxb1ZmWkM4UVI0aFNFYmw0WkNTNktaVzZZamwzdzNnbHhQUmFkcDc3Tm14Yzk5TjlDZjZ4M3Y2ZVEra1o3Q2VaV0RGekpBRnhJNForYkRxZElTVDAreXVYTVVTbkczRG1CWDZLamJFR050VkZTc0ZNeldBWTA2cm9iZ1NCTVBzQnZlNGhmaFNZL2VSQTl3c09ybUVuSnk3czlPTnhhR1FkWVpNUkJ3ayt3aDBNMXBlV3hXT3RMODVBK1h2eFZCRzFkRm1PL2YrNTU3azRjTjUrZkl5UjVJM01KWG5BZE5aZS9qVnE1aFVnTFlSQ0YxdTZKRFFaRUVraC9CUWJZNUdBSE5TSlROVkNnWTRCL1k4K0FBSnptRnlVVWZCN0FyM2hqWVRaVTRnUUNZSkJGTVhBZ29MeDRoMURsRjhLZ1FqQUFGQnNJUjAwS0hWM2phYmlFZXM1djNHSzR5d25sM0hhL3VIK0pTcnlsV3FwdS94cjFFdzJRRm9JaFM1cUlJNkRqRVVDY2tnZGthbGFLTkF4QUo3UkMrSWRqaWkvRkFJUmdDRTk3MFpmOFJBTGRoNmVJdkFzZ2IySVMydm96ZXB0ajdXRitjQ1JISUZSV1R3U1VPNS91QXRLNmhRbk1nMHQ2Z3k5ZWRkVkdJRlJYRHd5VzV6aTFqWHZtN1BzRzNLWlhzdEdsN2p3M3YxdHJZME5JY1Z1ZlhoNVNNN2hZbnQ2OXBSSXF0MGVFUTFpNGllRVhzQ3YxNEtPTklPNlFJRWpySGdDN2ZWaTRIWFFJeSs5VEhLRGVQWDcwbVordGNxM0wrL3dqOENCcGwzK25WZFJ6MWdvSHBrdWpsWDFlN3VXcnF2bmprZ281cFpLWTRpWkorOTFSK0RjeDMzWi80MUt0eGtqZ1RKMmlrZWlTZkZ3aWd0VEZXeFdNaVNsbHVmZ25BcmF0cjhrOHJsOHJYN3RjL052QjBDNlc5NGlDNldMVmwvTEZjNkpvdkgreFp5RmFPR0h6UUhJVnhRWWRJRkNSenM4cU9hUzlzMk5HOUFPdlB6a0kxeENCR0JvV0ZKRUMwUTBBaENWRFFxSGdueVlXWFFXckhnSU9zRGpma1l4Rmdub2dpS0FFR3lHVG90aGpCVTZPQlJGRjZKbml5NGxHYVZLd3JtVEozUzZHdXNwbVZGWUFzRG1NSlV1aURGaHJCVVA0V0IyT2NKUkd5QmN1b0d0aWQ2WVQrcmNZaDJVZDEvY0JPV2p6ZzZadkcwUEx5OHBuL1Bzd1k4QUVETGczTWsrR0FUMHRWeHdKcHNhVzdscHk5OGQrd1JyMzIwY2xDYk1xajEzOGdSSnd5V1ZRR0dNbXpRWlhBRjZlMXJmR1RkeFV2dU9IMERjWGI4V05yVHpvSjh1QUNLakVNSnlnNWI1S3g3aUpxUjM2QW1rMkFBRElEanQxajlmampSRmtmeXVldlFKeGlMaDRPVS9tZHk3diszTnY5MmdXODVZUm1FcVh1QUwvTFRnRUQwQk94dVhMOFllT0pHTWhZUkNPRW42aXFYM0tEcjJRM2RMaGdLZFhpd2hMRzVUbFVEWXJHRU1Gby9FZ2tjSXhKMk5TQzhoeW9ZWFJORHBGYmIwMmk5UHY1VlpKMHZZQnNtbmtvbzdlYlloNmtBZ0N1N1h0dS80SVE4U3BjSnhBVGx1enFYZlhROGI5UFlkUDFpdzRsdDRCNjZBcExrMGNCNVBDUUxaQS9COG43eWtqSkVNSFp3a2d5Z0RvV0NZR3U1R3FyNzloTTdRL3MrREZvb2pTS2paMlN4RDJuZjg4T3ZyMXJzdHA3cFdidHFDTDdEUmdvTjRBaFhDTkdFUHZVakdRdmpCQVF5Z0MwVG8ySThYRHNuRUNodmdvUXVyc0FSVGlaWGJWSGppUUxyRkU4ZXkrR09KTDNuRGpSREFYc1J6YmRaZGZTYmlxekJJWUpwdnZHVUdweFN5Rmpad1dnV0J6eW9ZSlpNdFExVDJ5S1cwRVBHUnl1eHBlYnZxMGU4SVViVWtEVW5NRmtjdW5qdlpOL09QRjVGTVZBNTdoZVFmNzRodnZLVlU4WU93cU5QNmdXU3o2ajNWY3dqdDZsTGhhTkU1TVZKNG9HT1M0TFE2enFVT2wzNCs0TEJFMlNsYm4yS0dqaGNPeVVvakFSU3JNRlVSR1F2Um9CMkdrRENXaTBlRmdNQVJ4MFRpcFdRR0lweTdLRjB5OWNEclAySVQ2QjA2RHFsUnBMdkNRZGdpYUFWSWRCQnM3bWw1QzBTZzErY0xTTWluUENxVzNVdENDS2RxTVlBa1p1bHRmWEZUeVIxM3NranJsUU1iTVVFWG1RY3VJT2NyY04wZUxnVXdTUkJwcDFmY1NWSUtUb3M2V2dBMnloVkVRRm1PaFFxblM4ZTUxSUdGUmxrQ0hRdXBFQkJBL3dvd2RPekhDN2RrS0RBcllLbHltS3FzVlR3V3lGVlJQQlp4aVQrRW5HYjM2RC9TeldKSjNaSlNVSmd6QUlSWjExVlFYYTJORGVRVFozRXluaTZPR1NROVdVaUtrUGNNZ2VnR1VvZXg3bTBIem5jYk56R2N0QnMvY1RMSmhOaUxQei9QNlJHcjBDSUMwVUpGWVJMRTFzWUcrTEdXc2Nqa0FZRFlRNUZBY2NQWHY3dWUrenJZSEJZaVU3Y2NYVEtXYlJBY0ZlaWlCUmU2dTJWajdPODVoRDF3WWhzV0toNUNvZE01ck5MbGxnd0Z1Z0xpbzV1NmUvMWFBcUo2clpHOGVLeERGekNROHlFM3JPUWlxUUFybHh4RnVIOEZRRGlYYytRQVdCVHA1UkxPMXNaTlBFdmdoZ1FLeGZiNEs4M1VIbG5PZlQ4YnlJTEx6N2pvVlVBV1VoV2VxYkN5WVV0dlp3ZW5mN203UUN4cC9XN2pKcklXTFdoRUNMWEhmYmtRdVVRTzBrRG81ZXpFV0RnWkNFWFhMampNNi9kMi9kK3BqOFZDSEdTbmhkTmhPYUtFbnhVRWp6QUpBMmpCaGM0UUJVU0RtSENKdndRRVRteWpFc1FHZXBHbTAwV2pXeklVaENqNURsUHYrOTVHSlZEVXdXd0JlZkZZQkMzVUVQS1NtV1oybVRrWlFCVng2d1dBMEV1U0FTRDB3c005RWwyMFhBclF5eHhESkMvSkJrWUpYVy9KYis3amRZckNrY2xBYkdDc0VKSEFKUUtWRnZZaWJxWlJSRjV5dkVRZE9NeU14WEtZRlNkam9Rc29IRGFHSUJCRk9NSVFZVUNJb3FOZDhVT0hVL2pCRlYxRzBTSUVPZ2lTVVEwbk5sRFB3a2t2dUU2SFU0QlJ1bVFoeWlqQkVhaE1RbzUwZ1RCUUdDemFTTVZqSVQ4ZmttSUVPTlZ3dHhObitzbHNkZ0MyRjVaekVFbXBGQzBlVzZMejRobkY4MG5acU1YZTJnMkVVRE1zNXlEV1FxN09nWG54WEozem5udWRRQVR5NGtrZ2lMbUlxek1DZWZGY25mT2VleDB6QW9QRDgrSVpqRUwrTDQrQVJRVHk0ckVJV2o0a2o4QmdCUExpR1l4Qy9pK1BnRVVFZmdzQUFQLy9lWW1OdlFBQUFBWkpSRUZVQXdBK2JFOXlMckdWWWdBQUFBQkpSVTVFcmtKZ2dnPT0iIGRhdGEtZmlsZW5hbWU9ImltYWdlLnBuZyIgc3R5bGU9IndpZHRoOiAyNzZweDsiPjxiPjxicj48L2I+PC9kaXY+PGRpdiBzdHlsZT0ibWFyZ2luLXRvcDogMmVtOyI+PGI+VFJBVEFNSUVOVE8gREUgREFUT1MgUEVSU09OQUxFUzo8L2I+Jm5ic3A7QWRpY2lvbmFsbWVlIEVuIGNhbGlkYWQgZGUgdGl0dWxhciBkZSBsYSBpbmZvcm1hY2nDs24geSBlbiB2aXJ0dWQgZGUgbG8gZGlzcHVlc3RvIGVuIGxhcyBMZXllcyAxMjY2IGRlIDIwMDgsIDE1ODEgZGVsIDIwMTIsIHN1cyBEZWNyZXRvcyBSZWdsYW1lbnRhcmlvcyB5IGRlbcOhcyBub3JtYXMgcXVlIGxhcyByZWdsYW1lbnRlbiwgbW9kaWZpcXVlbiB5L28gY29tcGxlbWVudGVuLCBBVVRPUklaTyBkZSBtYW5lcmEgaXJyZXZvY2FibGUsIGV4cHJlc2EsIHZvbHVudGFyaWEsIHByZXZpYSwgY29uY3JldGEsIHN1ZmljaWVudGUsIGluZm9ybWFkYSBlIGluZXF1w612b2NhIGEgSU5WRVJTSU9ORVMgQ0FSSVMgUy5BLlMsIGlkZW50aWZpY2FkYSBjb24gTklUIG7Dum1lcm8gOTAwLTk1Ny0zNTAsIGNvbiBkb21pY2lsaW8gcHJpbmNpcGFsIGVuIGxhIERpcmVjY2nDs246IENhcnJlcmEgNDMgQiBOcm8uIDE2IC0gOTUgZW4gZWwgbXVuaWNpcGlvIGRlIE1lZGVsbMOtbiAoQW50Lik7IG8gYSBxdWllbiByZXByZXNlbnRlIHN1cyBkZXJlY2hvcywgcGFyYSBxdWUgcmVjb2xlY3RlLCB0cmF0ZSwgY2FwdHVyZSwgcHJvY2VzZSwgY29uc3VsdGUsIHJlcG9ydGUsIHZlcmlmaXF1ZSwgeSBhbG1hY2VuZSBtaXMgZGF0b3MgcGVyc29uYWxlcyBlbiBzdXMgYmFzZXMgZGUgZGF0b3MuIExvIGFudGVyaW9yLCBjb24gbGFzIGZpbmFsaWRhZGVzIHF1ZSBhIGNvbnRpbnVhY2nDs24gc2UgcmVsYWNpb25hbi48L2Rpdj48ZGl2PjxkaXY+PHVsPjxsaT5BdGVuZGVyIG8gZm9ybWFsaXphciBjdWFscXVpZXIgcmVxdWVyaW1pZW50byBkZSBudWVzdHJvcyBwcm9kdWN0b3MgbyBzZXJ2aWNpb3MsIGVudsOtbyBkZSBlbmN1ZXN0YXMgZGUgc2VydmljaW8uPC9saT48bGk+UHJvdmVlciB5IHByb21vY2lvbmFyIHByb2R1Y3RvcyB5IHNlcnZpY2lvcy48L2xpPjxsaT5JbmZvcm1hciBzb2JyZSBudWV2b3MgcHJvZHVjdG9zIG8gc2VydmljaW9zIHF1ZSBlc3TDqW4gbyBubyByZWxhY2lvbmFkb3MgY29uIGxvcyBwcmV2aWFtZW50ZSBjb250cmF0YWRvcyBvIGFkcXVpcmlkb3MgcG9yIGxvcyBUaXR1bGFyZXMgZGUgbGEgSW5mb3JtYWNpw7NuLjwvbGk+PGxpPkRhciBjdW1wbGltaWVudG8gYSBvYmxpZ2FjaW9uZXMgY29udHJhw61kYXMgY29uIGxvcyBUaXR1bGFyZXMgZGUgbGEgSW5mb3JtYWNpw7NuLjwvbGk+PGxpPkluZm9ybWFyIHNvYnJlIGNhbWJpb3MgZGUgbG9zIHByb2R1Y3RvcyBvIHNlcnZpY2lvcy48L2xpPjxsaT5FdmFsdWFyIGxhIGNhbGlkYWQgZGVsIHNlcnZpY2lvLjwvbGk+PGxpPlJlYWxpemFyIGVzdHVkaW9zIGludGVybm9zIHkgZXh0ZXJub3Mgc29icmUgaMOhYml0b3MgZGUgY29uc3VtbyB5IGN1YWxxdWllciBhc3VudG8gZGUgbWVyY2FkZW8gZW4gZ2VuZXJhbC48L2xpPjxsaT5SZWFsaXphciBsYSBpZGVudGlmaWNhY2nDs24geSB0cmF6YWJpbGlkYWQgZGUgbGFzIHZhbG9yYWNpb25lcyByZWFsaXphZGFzIHkvbyBtdWVzdHJhcyBwcm9jZXNhZGFzLjwvbGk+PGxpPkN1bXBsaXIgY29uIGxhcyBvYmxpZ2FjaW9uZXMgY29udHJhY3R1YWxlcyBjb24gbG9zIGNsaWVudGVzLCBlbiB2aXJ0dWQgZGVsIGRlc2Fycm9sbG8gZGVsIG9iamV0byBzb2NpYWwgZGUgbGEgY29tcGHDscOtYS48L2xpPjxsaT5Db21wYXJ0aXIgZWwgY29uY2VwdG8gbWVkaWNvIGNvbiBsYSBlbXByZXNhIHBhcmEgbGEgY3VhbCBhc3Bpcm8gbGFib3JhciwgcmVzcGV0YW5kbyBlbiB0b2RvIGNhc28gbG8gZXN0YWJsZWNpZG8gZW4gbGEgcmVzb2x1Y2nDs24gMjM0NiBkZSAyMDA3LjwvbGk+PGxpPkNvbiBlbCBmaW4gZGUgc3VtaW5pc3RyYXIgZGF0b3MgYSBsYXMgZW50aWRhZGVzIGRlIGFmaWxpYWNpw7NuIHBhcmEgY3VtcGxpbWllbnRvcyBkZSBsYSBsZXkgY29tbzogRm9uZG9zIGRlIFBlbnNpb25lcyB5IENlc2FudMOtYXMsIEVtcHJlc2FzIFByb21vdG9yYXMgZGUgU2FsdWQgeSBBc2VndXJhZG9yYXMgZGUgcmllc2dvcyBMYWJvcmFsZXMuPC9saT48bGk+UGFyYSBjb21wYXJ0aXIgbWlzIGRhdG9zIHBlcnNvbmFsZXMgY29uIGF1dG9yaWRhZGVzIG5hY2lvbmFsZXMgbyBleHRyYW5qZXJhcyBjdWFuZG8gbGEgc29saWNpdHVkIHNlIGJhc2UgZW4gcmF6b25lcyBsZWdhbGVzLCBwcm9jZXNhbGVzIHBhcmEgbWkgcHJvcGlhIGNvbnZlbmllbmNpYSBvIGNvbGFib3JhciBjb24gZGljaGFzIGVudGlkYWRlcyBjdWFuZG8gcmVxdWllcmVuIGluZm9ybWFjacOzbiBmdW5kYW1lbnRhZGEgZW4gY2F1c2FzIGxlZ8OtdGltYXMgY29tbyBzb24gbG9zIHRlbWFzIGxlZ2FsZXMgbyBkZSBjYXLDoWN0ZXIgdHJpYnV0YXJpby48L2xpPjxsaT5BdXRvcml6byBhIHF1ZSBtaXMgZGF0b3MgcGVyc29uYWxlcyBlc3TDqW4gZGlzcG9uaWJsZXMgZW4gaW50ZXJuZXQgdSBvdHJvcyBtZWRpb3MgZGUgZGl2dWxnYWNpw7NuIG8gY29tdW5pY2FjacOzbiBtYXNpdmEgcGFyYSBtw60gZSBJTlZFUlNJT05FUyBDQVJJUyBTLkEuUywgc2llbXByZSB5IGN1YW5kbyBlbCBhY2Nlc28gc2VhIHTDqWNuaWNhbWVudGUgY29udHJvbGFibGUuPC9saT48L3VsPjwvZGl2PjxkaXYgc3R5bGU9Im1hcmdpbi10b3A6IDJlbTsiPjxiPkRhdG9zIFNlbnNpYmxlcyo6PC9iPiZuYnNwO0VuIHZpcnR1ZCBkZSBsbyBlc3RpcHVsYWRvIGVuIGVsIGFydMOtY3VsbyA2IGRlbCBEZWNyZXRvIDEzNzcgZGUgMjAxMywgYXV0b3Jpem8gZXhwcmVzYW1lbnRlIGEgSU5WRVJTSU9ORVMgQ0FSSVMgUy5BLlMgcGFyYSB0cmF0YXIgZGUgYWN1ZXJkbyBhIGxvcyBwcm9ww7NzaXRvcyBtZW5jaW9uYWRvcyBlbiBlc3RlIGRvY3VtZW50bywgbWkgaW5mb3JtYWNpw7NuIGJpb23DqXRyaWNhIHkgZGF0b3MgcmVsYXRpdm9zIGEgbWkgc2FsdWQuPC9kaXY+PC9kaXY+PGRpdj48ZGl2PkRlY2xhcm8gcXVlIGhlIGRhZG8gZXN0YSBhdXRvcml6YWNpw7NuIHkgaGUgZGFkbyBpbmZvcm1hY2nDs24gdmVyw61kaWNhIGEgdG9kYXMgbGFzIHByZWd1bnRhcyByZWFsaXphZGFzIGVuIGxhIGV2YWx1YWNpw7NuLCBzb24gZGFkYXMgZGUgZm9ybWEgdm9sdW50YXJpYSB5IHNpbiBjb2VyY2nDs24uPC9kaXY+PGRpdiBzdHlsZT0ibWFyZ2luLXRvcDogMmVtOyI+UGFjaWVudGUgbyBhY3VkaWVudGUmbmJzcDs8Yj5DQVJMT1MgQUxFWEFOREVSIEdPTUVaIE1PTElOQTwvYj48c3BhbiBzdHlsZT0idGV4dC1hbGlnbjogcmlnaHQ7Ij48YnI+PC9zcGFuPjwvZGl2PjxkaXYgc3R5bGU9Im1hcmdpbi10b3A6IDJlbTsiPjxzcGFuIHN0eWxlPSJ0ZXh0LWFsaWduOiByaWdodDsiPkBAZmlybWEtMCZuYnNwOzwvc3Bhbj48c3BhbiBzdHlsZT0idGV4dC1hbGlnbjogcmlnaHQ7Ij5AQGZpcm1hLTE8L3NwYW4+PC9kaXY+PC9kaXY+",
    //   "signature": "",
    //   "signed": false,
    //   "status": 0,
    //   "requireDecision": true,
    //   "decision": null,
    //   "decisionAt": null,
    //   "batchId": "",
    //   "decisionScope": "",
    //   "signingScope": "",
    //   "editScope": "",
    //   "locked": false,
    //   "editable": false,
    //   "responsable": "",
    //   "requiredSignatures": 2,
    //   "paciente": {
    //     "nombreCompleto": "CARLOS ALEXANDER GOMEZ MOLINA",
    //     "docIdentidad": "1007446942"
    //   }
    // }];
    // this.changeComponent('files', demo);
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
    },
    // Verifica si el documento seleccionado tiene responsable
    hasResponsable() {
      return this.selected.some(doc => doc.responsable);
    },
    // Obtiene datos del paciente del primer documento seleccionado
    pacienteData() {
      const firstDoc = this.selected[0];
      return firstDoc?.paciente || { nombreCompleto: '', docIdentidad: '', desTIdentificacion: '' };
    },
    // Obtiene datos del responsable del primer documento seleccionado
    responsableData() {
      const firstDoc = this.selected[0];
      return firstDoc?.responsable || null;
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
      console.log(docs);

      fetch(`./components/${name}.html?vs=${Date.now()}`)
        .then(resp => resp.text())
        .then(html => {
          Vue.component(name, { template: html });

          const prev = this.currentComponent;
          this.currentComponent = name;

          // Limpia listeners y canvas al salir de la vista de firma
          if (prev === 'signature' && name !== 'signature') {
            this.clearAllCanvases();
            this.teardownSignatureListeners();
          }

          this.$nextTick(() => {
            this.configProject = JSON.parse(localStorage.getItem('config') || '{}');

            if (name === 'signature') {
              this.zoom = 1;
              this.decisionTmp = {};
              // Reset variables del responsable
              this.canvasResponsable = null;
              this.ctxResponsable = null;
              this.isDrawingResponsable = false;
              this.canvaResponsableIsNull = true;
              this.signaturePendingResponsable = '';
              this.initializeSignature();
            } else if (name === 'home') {
              this.selected = [];
              this.documents = [];
              this.isDrawing = false;
              this.isDrawingResponsable = false;
              this.allSigned = false;
              this.signaturePending = '';
              this.signaturePendingResponsable = '';
            } else if (name === 'files') {
              // Limpiar canvas y resetear estados de dibujo al entrar a files
              this.clearAllCanvases();
              this.isDrawing = false;
              this.isDrawingResponsable = false;
              this.canvaIsNull = true;
              this.canvaResponsableIsNull = true;
              this.signaturePending = '';
              this.signaturePendingResponsable = '';
              
              if (docs.length) {
                const prevDocs = this.documents || [];

                this.documents = docs.map(doc => {
                  const base64str = doc.base64.includes(',') ? doc.base64.split(',')[1] : doc.base64;
                  const decodedHtml = this.decodeBase64Utf8(base64str);
                  // Ocultar ambos placeholders de firma
                  let cleanHtml = decodedHtml.replaceAll('@@firma-0', '<span style="display:none;">@@firma-0</span>');
                  cleanHtml = cleanHtml.replaceAll('@@firma-1', '<span style="display:none;">@@firma-1</span>');

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
      if (this.canvas) {
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
      }

      // Inicializar canvas del responsable si existe
      const hasResponsable = this.selected.some(doc => doc.responsable);
      if (hasResponsable) {
        this.canvasResponsable = document.getElementById('draw-canvas-responsable');
        if (this.canvasResponsable) {
          this.ctxResponsable = this.canvasResponsable.getContext('2d');
          this.configureCanvasResponsable();

          if (this.signaturePendingResponsable) {
            const img = new Image();
            img.src = this.signaturePendingResponsable;
            img.onload = () => {
              this.clearCanvasResponsable();
              this.ctxResponsable.drawImage(img, 0, 0, this.canvasResponsable.width, this.canvasResponsable.height);
            };
            this.signaturePendingResponsable = null;
          }
        }
      }
    },

    // Limpia el contenido de los canvas
    clearAllCanvases() {
      if (this.canvas && this.ctx) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this._blankCache.data = null;
      }
      if (this.canvasResponsable && this.ctxResponsable) {
        this.ctxResponsable.clearRect(0, 0, this.canvasResponsable.width, this.canvasResponsable.height);
        this._blankCacheResponsable.data = null;
      }
    },

    // Quita listeners del canvas para evitar duplicados/memoria
    teardownSignatureListeners() {
      if (this.canvas) {
        this.canvas.removeEventListener('mousedown', this.initializeDrawing);
        this.canvas.removeEventListener('mousemove', this.draw);
        this.canvas.removeEventListener('mouseup', this.endDrawing);
        this.canvas.removeEventListener('mouseleave', this.endDrawing);
        this.canvas.removeEventListener('touchstart', this.startTouch, { passive: false });
        this.canvas.removeEventListener('touchmove', this.drawTouch, { passive: false });
        this.canvas.removeEventListener('touchend', this.endDrawing, { passive: false });
      }
      if (this.canvasResponsable) {
        this.canvasResponsable.removeEventListener('mousedown', this.initializeDrawingResponsable);
        this.canvasResponsable.removeEventListener('mousemove', this.drawResponsable);
        this.canvasResponsable.removeEventListener('mouseup', this.endDrawingResponsable);
        this.canvasResponsable.removeEventListener('mouseleave', this.endDrawingResponsable);
        this.canvasResponsable.removeEventListener('touchstart', this.startTouchResponsable, { passive: false });
        this.canvasResponsable.removeEventListener('touchmove', this.drawTouchResponsable, { passive: false });
        this.canvasResponsable.removeEventListener('touchend', this.endDrawingResponsable, { passive: false });
      }
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

    // Configura estilos del canvas del responsable y listeners de dibujo
    configureCanvasResponsable() {
      this.ctxResponsable.lineCap = 'round';
      this.ctxResponsable.lineJoin = 'round';
      this.ctxResponsable.lineWidth = 2;
      this.ctxResponsable.strokeStyle = '#000';

      this.canvasResponsable.addEventListener('mousedown', this.initializeDrawingResponsable);
      this.canvasResponsable.addEventListener('mousemove', this.drawResponsable);
      this.canvasResponsable.addEventListener('mouseup', this.endDrawingResponsable);
      this.canvasResponsable.addEventListener('mouseleave', this.endDrawingResponsable);

      this.canvasResponsable.addEventListener('touchstart', this.startTouchResponsable, { passive: false });
      this.canvasResponsable.addEventListener('touchmove', this.drawTouchResponsable, { passive: false });
      this.canvasResponsable.addEventListener('touchend', this.endDrawingResponsable, { passive: false });

      // Reset de caché del canvas en blanco (para isCanvasEmptyResponsable)
      this._blankCacheResponsable = { width: this.canvasResponsable.width, height: this.canvasResponsable.height, data: null };
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

    // === MÉTODOS PARA CANVAS RESPONSABLE ===
    // Inicia un trazo con mouse (responsable)
    initializeDrawingResponsable(e) {
      this.isDrawingResponsable = true;
      const rect = this.canvasResponsable.getBoundingClientRect();
      const scaleX = this.canvasResponsable.width / rect.width;
      const scaleY = this.canvasResponsable.height / rect.height;
      this.ctxResponsable.beginPath();
      this.ctxResponsable.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    },
    drawResponsable(e) {
      if (!this.isDrawingResponsable) return;
      const rect = this.canvasResponsable.getBoundingClientRect();
      const scaleX = this.canvasResponsable.width / rect.width;
      const scaleY = this.canvasResponsable.height / rect.height;
      this.ctxResponsable.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
      this.ctxResponsable.stroke();
    },
    endDrawingResponsable() {
      this.isDrawingResponsable = false;
    },
    getCanvasPosResponsable(touch) {
      const rect = this.canvasResponsable.getBoundingClientRect();
      const scaleX = this.canvasResponsable.width / rect.width;
      const scaleY = this.canvasResponsable.height / rect.height;
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    },
    startTouchResponsable(e) {
      if (e.touches.length > 1) return;
      e.preventDefault();
      this.isDrawingResponsable = true;
      const pos = this.getCanvasPosResponsable(e.touches[0]);
      this.ctxResponsable.beginPath();
      this.ctxResponsable.moveTo(pos.x, pos.y);
    },
    drawTouchResponsable(e) {
      if (!this.isDrawingResponsable || e.touches.length > 1) return;
      e.preventDefault();
      const pos = this.getCanvasPosResponsable(e.touches[0]);
      this.ctxResponsable.lineTo(pos.x, pos.y);
      this.ctxResponsable.stroke();
    },

    // Limpia el canvas y la caché de "en blanco"
    clearCanvas() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this._blankCache.data = null;
      this.validateCanvas();
    },

    // Limpia el canvas del responsable y la caché de "en blanco"
    clearCanvasResponsable() {
      if (!this.canvasResponsable || !this.ctxResponsable) return;
      this.ctxResponsable.clearRect(0, 0, this.canvasResponsable.width, this.canvasResponsable.height);
      this._blankCacheResponsable.data = null;
      this.validateCanvasResponsable();
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

      // Validar firmas: verificar si hay responsable
      const hasResponsable = selected.some(doc => doc.responsable);

      if (this.isCanvasEmpty()) {
        await Swal.fire({ title: '¡Error!', text: 'Debe firmar antes de guardar.', icon: 'error', confirmButtonText: 'Aceptar', confirmButtonColor: '#f44336' });
        return;
      }

      // Si hay responsable, validar también su firma
      if (hasResponsable) {
        // Esperar a que el canvas se inicialice si aún no existe
        if (!this.canvasResponsable) {
          this.canvasResponsable = document.getElementById('draw-canvas-responsable');
          if (this.canvasResponsable && !this.ctxResponsable) {
            this.ctxResponsable = this.canvasResponsable.getContext('2d');
            this.configureCanvasResponsable();
          }
        }
        if (!this.canvasResponsable || this.isCanvasEmptyResponsable()) {
          await Swal.fire({ title: '¡Error!', text: 'Debe firmar el campo del responsable antes de guardar.', icon: 'error', confirmButtonText: 'Aceptar', confirmButtonColor: '#f44336' });
          return;
        }
      }

      // Validar decisiones y mostrar mensajes de confirmación específicos
      const groupBatch = this.groupDecisionBatchId;
      let hasRejection = false;
      let hasAcceptance = false;
      let hasAnyDecision = false;

      // Verificar decisiones de grupo
      if (this.hasGroupDecision && groupBatch) {
        if (this.groupDecision === false) {
          hasRejection = true;
          hasAnyDecision = true;
        } else if (this.groupDecision === true) {
          hasAcceptance = true;
          hasAnyDecision = true;
        }
      }

      // Verificar decisiones individuales
      selected.forEach(sel => {
        const doc = this.documents.find(d => d.id === sel.id);
        if (!doc || !doc.requireDecision) return;

        let decision = null;
        if (this.hasGroupDecision && groupBatch && doc.decisionScope === 'group' && doc.batchId === groupBatch) {
          decision = this.groupDecision;
        } else if (doc.decisionScope !== 'group') {
          decision = this.decisionTmp?.[doc.id];
        }

        if (decision === false) {
          hasRejection = true;
          hasAnyDecision = true;
        } else if (decision === true) {
          hasAcceptance = true;
          hasAnyDecision = true;
        }
      });

      // Mostrar confirmación según la decisión
      let confirm;
      if (hasRejection) {
        // Si hay al menos una decisión de "no aceptar"
        confirm = await Swal.fire({
          title: '¡Atención!',
          html: '¿Está seguro de que <b>NO acepta</b> el ' + selected[0].name + '?<br><br>Recuerda que esta opción cancela de manera automática la realización de los exámenes médicos programados.',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, confirmo',
          confirmButtonColor: '#f44336',
          cancelButtonText: 'Cancelar'
        });
      } else if (hasAcceptance) {
        // Si hay al menos una decisión de "aceptar" y ninguna de "no aceptar"
        confirm = await Swal.fire({
          title: '¡Confirmación!',
          text: '¿Está seguro de que leyó, comprende y acepta el ' + selected[0].name + '?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sí, confirmo',
          confirmButtonColor: '#4caf50',
          cancelButtonText: 'Cancelar'
        });
      } else {
        // Si no hay decisiones requeridas, mostrar confirmación general
        confirm = await Swal.fire({
          title: '¡Confirmación!',
          text: this.documents.every(d => d.editable === false) ? '¿Está seguro que desea guardar? Al guardar su decisión no podrá modificarla.' : '¿Está seguro que desea guardar?',
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Sí',
          confirmButtonColor: '#f44336',
          cancelButtonText: 'No'
        });
      }

      if (!confirm.isConfirmed) return;

      // Obtener firmas: array con una o dos firmas según corresponda (data URL completo)
      const signatureDataPaciente = this.canvas.toDataURL('image/png');
      let signaturesArray = [signatureDataPaciente];

      if (hasResponsable && this.canvasResponsable && this.ctxResponsable) {
        const signatureDataResponsable = this.canvasResponsable.toDataURL('image/png');
        signaturesArray.push(signatureDataResponsable);
      }

      // ---- Aplicar firma + decisión a cada doc seleccionado ----
      const nowIso = new Date().toISOString();

      this.selected.forEach(sel => {
        const doc = this.documents.find(d => d.id === sel.id);
        if (!doc) return;

        // Firma: ahora es un array (asegurar que siempre sea array, no string)
        doc.signature = Array.isArray(signaturesArray) ? signaturesArray : [signaturesArray];
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

        // Restaurar placeholders (sin reemplazar, se envían por separado)
        let restoredHtml = doc.html;

        // Restaurar placeholder @@firma-0 (devolver a su estado original)
        restoredHtml = restoredHtml.replace('<span style="display:none;">@@firma-0</span>', '@@firma-0');
        // Restaurar placeholder @@firma-1 (devolver a su estado original)
        restoredHtml = restoredHtml.replace('<span style="display:none;">@@firma-1</span>', '@@firma-1');
        
        // Las firmas se envían por separado en doc.signature (array)
        // El HTML se envía con los placeholders @@firma-0 y @@firma-1 intactos

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

    validateCanvasResponsable() {
      if (!this.canvasResponsable || this.isCanvasEmptyResponsable()) {
        this.canvaResponsableIsNull = true;
      } else {
        this.canvaResponsableIsNull = false;
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

    // Verifica si el canvas del responsable está en blanco (usa caché por rendimiento)
    isCanvasEmptyResponsable() {
      if (!this.canvasResponsable) return true;
      const { width, height } = this.canvasResponsable;

      if (!this._blankCacheResponsable.data || this._blankCacheResponsable.width !== width || this._blankCacheResponsable.height !== height) {
        const blank = document.createElement('canvas');
        blank.width = width; blank.height = height;
        this._blankCacheResponsable = {
          width, height,
          data: blank.getContext('2d').getImageData(0, 0, width, height).data
        };
      }

      const actual = this.ctxResponsable.getImageData(0, 0, width, height).data;
      const blankData = this._blankCacheResponsable.data;
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
        // Manejar firma como array o string (compatibilidad)
        const signatures = Array.isArray(doc.signature) ? doc.signature : [doc.signature];
        // Si ya es data URL completo, usarlo directamente; si no, agregar prefijo
        this.signaturePending = signatures[0]?.startsWith('data:') ? signatures[0] : 'data:image/png;base64,' + signatures[0];
        if (signatures.length > 1 && doc.responsable) {
          this.signaturePendingResponsable = signatures[1]?.startsWith('data:') ? signatures[1] : 'data:image/png;base64,' + signatures[1];
        }
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
            // Manejar firma como array o string (compatibilidad)
            const signatures = Array.isArray(documento.signature) ? documento.signature : [documento.signature];
            // Si ya es data URL completo, usarlo directamente; si no, agregar prefijo
            this.signaturePending = signatures[0]?.startsWith('data:') ? signatures[0] : 'data:image/png;base64,' + signatures[0];
            if (signatures.length > 1 && documento.responsable) {
              this.signaturePendingResponsable = signatures[1]?.startsWith('data:') ? signatures[1] : 'data:image/png;base64,' + signatures[1];
            }
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

      // Asegurar que las firmas se envíen como arrays
      const documentsToSend = this.documents.map(doc => ({
        ...doc,
        signature: Array.isArray(doc.signature) ? doc.signature : (doc.signature ? [doc.signature] : [])
      }));
      console.log(documentsToSend);
      

      window.socket.emit('saveSignature', {
        documentsSigned: documentsToSend,
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

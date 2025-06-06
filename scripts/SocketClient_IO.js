/*!
 * Socket.IO v4.8.1
 * (c) 2014-2024 Guillermo Rauch
 * Released under the MIT License.
 */
const t = Object.create(null);
(t.open = "0"),
  (t.close = "1"),
  (t.ping = "2"),
  (t.pong = "3"),
  (t.message = "4"),
  (t.upgrade = "5"),
  (t.noop = "6");
const s = Object.create(null);
Object.keys(t).forEach((i) => {
  s[t[i]] = i;
});
const i = { type: "error", data: "parser error" },
  e =
    "function" == typeof Blob ||
    ("undefined" != typeof Blob &&
      "[object BlobConstructor]" === Object.prototype.toString.call(Blob)),
  n = "function" == typeof ArrayBuffer,
  r = (t) =>
    "function" == typeof ArrayBuffer.isView
      ? ArrayBuffer.isView(t)
      : t && t.buffer instanceof ArrayBuffer,
  o = ({ type: s, data: i }, o, c) =>
    e && i instanceof Blob
      ? o
        ? c(i)
        : h(i, c)
      : n && (i instanceof ArrayBuffer || r(i))
      ? o
        ? c(i)
        : h(new Blob([i]), c)
      : c(t[s] + (i || "")),
  h = (t, s) => {
    const i = new FileReader();
    return (
      (i.onload = function () {
        const t = i.result.split(",")[1];
        s("b" + (t || ""));
      }),
      i.readAsDataURL(t)
    );
  };
function c(t) {
  return t instanceof Uint8Array
    ? t
    : t instanceof ArrayBuffer
    ? new Uint8Array(t)
    : new Uint8Array(t.buffer, t.byteOffset, t.byteLength);
}
let a;
const u = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
  f = "undefined" == typeof Uint8Array ? [] : new Uint8Array(256);
for (let t = 0; t < 64; t++) f[u.charCodeAt(t)] = t;
const l = "function" == typeof ArrayBuffer,
  d = (t, e) => {
    if ("string" != typeof t) return { type: "message", data: y(t, e) };
    const n = t.charAt(0);
    if ("b" === n) return { type: "message", data: p(t.substring(1), e) };
    return s[n]
      ? t.length > 1
        ? { type: s[n], data: t.substring(1) }
        : { type: s[n] }
      : i;
  },
  p = (t, s) => {
    if (l) {
      const i = ((t) => {
        let s,
          i,
          e,
          n,
          r,
          o = 0.75 * t.length,
          h = t.length,
          c = 0;
        "=" === t[t.length - 1] && (o--, "=" === t[t.length - 2] && o--);
        const a = new ArrayBuffer(o),
          u = new Uint8Array(a);
        for (s = 0; s < h; s += 4)
          (i = f[t.charCodeAt(s)]),
            (e = f[t.charCodeAt(s + 1)]),
            (n = f[t.charCodeAt(s + 2)]),
            (r = f[t.charCodeAt(s + 3)]),
            (u[c++] = (i << 2) | (e >> 4)),
            (u[c++] = ((15 & e) << 4) | (n >> 2)),
            (u[c++] = ((3 & n) << 6) | (63 & r));
        return a;
      })(t);
      return y(i, s);
    }
    return { base64: !0, data: t };
  },
  y = (t, s) =>
    "blob" === s
      ? t instanceof Blob
        ? t
        : new Blob([t])
      : t instanceof ArrayBuffer
      ? t
      : t.buffer,
  b = String.fromCharCode(30);
function g() {
  return new TransformStream({
    transform(t, s) {
      !(function (t, s) {
        e && t.data instanceof Blob
          ? t.data.arrayBuffer().then(c).then(s)
          : n && (t.data instanceof ArrayBuffer || r(t.data))
          ? s(c(t.data))
          : o(t, !1, (t) => {
              a || (a = new TextEncoder()), s(a.encode(t));
            });
      })(t, (i) => {
        const e = i.length;
        let n;
        if (e < 126)
          (n = new Uint8Array(1)), new DataView(n.buffer).setUint8(0, e);
        else if (e < 65536) {
          n = new Uint8Array(3);
          const t = new DataView(n.buffer);
          t.setUint8(0, 126), t.setUint16(1, e);
        } else {
          n = new Uint8Array(9);
          const t = new DataView(n.buffer);
          t.setUint8(0, 127), t.setBigUint64(1, BigInt(e));
        }
        t.data && "string" != typeof t.data && (n[0] |= 128),
          s.enqueue(n),
          s.enqueue(i);
      });
    },
  });
}
let w;
function v(t) {
  return t.reduce((t, s) => t + s.length, 0);
}
function m(t, s) {
  if (t[0].length === s) return t.shift();
  const i = new Uint8Array(s);
  let e = 0;
  for (let n = 0; n < s; n++)
    (i[n] = t[0][e++]), e === t[0].length && (t.shift(), (e = 0));
  return t.length && e < t[0].length && (t[0] = t[0].slice(e)), i;
}
function k(t) {
  if (t)
    return (function (t) {
      for (var s in k.prototype) t[s] = k.prototype[s];
      return t;
    })(t);
}
(k.prototype.on = k.prototype.addEventListener =
  function (t, s) {
    return (
      (this.t = this.t || {}),
      (this.t["$" + t] = this.t["$" + t] || []).push(s),
      this
    );
  }),
  (k.prototype.once = function (t, s) {
    function i() {
      this.off(t, i), s.apply(this, arguments);
    }
    return (i.fn = s), this.on(t, i), this;
  }),
  (k.prototype.off =
    k.prototype.removeListener =
    k.prototype.removeAllListeners =
    k.prototype.removeEventListener =
      function (t, s) {
        if (((this.t = this.t || {}), 0 == arguments.length))
          return (this.t = {}), this;
        var i,
          e = this.t["$" + t];
        if (!e) return this;
        if (1 == arguments.length) return delete this.t["$" + t], this;
        for (var n = 0; n < e.length; n++)
          if ((i = e[n]) === s || i.fn === s) {
            e.splice(n, 1);
            break;
          }
        return 0 === e.length && delete this.t["$" + t], this;
      }),
  (k.prototype.emit = function (t) {
    this.t = this.t || {};
    for (
      var s = new Array(arguments.length - 1), i = this.t["$" + t], e = 1;
      e < arguments.length;
      e++
    )
      s[e - 1] = arguments[e];
    if (i) {
      e = 0;
      for (var n = (i = i.slice(0)).length; e < n; ++e) i[e].apply(this, s);
    }
    return this;
  }),
  (k.prototype.emitReserved = k.prototype.emit),
  (k.prototype.listeners = function (t) {
    return (this.t = this.t || {}), this.t["$" + t] || [];
  }),
  (k.prototype.hasListeners = function (t) {
    return !!this.listeners(t).length;
  });
const A =
    "function" == typeof Promise && "function" == typeof Promise.resolve
      ? (t) => Promise.resolve().then(t)
      : (t, s) => s(t, 0),
  E =
    "undefined" != typeof self
      ? self
      : "undefined" != typeof window
      ? window
      : Function("return this")();
function O(t, ...s) {
  return s.reduce((s, i) => (t.hasOwnProperty(i) && (s[i] = t[i]), s), {});
}
const _ = E.setTimeout,
  j = E.clearTimeout;
function x(t, s) {
  s.useNativeTimers
    ? ((t.setTimeoutFn = _.bind(E)), (t.clearTimeoutFn = j.bind(E)))
    : ((t.setTimeoutFn = E.setTimeout.bind(E)),
      (t.clearTimeoutFn = E.clearTimeout.bind(E)));
}
function B() {
  return (
    Date.now().toString(36).substring(3) +
    Math.random().toString(36).substring(2, 5)
  );
}
class C extends Error {
  constructor(t, s, i) {
    super(t),
      (this.description = s),
      (this.context = i),
      (this.type = "TransportError");
  }
}
class T extends k {
  constructor(t) {
    super(),
      (this.writable = !1),
      x(this, t),
      (this.opts = t),
      (this.query = t.query),
      (this.socket = t.socket),
      (this.supportsBinary = !t.forceBase64);
  }
  onError(t, s, i) {
    return super.emitReserved("error", new C(t, s, i)), this;
  }
  open() {
    return (this.readyState = "opening"), this.doOpen(), this;
  }
  close() {
    return (
      ("opening" !== this.readyState && "open" !== this.readyState) ||
        (this.doClose(), this.onClose()),
      this
    );
  }
  send(t) {
    "open" === this.readyState && this.write(t);
  }
  onOpen() {
    (this.readyState = "open"),
      (this.writable = !0),
      super.emitReserved("open");
  }
  onData(t) {
    const s = d(t, this.socket.binaryType);
    this.onPacket(s);
  }
  onPacket(t) {
    super.emitReserved("packet", t);
  }
  onClose(t) {
    (this.readyState = "closed"), super.emitReserved("close", t);
  }
  pause(t) {}
  createUri(t, s = {}) {
    return t + "://" + this.i() + this.o() + this.opts.path + this.h(s);
  }
  i() {
    const t = this.opts.hostname;
    return -1 === t.indexOf(":") ? t : "[" + t + "]";
  }
  o() {
    return this.opts.port &&
      ((this.opts.secure && Number(443 !== this.opts.port)) ||
        (!this.opts.secure && 80 !== Number(this.opts.port)))
      ? ":" + this.opts.port
      : "";
  }
  h(t) {
    const s = (function (t) {
      let s = "";
      for (let i in t)
        t.hasOwnProperty(i) &&
          (s.length && (s += "&"),
          (s += encodeURIComponent(i) + "=" + encodeURIComponent(t[i])));
      return s;
    })(t);
    return s.length ? "?" + s : "";
  }
}
class N extends T {
  constructor() {
    super(...arguments), (this.u = !1);
  }
  get name() {
    return "polling";
  }
  doOpen() {
    this.l();
  }
  pause(t) {
    this.readyState = "pausing";
    const s = () => {
      (this.readyState = "paused"), t();
    };
    if (this.u || !this.writable) {
      let t = 0;
      this.u &&
        (t++,
        this.once("pollComplete", function () {
          --t || s();
        })),
        this.writable ||
          (t++,
          this.once("drain", function () {
            --t || s();
          }));
    } else s();
  }
  l() {
    (this.u = !0), this.doPoll(), this.emitReserved("poll");
  }
  onData(t) {
    ((t, s) => {
      const i = t.split(b),
        e = [];
      for (let t = 0; t < i.length; t++) {
        const n = d(i[t], s);
        if ((e.push(n), "error" === n.type)) break;
      }
      return e;
    })(t, this.socket.binaryType).forEach((t) => {
      if (
        ("opening" === this.readyState && "open" === t.type && this.onOpen(),
        "close" === t.type)
      )
        return (
          this.onClose({ description: "transport closed by the server" }), !1
        );
      this.onPacket(t);
    }),
      "closed" !== this.readyState &&
        ((this.u = !1),
        this.emitReserved("pollComplete"),
        "open" === this.readyState && this.l());
  }
  doClose() {
    const t = () => {
      this.write([{ type: "close" }]);
    };
    "open" === this.readyState ? t() : this.once("open", t);
  }
  write(t) {
    (this.writable = !1),
      ((t, s) => {
        const i = t.length,
          e = new Array(i);
        let n = 0;
        t.forEach((t, r) => {
          o(t, !1, (t) => {
            (e[r] = t), ++n === i && s(e.join(b));
          });
        });
      })(t, (t) => {
        this.doWrite(t, () => {
          (this.writable = !0), this.emitReserved("drain");
        });
      });
  }
  uri() {
    const t = this.opts.secure ? "https" : "http",
      s = this.query || {};
    return (
      !1 !== this.opts.timestampRequests && (s[this.opts.timestampParam] = B()),
      this.supportsBinary || s.sid || (s.b64 = 1),
      this.createUri(t, s)
    );
  }
}
let U = !1;
try {
  U =
    "undefined" != typeof XMLHttpRequest &&
    "withCredentials" in new XMLHttpRequest();
} catch (t) {}
const P = U;
function D() {}
class M extends N {
  constructor(t) {
    if ((super(t), "undefined" != typeof location)) {
      const s = "https:" === location.protocol;
      let i = location.port;
      i || (i = s ? "443" : "80"),
        (this.xd =
          ("undefined" != typeof location &&
            t.hostname !== location.hostname) ||
          i !== t.port);
    }
  }
  doWrite(t, s) {
    const i = this.request({ method: "POST", data: t });
    i.on("success", s),
      i.on("error", (t, s) => {
        this.onError("xhr post error", t, s);
      });
  }
  doPoll() {
    const t = this.request();
    t.on("data", this.onData.bind(this)),
      t.on("error", (t, s) => {
        this.onError("xhr poll error", t, s);
      }),
      (this.pollXhr = t);
  }
}
class S extends k {
  constructor(t, s, i) {
    super(),
      (this.createRequest = t),
      x(this, i),
      (this.p = i),
      (this.v = i.method || "GET"),
      (this.m = s),
      (this.k = void 0 !== i.data ? i.data : null),
      this.A();
  }
  A() {
    var t;
    const s = O(
      this.p,
      "agent",
      "pfx",
      "key",
      "passphrase",
      "cert",
      "ca",
      "ciphers",
      "rejectUnauthorized",
      "autoUnref"
    );
    s.xdomain = !!this.p.xd;
    const i = (this.O = this.createRequest(s));
    try {
      i.open(this.v, this.m, !0);
      try {
        if (this.p.extraHeaders) {
          i.setDisableHeaderCheck && i.setDisableHeaderCheck(!0);
          for (let t in this.p.extraHeaders)
            this.p.extraHeaders.hasOwnProperty(t) &&
              i.setRequestHeader(t, this.p.extraHeaders[t]);
        }
      } catch (t) {}
      if ("POST" === this.v)
        try {
          i.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
        } catch (t) {}
      try {
        i.setRequestHeader("Accept", "*/*");
      } catch (t) {}
      null === (t = this.p.cookieJar) || void 0 === t || t.addCookies(i),
        "withCredentials" in i && (i.withCredentials = this.p.withCredentials),
        this.p.requestTimeout && (i.timeout = this.p.requestTimeout),
        (i.onreadystatechange = () => {
          var t;
          3 === i.readyState &&
            (null === (t = this.p.cookieJar) ||
              void 0 === t ||
              t.parseCookies(i.getResponseHeader("set-cookie"))),
            4 === i.readyState &&
              (200 === i.status || 1223 === i.status
                ? this._()
                : this.setTimeoutFn(() => {
                    this.j("number" == typeof i.status ? i.status : 0);
                  }, 0));
        }),
        i.send(this.k);
    } catch (t) {
      return void this.setTimeoutFn(() => {
        this.j(t);
      }, 0);
    }
    "undefined" != typeof document &&
      ((this.B = S.requestsCount++), (S.requests[this.B] = this));
  }
  j(t) {
    this.emitReserved("error", t, this.O), this.C(!0);
  }
  C(t) {
    if (void 0 !== this.O && null !== this.O) {
      if (((this.O.onreadystatechange = D), t))
        try {
          this.O.abort();
        } catch (t) {}
      "undefined" != typeof document && delete S.requests[this.B],
        (this.O = null);
    }
  }
  _() {
    const t = this.O.responseText;
    null !== t &&
      (this.emitReserved("data", t), this.emitReserved("success"), this.C());
  }
  abort() {
    this.C();
  }
}
if (((S.requestsCount = 0), (S.requests = {}), "undefined" != typeof document))
  if ("function" == typeof attachEvent) attachEvent("onunload", L);
  else if ("function" == typeof addEventListener) {
    addEventListener("onpagehide" in E ? "pagehide" : "unload", L, !1);
  }
function L() {
  for (let t in S.requests)
    S.requests.hasOwnProperty(t) && S.requests[t].abort();
}
const R = (function () {
  const t = F({ xdomain: !1 });
  return t && null !== t.responseType;
})();
class I extends M {
  constructor(t) {
    super(t);
    const s = t && t.forceBase64;
    this.supportsBinary = R && !s;
  }
  request(t = {}) {
    return (
      Object.assign(t, { xd: this.xd }, this.opts), new S(F, this.uri(), t)
    );
  }
}
function F(t) {
  const s = t.xdomain;
  try {
    if ("undefined" != typeof XMLHttpRequest && (!s || P))
      return new XMLHttpRequest();
  } catch (t) {}
  if (!s)
    try {
      return new E[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
    } catch (t) {}
}
const $ =
  "undefined" != typeof navigator &&
  "string" == typeof navigator.product &&
  "reactnative" === navigator.product.toLowerCase();
class V extends T {
  get name() {
    return "websocket";
  }
  doOpen() {
    const t = this.uri(),
      s = this.opts.protocols,
      i = $
        ? {}
        : O(
            this.opts,
            "agent",
            "perMessageDeflate",
            "pfx",
            "key",
            "passphrase",
            "cert",
            "ca",
            "ciphers",
            "rejectUnauthorized",
            "localAddress",
            "protocolVersion",
            "origin",
            "maxPayload",
            "family",
            "checkServerIdentity"
          );
    this.opts.extraHeaders && (i.headers = this.opts.extraHeaders);
    try {
      this.ws = this.createSocket(t, s, i);
    } catch (t) {
      return this.emitReserved("error", t);
    }
    (this.ws.binaryType = this.socket.binaryType), this.addEventListeners();
  }
  addEventListeners() {
    (this.ws.onopen = () => {
      this.opts.autoUnref && this.ws.T.unref(), this.onOpen();
    }),
      (this.ws.onclose = (t) =>
        this.onClose({
          description: "websocket connection closed",
          context: t,
        })),
      (this.ws.onmessage = (t) => this.onData(t.data)),
      (this.ws.onerror = (t) => this.onError("websocket error", t));
  }
  write(t) {
    this.writable = !1;
    for (let s = 0; s < t.length; s++) {
      const i = t[s],
        e = s === t.length - 1;
      o(i, this.supportsBinary, (t) => {
        try {
          this.doWrite(i, t);
        } catch (t) {}
        e &&
          A(() => {
            (this.writable = !0), this.emitReserved("drain");
          }, this.setTimeoutFn);
      });
    }
  }
  doClose() {
    void 0 !== this.ws &&
      ((this.ws.onerror = () => {}), this.ws.close(), (this.ws = null));
  }
  uri() {
    const t = this.opts.secure ? "wss" : "ws",
      s = this.query || {};
    return (
      this.opts.timestampRequests && (s[this.opts.timestampParam] = B()),
      this.supportsBinary || (s.b64 = 1),
      this.createUri(t, s)
    );
  }
}
const H = E.WebSocket || E.MozWebSocket;
class W extends V {
  createSocket(t, s, i) {
    return $ ? new H(t, s, i) : s ? new H(t, s) : new H(t);
  }
  doWrite(t, s) {
    this.ws.send(s);
  }
}
class q extends T {
  get name() {
    return "webtransport";
  }
  doOpen() {
    try {
      this.N = new WebTransport(
        this.createUri("https"),
        this.opts.transportOptions[this.name]
      );
    } catch (t) {
      return this.emitReserved("error", t);
    }
    this.N.closed
      .then(() => {
        this.onClose();
      })
      .catch((t) => {
        this.onError("webtransport error", t);
      }),
      this.N.ready.then(() => {
        this.N.createBidirectionalStream().then((t) => {
          const s = (function (t, s) {
              w || (w = new TextDecoder());
              const e = [];
              let n = 0,
                r = -1,
                o = !1;
              return new TransformStream({
                transform(h, c) {
                  for (e.push(h); ; ) {
                    if (0 === n) {
                      if (v(e) < 1) break;
                      const t = m(e, 1);
                      (o = !(128 & ~t[0])),
                        (r = 127 & t[0]),
                        (n = r < 126 ? 3 : 126 === r ? 1 : 2);
                    } else if (1 === n) {
                      if (v(e) < 2) break;
                      const t = m(e, 2);
                      (r = new DataView(
                        t.buffer,
                        t.byteOffset,
                        t.length
                      ).getUint16(0)),
                        (n = 3);
                    } else if (2 === n) {
                      if (v(e) < 8) break;
                      const t = m(e, 8),
                        s = new DataView(t.buffer, t.byteOffset, t.length),
                        o = s.getUint32(0);
                      if (o > Math.pow(2, 21) - 1) {
                        c.enqueue(i);
                        break;
                      }
                      (r = o * Math.pow(2, 32) + s.getUint32(4)), (n = 3);
                    } else {
                      if (v(e) < r) break;
                      const t = m(e, r);
                      c.enqueue(d(o ? t : w.decode(t), s)), (n = 0);
                    }
                    if (0 === r || r > t) {
                      c.enqueue(i);
                      break;
                    }
                  }
                },
              });
            })(Number.MAX_SAFE_INTEGER, this.socket.binaryType),
            e = t.readable.pipeThrough(s).getReader(),
            n = g();
          n.readable.pipeTo(t.writable), (this.U = n.writable.getWriter());
          const r = () => {
            e.read()
              .then(({ done: t, value: s }) => {
                t || (this.onPacket(s), r());
              })
              .catch((t) => {});
          };
          r();
          const o = { type: "open" };
          this.query.sid && (o.data = `{"sid":"${this.query.sid}"}`),
            this.U.write(o).then(() => this.onOpen());
        });
      });
  }
  write(t) {
    this.writable = !1;
    for (let s = 0; s < t.length; s++) {
      const i = t[s],
        e = s === t.length - 1;
      this.U.write(i).then(() => {
        e &&
          A(() => {
            (this.writable = !0), this.emitReserved("drain");
          }, this.setTimeoutFn);
      });
    }
  }
  doClose() {
    var t;
    null === (t = this.N) || void 0 === t || t.close();
  }
}
const X = { websocket: W, webtransport: q, polling: I },
  z =
    /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
  J = [
    "source",
    "protocol",
    "authority",
    "userInfo",
    "user",
    "password",
    "host",
    "port",
    "relative",
    "path",
    "directory",
    "file",
    "query",
    "anchor",
  ];
function Q(t) {
  if (t.length > 8e3) throw "URI too long";
  const s = t,
    i = t.indexOf("["),
    e = t.indexOf("]");
  -1 != i &&
    -1 != e &&
    (t =
      t.substring(0, i) +
      t.substring(i, e).replace(/:/g, ";") +
      t.substring(e, t.length));
  let n = z.exec(t || ""),
    r = {},
    o = 14;
  for (; o--; ) r[J[o]] = n[o] || "";
  return (
    -1 != i &&
      -1 != e &&
      ((r.source = s),
      (r.host = r.host.substring(1, r.host.length - 1).replace(/;/g, ":")),
      (r.authority = r.authority
        .replace("[", "")
        .replace("]", "")
        .replace(/;/g, ":")),
      (r.ipv6uri = !0)),
    (r.pathNames = (function (t, s) {
      const i = /\/{2,9}/g,
        e = s.replace(i, "/").split("/");
      ("/" != s.slice(0, 1) && 0 !== s.length) || e.splice(0, 1);
      "/" == s.slice(-1) && e.splice(e.length - 1, 1);
      return e;
    })(0, r.path)),
    (r.queryKey = (function (t, s) {
      const i = {};
      return (
        s.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function (t, s, e) {
          s && (i[s] = e);
        }),
        i
      );
    })(0, r.query)),
    r
  );
}
const G =
    "function" == typeof addEventListener &&
    "function" == typeof removeEventListener,
  K = [];
G &&
  addEventListener(
    "offline",
    () => {
      K.forEach((t) => t());
    },
    !1
  );
class Y extends k {
  constructor(t, s) {
    if (
      (super(),
      (this.binaryType = "arraybuffer"),
      (this.writeBuffer = []),
      (this.P = 0),
      (this.D = -1),
      (this.M = -1),
      (this.S = -1),
      (this.L = 1 / 0),
      t && "object" == typeof t && ((s = t), (t = null)),
      t)
    ) {
      const i = Q(t);
      (s.hostname = i.host),
        (s.secure = "https" === i.protocol || "wss" === i.protocol),
        (s.port = i.port),
        i.query && (s.query = i.query);
    } else s.host && (s.hostname = Q(s.host).host);
    x(this, s),
      (this.secure =
        null != s.secure
          ? s.secure
          : "undefined" != typeof location && "https:" === location.protocol),
      s.hostname && !s.port && (s.port = this.secure ? "443" : "80"),
      (this.hostname =
        s.hostname ||
        ("undefined" != typeof location ? location.hostname : "localhost")),
      (this.port =
        s.port ||
        ("undefined" != typeof location && location.port
          ? location.port
          : this.secure
          ? "443"
          : "80")),
      (this.transports = []),
      (this.R = {}),
      s.transports.forEach((t) => {
        const s = t.prototype.name;
        this.transports.push(s), (this.R[s] = t);
      }),
      (this.opts = Object.assign(
        {
          path: "/engine.io",
          agent: !1,
          withCredentials: !1,
          upgrade: !0,
          timestampParam: "t",
          rememberUpgrade: !1,
          addTrailingSlash: !0,
          rejectUnauthorized: !0,
          perMessageDeflate: { threshold: 1024 },
          transportOptions: {},
          closeOnBeforeunload: !1,
        },
        s
      )),
      (this.opts.path =
        this.opts.path.replace(/\/$/, "") +
        (this.opts.addTrailingSlash ? "/" : "")),
      "string" == typeof this.opts.query &&
        (this.opts.query = (function (t) {
          let s = {},
            i = t.split("&");
          for (let t = 0, e = i.length; t < e; t++) {
            let e = i[t].split("=");
            s[decodeURIComponent(e[0])] = decodeURIComponent(e[1]);
          }
          return s;
        })(this.opts.query)),
      G &&
        (this.opts.closeOnBeforeunload &&
          ((this.I = () => {
            this.transport &&
              (this.transport.removeAllListeners(), this.transport.close());
          }),
          addEventListener("beforeunload", this.I, !1)),
        "localhost" !== this.hostname &&
          ((this.F = () => {
            this.$("transport close", {
              description: "network connection lost",
            });
          }),
          K.push(this.F))),
      this.opts.withCredentials && (this.V = void 0),
      this.H();
  }
  createTransport(t) {
    const s = Object.assign({}, this.opts.query);
    (s.EIO = 4), (s.transport = t), this.id && (s.sid = this.id);
    const i = Object.assign(
      {},
      this.opts,
      {
        query: s,
        socket: this,
        hostname: this.hostname,
        secure: this.secure,
        port: this.port,
      },
      this.opts.transportOptions[t]
    );
    return new this.R[t](i);
  }
  H() {
    if (0 === this.transports.length)
      return void this.setTimeoutFn(() => {
        this.emitReserved("error", "No transports available");
      }, 0);
    const t =
      this.opts.rememberUpgrade &&
      Y.priorWebsocketSuccess &&
      -1 !== this.transports.indexOf("websocket")
        ? "websocket"
        : this.transports[0];
    this.readyState = "opening";
    const s = this.createTransport(t);
    s.open(), this.setTransport(s);
  }
  setTransport(t) {
    this.transport && this.transport.removeAllListeners(),
      (this.transport = t),
      t
        .on("drain", this.W.bind(this))
        .on("packet", this.q.bind(this))
        .on("error", this.j.bind(this))
        .on("close", (t) => this.$("transport close", t));
  }
  onOpen() {
    (this.readyState = "open"),
      (Y.priorWebsocketSuccess = "websocket" === this.transport.name),
      this.emitReserved("open"),
      this.flush();
  }
  q(t) {
    if (
      "opening" === this.readyState ||
      "open" === this.readyState ||
      "closing" === this.readyState
    )
      switch (
        (this.emitReserved("packet", t), this.emitReserved("heartbeat"), t.type)
      ) {
        case "open":
          this.onHandshake(JSON.parse(t.data));
          break;
        case "ping":
          this.X("pong"),
            this.emitReserved("ping"),
            this.emitReserved("pong"),
            this.J();
          break;
        case "error":
          const s = new Error("server error");
          (s.code = t.data), this.j(s);
          break;
        case "message":
          this.emitReserved("data", t.data),
            this.emitReserved("message", t.data);
      }
  }
  onHandshake(t) {
    this.emitReserved("handshake", t),
      (this.id = t.sid),
      (this.transport.query.sid = t.sid),
      (this.D = t.pingInterval),
      (this.M = t.pingTimeout),
      (this.S = t.maxPayload),
      this.onOpen(),
      "closed" !== this.readyState && this.J();
  }
  J() {
    this.clearTimeoutFn(this.G);
    const t = this.D + this.M;
    (this.L = Date.now() + t),
      (this.G = this.setTimeoutFn(() => {
        this.$("ping timeout");
      }, t)),
      this.opts.autoUnref && this.G.unref();
  }
  W() {
    this.writeBuffer.splice(0, this.P),
      (this.P = 0),
      0 === this.writeBuffer.length ? this.emitReserved("drain") : this.flush();
  }
  flush() {
    if (
      "closed" !== this.readyState &&
      this.transport.writable &&
      !this.upgrading &&
      this.writeBuffer.length
    ) {
      const t = this.K();
      this.transport.send(t), (this.P = t.length), this.emitReserved("flush");
    }
  }
  K() {
    if (
      !(
        this.S &&
        "polling" === this.transport.name &&
        this.writeBuffer.length > 1
      )
    )
      return this.writeBuffer;
    let t = 1;
    for (let i = 0; i < this.writeBuffer.length; i++) {
      const e = this.writeBuffer[i].data;
      if (
        (e &&
          (t +=
            "string" == typeof (s = e)
              ? (function (t) {
                  let s = 0,
                    i = 0;
                  for (let e = 0, n = t.length; e < n; e++)
                    (s = t.charCodeAt(e)),
                      s < 128
                        ? (i += 1)
                        : s < 2048
                        ? (i += 2)
                        : s < 55296 || s >= 57344
                        ? (i += 3)
                        : (e++, (i += 4));
                  return i;
                })(s)
              : Math.ceil(1.33 * (s.byteLength || s.size))),
        i > 0 && t > this.S)
      )
        return this.writeBuffer.slice(0, i);
      t += 2;
    }
    var s;
    return this.writeBuffer;
  }
  Y() {
    if (!this.L) return !0;
    const t = Date.now() > this.L;
    return (
      t &&
        ((this.L = 0),
        A(() => {
          this.$("ping timeout");
        }, this.setTimeoutFn)),
      t
    );
  }
  write(t, s, i) {
    return this.X("message", t, s, i), this;
  }
  send(t, s, i) {
    return this.X("message", t, s, i), this;
  }
  X(t, s, i, e) {
    if (
      ("function" == typeof s && ((e = s), (s = void 0)),
      "function" == typeof i && ((e = i), (i = null)),
      "closing" === this.readyState || "closed" === this.readyState)
    )
      return;
    (i = i || {}).compress = !1 !== i.compress;
    const n = { type: t, data: s, options: i };
    this.emitReserved("packetCreate", n),
      this.writeBuffer.push(n),
      e && this.once("flush", e),
      this.flush();
  }
  close() {
    const t = () => {
        this.$("forced close"), this.transport.close();
      },
      s = () => {
        this.off("upgrade", s), this.off("upgradeError", s), t();
      },
      i = () => {
        this.once("upgrade", s), this.once("upgradeError", s);
      };
    return (
      ("opening" !== this.readyState && "open" !== this.readyState) ||
        ((this.readyState = "closing"),
        this.writeBuffer.length
          ? this.once("drain", () => {
              this.upgrading ? i() : t();
            })
          : this.upgrading
          ? i()
          : t()),
      this
    );
  }
  j(t) {
    if (
      ((Y.priorWebsocketSuccess = !1),
      this.opts.tryAllTransports &&
        this.transports.length > 1 &&
        "opening" === this.readyState)
    )
      return this.transports.shift(), this.H();
    this.emitReserved("error", t), this.$("transport error", t);
  }
  $(t, s) {
    if (
      "opening" === this.readyState ||
      "open" === this.readyState ||
      "closing" === this.readyState
    ) {
      if (
        (this.clearTimeoutFn(this.G),
        this.transport.removeAllListeners("close"),
        this.transport.close(),
        this.transport.removeAllListeners(),
        G &&
          (this.I && removeEventListener("beforeunload", this.I, !1), this.F))
      ) {
        const t = K.indexOf(this.F);
        -1 !== t && K.splice(t, 1);
      }
      (this.readyState = "closed"),
        (this.id = null),
        this.emitReserved("close", t, s),
        (this.writeBuffer = []),
        (this.P = 0);
    }
  }
}
Y.protocol = 4;
class Z extends Y {
  constructor() {
    super(...arguments), (this.Z = []);
  }
  onOpen() {
    if ((super.onOpen(), "open" === this.readyState && this.opts.upgrade))
      for (let t = 0; t < this.Z.length; t++) this.tt(this.Z[t]);
  }
  tt(t) {
    let s = this.createTransport(t),
      i = !1;
    Y.priorWebsocketSuccess = !1;
    const e = () => {
      i ||
        (s.send([{ type: "ping", data: "probe" }]),
        s.once("packet", (t) => {
          if (!i)
            if ("pong" === t.type && "probe" === t.data) {
              if (
                ((this.upgrading = !0), this.emitReserved("upgrading", s), !s)
              )
                return;
              (Y.priorWebsocketSuccess = "websocket" === s.name),
                this.transport.pause(() => {
                  i ||
                    ("closed" !== this.readyState &&
                      (a(),
                      this.setTransport(s),
                      s.send([{ type: "upgrade" }]),
                      this.emitReserved("upgrade", s),
                      (s = null),
                      (this.upgrading = !1),
                      this.flush()));
                });
            } else {
              const t = new Error("probe error");
              (t.transport = s.name), this.emitReserved("upgradeError", t);
            }
        }));
    };
    function n() {
      i || ((i = !0), a(), s.close(), (s = null));
    }
    const r = (t) => {
      const i = new Error("probe error: " + t);
      (i.transport = s.name), n(), this.emitReserved("upgradeError", i);
    };
    function o() {
      r("transport closed");
    }
    function h() {
      r("socket closed");
    }
    function c(t) {
      s && t.name !== s.name && n();
    }
    const a = () => {
      s.removeListener("open", e),
        s.removeListener("error", r),
        s.removeListener("close", o),
        this.off("close", h),
        this.off("upgrading", c);
    };
    s.once("open", e),
      s.once("error", r),
      s.once("close", o),
      this.once("close", h),
      this.once("upgrading", c),
      -1 !== this.Z.indexOf("webtransport") && "webtransport" !== t
        ? this.setTimeoutFn(() => {
            i || s.open();
          }, 200)
        : s.open();
  }
  onHandshake(t) {
    (this.Z = this.st(t.upgrades)), super.onHandshake(t);
  }
  st(t) {
    const s = [];
    for (let i = 0; i < t.length; i++)
      ~this.transports.indexOf(t[i]) && s.push(t[i]);
    return s;
  }
}
class tt extends Z {
  constructor(t, s = {}) {
    const i = "object" == typeof t ? t : s;
    (!i.transports || (i.transports && "string" == typeof i.transports[0])) &&
      (i.transports = (i.transports || ["polling", "websocket", "webtransport"])
        .map((t) => X[t])
        .filter((t) => !!t)),
      super(t, i);
  }
}
class st extends N {
  doPoll() {
    this.it()
      .then((t) => {
        if (!t.ok) return this.onError("fetch read error", t.status, t);
        t.text().then((t) => this.onData(t));
      })
      .catch((t) => {
        this.onError("fetch read error", t);
      });
  }
  doWrite(t, s) {
    this.it(t)
      .then((t) => {
        if (!t.ok) return this.onError("fetch write error", t.status, t);
        s();
      })
      .catch((t) => {
        this.onError("fetch write error", t);
      });
  }
  it(t) {
    var s;
    const i = void 0 !== t,
      e = new Headers(this.opts.extraHeaders);
    return (
      i && e.set("content-type", "text/plain;charset=UTF-8"),
      null === (s = this.socket.V) || void 0 === s || s.appendCookies(e),
      fetch(this.uri(), {
        method: i ? "POST" : "GET",
        body: i ? t : null,
        headers: e,
        credentials: this.opts.withCredentials ? "include" : "omit",
      }).then((t) => {
        var s;
        return (
          null === (s = this.socket.V) ||
            void 0 === s ||
            s.parseCookies(t.headers.getSetCookie()),
          t
        );
      })
    );
  }
}
const it = "function" == typeof ArrayBuffer,
  et = (t) =>
    "function" == typeof ArrayBuffer.isView
      ? ArrayBuffer.isView(t)
      : t.buffer instanceof ArrayBuffer,
  nt = Object.prototype.toString,
  rt =
    "function" == typeof Blob ||
    ("undefined" != typeof Blob &&
      "[object BlobConstructor]" === nt.call(Blob)),
  ot =
    "function" == typeof File ||
    ("undefined" != typeof File &&
      "[object FileConstructor]" === nt.call(File));
function ht(t) {
  return (
    (it && (t instanceof ArrayBuffer || et(t))) ||
    (rt && t instanceof Blob) ||
    (ot && t instanceof File)
  );
}
function ct(t, s) {
  if (!t || "object" != typeof t) return !1;
  if (Array.isArray(t)) {
    for (let s = 0, i = t.length; s < i; s++) if (ct(t[s])) return !0;
    return !1;
  }
  if (ht(t)) return !0;
  if (t.toJSON && "function" == typeof t.toJSON && 1 === arguments.length)
    return ct(t.toJSON(), !0);
  for (const s in t)
    if (Object.prototype.hasOwnProperty.call(t, s) && ct(t[s])) return !0;
  return !1;
}
function at(t) {
  const s = [],
    i = t.data,
    e = t;
  return (
    (e.data = ut(i, s)), (e.attachments = s.length), { packet: e, buffers: s }
  );
}
function ut(t, s) {
  if (!t) return t;
  if (ht(t)) {
    const i = { et: !0, num: s.length };
    return s.push(t), i;
  }
  if (Array.isArray(t)) {
    const i = new Array(t.length);
    for (let e = 0; e < t.length; e++) i[e] = ut(t[e], s);
    return i;
  }
  if ("object" == typeof t && !(t instanceof Date)) {
    const i = {};
    for (const e in t)
      Object.prototype.hasOwnProperty.call(t, e) && (i[e] = ut(t[e], s));
    return i;
  }
  return t;
}
function ft(t, s) {
  return (t.data = lt(t.data, s)), delete t.attachments, t;
}
function lt(t, s) {
  if (!t) return t;
  if (t && !0 === t.et) {
    if ("number" == typeof t.num && t.num >= 0 && t.num < s.length)
      return s[t.num];
    throw new Error("illegal attachments");
  }
  if (Array.isArray(t)) for (let i = 0; i < t.length; i++) t[i] = lt(t[i], s);
  else if ("object" == typeof t)
    for (const i in t)
      Object.prototype.hasOwnProperty.call(t, i) && (t[i] = lt(t[i], s));
  return t;
}
const dt = [
    "connect",
    "connect_error",
    "disconnect",
    "disconnecting",
    "newListener",
    "removeListener",
  ],
  pt = 5;
var yt;
!(function (t) {
  (t[(t.CONNECT = 0)] = "CONNECT"),
    (t[(t.DISCONNECT = 1)] = "DISCONNECT"),
    (t[(t.EVENT = 2)] = "EVENT"),
    (t[(t.ACK = 3)] = "ACK"),
    (t[(t.CONNECT_ERROR = 4)] = "CONNECT_ERROR"),
    (t[(t.BINARY_EVENT = 5)] = "BINARY_EVENT"),
    (t[(t.BINARY_ACK = 6)] = "BINARY_ACK");
})(yt || (yt = {}));
class bt extends k {
  constructor(t) {
    super(), (this.reviver = t);
  }
  add(t) {
    let s;
    if ("string" == typeof t) {
      if (this.reconstructor)
        throw new Error("got plaintext data when reconstructing a packet");
      s = this.decodeString(t);
      const i = s.type === yt.BINARY_EVENT;
      i || s.type === yt.BINARY_ACK
        ? ((s.type = i ? yt.EVENT : yt.ACK),
          (this.reconstructor = new gt(s)),
          0 === s.attachments && super.emitReserved("decoded", s))
        : super.emitReserved("decoded", s);
    } else {
      if (!ht(t) && !t.base64) throw new Error("Unknown type: " + t);
      if (!this.reconstructor)
        throw new Error("got binary data when not reconstructing a packet");
      (s = this.reconstructor.takeBinaryData(t)),
        s && ((this.reconstructor = null), super.emitReserved("decoded", s));
    }
  }
  decodeString(t) {
    let s = 0;
    const i = { type: Number(t.charAt(0)) };
    if (void 0 === yt[i.type]) throw new Error("unknown packet type " + i.type);
    if (i.type === yt.BINARY_EVENT || i.type === yt.BINARY_ACK) {
      const e = s + 1;
      for (; "-" !== t.charAt(++s) && s != t.length; );
      const n = t.substring(e, s);
      if (n != Number(n) || "-" !== t.charAt(s))
        throw new Error("Illegal attachments");
      i.attachments = Number(n);
    }
    if ("/" === t.charAt(s + 1)) {
      const e = s + 1;
      for (; ++s; ) {
        if ("," === t.charAt(s)) break;
        if (s === t.length) break;
      }
      i.nsp = t.substring(e, s);
    } else i.nsp = "/";
    const e = t.charAt(s + 1);
    if ("" !== e && Number(e) == e) {
      const e = s + 1;
      for (; ++s; ) {
        const i = t.charAt(s);
        if (null == i || Number(i) != i) {
          --s;
          break;
        }
        if (s === t.length) break;
      }
      i.id = Number(t.substring(e, s + 1));
    }
    if (t.charAt(++s)) {
      const e = this.tryParse(t.substr(s));
      if (!bt.isPayloadValid(i.type, e)) throw new Error("invalid payload");
      i.data = e;
    }
    return i;
  }
  tryParse(t) {
    try {
      return JSON.parse(t, this.reviver);
    } catch (t) {
      return !1;
    }
  }
  static isPayloadValid(t, s) {
    switch (t) {
      case yt.CONNECT:
        return vt(s);
      case yt.DISCONNECT:
        return void 0 === s;
      case yt.CONNECT_ERROR:
        return "string" == typeof s || vt(s);
      case yt.EVENT:
      case yt.BINARY_EVENT:
        return (
          Array.isArray(s) &&
          ("number" == typeof s[0] ||
            ("string" == typeof s[0] && -1 === dt.indexOf(s[0])))
        );
      case yt.ACK:
      case yt.BINARY_ACK:
        return Array.isArray(s);
    }
  }
  destroy() {
    this.reconstructor &&
      (this.reconstructor.finishedReconstruction(),
      (this.reconstructor = null));
  }
}
class gt {
  constructor(t) {
    (this.packet = t), (this.buffers = []), (this.reconPack = t);
  }
  takeBinaryData(t) {
    if (
      (this.buffers.push(t), this.buffers.length === this.reconPack.attachments)
    ) {
      const t = ft(this.reconPack, this.buffers);
      return this.finishedReconstruction(), t;
    }
    return null;
  }
  finishedReconstruction() {
    (this.reconPack = null), (this.buffers = []);
  }
}
const wt =
  Number.isInteger ||
  function (t) {
    return "number" == typeof t && isFinite(t) && Math.floor(t) === t;
  };
function vt(t) {
  return "[object Object]" === Object.prototype.toString.call(t);
}
var mt = Object.freeze({
  __proto__: null,
  protocol: 5,
  get PacketType() {
    return yt;
  },
  Encoder: class {
    constructor(t) {
      this.replacer = t;
    }
    encode(t) {
      return (t.type !== yt.EVENT && t.type !== yt.ACK) || !ct(t)
        ? [this.encodeAsString(t)]
        : this.encodeAsBinary({
            type: t.type === yt.EVENT ? yt.BINARY_EVENT : yt.BINARY_ACK,
            nsp: t.nsp,
            data: t.data,
            id: t.id,
          });
    }
    encodeAsString(t) {
      let s = "" + t.type;
      return (
        (t.type !== yt.BINARY_EVENT && t.type !== yt.BINARY_ACK) ||
          (s += t.attachments + "-"),
        t.nsp && "/" !== t.nsp && (s += t.nsp + ","),
        null != t.id && (s += t.id),
        null != t.data && (s += JSON.stringify(t.data, this.replacer)),
        s
      );
    }
    encodeAsBinary(t) {
      const s = at(t),
        i = this.encodeAsString(s.packet),
        e = s.buffers;
      return e.unshift(i), e;
    }
  },
  Decoder: bt,
  isPacketValid: function (t) {
    return (
      "string" == typeof t.nsp &&
      (void 0 === (s = t.id) || wt(s)) &&
      (function (t, s) {
        switch (t) {
          case yt.CONNECT:
            return void 0 === s || vt(s);
          case yt.DISCONNECT:
            return void 0 === s;
          case yt.EVENT:
            return (
              Array.isArray(s) &&
              ("number" == typeof s[0] ||
                ("string" == typeof s[0] && -1 === dt.indexOf(s[0])))
            );
          case yt.ACK:
            return Array.isArray(s);
          case yt.CONNECT_ERROR:
            return "string" == typeof s || vt(s);
          default:
            return !1;
        }
      })(t.type, t.data)
    );
    var s;
  },
});
function kt(t, s, i) {
  return (
    t.on(s, i),
    function () {
      t.off(s, i);
    }
  );
}
const At = Object.freeze({
  connect: 1,
  connect_error: 1,
  disconnect: 1,
  disconnecting: 1,
  newListener: 1,
  removeListener: 1,
});
class Et extends k {
  constructor(t, s, i) {
    super(),
      (this.connected = !1),
      (this.recovered = !1),
      (this.receiveBuffer = []),
      (this.sendBuffer = []),
      (this.nt = []),
      (this.rt = 0),
      (this.ids = 0),
      (this.acks = {}),
      (this.flags = {}),
      (this.io = t),
      (this.nsp = s),
      i && i.auth && (this.auth = i.auth),
      (this.p = Object.assign({}, i)),
      this.io.ot && this.open();
  }
  get disconnected() {
    return !this.connected;
  }
  subEvents() {
    if (this.subs) return;
    const t = this.io;
    this.subs = [
      kt(t, "open", this.onopen.bind(this)),
      kt(t, "packet", this.onpacket.bind(this)),
      kt(t, "error", this.onerror.bind(this)),
      kt(t, "close", this.onclose.bind(this)),
    ];
  }
  get active() {
    return !!this.subs;
  }
  connect() {
    return (
      this.connected ||
        (this.subEvents(),
        this.io.ht || this.io.open(),
        "open" === this.io.ct && this.onopen()),
      this
    );
  }
  open() {
    return this.connect();
  }
  send(...t) {
    return t.unshift("message"), this.emit.apply(this, t), this;
  }
  emit(t, ...s) {
    var i, e, n;
    if (At.hasOwnProperty(t))
      throw new Error('"' + t.toString() + '" is a reserved event name');
    if (
      (s.unshift(t),
      this.p.retries && !this.flags.fromQueue && !this.flags.volatile)
    )
      return this.ut(s), this;
    const r = { type: yt.EVENT, data: s, options: {} };
    if (
      ((r.options.compress = !1 !== this.flags.compress),
      "function" == typeof s[s.length - 1])
    ) {
      const t = this.ids++,
        i = s.pop();
      this.ft(t, i), (r.id = t);
    }
    const o =
        null ===
          (e =
            null === (i = this.io.engine) || void 0 === i
              ? void 0
              : i.transport) || void 0 === e
          ? void 0
          : e.writable,
      h =
        this.connected &&
        !(null === (n = this.io.engine) || void 0 === n ? void 0 : n.Y());
    return (
      (this.flags.volatile && !o) ||
        (h
          ? (this.notifyOutgoingListeners(r), this.packet(r))
          : this.sendBuffer.push(r)),
      (this.flags = {}),
      this
    );
  }
  ft(t, s) {
    var i;
    const e =
      null !== (i = this.flags.timeout) && void 0 !== i ? i : this.p.ackTimeout;
    if (void 0 === e) return void (this.acks[t] = s);
    const n = this.io.setTimeoutFn(() => {
        delete this.acks[t];
        for (let s = 0; s < this.sendBuffer.length; s++)
          this.sendBuffer[s].id === t && this.sendBuffer.splice(s, 1);
        s.call(this, new Error("operation has timed out"));
      }, e),
      r = (...t) => {
        this.io.clearTimeoutFn(n), s.apply(this, t);
      };
    (r.withError = !0), (this.acks[t] = r);
  }
  emitWithAck(t, ...s) {
    return new Promise((i, e) => {
      const n = (t, s) => (t ? e(t) : i(s));
      (n.withError = !0), s.push(n), this.emit(t, ...s);
    });
  }
  ut(t) {
    let s;
    "function" == typeof t[t.length - 1] && (s = t.pop());
    const i = {
      id: this.rt++,
      tryCount: 0,
      pending: !1,
      args: t,
      flags: Object.assign({ fromQueue: !0 }, this.flags),
    };
    t.push((t, ...e) => {
      if (i !== this.nt[0]) return;
      return (
        null !== t
          ? i.tryCount > this.p.retries && (this.nt.shift(), s && s(t))
          : (this.nt.shift(), s && s(null, ...e)),
        (i.pending = !1),
        this.lt()
      );
    }),
      this.nt.push(i),
      this.lt();
  }
  lt(t = !1) {
    if (!this.connected || 0 === this.nt.length) return;
    const s = this.nt[0];
    (s.pending && !t) ||
      ((s.pending = !0),
      s.tryCount++,
      (this.flags = s.flags),
      this.emit.apply(this, s.args));
  }
  packet(t) {
    (t.nsp = this.nsp), this.io.dt(t);
  }
  onopen() {
    "function" == typeof this.auth
      ? this.auth((t) => {
          this.yt(t);
        })
      : this.yt(this.auth);
  }
  yt(t) {
    this.packet({
      type: yt.CONNECT,
      data: this.bt ? Object.assign({ pid: this.bt, offset: this.gt }, t) : t,
    });
  }
  onerror(t) {
    this.connected || this.emitReserved("connect_error", t);
  }
  onclose(t, s) {
    (this.connected = !1),
      delete this.id,
      this.emitReserved("disconnect", t, s),
      this.wt();
  }
  wt() {
    Object.keys(this.acks).forEach((t) => {
      if (!this.sendBuffer.some((s) => String(s.id) === t)) {
        const s = this.acks[t];
        delete this.acks[t],
          s.withError &&
            s.call(this, new Error("socket has been disconnected"));
      }
    });
  }
  onpacket(t) {
    if (t.nsp === this.nsp)
      switch (t.type) {
        case yt.CONNECT:
          t.data && t.data.sid
            ? this.onconnect(t.data.sid, t.data.pid)
            : this.emitReserved(
                "connect_error",
                new Error(
                  "It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"
                )
              );
          break;
        case yt.EVENT:
        case yt.BINARY_EVENT:
          this.onevent(t);
          break;
        case yt.ACK:
        case yt.BINARY_ACK:
          this.onack(t);
          break;
        case yt.DISCONNECT:
          this.ondisconnect();
          break;
        case yt.CONNECT_ERROR:
          this.destroy();
          const s = new Error(t.data.message);
          (s.data = t.data.data), this.emitReserved("connect_error", s);
      }
  }
  onevent(t) {
    const s = t.data || [];
    null != t.id && s.push(this.ack(t.id)),
      this.connected
        ? this.emitEvent(s)
        : this.receiveBuffer.push(Object.freeze(s));
  }
  emitEvent(t) {
    if (this.vt && this.vt.length) {
      const s = this.vt.slice();
      for (const i of s) i.apply(this, t);
    }
    super.emit.apply(this, t),
      this.bt &&
        t.length &&
        "string" == typeof t[t.length - 1] &&
        (this.gt = t[t.length - 1]);
  }
  ack(t) {
    const s = this;
    let i = !1;
    return function (...e) {
      i || ((i = !0), s.packet({ type: yt.ACK, id: t, data: e }));
    };
  }
  onack(t) {
    const s = this.acks[t.id];
    "function" == typeof s &&
      (delete this.acks[t.id],
      s.withError && t.data.unshift(null),
      s.apply(this, t.data));
  }
  onconnect(t, s) {
    (this.id = t),
      (this.recovered = s && this.bt === s),
      (this.bt = s),
      (this.connected = !0),
      this.emitBuffered(),
      this.emitReserved("connect"),
      this.lt(!0);
  }
  emitBuffered() {
    this.receiveBuffer.forEach((t) => this.emitEvent(t)),
      (this.receiveBuffer = []),
      this.sendBuffer.forEach((t) => {
        this.notifyOutgoingListeners(t), this.packet(t);
      }),
      (this.sendBuffer = []);
  }
  ondisconnect() {
    this.destroy(), this.onclose("io server disconnect");
  }
  destroy() {
    this.subs && (this.subs.forEach((t) => t()), (this.subs = void 0)),
      this.io.kt(this);
  }
  disconnect() {
    return (
      this.connected && this.packet({ type: yt.DISCONNECT }),
      this.destroy(),
      this.connected && this.onclose("io client disconnect"),
      this
    );
  }
  close() {
    return this.disconnect();
  }
  compress(t) {
    return (this.flags.compress = t), this;
  }
  get volatile() {
    return (this.flags.volatile = !0), this;
  }
  timeout(t) {
    return (this.flags.timeout = t), this;
  }
  onAny(t) {
    return (this.vt = this.vt || []), this.vt.push(t), this;
  }
  prependAny(t) {
    return (this.vt = this.vt || []), this.vt.unshift(t), this;
  }
  offAny(t) {
    if (!this.vt) return this;
    if (t) {
      const s = this.vt;
      for (let i = 0; i < s.length; i++)
        if (t === s[i]) return s.splice(i, 1), this;
    } else this.vt = [];
    return this;
  }
  listenersAny() {
    return this.vt || [];
  }
  onAnyOutgoing(t) {
    return (this.At = this.At || []), this.At.push(t), this;
  }
  prependAnyOutgoing(t) {
    return (this.At = this.At || []), this.At.unshift(t), this;
  }
  offAnyOutgoing(t) {
    if (!this.At) return this;
    if (t) {
      const s = this.At;
      for (let i = 0; i < s.length; i++)
        if (t === s[i]) return s.splice(i, 1), this;
    } else this.At = [];
    return this;
  }
  listenersAnyOutgoing() {
    return this.At || [];
  }
  notifyOutgoingListeners(t) {
    if (this.At && this.At.length) {
      const s = this.At.slice();
      for (const i of s) i.apply(this, t.data);
    }
  }
}
function Ot(t) {
  (t = t || {}),
    (this.ms = t.min || 100),
    (this.max = t.max || 1e4),
    (this.factor = t.factor || 2),
    (this.jitter = t.jitter > 0 && t.jitter <= 1 ? t.jitter : 0),
    (this.attempts = 0);
}
(Ot.prototype.duration = function () {
  var t = this.ms * Math.pow(this.factor, this.attempts++);
  if (this.jitter) {
    var s = Math.random(),
      i = Math.floor(s * this.jitter * t);
    t = 1 & Math.floor(10 * s) ? t + i : t - i;
  }
  return 0 | Math.min(t, this.max);
}),
  (Ot.prototype.reset = function () {
    this.attempts = 0;
  }),
  (Ot.prototype.setMin = function (t) {
    this.ms = t;
  }),
  (Ot.prototype.setMax = function (t) {
    this.max = t;
  }),
  (Ot.prototype.setJitter = function (t) {
    this.jitter = t;
  });
class _t extends k {
  constructor(t, s) {
    var i;
    super(),
      (this.nsps = {}),
      (this.subs = []),
      t && "object" == typeof t && ((s = t), (t = void 0)),
      ((s = s || {}).path = s.path || "/socket.io"),
      (this.opts = s),
      x(this, s),
      this.reconnection(!1 !== s.reconnection),
      this.reconnectionAttempts(s.reconnectionAttempts || 1 / 0),
      this.reconnectionDelay(s.reconnectionDelay || 1e3),
      this.reconnectionDelayMax(s.reconnectionDelayMax || 5e3),
      this.randomizationFactor(
        null !== (i = s.randomizationFactor) && void 0 !== i ? i : 0.5
      ),
      (this.backoff = new Ot({
        min: this.reconnectionDelay(),
        max: this.reconnectionDelayMax(),
        jitter: this.randomizationFactor(),
      })),
      this.timeout(null == s.timeout ? 2e4 : s.timeout),
      (this.ct = "closed"),
      (this.uri = t);
    const e = s.parser || mt;
    (this.encoder = new e.Encoder()),
      (this.decoder = new e.Decoder()),
      (this.ot = !1 !== s.autoConnect),
      this.ot && this.open();
  }
  reconnection(t) {
    return arguments.length
      ? ((this.Et = !!t), t || (this.skipReconnect = !0), this)
      : this.Et;
  }
  reconnectionAttempts(t) {
    return void 0 === t ? this.Ot : ((this.Ot = t), this);
  }
  reconnectionDelay(t) {
    var s;
    return void 0 === t
      ? this._t
      : ((this._t = t),
        null === (s = this.backoff) || void 0 === s || s.setMin(t),
        this);
  }
  randomizationFactor(t) {
    var s;
    return void 0 === t
      ? this.jt
      : ((this.jt = t),
        null === (s = this.backoff) || void 0 === s || s.setJitter(t),
        this);
  }
  reconnectionDelayMax(t) {
    var s;
    return void 0 === t
      ? this.xt
      : ((this.xt = t),
        null === (s = this.backoff) || void 0 === s || s.setMax(t),
        this);
  }
  timeout(t) {
    return arguments.length ? ((this.Bt = t), this) : this.Bt;
  }
  maybeReconnectOnOpen() {
    !this.ht && this.Et && 0 === this.backoff.attempts && this.reconnect();
  }
  open(t) {
    if (~this.ct.indexOf("open")) return this;
    this.engine = new tt(this.uri, this.opts);
    const s = this.engine,
      i = this;
    (this.ct = "opening"), (this.skipReconnect = !1);
    const e = kt(s, "open", function () {
        i.onopen(), t && t();
      }),
      n = (s) => {
        this.cleanup(),
          (this.ct = "closed"),
          this.emitReserved("error", s),
          t ? t(s) : this.maybeReconnectOnOpen();
      },
      r = kt(s, "error", n);
    if (!1 !== this.Bt) {
      const t = this.Bt,
        i = this.setTimeoutFn(() => {
          e(), n(new Error("timeout")), s.close();
        }, t);
      this.opts.autoUnref && i.unref(),
        this.subs.push(() => {
          this.clearTimeoutFn(i);
        });
    }
    return this.subs.push(e), this.subs.push(r), this;
  }
  connect(t) {
    return this.open(t);
  }
  onopen() {
    this.cleanup(), (this.ct = "open"), this.emitReserved("open");
    const t = this.engine;
    this.subs.push(
      kt(t, "ping", this.onping.bind(this)),
      kt(t, "data", this.ondata.bind(this)),
      kt(t, "error", this.onerror.bind(this)),
      kt(t, "close", this.onclose.bind(this)),
      kt(this.decoder, "decoded", this.ondecoded.bind(this))
    );
  }
  onping() {
    this.emitReserved("ping");
  }
  ondata(t) {
    try {
      this.decoder.add(t);
    } catch (t) {
      this.onclose("parse error", t);
    }
  }
  ondecoded(t) {
    A(() => {
      this.emitReserved("packet", t);
    }, this.setTimeoutFn);
  }
  onerror(t) {
    this.emitReserved("error", t);
  }
  socket(t, s) {
    let i = this.nsps[t];
    return (
      i
        ? this.ot && !i.active && i.connect()
        : ((i = new Et(this, t, s)), (this.nsps[t] = i)),
      i
    );
  }
  kt(t) {
    const s = Object.keys(this.nsps);
    for (const t of s) {
      if (this.nsps[t].active) return;
    }
    this.Ct();
  }
  dt(t) {
    const s = this.encoder.encode(t);
    for (let i = 0; i < s.length; i++) this.engine.write(s[i], t.options);
  }
  cleanup() {
    this.subs.forEach((t) => t()),
      (this.subs.length = 0),
      this.decoder.destroy();
  }
  Ct() {
    (this.skipReconnect = !0), (this.ht = !1), this.onclose("forced close");
  }
  disconnect() {
    return this.Ct();
  }
  onclose(t, s) {
    var i;
    this.cleanup(),
      null === (i = this.engine) || void 0 === i || i.close(),
      this.backoff.reset(),
      (this.ct = "closed"),
      this.emitReserved("close", t, s),
      this.Et && !this.skipReconnect && this.reconnect();
  }
  reconnect() {
    if (this.ht || this.skipReconnect) return this;
    const t = this;
    if (this.backoff.attempts >= this.Ot)
      this.backoff.reset(),
        this.emitReserved("reconnect_failed"),
        (this.ht = !1);
    else {
      const s = this.backoff.duration();
      this.ht = !0;
      const i = this.setTimeoutFn(() => {
        t.skipReconnect ||
          (this.emitReserved("reconnect_attempt", t.backoff.attempts),
          t.skipReconnect ||
            t.open((s) => {
              s
                ? ((t.ht = !1),
                  t.reconnect(),
                  this.emitReserved("reconnect_error", s))
                : t.onreconnect();
            }));
      }, s);
      this.opts.autoUnref && i.unref(),
        this.subs.push(() => {
          this.clearTimeoutFn(i);
        });
    }
  }
  onreconnect() {
    const t = this.backoff.attempts;
    (this.ht = !1), this.backoff.reset(), this.emitReserved("reconnect", t);
  }
}
const jt = {};
function xt(t, s) {
  "object" == typeof t && ((s = t), (t = void 0));
  const i = (function (t, s = "", i) {
      let e = t;
      (i = i || ("undefined" != typeof location && location)),
        null == t && (t = i.protocol + "//" + i.host),
        "string" == typeof t &&
          ("/" === t.charAt(0) &&
            (t = "/" === t.charAt(1) ? i.protocol + t : i.host + t),
          /^(https?|wss?):\/\//.test(t) ||
            (t = void 0 !== i ? i.protocol + "//" + t : "https://" + t),
          (e = Q(t))),
        e.port ||
          (/^(http|ws)$/.test(e.protocol)
            ? (e.port = "80")
            : /^(http|ws)s$/.test(e.protocol) && (e.port = "443")),
        (e.path = e.path || "/");
      const n = -1 !== e.host.indexOf(":") ? "[" + e.host + "]" : e.host;
      return (
        (e.id = e.protocol + "://" + n + ":" + e.port + s),
        (e.href =
          e.protocol +
          "://" +
          n +
          (i && i.port === e.port ? "" : ":" + e.port)),
        e
      );
    })(t, (s = s || {}).path || "/socket.io"),
    e = i.source,
    n = i.id,
    r = i.path,
    o = jt[n] && r in jt[n].nsps;
  let h;
  return (
    s.forceNew || s["force new connection"] || !1 === s.multiplex || o
      ? (h = new _t(e, s))
      : (jt[n] || (jt[n] = new _t(e, s)), (h = jt[n])),
    i.query && !s.query && (s.query = i.queryKey),
    h.socket(i.path, s)
  );
}
Object.assign(xt, { Manager: _t, Socket: Et, io: xt, connect: xt });
export {
  st as Fetch,
  _t as Manager,
  W as NodeWebSocket,
  I as NodeXHR,
  Et as Socket,
  W as WebSocket,
  q as WebTransport,
  I as XHR,
  xt as connect,
  xt as default,
  xt as io,
  pt as protocol,
};
//# sourceMappingURL=socket.io.esm.min.js.map

function back() {
    Swal.fire({
        title: '¡Alerta!',
        text: '¿Está seguro de que desea salir? Los cambios no se guardarán.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        confirmButtonColor: '#d41717',
        cancelButtonText: 'No'
    }).then((result) => {
        if (result.isConfirmed) {
            location.href = "index.html";
        }
    });
}

async function search() {
    await clearHighlights();
    document.getElementById("up-search").style.display = "block";
    document.getElementById("down-search").style.display = "block";
    document.getElementById("btn-search").style.display = "none";
    document.getElementById("btn-close").style.display = "block";
    document.getElementById("search-text").style.display = "flex";
    document.getElementById("search-text").innerHTML = "0/0";
    document.getElementById("search").style.display = "block";
    document.getElementById("search").focus();
}

async function searchText() {
    await clearHighlights();
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
}

async function clearHighlights() {
    let content = document.getElementsByClassName("content")[0];
    let innerHTML = content.innerHTML;
    innerHTML = innerHTML.replace(/<span class="highlight">(.*?)<\/span>/g, "$1");
    innerHTML = innerHTML.replace(/<span class="highlight current">(.*?)<\/span>/g, "$1");
    content.innerHTML = innerHTML;
}

async function closeSearch() {
    await clearHighlights();
    document.getElementById("search").value = "";
    document.getElementById("search").style.display = "none";
    document.getElementById("up-search").style.display = "none";
    document.getElementById("down-search").style.display = "none";
    document.getElementById("btn-search").style.display = "block";
    document.getElementById("btn-close").style.display = "none";
    document.getElementById("search-text").style.display = "none";
}

async function upSearch() {
    // Buscar y resaltar el siguiente highlight hacia arriba
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

    // Llevar el scroll al elemento resaltado
    highlights[index - 1].scrollIntoView({ behavior: "smooth", block: "center" });
}

async function downSearch() {
    // Buscar y resaltar el siguiente highlight hacia abajo
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

    // Llevar el scroll al elemento resaltado
    highlights[index + 1].scrollIntoView({ behavior: "smooth", block: "center" });
}

async function addZoom() {
    // Aumentar el zoom del contenido
    let content = document.getElementsByClassName("content")[0];
    let currentZoom = parseInt(content.style.zoom) || 100;
    content.style.zoom = currentZoom + 10 + "%";

    // Validar que el zoom no sea mayor al 150%
    if (currentZoom >= 150) {
        content.style.zoom = "150%";
    }
}

async function lessZoom() {
    // Disminuir el zoom del contenido
    let content = document.getElementsByClassName("content")[0];
    let currentZoom = parseInt(content.style.zoom) || 100;
    content.style.zoom = currentZoom - 10 + "%";

    // Validar que el zoom no sea menor al 100%
    if (currentZoom <= 100) {
        content.style.zoom = "100%";
    }
}

async function save() {
    // Validar si el canvas tiene algo dibujado
    if (ctx.getImageData(0, 0, canvas.width, canvas.height).data.some(value => value !== 0)) {
        Swal.fire({
            title: '¡Alerta!',
            text: '¿Está seguro de que desea terminar?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Sí',
            confirmButtonColor: '#d41717',
            cancelButtonText: 'No'
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('¡Alerta!', 'Guardado con éxito', 'success');

                if(window.socket){
                    // Enviar la firma al servidor
                    const signatureData = canvas.toDataURL("image/png").split(',')[1]; // Solo base64
                    
                    window.socket.emit("saveSignature", {
                        signature: signatureData,
                        asigTo: "1004163783" // Cambia esto por el ID del destinatario real
                    });

                    // Redirigir al index.html
                    setTimeout(() => {
                        location.href = "index.html";
                    }, 1000);

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
}

// Evento para buscar y resaltar el texto al presionar Enter
document.getElementById("search").addEventListener("keyup", function (event) {
    let valueTxt = document.getElementById("search").value;

    if (valueTxt.length >= 4) {
        searchText();
    } else {
        clearHighlights();
        document.getElementById("search-text").innerHTML = "0/0";
    }
});

// Apenas carga el documento
document.addEventListener("DOMContentLoaded", function () {
    // Falta la páginación del documento
    const content = document.querySelector(".content");
    const pageHeight = 297 * 3.77953; // Altura de una página A4 en px (1mm = 3.77953px)
    const pageMargin = 20 * 3.77953; // Margen entre páginas en px
    let page = 1;

    // Poner zoom en 130% apenas carga
    content.style.zoom = "130%";
});

// Canvas para la firma
const canvas = document.getElementById("draw-canvas");
const ctx = canvas.getContext("2d");
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.lineWidth = 2; // O el valor que prefieras
ctx.strokeStyle = "#000"; // Color del trazo
let isDrawing = false;

// --- SOPORTE PARA MOUSE ---
canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
});

canvas.addEventListener('mousemove', (e) => {
    if (isDrawing) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
    }
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
});

canvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

function getCanvasPos(touch, canvas) {
    const rect = canvas.getBoundingClientRect();
    // Ajusta las coordenadas al tamaño real del canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
    };
}

// --- SOPORTE PARA TÁCTIL/LÁPIZ ---
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return; // Ignora multitouch
    e.preventDefault();
    isDrawing = true;
    const touch = e.touches[0];
    const pos = getCanvasPos(touch, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) return;
    e.preventDefault();
    if (isDrawing) {
        const touch = e.touches[0];
        const pos = getCanvasPos(touch, canvas);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    isDrawing = false;
});

// Función para limpiar el canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
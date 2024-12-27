function back() {
    // Pedir confirmación antes de volver a la página anterior
    if (confirm("¿Estás seguro de que quieres volver?")) {
        location.href = "index.html";
    }
}

function search() {
    // Mostrar o ocultar el input de búsqueda
    var input = document.getElementById("search");
    if (input.style.display === "none") {
        input.style.display = "block";
    } else {
        input.style.display = "none";
    }
}
const images = document.querySelectorAll(".carousel img");
let current = 0;

setInterval(() => {
    images[current].classList.remove("active");
    current = (current + 1) % images.length;
    images[current].classList.add("active");
}, 4000); // Cambia cada 4 segundos

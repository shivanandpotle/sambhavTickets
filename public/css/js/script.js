document.addEventListener('DOMContentLoaded', () => {
    // --- Social Links ---
    const socialLinks = {
        "fb": "https://www.facebook.com/share/15WAJa6U1S/",
        "insta": "https://www.instagram.com/sambhav.official?igsh=dndubW1icGsyZmR0",
        "twit": "https://x.com/Sambhav_Youth?t=IsaiQ-rJpC_vX_oioVWS2Q&s=09"
    };

    for (const [id, url] of Object.entries(socialLinks)) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener("click", () => window.open(url, "_blank"));
        }
    }

    // --- Smooth Scrolling for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
/* =========================================
   GI28 PANEL - GLOBAL JAVASCRIPT (app.js)
   ========================================= */

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Calculate Base Path (Root vs Subfolder)
    const isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') && !window.location.pathname.includes('/');
    const basePath = isRoot ? './' : '../';

    // 2. Load Components Dynamically
    await loadComponents(basePath);

    // 3. Initialize Theme
    initTheme();

    // 4. Smoothly Remove Loader
    setTimeout(() => {
        const loader = document.getElementById("global-loader");
        if (loader) {
            loader.style.opacity = "0";
            setTimeout(() => loader.remove(), 400);
        }
    }, 600); // Premium delay feel
});

// --- COMPONENT LOADER LOGIC ---
async function loadComponents(basePath) {
    const components = [
    { id: 'loader-placeholder', url: basePath + 'components/loader.html' },
    { id: 'navbar-placeholder', url: basePath + 'components/navbar.html' },
    { id: 'sidebar-placeholder', url: basePath + 'components/sidebar.html' },
    { id: 'footer-placeholder', url: basePath + 'components/footer.html' } 
    ];
    for (let comp of components) {
        const placeholder = document.getElementById(comp.id);
        if (placeholder) {
            try {
                const response = await fetch(comp.url);
                if (response.ok) {
                    let html = await response.text();
                    // Auto-correct links based on current folder depth
                    html = html.replace(/\{\{BASE\}\}/g, basePath);
                    placeholder.innerHTML = html;
                }
            } catch (error) {
                console.error(`Failed to load ${comp.url}`);
            }
        }
    }
}

// --- SIDEBAR LOGIC ---
function toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');

    // 👇 BODY SCROLL LOCK
    if (sidebar.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none'; // mobile fix
    } else {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    }
}

// --- THEME LOGIC (Strict B&W) ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function toggleTheme() {
    const htmlTag = document.documentElement;
    const currentTheme = htmlTag.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    htmlTag.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);

    // If a chart exists on the page, update its colors
    if (typeof window.updateChartTheme === 'function') {
        window.updateChartTheme(newTheme);
    }
}

function updateThemeIcons(theme) {
    const sunIcon = document.getElementById('theme-sun');
    const moonIcon = document.getElementById('theme-moon');
    
    if (sunIcon && moonIcon) {
        if (theme === 'light') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
}

// --- LOGOUT LOGIC ---
function logoutUser() {
    localStorage.removeItem("guestMode");
    // Path correction for logout
    const isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('index.html') && !window.location.pathname.includes('/');
    window.location.href = isRoot ? "index.html" : "../index.html";
}


const clickSound = new Audio('/assets/sounds/mixkit-fast-double-click-on-mouse-275.wav');
clickSound.volume = 1;
clickSound.load();

// Mobile + Desktop fix
let lastTouch = 0;

function playSound() {
    try {
        clickSound.currentTime = 0;
        clickSound.play();
    } catch(e) {}
}

// Mobile touch
document.addEventListener('touchstart', () => {
    lastTouch = Date.now();
    playSound();
}, { passive: true });

// Desktop click
document.addEventListener('click', () => {
    if (Date.now() - lastTouch < 300) return;
    playSound();
});

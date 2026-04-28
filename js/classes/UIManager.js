export class UIManager {
    constructor() {
        this.themeBtn = document.getElementById('theme-btn');
        this.iconMoon = document.getElementById('icon-moon');
        this.iconSun = document.getElementById('icon-sun');
        this.ambientBg = document.querySelector('.ambient-bg');
        this.toastContainer = document.getElementById('toast-container');
        this.orderModal = document.getElementById('order-modal');

        this.init();
    }

    init() {
        if (this.themeBtn) {
            this.themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // We bind the navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetTabId = e.currentTarget.dataset.target;
                if (targetTabId) this.switchTab(targetTabId, e.currentTarget);
            });
        });

        // Hide splash screen
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if (splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 600);
            }
        }, 600);
    }

    vibrate() {
        try {
            if (navigator && navigator.vibrate) navigator.vibrate(50);
        } catch (e) { }
    }

    showToast(msg) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = msg;
        this.toastContainer.appendChild(t);
        setTimeout(() => {
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 400);
        }, 3000);
    }

    toggleTheme() {
        this.vibrate();
        const body = document.body;
        const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);

        if (this.iconMoon) this.iconMoon.style.display = newTheme === 'dark' ? 'block' : 'none';
        if (this.iconSun) this.iconSun.style.display = newTheme === 'light' ? 'block' : 'none';
        if (this.ambientBg) this.ambientBg.style.display = newTheme === 'dark' ? 'block' : 'none';
    }

    switchTab(tabId, el = null) {
        this.vibrate();
        document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');

        if (el) {
            el.classList.add('active');
        } else {
            const navItems = document.querySelectorAll('.nav-item');
            if (tabId === 'tab-home' && navItems[0]) navItems[0].classList.add('active');
            if (tabId === 'tab-store' && navItems[1]) navItems[1].classList.add('active');
            if (tabId === 'tab-profile' && navItems[2]) navItems[2].classList.add('active');
        }
        window.scrollTo(0, 0);
    }

    openModal() {
        if (this.orderModal) {
            this.orderModal.style.display = 'flex';
            setTimeout(() => this.orderModal.classList.add('show'), 10);
        }
    }

    closeModal() {
        this.vibrate();
        if (this.orderModal) {
            this.orderModal.classList.remove('show');
            setTimeout(() => this.orderModal.style.display = 'none', 400);
        }
    }

    triggerConfetti() {
        if (typeof confetti !== 'undefined') {
            confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#ff0055', '#00e5ff', '#ffffff'] });
        }
    }
}

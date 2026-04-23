export class PWAController {
    constructor() {
        this.pwaPrompt = document.getElementById('pwa-prompt');
        this.btnClosePwa = document.getElementById('pwa-close');
        this.iosGuide = document.getElementById('pwa-ios-guide');
        this.installBtn = document.getElementById('pwa-install-btn');
        this.deferredPrompt = null;
        
        this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        this.pwaDismissed = localStorage.getItem('pwa_dismissed') === 'true';
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        this.init();
    }

    init() {
        if (this.btnClosePwa) {
            this.btnClosePwa.addEventListener('click', () => {
                if (this.pwaPrompt) {
                    this.pwaPrompt.classList.remove('show');
                    setTimeout(() => this.pwaPrompt.style.display = 'none', 400);
                }
                localStorage.setItem('pwa_dismissed', 'true');
            });
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            if (this.installBtn) {
                this.installBtn.style.display = 'flex';
            }
        });

        if (this.installBtn) {
            this.installBtn.addEventListener('click', async () => {
                if (this.deferredPrompt) {
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        console.log('Пользователь установил PWA');
                    }
                    this.deferredPrompt = null;
                    if (this.pwaPrompt) {
                        this.pwaPrompt.classList.remove('show');
                        setTimeout(() => this.pwaPrompt.style.display = 'none', 400);
                    }
                }
            });
        }

        // Show prompt after 3s
        setTimeout(() => this.showPwaPrompt(), 3000);
    }

    showPwaPrompt() {
        if (this.isStandalone || this.pwaDismissed) return;
        
        if (this.pwaPrompt) {
            this.pwaPrompt.style.display = 'flex';
            setTimeout(() => this.pwaPrompt.classList.add('show'), 10);
        }

        if (this.isIOS && this.iosGuide) {
            this.iosGuide.style.display = 'block';
        }
    }
}

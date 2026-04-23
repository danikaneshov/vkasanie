import { UIManager } from './classes/UIManager.js';
import { AuthManager } from './classes/AuthManager.js';
import { OrderManager } from './classes/OrderManager.js';
import { ProfileManager } from './classes/ProfileManager.js';
import { PWAController } from './classes/PWAController.js';

class App {
    constructor() {
        this.ui = new UIManager(this);
        this.auth = new AuthManager(this);
        this.profile = new ProfileManager(this);
        this.order = new OrderManager(this);
        this.pwa = new PWAController(this);

        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            // Check if user is logged in
            if (this.auth.currentUserPhone) {
                this.profile.updateUI();
            }

            // Open Order Modal buttons from Store Tab
            document.querySelectorAll('.btn-order').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tariff = e.currentTarget.dataset.tariff;
                    const price = parseInt(e.currentTarget.dataset.price);
                    if (tariff && price) {
                        this.order.openOrderModal(tariff, price);
                    }
                });
            });

            // "ОТКРЫТЬ АРСЕНАЛ" button on home
            const btnToStore = document.getElementById('btn-to-store');
            if (btnToStore) {
                btnToStore.addEventListener('click', () => this.ui.switchTab('tab-store'));
            }
        });
    }
}

// Instantiate the application
window.app = new App();

import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-config.js";

export class AuthManager {
    constructor(app) {
        this.app = app; // Reference to the main App
        this.currentUserPhone = localStorage.getItem('damdym_phone') || null;
        this.currentUserData = null;

        this.init();
    }

    init() {
        const loginBtn = document.getElementById('btn-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.login());
        }

        const toggleRegBtn = document.getElementById('toggle-reg-text');
        if (toggleRegBtn) {
            toggleRegBtn.addEventListener('click', () => this.toggleRegField());
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        const phoneInput = document.getElementById('login-phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => this.formatPhoneInput(e));
        }
    }

    formatPhoneInput(e) {
        let el = e.target;
        let val = el.value.replace(/\D/g, '');
        
        if (!val) {
            el.value = '';
            return;
        }

        // Always start with 7 for Kazakhstan
        if (val[0] === '8') val = '7' + val.slice(1);
        if (val[0] !== '7') val = '7' + val;

        let formatted = '+7';
        if (val.length > 1) formatted += ' (' + val.substring(1, 4);
        if (val.length >= 5) formatted += ') ' + val.substring(4, 7);
        if (val.length >= 8) formatted += '-' + val.substring(7, 9);
        if (val.length >= 10) formatted += '-' + val.substring(9, 11);
        
        el.value = formatted;
    }

    toggleRegField() {
        this.app.ui.vibrate();
        const f = document.getElementById('reg-name');
        const btnText = document.getElementById('toggle-reg-text');
        const ageContainer = document.getElementById('age-check-container');
        
        if (f.style.display === 'none' || !f.style.display) {
            f.style.display = 'block';
            if (ageContainer) ageContainer.style.display = 'block';
            btnText.innerText = 'Уже есть аккаунт? Войти';
        } else {
            f.style.display = 'none';
            if (ageContainer) ageContainer.style.display = 'none';
            btnText.innerText = 'Создать аккаунт';
        }
    }

    async login() {
        this.app.ui.vibrate();
        const nameInput = document.getElementById('reg-name');
        const phoneInput = document.getElementById('login-phone');
        const passInput = document.getElementById('login-pass');
        const ageCheck = document.getElementById('age-check');

        const name = nameInput.value.trim();
        const phone = phoneInput.value.replace(/\D/g, ''); // Strip non-digits for database
        const pass = passInput.value.trim();
        const isRegMode = nameInput.style.display !== 'none' && nameInput.style.display !== '';

        if (phone.length < 11 || pass.length < 4) {
            return this.app.ui.showToast("⚠️ Введи полный номер и пароль (от 4 символов)");
        }
        
        try {
            const docSnap = await getDoc(doc(db, "users", phone));
            
            if (!docSnap.exists()) {
                if (!isRegMode) return this.app.ui.showToast("❌ Аккаунт не найден. Нажми 'Создать аккаунт'");
                if (!name) return this.app.ui.showToast("⚠️ Укажи имя для регистрации!");
                
                if (isRegMode && ageCheck && !ageCheck.checked) {
                    return this.app.ui.showToast("⚠️ Подтверди, что тебе есть 21 год!");
                }
                
                await setDoc(doc(db, "users", phone), { name: name, password: pass, totalSpent: 0, usedPromos: {} });
                this.app.ui.showToast("🎉 Аккаунт создан!");
            } else {
                if (isRegMode) return this.app.ui.showToast("⚠️ Номер уже зарегистрирован. Войди в аккаунт!");
                if (docSnap.data().password !== pass) return this.app.ui.showToast("❌ Неверный пароль");
            }
            
            this.currentUserPhone = phone; 
            localStorage.setItem('damdym_phone', phone);
            
            await this.app.profile.updateUI(); 
            this.app.ui.switchTab('tab-store'); 
            this.app.ui.showToast("🔥 Успешный вход!");
        } catch (e) { 
            console.error(e);
            this.app.ui.showToast("Ошибка сети"); 
        }
    }

    logout() {
        this.app.ui.vibrate();
        this.currentUserPhone = null; 
        this.currentUserData = null; 
        this.app.profile.userCurrentDiscount = 0;
        
        if (this.app.profile.activeOrderUnsubscribe) { 
            this.app.profile.activeOrderUnsubscribe(); 
            this.app.profile.activeOrderUnsubscribe = null; 
        } 
        
        localStorage.removeItem('damdym_phone');
        this.app.profile.updateUI(); 
        this.app.ui.switchTab('tab-profile'); 
        this.app.ui.showToast("Вы вышли");
    }

    isLoggedIn() {
        return !!this.currentUserPhone;
    }
}

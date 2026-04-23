import { doc, getDoc, collection, addDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-config.js";

export class OrderManager {
    constructor(app) {
        this.app = app;
        
        this.currentOrderTariff = "";
        this.currentOrderBasePrice = 0;
        this.currentOrderFinalPrice = 0;
        this.bowlsData = [];
        this.activeBowlIndex = 0;
        this.appliedPromoObj = null;

        this.strengthLabels = { 
            0:"ВООБЩЕ ЛЕГКО (0)", 1:"ЛЕГКО (1)", 2:"ЛЕГКО (2)", 3:"НИЖЕ СРЕДНЕГО", 4:"КОМФОРТ (4)", 
            5:"КЛАССИКА (5)", 6:"КЛАССИКА (6)", 7:"ПЛОТНО (7)", 8:"КРЕПКО (8)", 9:"ОЧЕНЬ КРЕПКО", 10:"HARDCORE" 
        };

        this.init();
    }

    init() {
        // Flavor tags
        document.querySelectorAll('.flavor-tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const f = e.currentTarget.dataset.flavor;
                if (f) this.addFlavor(f);
            });
        });

        // Sliders
        const slider = document.getElementById('strength-slider');
        if (slider) {
            slider.addEventListener('input', (e) => {
                const val = e.target.value;
                document.getElementById('strength-display').innerText = this.strengthLabels[val];
                this.updateSliderColor(val);
                if (this.bowlsData[this.activeBowlIndex]) {
                    this.bowlsData[this.activeBowlIndex].strength = val;
                }
            });
        }

        const flavorInput = document.getElementById('flavor-input');
        if (flavorInput) {
            flavorInput.addEventListener('input', (e) => {
                if (this.bowlsData[this.activeBowlIndex]) {
                    this.bowlsData[this.activeBowlIndex].flavor = e.target.value;
                }
            });
        }

        // Ice buttons
        const iceYes = document.getElementById('ice-yes');
        const iceNo = document.getElementById('ice-no');
        if (iceYes) iceYes.addEventListener('click', () => this.setIce(true));
        if (iceNo) iceNo.addEventListener('click', () => this.setIce(false));

        // Promo
        const applyPromoBtn = document.getElementById('btn-apply-promo');
        if (applyPromoBtn) {
            applyPromoBtn.addEventListener('click', () => this.applyPromo());
        }

        // Bowls
        const addBowlBtn = document.getElementById('btn-add-bowl');
        if (addBowlBtn) addBowlBtn.addEventListener('click', () => this.addExtraBowl());

        const removeBowlBtn = document.getElementById('btn-remove-bowl');
        if (removeBowlBtn) removeBowlBtn.addEventListener('click', () => this.removeExtraBowl());

        // Modal Action buttons
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.addEventListener('click', () => this.submitOrder());

        const closeModalBtn = document.getElementById('btn-close-modal');
        if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.app.ui.closeModal());
    }

    openOrderModal(tariff, basePrice) {
        this.app.ui.vibrate();
        if (!this.app.auth.isLoggedIn()) {
            this.app.ui.switchTab('tab-profile');
            this.app.ui.showToast("⚠️ Для заказа нужно войти!");
            return;
        }

        this.currentOrderTariff = tariff;
        this.currentOrderBasePrice = basePrice;
        this.appliedPromoObj = null;

        const promoInput = document.getElementById('promo-input');
        if (promoInput) promoInput.value = "";
        
        const promoBadge = document.getElementById('promo-badge');
        if (promoBadge) promoBadge.style.display = 'none';

        let numBowls = tariff === 'DOUBLE' ? 2 : (tariff === 'TEAM' ? 4 : 1);
        this.bowlsData = Array.from({length: numBowls}, () => ({ strength: 5, flavor: '', ice: true }));

        const modalTariffName = document.getElementById('modal-tariff-name');
        if (modalTariffName) modalTariffName.innerText = tariff;
        
        const commentInput = document.getElementById('comment-input');
        if (commentInput) commentInput.value = "";

        this.recalcPrice();
        this.selectBowl(0);
        this.app.ui.openModal();
    }

    addFlavor(f) {
        this.app.ui.vibrate();
        const inp = document.getElementById('flavor-input');
        if (inp) {
            inp.value = inp.value ? inp.value + ', ' + f : f;
            this.saveCurrentBowl();
        }
    }

    saveCurrentBowl() {
        if (this.bowlsData.length > 0) {
            const slider = document.getElementById('strength-slider');
            const flavorInp = document.getElementById('flavor-input');
            if (slider && flavorInp) {
                this.bowlsData[this.activeBowlIndex].strength = slider.value;
                this.bowlsData[this.activeBowlIndex].flavor = flavorInp.value;
            }
        }
    }

    updateSliderColor(val) {
        const slider = document.getElementById('strength-slider');
        if (!slider) return;
        const percent = (val / 10) * 100;
        slider.style.background = `linear-gradient(90deg, #00e5ff ${percent}%, var(--border-color) ${percent}%)`;
        if (val > 7) slider.style.background = `linear-gradient(90deg, #ff0055 ${percent}%, var(--border-color) ${percent}%)`;
        else if (val > 4) slider.style.background = `linear-gradient(90deg, #ffd700 ${percent}%, var(--border-color) ${percent}%)`;
    }

    setIce(val) {
        this.app.ui.vibrate();
        this.bowlsData[this.activeBowlIndex].ice = val;
        const iceYes = document.getElementById('ice-yes');
        const iceNo = document.getElementById('ice-no');
        if (iceYes) iceYes.classList.toggle('active', val);
        if (iceNo) iceNo.classList.toggle('active', !val);
    }

    selectBowl(index, skipSave = false) {
        this.app.ui.vibrate();
        if (!skipSave) this.saveCurrentBowl();
        
        this.activeBowlIndex = index;
        this.renderBowlTabs();

        const lblStrength = document.getElementById('lbl-strength');
        if (lblStrength) lblStrength.innerText = `КРЕПОСТЬ (ЧАША ${index + 1})`;

        const b = this.bowlsData[index];
        const slider = document.getElementById('strength-slider');
        const flavorInp = document.getElementById('flavor-input');
        const iceYes = document.getElementById('ice-yes');
        const iceNo = document.getElementById('ice-no');
        const strengthDisp = document.getElementById('strength-display');

        if (slider) {
            slider.value = b.strength;
            this.updateSliderColor(b.strength);
        }
        if (strengthDisp) strengthDisp.innerText = this.strengthLabels[b.strength];
        if (flavorInp) flavorInp.value = b.flavor;
        if (iceYes) iceYes.classList.toggle('active', b.ice);
        if (iceNo) iceNo.classList.toggle('active', !b.ice);
    }

    renderBowlTabs() {
        const container = document.getElementById('bowl-tabs-container');
        const removeBtn = document.getElementById('btn-remove-bowl');
        if (!container) return;

        let defaultBowls = this.currentOrderTariff === 'DOUBLE' ? 2 : (this.currentOrderTariff === 'TEAM' ? 4 : 1);

        if (this.bowlsData.length > 1) {
            container.style.display = 'flex';
            container.innerHTML = this.bowlsData.map((_, i) => 
                `<div class="bowl-tab ${i === this.activeBowlIndex ? 'active' : ''}" data-index="${i}">Чаша ${i + 1}</div>`
            ).join('');

            // Bind events for dynamically created tabs
            container.querySelectorAll('.bowl-tab').forEach(tab => {
                tab.addEventListener('click', (e) => {
                    const idx = parseInt(e.currentTarget.dataset.index);
                    this.selectBowl(idx);
                });
            });
        } else {
            container.style.display = 'none';
            const lblStrength = document.getElementById('lbl-strength');
            if (lblStrength) lblStrength.innerText = `КРЕПОСТЬ`;
        }

        if (removeBtn) {
            removeBtn.style.display = this.bowlsData.length > defaultBowls ? 'block' : 'none';
        }
    }

    recalcPrice() {
        let defaultBowls = this.currentOrderTariff === 'DOUBLE' ? 2 : (this.currentOrderTariff === 'TEAM' ? 4 : 1);
        let extraBowlsCount = Math.max(0, this.bowlsData.length - defaultBowls);
        
        let subtotal = this.currentOrderBasePrice + (extraBowlsCount * 2000);
        
        let bestDiscount = this.app.profile.userCurrentDiscount || 0;
        const promoBadge = document.getElementById('promo-badge');

        if (this.appliedPromoObj && this.appliedPromoObj.discount > bestDiscount) {
            bestDiscount = this.appliedPromoObj.discount;
            if (promoBadge) promoBadge.style.display = 'inline-block';
        } else {
            if (promoBadge) promoBadge.style.display = 'none';
        }

        this.currentOrderFinalPrice = Math.floor(subtotal - (subtotal * (bestDiscount / 100)));
        const finalPriceEl = document.getElementById('modal-final-price');
        if (finalPriceEl) finalPriceEl.innerText = this.currentOrderFinalPrice.toLocaleString() + ' ₸';
    }

    addExtraBowl() {
        this.app.ui.vibrate();
        this.saveCurrentBowl();
        this.bowlsData.push({ strength: 5, flavor: '', ice: true });
        this.recalcPrice();
        this.selectBowl(this.bowlsData.length - 1);
    }

    removeExtraBowl() {
        this.app.ui.vibrate();
        let defaultBowls = this.currentOrderTariff === 'DOUBLE' ? 2 : (this.currentOrderTariff === 'TEAM' ? 4 : 1);
        if (this.bowlsData.length <= defaultBowls) return;
        
        this.bowlsData.splice(this.activeBowlIndex, 1);
        this.recalcPrice();

        let nextIndex = this.activeBowlIndex >= this.bowlsData.length ? this.bowlsData.length - 1 : this.activeBowlIndex;
        this.selectBowl(nextIndex, true);
    }

    async applyPromo() {
        this.app.ui.vibrate();
        const promoInput = document.getElementById('promo-input');
        if (!promoInput) return;

        const codeInput = promoInput.value.trim().toUpperCase();
        if (!codeInput) return;

        try {
            const promoSnap = await getDoc(doc(db, "promocodes", codeInput));
            
            if (!promoSnap.exists()) return this.app.ui.showToast("❌ Промокод не найден");
            const p = promoSnap.data();
            
            if (p.isActive === false) return this.app.ui.showToast("❌ Промокод неактивен");
            if (p.globalLimit > 0 && (p.globalUsed || 0) >= p.globalLimit) return this.app.ui.showToast("❌ Лимит исчерпан");
            
            const currentUserData = this.app.auth.currentUserData;
            const userUsedMap = currentUserData?.usedPromos || {};
            const userUses = userUsedMap[codeInput] || 0;
            
            if (p.perUserLimit > 0 && userUses >= p.perUserLimit) return this.app.ui.showToast("❌ Ты уже использовал этот код");

            this.appliedPromoObj = { code: codeInput, discount: p.discount };
            this.app.ui.showToast(`✅ Код применен! Скидка: ${p.discount}%`);
            this.recalcPrice();

        } catch (e) { 
            console.error(e);
            this.app.ui.showToast("Ошибка проверки"); 
        }
    }

    async submitOrder() {
        this.app.ui.vibrate();
        this.saveCurrentBowl();
        
        const commentInput = document.getElementById('comment-input');
        const comment = commentInput ? commentInput.value.trim() : "";
        
        if (!comment) return this.app.ui.showToast("⚠️ Укажи адрес доставки!");
        
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.innerText = "СЕКУНДУ...";
            submitBtn.disabled = true;
        }

        let bowlsArrayForDb = this.bowlsData.map(b => ({ 
            strength: this.strengthLabels[b.strength], 
            flavor: b.flavor || "На усмотрение", 
            ice: b.ice 
        }));

        try {
            const currentUserData = this.app.auth.currentUserData;
            const currentUserPhone = this.app.auth.currentUserPhone;

            let orderData = { 
                phone: currentUserPhone, 
                name: currentUserData?.name || "Бро", 
                tariff: this.currentOrderTariff, 
                price: this.currentOrderFinalPrice, 
                comment: comment, 
                bowls: bowlsArrayForDb, 
                status: "new", 
                createdAt: Date.now() 
            };

            if (this.appliedPromoObj) orderData.promoCode = this.appliedPromoObj.code;

            // 1. Save to Firebase
            await addDoc(collection(db, "orders"), orderData);

            if (this.appliedPromoObj) {
                await updateDoc(doc(db, "promocodes", this.appliedPromoObj.code), { globalUsed: increment(1) });
                const userUsedMap = currentUserData?.usedPromos || {};
                userUsedMap[this.appliedPromoObj.code] = (userUsedMap[this.appliedPromoObj.code] || 0) + 1;
                await updateDoc(doc(db, "users", currentUserPhone), { usedPromos: userUsedMap });
            }
            
            // 2. Telegram Notification
            const tgToken = "8616525461:AAGTwex70ZkIQMwbBikG9msSG6dY0ErEDKg";
            const tgChatId = "7711813441";
            
            let bowlsText = bowlsArrayForDb.map((b, i) => `💨 Чаша ${i+1}: ${b.flavor} (${b.strength}) ${b.ice ? '🧊' : '🔥'}`).join('\n');
            let promoText = this.appliedPromoObj ? `\n🎟 Промокод: ${this.appliedPromoObj.code}` : "";

            let textMessage = `🔥 <b>НОВЫЙ ЗАКАЗ vKasanie!</b> 🔥\n\n` +
                              `👤 <b>Клиент:</b> ${orderData.name} (${orderData.phone})\n` +
                              `📦 <b>Тариф:</b> ${orderData.tariff}\n` +
                              `💰 <b>Сумма:</b> ${orderData.price} ₸${promoText}\n\n` +
                              `📍 <b>Адрес:</b> ${orderData.comment}\n\n` +
                              `<b>Забивки:</b>\n${bowlsText}`;

            fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: tgChatId,
                    text: textMessage,
                    parse_mode: 'HTML'
                })
            }).catch(e => console.error("Ошибка отправки в ТГ:", e));

            this.app.ui.triggerConfetti();
            this.app.ui.showToast("🎉 ЗАКАЗ УЛЕТЕЛ!");
            this.app.ui.closeModal();
            this.app.ui.switchTab('tab-home');

        } catch(e) { 
            console.error(e);
            this.app.ui.showToast("Ошибка сети"); 
        } finally { 
            if (submitBtn) {
                submitBtn.innerText = "ОФОРМИТЬ";
                submitBtn.disabled = false;
            }
        }
    }

    async cancelOrder(orderId) {
        if (confirm("Точно отменить заказ?")) {
            try {
                await updateDoc(doc(db, "orders", orderId), { status: "canceled_client" });
                this.app.ui.showToast("Заказ отменен");
            } catch (e) {
                console.error(e);
                this.app.ui.showToast("Ошибка отмены");
            }
        }
    }
}

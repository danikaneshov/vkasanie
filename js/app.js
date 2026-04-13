import { db } from './firebase-config.js';
import { doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, where, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- УТИЛИТЫ ---
const vibrate = () => { try { if (navigator && navigator.vibrate) navigator.vibrate(50); } catch(e){} };

window.showToast = function(msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
};

window.toggleTheme = function() {
    vibrate();
    const body = document.body;
    const newTheme = body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    document.getElementById('icon-moon').style.display = newTheme === 'dark' ? 'block' : 'none';
    document.getElementById('icon-sun').style.display = newTheme === 'light' ? 'block' : 'none';
    document.querySelector('.ambient-bg').style.display = newTheme === 'dark' ? 'block' : 'none';
};

window.switchTab = function(tabId, el = null) {
    vibrate();
    document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.add('active');
    
    if (el) {
        el.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        if(tabId === 'tab-home' && navItems[0]) navItems[0].classList.add('active');
        if(tabId === 'tab-store' && navItems[1]) navItems[1].classList.add('active');
        if(tabId === 'tab-profile' && navItems[2]) navItems[2].classList.add('active');
    }
    window.scrollTo(0,0);
};

window.toggleRegField = function() {
    const f = document.getElementById('reg-name');
    const btnText = document.getElementById('toggle-reg-text');
    if (f.style.display === 'none') {
        f.style.display = 'block';
        btnText.innerText = 'Уже есть аккаунт? Войти';
    } else {
        f.style.display = 'none';
        btnText.innerText = 'Создать аккаунт';
    }
};

// --- СОСТОЯНИЕ И ДАННЫЕ ЮЗЕРА ---
let currentUserPhone = localStorage.getItem('damdym_phone') || null;
let currentUserData = null; 
let userCurrentDiscount = 0;
let activeOrderUnsubscribe = null; 
const discountTiers = [{ limit: 1000000, percent: 20 }, { limit: 600000, percent: 15 }, { limit: 400000, percent: 10 }, { limit: 250000, percent: 7 }, { limit: 150000, percent: 5 }, { limit: 75000, percent: 3 }, { limit: 0, percent: 0 }];

window.login = async function() {
    vibrate();
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const isRegMode = document.getElementById('reg-name').style.display !== 'none';

    if(phone.length < 10 || pass.length < 4) return showToast("⚠️ Введи номер (от 10 цифр) и пароль (от 4 символов)");
    
    try {
        const docSnap = await getDoc(doc(db, "users", phone));
        
        if (!docSnap.exists()) {
            if (!isRegMode) return showToast("❌ Аккаунт не найден. Нажми 'Создать аккаунт'");
            if (!name) return showToast("⚠️ Укажи имя для регистрации!");
            
            await setDoc(doc(db, "users", phone), { name: name, password: pass, totalSpent: 0, usedPromos: {} });
            showToast("🎉 Аккаунт создан!");
        } else {
            if (isRegMode) return showToast("⚠️ Номер уже зарегистрирован. Войди в аккаунт!");
            if(docSnap.data().password !== pass) return showToast("❌ Неверный пароль");
        }
        
        currentUserPhone = phone; localStorage.setItem('damdym_phone', phone);
        updateUI(); switchTab('tab-store'); showToast("🔥 Успешный вход!");
    } catch (e) { showToast("Ошибка сети"); }
};

window.logout = function() {
    currentUserPhone = null; currentUserData = null; userCurrentDiscount = 0;
    if(activeOrderUnsubscribe) { activeOrderUnsubscribe(); activeOrderUnsubscribe = null; } 
    localStorage.removeItem('damdym_phone');
    updateUI(); switchTab('tab-profile'); showToast("Вы вышли");
};

async function updateUI() {
    if(currentUserPhone) {
        const snap = await getDoc(doc(db, "users", currentUserPhone));
        if(snap.exists()) currentUserData = snap.data();
        
        document.getElementById('view-login').style.display = 'none';
        document.getElementById('view-profile').style.display = 'block';
        document.getElementById('profile-name').innerText = currentUserData?.name || 'Бро';
        document.getElementById('profile-phone').innerText = currentUserPhone;
        
        const spent = currentUserData?.totalSpent || 0;
        document.getElementById('profile-spent').innerText = spent.toLocaleString() + ' ₸';
        
        // Исправленная проверка скидки
        let hasCustomDiscount = currentUserData?.customDiscount !== undefined && currentUserData?.customDiscount !== null && currentUserData?.customDiscount !== "";
        
        if (hasCustomDiscount) {
            userCurrentDiscount = currentUserData.customDiscount;
        } else {
            userCurrentDiscount = discountTiers.find(t => spent >= t.limit).percent;
        }
        
        document.getElementById('profile-discount-text').innerText = userCurrentDiscount + '% СКИДКА';

        let nextTier = [...discountTiers].reverse().find(t => t.limit > spent);
        
        if (nextTier && !hasCustomDiscount) {
            let prevLimit = discountTiers.find(t => spent >= t.limit).limit;
            let progress = ((spent - prevLimit) / (nextTier.limit - prevLimit)) * 100;
            document.getElementById('loyalty-bar').style.width = `${progress}%`;
            document.getElementById('loyalty-next').innerText = `До скидки ${nextTier.percent}% осталось ${ (nextTier.limit - spent).toLocaleString() } ₸`;
        } else {
            document.getElementById('loyalty-bar').style.width = `100%`;
            document.getElementById('loyalty-next').innerText = hasCustomDiscount ? 'Персональная скидка VIP' : `Максимальный уровень!`;
        }

        // Обновляем каталог
        ['solo', 'double', 'team'].forEach(item => { 
            const priceEl = document.getElementById(`price-${item}`);
            const badge = document.getElementById(`badge-${item}`);
            const oldPrice = document.getElementById(`old-price-${item}`);
            if(priceEl) {
                const basePrice = parseInt(priceEl.getAttribute('data-base'));
                const finalPrice = Math.floor(basePrice - (basePrice * (userCurrentDiscount / 100)));
                priceEl.innerText = finalPrice.toLocaleString() + ' ₸';
                if(userCurrentDiscount > 0) { 
                    oldPrice.style.display = 'block'; 
                    badge.style.display = 'inline-block'; 
                    badge.innerText = `СКИДКА ${userCurrentDiscount}%`; 
                } else { 
                    oldPrice.style.display = 'none'; 
                    badge.style.display = 'none'; 
                }
            }
        });
        listenOrders();
    } else {
        document.getElementById('view-login').style.display = 'block';
        document.getElementById('view-profile').style.display = 'none';
        document.getElementById('home-empty').style.display = 'block';
        document.getElementById('home-trackers-container').style.display = 'none';
        ['solo', 'double', 'team'].forEach(item => { 
            const priceEl = document.getElementById(`price-${item}`);
            if(priceEl) {
                priceEl.innerText = parseInt(priceEl.getAttribute('data-base')).toLocaleString() + ' ₸';
                document.getElementById(`old-price-${item}`)?.style.setProperty('display', 'none');
                document.getElementById(`badge-${item}`)?.style.setProperty('display', 'none');
            }
        });
    }
}

// --- ЛОГИКА ЗАКАЗА И ЧАШ ---
let currentOrderTariff = "", currentOrderBasePrice = 0, currentOrderFinalPrice = 0;
let bowlsData = []; let activeBowlIndex = 0;
let appliedPromoObj = null; 

const strengthLabels = { 0:"ВООБЩЕ ЛЕГКО (0)", 1:"ЛЕГКО (1)", 2:"ЛЕГКО (2)", 3:"НИЖЕ СРЕДНЕГО", 4:"КОМФОРТ (4)", 5:"КЛАССИКА (5)", 6:"КЛАССИКА (6)", 7:"ПЛОТНО (7)", 8:"КРЕПКО (8)", 9:"ОЧЕНЬ КРЕПКО", 10:"HARDCORE" };

window.addFlavor = function(f) { vibrate(); const inp = document.getElementById('flavor-input'); inp.value = inp.value ? inp.value + ', ' + f : f; saveCurrentBowl(); };

function saveCurrentBowl() {
    if(bowlsData.length > 0 && document.getElementById('strength-slider')) {
        bowlsData[activeBowlIndex].strength = document.getElementById('strength-slider').value;
        bowlsData[activeBowlIndex].flavor = document.getElementById('flavor-input').value;
    }
}

function updateSliderColor(val) {
    const slider = document.getElementById('strength-slider');
    const percent = (val / 10) * 100;
    slider.style.background = `linear-gradient(90deg, #00e5ff ${percent}%, var(--border-color) ${percent}%)`;
    if(val > 7) slider.style.background = `linear-gradient(90deg, #ff0055 ${percent}%, var(--border-color) ${percent}%)`;
    else if(val > 4) slider.style.background = `linear-gradient(90deg, #ffd700 ${percent}%, var(--border-color) ${percent}%)`;
}

document.getElementById('strength-slider').addEventListener('input', e => { 
    document.getElementById('strength-display').innerText = strengthLabels[e.target.value]; 
    updateSliderColor(e.target.value); bowlsData[activeBowlIndex].strength = e.target.value; 
});
document.getElementById('flavor-input').addEventListener('input', e => { bowlsData[activeBowlIndex].flavor = e.target.value; });

window.setIce = function(val) { vibrate(); bowlsData[activeBowlIndex].ice = val; document.getElementById('ice-yes').classList.toggle('active', val); document.getElementById('ice-no').classList.toggle('active', !val); };

window.selectBowl = function(index, skipSave = false) {
    vibrate(); 
    if (!skipSave) saveCurrentBowl(); 
    
    activeBowlIndex = index; renderBowlTabs();
    
    document.getElementById('lbl-strength').innerText = `КРЕПОСТЬ (ЧАША ${index+1})`;
    const b = bowlsData[index];
    document.getElementById('strength-slider').value = b.strength; updateSliderColor(b.strength); document.getElementById('strength-display').innerText = strengthLabels[b.strength];
    document.getElementById('flavor-input').value = b.flavor;
    document.getElementById('ice-yes').classList.toggle('active', b.ice); document.getElementById('ice-no').classList.toggle('active', !b.ice); 
};

function renderBowlTabs() {
    const container = document.getElementById('bowl-tabs-container');
    const removeBtn = document.getElementById('btn-remove-bowl');
    let defaultBowls = currentOrderTariff === 'DOUBLE' ? 2 : (currentOrderTariff === 'TEAM' ? 4 : 1);

    if(bowlsData.length > 1) { 
        container.style.display = 'flex'; 
        container.innerHTML = bowlsData.map((_, i) => `<div class="bowl-tab ${i===activeBowlIndex?'active':''}" onclick="selectBowl(${i})">Чаша ${i+1}</div>`).join(''); 
    } else { 
        container.style.display = 'none'; 
        document.getElementById('lbl-strength').innerText = `КРЕПОСТЬ`; 
    }

    if(removeBtn) removeBtn.style.display = bowlsData.length > defaultBowls ? 'block' : 'none';
}

function recalcPrice() {
    let defaultBowls = currentOrderTariff === 'DOUBLE' ? 2 : (currentOrderTariff === 'TEAM' ? 4 : 1);
    let extraBowlsCount = Math.max(0, bowlsData.length - defaultBowls);
    
    let subtotal = currentOrderBasePrice + (extraBowlsCount * 2000);
    
    let bestDiscount = userCurrentDiscount;
    if (appliedPromoObj && appliedPromoObj.discount > userCurrentDiscount) {
        bestDiscount = appliedPromoObj.discount;
        document.getElementById('promo-badge').style.display = 'inline-block';
    } else {
        document.getElementById('promo-badge').style.display = 'none';
    }

    currentOrderFinalPrice = Math.floor(subtotal - (subtotal * (bestDiscount / 100)));
    document.getElementById('modal-final-price').innerText = currentOrderFinalPrice.toLocaleString() + ' ₸';
}

window.addExtraBowl = function() { 
    vibrate(); saveCurrentBowl(); 
    bowlsData.push({ strength: 5, flavor: '', ice: true }); 
    recalcPrice();
    selectBowl(bowlsData.length - 1); 
};

window.removeExtraBowl = function() { 
    vibrate(); 
    let defaultBowls = currentOrderTariff === 'DOUBLE' ? 2 : (currentOrderTariff === 'TEAM' ? 4 : 1);
    if(bowlsData.length <= defaultBowls) return;
    
    bowlsData.splice(activeBowlIndex, 1);
    recalcPrice();

    let nextIndex = activeBowlIndex >= bowlsData.length ? bowlsData.length - 1 : activeBowlIndex;
    selectBowl(nextIndex, true); 
};

// --- ПРОМОКОДЫ ---
window.applyPromo = async function() {
    vibrate();
    const codeInput = document.getElementById('promo-input').value.trim().toUpperCase();
    if(!codeInput) return;

    try {
        const promoSnap = await getDoc(doc(db, "promocodes", codeInput));
        
        if(!promoSnap.exists()) return showToast("❌ Промокод не найден");
        const p = promoSnap.data();
        
        if(p.isActive === false) return showToast("❌ Промокод неактивен");
        if(p.globalLimit > 0 && (p.globalUsed || 0) >= p.globalLimit) return showToast("❌ Лимит исчерпан");
        
        const userUsedMap = currentUserData?.usedPromos || {};
        const userUses = userUsedMap[codeInput] || 0;
        
        if(p.perUserLimit > 0 && userUses >= p.perUserLimit) return showToast("❌ Ты уже использовал этот код");

        appliedPromoObj = { code: codeInput, discount: p.discount };
        showToast(`✅ Код применен! Скидка: ${p.discount}%`);
        recalcPrice();

    } catch (e) { showToast("Ошибка проверки"); }
};

// --- ОФОРМЛЕНИЕ ЗАКАЗА ---
window.openOrderModal = function(tariff, basePrice) {
    vibrate(); 
    if(!currentUserPhone) { 
        switchTab('tab-profile'); 
        showToast("⚠️ Для заказа нужно войти!");
        return; 
    }
    
    currentOrderTariff = tariff; 
    currentOrderBasePrice = basePrice;
    appliedPromoObj = null; 
    document.getElementById('promo-input').value = "";
    document.getElementById('promo-badge').style.display = 'none';

    let numBowls = tariff === 'DOUBLE' ? 2 : (tariff === 'TEAM' ? 4 : 1);
    bowlsData = Array.from({length: numBowls}, () => ({ strength: 5, flavor: '', ice: true }));
    
    document.getElementById('modal-tariff-name').innerText = tariff; 
    document.getElementById('comment-input').value = "";
    
    recalcPrice();
    selectBowl(0);
    
    const modal = document.getElementById('order-modal'); 
    modal.style.display = 'flex'; 
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeOrderModal = function() { vibrate(); const modal = document.getElementById('order-modal'); modal.classList.remove('show'); setTimeout(() => modal.style.display = 'none', 400); };

window.submitOrder = async function() {
    vibrate(); saveCurrentBowl(); const comment = document.getElementById('comment-input').value.trim();
    if(!comment) return showToast("⚠️ Укажи адрес доставки!");
    const submitBtn = document.getElementById('submit-btn'); submitBtn.innerText = "СЕКУНДУ..."; submitBtn.disabled = true;

    let bowlsArrayForDb = bowlsData.map(b => ({ strength: strengthLabels[b.strength], flavor: b.flavor || "На усмотрение", ice: b.ice }));

    try {
        let orderData = { 
            phone: currentUserPhone, 
            name: currentUserData?.name || "Бро", 
            tariff: currentOrderTariff, 
            price: currentOrderFinalPrice, 
            comment: comment, 
            bowls: bowlsArrayForDb, 
            status: "new", 
            createdAt: Date.now() 
        };

        if (appliedPromoObj) orderData.promoCode = appliedPromoObj.code;

        // 1. Сохраняем в Firebase
        await addDoc(collection(db, "orders"), orderData);

        if (appliedPromoObj) {
            await updateDoc(doc(db, "promocodes", appliedPromoObj.code), { globalUsed: increment(1) });
            const userUsedMap = currentUserData?.usedPromos || {};
            userUsedMap[appliedPromoObj.code] = (userUsedMap[appliedPromoObj.code] || 0) + 1;
            await updateDoc(doc(db, "users", currentUserPhone), { usedPromos: userUsedMap });
        }
        
        // 2. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ В TELEGRAM
        const tgToken = "8616525461:AAGTwex70ZkIQMwbBikG9msSG6dY0ErEDKg";
        const tgChatId = "7711813441";
        
        let bowlsText = bowlsArrayForDb.map((b, i) => `💨 Чаша ${i+1}: ${b.flavor} (${b.strength}) ${b.ice ? '🧊' : '🔥'}`).join('\n');
        let promoText = appliedPromoObj ? `\n🎟 Промокод: ${appliedPromoObj.code}` : "";

        let textMessage = `🔥 <b>НОВЫЙ ЗАКАЗ vKasanie!</b> 🔥\n\n` +
                          `👤 <b>Клиент:</b> ${orderData.name} (${orderData.phone})\n` +
                          `📦 <b>Тариф:</b> ${orderData.tariff}\n` +
                          `💰 <b>Сумма:</b> ${orderData.price} ₸${promoText}\n\n` +
                          `📍 <b>Адрес:</b> ${orderData.comment}\n\n` +
                          `<b>Забивки:</b>\n${bowlsText}`;

        // Делаем фоновый POST-запрос к API Телеграма
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: tgChatId,
                text: textMessage,
                parse_mode: 'HTML'
            })
        }).catch(e => console.error("Ошибка отправки в ТГ:", e)); // Ошибку ТГ просто пишем в консоль, чтобы не стопить прилу клиенту
        // ------------------------------------------

        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#ff0055', '#00e5ff', '#ffffff'] });
        showToast("🎉 ЗАКАЗ УЛЕТЕЛ!"); closeOrderModal(); switchTab('tab-home');
    } catch(e) { 
        showToast("Ошибка сети"); 
    } finally { 
        submitBtn.innerText = "ОФОРМИТЬ"; submitBtn.disabled = false; 
    }
};

window.cancelOrder = async function(orderId) { if(confirm("Точно отменить заказ?")) { await updateDoc(doc(db, "orders", orderId), { status: "canceled_client" }); showToast("Заказ отменен"); } };

// --- ПРОСЛУШИВАНИЕ ЗАКАЗОВ (ИСТОРИЯ И АКТИВНЫЕ) ---
function listenOrders() {
    if(activeOrderUnsubscribe) activeOrderUnsubscribe(); 
    
    const q = query(collection(db, "orders"), where("phone", "==", currentUserPhone));
    
    activeOrderUnsubscribe = onSnapshot(q, (snapshot) => {
        let activeHtml = ''; let hasActive = false;
        let historyHtml = '';
        
        let ordersArray = [];
        snapshot.forEach(docSnap => {
            let data = docSnap.data();
            data.id = docSnap.id;
            ordersArray.push(data);
        });

        // Сортируем локально, чтобы обойти ограничения Firebase индексов
        ordersArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        ordersArray.forEach(o => {
            if(!['done', 'canceled_client', 'canceled_admin'].includes(o.status)) {
                hasActive = true;
                const statusMap = { 'new': 'ИЩЕМ МАСТЕРА ⏳', 'accepted': 'ДЫМ УЖЕ ГОТОВИТСЯ 🔥', 'courier': 'КУРЬЕР МЧИТСЯ 🚀' };
                let bgStyle = o.status === 'new' ? 'var(--input-bg)' : (o.status === 'accepted' ? 'linear-gradient(45deg, rgba(255,0,85,0.2), transparent)' : 'linear-gradient(45deg, rgba(0,229,255,0.2), transparent)');

                activeHtml += `
                <div class="app-card glass" style="border-top: 4px solid var(--accent); overflow:hidden;">
                    <p style="font-weight: 800; font-size: 0.8rem; color: var(--accent); margin-bottom: 5px;">ТВОЙ АППАРАТ</p>
                    <h3 style="font-family: var(--font-vandal); font-size: 2.5rem;">${o.tariff}</h3>
                    <div style="background: ${bgStyle}; padding: 20px; border-radius: var(--radius-md); margin-top: 20px; font-weight: 900; font-size: 1.1rem; border: 1px solid var(--border-color);">
                        ${statusMap[o.status] || o.status}
                    </div>
                    ${o.status === 'new' ? `<button class="btn btn-outline" style="border-color:transparent; color:var(--text-muted); padding: 12px; margin-top: 10px;" onclick="cancelOrder('${o.id}')">Отменить заказ</button>` : ''}
                </div>`;
            } else {
                const timeStr = new Date(o.createdAt).toLocaleDateString('ru-RU', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
                const isDone = o.status === 'done';
                const statusText = isDone ? '✅ ВЫПОЛНЕН' : '❌ ОТМЕНЕН';
                const color = isDone ? '#10b981' : '#ef4444';
                
                historyHtml += `
                <div class="glass" style="padding: 18px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: 0.9rem; border-left: 4px solid ${color};">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items: center;">
                        <span style="font-weight: 900; font-family: var(--font-vandal); font-size: 1.2rem;">${o.tariff}</span>
                        <span style="font-weight: 900; color: ${color}; font-size: 0.8rem;">${statusText}</span>
                    </div>
                    <div style="color: var(--text-muted); font-weight: 600;">${timeStr} • <span style="color: var(--text-main); font-weight: 800;">${o.price} ₸</span></div>
                </div>`;
            }
        });

        document.getElementById('home-trackers-container').innerHTML = activeHtml;
        document.getElementById('home-trackers-container').style.display = hasActive ? 'block' : 'none';
        document.getElementById('home-empty').style.display = hasActive ? 'none' : 'block';

        document.getElementById('profile-history-container').innerHTML = historyHtml || '<p style="text-align:center; color:var(--text-muted); font-weight:600;">Пока пусто. Время дыметь!</p>';
    });
}

// --- ЗАПУСК ---
document.addEventListener('DOMContentLoaded', () => { 
    setTimeout(() => { document.getElementById('splash-screen').style.opacity = '0'; setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 600); }, 2000);
    if(currentUserPhone) updateUI(); 
    
    // Биндим кнопки Арсенала на новую логику с дата-атрибутами, так как в HTML мы заменили onclick
    document.querySelectorAll('.btn-order').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tariff = e.target.dataset.tariff;
            const price = parseInt(e.target.dataset.price);
            openOrderModal(tariff, price);
        });
    });

    // Кнопка перехода в арсенал с главной
    const btnToStore = document.getElementById('btn-to-store');
    if (btnToStore) btnToStore.addEventListener('click', () => switchTab('tab-store'));
    
    // Кнопка закрытия модалки
    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeOrderModal);

    // --- ЛОГИКА УСТАНОВКИ PWA (ДОБАВИТЬ НА ЭКРАН) ---
    const pwaPrompt = document.getElementById('pwa-prompt');
    const btnClosePwa = document.getElementById('pwa-close');
    const iosGuide = document.getElementById('pwa-ios-guide');
    const installBtn = document.getElementById('pwa-install-btn');
    let deferredPrompt;

    // Проверяем, не открыто ли уже как приложение (standalone) и не закрывал ли юзер плашку ранее
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const pwaDismissed = localStorage.getItem('pwa_dismissed') === 'true';

    // Определяем iOS (iPhone, iPad)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // Функция показа плашки
    const showPwaPrompt = () => {
        if (isStandalone || pwaDismissed) return;
        
        pwaPrompt.style.display = 'flex';
        setTimeout(() => pwaPrompt.classList.add('show'), 10);

        if (isIOS) {
            iosGuide.style.display = 'block'; // На iOS показываем текст
        }
    };

    // Закрытие плашки
    if (btnClosePwa) {
        btnClosePwa.addEventListener('click', () => {
            pwaPrompt.classList.remove('show');
            setTimeout(() => pwaPrompt.style.display = 'none', 400);
            localStorage.setItem('pwa_dismissed', 'true'); // Запоминаем, чтобы не бесить
        });
    }

    // Перехватываем системное событие установки (работает на Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e; // Сохраняем событие
        installBtn.style.display = 'flex'; // Показываем кнопку установки
    });

    // Обработка клика по кнопке (только Android/PC)
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    console.log('Пользователь установил PWA');
                }
                deferredPrompt = null;
                pwaPrompt.classList.remove('show');
                setTimeout(() => pwaPrompt.style.display = 'none', 400);
            }
        });
    }

    // Запускаем показ плашки через 3 секунды после захода на сайт (чтобы не перекрывать сплеш-скрин)
    setTimeout(showPwaPrompt, 3000);
});

import { doc, getDoc, collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "../firebase-config.js";

export class ProfileManager {
    constructor(app) {
        this.app = app;
        this.userCurrentDiscount = 0;
        this.activeOrderUnsubscribe = null;
        this.discountTiers = [
            { limit: 1000000, percent: 20 }, 
            { limit: 600000, percent: 15 }, 
            { limit: 400000, percent: 10 }, 
            { limit: 250000, percent: 7 }, 
            { limit: 150000, percent: 5 }, 
            { limit: 75000, percent: 3 }, 
            { limit: 0, percent: 0 }
        ];

        // We bind dynamic cancel buttons to window if needed or handle them through event delegation
        // Let's use event delegation on the home-trackers-container
        this.init();
    }

    init() {
        const trackersContainer = document.getElementById('home-trackers-container');
        if (trackersContainer) {
            trackersContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('btn-cancel-order')) {
                    const orderId = e.target.dataset.id;
                    if (orderId && this.app.order) {
                        this.app.order.cancelOrder(orderId);
                    }
                }
            });
        }
    }

    async updateUI() {
        const currentUserPhone = this.app.auth.currentUserPhone;

        if (currentUserPhone) {
            try {
                const snap = await getDoc(doc(db, "users", currentUserPhone));
                if (snap.exists()) {
                    this.app.auth.currentUserData = snap.data();
                }

                document.getElementById('view-login').style.display = 'none';
                document.getElementById('view-profile').style.display = 'block';
                
                const profileName = document.getElementById('profile-name');
                if (profileName) profileName.innerText = this.app.auth.currentUserData?.name || 'Бро';
                
                const profilePhone = document.getElementById('profile-phone');
                if (profilePhone) profilePhone.innerText = currentUserPhone;

                const spent = this.app.auth.currentUserData?.totalSpent || 0;
                const profileSpent = document.getElementById('profile-spent');
                if (profileSpent) profileSpent.innerText = spent.toLocaleString() + ' ₸';

                let hasCustomDiscount = this.app.auth.currentUserData?.customDiscount !== undefined && 
                                        this.app.auth.currentUserData?.customDiscount !== null && 
                                        this.app.auth.currentUserData?.customDiscount !== "";

                if (hasCustomDiscount) {
                    this.userCurrentDiscount = this.app.auth.currentUserData.customDiscount;
                } else {
                    const matchedTier = this.discountTiers.find(t => spent >= t.limit);
                    this.userCurrentDiscount = matchedTier ? matchedTier.percent : 0;
                }

                const profileDiscountText = document.getElementById('profile-discount-text');
                if (profileDiscountText) profileDiscountText.innerText = this.userCurrentDiscount + '% СКИДКА';

                let nextTier = [...this.discountTiers].reverse().find(t => t.limit > spent);

                const loyaltyBar = document.getElementById('loyalty-bar');
                const loyaltyNext = document.getElementById('loyalty-next');

                if (nextTier && !hasCustomDiscount) {
                    let prevLimit = this.discountTiers.find(t => spent >= t.limit)?.limit || 0;
                    let progress = ((spent - prevLimit) / (nextTier.limit - prevLimit)) * 100;
                    if (loyaltyBar) loyaltyBar.style.width = `${progress}%`;
                    if (loyaltyNext) loyaltyNext.innerText = `До скидки ${nextTier.percent}% осталось ${(nextTier.limit - spent).toLocaleString()} ₸`;
                } else {
                    if (loyaltyBar) loyaltyBar.style.width = `100%`;
                    if (loyaltyNext) loyaltyNext.innerText = hasCustomDiscount ? 'Персональная скидка VIP' : `Максимальный уровень!`;
                }

                // Update catalog prices
                ['solo', 'double', 'team'].forEach(item => {
                    const priceEl = document.getElementById(`price-${item}`);
                    const badge = document.getElementById(`badge-${item}`);
                    const oldPrice = document.getElementById(`old-price-${item}`);
                    
                    if (priceEl) {
                        const basePrice = parseInt(priceEl.getAttribute('data-base'));
                        const finalPrice = Math.floor(basePrice - (basePrice * (this.userCurrentDiscount / 100)));
                        priceEl.innerText = finalPrice.toLocaleString() + ' ₸';
                        
                        if (this.userCurrentDiscount > 0) {
                            if (oldPrice) oldPrice.style.display = 'block';
                            if (badge) {
                                badge.style.display = 'inline-block';
                                badge.innerText = `СКИДКА ${this.userCurrentDiscount}%`;
                            }
                        } else {
                            if (oldPrice) oldPrice.style.display = 'none';
                            if (badge) badge.style.display = 'none';
                        }
                    }
                });

                this.listenOrders();

            } catch (e) {
                console.error("Error updating UI:", e);
            }
        } else {
            document.getElementById('view-login').style.display = 'block';
            document.getElementById('view-profile').style.display = 'none';
            document.getElementById('home-empty').style.display = 'block';
            
            const trackersContainer = document.getElementById('home-trackers-container');
            if (trackersContainer) {
                trackersContainer.style.display = 'none';
                trackersContainer.innerHTML = '';
            }
            
            const profileHistoryContainer = document.getElementById('profile-history-container');
            if (profileHistoryContainer) {
                profileHistoryContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-weight:600;">Пока пусто. Время дыметь!</p>';
            }
            
            ['solo', 'double', 'team'].forEach(item => {
                const priceEl = document.getElementById(`price-${item}`);
                if (priceEl) {
                    priceEl.innerText = parseInt(priceEl.getAttribute('data-base')).toLocaleString() + ' ₸';
                    const oldPrice = document.getElementById(`old-price-${item}`);
                    const badge = document.getElementById(`badge-${item}`);
                    if (oldPrice) oldPrice.style.display = 'none';
                    if (badge) badge.style.display = 'none';
                }
            });
        }
    }

    listenOrders() {
        if (this.activeOrderUnsubscribe) this.activeOrderUnsubscribe();

        const currentUserPhone = this.app.auth.currentUserPhone;
        const q = query(collection(db, "orders"), where("phone", "==", currentUserPhone));

        this.activeOrderUnsubscribe = onSnapshot(q, (snapshot) => {
            let activeHtml = '';
            let hasActive = false;
            let historyHtml = '';
            let ordersArray = [];

            snapshot.forEach(docSnap => {
                let data = docSnap.data();
                data.id = docSnap.id;
                ordersArray.push(data);
            });

            // Sort locally to bypass Firebase index requirements
            ordersArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

            ordersArray.forEach(o => {
                if (!['done', 'canceled_client', 'canceled_admin'].includes(o.status)) {
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
                        ${o.status === 'new' ? `<button class="btn btn-outline btn-cancel-order" data-id="${o.id}" style="border-color:transparent; color:var(--text-muted); padding: 12px; margin-top: 10px;">Отменить заказ</button>` : ''}
                    </div>`;
                } else if (o.status === 'done') {
                    const timeStr = new Date(o.createdAt).toLocaleDateString('ru-RU', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
                    const color = '#10b981';
                    
                    historyHtml += `
                    <div class="glass" style="padding: 18px; border-radius: var(--radius-md); margin-bottom: 12px; font-size: 0.9rem; border-left: 4px solid ${color};">
                        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; align-items: center;">
                            <span style="font-weight: 900; font-family: var(--font-vandal); font-size: 1.2rem;">${o.tariff}</span>
                            <span style="font-weight: 900; color: ${color}; font-size: 0.8rem;">✅ ВЫПОЛНЕН</span>
                        </div>
                        <div style="color: var(--text-muted); font-weight: 600;">${timeStr} • <span style="color: var(--text-main); font-weight: 800;">${o.price} ₸</span></div>
                    </div>`;
                }
            });

            const trackersContainer = document.getElementById('home-trackers-container');
            const homeEmpty = document.getElementById('home-empty');
            const profileHistoryContainer = document.getElementById('profile-history-container');

            if (trackersContainer) {
                trackersContainer.innerHTML = activeHtml;
                trackersContainer.style.display = hasActive ? 'block' : 'none';
            }
            if (homeEmpty) {
                homeEmpty.style.display = hasActive ? 'none' : 'block';
            }
            if (profileHistoryContainer) {
                profileHistoryContainer.innerHTML = historyHtml || '<p style="text-align:center; color:var(--text-muted); font-weight:600;">Пока пусто. Время дыметь!</p>';
            }
        });
    }
}

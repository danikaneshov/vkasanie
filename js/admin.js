import { app, db } from './firebase-config.js';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_HASH = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";

let audioUnlocked = false;
document.body.addEventListener('click', () => {
    if(!audioUnlocked) {
        const audio = document.getElementById('alert-sound');
        audio.play().then(() => { audio.pause(); audio.currentTime = 0; }).catch(()=>{});
        audioUnlocked = true;
    }
});

async function hashPassword(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
}

window.checkAuth = async function() {
    const inputVal = document.getElementById('crm-pass').value;
    const hashedInput = await hashPassword(inputVal);
    
    if(hashedInput === ADMIN_HASH || sessionStorage.getItem('crm_auth') === 'true') {
        sessionStorage.setItem('crm_auth', 'true');
        document.getElementById('login-screen').style.display = 'none';
        initCRM(); 
    } else { alert("Неверный пароль!"); }
};

if(sessionStorage.getItem('crm_auth') === 'true') {
    document.getElementById('login-screen').style.display = 'none';
    initCRM();
}

window.switchView = function(viewId) {
    document.getElementById('view-dashboard').style.display = viewId === 'dashboard' ? 'block' : 'none';
    document.getElementById('view-clients').style.display = viewId === 'clients' ? 'block' : 'none';
    document.getElementById('view-promos').style.display = viewId === 'promos' ? 'block' : 'none';
    
    document.getElementById('btn-export').style.display = viewId === 'clients' ? 'block' : 'none';
    
    document.getElementById('nav-dash').classList.toggle('active', viewId === 'dashboard');
    document.getElementById('nav-clients').classList.toggle('active', viewId === 'clients');
    document.getElementById('nav-promos').classList.toggle('active', viewId === 'promos');
    
    if(viewId === 'dashboard') document.getElementById('page-title').innerText = 'Обзор бизнеса';
    if(viewId === 'clients') document.getElementById('page-title').innerText = 'База клиентов';
    if(viewId === 'promos') document.getElementById('page-title').innerText = 'Управление промокодами';
};

setInterval(() => { document.getElementById('clock').innerText = new Date().toLocaleTimeString('ru-RU'); }, 1000);

let currentClientsData = [];
let editingPhone = null;

function initCRM() {
    Chart.defaults.font.family = 'Montserrat';
    const ctxLine = document.getElementById('chartLine').getContext('2d');
    const ctxDoughnut = document.getElementById('chartDoughnut').getContext('2d');
    let chartRevenue = new Chart(ctxLine, { type: 'line', data: { labels: [], datasets: [{ label: 'Выручка (₸)', data: [], borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: {display: true, text: 'ДИНАМИКА ВЫРУЧКИ', align: 'start'} } } });
    let chartTariffs = new Chart(ctxDoughnut, { type: 'doughnut', data: { labels: ['SOLO', 'DOUBLE', 'TEAM'], datasets: [{ data: [0,0,0], backgroundColor: ['#000', '#ef4444', '#10b981'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { title: {display: true, text: 'ПОПУЛЯРНОСТЬ ТАРИФОВ', align: 'start'} }, cutout: '70%' } });

    window.updateStatus = async function(id, status, phone, price) {
        try {
            if (status === 'done') {
                const uRef = doc(db, "users", phone);
                await updateDoc(uRef, { totalSpent: increment(Number(price)) });
            }
            await updateDoc(doc(db, "orders", id), { status: status });
        } catch(e) { console.error(e); }
    };

    let lastOrderCount = 0;
    const qOrders = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    onSnapshot(qOrders, (snapshot) => {
        const container = document.getElementById('orders-container');
        container.innerHTML = '';
        
        let tOrders = 0; let tRev = 0; let tActive = 0; let newOrders = 0;
        let salesDays = {}; let tariffCounts = { 'SOLO':0, 'DOUBLE':0, 'COMPANY':0, 'TEAM':0 };
        
        if(snapshot.docs.length > lastOrderCount && lastOrderCount !== 0) {
            if (audioUnlocked) document.getElementById('alert-sound').play().catch(()=>{});
        }
        lastOrderCount = snapshot.docs.length;

        snapshot.forEach((docSnap) => {
            const o = docSnap.data(); o.id = docSnap.id;
            
            if(o.status === 'done') {
                tOrders++; tRev += Number(o.price) || 0;
                const dStr = new Date(o.createdAt).toLocaleDateString('ru-RU', {day:'numeric', month:'short'});
                salesDays[dStr] = (salesDays[dStr] || 0) + Number(o.price);
                let tName = o.tariff.toUpperCase();
                if(tariffCounts[tName] !== undefined) tariffCounts[tName]++;
            }
            
            if(!['done', 'canceled_client', 'canceled_admin'].includes(o.status)) {
                tActive++;
                if(o.status === 'new') newOrders++;
                
                const time = new Date(o.createdAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
                const cleanPhone = o.phone.replace(/\D/g, '');
                let bowlsInfo = 'Нет данных';
                if(o.bowls && o.bowls.length > 0) bowlsInfo = o.bowls.map((b, i) => `<b>Чаша ${i+1}:</b> ${b.flavor} (${b.strength}) ${b.ice ? '🧊' : ''}`).join('<br>');
                let promoText = o.promoCode ? `<span style="background:var(--accent); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">ПРОМО: ${o.promoCode}</span>` : '';

                container.innerHTML += `
                    <div class="order-ticket status-${o.status}">
                        <div class="t-head"><span class="t-tariff">${o.tariff} ${promoText}</span><span class="t-price">${o.price} ₸</span></div>
                        <div class="t-body">
                            <div class="t-label">КЛИЕНТ</div><b>${o.name || 'Бро'}</b> (${o.phone})<br><br>
                            <div class="t-label">АДРЕС И КОММЕНТАРИЙ</div>${o.comment || 'Нет данных'}<br><br>
                            <div class="t-label">ЗАБИВКИ</div>${bowlsInfo}<br><br>
                            <div class="t-label">СОЗДАН: ${time} | СТАТУС: ${o.status.toUpperCase()}</div>
                        </div>
                        <div class="actions">
                            ${o.status === 'new' ? `<button class="btn btn-black" onclick="updateStatus('${o.id}', 'accepted', '${o.phone}', ${o.price})">ПРИНЯТЬ</button>` : ''}
                            ${o.status === 'accepted' ? `<button class="btn btn-blue" onclick="updateStatus('${o.id}', 'courier', '${o.phone}', ${o.price})">КУРЬЕР В ПУТИ</button>` : ''}
                            <a href="https://wa.me/${cleanPhone}" target="_blank" style="text-decoration:none;"><button class="btn btn-outline" style="width:100%">WHATSAPP</button></a>
                            <button class="btn btn-green" onclick="updateStatus('${o.id}', 'done', '${o.phone}', ${o.price})">ЗАВЕРШИТЬ (ВЫДАН)</button>
                            <button class="btn btn-outline" style="border-color: #ef4444; color: #ef4444;" onclick="if(confirm('Точно отменить?')) updateStatus('${o.id}', 'canceled_admin', '${o.phone}', ${o.price})">ОТМЕНИТЬ</button>
                        </div>
                    </div>`;
            }
        });

        document.getElementById('s-orders').innerText = tOrders;
        document.getElementById('s-revenue').innerText = tRev.toLocaleString() + ' ₸';
        document.getElementById('s-active').innerText = tActive;
        document.getElementById('s-new').innerText = newOrders;
        document.getElementById('s-avg').innerText = tOrders > 0 ? Math.round(tRev / tOrders).toLocaleString() + ' ₸' : '0 ₸';

        chartRevenue.data.labels = Object.keys(salesDays).reverse(); chartRevenue.data.datasets[0].data = Object.values(salesDays).reverse(); chartRevenue.update();
        chartTariffs.data.datasets[0].data = [ tariffCounts['SOLO'] || 0, tariffCounts['DOUBLE'] || 0, (tariffCounts['TEAM'] || 0) + (tariffCounts['COMPANY'] || 0) ]; 
        chartTariffs.update();
    });

    const discountTiers = [
        { limit: 1000000, percent: 20 }, { limit: 600000, percent: 15 }, { limit: 400000, percent: 10 },
        { limit: 250000, percent: 7 }, { limit: 150000, percent: 5 }, { limit: 75000, percent: 3 }, { limit: 0, percent: 0 }
    ];

    const qClients = query(collection(db, "users"), orderBy("totalSpent", "desc"));
    onSnapshot(qClients, (snapshot) => {
        const tbody = document.getElementById('clients-tbody');
        tbody.innerHTML = ''; currentClientsData = [];
        
        if(snapshot.empty) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">База пуста</td></tr>';

        snapshot.forEach(docSnap => {
            const user = docSnap.data(); const phone = docSnap.id;
            const spent = user.totalSpent || 0;
            
            let currentPercent = 0; let isCustom = false;
            
            if(user.customDiscount !== undefined && user.customDiscount !== null && user.customDiscount !== "") {
                currentPercent = user.customDiscount; isCustom = true;
            } else {
                currentPercent = discountTiers.find(t => spent >= t.limit).percent;
            }

            currentClientsData.push({phone, name: user.name || 'Без имени', spent, discount: currentPercent});
            let discountText = currentPercent > 0 ? `<span class="badge-discount" ${isCustom ? 'style="background: #8a2be2;" title="Ручная скидка"' : ''}>${currentPercent}%</span>` : '0%';

            tbody.innerHTML += `
                <tr>
                    <td style="cursor:pointer;" onclick="openEditModal('${phone}', '${user.name || ''}', ${spent}, ${user.customDiscount || ''})"><u>${user.name || 'Без имени'}</u></td>
                    <td>${phone}</td>
                    <td style="color: #10b981;">${spent.toLocaleString()} ₸</td>
                    <td>${discountText}</td>
                    <td><button class="btn btn-outline" style="padding: 5px 10px;" onclick="openEditModal('${phone}', '${user.name || ''}', ${spent}, ${user.customDiscount !== undefined ? user.customDiscount : ''})">Изменить</button></td>
                </tr>`;
        });
    });

    // ПОДГРУЗКА ПРОМОКОДОВ
    onSnapshot(collection(db, "promocodes"), (snapshot) => {
        const tbody = document.getElementById('promos-tbody');
        tbody.innerHTML = '';
        if(snapshot.empty) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Промокодов нет</td></tr>';

        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const code = docSnap.id;
            const statusBadge = p.isActive ? '<span style="color:#10b981; font-weight:900;">АКТИВЕН</span>' : '<span style="color:#ef4444; font-weight:900;">ВЫКЛ</span>';
            const globalLimitTxt = p.globalLimit > 0 ? p.globalLimit : '∞';
            const userLimitTxt = p.perUserLimit > 0 ? p.perUserLimit : '∞';

            tbody.innerHTML += `
                <tr>
                    <td style="font-weight:900; font-family:'Permanent Marker';">${code}</td>
                    <td>${p.discount}%</td>
                    <td>${p.globalUsed || 0} / ${globalLimitTxt}</td>
                    <td>${userLimitTxt} раз(а)</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-outline" style="padding: 5px 10px; margin-right:5px;" onclick="openPromoModal('${code}', ${p.discount}, ${p.globalLimit}, ${p.perUserLimit})">⚙️</button>
                        <button class="btn btn-outline" style="padding: 5px 10px;" onclick="togglePromoStatus('${code}', ${!p.isActive})">${p.isActive ? 'Выкл' : 'Вкл'}</button>
                    </td>
                </tr>
            `;
        });
    });
}

// УПРАВЛЕНИЕ КЛИЕНТАМИ
window.openEditModal = function(phone, name, spent, customDiscount) {
    editingPhone = phone;
    document.getElementById('edit-name').value = name;
    document.getElementById('edit-spent').value = spent;
    document.getElementById('edit-discount').value = customDiscount !== "undefined" ? customDiscount : '';
    document.getElementById('edit-modal').style.display = 'flex';
};
window.closeEditModal = function() { editingPhone = null; document.getElementById('edit-modal').style.display = 'none'; };
window.saveClientEdit = async function() {
    if(!editingPhone) return;
    const newName = document.getElementById('edit-name').value;
    const newSpent = Number(document.getElementById('edit-spent').value);
    const newDiscount = document.getElementById('edit-discount').value;

    let updateData = { name: newName, totalSpent: newSpent };
    if(newDiscount !== '') updateData.customDiscount = Number(newDiscount);
    else updateData.customDiscount = null; 

    try {
        await updateDoc(doc(db, "users", editingPhone), updateData);
        closeEditModal();
    } catch(e) { alert("Ошибка сохранения!"); }
};

// УПРАВЛЕНИЕ ПРОМОКОДАМИ
window.openPromoModal = function(code='', discount='', gLimit=500, uLimit=1) {
    document.getElementById('promo-code-input').value = code;
    document.getElementById('promo-code-input').disabled = code !== ''; // Нельзя менять код при редактировании
    document.getElementById('promo-discount-input').value = discount;
    document.getElementById('promo-global-limit').value = gLimit;
    document.getElementById('promo-user-limit').value = uLimit;
    document.getElementById('promo-modal').style.display = 'flex';
};

window.closePromoModal = function() {
    document.getElementById('promo-modal').style.display = 'none';
};

window.savePromo = async function() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    const discount = Number(document.getElementById('promo-discount-input').value);
    const globalLimit = Number(document.getElementById('promo-global-limit').value);
    const perUserLimit = Number(document.getElementById('promo-user-limit').value); // Исправлено здесь!

    if(!code || !discount) return alert("Укажи код и скидку!");

    try {
        const promoRef = doc(db, "promocodes", code);
        const snap = await getDoc(promoRef);
        
        if (snap.exists()) {
            await updateDoc(promoRef, { discount, globalLimit, perUserLimit });
        } else {
            await setDoc(promoRef, { discount, globalLimit, perUserLimit, globalUsed: 0, isActive: true });
        }
        closePromoModal();
    } catch(e) { 
        console.error(e); // Чтобы, если что, ошибку было видно в консоли (F12)
        alert("Ошибка сохранения промокода"); 
    }
};

window.togglePromoStatus = async function(code, newStatus) {
    try { await updateDoc(doc(db, "promocodes", code), { isActive: newStatus }); } 
    catch(e) { alert("Ошибка смены статуса"); }
};

window.exportToCSV = function() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFИмя,Телефон,Потрачено (Тенге),Скидка (%)\n";
    currentClientsData.forEach(row => { csvContent += `"${row.name}","${row.phone}",${row.spent},${row.discount}\n`; });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `narahate_clients_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
};

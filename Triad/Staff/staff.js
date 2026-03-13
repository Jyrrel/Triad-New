document.addEventListener("DOMContentLoaded",()=>{
/* ═══════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════ */
const TAX=0.12;
const LOW_THRESHOLD=5;
const BEST=new Set([1,2,3,4,7,8,11,12,14,15,17,18,19,20]);
const CATEGORIES={
  "hot-coffee":"☕ Hot Coffee","iced-coffee":"🧊 Iced Coffee",
  "espresso":"⚡ Espresso","frappe":"🥤 Frappe",
  "tea":"🍵 Tea","pastries":"🥐 Pastries","beans":"🫘 Beans"
};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const php=n=>`₱${(isFinite(n)?n:0).toFixed(2)}`;
const now=()=>new Date();
const timeStr=d=>new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const dateStr=d=>d.toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"});

/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
const stockData={};
let orders=[],orderSeq=1;
let archive=[];
let notifications=[],notifSeq=1,notifiedState={};
let currentPayment="cash";
let ewalletProvider="paymaya";
let sidebarPinned=true;

/* ═══════════════════════════════════
   OWNER / STAFF MODE
   Owner PIN: 1234
   Stock changes are synced via localStorage
   so staff sees owner restocks on page load.
═══════════════════════════════════ */
let currentMode = localStorage.getItem('triad_mode')||'staff'; // 'owner' or 'staff'

function saveStockToStorage(){
  // Save stock & status for all items
  const snap={};
  Object.keys(stockData).forEach(id=>{
    snap[id]={stock:stockData[id].stock, status:stockData[id].status};
  });
  localStorage.setItem('triad_stock', JSON.stringify(snap));
}

function loadStockFromStorage(){
  try{
    const snap=JSON.parse(localStorage.getItem('triad_stock')||'{}');
    Object.keys(snap).forEach(id=>{
      if(stockData[id]){
        stockData[id].stock=snap[id].stock;
        stockData[id].status=snap[id].status;
      }
    });
  } catch(e){}
}

function setMode(mode){
  currentMode=mode;
  localStorage.setItem('triad_mode', mode);
  updateModeUI();
}

function updateModeUI(){
  const roleEl=document.querySelector('.sb-profile-role');
  const nameEl=document.querySelector('.sb-profile-name');
  if(roleEl) roleEl.textContent=currentMode==='owner'?'Owner · Active':'Cashier · Active';
  if(nameEl) nameEl.textContent=currentMode==='owner'?'Triad Owner':'Triad Staff';
}

/* ═══════════════════════════════════
   DOM REFS
═══════════════════════════════════ */
const appLayout=$("#appLayout");
const sidebar=$("#sidebar");
const menuGrid=$("#menuGrid");
// Mutable array — syncMenuAndStockFromDB repopulates this after rebuilding the grid from DB
const cards=[...$$("[data-id]",menuGrid)];
// search handled below via #menuSearch
const catBtns=$$(".cat");
const cartEl=$("#cartEl");
const subtotalEl=$("#subtotalEl"),taxEl=$("#taxEl"),totalEl=$("#totalEl");
const continueBtn=$("#continueBtn");
const payBtns=$$(".pay-btn");
const custName=$("#custName");
const tableText=$("#tableText");
const payModal=$("#payModal");
const modalBody=$("#modalBody"),modalFooter=$("#modalFooter");
const navBtns=$$(".sb-row[data-nav]");
const pageTitle=$("#pageTitle");
const toast=$("#toast");
const itemCount=$("#itemCount");
const notifBtn=$("#notifBtn"),notifPanel=$("#notifPanel"),notifBadge=$("#notifBadge"),notifList=$("#notifList");
const sidebarToggle=$("#sidebarToggle");
const sidebarBackBtn=null; // removed in new sidebar

/* ═══════════════════════════════════
   INIT STOCK
═══════════════════════════════════ */
const STOCK_CATEGORIES=new Set(["beans","pastries"]);
cards.forEach(c=>{
  const id=c.dataset.id;
  const cat=c.dataset.category||"";
  if(STOCK_CATEGORIES.has(cat)){
    stockData[id]={name:c.dataset.name,category:cat,type:"stock",stock:20,status:"available"};
  } else {
    // Coffee/tea/frappe/espresso: staff controls availability manually
    stockData[id]={name:c.dataset.name,category:cat,type:"manual",stock:999,status:"available"};
  }
});

// Sync stock from owner's last save
loadStockFromStorage();
// Apply mode UI
updateModeUI();

/* Hero slider removed — menu page replaced with POS Terminal landing */

/* ═══════════════════════════════════
   SIDEBAR COLLAPSE / SHOW
═══════════════════════════════════ */
function showSidebar(){
  sidebarPinned=true;
  sidebar.classList.remove("is-collapsed");
}
function hideSidebar(){
  sidebarPinned=false;
  sidebar.classList.add("is-collapsed");
}
function toggleSidebar(){
  if(sidebar.classList.contains("is-collapsed")) showSidebar();
  else hideSidebar();
}
if (sidebarToggle) {
  sidebarToggle.addEventListener("click", () => toggleSidebar());
}

/* ═══════════════════════════════════
   NAVIGATION
═══════════════════════════════════ */
const pageTitles={pos:"POS Terminal",orders:"Orders",dashboard:"Dashboard",archive:"Archive"};
navBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    // If sidebar is collapsed, expand it first when a nav icon is clicked
    if(sidebar.classList.contains("is-collapsed")) showSidebar();
    navBtns.forEach(b=>b.classList.remove("is-active"));
    btn.classList.add("is-active");
    const key=btn.dataset.nav;
    $$("[data-page]").forEach(p=>p.classList.toggle("active",p.dataset.page===key));
    pageTitle.textContent=pageTitles[key]||key;

    if(key==="dashboard")renderDashboard();
    if(key==="orders")renderOrdersPage();
    if(key==="archive")renderArchive();
  });
});

/* ═══════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════ */
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    payModal.classList.remove("open");
    $("#profileModal").classList.remove("open");
    if($("#appearanceModal").classList.contains("open")) revertAppearance();
    notifPanel.classList.remove("open");
  }
  if(e.altKey){
    if(e.key==="1"){navBtns[0]?.click();e.preventDefault();}
    if(e.key==="2"){navBtns[1]?.click();e.preventDefault();}
    if(e.key==="3"){navBtns[2]?.click();e.preventDefault();}
    if(e.key==="4"){navBtns[3]?.click();e.preventDefault();}
    if(e.key==="h"||e.key==="H"){toggleSidebar();e.preventDefault();}  // Alt+H toggles sidebar
    if(e.key==="n"||e.key==="N"){notifBtn.click();e.preventDefault();}
    if(e.key==="a"||e.key==="A"){$("#appearanceModal").classList.add("open");e.preventDefault();}
  }
});

/* ═══════════════════════════════════
   BEST SELLERS
═══════════════════════════════════ */
cards.forEach(c=>{if(BEST.has(Number(c.dataset.id)))c.classList.add("bestseller");});

/* ═══════════════════════════════════
   CATEGORY FILTER — pill buttons
═══════════════════════════════════ */
let activeCat="all";
let searchQuery="";

function filter(){
  let visible=0;
  const q=searchQuery.trim().toLowerCase();
  cards.forEach(c=>{
    const matchCat=activeCat==="all"||c.dataset.category===activeCat;
    const matchSearch=!q||c.dataset.name.toLowerCase().includes(q)||(c.querySelector("p")?.textContent||"").toLowerCase().includes(q);
    c.style.display=(matchCat&&matchSearch)?"":"none";
    if(matchCat&&matchSearch)visible++;
  });
  if(itemCount)itemCount.textContent=visible+" items";
}

catBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    catBtns.forEach(b=>{b.classList.remove("active");b.setAttribute("aria-selected","false");});
    btn.classList.add("active");btn.setAttribute("aria-selected","true");
    activeCat=btn.dataset.category||"all";filter();
  });
});
filter();

const menuSearchInput=$("#menuSearch");
if(menuSearchInput){
  menuSearchInput.addEventListener("input",()=>{searchQuery=menuSearchInput.value;filter();});
}

/* ═══════════════════════════════════
   STOCK HELPERS
═══════════════════════════════════ */
function getStock(id){return stockData[String(id)]?.stock??999;}
function setStock(id,val){if(stockData[String(id)])stockData[String(id)].stock=Math.max(0,val);}
function getStatus(id){return stockData[String(id)]?.status||"available";}
function setStatus(id,status){if(stockData[String(id)])stockData[String(id)].status=status;}
function isStockType(id){return stockData[String(id)]?.type==="stock";}

function stockLevel(id){
  const d=stockData[String(id)];if(!d)return"ok";
  // Manual-status products (coffee etc.)
  if(d.type==="manual"){
    if(d.status==="out")return"out";
    if(d.status==="unavailable")return"unavailable";
    return"ok";
  }
  // Stock-tracked products (beans, pastries)
  if(d.status==="out"||d.stock===0)return"out";
  if(d.status==="unavailable")return"unavailable";
  if(d.stock<=LOW_THRESHOLD)return"low";
  return"ok";
}

function canAddToCart(id){
  const level=stockLevel(id);
  if(level==="out"||level==="unavailable")return false;
  if(isStockType(id)){
    const inCart=cart.get(String(id))?.qty||0;
    return getStock(id)>inCart;
  }
  return true;
}

function refreshCardStockUI(id){
  const card=$(`[data-id="${id}"]`,menuGrid);if(!card)return;
  // Clear dynamic children
  card.querySelector('.stock-badge')?.remove();
  card.querySelector('.out-of-stock-overlay')?.remove();
  card.querySelector('.avail-toggle-btn')?.remove();
  card.querySelector('.avail-dropdown')?.remove();
  card.classList.remove('out-of-stock','menu-open');

  const level=stockLevel(id);
  const d=stockData[String(id)];

  // ── Overlay for out / unavailable ──
  if(level==='out'||level==='unavailable'){
    const ov=document.createElement('div');
    ov.className='out-of-stock-overlay';
    ov.innerHTML=`<span>${level==='unavailable'?'⏸️':'🚫'}</span><strong>${level==='unavailable'?'Not Available':'Out of Stock'}</strong><small>${d?.name||''}</small>`;
    card.appendChild(ov);
    card.classList.add('out-of-stock');
  } else {
    if(level==='low'&&isStockType(id)){
      const b=document.createElement('span');
      b.className='stock-badge';
      b.textContent=`Low: ${getStock(id)} left`;
      card.appendChild(b);
    }
  }

  // ── Gear toggle button — only for beans & pastries (stock-tracked) ──
  if(isStockType(id)){
    const btn=document.createElement('button');
    btn.className='avail-toggle-btn';
    btn.title='Set availability';
    const status=d?.status||'available';
    if(status==='unavailable'){btn.innerHTML='⏸ Not Available';btn.classList.add('status-unavail');}
    else if(status==='out'){btn.innerHTML='🚫 Out of Stock';btn.classList.add('status-out');}
    else if(level==='low'){btn.innerHTML='⚠ Low Stock';btn.classList.add('status-low');}
    else btn.innerHTML='⚙ Availability';
    btn.addEventListener('click',e=>{
      e.stopPropagation();
      const existing=document.querySelector(`.avail-dropdown[data-drop-id="${id}"]`);
      if(existing){existing.remove();card.classList.remove('menu-open');return;}
      closeAllAvailMenus();
      openAvailDropdown(id, card, btn);
    });
    card.appendChild(btn);
  }
}
function refreshAllCardStock(){Object.keys(stockData).forEach(id=>refreshCardStockUI(id));}

function closeAllAvailMenus(){
  document.querySelectorAll('.avail-dropdown').forEach(m=>m.remove());
  document.querySelectorAll('.card.menu-open').forEach(c=>c.classList.remove('menu-open'));
}

function openAvailDropdown(id, card, anchorBtn){
  const d=stockData[String(id)];if(!d)return;
  const isStock=d.type==='stock';
  const status=d.status||'available';

  const drop=document.createElement('div');
  drop.className='avail-dropdown';
  drop.dataset.dropId=id;

  // ── Status options ──
  const statusOpts=[];
  if(status!=='available') statusOpts.push({label:'✅ Mark as Available',  status:'available'});
  if(status!=='unavailable') statusOpts.push({label:'⏸️ Not Available',  status:'unavailable'});
  if(status!=='out')        statusOpts.push({label:'🚫 Out of Stock',      status:'out'});

  let html='<div class="avail-section-label">Set Status</div>';
  html+=statusOpts.map((o,i)=>`<button class="avail-dropdown-item" data-action="status" data-idx="${i}">${o.label}</button>`).join('');

  // ── Restock section (beans/pastries only, owner mode only) ──
  if(isStock && currentMode==='owner'){
    html+=`<div class="avail-dropdown-sep"></div>
      <div class="avail-section-label">Restock (currently ${getStock(id)})</div>
      <div class="avail-restock-row">
        <button class="avail-restock-btn" style="width:100%;" data-action="restock">🔄 Restock to Full (20)</button>
      </div>`;
  }

  drop.innerHTML=html;

  // ── Portal: append to body so overflow:hidden on .card doesn't clip it ──
  document.body.appendChild(drop);
  card.classList.add('menu-open');

  // Position below the anchor button
  const btnRect=anchorBtn.getBoundingClientRect();
  drop.style.top=(btnRect.bottom+4)+'px';
  drop.style.left='auto';
  drop.style.right=(window.innerWidth-btnRect.right)+'px';

  requestAnimationFrame(()=>{
    const rect=drop.getBoundingClientRect();
    if(rect.bottom>window.innerHeight-12){
      drop.style.top=(btnRect.top-rect.height-4)+'px';
    }
    if(rect.left<8){
      drop.style.right='auto';
      drop.style.left='8px';
    }
  });

  // Use mousedown so it fires BEFORE document click closes the menu
  drop.querySelectorAll('[data-action="status"]').forEach((btn,i)=>{
    btn.addEventListener('mousedown',e=>{
      e.preventDefault();
      e.stopPropagation();
      closeAllAvailMenus();
      const opt=statusOpts[i];
      setStatus(id,opt.status);
      saveStockToStorage();
      if(opt.status==='available'&&isStock&&getStock(id)===0)setStock(id,20);
      checkStockNotifications(id,d.name);
      refreshCardStockUI(id);
      if(opt.status!=='available'&&cart.has(String(id))){
        cart.delete(String(id));renderCart();updateCardUI(id);
      }
      const label=opt.status==='available'?'Available':opt.status==='unavailable'?'Not Available':'Out of Stock';
      showToast(`${d.name} → ${label}`);
    });
  });

  // Restock click (owner mode only — resets stock to 20)
  drop.querySelector('[data-action="restock"]')?.addEventListener('mousedown',async e=>{
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await TriadDB.restock(id, 20 - getStock(id), 0, 'Restocked via staff panel', 'Owner');
      if (res.success) {
        setStock(id,20);
        setStatus(id,'available');
        saveStockToStorage();
        checkStockNotifications(id,d.name);
        closeAllAvailMenus();
        refreshCardStockUI(id);
        showToast(`${d.name} restocked! Stock set to 20`);
      } else {
        showToast('Failed to restock: ' + (res.message || 'Unknown error'));
      }
    } catch (err) {
      showToast('Error restocking: ' + err.message);
    }
  });
}

// Close menu on outside click or scroll
document.addEventListener('click',closeAllAvailMenus);
document.querySelector('.content')?.addEventListener('scroll',closeAllAvailMenus,{passive:true});

/* ═══════════════════════════════════
   NOTIFICATIONS — auto-remove on restock
═══════════════════════════════════ */
function addNotif(type,msg){
  notifications.unshift({id:notifSeq++,type,msg,time:now(),unread:true});
  if(notifications.length>50)notifications.pop();
  renderNotifBadge();renderNotifList();
}
function removeNotifForItem(name){
  // Remove any low/out notifications for this item when restocked
  notifications=notifications.filter(n=>!n.msg.includes(name));
  renderNotifBadge();renderNotifList();
}
function renderNotifBadge(){
  const count=notifications.length;
  if(count>0){
    notifBadge.textContent=count>99?"99+":count;
    notifBadge.classList.add("show");
  } else {
    notifBadge.classList.remove("show");
  }
}
function renderNotifList(){
  if(!notifications.length){notifList.innerHTML=`<div class="notif-empty">No notifications</div>`;return;}
  const icons={warn:"⚠️",danger:"🚫",info:"ℹ️"};
  notifList.innerHTML=notifications.map(n=>`
    <div class="notif-item">
      <div class="notif-icon-wrap ${n.type}">${icons[n.type]||"🔔"}</div>
      <div class="notif-content">
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-time">${timeStr(n.time)}</div>
      </div>
    </div>`).join("");
}
notifBtn.addEventListener("click",e=>{
  e.stopPropagation();notifPanel.classList.toggle("open");
});
document.addEventListener("click",e=>{
  if(!notifBtn.contains(e.target)&&!notifPanel.contains(e.target))notifPanel.classList.remove("open");
});

/* ── See All Stock Status ── */
function renderStockStatusPanel(){
  const body=document.getElementById("stockStatusBody");if(!body)return;
  const catOrder=["hot-coffee","iced-coffee","espresso","frappe","tea","pastries","beans"];
  const catLabels={"hot-coffee":"☕ Hot Coffee","iced-coffee":"🧊 Iced Coffee","espresso":"⚡ Espresso","frappe":"🥤 Frappe","tea":"🍵 Tea","pastries":"🥐 Pastries","beans":"🫘 Beans"};

  // Group by status priority
  const groups={out:[],low:[],unavailable:[]};
  cards.forEach(c=>{
    const id=c.dataset.id;
    const d=stockData[id];if(!d)return;
    const level=stockLevel(id);
    const cat=c.dataset.category||"other";
    const entry={id,name:d.name,cat,level,stock:d.stock,type:d.type,status:d.status};
    if(level==="out")groups.out.push(entry);
    else if(level==="low")groups.low.push(entry);
    else if(level==="unavailable")groups.unavailable.push(entry);
  });

  // Render one status section, items grouped by category inside
  const renderSection=(title,sectionClass,items)=>{
    if(!items.length)return"";
    // Sub-group by category
    const byCat={};
    items.forEach(e=>{
      if(!byCat[e.cat])byCat[e.cat]=[];
      byCat[e.cat].push(e);
    });
    let s=`<div class="stock-section-wrap">`;
    s+=`<div class="stock-section-head ${sectionClass}-head">${title} <span class="stock-section-count">${items.length}</span></div>`;
    // Render each category sub-group
    catOrder.forEach(cat=>{
      const list=byCat[cat];
      if(!list||!list.length)return;
      s+=`<div class="stock-cat-group">
        <div class="stock-cat-label">${catLabels[cat]||cat}</div>`;
      s+=list.map(e=>`
        <div class="stock-status-row" id="ssr_${e.id}">
          <div class="stock-status-name">${e.name}</div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            ${e.level==="out"?`<span class="stock-status-tag tag-out">Out of Stock</span>`:
              e.level==="low"?`<span class="stock-status-tag tag-low">Low: ${e.stock}</span>`:
              `<span class="stock-status-tag tag-unavail">Not Available</span>`}
            <button class="stock-change-btn" onclick="toggleStockPicker('${e.id}','${e.name}')">Change</button>
          </div>
        </div>
        <div class="stock-picker-row" id="picker_${e.id}" style="display:none;">
          <span class="stock-picker-label">Set to:</span>
          <button class="stock-picker-btn picker-available" onclick="applyStockChange('${e.id}','${e.name}','available')">✅ Available</button>
          <button class="stock-picker-btn picker-unavail" onclick="applyStockChange('${e.id}','${e.name}','unavailable')">⏸️ Not Available</button>
          <button class="stock-picker-btn picker-out" onclick="applyStockChange('${e.id}','${e.name}','out')">🚫 Out of Stock</button>
        </div>`).join("");
      s+=`</div>`;
    });
    s+=`</div>`;
    return s;
  };

  let html="";
  html+=renderSection("🚫 Out of Stock","status-out",groups.out);
  html+=renderSection("⚠️ Low Stock","status-low",groups.low);
  html+=renderSection("⏸️ Not Available","status-unavail",groups.unavailable);
  body.innerHTML=html||`<div style="text-align:center;padding:28px 16px;color:var(--muted);font-size:13px;">✅ All products are currently available</div>`;
}
document.getElementById("notifSeeAllBtn")?.addEventListener("click",e=>{
  e.stopPropagation();
  notifPanel.classList.remove("open");
  renderStockStatusPanel();
  document.getElementById("stockStatusModal").classList.add("open");
});

window.toggleStockPicker=function(id, name){
  const picker=document.getElementById(`picker_${id}`);
  if(!picker)return;
  const isOpen=picker.style.display!=='none';
  // Close all other open pickers first
  document.querySelectorAll('.stock-picker-row').forEach(p=>p.style.display='none');
  document.querySelectorAll('.stock-change-btn').forEach(b=>b.textContent='Change');
  if(!isOpen){
    picker.style.display='flex';
    const btn=document.querySelector(`#ssr_${id} .stock-change-btn`);
    if(btn) btn.textContent='Cancel';
  }
};

window.applyStockChange=function(id, name, newStatus){
  setStatus(id, newStatus);
  if(newStatus==='available'){
    const isStock=stockData[String(id)]?.type==='stock';
    if(isStock && getStock(id)===0) setStock(id, 20);
  }
  if(newStatus!=='available' && cart.has(String(id))){
    cart.delete(String(id)); renderCart(); updateCardUI(id);
  }
  saveStockToStorage();
  checkStockNotifications(id, name);
  refreshCardStockUI(id);
  const label=newStatus==='available'?'Available':newStatus==='unavailable'?'Not Available':'Out of Stock';
  showToast(`${name} → ${label}`);
  // Re-render the panel to reflect updated statuses
  renderStockStatusPanel();
};

function checkStockNotifications(id,name){
  const d=stockData[String(id)];if(!d)return;
  const prev=notifiedState[id];
  const status=d.status||"available";
  const level=stockLevel(id);

  if(level==="out"&&prev!=="out"){
    notifiedState[id]="out";
    addNotif("danger",`<strong>${name}</strong> is out of stock.`);
  } else if(level==="unavailable"&&prev!=="unavailable"){
    notifiedState[id]="unavailable";
    addNotif("warn",`<strong>${name}</strong> was marked as not available.`);
  } else if(level==="low"&&prev!=="low"&&prev!=="out"){
    const s=getStock(id);
    notifiedState[id]="low";
    addNotif("warn",`<strong>${name}</strong> is running low — only <strong>${s} units</strong> left.`);
  } else if(level==="ok"&&prev){
    // Auto-remove notification when available again
    delete notifiedState[id];
    removeNotifForItem(name);
  }
}

/* ═══════════════════════════════════
   CART & TOTALS
   Prices on cards are VAT-INCLUSIVE.
   Total = sum of (price × qty)  ← already includes 12% VAT
   VAT portion = Total × (0.12/1.12)
   SubTotal (ex-VAT) = Total - VAT
═══════════════════════════════════ */
const cart=new Map();
function calcTotals(){
  let total=0;
  cart.forEach(i=>total+=i.price*i.qty);
  const vatPortion=total*(0.12/1.12);
  const sub=total-vatPortion;
  // Display: total = original displayed price (already VAT-inclusive)
  // Show VAT as a small note, not a separate line
  totalEl.textContent=php(total);
  taxEl.textContent=php(vatPortion);
  if(subtotalEl)subtotalEl.textContent=php(sub); // hidden, used internally
  continueBtn.disabled=cart.size===0;
  return{sub,tax:vatPortion,total};
}
function updateCardUI(id){
  const card=$(`[data-id="${id}"]`,menuGrid);if(!card)return;
  const item=cart.get(String(id));
  const qtyEl=card.querySelector("[data-card-qty]");
  if(item&&item.qty>0){card.classList.add("in-cart");if(qtyEl)qtyEl.textContent=item.qty;}
  else{card.classList.remove("in-cart");if(qtyEl)qtyEl.textContent="1";}
  refreshCardStockUI(id);
}
function updateRightPanel(){
  const rightPanel=$(".right");
  if(cart.size===0){
    rightPanel.classList.add("hidden");
  }else{
    rightPanel.classList.remove("hidden");
  }
}
function renderCart(){
  if(cart.size===0){
    cartEl.innerHTML=`<div class="cart-empty"><div class="cart-empty-icon">🛒</div><div>Cart is empty</div><div style="margin-top:4px;font-size:11px;color:var(--muted)">Tap items to add them</div></div>`;
    calcTotals();updateRightPanel();return;
  }
  cartEl.innerHTML="";
  cart.forEach(item=>{
    const row=document.createElement("div");row.className="order-item";
    row.dataset.cartItem="";row.dataset.id=item.id;
    row.innerHTML=`
      <img src="${item.img}" alt="${item.name}" style="width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;">
      <div class="order-info">
        <div class="order-name">${item.name}</div>
        <div class="order-price">${php(item.price)} × ${item.qty} = ${php(item.price*item.qty)}</div>
      </div>
      <div class="order-actions">
        <button class="round" data-action="dec">−</button>
        <span class="qty-badge">${item.qty}</span>
        <button class="round" data-action="inc">+</button>
        <button class="round remove" data-action="remove">✕</button>
      </div>`;
    cartEl.appendChild(row);
  });
  calcTotals();
  updateRightPanel();
}
function addItem(card){
  const id=String(card.dataset.id),name=card.dataset.name,price=Number(card.dataset.price);
  const img=card.querySelector("img")?.src||"";
  if(!id||!name||!price)return;
  const level=stockLevel(id);
  if(level==="out"){showToast(`${name} is out of stock!`);return;}
  if(level==="unavailable"){showToast(`${name} is not available.`);return;}
  if(isStockType(id)){
    const inCart=cart.get(id)?.qty||0;
    if(inCart>=getStock(id)){showToast(`Not enough stock for ${name}`);return;}
  }
  const ex=cart.get(id);
  if(ex)ex.qty++;else cart.set(id,{id,name,price,img,qty:1,category:stockData[id]?.category||card.dataset.category||'',type:stockData[id]?.type||'manual'});
  renderCart();updateCardUI(id);showToast(`Added ${name} ☕`);
}
menuGrid.addEventListener("click",e=>{
  const card=e.target.closest("[data-id]");if(!card)return;
  const action=e.target.closest("button")?.dataset.action;
  if(!action||action==="add-to-cart"){addItem(card);}
  else if(action==="card-increase"){
    const id=String(card.dataset.id);
    if(isStockType(id)&&(cart.get(id)?.qty||0)>=getStock(id)){showToast("Not enough stock!");return;}
    const ex=cart.get(id);if(ex){ex.qty++;renderCart();updateCardUI(id);}
  }else if(action==="card-decrease"){
    const id=String(card.dataset.id);
    const ex=cart.get(id);
    if(ex){
      // Minimum 1 — don't go below, don't remove
      if(ex.qty>1){ex.qty--;renderCart();updateCardUI(id);}
      // If qty is 1 and minus is clicked: stay at 1, just show a gentle toast
      else{showToast("Minimum quantity is 1. Use ✕ to remove.");}
    }
  }
});
cartEl.addEventListener("click",e=>{
  const row=e.target.closest("[data-cart-item]");if(!row)return;
  const id=row.dataset.id,item=cart.get(id);if(!item)return;
  const action=e.target.closest("button")?.dataset.action;
  if(action==="inc"){if(isStockType(id)&&item.qty>=getStock(id)){showToast("Not enough stock!");return;}item.qty++;}
  else if(action==="dec"){if(item.qty>1)item.qty--;} // min 1 in cart
  else if(action==="remove"){cart.delete(id);renderCart();updateCardUI(id);return;}
  // Update in-place to avoid blink
  const badge=row.querySelector(".qty-badge");
  if(badge)badge.textContent=item.qty;
  const priceEl=row.querySelector(".order-price");
  if(priceEl)priceEl.textContent=`${php(item.price)} × ${item.qty} = ${php(item.price*item.qty)}`;
  calcTotals();updateCardUI(id);
});
renderCart();
updateRightPanel();

/* ═══════════════════════════════════
   PAYMENT
═══════════════════════════════════ */
payBtns.forEach(btn=>{
  btn.addEventListener("click",()=>{
    payBtns.forEach(b=>{b.classList.remove("active");});
    btn.classList.add("active");
    currentPayment=btn.dataset.payment;
  });
});
const getPayment=()=>payBtns.find(b=>b.classList.contains("active"))?.dataset.payment||"cash";
$$(".type-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{$$(".type-btn").forEach(b=>b.classList.remove("active"));btn.classList.add("active");});
});
const getOrderType=()=>$(".type-btn.active")?.dataset.type||"dine-in";
function setPersons(n){
  const c=Math.max(1,Math.min(99,Math.round(n)||1));
  const inp=document.getElementById("tableText");
  if(inp)inp.value=c;
}
function getPersons(){
  const v=parseInt(document.getElementById("tableText")?.value)||1;
  return Math.max(1,v);
}
const decPerson=document.getElementById("decPerson");
const incPerson=document.getElementById("incPerson");
const tableTextEl=document.getElementById("tableText");
if(decPerson)decPerson.addEventListener("click",()=>setPersons(getPersons()-1));
if(incPerson)incPerson.addEventListener("click",()=>setPersons(getPersons()+1));
if(tableTextEl){
  tableTextEl.addEventListener("change",()=>setPersons(parseInt(tableTextEl.value)||1));
  tableTextEl.addEventListener("blur",()=>setPersons(parseInt(tableTextEl.value)||1));
}

/* ═══════════════════════════════════
   QR GENERATOR
═══════════════════════════════════ */
function generateQR(text,size=152){
  const cells=21,cs=size/cells;
  let h=0;for(let i=0;i<text.length;i++)h=((h<<5)-h)+text.charCodeAt(i);
  const rng=s=>{s=(s^(s>>>16))*0x45d9f3b;s=(s^(s>>>16))*0x45d9f3b;return(s^(s>>>16))>>>0;};
  let svg=`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="white"/>`;
  [[0,0],[0,14],[14,0]].forEach(([r,c])=>{
    svg+=`<rect x="${c*cs}" y="${r*cs}" width="${7*cs}" height="${7*cs}" fill="black"/>`;
    svg+=`<rect x="${(c+1)*cs}" y="${(r+1)*cs}" width="${5*cs}" height="${5*cs}" fill="white"/>`;
    svg+=`<rect x="${(c+2)*cs}" y="${(r+2)*cs}" width="${3*cs}" height="${3*cs}" fill="black"/>`;
  });
  for(let r=0;r<cells;r++)for(let c=0;c<cells;c++){
    const inFinder=(r<8&&c<8)||(r<8&&c>12)||(r>12&&c<8);
    if(!inFinder&&rng(h+r*cells+c)%3===0)
      svg+=`<rect x="${c*cs}" y="${r*cs}" width="${cs}" height="${cs}" fill="black"/>`;
  }
  svg+="</svg>";return svg;
}

/* ═══════════════════════════════════
   PAYMENT MODAL
═══════════════════════════════════ */
function openPaymentModal(initialCash=null) {
  if(cart.size===0)return;
  const{sub,tax,total}=calcTotals();
  const customer=custName.value.trim()||"Guest";
  const persons=getPersons();
  const orderType=getOrderType();
  const payment=getPayment();
  const isCash=payment==="cash";

  let itemsHtml="";
  cart.forEach(it=>{
    itemsHtml+=`<div class="receipt-item"><span class="receipt-item-name">${it.name} <span class="receipt-item-qty">×${it.qty}</span></span><span>${php(it.price*it.qty)}</span></div>`;
  });

  let paySection="";
  if(isCash){
    paySection=`<div class="cash-section">
      <div class="field-label">Cash Tendered</div>
      <div class="cash-row"><label>₱</label><input class="cash-input" id="cashTendered" type="number" min="0" step="0.01" placeholder="${total.toFixed(2)}"/></div>
      <div class="quick-cash" id="quickCash"></div>
      <div class="change-display"><span class="change-label">Change</span><span class="change-amount" id="changeAmount">₱0.00</span></div>
    </div>`;
  }else{
    // E-Wallet — show QR, simulate scan → auto receipt
    if(!["paymaya","gcash"].includes(ewalletProvider)) ewalletProvider="paymaya";
    const isGcash = ewalletProvider === 'gcash';
    
    paySection=`<div class="ewallet-wrap" id="ewalletWrap">
      <div class="ewallet-tabs">
        <button class="ewallet-tab ${!isGcash?'active':''}" id="tabPaymaya" onclick="switchEwallet('paymaya')">💜 PayMaya</button>
        <button class="ewallet-tab ${isGcash?'active':''}" id="tabGcash" onclick="switchEwallet('gcash')">💙 GCash</button>
      </div>
      <div id="qrArea">
        <div class="qr-brand" id="ewalletBrand">${isGcash?'GCash':'PayMaya'}</div>
        <div class="qr-box" id="qrBox"><div id="qrSvg">${generateQR((isGcash?"GCASH_":"PAYMAYA_")+total.toFixed(2))}</div><div class="qr-scan-line"></div></div>
        <div class="qr-amount">${php(total)}</div>
        <div class="qr-inst">Open your <span id="ewalletApp">${isGcash?'GCash':'PayMaya'}</span> app and scan the QR code</div>
        <div class="qr-status-bar scanning" id="qrStatus"><span class="qr-dot"></span><span id="qrStatusText">Waiting for scan…</span></div>
        <button class="sim-scan-btn" id="simScanBtn" onclick="simulateScan()">📱 Simulate Customer Scan</button>
      </div>
    </div>`;
  }

  $("#payModalTitle").textContent=isCash?"Confirm Payment":"E-Wallet Payment";
  modalBody.innerHTML=`
    <div style="font-size:13px;color:var(--muted);">
      <strong style="color:var(--text)">${customer}</strong> · ${persons} person${Number(persons)>1?"s":""} · ${orderType==="dine-in"?"🍽️ Dine In":"🥡 Takeout"}
    </div>
    <div class="receipt-items">${itemsHtml}</div>
    <div class="receipt-totals">
      <div class="receipt-total-line grand"><span>Total</span><span>${php(total)}</span></div>
      <div class="receipt-total-line" style="font-size:11px;"><span style="color:var(--muted);">incl. VAT 12%</span><span style="color:var(--muted);">${php(tax)}</span></div>
    </div>${paySection}`;

  // Footer — cash shows confirm btn, ewallet hides it (auto-triggers on scan)
  modalFooter.innerHTML=`
    ${isCash?`<button class="btn-outline" id="cancelPayBtn">Cancel</button><button class="btn-confirm" id="confirmPayBtn" disabled>✓ Confirm Payment</button>`:`<div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;"><div style="font-size:12px;text-align:center;color:var(--muted);line-height:1.5;">Scan QR to complete payment automatically</div><button class="btn-outline" id="cancelPayBtn" style="width:100%;max-width:200px;">Cancel</button></div>`}`;

  $("#cancelPayBtn").addEventListener("click",()=>payModal.classList.remove("open"));
  payModal.classList.add("open");

  if(isCash){
    const cashInput=$("#cashTendered");
    const changeAmount=$("#changeAmount");
    const quickCashEl=$("#quickCash");
    const cpBtn=$("#confirmPayBtn");
    // Always include exact total + rounded amounts
    const rounds=[total,Math.ceil(total/5)*5,Math.ceil(total/10)*10,Math.ceil(total/50)*50,Math.ceil(total/100)*100];
    [...new Set(rounds)].filter(v=>v>=total).slice(0,5).forEach(v=>{
      const btn=document.createElement("button");btn.className="quick-btn";
      btn.textContent=v===total?`Exact ${php(v)}`:php(v);
      btn.addEventListener("click",()=>{cashInput.value=v.toFixed(2);cashInput.dispatchEvent(new Event("input"));});
      quickCashEl.appendChild(btn);
    });
    cashInput.addEventListener("input",()=>{
      const t=parseFloat(cashInput.value)||0;
      const ch=parseFloat((t-total).toFixed(2));
      if(t<=0){changeAmount.textContent="—";changeAmount.style.color="var(--muted)";cpBtn.disabled=true;}
      else if(ch>=0){changeAmount.textContent=php(ch);changeAmount.style.color="var(--primary)";cpBtn.disabled=false;}
      else{changeAmount.textContent="Insufficient";changeAmount.style.color="var(--red)";cpBtn.disabled=true;}
    });
    
    if(initialCash !== null) {
        cashInput.value = initialCash;
        cashInput.dispatchEvent(new Event("input"));
    } else {
        cashInput.focus();
    }

    cpBtn.addEventListener("click",()=>finaliseOrder(payment,parseFloat(cashInput.value)||0,total,customer,orderType,persons,sub,tax,total));
  }
}

continueBtn.addEventListener("click",()=>openPaymentModal());

/* Ewallet provider switch */
window.switchEwallet=provider=>{
  ewalletProvider=provider;
  const{total}=calcTotals();
  $("#tabPaymaya")?.classList.toggle("active",provider==="paymaya");
  $("#tabGcash")?.classList.toggle("active",provider==="gcash");
  const name=provider==="gcash"?"GCash":"PayMaya";
  const brand=$("#ewalletBrand");if(brand)brand.textContent=name;
  const app=$("#ewalletApp");if(app)app.textContent=name;
  const qrSvg=$("#qrSvg");if(qrSvg)qrSvg.innerHTML=generateQR((provider==="gcash"?"GCASH_":"PAYMAYA_")+total.toFixed(2));
};

/* Simulate customer scanning */
window.simulateScan=()=>{
  const statusBar=$("#qrStatus");
  const statusText=$("#qrStatusText");
  const simBtn=$("#simScanBtn");
  if(!statusBar)return;
  // Disable sim button
  if(simBtn){simBtn.disabled=true;simBtn.textContent="Scanning…";}
  statusBar.className="qr-status-bar scanning";
  if(statusText)statusText.textContent="Scanning QR…";
  const qrBox=$("#qrBox");if(qrBox)qrBox.classList.add("qr-scanning");

  setTimeout(()=>{
    // Mark as scanned
    statusBar.className="qr-status-bar scanned";
    if(statusText)statusText.textContent="✓ Payment Received!";
    if(qrBox){qrBox.classList.remove("qr-scanning");qrBox.classList.add("qr-scanned");}

    // Auto-proceed after brief delay
    setTimeout(()=>{
      const{sub,tax,total}=calcTotals();
      const customer=custName.value.trim()||"Guest";
      const persons=getPersons();
      const orderType=getOrderType();
      finaliseOrder("ewallet",0,total,customer,orderType,persons,sub,tax,total);
    },900);
  },2000);
};

/* Finalise order & show receipt */
function finaliseOrder(payment,tendered,total,customer,orderType,persons,sub,tax,_total){
  const change=payment==="cash"?tendered-total:0;
  const payLabel=payment==="ewallet"?(ewalletProvider==="gcash"?"GCash":"PayMaya"):"Cash";
  const payIcon=payment==="cash"?"💵":"📱";

  // Build receipt
  // Build receipt (Preview)
  const receiptTime=now();
  const orderItems=[];cart.forEach(it=>orderItems.push({...it}));
  const receiptItemRows=orderItems.map(it=>`<div class="r-row"><span>${it.name} ×${it.qty}</span><span>${php(it.price*it.qty)}</span></div>`).join("");
  const receiptHTML=`
    <div class="receipt-paper" id="receiptContent">
      <div class="r-logo">☕ Triad Coffee Roasters</div>
      <div style="font-size:10px;color:#888;margin:2px 0;">${dateStr(receiptTime)} ${timeStr(receiptTime)}</div>
      <hr>
      <div style="font-size:11px;">Order #${orderSeq}</div>
      <div style="font-size:11px;">Customer: <strong>${customer}</strong></div>
      <div style="font-size:11px;">${orderType==="dine-in"?"🍽️ Dine-In":"🥡 Takeout"} · ${persons} pax</div>
      <hr>
      ${receiptItemRows}
      <hr>
      <hr>
      <div class="r-bold"><span>TOTAL</span><span>${php(total)}</span></div>
      <div class="r-row" style="font-size:10px;color:#999;"><span>incl. VAT 12%</span><span>${php(tax)}</span></div>
      ${payment==="cash"?`<div class="r-row" style="margin-top:6px;"><span>Cash</span><span>${php(tendered)}</span></div><div class="r-row"><span>Change</span><span>${php(change)}</span></div>`:""}
      <hr>
      <div class="r-paid">${payIcon} Paid via ${payLabel}</div>
      <div style="margin-top:12px;font-size:13px;font-weight:700;font-family:'Playfair Display',serif;">Thank you, ${customer}! ☕</div>
      <div style="font-size:10px;color:#aaa;margin-top:4px;">Have a wonderful day!</div>
    </div>`;

  // Update modal to show receipt
  $("#payModalTitle").textContent="Receipt";
  modalBody.innerHTML=receiptHTML;
  modalFooter.innerHTML = `
    <button class="btn-outline" id="receiptBackBtn">⬅ Back</button>
    <button class="btn-confirm" id="receiptFinishBtn" style="flex:2;">🖨️ Print & New Order</button>
  `;

  // Hide scan button area
  const simBtn=$("#simScanBtn");if(simBtn)simBtn.style.display="none";

  // Back Button Logic
  $("#receiptBackBtn").addEventListener("click", () => {
      openPaymentModal(payment === "cash" ? tendered : null);
  });

  // Finish Button Logic
  $("#receiptFinishBtn").addEventListener("click", async function() {
    // 1. Deduct stock (local UI)
    cart.forEach(it=>{if(isStockType(it.id)){setStock(it.id,getStock(it.id)-it.qty);checkStockNotifications(it.id,stockData[it.id]?.name||it.name);}});
    saveStockToStorage();
    refreshAllCardStock();

    // 2. Save order to local orders[]
    const order={
        id:orderSeq++,customer,persons:Number(persons),orderType,
        payment:payment==="ewallet"?ewalletProvider:payment,
        items:orderItems,sub,tax,total,time:new Date().toISOString()
    };
    orders.unshift(order);

    // 3. Save sale + deduct stock in MySQL DB
    const payload = {
      customer:  customer || 'Guest',
      cashier:   sessionStorage.getItem('triad_staff_name') || sessionStorage.getItem('triad_username') || 'Staff',
      orderType: orderType || 'dine-in',
      payment:   payment === 'ewallet' ? ewalletProvider : payment,
      persons:   Number(persons) || 1,
      subtotal:  sub   || 0,
      tax:       tax   || 0,
      total:     total || 0,
      items: orderItems.map(i => ({
        id:       i.id       || 0,
        name:     i.name     || '',
        category: i.category || stockData[String(i.id)]?.category || '',
        type:     i.type     || stockData[String(i.id)]?.type     || 'manual',
        qty:      i.qty      || 1,
        price:    i.price    || 0
      }))
    };
    try {
      const res  = await fetch('../api/sales.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'save', order: payload })
      });
      const data = await res.json();
      if (data.success) {
        console.log('[TriadDB] Sale saved & stock deducted — DB id: ' + data.sale_id);
      } else {
        console.warn('[TriadDB] Sale save failed:', data.message);
      }
    } catch(e) {
      console.warn('[TriadDB] Could not save sale (is XAMPP running?):', e.message);
    }

    // 4. Print
    printReceipt();

    // 5. Clear and Reset
    cart.clear();
    cards.forEach(c => {
      c.classList.remove("in-cart");
      const q = c.querySelector("[data-card-qty]");
      if (q) q.textContent = "1";
    });
    custName.value = ""; setPersons(1); $$(".type-btn")[0].click();
    payBtns.forEach(b => b.classList.remove("active")); payBtns[0].classList.add("active"); currentPayment = "cash";
    renderCart();
    showToast(`Order #${order.id} complete! ✓`);
    
    // Close modal
    payModal.classList.remove("open");
  });
}

/* Print receipt */
window.printReceipt=()=>{
  const rc=$("#receiptContent");if(!rc)return;
  const printWin=window.open("","_blank","width=400,height=600");
  if(!printWin)return;
  printWin.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet"/>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Courier New',monospace;font-size:12px;padding:20px;background:#fff;color:#000;}
      .r-logo{font-family:'Playfair Display',serif;font-size:20px;font-weight:800;color:#c8501a;text-align:center;margin-bottom:4px;}
      .r-row{display:flex;justify-content:space-between;margin:2px 0;}
      .r-bold{display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:4px 0;}
      .r-paid{color:#1a9e5c;font-weight:700;text-align:center;margin-top:6px;}
      hr{border:none;border-top:1px dashed #ccc;margin:8px 0;}
      p{text-align:center;}
    </style></head><body>
    ${rc.innerHTML}
    </body></html>`);
  printWin.document.close();
  printWin.focus();
  setTimeout(()=>{printWin.print();printWin.close();},300);
};

$("#closeModal")?.addEventListener("click",()=>payModal.classList.remove("open"));
payModal.addEventListener("click",e=>{if(e.target===payModal)payModal.classList.remove("open");});

/* ═══════════════════════════════════
   DASHBOARD
═══════════════════════════════════ */
function renderDashboard(){
  if(!orders.length){
    $("#kpiRevenue").textContent="₱0.00";$("#kpiRevSub").textContent="0 orders";
    $("#kpiOrders").textContent="0";$("#kpiOrdersSub").textContent="Avg ₱0.00 / order";
    $("#kpiCustomers").textContent="0";$("#kpiCustomersSub").textContent="0 dine-in · 0 takeout";
    $("#kpiItems").textContent="0";$("#kpiItemsSub").textContent="Top: —";
    renderPaymentMix({});renderRecentOrders([]);return;
  }
  const totalRev=orders.reduce((s,o)=>s+o.total,0);
  const avgOrder=totalRev/orders.length;
  const totalPersons=orders.reduce((s,o)=>s+o.persons,0);
  const dineIn=orders.filter(o=>o.orderType==="dine-in").length;
  const takeout=orders.filter(o=>o.orderType==="takeout").length;
  const totalItems=orders.reduce((s,o)=>s+o.items.reduce((a,i)=>a+i.qty,0),0);
  const itemMap=new Map();
  orders.forEach(o=>o.items.forEach(it=>{const ex=itemMap.get(it.name)||{qty:0};ex.qty+=it.qty;itemMap.set(it.name,ex);}));
  const topItem=[...itemMap.entries()].sort((a,b)=>b[1].qty-a[1].qty)[0];
  $("#kpiRevenue").textContent=php(totalRev);
  $("#kpiRevSub").textContent=`${orders.length} order${orders.length!==1?"s":""}`;
  $("#kpiOrders").textContent=orders.length;
  $("#kpiOrdersSub").textContent=`Avg ${php(avgOrder)} / order`;
  $("#kpiCustomers").textContent=totalPersons;
  $("#kpiCustomersSub").textContent=`${dineIn} dine-in · ${takeout} takeout`;
  $("#kpiItems").textContent=totalItems;
  $("#kpiItemsSub").textContent=`Top: ${topItem?topItem[0]:"—"}`;
  $("#otDineCount").textContent=dineIn;$("#otTakeCount").textContent=takeout;
  const payMap={};orders.forEach(o=>{const k=["paymaya","gcash"].includes(o.payment)?"ewallet":o.payment;payMap[k]=(payMap[k]||0)+1;});
  renderPaymentMix(payMap);
  renderRecentOrders(orders.slice(0,5));
}
function renderPaymentMix(payMap){
  const total=Object.values(payMap).reduce((s,v)=>s+v,0)||1;
  const pct=k=>Math.round((payMap[k]||0)/total*100);
  $("#pmCash").style.width=pct("cash")+"%";$("#pmCashPct").textContent=pct("cash")+"%";
  $("#pmEwallet").style.width=pct("ewallet")+"%";$("#pmEwalletPct").textContent=pct("ewallet")+"%";
}
function renderRecentOrders(list){
  const el=$("#recentOrdersEl");if(!el)return;
  if(!list.length){el.innerHTML=`<div style="text-align:center;padding:24px 0;color:var(--muted);font-size:13px;">No orders yet.</div>`;return;}
  el.innerHTML=list.map(o=>`
    <div class="order-history-item">
      <div class="order-num">#${o.id}</div>
      <div class="order-history-info">
        <div class="order-history-name">${o.customer}</div>
        <div class="order-history-meta">${timeStr(o.time)} · ${o.items.length} item${o.items.length!==1?"s":""} · ${o.payment.toUpperCase()}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="order-badge ${o.orderType==="dine-in"?"badge-dine":"badge-take"}">${o.orderType==="dine-in"?"🍽️":"🥡"} ${o.orderType}</span>
        <div class="order-history-total">${php(o.total)}</div>
      </div>
    </div>`).join("");
}

/* ═══════════════════════════════════
   CUSTOM CONFIRM MODAL LOGIC
═══════════════════════════════════ */
const customConfirmModal=$("#customConfirmModal");
const confirmOkBtn=$("#confirmOkBtn");
const confirmCancelBtn=$("#confirmCancelBtn");
let _confirmCallback=null;

function openConfirm({icon,iconClass,title,desc,details,okLabel,okClass,onConfirm}){
  $("#confirmModalIcon").textContent=icon;
  $("#confirmModalIcon").className=`confirm-modal-icon ${iconClass}`;
  $("#confirmModalTitle").textContent=title;
  $("#confirmModalDesc").textContent=desc;
  const detEl=$("#confirmModalDetails");
  if(details&&details.length){
    detEl.style.display="";
    detEl.innerHTML=details.map(d=>`<div class="det-row"><span class="det-label">${d.label}</span><span class="det-val">${d.val}</span></div>`).join("");
  }else{detEl.style.display="none";}
  confirmOkBtn.textContent=okLabel;
  confirmOkBtn.className=`confirm-ok-btn ${okClass}`;
  _confirmCallback=onConfirm;
  customConfirmModal.classList.add("open");
}
confirmCancelBtn.addEventListener("click",()=>{customConfirmModal.classList.remove("open");_confirmCallback=null;});
customConfirmModal.addEventListener("click",e=>{if(e.target===customConfirmModal){customConfirmModal.classList.remove("open");_confirmCallback=null;}});
confirmOkBtn.addEventListener("click",()=>{
  customConfirmModal.classList.remove("open");
  if(_confirmCallback)_confirmCallback();
  _confirmCallback=null;
});

/* ═══════════════════════════════════
   ORDERS PAGE — categorized by product type
═══════════════════════════════════ */
function renderOrdersPage(){
  const filterVal=$("#orderFilter")?.value||"all";
  const catFilterVal=$("#orderCatFilter")?.value||"all";
  const dateFilterVal=$("#orderDateFilter")?.value||""; // YYYY-MM-DD
  let filtered=filterVal==="all"?orders:orders.filter(o=>o.orderType===filterVal);
  if(dateFilterVal){
    filtered=filtered.filter(o=>{
      const d=new Date(o.time);
      const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`===dateFilterVal;
    });
  }
  const el=$("#ordersListEl");if(!el)return;
  if(!filtered.length){
    el.innerHTML=`<div class="placeholder-page" style="margin-top:0;"><div style="font-size:36px;margin-bottom:10px;">🧾</div><h3>No orders yet</h3><p>Completed orders will appear here.</p></div>`;return;
  }

  // Build catMap: category → list of {order, items in that category}
  const catMap={};
  filtered.forEach(order=>{
    order.items.forEach(item=>{
      const card=$(`[data-id="${item.id}"]`);
      const cat=item.category||card?.dataset.category||"other";
      // If a category filter is active, only include that category
      if(catFilterVal!=="all"&&cat!==catFilterVal)return;
      if(!catMap[cat])catMap[cat]=[];
      catMap[cat].push({order,item});
    });
  });

  if(!Object.keys(catMap).length){
    el.innerHTML=`<div class="placeholder-page" style="margin-top:0;"><div style="font-size:36px;margin-bottom:10px;">🧾</div><h3>No orders in this category</h3><p>Try a different filter.</p></div>`;return;
  }

  const catOrder=["hot-coffee","iced-coffee","espresso","frappe","tea","pastries","beans","other"];
  let html="";

  catOrder.forEach(cat=>{
    if(!catMap[cat])return;
    const entries=catMap[cat];
    const catLabel=CATEGORIES[cat]||"📦 Other";
    const totalQty=entries.reduce((s,e)=>s+e.item.qty,0);

    const seenOrderIds=new Set();
    const ordersInCat=[];
    entries.forEach(e=>{
      if(!seenOrderIds.has(e.order.id)){seenOrderIds.add(e.order.id);ordersInCat.push(e.order);}
    });

    html+=`<div class="orders-cat-section">
      <div class="orders-cat-title">${catLabel} <span class="orders-cat-badge">${totalQty} sold · ${ordersInCat.length} order${ordersInCat.length!==1?"s":""}</span></div>
      <div style="display:flex;flex-direction:column;gap:10px;">`;

    ordersInCat.forEach(o=>{
      const catItems=o.items.filter(it=>{
        const c=$(`[data-id="${it.id}"]`);return(c?.dataset.category||"other")===cat;
      });
      const itemsList=catItems.map(i=>`${i.name} ×${i.qty}`).join(", ");
      const orderIdx=orders.findIndex(x=>x.id===o.id);
      html+=`<div class="dash-card" style="padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="order-num" style="width:32px;height:32px;font-size:11px;">#${o.id}</div>
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text);">${o.customer}</div>
              <div style="font-size:11px;color:var(--muted);">${timeStr(o.time)} · ${o.persons} pax</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="order-badge ${o.orderType==="dine-in"?"badge-dine":"badge-take"}">${o.orderType==="dine-in"?"🍽️":"🥡"} ${o.orderType}</span>
            <span style="font-size:12px;color:var(--muted);">${o.payment.toUpperCase()}</span>
            <strong style="color:var(--green);font-size:15px;">${php(o.total)}</strong>
            <button class="archive-single-btn" onclick="archiveSingleOrder(${orderIdx})" title="Archive this order">📦</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);padding-top:8px;border-top:1px solid var(--line);">${itemsList}</div>
      </div>`;
    });

    html+=`</div></div>`;
  });

  el.innerHTML=html;
}

window.archiveSingleOrder=(idx)=>{
  const order=orders[idx];if(!order)return;
  orders.splice(idx,1);
  archive.unshift(order);
  renderOrdersPage();
  renderDashboard();
  showToast(`Order #${order.id} archived 📦`);
};
$("#orderFilter")?.addEventListener("change",renderOrdersPage);
$("#orderCatFilter")?.addEventListener("change",renderOrdersPage);
$("#orderDateFilter")?.addEventListener("change",renderOrdersPage);
$("#clearOrderDateBtn")?.addEventListener("click",()=>{const el=$("#orderDateFilter");if(el){el.value="";renderOrdersPage();}});
$("#clearOrdersBtn")?.addEventListener("click",()=>{
  if(!orders.length)return;
  const catFilterVal=$("#orderCatFilter")?.value||"all";
  const orderTypeFilter=$("#orderFilter")?.value||"all";

  // Determine which orders match the current filters
  const toArchive=orders.filter(o=>{
    const matchType=orderTypeFilter==="all"||o.orderType===orderTypeFilter;
    const matchCat=catFilterVal==="all"||o.items.some(it=>{
      const c=$(`[data-id="${it.id}"]`);return(c?.dataset.category||"other")===catFilterVal;
    });
    return matchType&&matchCat;
  });

  if(!toArchive.length)return;

  const catLabel=catFilterVal==="all"?"All":({
    "hot-coffee":"☕ Hot Coffee","iced-coffee":"🧊 Iced Coffee","espresso":"⚡ Espresso",
    "frappe":"🥤 Frappe","tea":"🍵 Tea","pastries":"🥐 Pastries","beans":"🫘 Beans"
  }[catFilterVal]||catFilterVal);

  const totalRev=toArchive.reduce((s,o)=>s+o.total,0);
  openConfirm({
    icon:"📦",
    iconClass:"archive-icon",
    title:catFilterVal==="all"?"Archive All Orders?":`Archive ${catLabel} Orders?`,
    desc:catFilterVal==="all"
      ?"All current orders will be moved to the Archive."
      :`Only orders containing ${catLabel} items will be archived.`,
    details:[
      {label:"Orders to Archive",val:`${toArchive.length} order${toArchive.length!==1?"s":""}`},
      {label:"Revenue",val:php(totalRev)},
      ...(catFilterVal!=="all"?[{label:"Category",val:catLabel}]:[]),
    ],
    okLabel:"📦 Archive",
    okClass:"archive",
    onConfirm:()=>{
      const archiveIds=new Set(toArchive.map(o=>o.id));
      archive.unshift(...toArchive);
      orders=orders.filter(o=>!archiveIds.has(o.id));
      if(!orders.length)orderSeq=1;
      renderOrdersPage();
      showToast(`${toArchive.length} order${toArchive.length!==1?"s":""} archived ✓`);
    }
  });
});

/* ═══════════════════════════════════
   ARCHIVE — categorized by product type
═══════════════════════════════════ */
function renderArchive(){
  const el=$("#archiveListEl");if(!el)return;
  const catFilterVal=$("#archiveCatFilter")?.value||"all";
  const dateFilterVal=$("#archiveDateFilter")?.value||"";
  let archiveFiltered=archive;
  if(dateFilterVal){
    archiveFiltered=archive.filter(o=>{
      const d=o.time;
      const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`===dateFilterVal;
    });
  }
  if(!archiveFiltered.length){
    el.innerHTML=`<div class="placeholder-page"><div style="font-size:36px;margin-bottom:10px;">📦</div><h3>No archived orders${dateFilterVal?" on this date":""}</h3><p>${dateFilterVal?"Try a different date.":"Cleared orders will appear here."}</p></div>`;return;
  }
  // Build category → items sold map
  const catMap={};
  archiveFiltered.forEach(order=>{
    order.items.forEach(item=>{
      const card=$(`[data-id="${item.id}"]`);
      const cat=item.category||card?.dataset.category||"other";
      if(catFilterVal!=="all"&&cat!==catFilterVal)return;
      if(!catMap[cat])catMap[cat]=[];
      catMap[cat].push({order,item});
    });
  });

  if(!Object.keys(catMap).length){
    el.innerHTML=`<div class="placeholder-page"><div style="font-size:36px;margin-bottom:10px;">📦</div><h3>No archived orders in this category</h3><p>Try a different filter.</p></div>`;return;
  }

  const catOrder=["hot-coffee","iced-coffee","espresso","frappe","tea","pastries","beans","other"];
  let html="";
  catOrder.forEach(cat=>{
    if(!catMap[cat])return;
    const entries=catMap[cat];
    const catLabel=CATEGORIES[cat]||"📦 Other";
    const orderIds=[...new Set(entries.map(e=>e.order.id))];
    html+=`<div class="archive-category-section">
      <div class="archive-category-title">
        ${catLabel}
        <span class="archive-category-badge">${entries.reduce((s,e)=>s+e.item.qty,0)} sold</span>
      </div>`;
    const shownOrders=new Set();
    orderIds.forEach(oid=>{
      if(shownOrders.has(oid))return;
      shownOrders.add(oid);
      const order=archive.find(o=>o.id===oid);
      if(!order)return;
      const catItems=order.items.filter(it=>{
        const card=$(`[data-id="${it.id}"]`);return(card?.dataset.category||"other")===cat;
      });
      if(!catItems.length)return;
      const archiveIdx=archive.findIndex(o=>o.id===oid);
      html+=`<div class="archive-card">
        <div class="archive-header">
          <span class="archive-id">Order #${order.id}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="archive-date">${dateStr(order.time)} ${timeStr(order.time)}</span>
            <button class="restore-btn" onclick="restoreOrder(${archiveIdx})">↩ Restore</button>
          </div>
        </div>
        <div class="archive-body">
          <strong style="color:var(--text)">${order.customer}</strong>
          <span class="order-badge ${order.orderType==="dine-in"?"badge-dine":"badge-take"}">${order.orderType}</span>
          <strong style="color:var(--green)">${php(order.total)}</strong>
        </div>
        <div class="archive-items-list">${catItems.map(it=>`${it.name} ×${it.qty}`).join(" · ")}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  el.innerHTML=html;
}

window.restoreOrder=idx=>{
  const order=archive[idx];if(!order)return;
  archive.splice(idx,1);
  orders.unshift(order);
  renderArchive();
  showToast(`Order #${order.id} restored ✓`);
};

$("#archiveCatFilter")?.addEventListener("change",renderArchive);
$("#archiveDateFilter")?.addEventListener("change",renderArchive);
$("#clearArchiveDateBtn")?.addEventListener("click",()=>{const el=$("#archiveDateFilter");if(el){el.value="";renderArchive();}});

$("#clearArchiveBtn")?.addEventListener("click",()=>{
  if(!archive.length)return;
  const catFilterVal=$("#archiveCatFilter")?.value||"all";

  // Determine which archived orders match the filter
  const toRestore=archive.filter(o=>{
    if(catFilterVal==="all")return true;
    return o.items.some(it=>{
      const c=$(`[data-id="${it.id}"]`);return(c?.dataset.category||"other")===catFilterVal;
    });
  });

  if(!toRestore.length)return;

  const catLabel=catFilterVal==="all"?"All":({
    "hot-coffee":"☕ Hot Coffee","iced-coffee":"🧊 Iced Coffee","espresso":"⚡ Espresso",
    "frappe":"🥤 Frappe","tea":"🍵 Tea","pastries":"🥐 Pastries","beans":"🫘 Beans"
  }[catFilterVal]||catFilterVal);

  openConfirm({
    icon:"↩️",
    iconClass:"archive-icon",
    title:catFilterVal==="all"?"Restore All Archived Orders?":`Restore ${catLabel} Orders?`,
    desc:catFilterVal==="all"
      ?"All archived orders will be moved back to the Orders list."
      :`Only archived orders containing ${catLabel} items will be restored.`,
    details:[
      {label:"Orders to Restore",val:`${toRestore.length} order${toRestore.length!==1?"s":""}`},
      ...(catFilterVal!=="all"?[{label:"Category",val:catLabel}]:[]),
    ],
    okLabel:"↩ Restore",
    okClass:"archive",
    onConfirm:()=>{
      const restoreIds=new Set(toRestore.map(o=>o.id));
      orders.unshift(...toRestore);
      archive=archive.filter(o=>!restoreIds.has(o.id));
      renderArchive();
      renderOrdersPage();
      showToast(`${toRestore.length} order${toRestore.length!==1?"s":""} restored ✓`);
    }
  });
});

/* ═══════════════════════════════════
   PROFILE MODAL
═══════════════════════════════════ */
const AVATARS=['🧑‍💼','👨‍💼','👩‍💼','🧑‍🍳','👨‍🍳','👩‍🍳','🧑','👦','👧','👴','👵','🧔'];
let selectedAvatar=localStorage.getItem('triad_avatar')||'🧑‍💼';

const staffChip=$("#staffChip");
const profileModal=$("#profileModal");

function openProfile(){
  const ordersToday=orders.length;
  const revToday=orders.reduce((s,o)=>s+o.total,0);
  const archiveCount=archive.length;
  const isOwner=currentMode==='owner';
  const avatarDisplay=selectedAvatar||'🧑‍💼';

  // Build avatar grid
  const avatarGridHtml=AVATARS.map(a=>`
    <button class="avatar-opt${a===selectedAvatar?' selected':''}" data-avatar="${a}" title="${a}">${a}</button>
  `).join('');

  $("#profileModalContent").innerHTML=`
    <div class="profile-header">
      <div class="profile-avatar-lg" id="profileAvatarBtn" title="Change avatar">${avatarDisplay}</div>
      <div class="profile-avatar-edit-hint">Tap to change avatar</div>
      <h2>${isOwner?'Triad Owner':'Triad Staff'}</h2>
      <p>${isOwner?'Owner · Main Branch':'Cashier · Main Branch'}</p>
    </div>
    <div class="avatar-chooser" id="avatarChooser">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="avatar-chooser-title">Choose Your Avatar</span>
        <button class="avatar-chooser-close" id="avatarChooserClose">✕</button>
      </div>
      <div style="text-align:center;">
        <div class="avatar-current" id="avatarPreview">${avatarDisplay}</div>
        <div class="avatar-role-badge">${isOwner?'OWNER':'STAFF'}</div>
      </div>
      <div class="avatar-grid" id="avatarGrid">${avatarGridHtml}</div>
    </div>
    <div class="profile-body">
      <div class="profile-stats">
        <div class="profile-stat"><div class="profile-stat-val">${ordersToday}</div><div class="profile-stat-label">Orders Today</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${php(revToday)}</div><div class="profile-stat-label">Revenue</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${orders.filter(o=>o.orderType==="dine-in").length}</div><div class="profile-stat-label">Dine-In</div></div>
        <div class="profile-stat"><div class="profile-stat-val">${archiveCount}</div><div class="profile-stat-label">Archived</div></div>
      </div>
      <div class="profile-info-row"><span class="profile-info-label">Account</span><span class="profile-info-val">${isOwner?'Owner':'Staff'}</span></div>
      <div class="profile-info-row"><span class="profile-info-label">Branch</span><span class="profile-info-val">Main Branch</span></div>
      <div class="profile-info-row"><span class="profile-info-label">Shift</span><span class="profile-info-val">Morning 8:00 AM – 4:00 PM</span></div>
      <div class="profile-info-row"><span class="profile-info-label">Started</span><span class="profile-info-val">January 2025</span></div>
      <div class="profile-info-row" style="border-bottom:none;"><span class="profile-info-label">Keyboard</span><span class="profile-info-val" style="font-size:11px;">Alt+1-4 nav · Alt+H sidebar · Esc close</span></div>
    </div>
    <div class="profile-logout-footer">
      <button class="logout-btn-full" onclick="handleLogout()">🔒 Log Out</button>
    </div>`;

  profileModal.classList.add("open");

  // Avatar chooser toggle
  document.getElementById("profileAvatarBtn")?.addEventListener("click",()=>{
    document.getElementById("avatarChooser")?.classList.toggle("open");
  });
  document.getElementById("avatarChooserClose")?.addEventListener("click",()=>{
    document.getElementById("avatarChooser")?.classList.remove("open");
  });

  // Avatar selection
  document.getElementById("avatarGrid")?.addEventListener("click",e=>{
    const btn=e.target.closest(".avatar-opt");if(!btn)return;
    const a=btn.dataset.avatar;if(!a)return;
    selectedAvatar=a;
    localStorage.setItem('triad_avatar',a);
    // Update all UI
    document.querySelectorAll(".avatar-opt").forEach(b=>b.classList.toggle("selected",b.dataset.avatar===a));
    const preview=document.getElementById("avatarPreview");
    if(preview)preview.textContent=a;
    const headerAvatar=document.getElementById("profileAvatarBtn");
    if(headerAvatar)headerAvatar.textContent=a;
    // Update sidebar avatar
    updateSidebarAvatar();
  });
}

window.promptSwitchMode=()=>{
  if(currentMode==='owner'){
    profileModal.classList.remove("open");
    openConfirm({
      icon:"👤",
      title:"Switch to Staff Mode?",
      desc:"You'll switch from Owner to Staff. Stock changes made in owner mode are saved.",
      okLabel:"Switch",
      onConfirm:()=>{setMode('staff');refreshAllCardStock();showToast('Switched to Staff mode');}
    });
  } else {
    profileModal.classList.remove("open");
    const pinInput=prompt('Enter Owner PIN to switch to Owner Mode:');
    if(pinInput==='1234'){
      setMode('owner');
      refreshAllCardStock();
      showToast('Switched to Owner mode 👑');
    } else if(pinInput!==null){
      showToast('Incorrect PIN');
    }
  }
};

function updateSidebarAvatar(){
  const el=document.getElementById("sidebarAvatarCircle");
  if(!el)return;
  const a=selectedAvatar||'🧑‍💼';
  el.textContent=a;
  el.style.fontSize='18px';
  el.style.background='transparent';
}
// Init sidebar avatar on load
updateSidebarAvatar();
staffChip.addEventListener("click",openProfile);
staffChip.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")openProfile();});
profileModal.addEventListener("click",e=>{if(e.target===profileModal)profileModal.classList.remove("open");});

window.handleLogout=()=>{
  profileModal.classList.remove("open");
  openConfirm({
    icon:"🔒",
    iconClass:"danger-icon",
    title:"Log Out?",
    desc:"You'll be signed out of this POS session. Any unsaved changes may be lost.",
    details:[
      {label:"Staff",val:"Triad Staff"},
      {label:"Role",val:"Cashier"},
      {label:"Session",val:"Active"},
    ],
    okLabel:"🔒 Log Out",
    okClass:"danger",
    onConfirm:()=>{
      window.location.href = "../Login/triad.html";
      showToast("Logged out successfully.");
    }
  });
};

/* ═══════════════════════════════════
   APPEARANCE
═══════════════════════════════════ */
const appearanceBtn=$("#appearanceBtn");
const appearanceModal=$("#appearanceModal");
// appearanceBtn listener and outside-click handler now handled below in appearance section

/* ═══════════════════════════════════
   APPEARANCE — live preview + save on Done
   Settings stored in localStorage so they
   survive page refresh / reopening the file.
═══════════════════════════════════ */

// Pending (unsaved) state while modal is open
let _pendingTheme  = null;
let _pendingAccent = null;
let _pendingBri    = null;
let _pendingCon    = null;

// ── helpers ──
const hex2rgba=(h,a)=>{
  const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
};

function _applyThemeNow(theme){
  document.body.removeAttribute("data-theme");
  if(theme&&theme!=="default") document.body.setAttribute("data-theme",theme);
}
function _applyAccentNow(color){
  document.documentElement.style.setProperty("--primary",color);
  document.documentElement.style.setProperty("--primary-light",hex2rgba(color,.15));
  document.documentElement.style.setProperty("--primary-mid",hex2rgba(color,.3));
}
function _applyFiltersNow(b,c){
  document.body.style.filter=`brightness(${b}%) contrast(${c}%)`;
}

// ── Load saved settings on startup ──
(function loadSavedAppearance(){
  const saved = JSON.parse(localStorage.getItem("triad_appearance")||"{}");
  const theme  = saved.theme  || "dark";
  const accent = saved.accent || "#c8501a";
  const bri    = saved.bri    || 100;
  const con    = saved.con    || 100;

  _applyThemeNow(theme);
  _applyAccentNow(accent);
  _applyFiltersNow(bri, con);

  // mark correct swatch active
  $$(".theme-swatch").forEach(s=>s.classList.remove("active"));
  const activeSwatch=document.querySelector(`.theme-swatch[data-theme="${theme}"]`);
  if(activeSwatch) activeSwatch.classList.add("active");

  // mark correct accent dot
  $$(".accent-dot").forEach(d=>{
    d.classList.toggle("active", d.style.background===accent||d.style.backgroundColor===accent);
  });

  // restore sliders
  const bSlider=document.getElementById("brightnessSlider");
  const cSlider=document.getElementById("contrastSlider");
  if(bSlider) bSlider.value=bri;
  if(cSlider) cSlider.value=con;
  const bVal=document.getElementById("brightnessVal");
  const cVal=document.getElementById("contrastVal");
  if(bVal) bVal.textContent=bri+"%";
  if(cVal) cVal.textContent=con+"%";
  const picker=document.getElementById("accentColorPicker");
  if(picker) picker.value=accent;
})();

// ── When modal OPENS: snapshot current saved state as pending ──
appearanceBtn.addEventListener("click",()=>{
  const saved=JSON.parse(localStorage.getItem("triad_appearance")||"{}");
  _pendingTheme  = saved.theme  || "dark";
  _pendingAccent = saved.accent || "#c8501a";
  _pendingBri    = saved.bri    || 100;
  _pendingCon    = saved.con    || 100;
  appearanceModal.classList.add("open");
});

// ── Live preview (no save yet) ──
window.applyTheme=(theme,el)=>{
  _pendingTheme=theme;
  _applyThemeNow(theme);
  $$(".theme-swatch").forEach(s=>s.classList.remove("active"));
  el?.classList.add("active");
};

window.applyFilters=()=>{
  const b=document.getElementById("brightnessSlider")?.value||100;
  const c=document.getElementById("contrastSlider")?.value||100;
  _pendingBri=Number(b); _pendingCon=Number(c);
  document.getElementById("brightnessVal").textContent=b+"%";
  document.getElementById("contrastVal").textContent=c+"%";
  _applyFiltersNow(b,c);
};

window.applyAccent=(color,dotEl)=>{
  _pendingAccent=color;
  _applyAccentNow(color);
  document.getElementById("accentColorPicker").value=color;
  $$(".accent-dot").forEach(d=>d.classList.remove("active"));
  dotEl?.classList.add("active");
};

// ── Save on Done ──
window.saveAppearance=()=>{
  const toSave={
    theme  : _pendingTheme  || "dark",
    accent : _pendingAccent || "#c8501a",
    bri    : _pendingBri    || 100,
    con    : _pendingCon    || 100,
  };
  localStorage.setItem("triad_appearance", JSON.stringify(toSave));
  appearanceModal.classList.remove("open");
  showToast("Appearance saved ✓");
};

// ── Cancel (X or click outside) → revert to saved ──
function revertAppearance(){
  const saved=JSON.parse(localStorage.getItem("triad_appearance")||"{}");
  const theme  = saved.theme  || "dark";
  const accent = saved.accent || "#c8501a";
  const bri    = saved.bri    || 100;
  const con    = saved.con    || 100;
  _applyThemeNow(theme);
  _applyAccentNow(accent);
  _applyFiltersNow(bri,con);
  $$(".theme-swatch").forEach(s=>s.classList.remove("active"));
  const sw=document.querySelector(`.theme-swatch[data-theme="${theme}"]`);
  if(sw) sw.classList.add("active");
  $$(".accent-dot").forEach(d=>{
    d.classList.toggle("active", d.style.background===accent);
  });
  const bSlider=document.getElementById("brightnessSlider");
  const cSlider=document.getElementById("contrastSlider");
  if(bSlider){bSlider.value=bri;document.getElementById("brightnessVal").textContent=bri+"%";}
  if(cSlider){cSlider.value=con;document.getElementById("contrastVal").textContent=con+"%";}
  appearanceModal.classList.remove("open");
}
window.revertAppearance=revertAppearance;
window.saveAppearance=saveAppearance;
appearanceModal.addEventListener("click",e=>{if(e.target===appearanceModal)revertAppearance();});

/* ═══════════════════════════════════
   TOAST
═══════════════════════════════════ */
let toastTimer;
function showToast(msg){
  toast.textContent=msg;toast.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),2500);
}

/* ═══════════════════════════════════
   INIT
═══════════════════════════════════ */
refreshAllCardStock();

// Close availability menus on scroll of content area
document.querySelector('.content')?.addEventListener('scroll', closeAllAvailMenus, {passive:true});

// Set max date to today for both date pickers (no future dates allowed)
(function setDatePickerMaxToToday(){
  const t=new Date();
  const y=t.getFullYear();
  const m=String(t.getMonth()+1).padStart(2,"0");
  const d=String(t.getDate()).padStart(2,"0");
  const todayStr=`${y}-${m}-${d}`;
  const orderD=document.getElementById("orderDateFilter");
  const archiveD=document.getElementById("archiveDateFilter");
  if(orderD){orderD.max=todayStr;orderD.value="";}
  if(archiveD){archiveD.max=todayStr;archiveD.value="";}
  // Also prevent typing future dates manually
  [orderD,archiveD].forEach(el=>{
    if(!el)return;
    el.addEventListener("change",function(){
      if(this.value>todayStr){
        this.value=todayStr;
        showToast("Cannot select a future date.");
      }
    });
  });
})();

/* ═══════════════════════════════════════════════════════
   MYSQL DATABASE INTEGRATION — Staff POS & Owner Sync
   - Saves every completed transaction to MySQL.
   - Loads real-time menu, prices, and stock from MySQL on startup.
═══════════════════════════════════════════════════════ */


/* ── Category emoji map for card images ── */
/* ── Real product images from assets/assets/image/ ── */
const PRODUCT_IMG = {
  'caramel latte':         '../assets/assets/image/CaramelLatte.png',
  'americano':             '../assets/assets/image/americano.jpeg',
  'cappuccino':            '../assets/assets/image/Cappuccino.jpeg',
  'mocha latte':           '../assets/assets/image/mochaLatte.jpg',
  'matcha latte':          '../assets/assets/image/matchaLatte.jpg',
  'golden turmeric latte': '../assets/assets/image/Golden Turmeric Latte.jpg',
  'iced latte':            '../assets/assets/image/icedLatte.jpg',
  'vanilla cold brew':     '../assets/assets/image/vanila cold brew.jpg',
  'single espresso':       '../assets/assets/image/singleEspresso.jpg',
  'double espresso':       '../assets/assets/image/doubleEspresso.jpg',
  'mocha frappe':          '../assets/assets/image/mochaLatte.jpg',
  'caramel frappe':        '../assets/assets/image/caramelFrappe.jpg',
  'matcha latte (iced)':   '../assets/assets/image/matchaLatte(iced).jpg',
  'classic black tea':     '../assets/assets/image/classic blackTea.jpg',
  'butter croissant':      '../assets/assets/image/Butter Croissant.jpg',
  'chocolate muffin':      '../assets/assets/image/ChocolateMuffin.jpg',
  'darkfruit blend 250g':  '../assets/assets/image/DarkFruitblend.jpg',
  'mono blend 250g':       '../assets/assets/image/monoblend.jpg',
  'espresso beans 250g':   '../assets/assets/image/Espresso Beans.jpg',
  'house blend 250g':      '../assets/assets/image/HouseBlend.jpg',
};

const CAT_FALLBACK_IMG = {
  'hot-coffee':  '../assets/assets/image/CaramelLatte.png',
  'iced-coffee': '../assets/assets/image/icedLatte.jpg',
  'espresso':    '../assets/assets/image/singleEspresso.jpg',
  'frappe':      '../assets/assets/image/caramelFrappe.jpg',
  'tea':         '../assets/assets/image/classic blackTea.jpg',
  'pastries':    '../assets/assets/image/Butter Croissant.jpg',
  'beans':       '../assets/assets/image/DarkFruitblend.jpg',
};

function _menuCardImgURI(category, name) {
  const key = (name || '').toLowerCase().trim();
  return PRODUCT_IMG[key] || CAT_FALLBACK_IMG[category] || '../assets/assets/image/CaramelLatte.png';
}

/* ── Build a single card DOM element from a DB menu item ── */
function buildMenuCard(item) {
  const id    = String(item.id);
  const name  = item.name;
  const price = parseFloat(item.price);
  const cat   = item.category;
  const desc  = item.description || '';

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id       = id;
  card.dataset.name     = name;
  card.dataset.price    = price;
  card.dataset.category = cat;

  const img = document.createElement('img');
  img.src    = item.image_path ? item.image_path : _menuCardImgURI(cat, name);
  img.alt    = name;
  img.loading = 'lazy';
  card.appendChild(img);

  card.insertAdjacentHTML('beforeend', `
    <div class="card-body">
      <h4>${name}</h4>
      ${desc ? `<p>${desc}</p>` : ''}
      <div class="card-foot">
        <span class="price pill" data-action="add-to-cart">₱${price.toFixed(2)}</span>
        <div class="card-qty-ctrl">
          <button class="card-qty-btn" data-action="card-decrease">−</button>
          <span class="card-qty-num">0</span>
          <button class="card-qty-btn" data-action="card-increase">＋</button>
        </div>
      </div>
    </div>`);

  return card;
}

/* ── Load ALL menu data (incl. prices & stock) from MySQL on startup ──
   This fully rebuilds the menu grid to match the owner's menu panel.
   Items added, removed, or renamed in the owner panel will sync here. ── */
(async function syncMenuAndStockFromDB() {
  try {
    const res  = await fetch('../api/menu.php?action=list');
    const data = await res.json();

    if (!data.success || !data.data || !data.data.length) {
      console.warn('[TriadDB] Could not sync menu from DB. Using local data as fallback.');
      loadStockFromStorage();
      refreshAllCardStock();
      return;
    }

    /* ── 1. Rebuild the menu grid entirely from DB items ── */
    menuGrid.innerHTML = '';
    // Clear stale stockData so we start fresh
    Object.keys(stockData).forEach(k => delete stockData[k]);

    data.data.forEach(item => {
      // Skip items marked unavailable by the owner — don't show them at all
      // (They can still be toggled back from the owner panel)
      const id   = String(item.id);
      const type = item.type === 'stock' ? 'stock' : 'manual';
      const qty  = parseInt(item.qty);
      const avail = item.available === true || item.available === 1 || item.available === '1';

      // Populate stockData for this item
      stockData[id] = {
        name:     item.name,
        category: item.category,
        type,
        stock:    qty,
        status:   type === 'stock'
          ? (qty <= 0 ? 'out' : (avail ? 'available' : 'unavailable'))
          : (avail ? 'available' : 'unavailable')
      };

      // Build and append the card
      const card = buildMenuCard(item);
      menuGrid.appendChild(card);
    });

    /* ── 2. Re-wire cards reference (used throughout staff.js) ── */
    // `cards` was originally a const from DOM — now we update the live NodeList via re-query
    // All code that uses `cards` iterates it, so patching the array reference works.
    const liveCards = [...menuGrid.querySelectorAll('[data-id]')];
    // Replace contents of the cards array in-place
    cards.length = 0;
    liveCards.forEach(c => cards.push(c));

    /* ── 3. Re-apply bestseller badges ── */
    cards.forEach(c => { if (BEST.has(Number(c.dataset.id))) c.classList.add('bestseller'); });

    /* ── 4. Persist and refresh UI ── */
    saveStockToStorage();
    refreshAllCardStock();
    filter(); // re-apply any active category/search filters

    console.log(`[TriadDB] Menu synced from MySQL — ${cards.length} items ✓`);

  } catch(e) {
    console.warn('[TriadDB] Could not sync from DB (is XAMPP running?):', e.message);
    loadStockFromStorage();
    refreshAllCardStock();
  }

  // ── Load past sales from DB into orders[] so the Orders panel is populated ──
  try {
    const today   = new Date();
    const from    = new Date(); from.setDate(from.getDate() - 29);
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = today.toISOString().split('T')[0];
    const sRes    = await fetch(`../api/sales.php?action=list&from=${fromStr}&to=${toStr}&limit=500`);
    const sData   = await sRes.json();
    if (sData.success && sData.data && sData.data.length) {
      orders = sData.data.map(s => ({
        id:        parseInt(s.id),
        customer:  s.customer,
        cashier:   s.cashier,
        persons:   parseInt(s.persons),
        orderType: s.order_type,
        payment:   s.payment,
        items:     s.items || [],
        sub:       parseFloat(s.subtotal),
        subtotal:  parseFloat(s.subtotal),
        tax:       parseFloat(s.tax),
        total:     parseFloat(s.total),
        time:      new Date(s.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
      }));
      // Set orderSeq so new orders don't collide with DB ids
      orderSeq = Math.max(...orders.map(o => o.id), 0) + 1;
      console.log(`[TriadDB] Loaded ${orders.length} past sales into Orders panel ✓`);
    }
  } catch(e) {
    console.warn('[TriadDB] Could not load sales history:', e.message);
  }
})();
});

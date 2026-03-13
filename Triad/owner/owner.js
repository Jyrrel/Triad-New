/* ════════════════════════════════════════════
   CONSTANTS & DATA
════════════════════════════════════════════ */
const TAX = 0.12;
const STORE_NAME = 'Triad Coffee Roaster';
const OWNER_NAME = 'Josh Estrada';

/* ── Archive date button toggle ── */
/* ══ ARCHIVE DATE PICKER ══
   Text input: DD/MM/YYYY  |  Calendar icon toggles native picker
   - Typing: auto-inserts slashes, validates on blur
   - Future dates: hard-blocked in JS
   - Calendar icon: opens native picker; second click closes it
   - Hidden <input type="date"> stores YYYY-MM-DD for render functions
═══════════════════════════════════════════════════════════════ */
const _arcCalOpen = {menu:false, staff:false};

function _arcIds(which){
  return {
    txt:    document.getElementById(which==='menu'?'menuDateTxt':'staffDateTxt'),
    btn:    document.getElementById(which==='menu'?'menuCalBtn':'staffCalBtn'),
    hidden: document.getElementById(which==='menu'?'menuArchiveDate':'staffArchiveDate'),
    allBtn: document.getElementById(which==='menu'?'menuArchiveAllBtn':'staffArchiveAllBtn'),
  };
}

// Auto-format + auto-clamp as user types DD/MM/YYYY
function arcDateTyping(el, which){
  // Strip non-digits, keep only up to 8 digits
  let digits = el.value.replace(/\D/g,'').slice(0,8);

  // Extract segments as they fill up
  let dd = digits.slice(0,2);
  let mm = digits.slice(2,4);
  let yy = digits.slice(4,8);

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth()+1; // 1-12
  const todayD = today.getDate();

  // ── Clamp DD (once 2 digits entered) ──
  if(dd.length===2){
    let d = parseInt(dd,10)||1;
    d = Math.max(1, d);
    // Max days: if we know month+year use real max, else 31
    let maxD = 31;
    if(mm.length===2 && yy.length===4){
      const m=parseInt(mm,10), y=parseInt(yy,10);
      maxD = new Date(y, m, 0).getDate(); // last day of month
    } else if(mm.length===2){
      const m=parseInt(mm,10);
      maxD = new Date(todayY, m, 0).getDate();
    }
    d = Math.min(d, maxD);
    dd = String(d).padStart(2,'0');
  }

  // ── Clamp MM (once 2 digits entered) ──
  if(mm.length===2){
    let m = parseInt(mm,10)||1;
    m = Math.max(1, Math.min(12, m));
    mm = String(m).padStart(2,'0');
  }

  // ── Clamp YYYY (once 4 digits entered) ──
  if(yy.length===4){
    let y = parseInt(yy,10)||todayY;
    if(y < 2000) y = 2000;
    if(y > todayY) y = todayY; // no future year

    // If year == today's year, clamp month
    if(mm.length===2){
      let m = parseInt(mm,10);
      if(y===todayY && m > todayM) m = todayM;
      mm = String(m).padStart(2,'0');

      // Clamp day against real month length
      const maxD = new Date(y, m, 0).getDate();
      if(dd.length===2){
        let d = parseInt(dd,10);
        // If same year+month as today, also cap at today's day
        if(y===todayY && m===todayM && d > todayD) d = todayD;
        d = Math.min(d, maxD);
        dd = String(d).padStart(2,'0');
      }
    }
    yy = String(y);
  }

  // ── Rebuild display value with slashes ──
  let display = dd;
  if(digits.length > 2) display += '/' + mm;
  if(digits.length > 4) display += '/' + yy;
  el.value = display;
  el.classList.remove('invalid');

  // Apply immediately once fully entered
  if(digits.length===8) _arcApply(which, `${dd}/${mm}/${yy}`);
}

// On blur: if incomplete, auto-complete or clear
function arcDateBlur(el, which){
  const v = el.value.trim();
  if(!v){ _arcClearValue(which); return; }
  // If fully typed (10 chars DD/MM/YYYY), apply
  if(v.length===10){ _arcApply(which, v); return; }
  // Incomplete — clear it
  _arcClearValue(which);
}

// Apply DD/MM/YYYY → auto-clamp, sync hidden input, re-render
function _arcApply(which, txt){
  const {txt:el, hidden, allBtn} = _arcIds(which);
  const parts = txt.split('/');
  if(parts.length!==3){ el.classList.add('invalid'); return; }
  let [dd,mm,yy] = parts.map(Number);

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth()+1;
  const todayD = today.getDate();

  // Clamp year
  if(!yy||yy<2000) yy=2000;
  if(yy>todayY) yy=todayY;

  // Clamp month
  if(!mm||mm<1) mm=1;
  if(mm>12) mm=12;
  if(yy===todayY && mm>todayM) mm=todayM;

  // Clamp day
  const maxD = new Date(yy, mm, 0).getDate();
  if(!dd||dd<1) dd=1;
  if(dd>maxD) dd=maxD;
  if(yy===todayY && mm===todayM && dd>todayD) dd=todayD;

  // Update display with clamped values
  const display = `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${yy}`;
  el.value = display;
  el.classList.remove('invalid');
  el.title='';

  // Sync hidden YYYY-MM-DD
  const iso = `${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
  hidden.value = iso;
  allBtn.classList.remove('active');
  if(which==='menu') renderMenuArchive(); else renderStaffArchive();
}

// When native picker changes (user picked from calendar), sync text input
function arcHiddenChanged(which){
  const {txt, hidden, allBtn} = _arcIds(which);
  const val = hidden.value;
  _arcCalOpen[which] = false;
  if(val){
    const [y,m,d] = val.split('-');
    txt.value = `${d}/${m}/${y}`;
    txt.classList.remove('invalid');
    allBtn.classList.remove('active');
  } else {
    txt.value='';
    allBtn.classList.add('active');
  }
  if(which==='menu') renderMenuArchive(); else renderStaffArchive();
}

// Calendar icon: mousedown fires before blur, so we can toggle reliably
function arcCalToggle(e, which){
  e.preventDefault(); // prevent focus stealing
  const {txt, hidden} = _arcIds(which);
  if(_arcCalOpen[which]){
    // Already open — close by blurring the hidden input
    _arcCalOpen[which] = false;
    hidden.blur();
    txt.blur();
  } else {
    // Open native date picker on the hidden input
    _arcCalOpen[which] = true;
    hidden.style.pointerEvents='auto';
    try{ hidden.showPicker(); }catch(err){ hidden.focus(); }
    hidden.style.pointerEvents='none';
    // Reset flag when picker closes (blur fires when calendar closes)
    hidden.addEventListener('blur', ()=>{ _arcCalOpen[which]=false; }, {once:true});
  }
}

function _arcClearValue(which){
  const {txt, hidden, allBtn} = _arcIds(which);
  txt.value=''; txt.classList.remove('invalid');
  hidden.value='';
  allBtn.classList.add('active');
  if(which==='menu') renderMenuArchive(); else renderStaffArchive();
}

/* ── Date input helpers ── */
function _todayStr(){ return new Date().toISOString().split('T')[0]; }

function clampDateToToday(el){
  const today = _todayStr();
  if(el.value && el.value > today) el.value = today;
}

/* ── Set max=today + wire toggle-close + clamp on all date inputs ── */
(function initDateMax(){
  const today = _todayStr();
  const ids = ['ordFrom','ordTo','doneHistFrom','doneHistTo','menuArchiveDate','staffArchiveDate'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.max = today;

    // Toggle: if already focused (picker open), mousedown closes it
    el.addEventListener('mousedown', function(e){
      if(document.activeElement === this){
        e.preventDefault();
        this.blur();
      }
    });

    // Clamp future values on change (belt-and-suspenders alongside inline onchange)
    el.addEventListener('change', function(){
      if(this.value && this.value > _todayStr()){
        this.value = _todayStr();
      }
    });
  });
})();

const CAT_META = {
  'hot-coffee' :{label:'Hot Coffee',  emoji:'☕'},
  'iced-coffee':{label:'Iced Coffee', emoji:'🧊'},
  'espresso'   :{label:'Espresso',    emoji:'⚡'},
  'frappe'     :{label:'Frappe',      emoji:'🥤'},
  'tea'        :{label:'Tea',         emoji:'🍵'},
  'pastries'   :{label:'Pastries',    emoji:'🥐'},
  'beans'      :{label:'Beans',       emoji:'🫘'},
};

/* ── Seed realistic 60-day order history ── */
function seedOrders(){
  const names=['Ana R.','Juan D.','Carlo M.','Lea S.','Mark P.','Tina B.','Rico G.','Clara F.','Ben N.','Joy T.','Kim L.','Ryan A.','Mae C.','Dave O.','Iris L.'];
  const cashiers=['Ana Cruz','Rico Dela Cruz','Ben Navarro','Mia Santos','Josh Estrada'];
  const menu=[
    {id:1, name:'Caramel Latte',        price:3.95, category:'hot-coffee'},
    {id:2, name:'Americano',            price:3.10, category:'hot-coffee'},
    {id:3, name:'Cappuccino',           price:3.50, category:'hot-coffee'},
    {id:5, name:'Matcha Latte',         price:3.85, category:'hot-coffee'},
    {id:7, name:'Iced Latte',           price:3.80, category:'iced-coffee'},
    {id:8, name:'Vanilla Cold Brew',    price:3.95, category:'iced-coffee'},
    {id:11,name:'Mocha Frappe',         price:4.25, category:'frappe'},
    {id:12,name:'Caramel Frappe',       price:4.35, category:'frappe'},
    {id:13,name:'Matcha Latte (Iced)',  price:3.85, category:'tea'},
    {id:14,name:'Classic Black Tea',    price:2.50, category:'tea'},
    {id:15,name:'Butter Croissant',     price:2.40, category:'pastries'},
    {id:16,name:'Chocolate Muffin',     price:2.80, category:'pastries'},
    {id:9, name:'Single Espresso',      price:2.20, category:'espresso'},
    {id:10,name:'Double Espresso',      price:2.95, category:'espresso'},
    {id:17,name:'Darkfruit Blend 250g', price:8.99, category:'beans'},
  ];
  const payments=['gcash','gcash','gcash','paymaya','cash','cash','cash'];
  const types=['dine-in','dine-in','takeout'];
  const now=new Date();
  const orders=[];
  for(let day=59;day>=0;day--){
    const count=9+Math.floor(Math.random()*13);
    for(let i=0;i<count;i++){
      const hour=7+Math.floor(Math.random()*13);
      const t=new Date(now);
      t.setDate(t.getDate()-day);
      t.setHours(hour,Math.floor(Math.random()*60),0,0);
      const n=1+Math.floor(Math.random()*3);
      const itms=[];
      for(let j=0;j<n;j++){
        const m=menu[Math.floor(Math.random()*menu.length)];
        const ex=itms.find(x=>x.id===m.id);
        if(ex)ex.qty++;else itms.push({...m,qty:1});
      }
      const sub=itms.reduce((s,x)=>s+x.price*x.qty,0);
      const tax=sub*TAX;
      orders.push({
        id:orders.length+1,
        customer:names[Math.floor(Math.random()*names.length)],
        cashier:cashiers[Math.floor(Math.random()*cashiers.length)],
        persons:1+Math.floor(Math.random()*4),
        orderType:types[Math.floor(Math.random()*types.length)],
        payment:payments[Math.floor(Math.random()*payments.length)],
        items:itms, subtotal:sub, tax, total:sub+tax, time:t
      });
    }
  }
  return orders;
}

let allOrders = seedOrders();
let currentPeriod = 'today';

let products=[
  {id:1, name:'Caramel Latte',         category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:3.95,cost:0},
  {id:2, name:'Americano',             category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:3.10,cost:0},
  {id:3, name:'Cappuccino',            category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:3.50,cost:0},
  {id:4, name:'Mocha Latte',           category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:3.75,cost:0},
  {id:5, name:'Matcha Latte',          category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:3.85,cost:0},
  {id:6, name:'Golden Turmeric Latte', category:'hot-coffee', type:'manual',qty:999,threshold:0,unit:'cups', price:2.40,cost:0},
  {id:7, name:'Iced Latte',            category:'iced-coffee',type:'manual',qty:999,threshold:0,unit:'cups', price:3.80,cost:0},
  {id:8, name:'Vanilla Cold Brew',     category:'iced-coffee',type:'manual',qty:999,threshold:0,unit:'cups', price:3.95,cost:0},
  {id:9, name:'Single Espresso',       category:'espresso',   type:'manual',qty:999,threshold:0,unit:'shots',price:2.20,cost:0},
  {id:10,name:'Double Espresso',       category:'espresso',   type:'manual',qty:999,threshold:0,unit:'shots',price:2.95,cost:0},
  {id:11,name:'Mocha Frappe',          category:'frappe',     type:'manual',qty:999,threshold:0,unit:'cups', price:4.25,cost:0},
  {id:12,name:'Caramel Frappe',        category:'frappe',     type:'manual',qty:999,threshold:0,unit:'cups', price:4.35,cost:0},
  {id:13,name:'Matcha Latte (Iced)',   category:'tea',        type:'manual',qty:999,threshold:0,unit:'cups', price:3.85,cost:0},
  {id:14,name:'Classic Black Tea',     category:'tea',        type:'manual',qty:999,threshold:0,unit:'cups', price:2.50,cost:0},
  {id:15,name:'Butter Croissant',      category:'pastries',   type:'stock', qty:12, threshold:8, unit:'pcs', price:2.40,cost:45},
  {id:16,name:'Chocolate Muffin',      category:'pastries',   type:'stock', qty:8,  threshold:6, unit:'pcs', price:2.80,cost:38},
  {id:17,name:'Darkfruit Blend 250g',  category:'beans',      type:'stock', qty:14, threshold:5, unit:'bags',price:8.99,cost:280},
  {id:18,name:'Mono Blend 250g',       category:'beans',      type:'stock', qty:3,  threshold:5, unit:'bags',price:9.50,cost:295},
  {id:19,name:'Espresso Beans 250g',   category:'beans',      type:'stock', qty:20, threshold:5, unit:'bags',price:10.99,cost:310},
  {id:20,name:'House Blend 250g',      category:'beans',      type:'stock', qty:2,  threshold:5, unit:'bags',price:8.99,cost:270},
];

let snoozed={}, dismissed=new Set(), auditLog=[], stockFilter='all', editingId=null;
let notifications=[];

/* ════ HELPERS ════ */
const php = n => '₱'+parseFloat(n).toFixed(2);
const ts  = () => new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
const byId = id => products.find(p=>p.id===id);
const fmtDate = d => d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
const fmtDateISO = d => {
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};
function toast(msg,dur=2600){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),dur);
}
function addAudit(msg,type='edit'){auditLog.unshift({msg,type,time:ts()});renderAudit();}
function pushNotif(msg, icon='📣', meta={}){
  // Strip leading emoji from msg to avoid double icon display
  const cleanMsg = msg.replace(/^[\u{1F300}-\u{1FFFF}🔴🟡📦📋➕👥⏰🧾↩]\s*/u, '');
  notifications.unshift({msg: cleanMsg, icon, time: ts(), unread: true, ...meta});
  renderNotifDropdown(); updateBellBadge();
}
function payLabel(p){
  return p==='cash'?'💵 Cash':p==='gcash'?'📱 GCash':'💜 PayMaya';
}
function payBadge(p){
  const cls=p==='cash'?'badge-cash':p==='paymaya'?'badge-paymaya':'badge-ewallet';
  return `<span class="badge ${cls}">${payLabel(p)}</span>`;
}

/* ════ NAVIGATION ════ */
function navigateTo(p){
  if(!p) return;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const navEl=document.querySelector(`.nav-item[data-page="${p}"]`);
  if(navEl) navEl.classList.add('active');
  // Reset scroll on ALL pages BEFORE hiding/showing so position is 0 when they appear next
  document.querySelectorAll('.page').forEach(pg=>{ pg.scrollTop=0; pg.classList.remove('active'); });
  const newPage=document.getElementById('page-'+p);
  if(newPage){ newPage.scrollTop=0; newPage.classList.add('active'); }
  const titles={dashboard:'Dashboard',orders:'Orders',stock:'Stock Manager',staff:'Staff Accounts',menu:'Menu & Pricing','archive-menu':'Menu Archive','archive-staff':'Staff Archive'};
  document.getElementById('pageTitle').textContent=titles[p]||p;
  document.getElementById('periodTabs').style.display = p==='dashboard'?'flex':'none';
  if(p==='stock')          renderStockAll();
  if(p==='dashboard')      renderDashboard();
  if(p==='orders')         initOrdersPage();
  if(p==='staff')          renderStaff();
  if(p==='menu')           renderMenu();
  if(p==='archive-menu'){
    document.getElementById('menuArchiveDate').max=fmtDateISO(new Date());
    renderMenuArchive();
  }
  if(p==='archive-staff'){
    document.getElementById('staffArchiveDate').max=fmtDateISO(new Date());
    renderStaffArchive();
  }
}

/* ════════════════════════════════════════
   MENU & PRICING
════════════════════════════════════════ */

// availability map: product id → true/false (default true)
const menuAvailability = {};
function isAvailable(id){ return menuAvailability[id]!==false; }

// description map for display flair
const menuDescriptions = {
  1:'Rich espresso with smooth caramel & steamed milk',
  2:'Bold black espresso with hot water, clean & strong',
  3:'Espresso with velvety steamed milk & light foam',
  4:'Espresso blended with rich chocolate & steamed milk',
  5:'Earthy matcha whisked into warm steamed milk',
  6:'Warm turmeric blend with honey & steamed milk',
  7:'Double espresso over ice with cold fresh milk',
  8:'Cold-brewed coffee infused with sweet vanilla',
  9:'Single pulled shot of our house espresso blend',
  10:'Double shot of our signature espresso — intense',
  11:'Blended espresso, chocolate & ice topped with cream',
  12:'Caramel drizzle blended with espresso & creamy ice',
  13:'Ceremonial matcha whisked into cold milk over ice',
  14:'Smooth black tea brewed from whole leaves',
  15:'Buttery, flaky croissant baked fresh daily',
  16:'Double chocolate muffin, moist and rich',
  17:'Complex dark fruit notes, medium roast 250g',
  18:'Balanced single-origin mono blend 250g',
  19:'Specially selected espresso beans 250g',
  20:'Our signature house blend, smooth & consistent 250g',
};

let editingMenuId = null;

function renderMenu(){
  const q=(document.getElementById('menuSearch').value||'').toLowerCase().trim();
  const catF=document.getElementById('menuCatFilter').value;
  const availF=document.getElementById('menuAvailFilter').value;

  // Stats (always from full products list)
  const avail=products.filter(p=>isAvailable(p.id)).length;
  document.getElementById('mnTotal').textContent=products.length;
  document.getElementById('mnAvail').textContent=avail;
  document.getElementById('mnUnavail').textContent=`${products.length-avail} Unavailable`;
  const avgPrice=products.length?products.reduce((s,p)=>s+p.price,0)/products.length:0;
  document.getElementById('mnAvgPrice').textContent=php(avgPrice);
  document.getElementById('mnCats').textContent=new Set(products.map(p=>p.category)).size;

  // Filter
  let list=products.filter(p=>{
    if(catF!=='all'&&p.category!==catF) return false;
    if(availF==='available'&&!isAvailable(p.id)) return false;
    if(availF==='unavailable'&&isAvailable(p.id)) return false;
    if(q&&!p.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const container=document.getElementById('menuBody');
  if(!list.length){
    container.innerHTML=`<div class="menu-empty">No menu items match your filters.</div>`;
    return;
  }

  // Group by category in CAT_META order
  const catOrder=Object.keys(CAT_META);
  const grouped={};
  list.forEach(p=>{
    if(!grouped[p.category]) grouped[p.category]=[];
    grouped[p.category].push(p);
  });

  const catKeys=catOrder.filter(c=>grouped[c]);
  container.innerHTML=catKeys.map(cat=>{
    const meta=CAT_META[cat];
    const items=grouped[cat];
    const cards=items.map(p=>{
      const avail=isAvailable(p.id);
      const desc=menuDescriptions[p.id]||'';
      const margin=p.cost>0?Math.round((p.price-p.cost/100)*100/p.price)+'% margin':'—';
      const typeCls=p.type==='stock'?'type-stock':'type-manual';
      const typeLabel=p.type==='stock'?'Tracked':'Manual';
      return `<div class="menu-card ${avail?'':'unavailable'}" id="mc-${p.id}">
        <div class="menu-card-top">
          <div class="menu-item-name">${p.name}</div>
          <div class="menu-item-price">${php(p.price)}</div>
        </div>
        <div class="menu-item-meta">
          <span class="menu-item-unit">${p.unit}</span>
          <span class="menu-item-type ${typeCls}">${typeLabel}</span>
          ${p.cost>0?`<span style="font-size:10px;color:var(--muted)">${margin}</span>`:''}
        </div>
        ${desc?`<div class="menu-item-desc">${desc}</div>`:'<div class="menu-item-desc" style="min-height:0"></div>'}
        <div class="menu-card-footer">
          <button class="menu-avail-toggle ${avail?'available':'unavailable'}" onclick="toggleMenuAvail(${p.id})">
            ${avail?'✅ Available':'🚫 Unavailable'}
          </button>
          <div class="menu-card-actions">
            <button class="menu-edit-btn" onclick="openMenuModal(${p.id})">✏️ Edit</button>
            <button class="menu-del-btn" onclick="confirmMenuDelete(${p.id})">🗑</button>
          </div>
        </div>
      </div>`;
    }).join('');

    return `<div class="menu-cat-section">
      <div class="menu-cat-header">
        <span class="menu-cat-emoji">${meta.emoji}</span>
        <span class="menu-cat-label">${meta.label}</span>
        <span class="menu-cat-count">${items.length} item${items.length!==1?'s':''}</span>
      </div>
      <div class="menu-cards-grid">${cards}</div>
    </div>`;
  }).join('');
}

function toggleMenuAvail(id){
  menuAvailability[id]=!isAvailable(id);
  const p=products.find(x=>x.id===id);
  const state=isAvailable(id)?'available':'Unavailable';
  toast(`${p?p.name:'Item'} marked ${state}`);
  addAudit(`Menu item "${p?p.name:'#'+id}" set to ${state}`,'edit');
  renderMenu();
}

function updateMenuPricePreview(){
  const v=parseFloat(document.getElementById('mnPrice').value)||0;
  document.getElementById('menuPricePreview').textContent=php(v);
}

function openMenuModal(id=null){
  editingMenuId=id;
  document.getElementById('menuModalTitle').textContent=id?'Edit Menu Item':'Add Menu Item';
  if(id){
    const p=products.find(x=>x.id===id);
    if(!p) return;
    document.getElementById('mnName').value=p.name;
    document.getElementById('mnDesc').value=menuDescriptions[p.id]||'';
    document.getElementById('mnCat').value=p.category;
    document.getElementById('mnUnit').value=p.unit;
    document.getElementById('mnPrice').value=p.price;
    document.getElementById('mnCost').value=p.cost||0;
    document.getElementById('mnAvail').value=isAvailable(p.id)?'1':'0';
    // Auto-set type from category (pastries/beans → stock, others → manual)
    document.getElementById('mnType').value=CAT_DEFAULT_TYPE[p.category]||p.type;
  } else {
    document.getElementById('mnName').value='';
    document.getElementById('mnDesc').value='';
    document.getElementById('mnCat').value='hot-coffee';
    document.getElementById('mnUnit').value=CAT_DEFAULT_UNIT['hot-coffee'];
    document.getElementById('mnPrice').value='0';
    document.getElementById('mnCost').value='0';
    document.getElementById('mnAvail').value='1';
    document.getElementById('mnType').value=CAT_DEFAULT_TYPE['hot-coffee']||'manual';
  }
  updateMenuPricePreview();
  document.getElementById('menuModalOverlay').classList.add('open');
}

function closeMenuModal(){
  document.getElementById('menuModalOverlay').classList.remove('open');
  clearMenuImg();
}

function saveMenuItem(){
  const name=document.getElementById('mnName').value.trim();
  if(!name){toast('⚠️ Item name is required.');return;}
  const desc=document.getElementById('mnDesc').value.trim();
  const cat=document.getElementById('mnCat').value;
  const unit=document.getElementById('mnUnit').value.trim()||'pcs';
  const price=parseFloat(document.getElementById('mnPrice').value)||0;
  const cost=parseFloat(document.getElementById('mnCost').value)||0;

  if (price < 0) { toast('⚠️ Selling price cannot be negative.'); return; }
  if (cost < 0) { toast('⚠️ Unit cost cannot be negative.'); return; }
  const avail=document.getElementById('mnAvail').value==='1';
  const type=document.getElementById('mnType').value;

  if(editingMenuId){
    const p=products.find(x=>x.id===editingMenuId);
    if(p){ Object.assign(p,{name,category:cat,unit,price,cost,type}); }
    menuAvailability[editingMenuId]=avail;
    if(desc) menuDescriptions[editingMenuId]=desc;
    toast(`✓ "${name}" updated.`);
    addAudit(`Menu item "${name}" updated`,'edit');
  } else {
    const newId=Math.max(0,...products.map(p=>p.id))+1;
    products.push({id:newId,name,category:cat,type,qty:type==='manual'?999:0,threshold:0,unit,price,cost});
    menuAvailability[newId]=avail;
    if(desc) menuDescriptions[newId]=desc;
    toast(`✓ "${name}" added to menu.`);
    addAudit(`New menu item "${name}" added`,'add');
  }
  closeMenuModal();
  renderMenu();
}

/* ── auto-fill unit based on category ── */
const CAT_DEFAULT_UNIT={'hot-coffee':'cups','iced-coffee':'cups','espresso':'shots','frappe':'cups','tea':'cups','pastries':'pcs','beans':'bags'};
const CAT_DEFAULT_TYPE={'hot-coffee':'manual','iced-coffee':'manual','espresso':'manual','frappe':'manual','tea':'manual','pastries':'stock','beans':'stock'};
function autoFillUnit(){
  const cat=document.getElementById('mnCat').value;
  document.getElementById('mnUnit').value=CAT_DEFAULT_UNIT[cat]||'pcs';
  document.getElementById('mnType').value=CAT_DEFAULT_TYPE[cat]||'manual';
}

function confirmMenuDelete(id){
  const p=products.find(x=>x.id===id);
  if(!p) return;
  document.getElementById('delConfirmTitle').textContent='Archive Menu Item';
  document.getElementById('delConfirmIcon').textContent='📦';
  document.getElementById('delConfirmSub').textContent=`"${p.name}" will be moved to Menu Archive. You can restore it anytime.`;
  document.getElementById('delConfirmOk').onclick=()=>{ closeDelConfirm(); archiveMenuItem(id); };
  document.getElementById('delConfirmOverlay').classList.add('open');
}

/* ── Menu archive data ── */
/* ════════════════════════════════════════
   MENU ARCHIVE
════════════════════════════════════════ */
const ARCHIVE_TTL_DAYS = 30;
let menuArchive = [];
function purgeExpiredMenuArchive(){
  const cutoff=Date.now()-ARCHIVE_TTL_DAYS*24*60*60*1000;
  menuArchive=menuArchive.filter(p=>p.archivedOn.getTime()>=cutoff);
}

function daysLeft(archivedOn){
  const elapsed=(Date.now()-archivedOn.getTime())/(1000*60*60*24);
  return Math.max(0,Math.ceil(ARCHIVE_TTL_DAYS-elapsed));
}

function expiryBadge(archivedOn){
  const d=daysLeft(archivedOn);
  const cls=d<=3?'expiry-urgent':d<=7?'expiry-warn':'expiry-ok';
  return `<span class="expiry-badge ${cls}">${d===0?'Expiring today':`${d}d left`}</span>`;
}

function archiveMenuItem(id){
  const p=products.find(x=>x.id===id);
  if(!p) return;
  menuArchive.push({...p, archivedOn:new Date(), desc:menuDescriptions[p.id]||''});
  products=products.filter(x=>x.id!==id);
  delete menuAvailability[id];
  toast(`📦 "${p.name}" moved to Menu Archive.`);
  addAudit(`Menu item "${p.name}" archived`,'remove');
  renderMenu();
}

function renderMenuArchive(){
  purgeExpiredMenuArchive();
  const dateVal=document.getElementById('menuArchiveDate').value; // YYYY-MM-DD or ''
  const list=dateVal
    ? menuArchive.filter(p=>fmtDateISO(p.archivedOn)===dateVal)
    : [...menuArchive];
  // Update All Dates button style
  const allBtn=document.getElementById('menuArchiveAllBtn');
  if(allBtn) allBtn.classList.toggle('active',!dateVal);
  const count=menuArchive.length;
  document.getElementById('menuArchiveCount').textContent=`${count} item${count!==1?'s':''}`;
  const tbody=document.getElementById('menuArchiveBody');
  if(!menuArchive.length){
    tbody.innerHTML=`<tr><td colspan="7"><div class="archive-empty">
      <div class="archive-empty-icon">📭</div>
      <div class="archive-empty-title">No archived items</div>
      <div class="archive-empty-sub">Items you remove from the menu will appear here.</div>
    </div></td></tr>`;
    return;
  }
  if(!list.length){
    tbody.innerHTML=`<tr><td colspan="7"><div class="archive-empty">
      <div class="archive-empty-icon">🔍</div>
      <div class="archive-empty-title">No items on this date</div>
      <div class="archive-empty-sub">Try a different date or click All Dates to reset.</div>
    </div></td></tr>`;
    return;
  }
  const sorted=[...list].sort((a,b)=>b.archivedOn-a.archivedOn);
  tbody.innerHTML=sorted.map(p=>{
    const meta=CAT_META[p.category]||{emoji:'📦',label:p.category};
    const archivedStr=p.archivedOn.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    return `<tr>
      <td><span style="font-weight:700">${p.name}</span>${p.desc?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${p.desc}</div>`:''}
      </td>
      <td><span style="font-size:12px">${meta.emoji} ${meta.label}</span></td>
      <td style="font-weight:700;color:var(--primary)">${php(p.price)}</td>
      <td style="color:var(--muted);font-size:12px">${p.unit}</td>
      <td>${expiryBadge(p.archivedOn)}</td>
      <td class="archived-on">${archivedStr}</td>
      <td><button class="restore-btn" onclick="restoreMenuItem(${p.id})">↩ Restore</button></td>
    </tr>`;
  }).join('');
}

function clearMenuArchiveDate(){
  _arcClearValue('menu');
}

function restoreMenuItem(id){
  const idx=menuArchive.findIndex(x=>x.id===id);
  if(idx<0) return;
  const p=menuArchive.splice(idx,1)[0];
  const {archivedOn,desc,...item}=p;
  products.push(item);
  menuAvailability[id]=true;
  if(desc) menuDescriptions[id]=desc;
  toast(`✅ "${p.name}" restored to menu.`);
  addAudit(`Menu item "${p.name}" restored from archive`,'add');
  renderMenuArchive();
}

function restoreAllMenuItems(){
  if(!menuArchive.length){toast('ℹ No items to restore.');return;}
  const count=menuArchive.length;
  [...menuArchive].forEach(p=>{
    const {archivedOn,desc,...item}=p;
    products.push(item);
    menuAvailability[item.id]=true;
    if(desc) menuDescriptions[item.id]=desc;
  });
  menuArchive=[];
  toast(`✅ All ${count} item${count!==1?'s':''} restored to menu.`);
  addAudit(`Restored all ${count} menu items from archive`,'add');
  renderMenuArchive();
}

/* ════════════════════════════════════════
   STAFF ACCOUNTS
════════════════════════════════════════ */
const AVATAR_COLORS=['#c8501a','#2563eb','#1a9e5c','#7c3aed','#d97706','#0e7490','#be185d','#065f46'];
function avatarColor(name){ let h=0;for(let c of name)h=(h*31+c.charCodeAt(0))%AVATAR_COLORS.length; return AVATAR_COLORS[h]; }
function initials(f,l){ return ((f[0]||'')+(l[0]||'')).toUpperCase()||'?'; }
function roleCls(r){ return r==='Barista'?'role-barista':r==='Cashier'?'role-cashier':r==='Shift Lead'?'role-shiftlead':'role-manager'; }

let staffList=[];
let staffNextId=1;
let editingStaffId=null;

function renderStaff(){
  const q=(document.getElementById('staffSearch').value||'').toLowerCase();
  const rf=document.getElementById('staffRoleFilter').value;
  let list=[...staffList];
  if(q) list=list.filter(s=>(s.first+' '+s.last).toLowerCase().includes(q)||s.email.toLowerCase().includes(q));
  if(rf!=='all') list=list.filter(s=>s.role===rf);

  // KPI strip (always from full list)
  document.getElementById('sfTotal').textContent=staffList.length;
  document.getElementById('sfActive').textContent=staffList.filter(s=>s.status==='active').length;
  document.getElementById('sfInactive').textContent=staffList.filter(s=>s.status==='inactive').length;
  const roles=new Set(staffList.map(s=>s.role));
  document.getElementById('sfRoles').textContent=roles.size;

  const tbody=document.getElementById('staffTableBody');
  if(!list.length){
    tbody.innerHTML=`<tr><td colspan="6" class="staff-empty">No staff members found.</td></tr>`;
    return;
  }
  tbody.innerHTML=list.map(s=>{
    const initls=initials(s.first,s.last);
    const color=avatarColor(s.first+s.last);
    const joined=s.joined?new Date(s.joined+'T00:00:00').toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):'—';
    const isActive=s.status==='active';
    return `<tr>
      <td>
        <div class="staff-name-cell">
          <div class="staff-avatar" style="background:${color}">${initls}</div>
          <div>
            <div class="staff-name">${s.first} ${s.last}</div>
            <div class="staff-id-tag">${s.email}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge ${roleCls(s.role)}">${s.role}</span></td>
      <td><span class="staff-schedule">${s.schedule}</span></td>
      <td><span class="staff-status ${isActive?'active':'inactive'}"><span class="status-dot"></span>${isActive?'Active':'Inactive'}</span></td>
      <td style="color:var(--muted);font-size:12px">${joined}</td>
      <td>
        <div class="staff-actions">
          <button class="staff-act-btn" onclick="openStaffModal(${s.id})">✏️ Edit</button>
          <button class="staff-act-btn ${isActive?'deactivate':'activate'}" onclick="toggleStaffStatus(${s.id})">${isActive?'Deactivate':'Activate'}</button>
          <button class="staff-act-btn" style="border-color:rgba(208,48,48,.35);color:var(--red)" onclick="confirmDeleteStaff(${s.id})" onmouseover="this.style.background='var(--rl)'" onmouseout="this.style.background=''">🗑 Remove</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function updateStaffPreview(){
  const f=document.getElementById('sfFirstName').value.trim();
  const l=document.getElementById('sfLastName').value.trim();
  const initls=initials(f||'?',l||'');
  const color=f||l?avatarColor((f+l)):AVATAR_COLORS[0];
  const el=document.getElementById('staffAvatarPreview');
  el.textContent=initls; el.style.background=color;
}

function openStaffModal(id=null){
  editingStaffId = id ? parseInt(id) : null;
  document.getElementById('staffModalTitle').textContent=id?'Edit Staff Member':'Add Staff Member';
  const today=new Date(); const todayStr=fmtDateISO(today);
  if(id){
    const s=staffList.find(x=>x.id===id);
    if(!s) return;
    document.getElementById('sfFirstName').value=s.first;
    document.getElementById('sfLastName').value=s.last;
    document.getElementById('sfEmail').value=s.email;
    document.getElementById('sfPhone').value=s.phone||'';
    document.getElementById('sfRole').value=s.role;
    document.getElementById('sfPin').value=s.pin;
    document.getElementById('sfSchedule').value=s.schedule;
    document.getElementById('sfStatus').value=s.status;
    document.getElementById('sfJoined').value=s.joined||todayStr;
  } else {
    ['sfFirstName','sfLastName','sfEmail','sfPhone','sfPin'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('sfRole').value='Barista';
    document.getElementById('sfSchedule').value='Mon–Fri · 7AM–3PM';
    document.getElementById('sfStatus').value='active';
    document.getElementById('sfJoined').value=todayStr;
  }
  updateStaffPreview();
  document.getElementById('staffModalOverlay').classList.add('open');
}

function closeStaffModal(){
  document.getElementById('staffModalOverlay').classList.remove('open');
}

function saveStaffMember(){
  const f=document.getElementById('sfFirstName').value.trim();
  const l=document.getElementById('sfLastName').value.trim();
  const email=document.getElementById('sfEmail').value.trim();
  const phone=document.getElementById('sfPhone').value.trim();
  const role=document.getElementById('sfRole').value;
  const pin=document.getElementById('sfPin').value.trim();
  const schedule=document.getElementById('sfSchedule').value;
  const status=document.getElementById('sfStatus').value;
  const joined=document.getElementById('sfJoined').value;
  if(!f||!l){toast('⚠️ First and last name required.');return;}
  if(pin&&(!/^\d{4}$/.test(pin))){toast('⚠️ PIN must be exactly 4 digits.');return;}
  if(editingStaffId){
    const s=staffList.find(x=>x.id===editingStaffId);
    if(s){Object.assign(s,{first:f,last:l,email,phone,role,pin:pin||s.pin,schedule,status,joined});}
    toast(`✓ ${f} ${l} updated.`);
    addAudit(`Staff ${f} ${l} updated`,'edit');
  } else {
    staffList.push({id:staffNextId++,first:f,last:l,email,phone,role,pin:pin||'0000',schedule,status,joined});
    toast(`✓ ${f} ${l} added to staff.`);
    addAudit(`New staff ${f} ${l} (${role}) added`,'add');
    pushNotif(`👥 New staff added: ${f} ${l}`,`👥`);
  }
  closeStaffModal();
  renderStaff();
}

function toggleStaffStatus(id){
  const s=staffList.find(x=>x.id===parseInt(id));
  if(!s) return;
  s.status=s.status==='active'?'inactive':'active';
  toast(`${s.first} ${s.last} marked ${s.status}.`);
  addAudit(`Staff ${s.first} ${s.last} set to ${s.status}`,'edit');
  renderStaff();
}

function confirmDeleteStaff(id){
  const s=staffList.find(x=>x.id===parseInt(id));
  if(!s) return;
  document.getElementById('delConfirmTitle').textContent='Archive Staff Member';
  document.getElementById('delConfirmIcon').textContent='👤';
  document.getElementById('delConfirmSub').textContent=`${s.first} ${s.last} (${s.role}) will be moved to Staff Archive. You can restore them anytime.`;
  document.getElementById('delConfirmOk').onclick=()=>{ closeDelConfirm(); window.archiveStaff(parseInt(id)); };
  document.getElementById('delConfirmOverlay').classList.add('open');
}
function closeDelConfirm(){ document.getElementById('delConfirmOverlay').classList.remove('open'); }
document.getElementById('delConfirmOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDelConfirm();});

/* ── Staff archive data ── */
/* ════════════════════════════════════════
   STAFF ARCHIVE
════════════════════════════════════════ */
let staffArchive = [];

function purgeExpiredStaffArchive(){
  const cutoff=Date.now()-ARCHIVE_TTL_DAYS*24*60*60*1000;
  staffArchive=staffArchive.filter(s=>s.archivedOn.getTime()>=cutoff);
}

function archiveStaff(id){
  const s=staffList.find(x=>x.id===id);
  if(!s) return;
  staffArchive.push({...s, archivedOn:new Date()});
  staffList=staffList.filter(x=>x.id!==id);
  toast(`👤 ${s.first} ${s.last} moved to Staff Archive.`);
  addAudit(`Staff ${s.first} ${s.last} archived`,'remove');
  renderStaff();
}

function renderStaffArchive(){
  purgeExpiredStaffArchive();
  const dateVal=document.getElementById('staffArchiveDate').value;
  const list=dateVal
    ? staffArchive.filter(s=>fmtDateISO(s.archivedOn)===dateVal)
    : [...staffArchive];
  const allBtn=document.getElementById('staffArchiveAllBtn');
  if(allBtn) allBtn.classList.toggle('active',!dateVal);
  const count=staffArchive.length;
  document.getElementById('staffArchiveCount').textContent=`${count} member${count!==1?'s':''}`;
  const tbody=document.getElementById('staffArchiveBody');
  if(!staffArchive.length){
    tbody.innerHTML=`<tr><td colspan="7"><div class="archive-empty">
      <div class="archive-empty-icon">📭</div>
      <div class="archive-empty-title">No archived staff</div>
      <div class="archive-empty-sub">Staff members you archive will appear here.</div>
    </div></td></tr>`;
    return;
  }
  if(!list.length){
    tbody.innerHTML=`<tr><td colspan="7"><div class="archive-empty">
      <div class="archive-empty-icon">🔍</div>
      <div class="archive-empty-title">No staff archived on this date</div>
      <div class="archive-empty-sub">Try a different date or click All Dates to reset.</div>
    </div></td></tr>`;
    return;
  }
  const sorted=[...list].sort((a,b)=>b.archivedOn-a.archivedOn);
  tbody.innerHTML=sorted.map(s=>{
    const initls=initials(s.first,s.last);
    const color=avatarColor(s.first+s.last);
    const archivedStr=s.archivedOn.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
    return `<tr>
      <td>
        <div class="staff-name-cell">
          <div class="staff-avatar" style="background:${color}">${initls}</div>
          <div><div class="staff-name">${s.first} ${s.last}</div><div class="staff-id-tag">${s.phone||''}</div></div>
        </div>
      </td>
      <td><span class="role-badge ${roleCls(s.role)}">${s.role}</span></td>
      <td class="staff-schedule">${s.schedule}</td>
      <td style="font-size:12px;color:var(--muted)">${s.email}</td>
      <td>${expiryBadge(s.archivedOn)}</td>
      <td class="archived-on">${archivedStr}</td>
      <td><button class="restore-btn" onclick="restoreStaff(${s.id})">↩ Restore</button></td>
    </tr>`;
  }).join('');
}

function clearStaffArchiveDate(){
  _arcClearValue('staff');
}

function restoreStaff(id){
  const idx=staffArchive.findIndex(x=>x.id===id);
  if(idx<0) return;
  const s=staffArchive.splice(idx,1)[0];
  const {archivedOn,...member}=s;
  member.status='inactive';
  staffList.push(member);
  toast(`✅ ${s.first} ${s.last} restored to staff (set Inactive — activate when ready).`);
  addAudit(`Staff ${s.first} ${s.last} restored from archive`,'add');
  renderStaffArchive();
}

function restoreAllStaff(){
  if(!staffArchive.length){toast('ℹ No staff to restore.');return;}
  const count=staffArchive.length;
  [...staffArchive].forEach(s=>{
    const {archivedOn,...member}=s;
    member.status='inactive';
    staffList.push(member);
  });
  staffArchive=[];
  toast(`✅ All ${count} staff member${count!==1?'s':''} restored.`);
  addAudit(`Restored all ${count} staff from archive`,'add');
  renderStaffArchive();
}
/* ════════════════════════════════════════
   CALENDAR & ACTIVITIES
════════════════════════════════════════ */
const ACT_COLORS=['#c8501a','#2563eb','#1a9e5c','#7c3aed','#d97706','#e11d48','#0e7490'];
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
let calSelectedDate=fmtDateISO(new Date());
let activities={}; // key: 'YYYY-MM-DD' → [{id,title,time,endTime,note,color}]
let doneActivities=[]; // [{title,time,endTime,note,color,ds,completedAt}] — history of Done'd activities
let actNextId=1, actModalDate=null, actSelectedColor=ACT_COLORS[0];

/* ── Save scroll so Calendar section stays in view ── */
let _actScrollSaved = 0;
function _saveDashScroll(){
  const pg = document.getElementById('page-dashboard');
  _actScrollSaved = pg ? pg.scrollTop : 0;
}
function _restoreDashScroll(){
  const pg = document.getElementById('page-dashboard');
  if(pg) pg.scrollTop = _actScrollSaved;
}

function calRender(){
  const now=new Date();
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('calMonthLbl').textContent=`${monthNames[calMonth]} ${calYear}`;
  const grid=document.getElementById('calGrid');
  const dows=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  const first=new Date(calYear,calMonth,1).getDay();
  const days=new Date(calYear,calMonth+1,0).getDate();
  const todayStr=fmtDateISO(now);
  const prevDays=new Date(calYear,calMonth,0).getDate();
  for(let i=first-1;i>=0;i--){
    const d=prevDays-i;
    html+=`<div class="cal-day other-month">${d}</div>`;
  }
  for(let d=1;d<=days;d++){
    const ds=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=ds===todayStr;
    const isSel=ds===calSelectedDate;
    const hasEv=activities[ds]&&activities[ds].some(a=>!a.confirmed);
    let cls='cal-day';
    if(isToday) cls+=' today';
    else if(isSel) cls+=' selected';
    if(hasEv) cls+=' has-event';
    html+=`<div class="${cls}" onclick="calSelectDate('${ds}')">${d}</div>`;
  }
  grid.innerHTML=html;
  calRenderActivities();
  // Restore scroll after DOM rebuild to prevent jump
  _restoreDashScroll();
}

function calSelectDate(ds){
  calSelectedDate=ds;
  _saveDashScroll();
  calRender();
}

function calRenderActivities(){
  const ds=calSelectedDate;
  const now=new Date();
  const todayStr=fmtDateISO(now);
  const d=new Date(ds+'T00:00:00');
  const lbl=ds===todayStr?'Today — '+d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}):d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  document.getElementById('calActDateLbl').textContent=lbl;
  const list=document.getElementById('calActList');
  // Only show activities that are not done (confirmed) — done ones get removed on confirm anyway
  const acts=(activities[ds]||[]).filter(a=>!a.confirmed).sort((a,b)=>a.time.localeCompare(b.time));
  if(!acts.length){
    // If selected date is in the past, show a different message
    const msg = ds < todayStr
      ? `<div class="cal-act-empty">No upcoming activities for this day.</div>`
      : `<div class="cal-act-empty">No activities for this day.<br>Click <strong>＋ Add Activity</strong> to schedule one.</div>`;
    list.innerHTML=msg;
    return;
  }
  list.innerHTML=acts.map(a=>`
    <div class="cal-act-item">
      <div class="cal-act-dot" style="background:${a.color}"></div>
      <div class="cal-act-body">
        <div class="cal-act-title">${a.title}</div>
        <div class="cal-act-time">${fmtTime12(a.time)}${a.endTime?' – '+fmtTime12(a.endTime):''}${a.note?'  ·  '+a.note:''}</div>
      </div>
      <button class="cal-act-del" onclick="deleteActivity('${ds}',${a.id})" title="Remove">✕</button>
    </div>`).join('');
}

function fmtTime12(t){
  if(!t) return '';
  const [h,m]=t.split(':').map(Number);
  const ampm=h>=12?'PM':'AM';
  return `${((h%12)||12)}:${String(m).padStart(2,'0')} ${ampm}`;
}

function calPrevMonth(){ _saveDashScroll(); calMonth--; if(calMonth<0){calMonth=11;calYear--;} calRender(); }
function calNextMonth(){ _saveDashScroll(); calMonth++; if(calMonth>11){calMonth=0;calYear++;} calRender(); }

function openActModal(){
  actModalDate=calSelectedDate;
  const d=new Date(actModalDate+'T00:00:00');
  document.getElementById('actModalTitle').textContent='Add Activity · '+d.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'});
  document.getElementById('actTitle').value='';
  document.getElementById('actNote').value='';
  document.getElementById('actTime').value='09:00';
  document.getElementById('actEndTime').value='';
  actSelectedColor=ACT_COLORS[0];
  document.getElementById('actColorRow').innerHTML=ACT_COLORS.map((c,i)=>
    `<div class="act-color-dot${i===0?' selected':''}" style="background:${c}" onclick="selectActColor('${c}',this)"></div>`
  ).join('');
  _saveDashScroll();
  // Lock ALL scroll — page container AND body — so nothing moves while modal is open
  const pg = document.getElementById('page-dashboard');
  if(pg) pg.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.getElementById('actModalOverlay').classList.add('open');
  setTimeout(()=>{
    document.getElementById('actTitle').focus({preventScroll:true});
    _restoreDashScroll();
  },120);
}
function closeActModal(){
  document.getElementById('actModalOverlay').classList.remove('open');
  // Unlock scroll on both body and page, restore position
  document.body.style.overflow = '';
  const pg = document.getElementById('page-dashboard');
  if(pg){ pg.style.overflow = ''; pg.scrollTop = _actScrollSaved; }
}
document.getElementById('actModalOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeActModal();});

function selectActColor(c,el){
  actSelectedColor=c;
  document.querySelectorAll('.act-color-dot').forEach(d=>d.classList.remove('selected'));
  el.classList.add('selected');
}

function saveActivity(){
  const title=document.getElementById('actTitle').value.trim();
  if(!title){toast('⚠️ Activity title is required.');return;}
  const time=document.getElementById('actTime').value||'09:00';
  const endTime=document.getElementById('actEndTime').value||'';
  const note=document.getElementById('actNote').value.trim();
  if(!activities[actModalDate]) activities[actModalDate]=[];
  activities[actModalDate].push({id:actNextId++,title,time,endTime,note,color:actSelectedColor});
  closeActModal(); // already restores scroll
  calRender();     // calRender also calls _restoreDashScroll at end
  toast(`✅ Activity added for ${new Date(actModalDate+'T00:00:00').toLocaleDateString([],{month:'short',day:'numeric'})}.`);
}

function deleteActivity(ds,id){
  if(activities[ds]) activities[ds]=activities[ds].filter(a=>a.id!==id);
  _saveDashScroll();
  calRenderActivities();
  calRender();
}

// init calendar on load
calRender();

document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
  el.addEventListener('click',()=>navigateTo(el.dataset.page));
});

/* ════ NOTIFICATIONS ════ */
function toggleNotif(){
  const dd=document.getElementById('notifDropdown');
  dd.classList.toggle('open');
  if(dd.classList.contains('open')){
    notifications.forEach(n=>n.unread=false);
    updateBellBadge(); renderNotifDropdown();
  }
}
document.addEventListener('click',e=>{
  if(!document.getElementById('notifWrap').contains(e.target))
    document.getElementById('notifDropdown').classList.remove('open');
});
function clearAllNotifs(){notifications=[];renderNotifDropdown();renderNotifAllPanel();updateBellBadge();}
function updateBellBadge(){
  const unread=notifications.filter(n=>n.unread).length;
  const stockA=products.filter(p=>{
    if(stockStatus(p)==='ok')return false;
    if(dismissed.has(p.id))return false;
    if(snoozed[p.id]&&snoozed[p.id]>Date.now())return false;
    return true;
  }).length;
  const total=unread+stockA;
  const b=document.getElementById('bellBadge');
  b.textContent=total; b.classList.toggle('show',total>0);
}
function goToStockAlerts(){
  document.getElementById('notifDropdown').classList.remove('open');
  const allNotifOverlay = document.getElementById('notifAllOverlay');
  if(allNotifOverlay) allNotifOverlay.classList.remove('open');
  navigateTo('stock');
  setTimeout(()=>{
    const alertsPanel = document.getElementById('alertsBody')?.closest('.panel');
    if(alertsPanel){
      alertsPanel.scrollIntoView({behavior:'smooth', block:'center'});
      alertsPanel.classList.add('panel-highlight');
      setTimeout(()=> alertsPanel.classList.remove('panel-highlight'), 2200);
    }
  }, 150);
}

function goToOrder(orderId, itemName){
  document.getElementById('notifDropdown').classList.remove('open');
  const allNotifOverlay = document.getElementById('notifAllOverlay');
  if(allNotifOverlay) allNotifOverlay.classList.remove('open');
  navigateTo('orders');

  function _highlightRow(){
    const row = document.querySelector(`#ordersPageBody tr[data-order-id="${orderId}"]`);
    if(row){
      row.scrollIntoView({behavior:'smooth', block:'center'});
      row.classList.add('notif-highlight');
      setTimeout(()=> row.classList.remove('notif-highlight'), 2500);
      // Highlight the specific ordered item text inside the items cell
      if(itemName){
        const itemsCell = row.querySelector('.txn-items');
        if(itemsCell){
          const raw = itemsCell.textContent;
          // Wrap matching item name in highlight span
          const escaped = itemName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
          const highlighted = raw.replace(new RegExp(`(${escaped}×?\\d*)`, 'i'),
            `<span class="notif-item-highlight">$1</span>`);
          itemsCell.innerHTML = highlighted;
          setTimeout(()=>{ itemsCell.innerHTML = raw; }, 2600);
        }
      }
      return true;
    }
    return false;
  }

  setTimeout(()=>{
    if(_highlightRow()) return;
    const idx = filteredOrders.findIndex(o => o.id === orderId);
    if(idx === -1){
      ordPage = 0;
      if(document.getElementById('ordSearchInput')) document.getElementById('ordSearchInput').value='';
      applyOrderFilters && applyOrderFilters();
      setTimeout(()=>{
        const idx2 = filteredOrders.findIndex(o => o.id === orderId);
        if(idx2 !== -1){
          ordPage = Math.floor(idx2 / ordPageSize);
          renderOrdersPage();
          setTimeout(_highlightRow, 120);
        }
      }, 100);
    } else {
      ordPage = Math.floor(idx / ordPageSize);
      renderOrdersPage();
      setTimeout(_highlightRow, 120);
    }
  }, 200);
}

function goToInventory(productName){
  document.getElementById('notifDropdown').classList.remove('open');
  document.getElementById('notifAllOverlay')?.classList.remove('open');
  navigateTo('stock');

  function _highlightInvRow(){
    // Find row by data-prod-name in tableBody
    const row = document.querySelector(`#tableBody tr[data-prod-name="${CSS.escape(productName)}"]`);
    if(row){
      row.scrollIntoView({behavior:'smooth', block:'center'});
      row.classList.add('notif-highlight');
      setTimeout(()=> row.classList.remove('notif-highlight'), 2500);
      // Also highlight the product name cell
      const nameEl = row.querySelector('.prod-name');
      if(nameEl){
        nameEl.classList.add('notif-item-highlight');
        setTimeout(()=> nameEl.classList.remove('notif-item-highlight'), 2600);
      }
      return true;
    }
    return false;
  }

  setTimeout(()=>{
    if(_highlightInvRow()) return;
    // Product might be on another page — find it
    const allFlat = buildInvRows(products).flatMap(s=>s.prods);
    const idx = allFlat.findIndex(p => p.name === productName);
    if(idx !== -1){
      invPage = Math.floor(idx / INV_PAGE_SIZE);
      renderTable();
      setTimeout(_highlightInvRow, 150);
    }
  }, 220);
}
const _notifReg = {};
let _notifRegIdx = 0;
function _regNotif(n){ const k='nr'+(++_notifRegIdx); _notifReg[k]=n; return k; }

function renderNotifDropdown(){
  const list = document.getElementById('notifList');
  const sa = products.filter(p => stockStatus(p)!=='ok' && !dismissed.has(p.id) && !(snoozed[p.id] && snoozed[p.id]>Date.now()));
  const stockItems = sa.map(p => ({
    icon: stockStatus(p)==='critical' ? '🔴' : '🟡',
    msg: `${p.name} — ${stockStatus(p)==='critical' ? 'critically low' : 'running low'} (${p.qty} ${p.unit})`,
    time: 'Now', unread: true, cat: 'stock'
  }));
  const allItems = [...stockItems, ...notifications];
  if(!allItems.length){ list.innerHTML='<div class="notif-empty">All caught up! ✅</div>'; return; }
  const visible = allItems.slice(0, 6);
  list.innerHTML = visible.map(n => {
    const k = _regNotif(n);
    const isStock = n.cat==='stock' || n.icon==='🔴' || n.icon==='🟡';
    const hint = isStock ? 'View Alerts →' : n.icon==='🧾' ? 'View Order →' : n.icon==='📦'||n.icon==='➕' ? 'View Stock →' : n.icon==='👥' ? 'View Staff →' : '';
    return `<div class="notif-item${n.unread?' unread':''} notif-clickable"
      onclick="_notifClick('${k}')" title="${hint}">
      <div class="notif-ico">${n.icon}</div>
      <div class="notif-item-body">
        <div class="notif-msg">${n.msg}</div>
        <div class="notif-time">${n.time}${hint ? ` · <span class="notif-hint">${hint}</span>` : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function _notifClick(k){
  const n = _notifReg[k];
  if(!n) return;
  const isStock = n.cat==='stock' || n.icon==='🔴' || n.icon==='🟡' || n.icon==='⏰';
  if(isStock){
    goToStockAlerts();
  } else if(n.icon==='🧾' && n.orderId){
    goToOrder(n.orderId, n.itemName||null);
  } else if(n.icon==='🧾'){
    document.getElementById('notifDropdown').classList.remove('open');
    document.getElementById('notifAllOverlay')?.classList.remove('open');
    navigateTo('orders');
  } else if(n.icon==='📋' && n.orderId){
    // Refund notification — go to order and highlight refunded row + item
    goToOrder(n.orderId, n.itemName||null);
  } else if(n.icon==='📦' && n.productName){
    // Restock notification — go to inventory and highlight the restocked product
    goToInventory(n.productName);
  } else if(n.icon==='📦' || n.icon==='➕'){
    document.getElementById('notifDropdown').classList.remove('open');
    document.getElementById('notifAllOverlay')?.classList.remove('open');
    navigateTo('stock');
  } else if(n.icon==='👥'){
    document.getElementById('notifDropdown').classList.remove('open');
    document.getElementById('notifAllOverlay')?.classList.remove('open');
    navigateTo('staff');
  } else if(n.icon==='📋'){
    document.getElementById('notifDropdown').classList.remove('open');
    document.getElementById('notifAllOverlay')?.classList.remove('open');
    navigateTo('orders');
  }
}
/* View All Notifications panel */
function openNotifAll(){
  renderNotifAllPanel();
  document.getElementById('notifAllOverlay').classList.add('open');
}
function closeNotifAll(){document.getElementById('notifAllOverlay').classList.remove('open');}
document.getElementById('notifAllOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeNotifAll();});
function renderNotifAllPanel(){
  const sa = products.filter(p => stockStatus(p)!=='ok' && !dismissed.has(p.id) && !(snoozed[p.id] && snoozed[p.id]>Date.now()));
  const stockItems = sa.map(p => ({
    icon: stockStatus(p)==='critical' ? '🔴' : '🟡',
    msg: `${p.name} — ${stockStatus(p)==='critical' ? 'critically low' : 'running low'} (${p.qty} ${p.unit})`,
    time: 'Now', unread: true, cat: 'stock'
  }));
  const orderItems   = notifications.filter(n => n.icon==='🧾');
  const restockItems = notifications.filter(n => n.icon==='📦');
  const otherItems   = notifications.filter(n => n.icon!=='🧾' && n.icon!=='📦');
  const body = document.getElementById('notifAllBody');

  function notifRow(n){
    const k = _regNotif(n);
    const isStock  = n.cat==='stock' || n.icon==='🔴' || n.icon==='🟡';
    const hint = isStock ? 'View Alerts →' : n.icon==='🧾' ? 'View Order →' : n.icon==='📦'||n.icon==='➕' ? 'View Stock →' : n.icon==='👥' ? 'View Staff →' : '';
    return `<div class="notif-all-item${n.unread?' unread':''} notif-clickable"
      onclick="_notifClick('${k}')" title="${hint}">
      <div class="notif-all-ico">${n.icon}</div>
      <div class="notif-item-body">
        <div class="notif-all-msg">${n.msg}</div>
        <div class="notif-all-time">${n.time}${hint ? ` · <span class="notif-hint">${hint}</span>` : ''}</div>
      </div>
    </div>`;
  }

  function section(label, items){
    if(!items.length) return '';
    return `<div class="notif-cat-section">
      <div class="notif-cat-label">${label}</div>
      ${items.map(notifRow).join('')}
    </div>`;
  }

  let html = '';
  html += section('🚨 Stock Alerts', stockItems);
  html += section('🧾 New Orders', orderItems);
  html += section('📦 Restock Activity', restockItems);
  html += section('📣 Other', otherItems);
  body.innerHTML = html || '<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">No notifications yet.</div>';
}

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
function getFilteredOrders(){
  const now=new Date();
  return allOrders.filter(o=>{
    const d=o.time;
    if(currentPeriod==='today')  return d.toDateString()===now.toDateString();
    if(currentPeriod==='week'){   const w=new Date(now);w.setDate(w.getDate()-6);return d>=w;}
    if(currentPeriod==='month'){  const m=new Date(now);m.setDate(m.getDate()-29);return d>=m;}
    return true;
  });
}
function setPeriod(p){
  currentPeriod=p;
  const map={'today':'Today','week':'This Week','month':'This Month'};
  document.querySelectorAll('.period-tab').forEach(t=>t.classList.toggle('active',t.textContent===map[p]));
  renderDashboard();
}

function renderDashboard(){
  const orders=getFilteredOrders();
  const totalRev=orders.reduce((s,o)=>s+o.total,0);
  const totalSub=orders.reduce((s,o)=>s+o.subtotal,0);
  const totalTax=orders.reduce((s,o)=>s+o.tax,0);
  const avg=orders.length?totalRev/orders.length:0;
  const totalPersons=orders.reduce((s,o)=>s+o.persons,0);
  const dineIn=orders.filter(o=>o.orderType==='dine-in').length;
  const takeout=orders.filter(o=>o.orderType==='takeout').length;
  const itemMap={};
  orders.forEach(o=>o.items.forEach(it=>{
    if(!itemMap[it.name])itemMap[it.name]={qty:0,rev:0,category:it.category};
    itemMap[it.name].qty+=it.qty; itemMap[it.name].rev+=it.price*it.qty;
  }));
  const totalItems=Object.values(itemMap).reduce((s,v)=>s+v.qty,0);
  const topItem=Object.entries(itemMap).sort((a,b)=>b[1].qty-a[1].qty)[0];

  document.getElementById('kRevenue').textContent=php(totalRev);
  document.getElementById('kRevSub').textContent=`${orders.length} order${orders.length!==1?'s':''}`;
  document.getElementById('kOrders').textContent=orders.length;
  document.getElementById('kOrdersSub').textContent=`Avg ${php(avg)}`;
  document.getElementById('kCustomers').textContent=totalPersons;
  document.getElementById('kCustSub').textContent=`${dineIn} dine · ${takeout} take`;
  document.getElementById('kItems').textContent=totalItems;
  document.getElementById('kItemsSub').textContent=`Top: ${topItem?topItem[0]:'—'}`;
  document.getElementById('fGross').textContent=php(totalRev);
  document.getElementById('fTax').textContent=php(totalTax);
  document.getElementById('fNet').textContent=php(totalSub);
  document.getElementById('fOrders').textContent=orders.length;

  renderRevenueChart(orders);
  renderOrderTypeDonut(dineIn,takeout);
  renderTopSellers(itemMap);
  renderPaymentBreakdown(orders);
  renderHourlyChart(orders);
  renderRecentOrders(orders);
  renderCategoryBreakdown(itemMap);
  updateBellBadge();
  renderNotifDropdown();
}

/* ── Canvas line chart ── */
/* ── Interactive line chart with hover tooltip ── */
const _chartState = {};

function drawLineChart(canvasId, points, lineColor, fillColor, heightPx){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.parentElement.offsetWidth - 28 || 400;
  const H = heightPx || 130;

  // Set canvas backing store size, CSS size stays fixed
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const pad = {t:20, r:14, b:8, l:8};
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const maxVal = Math.max(...points.map(p => p.v), 0.01);
  const coords = points.map((p, i) => ({
    x: pad.l + (i / (points.length - 1 || 1)) * cw,
    y: pad.t + ch * (1 - p.v / maxVal),
    v: p.v,
    label: p.label
  }));

  // Tooltip element — sibling inside .linechart-wrap
  const tooltipId = canvasId === 'revenueCanvas' ? 'revenueTooltip' : 'hourlyTooltip';
  const isRevChart = heightPx >= 120;

  _chartState[canvasId] = {coords, pad, lineColor, W, H, cw, ch, dpr, isRevChart, tooltipId};

  // Draw baseline (no hover)
  _redrawChart(canvasId, null);

  // Attach listeners once
  if(!canvas._hoverBound){
    canvas._hoverBound = true;
    canvas.style.cursor = 'crosshair';

    canvas.addEventListener('mousemove', e => {
      const st = _chartState[canvasId];
      if(!st) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left);
      // snap to nearest point
      let nearest = st.coords[0], minDist = Infinity;
      st.coords.forEach(c => {
        const d = Math.abs(c.x - mx);
        if(d < minDist){ minDist = d; nearest = c; }
      });
      _redrawChart(canvasId, nearest);
      // Show HTML tooltip — position in px relative to .linechart-wrap
      const tip = document.getElementById(st.tooltipId);
      if(tip){
        const valStr = st.isRevChart
          ? '₱' + nearest.v.toFixed(2)
          : nearest.v + (nearest.v === 1 ? ' order' : ' orders');
        tip.innerHTML = `${nearest.label}<br>${valStr}`;
        tip.style.opacity = '1';

        // canvas sits inside .linechart-wrap with ~14-15px left padding
        const wrapPadLeft = 14;
        const wrapPadTop  = 14;
        // x in wrap coords = canvas pad.l offset + point x + wrap left padding
        let xInWrap = wrapPadLeft + nearest.x;
        const yInWrap = wrapPadTop + nearest.y;

        // After rendering, clamp so tooltip doesn't overflow wrap edges
        // tip width is unknown until rendered — estimate ~90px, adjust after
        tip.style.left = xInWrap + 'px';
        tip.style.top  = yInWrap + 'px';

        // Flip: show below dot if near top of canvas
        if(nearest.y < 36){
          tip.style.transform = 'translate(-50%, 8px)';
        } else {
          tip.style.transform = 'translate(-50%, calc(-100% - 10px))';
        }

        // Clamp after browser lays out the tip
        requestAnimationFrame(()=>{
          const tipW = tip.offsetWidth;
          const wrapW = canvas.parentElement.offsetWidth;
          let clampedX = xInWrap;
          if(clampedX - tipW/2 < 4) clampedX = tipW/2 + 4;
          if(clampedX + tipW/2 > wrapW - 4) clampedX = wrapW - tipW/2 - 4;
          tip.style.left = clampedX + 'px';
        });
      }
    });

    canvas.addEventListener('mouseleave', () => {
      _redrawChart(canvasId, null);
      const st = _chartState[canvasId];
      if(st){ const tip = document.getElementById(st.tooltipId); if(tip) tip.style.opacity='0'; }
    });
  }
}

function _redrawChart(canvasId, hoveredPt){
  const canvas = document.getElementById(canvasId);
  const st = _chartState[canvasId];
  if(!canvas || !st) return;
  const ctx = canvas.getContext('2d');
  // Always reset transform cleanly — no accumulation
  ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  ctx.clearRect(0, 0, st.W, st.H);
  _drawChartBase(ctx, st.coords, st.lineColor, st.pad, st.cw, st.ch, st.W, st.H, hoveredPt);
}

function _drawChartBase(ctx, coords, lineColor, pad, cw, ch, W, H, hoveredPt){
  const r = parseInt(lineColor.slice(1,3),16),
        g = parseInt(lineColor.slice(3,5),16),
        b = parseInt(lineColor.slice(5,7),16);

  // Gradient fill under line
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.2)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  coords.slice(1).forEach(c => ctx.lineTo(c.x, c.y));
  ctx.lineTo(coords[coords.length-1].x, pad.t + ch);
  ctx.lineTo(coords[0].x, pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line path
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  coords.slice(1).forEach(c => ctx.lineTo(c.x, c.y));
  ctx.strokeStyle = lineColor; ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();

  // Vertical crosshair on hover
  if(hoveredPt){
    ctx.save();
    ctx.setLineDash([3,3]);
    ctx.strokeStyle = `rgba(${r},${g},${b},0.35)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hoveredPt.x, pad.t);
    ctx.lineTo(hoveredPt.x, pad.t + ch);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Dots + static labels
  const maxV = Math.max(...coords.map(c => c.v));
  coords.forEach((c, i) => {
    if(c.v === 0) return;
    const isHov = hoveredPt && c.x === hoveredPt.x;
    const dotR = isHov ? 5.5 : 3.5;
    ctx.beginPath(); ctx.arc(c.x, c.y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = isHov ? lineColor : '#fff'; ctx.fill();
    ctx.strokeStyle = lineColor; ctx.lineWidth = isHov ? 2.5 : 2; ctx.stroke();
    // Static label only on key points when not hovered
    const showLbl = !hoveredPt && (i === 0 || i === coords.length-1 || c.v === maxV);
    if(showLbl && c.v > 0){
      ctx.fillStyle = lineColor;
      ctx.font = 'bold 8px DM Sans,sans-serif';
      ctx.textAlign = 'center';
      const lbl = c.v > 999 ? php(c.v).replace('₱','') : php(c.v).replace('₱','');
      ctx.fillText(lbl, c.x, c.y - 8);
    }
  });
}

function _roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

function renderRevenueChart(orders){
  const now=new Date();
  let points=[];
  if(currentPeriod==='today'){
    document.getElementById('chartSubtitle').textContent='Today by hour';
    for(let h=7;h<=19;h++){
      const v=orders.filter(o=>o.time.getHours()===h).reduce((s,o)=>s+o.total,0);
      const shortLbl=`${h>12?h-12:h}${h>=12?'p':'a'}`;
      const fullLbl=`${h>12?h-12:(h===0?12:h)}:00 ${h>=12?'PM':'AM'}`;
      points.push({label:fullLbl, shortLabel:shortLbl, v});
    }
  } else {
    const days=currentPeriod==='week'?7:30;
    document.getElementById('chartSubtitle').textContent=`Last ${days} days`;
    for(let i=days-1;i>=0;i--){
      const d=new Date(now); d.setDate(d.getDate()-i);
      const v=orders.filter(o=>o.time.toDateString()===d.toDateString()).reduce((s,o)=>s+o.total,0);
      const lbl=i===0?'Today':d.toLocaleDateString([],{month:'short',day:'numeric'});
      points.push({label:lbl, v});
    }
  }
  requestAnimationFrame(()=>drawLineChart('revenueCanvas',points,'#c8501a','#c8501a',130));
  const labEl=document.getElementById('chartLabels');
  labEl.innerHTML='';
  if(points.length<=9){
    points.forEach(p=>{const s=document.createElement('span');s.style.cssText='font-size:9px;color:var(--muted);font-weight:600;flex:1;text-align:center';s.textContent=p.shortLabel||p.label;labEl.appendChild(s);});
  } else {
    labEl.innerHTML=`<span style="font-size:9px;color:var(--muted);font-weight:600">${points[0].shortLabel||points[0].label}</span><span style="font-size:9px;color:var(--muted);font-weight:600">${points[points.length-1].shortLabel||points[points.length-1].label}</span>`;
  }
}

function renderHourlyChart(orders){
  const hourMap={};
  for(let h=7;h<=19;h++) hourMap[h]=0;
  orders.forEach(o=>{const h=o.time.getHours();if(hourMap[h]!==undefined)hourMap[h]++;});
  const points=Object.entries(hourMap).map(([h,v])=>{
    const hNum=parseInt(h);
    const shortLbl=`${hNum>12?hNum-12:hNum}${hNum>=12?'p':'a'}`;
    const fullLbl=`${hNum>12?hNum-12:(hNum===0?12:hNum)}:00 ${hNum>=12?'PM':'AM'}`;
    return {label:fullLbl, shortLabel:shortLbl, v:parseInt(v)};
  });
  requestAnimationFrame(()=>drawLineChart('hourlyCanvas',points,'#1a9e5c','#1a9e5c',90));
  const labEl=document.getElementById('hourlyLabels');
  labEl.innerHTML=`<span style="font-size:9px;color:var(--muted);font-weight:600">${points[0].shortLabel||points[0].label}</span><span style="font-size:9px;color:var(--muted);font-weight:600">${points[points.length-1].shortLabel||points[points.length-1].label}</span>`;
}

function renderOrderTypeDonut(dine,take){
  const total=dine+take||1;
  const circ=2*Math.PI*35;
  const dA=circ*(dine/total), tA=circ*(take/total);
  document.getElementById('donutDine').setAttribute('stroke-dasharray',`${dA} ${circ-dA}`);
  document.getElementById('donutDine').setAttribute('stroke-dashoffset','0');
  document.getElementById('donutTake').setAttribute('stroke-dasharray',`${tA} ${circ-tA}`);
  document.getElementById('donutTake').setAttribute('stroke-dashoffset',`-${dA}`);
  document.getElementById('donutPct').textContent=dine+take;
  document.getElementById('legDine').textContent=dine;
  document.getElementById('legTake').textContent=take;
}

function renderTopSellers(itemMap){
  document.getElementById('topSellerPeriod').textContent=
    currentPeriod==='today'?'Today':currentPeriod==='week'?'This Week':'This Month';
  const sorted=Object.entries(itemMap).sort((a,b)=>b[1].qty-a[1].qty).slice(0,7);
  const maxQ=sorted[0]?sorted[0][1].qty:1;
  const el=document.getElementById('topSellersList');
  if(!sorted.length){el.innerHTML='<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">No sales yet.</div>';return;}
  el.innerHTML=sorted.map(([name,data],i)=>`
    <div class="seller-row">
      <div class="seller-rank">${i+1}</div>
      <div class="seller-name">${name}</div>
      <div class="seller-bar-wrap"><div class="seller-bar" style="width:${Math.round(data.qty/maxQ*100)}%"></div></div>
      <div class="seller-qty">${data.qty}</div>
    </div>`).join('');
}

function renderPaymentBreakdown(orders){
  const map={cash:0,gcash:0,paymaya:0};
  orders.forEach(o=>{if(map[o.payment]!==undefined)map[o.payment]+=o.total;});
  const total=Object.values(map).reduce((s,v)=>s+v,0.01);
  const el=document.getElementById('payBreakdown');
  if(!Object.values(map).some(v=>v>0)){el.innerHTML='<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">No data.</div>';return;}
  el.innerHTML='<div class="pay-list">'+[
    {key:'cash',   icon:'💵',name:'Cash',   color:'#1a9e5c'},
    {key:'gcash',  icon:'📱',name:'GCash',  color:'#2563eb'},
    {key:'paymaya',icon:'💜',name:'PayMaya',color:'#7c3aed'},
  ].map(r=>`
    <div class="pay-row">
      <div class="pay-icon">${r.icon}</div>
      <div class="pay-name">${r.name}</div>
      <div class="pay-bar-wrap"><div class="pay-bar" style="width:${Math.round(map[r.key]/total*100)}%;background:${r.color}"></div></div>
      <div class="pay-val">${php(map[r.key])}</div>
    </div>`).join('')+'</div>';
}

function renderRecentOrders(orders){
  /* Show latest 9 only */
  const recent=[...orders].sort((a,b)=>b.time-a.time).slice(0,9);
  const tbody=document.getElementById('recentOrdersBody');
  if(!recent.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">No orders yet.</td></tr>';return;}
  tbody.innerHTML=recent.map(o=>`<tr>
    <td style="font-weight:700;color:var(--primary)">#${o.id}</td>
    <td style="font-weight:600">${o.customer}</td>
    <td style="color:var(--muted);font-size:11px;max-width:140px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${o.items.map(it=>`${it.name}×${it.qty}`).join(', ')}</td>
    <td><span class="badge badge-${o.orderType==='dine-in'?'dine':'take'}">${o.orderType==='dine-in'?'🍽 Dine':'🥡 Take'}</span></td>
    <td>${payBadge(o.payment)}</td>
    <td style="font-weight:700;color:var(--green)">${php(o.total)}</td>
    <td style="color:var(--muted)">${o.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
  </tr>`).join('');
}

function renderCategoryBreakdown(itemMap){
  const catMap={};
  Object.entries(itemMap).forEach(([,data])=>{
    const cat=data.category||'other';
    if(!catMap[cat])catMap[cat]={rev:0,qty:0};
    catMap[cat].rev+=data.rev; catMap[cat].qty+=data.qty;
  });
  const sorted=Object.entries(catMap).sort((a,b)=>b[1].rev-a[1].rev);
  const el=document.getElementById('catBreakdown');
  if(!sorted.length){el.innerHTML='<div style="color:var(--muted);font-size:12px;text-align:center;padding:8px">No data.</div>';return;}
  el.innerHTML=sorted.map(([cat,data])=>{
    const m=CAT_META[cat]||{emoji:'📦',label:cat};
    return `<div class="summary-item"><span>${m.emoji} ${m.label}</span><span style="font-weight:700">${php(data.rev)}</span></div>`;
  }).join('');
}

/* ════════════════════════════════════════
   ALL ORDERS — now a full page via sidebar tab
   openAllOrders() navigates there directly
════════════════════════════════════════ */
function openAllOrders(){
  navigateTo('orders');
}

/* ════════════════════════════════════════
   ORDERS PAGE — Transaction History
════════════════════════════════════════ */

/* Order status: stored per order id — default 'completed' */
const orderStatus = {}; // id → 'completed'|'refunded'|'voided'
function getStatus(o){ return orderStatus[o.id]||'completed'; }

function resetOrdFilters(){
  document.getElementById('txnPayFilter').value='all';
  document.getElementById('txnTypeFilter').value='all';
  document.getElementById('ordSearch').value='';
  // update select visual
  ['txnPayFilter','txnTypeFilter'].forEach(id=>{
    document.getElementById(id).classList.remove('active-filter');
  });
  renderOrdersPage();
}

function clearOrdDates(){
  const now=new Date();
  const from=new Date(now); from.setDate(from.getDate()-59);
  document.getElementById('ordFrom').value=fmtDateISO(from);
  document.getElementById('ordTo').value=fmtDateISO(now);
  ordPage=0;
  renderOrdersPage();
}

function initOrdersPage(){
  const now=new Date();
  const from=new Date(now); from.setDate(from.getDate()-29);
  if(!document.getElementById('ordFrom').value)
    document.getElementById('ordFrom').value=fmtDateISO(from);
  if(!document.getElementById('ordTo').value)
    document.getElementById('ordTo').value=fmtDateISO(now);
  ordPage=0;
  renderOrdersPage();
}

function renderOrdersPage(){
  const q=(document.getElementById('ordSearch').value||'').toLowerCase().trim();
  const fromVal=document.getElementById('ordFrom').value;
  const toVal=document.getElementById('ordTo').value;
  const payF=document.getElementById('txnPayFilter').value;
  const typeF=document.getElementById('txnTypeFilter').value;

  // Update select active styling
  document.getElementById('txnPayFilter').classList.toggle('active-filter', payF!=='all');
  document.getElementById('txnTypeFilter').classList.toggle('active-filter', typeF!=='all');

  // ── KPI base: date + dropdown filters only — NOT affected by search ──
  let kpiBase=[...allOrders];
  if(fromVal) kpiBase=kpiBase.filter(o=>o.time>=new Date(fromVal+'T00:00:00'));
  if(toVal)   kpiBase=kpiBase.filter(o=>o.time<=new Date(toVal+'T23:59:59'));
  if(payF!=='all')  kpiBase=kpiBase.filter(o=>o.payment===payF);
  if(typeF!=='all') kpiBase=kpiBase.filter(o=>o.orderType===typeF);

  const totalRev=kpiBase.reduce((s,o)=>s+o.total,0);
  const totalTax=kpiBase.reduce((s,o)=>s+o.tax,0);
  const totalSub=kpiBase.reduce((s,o)=>s+o.subtotal,0);
  const dine=kpiBase.filter(o=>o.orderType==='dine-in').length;
  const take=kpiBase.filter(o=>o.orderType==='takeout').length;
  const tot=kpiBase.length;
  document.getElementById('okTotal').textContent=tot;
  document.getElementById('okPeriod').textContent=fromVal&&toVal?`${fromVal} → ${toVal}`:'All time';
  document.getElementById('okRevenue').textContent=php(totalRev);
  document.getElementById('okAvg').textContent=`Avg ${php(tot?totalRev/tot:0)}`;
  document.getElementById('okDine').textContent=dine;
  document.getElementById('okDinePct').textContent=`${tot?Math.round(dine/tot*100):0}% of orders`;
  document.getElementById('okTake').textContent=take;
  document.getElementById('okTakePct').textContent=`${tot?Math.round(take/tot*100):0}% of orders`;
  document.getElementById('okVat').textContent=php(totalTax);
  document.getElementById('okNet').textContent=`Net ${php(totalSub)}`;

  // ── Table rows: also apply search ──
  let filtered=[...kpiBase];
  if(q) filtered=filtered.filter(o=>
    o.customer.toLowerCase().includes(q)||
    String(o.id).includes(q)||
    o.items.some(it=>it.name.toLowerCase().includes(q))
  );
  filtered.sort((a,b)=>b.time-a.time);

  const rc=document.getElementById('txnResultCount');
  if(rc) rc.textContent=q?`${filtered.length} result${filtered.length!==1?'s':''} for "${q}"`:`${tot} order${tot!==1?'s':''}`;

  /* ── Paginate flat list, then group visible slice by week ── */
  const totalOrds = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalOrds / ORD_PAGE_SIZE));
  ordPage = Math.min(ordPage, totalPages - 1);
  const pageStart = ordPage * ORD_PAGE_SIZE;
  const pageEnd   = pageStart + ORD_PAGE_SIZE;
  const pageSlice = filtered.slice(pageStart, pageEnd);

  // Update footer
  const ordPageInfo = document.getElementById('ordPageInfo');
  const ordPageNum  = document.getElementById('ordPageNum');
  const ordPrev     = document.getElementById('ordPrev');
  const ordNext     = document.getElementById('ordNext');
  if(ordPageInfo) ordPageInfo.textContent = `Showing ${pageStart+1}–${Math.min(pageEnd,totalOrds)} of ${totalOrds} order${totalOrds!==1?'s':''}`;
  if(ordPageNum)  ordPageNum.textContent  = `Page ${ordPage+1} / ${totalPages}`;
  if(ordPrev)     ordPrev.disabled  = ordPage===0;
  if(ordNext)     ordNext.disabled  = ordPage>=totalPages-1;

  const tbody = document.getElementById('ordersPageBody');
  if(!pageSlice.length){
    tbody.innerHTML=`<tr><td colspan="10" class="txn-empty">No transactions match your filters.</td></tr>`;
    return;
  }

  function getWeekKey(d){
    const dd=new Date(d); dd.setHours(0,0,0,0);
    const day=dd.getDay()||7;
    dd.setDate(dd.getDate()-day+1);
    return fmtDateISO(dd);
  }
  function getWeekEnd(monStr){
    const d=new Date(monStr+'T00:00:00'); d.setDate(d.getDate()+6); return d;
  }

  // Group the current page's orders by week
  const weekMap={};
  pageSlice.forEach(o=>{
    const wk=getWeekKey(o.time);
    if(!weekMap[wk])weekMap[wk]=[];
    weekMap[wk].push(o);
  });

  const weekKeys=Object.keys(weekMap).sort().reverse();
  let html='';
  weekKeys.forEach((wk,wi)=>{
    const wOrders=weekMap[wk];
    const wRev=wOrders.reduce((s,o)=>s+o.total,0);
    const monDate=new Date(wk+'T00:00:00');
    const sunDate=getWeekEnd(wk);
    const rangeStr=`${monDate.toLocaleDateString([],{month:'short',day:'numeric'})} – ${sunDate.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}`;
    const gid=`txwg-${ordPage}-${wi}`;
    const isFirst=true; // always expanded on current page

    html+=`<tr class="txn-week-hdr">
      <td colspan="11">
        <div class="txn-week-hdr-inner">
          <div class="txn-week-hdr-left">
            <span class="txn-week-name">Week of ${monDate.toLocaleDateString([],{month:'long',day:'numeric'})}</span>
            <span class="txn-week-range">${rangeStr}</span>
          </div>
          <div class="txn-week-right">
            <span class="txn-week-rev">${php(wRev)}</span>
            <span class="txn-week-cnt">${wOrders.length} order${wOrders.length!==1?'s':''}</span>
          </div>
        </div>
      </td>
    </tr>`;

    wOrders.forEach(o=>{
      const st=getStatus(o);
      const stClass=`txn-status-${st}`;
      const stLabel=st==='completed'?'✅ Completed':'↩ Refunded';
      const isRefunded=st==='refunded';
      html+=`<tr class="${gid}" data-order-id="${o.id}">
        <td><span class="txn-order-num">#${o.id}</span></td>
        <td><span class="txn-customer">${o.customer}</span></td>
        <td><span class="txn-cashier" title="Served by ${o.cashier||'—'}">${o.cashier||'—'}</span></td>
        <td><span class="txn-items" title="${o.items.map(it=>`${it.name}×${it.qty}`).join(', ')}">${o.items.map(it=>`${it.name}×${it.qty}`).join(', ')}</span></td>
        <td>${payBadge(o.payment)}</td>
        <td class="txn-subtotal">${php(o.subtotal)}</td>
        <td class="txn-vat">${php(o.tax)}</td>
        <td class="txn-total">${php(o.total)}</td>
        <td class="txn-dt-cell" style="font-size:11px;color:var(--muted);">${o.time.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}<br>${o.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
        <td><span class="txn-status-badge ${stClass}">${stLabel}</span></td>
        <td>
          <div class="txn-actions">
            <button class="txn-act-receipt" onclick="openReceipt(${o.id})">📋 Receipt</button>
            ${!isRefunded?`<button class="txn-act-refund" onclick="confirmRefund(${o.id},'${o.customer}')">↩ Refund</button>`:''}
          </div>
        </td>
      </tr>`;
    });
  });

  tbody.innerHTML=html;
}


function markOrder(id,status){
  orderStatus[id]=status;
  addAudit(`Order #${id} marked as Refunded`,'edit');
  const o = allOrders.find(x=>x.id===id);
  const itemName = o && o.items && o.items[0] ? o.items[0].name : null;
  pushNotif(`↩ Order #${id} Refunded`,'📋',{orderId:id, itemName});
  toast(`✓ Order #${id} Refunded`);
  renderOrdersPage();
}

function confirmRefund(id, customer){
  const o = allOrders.find(x=>x.id===id);
  const sub = document.getElementById('refundConfirmSub');
  if(sub && o) sub.textContent = `Refund order #${id} for ${customer} (${php(o.total)})?`;
  const okBtn = document.getElementById('refundConfirmOk');
  okBtn.onclick = ()=>{ closeRefundConfirm(); markOrder(id,'refunded'); };
  document.getElementById('refundConfirmOverlay').classList.add('open');
}
function closeRefundConfirm(){
  document.getElementById('refundConfirmOverlay').classList.remove('open');
}
document.getElementById('refundConfirmOverlay').addEventListener('click',e=>{
  if(e.target===e.currentTarget) closeRefundConfirm();
});

/* Receipt modal */
function openReceipt(id){
  const o=allOrders.find(x=>x.id===id);
  if(!o) return;
  const st=getStatus(o);
  document.getElementById('receiptBody').innerHTML=`
    <div class="receipt-store">
      <div class="receipt-store-name">${STORE_NAME}</div>
      <div class="receipt-store-sub">Official Receipt</div>
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row"><span>Order #</span><span style="font-weight:700;color:var(--primary)">#${o.id}</span></div>
    <div class="receipt-row"><span>Date</span><span>${o.time.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}</span></div>
    <div class="receipt-row"><span>Time</span><span>${o.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>
    <div class="receipt-row"><span>Customer</span><span style="font-weight:700">${o.customer}</span></div>
    <div class="receipt-row"><span>Type</span><span>${o.orderType==='dine-in'?'🍽 Dine-In':'🥡 Takeout'}</span></div>
    <div class="receipt-row"><span>Payment</span><span>${payLabel(o.payment)}</span></div>
    <hr class="receipt-divider"/>
    <div class="receipt-items">
      ${o.items.map(it=>`<div class="receipt-item-row"><span>${it.name} × ${it.qty}</span><span>${php(it.price*it.qty)}</span></div>`).join('')}
    </div>
    <hr class="receipt-divider"/>
    <div class="receipt-row bold"><span>Subtotal</span><span>${php(o.subtotal)}</span></div>
    <div class="receipt-row"><span style="color:var(--muted)">VAT (12%)</span><span style="color:var(--muted)">${php(o.tax)}</span></div>
    <div class="receipt-row total"><span>TOTAL</span><span>${php(o.total)}</span></div>
    <div class="receipt-footer">Status: <strong style="color:var(--${st==='completed'?'green':st==='refunded'?'amber':'red'})">${st.toUpperCase()}</strong><br/>${STORE_NAME} · Thank you!</div>`;
  document.getElementById('receiptOverlay').classList.add('open');
}
function closeReceipt(){document.getElementById('receiptOverlay').classList.remove('open');}
document.getElementById('receiptOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeReceipt();});

/* ════════════════════════════════════════
   EXPORT — Microsoft Word .docx report
   Uses pure Office Open XML built in-browser
════════════════════════════════════════ */
function exportReport(){
  const orders=getFilteredOrders();
  if(!orders.length){toast('⚠ No orders to export');return;}
  toast('📄 Building Word document…',3500);

  const sorted=[...orders].sort((a,b)=>a.time-b.time);
  const periodLabel=currentPeriod==='today'?'Today':currentPeriod==='week'?'This Week':'This Month';
  const genDate=new Date().toLocaleString();

  const totalRev=sorted.reduce((s,o)=>s+o.total,0);
  const totalSub=sorted.reduce((s,o)=>s+o.subtotal,0);
  const totalTax=sorted.reduce((s,o)=>s+o.tax,0);
  const avg=totalRev/sorted.length;
  const dineIn=sorted.filter(o=>o.orderType==='dine-in').length;
  const takeout=sorted.filter(o=>o.orderType==='takeout').length;
  const cashRev=sorted.filter(o=>o.payment==='cash').reduce((s,o)=>s+o.total,0);
  const gcashRev=sorted.filter(o=>o.payment==='gcash').reduce((s,o)=>s+o.total,0);
  const paymayaRev=sorted.filter(o=>o.payment==='paymaya').reduce((s,o)=>s+o.total,0);

  const itemMap={};
  sorted.forEach(o=>o.items.forEach(it=>{
    if(!itemMap[it.name])itemMap[it.name]={qty:0,rev:0,category:it.category};
    itemMap[it.name].qty+=it.qty; itemMap[it.name].rev+=it.price*it.qty;
  }));
  const topItems=Object.entries(itemMap).sort((a,b)=>b[1].qty-a[1].qty);
  const catMap={};
  topItems.forEach(([,d])=>{
    const c=d.category||'other';
    if(!catMap[c])catMap[c]={rev:0,qty:0};
    catMap[c].rev+=d.rev; catMap[c].qty+=d.qty;
  });

  /* ── OOXML helpers ── */
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const twips=n=>Math.round(n*1440); // inches → twips

  function wPara(runs,opts={}){
    const jc=opts.align?`<w:jc w:val="${opts.align}"/>`:'';
    const spacing=opts.spaceBefore||opts.spaceAfter?`<w:spacing w:before="${opts.spaceBefore||0}" w:after="${opts.spaceAfter||80}"/>`:`<w:spacing w:after="80"/>`;
    const shading=opts.shading?`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`:'';
    const pPr=`<w:pPr>${spacing}${jc}${shading}</w:pPr>`;
    return `<w:p>${pPr}${runs}</w:p>`;
  }
  function wRun(text,opts={}){
    const b=opts.bold?'<w:b/>':'';
    const sz=opts.size?`<w:sz w:val="${opts.size*2}"/><w:szCs w:val="${opts.size*2}"/>`:'';
    const color=opts.color?`<w:color w:val="${opts.color}"/>`:'';
    const font=`<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>`;
    return `<w:r><w:rPr>${font}${b}${sz}${color}</w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }
  function wCell(content,opts={}){
    const w=opts.width?`<w:tcW w:w="${opts.width}" w:type="dxa"/>`:'<w:tcW w:w="1500" w:type="dxa"/>';
    const shd=opts.shading?`<w:shd w:val="clear" w:color="auto" w:fill="${opts.shading}"/>`:'';
    const vAlign=`<w:vAlign w:val="center"/>`;
    const bdr=`<w:tcBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
    </w:tcBorders>`;
    const margins=`<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>`;
    return `<w:tc><w:tcPr>${w}${bdr}${shd}${vAlign}${margins}</w:tcPr>${content}</w:tc>`;
  }
  function wRow(cells){ return `<w:tr>${cells}</w:tr>`; }
  function wTable(rows,widths){
    const colDefs=widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('');
    const totalW=widths.reduce((a,b)=>a+b,0);
    return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="${totalW}" w:type="dxa"/>
        <w:tblBorders>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>${colDefs}</w:tblGrid>
      ${rows}
    </w:tbl>`;
  }
  function headerRow(labels,widths,bg='C8501A'){
    return wRow(labels.map((l,i)=>wCell(
      wPara(wRun(l,{bold:true,size:9,color:'FFFFFF'}),{align:'left',spaceBefore:0,spaceAfter:0}),
      {width:widths[i],shading:bg}
    )));
  }
  function dataRow(vals,widths,bg=''){
    return wRow(vals.map((v,i)=>wCell(
      wPara(wRun(String(v),{size:9}),{align:'left',spaceBefore:0,spaceAfter:0}),
      {width:widths[i],shading:bg||'FFFFFF'}
    )));
  }
  function sectionHeading(text){
    return wPara(wRun(text,{bold:true,size:13,color:'C8501A'}),{spaceBefore:220,spaceAfter:100});
  }
  function subLine(label,value){
    return wPara(
      wRun(label+': ',{bold:true,size:10})+wRun(value,{size:10}),
      {spaceAfter:40}
    );
  }
  function divider(){
    return `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C8501A"/></w:pBdr><w:spacing w:before="80" w:after="80"/></w:pPr></w:p>`;
  }

  /* ── Build document body ── */
  let body='';

  // Title
  body+=wPara(wRun(STORE_NAME,{bold:true,size:22,color:'C8501A'}),{align:'center',spaceBefore:0,spaceAfter:40});
  body+=wPara(wRun('Sales Report — '+periodLabel,{bold:true,size:14,color:'3A3028'}),{align:'center',spaceAfter:40});
  body+=wPara(wRun('Generated: '+genDate+'   ·   Prepared by: '+OWNER_NAME,{size:9,color:'8A8278'}),{align:'center',spaceAfter:20});
  body+=divider();

  // Executive Summary
  body+=sectionHeading('Executive Summary');
  const sumW=[3600,2100];
  body+=wTable([
    headerRow(['Metric','Value'],sumW),
    dataRow(['Total Orders',sorted.length],sumW),
    dataRow(['Gross Revenue','PHP '+totalRev.toFixed(2)],sumW,'F9F6F3'),
    dataRow(['VAT Collected (12%)','PHP '+totalTax.toFixed(2)],sumW),
    dataRow(['Net Revenue (excl. VAT)','PHP '+totalSub.toFixed(2)],sumW,'F9F6F3'),
    dataRow(['Average Order Value','PHP '+avg.toFixed(2)],sumW),
    dataRow(['Dine-In Orders',dineIn],sumW,'F9F6F3'),
    dataRow(['Takeout Orders',takeout],sumW),
    dataRow(['Cash Revenue','PHP '+cashRev.toFixed(2)],sumW,'F9F6F3'),
    dataRow(['GCash Revenue','PHP '+gcashRev.toFixed(2)],sumW),
    dataRow(['PayMaya Revenue','PHP '+paymayaRev.toFixed(2)],sumW,'F9F6F3'),
  ],sumW);

  // Product Sales
  body+=sectionHeading('Product Sales Breakdown');
  const prodW=[340,2200,1200,700,1000,720];
  body+=wTable([
    headerRow(['#','Product','Category','Qty','Revenue (PHP)','% Revenue'],prodW),
    ...topItems.map(([name,data],i)=>{
      const m=CAT_META[data.category]||{label:data.category};
      return dataRow([i+1,name,m.label,data.qty,'PHP '+data.rev.toFixed(2),((data.rev/totalRev)*100).toFixed(1)+'%'],prodW,i%2?'F9F6F3':'FFFFFF');
    })
  ],prodW);

  // Category Breakdown
  body+=sectionHeading('Sales by Category');
  const catW=[2200,1000,1400,720];
  body+=wTable([
    headerRow(['Category','Items Sold','Revenue (PHP)','% Revenue'],catW),
    ...Object.entries(catMap).sort((a,b)=>b[1].rev-a[1].rev).map(([cat,data],i)=>{
      const m=CAT_META[cat]||{label:cat};
      return dataRow([m.label,data.qty,'PHP '+data.rev.toFixed(2),((data.rev/totalRev)*100).toFixed(1)+'%'],catW,i%2?'F9F6F3':'FFFFFF');
    })
  ],catW);

  // All Orders Detail
  body+=sectionHeading('All Orders Detail');
  const ordW=[520,580,660,900,680,660,680,730,680];
  body+=wTable([
    headerRow(['Order#','Date','Time','Customer','Items','Type','Payment','Subtotal','Total'],ordW),
    ...sorted.map((o,i)=>{
      const itemStr=o.items.map(it=>`${it.name} x${it.qty}`).join(', ');
      return dataRow([
        '#'+o.id,
        o.time.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'}),
        o.time.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
        o.customer, itemStr,
        o.orderType==='dine-in'?'Dine-In':'Takeout',
        o.payment==='cash'?'Cash':o.payment==='gcash'?'GCash':'PayMaya',
        'PHP '+o.subtotal.toFixed(2),
        'PHP '+o.total.toFixed(2)
      ],ordW,i%2?'F9F6F3':'FFFFFF');
    }),
    // Totals row
    wRow(ordW.map((w,i)=>wCell(
      wPara(wRun(i===0?'TOTALS':i===7?'PHP '+totalSub.toFixed(2):i===8?'PHP '+totalRev.toFixed(2):'',{bold:true,size:9,color:'C8501A'}),{spaceAfter:0}),
      {width:w,shading:'F4EDE8'}
    )))
  ],ordW);

  /* ── Assemble the full OOXML document ── */
  const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 wp14">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;

  const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="20"/><w:szCs w:val="20"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const contentTypesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const appRelsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  /* ── Build ZIP (docx) in-browser using pure JS ── */
  // Use JSZip loaded from CDN
  if(typeof JSZip==='undefined'){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload=()=>_buildAndDownloadDocx(documentXml,relsXml,stylesXml,contentTypesXml,appRelsXml,periodLabel);
    document.head.appendChild(s);
  } else {
    _buildAndDownloadDocx(documentXml,relsXml,stylesXml,contentTypesXml,appRelsXml,periodLabel);
  }
}

async function _buildAndDownloadDocx(docXml,relsXml,stylesXml,ctXml,appRels,label){
  try{
    const zip=new JSZip();
    zip.file('[Content_Types].xml',ctXml);
    zip.file('_rels/.rels',appRels);
    zip.file('word/document.xml',docXml);
    zip.file('word/styles.xml',stylesXml);
    zip.file('word/_rels/document.xml.rels',relsXml);
    const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`TriadCoffee_SalesReport_${label.replace(/\s/g,'')}_${fmtDateISO(new Date())}.docx`;
    a.click();
    toast('📄 Word report downloaded!');
  }catch(e){
    toast('⚠ Export failed: '+e.message);
    console.error(e);
  }
}

/* ════════════════════════════════════════
   APPEARANCE
════════════════════════════════════════ */
const THEMES=[
  {id:'dark',    name:'Dark',    colors:{s:'#221e19',t:'#1a1410',c:'#151210',p:'#e0622a'}},
  {id:'light',   name:'Classic', colors:{s:'#ffffff',t:'#f4f2ee',c:'#e8e4de',p:'#c8501a'}},
  {id:'espresso',name:'Espresso',colors:{s:'#251a0e',t:'#1c1209',c:'#140e06',p:'#d4622a'}},
  {id:'blush',   name:'Latte',   colors:{s:'#fff9f5',t:'#fdf6f0',c:'#f0e0d8',p:'#c0392b'}},
  {id:'sage',    name:'Matcha',  colors:{s:'#f5faf1',t:'#eef3e8',c:'#dce8d4',p:'#4a7c3f'}},
];
const ACCENT_COLORS=[
  '#e05a1a','#c8501a','#d4622a','#a04828','#4a7c3f','#2563eb','#7c3aed'
];

// Saved state (committed)
let currentTheme    = localStorage.getItem('tcr-theme')||'light';
let currentAccent   = localStorage.getItem('tcr-accent')||'';
let currentBright   = parseInt(localStorage.getItem('tcr-bright'))||100;
let currentContrast = parseInt(localStorage.getItem('tcr-contrast'))||100;

// Pending state (shown while modal is open, NOT yet saved)
let pendingTheme, pendingAccent, pendingBright, pendingContrast;

function _applyVisual(theme, accent, bright, contrast){
  document.documentElement.setAttribute('data-theme', theme);
  const accentVal = accent || THEMES.find(t=>t.id===theme)?.colors.p || '#c8501a';
  document.documentElement.style.setProperty('--primary', accentVal);
  // derive pl/pm from accent
  const hex2rgb = h=>{const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return`${r},${g},${b}`;};
  try{const rgb=hex2rgb(accentVal);document.documentElement.style.setProperty('--pl',`rgba(${rgb},.12)`);document.documentElement.style.setProperty('--pm',`rgba(${rgb},.25)`);}catch(e){}
  const filterVal = (bright===100&&contrast===100) ? '' : `brightness(${bright/100}) contrast(${contrast/100})`;
  document.querySelectorAll('.page').forEach(pg => pg.style.filter = filterVal);
}

function openAppear(){
  // Snapshot current saved into pending
  pendingTheme    = currentTheme;
  pendingAccent   = currentAccent;
  pendingBright   = currentBright;
  pendingContrast = currentContrast;
  document.getElementById('apBrightness').value = pendingBright;
  document.getElementById('apContrast').value   = pendingContrast;
  document.getElementById('apBrightnessVal').textContent = pendingBright+'%';
  document.getElementById('apContrastVal').textContent   = pendingContrast+'%';
  renderAppear();
  document.getElementById('appearOverlay').classList.add('open');
}

function cancelAppear(){
  // Revert to saved state visually
  _applyVisual(currentTheme, currentAccent, currentBright, currentContrast);
  document.getElementById('appearOverlay').classList.remove('open');
}

function saveAppear(){
  // Commit pending → saved
  currentTheme    = pendingTheme;
  currentAccent   = pendingAccent;
  currentBright   = pendingBright;
  currentContrast = pendingContrast;
  localStorage.setItem('tcr-theme',   currentTheme);
  localStorage.setItem('tcr-accent',  currentAccent);
  localStorage.setItem('tcr-bright',  currentBright);
  localStorage.setItem('tcr-contrast',currentContrast);
  _applyVisual(currentTheme, currentAccent, currentBright, currentContrast);
  document.getElementById('appearOverlay').classList.remove('open');
  renderDashboard();
  toast('✓ Appearance saved!');
}

document.getElementById('appearOverlay').addEventListener('click', e=>{
  if(e.target===e.currentTarget) cancelAppear();
});

function selectPendingTheme(id){
  pendingTheme = id;
  // Reset accent when switching theme so theme default shows
  pendingAccent = '';
  _applyVisual(pendingTheme, pendingAccent, pendingBright, pendingContrast);
  renderAppear();
}

function selectPendingAccent(color){
  pendingAccent = color;
  _applyVisual(pendingTheme, pendingAccent, pendingBright, pendingContrast);
  renderAppear();
}

function previewBrightness(v){
  pendingBright = parseInt(v);
  document.getElementById('apBrightnessVal').textContent = v+'%';
  _applyVisual(pendingTheme, pendingAccent, pendingBright, pendingContrast);
}

function previewContrast(v){
  pendingContrast = parseInt(v);
  document.getElementById('apContrastVal').textContent = v+'%';
  _applyVisual(pendingTheme, pendingAccent, pendingBright, pendingContrast);
}

function renderAppear(){
  // Theme cards
  document.getElementById('apThemeGrid').innerHTML = THEMES.map(t=>`
    <div class="ap-theme-card${t.id===pendingTheme?' selected':''}" onclick="selectPendingTheme('${t.id}')">
      ${t.id===pendingTheme?'<div class="ap-theme-check">✓</div>':''}
      <div class="ap-theme-preview">
        <div class="ap-theme-sidebar" style="background:${t.colors.s}"></div>
        <div class="ap-theme-main" style="background:${t.colors.t}">
          <div class="ap-theme-topbar" style="background:${t.colors.s}"></div>
          <div class="ap-theme-content" style="background:${t.colors.c}"></div>
        </div>
      </div>
      <div class="ap-theme-name">${t.name}</div>
    </div>`).join('');
  // Accent preview
  const effectiveAccent = pendingAccent || THEMES.find(t=>t.id===pendingTheme)?.colors.p || '#c8501a';
  document.getElementById('apAccentPreview').style.background = effectiveAccent;
  // Accent swatches
  document.getElementById('apSwatches').innerHTML = ACCENT_COLORS.map(c=>`
    <div class="appear-swatch${c===effectiveAccent?' selected':''}" style="background:${c}" onclick="selectPendingAccent('${c}')"></div>`).join('');
}

// Init visual on page load
_applyVisual(currentTheme, currentAccent, currentBright, currentContrast);

/* ════════════════════════════════════════
   STOCK MANAGER
════════════════════════════════════════ */
function stockStatus(p){
  if(p.type==='manual') return 'ok';
  if(p.qty===0) return 'critical';
  if(p.qty<=p.threshold) return p.qty<=Math.ceil(p.threshold*.5)?'critical':'low';
  return 'ok';
}
function barPct(p){
  if(p.type==='manual') return 100;
  return Math.min(100,Math.round((p.qty/Math.max(p.threshold*3,1))*100));
}

/* ══ STOCK ALERT SOUND SYSTEM ══ */
let _stockAudioCtx = null;
const _prevStockStatus = {}; // productId → last known status

function _playStockBeep(type){
  try{
    if(!_stockAudioCtx) _stockAudioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _stockAudioCtx;

    function ding(freq, startTime, vol=0.5){
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      // Sharp attack, smooth exponential decay — classic "ding"
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.5);
      osc.start(startTime);
      osc.stop(startTime + 1.6);
    }

    const t = ctx.currentTime;
    if(type === 'out'){
      // Out of stock: ding-ding (two strikes)
      ding(1047, t + 0.0,  0.5);
      ding(1047, t + 0.55, 0.4);
    } else {
      // Low stock: single ding
      ding(1047, t + 0.0, 0.4);
    }
  } catch(e){}
}

function _checkStockSoundAlerts(){
  products.forEach(p=>{
    if(p.type !== 'stock') return;
    const current = stockStatus(p);
    const prev    = _prevStockStatus[p.id] || 'ok';

    // Only fire when status gets WORSE (ok→low, ok→critical, low→critical)
    if(current !== prev){
      if(current === 'critical' && prev !== 'critical'){
        _playStockBeep('out');
        // Stock alerts render live from products — no need to push into notifications array
      } else if(current === 'low' && prev === 'ok'){
        _playStockBeep('low');
        // Stock alerts render live from products — no need to push into notifications array
      }
    }
    _prevStockStatus[p.id] = current;
  });
}

function renderStockStats(){
  const tracked=products.filter(p=>p.type==='stock');
  document.getElementById('sTotalSKU').textContent=products.length;
  document.getElementById('sLow').textContent=tracked.filter(p=>stockStatus(p)!=='ok').length;
  document.getElementById('sOk').textContent=tracked.filter(p=>stockStatus(p)==='ok').length;
  document.getElementById('sValue').textContent=php(tracked.reduce((s,p)=>s+p.qty*p.cost,0));
  _checkStockSoundAlerts(); // 🔔 check and play beep on new stock issues
  updateBellBadge();
}
const INV_PAGE_SIZE = 10;
let invPage = 0; // current page (0-indexed)

const ORD_PAGE_SIZE = 15;
let ordPage = 0;
function ordChangePage(dir){
  ordPage += dir;
  renderOrdersPage();
  const pg=document.getElementById('page-orders');
  if(pg) pg.scrollTop=0;
}

function setFilter(f){
  stockFilter=f;
  invPage=0;
  ['all','low'].forEach(x=>{const el=document.getElementById('chip-'+x);if(el)el.classList.toggle('active',x===f);});
  renderTable();
}

/* Build a flat list of rows respecting category grouping and current filter/search */
function buildInvRows(allProds){
  const q=document.getElementById('searchInput')?document.getElementById('searchInput').value.toLowerCase():'';
  const catSel=document.getElementById('invCatFilter')?document.getElementById('invCatFilter').value:'all';
  const catOrder=['hot-coffee','iced-coffee','espresso','frappe','tea','pastries','beans'];
  // Collect matching products per category
  const sections=[];
  catOrder.forEach(cat=>{
    if(catSel!=='all'&&catSel!==cat) return;
    const catProds=allProds.filter(p=>{
      if(p.category!==cat) return false;
      const s=stockStatus(p);
      if(stockFilter==='low'&&s==='ok') return false;
      if(q&&!p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if(catProds.length) sections.push({cat,prods:catProds});
  });
  return sections;
}

function renderProductRows(sections, highlightAll){
  let html='';
  sections.forEach(({cat,prods})=>{
    const m=CAT_META[cat]||{emoji:'📦',label:cat};
    html+=`<tr class="cat-group-header"><td colspan="6">${m.emoji} ${m.label}</td></tr>`;
    prods.forEach(p=>{
      const s=stockStatus(p);
      const pct=barPct(p);
      const bc=s==='ok'?'bar-green':s==='low'?'bar-amber':'bar-red';
      const bdc=s==='ok'?'qbadge-ok':s==='low'?'qbadge-low':'qbadge-out';
      const bdi=s==='ok'?'✓':s==='low'?'⚠':'✕';
      const rs=s!=='ok'?(s==='critical'?`style="border-color:var(--red);color:var(--red);background:var(--rl)"`:
                                         `style="border-color:var(--amber);color:var(--amber);background:var(--al)"`):'';
      html+=`<tr data-prod-name="${p.name}">
        <td><div class="prod-name">${p.name}</div></td>
        <td><span class="type-tag type-${p.type}">${p.type==='stock'?'Tracked':'Manual'}</span></td>
        <td>${p.type==='stock'?`<div class="bar-wrap"><div class="bar-fill ${bc}" style="width:${pct}%"></div></div>`:'<span style="color:var(--muted);font-size:11px">N/A</span>'}</td>
        <td><span class="qbadge ${bdc}">${bdi} ${p.type==='manual'?'—':p.qty+' '+p.unit}</span></td>
        <td style="font-size:12px;font-weight:700;color:var(--muted)">${p.type==='manual'?'—':p.threshold}</td>
        <td><div class="row-actions">
          <button class="mini-btn" onclick="openEditModal(${p.id})">✏ Edit</button>
          ${p.type==='stock'?`<button class="mini-btn ${s!=='ok'?'danger':''}" ${rs} onclick="focusRestock(${p.id})">＋ Stock</button>`:''}
        </div></td></tr>`;
    });
  });
  return html;
}

function renderTable(){
  const tbody=document.getElementById('tableBody');
  const sections=buildInvRows(products);
  // Flatten all products across sections to get total count for pagination
  const allFlat=sections.flatMap(s=>s.prods);
  const total=allFlat.length;
  const totalPages=Math.max(1,Math.ceil(total/INV_PAGE_SIZE));
  invPage=Math.min(invPage,totalPages-1);
  const start=invPage*INV_PAGE_SIZE;
  const end=start+INV_PAGE_SIZE;

  // Slice products per page while keeping category grouping
  let counted=0;
  const pageSections=[];
  for(const {cat,prods} of sections){
    const visible=[];
    for(const p of prods){
      if(counted>=start && counted<end) visible.push(p);
      counted++;
      if(counted>=end) break;
    }
    if(visible.length) pageSections.push({cat,prods:visible});
    if(counted>=end) break;
  }

  const html=renderProductRows(pageSections);
  tbody.innerHTML=html||`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No products match.</td></tr>`;

  // Update pagination footer
  const info=document.getElementById('invPageInfo');
  const pageNum=document.getElementById('invPageNum');
  const prevBtn=document.getElementById('invPrev');
  const nextBtn=document.getElementById('invNext');
  if(info) info.textContent=total?`Showing ${start+1}–${Math.min(end,total)} of ${total} products`:'No products';
  if(pageNum) pageNum.textContent=`Page ${invPage+1} / ${totalPages}`;
  if(prevBtn) prevBtn.disabled=invPage===0;
  if(nextBtn) nextBtn.disabled=invPage>=totalPages-1;
  prevBtn.style.opacity=invPage===0?'.4':'1';
  nextBtn.style.opacity=invPage>=totalPages-1?'.4':'1';
}

function invChangePage(dir){
  const sections=buildInvRows(products);
  const total=sections.flatMap(s=>s.prods).length;
  const totalPages=Math.max(1,Math.ceil(total/INV_PAGE_SIZE));
  invPage=Math.max(0,Math.min(totalPages-1,invPage+dir));
  renderTable();
}

/* ── All Products Modal ── */
function openAllProducts(){
  document.getElementById('allProdSearch').value='';
  document.getElementById('allProdCat').value='all';
  renderAllProductsModal();
  document.getElementById('allProductsOverlay').classList.add('open');
  // Scroll stock page to top
  const pg = document.getElementById('page-stock');
  if(pg) pg.scrollTop = 0;
}
function closeAllProducts(){document.getElementById('allProductsOverlay').classList.remove('open');}
document.getElementById('allProductsOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAllProducts();});
function renderAllProductsModal(){
  const q=document.getElementById('allProdSearch').value.toLowerCase();
  const catSel=document.getElementById('allProdCat').value;
  const catOrder=['hot-coffee','iced-coffee','espresso','frappe','tea','pastries','beans'];
  const sections=[];
  catOrder.forEach(cat=>{
    if(catSel!=='all'&&catSel!==cat) return;
    const prods=products.filter(p=>p.category===cat&&(!q||p.name.toLowerCase().includes(q)));
    if(prods.length) sections.push({cat,prods});
  });
  const html=renderProductRows(sections);
  const body=document.getElementById('allProductsBody');
  const total=sections.flatMap(s=>s.prods).length;
  body.innerHTML=`<div style="overflow-x:auto">
    <div style="padding:8px 16px 4px;font-size:11px;color:var(--muted);font-weight:600">${total} product${total!==1?'s':''} total</div>
    <table style="width:100%;border-collapse:collapse;min-width:500px">
      <thead><tr>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Product</th>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Type</th>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Stock</th>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Qty</th>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Threshold</th>
        <th style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:left;border-bottom:1px solid var(--line);background:var(--bg);white-space:nowrap">Actions</th>
      </tr></thead>
      <tbody>${html||`<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--muted)">No products found.</td></tr>`}</tbody>
    </table>
  </div>`;
}
function renderAlerts(){
  Object.keys(snoozed).forEach(id=>{if(snoozed[id]<=Date.now())delete snoozed[id];});
  const alertable=products.filter(p=>stockStatus(p)!=='ok'&&!dismissed.has(p.id));
  const active=alertable.filter(p=>!(snoozed[p.id]&&snoozed[p.id]>Date.now()));
  const countEl=document.getElementById('alertCount');
  countEl.textContent=active.length>0?`${active.length} alert${active.length>1?'s':''}`:'Clear';
  countEl.style.background=active.length>0?'var(--rl)':'var(--gl)';
  countEl.style.color=active.length>0?'var(--red)':'var(--green)';
  const body=document.getElementById('alertsBody');
  if(!alertable.length){body.innerHTML='<div class="no-alerts">✅ All stocked up!</div>';return;}
  const sorted=[...alertable].sort((a,b)=>{const o={critical:0,low:1};return o[stockStatus(a)]-o[stockStatus(b)];});
  const preview=sorted.slice(0,3);
  body.innerHTML='<div class="alert-list">'+preview.map(p=>{
    const s=stockStatus(p);
    const isSnoozed=snoozed[p.id]&&snoozed[p.id]>Date.now();
    const minsLeft=isSnoozed?Math.ceil((snoozed[p.id]-Date.now())/60000):0;
    return `<div class="alert-item ${s} ${isSnoozed?'snoozed':''}">
      <div class="alert-icon">${s==='critical'?'🔴':'🟡'}</div>
      <div class="alert-body">
        <div class="alert-title">${p.name}${isSnoozed?`<span class="snooze-tag">💤${minsLeft}m</span>`:''}</div>
        <div class="alert-sub">${p.qty} ${p.unit} · threshold ${p.threshold}</div>
        <div class="alert-actions">
          <button class="alert-btn restock" onclick="focusRestock(${p.id})">+Restock</button>
          ${!isSnoozed?`<button class="alert-btn snooze" onclick="snoozeAlert(${p.id})">💤 30m</button>`:`<button class="alert-btn snooze" onclick="unsnooze(${p.id})">Wake</button>`}
          ${!isSnoozed?`<button class="alert-btn dismiss" onclick="dismissAlert(${p.id})">✕</button>`:''}
        </div>
      </div></div>`;
  }).join('')+
  '</div>';
}
function snoozeAlert(id){
  snoozed[id]=Date.now()+30*60*1000;
  const p=byId(id);
  toast(`💤 ${p.name} snoozed 30 min`);
  addAudit(`Snoozed: ${p.name}`,'edit');
  renderAlerts();renderStockStats();
  setTimeout(()=>{renderAlerts();renderStockStats();pushNotif(`⏰ ${p.name} alert reactivated`,'⏰');},30*60*1000);
}
function unsnooze(id){delete snoozed[id];renderAlerts();renderStockStats();}
function dismissAlert(id){dismissed.add(id);toast('✕ Alert dismissed');addAudit(`Dismissed: ${byId(id).name}`,'remove');renderAlerts();renderStockStats();}
function renderRestockDropdown(){
  const stockProducts = products.filter(p=>p.type==='stock');
  const dl = document.getElementById('rProductList');
  if(dl) dl.innerHTML = stockProducts.map(p=>`<option value="${p.name} (${p.qty} ${p.unit})" data-id="${p.id}">`).join('');
  // Pre-fill first product if field is empty
  const txt = document.getElementById('rProduct');
  const hiddenId = document.getElementById('rProductId');
  if(txt && hiddenId && !txt.value && stockProducts.length){
    txt.value = `${stockProducts[0].name} (${stockProducts[0].qty} ${stockProducts[0].unit})`;
    hiddenId.value = stockProducts[0].id;
  }
}
function syncRProductId(){
  const txt = document.getElementById('rProduct').value.trim();
  const opts = document.querySelectorAll('#rProductList option');
  const match = [...opts].find(o => o.value === txt);
  document.getElementById('rProductId').value = match ? match.getAttribute('data-id') : '';
}
let _qrProductId = null;

function openQuickRestock(id){
  const p = byId(id);
  if(!p || p.type !== 'stock'){ toast('ℹ Manual products don\'t need restocking'); return; }
  _qrProductId = id;
  window._qrProductId = id;
  document.getElementById('qrModalTitle').textContent = 'Restock · ' + p.name;
  document.getElementById('qrProductName').textContent = p.name + '  —  Current: ' + p.qty + ' ' + p.unit;
  document.getElementById('qrQty').value = '';
  document.getElementById('qrCost').value = p.cost > 0 ? p.cost : '';
  document.getElementById('qrNote').value = '';
  document.getElementById('quickRestockOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(()=> document.getElementById('qrQty').focus({preventScroll:true}), 120);
}
function closeQuickRestock(){
  document.getElementById('quickRestockOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('quickRestockOverlay').addEventListener('click', e=>{
  if(e.target === e.currentTarget) closeQuickRestock();
});

function submitQuickRestock(){
  const qtyVal = document.getElementById('qrQty').value.trim();
  const qty = parseInt(qtyVal);
  if(!qtyVal || isNaN(qty) || qty <= 0){ toast('⚠ Enter a valid quantity.'); document.getElementById('qrQty').focus(); return; }
  const costVal = document.getElementById('qrCost').value.trim();
  const cost = parseFloat(costVal) || 0;
  const note = document.getElementById('qrNote').value.trim();
  const p = byId(_qrProductId);
  p.qty += qty;
  if(cost > 0) p.cost = cost;
  if(p.qty > p.threshold) dismissed.delete(p.id);
  addAudit(`Restocked ${p.name}: +${qty}${note?' · '+note:''}`, 'add');
  pushNotif(`📦 ${p.name} restocked +${qty} ${p.unit}`, '📦', {productName: p.name});
  toast(`✓ ${p.name} → ${p.qty} ${p.unit}`);
  closeQuickRestock();
  renderStockAll();
  // Refresh All Products modal if it's open
  if(document.getElementById('allProductsOverlay').classList.contains('open')) renderAllProductsModal();
}

function focusRestock(id){
  openQuickRestock(id);
}
function doRestock(){
  const id=parseInt(document.getElementById('rProductId').value);
  const qtyVal=document.getElementById('rQty').value.trim();
  const costVal=document.getElementById('rCost').value.trim();
  const qty=parseInt(qtyVal);
  const cost=parseFloat(costVal)||0;
  if(!qtyVal||isNaN(qty)||qty<=0){toast('⚠ Please enter a valid quantity.');document.getElementById('rQty').focus();return;}
  if(!costVal&&costVal!=='0'){toast('⚠ Please enter unit cost (enter 0 if none).');document.getElementById('rCost').focus();return;}
  if(cost < 0){toast('⚠ Unit cost cannot be negative.');document.getElementById('rCost').focus();return;}
  const note=document.getElementById('rNote').value.trim();
  const p=byId(id); p.qty+=qty;
  if(cost>0) p.cost=cost;
  if(p.qty>p.threshold) dismissed.delete(p.id);
  addAudit(`Restocked ${p.name}: +${qty}${note?' · '+note:''}`,'add');
  pushNotif(`📦 ${p.name} restocked +${qty} ${p.unit}`,'📦',{productName:p.name});
  toast(`✓ ${p.name} → ${p.qty} ${p.unit}`);
  document.getElementById('rQty').value='';
  document.getElementById('rCost').value='';
  document.getElementById('rNote').value='';
  renderStockAll();
}
function renderAudit(){
  const el=document.getElementById('auditList');
  if(!auditLog.length){el.innerHTML='<div style="padding:12px;font-size:11px;color:var(--muted);text-align:center">No activity yet.</div>';return;}
  el.innerHTML=auditLog.slice(0,3).map(e=>`<div class="audit-item">
    <div class="audit-dot dot-${e.type}"></div>
    <div><div class="audit-msg">${e.msg}</div><div class="audit-time">${e.time} · ${OWNER_NAME}</div></div>
  </div>`).join('');
}
function openAuditAll(){
  const body=document.getElementById('auditAllBody');
  if(!auditLog.length){body.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">No activity yet.</div>';
  }else{
    body.innerHTML='<div style="padding:4px 12px 10px">'+auditLog.map(e=>`<div class="audit-item">
      <div class="audit-dot dot-${e.type}"></div>
      <div><div class="audit-msg">${e.msg}</div><div class="audit-time">${e.time} · ${OWNER_NAME}</div></div>
    </div>`).join('')+'</div>';
  }
  document.getElementById('auditAllOverlay').classList.add('open');
}
function closeAuditAll(){document.getElementById('auditAllOverlay').classList.remove('open');}
document.getElementById('auditAllOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAuditAll();});

function openAlertsAll(){
  const body=document.getElementById('alertsAllBody');
  // Re-render full alerts list inside the side panel
  const alertable=products.filter(p=>stockStatus(p)!=='ok'&&!dismissed.has(p.id));
  if(!alertable.length){body.innerHTML='<div style="padding:24px;text-align:center;color:var(--muted);font-size:12px">✅ All products are well stocked!</div>';}
  else{
    const sorted=[...alertable].sort((a,b)=>{const o={critical:0,low:1};return o[stockStatus(a)]-o[stockStatus(b)];});
    body.innerHTML='<div class="alert-list" style="padding:10px">'+sorted.map(p=>{
      const s=stockStatus(p);
      const isSnoozed=snoozed[p.id]&&snoozed[p.id]>Date.now();
      const minsLeft=isSnoozed?Math.ceil((snoozed[p.id]-Date.now())/60000):0;
      return `<div class="alert-item ${s} ${isSnoozed?'snoozed':''}">
        <div class="alert-icon">${s==='critical'?'🔴':'🟡'}</div>
        <div class="alert-body">
          <div class="alert-title">${p.name}${isSnoozed?`<span class="snooze-tag">💤${minsLeft}m</span>`:''}</div>
          <div class="alert-sub">${p.qty} ${p.unit} · threshold ${p.threshold}</div>
          <div class="alert-actions">
            <button class="alert-btn restock" onclick="focusRestock(${p.id});closeAlertsAll()">+Restock</button>
            ${!isSnoozed?`<button class="alert-btn snooze" onclick="snoozeAlert(${p.id});openAlertsAll()">💤 30m</button>`:`<button class="alert-btn snooze" onclick="unsnooze(${p.id});openAlertsAll()">Wake</button>`}
            ${!isSnoozed?`<button class="alert-btn dismiss" onclick="dismissAlert(${p.id});openAlertsAll()">✕</button>`:''}
          </div>
        </div></div>`;
    }).join('')+'</div>';
  }
  document.getElementById('alertsAllOverlay').classList.add('open');
}
function closeAlertsAll(){document.getElementById('alertsAllOverlay').classList.remove('open');}
document.getElementById('alertsAllOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeAlertsAll();});

/* PIN show/hide toggle */
function togglePinVisibility(){
  const input=document.getElementById('sfPin');
  const btn=document.getElementById('pinToggleBtn');
  if(input.type==='password'){input.type='text';btn.textContent='🙈';}
  else{input.type='password';btn.textContent='👁';}
}
function renderStockAll(){renderStockStats();renderTable();renderAlerts();renderRestockDropdown();}

/* ── Need Restock Modal ── */
function openRestockModal(){
  const low=products.filter(p=>p.type==='stock'&&stockStatus(p)!=='ok');
  const body=document.getElementById('restockModalBody');
  if(!low.length){body.innerHTML='<div style="padding:32px;text-align:center;color:var(--muted);font-size:13px">✅ All products are well stocked!</div>';}
  else{
    body.innerHTML=low.sort((a,b)=>{const o={critical:0,low:1};return o[stockStatus(a)]-o[stockStatus(b)];}).map(p=>{
      const s=stockStatus(p);
      const cls=s==='critical'?'critical-row':'low-row';
      return `<div class="restock-product-row ${cls}" id="rrow-${p.id}">
        <div class="rp-info">
          <div class="rp-name">${s==='critical'?'🔴':'🟡'} ${p.name}</div>
          <div class="rp-status">${s==='critical'?'Out / Critical':'Low Stock'} · ${p.qty} ${p.unit} (min: ${p.threshold})</div>
        </div>
        <div class="rp-inputs">
          <div class="rp-input-group">
            <span class="rp-input-label">Qty to Add</span>
            <input class="rp-input" id="mRqty-${p.id}" type="number" min="1" placeholder="e.g. 10"/>
          </div>
          <div class="rp-input-group">
            <span class="rp-input-label">Unit Cost (₱)</span>
            <input class="rp-input" id="mRcost-${p.id}" type="number" min="0" step="0.01" placeholder="e.g. 270"/>
          </div>
          <button class="rp-btn" onclick="doModalRestock(${p.id})">📦 Restock</button>
        </div>
      </div>`;
    }).join('');
  }
  document.getElementById('restockOverlay').classList.add('open');
}
function closeRestockModal(){document.getElementById('restockOverlay').classList.remove('open');}
document.getElementById('restockOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeRestockModal();});
function doModalRestock(id){
  const qtyVal=document.getElementById('mRqty-'+id).value.trim();
  const costVal=document.getElementById('mRcost-'+id).value.trim();
  const qty=parseInt(qtyVal);
  const cost=parseFloat(costVal)||0;
  if(!qtyVal||isNaN(qty)||qty<=0){toast('⚠ Please fill in the Qty to Add field.');document.getElementById('mRqty-'+id).focus();return;}
  if(!costVal){toast('⚠ Please fill in the Unit Cost field (enter 0 if none).');document.getElementById('mRcost-'+id).focus();return;}
  if(cost < 0){toast('⚠ Unit cost cannot be negative.');document.getElementById('mRcost-'+id).focus();return;}
  const p=byId(id); p.qty+=qty;
  if(cost>0) p.cost=cost;
  if(p.qty>p.threshold) dismissed.delete(p.id);
  addAudit(`Restocked ${p.name}: +${qty}`,'add');
  pushNotif(`📦 ${p.name} restocked +${qty} ${p.unit}`,'📦',{productName:p.name});
  toast(`✓ ${p.name} → ${p.qty} ${p.unit}`);
  const row=document.getElementById('rrow-'+id);
  if(row){row.classList.remove('critical-row','low-row');row.style.opacity='.45';row.querySelector('.rp-btn').textContent='✓ Done';row.querySelector('.rp-btn').classList.add('done');row.querySelector('.rp-btn').disabled=true;}
  renderStockAll();
}

/* ── Global Esc key to close any open modal/panel ── */
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(document.getElementById('notifAllOverlay').classList.contains('open')){closeNotifAll();return;}
  if(document.getElementById('auditAllOverlay').classList.contains('open')){closeAuditAll();return;}
  if(document.getElementById('alertsAllOverlay').classList.contains('open')){closeAlertsAll();return;}
  if(document.getElementById('restockOverlay').classList.contains('open')){closeRestockModal();return;}
  if(document.getElementById('allProductsOverlay').classList.contains('open')){closeAllProducts();return;}
  if(document.getElementById('delConfirmOverlay').classList.contains('open')){closeDelConfirm();return;}
  if(document.getElementById('staffModalOverlay').classList.contains('open')){closeStaffModal();return;}
  if(document.getElementById('menuModalOverlay').classList.contains('open')){closeMenuModal();return;}
  if(document.getElementById('changePwOverlay').classList.contains('open')){closeChangePassword();return;}
  if(document.getElementById('quickRestockOverlay').classList.contains('open')){closeQuickRestock();return;}
  if(document.getElementById('doneHistoryOverlay').classList.contains('open')){closeDoneHistory();return;}
  if(document.getElementById('logoutOverlay').classList.contains('open')){closeLogoutModal();return;}
  if(document.getElementById('actModalOverlay').classList.contains('open')){closeActModal();return;}
  if(document.getElementById('refundConfirmOverlay').classList.contains('open')){closeRefundConfirm();return;}
  if(document.getElementById('receiptOverlay').classList.contains('open')){closeReceipt();return;}
  if(document.getElementById('appearOverlay').classList.contains('open')){cancelAppear();return;}
  if(document.getElementById('editOverlay').classList.contains('open')){closeModal();return;}
});

/* ── Product Modal ── */
function openAddModal(){
  editingId=null;
  document.getElementById('modalTitle').textContent='Add Product';
  ['mName','mUnit'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('mCat').value='hot-coffee';
  document.getElementById('mType').value='manual';
  document.getElementById('mQty').value=0;
  document.getElementById('mThreshold').value=5;
  document.getElementById('mPrice').value=0;
  autoFillStockUnit(); // auto-set unit for default category
  document.getElementById('editOverlay').classList.add('open');
}

const STOCK_CAT_UNIT={'hot-coffee':'cups','iced-coffee':'cups','espresso':'shots','frappe':'cups','tea':'cups','pastries':'pcs','beans':'bags'};
const STOCK_CAT_TYPE={'hot-coffee':'manual','iced-coffee':'manual','espresso':'manual','frappe':'manual','tea':'manual','pastries':'stock','beans':'stock'};
function toggleStockQtyRow(){
  const isStock = document.getElementById('mType').value === 'stock';
  const row = document.getElementById('mQtyRow');
  row.style.display = isStock ? '' : 'none';
  if(!isStock){
    document.getElementById('mQty').value = 0;
    document.getElementById('mThreshold').value = 0;
  }
}

function autoFillStockUnit(){
  const cat=document.getElementById('mCat').value;
  document.getElementById('mUnit').value=STOCK_CAT_UNIT[cat]||'pcs';
  document.getElementById('mType').value=STOCK_CAT_TYPE[cat]||'manual';
  toggleStockQtyRow();
}
function openEditModal(id){
  editingId=id;
  const p=byId(id);
  document.getElementById('modalTitle').textContent='Edit: '+p.name;
  document.getElementById('mName').value=p.name;
  document.getElementById('mCat').value=p.category;
  document.getElementById('mType').value=p.type;
  document.getElementById('mQty').value=p.type==='manual'?0:p.qty;
  document.getElementById('mThreshold').value=p.threshold;
  document.getElementById('mUnit').value=p.unit;
  document.getElementById('mPrice').value=p.price;
  toggleStockQtyRow(); // show/hide qty+threshold based on type
  document.getElementById('editOverlay').classList.add('open');
}
function closeModal(){ document.getElementById('editOverlay').classList.remove('open'); clearStockImg(); }
function saveModal(){
  const name=document.getElementById('mName').value.trim();
  const cat=document.getElementById('mCat').value;
  const type=document.getElementById('mType').value;
  const qty=parseInt(document.getElementById('mQty').value)||0;
  const thr=parseInt(document.getElementById('mThreshold').value)||0;
  const unit=document.getElementById('mUnit').value.trim()||'pcs';
  const price=parseFloat(document.getElementById('mPrice').value)||0;
  if(!name){toast('⚠ Product name required');return;}
  if(editingId){
    const p=byId(editingId);
    addAudit(`Edited: ${p.name}`,'edit');
    p.name=name;p.category=cat;p.type=type;p.qty=type==='manual'?999:qty;p.threshold=thr;p.unit=unit;p.price=price;
    if(p.qty>p.threshold) dismissed.delete(p.id);
    toast('✓ '+name+' updated');
  } else {
    const newId=Math.max(0,...products.map(p=>p.id))+1;
    products.push({id:newId,name,category:cat,type,qty:type==='manual'?999:qty,threshold:thr,unit,price,cost:0});
    addAudit('Added: '+name,'add');
    pushNotif(`➕ New product added: ${name}`,'➕');
    toast('✓ '+name+' added');
  }
  closeModal(); renderStockAll();
}
document.getElementById('editOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});

/* ════ REAL-TIME SIMULATION ════ */
setInterval(()=>{
  if(Math.random()<0.018){
    const liveMenu=[
      {id:1,name:'Caramel Latte',price:3.95,category:'hot-coffee'},
      {id:7,name:'Iced Latte',price:3.80,category:'iced-coffee'},
      {id:11,name:'Mocha Frappe',price:4.25,category:'frappe'},
      {id:15,name:'Butter Croissant',price:2.40,category:'pastries'},
    ];
    const it=liveMenu[Math.floor(Math.random()*liveMenu.length)];
    const sub=it.price; const tax=sub*TAX;
    const newOrder={
      id:allOrders.length+1,
      customer:['Ana R.','Juan D.','Carlo M.','Lea S.'][Math.floor(Math.random()*4)],
      cashier:['Ana Cruz','Rico Dela Cruz','Ben Navarro','Mia Santos','Josh Estrada'][Math.floor(Math.random()*5)],
      persons:1+Math.floor(Math.random()*3),
      orderType:Math.random()>.5?'dine-in':'takeout',
      payment:['cash','gcash','paymaya'][Math.floor(Math.random()*3)],
      items:[{...it,qty:1}],subtotal:sub,tax,total:sub+tax,time:new Date()
    };
    allOrders.push(newOrder);
    pushNotif(`🧾 New order #${newOrder.id} — ${newOrder.customer}, ${it.name}`,'🧾',{orderId: newOrder.id, itemName: it.name});
    // sync pulse removed
    if(document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  }
},3000);


renderDashboard();
renderStockAll();
// Seed initial stock states — no beep on first load, only on changes after
products.forEach(p=>{ _prevStockStatus[p.id] = stockStatus(p); });
addAudit('Manager portal loaded','edit');

let _selectedAvatar = '🧑‍💼';

function selectAvatar(el){
  document.querySelectorAll('.pav-choice').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  _selectedAvatar = el.dataset.avatar;
  document.getElementById('profileAvaDisplay').textContent = _selectedAvatar;
  // Update sidebar ava too
  document.getElementById('ownerAva').textContent = _selectedAvatar;
}

function openProfileModal(){
  const name = document.getElementById('ownerNameDisplay').textContent;
  document.getElementById('profileNameInput').value = name;
  // Sync avatar
  document.getElementById('profileAvaDisplay').textContent = _selectedAvatar;
  // Mark correct avatar as selected
  document.querySelectorAll('.pav-choice').forEach(c=>{
    c.classList.toggle('selected', c.dataset.avatar===_selectedAvatar);
  });
  document.getElementById('profileOverlay').classList.add('open');
}
function closeProfileModal(){
  document.getElementById('profileOverlay').classList.remove('open');
}
function saveProfile(){
  const raw = document.getElementById('profileNameInput').value.trim();
  if(!raw){toast('⚠ Please enter a name.');return;}
  document.getElementById('ownerNameDisplay').textContent = raw;
  document.getElementById('ownerAva').textContent = _selectedAvatar;
  window._ownerName = raw;
  toast('✅ Profile updated!');
  closeProfileModal();
}

/* ── Change Password ── */
let _ownerPassword = 'owner1234';

function openChangePassword(){
  closeProfileModal();
  ['cpwCurrent','cpwNew','cpwConfirm'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('pwStrengthFill').style.width = '0';
  document.getElementById('pwStrengthFill').style.background = '';
  document.getElementById('pwStrengthLbl').textContent = '';
  document.getElementById('pwMatchLbl').textContent = '';
  document.getElementById('changePwOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(()=> document.getElementById('cpwCurrent').focus({preventScroll:true}), 120);
}
function closeChangePassword(){
  document.getElementById('changePwOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('changePwOverlay').addEventListener('click', e=>{
  if(e.target === e.currentTarget) closeChangePassword();
});
function toggleCpwEye(inputId, btn){
  const inp = document.getElementById(inputId);
  if(inp.type === 'password'){ inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}
function evalPwStrength(){
  const val = document.getElementById('cpwNew').value;
  const fill = document.getElementById('pwStrengthFill');
  const lbl  = document.getElementById('pwStrengthLbl');
  if(!val){ fill.style.width='0'; lbl.textContent=''; return; }
  let score = 0;
  if(val.length >= 8) score++;
  if(val.length >= 12) score++;
  if(/[A-Z]/.test(val)) score++;
  if(/[0-9]/.test(val)) score++;
  if(/[^A-Za-z0-9]/.test(val)) score++;
  const levels = [
    {w:'20%', color:'var(--red)',   text:'Very weak'},
    {w:'40%', color:'#f97316',      text:'Weak'},
    {w:'60%', color:'var(--amber)', text:'Fair'},
    {w:'80%', color:'#84cc16',      text:'Strong'},
    {w:'100%',color:'var(--green)', text:'Very strong'},
  ];
  const lvl = levels[Math.min(score, levels.length) - 1] || levels[0];
  fill.style.width = lvl.w;
  fill.style.background = lvl.color;
  lbl.textContent = lvl.text;
  lbl.style.color = lvl.color;
  evalPwMatch();
}
function evalPwMatch(){
  const nw  = document.getElementById('cpwNew').value;
  const cf  = document.getElementById('cpwConfirm').value;
  const lbl = document.getElementById('pwMatchLbl');
  if(!cf){ lbl.textContent=''; return; }
  if(nw === cf){ lbl.textContent='✓ Passwords match'; lbl.style.color='var(--green)'; }
  else         { lbl.textContent='✕ Passwords do not match'; lbl.style.color='var(--red)'; }
}
function submitChangePassword(){
  const current = document.getElementById('cpwCurrent').value;
  const nw      = document.getElementById('cpwNew').value;
  const confirm = document.getElementById('cpwConfirm').value;
  if(!current){ toast('⚠ Enter your current password.'); document.getElementById('cpwCurrent').focus(); return; }
  if(current !== _ownerPassword){ toast('✕ Current password is incorrect.'); document.getElementById('cpwCurrent').focus(); return; }
  if(nw.length < 8){ toast('⚠ New password must be at least 8 characters.'); document.getElementById('cpwNew').focus(); return; }
  if(nw !== confirm){ toast('⚠ Passwords do not match.'); document.getElementById('cpwConfirm').focus(); return; }
  if(nw === current){ toast('⚠ New password must be different from current.'); document.getElementById('cpwNew').focus(); return; }
  _ownerPassword = nw;
  closeChangePassword();
  toast('✅ Password updated successfully!');
}

function logOut(){
  closeProfileModal();
  const ov = document.getElementById("logoutOverlay");
  ov.classList.add("open");
  ov.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeLogoutModal(){
  const ov = document.getElementById("logoutOverlay");
  ov.classList.remove("open");
  ov.style.display = "none";
  document.body.style.overflow = "";
}

function confirmLogOut(){
  document.body.style.overflow = "";
  window.location.href = "../Login/triad.html";
}

document.getElementById('logoutOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeLogoutModal();});
document.getElementById('profileOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeProfileModal();});
// Init sidebar avatar
document.getElementById('ownerAva').textContent = _selectedAvatar;

/* ══ ACTIVITY REMINDER SYSTEM ══ */
let _reminderQueue   = [];
let _reminderCurrent = null;
const _snoozed       = {};
let   _reminderAudioCtx = null;
let   _reminderAlarmInterval = null;

/* ── Web Audio alert sound ── */
function _playAlertSound(){
  try{
    if(!_reminderAudioCtx) _reminderAudioCtx = new (window.AudioContext||window.webkitAudioContext)();
    const ctx = _reminderAudioCtx;

    // Pattern: three urgent beeps then pause, repeat
    function beep(startTime, freq, duration, vol=0.45){
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);
      // Quick attack, fast decay for urgency
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
      gain.gain.setValueAtTime(vol, startTime + duration - 0.04);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration + 0.01);
    }

    function playPattern(offset=0){
      const t = ctx.currentTime + offset;
      // Three rising-tone beeps: urgent alarm feel
      beep(t + 0.00, 880, 0.12, 0.4);
      beep(t + 0.16, 988, 0.12, 0.45);
      beep(t + 0.32, 1100, 0.18, 0.5);
      // Short pause then repeat once
      beep(t + 0.65, 880, 0.12, 0.4);
      beep(t + 0.81, 988, 0.12, 0.45);
      beep(t + 0.97, 1100, 0.18, 0.5);
    }

    playPattern(0);
    // Repeat every 3s while reminder is showing
    _reminderAlarmInterval = setInterval(()=>{
      if(!_reminderCurrent){ _stopAlertSound(); return; }
      playPattern(0);
    }, 3000);

  }catch(e){ /* audio not supported — silent fail */ }
}

function _stopAlertSound(){
  if(_reminderAlarmInterval){ clearInterval(_reminderAlarmInterval); _reminderAlarmInterval=null; }
}

function _checkActivityReminders(){
  const now   = new Date();
  const nowMs = now.getTime();
  Object.entries(activities).forEach(([ds, acts])=>{
    acts.forEach(a=>{
      if(a.confirmed) return;
      const [h,m] = (a.time||'00:00').split(':').map(Number);
      const scheduled = new Date(ds+'T'+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':00');
      if(scheduled > now) return;
      const key = `${ds}_${a.id}`;
      if(_snoozed[key] && nowMs < _snoozed[key]) return;
      if(_reminderCurrent && _reminderCurrent.ds===ds && _reminderCurrent.actId===a.id) return;
      if(_reminderQueue.some(r=>r.ds===ds&&r.actId===a.id)) return;
      _reminderQueue.push({ds, actId:a.id});
    });
  });
  if(!_reminderCurrent && _reminderQueue.length>0) _showNextReminder();
}

function _showNextReminder(){
  if(_reminderQueue.length===0){
    _reminderCurrent=null;
    _stopAlertSound();
    document.getElementById('actReminderOverlay').style.display='none';
    return;
  }
  _reminderCurrent = _reminderQueue.shift();
  const {ds, actId} = _reminderCurrent;
  const act = (activities[ds]||[]).find(a=>a.id===actId);
  if(!act){ _showNextReminder(); return; }

  const d = new Date(ds+'T00:00:00');
  const dateStr = d.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  document.getElementById('actReminderTitle').textContent = act.title;
  document.getElementById('actReminderTime').textContent  = '📅 '+dateStr+'  ·  ⏰ '+fmtTime12(act.time)+(act.endTime?' – '+fmtTime12(act.endTime):'');
  document.getElementById('actReminderNote').textContent  = act.note||'';

  const overlay = document.getElementById('actReminderOverlay');
  const box     = document.getElementById('actReminderBox');

  // Show overlay with flash
  overlay.style.display='flex';
  overlay.style.animation='none'; void overlay.offsetWidth;
  overlay.style.animation='overlayFlash .6s ease forwards';

  // Pop + shake animation on box
  box.style.animation='none'; void box.offsetWidth;
  box.style.animation='reminderPop .38s cubic-bezier(.34,1.46,.64,1) forwards';
  // After pop, start shake + glow loop
  setTimeout(()=>{
    if(!_reminderCurrent) return;
    box.style.animation='reminderShake .55s ease-in-out, reminderGlow 1.2s ease-in-out infinite';
    // Re-shake every 4s
    const reshake = setInterval(()=>{
      if(!_reminderCurrent){ clearInterval(reshake); return; }
      box.style.animation='none'; void box.offsetWidth;
      box.style.animation='reminderShake .55s ease-in-out, reminderGlow 1.2s ease-in-out infinite';
    }, 4000);
  }, 420);

  // Play alert sound
  _stopAlertSound();
  _playAlertSound();
}

function actReminderConfirm(){
  if(!_reminderCurrent) return;
  const {ds, actId} = _reminderCurrent;
  // Save to done history before removing
  const act = (activities[ds]||[]).find(a=>a.id===actId);
  if(act){
    doneActivities.unshift({
      title: act.title, time: act.time, endTime: act.endTime||'',
      note: act.note||'', color: act.color, ds,
      completedAt: new Date().toISOString()
    });
  }
  // Remove the activity entirely — Done means it's finished
  if(activities[ds]){
    activities[ds] = activities[ds].filter(a => a.id !== actId);
    if(!activities[ds].length) delete activities[ds];
  }
  _stopAlertSound();
  toast('✅ Activity done & removed!');
  addAudit(`Activity completed: "${act?act.title:'?'}"`, 'edit');
  _reminderCurrent=null;
  document.getElementById('actReminderOverlay').style.display='none';
  _saveDashScroll();
  calRenderActivities();
  calRender();
  renderDoneHistory();
  setTimeout(_showNextReminder, 400);
}

function actReminderSnooze(){
  if(!_reminderCurrent) return;
  const {ds, actId} = _reminderCurrent;
  const key = `${ds}_${actId}`;
  _snoozed[key] = Date.now() + 5*60*1000;
  const act = (activities[ds]||[]).find(a=>a.id===actId);
  _stopAlertSound();
  toast(`⏱ Snoozed 5 min — "${act?act.title:'Activity'}"`);
  _reminderCurrent=null;
  document.getElementById('actReminderOverlay').style.display='none';
  // Keep user at Calendar section — restore scroll after overlay hides
  _restoreDashScroll();
  setTimeout(_showNextReminder, 400);
}

function openDoneHistory(){
  renderDoneHistory();
  document.getElementById('doneHistoryOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeDoneHistory(){
  document.getElementById('doneHistoryOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('doneHistoryOverlay').addEventListener('click',e=>{if(e.target===e.currentTarget)closeDoneHistory();});

function renderDoneHistory(){
  const el = document.getElementById('doneHistoryList');
  if(!el) return;
  const fromVal = document.getElementById('doneHistFrom')?.value || '';
  const toVal   = document.getElementById('doneHistTo')?.value   || '';
  let entries = doneActivities;
  // Filter by scheduled date range if set
  if(fromVal) entries = entries.filter(a => a.ds >= fromVal);
  if(toVal)   entries = entries.filter(a => a.ds <= toVal);
  if(!entries.length){
    el.innerHTML = `<div style="text-align:center;padding:32px 0;font-size:13px;color:var(--muted);">
      ${doneActivities.length ? 'No activities match the selected date range.' : 'No completed activities yet. Mark one as Done from a reminder to see it here.'}
    </div>`;
    return;
  }
  el.innerHTML = entries.map((a,i)=>{
    const realIdx = doneActivities.indexOf(a);
    const scheduled = new Date(a.ds+'T00:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric',year:'numeric'});
    const completedDate = new Date(a.completedAt);
    const completedStr = completedDate.toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})
      +' · '+completedDate.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
    const timeRange = fmtTime12(a.time)+(a.endTime?' – '+fmtTime12(a.endTime):'');
    return `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
        border-radius:10px;border:1.5px solid var(--line);background:var(--bg);margin-bottom:7px;">
      <div style="width:9px;height:9px;border-radius:50%;background:${a.color};flex-shrink:0;margin-top:5px;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13.5px;font-weight:700;color:var(--text);text-decoration:line-through;opacity:.7;">${a.title}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px;">
          📅 Scheduled: <strong style="color:var(--text2)">${scheduled}</strong> · ⏰ ${timeRange}
          ${a.note?`<br>📝 <span style="color:var(--text2)">${a.note}</span>`:''}
        </div>
        <div style="font-size:11.5px;color:var(--green);margin-top:4px;font-weight:700;">✅ Completed: ${completedStr}</div>
      </div>
      <button onclick="doneActivities.splice(${realIdx},1);renderDoneHistory();" title="Remove"
        style="background:none;border:none;font-size:13px;color:var(--muted);cursor:pointer;padding:2px 4px;flex-shrink:0;"
        onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">✕</button>
    </div>`;
  }).join('');
}

function removeDoneEntry(i){
  doneActivities.splice(i,1);
  renderDoneHistory();
}

setInterval(_checkActivityReminders, 30000);
setTimeout(_checkActivityReminders, 1500);

/* ═══════════════════════════════════════════════════════════
   MYSQL DATABASE INTEGRATION — Triad POS
   These overrides hook into the existing UI functions and
   sync all data to the MySQL database via the PHP API.
   The UI / UX is 100% unchanged — only persistence added.
═══════════════════════════════════════════════════════════ */

/* ── DB ready flag ── */
window._dbReady = typeof TriadDB !== 'undefined';

/* ── Helper: POST to API ── */
async function _dbPost(endpoint, body) {
  try {
    const res  = await fetch('../api/' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await res.json();
  } catch(e) {
    console.warn('[DB]', endpoint, e.message);
    return { success: false, message: e.message };
  }
}
async function _dbPostForm(endpoint, formData) {
  try {
    const res = await fetch('../api/' + endpoint, { method: 'POST', body: formData });
    return await res.json();
  } catch(e) {
    console.warn('[DB]', endpoint, e.message);
    return { success: false, message: e.message };
  }
}
async function _dbGet(endpoint, params = {}) {
  try {
    const qs  = new URLSearchParams(params).toString();
    const res = await fetch('../api/' + endpoint + (qs ? '?' + qs : ''));
    return await res.json();
  } catch(e) {
    console.warn('[DB]', endpoint, e.message);
    return { success: false, data: [] };
  }
}

/* ── Image preview helpers ── */
function previewMenuImg(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('mnImgPreview').src = URL.createObjectURL(file);
  document.getElementById('mnImgPreviewWrap').style.display = '';
}
function clearMenuImg() {
  const inp = document.getElementById('mnImg');
  if (inp) inp.value = '';
  const prev = document.getElementById('mnImgPreview');
  if (prev) prev.src = '';
  const wrap = document.getElementById('mnImgPreviewWrap');
  if (wrap) wrap.style.display = 'none';
}
function previewStockImg(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('mImgPreview').src = URL.createObjectURL(file);
  document.getElementById('mImgPreviewWrap').style.display = '';
}
function clearStockImg() {
  const inp = document.getElementById('mImg');
  if (inp) inp.value = '';
  const prev = document.getElementById('mImgPreview');
  if (prev) prev.src = '';
  const wrap = document.getElementById('mImgPreviewWrap');
  if (wrap) wrap.style.display = 'none';
}

/* ─────────────────────────────────────────────────────────
   1. OWNER PASSWORD CHANGE — overrides submitChangePassword
───────────────────────────────────────────────────────── */
async function submitChangePassword() {
  const current  = document.getElementById('cpwCurrent').value;
  const nw       = document.getElementById('cpwNew').value;
  const confirm  = document.getElementById('cpwConfirm').value;
  const username = sessionStorage.getItem('triad_username') || 'Owner123';

  if (!current) { toast('⚠ Enter your current password.'); document.getElementById('cpwCurrent').focus(); return; }
  if (nw.length < 8) { toast('⚠ New password must be at least 8 characters.'); document.getElementById('cpwNew').focus(); return; }
  if (nw !== confirm) { toast('⚠ Passwords do not match.'); document.getElementById('cpwConfirm').focus(); return; }
  if (nw === current) { toast('⚠ New password must be different from current.'); document.getElementById('cpwNew').focus(); return; }

  const res = await _dbPost('auth.php', { action: 'change_password', username, current_password: current, new_password: nw });
  if (res.success) {
    closeChangePassword();
    toast('✅ Password updated successfully!');
    addAudit('Owner password changed', 'edit');
  } else {
    toast('✕ ' + (res.message || 'Error updating password.'));
    document.getElementById('cpwCurrent').focus();
  }
}

/* ─────────────────────────────────────────────────────────
   2. STAFF — save, archive, restore wrapped with DB sync
───────────────────────────────────────────────────────── */
const _origSaveStaff     = window.saveStaffMember    || saveStaffMember;
const _origArchiveStaff  = window.archiveStaff       || archiveStaff;
const _origRestoreStaff  = window.restoreStaff       || restoreStaff;
const _origToggleStatus  = window.toggleStaffStatus  || toggleStaffStatus;

window.saveStaffMember = async function() {
  // Capture editingStaffId BEFORE _origSaveStaff clears it
  const isEditing = editingStaffId;
  const prevLength = staffList.length;
  // Run original UI logic first
  _origSaveStaff();
  // Find the staff record that was just saved
  const s = isEditing
    ? staffList.find(x => x.id === isEditing)
    : staffList[staffList.length - 1];
  if (!s) return;
  const payload = {
    id: isEditing || 0,
    first: s.first, last: s.last, email: s.email, phone: s.phone,
    role: s.role, pin: s.pin, schedule: s.schedule,
    status: s.status, joined: s.joined
  };
  const res = await _dbPost('staff.php', { action: 'save', ...payload });
  if (res.success && !isEditing) {
    // Update local id with DB-generated one
    s.id = res.id || s.id;
  }
  if (!res.success) console.warn('[DB] saveStaff failed:', res.message);
};

window.archiveStaff = async function(id) {
  _origArchiveStaff(id);
  await _dbPost('staff.php', { action: 'archive', id });
};

window.restoreStaff = async function(id) {
  _origRestoreStaff(id);
  // Find the newly restored staff in staffList
  const archived = staffArchive.find(x => x.id === id);
  if (archived) {
    const res = await _dbPost('staff.php', { action: 'restore', id });
    if (res.success && res.new_id) {
      const s = staffList.find(x => x.id === id);
      if (s) s.id = res.new_id;
    }
  }
};

window.toggleStaffStatus = function(id) {
  _origToggleStatus(id);
  _dbPost('staff.php', { action: 'toggle_status', id });
};

/* ─────────────────────────────────────────────────────────
   3. MENU — save, archive, restore, toggle availability
───────────────────────────────────────────────────────── */
const _origSaveMenu      = window.saveMenuItem       || saveMenuItem;
const _origArchiveMenu   = window.archiveMenuItem    || archiveMenuItem;
const _origRestoreMenu   = window.restoreMenuItem    || restoreMenuItem;
const _origToggleAvail   = window.toggleMenuAvail    || toggleMenuAvail;

window.saveMenuItem = async function() {
  // Capture file BEFORE _origSaveMenu() closes the modal and clears the input
  const imgFile = document.getElementById('mnImg')?.files[0] || null;
  _origSaveMenu();
  const p = editingMenuId ? products.find(x => x.id === editingMenuId) : products[products.length - 1];
  if (!p) return;
  const fd = new FormData();
  fd.append('action',      'save');
  fd.append('id',          editingMenuId || 0);
  fd.append('name',        p.name);
  fd.append('category',    p.category);
  fd.append('type',        p.type);
  fd.append('qty',         p.qty);
  fd.append('threshold',   p.threshold);
  fd.append('unit',        p.unit);
  fd.append('price',       p.price);
  fd.append('cost',        p.cost || 0);
  fd.append('available',   isAvailable(p.id) ? 1 : 0);
  fd.append('description', menuDescriptions[p.id] || '');
  if (imgFile) fd.append('image', imgFile);
  const res = await _dbPostForm('menu.php', fd);
  if (res.success) {
    if (!editingMenuId) p.id = res.id || p.id;
    if (res.image_path) p.image_path = res.image_path;
  }
};

/* ─────────────────────────────────────────────────────────
   3b. STOCK MANAGER — saveModal (Add/Edit product)
───────────────────────────────────────────────────────── */
const _origSaveModal = window.saveModal || saveModal;

window.saveModal = async function() {
  // Capture file BEFORE _origSaveModal() closes the modal and clears the input
  const imgFile = document.getElementById('mImg')?.files[0] || null;
  const wasEditing = !!editingId;
  const oldId = editingId;
  _origSaveModal();
  const p = wasEditing ? byId(oldId) : products[products.length - 1];
  if (!p) return;
  const fd = new FormData();
  fd.append('action',      'save');
  fd.append('id',          wasEditing ? p.id : 0);
  fd.append('name',        p.name);
  fd.append('category',    p.category);
  fd.append('type',        p.type);
  fd.append('qty',         p.qty);
  fd.append('threshold',   p.threshold);
  fd.append('unit',        p.unit);
  fd.append('price',       p.price);
  fd.append('cost',        p.cost || 0);
  fd.append('available',   isAvailable(p.id) ? 1 : 0);
  fd.append('description', menuDescriptions[p.id] || '');
  if (imgFile) fd.append('image', imgFile);
  const res = await _dbPostForm('menu.php', fd);
  if (res.success) {
    if (!wasEditing) p.id = res.id || p.id;
    if (res.image_path) p.image_path = res.image_path;
  }
};

window.archiveMenuItem = async function(id) {
  _origArchiveMenu(id);
  await _dbPost('menu.php', { action: 'archive', id });
};

window.restoreMenuItem = async function(id) {
  _origRestoreMenu(id);
  await _dbPost('menu.php', { action: 'restore', id });
};

window.toggleMenuAvail = function(id) {
  _origToggleAvail(id);
  _dbPost('menu.php', { action: 'toggle_avail', id });
};

/* ─────────────────────────────────────────────────────────
   4. INVENTORY — Restock
───────────────────────────────────────────────────────── */
window.submitQuickRestock = async function() {
  const productId = window._qrProductId;
  const p         = byId(productId);
  const qtyVal    = document.getElementById('qrQty').value.trim();
  const qty       = parseInt(qtyVal);
  const cost      = parseFloat(document.getElementById('qrCost')?.value || '0');
  const note      = document.getElementById('qrNote')?.value?.trim() || '';
  if (!qtyVal || isNaN(qty) || qty <= 0) { toast('⚠ Enter a valid quantity.'); document.getElementById('qrQty').focus(); return; }
  if (cost < 0) { toast('⚠ Unit cost cannot be negative.'); document.getElementById('qrCost').focus(); return; }
  if (!p || p.type !== 'stock') return;
  p.qty += qty;
  if (cost > 0) p.cost = cost;
  if (p.qty > p.threshold) dismissed.delete(p.id);
  addAudit(`Restocked ${p.name}: +${qty}${note ? ' · ' + note : ''}`, 'add');
  pushNotif(`📦 ${p.name} restocked +${qty} ${p.unit}`, '📦', { productName: p.name });
  toast(`✓ ${p.name} → ${p.qty} ${p.unit}`);
  closeQuickRestock();
  renderStockAll();
  if (document.getElementById('allProductsOverlay')?.classList.contains('open')) renderAllProductsModal();
  const done_by = sessionStorage.getItem('triad_username') || 'Owner';
  const res = await _dbPost('inventory.php', { action: 'restock', id: productId, qty, cost, note, done_by });
  if (!res.success) console.warn('[DB] submitQuickRestock failed:', res.message);
};

/* ─────────────────────────────────────────────────────────
   4b. INVENTORY — doRestock (Quick Restock panel form)
───────────────────────────────────────────────────────── */
const _origDoRestock = window.doRestock || doRestock;

window.doRestock = async function() {
  const id      = parseInt(document.getElementById('rProductId').value);
  const qtyVal  = document.getElementById('rQty').value.trim();
  const costVal = document.getElementById('rCost').value.trim();
  const qty     = parseInt(qtyVal);
  const cost    = parseFloat(costVal) || 0;
  const note    = document.getElementById('rNote').value.trim();
  const p       = byId(id);

  if (!p || !qtyVal || isNaN(qty) || qty <= 0) { _origDoRestock(); return; }

  _origDoRestock(); // runs local update + validation + toast

  const done_by = sessionStorage.getItem('triad_username') || 'Owner';
  const res = await _dbPost('inventory.php', { action: 'restock', id, qty, cost, note, done_by });
  if (!res.success) console.warn('[DB] doRestock failed:', res.message);
};

/* ─────────────────────────────────────────────────────────
   5. SALES — Refund
───────────────────────────────────────────────────────── */
const _origMarkOrder = window.markOrder || markOrder;

window.markOrder = function(id, status) {
  _origMarkOrder(id, status);
  if (status === 'refunded') {
    _dbPost('sales.php', { action: 'refund', id });
  }
};

/* ─────────────────────────────────────────────────────────
   6. LOAD DATA FROM DB on startup (non-blocking)
───────────────────────────────────────────────────────── */
(async function loadFromDB() {
  try {
    // Load staff
    const staffRes = await _dbGet('staff.php', { action: 'list' });
    if (staffRes.success && staffRes.data.length) {
      staffList = staffRes.data.map(s => ({
        id:       parseInt(s.id),
        first:    s.first_name,
        last:     s.last_name,
        email:    s.email,
        phone:    s.phone || '',
        role:     s.role,
        pin:      s.pin,
        schedule: s.schedule || '',
        status:   s.status,
        joined:   s.joined_date || ''
      }));
      staffNextId = Math.max(...staffList.map(s => s.id), 0) + 1;
      renderStaff();
    }

    // Load menu
    const menuRes = await _dbGet('menu.php', { action: 'list' });
    if (menuRes.success && menuRes.data.length) {
      products = menuRes.data.map(m => ({
        id:        parseInt(m.id),
        name:      m.name,
        category:  m.category,
        type:      m.type,
        qty:       parseInt(m.qty),
        threshold: parseInt(m.threshold),
        unit:      m.unit,
        price:     parseFloat(m.price),
        cost:      parseFloat(m.cost)
      }));
      menuRes.data.forEach(m => {
        menuAvailability[m.id] = m.available;
        if (m.description) menuDescriptions[m.id] = m.description;
      });
      renderMenu();
      renderStockAll();
    }

    // Load sales (last 60 days) for dashboard
    const today    = new Date();
    const from     = new Date(); from.setDate(from.getDate() - 59);
    const fromStr  = from.toISOString().split('T')[0];
    const toStr    = today.toISOString().split('T')[0];
    const salesRes = await _dbGet('sales.php', { action: 'list', from: fromStr, to: toStr, limit: 1000 });
    if (salesRes.success && salesRes.data.length) {
      allOrders = salesRes.data.map((s, idx) => ({
        id:        parseInt(s.id),
        customer:  s.customer,
        cashier:   s.cashier,
        persons:   parseInt(s.persons),
        orderType: s.order_type,
        payment:   s.payment,
        items:     s.items || [],
        subtotal:  parseFloat(s.subtotal),
        tax:       parseFloat(s.tax),
        total:     parseFloat(s.total),
        time:      new Date(s.created_at)
      }));
      // Sync refunded status
      salesRes.data.forEach(s => {
        if (s.status === 'refunded') orderStatus[s.id] = 'refunded';
      });
      renderDashboard();
    }

    console.log('[TriadDB] Data loaded from MySQL ✓');
  } catch(e) {
    console.warn('[TriadDB] Could not load from DB (is XAMPP running?):', e.message);
  }
})();

/* ── Poll MySQL every 30s: sync new sales + refresh stock quantities ── */
setInterval(async function pollDBUpdates() {
  try {
    // 1. Refresh stock quantities — so low/critical alerts reflect actual DB stock
    const menuRes = await _dbGet('menu.php', { action: 'list' });
    if (menuRes.success && menuRes.data.length) {
      menuRes.data.forEach(m => {
        const p = products.find(x => x.id === parseInt(m.id));
        if (p) {
          p.qty       = parseInt(m.qty);
          p.threshold = parseInt(m.threshold);
        }
      });
      renderAlerts();
      renderStockAll();
      _checkStockSoundAlerts();
    }

    // 2. Sync new sales so Orders panel and Dashboard stay up to date
    const today   = new Date();
    const from    = new Date(); from.setDate(from.getDate() - 59);
    const fromStr = from.toISOString().split('T')[0];
    const toStr   = today.toISOString().split('T')[0];
    const salesRes = await _dbGet('sales.php', { action: 'list', from: fromStr, to: toStr, limit: 1000 });
    if (salesRes.success && salesRes.data.length) {
      const prevCount = allOrders.length;
      allOrders = salesRes.data.map(s => ({
        id:        parseInt(s.id),
        customer:  s.customer,
        cashier:   s.cashier,
        persons:   parseInt(s.persons),
        orderType: s.order_type,
        payment:   s.payment,
        items:     s.items || [],
        subtotal:  parseFloat(s.subtotal),
        tax:       parseFloat(s.tax),
        total:     parseFloat(s.total),
        time:      new Date(s.created_at)
      }));
      salesRes.data.forEach(s => {
        if (s.status === 'refunded') orderStatus[s.id] = 'refunded';
      });
      // Notify and re-render if new orders came in
      const newCount = allOrders.length;
      if (newCount > prevCount) {
        const newest = allOrders[0];
        pushNotif(`🧾 New order #${newest.id} — ${newest.customer}`, '🧾', { orderId: newest.id });
        renderDashboard();
      }
      // Always re-render orders page if it's active
      if (document.getElementById('page-orders')?.classList.contains('active')) {
        renderOrdersPage();
      }
    }
  } catch(e) {
    // Silently fail — no internet or XAMPP not running
  }
}, 30000);


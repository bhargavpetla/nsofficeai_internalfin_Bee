/* ============================================================
   NSOffice.AI Business Command Center - Engine
   by Netscience Technologies Pvt. Ltd.
   ============================================================ */

/* PASSWORD */
function tryLogin(){
  const pwd = document.getElementById('loginPwd').value.trim();
  let curPwd = 'admin';
  try{
    const stored = JSON.parse(localStorage.getItem('ns_a')||'{}');
    if(stored.adminPwd) curPwd = stored.adminPwd;
  } catch(e){}
  if(pwd === curPwd){
    document.getElementById('loginOverlay').style.display='none';
    document.getElementById('app').classList.add('visible');
    sessionStorage.setItem('ns_auth','1');
    init();
  } else {
    document.getElementById('loginErr').style.display='block';
    document.getElementById('loginPwd').value='';
    document.getElementById('loginPwd').focus();
  }
}
function logout(){sessionStorage.removeItem('ns_auth');location.reload()}
document.addEventListener('DOMContentLoaded',function(){
  var lp=document.getElementById('loginPwd');
  if(lp) lp.addEventListener('keydown',function(e){if(e.key==='Enter')tryLogin()});
  if(sessionStorage.getItem('ns_auth')==='1'){
    document.getElementById('loginOverlay').style.display='none';
    document.getElementById('app').classList.add('visible');
    init();
  }
});

/* ============================================================
   STATE & DEFAULTS
   ============================================================ */
const DEF={
  // AWS
  awsBase:1500, awsPerCust:400, awsScale:15, awsOrgs:0,
  // Team (monthly salaries, Mumbai)
  teamEng:15000, teamEngC:5,
  teamSup:3000,  teamSupC:2,
  teamSales:4000,teamSalesC:2,
  teamMgmt:6000, teamMgmtC:2,
  // Overheads (monthly, company-wide)
  office:2000, tools:1500, legal:500, insurance:200, marketing:1000, misc:500,
  // Internal cost to build integrations (effort, per org)
  costIntSimple:200, costIntModerate:600, costIntComplex:2000, costIntMaint:30,
  // Internal onboarding costs (per org, one-time)
  onboard:500, training:300, migration:200,
  // API costs per action (your cost to providers)
  apiPrompt:.02, apiDoc:.10, apiWord:.25, apiPPT:.50, apiExcel:.40, apiImage:.04, apiVideo:.60, apiKnow:.015,
  // Pricing to customer (what you charge)
  priceIntSimple:500, priceIntModerate:1500, priceIntComplex:5000,
  priceDoSimple:1000, priceDoComplex:3000, priceDoEnterprise:8000, priceBaseSub:100,
  // Admin
  adminPwd:'admin',
};
const DEF_BUNDLES=[
  {l:'Base Subscription',u:500,p:100,locked:1},
  {l:'Bundle 1',u:1000,p:180},{l:'Bundle 2',u:2500,p:400},
  {l:'Bundle 3',u:5000,p:750},{l:'Bundle 4',u:10000,p:1400},{l:'Bundle 5',u:25000,p:3000},
];
let A={},bundles=[],portfolio=[],charts={};

function load(){
  try{A={...DEF,...JSON.parse(localStorage.getItem('ns_a')||'{}')}}catch{A={...DEF}}
  // migrate old key 'software' -> 'tools'
  if(A.software!==undefined&&A.tools===undefined){A.tools=A.software;delete A.software}
  try{bundles=JSON.parse(localStorage.getItem('ns_b'))||JSON.parse(JSON.stringify(DEF_BUNDLES))}catch{bundles=JSON.parse(JSON.stringify(DEF_BUNDLES))}
  try{portfolio=JSON.parse(localStorage.getItem('ns_p'))||[]}catch{portfolio=[]}
  // sync awsOrgs from portfolio
  A.awsOrgs=portfolio.length;
}
function save(){
  A.awsOrgs=portfolio.length;
  tursoSaveDebounced(A,bundles,portfolio);
  const s=document.getElementById('saveInd');s.classList.add('show');setTimeout(()=>s.classList.remove('show'),1200);
}
function resetDef(){A={...DEF};bundles=JSON.parse(JSON.stringify(DEF_BUNDLES));portfolio=[];save();syncAdm();syncPricing();updateAll()}
function exportCfg(){
  const d=JSON.stringify({a:A,b:bundles,p:portfolio},null,2);
  const u=URL.createObjectURL(new Blob([d],{type:'application/json'}));
  const a=document.createElement('a');a.href=u;a.download='nsoffice_config.json';a.click();URL.revokeObjectURL(u);
}
function importCfg(e){
  const f=e.target.files[0];if(!f)return;const r=new FileReader();
  r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.a)A={...DEF,...d.a};if(d.b)bundles=d.b;if(d.p)portfolio=d.p;save();syncAdm();syncPricing();updateAll();alert('Imported.')}catch{alert('Invalid file.')}};
  r.readAsText(f);e.target.value='';
}

/* HELPERS */
const $=id=>document.getElementById(id);
const $$=s=>document.querySelectorAll(s);
const fmt=(n,d=0)=>n.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const fD=n=>'$'+fmt(n,n<10&&n>-10&&n!==0?2:0);
const pct=n=>fmt(n*100,1)+'%';
const v=id=>{const el=$(id);return el?parseInt(el.value)||0:0};
const vf=id=>{const el=$(id);return el?parseFloat(el.value)||0:0};

/* Calculated costs */
function awsC(orgs){
  const n=orgs||0;
  const discount=1-Math.min(Math.floor(n/10)*(A.awsScale/100),.6);
  return A.awsBase + n*A.awsPerCust*discount;
}
function baseTeamC(){
  return (A.teamEng*A.teamEngC)+(A.teamSup*A.teamSupC)+(A.teamSales*A.teamSalesC)+(A.teamMgmt*A.teamMgmtC);
}
function teamC(){
  return baseTeamC();
}
function ovhd(){return A.office+A.tools+A.legal+A.insurance+A.marketing+A.misc}
function fixedC(orgs){return awsC(orgs)+teamC()+ovhd()}
function bPrice(u){const b=bundles.find(b=>b.u===parseInt(u));return b?b.p:0}
function midRate(){const b=bundles[2]||bundles[1]||bundles[0];return b.u>0?b.p/b.u:.16}

/* NU SCHEDULE */
const NU=[
  {id:'prompt',l:'Text Prompt',nu:.25,ak:'apiPrompt',cm:1},
  {id:'docS',l:'Doc (≤10pg)',nu:2,ak:'apiDoc',cm:1},{id:'docM',l:'Doc (11–30pg)',nu:4,ak:'apiDoc',cm:1.5},
  {id:'docL',l:'Doc (31–100pg)',nu:7,ak:'apiDoc',cm:2.5},{id:'docXL',l:'Doc (>100pg)',nu:10,ak:'apiDoc',cm:4},
  {id:'wordS',l:'Word (≤5pg)',nu:5,ak:'apiWord',cm:1},{id:'wordM',l:'Word (5–20pg)',nu:10,ak:'apiWord',cm:1.8},
  {id:'wordL',l:'Word (21–40pg)',nu:20,ak:'apiWord',cm:3},{id:'wordXL',l:'Word (>40pg)',nu:30,ak:'apiWord',cm:5},
  {id:'pptS',l:'PPT (≤15sl)',nu:10,ak:'apiPPT',cm:1},{id:'pptM',l:'PPT (15–30sl)',nu:20,ak:'apiPPT',cm:1.8},
  {id:'pptL',l:'PPT (31–50sl)',nu:30,ak:'apiPPT',cm:2.5},{id:'pptXL',l:'PPT (>50sl)',nu:60,ak:'apiPPT',cm:4.5},
  {id:'exS',l:'Excel (1 sheet)',nu:15,ak:'apiExcel',cm:1},{id:'exM',l:'Excel (2 sheets)',nu:30,ak:'apiExcel',cm:1.8},
  {id:'exL',l:'Excel (3–5 sheets)',nu:50,ak:'apiExcel',cm:3},{id:'exXL',l:'Excel (>5 sheets)',nu:75,ak:'apiExcel',cm:4.5},
  {id:'i512',l:'Image 512px',nu:5,ak:'apiImage',cm:1},{id:'i1k',l:'Image 1024px',nu:8,ak:'apiImage',cm:1.5},
  {id:'i2k',l:'Image 2048px',nu:16,ak:'apiImage',cm:3},{id:'i4k',l:'Image 4096px',nu:24,ak:'apiImage',cm:5},
  {id:'v480',l:'Video 480p',nu:30,ak:'apiVideo',cm:1},{id:'v480a',l:'Video 480p+audio',nu:50,ak:'apiVideo',cm:1.6},
  {id:'v720',l:'Video 720p',nu:60,ak:'apiVideo',cm:2},{id:'v720a',l:'Video 720p+audio',nu:90,ak:'apiVideo',cm:3},
  {id:'kQ',l:'Know Query',nu:1,ak:'apiKnow',cm:1},
];

/* ============================================================
   TAB SWITCHING
   ============================================================ */
window._simDirty=false;
window._editingOrgId=null;
document.addEventListener('click',e=>{
  if(!e.target.classList.contains('tab-btn'))return;
  const targetTab=e.target.dataset.tab;
  // Check if leaving simulator with unsaved changes
  const currentSim=document.querySelector('.tab-content.active');
  if(currentSim&&currentSim.id==='simulator'&&targetTab!=='simulator'&&window._simDirty){
    if(!confirm('You have unsaved changes in the simulator. Leave without saving?'))return;
    window._simDirty=false;
    window._editingOrgId=null;
  }
  $$('.tab-btn').forEach(x=>x.classList.remove('active'));
  $$('.tab-content').forEach(x=>x.classList.remove('active'));
  e.target.classList.add('active');
  const tab=$(targetTab);
  if(tab)tab.classList.add('active');
});

/* ============================================================
   ADMIN (COST CONTROLS)
   ============================================================ */
const TEAMS=[
  {k:'teamEng',ck:'teamEngC',l:'Engineering',h:'engineers'},
  {k:'teamSup',ck:'teamSupC',l:'Support',h:'staff'},
  {k:'teamSales',ck:'teamSalesC',l:'Sales/BD',h:'reps'},
  {k:'teamMgmt',ck:'teamMgmtC',l:'Management',h:'leads'},
];
const APIS=[
  {k:'apiPrompt',l:'Text Prompt (blended $/action)',h:'GPT 5.3, Claude Sonnet 4.6, Gemini'},
  {k:'apiDoc',l:'Doc Analysis ($/action)',h:'Doculing + LLM'},
  {k:'apiWord',l:'Word Gen ($/action)',h:'Multi-model'},{k:'apiPPT',l:'PPT Gen ($/action)',h:'Gemini 3.2 Pro'},
  {k:'apiExcel',l:'Excel Gen ($/action)',h:''},{k:'apiImage',l:'Image Gen ($/action)',h:'NanoBanan 2'},
  {k:'apiVideo',l:'Video 5s ($/action)',h:'Seedance 1.5 Pro'},{k:'apiKnow',l:'Know Query ($/action)',h:'Gemini 2.5 Flash'},
];

function buildAdm(){
  $('teamInputs').innerHTML=TEAMS.map(t=>`<div class="form-row" style="margin-bottom:8px">
    <div class="form-group" style="flex:2"><label class="form-label">${t.l} $/mo per person</label><input type="number" class="form-input adm" data-key="${t.k}" value="${A[t.k]}"></div>
    <div class="form-group" style="flex:1"><label class="form-label">Count</label><input type="number" class="form-input adm" data-key="${t.ck}" value="${A[t.ck]}" min="0"></div>
    <div class="form-group" style="flex:1"><label class="form-label">Subtotal</label><div style="padding:9px 12px;background:var(--bg3);border-radius:6px;font-weight:700;font-size:12px">${fD(A[t.k]*A[t.ck])}/mo</div></div>
  </div>`).join('');
  $('apiInputs').innerHTML=APIS.map(a=>`<div class="form-group"><label class="form-label">${a.l}</label><input type="number" class="form-input adm" data-key="${a.k}" value="${A[a.k]}" step=".001">${a.h?`<div class="form-hint">${a.h}</div>`:''}</div>`).join('');
}
function syncAdm(){
  $$('.adm').forEach(el=>{
    const k=el.dataset.key;
    if(k&&A[k]!==undefined){
      if(el.type==='range'){el.value=A[k];const sv=$(k+'Val');if(sv)sv.textContent=A[k]+'%'}
      else el.value=A[k];
    }
  });
  updAdmCalc();
}
function syncPricing(){
  $$('.price-in').forEach(el=>{
    const k=el.dataset.key;
    if(k&&A[k]!==undefined) el.value=A[k];
  });
  // Sync subscription pricing from pricing module
  const sSubP=$('sSubP');if(sSubP) sSubP.value=A.priceBaseSub;
}
function updAdmCalc(){
  const orgs=A.awsOrgs||portfolio.length;
  $('admCC').textContent=orgs;
  $('admAws').textContent=fD(awsC(orgs))+'/mo';
  $('admTeam').textContent=fD(teamC())+'/mo';
}

function bindAll(){
  document.addEventListener('input',e=>{
    if(e.target.classList.contains('adm')){
      const k=e.target.dataset.key;
      if(k){
        A[k]=parseFloat(e.target.value)||0;
        if(e.target.type==='range'){const sv=$(k+'Val');if(sv)sv.textContent=A[k]+'%'}
      }
      // Don't rebuild DOM on input - just update calculated values
      updAdmCalc();save();
      // Debounced full update to avoid focus loss
      clearTimeout(window._admTimer);
      window._admTimer=setTimeout(()=>{buildAdm();syncAdm();updateAll()},800);
    }
    if(e.target.classList.contains('price-in')){
      const k=e.target.dataset.key;
      if(k) A[k]=parseFloat(e.target.value)||0;
      syncPricing();
      save();renderNU();renderNUSchedule();updateSim();
    }
    if(e.target.classList.contains('sim')){window._simDirty=true;updateSim();updateUsageConversionNote()}
    if(e.target.classList.contains('sim-usage')){window._simDirty=true;updateSim();updateUsageConversionNote()}
    /* be-in and fund-in removed */
  });
  document.addEventListener('change',e=>{
    if(e.target.classList.contains('sim')){window._simDirty=true;updateSim();updateUsageConversionNote()}
    if(e.target.id==='usageModeToggle'){updateSim();updateUsageConversionNote()}
  });
}

/* ============================================================
   PRICING ENGINE
   ============================================================ */
function renderBundles(){
  const c=$('bundleContainer');
  c.innerHTML=`<div class="tier-row header"><span>Label</span><span class="num">NUs</span><span class="num">$/mo</span><span class="num">$/NU</span><span class="num">Disc</span><span></span></div>`;
  const br=bundles[0].u>0?bundles[0].p/bundles[0].u:.2;
  bundles.forEach((b,i)=>{
    const r=b.u>0?b.p/b.u:0;const d=br>0?1-r/br:0;
    c.innerHTML+=`<div class="tier-row">
      <input class="form-input" value="${b.l}" style="font-size:12px" oninput="bundles[${i}].l=this.value;save()" onchange="updateAll()" ${b.locked?'disabled':''}>
      <input type="number" class="form-input num" value="${b.u}" style="font-size:12px" oninput="bundles[${i}].u=parseInt(this.value)||0;save()" onchange="updateAll()" ${b.locked?'disabled':''}>
      <input type="number" class="form-input num" value="${b.p}" style="font-size:12px" oninput="bundles[${i}].p=parseFloat(this.value)||0;save()" onchange="updateAll()" ${b.locked?'disabled':''}>
      <span class="num" style="font-weight:700;font-size:12px">${fD(r)}</span>
      <span class="num" style="font-size:12px">${i===0?'–':pct(d)}</span>
      <span>${b.locked?'':'<button class="btn btn-danger btn-sm" onclick="bundles.splice('+i+',1);save();updateAll()">x</button>'}</span></div>`;
  });
}
function addBundle(){const l=bundles[bundles.length-1];bundles.push({l:'Custom',u:l.u*2,p:Math.round(l.p*1.8)});save();updateAll()}

function renderNU(){
  const mr=midRate();

  const smp=['prompt','docS','wordS','pptS','exS','i1k','v480a','kQ'];
  const sd=smp.map(id=>{const n=NU.find(x=>x.id===id);const c=A[n.ak]*n.cm,r=n.nu*mr;return{l:n.l.split('(')[0].trim(),c,r,m:r>0?(r-c)/r:0}});
  mkCh('chPMargin','bar',{labels:sd.map(d=>d.l),datasets:[{label:'Margin %',data:sd.map(d=>d.m*100),backgroundColor:sd.map(d=>d.m>=.5?'#059669':d.m>=0?'#d97706':'#dc2626'),borderRadius:6}]},{scales:{y:{ticks:{callback:v=>v+'%'}}}});
  mkCh('chPCR','bar',{labels:sd.map(d=>d.l),datasets:[{label:'Your Cost ($)',data:sd.map(d=>d.c),backgroundColor:'#dc2626',borderRadius:6},{label:'Revenue ($)',data:sd.map(d=>d.r),backgroundColor:'#059669',borderRadius:6}]});
  mkCh('chPTier','bar',{labels:bundles.map(b=>b.l),datasets:[{label:'$/NU',data:bundles.map(b=>b.u>0?b.p/b.u:0),backgroundColor:'#6366f1',borderRadius:6}]});
}

function renderNUSchedule(){
  const tbl=$('nuScheduleTable');if(!tbl)return;
  const mr=midRate();
  const categories=[
    {label:'Prompts (Per Query)',sub:'',tiers:[
      {id:'prompt',label:'All Tiers',desc:'0.25 NU'}]},
    {label:'Document Analysis',sub:'Per Uploaded File',tiers:[
      {id:'docS',label:'Core',desc:'≤10 pages'},
      {id:'docM',label:'Extended',desc:'11–30 pages'},
      {id:'docL',label:'Advanced',desc:'31–100 pages'},
      {id:'docXL',label:'Enterprise',desc:'>100 pages'}]},
    {label:'Word Creation',sub:'Per Generated Document',tiers:[
      {id:'wordS',label:'Core',desc:'≤5 pages'},
      {id:'wordM',label:'Extended',desc:'5–20 pages'},
      {id:'wordL',label:'Advanced',desc:'21–40 pages'},
      {id:'wordXL',label:'Enterprise',desc:'>40 pages'}]},
    {label:'PPT Creation',sub:'Per Generated Deck',tiers:[
      {id:'pptS',label:'Core',desc:'≤15 slides'},
      {id:'pptM',label:'Extended',desc:'15–30 slides'},
      {id:'pptL',label:'Advanced',desc:'31–50 slides'},
      {id:'pptXL',label:'Enterprise',desc:'>50 slides'}]},
    {label:'Excel Creation',sub:'Per Generated Workbook',tiers:[
      {id:'exS',label:'Core',desc:'1 sheet'},
      {id:'exM',label:'Extended',desc:'2 sheets'},
      {id:'exL',label:'Advanced',desc:'3–5 sheets'},
      {id:'exXL',label:'Enterprise',desc:'>5 sheets'}]},
    {label:'Image (Per Image)',sub:'',tiers:[
      {id:'i512',label:'512×512',desc:''},
      {id:'i1k',label:'1024×1024',desc:''},
      {id:'i2k',label:'2048×2048',desc:''},
      {id:'i4k',label:'4096×4096',desc:''}]},
    {label:'Video (Per 5s)',sub:'Coming Soon',tiers:[
      {id:'v480',label:'480p · No audio',desc:''},
      {id:'v480a',label:'480p · Audio',desc:''},
      {id:'v720',label:'720p · No audio',desc:''},
      {id:'v720a',label:'720p · Audio',desc:''}]},
  ];

  let h='<thead><tr><th style="min-width:180px">Category</th>';
  // Use max 4 tier columns
  const colHeaders=['Core','Extended','Advanced','Enterprise'];
  colHeaders.forEach(c=>h+=`<th class="num" style="min-width:120px">${c}</th>`);
  h+='</tr></thead><tbody>';

  categories.forEach(cat=>{
    // If single tier (prompts), span all 4 columns
    if(cat.tiers.length===1){
      const t=cat.tiers[0];const nuObj=NU.find(n=>n.id===t.id);const nu=nuObj?nuObj.nu:0;
      h+=`<tr><td><strong>${cat.label}</strong>${cat.sub?`<br><span style="font-size:11px;color:var(--text3)">${cat.sub}</span>`:''}</td>`;
      for(let i=0;i<4;i++){
        h+=`<td class="num"><input type="number" class="form-input nu-edit" data-nuid="${t.id}" value="${nu}" step="0.25" min="0" style="width:70px;text-align:right;font-size:12px;font-weight:700">`
          +`<div style="font-size:10px;color:var(--text3);margin-top:2px">${fD(nu*mr)}</div></td>`;
      }
      h+='</tr>';
    } else {
      // Multiple tiers: one row with 4 columns
      h+=`<tr><td><strong>${cat.label}</strong>${cat.sub?`<br><span style="font-size:11px;color:var(--text3)">${cat.sub}</span>`:''}</td>`;
      cat.tiers.forEach(t=>{
        const nuObj=NU.find(n=>n.id===t.id);const nu=nuObj?nuObj.nu:0;
        h+=`<td class="num"><input type="number" class="form-input nu-edit" data-nuid="${t.id}" value="${nu}" step="0.25" min="0" style="width:70px;text-align:right;font-size:12px;font-weight:700">`
          +`<div style="font-size:10px;color:var(--text3);margin-top:2px">${fD(nu*mr)}</div>`
          +`<div style="font-size:10px;color:var(--text3)">${t.desc||t.label}</div></td>`;
      });
      // Fill remaining columns if less than 4
      for(let i=cat.tiers.length;i<4;i++) h+='<td></td>';
      h+='</tr>';
    }
  });

  h+='</tbody>';tbl.innerHTML=h;
  tbl.querySelectorAll('.nu-edit').forEach(el=>{
    el.addEventListener('input',e=>{
      const nuid=e.target.dataset.nuid;
      const nuObj=NU.find(n=>n.id===nuid);
      if(nuObj) nuObj.nu=parseFloat(e.target.value)||0;
      // For single-tier items (prompt), sync all 4 inputs
      const allInputs=tbl.querySelectorAll(`.nu-edit[data-nuid="${nuid}"]`);
      allInputs.forEach(inp=>{if(inp!==e.target) inp.value=e.target.value});
      syncNUHints();renderNU();updateSim();
      clearTimeout(window._nuTimer);window._nuTimer=setTimeout(()=>renderNUSchedule(),800);
    });
  });
}

/* ============================================================
   SIMULATOR
   ============================================================ */
function autoFillActiveUsers(){
  const total=v('sUsers');
  $('sActive').value=Math.round(total*0.65);
  updateSim();
}

function nuVal(id){const n=NU.find(x=>x.id===id);return n?n.nu:0}
function nuCost(id){const n=NU.find(x=>x.id===id);return n?A[n.ak]*n.cm:0}
function syncNUHints(){
  /* no-op: hints are now inline in the usage table */
}

/* Sim usage table categories - mirrors the NU consumption schedule */
const SIM_USAGE_CATS=[
  {label:'Prompts (Per Query)',sub:'',tiers:[{id:'prompt',desc:''}]},
  {label:'Document Analysis',sub:'Per Uploaded File',tiers:[
    {id:'docS',desc:'≤10 pages'},{id:'docM',desc:'11–30 pages'},{id:'docL',desc:'31–100 pages'},{id:'docXL',desc:'>100 pages'}]},
  {label:'Word Creation',sub:'Per Generated Document',tiers:[
    {id:'wordS',desc:'≤5 pages'},{id:'wordM',desc:'5–20 pages'},{id:'wordL',desc:'21–40 pages'},{id:'wordXL',desc:'>40 pages'}]},
  {label:'PPT Creation',sub:'Per Generated Deck',tiers:[
    {id:'pptS',desc:'≤15 slides'},{id:'pptM',desc:'15–30 slides'},{id:'pptL',desc:'31–50 slides'},{id:'pptXL',desc:'>50 slides'}]},
  {label:'Excel Creation',sub:'Per Generated Workbook',tiers:[
    {id:'exS',desc:'1 sheet'},{id:'exM',desc:'2 sheets'},{id:'exL',desc:'3–5 sheets'},{id:'exXL',desc:'>5 sheets'}]},
  {label:'Image (Per Image)',sub:'',tiers:[
    {id:'i512',desc:'512×512'},{id:'i1k',desc:'1024×1024'},{id:'i2k',desc:'2048×2048'},{id:'i4k',desc:'4096×4096'}]},
  {label:'Video (Per 5s)',sub:'Coming Soon',tiers:[
    {id:'v480',desc:'480p · No audio'},{id:'v480a',desc:'480p · Audio'},{id:'v720',desc:'720p · No audio'},{id:'v720a',desc:'720p · Audio'}]},
  {label:'Know Queries',sub:'',tiers:[{id:'kQ',desc:''}]},
];

function buildSimUsageTable(){
  const body=$('simUsageBody');if(!body)return;
  const mr=midRate();
  let h='';
  SIM_USAGE_CATS.forEach(cat=>{
    if(cat.tiers.length===1){
      const t=cat.tiers[0];const nuObj=NU.find(n=>n.id===t.id);const nu=nuObj?nuObj.nu:0;
      h+=`<tr><td><strong>${cat.label}</strong>${cat.sub?`<br><span style="font-size:11px;color:var(--text3)">${cat.sub}</span>`:''}</td>`;
      for(let i=0;i<4;i++){
        h+=`<td class="num"><div class="sim-converted" data-nuid="${t.id}" style="font-size:10px;color:var(--text3);min-height:14px;text-align:right"></div>`;
        h+=`<input type="number" class="form-input sim-usage" data-nuid="${t.id}" value="0" min="0" style="width:70px;text-align:right;font-size:12px">`;
        h+=`<div class="sim-nu-display" data-nuid="${t.id}" style="font-size:10px;color:var(--text3);margin-top:2px">${fmt(nu,2)} NU · ${fD(nu*mr)}</div></td>`;
      }
      h+='</tr>';
    } else {
      h+=`<tr><td><strong>${cat.label}</strong>${cat.sub?`<br><span style="font-size:11px;color:var(--text3)">${cat.sub}</span>`:''}</td>`;
      cat.tiers.forEach(t=>{
        const nuObj=NU.find(n=>n.id===t.id);const nu=nuObj?nuObj.nu:0;
        h+=`<td class="num"><div class="sim-converted" data-nuid="${t.id}" style="font-size:10px;color:var(--text3);min-height:14px;text-align:right"></div>`;
        h+=`<input type="number" class="form-input sim-usage" data-nuid="${t.id}" value="0" min="0" style="width:70px;text-align:right;font-size:12px">`;
        h+=`<div class="sim-nu-display" data-nuid="${t.id}" style="font-size:10px;color:var(--text3);margin-top:2px">${fmt(nu,2)} NU · ${fD(nu*mr)}</div>`;
        h+=`<div style="font-size:10px;color:var(--text3)">${t.desc}</div></td>`;
      });
      for(let i=cat.tiers.length;i<4;i++) h+='<td></td>';
      h+='</tr>';
    }
  });
  body.innerHTML=h;
}

/* Usage mode: checked=org, unchecked=per-user */
function isOrgMode(){const t=$('usageModeToggle');return t?t.checked:true}

function getSimUsageValues(){
  // Read all sim-usage inputs, summing duplicates (e.g. prompt appears 4x)
  const vals={};
  const au=v('sActive')||1;
  const perUser=!isOrgMode();
  $$('.sim-usage').forEach(el=>{
    const nuid=el.dataset.nuid;
    let cnt=parseInt(el.value)||0;
    if(perUser) cnt=cnt*au; // scale per-user input to org total
    if(!vals[nuid]) vals[nuid]=0;
    vals[nuid]+=cnt;
  });
  return vals;
}

function updateUsageConversionNote(){
  const note=$('usageConversionNote');
  const lbl=$('usageModeLabel');
  const au=v('sActive')||1;
  const mr=midRate();
  const perUser=!isOrgMode();
  if(lbl) lbl.textContent=perUser?'per user':'whole organisation';
  // highlight active label
  const lu=$('modeLabelUser'),lo=$('modeLabelOrg');
  if(lu) lu.style.color=perUser?'var(--accent)':'var(--text3)';
  if(lo) lo.style.color=perUser?'var(--text3)':'var(--accent)';

  // Update per-cell converted values above each input
  $$('.sim-usage').forEach(inp=>{
    const convDiv=inp.previousElementSibling;
    if(!convDiv||!convDiv.classList.contains('sim-converted'))return;
    const cnt=parseInt(inp.value)||0;
    if(cnt===0){convDiv.innerHTML='';return}
    if(perUser){
      const orgVal=cnt*au;
      convDiv.innerHTML=`<span style="color:var(--text3);font-size:10px">Org: ${orgVal.toLocaleString()}</span>`;
    } else {
      const userVal=au>0?(cnt/au):0;
      convDiv.innerHTML=`<span style="color:var(--text3);font-size:10px">Per user: ${userVal%1===0?userVal.toLocaleString():userVal.toFixed(1)}</span>`;
    }
  });

  // Summary note
  if(!note) return;
  const usage=getSimUsageValues(); // already scaled to org
  let totalNU=0;
  for(const [nuid,count] of Object.entries(usage)){
    const nuObj=NU.find(n=>n.id===nuid);if(!nuObj)continue;
    totalNU+=count*nuObj.nu;
  }
  if(perUser){
    const perUserNU=au>0?(totalNU/au):0;
    note.style.display='block';
    note.innerHTML=`<strong>Organisation total</strong> (×${au} active users): <strong>${fmt(totalNU)} NU</strong> · ${fD(totalNU*mr)}
      &nbsp;|&nbsp; Per-user input: ${fmt(perUserNU)} NU · ${fD(perUserNU*mr)}`;
  } else {
    const perUserNU=au>0?(totalNU/au):0;
    note.style.display='block';
    note.innerHTML=`<strong>Per-user average</strong> (÷${au} active users): <strong>${fmt(perUserNU)} NU</strong> · ${fD(perUserNU*mr)}
      &nbsp;|&nbsp; Organisation total: ${fmt(totalNU)} NU · ${fD(totalNU*mr)}`;
  }
}

function calcAndShowNU(){
  const au=v('sActive');
  const usage=getSimUsageValues();
  const mr=midRate();

  let totalNU=0, totalApiCost=0;
  const breakdown={
    prompts:{label:'Prompts',nu:0,cost:0},
    docs:{label:'Docs',nu:0,cost:0},
    word:{label:'Word',nu:0,cost:0},
    ppt:{label:'PPT',nu:0,cost:0},
    excel:{label:'Excel',nu:0,cost:0},
    images:{label:'Images',nu:0,cost:0},
    video:{label:'Video',nu:0,cost:0},
    know:{label:'Know',nu:0,cost:0}
  };

  const catMap={prompt:'prompts',docS:'docs',docM:'docs',docL:'docs',docXL:'docs',
    wordS:'word',wordM:'word',wordL:'word',wordXL:'word',
    pptS:'ppt',pptM:'ppt',pptL:'ppt',pptXL:'ppt',
    exS:'excel',exM:'excel',exL:'excel',exXL:'excel',
    i512:'images',i1k:'images',i2k:'images',i4k:'images',
    v480:'video',v480a:'video',v720:'video',v720a:'video',
    kQ:'know'};

  const knowOn=$('sKnow')&&$('sKnow').checked;

  for(const [nuid,count] of Object.entries(usage)){
    if(nuid==='kQ'&&!knowOn) continue;
    const nuObj=NU.find(n=>n.id===nuid);if(!nuObj) continue;
    const nu=count*nuObj.nu;
    const cost=count*(A[nuObj.ak]*nuObj.cm);
    totalNU+=nu;
    totalApiCost+=cost;
    const bk=catMap[nuid];
    if(bk){breakdown[bk].nu+=nu;breakdown[bk].cost+=cost}
  }

  // Update NU/$ display next to each input
  $$('.sim-nu-display').forEach(el=>{
    const nuid=el.dataset.nuid;
    const nuObj=NU.find(n=>n.id===nuid);if(!nuObj)return;
    const inp=el.previousElementSibling;
    const cnt=parseInt(inp.value)||0;
    const nu=cnt*nuObj.nu;
    const cost=nu*mr;
    if(cnt>0){
      el.innerHTML=`<strong>${fmt(nu,1)} NU</strong> · ${fD(cost)}`;
      el.style.color='var(--accent)';
    } else {
      el.innerHTML=`${fmt(nuObj.nu,2)} NU · ${fD(nuObj.nu*mr)}`;
      el.style.color='var(--text3)';
    }
  });

  // Show NU estimate
  const el=$('sNUEstimate');
  if(el){
    const bunOptions=[[0,500],[1000,1500],[2500,3000],[5000,7500],[10000,17500],[25000,35000]];
    let suggestVal=0;
    for(const [bu,limit] of bunOptions){if(totalNU<=limit){suggestVal=bu;break}else suggestVal=25000}
    const bundleSel=$('sBundle');
    if(bundleSel) bundleSel.value=suggestVal;

    const sugBundle=bundles.find(b=>b.u===suggestVal);
    const sugLabel=sugBundle?sugBundle.l:'Base';
    const sugPrice=sugBundle?sugBundle.p:100;

    el.innerHTML=`<div class="card" style="border-left:4px solid var(--accent)">
      <div class="card-title">Estimated Monthly NU Consumption</div>
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:12px">
        <div class="kpi-card"><div class="kpi-label">Total Organisation</div><div class="kpi-value">${fmt(totalNU)} <span style="font-size:14px">NU</span></div></div>
        <div class="kpi-card cyan"><div class="kpi-label">Total Cost</div><div class="kpi-value">${fD(totalNU*mr)}</div></div>
        <div class="kpi-card green"><div class="kpi-label">Suggested Bundle</div><div class="kpi-value" style="font-size:18px">${sugLabel}</div><div class="kpi-sub">${fD(sugPrice)}/mo</div></div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text3)">
        ${Object.values(breakdown).filter(b=>b.nu>0).map(b=>`<span>${b.label}: ${fmt(b.nu)} NU · ${fD(b.nu*mr)}</span>`).join('')}
      </div>
    </div>`;
  }

  return {au,totalNU,totalApiCost,breakdown};
}

function updateSim(){
  const {au,totalNU,totalApiCost,breakdown}=calcAndShowNU();
  const knowOn=$('sKnow')&&$('sKnow').checked;
  const doOn=$('sDo')&&$('sDo').checked;
  if($('sIntCard')) $('sIntCard').style.display=(knowOn||doOn)?'block':'none';
  if($('sDoCard')) $('sDoCard').style.display=doOn?'block':'none';

  const apiCo = totalApiCost; // total API cost/mo for this org (org-level now)

  // Integration counts
  const iS=v('sIntS'), iM=v('sIntM'), iC=v('sIntC');

  // Integration revenue (what you charge customer)
  const intChargeOT = (knowOn||doOn) ? iS*A.priceIntSimple + iM*A.priceIntModerate + iC*A.priceIntComplex : 0;

  // Do module revenue
  const doChargeOT = v('sCustFee');

  // One-time costs (internal) – covered by Know/Do hiring
  const otCostInternal = 0;
  // One-time revenue from customer
  const otRevenue = doChargeOT + intChargeOT;

  // Monthly costs (for this org) – only API + AWS, no team/overhead allocation
  const awsInc = A.awsPerCust; // per-org AWS
  const moCost = awsInc + apiCo;

  // Monthly revenue from this org
  const sub = v('sSubP');
  const bU = parseInt($('sBundle').value)||0;
  const bP = bPrice(bU);
  const moRev = sub + bP;

  const netOT = otRevenue - otCostInternal;
  const moMarg = moRev - moCost;
  const margP = moRev>0 ? moMarg/moRev : 0;
  const payback = moMarg>0 ? Math.ceil(Math.max(0,-netOT)/moMarg) : Infinity;
  const nuAv = 500+bU;
  const nuUt = nuAv>0 ? totalNU/nuAv : 0;
  const ltv = moMarg*18 + otRevenue;
  const ltvCac = otCostInternal>0 ? ltv/otCostInternal : Infinity;

  $('simRes').innerHTML=`
    <div class="kpi-grid" style="margin-bottom:16px;grid-template-columns:repeat(4,1fr)">
      <div class="kpi-card"><div class="kpi-label">NU Usage/mo</div><div class="kpi-value">${fmt(totalNU)} <span style="font-size:12px">NU</span></div><div class="kpi-sub">${fmt(nuAv)} NU avail (${pct(nuUt)} used)</div></div>
      <div class="kpi-card green"><div class="kpi-label">Monthly Revenue</div><div class="kpi-value">${fD(moRev)}</div><div class="kpi-sub">Sub ${fD(sub)} + Bundle ${fD(bP)}/mo</div></div>
      <div class="kpi-card yellow"><div class="kpi-label">Monthly Cost</div><div class="kpi-value">${fD(moCost)}</div><div class="kpi-sub">AWS ${fD(awsInc)} | API ${fD(apiCo)}/mo</div></div>
      <div class="kpi-card ${moMarg>=0?'green':'red'}"><div class="kpi-label">Monthly Margin</div><div class="kpi-value">${fD(moMarg)}</div><div class="kpi-sub">${pct(margP)}</div></div>
    </div>
    <table class="data-table"><tbody>
      <tr><td>One-Time Internal Cost</td><td class="num negative">${fD(otCostInternal)}</td><td>Covered by Know/Do hiring</td></tr>
      <tr><td>One-Time Revenue from Customer</td><td class="num positive">${fD(otRevenue)}</td><td>Do Fee + Integration Charges</td></tr>
      <tr class="highlight-row"><td><strong>Net One-Time</strong></td><td class="num ${netOT>=0?'positive':'negative'}">${fD(netOT)}</td><td>${netOT>=0?'Covered upfront':'Recover from monthly margin'}</td></tr>
      <tr class="highlight-row"><td><strong>Payback Period</strong></td><td class="num" style="font-weight:800;color:${payback<=6?'var(--green)':payback<=12?'var(--yellow)':'var(--red)'}">${payback===Infinity?'Never':payback+' months'}</td><td></td></tr>
      <tr><td>LTV (18 months)</td><td class="num positive">${fD(ltv)}</td><td></td></tr>
      <tr><td>LTV:CAC</td><td class="num" style="color:${ltvCac>=3?'var(--green)':'var(--red)'}">${ltvCac===Infinity?'N/A':fmt(ltvCac,1)+'x'}</td><td>${ltvCac>=3?'Healthy':'Needs improvement'}</td></tr>
    </tbody></table>
    <div style="margin:12px 0;padding:10px;border-radius:8px;background:var(--bg3)">
      <div style="font-size:13px;margin-bottom:8px;color:var(--text)"><strong>Itemized Monthly API Cost & NU (this organisation)</strong></div>
      <div style="display:grid;grid-template-columns:1fr 100px 100px;gap:6px;font-size:12px;color:var(--text3)">
        <div style="font-weight:600">Category</div><div style="font-weight:600;text-align:right">NU/mo</div><div style="font-weight:600;text-align:right">API Cost/mo</div>
        ${Object.values(breakdown).filter(it=>it.nu>0||it.cost>0).map(it=>`<div>${it.label}</div><div style="text-align:right">${fmt(it.nu)} NU</div><div style="text-align:right">${fD(it.cost)}</div>`).join('')}
        <div style="font-weight:700;border-top:1px solid var(--border);padding-top:4px">Total</div>
        <div style="text-align:right;font-weight:700;border-top:1px solid var(--border);padding-top:4px">${fmt(totalNU)} NU</div>
        <div style="text-align:right;font-weight:700;border-top:1px solid var(--border);padding-top:4px">${fD(apiCo)}</div>
      </div>
    </div>`;

  // Charts
  const mL=Array.from({length:24},(_,i)=>'M'+(i+1));
  let cc=otCostInternal,cr=otRevenue;const cC=[],cR=[],cP=[];
  for(let m=0;m<24;m++){cc+=moCost;cr+=moRev;cC.push(cc);cR.push(cr);cP.push(cr-cc)}
  mkCh('chSimROI','line',{labels:mL,datasets:[
    {label:'Cum Revenue ($)',data:cR,borderColor:'#059669',fill:false,tension:.3},
    {label:'Cum Cost ($)',data:cC,borderColor:'#dc2626',fill:false,tension:.3},
    {label:'Cum Profit ($)',data:cP,borderColor:'#4338ca',backgroundColor:cP.map(x=>x>=0?'rgba(67,56,202,.08)':'rgba(220,38,38,.08)'),fill:true,tension:.3},
  ]});
  mkCh('chSimBar','bar',{labels:['AWS/mo','API/mo','Revenue/mo'],
    datasets:[{data:[awsInc,apiCo,moRev],backgroundColor:['#6366f1','#db2777','#059669'],borderRadius:6}]});

  window._lastSim={
    name:$('sName').value, sector:$('sSector').value, region:$('sRegion').value,
    users:v('sUsers'), active:au, knowOn, doOn,
    intS:v('sIntS'), intM:v('sIntM'), intC:v('sIntC'),
    doS:v('sDoS'), doM:v('sDoM'), doC:v('sDoC'),
    moRev, moCost, moMarg, margP, otCostInternal, otRevenue, payback, ltv, ltvCac, tNU:totalNU, nuAv, breakdown
  };
}

/* Dashboard removed */

/* Breakeven & Funding removed */

/* ============================================================
   PORTFOLIO
   ============================================================ */
async function saveToPortfolio(){
  if(!window._lastSim){alert('Run a simulation first.');return}
  const org={...window._lastSim,id:window._editingOrgId||Date.now()};
  // Remove existing if editing
  if(window._editingOrgId){
    portfolio=portfolio.filter(x=>x.id!==window._editingOrgId);
    window._editingOrgId=null;
  }
  portfolio.push(org);
  A.awsOrgs=portfolio.length;
  // Save to localStorage immediately
  localStorage.setItem('ns_a',JSON.stringify(A));
  localStorage.setItem('ns_b',JSON.stringify(bundles));
  localStorage.setItem('ns_p',JSON.stringify(portfolio));
  syncAdm();
  updateAll();
  window._simDirty=false;
  // Immediate backend save (not debounced)
  try{
    await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:A,b:bundles})});
    await fetch('/api/orgs/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgs:portfolio})});
    showToast('"'+org.name+'" saved to database successfully!');
  }catch(e){
    console.error('Save failed:',e);
    showToast('Saved locally but database sync failed. Will retry.','error');
  }
}

function showToast(msg,type){
  let t=document.querySelector('.toast-notification');
  if(!t){t=document.createElement('div');t.className='toast-notification';document.body.appendChild(t)}
  // Force reflow to restart transition if already visible
  t.classList.remove('show');
  void t.offsetWidth;
  t.textContent=msg;
  t.style.background=type==='error'?'var(--red)':'var(--green)';
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>t.classList.remove('show'),3500);
}
async function rmPort(id){
  if(!confirm('Delete this organisation from portfolio?'))return;
  const org=portfolio.find(p=>p.id===id);
  portfolio=portfolio.filter(p=>p.id!==id);
  A.awsOrgs=portfolio.length;
  localStorage.setItem('ns_a',JSON.stringify(A));
  localStorage.setItem('ns_p',JSON.stringify(portfolio));
  syncAdm();
  updateAll();
  try{
    await fetch('/api/org/'+id,{method:'DELETE'});
    showToast('"'+(org?org.name:'Organisation')+'" deleted from database.');
  }catch(e){
    showToast('Deleted locally but database sync failed.','error');
  }
}
function editPort(id){
  const p=portfolio.find(x=>x.id===id);if(!p)return;
  // Track which org we are editing so save replaces it
  window._editingOrgId=id;
  // Load org data back into simulator fields
  $('sName').value=p.name||'';
  $('sSector').value=p.sector||'';
  $('sRegion').value=p.region||'india';
  $('sUsers').value=p.users||50;
  $('sActive').value=p.active||33;
  if($('sThink')) $('sThink').checked=true;
  if($('sKnow')) $('sKnow').checked=!!p.knowOn;
  if($('sDo')) $('sDo').checked=!!p.doOn;
  $('sIntS').value=p.intS||0;$('sIntM').value=p.intM||0;$('sIntC').value=p.intC||0;
  $('sDoS').value=p.doS||0;$('sDoM').value=p.doM||0;$('sDoC').value=p.doC||0;
  // Switch to simulator tab
  $$('.tab-btn').forEach(x=>x.classList.remove('active'));
  $$('.tab-content').forEach(x=>x.classList.remove('active'));
  const simBtn=document.querySelector('[data-tab="simulator"]');
  if(simBtn){simBtn.classList.add('active');$('simulator').classList.add('active')}
  updateSim();
  window._simDirty=false;
  showToast('Editing "'+p.name+'" — make changes and Save to Portfolio.');
}
function updatePort(){
  if(!portfolio.length){
    $('portEmpty').style.display='block';$('portKpis').style.display='none';$('portCharts').style.display='none';$('portGrid').innerHTML='';return;
  }
  $('portEmpty').style.display='none';$('portKpis').style.display='grid';$('portCharts').style.display='grid';
  const tR=portfolio.reduce((s,p)=>s+(p.moRev||0),0), tC=portfolio.reduce((s,p)=>s+(p.moCost||0),0), aM=tR>0?(tR-tC)/tR:0;
  $('portKpis').innerHTML=`
    <div class="kpi-card"><div class="kpi-label">Organisations</div><div class="kpi-value">${portfolio.length}</div></div>
    <div class="kpi-card green"><div class="kpi-label">Total MRR</div><div class="kpi-value">${fD(tR)}</div><div class="kpi-sub">per month</div></div>
    <div class="kpi-card yellow"><div class="kpi-label">Total Variable Cost</div><div class="kpi-value">${fD(tC)}</div><div class="kpi-sub">per month</div></div>
    <div class="kpi-card ${aM>=0?'green':'red'}"><div class="kpi-label">Avg Margin</div><div class="kpi-value">${pct(aM)}</div></div>`;
  $('portGrid').innerHTML=portfolio.map(p=>`<div class="cust-card">
    <div class="cc-name">${p.name||'Unnamed'}</div><div class="cc-stat">${p.sector||'–'} | ${(p.region||'').toUpperCase()||'–'} | ${p.active||0} active users</div>
    <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
      <span style="color:var(--text3)">Rev:</span><span class="num positive">${fD(p.moRev||0)}/mo</span>
      <span style="color:var(--text3)">Cost:</span><span class="num">${fD(p.moCost||0)}/mo</span>
      <span style="color:var(--text3)">Margin:</span><span class="num ${(p.margP||0)>=0?'positive':'negative'}">${pct(p.margP||0)}</span>
      <span style="color:var(--text3)">Payback:</span><span class="num">${p.payback===Infinity||!p.payback?'N/A':p.payback+' mo'}</span>
      <span style="color:var(--text3)">LTV:CAC:</span><span class="num">${p.ltvCac===Infinity||!p.ltvCac?'N/A':fmt(p.ltvCac,1)+'x'}</span>
      <span style="color:var(--text3)">NU/mo:</span><span class="num">${fmt(p.tNU||0)} NU</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
      <button class="btn btn-secondary btn-sm" style="flex:1;font-size:11px" onclick="editPort(${p.id})">Edit</button>
      <button class="btn btn-sm" style="flex:1;font-size:11px;background:var(--red);color:#fff;border:none;border-radius:6px;cursor:pointer" onclick="rmPort(${p.id})">Delete</button>
    </div></div>`).join('');
  mkCh('chPortR','bar',{labels:portfolio.map(p=>p.name),datasets:[{label:'Revenue ($/mo)',data:portfolio.map(p=>p.moRev),backgroundColor:'#059669',borderRadius:6},{label:'Cost ($/mo)',data:portfolio.map(p=>p.moCost),backgroundColor:'#dc2626',borderRadius:6}]});
  mkCh('chPortM','bar',{labels:portfolio.map(p=>p.name),datasets:[{label:'Margin %',data:portfolio.map(p=>p.margP*100),backgroundColor:portfolio.map(p=>p.margP>=0?'#059669':'#dc2626'),borderRadius:6}]},{scales:{y:{ticks:{callback:x=>x+'%'}}}});
}

/* ============================================================
   UNIT ECONOMICS & P&L
   ============================================================ */
function updateUnitEconomics(){
  const n=portfolio.length;
  const totalUsers=portfolio.reduce((s,p)=>s+(p.users||0),0);
  const totalActive=portfolio.reduce((s,p)=>s+(p.active||0),0);
  const tMoRev=portfolio.reduce((s,p)=>s+(p.moRev||0),0);
  const arpu=n>0?tMoRev/n:0;

  // Direct costs
  const awsTotal=awsC(n);
  const awsBaseCost=A.awsBase;
  const awsOrgCost=awsTotal-awsBaseCost;
  const totalApiCost=n>0?portfolio.reduce((s,p)=>s+((p.moCost||0)-A.awsPerCust),0):0;
  const directCosts=awsTotal+totalApiCost;

  // Indirect costs
  const engCost=A.teamEng*A.teamEngC;
  const supCost=A.teamSup*A.teamSupC;
  const salesCost=A.teamSales*A.teamSalesC;
  const mgmtCost=A.teamMgmt*A.teamMgmtC;
  const teamTotal=teamC();
  const overheadTotal=ovhd();
  const indirectCosts=teamTotal+overheadTotal;

  // Margins
  const totalCost=directCosts+indirectCosts;
  const grossMargin=tMoRev-directCosts;
  const grossMarginPct=tMoRev>0?grossMargin/tMoRev:0;
  const netMargin=tMoRev-totalCost;
  const netMarginPct=tMoRev>0?netMargin/tMoRev:0;
  const burn=Math.max(0,-netMargin);

  // Unit economics
  const avgDirectPerOrg=n>0?directCosts/n:0;
  const avgContribMargin=n>0?arpu-avgDirectPerOrg:0;
  const avgContribPct=arpu>0?avgContribMargin/arpu:0;
  const totalNU=portfolio.reduce((s,p)=>s+(p.tNU||0),0);
  const avgNU=n>0?totalNU/n:0;
  const mr=midRate();
  const revPerNU=totalNU>0?tMoRev/totalNU:0;
  const costPerNU=totalNU>0?totalApiCost/totalNU:0;
  const marginPerNU=revPerNU-costPerNU;

  // Breakeven
  const contribPerOrg=avgContribMargin>0?avgContribMargin:arpu>0?arpu*0.85:0;
  const beCust=contribPerOrg>0?Math.ceil(indirectCosts/contribPerOrg):0;
  const gap=Math.max(0,beCust-n);
  const moToGo=gap>0?Math.ceil(gap/2):0;
  const cashNeeded=burn*moToGo*1.25;

  // Sensitivity: breakeven at different ARPUs
  const arpuScenarios=[300,500,800,1000,1500,2000,3000];
  const sensitivityRows=arpuScenarios.map(a=>{
    const dc=n>0?avgDirectPerOrg:A.awsPerCust;
    const cm=a-dc;
    const be=cm>0?Math.ceil(indirectCosts/cm):Infinity;
    const mo=Math.max(0,be-n);
    return {arpu:a,contrib:cm,be,gap:mo,moToGo:mo>0?Math.ceil(mo/2):0};
  });

  const db=$('ueDashboard');
  if(!db)return;

  db.innerHTML=`
  <!-- KPI ROW -->
  <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="kpi-card"><div class="kpi-label">Organisations</div><div class="kpi-value">${n}</div><div class="kpi-sub">${totalUsers} users (${totalActive} active)</div></div>
    <div class="kpi-card green"><div class="kpi-label">Monthly Revenue (MRR)</div><div class="kpi-value">${fD(tMoRev)}</div><div class="kpi-sub">ARPU ${fD(arpu)}/org</div></div>
    <div class="kpi-card red"><div class="kpi-label">Total Monthly Cost</div><div class="kpi-value">${fD(totalCost)}</div><div class="kpi-sub">Direct ${fD(directCosts)} + Indirect ${fD(indirectCosts)}</div></div>
    <div class="kpi-card ${netMargin>=0?'green':'red'}"><div class="kpi-label">Net Margin</div><div class="kpi-value">${fD(netMargin)}</div><div class="kpi-sub">${pct(netMarginPct)}</div></div>
  </div>
  <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
    <div class="kpi-card cyan"><div class="kpi-label">Direct Costs</div><div class="kpi-value">${fD(directCosts)}</div><div class="kpi-sub">AWS + API/Model</div></div>
    <div class="kpi-card yellow"><div class="kpi-label">Indirect Costs</div><div class="kpi-value">${fD(indirectCosts)}</div><div class="kpi-sub">Team + Overheads</div></div>
    <div class="kpi-card ${grossMarginPct>=0.5?'green':grossMarginPct>=0.2?'yellow':'red'}"><div class="kpi-label">Gross Margin</div><div class="kpi-value">${fD(grossMargin)}</div><div class="kpi-sub">${pct(grossMarginPct)} (Rev − Direct)</div></div>
    <div class="kpi-card"><div class="kpi-label">Monthly Burn</div><div class="kpi-value ${burn>0?'negative':''}">${burn>0?fD(burn):'$0'}</div><div class="kpi-sub">${burn>0?'Cash outflow/mo':'Cash flow positive'}</div></div>
  </div>

  <!-- P&L STATEMENT -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Profit & Loss Statement <span class="badge badge-info">Monthly</span></div>
    <table class="data-table">
      <thead><tr><th style="width:50%">Line Item</th><th class="num">Amount ($/mo)</th><th class="num">% of Revenue</th></tr></thead>
      <tbody>
        <tr style="background:var(--bg2)"><td colspan="3" style="font-weight:700;color:var(--accent)">REVENUE</td></tr>
        <tr><td style="padding-left:24px">Subscription & Bundle Revenue (${n} orgs)</td><td class="num positive">${fD(tMoRev)}</td><td class="num">100%</td></tr>
        <tr class="highlight-row"><td><strong>Total Revenue</strong></td><td class="num positive" style="font-weight:800">${fD(tMoRev)}</td><td class="num" style="font-weight:800">100%</td></tr>

        <tr style="background:var(--bg2)"><td colspan="3" style="font-weight:700;color:var(--cyan)">DIRECT COSTS (Variable)</td></tr>
        <tr><td style="padding-left:24px">AWS Base Infrastructure (3 regions)</td><td class="num">${fD(awsBaseCost)}</td><td class="num">${tMoRev>0?pct(awsBaseCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">AWS Per-Organisation (${n} orgs, incl. scaling discount)</td><td class="num">${fD(awsOrgCost)}</td><td class="num">${tMoRev>0?pct(awsOrgCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">API & Model Costs (LLM providers)</td><td class="num">${fD(totalApiCost)}</td><td class="num">${tMoRev>0?pct(totalApiCost/tMoRev):'–'}</td></tr>
        <tr class="highlight-row"><td><strong>Total Direct Costs</strong></td><td class="num" style="font-weight:800">${fD(directCosts)}</td><td class="num" style="font-weight:800">${tMoRev>0?pct(directCosts/tMoRev):'–'}</td></tr>

        <tr class="highlight-row" style="background:rgba(5,150,105,0.06)"><td><strong>GROSS MARGIN</strong></td><td class="num ${grossMargin>=0?'positive':'negative'}" style="font-weight:800">${fD(grossMargin)}</td><td class="num" style="font-weight:800">${tMoRev>0?pct(grossMarginPct):'–'}</td></tr>

        <tr style="background:var(--bg2)"><td colspan="3" style="font-weight:700;color:var(--yellow)">INDIRECT COSTS (Fixed)</td></tr>
        <tr><td style="padding-left:24px">Engineering Team (${A.teamEngC} people)</td><td class="num">${fD(engCost)}</td><td class="num">${tMoRev>0?pct(engCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Support Team (${A.teamSupC} people)</td><td class="num">${fD(supCost)}</td><td class="num">${tMoRev>0?pct(supCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Sales & BD Team (${A.teamSalesC} people)</td><td class="num">${fD(salesCost)}</td><td class="num">${tMoRev>0?pct(salesCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Management (${A.teamMgmtC} people)</td><td class="num">${fD(mgmtCost)}</td><td class="num">${tMoRev>0?pct(mgmtCost/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Office Rent</td><td class="num">${fD(A.office)}</td><td class="num">${tMoRev>0?pct(A.office/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Tools & Subscriptions</td><td class="num">${fD(A.tools)}</td><td class="num">${tMoRev>0?pct(A.tools/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Legal</td><td class="num">${fD(A.legal)}</td><td class="num">${tMoRev>0?pct(A.legal/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Insurance</td><td class="num">${fD(A.insurance)}</td><td class="num">${tMoRev>0?pct(A.insurance/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Marketing</td><td class="num">${fD(A.marketing)}</td><td class="num">${tMoRev>0?pct(A.marketing/tMoRev):'–'}</td></tr>
        <tr><td style="padding-left:24px">Miscellaneous</td><td class="num">${fD(A.misc)}</td><td class="num">${tMoRev>0?pct(A.misc/tMoRev):'–'}</td></tr>
        <tr class="highlight-row"><td><strong>Total Indirect Costs</strong></td><td class="num" style="font-weight:800">${fD(indirectCosts)}</td><td class="num" style="font-weight:800">${tMoRev>0?pct(indirectCosts/tMoRev):'–'}</td></tr>

        <tr style="background:var(--bg2)"><td colspan="3"></td></tr>
        <tr class="highlight-row"><td><strong>TOTAL COSTS</strong></td><td class="num" style="font-weight:800">${fD(totalCost)}</td><td class="num" style="font-weight:800">${tMoRev>0?pct(totalCost/tMoRev):'–'}</td></tr>
        <tr class="highlight-row" style="background:${netMargin>=0?'rgba(5,150,105,0.08)':'rgba(220,38,38,0.08)'}"><td style="font-size:15px"><strong>NET MARGIN</strong></td><td class="num ${netMargin>=0?'positive':'negative'}" style="font-weight:900;font-size:15px">${fD(netMargin)}</td><td class="num" style="font-weight:900;font-size:15px">${tMoRev>0?pct(netMarginPct):'–'}</td></tr>
      </tbody>
    </table>
  </div>

  <!-- CHARTS ROW -->
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card"><div class="card-title">Cost Structure Breakdown</div><div class="chart-wrap tall"><canvas id="chCostStructure"></canvas></div></div>
    <div class="card"><div class="card-title">Revenue vs Direct Cost per Organisation</div><div class="chart-wrap tall"><canvas id="chOrgComparison"></canvas></div></div>
  </div>

  <!-- UNIT ECONOMICS -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Unit Economics <span class="badge badge-info">Per Organisation & Per NU</span></div>
    ${n===0?'<div style="padding:24px;text-align:center;color:var(--text3)">Onboard organisations via the Simulator and save to Portfolio to see unit economics.</div>':`
    <div class="grid-2">
      <div>
        <table class="data-table">
          <thead><tr><th colspan="2" style="text-align:center;background:var(--accent);color:#fff">Per Organisation</th></tr></thead>
          <tbody>
            <tr><td>Average Revenue (ARPU)</td><td class="num positive" style="font-weight:700">${fD(arpu)}/mo</td></tr>
            <tr><td>Average Direct Cost</td><td class="num">${fD(avgDirectPerOrg)}/mo</td></tr>
            <tr class="highlight-row"><td><strong>Contribution Margin</strong></td><td class="num ${avgContribMargin>=0?'positive':'negative'}" style="font-weight:700">${fD(avgContribMargin)}/mo (${pct(avgContribPct)})</td></tr>
            <tr><td>Avg NU Consumption</td><td class="num">${fmt(avgNU,0)} NU/mo</td></tr>
            <tr><td>Avg Users per Org</td><td class="num">${n>0?fmt(totalUsers/n,0):0}</td></tr>
            <tr><td>Revenue per User</td><td class="num">${totalUsers>0?fD(tMoRev/totalUsers):'–'}/mo</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <table class="data-table">
          <thead><tr><th colspan="2" style="text-align:center;background:var(--accent2);color:#fff">Per Nectar Unit (NU)</th></tr></thead>
          <tbody>
            <tr><td>Blended $/NU Rate (Pricing)</td><td class="num" style="font-weight:700">${fD(mr)}</td></tr>
            <tr><td>Effective Revenue/NU</td><td class="num positive">${totalNU>0?fD(revPerNU):'–'}</td></tr>
            <tr><td>API Cost/NU</td><td class="num">${totalNU>0?fD(costPerNU):'–'}</td></tr>
            <tr class="highlight-row"><td><strong>Margin/NU</strong></td><td class="num ${marginPerNU>=0?'positive':'negative'}" style="font-weight:700">${totalNU>0?fD(marginPerNU):'–'}</td></tr>
            <tr><td>NU Margin %</td><td class="num">${totalNU>0&&revPerNU>0?pct(marginPerNU/revPerNU):'–'}</td></tr>
            <tr><td>Total NU Consumption</td><td class="num">${fmt(totalNU,0)} NU/mo</td></tr>
          </tbody>
        </table>
      </div>
    </div>`}
  </div>

  <!-- BREAKEVEN ANALYSIS -->
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">Breakeven Analysis <span class="badge badge-info">Dynamic</span></div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="kpi-card ${n>=beCust&&beCust>0?'green':'yellow'}"><div class="kpi-label">Breakeven Target</div><div class="kpi-value">${beCust>0?beCust:'–'}</div><div class="kpi-sub">organisations needed</div></div>
      <div class="kpi-card"><div class="kpi-label">Current Orgs</div><div class="kpi-value">${n}</div><div class="kpi-sub">onboarded</div></div>
      <div class="kpi-card ${gap===0&&n>0?'green':'red'}"><div class="kpi-label">Gap</div><div class="kpi-value">${gap}</div><div class="kpi-sub">more orgs needed</div></div>
      <div class="kpi-card"><div class="kpi-label">Time to Breakeven</div><div class="kpi-value">${moToGo>0?moToGo+' mo':n>=beCust&&beCust>0?'Now':'–'}</div><div class="kpi-sub">at 2 orgs/month</div></div>
    </div>
    ${burn>0?`<div style="padding:12px;background:rgba(220,38,38,0.06);border-radius:8px;border-left:3px solid var(--red);margin-bottom:16px;font-size:13px">
      <strong>Current burn rate:</strong> ${fD(burn)}/mo. Cash needed to reach breakeven (with 25% buffer): <strong>${fD(cashNeeded)}</strong>.
      Each new organisation at ${fD(arpu||500)}/mo ARPU contributes <strong>${fD(avgContribMargin)}/mo</strong> towards covering indirect costs.
    </div>`:''}
    ${n>=beCust&&beCust>0?`<div style="padding:12px;background:rgba(5,150,105,0.06);border-radius:8px;border-left:3px solid var(--green);margin-bottom:16px;font-size:13px">
      <strong>Breakeven achieved.</strong> The business is generating positive net margin of <strong>${fD(netMargin)}/mo</strong>.
    </div>`:''}

    <div class="card-title" style="font-size:13px;margin-top:8px">Sensitivity: Breakeven at Different ARPU Levels</div>
    <table class="data-table">
      <thead><tr><th>ARPU ($/mo)</th><th class="num">Contribution/Org</th><th class="num">Orgs to Breakeven</th><th class="num">Gap from Current</th><th class="num">Months (@ 2/mo)</th></tr></thead>
      <tbody>
        ${sensitivityRows.map(r=>`<tr${r.arpu===arpuScenarios.find(a=>Math.abs(a-arpu)<50)?` style="background:var(--accentLight);font-weight:600"`:''}>
          <td>${fD(r.arpu)}</td>
          <td class="num ${r.contrib>=0?'positive':'negative'}">${fD(r.contrib)}</td>
          <td class="num">${r.be===Infinity?'Never':r.be}</td>
          <td class="num">${r.be===Infinity?'–':Math.max(0,r.be-n)}</td>
          <td class="num">${r.be===Infinity?'–':r.moToGo>0?r.moToGo+' mo':'Now'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- BREAKEVEN CHART -->
  <div class="card">
    <div class="card-title">Path to Breakeven — Projected Growth</div>
    <div class="chart-wrap tall"><canvas id="chBreakeven"></canvas></div>
    <div style="padding:8px 12px;font-size:11px;color:var(--text3)">Projection assumes 2 new organisations/month at current ARPU of ${fD(arpu||500)}/mo with scaling AWS discounts applied.</div>
  </div>`;

  // === CHARTS ===

  // Cost Structure Doughnut
  mkCh('chCostStructure','doughnut',{
    labels:['AWS Infrastructure','API & Model Costs','Team Salaries','Overheads'],
    datasets:[{data:[awsTotal,totalApiCost,teamTotal,overheadTotal],
      backgroundColor:['#6366f1','#db2777','#f59e0b','#94a3b8'],
      borderWidth:2,borderColor:'#fff'}]
  },{plugins:{legend:{position:'bottom'}}});

  // Revenue vs Direct Cost per Org
  if(n>0){
    mkCh('chOrgComparison','bar',{
      labels:portfolio.map(p=>p.name),
      datasets:[
        {label:'Revenue ($/mo)',data:portfolio.map(p=>p.moRev),backgroundColor:'#059669',borderRadius:6},
        {label:'Direct Cost ($/mo)',data:portfolio.map(p=>p.moCost),backgroundColor:'#dc2626',borderRadius:6}
      ]
    });
  }

  // Breakeven Projection Chart
  const projMonths=24;
  const projLabels=Array.from({length:projMonths},(_,i)=>'M'+(i+1));
  const projRevenue=[],projCost=[];
  for(let m=0;m<projMonths;m++){
    const projOrgs=n+Math.floor((m+1)*2); // 2 new orgs/month
    const projMRR=projOrgs*(arpu||500);
    const projAWS=awsC(projOrgs);
    const projAPI=projOrgs*(n>0?totalApiCost/n:0);
    const projDirect=projAWS+projAPI;
    const projTotal=projDirect+indirectCosts;
    projRevenue.push(projMRR);
    projCost.push(projTotal);
  }
  mkCh('chBreakeven','line',{
    labels:projLabels,
    datasets:[
      {label:'Projected Revenue ($/mo)',data:projRevenue,borderColor:'#059669',backgroundColor:'rgba(5,150,105,0.05)',fill:true,tension:.3},
      {label:'Total Cost ($/mo)',data:projCost,borderColor:'#dc2626',backgroundColor:'rgba(220,38,38,0.05)',fill:true,tension:.3}
    ]
  });
}

/* ============================================================
   CHART HELPER
   ============================================================ */
function mkCh(id,type,data,extra){
  if(charts[id])charts[id].destroy();
  const el=$(id);
  if(!el)return;
  const o={responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:'#475569',font:{size:10,family:'Inter'}}},tooltip:{backgroundColor:'#fff',titleColor:'#1e1b4b',bodyColor:'#475569',borderColor:'#e2e8f0',borderWidth:1}},
    scales:type==='doughnut'||type==='pie'?undefined:{
      x:{ticks:{color:'#94a3b8',font:{size:9.5}},grid:{color:'rgba(226,232,240,.5)'}},
      y:{ticks:{color:'#94a3b8',font:{size:9.5},callback:val=>typeof val==='number'&&Math.abs(val)>=1000?'$'+(val/1000).toFixed(0)+'k':typeof val==='number'?'$'+val:val},grid:{color:'rgba(226,232,240,.5)'}}}};
  if(extra){if(extra.scales&&o.scales)Object.assign(o.scales,extra.scales);if(extra.plugins)Object.assign(o.plugins,extra.plugins)}
  charts[id]=new Chart(el.getContext('2d'),{type,data,options:o});
}

/* ============================================================
   UPDATE ALL
   ============================================================ */
function updateAll(){
  updAdmCalc();
  renderBundles();
  renderNU();
  renderNUSchedule();
  syncNUHints();
  buildSimUsageTable();
  updateSim();
  updateUsageConversionNote();
  updatePort();
  updateUnitEconomics();
}

/* ============================================================
   INIT
   ============================================================ */
async function init(){
  // Try loading from backend (Turso) first, fall back to localStorage
  const backendData = await loadFromBackend();
  if(backendData){
    A = {...DEF, ...(backendData.a || {})};
    bundles = (backendData.b && backendData.b.length) ? backendData.b : JSON.parse(JSON.stringify(DEF_BUNDLES));
    portfolio = backendData.p || [];
    A.awsOrgs = portfolio.length;
    // Cache to localStorage
    localStorage.setItem('ns_a', JSON.stringify(A));
    localStorage.setItem('ns_b', JSON.stringify(bundles));
    localStorage.setItem('ns_p', JSON.stringify(portfolio));
  } else {
    load();
  }
  buildAdm();
  syncAdm();
  syncPricing();
  bindAll();
  updateAll();
}

const $ = (id)=>document.getElementById(id);
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DOW_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const COLORS = ["blue","green","orange","red","yellow","purple"];

const defaults = {
  name:"Roly",
  planTitle:"Transformation 2026",
  age:54,
  height:"5'9\"",
  units:"imperial",
  startDate:new Date().toISOString().slice(0,10),
  startWeight:187,
  goalWeight:150,
  currentWeight:187,
  protein:170,
  water:4,
  sleep:7.5,
  vialDays:30,
  mealTemplate:"Breakfast: Eggs, oats, berries\nSnack: Greek yogurt, almonds\nLunch: Chicken, rice, vegetables\nSnack: Protein shake\nDinner: Fish or lean beef, salad, avocado",
  workouts:{
    Sunday:"Rest",
    Monday:"Chest + Triceps",
    Tuesday:"Back + Biceps",
    Wednesday:"Cardio + Abs",
    Thursday:"Legs",
    Friday:"Shoulders modified + Abs",
    Saturday:"Light cardio / mobility"
  },
  peptides:[
    {id:"reta", name:"Retatrutide", active:true, purpose:"Weight management", days:["Sunday"], color:"red"},
    {id:"klow", name:"KLOW", active:true, purpose:"Recovery / tissue support", days:["Monday","Tuesday","Wednesday","Thursday","Friday"], color:"green"},
    {id:"tesa", name:"Tesamorelin", active:true, purpose:"Body composition", days:["Monday","Tuesday","Wednesday","Thursday","Friday"], color:"blue"},
    {id:"ipa", name:"Ipamorelin", active:true, purpose:"Recovery / sleep routine", days:["Monday","Tuesday","Wednesday","Thursday","Friday"], color:"blue"},
    {id:"mots", name:"MOTS-c", active:true, purpose:"Metabolic support", days:["Monday","Thursday"], color:"orange"},
    {id:"kiss", name:"Kisspeptin", active:false, purpose:"Hormonal support", days:[], color:"yellow"}
  ]
};

const store = {
  get(k, fallback){ try{return JSON.parse(localStorage.getItem(k)) ?? fallback}catch{return fallback}},
  set(k,v){ localStorage.setItem(k, JSON.stringify(v))}
};
function profile(){ return {...defaults, ...store.get("profile", {})}; }
function saveProfile(p){ store.set("profile", p); }

function dayName(date=new Date()){
  return date.toLocaleDateString("en-US",{weekday:"long"});
}
function tasksForDay(name){
  const p=profile();
  const tasks=p.peptides.filter(x=>x.active && x.days.includes(name)).map(x=>x.name);
  tasks.push(`Water ${p.water} ${p.units==="imperial"?"L":"L"}`);
  tasks.push(`Protein ${p.protein} g`);
  if(p.workouts[name]) tasks.push(p.workouts[name]);
  return tasks;
}
function nextScheduledShot(){
  const p=profile();
  const now=new Date();
  for(let offset=0; offset<8; offset++){
    const d=new Date(now); d.setDate(now.getDate()+offset);
    const dn=dayName(d);
    const item=p.peptides.find(x=>x.active && x.days.includes(dn));
    if(item) return {label: offset===0 ? "Today" : dn, item:item.name};
  }
  return {label:"—", item:"No schedule"};
}
function units(){
  const p=profile();
  document.querySelectorAll(".unitWeight").forEach(e=>e.textContent=p.units==="imperial"?"lb":"kg");
}
function updateDashboard(){
  const p=profile();
  const current=Number(p.currentWeight || p.startWeight);
  const start=Number(p.startWeight);
  const goal=Number(p.goalWeight);
  const total=Math.abs(start-goal) || 1;
  const progress=Math.abs(start-current);
  const pct=Math.min(100, Math.max(0, Math.round((progress/total)*100)));
  $("appTitle").textContent=`${p.name || "My"} ${p.planTitle || "Tracker"}`;
  $("startWeightDash").textContent=start || "—";
  $("goalWeightDash").textContent=goal || "—";
  $("currentWeight").textContent=current || "—";
  $("remainingWeight").textContent=Math.max(0, Math.abs(current-goal)).toFixed(1);
  $("weightInput").value=current || "";
  $("goalSummary").textContent=`Protein ${p.protein} g/day • Water ${p.water} L/day • Sleep ${p.sleep} hrs`;
  $("progressPercent").textContent=pct+"%";
  document.querySelector(".ring").style.setProperty("--deg",(pct*3.6)+"deg");
  const dn=dayName();
  $("todayName").textContent=dn;
  $("todayTasks").textContent=tasksForDay(dn).join(" • ");
  const ns=nextScheduledShot();
  $("nextShot").textContent=ns.label;
  $("nextShotName").textContent=ns.item;
  $("proteinDash").textContent=p.protein;
  $("waterDash").textContent=p.water;
  $("sleepDash").textContent=p.sleep;
  $("planDash").textContent=p.planTitle;
  units();
  renderTodayChecklist();
}
function renderTodayChecklist(){
  const dn=dayName();
  const key="todayDone_"+new Date().toDateString();
  const done=store.get(key,{});
  const box=$("todayChecklist"); box.innerHTML="";
  tasksForDay(dn).forEach(task=>{
    const div=document.createElement("div");
    div.className="check-item "+(done[task]?"done":"");
    div.innerHTML=`<span>${task}</span><button>${done[task]?"Done":"Mark"}</button>`;
    div.querySelector("button").onclick=()=>{done[task]=!done[task];store.set(key,done);renderTodayChecklist()};
    box.appendChild(div);
  });
}
function renderDaily(){
  const p=profile();
  const list=$("dayList"); list.innerHTML="";
  const s=new Date((p.startDate || new Date().toISOString().slice(0,10))+"T00:00:00");
  for(let i=0;i<90;i++){
    const d=new Date(s); d.setDate(s.getDate()+i);
    const dn=dayName(d);
    const label=d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    const card=document.createElement("div");
    card.className="day-card";
    const pills=tasksForDay(dn).map((t,idx)=>{
      const item=p.peptides.find(x=>x.name===t);
      const c=item ? item.color : (t.includes("Water")?"blue":t.includes("Protein")?"green":"");
      return `<span class="pill ${c}">${t}</span>`;
    }).join("");
    card.innerHTML=`<h3>Day ${i+1} • ${label} • ${dn}</h3><div class="pill-row">${pills}</div>`;
    list.appendChild(card);
  }
}
function renderItems(){
  const p=profile();
  const box=$("itemCards"); box.innerHTML="";
  p.peptides.forEach(item=>{
    const div=document.createElement("div");
    div.className="peptide-card";
    div.innerHTML=`<h3>${item.name}</h3><p class="muted">${item.purpose || ""}</p><div class="pill-row"><span class="pill ${item.color}">${item.active?"Active":"Off"}</span><span class="pill">${item.days.length?item.days.join(", "):"No days selected"}</span></div>`;
    box.appendChild(div);
  });
  updateVialDropdown();
}
function updateVialDropdown(){
  const p=profile();
  const sel=$("vialName");
  const current=sel.value;
  sel.innerHTML="";
  p.peptides.forEach(item=>{
    const opt=document.createElement("option"); opt.textContent=item.name; opt.value=item.name; sel.appendChild(opt);
  });
  if(current) sel.value=current;
}
function renderSettings(){
  const p=profile();
  $("setName").value=p.name||"";
  $("setPlanTitle").value=p.planTitle||"";
  $("setAge").value=p.age||"";
  $("setHeight").value=p.height||"";
  $("setUnits").value=p.units||"imperial";
  $("setStartDate").value=p.startDate||"";
  $("setStartWeight").value=p.startWeight||"";
  $("setGoalWeight").value=p.goalWeight||"";
  $("setProtein").value=p.protein||"";
  $("setWater").value=p.water||"";
  $("setSleep").value=p.sleep||"";
  $("setVialDays").value=p.vialDays||30;
  $("mealTemplate").value=p.mealTemplate || "";
  const box=$("peptideSettingsList"); box.innerHTML="";
  p.peptides.forEach((item,idx)=>{
    const div=document.createElement("div");
    div.className="setting-item";
    div.innerHTML=`
      <div class="setting-row">
        <input data-idx="${idx}" data-field="name" value="${item.name}">
        <select data-idx="${idx}" data-field="active"><option value="true">Active</option><option value="false">Off</option></select>
      </div>
      <input data-idx="${idx}" data-field="purpose" value="${item.purpose || ""}" placeholder="Purpose">
      <div class="days-grid">${DOW.map((d,i)=>`<label><input type="checkbox" data-idx="${idx}" data-day="${d}" ${item.days.includes(d)?"checked":""}>${DOW_SHORT[i]}</label>`).join("")}</div>
      <div class="setting-row">
        <select data-idx="${idx}" data-field="color">${COLORS.map(c=>`<option value="${c}">${c}</option>`).join("")}</select>
        <button class="small-btn remove-item" data-idx="${idx}">Remove</button>
      </div>`;
    box.appendChild(div);
    div.querySelector(`[data-field="active"]`).value=String(item.active);
    div.querySelector(`[data-field="color"]`).value=item.color || "blue";
  });
  document.querySelectorAll(".remove-item").forEach(btn=>btn.onclick=()=>{
    const p=profile(); p.peptides.splice(Number(btn.dataset.idx),1); saveProfile(p); refreshAll();
  });
}
function readSettings(){
  const p=profile();
  p.name=$("setName").value || "User";
  p.planTitle=$("setPlanTitle").value || "Tracker";
  p.age=Number($("setAge").value)||"";
  p.height=$("setHeight").value||"";
  p.units=$("setUnits").value;
  p.startDate=$("setStartDate").value || new Date().toISOString().slice(0,10);
  p.startWeight=Number($("setStartWeight").value)||0;
  p.goalWeight=Number($("setGoalWeight").value)||0;
  p.currentWeight=Number($("weightInput").value)||p.startWeight;
  p.protein=Number($("setProtein").value)||0;
  p.water=Number($("setWater").value)||0;
  p.sleep=Number($("setSleep").value)||0;
  p.vialDays=Number($("setVialDays").value)||30;
  p.mealTemplate=$("mealTemplate").value || "";
  document.querySelectorAll(".setting-item").forEach((div,idx)=>{
    const item=p.peptides[idx];
    if(!item) return;
    item.name=div.querySelector('[data-field="name"]').value || item.name;
    item.active=div.querySelector('[data-field="active"]').value==="true";
    item.purpose=div.querySelector('[data-field="purpose"]').value || "";
    item.color=div.querySelector('[data-field="color"]').value || "blue";
    item.days=[...div.querySelectorAll("[data-day]:checked")].map(x=>x.dataset.day);
  });
  saveProfile(p);
}
function renderWorkouts(){
  const p=profile();
  const edit=$("workoutEditor"); edit.innerHTML="";
  DOW.forEach(d=>{
    const label=document.createElement("label");
    label.textContent=d;
    label.innerHTML=`${d}<input data-workout-day="${d}" value="${p.workouts[d] || ""}">`;
    edit.appendChild(label);
  });
  const box=$("workoutCards"); box.innerHTML="";
  DOW.forEach(d=>{
    const div=document.createElement("div");
    div.className="workout-card";
    div.innerHTML=`<h3>${d}</h3><p class="muted">${p.workouts[d] || "—"}</p><div class="pill-row"><span class="pill">Sets</span><span class="pill green">Reps</span><span class="pill orange">Notes</span></div>`;
    box.appendChild(div);
  });
}
function saveWorkouts(){
  const p=profile();
  document.querySelectorAll("[data-workout-day]").forEach(inp=>p.workouts[inp.dataset.workoutDay]=inp.value);
  saveProfile(p); refreshAll();
}
function renderInventory(){
  const p=profile();
  const list=store.get("inventory",[]);
  const box=$("inventoryList"); box.innerHTML="";
  if(!list.length){ box.innerHTML='<p class="muted">No vials/items added yet.</p>'; return; }
  list.forEach((v,idx)=>{
    const recon=new Date(v.date+"T00:00:00");
    const useBy=new Date(recon); useBy.setDate(recon.getDate()+(p.vialDays||30));
    const daysLeft=Math.ceil((useBy-new Date())/(1000*60*60*24));
    const status = daysLeft < 0 ? "Expired" : daysLeft <= 7 ? "Use soon" : "OK";
    const color = daysLeft < 0 ? "red" : daysLeft <= 7 ? "yellow" : "green";
    const div=document.createElement("div");
    div.className="inventory-card";
    div.innerHTML=`<b>${v.qty} × ${v.name}</b><p class="muted">Reconstituted/opened: ${v.date || "Not set"} • Use by: ${useBy.toISOString().slice(0,10)}</p><span class="pill ${color}">${status}: ${daysLeft} days</span> <button class="small-btn" data-idx="${idx}">Remove</button>`;
    div.querySelector("button").onclick=()=>{list.splice(idx,1);store.set("inventory",list);renderInventory()};
    box.appendChild(div);
  });
}
function renderProgress(){
  const list=store.get("progress",[]);
  const box=$("progressList"); box.innerHTML="";
  if(!list.length){ box.innerHTML='<div class="card"><p class="muted">No progress entries yet.</p></div>'; return; }
  list.slice().reverse().forEach(p=>{
    const div=document.createElement("div"); div.className="progress-card";
    div.innerHTML=`<b>${p.date}</b><p class="muted">Weight: ${p.weight || "-"} • Waist: ${p.waist || "-"} • Sleep: ${p.sleep || "-"} hrs • Energy: ${p.energy || "-"}/10</p>`;
    box.appendChild(div);
  });
}
function calcDose(){
  const vial=Number($("vialMg").value), water=Number($("waterMl").value), dose=Number($("doseMg").value), syringe=Number($("syringeType").value);
  if(!vial||!water||!dose){return}
  const conc=vial/water;
  const ml=dose/conc;
  const units=ml*100;
  $("concOut").textContent=conc.toFixed(2)+" mg/mL";
  $("mlOut").textContent=ml.toFixed(3)+" mL";
  $("unitsOut").textContent=units.toFixed(1)+" units";
  $("syringeOut").textContent=units<=syringe ? "Fits" : `Needs > ${syringe} units`;
}
function refreshAll(){
  renderSettings(); updateDashboard(); renderDaily(); renderItems(); renderWorkouts(); renderInventory(); renderProgress(); calcDose();
}
document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.screen).classList.add("active");
  }
});
$("themeToggle").onclick=()=>{document.body.classList.toggle("light"); store.set("light",document.body.classList.contains("light"))};
$("weightInput").onchange=()=>{const p=profile(); p.currentWeight=Number($("weightInput").value); saveProfile(p); updateDashboard()};
$("resetToday").onclick=()=>{localStorage.removeItem("todayDone_"+new Date().toDateString());renderTodayChecklist()};
$("saveSettings").onclick=()=>{readSettings(); refreshAll(); alert("Settings saved.")};
$("addPeptideSetting").onclick=()=>{const p=profile(); p.peptides.push({id:"custom_"+Date.now(),name:"New Item",active:true,purpose:"Custom reminder",days:["Monday"],color:"purple"}); saveProfile(p); refreshAll()};
$("resetAll").onclick=()=>{ if(confirm("Reset all app data on this device?")){localStorage.clear(); location.reload();}};
$("generateDays").onclick=renderDaily;
$("calcDose").onclick=calcDose;
$("addVial").onclick=()=>{
  const list=store.get("inventory",[]);
  list.push({name:$("vialName").value,date:$("reconDate").value || new Date().toISOString().slice(0,10),qty:Number($("vialQty").value)||1});
  store.set("inventory",list); renderInventory();
};
$("saveWorkout").onclick=saveWorkouts;
$("saveMeals").onclick=()=>{const p=profile(); p.mealTemplate=$("mealTemplate").value; saveProfile(p); refreshAll(); alert("Meal template saved.")};
$("addProgress").onclick=()=>{
  const p=profile();
  const list=store.get("progress",[]);
  const entry={date:$("progDate").value || new Date().toISOString().slice(0,10),weight:$("progWeight").value,waist:$("progWaist").value,sleep:$("progSleep").value,energy:$("progEnergy").value};
  list.push(entry);
  if(entry.weight){p.currentWeight=Number(entry.weight); saveProfile(p);}
  store.set("progress",list); renderProgress(); updateDashboard();
};
if(!store.get("profile",null)) saveProfile(defaults);
if(store.get("light",false)) document.body.classList.add("light");
refreshAll();
if("serviceWorker" in navigator){ navigator.serviceWorker.register("service-worker.js").catch(()=>{}); }

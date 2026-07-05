const $=id=>document.getElementById(id);
const sb=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
let STATE={profile:null,items:[],vials:[],progress:[],daily:[],workouts:[],meals:null};
const DEFAULT_PROFILE={name:"Roly",plan_title:"Transformation 2026",age:54,height:"5'9",units:"imperial",start_date:new Date().toISOString().slice(0,10),starting_weight:187,goal_weight:150,current_weight:187,protein_goal:170,water_goal:4,sleep_goal:7.5,vial_limit_days:30, meal_template:"Breakfast: eggs, oats, berries\nSnack: Greek yogurt, almonds\nLunch: chicken, rice, vegetables\nSnack: protein shake\nDinner: fish or lean beef, salad, avocado"};
const DEFAULT_ITEMS=[["Retatrutide","Weight management",true,["Sunday"],"red"],["KLOW","Recovery / tissue support",true,["Monday","Tuesday","Wednesday","Thursday","Friday"],"green"],["Tesamorelin","Body composition",true,["Monday","Tuesday","Wednesday","Thursday","Friday"],"blue"],["Ipamorelin","Recovery / sleep routine",true,["Monday","Tuesday","Wednesday","Thursday","Friday"],"blue"],["MOTS-c","Metabolic support",true,["Monday","Thursday"],"orange"],["Kisspeptin","Hormonal support",false,[],"yellow"]];
const DEFAULT_WORKOUTS={Sunday:"Rest",Monday:"Chest + Triceps",Tuesday:"Back + Biceps",Wednesday:"Cardio + Abs",Thursday:"Legs",Friday:"Shoulders modified + Abs",Saturday:"Light cardio / mobility"};
function setStatus(t){$("cloudStatus").textContent=t}
function dayName(d=new Date()){return d.toLocaleDateString("en-US",{weekday:"long"})}
function iso(d){return d.toISOString().slice(0,10)}
async function safeSelect(table){try{return await sb.from(table).select("*")}catch(e){return {data:[],error:e}}}
async function init(){
  try{
    setStatus("Loading from Supabase...");
    let {data:p,error:pe}=await sb.from("user_profiles").select("*").order("created_at",{ascending:true}).limit(1);
    if(pe)throw pe;
    if(!p||!p.length){const {data:newp,error:e}=await sb.from("user_profiles").insert(DEFAULT_PROFILE).select().single();if(e)throw e;STATE.profile=newp}else STATE.profile=p[0];
    let {data:items,error:ie}=await sb.from("peptide_items").select("*").order("created_at",{ascending:true});
    if(ie)throw ie;
    if(!items||!items.length){for(const i of DEFAULT_ITEMS){await sb.from("peptide_items").insert({name:i[0],purpose:i[1],active:i[2],schedule_days:i[3],color:i[4]})}}
    await loadAll(); setStatus("Cloud connected");
  }catch(e){setStatus("Cloud error: "+e.message);console.error(e)}
}
async function loadAll(){
  const [items,vials,progress,daily,workouts]=await Promise.all([
    sb.from("peptide_items").select("*").order("created_at",{ascending:true}),
    sb.from("vial_inventory").select("*").order("created_at",{ascending:false}),
    sb.from("progress_logs").select("*").order("log_date",{ascending:false}),
    sb.from("daily_logs").select("*").order("log_date",{ascending:false}),
    safeSelect("workout_plan")
  ]);
  STATE.items=items.data||[];STATE.vials=vials.data||[];STATE.progress=progress.data||[];STATE.daily=daily.data||[];STATE.workouts=workouts.data||[];
  renderAll();
}
function workoutFor(day){let w=STATE.workouts.find(x=>x.day_name===day);return w? w.workout_name : DEFAULT_WORKOUTS[day]}
function tasksForDay(day){
  let arr=STATE.items.filter(i=>i.active&&(i.schedule_days||[]).includes(day)).map(i=>i.name);
  const p=STATE.profile; arr.push(`Water ${p.water_goal} L`,`Protein ${p.protein_goal} g`);
  if(workoutFor(day)) arr.push(workoutFor(day));
  return arr;
}
function renderAll(){renderDashboard();renderProfile();renderItems();renderInventory();renderProgress();renderDaily();renderWorkout();renderNutrition();calcDose()}
function renderDashboard(){
  const p=STATE.profile||DEFAULT_PROFILE,start=Number(p.starting_weight),goal=Number(p.goal_weight),cur=Number(p.current_weight);
  const total=Math.abs(start-goal)||1,done=Math.abs(start-cur),pct=Math.min(100,Math.max(0,Math.round(done/total*100)));
  $("appTitle").textContent=`${p.name||"My"} ${p.plan_title||"Tracker"}`;$("startWeightDash").textContent=start;$("goalWeightDash").textContent=goal;$("currentWeight").textContent=cur;$("remainingWeight").textContent=Math.abs(cur-goal).toFixed(1);$("progressPercent").textContent=pct+"%";document.querySelector(".ring").style.setProperty("--deg",(pct*3.6)+"deg");
  document.querySelectorAll(".unitWeight").forEach(x=>x.textContent=p.units==="metric"?"kg":"lb");$("weightUnit").textContent=p.units==="metric"?"kg":"lb";
  $("goalSummary").textContent=`Protein ${p.protein_goal} g/day • Water ${p.water_goal} L/day • Sleep ${p.sleep_goal} hrs`;
  $("recordCount").textContent=STATE.vials.length+STATE.progress.length+STATE.daily.length;$("activeItems").textContent=STATE.items.filter(i=>i.active).length;
  const box=$("todayChecklist");box.innerHTML="";const today=iso(new Date());tasksForDay(dayName()).forEach(task=>box.appendChild(checkItem(today,task)));
}
function checkItem(date,task){
  const done=STATE.daily.find(d=>d.log_date===date&&d.item_name===task&&d.status==="Done");
  const div=document.createElement("div");div.className="check-item "+(done?"done":"");div.innerHTML=`<span>${task}</span><button>${done?"Done":"Mark"}</button>`;
  div.querySelector("button").onclick=async()=>{if(done){await sb.from("daily_logs").delete().eq("id",done.id)}else{await sb.from("daily_logs").insert({log_date:date,item_name:task,status:"Done"})}await loadAll()};
  return div;
}
function renderDaily(){
  const box=$("dayList");box.innerHTML="";
  const p=STATE.profile||DEFAULT_PROFILE;let start=new Date((p.start_date||iso(new Date()))+"T00:00:00");
  for(let i=0;i<90;i++){
    let d=new Date(start); d.setDate(start.getDate()+i); let date=iso(d), day=dayName(d);
    let div=document.createElement("div");div.className="list-card";
    let tasks=tasksForDay(day); let doneCount=tasks.filter(t=>STATE.daily.find(x=>x.log_date===date&&x.item_name===t&&x.status==="Done")).length;
    div.innerHTML=`<div class="day-date">Day ${i+1} • ${date} • ${day}</div><h3>${doneCount}/${tasks.length} complete</h3><div class="checklist"></div>`;
    let cb=div.querySelector(".checklist"); tasks.forEach(t=>cb.appendChild(checkItem(date,t)));
    box.appendChild(div);
  }
}
function renderProfile(){
  const p=STATE.profile||DEFAULT_PROFILE;$("setName").value=p.name||"";$("setPlanTitle").value=p.plan_title||"";$("setAge").value=p.age||"";$("setHeight").value=p.height||"";$("setUnits").value=p.units||"imperial";$("setStartDate").value=p.start_date||"";$("setStartWeight").value=p.starting_weight||"";$("setGoalWeight").value=p.goal_weight||"";$("setCurrentWeight").value=p.current_weight||"";$("setProtein").value=p.protein_goal||"";$("setWater").value=p.water_goal||"";$("setSleep").value=p.sleep_goal||"";$("setVialDays").value=p.vial_limit_days||30;
}
function pill(c,t){return `<span class="pill ${c||""}">${t}</span>`}
function card(title,body,pills="",actions=""){return `<div class="list-card"><h3>${title}</h3><p class="muted">${body}</p><div class="pill-row">${pills}</div>${actions}</div>`}
function renderItems(){const box=$("itemsList");box.innerHTML=STATE.items.length?"":"<div class='card'><p class='muted'>No items yet.</p></div>";STATE.items.forEach(i=>box.innerHTML+=card(i.name,i.purpose||"",pill(i.color,i.active?"Active":"Off")+pill("",(i.schedule_days||[]).join(", ")||"No days"),`<div class="card-actions"><button class="small-btn" onclick="deleteRow('peptide_items','${i.id}')">Delete</button></div>`))}
function renderInventory(){const box=$("inventoryList"),limit=Number((STATE.profile||{}).vial_limit_days||30);box.innerHTML=STATE.vials.length?"":"<div class='card'><p class='muted'>No vials yet.</p></div>";STATE.vials.forEach(v=>{let recon=new Date((v.reconstituted_date||iso(new Date()))+"T00:00:00"),use=new Date(recon);use.setDate(recon.getDate()+limit);let days=Math.ceil((use-new Date())/86400000),c=days<0?"red":days<=7?"yellow":"green";box.innerHTML+=card(`${v.quantity||1} × ${v.item_name}`,`Reconstituted: ${v.reconstituted_date||"-"} • Use by: ${use.toISOString().slice(0,10)} • ${v.notes||""}`,pill(c,`${days} days left`),`<div class="card-actions"><button class="small-btn" onclick="deleteRow('vial_inventory','${v.id}')">Delete</button></div>`)})}
function renderProgress(){const box=$("progressList");box.innerHTML=STATE.progress.length?"":"<div class='card'><p class='muted'>No progress yet.</p></div>";STATE.progress.forEach(p=>box.innerHTML+=card(p.log_date||"Date",`Weight: ${p.weight||"-"} • Waist: ${p.waist||"-"} • Sleep: ${p.sleep_hours||"-"} • Energy: ${p.energy||"-"}`,pill("green","Progress"),`<div class="card-actions"><button class="small-btn" onclick="deleteRow('progress_logs','${p.id}')">Delete</button></div>`))}
function renderWorkout(){
  const editor=$("workoutEditor"),cards=$("workoutCards"); editor.innerHTML=""; cards.innerHTML="";
  ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].forEach(day=>{
    let label=document.createElement("label"); label.innerHTML=`${day}<input data-workout-day="${day}" value="${workoutFor(day)||""}">`; editor.appendChild(label);
    cards.innerHTML+=card(day,workoutFor(day)||"No workout",pill("blue","Weekly plan"));
  });
}
function renderNutrition(){
  const p=STATE.profile||DEFAULT_PROFILE;$("proteinDash").textContent=p.protein_goal||"";$("waterDash").textContent=p.water_goal||"";$("sleepDash").textContent=p.sleep_goal||"";$("planDash").textContent=p.plan_title||"Custom";$("mealTemplate").value=p.meal_template||DEFAULT_PROFILE.meal_template;
}
window.deleteRow=async(table,id)=>{await sb.from(table).delete().eq("id",id);await loadAll()}
document.querySelectorAll(".nav-btn").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));btn.classList.add("active");$(btn.dataset.screen).classList.add("active")});
$("themeToggle").onclick=()=>document.body.classList.toggle("light");$("refreshCloud").onclick=loadAll;$("rebuildDaily").onclick=renderDaily;
$("saveProfile").onclick=async()=>{const payload={name:$("setName").value,plan_title:$("setPlanTitle").value,age:Number($("setAge").value)||null,height:$("setHeight").value,units:$("setUnits").value,start_date:$("setStartDate").value||null,starting_weight:Number($("setStartWeight").value)||null,goal_weight:Number($("setGoalWeight").value)||null,current_weight:Number($("setCurrentWeight").value)||null,protein_goal:Number($("setProtein").value)||null,water_goal:Number($("setWater").value)||null,sleep_goal:Number($("setSleep").value)||null,vial_limit_days:Number($("setVialDays").value)||30, meal_template:$("mealTemplate")?$("mealTemplate").value:null};const {data,error}=await sb.from("user_profiles").update(payload).eq("id",STATE.profile.id).select().single();if(error){alert(error.message);return}STATE.profile=data;renderAll();alert("Saved to cloud")};
$("addItem").onclick=async()=>{const days=$("itemDays").value.split(",").map(x=>x.trim()).filter(Boolean);const {error}=await sb.from("peptide_items").insert({name:$("itemName").value,purpose:$("itemPurpose").value,active:$("itemActive").value==="true",color:$("itemColor").value,schedule_days:days});if(error)alert(error.message);["itemName","itemPurpose","itemDays"].forEach(id=>$(id).value="");await loadAll()};
$("addVial").onclick=async()=>{const p=STATE.profile||DEFAULT_PROFILE;let recon=$("vialRecon").value||iso(new Date());let d=new Date(recon+"T00:00:00");d.setDate(d.getDate()+Number(p.vial_limit_days||30));const {error}=await sb.from("vial_inventory").insert({item_name:$("vialItem").value,quantity:Number($("vialQty").value)||1,reconstituted_date:recon,use_by_date:d.toISOString().slice(0,10),notes:$("vialNotes").value});if(error)alert(error.message);["vialItem","vialNotes"].forEach(id=>$(id).value="");await loadAll()};
$("addProgress").onclick=async()=>{const payload={log_date:$("progDate").value||iso(new Date()),weight:Number($("progWeight").value)||null,waist:Number($("progWaist").value)||null,sleep_hours:Number($("progSleep").value)||null,energy:Number($("progEnergy").value)||null,notes:$("progNotes").value};const {error}=await sb.from("progress_logs").insert(payload);if(error)alert(error.message);if(payload.weight&&STATE.profile){await sb.from("user_profiles").update({current_weight:payload.weight}).eq("id",STATE.profile.id)}["progWeight","progWaist","progSleep","progEnergy","progNotes"].forEach(id=>$(id).value="");await loadAll()};
$("saveWorkout").onclick=async()=>{
  for(const inp of document.querySelectorAll("[data-workout-day]")){
    const day=inp.dataset.workoutDay,val=inp.value;
    let existing=STATE.workouts.find(w=>w.day_name===day);
    if(existing){await sb.from("workout_plan").update({workout_name:val}).eq("id",existing.id)}
    else{await sb.from("workout_plan").insert({day_name:day,workout_name:val,exercises:"",notes:""})}
  }
  await loadAll(); alert("Workout plan saved");
};
$("saveMeals").onclick=async()=>{const p=STATE.profile;if(!p)return;const {data,error}=await sb.from("user_profiles").update({meal_template:$("mealTemplate").value}).eq("id",p.id).select().single();if(error){alert(error.message);return}STATE.profile=data;renderAll();alert("Meal template saved")};
function calcDose(){let vial=Number($("vialMg").value),water=Number($("waterMl").value),dose=Number($("doseMg").value),s=Number($("syringeType").value);if(!vial||!water||!dose)return;let conc=vial/water,ml=dose/conc,u=ml*100;$("concOut").textContent=conc.toFixed(2)+" mg/mL";$("mlOut").textContent=ml.toFixed(3)+" mL";$("unitsOut").textContent=u.toFixed(1)+" units";$("syringeOut").textContent=u<=s?"Fits":"Use larger syringe"}$("calcDose").onclick=calcDose;
init();

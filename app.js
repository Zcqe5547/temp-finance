(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "temp-finance-v1";
  const today = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const parseDate = (s) => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
  const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const money = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;
  const fmtMonth = (d) => d.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
  const fmtDate = (s) => parseDate(s).toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"});
  const makeId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  let state = { goalByMonth:{}, operations:[], workDays:"all" };
  let viewMonth = new Date(today.getFullYear(),today.getMonth(),1);
  let selectedDate = iso(today);
  let editingId = null;
  let toastTimer;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") state = {...state,...saved, goalByMonth:saved.goalByMonth || {}, operations:Array.isArray(saved.operations)?saved.operations:[]};
  } catch(e) {}
  function save(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
  function getGoal(d=viewMonth){ return Number(state.goalByMonth[monthKey(d)] ?? 250000); }
  function monthOps(d=viewMonth){ const key=monthKey(d); return state.operations.filter(o=>o.date.startsWith(key)); }
  function sum(ops,type){ return ops.filter(o=>o.type===type).reduce((a,o)=>a+Number(o.amount||0),0); }
  function showToast(msg){ const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2200); }
  function countRemainingDays(fromDate){
    const last = new Date(fromDate.getFullYear(),fromDate.getMonth()+1,0).getDate();
    let count=0;
    for(let day=fromDate.getDate();day<=last;day++){
      const d=new Date(fromDate.getFullYear(),fromDate.getMonth(),day);
      if(state.workDays==="all" || (d.getDay()!==0 && d.getDay()!==6)) count++;
    }
    return count;
  }
  function calcDailyNeed(d=viewMonth){
    const ops=monthOps(d), earned=sum(ops,"income"), remaining=Math.max(0,getGoal(d)-earned);
    const nowMonth=monthKey(d)===monthKey(today);
    let start;
    if(nowMonth) start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    else if(d.getTime()>new Date(today.getFullYear(),today.getMonth(),1).getTime()) start=new Date(d.getFullYear(),d.getMonth(),1);
    else return {earned,remaining,need:0,days:0,past:true};
    const days=countRemainingDays(start);
    return {earned,remaining,need:days?remaining/days:remaining,days,past:false};
  }
  function renderDashboard(){
    const goal=getGoal(viewMonth),ops=monthOps(viewMonth),earned=sum(ops,"income"),expenses=sum(ops,"expense");
    const pct=goal>0?Math.min(100,earned/goal*100):0, remaining=Math.max(0,goal-earned);
    $("monthLabel").textContent=fmtMonth(viewMonth).toLocaleUpperCase("ru-RU");
    $("goalAmount").textContent=money(goal);
    $("progressFill").style.width=`${pct}%`;
    $("progressPct").textContent=`${pct.toLocaleString("ru-RU",{maximumFractionDigits:1})}% выполнено`;
    $("remainingAmount").textContent=remaining?`Осталось ${money(remaining)}`:"Цель выполнена 🎉";
    $("earnedStat").textContent=money(earned);
    const pace=calcDailyNeed(viewMonth);
    $("dailyNeed").textContent=pace.past?"—":money(pace.need);
    const daysPassed=monthKey(viewMonth)===monthKey(today)?today.getDate():Math.max(1,new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate());
    $("dailyAverage").textContent=money(earned/daysPassed);
    $("paceHint").textContent=pace.past?"Прошедший месяц. Дневной темп не рассчитывается.":remaining===0?"Месячная цель выполнена. Всё, что заработаешь дальше, — сверх плана.":`Осталось ${pace.days} ${plural(pace.days,"день","дня","дней")}. Расходы не уменьшают прогресс цели.`;
  }
  function plural(n,a,b,c){const n10=n%10,n100=n%100;return n10===1&&n100!==11?a:n10>=2&&n10<=4&&(n100<12||n100>14)?b:c;}
  function renderCalendar(){
    $("calendarMonth").textContent=viewMonth.toLocaleDateString("ru-RU",{month:"short",year:"numeric"}).replace(".","").replace(/^./,c=>c.toUpperCase());
    const grid=$("calendarGrid");grid.innerHTML="";
    const first=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),1);
    const offset=(first.getDay()+6)%7, days=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,0).getDate();
    for(let i=0;i<offset;i++){const blank=document.createElement("div");blank.className="day-cell empty";grid.append(blank);}
    for(let day=1;day<=days;day++){
      const d=new Date(viewMonth.getFullYear(),viewMonth.getMonth(),day),date=iso(d),ops=state.operations.filter(o=>o.date===date),inc=sum(ops,"income"),exp=sum(ops,"expense");
      const cell=document.createElement("button");cell.className="day-cell"+(date===selectedDate?" selected":"")+(date===iso(today)?" today":"");cell.type="button";
      const n=document.createElement("span");n.className="day-number";n.textContent=day;cell.append(n);
      if(inc||exp){const v=document.createElement("span");v.className="day-value"+(inc===0&&exp>0?" negative":"");v.textContent=inc?shortMoney(inc):`−${shortMoney(exp)}`;cell.append(v);
        const marker=document.createElement("span");marker.className="day-marker";if(inc){const dot=document.createElement("i");marker.append(dot);}if(exp){const dot=document.createElement("i");dot.className="expense";marker.append(dot);}cell.append(marker);}
      cell.addEventListener("click",()=>{selectedDate=date;renderCalendar();renderSelectedDay();});
      grid.append(cell);
    }
  }
  function shortMoney(n){ if(n>=1000000)return `${(n/1000000).toLocaleString("ru-RU",{maximumFractionDigits:1})}м`;if(n>=10000)return `${Math.round(n/1000)}к`;if(n>=1000)return `${(n/1000).toLocaleString("ru-RU",{maximumFractionDigits:1})}к`;return Math.round(n).toString(); }
  function renderSelectedDay(){
    $("selectedDateTitle").textContent=selectedDate===iso(today)?"Сегодня":fmtDate(selectedDate);
    const ops=state.operations.filter(o=>o.date===selectedDate).sort((a,b)=>b.createdAt-a.createdAt);
    const inc=sum(ops,"income"),exp=sum(ops,"expense");
    $("daySummary").innerHTML=`<div class="summary-chip"><span>Доход</span><strong class="income-text">+${money(inc)}</strong></div><div class="summary-chip"><span>Расход</span><strong class="expense-text">−${money(exp)}</strong></div>`;
    const list=$("operationsList");list.innerHTML="";
    if(!ops.length){list.innerHTML='<div class="empty-state">Пока нет операций за этот день.<br>Нажми «Добавить», чтобы записать доход или расход.</div>';return;}
    for(const op of ops){
      const row=document.createElement("div");row.className="operation";
      const ico=document.createElement("div");ico.className="op-icon"+(op.type==="expense"?" expense":"");ico.textContent=op.type==="income"?"↙":"↗";
      const info=document.createElement("div");info.className="op-info";
      const name=document.createElement("strong");name.textContent=op.category||(op.type==="income"?"Доход":"Расход");
      const meta=document.createElement("span");meta.textContent=op.type==="income"?"Заработок":"Трата";info.append(name,meta);
      const right=document.createElement("div");right.className="op-right";
      const amount=document.createElement("div");amount.className="op-amount "+(op.type==="income"?"income-text":"expense-text");amount.textContent=(op.type==="income"?"+":"−")+money(op.amount);
      const del=document.createElement("button");del.className="delete-op";del.textContent="Удалить";del.addEventListener("click",()=>{if(confirm("Удалить эту операцию?")){state.operations=state.operations.filter(x=>x.id!==op.id);save();renderAll();showToast("Операция удалена");}});
      right.append(amount,del);row.append(ico,info,right);list.append(row);
    }
  }
  function renderAll(){renderDashboard();renderCalendar();renderSelectedDay();}
  function openOperation(){
    editingId=null;$("operationDialogTitle").textContent="Новая операция";$("operationAmount").value="";$("operationCategory").value="";$("operationDate").value=selectedDate;$("operationType").value="income";setType("income");$("operationDialog").showModal();
  }
  function setType(type){$("operationType").value=type;document.querySelectorAll(".segment").forEach(b=>b.classList.toggle("active",b.dataset.type===type));}
  document.querySelectorAll(".segment").forEach(b=>b.addEventListener("click",()=>setType(b.dataset.type)));
  $("addOperationBtn").addEventListener("click",openOperation);
  $("operationForm").addEventListener("submit",e=>{
    e.preventDefault();const amount=Number($("operationAmount").value),date=$("operationDate").value,type=$("operationType").value,category=$("operationCategory").value.trim();
    if(!Number.isFinite(amount)||amount<=0||!date){showToast("Проверь сумму и дату");return;}
    state.operations.push({id:makeId(),type,amount:Math.round(amount*100)/100,date,category,createdAt:Date.now()});
    selectedDate=date;viewMonth=new Date(parseDate(date).getFullYear(),parseDate(date).getMonth(),1);save();$("operationDialog").close();renderAll();showToast("Операция сохранена");
  });
  $("editGoalBtn").addEventListener("click",()=>{$("goalInput").value=getGoal(viewMonth);$("goalDialog").showModal();});
  $("goalForm").addEventListener("submit",e=>{e.preventDefault();const goal=Number($("goalInput").value);if(!Number.isFinite(goal)||goal<0){showToast("Введи корректную цель");return;}state.goalByMonth[monthKey(viewMonth)]=goal;save();$("goalDialog").close();renderAll();showToast("Цель обновлена");});
  $("settingsBtn").addEventListener("click",()=>{$("workDays").value=state.workDays||"all";$("settingsDialog").showModal();});
  $("workDays").addEventListener("change",()=>{state.workDays=$("workDays").value;save();renderAll();showToast("Настройки сохранены");});
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
  $("prevMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()-1,1);selectedDate=iso(viewMonth);renderAll();});
  $("nextMonth").addEventListener("click",()=>{viewMonth=new Date(viewMonth.getFullYear(),viewMonth.getMonth()+1,1);selectedDate=iso(viewMonth);renderAll();});
  $("exportBtn").addEventListener("click",()=>{
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`temp-finance-${iso(today)}.json`;a.click();URL.revokeObjectURL(url);showToast("Резервная копия подготовлена");
  });
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files[0];if(!file)return;
    try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.operations)||!data.goalByMonth)throw new Error("invalid");if(!confirm("Импорт заменит текущие данные. Продолжить?"))return;state={goalByMonth:data.goalByMonth,operations:data.operations,workDays:data.workDays==="weekdays"?"weekdays":"all"};save();renderAll();showToast("Данные импортированы");}
    catch(err){showToast("Не удалось прочитать резервную копию");}finally{e.target.value="";}
  });
  $("resetBtn").addEventListener("click",()=>{if(confirm("Точно удалить все цели и операции? Это действие нельзя отменить. Сначала экспортируй резервную копию, если она нужна.")){state={goalByMonth:{},operations:[],workDays:"all"};save();renderAll();$("settingsDialog").close();showToast("Данные удалены");}});
  if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
  renderAll();
})();
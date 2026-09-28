let rows=[], columns=[], types={}, filteredRows=[], chart=null, page=1, pageSize=25;
const $=id=>document.getElementById(id);
const uploadView=$("uploadView"), appView=$("appView"), fileInput=$("fileInput"), dropzone=$("dropzone");

fileInput.addEventListener("change",e=>{if(e.target.files[0]) loadFile(e.target.files[0])});
["dragenter","dragover"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove("drag")}));
dropzone.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});
$("demoBtn").onclick=loadDemo;
$("clearBtn").onclick=clearAll;
$("newFile").onclick=()=>{clearAll();fileInput.click()};
$("chartType").onchange=renderChart;
$("xField").onchange=renderChart;
$("yField").onchange=renderChart;
$("rowLimit").onchange=renderChart;
$("searchInput").oninput=()=>{page=1;applyFilter();renderTable()};
$("prevPage").onclick=()=>{if(page>1){page--;renderTable()}};
$("nextPage").onclick=()=>{if(page<Math.ceil(filteredRows.length/pageSize)){page++;renderTable()}};
$("downloadChart").onclick=()=>{if(chart){const a=document.createElement("a");a.href=chart.toBase64Image();a.download="dataforge-chart.png";a.click()}};
$("exportCsv").onclick=exportCSV;
$("exportJson").onclick=exportJSON;

function loadFile(file){
  const ext=file.name.toLowerCase().split(".").pop();
  if(ext==="csv"||ext==="tsv"){
    Papa.parse(file,{header:true,skipEmptyLines:true,dynamicTyping:true,complete:r=>initData(r.data,file.name)});
  }else if(ext==="xlsx"||ext==="xls"){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const data=XLSX.utils.sheet_to_json(ws,{defval:""});
        initData(data,file.name+" • "+wb.SheetNames[0]);
      }catch(err){showNotice("Could not read this Excel file: "+err.message)}
    };
    reader.readAsArrayBuffer(file);
  }else showNotice("Please choose a CSV, TSV, XLSX or XLS file.");
}
function initData(data,name){
  rows=data.filter(r=>r&&Object.keys(r).length);
  columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  rows=rows.map(r=>{const o={};columns.forEach(c=>o[c]=r[c]??"");return o});
  types={};columns.forEach(c=>types[c]=detectType(c,rows.map(r=>r[c])));
  filteredRows=rows.slice();page=1;
  uploadView.classList.add("hidden");appView.classList.remove("hidden");
  $("fileName").textContent=name;
  $("datasetMeta").textContent=`${fmt(rows.length)} rows • ${columns.length} columns`;
  buildSelectors();renderAll();
}
function detectType(col,vals){
  const clean=vals.filter(v=>v!==null&&v!==undefined&&String(v).trim()!=="");
  if(!clean.length)return"text";
  const low=col.toLowerCase();
  const numeric=clean.filter(v=>typeof v==="number"||(!isNaN(Number(String(v).replace(/,/g,"").replace(/%$/,""))) && String(v).trim()!=="")).length/clean.length;
  if(numeric>.85 && !/(url|link|email|id|phone)/i.test(low))return"number";
  const date=clean.filter(v=>!isNaN(Date.parse(v))).length/clean.length;
  if(date>.85 && /(date|time|upload|publish|created|updated)/i.test(low))return"date";
  return"text";
}
function numericCols(){return columns.filter(c=>types[c]==="number")}
function dateCols(){return columns.filter(c=>types[c]==="date")}
function textCols(){return columns.filter(c=>types[c]==="text")}
function buildSelectors(){
  const xs=[...dateCols(),...textCols(),...numericCols()];
  const ys=numericCols();
  fillSelect($("xField"),xs, xs[0]);
  fillSelect($("yField"),ys, ys[0]);
  if(!ys.length) $("yField").innerHTML="<option value=''>No numeric columns</option>";
}
function fillSelect(sel,arr,preferred){sel.innerHTML=arr.map(c=>`<option value="${escAttr(c)}">${esc(c)}</option>`).join("");if(preferred)sel.value=preferred}
function renderAll(){renderKPIs();renderChart();renderProfile();renderInsights();applyFilter();renderTable()}
function renderKPIs(){
  const nums=numericCols();let cards=[];
  cards.push(["Rows",fmt(rows.length),"records loaded"]);
  cards.push(["Columns",fmt(columns.length),"fields detected"]);
  if(nums.length){
    const primary=pickMetric(nums);
    cards.push([primary,fmt(sum(rows,primary)),`sum of ${primary}`]);
    const avg=avgVal(rows,primary);cards.push([`Avg ${primary}`,fmt(avg),`average across rows`]);
  }
  $("kpis").innerHTML=cards.map(x=>`<div class="kpi"><div class="label">${esc(x[0])}</div><div class="value">${esc(x[1])}</div><div class="sub">${esc(x[2])}</div></div>`).join("");
}
function pickMetric(nums){
  const preferred=nums.find(c=>/(views|revenue|sales|amount|likes|subscribers|watch|score|count|quantity|total)/i.test(c));
  return preferred||nums[0];
}
function renderChart(){
  const type=$("chartType").value,x=$("xField").value,y=$("yField").value;
  if(!x||!y){return}
  const limit=Number($("rowLimit").value);
  let data=rows.slice();
  const agg=new Map();
  if(type==="scatter"){
    const points=data.map(r=>({x:num(r[x]),y:num(r[y])})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(0,limit*10);
    draw(type,{datasets:[{label:`${y} vs ${x}`,data:points}]});return;
  }
  const xType=types[x];
  if(xType==="number"){
    data.sort((a,b)=>num(b[y])-num(a[y]));
    data=data.slice(0,limit);
    draw(type,{labels:data.map(r=>String(r[x])),datasets:[{label:y,data:data.map(r=>num(r[y]))}]});
  }else{
    data.forEach(r=>{
      let key=r[x];
      if(xType==="date"){const d=new Date(key);if(!isNaN(d))key=d.toISOString().slice(0,10)}
      key=String(key??"").trim()||"(blank)";
      const v=num(r[y]);if(!Number.isFinite(v))return;
      agg.set(key,(agg.get(key)||0)+v);
    });
    let arr=[...agg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit);
    if(xType==="date")arr.sort((a,b)=>a[0].localeCompare(b[0]));
    draw(type,{labels:arr.map(a=>a[0]),datasets:[{label:`Sum of ${y}`,data:arr.map(a=>a[1])}]});
  }
}
function draw(type,data){
  if(chart)chart.destroy();
  const ctx=$("mainChart").getContext("2d");
  chart=new Chart(ctx,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:"#b9c2cf"}},tooltip:{mode:"index",intersect:false}},scales:(type==="doughnut"||type==="pie")?{}:{x:{ticks:{color:"#8994a5"},grid:{color:"#202631"}},y:{ticks:{color:"#8994a5"},grid:{color:"#202631"}}}}});
}
function renderProfile(){
  $("profileTable").innerHTML="<thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Example</th></tr></thead><tbody>"+
  columns.map(c=>{const vals=rows.map(r=>r[c]);const missing=vals.filter(v=>v===""||v==null).length;const unique=new Set(vals.map(v=>String(v))).size;const ex=vals.find(v=>v!==""&&v!=null);return `<tr><td>${esc(c)}</td><td>${types[c]}</td><td>${fmt(missing)}</td><td>${fmt(unique)}</td><td>${esc(String(ex??"").slice(0,70))}</td></tr>`}).join("")+"</tbody>";
}
function renderInsights(){
  const out=[];const nums=numericCols();
  nums.slice(0,8).forEach(c=>{const a=avgVal(rows,c),mx=Math.max(...rows.map(r=>num(r[c])).filter(Number.isFinite));out.push(`<div class="insight"><b>${esc(c)}</b>: average <b>${fmt(a)}</b>, maximum <b>${fmt(mx)}</b>.</div>`)});
  const title=columns.find(c=>/title|name/i.test(c));
  const metric=nums.length?pickMetric(nums):null;
  if(title&&metric){
    const top=rows.slice().sort((a,b)=>num(b[metric])-num(a[metric]))[0];
    if(top)out.unshift(`<div class="insight">Highest <b>${esc(metric)}</b>: <b>${esc(String(top[title]))}</b> with <b>${fmt(num(top[metric]))}</b>.</div>`);
  }
  $("insights").innerHTML=out.length?out.join(""):"No numeric fields were detected for automatic insights.";
}
function applyFilter(){
  const q=$("searchInput").value.trim().toLowerCase();
  filteredRows=!q?rows.slice():rows.filter(r=>columns.some(c=>String(r[c]??"").toLowerCase().includes(q)));
  $("tableMeta").textContent=`Showing ${fmt(filteredRows.length)} of ${fmt(rows.length)} matching rows`;
}
function renderTable(){
  const start=(page-1)*pageSize,end=Math.min(start+pageSize,filteredRows.length),view=filteredRows.slice(start,end);
  $("dataTable").innerHTML="<thead><tr>"+columns.map(c=>`<th>${esc(c)}</th>`).join("")+"</tr></thead><tbody>"+
    view.map(r=>"<tr>"+columns.map(c=>`<td title="${escAttr(String(r[c]??""))}">${esc(String(r[c]??"").slice(0,120))}</td>`).join("")+"</tr>").join("")+"</tbody>";
  const total=Math.max(1,Math.ceil(filteredRows.length/pageSize));if(page>total)page=total;
  $("pageInfo").textContent=`Page ${page} / ${total}`;
}
function exportCSV(){
  if(!rows.length)return;
  const csv=Papa.unparse(rows);downloadBlob(csv,"dataforge-export.csv","text/csv;charset=utf-8");
}
function exportJSON(){downloadBlob(JSON.stringify(rows,null,2),"dataforge-export.json","application/json")}
function loadDemo(){
  const demo=[
    {Title:"Galaxy S27 Ultra vs S26 Ultra",Views:820000,Likes:31200,Comments:2381,CTR:7.8,Subscribers:8921,Uploaded:"2026-01-10"},
    {Title:"iPhone 18 Pro vs Pro Max",Views:1200000,Likes:54200,Comments:4102,CTR:8.1,Subscribers:11040,Uploaded:"2026-02-04"},
    {Title:"Top 5 Camera Phones",Views:640000,Likes:27800,Comments:1800,CTR:6.4,Subscribers:7210,Uploaded:"2026-02-20"},
    {Title:"Best Budget 5G Phones",Views:430000,Likes:16200,Comments:1100,CTR:5.9,Subscribers:4200,Uploaded:"2026-03-02"},
    {Title:"Vivo S2 5G vs Vivo V40 5G",Views:760000,Likes:29100,Comments:2010,CTR:7.2,Subscribers:8030,Uploaded:"2026-03-18"},
    {Title:"Best Smartphone Displays",Views:315000,Likes:11200,Comments:800,CTR:5.1,Subscribers:2900,Uploaded:"2026-04-01"}
  ];
  initData(demo,"Demo YouTube Dataset");
}
function clearAll(){if(chart){chart.destroy();chart=null}rows=[];columns=[];appView.classList.add("hidden");uploadView.classList.remove("hidden");fileInput.value=""}
function showNotice(msg){$("notice").textContent=msg;$("notice").classList.remove("hidden");setTimeout(()=>$("notice").classList.add("hidden"),6000)}
function sum(rs,c){return rs.reduce((a,r)=>a+(Number.isFinite(num(r[c]))?num(r[c]):0),0)}
function avgVal(rs,c){const a=rs.map(r=>num(r[c])).filter(Number.isFinite);return a.length?sum(rs.filter(r=>Number.isFinite(num(r[c]))),c)/a.length:0}
function num(v){if(typeof v==="number")return v;let s=String(v??"").replace(/,/g,"").replace(/%$/,"");if(s.trim()==="")return NaN;return Number(s)}
function fmt(v){if(typeof v!=="number")v=Number(v);if(!Number.isFinite(v))return"—";return Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(v)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function escAttr(s){return esc(s)}
function downloadBlob(content,name,type){const blob=new Blob([content],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

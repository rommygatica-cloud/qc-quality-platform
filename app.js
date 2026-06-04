let defects=[], docs={tolerances:[],specs:[],barcodes:[]};
const $=id=>document.getElementById(id);
async function load(){
  defects=await fetch('data/defects.json').then(r=>r.json());
  docs=await fetch('data/docs.json').then(r=>r.json());
  initNav(); renderDashboard(); renderFilters(); renderDefects(); renderDocs();
}
function initNav(){document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>show(btn.dataset.view));$('globalSearch').oninput=()=>{renderDefects();renderDocs()};$('closeModal').onclick=()=>$('modal').close();$('barcodeBtn').onclick=lookupBarcode;}
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(id).classList.add('active');document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===id));const names={dashboard:'Dashboard',defects:'Defects Library',tolerances:'Tolerances',specs:'Specs Library',barcode:'Barcode Scanner'};$('pageTitle').textContent=names[id];}
function renderDashboard(){$('defectCount').textContent=defects.length;$('tolCount').textContent=docs.tolerances.length;$('specCount').textContent=docs.specs.length;}
function options(id, values){$(id).innerHTML=$(id).children[0].outerHTML+[...new Set(values)].sort().map(v=>`<option>${v}</option>`).join('');$(id).onchange=renderDefects;}
function renderFilters(){options('commodityFilter',defects.map(d=>d.commodity));options('categoryFilter',defects.map(d=>d.category));options('severityFilter',defects.map(d=>d.severity));}
function matchText(obj){const q=$('globalSearch').value.toLowerCase();return !q||JSON.stringify(obj).toLowerCase().includes(q)}
function renderDefects(){const list=defects.filter(d=>(!$('commodityFilter').value||d.commodity===$('commodityFilter').value)&&(!$('categoryFilter').value||d.category===$('categoryFilter').value)&&(!$('severityFilter').value||d.severity===$('severityFilter').value)&&matchText(d));$('defectGrid').innerHTML=list.map((d,i)=>`<article class="card" onclick="openDefect(${i})"><img src="${d.image}"><div class="cardBody"><span class="tag">${d.category}</span><span class="tag ${d.severity}">${d.severity}</span><h3>${d.defect}</h3><p>${d.description.slice(0,95)}...</p></div></article>`).join('');}
function openDefect(i){
  const d = defects[i];

  const gallery = d.gallery && d.gallery.length
    ? d.gallery.map(img => `<img src="${img}" class="galleryImg">`).join('')
    : `<img src="${d.image}" class="galleryImg">`;

  $('modalContent').innerHTML = `
    <img src="${d.image}">
    <h2>${d.defect}</h2>
    <p><b>Commodity:</b> ${d.commodity}</p>
    <p><b>Category:</b> ${d.category}</p>
    <p><b>Severity:</b> ${d.severity}</p>
    <p><b>Description:</b> ${d.description}</p>
    <p><b>Recommendation:</b> ${d.recommendation}</p>
    <h3>Photo Gallery</h3>
    <div class="galleryGrid">${gallery}</div>
  `;

  $('modal').showModal();
}
function docCard(d){return `<article class="card" onclick="window.open('${d.file}','_blank')"><div class="cardBody"><div class="docIcon">📄</div><span class="tag">${d.status}</span><h3>${d.title}</h3><p>${d.commodity||''} ${d.customer? '• '+d.customer:''}</p></div></article>`}
function renderDocs(){$('toleranceGrid').innerHTML=docs.tolerances.filter(matchText).map(docCard).join('');$('specGrid').innerHTML=docs.specs.filter(matchText).map(docCard).join('');}
function lookupBarcode(){const q=$('barcodeInput').value.trim();const r=docs.barcodes.find(b=>b.upc===q||b.gtin===q);$('barcodeResult').innerHTML=r?`<h3>✓ Match found</h3><p><b>Label:</b> ${r.label}</p><p><b>Variety:</b> ${r.variety}</p><p><b>Pack:</b> ${r.packStyle}</p><p><b>GTIN:</b> ${r.gtin}</p><p><b>PLU:</b> ${r.plu}</p><p><b>COO:</b> ${r.coo}</p>`:`<h3>⚠ No match found</h3><p>Check the UPC/GTIN or add this label to the barcode database.</p>`}
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{})}load();

let defects = [];
let docs = { tolerances: [], specs: [], sops: [], barcodes: [] };

let commodities = [];

let currentSpecSection = "";
let currentSpecCommodity = "";

const $ = id => document.getElementById(id);

async function load() {
  defects = await fetch("data/defects.json").then(r => r.json());

  const { data: documentsData, error } = await supabaseClient
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Documents error:", error);
    docs = { tolerances: [], specs: [], sops: [], barcodes: [] };
  } else {
    docs = {
      tolerances: documentsData.filter(d => d.category === "Tolerance"),
      specs: documentsData.filter(d => d.category === "Specification"),
      sops: documentsData.filter(d => d.category === "SOP"),
      barcodes: []
    };
  }
const { data: commoditiesData, error: commoditiesError } =
  await supabaseClient
    .from("commodities")
    .select("*")
    .eq("status", "Active")
    .order("name");

if (commoditiesError) {
  console.error("Commodities error:", commoditiesError);
  commodities = [];
} else {
  commodities = commoditiesData || [];
}

  initNav();
  renderDashboard();
  renderFilters();
  renderDefects();
  renderDocs();
  renderQCLibrary();
}

function initNav() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => show(btn.dataset.view);
  });

  const search = $("globalSearch");
  if (search) {
    search.oninput = () => {
      renderDefects();
      renderDocs();
    };
  }

  const closeModal = $("closeModal");
  if (closeModal) {
    closeModal.onclick = () => $("modal").close();
  }

  const barcodeBtn = $("barcodeBtn");
  if (barcodeBtn) {
    barcodeBtn.onclick = lookupBarcode;
  }
}

function show(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));

  $(id).classList.add("active");

  document.querySelectorAll(".nav").forEach(n =>
    n.classList.toggle("active", n.dataset.view === id)
  );

  const names = {
    dashboard: "Dashboard",
    defects: "QC Knowledge Base",
    tolerances: "Tolerances",
    specs: "Specifications",
    sops: "SOPs",
    daily: "Daily Work",
    barcode: "Barcode Verification",
    traceability: "Traceability Search",
    qa: "QA Control",
    admin: "Administration"
  };

  $("pageTitle").textContent = names[id] || "Dashboard";
}

function renderDashboard() {
  $("defectCount").textContent = defects.length;
  $("tolCount").textContent = docs.tolerances.length;
  $("specCount").textContent = docs.specs.length;

  if ($("ptfSpecCount")) {
    $("ptfSpecCount").textContent =
      `${getSectionCount("PTF Internal")} Documents`;
  }

  if ($("retailSpecCount")) {
    $("retailSpecCount").textContent =
      `${getSectionCount("Retail")} Documents`;
  }

  if ($("usdaSpecCount")) {
    $("usdaSpecCount").textContent =
      `${getSectionCount("USDA / Industry")} Documents`;
  }
}

function options(id, values) {
  const element = $(id);
  if (!element) return;

  element.innerHTML =
    element.children[0].outerHTML +
    [...new Set(values)].sort().map(v => `<option>${v}</option>`).join("");

  element.onchange = renderDefects;
}

function renderFilters() {
  options("commodityFilter", defects.map(d => d.commodity));
  options("categoryFilter", defects.map(d => d.category));
  options("severityFilter", defects.map(d => d.severity));
}

function matchText(obj) {
  const search = $("globalSearch");
  const q = search ? search.value.toLowerCase() : "";
  return !q || JSON.stringify(obj).toLowerCase().includes(q);
}
function matchDocument(doc) {
  const search = $("globalSearch");
  const q = search ? search.value.toLowerCase().trim() : "";

  if (!q) return true;

  const text = `
    ${doc.title || ""}
    ${doc.commodity || ""}
    ${doc.customer || ""}
    ${doc.section || ""}
    ${doc.category || ""}
  `.toLowerCase();

  return q.split(" ").every(word =>
    text.includes(word)
  );
}
function renderDefects() {
  const defectGrid = $("defectGrid");
  if (!defectGrid) return;

  const commodityFilter = $("commodityFilter");
  const categoryFilter = $("categoryFilter");
  const severityFilter = $("severityFilter");

  const list = defects.filter(d =>
    (!commodityFilter || !commodityFilter.value || d.commodity === commodityFilter.value) &&
    (!categoryFilter || !categoryFilter.value || d.category === categoryFilter.value) &&
    (!severityFilter || !severityFilter.value || d.severity === severityFilter.value) &&
    matchText(d)
  );

  defectGrid.innerHTML = list.map((d, i) => `
    <article class="card" onclick="openDefect(${i})">
      <img src="${d.image}">
      <div class="cardBody">
        <span class="tag">${d.category}</span>
        <span class="tag ${d.severity}">${d.severity}</span>
        <h3>${d.defect}</h3>
        <p>${d.description.slice(0, 95)}...</p>
      </div>
    </article>
  `).join("");
}

function openDefect(i) {
  const d = defects[i];

  const gallery = d.gallery && d.gallery.length
    ? d.gallery.map(img => `<img src="${img}" class="galleryImg">`).join("")
    : `<img src="${d.image}" class="galleryImg">`;

  $("modalContent").innerHTML = `
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

  $("modal").showModal();
}

function getCommodityIcon(commodity) {
  const group = getCommodityGroup(commodity);

  if (group === "Stone Fruit") return "🍑";
  if (group === "Citrus") return "🍊";
  if (group === "Grapes") return "🍇";

  return "📦";
}

function docCard(d) {
  const updated = d.created_at
    ? new Date(d.created_at).toLocaleDateString()
    : "N/A";

  return `
    <article class="card" onclick="window.open('${d.file_url}','_blank')">
      <div class="cardBody">
        <div class="docIcon">📄</div>

        <span class="tag">${d.status}</span>

        <h3>${d.title}</h3>

        <p>${getCommodityIcon(d.commodity)} ${d.commodity || ""}</p>

        ${d.customer
          ? `<p>🏪 ${d.customer}</p>`
          : ""
        }

        <p style="font-size:12px;color:#64748b;">
          📅 Updated ${updated}
        </p>
      </div>
    </article>
  `;
}

function renderDocs() {
  $("toleranceGrid").innerHTML =
  docs.tolerances.filter(matchDocument).map(docCard).join("");

const latestDoc = getLatestDocument();
if ($("latestDocumentCard")) {
  if (latestDoc) {
    $("latestDocumentCard").innerHTML = `
      <div class="latestDoc">
        <h3>📄 Latest Upload</h3>
        <p><strong>${latestDoc.title}</strong></p>
        <p>${getCommodityIcon(latestDoc.commodity)} ${latestDoc.commodity || ""}</p>
        <p style="font-size:12px;color:#64748b;">
          📅 Updated ${new Date(latestDoc.created_at).toLocaleDateString()}
        </p>
      </div>
    `;
  } else {
    $("latestDocumentCard").innerHTML = "";
  }
}
  const searchActive =
    $("globalSearch").value.trim() !== "";

    const mainCards = $("specMainCards");

if (mainCards) {
  mainCards.style.display = searchActive ? "none" : "grid";
}
const sectionTitle = $("specSectionTitle");
const latestCard = $("latestDocumentCard");

if (sectionTitle) {
  sectionTitle.style.display = searchActive ? "none" : "block";
}

if (latestCard) {
  latestCard.style.display = searchActive ? "none" : "block";
}
  let specsToShow = [];

  if (searchActive) {
    specsToShow = docs.specs.filter(matchDocument);
  } else {
    specsToShow = docs.specs.filter(d => {
      const sameSection = currentSpecSection
        ? d.section === currentSpecSection
        : false;

      const sameCommodity = currentSpecCommodity
        ? getCommodityGroup(d.commodity) === currentSpecCommodity
        : false;

      return sameSection && sameCommodity;
    });
  }

  $("specGrid").innerHTML = searchActive
    ? renderSpecSearchResults(specsToShow)
    : currentSpecSection
      ? renderSpecDocuments(specsToShow)
      : `<p style="color:#64748b;">Select a specification section.</p>`;

  const sopGrid = $("sopGrid");

if (sopGrid) {
  const sopList = currentSopSection
    ? docs.sops.filter(d =>
        d.section === currentSopSection &&
        matchDocument(d)
      )
    : [];

  sopGrid.innerHTML = currentSopSection
    ? sopList.length
      ? sopList.map(docCard).join("")
      : `<p style="color:#64748b;">No SOPs found for ${currentSopSection}.</p>`
    : `<p style="color:#64748b;">Select an SOP section.</p>`;
}
}
function renderSpecSearchResults(list) {
  if (!list.length) {
    return `<p style="color:#64748b;">No specification results found.</p>`;
  }

  return `
    <div style="grid-column:1/-1;">
      <h2>Search Results (${list.length})</h2>
    </div>
    ${list.map(docCard).join("")}
  `;
}

function showSpecSection(section) {
  currentSpecSection = section;
  currentSpecCommodity = "";

  $("specSectionTitle").innerHTML = `
    <h2>${section}</h2>

    <div class="cards">

      <article class="stat" onclick="showSpecCommodity('Stone Fruit')">
        <b>🍑 Stone Fruit</b>
        <span>${getCommodityCount(section, "Stone Fruit")} Documents</span>
      </article>

      <article class="stat" onclick="showSpecCommodity('Citrus')">
        <b>🍊 Citrus</b>
        <span>${getCommodityCount(section, "Citrus")} Documents</span>
      </article>

      <article class="stat" onclick="showSpecCommodity('Grapes')">
        <b>🍇 Grapes</b>
        <span>${getCommodityCount(section, "Grapes")} Documents</span>
      </article>

    </div>
  `;

  renderDocs();
}

function showSpecCommodity(commodity) {
  currentSpecCommodity = commodity;
  renderDocs();
}

function renderSpecDocuments(list) {
  if (!currentSpecCommodity) {
    return `<p style="color:#64748b;">Select a commodity group.</p>`;
  }

  if (!list.length) {
    return `<p style="color:#64748b;">No documents found for ${currentSpecCommodity}.</p>`;
  }

  return `
    <div style="grid-column:1/-1;">
      <h2>${currentSpecCommodity}</h2>
    </div>
    ${list.map(docCard).join("")}
  `;
}

function getCommodityGroup(commodity) {
  const value = (commodity || "").toLowerCase();

  if (
    value.includes("cherr") ||
    value.includes("apricot") ||
    value.includes("peach") ||
    value.includes("nectarine") ||
    value.includes("plum") ||
    value.includes("stone")
  ) {
    return "Stone Fruit";
  }

  if (
    value.includes("citrus") ||
    value.includes("mandarin") ||
    value.includes("orange") ||
    value.includes("lemon")
  ) {
    return "Citrus";
  }

  if (value.includes("grape")) {
    return "Grapes";
  }

  return commodity || "Other";
}

function getSectionCount(section) {
  return docs.specs.filter(d => d.section === section).length;
}

function getCommodityCount(section, commodityGroup) {
  return docs.specs.filter(d =>
    d.section === section &&
    getCommodityGroup(d.commodity) === commodityGroup
  ).length;
}

function getLatestDocument() {
  if (!docs.specs.length) {
    return null;
  }

  return [...docs.specs]
    .sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    )[0];
}

async function lookupBarcode() {
  const q = $("barcodeInput").value.trim();

  if (!q) {
    alert("Please enter a UPC or GTIN");
    return;
  }

  const qClean = q.replace(/\D/g, "");

  let { data, error } = await supabaseClient
    .from("barcodes")
    .select("*")
    .ilike("upc", `%${qClean}%`)
    .limit(1);

  if (!error && (!data || data.length === 0)) {
    const gtinResult = await supabaseClient
      .from("barcodes")
      .select("*")
      .ilike("gtin", `%${qClean}%`)
      .limit(1);

    data = gtinResult.data;
    error = gtinResult.error;
  }

  if (error) {
    console.error(error);

    $("barcodeResult").innerHTML = `
      <h3>⚠ Database Error</h3>
      <p>${error.message}</p>
    `;
    return;
  }

  const r = data?.[0];

  $("barcodeResult").innerHTML = r
    ? `
      <h3>✓ Match Found</h3>
      <p><b>Commodity:</b> ${r.commodity || "-"}</p>
      <p><b>Program:</b> ${r.program || "-"}</p>
      <p><b>Label:</b> ${r.label || "-"}</p>
      <p><b>Variety:</b> ${r.variety || "-"}</p>
      <p><b>UPC:</b> ${r.upc || "-"}</p>
      <p><b>GTIN:</b> ${r.gtin || "-"}</p>
      <p><b>Pack Style:</b> ${r.pack_style || "-"}</p>
      <p><b>PLU:</b> ${r.plu || "-"}</p>
      <p><b>COO:</b> ${r.coo || "-"}</p>
      <p><b>SSN East:</b> ${r.ssn_east || "-"}</p>
      <p><b>SSN West:</b> ${r.ssn_west || "-"}</p>
      <p><b>Traceability:</b> ${r.traceability_sticker || "-"}</p>
      <p><b>Item Number:</b> ${r.item_number || "-"}</p>
    `
    : `
      <h3>⚠ No Match Found</h3>
      <p>This UPC / GTIN does not exist in the Label Database.</p>
    `;
}
function showUploadForm() {
  const panel = $("uploadDocumentPanel");
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}

async function uploadDocument() {
  const title = $("docTitle").value.trim();
  const documentType = $("docType").value;
  const section = $("docSection").value;
  const commodity = $("docCommodity").value.trim();
  const customer = $("docCustomer").value.trim();
  const file = $("docFile").files[0];

  if (!title || !file) {
    alert("Please enter a title and select a file.");
    return;
  }

  const filePath = `${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("documents")
    .upload(filePath, file);

  if (uploadError) {
    alert("Upload error: " + uploadError.message);
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("documents")
    .getPublicUrl(filePath);

  const fileUrl = publicUrlData.publicUrl;

  const { error: insertError } = await supabaseClient
    .from("documents")
    .insert({
      title: title,
      document_type: documentType,
      category: documentType,
      section: section,
      commodity: commodity,
      customer: customer,
      status: "Active",
      file_url: fileUrl,
      uploaded_by: "romy"
    });

  if (insertError) {
    alert("Database error: " + insertError.message);
    return;
  }

  alert("Document uploaded successfully!");

  $("docTitle").value = "";
  $("docCommodity").value = "";
  $("docCustomer").value = "";
  $("docFile").value = "";

  await load();
}

async function importBarcodeExcel() {
  const file = $("barcodeExcelFile").files[0];
  const resultBox = $("barcodeImportResult");

  if (!file) {
    alert("Please select an Excel or CSV file.");
    return;
  }

  resultBox.innerHTML = "Reading file...";

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rows.length) {
    resultBox.innerHTML = "No rows found in this file.";
    return;
  }

  const cleanRows = rows.map(row => ({
    commodity: String(row.commodity || "").trim(),
    program: String(row.program || "").trim(),
    variety: String(row.variety || "").trim(),
    label: String(row.label || "").trim(),
    upc: String(row.upc || "").trim(),
    gtin: String(row.gtin || "").trim(),
    pack_style: String(row.pack_style || "").trim(),
    plu: String(row.plu || "").trim(),
    coo: String(row.coo || "").trim(),
    ssn_east: String(row.ssn_east || "").trim(),
    ssn_west: String(row.ssn_west || "").trim(),
    traceability_sticker: String(row.traceability_sticker || "").trim(),
    item_number: String(row.item_number || "").trim(),
    status: "Active",
    uploaded_by: "romy"
  })).filter(row => row.upc || row.gtin);

  const { data: existingData, error: existingError } = await supabaseClient
    .from("barcodes")
    .select("upc, gtin");

  if (existingError) {
    resultBox.innerHTML = "Error checking existing records: " + existingError.message;
    return;
  }

  const existingKeys = new Set();

  existingData.forEach(row => {
    if (row.upc) existingKeys.add("upc:" + row.upc);
    if (row.gtin) existingKeys.add("gtin:" + row.gtin);
  });

  const newRows = cleanRows.filter(row => {
    const upcExists = row.upc && existingKeys.has("upc:" + row.upc);
    const gtinExists = row.gtin && existingKeys.has("gtin:" + row.gtin);
    return !upcExists && !gtinExists;
  });

  if (!newRows.length) {
    resultBox.innerHTML = `
      <b>No new records imported.</b><br>
      All UPC / GTIN records already exist.
    `;
    return;
  }

  const { error: insertError } = await supabaseClient
    .from("barcodes")
    .insert(newRows);

  if (insertError) {
    resultBox.innerHTML = "Import error: " + insertError.message;
    return;
  }

  resultBox.innerHTML = `
    <b>Import completed!</b><br>
    Rows in file: ${rows.length}<br>
    New records imported: ${newRows.length}<br>
    Skipped duplicates: ${cleanRows.length - newRows.length}
  `;
}

async function uploadCommodityImage() {

  const commodity = $("commodityImageSelect").value;
  const file = $("commodityImageFile").files[0];
  const resultBox = $("commodityImageResult");

  if (!file) {
    alert("Please select an image.");
    return;
  }

  resultBox.innerHTML = "Uploading image...";

  const filePath = `${commodity}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("commodity-images")
    .upload(filePath, file);

  if (uploadError) {
    resultBox.innerHTML = "Upload error: " + uploadError.message;
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("commodity-images")
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabaseClient
    .from("commodities")
    .update({
      image_url: imageUrl
    })
    .eq("name", commodity);

  if (updateError) {
    resultBox.innerHTML = "Database error: " + updateError.message;
    return;
  }

  resultBox.innerHTML = `
    <b>Image uploaded successfully!</b><br>
    ${commodity} updated.
  `;
}

function renderQCLibrary() {

  const grid = $("qcLibraryCommodityGrid");

  if (!grid) return;

  grid.innerHTML = commodities.map(c => `

    <article class="commodityCard"
      onclick="openQCLibraryCommodity('${c.name}')">

      ${
        c.image_url
          ? `<img src="${c.image_url}" alt="${c.name}">`
          : `<div class="commodityPlaceholder">
              ${c.name}
             </div>`
      }

      <div class="commodityBody">
        <h3>${c.name}</h3>
        <p>Quality Standards & Defects</p>
      </div>

    </article>

  `).join("");
}

function openQCLibraryCommodity(commodity) {
  $("qcLibraryHome").style.display = "none";
  $("qcLibraryDetail").style.display = "block";
  $("qcCommodityTitle").textContent = commodity;
}

function backToQCLibrary() {
  $("qcLibraryDetail").style.display = "none";
  $("qcLibraryHome").style.display = "block";
}
let currentSopSection = "";

function showSopSection(section) {

  currentSopSection = section;

  $("sopSectionTitle").innerHTML =
    `<h2>${section}</h2>`;

  renderDocs();
}
load();

// Service worker disabled for development/cache issues
// if ("serviceWorker" in navigator) {
//   navigator.serviceWorker.register("sw.js").catch(() => {});
// }
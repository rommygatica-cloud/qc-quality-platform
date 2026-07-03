let defects = [];
let docs = { tolerances: [], specs: [], sops: [], barcodes: [] };
let commodities = [];
let qaRejections = [];

let currentSpecSection = "";
let currentSpecCommodity = "";
let currentSopSection = "";
let currentQCLibraryCommodity = "";

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

  await loadQARejections();

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
  if (typeof canAccessView === "function" && !canAccessView(id)) {
    alert("You do not have permission to access this section.");
    return;
  }

  document.querySelectorAll(".view").forEach(v => {
    v.classList.remove("active");
    v.style.display = "none";
  });

  const view = $(id);
  if (!view) return;

  view.classList.add("active");
  view.style.display = "block";

  document.querySelectorAll(".nav").forEach(n =>
    n.classList.toggle("active", n.dataset.view === id)
  );

  const names = {
    dashboard: "Dashboard",
    defects: "QC Knowledge Base",
    tolerances: "Tolerances",
    specs: "Specifications",
    sops: "SOPs",
    daily: "Inbound Management",
    barcode: "Barcode Verification",
    traceability: "Traceability Search",
    qa: "QA Control",
    admin: "Administration"
  };

  $("pageTitle").textContent = names[id] || "Dashboard";

if (id === "qa") {
  openQAModule("dashboard");
  window.scrollTo(0, 0);
}
}

function renderDashboard() {
  if ($("defectCount")) $("defectCount").textContent = defects.length;
  if ($("tolCount")) $("tolCount").textContent = docs.tolerances.length;
  if ($("specCount")) $("specCount").textContent = docs.specs.length;

  if ($("ptfSpecCount")) {
    $("ptfSpecCount").textContent = `${getSectionCount("PTF Internal")} Documents`;
  }

  if ($("retailSpecCount")) {
    $("retailSpecCount").textContent = `${getSectionCount("Retail")} Documents`;
  }

  if ($("usdaSpecCount")) {
    $("usdaSpecCount").textContent = `${getSectionCount("USDA")} Documents`;
  }
}

function options(id, values) {
  const element = $(id);
  if (!element || !element.children[0]) return;

  element.innerHTML =
    element.children[0].outerHTML +
    [...new Set(values)].filter(Boolean).sort().map(v => `<option>${v}</option>`).join("");

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

  return q.split(" ").every(word => text.includes(word));
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
        <p>${(d.description || "").slice(0, 95)}...</p>
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

  return "";
}

function docCard(d) {
  const updated = d.created_at
    ? new Date(d.created_at).toLocaleDateString()
    : "N/A";

  return `
    <article class="card" onclick="window.open('${d.file_url}','_blank')">
      <div class="cardBody">
        <span class="tag">${d.status || "Active"}</span>
        <h3>${d.title}</h3>
        <p>${getCommodityIcon(d.commodity)} ${d.commodity || ""}</p>
        ${d.customer ? `<p>${d.customer}</p>` : ""}
        <p style="font-size:12px;color:#64748b;">Updated ${updated}</p>
      </div>
    </article>
  `;
}

function renderDocs() {
  if ($("toleranceGrid")) {
    $("toleranceGrid").innerHTML =
      docs.tolerances.filter(matchDocument).map(docCard).join("");
  }

  const latestDoc = getLatestDocument();

  if ($("latestDocumentCard")) {
    if (latestDoc) {
      $("latestDocumentCard").innerHTML = `
        <div class="latestDoc">
          <h3>Latest Upload</h3>
          <p><strong>${latestDoc.title}</strong></p>
          <p>${getCommodityIcon(latestDoc.commodity)} ${latestDoc.commodity || ""}</p>
          <p style="font-size:12px;color:#64748b;">
            Updated ${new Date(latestDoc.created_at).toLocaleDateString()}
          </p>
        </div>
      `;
    } else {
      $("latestDocumentCard").innerHTML = "";
    }
  }

  const search = $("globalSearch");
  const searchActive = search ? search.value.trim() !== "" : false;

  const mainCards = $("specMainCards");
  if (mainCards) mainCards.style.display = searchActive ? "none" : "grid";

  const sectionTitle = $("specSectionTitle");
  const latestCard = $("latestDocumentCard");

  if (sectionTitle) sectionTitle.style.display = searchActive ? "none" : "block";
  if (latestCard) latestCard.style.display = searchActive ? "none" : "block";

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

  if ($("specGrid")) {
    $("specGrid").innerHTML = searchActive
      ? renderSpecSearchResults(specsToShow)
      : currentSpecSection
        ? renderSpecDocuments(specsToShow)
        : `<p style="color:#64748b;">Select a specification section.</p>`;
  }

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
    value.includes("cherries") ||
    value.includes("apricots") ||
    value.includes("peaches") ||
    value.includes("nectarines") ||
    value.includes("plums") ||
    value.includes("pears") ||
    value.includes("stone")
  ) {
    return "Stone Fruit";
  }

  if (
    value.includes("citrus") ||
    value.includes("mandarins") ||
    value.includes("oranges") ||
    value.includes("lemons")
  ) {
    return "Citrus";
  }

  if (value.includes("grapes")) {
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
  if (!docs.specs.length) return null;

  return [...docs.specs].sort((a, b) =>
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
      <h3>Database Error</h3>
      <p>${error.message}</p>
    `;
    return;
  }

  const r = data?.[0];

  $("barcodeResult").innerHTML = r
    ? `
      <h3>Match Found</h3>
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
      <h3>No Match Found</h3>
      <p>This UPC / GTIN does not exist in the Label Database.</p>
    `;
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
  const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: "",
  range: 1
});

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

  const { data: updatedRows, error: updateError } = await supabaseClient
    .from("commodities")
    .update({ image_url: imageUrl })
    .eq("name", commodity)
    .select();

  if (updateError) {
    resultBox.innerHTML = "Database error: " + updateError.message;
    return;
  }

  if (!updatedRows || updatedRows.length === 0) {
    resultBox.innerHTML = `No commodity found with name: ${commodity}`;
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
    <article class="commodityCard" onclick="openQCLibraryCommodity('${c.name}')">
      ${
        c.image_url
          ? `<img src="${c.image_url}" alt="${c.name}">`
          : `<div class="commodityPlaceholder">${c.name}</div>`
      }

      <div class="commodityBody">
        <h3>${c.name}</h3>
        <p>Quality Standards & Defects</p>
      </div>
    </article>
  `).join("");
}

function openQCLibraryCommodity(commodity) {
  currentQCLibraryCommodity = commodity;

  $("qcLibraryHome").style.display = "none";
  $("qcLibraryDetail").style.display = "block";
  $("qcCommodityTitle").textContent = commodity;

  if ($("qcSectionTitle")) $("qcSectionTitle").innerHTML = "";
  if ($("qcPhotoGrid")) $("qcPhotoGrid").innerHTML = "";
}

function backToQCLibrary() {
  $("qcLibraryDetail").style.display = "none";
  $("qcLibraryHome").style.display = "block";

  currentQCLibraryCommodity = "";

  if ($("qcSectionTitle")) $("qcSectionTitle").innerHTML = "";
  if ($("qcPhotoGrid")) $("qcPhotoGrid").innerHTML = "";
}

async function openQCLibrarySection(section) {
  $("qcSectionTitle").innerHTML = `<h3>${section}</h3>`;

  const { data, error } = await supabaseClient
    .from("qc_library_photos")
    .select("*")
    .eq("commodity", currentQCLibraryCommodity)
    .eq("section", section)
    .eq("status", "Active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    $("qcPhotoGrid").innerHTML =
      `<p style="color:#991b1b;">Error loading photos.</p>`;
    return;
  }

  if (!data.length) {
    $("qcPhotoGrid").innerHTML =
      `<p style="color:#64748b;">No photos found for ${section}.</p>`;
    return;
  }

  $("qcPhotoGrid").innerHTML = data.map(photo => `
    <article class="card">
      <img src="${photo.image_url}">
      <div class="cardBody">
        <h3>${photo.defect_name}</h3>
        <p>${photo.notes || ""}</p>
      </div>
    </article>
  `).join("");
}

function showSopSection(section) {
  currentSopSection = section;
  $("sopSectionTitle").innerHTML = `<h2>${section}</h2>`;
  renderDocs();
}

async function uploadQCLibraryPhoto() {
  const commodity = $("libraryPhotoCommodity").value;
  const section = $("libraryPhotoSection").value;
  const defectName = $("libraryPhotoDefectName").value.trim();
  const notes = $("libraryPhotoNotes").value.trim();
  const file = $("libraryPhotoFile").files[0];
  const resultBox = $("libraryPhotoResult");

  if (!commodity || !section || !defectName || !file) {
    alert("Please complete commodity, section, defect/topic name, and image.");
    return;
  }

  resultBox.innerHTML = "Uploading QC photo...";

  const safeName = defectName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const safeFileName = file.name.replace(/[^a-z0-9.]/gi, "-").toLowerCase();
  const filePath = `${commodity}/${section}/${safeName}-${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("qc-library-photos")
    .upload(filePath, file);

  if (uploadError) {
    resultBox.innerHTML = "Upload error: " + uploadError.message;
    return;
  }

  const { data: publicUrlData } = supabaseClient.storage
    .from("qc-library-photos")
    .getPublicUrl(filePath);

  const imageUrl = publicUrlData.publicUrl;

  const { error: insertError } = await supabaseClient
    .from("qc_library_photos")
    .insert({
      commodity: commodity,
      section: section,
      defect_name: defectName,
      image_url: imageUrl,
      notes: notes,
      status: "Active"
    });

  if (insertError) {
    resultBox.innerHTML = "Database error: " + insertError.message;
    return;
  }

  resultBox.innerHTML = `
    <b>QC photo uploaded successfully!</b><br>
    ${commodity} → ${section} → ${defectName}
  `;

  $("libraryPhotoDefectName").value = "";
  $("libraryPhotoNotes").value = "";
  $("libraryPhotoFile").value = "";
}

function formatExcelDate(value) {
  if (!value) return "";

  const numberValue = Number(value);

  if (!isNaN(numberValue) && numberValue > 30000) {
    const date = XLSX.SSF.parse_date_code(numberValue);
    if (!date) return String(value);

    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const year = String(date.y).slice(-2);
    return `${date.d}-${months[date.m - 1]}-${year}`;
  }

  return String(value).trim();
}

function getExcelValue(row, possibleNames) {
  const keys = Object.keys(row);

  for (const name of possibleNames) {
    const foundKey = keys.find(k =>
      k.trim().toUpperCase() === name.trim().toUpperCase()
    );

    if (foundKey) return row[foundKey];
  }

  return "";
}

async function importQARejectionsExcel() {
  const file = $("qaRejectionsFile").files[0];
  const resultBox = $("qaRejectionsResult");

  if (!file) {
    alert("Please select an Excel file.");
    return;
  }

  resultBox.innerHTML = "Reading file...";

  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array"
  });

  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });

  if (!rows.length) {
    resultBox.innerHTML = "No rows found.";
    return;
  }

  const records = rows.map(row => ({
    return_date: formatExcelDate(getExcelValue(row, ["RETURN DATE", "RETURN_DATE", "DATE"])),

    loc: String(getExcelValue(row, ["LOC", "LOCATION"]) || "").trim(),

    order_number: String(getExcelValue(row, ["ORDER#", "ORDER", "ORDER NUMBER"]) || "").trim(),

    type: String(getExcelValue(row, ["TYPE"]) || "").trim(),

    reason: String(getExcelValue(row, ["REASON", "REJECTION REASON"]) || "").trim(),

    po_wo: String(getExcelValue(row, ["WO/PO", "PO/WO", "PO", "WO", "PO WO"]) || "").trim(),

    lot: String(getExcelValue(row, ["LOT", "LOT#"]) || "").trim(),

    customer: String(getExcelValue(row, ["CUSTOMER", "CUSTOMER NAME"]) || "").trim(),

    dc: String(getExcelValue(row, ["DC"]) || "").trim(),

    commodity: String(getExcelValue(row, ["COMMODITY", "COMODITY"]) || "").trim(),

    variety: String(getExcelValue(row, ["VARIETY"]) || "").trim(),

    size: String(getExcelValue(row, ["SIZE"]) || "").trim(),

    grower: String(getExcelValue(row, ["GROWER", "PRODUCER", "PRODUCTOR"]) || "").trim(),

    ship_date: formatExcelDate(getExcelValue(row, ["SHIP DATE", "SHIP_DATE"])),

    qty_cases: Number(getExcelValue(row, ["QTY CASES", "QTY", "CASES", "QTY_CASES"]) || 0),

    qc_comments: String(getExcelValue(row, ["QC COMMENTS", "COMMENTS"]) || "").trim(),

    score: String(getExcelValue(row, ["SCORE", "GRADE"]) || "").trim(),

    source: String(getExcelValue(row, ["TYPE"]) || "").toUpperCase().includes("QA")
      ? "QA"
      : "REPACK",

    status: "Open"
  }));
console.log("Excel rows:", rows.length);
console.log("Records generated:", records.length);
console.log(records.slice(0, 10));
  
  const { error } = await supabaseClient
    .from("qa_rejections")
    .insert(records);

  if (error) {
    console.error(error);
    resultBox.innerHTML = "Import error: " + error.message;
    return;
  }

  resultBox.innerHTML = `
    <b>${records.length} records imported successfully.</b>
  `;

  $("qaRejectionsFile").value = "";

  await loadQARejections();

  if ($("qaModuleContent")) {
    openQAModule("records");
  }
}

/* QA CONTROL */

async function loadQARejections() {
  const { data, error } = await supabaseClient
    .from("qa_rejections")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("QA rejections error:", error);
    qaRejections = [];
    return;
  }

  qaRejections = data || [];
}

function openQAModule(module) {
  const container = $("qaModuleContent");
  if (!container) return;

  if (module === "dashboard") {
    renderQARejectionDashboard();
  }

  if (module === "records") {
    renderQARejectionRecords();
  }

  if (module === "entry") {
    renderQAEntryForm();
  }
}

function renderQARejectionDashboard() {
  const container = $("qaModuleContent");

  const currentYear = new Date().getFullYear();

  const currentYearData = qaRejections.filter(r =>
    getRecordYear(r) === currentYear
  );

  const totalRejections = currentYearData.length;
  const totalCases = sumBy(currentYearData, "qty_cases");

  const casesWithProtection = sumBy(
    currentYearData.filter(r =>
      !String(r.return_date || "").toLowerCase().includes("no return")
    ),
    "qty_cases"
  );

  const growerSummary = getGrowerSummaryByCommodity(currentYearData);

  container.innerHTML = `
    <div class="qaToolbar">
      <button class="secondaryBtn" onclick="openQAModule('records')">
        View Records
      </button>

      <button class="secondaryBtn" onclick="openQAModule('entry')">
        Enter Data
      </button>
    </div>

    <section class="qaPanel">
      <div class="qaPanelHeader">
        <div>
          <h2>Rejection Dashboard</h2>
          <p>Monthly rejection trends by commodity, variety, and grower.</p>
        </div>
      </div>

      <div class="qaKpiGrid">
        <article class="stat">
          <b>${totalRejections}</b>
          <span>Total Rejections ${currentYear}</span>
        </article>

        <article class="stat">
          <b>${totalCases.toLocaleString()}</b>
          <span>Total Cases Rejected ${currentYear}</span>
        </article>

        <article class="stat">
          <b>${casesWithProtection.toLocaleString()}</b>
          <span>Cases with Protection ${currentYear}</span>
        </article>

        <article class="stat summaryCard">
          <h4 class="summaryTitle">Active Growers by Commodity</h4>
          <span>${growerSummary}</span>
        </article>
      </div>

      <div class="qaFilters">
        <select id="qaDashMonthFilter" multiple>
          <option value="">All Months</option>
          ${monthOptions(currentYearData)}
        </select>

        <select id="qaDashCommodityFilter" multiple>
          <option value="">All Commodities</option>
          ${optionList(uniqueValues(currentYearData, "commodity"))}
        </select>

        <select id="qaDashVarietyFilter" multiple>
          <option value="">All Varieties</option>
          ${optionList(uniqueValues(currentYearData, "variety"))}
        </select>

        <select id="qaDashGrowerFilter" multiple>
          <option value="">All Growers</option>
          ${optionList(uniqueValues(currentYearData, "grower"))}
        </select>

        <select id="qaDashLotFilter" multiple>
          <option value="">All Lots</option>
          ${optionList(uniqueValues(currentYearData, "lot"))}
        </select>
      </div>

      <div class="qaChartGrid">
        <div class="qaChartBox">
          <h3>Rejections by Month</h3>
          <div id="qaChartMonth"></div>
        </div>

        <div class="qaChartBox">
          <h3>Rejected Cases by Commodity</h3>
          <div id="qaChartCommodity"></div>
        </div>

        <div class="qaChartBox">
          <h3>Rejected Cases by Variety</h3>
          <canvas id="qaChartVariety"></canvas>
        </div>

        <div class="qaChartBox">
          <h3>Rejected Cases by Grower</h3>
          <canvas id="qaChartGrower"></canvas>
        </div>
      </div>

      <div class="qaChartBox">
  <h3>Rejection Reasons</h3>
  <div id="qaChartReason"></div>
</div>

      <div id="qaDashboardDetail"></div>
    </section>
  `;

  [
    "qaDashMonthFilter",
    "qaDashCommodityFilter",
    "qaDashVarietyFilter",
    "qaDashGrowerFilter",
    "qaDashLotFilter"
  ].forEach(id => {
    const el = $(id);
    if (el) el.onchange = updateQADashboardCharts;
  });

  updateQADashboardCharts();
}

function updateQADashboardCharts() {
  const currentYear = new Date().getFullYear();

  const filtered = getFilteredQAData({
    year: currentYear,
    months: getSelectedValues("qaDashMonthFilter"),
    commodities: getSelectedValues("qaDashCommodityFilter"),
    varieties: getSelectedValues("qaDashVarietyFilter"),
    growers: getSelectedValues("qaDashGrowerFilter"),
    lots: getSelectedValues("qaDashLotFilter")
  });


renderBarList("qaChartMonth", groupByMonth(filtered));
renderBarList("qaChartCommodity", groupSum(filtered, "commodity", "qty_cases"));

renderHorizontalChart(
  "qaChartVariety",
  groupSum(filtered, "variety", "qty_cases"),
  "Rejected Cases"
);

renderHorizontalChart(
  "qaChartGrower",
  groupSum(filtered, "grower", "qty_cases"),
  "Rejected Cases"
);

const validReasons = filtered.filter(r => {
  const reason = String(r.reason || "").trim();
  return reason && reason !== "-" && reason.toLowerCase() !== "empty";
});

renderBarList(
  "qaChartReason",
  groupCount(validReasons, "reason")
);

  const hasFilters =
    getSelectedValues("qaDashMonthFilter").length ||
    getSelectedValues("qaDashCommodityFilter").length ||
    getSelectedValues("qaDashVarietyFilter").length ||
    getSelectedValues("qaDashGrowerFilter").length ||
    getSelectedValues("qaDashLotFilter").length;

  const detail = $("qaDashboardDetail");
  if (!detail) return;

  if (!hasFilters) {
    detail.innerHTML = "";
    return;
  }

  if (!filtered.length) {
    detail.innerHTML = `<p style="margin-top:18px;">No records found for the selected filters.</p>`;
    return;
  }

  detail.innerHTML = `
    <h3 style="margin-top:24px;">Detail</h3>
    ${qaSimpleDetailTable(filtered.slice(0, 10))}
  `;
}
function renderQARejectionRecords() {
  const container = $("qaModuleContent");

  container.innerHTML = `
    <section class="qaPanel">
      <div class="qaPanelHeader">
        <div>
          <h2>Rejection Records</h2>
          <p>Review complete rejection data, rankings, filters, and export tools.</p>
        </div>

        <button class="primaryBtn" onclick="openQAModule('entry')">
          Enter Rejection Data
        </button>
      </div>

      <div class="qaFilters">
        <input id="qaRecordSearch" placeholder="Search records..." />

        <select id="qaRecordMonthFilter">
          <option value="">All Months</option>
          ${monthOptions(qaRejections)}
        </select>

        <select id="qaRecordCommodityFilter">
          <option value="">All Commodities</option>
          ${optionList(uniqueValues(qaRejections, "commodity"))}
        </select>

        <select id="qaRecordVarietyFilter">
          <option value="">All Varieties</option>
          ${optionList(uniqueValues(qaRejections, "variety"))}
        </select>

        <select id="qaRecordGrowerFilter">
          <option value="">All Growers</option>
          ${optionList(uniqueValues(qaRejections, "grower"))}
        </select>

        <select id="qaRecordCustomerFilter">
          <option value="">All Customers</option>
          ${optionList(uniqueValues(qaRejections, "customer"))}
        </select>
      </div>

      <div class="qaRankingGrid">
        <div class="qaRankingCard">
          <h3>Risky Customers</h3>
          <div id="qaRiskyCustomers"></div>
        </div>

        <div class="qaRankingCard">
          <h3>Most Rejected Varieties</h3>
          <div id="qaRejectedVarieties"></div>
        </div>

        <div class="qaRankingCard">
          <h3>Growers with More Rejections</h3>
          <div id="qaRejectedGrowers"></div>
        </div>
      </div>

      <div id="qaRecordsTable"></div>
    </section>
  `;

  [
    "qaRecordSearch",
    "qaRecordMonthFilter",
    "qaRecordCommodityFilter",
    "qaRecordVarietyFilter",
    "qaRecordGrowerFilter",
    "qaRecordCustomerFilter"
  ].forEach(id => {
    const el = $(id);
    if (el) el.oninput = updateQARecordsTable;
    if (el) el.onchange = updateQARecordsTable;
  });

  updateQARecordsTable();
}

function updateQARecordsTable() {
  const filtered = getFilteredQAData({
    search: $("qaRecordSearch")?.value || "",
    month: $("qaRecordMonthFilter")?.value || "",
    commodity: $("qaRecordCommodityFilter")?.value || "",
    variety: $("qaRecordVarietyFilter")?.value || "",
    grower: $("qaRecordGrowerFilter")?.value || "",
    customer: $("qaRecordCustomerFilter")?.value || ""
  });

  renderRanking("qaRiskyCustomers", groupSum(filtered, "customer", "qty_cases"));
  renderRanking("qaRejectedVarieties", groupSum(filtered, "variety", "qty_cases"));
  renderRanking("qaRejectedGrowers", groupSum(filtered, "grower", "qty_cases"));

  const table = $("qaRecordsTable");

  if (!table) return;

  if (!filtered.length) {
    table.innerHTML = `<p style="margin-top:18px;">No rejection records found.</p>`;
    return;
  }

  table.innerHTML = `
    <div class="qaTableWrap">
      <table class="qaTable">
        <thead>
          <tr>
            <th>RETURN DATE</th>
            <th>LOC</th>
            <th>ORDER#</th>
            <th>PO/WO</th>
            <th>LOT</th>
            <th>CUSTOMER</th>
            <th>COMMODITY</th>
            <th>VARIETY</th>
            <th>GROWER</th>
            <th>QTY CASES</th>
            <th>REASON</th>
            <th>SCORE</th>
          </tr>
        </thead>

        <tbody>
          ${filtered.map(r => `
            <tr>
              <td>${r.return_date || "-"}</td>
              <td>${r.loc || "-"}</td>
              <td>${r.order_number || "-"}</td>
              <td>${r.po_wo || "-"}</td>
              <td>${r.lot || "-"}</td>
              <td>${r.customer || "-"}</td>
              <td>${r.commodity || "-"}</td>
              <td>${r.variety || "-"}</td>
              <td>${r.grower || "-"}</td>
              <td>${Number(r.qty_cases || 0).toLocaleString()}</td>
              <td>${r.reason || "-"}</td>
              <td>${r.score || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderQAEntryForm() {
  const container = $("qaModuleContent");

  container.innerHTML = `
    <section class="qaPanel">
      <div class="qaPanelHeader">
        <div>
          <h2>New Rejection Record</h2>
          <p>Create and save a new rejection record.</p>
        </div>

        <button class="secondaryBtn" onclick="openQAModule('records')">
  Records
</button>
      </div>

      <form id="qaEntryForm" class="qaForm">
        <input id="qaEntryReturnDate" placeholder="Return Date" />
        <input id="qaEntryLoc" placeholder="LOC" />

        <input id="qaEntryOrder" placeholder="Order#" />
        <input id="qaEntryPoWo" placeholder="PO/WO" />

        <input id="qaEntryLot" placeholder="Lot" />
        <input id="qaEntryCustomer" placeholder="Customer" />

        <input id="qaEntryCommodity" placeholder="Commodity" />
        <input id="qaEntryVariety" placeholder="Variety" />

        <input id="qaEntryGrower" placeholder="Grower" />
        <input id="qaEntryQtyCases" type="number" placeholder="Qty Cases" />

        <input id="qaEntryScore" placeholder="Score" />

        <textarea id="qaEntryReason" class="full" placeholder="Reason"></textarea>

        <button type="submit" class="primaryBtn full">
  Create Rejection
</button>
      </form>

      <div id="qaEntryResult" style="margin-top:16px;"></div>
    </section>
  `;

  $("qaEntryForm").onsubmit = saveQAEntryRecord;
}

async function saveQAEntryRecord(event) {
  event.preventDefault();

  const record = {
    return_date: $("qaEntryReturnDate").value.trim(),
    loc: $("qaEntryLoc").value.trim(),
    order_number: $("qaEntryOrder").value.trim(),
    po_wo: $("qaEntryPoWo").value.trim(),
    lot: $("qaEntryLot").value.trim(),
    customer: $("qaEntryCustomer").value.trim(),
    commodity: $("qaEntryCommodity").value.trim(),
    variety: $("qaEntryVariety").value.trim(),
    grower: $("qaEntryGrower").value.trim(),
    qty_cases: Number($("qaEntryQtyCases").value || 0),
    score: $("qaEntryScore").value.trim(),
    reason: $("qaEntryReason").value.trim(),
    source: "MANUAL",
    status: "Open"
  };

  const { error } = await supabaseClient
    .from("qa_rejections")
    .insert(record);

  if (error) {
    $("qaEntryResult").innerHTML = `<p style="color:#991b1b;">${error.message}</p>`;
    return;
  }

  $("qaEntryResult").innerHTML = `<p style="color:#166534;"><b>Record saved successfully.</b></p>`;
  $("qaEntryForm").reset();

  await loadQARejections();
}

/* QA HELPERS */

function getSelectedValues(id) {
  const el = $(id);
  if (!el) return [];

  return [...el.selectedOptions]
    .map(o => o.value)
    .filter(v => v !== "");
}

function uniqueValues(list, key) {
  return [...new Set(
    list.map(item => item[key]).filter(Boolean)
  )].sort();
}

function optionList(values) {
  return values.map(v => `<option value="${v}">${v}</option>`).join("");
}

function sumBy(list, key) {
  return list.reduce((sum, item) => {
    const value = String(item[key] || "")
      .replace(/,/g, "")
      .trim();

    return sum + (Number(value) || 0);
  }, 0);
}

function topValue(list, key) {
  const grouped = groupCount(list, key);
  const first = grouped[0];
  return first ? first.label : "";
}

function monthOptions(list) {
  const monthOrder = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const months = [...new Set(
    list.map(r => getRecordMonth(r)).filter(m => m && m !== "Unknown")
  )];

  return months
    .sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))
    .map(month => `<option value="${month}">${month}</option>`)
    .join("");
}

function getFilteredQAData(filters = {}) {
  return qaRejections.filter(r => {
    const text = JSON.stringify(r).toLowerCase();

    return (
      (!filters.search || text.includes(filters.search.toLowerCase())) &&

      (!filters.year || getRecordYear(r) === filters.year) &&

      (!filters.month || getRecordMonth(r) === filters.month) &&

      (!filters.months?.length ||
        filters.months.includes(getRecordMonth(r))) &&

      (!filters.commodity || r.commodity === filters.commodity) &&

      (!filters.commodities?.length ||
        filters.commodities.includes(r.commodity)) &&

      (!filters.variety || r.variety === filters.variety) &&

      (!filters.varieties?.length ||
        filters.varieties.includes(r.variety)) &&

      (!filters.grower || r.grower === filters.grower) &&

      (!filters.growers?.length ||
        filters.growers.includes(r.grower)) &&

      (!filters.customer || r.customer === filters.customer) &&

      (!filters.lots?.length ||
        filters.lots.includes(r.lot))
    );
  });
}

function groupCount(list, key) {
  const map = {};

  list.forEach(item => {
    const label = item[key] || "Unknown";
    map[label] = (map[label] || 0) + 1;
  });

  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function groupSum(list, key, sumKey) {
  const map = {};

  list.forEach(item => {
    const label = item[key] || "Unknown";
    map[label] = (map[label] || 0) + (Number(item[sumKey]) || 0);
  });

  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

function groupByMonth(list) {
  const monthOrder = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const map = {};

  list.forEach(item => {
    const label = getRecordMonth(item);
    map[label] = (map[label] || 0) + 1;
  });

  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => monthOrder.indexOf(a.label) - monthOrder.indexOf(b.label));
}

function renderRanking(id, items) {
  const el = $(id);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<p>No data.</p>`;
    return;
  }

  el.innerHTML = items.map((item, index) => `
    <p style="margin:8px 0;">
      <b>${index + 1}. ${item.label}</b><br>
      <span>${Number(item.value).toLocaleString()} cases</span>
    </p>
  `).join("");
}

function renderBarList(id, items) {
  const el = $(id);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<p>No data.</p>`;
    return;
  }

  const max = Math.max(...items.map(i => i.value));

  el.innerHTML = items.map(item => {
    const width = max ? Math.max((item.value / max) * 100, 5) : 0;

    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;">
          <span>${item.label}</span>
          <b>${item.value}</b>
        </div>
        <div style="height:10px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:5px;">
          <div style="height:100%;width:${width}%;background:var(--primary);border-radius:999px;"></div>
        </div>
      </div>
    `;
  }).join("");
}

let commodityChart;

function renderCommodityChart(data) {
  const canvas = document.getElementById("qaChartCommodity");
  if (!canvas) return;
canvas.style.height = "250px";
canvas.height = 250;

  if (commodityChart) {
    commodityChart.destroy();
  }

  commodityChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map(x => x.label),
      datasets: [{
        data: data.map(x => x.value),
        backgroundColor: "#d4a017",
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
maintainAspectRatio: false,
resizeDelay: 200,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true
        }
      }
    }
  });
}

const qaCharts = {};

function renderHorizontalChart(canvasId, data, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  if (qaCharts[canvasId]) {
    qaCharts[canvasId].destroy();
  }

  const total = data.reduce((sum, x) => sum + x.value, 0);

  qaCharts[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map(x => {
        const pct = total ? ((x.value / total) * 100).toFixed(1) : "0.0";
        return `${x.label} (${pct}%)`;
      }),
      datasets: [{
        label: label,
        data: data.map(x => x.value),
        backgroundColor: "#d4a017",
        borderRadius: 8,
        barThickness: 18
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : "0.0";
              return Number(ctx.raw).toLocaleString() + " cases (" + pct + "%)";
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true
        },
        y: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function qaSimpleDetailTable(list) {
  return `
    <div class="qaTableWrap">
      <table class="qaTable">
        <thead>
          <tr>
            <th>RETURN DATE</th>
            <th>LOT</th>
            <th>PO/WO</th>
            <th>VARIETY</th>
            <th>GROWER</th>
            <th>QTY CASES</th>
            <th>REASON</th>
          </tr>
        </thead>

        <tbody>
          ${list.map(r => `
            <tr>
              <td>${r.return_date || "-"}</td>
              <td>${r.lot || "-"}</td>
              <td>${r.po_wo || "-"}</td>
              <td>${r.variety || "-"}</td>
              <td>${r.grower || "-"}</td>
              <td>${Number(r.qty_cases || 0).toLocaleString()}</td>
              <td>${r.reason || "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getRecordYear(record) {
  const raw = String(
    record.ship_date ||
    record.return_date ||
    record.created_at ||
    ""
  ).trim();

  const match = raw.match(/(\d{4})$/);

  if (match) {
    return Number(match[1]);
  }

  return null;
}

function getRecordMonth(record) {
  const raw = String(
    record.ship_date ||
    record.return_date ||
    record.created_at ||
    ""
  ).trim();

  const parts = raw.split("-");

  if (parts.length >= 2) {
    const monthNum = Number(parts[0]);

    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];

    return months[monthNum - 1] || "Unknown";
  }

  return "Unknown";
}

function getGrowerSummaryByCommodity(list) {
  const map = {};

  list.forEach(r => {
    const commodity = r.commodity || "Unknown";
    const grower = r.grower || "";

    if (!grower) return;

    if (!map[commodity]) map[commodity] = new Set();
    map[commodity].add(grower);
  });

  const rows = Object.entries(map)
    .map(([commodity, growers]) => ({
      commodity,
      count: growers.size
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  if (!rows.length) return "-";

  return rows
    .map(r => `${r.commodity}: ${r.count} growers`)
    .join("<br>");
}

async function importManifestExcel() {
  const file = $("manifestFile")?.files[0];

  if (!file) {
    alert("Please select a manifest file.");
    return;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: ""
  });

  console.log("Manifest file:", file.name);
  const po = String(rows[0]?.[1] || "")
  .replace("PO#", "")
  .trim();

const growerRaw = String(rows[0]?.[2] || "").trim();

let grower = "";

if (growerRaw.includes("-")) {
  grower = growerRaw.split("-")[0].trim();
} else {
  grower = growerRaw.split(" ")[0].trim();
}

const vessel = String(rows[1]?.[2] || "").trim();
const eta = formatExcelDate(rows[3]?.[2]);
const container = String(rows[6]?.[2] || "").trim();

console.log({
  po,
  grower,
  vessel,
  eta,
  container
});

const headerRowIndex = rows.findIndex(r =>
  String(r[0]).trim() === "Line"
);

console.log("Header Row:", headerRowIndex);
const manifestRows = rows.slice(headerRowIndex + 1);

console.log("Manifest Rows:", manifestRows.length);

console.log("First Line:", manifestRows[0]);
const firstLine = manifestRows[0];

const sampleRecord = {
  po,
  grower,
  container,

  lot: firstLine[2],
  commodity: firstLine[3],
  variety: firstLine[4],
  pack_style: firstLine[5],
  size: firstLine[6],
  ptf_code: firstLine[8],
  boxes: firstLine[9],
  subgrower: firstLine[10],
  pack_date: firstLine[11]
};

console.log("Sample Record:", sampleRecord);
const records = manifestRows
  .filter(row => row[2]) // lot existe
  .map(row => ({
    eta,
    po,
    grower,
    container,
    vessel,

    lot: row[2],
    commodity: row[3],
    variety: row[4],
    pack_style: row[5],
    size: row[6],
    label: row[7],
    ptf_code: row[8],
    boxes: row[9],
    subgrower: row[10],
    pack_date: row[11]
  }));

console.log("Records:", records);
console.log("Total Records:", records.length);

const saved = await saveManifestToDatabase({
  eta,
  po,
  grower,
  vessel,
  container,
  records
});

if (!saved) return;

await loadInboundArrivals();

alert("Manifest saved successfully.");
}

async function saveManifestToDatabase(data) {
  const fileName = $("manifestFile")?.files[0]?.name || "";
  const lots = [...new Set(
    data.records.map(r => String(r.lot || "").trim())
  )];

  const { data: existingLots, error: checkError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .select("lot")
      .in("lot", lots);

  if (checkError) {
  console.error("Duplicate Check Error:", checkError);

  alert(
    "Error checking duplicate lots:\n\n" +
    checkError.message
  );

  return false;
}

  if (existingLots && existingLots.length > 0) {
  const duplicatedLots = [...new Set(existingLots.map(x => x.lot))];

  alert(
    "This manifest was not imported because these lots already exist:\n\n" +
    duplicatedLots.join(", ")
  );

  return false;
}
  const { data: containerRow, error: containerError } =
    await supabaseClient
      .from("arrival_containers")
      .insert({
        eta: data.eta,
        po: data.po,
        lot: [...new Set(data.records.map(r => r.lot).filter(Boolean))].join(", "),
        grower: data.grower,
        vessel: data.vessel,
        container: data.container,
        commodity: [...new Set(data.records.map(r => r.commodity).filter(Boolean))].join(", "),
        variety: [...new Set(data.records.map(r => r.variety).filter(Boolean))].join(", "),
        recorder_status: "Unknown",
        manifest_name: fileName,
        status: "Pending",
        last_manifest_import: new Date().toISOString(),
        origin: "",
        priority: "",
        active: true,
        notes: ""
      })
      .select()
      .single();

  if (containerError) {
    console.error("Container Error:", containerError);
    alert("Container save error: " + containerError.message);
    return;
  }

  const lines = data.records.map(r => ({
    container_id: containerRow.id,
    po: data.po,
    lot: String(r.lot || ""),
    grower: data.grower,
    commodity: r.commodity,
    variety: r.variety,
    size: r.size,
    pack_style: r.pack_style,
    boxes: Number(r.boxes || 0),
    subgrower: r.subgrower,
    pack_date: formatExcelDate(r.pack_date),
    recorder_code: "",
    ptf_code: r.ptf_code,
    label: r.label || "",
    vessel: data.vessel
  }));

  const { error: linesError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .insert(lines);

  if (linesError) {
    console.error("Manifest Lines Error:", linesError);
    alert("Manifest lines save error: " + linesError.message);
    return;
  }

  console.log("Manifest saved:", containerRow.container, lines.length, "lines");
  
  return true;
}

function renderInboundPreview(records) {
  const tbody = $("inboundTableBody");

  console.log("TBODY:", tbody);
  console.log("Records received:", records.length);

  if (!tbody || !records.length) return;

  const first = records[0];

  const totalBoxes = records.reduce((sum, r) => {
    return sum + (Number(r.boxes) || 0);
  }, 0);

  const commodities = [...new Set(records.map(r => r.commodity).filter(Boolean))].join(", ");
  const varieties = [...new Set(records.map(r => r.variety).filter(Boolean))].join(", ");

  tbody.innerHTML = records.map(r => `
  <tr>
    <td>${r.eta || "-"}</td>
    <td>${r.container || "-"}</td>
    <td>${r.po || "-"}</td>
    <td>${r.lot || "-"}</td>
    <td>${r.grower || "-"}</td>
    <td>${r.commodity || "-"}</td>
    <td>${r.variety || "-"}</td>
    <td>${r.origin || "-"}</td>
    <td>
      <select>
        <option value="">Select Status</option>
        <option>🟢 At Door</option>
        <option>🟡 Sampling</option>
        <option>🔵 Inspection Started</option>
        <option>✅ Inspection Finished</option>
        <option>📧 Report Sent</option>
        <option>🚫 Cancelled / Diverted</option>
      </select>
    </td>
    <td>
      <select>
        <option value="">Select Priority</option>
        <option>Low</option>
        <option>Normal</option>
        <option>High</option>
        <option>Critical</option>
      </select>
    </td>
  </tr>
`).join("");

  console.log("Inbound Summary:", {
    eta: first.eta,
    ref: first.container,
    po: first.po,
    lot: first.lot,
    grower: first.grower,
    commodity: commodities,
    variety: varieties,
    origin: first.origin,
    totalBoxes
  });
}

function openInboundModule(module) {
  const home = $("inboundHomeGrid");
  const content = $("inboundModuleContent");

  if (!home || !content) return;

  home.style.display = "none";

  if (module === "arrivals") {
    content.innerHTML = `
      <section class="qaPanel">
        <button class="secondaryBtn" onclick="backToInboundHome()">
          ← Back
        </button>

        <div class="qaPanelHeader" style="margin-top:18px;">
          <div>
            <h2>🚢 Arrivals</h2>
            <p>Upload JK Fresh status files and manifest details.</p>
          </div>
        </div>

        <div class="qaToolbar">
        <label class="primaryBtn" style="display:inline-block;">
        Upload JK Fresh
        <input
        type="file"
        id="jkFreshFile"
        accept=".xlsx"
        style="display:none;"
        onchange="importJKFreshExcel()"
        />
        </label>

          <label class="secondaryBtn" style="display:inline-block;">
  Upload Manifest
  <input
    type="file"
    id="manifestFile"
    accept=".xlsx"
    style="display:none;"
    onchange="importManifestExcel()"
  />
</label>
        </div>
<div id="arrivalHealthSummary" class="qaKpiGrid" style="margin-bottom:18px;"></div>
        <div class="qaTableWrap">
          <table class="qaTable">
            <thead>
              <tr>
<th>ETA</th>
<th>Ref</th>
<th>PO</th>
<th>Lot</th>
<th>Grower</th>
<th>Commodity</th>
<th>Variety</th>
<th>Origin</th>
<th>Status</th>
<th>Priority</th>
              </tr>
            </thead>

            <tbody id="inboundTableBody">
  <tr>
    <td colspan="10">Ready to import inbound records.</td>
  </tr>
</tbody>
          </table>
        </div>
      </section>
    `;
    
    loadInboundArrivals();
    return;
  }

  content.innerHTML = `
    <section class="qaPanel">
      <button class="secondaryBtn" onclick="backToInboundHome()">
        ← Back
      </button>

      <div class="qaPanelHeader" style="margin-top:18px;">
        <div>
          <h2>${module}</h2>
          <p>This section will be built next.</p>
        </div>
      </div>
    </section>
  `;
}

function backToInboundHome() {
  const home = $("inboundHomeGrid");
  const content = $("inboundModuleContent");

  if (!home || !content) return;

  home.style.display = "grid";
  content.innerHTML = "";
}
let qcClicks = 0;

$("qcLogoTitle")?.addEventListener("click", () => {
  qcClicks++;

  if (qcClicks >= 5) {
    qcClicks = 0;

    alert(`
QC OPERATIONS HUB

The QC Manager who got tired of Excel.

Developed by a QC Specialist with advanced Excel fatigue.
Created after one too many Excel files.

Powered by coffee, containers and frustration.

If you found this message,
you have discovered the first hidden feature
of QC Operations Hub🎉🍇📊☕💛.

Version 1.0
`);
  }

  setTimeout(() => {
    qcClicks = 0;
  }, 3000);
});

function splitPoLot(value) {
  const text = String(value || "").trim();

  if (!text) {
    return { po: "", lot: "" };
  }

  if (text.includes("_")) {
    const parts = text.split("_");
    return {
      po: parts[0] || "",
      lot: parts[1] || ""
    };
  }

  return {
    po: text,
    lot: ""
  };
}

window.importJKFreshExcel = async function importJKFreshExcel() {
  const file = $("jkFreshFile")?.files[0];

  if (!file) {
    alert("Please select a JK Fresh file.");
    return;
  };

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: "",
  range: 1
});

console.log("JK Fresh Rows:", rows);

console.log("First JK Fresh Row:", rows[0]);
console.log("JK Fresh Headers:", Object.keys(rows[0] || {}));

const records = rows
  .filter(row =>
    row["Container"] &&
    String(row["Container"]).trim() !== "" &&
    String(row["Port/Terminal"] || "").trim() !== "-->"
  )
  .map(row => {
    const poLot = splitPoLot(row["Vessel #"]);

    return {
      arrival_key: `${String(row["Container"]).trim()}-${formatExcelDate(row["ETA"])}`,
      vessel: row["Vessel"] || "",
      po: poLot.po,
      lot: poLot.lot,
      container: row["Container"] || "",
      eta: formatExcelDate(row["ETA"]),
      recorder_status: row["Status"] || "Pending",
      commodity: row["Commodity"] || "",
      origin: normalizeOrigin(row["Origin"] || ""),
      shipper_name: row["Shipper"] || "",
      grower: "",
      manifest_name: file.name,
      last_manifest_import: new Date().toISOString(),
      active: true,
      status: "Expected"
    };
  });

console.log("JK Fresh Records:", records);

const uniqueRecords = Array.from(
  new Map(records.map(r => [r.arrival_key, r])).values()
);

console.log("Unique JK Fresh Records:", uniqueRecords);

  const { error } = await supabaseClient
  .from("arrival_containers")
  .upsert(uniqueRecords, {
  onConflict: "arrival_key"
});

  if (error) {
    console.error(error);
    alert("JK Fresh import error: " + error.message);
    return;
  }

  alert(`${uniqueRecords.length} JK Fresh records imported successfully.`);
    await loadInboundArrivals();
};
function normalizeOrigin(value) {
  const code = String(value || "").trim().toUpperCase();

  const origins = {
  PE: "Peru",
  CL: "Chile",
  BR: "Brazil",
  UY: "Uruguay",
  ZA: "South Africa",
  MX: "Mexico",
  US: "United States",
  AR: "Argentina",
  ES: "Spain",
  IT: "Italy",
  EG: "Egypt",
  MA: "Morocco",
  IN: "India"
};

  return origins[code] || code;
}

function parseEtaDate(value) {
  const text = String(value || "").trim();

  if (!text) return null;

  const parts = text.split("-");
  if (parts.length < 3) return null;

  const day = Number(parts[0]);

  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  };

  const month = months[parts[1]];
  const year = 2000 + Number(parts[2]);

  if (!day || month === undefined || !year) return null;

  return new Date(year, month, day);
}

function getEtaHealth(eta) {
  const etaDate = parseEtaDate(eta);

  if (!etaDate) return "unknown";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  etaDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((etaDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "delayed";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";

  return "upcoming";
}

function renderArrivalHealthSummary(list) {
  const box = $("arrivalHealthSummary");
  if (!box) return;

  const counts = {
    delayed: 0,
    today: 0,
    tomorrow: 0,
    upcoming: 0
  };

  list.forEach(r => {
    const health = getEtaHealth(r.eta);
    if (counts[health] !== undefined) {
      counts[health]++;
    }
  });

  box.innerHTML = `
    <article class="stat">
      <b>🔴 ${counts.delayed}</b>
      <span>Delayed</span>
    </article>

    <article class="stat">
      <b>🟡 ${counts.today}</b>
      <span>Today</span>
    </article>

    <article class="stat">
      <b>🟢 ${counts.tomorrow}</b>
      <span>Tomorrow</span>
    </article>

    <article class="stat">
      <b>🔵 ${counts.upcoming}</b>
      <span>Upcoming</span>
    </article>
  `;
}

async function loadInboundArrivals() {
  console.log("Loading arrivals...");

  const tbody = $("inboundTableBody");
  if (!tbody) return;

  const { data, error } = await supabaseClient
  .from("arrival_containers")
  .select("*")
  .eq("active", true);

    console.log("Supabase returned:", data);
    console.log("Supabase error:", error);

  if (error) {
    console.error("Load arrivals error:", error);
    tbody.innerHTML = `<tr><td colspan="10">Error loading arrivals.</td></tr>`;
    return;
  }

  if (!data || !data.length) {
  tbody.innerHTML = `<tr><td colspan="10">No arrivals found.</td></tr>`;
  return;
}

const today = new Date();
today.setHours(0, 0, 0, 0);

const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 7);

const sortedData = data
  .filter(r => {
    const etaDate = parseEtaDate(r.eta);
    return etaDate && etaDate >= startDate;
  })
  .sort((a, b) => {
    return parseEtaDate(a.eta) - parseEtaDate(b.eta);
  });

renderArrivalHealthSummary(sortedData);

  if (!sortedData.length) {
  tbody.innerHTML = `<tr><td colspan="10">No upcoming arrivals found.</td></tr>`;
  return;
}

  tbody.innerHTML = sortedData.map(r => `
    <tr>
      <td>${r.eta || "-"}</td>
      <td>${r.container || "-"}</td>
      <td>${r.po || "-"}</td>
      <td>${r.lot || "-"}</td>
      <td>${r.grower || "-"}</td>
      <td>${r.commodity || "-"}</td>
      <td>${r.variety || "-"}</td>
      <td>${r.origin || "-"}</td>
      <td>
  <select data-id="${r.id}" onchange="window.updateArrivalField(this.dataset.id, 'status', this.value)">
    <option value="">Select Status</option>
<option value="Expected" ${r.status === "Expected" ? "selected" : ""}>Expected</option>
<option value="At Door" ${r.status === "At Door" ? "selected" : ""}>🟢 At Door</option>
<option value="Sampling" ${r.status === "Sampling" ? "selected" : ""}>🟡 Sampling</option>
<option value="Inspection Started" ${r.status === "Inspection Started" ? "selected" : ""}>🔵 Inspection Started</option>
<option value="Inspection Finished" ${r.status === "Inspection Finished" ? "selected" : ""}>✅ Inspection Finished</option>
<option value="Report Sent" ${r.status === "Report Sent" ? "selected" : ""}>📧 Report Sent</option>
<option value="Cancelled / Diverted" ${r.status === "Cancelled / Diverted" ? "selected" : ""}>🚫 Cancelled / Diverted</option>
  </select>
</td>

<td>
  <select data-id="${r.id}" onchange="window.updateArrivalField(this.dataset.id, 'priority', this.value)">
    <option value="">Select Priority</option>
<option value="Low" ${r.priority === "Low" ? "selected" : ""}>Low</option>
<option value="Normal" ${r.priority === "Normal" ? "selected" : ""}>Normal</option>
<option value="High" ${r.priority === "High" ? "selected" : ""}>High</option>
<option value="Critical" ${r.priority === "Critical" ? "selected" : ""}>Critical</option>
  </select>
</td>
    </tr>
  `).join("");
}

window.updateArrivalField = async function updateArrivalField(id, field, value) {
  console.log("Updating:", id, field, value);

  const updates = {
    [field]: value
  };

  if (
    field === "status" &&
    (value === "Report Sent" || value === "Cancelled / Diverted")
  ) {
    updates.active = false;
    updates.closed_at = new Date().toISOString();
  }

  const { error } = await supabaseClient
    .from("arrival_containers")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to save change.");
    return;
  }

  await loadInboundArrivals();
}

load();
// ==========================================
// 🫘 TRACEABILITY MODULE
// ==========================================

function openTraceabilityModule(module) {

  const home = document.getElementById("traceabilityHomeGrid");
  const content = document.getElementById("traceabilityModuleContent");

  if (!home || !content) return;

  home.style.display = "none";

  if (module === "inventory") {

    content.innerHTML = `
      <section class="qaPanel">

        <button
          class="secondaryBtn"
          onclick="backToTraceabilityHome()">
          ← Back
        </button>

        <div class="qaPanelHeader" style="margin-top:18px;">
          <div>
            <h2>📦 Inventory Detail</h2>
            <p>Manage Famous inventory and Decofrut QC scores.</p>
          </div>
        </div>

        <div id="inventoryDetailContent" style="margin-top:24px;">

  <div class="qaToolbar">

    <label class="primaryBtn" style="display:inline-block;">
      📥 Upload Famous Inventory
      <input
        type="file"
        id="famousInventoryFile"
        onchange="previewFamousInventory(this.files[0])"
        accept=".xlsx,.xls"
        style="display:none;"
      />
    </label>

    <label class="secondaryBtn" style="display:inline-block;">
      📊 Upload Decofrut Scores
      <input
      type="file"
      id="decofrutScoresFile"
      onchange="previewDecofrutScores(this.files[0])"
      accept=".xlsx,.xls"
      style="display:none;"
      />
    </label>

  </div>

  <div id="inventoryTableContent" style="margin-top:24px;"></div>

</div>

      </section>
    `;

    loadFamousInventoryFromSupabase()
      .then(rows => {
  inventoryExplorerRows = rows;

  console.log("🫘 Famous inventory restored:", rows.length);

if (rows.length > 0) {
  renderFamousInventoryExplorer(rows);
  renderInventoryDetail();
}
loadDecofrutScoresFromSupabase()
  .then(qcRows => {
    console.log("🫘 Decofrut records available:", qcRows.length);

    if (qcRows.length > 0) {
      window.inventoryQCScoresRows = qcRows;
      associateDecofrutScores(qcRows);
    }
  })
  .catch(error => {
    console.error("❌ Decofrut restore failed:", error);
  });
})
      .catch(error => {
        console.error("❌ Famous inventory restore failed:", error);
      });

  }
}


// ==========================================
// 🫘 BACK TO TRACEABILITY HOME
// ==========================================

function backToTraceabilityHome() {

  const home = document.getElementById("traceabilityHomeGrid");
  const content = document.getElementById("traceabilityModuleContent");

  if (home) home.style.display = "";
  if (content) content.innerHTML = "";

}

// ==========================================
// 📦 FAMOUS INVENTORY — FILE PREVIEW
// ==========================================

async function canUploadFamousInventory() {
  const { data, error } = await supabaseClient.rpc("is_qc_admin");

  if (error) {
    console.error("Famous upload permission error:", error);
    return false;
  }

  return data === true;
}

async function registerFamousInventoryUpload(uploadId) {
  const { error } = await supabaseClient
    .from("famous_inventory_uploads")
    .insert({
      upload_id: uploadId
    });

  if (error) {
    throw new Error(
      `Famous upload registration failed: ${error.message}`
    );
  }

  console.log("🫘 Famous upload registered:", uploadId);
}

let famousInventoryUploadInProgress = false;
async function saveFamousInventoryToSupabase(inventoryRows) {
  if (!Array.isArray(inventoryRows) || inventoryRows.length === 0) {
    throw new Error("Cannot save an empty Famous inventory.");
  }

if (famousInventoryUploadInProgress) {
  throw new Error("A Famous inventory upload is already in progress.");
}

famousInventoryUploadInProgress = true;

try {
  
  console.log("🫘 Famous upload lock activated");
  console.log("🫘 Upload lock status:", famousInventoryUploadInProgress);

  const allowed = await canUploadFamousInventory();

  if (!allowed) {
    throw new Error("Only QC Admin can upload Famous inventory.");
  }

  const uploadId = crypto.randomUUID();
  const uploadStartedAt = new Date().toISOString();

  await registerFamousInventoryUpload(uploadId);

  console.log("🫘 Famous inventory ready for upload:", {
    uploadId,
    totalRecords: inventoryRows.length
  });

  const batchSize = 200;
  const batches = [];

  for (let i = 0; i < inventoryRows.length; i += batchSize) {
    batches.push(inventoryRows.slice(i, i + batchSize));
  }

  console.log("🫘 Famous upload batches prepared:", {
    totalRecords: inventoryRows.length,
    totalBatches: batches.length,
    batchSize
  });

const uploadRecords = inventoryRows.map(row => ({
  upload_id: uploadId,
  data: row
}));

console.log("🫘 Famous records prepared for Supabase:", {
  totalRecords: uploadRecords.length,
  firstRecord: uploadRecords[0]
});

for (let i = 0; i < uploadRecords.length; i += batchSize) {
  const batch = uploadRecords.slice(i, i + batchSize);

  await insertFamousInventoryBatch(batch);

  console.log("🫘 Famous batch uploaded:", {
    batchNumber: Math.floor(i / batchSize) + 1,
    totalBatches: Math.ceil(uploadRecords.length / batchSize)
  });
}
await activateFamousInventory(uploadId, uploadRecords.length);

return uploadId;

} finally {
  famousInventoryUploadInProgress = false;
  console.log("🫘 Famous upload lock released");
}
}

async function insertFamousInventoryBatch(uploadRecords) {
  const { error } = await supabaseClient
    .from("famous_current_inventory")
    .insert(uploadRecords);

  if (error) {
    throw new Error(
      `Famous inventory batch failed: ${error.message}`
    );
  }
}

async function activateFamousInventory(uploadId, expectedRecords) {
  const { error } = await supabaseClient.rpc(
    "activate_famous_inventory",
    {
      p_upload_id: uploadId,
      p_expected_records: expectedRecords
    }
  );

  if (error) {
    throw new Error(
      `Famous inventory activation failed: ${error.message}`
    );
  }

  console.log("🫘 Famous inventory activated:", {
    uploadId,
    totalRecords: expectedRecords
  });
}

async function loadFamousInventoryFromSupabase() {
  const { data: status, error: statusError } = await supabaseClient
    .from("famous_inventory_status")
    .select("active_upload_id, last_updated, total_records")
    .eq("id", 1)
    .single();

  if (statusError) throw statusError;
  if (!status?.active_upload_id) return [];

  const rows = [];
  const pageSize = 500;

  for (let start = 0; start < status.total_records; start += pageSize) {
    const { data, error } = await supabaseClient
      .from("famous_current_inventory")
      .select("data")
      .eq("upload_id", status.active_upload_id)
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1);

    if (error) throw error;
    rows.push(...data.map(record => record.data));
  }

  if (rows.length !== status.total_records) {
    throw new Error("Incomplete Famous inventory download.");
  }

  return rows;
}

async function displayFamousInventory(rows) {
  inventoryExplorerRows = rows;
  console.log("🫘 Inventory ready to display:", rows.length);
}

async function previewFamousInventory(file) {

  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
  type: "array",
  cellDates: true
});

    console.log("📦 FAMOUS INVENTORY FILE:", file.name);
    console.log("📋 AVAILABLE SHEETS:", workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {

      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: ""
      });

      console.log("📄 SHEET:", sheetName);
      console.log("📊 TOTAL ROWS:", rows.length);
      console.log("🔎 COLUMNS:", Object.keys(rows[0] || {}));
      
      if (sheetName === "INV 10-12") {

        console.table(
  rows.slice(0, 10).map(r => ({
    pallet: r.pallet,
    PO: r.lot,
    GS1Lot: r.gs1lot,
    boxes: r.boxes
  }))
);

const withPO = rows.filter(r =>
  String(r.po ?? "").trim() !== ""
);

const withGrade = rows.filter(r =>
  String(r.grade ?? "").trim() !== ""
);

const uniquePallets = new Set(
  rows.map(r => String(r.pallet ?? "").trim())
      .filter(Boolean)
);

console.log("📦 INVENTORY ANALYSIS:", {
  totalRows: rows.length,
  uniquePallets: uniquePallets.size,
  rowsWithPO: withPO.length,
  rowsWithoutPO: rows.length - withPO.length,
  rowsWithGrade: withGrade.length
});
        
  console.table(
    rows.slice(0, 10).map(r => ({
      pallet: r.pallet,
      po: r.po,
      lot: r.lot,
      boxes: r.boxes,
      grade: r.grade,
      quality: r.quality,
      condition: r.condition
    }))
  );
}

    });

    const inventorySheetName = workbook.SheetNames.find(name =>
  name.toLowerCase().startsWith("inv ")
);

if (!inventorySheetName) {
  alert("Inventory detail sheet not found.");
  return;
}

const inventoryRows = XLSX.utils.sheet_to_json(
  workbook.Sheets[inventorySheetName],
  { defval: "" }
);
if (!inventoryRows.length) {
  alert("Famous Inventory is empty. Previous inventory was preserved.");
  return;
}
inventoryExplorerRows = inventoryRows;
try {
  const uploadId = await saveFamousInventoryToSupabase(inventoryRows);
  console.log("🫘 Famous inventory saved successfully:", uploadId);
  alert(`✅ Famous inventory saved: ${inventoryRows.length} records.`);
} catch (error) {
  console.error("❌ Famous inventory save failed:", error);
  alert(`⚠️ Inventory preview loaded, but Supabase save failed: ${error.message}`);
}
console.log(
  "🫘 FAMOUS INVENTORY COLUMNS:",
  Object.keys(inventoryRows[0] || {})
);

renderFamousInventoryExplorer(inventoryRows);
renderInventoryDetail();

  } catch (error) {
    console.error("❌ INVENTORY READ ERROR:", error);
    alert("Could not read inventory file.");
  }
}

function renderFamousInventoryExplorer(inventoryRows) {


const container = document.getElementById("inventoryTableContent");

if (!container) return;

container.innerHTML = `
  <h3>📊 Inventory Explorer</h3>
<p>${inventoryRows.length} inventory records loaded.</p>

<div class="qaPanel" style="margin:20px 0; padding:20px;">

  <div style="display:flex; justify-content:space-between; align-items:center;">
    <div>
      <h3 style="margin:0;">⚙️ Customize View</h3>
      <p style="margin:6px 0 0; color:#64748b;">
        Choose how you want to explore your inventory.
      </p>
    </div>
  </div>

  <div style="
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:16px;
    margin-top:20px;
  ">

    <div>
      <label><b>Group By</b></label>
      <div id="inventoryGroupingFields" style="
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:10px;
">

  <button type="button" class="secondaryBtn" data-group="grower">Grower</button>
  <button type="button" class="secondaryBtn" data-group="vendor">Vendor</button>
  <button type="button" class="secondaryBtn" data-group="lot">PO</button>
  <button type="button" class="secondaryBtn" data-group="gs1lot">Lot</button>
  <button type="button" class="secondaryBtn" data-group="commodity">Commodity</button>
  <button type="button" class="secondaryBtn" data-group="variety">Variety</button>
  <button type="button" class="secondaryBtn" data-group="size">Size</button>
  <button type="button" class="secondaryBtn" data-group="package">Package</button>
  <button type="button" class="secondaryBtn" data-group="location">Location</button>

</div>

<div id="inventorySelectedGroups" style="
  margin-top:12px;
  font-size:13px;
  color:#64748b;
">
  No grouping selected.
</div>
    </div>

    <div>
     <div>
  <label><b>View Mode</b></label>

  <div style="
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    margin-top:10px;
  ">

    <button
      type="button"
      id="inventoryDetailBtn"
      class="primaryBtn">
      📦 Pallet Detail
    </button>

    <button
      type="button"
      id="inventorySummaryBtn"
      class="secondaryBtn">
      📊 Consolidated Inventory
    </button>

  </div>

  <select id="inventoryViewMode" style="display:none;">
    <option value="detail">Pallet Detail</option>
    <option value="summary">Consolidated Inventory</option>
  </select>
</div>

  </div>

  <div style="margin-top:18px; color:#64748b; font-size:13px;">
    💡 Multi-level grouping, custom columns, and saved views are coming next.
    <!-- 🫘 INVENTORY FILTERS -->
<div style="
  margin-top:20px;
  padding-top:18px;
  border-top:1px solid #e2e8f0;
">

  <label style="font-weight:600;">
    🔎 Filter Inventory
  </label>

  <div style="
    display:flex;
    flex-wrap:wrap;
    gap:12px;
    margin-top:12px;
    align-items:center;
  ">

    <div>
      <label style="font-size:12px; color:#64748b;">
        Location
      </label>

      <select
        id="inventoryLocationFilter"
        style="
          display:block;
          min-width:220px;
          padding:10px;
          margin-top:6px;
          border:1px solid #e2e8f0;
          border-radius:10px;
          background:white;
        "
      >
        <option value="">All Locations</option>
      </select>
    </div>

  </div>

</div>
  </div>

</div>


<style>
  #inventoryCommodityFilter,
  #inventoryVarietyFilter,
  #inventoryGrowerFilter,
  #inventoryVendorFilter,
  #inventoryPOFilter {
    min-width: 170px;
    max-width: 220px;
    flex: 1 1 170px;
    padding: 12px 14px;
    border: 1px solid #dce3eb;
    border-radius: 12px;
    background-color: #ffffff;
    color: #253247;
    font-size: 14px;
    font-family: inherit;
    cursor: pointer;
    box-sizing: border-box;
  }

  #inventoryCommodityFilter:focus,
  #inventoryVarietyFilter:focus,
  #inventoryGrowerFilter:focus,
  #inventoryVendorFilter:focus,
  #inventoryPOFilter:focus {
    outline: 2px solid #DDAA13;
    outline-offset: 1px;
  }
</style>


<!-- 📊 INVENTORY ADVANCED FILTERS -->
<div style="
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  margin:18px 0;
">

  
<select id="inventoryCommodityFilter">
  <option value="">All Commodities</option>
</select>

<select id="inventoryVarietyFilter">
  <option value="">All Varieties</option>
</select>

<select id="inventoryGrowerFilter">
  <option value="">All Growers</option>
</select>

<select id="inventoryVendorFilter">
  <option value="">All Vendors</option>
</select>

<select id="inventoryPOFilter">
  <option value="">All POs</option>
</select>


  <button
    type="button"
    class="secondaryBtn"
    id="inventoryClearFilters">
    Clear Filters
  </button>

</div>

<!-- 🔎 INVENTORY GENERAL SEARCH -->
<div style="margin:18px 0;">

  <label for="inventorySearch"
    style="display:block; font-weight:600; margin-bottom:8px;">
    🔎 Search Inventory
  </label>

  <input
    type="search"
    id="inventorySearch"
    placeholder="Search Commodity, Variety, Grower, PO, Lot, Pallet..."
    style="
      width:100%;
      max-width:550px;
      padding:12px;
      border:1px solid #cbd5e1;
      border-radius:10px;
      font-size:14px;
      box-sizing:border-box;
    "
  />

</div>

<div id="inventoryDetailView">
  <div class="qaTableWrap">
    <table class="qaTable">
     <thead>
  <tr>
    <th>Grower</th>
    <th>PO</th>
    <th>Lot</th>
    <th>Commodity</th>
    <th>Variety</th>
    <th>size</th>
    <th>Package</th>
    <th>Ageing</th>
    <th>Receiving Date</th>
    <th>Pallet</th>
    <th>QC Score</th>
    <th>Boxes</th>
    </tr>
    </thead>

<tbody>
  ${inventoryRows.slice(0, 20).map(r => `
    <tr>
      <td>${r.grower ?? ""}</td>
      <td>${r.lot ?? ""}</td>
      <td>${r.gs1lot ?? ""}</td>
      <td>${r.commodity ?? ""}</td>
      <td>${r.variety ?? ""}</td>
      <td>${r.size ?? ""}</td>
      <td>${r.package ?? ""}</td>
      <td>${getInventoryAgeing(r.receivingdate)}</td>
      <td>${
  r.receivingdate
    ? new Date(r.receivingdate).toLocaleDateString("en-US", {
        timeZone: "America/New_York"
      })
    : ""
}</td>
      <td>${r.pallet ?? ""}</td>
      <td>${r.qcScore || r.grade || ""}</td>
      <td>${r.boxes ?? ""}</td>
    </tr>
  `).join("")}
</tbody>
    </table>
  </div>

  <p style="margin-top:12px;color:#64748b;">
    Preview only — showing the first 20 records.
    No data has been saved.
  </p>
  </div>

<div id="inventorySummaryView" style="display:none;"></div>
`;

const inventoryDetailRows = document.querySelectorAll(
  "#inventoryDetailView tbody tr"
);
setupInventoryGrouping();
setupInventoryAdvancedFilters();

// 🔎 INVENTORY SEARCH — UPDATE BOTH VIEWS
document.getElementById("inventorySearch")
  ?.addEventListener("input", () => {

    inventoryCurrentPage = 1;

    const mode =
      document.getElementById("inventoryViewMode")?.value;

    if (mode === "summary") {
      renderInventorySummary();
    } else {
      renderInventoryDetail();
    }

  });

// 🫘 INVENTORY LOCATION FILTER — LOAD OPTIONS

const locationFilter = document.getElementById(
  "inventoryLocationFilter"
);

if (locationFilter) {

  const locations = [...new Set(
    inventoryExplorerRows
      .map(row => String(row.location ?? "").trim())
      .filter(Boolean)
  )].sort();

  locations.forEach(location => {

    const option = document.createElement("option");

    option.value = location;
    option.textContent = location;

    locationFilter.appendChild(option);

  });
 
  locationFilter.addEventListener("change", () => {

  const viewMode = document.getElementById("inventoryViewMode");

  if (viewMode?.value === "summary") {
    renderInventorySummary();
  } else {
    renderInventoryDetail();
  }

});

}

const detailBtn = document.getElementById("inventoryDetailBtn");
const summaryBtn = document.getElementById("inventorySummaryBtn");

detailBtn.addEventListener("click", () => {
  viewMode.value = "detail";
  viewMode.dispatchEvent(new Event("change"));

  detailBtn.className = "primaryBtn";
  summaryBtn.className = "secondaryBtn";
});

summaryBtn.addEventListener("click", () => {
  viewMode.value = "summary";
  viewMode.dispatchEvent(new Event("change"));

  summaryBtn.className = "primaryBtn";
  detailBtn.className = "secondaryBtn";
});

const viewMode = document.getElementById("inventoryViewMode");
const detailView = document.getElementById("inventoryDetailView");
const summaryView = document.getElementById("inventorySummaryView");

viewMode.addEventListener("change", () => {

  const showSummary = viewMode.value === "summary";

  detailView.style.display = showSummary ? "none" : "block";
  summaryView.style.display = showSummary ? "block" : "none";
  if (showSummary) {
  renderInventorySummary();
}

});

 }

// ==========================================
// 🫘 INVENTORY EXPLORER — GROUP SELECTION
// ==========================================

let inventorySelectedGroups = [];
let inventoryExplorerRows = [];

// ==========================================
// 📦 INVENTORY EXPLORER — PAGINATION
// ==========================================

let inventoryCurrentPage = 1;
let inventoryRowsPerPage = 50;

function setupInventoryGrouping() {

  const buttons = document.querySelectorAll(
    "#inventoryGroupingFields button"
  );

  const display = document.getElementById(
    "inventorySelectedGroups"
  );

  buttons.forEach(button => {

    button.addEventListener("click", () => {

      const field = button.dataset.group;

      if (inventorySelectedGroups.includes(field)) {
        inventorySelectedGroups =
          inventorySelectedGroups.filter(g => g !== field);
      } else {
        inventorySelectedGroups.push(field);
      }

      const isSelected = inventorySelectedGroups.includes(field);

button.classList.toggle("active", isSelected);

button.style.backgroundColor = isSelected ? "#DDAA13" : "";
button.style.color = isSelected ? "#FFFFFF" : "";
button.style.borderColor = isSelected ? "#DDAA13" : "";

      display.textContent = inventorySelectedGroups.length
        ? "Grouping: " + inventorySelectedGroups.join(" → ")
        : "No grouping selected.";
if (document.getElementById("inventoryViewMode")?.value === "summary") {
  renderInventorySummary();
}


        const groupedRows = groupInventoryRows(
  inventoryExplorerRows,
  inventorySelectedGroups
);

console.log("📊 INVENTORY GROUPING TEST:", {
  selectedFields: inventorySelectedGroups,
  totalGroups: groupedRows.length
});

console.table(
  groupedRows.slice(0, 10).map(group => ({
    Group: group.values.join(" → "),
    TotalBoxes: group.totalBoxes,
    Pallets: group.palletCount,
    Records: group.records
  }))
);
    });
  });

}

// ==========================================
// 📊 INVENTORY EXPLORER — GROUPING ENGINE
// ==========================================

function groupInventoryRows(rows, fields) {

  if (!fields.length) return [];

  const groups = new Map();

  rows.forEach(row => {

    const values = fields.map(field =>
      String(row[field] ?? "").trim()
    );

    const key = JSON.stringify(values);

    if (!groups.has(key)) {
      groups.set(key, {
        values,
        totalBoxes: 0,
        pallets: new Set(),
        records: 0
      });
    }

    const group = groups.get(key);

    group.totalBoxes += Number(row.boxes) || 0;
    group.records++;

    if (row.pallet) {
      group.pallets.add(String(row.pallet).trim());
    }

  });

  return Array.from(groups.values()).map(group => ({
    ...group,
    palletCount: group.pallets.size
  }));

}

// ==========================================
// 📊 INVENTORY EXPLORER — SUMMARY TABLE
// ==========================================

function renderInventorySummary() {

  const container = document.getElementById("inventorySummaryView");

  if (!container) return;

  if (!inventorySelectedGroups.length) {
    container.innerHTML = `
      <p style="padding:20px; color:#64748b;">
        🫘 Select at least one Group By field to view consolidated inventory.
      </p>
    `;
    return;
  }

  const groupedRows = groupInventoryRows(
  getFilteredInventoryRows(),
  inventorySelectedGroups
);

  const labels = {
    grower: "Grower",
    vendor: "Vendor",
    lot: "PO",
    gs1lot: "Lot",
    commodity: "Commodity",
    variety: "Variety",
    size: "Size",
    package: "Package",
    location: "Location"
  };

  container.innerHTML = `
    <div class="qaTableWrap">
      <table class="qaTable">

        <thead>
          <tr>
            ${inventorySelectedGroups.map(field => `
              <th>${labels[field] || field}</th>
            `).join("")}

            <th>Boxes</th>
            <th>Pallets</th>
          </tr>
        </thead>

        <tbody>
          ${groupedRows.map(group => `
            <tr>
              ${group.values.map(value => `
                <td>${value}</td>
              `).join("")}

              <td>${group.totalBoxes.toLocaleString("en-US")}</td>
              <td>${group.palletCount.toLocaleString("en-US")}</td>
            </tr>
          `).join("")}
        </tbody>

      </table>
    </div>

    <p style="margin-top:12px; color:#64748b;">
      ${groupedRows.length} groups generated.
      No data has been saved.
    </p>
  `;

}

// ==========================================
// 🫘 INVENTORY EXPLORER — LOCATION FILTER
// ==========================================


function getFilteredInventoryRows() {
  const value = id =>
    String(document.getElementById(id)?.value || "")
      .trim().toLowerCase();

  const filters = {
    location: value("inventoryLocationFilter"),
    commodity: value("inventoryCommodityFilter"),
    variety: value("inventoryVarietyFilter"),
    grower: value("inventoryGrowerFilter"),
    vendor: value("inventoryVendorFilter"),
    lot: value("inventoryPOFilter")
  };

  const search = value("inventorySearch");

  const searchFields = [
    "commodity", "variety", "grower", "vendor",
    "lot", "gs1lot", "pallet", "size", "package"
  ];

  return inventoryExplorerRows.filter(row => {
    const matchesFilters = Object.entries(filters).every(
      ([field, selected]) =>
        !selected ||
        String(row[field] ?? "").trim().toLowerCase() === selected
    );

    const matchesSearch = !search || searchFields.some(field =>
      String(row[field] ?? "").toLowerCase().includes(search)
    );

    return matchesFilters && matchesSearch;
  });
}

// 📊 INVENTORY CASCADING FILTERS
function setupInventoryAdvancedFilters() {
  const fields = {
    inventoryCommodityFilter: "commodity",
    inventoryVarietyFilter: "variety",
    inventoryGrowerFilter: "grower",
    inventoryVendorFilter: "vendor",
    inventoryPOFilter: "lot"
  };

  const ids = Object.keys(fields);

  const normalize = value =>
    String(value ?? "").trim().toLowerCase();

  const refresh = () => {
    inventoryCurrentPage = 1;

    if (document.getElementById("inventoryViewMode")?.value === "summary") {
      renderInventorySummary();
    } else {
      renderInventoryDetail();
    }
  };

  const populate = () => {
    const location = normalize(
      document.getElementById("inventoryLocationFilter")?.value
    );

    const selected = {};

    ids.forEach(id => {
      selected[id] = normalize(document.getElementById(id)?.value);
    });

    ids.forEach(id => {
      const select = document.getElementById(id);
      if (!select) return;

      const field = fields[id];

      // Filter available options using all other active filters.
      const matchingRows = inventoryExplorerRows.filter(row => {
        if (
          location &&
          normalize(row.location) !== location
        ) return false;

        return ids.every(otherId => {
          if (otherId === id || !selected[otherId]) return true;

          return normalize(row[fields[otherId]]) === selected[otherId];
        });
      });

      const values = [...new Set(
        matchingRows
          .map(row => String(row[field] ?? "").trim())
          .filter(Boolean)
      )].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );

      const firstOption = select.options[0].cloneNode(true);
      const previous = select.value;

      select.replaceChildren(firstOption);

      values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      if (values.some(v => normalize(v) === normalize(previous))) {
        select.value = values.find(
          v => normalize(v) === normalize(previous)
        );
      } else {
        select.value = "";
      }
    });
  };

  ids.forEach(id => {
    document.getElementById(id)?.addEventListener("change", () => {
      populate();
      refresh();
    });
  });

  document.getElementById("inventoryLocationFilter")
    ?.addEventListener("change", () => {
      populate();
      refresh();
    });

  document.getElementById("inventoryClearFilters")
    ?.addEventListener("click", () => {
      ids.forEach(id => {
        const select = document.getElementById(id);
        if (select) select.value = "";
      });

      const search = document.getElementById("inventorySearch");
      if (search) search.value = "";

      populate();
      refresh();
    });

  populate();
}


// ==========================================
// 📦 INVENTORY EXPLORER — FILTERED PALLET DETAIL
// ==========================================

function getInventoryAgeing(receivingDate) {
  if (!receivingDate) return "";

  const date = new Date(receivingDate);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();

  const start = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const end = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  return Math.floor((end - start) / 86400000);
}

function renderInventoryDetail() {

  const tbody = document.querySelector(
    "#inventoryDetailView tbody"
  );

  if (!tbody) return;

  const rows = getFilteredInventoryRows();

  // 🫘 PAGINATION — CURRENT PAGE

const totalPages = Math.max(
  1,
  Math.ceil(rows.length / inventoryRowsPerPage)
);

inventoryCurrentPage = Math.min(
  Math.max(1, inventoryCurrentPage),
  totalPages
);

const startIndex =
  (inventoryCurrentPage - 1) * inventoryRowsPerPage;

const paginatedRows = rows.slice(
  startIndex,
  startIndex + inventoryRowsPerPage
);

  const detailView = document.getElementById("inventoryDetailView");
const info = detailView?.querySelector("p");

if (info) {
  info.textContent =
    `${rows.length.toLocaleString("en-US")} inventory records displayed. No data has been saved.`;
}

  tbody.innerHTML = paginatedRows.map(r => `
    <tr>
      <td>${r.grower ?? ""}</td>
      <td>${r.lot ?? ""}</td>
      <td>${r.gs1lot ?? ""}</td>
      <td>${r.commodity ?? ""}</td>
      <td>${r.variety ?? ""}</td>
      <td>${r.size ?? ""}</td>
      <td>${r.package ?? ""}</td>
      <td>${getInventoryAgeing(r.receivingdate)}</td>
      <td>${
  r.receivingdate
    ? new Date(r.receivingdate).toLocaleDateString("en-US", {
        timeZone: "America/New_York"
      })
    : ""
}</td>
      <td>${r.pallet ?? ""}</td>
      <td>${r.qcScore || r.grade || ""}</td>
      <td>${r.boxes ?? ""}</td>
    </tr>
  `).join("");
  // 🫘 INVENTORY PAGINATION CONTROLS

let pagination = document.getElementById(
  "inventoryPagination"
);

if (!pagination) {
  pagination = document.createElement("div");
  pagination.id = "inventoryPagination";
  pagination.style.cssText = `
    display:flex;
    justify-content:center;
    align-items:center;
    gap:14px;
    padding:18px;
    flex-wrap:wrap;
  `;

  document.getElementById("inventoryDetailView")
    .appendChild(pagination);
}

pagination.innerHTML = `
  <button
    type="button"
    class="secondaryBtn"
    id="inventoryPreviousPage"
    ${inventoryCurrentPage === 1 ? "disabled" : ""}
  >
    ← Previous
  </button>

  <span>
    Page ${inventoryCurrentPage} of ${totalPages}
  </span>

  <button
    type="button"
    class="secondaryBtn"
    id="inventoryNextPage"
    ${inventoryCurrentPage === totalPages ? "disabled" : ""}
  >
    Next →
  </button>
`;

document.getElementById("inventoryPreviousPage")
  .addEventListener("click", () => {
    inventoryCurrentPage--;
    renderInventoryDetail();
  });

document.getElementById("inventoryNextPage")
  .addEventListener("click", () => {
    inventoryCurrentPage++;
    renderInventoryDetail();
  });

}
let decofrutQCUploadInProgress = false;

async function loadDecofrutScoresFromSupabase() {
  const { data: status, error: statusError } = await supabaseClient
    .from("decofrut_qc_status")
    .select("active_upload_id, total_records")
    .eq("id", 1)
    .single();

  if (statusError) {
    throw new Error(statusError.message);
  }

  if (!status.active_upload_id) {
    return [];
  }

  const allRows = [];
  const batchSize = 500;

  for (let start = 0; start < status.total_records; start += batchSize) {
    const { data, error } = await supabaseClient
      .from("decofrut_qc_scores")
      .select("data")
      .eq("upload_id", status.active_upload_id)
      .order("id", { ascending: true })
      .range(start, start + batchSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    allRows.push(...data.map(record => record.data));
  }

  if (allRows.length !== status.total_records) {
    throw new Error("Incomplete Decofrut QC recovery.");
  }

  console.log("🫘 Decofrut QC recovered:", allRows.length);

  return allRows;
}

async function saveDecofrutScoresToSupabase(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Decofrut QC file is empty.");
  }

if (decofrutQCUploadInProgress) {
  throw new Error("A Decofrut QC upload is already in progress.");
}

decofrutQCUploadInProgress = true;
try {

  const allowed = await canUploadFamousInventory();

  if (!allowed) {
    throw new Error("Only QC Admin can upload Decofrut scores.");
  }

  const uploadId = crypto.randomUUID();
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(row => ({
      upload_id: uploadId,
      data: row
    }));

    const { error } = await supabaseClient
      .from("decofrut_qc_scores")
      .insert(batch);

    if (error) {
      throw new Error(`Decofrut save failed: ${error.message}`);
    }
  }

  console.log("🫘 Decofrut QC saved:", {
    uploadId,
    totalRecords: rows.length
  });

const { error: activationError } = await supabaseClient.rpc(
  "activate_decofrut_qc",
  {
    p_upload_id: uploadId,
    p_expected_records: rows.length
  }
);

if (activationError) {
  throw new Error(
    `Decofrut activation failed: ${activationError.message}`
  );
}

return uploadId;

} finally {
  decofrutQCUploadInProgress = false;
  console.log("🫘 Decofrut upload lock released");
}
}

function associateDecofrutScores(rows) {
const cleanQC = value =>
  String(value ?? "").trim().toUpperCase();

const baseLotQC = value =>
  cleanQC(value).replace(/-\d+$/, "");

const subGrowerQC = value =>
  cleanQC(value).replace(/^0+(?=\d)/, "");

const normalizePalletQC = value =>
  cleanQC(value).replace(/^[GFJ](?=\d)/, "");

const qcLookup = new Map();
const ambiguousKeys = new Set();

rows.forEach(q => {
  const key = [
    normalizePalletQC(q.Pallet),
    baseLotQC(q["Lot Number"]),
    cleanQC(q.Grower)
  ].join("|");

  if (!qcLookup.has(key)) {
    qcLookup.set(key, q);
    return;
  }

  const previous = qcLookup.get(key);

  if (
    cleanQC(previous.Container) !== cleanQC(q.Container) ||
    cleanQC(previous.QC) !== cleanQC(q.QC)
  ) {
    ambiguousKeys.add(key);
  }
});

let matchedQC = 0;
const matchedPallets = new Set();

inventoryExplorerRows.forEach(r => {
  const key = [
    normalizePalletQC(r.pallet),
    baseLotQC(r.gs1lot),
    cleanQC(r.grower)
  ].join("|");

  const qcRecord = ambiguousKeys.has(key)
    ? null
    : qcLookup.get(key);

  r.qcScore = qcRecord ? qcRecord.QC : "";
  r.qcContainer = qcRecord ? qcRecord.Container : "";
  r.qcStatus = qcRecord
    ? "Pending Container"
    : ambiguousKeys.has(key)
      ? "Ambiguous QC"
      : "";

  if (qcRecord) {
    matchedQC++;
    matchedPallets.add(key);
  }
});

console.log("🫘 QC ASSOCIATION:", {
  matchedInventoryRows: matchedQC,
  matchedPallets: matchedPallets.size,
  ambiguousGroups: ambiguousKeys.size,
  totalQCScores: rows.length
});

renderInventoryDetail();
}

async function previewDecofrutScores(file) {
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();

    const workbook = XLSX.read(buffer, {
      type: "array",
      cellDates: true
    });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: ""
    });

    window.inventoryQCScoresRows = rows;
    associateDecofrutScores(rows);

    console.log("🫘 QC SCORES LOADED:", rows.length);
    console.table(rows.slice(0, 5));

const savedUploadId = await saveDecofrutScoresToSupabase(rows);

console.log("🫘 Decofrut QC permanently saved:", {
  uploadId: savedUploadId,
  totalRecords: rows.length
});

    alert(
      `✅ QC Scores file loaded!\n\n` +
      `Records found: ${rows.length}`
    );

  } catch (error) {
    console.error("QC Scores upload error:", error);
    alert("❌ Error reading QC Scores file.");
  }
}
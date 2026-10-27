let defects = [];
let docs = { tolerances: [], specs: [], sops: [], barcodes: [] };
let commodities = [];
let qaRejections = [];

let currentSpecSection = "";
let currentSpecCommodity = "";
let currentSopSection = "";
let currentQCLibraryCommodity = "";
let currentArrivalHealthFilter = "all";
let currentArrivalView = "live";
let expandedArrivalId = null;

const $ = id => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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

  const barcodeBackBtn = $("barcodeBackBtn");

  if (barcodeBackBtn) {
    barcodeBackBtn.onclick = () => show("dashboard");
  }

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

    // 🫘 DASHBOARD — LOAD EASTERN PROPAK INVENTORY
  if (id === "dashboard") {
    loadFamousInventoryFromSupabase()
      .then(rows => {
        renderDashboardEasternInventory(rows);
      })
      .catch(error => {
        console.error("❌ Dashboard inventory load failed:", error);
      });
  }

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

    // Barcode Verification - Inspector Mode
  const headerActions = document.querySelector(".headerActions");

  if (headerActions) {
    headerActions.style.display = id === "barcode" ? "none" : "";
  }

if (id === "qa") {
  openQAModule("dashboard");
  window.scrollTo(0, 0);
}

  // Hide extra header information in Barcode Verification
  const barcodeMode = id === "barcode";
  // Hide sidebar in Barcode Verification
const sidebar = document.querySelector(".sidebar");

if (sidebar) {
  sidebar.style.display = barcodeMode ? "none" : "";
}

  ["pageSubtitle", "userRoleBadge"].forEach(elementId => {
    const element = $(elementId);

    if (element) {
      element.style.display = barcodeMode ? "none" : "";
    }
  });

if (id === "admin") {
  openAdminTab("users");
  loadAdminUsers();
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

window.openDailyArrivalReport = async function openDailyArrivalReport() {

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const todayIso = `${year}-${month}-${day}`;
  const reportDate = `${month}/${day}/${year}`;

  const { data: arrivals, error } = await supabaseClient
    .from("arrival_containers")
    .select("*")
    .eq("warehouse_eta", todayIso);

  if (error) {
    console.error("Daily report arrivals error:", error);
    alert("Unable to load today's arrivals.");
    return;
  }

  const arrivalIds = (arrivals || []).map(r => r.id);

let manifestLines = [];

if (arrivalIds.length) {
  const { data: manifestData, error: manifestError } = await supabaseClient
    .from("arrival_manifest_lines")
    .select("container_id, variety")
    .in("container_id", arrivalIds);

  if (manifestError) {
    console.error("Daily report manifest error:", manifestError);
  } else {
    manifestLines = manifestData || [];
  }
}

let notes = [];

if (arrivalIds.length) {
  const { data: notesData, error: notesError } = await supabaseClient
    .from("arrival_notes")
    .select("*")
    .in("container_id", arrivalIds)
    .order("created_at", { ascending: false });

  if (notesError) {
    console.error("Daily report notes error:", notesError);
  } else {
    notes = notesData || [];
  }
}

const warehouseGroups = {};

(arrivals || []).forEach(arrival => {
  const warehouse = String(arrival.warehouse || "").trim() || "Warehouse Not Assigned";

  if (!warehouseGroups[warehouse]) {
    warehouseGroups[warehouse] = [];
  }

  warehouseGroups[warehouse].push(arrival);
});

const getArrivalVariety = arrival => {
  const lines = manifestLines.filter(
    line => line.container_id === arrival.id
  );

  return (
    [...new Set(lines.map(line => line.variety).filter(Boolean))].join(", ") ||
    arrival.variety ||
    "-"
  );
};

const reportRows = Object.entries(warehouseGroups).map(
  ([warehouse, warehouseArrivals]) => {

    const completed = warehouseArrivals.filter(
      arrival => arrival.status === "Report Sent"
    );

    const open = warehouseArrivals.filter(
      arrival => arrival.status !== "Report Sent"
    );

    return `
      <div style="margin-top:24px;">

        <div style="
          font-size:16px;
          font-weight:700;
          padding-bottom:8px;
          border-bottom:2px solid #cbd5e1;
        ">
          📍 ${escapeHtml(warehouse)}
          · ${warehouseArrivals.length} Container${warehouseArrivals.length === 1 ? "" : "s"}
        </div>

        ${
          completed.length
            ? `
              <div style="margin-top:14px; font-weight:600;">
                ✅ Completed — Report Sent (${completed.length})
              </div>

              ${completed.map(arrival => {
                const latestNote = notes.find(
                  note => note.container_id === arrival.id
                );

                return `
                  <div style="
                    padding:10px 0;
                    border-bottom:1px solid #e5e7eb;
                  ">
                    <b>${escapeHtml(arrival.container || "-")}</b>
                    · PO ${escapeHtml(arrival.po || "-")}
                    · ${escapeHtml(arrival.grower || "-")}
                    · ${escapeHtml(arrival.commodity || "-")}
                    · ${escapeHtml(getArrivalVariety(arrival))}

                    ${
                      latestNote
                        ? `<div style="margin-top:5px;">
                            💬 ${escapeHtml(latestNote.note || "")}
                           </div>`
                        : ""
                    }
                  </div>
                `;
              }).join("")}
            `
            : ""
        }

        ${
          open.length
            ? `
              <div style="margin-top:16px; font-weight:600;">
                ⏳ Open / Follow-up (${open.length})
              </div>

              ${open.map(arrival => {
                const latestNote = notes.find(
                  note => note.container_id === arrival.id
                );

                return `
                  <div style="
                    padding:10px 0;
                    border-bottom:1px solid #e5e7eb;
                  ">
                    <b>${escapeHtml(arrival.container || "-")}</b>
                    · PO ${escapeHtml(arrival.po || "-")}
                    · ${escapeHtml(arrival.grower || "-")}
                    · ${escapeHtml(arrival.commodity || "-")}
                    · ${escapeHtml(getArrivalVariety(arrival))}

                    <div style="margin-top:5px;">
                      <b>Status:</b>
                      ${escapeHtml(arrival.status || "Pending")}
                    </div>

                    ${
                      latestNote
                        ? `<div style="margin-top:5px;">
                            💬 ${escapeHtml(latestNote.note || "")}
                           </div>`
                        : ""
                    }
                  </div>
                `;
              }).join("")}
            `
            : ""
        }

      </div>
    `;
  }
).join("");

const emailWarehouseSummary = Object.entries(warehouseGroups)
  .map(([warehouse, warehouseArrivals]) => {
    return `${warehouse} - ${warehouseArrivals.length} Container${warehouseArrivals.length === 1 ? "" : "s"}`;
  })
  .join("\n");

const reportEmailBody = Object.entries(warehouseGroups).map(
  ([warehouse, warehouseArrivals]) => {

    const completed = warehouseArrivals.filter(
      arrival => arrival.status === "Report Sent"
    );

    const open = warehouseArrivals.filter(
      arrival => arrival.status !== "Report Sent"
    );

    let text = `${warehouse} - ${warehouseArrivals.length} Container${warehouseArrivals.length === 1 ? "" : "s"}\n`;

    if (completed.length) {
      text += `\nCOMPLETED - REPORT SENT (${completed.length})\n`;

      completed.forEach(arrival => {
        text += `${arrival.container || "-"} | PO ${arrival.po || "-"} | ${arrival.grower || "-"} | ${arrival.commodity || "-"} | ${getArrivalVariety(arrival)}\n`;

        const latestNote = notes.find(
          note => note.container_id === arrival.id
        );

        if (latestNote) {
          text += `Note: ${latestNote.note}\n`;
        }
      });
    }

    if (open.length) {
      text += `\nOPEN / FOLLOW-UP (${open.length})\n`;

      open.forEach(arrival => {
        text += `${arrival.container || "-"} | PO ${arrival.po || "-"} | ${arrival.grower || "-"} | ${arrival.commodity || "-"} | ${getArrivalVariety(arrival)}\n`;
        text += `Status: ${arrival.status || "Pending"}\n`;

        const latestNote = notes.find(
          note => note.container_id === arrival.id
        );

        if (latestNote) {
          text += `Note: ${latestNote.note}\n`;
        }
      });
    }

    return text;
  }
).join("\n");

const totalCompleted = (arrivals || []).filter(
  arrival => arrival.status === "Report Sent"
).length;

const totalOpen = (arrivals || []).length - totalCompleted;

const warehouseCards = Object.entries(warehouseGroups).map(
  ([warehouse, warehouseArrivals]) => {

    const completedCount = warehouseArrivals.filter(
      arrival => arrival.status === "Report Sent"
    ).length;

    const openCount = warehouseArrivals.length - completedCount;

    return `
      <div style="
        border:1px solid #e2e8f0;
        border-radius:10px;
        padding:10px 14px;
        min-width:125px;
      ">
        <div style="
          font-size:12px;
          color:#64748b;
          font-weight:600;
        ">
          ${escapeHtml(warehouse)}
        </div>

        <div style="
          font-size:22px;
          font-weight:700;
          margin-top:2px;
        ">
          ${warehouseArrivals.length}
        </div>

        <div style="
          font-size:11px;
          color:#64748b;
          margin-top:2px;
        ">
          ${completedCount} Completed · ${openCount} Open
        </div>
      </div>
    `;
  }
).join("");

window.currentDailyReportDate = reportDate;
window.currentDailyReportWarehouseSummary = emailWarehouseSummary;
window.currentDailyReportEmailBody = reportEmailBody;

$("modalContent").innerHTML = `
  <h2>📋 QC Daily Report</h2>

  <p style="color:#64748b;">
    Warehouse ETA: ${reportDate}
    · ${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"}
  </p>

  <div style="
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:16px;
">

  <div style="
    border:1px solid #e2e8f0;
    border-radius:10px;
    padding:10px 14px;
    min-width:125px;
  ">
    <div style="
      font-size:12px;
      color:#64748b;
      font-weight:600;
    ">
      TOTAL
    </div>

    <div style="
      font-size:22px;
      font-weight:700;
      margin-top:2px;
    ">
      ${arrivals.length}
    </div>

    <div style="
      font-size:11px;
      color:#64748b;
      margin-top:2px;
    ">
      ${totalCompleted} Completed · ${totalOpen} Open
    </div>
  </div>

  ${warehouseCards}

</div>

  <div style="margin-top:20px;">
    ${
      reportRows ||
      `<p style="color:#64748b;">
        No arrivals scheduled for today.
      </p>`
    }
  </div>
  <div style="margin-top:24px; text-align:right;">
  <button
    type="button"
    class="primaryBtn"
    onclick="createDailyReportEmail()">
    ✉️ Create Email
  </button>
</div>
`;

$("modal").showModal();
};

window.createDailyReportEmail = function createDailyReportEmail() {

  const subject = `QC Daily Report - ${window.currentDailyReportDate}`;

const body = `Hi Team,

Please see below today's QC inbound summary.

TODAY'S ARRIVALS
${window.currentDailyReportWarehouseSummary}

${window.currentDailyReportEmailBody}

Best regards,`;

  const mailto =
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  window.location.href = mailto;
};

window.openArrivalNotes = async function openArrivalNotes(containerId) {

  const { data: arrival, error: arrivalError } = await supabaseClient
    .from("arrival_containers")
    .select("id, container, po")
    .eq("id", containerId)
    .single();

  if (arrivalError) {
    console.error("Arrival lookup error:", arrivalError);
    alert("Unable to load arrival information.");
    return;
  }

  const { data: notes, error: notesError } = await supabaseClient
    .from("arrival_notes")
    .select("*")
    .eq("container_id", containerId)
    .order("created_at", { ascending: false });

  if (notesError) {
    console.error("Arrival notes error:", notesError);
    alert("Unable to load arrival notes.");
    return;
  }

  $("modalContent").innerHTML = `
    <h2>💬 Arrival Notes</h2>

    <p>
      <b>Container:</b> ${escapeHtml(arrival.container || "-")}
      <br>
      <b>PO:</b> ${escapeHtml(arrival.po || "-")}
    </p>

    <div style="margin-top:20px;">
      <textarea
        id="arrivalNoteText"
        rows="4"
        placeholder="Write an operational note..."
        style="width:100%; resize:vertical;"
      ></textarea>

      <button
        class="primaryBtn"
        style="margin-top:10px;"
        onclick="saveArrivalNote('${containerId}')">
        Save Note
      </button>
    </div>

    <div style="margin-top:24px;">
      <h3>Note History</h3>

      ${
        notes?.length
          ? notes.map(note => `
              <div style="
                padding:12px 0;
                border-bottom:1px solid #e5e7eb;
              ">
                <div style="font-size:13px; color:#64748b;">
                  ${new Date(note.created_at).toLocaleString()}
                  · ${escapeHtml(note.created_by || "Unknown user")}
                </div>

                <div style="margin-top:5px;">
                  ${escapeHtml(note.note)}
                </div>
              </div>
            `).join("")
          : `<p style="color:#64748b;">No arrival notes yet.</p>`
      }
    </div>
  `;

  $("modal").showModal();
};

window.saveArrivalNote = async function saveArrivalNote(containerId) {

  const input = $("arrivalNoteText");
  const noteText = String(input?.value || "").trim();

  if (!noteText) {
    alert("Please enter a note.");
    return;
  }

  const {
    data: { user },
    error: userError
  } = await supabaseClient.auth.getUser();

  if (userError) {
    console.error("Unable to read authenticated user:", userError);
  }

  const createdBy = user?.email || "Unknown user";

  const { error } = await supabaseClient
    .from("arrival_notes")
    .insert({
      container_id: containerId,
      note: noteText,
      created_by: createdBy
    });

  if (error) {
    console.error("Arrival note save error:", error);
    alert("Unable to save arrival note.");
    return;
  }

  await openArrivalNotes(containerId);
};

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
      <div class="barcodeProductCard">

        <div class="barcodeProductHeader">
          <span class="barcodeStatus">✓ Match Found</span>
        </div>

        <h4>🍇 Product Information</h4>

<div class="barcodeProductGrid">
  ${[
    ["Commodity", r.commodity],
    ["Variety", r.variety],
    ["Label", r.label],
    ["Program", r.program],
    ["Pack Style", r.pack_style],
    ["COO", r.coo]
  ].map(([label]) => `
    <div class="barcodeField">
      <span class="barcodeFieldLabel">${label}</span>
      <span class="barcodeFieldValue"></span>
    </div>
  `).join("")}
</div>

<h4>🔎 Barcode Information</h4>

<div class="barcodeProductGrid">
  ${[
    ["UPC", r.upc],
    ["GTIN", r.gtin]
  ].map(([label]) => `
    <div class="barcodeField">
      <span class="barcodeFieldLabel">${label}</span>
      <span class="barcodeFieldValue"></span>
    </div>
  `).join("")}
</div>

<details class="barcodeAdditionalDetails">
  <summary>＋ Additional Details</summary>

  <div class="barcodeProductGrid">
    ${[
      ["PLU", r.plu],
      ["Traceability", r.traceability_sticker],
      ["SSN East", r.ssn_east],
      ["SSN West", r.ssn_west],
      ["Item Number", r.item_number]
    ].map(([label]) => `
      <div class="barcodeField">
        <span class="barcodeFieldLabel">${label}</span>
        <span class="barcodeFieldValue"></span>
      </div>
    `).join("")}
  </div>
</details>
      </div>
    `
    : `
      <div class="barcodeProductCard">
        <h3>No Match Found</h3>
        <p>This UPC / GTIN does not exist in the Label Database.</p>
      </div>
    `;

  if (r) {
    const values = [
  // Product Information
  r.commodity,
  r.variety,
  r.label,
  r.program,
  r.pack_style,
  r.coo,

  // Barcode Information
  r.upc,
  r.gtin,

  // Additional Details
  r.plu,
  r.traceability_sticker,
  r.ssn_east,
  r.ssn_west,
  r.item_number
];

    document.querySelectorAll(
      "#barcodeResult .barcodeFieldValue"
    ).forEach((element, index) => {
      element.textContent = values[index] || "-";
    });
  }
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
              <td>${lotSummary}</td>
              <td>${r.customer || "-"}</td>
              <td>${commoditySummary}</td>
              <td>${varietySummary}</td>
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

function extractOriginFromProductName(value) {
  const text = String(value || "").trim();

  const knownOrigins = [
    "South Africa",
    "United States",
    "New Zealand",
    "Chile",
    "Peru",
    "Brazil",
    "Mexico",
    "Uruguay",
    "Spain",
    "Morocco",
    "Argentina",
    "Australia",
    "Italy",
    "Greece"
  ];

  return knownOrigins.find(origin =>
    text.toLowerCase().endsWith(origin.toLowerCase())
  ) || "";
}

async function importManifestExcel() {
    if (currentUserRole === "QC Lead") {
    alert("You do not have permission to import manifests.");
    return;
  }
  const file = $("manifestFile")?.files[0];

  if (!file) {
    alert("Please select a manifest file.");
    return;
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: ""
});

console.log("NEW Manifest Rows:", rows);
console.log("NEW Manifest Headers:", Object.keys(rows[0] || {}));
console.log("NEW First Manifest Row:", rows[0]);

 console.log("Manifest file:", file.name);

const firstRow = rows[0] || {};

const po = String(firstRow.lotid || "").trim();
const grower = String(firstRow.growerid || "").trim();
const container = String(firstRow.poolid || "").trim();

const receiveDate = formatExcelDate(firstRow.receivedate || "");
const eta = receiveDate;

const vessel = "";

function extractOriginFromProductName(value) {
  const text = String(value || "").trim();

  const knownOrigins = [
    "Chile",
    "Peru",
    "Uruguay",
    "Brazil",
    "South Africa",
    "Mexico",
    "United States",
    "Argentina",
    "Spain",
    "Italy",
    "Egypt",
    "Morocco",
    "India"
  ];

  return knownOrigins.find(origin =>
    text.toLowerCase().endsWith(origin.toLowerCase())
  ) || "";
}

const records = rows
  .filter(row =>
    row.tagid &&
    String(row.tagid).trim() !== ""
  )
  .map(row => ({
    eta,
    po,
    grower,
    container,
    vessel,

    pallet_number: String(row.tagid || "").trim(),

    lot: String(row.entryno || "").trim(),

    commodity: String(row.commodity || "").trim(),
    variety: String(row.variety || "").trim(),

    pack_style:
      String(
        row.styleiddescription ||
        row.styleid ||
        ""
      ).trim(),

    size: String(row.packid || "").trim(),

    label: String(row.label || "").trim(),

    boxes: Number(row.recvqnt || 0),

    subgrower: String(row.subgrower || "").trim(),

    pack_date: formatExcelDate(row.packdate || ""),

    receive_date: formatExcelDate(row.receivedate || ""),

    warehouse_name: String(row.warehousename || "").trim(),

    product_name: String(row.productname || "").trim(),

    origin: extractOriginFromProductName(row.productname),

    condition: String(row.condition || "").trim(),

    lot_source: "famous",

    recorder_code: "",
    temp_rec_loc: "",

    ptf_code: ""
  }));

console.log("Records:", records);
console.log("Total Records:", records.length);
console.table(records.slice(0, 10));
console.table(records.slice(0, 10).map(r => ({
  pallet: r.pallet_number,
  lot: r.lot
})));

const validation = {
  totalRows: rows.length,
  totalRecords: records.length,
  po,
  container,
  grower,
  eta,
  commodities: [...new Set(records.map(r => r.commodity).filter(Boolean))],
  varieties: [...new Set(records.map(r => r.variety).filter(Boolean))],
  pallets: [...new Set(records.map(r => r.pallet_number).filter(Boolean))].length,
  totalCases: records.reduce((sum, r) => sum + (Number(r.boxes) || 0), 0)
};

console.log("MANIFEST VALIDATION:", validation);

if (!po || !container || !records.length) {
  console.error("Manifest validation failed:", validation);
  alert("Manifest validation failed. Check console.");
  return;
}

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
  const palletNumbers = [...new Set(
  data.records
    .map(r => String(r.pallet_number || "").trim())
    .filter(Boolean)
)];

  let containerRow = null;

const { data: existingContainer, error: findContainerError } =
  await supabaseClient
    .from("arrival_containers")
    .select("*")
    .eq("container", data.container)
.in("po", [
  String(data.po || "").trim(),
  `${String(data.po || "").trim()}-${String(data.container || "").trim().slice(-4)}`
])
.maybeSingle();

if (findContainerError) {
  console.error("Container Lookup Error:", findContainerError);
  alert("Container lookup error: " + findContainerError.message);
  return false;
}

if (existingContainer) {

  const { data: updatedContainer, error: updateContainerError } =
    await supabaseClient
      .from("arrival_containers")
      .update({
        arrival_key: `${String(data.po || "").trim()}-${String(data.container || "").trim().toUpperCase()}`,
        po: data.po,
        lot: [...new Set(data.records.map(r => r.lot).filter(Boolean))].join(", "),
        grower: data.grower,
        origin: data.records.find(r => r.origin)?.origin || "",
        commodity: [...new Set(
          data.records.map(r => r.commodity).filter(Boolean)
        )].join(", "),
        manifest_name: fileName,
        last_manifest_import: new Date().toISOString()
      })
      .eq("id", existingContainer.id)
      .select()
      .single();

  if (updateContainerError) {
    console.error("Container Update Error:", updateContainerError);
    alert("Container update error: " + updateContainerError.message);
    return false;
  }

  containerRow = updatedContainer;

} else {

  const { data: newContainer, error: insertContainerError } =
    await supabaseClient
      .from("arrival_containers")
      .insert({
        arrival_key: `${String(data.po || "").trim()}-${String(data.container || "").trim().toUpperCase()}`,
        eta: data.eta,
        po: data.po,
        lot: [...new Set(data.records.map(r => r.lot).filter(Boolean))].join(", "),
        grower: data.grower,
        vessel: data.vessel,
        container: data.container,
        commodity: [...new Set(
          data.records.map(r => r.commodity).filter(Boolean)
        )].join(", "),
        recorder_status: "Unknown",
        manifest_name: fileName,
        status: "Pending",
        last_manifest_import: new Date().toISOString(),
        origin: data.records.find(r => r.origin)?.origin || "",
        priority: "",
        active: true,
        notes: ""
      })
      .select()
      .single();

  if (insertContainerError) {
    console.error("Container Insert Error:", insertContainerError);
    alert("Container save error: " + insertContainerError.message);
    return false;
  }

  containerRow = newContainer;
}

const { data: existingPallets, error: checkError } =
  await supabaseClient
    .from("arrival_manifest_lines")
    .select("container_id, pallet_number")
    .eq("container_id", containerRow.id)
    .in("pallet_number", palletNumbers);

if (checkError) {
  console.error("Pallet Lookup Error:", checkError);
  alert("Error checking existing pallets: " + checkError.message);
  return false;
}

 const existingForThisContainer = new Set(
  (existingPallets || [])
    .map(p => String(p.pallet_number || "").trim())
);

const newLines = [];
const updateLines = [];

data.records.forEach(r => {

  const palletNumber = String(r.pallet_number || "").trim();

  const lineData = {
    container_id: containerRow.id,
    po: data.po,
    pallet_number: palletNumber,

    lot: String(r.lot || "").trim(),

    grower: data.grower,
    commodity: r.commodity,
    variety: r.variety,
    size: r.size,
    pack_style: r.pack_style,
    boxes: Number(r.boxes || 0),
    subgrower: r.subgrower,
    pack_date: formatExcelDate(r.pack_date),

    label: r.label || "",
    ptf_code: r.ptf_code || "",

    recorder_code: r.recorder_code || "",
    temp_rec_loc: r.temp_rec_loc || "",

    vessel: data.vessel,

    receive_date: r.receive_date || "",
    warehouse_name: r.warehouse_name || "",
    product_name: r.product_name || "",
    origin: r.origin || "",
    condition: r.condition || ""
  };

  if (existingForThisContainer.has(palletNumber)) {
    updateLines.push(lineData);
  } else {
    
    newLines.push({
      ...lineData,
      lot_source: "famous"
    });
  }
});

for (const line of updateLines) {

  const { error: updateError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .update({
        po: line.po,
        ...(line.lot ? {
        lot: line.lot,
        lot_source: "famous"
        } : {}),
        grower: line.grower,
        commodity: line.commodity,
        variety: line.variety,
        size: line.size,
        pack_style: line.pack_style,
        boxes: line.boxes,
        subgrower: line.subgrower,
        pack_date: line.pack_date,
        label: line.label,
        ptf_code: line.ptf_code,
        recorder_code: line.recorder_code,
        temp_rec_loc: line.temp_rec_loc,
        vessel: line.vessel,
        receive_date: line.receive_date,
        warehouse_name: line.warehouse_name,
        product_name: line.product_name,
        origin: line.origin,
        condition: line.condition
      })
      .eq("container_id", containerRow.id)
      .eq("pallet_number", line.pallet_number);

  if (updateError) {
    console.error(
      "Manifest pallet update error:",
      line.pallet_number,
      updateError
    );

    alert(
      `Error updating pallet ${line.pallet_number}: ` +
      updateError.message
    );

    return false;
  }
}

if (newLines.length) {

  const { error: insertLinesError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .insert(newLines);

  if (insertLinesError) {
    console.error("Manifest Lines Insert Error:", insertLinesError);

    alert(
      "Manifest lines save error: " +
      insertLinesError.message
    );

    return false;
  }
}

 console.log("Manifest saved:", {
  container: containerRow.container,
  totalLines: data.records.length,
  newPallets: newLines.length,
  updatedPallets: updateLines.length
});

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
        <option>✅ Inspection Finished</option>
        <option>📧 Report Sent</option>
        <option>🚫 Cancelled / Diverted</option>
      </select>
    </td>
    <td>
      <select>
        <option value="">Priority</option>
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

  const requiredPermission = {
    "arrivals": "arrivals.view",
    "arrivals-history": "arrivals_history.view"
  };

 if (currentUserRole === "QC Lead") {
  const permission = requiredPermission[module];

  if (!permission || !hasPermission(permission)) {
    console.warn("Access denied to inbound module:", module);
    return;
  }
}

  const home = $("inboundHomeGrid");
  const content = $("inboundModuleContent");

  if (!home || !content) return;

  home.style.display = "none";

  if (module === "arrivals" || module === "arrivals-history") {

  const isHistory = module === "arrivals-history";

  currentArrivalView = isHistory ? "historical" : "live";
    content.innerHTML = `
      <section class="qaPanel">
        <button class="secondaryBtn" onclick="backToInboundHome()">
          ← Back
        </button>

        <div class="qaPanelHeader" style="margin-top:18px;">
          <div>
            <h2>${isHistory ? "🗂️ Arrivals History" : "🚢 Arrivals"}</h2>

          <p>
          ${isHistory
          ? "Review historical arrivals, manifests, and arrival records."
          : "Manage current arrivals, manifests, and operational priorities."
          }
          </p>
          </div>
          </div>

       ${!isHistory ? `

        <div class="qaToolbar">

        <div style="${currentUserRole === 'QC Lead' ? 'display:none;' : 'display:contents;'}">
  <div class="arrivalImportBox">
    <label for="arrivalImportMode">Import Type</label>

    <select id="arrivalImportMode">
      <option value="live">Daily Import</option>
      <option value="historical">Historical Import</option>
    </select>
  </div>

  <label class="primaryBtn" style="display:inline-block;">
    Upload Arrivals
    <input
      type="file"
      id="arrivalImportFile"
      accept=".xlsx"
      style="display:none;"
      onchange="importArrivalsExcel()"
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
  <button
  type="button"
  class="secondaryBtn"
  style="margin-left:auto;"
  onclick="openDailyArrivalReport()">
  📋 QC Daily Report
</button>

</div>

<div id="arrivalHealthSummary"
     class="qaKpiGrid"
     style="margin-bottom:18px;">
</div>
` : ""}

<div class="arrivalToolbar">

  <input
    id="arrivalSearch"
    class="arrivalSearch"
    placeholder="🔍 Search container, PO, lot, grower, commodity..."
  >

</div>
<div class="qaTableWrap">
          <table class="qaTable">
            <thead>
              <tr>
              <th style="width:40px;"></th>
<th>JK ETA</th>
<th>WH</th>
<th>Warehouse ETA</th>
<th>Door</th>
<th>Ref</th>
<th>PO</th>
<th>Lot</th>
<th>Grower</th>
<th>Commodity</th>
<th>Variety</th>
<th>Origin</th>
${isHistory
  ? `<th>Arrival Notes</th>`
  : `<th>Status</th><th>Priority</th>`
} 
              </tr>
            </thead>

            <tbody id="inboundTableBody">
  <tr>
    <td colspan="11">Ready to import inbound records.</td>
  </tr>
</tbody>
          </table>
        </div>
      </section>
    `;
    
    loadInboundArrivals();

$("arrivalSearch")?.addEventListener("input", () => {
  console.log("Typing search:", $("arrivalSearch").value);
  loadInboundArrivals();
});

return;
  }
  if (module === "inspections") {
    content.innerHTML = `
      <section class="qaPanel">
        <button class="secondaryBtn" onclick="backToInboundHome()">
          ← Back
        </button>

        <div class="qaPanelHeader" style="margin-top:18px;">
          <div>
            <h2>Inspections</h2>
            <p>Inbound QC inspection data and analysis.</p>
          </div>
        </div>
        <div class="qaToolbar">
  <label class="primaryBtn" style="display:inline-block;">
    📥 Upload Inspection Data
    <input
      type="file"
      id="inspectionImportFile"
      accept=".xlsx,.xls"
      style="display:none;"
      onchange="previewInspectionImport()"
    />
  </label>
</div>
      </section>
    `;

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

window.previewInspectionImport = async function previewInspectionImport() {

  // Use the updated Decofrut inspection importer
  const previewFile = $("inspectionImportFile")?.files[0];

  if (!previewFile) {
    alert("Please select an inspection file.");
    return;
  }

  const rows = await window.buildInspectionDryRun(previewFile, "auto");
  const groups = window.groupInspectionDryRunBySheet(rows);

  console.log("🫘 DECOFRUT IMPORT PREVIEW:", groups);
console.log(
  "🛡️ SAVE FUNCTION AVAILABLE:",
  typeof window.saveSingleInspectionGroup
);

// DECOFRUT — FULL IMPORT
if (!groups.length) {
  alert("No valid inspections were found in this file.");
  return;
}

const totalSamples = groups.reduce(
  (total, group) => total + group.records.length,
  0
);

const confirmImport = confirm(
  `DECOFRUT IMPORT\n\n` +
  `Inspections: ${groups.length}\n` +
  `Samples: ${totalSamples}\n\n` +
  `This will save REAL data to Supabase.\n` +
  `Existing inspections will be skipped.\n\n` +
  `Do you want to continue?`
);

if (!confirmImport) return;

let inserted = 0;
let skipped = 0;
let failed = 0;
let samplesInserted = 0;

const failedInspections = [];

for (const group of groups) {
  try {
    const result = await window.saveSingleInspectionGroup(group);

    if (result.status === "inserted") {
      inserted++;
      samplesInserted += result.samplesInserted || 0;
    } else if (result.status === "skipped") {
      skipped++;
    }

    console.log(
      `🫘 Inspection ${group.sourceSheetId}: ${result.status}`
    );

  } catch (error) {
    failed++;
    failedInspections.push(group.sourceSheetId);

    console.error(
      `❌ Inspection ${group.sourceSheetId} failed:`,
      error
    );
  }
}

console.log("📊 DECOFRUT IMPORT SUMMARY:", {
  inserted,
  skipped,
  failed,
  samplesInserted,
  failedInspections
});

alert(
  `DECOFRUT IMPORT COMPLETE\n\n` +
  `New inspections: ${inserted}\n` +
  `Already existing: ${skipped}\n` +
  `Failed: ${failed}\n` +
  `New samples saved: ${samplesInserted}\n\n` +
  (failed
    ? `Failed IdSheets: ${failedInspections.join(", ")}\nCheck Console for details.`
    : `Import completed without reported errors.`)
);

return;

};

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
    po: text.split("-")[0].trim(),
    lot: ""
  };
}

window.importArrivalsExcel = async function importArrivalsExcel() {

  if (currentUserRole === "QC Lead") {
    alert("You do not have permission to import arrivals.");
    return;
  }

  const file = $("arrivalImportFile")?.files[0];
  const importMode = $("arrivalImportMode").value;

  if (!file) {
    alert("Please select an arrivals file.");
    return;
  };

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
  defval: "",
  range: 1
});

console.log("Arrival Rows:", rows);
console.log("First Arrival Row:", rows[0]);
console.log("Arrival Headers:", Object.keys(rows[0] || {}));

const records = rows
  .filter(row =>
    row["Container"] &&
    String(row["Container"]).trim() !== "" &&
    String(row["Port/Terminal"] || "").trim() !== "-->"
  )
  .map(row => {
    const poLot = splitPoLot(row["Vessel #"]);

    return {
      arrival_key: `${String(poLot.po || "").trim()}-${String(row["Container"] || "").trim().toUpperCase()}`,
      vessel: row["Vessel"] || "",
      po: poLot.po,
      lot: poLot.lot,
      container: String(row["Container"] || "").trim().toUpperCase(),
      eta: formatExcelDate(row["ETA"]),
      recorder_status: row["Status"] || "Pending",
      source_status: String(row["Status"] || "").trim(),
      commodity: row["Commodity"] || "",
      origin: normalizeOrigin(row["Origin"] || ""),
      treatment: String(row["Treatment"] || "").trim(),
      grower: "",
      jk_source_file: file.name,
      data_type: importMode,
      active: importMode === "live",
      status:
        importMode === "live"
        ? "Expected"
        : "Historical"
    };
  });

console.log("Arrival Records:", records);

const uniqueRecords = Array.from(
  new Map(records.map(r => [r.arrival_key, r])).values()
);

console.log("Unique Arrival Records:", uniqueRecords);

  const containerNumbers = [...new Set(
  uniqueRecords
    .map(r => String(r.container || "").trim().toUpperCase())
    .filter(Boolean)
)];

const { data: existingArrivals, error: existingError } =
  await supabaseClient
    .from("arrival_containers")
    .select("id, arrival_key, container, po, lot, status, active, data_type, eta, commodity, origin, manifest_name, last_manifest_import")
    .in("container", containerNumbers);

if (existingError) {
  console.error("Existing arrivals lookup error:", existingError);
  alert("Unable to check existing arrivals.");
  return;
}

console.table(
  (existingArrivals || []).map(r => ({
    po: r.po,
    lot: r.lot,
    container: r.container,
    status: r.status,
    active: r.active,
    data_type: r.data_type
  }))
);

const makePoContainerKey = (po, container) =>
  `${String(po || "").trim().split("-")[0]}-${String(container || "").trim().toUpperCase()}`;

const existingKeys = new Set(
  (existingArrivals || []).map(r =>
    makePoContainerKey(r.po, r.container)
  )
);

const isPendingPo = po =>
  !String(po || "").trim() ||
  ["TBD", "N/A", "PENDING", "--"].includes(
    String(po || "").trim().toUpperCase()
  );
const sameContainer = (a, b) =>
  String(a || "").trim().toUpperCase() ===
  String(b || "").trim().toUpperCase();

const findArrivalMatches = record =>
  (existingArrivals || []).filter(existing =>
    sameContainer(existing.container, record.container) &&
    makePoContainerKey(existing.po, existing.container) ===
      makePoContainerKey(record.po, record.container)
  );

const newArrivals = uniqueRecords.filter(record => {
  const matches = findArrivalMatches(record);
  if (matches.some(existing =>
  existing.status === "Report Sent" ||
  existing.status === "Cancelled / Diverted" ||
  existing.active === false
)) {
  return false;
}
if (isPendingPo(record.po)) {
  console.warn(
    "JK Fresh arrival without PO — manual review required:",
    record.container
  );
  return false;
}
if (matches.length > 1) {
  console.warn(
    "Multiple arrival matches — review required:",
    record.container,
    matches
  );
  return false;
}

return matches.length === 0;
});

const updateArrivals = uniqueRecords.filter(record => {

  if (isPendingPo(record.po)) return false;

  const matches = findArrivalMatches(record);

  return matches.length === 1 &&
    matches[0].active === true &&
    matches[0].data_type === "live" &&
    !["Report Sent", "Cancelled / Diverted"].includes(matches[0].status);

});

// INSERT nuevos arrivals
if (newArrivals.length) {
  const { error: insertError } =
    await supabaseClient
      .from("arrival_containers")
      .insert(newArrivals);

  if (insertError) {
    console.error("Arrival insert error:", insertError);
    alert("Arrival import error: " + insertError.message);
    return;
  }
}

// UPDATE arrivals existentes sin pisar datos operativos QC
for (const record of updateArrivals) {
const existingRecord = findArrivalMatches(record)[0];
if (!existingRecord) {
  console.warn("Existing arrival not found:", record);
  continue;
}

if (
  existingRecord.status === "Report Sent" ||
  existingRecord.status === "Cancelled / Diverted" ||
  existingRecord.active === false
) {
  console.log("Skipping closed arrival:", record.container);
  continue;
}

  const { error: updateError } =
    await supabaseClient
      .from("arrival_containers")
      .update({
        vessel: record.vessel,
        container: record.container,
        eta:
  record.eta &&
  record.eta.trim().toUpperCase() !== "TBD"
    ? record.eta
    : existingRecord.eta || record.eta,

        recorder_status: record.recorder_status,
        source_status: record.source_status,
        treatment: record.treatment,

        commodity: (existingRecord.manifest_name || existingRecord.last_manifest_import)
  ? existingRecord.commodity
  : record.commodity,
        origin: (existingRecord.manifest_name || existingRecord.last_manifest_import)
  ? existingRecord.origin
  : record.origin,
        jk_source_file: record.jk_source_file,
      })
      .eq("id", existingRecord.id);

  if (updateError) {
    console.error(
      "Arrival update error:",
      record.arrival_key,
      updateError
    );

    alert(
      `Unable to update arrival ${record.container}: ` +
      updateError.message
    );

    return;
  }
}

alert(
  `JK Fresh import completed.\n` +
  `New arrivals: ${newArrivals.length}\n` +
  `Existing arrivals updated: ${updateArrivals.length}\n` +
  `Skipped: ${uniqueRecords.length - newArrivals.length - updateArrivals.length}`
);
  
currentArrivalView =
  importMode === "historical"
    ? "historical"
    : "live";

openInboundModule("arrivals");
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

  // Warehouse ETA format: YYYY-MM-DD
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);

    return new Date(year, month, day);
  }

  // JK ETA format: D-Mmm-YY
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

function isArrivalAttention(record) {
  const treatmentAlert = getArrivalTreatmentAlert(record);

  // Critical treatment/release issue
  if (treatmentAlert?.level === "critical") {
    return true;
  }

  // Use Warehouse ETA first, JK ETA as fallback
  const etaHealth = getEtaHealth(
    record.warehouse_eta || record.eta
  );

  // Past ETA and still in Live Arrivals
  return etaHealth === "delayed";
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

  // TODAY: count all containers scheduled by Warehouse ETA
  if (
    r.warehouse_eta &&
    getEtaHealth(r.warehouse_eta) === "today"
  ) {
    counts.today++;
  }

  // Keep Need Attention logic unchanged
  if (isArrivalAttention(r)) {
    counts.delayed++;
    return;
  }

  const health = getEtaHealth(r.warehouse_eta || r.eta);

  if (
    health === "tomorrow" ||
    health === "upcoming"
  ) {
    counts[health]++;
  }
});

  box.innerHTML = `
    <article class="arrivalHealthCard attention ${currentArrivalHealthFilter === "delayed" ? "active" : ""}"
      onclick="setArrivalHealthFilter('delayed')">
      <div>
        <b>${counts.delayed}</b>
        <span>Need Attention</span>
      </div>
    </article>

    <article class="arrivalHealthCard today ${currentArrivalHealthFilter === "today" ? "active" : ""}"
      onclick="setArrivalHealthFilter('today')">
      <div>
        <b>${counts.today}</b>
        <span>Today</span>
      </div>
    </article>

    <article class="arrivalHealthCard tomorrow ${currentArrivalHealthFilter === "tomorrow" ? "active" : ""}"
      onclick="setArrivalHealthFilter('tomorrow')">
      <div>
        <b>${counts.tomorrow}</b>
        <span>Tomorrow</span>
      </div>
    </article>

    <article class="arrivalHealthCard upcoming ${currentArrivalHealthFilter === "upcoming" ? "active" : ""}"
      onclick="setArrivalHealthFilter('upcoming')">
      <div>
        <b>${counts.upcoming}</b>
        <span>Upcoming</span>
      </div>
    </article>
  `;
}

window.setArrivalHealthFilter = function setArrivalHealthFilter(filter) {
  currentArrivalHealthFilter =
    currentArrivalHealthFilter === filter ? "all" : filter;

  loadInboundArrivals();
};

function getArrivalTreatmentAlert(container) {
  const treatment = String(container?.treatment || "")
    .trim()
    .toUpperCase();

  const sourceStatus = String(container?.source_status || "")
    .trim();

  const sourceStatusUpper = sourceStatus.toUpperCase();

  // 🟡 CT NOT YET PASSED — AWAITING FINAL RESULT
if (
  sourceStatusUpper.includes("HAS NOT PASSED COLD TREATMENT") ||
  sourceStatusUpper.includes("NOT PASSED COLD TREATMENT")
) {
  return {
    level: "warning",
    label: "🟡 CT Pending",
    detail: sourceStatus
  };
}

// 🔴 CONFIRMED COLD TREATMENT FAILURE
if (
  sourceStatusUpper.includes("CT FAILED") ||
  sourceStatusUpper.includes("FAILED COLD TREATMENT") ||
  (
    sourceStatusUpper.includes("FAILED") &&
    sourceStatusUpper.includes("COLD TREATMENT")
  )
) {
    return {
      level: "critical",
      label: "🔴 CT Failed",
      detail: sourceStatus
    };
  }

  if (
    sourceStatusUpper.includes("PASSED COLD TREATMENT")
  ) {
    return {
      level: "success",
      label: "🟢 CT Passed",
      detail: sourceStatus
    };
  }

  if (
    treatment.includes("CTIT") ||
    treatment.includes("COLD TREATMENT")
  ) {
    return {
      level: "cold-treatment",
      label: "❄️ CT",
      detail: sourceStatus
    };
  }

  if (
    sourceStatusUpper.includes("USDA") &&
    sourceStatusUpper.includes("PENDING")
  ) {
    return {
      level: "warning",
      label: "🟡 USDA Pending",
      detail: sourceStatus
    };
  }

  if (
    sourceStatusUpper.includes("PENDING")
  ) {
    return {
      level: "warning",
      label: "🟡 Release Pending",
      detail: sourceStatus
    };
  }

  if (treatment) {
    return {
      level: "info",
      label: `${container.treatment}`,
      detail: sourceStatus
    };
  }

  return null;
}

function getArrivalReleaseDetails(container) {
  const treatment = String(container?.treatment || "").trim();
  const sourceStatus = String(container?.source_status || "").trim();
  const upper = sourceStatus.toUpperCase();

  const items = [];

  if (treatment) {
    items.push({
      type: "treatment",
      label: `Treatment: ${treatment}`
    });
  }

  // 🟡 COLD TREATMENT — AWAITING FINAL RESULT
if (
  upper.includes("HAS NOT PASSED COLD TREATMENT") ||
  upper.includes("NOT PASSED COLD TREATMENT")
) {
  items.push({
    type: "warning",
    label: "Cold Treatment: Pending"
  });

// 🔴 CONFIRMED COLD TREATMENT FAILURE
} else if (
  upper.includes("CT FAILED") ||
  upper.includes("FAILED COLD TREATMENT")
) {
  items.push({
    type: "critical",
    label: "Cold Treatment: Failed"
  });

// 🟢 COLD TREATMENT PASSED
} else if (upper.includes("PASSED COLD TREATMENT")) {
  items.push({
    type: "success",
    label: "Cold Treatment: Passed"
  });
}

  if (upper.includes("PENDING INSPECTION")) {
    items.push({
      type: "warning",
      label: "Inspection: Pending"
    });
  }

  if (upper.includes("USDA") && upper.includes("PENDING")) {
    items.push({
      type: "warning",
      label: "USDA: Pending"
    });
  }

  return {
    items,
    sourceStatus
  };
}

function getQcGradeColorClass(grade) {
  const value = String(grade || "")
    .trim()
    .toUpperCase();

  if (value === "A1") {
    return "qcGradeBlue";
  }

  if (["A2", "B2"].includes(value)) {
    return "qcGradeGreen";
  }

  if (["A3", "B3", "C2", "C3"].includes(value)) {
    return "qcGradeYellow";
  }

  if (["A4", "B4", "C4"].includes(value)) {
    return "qcGradeRed";
  }

  return "qcGradeNeutral";
}

function renderArrivalDetails(
  lines,
  container,
  inspectionSamples = []
) {
   const isHistoricalView =
  currentArrivalView === "historical";
 
   const treatmentAlert = getArrivalTreatmentAlert(container);
   const releaseDetails = getArrivalReleaseDetails(container);

  if (!lines.length) {
    return `
      <tr class="arrivalDetailRow">
        <td colspan="11">
          <div class="arrivalDetailBox">
            <h3>📦 Container Composition</h3>
            ${releaseDetails.items.length || releaseDetails.sourceStatus ? `
    <div class="arrivalReleaseBox">
    <strong>Treatment & Release</strong>
    <div class="arrivalReleaseItems">
      ${releaseDetails.items.map(item => `
        <span class="arrivalReleaseBadge ${item.type}">
          ${
            item.type === "critical" ? "🔴" :
            item.type === "success" ? "🟢" :
            item.type === "warning" ? "🟡" :
            "❄️"
          }
          ${item.label}
        </span>
      `).join("")}
    </div>

    ${releaseDetails.sourceStatus ? `
    <div class="arrivalReleaseSource">
        JK Fresh Status: ${releaseDetails.sourceStatus}
    </div>
    ` : ""}
    </div>
` : ""}

<p>No manifest details found for this container.</p>
          </div>
        </td>
      </tr>
    `;
  }

  const uniqueLots = [...new Set(lines.map(x => x.lot).filter(Boolean))];
  const uniqueSubgrowers = [...new Set(lines.map(x => x.subgrower).filter(Boolean))];
  const uniquePackDates = [...new Set(lines.map(x => x.pack_date).filter(Boolean))];

const totalBoxes = lines.reduce(
  (sum, x) => sum + (Number(x.boxes) || 0),
  0
);

const tempRecorderCount = lines.filter(
  x => String(x.condition || "").trim().toLowerCase() === "temp recorder"
).length;

const manifestPalletNumbers = new Set(
  (lines || [])
    .map(line => String(line.pallet_number || "").trim())
    .filter(Boolean)
);

const inspectedPalletNumbers = new Set(
  (inspectionSamples || [])
    .filter(sample =>
      String(
        sample.qc_inspections?.inspection_type || ""
      ).toLowerCase() === "inbound"
    )
    .map(sample =>
      String(sample.pallet_number || "").trim()
    )
    .filter(pallet =>
      pallet && manifestPalletNumbers.has(pallet)
    )
);

const manifestPalletCount = manifestPalletNumbers.size;
const inspectedPalletCount = inspectedPalletNumbers.size;

const notSampledPalletCount = Math.max(
  manifestPalletCount - inspectedPalletCount,
  0
);

const inspectionCoverage = manifestPalletCount
  ? Math.round(
      (inspectedPalletCount / manifestPalletCount) * 100
    )
  : 0;

const inspectionByPallet = {};

(inspectionSamples || [])
  .filter(sample =>
    String(
      sample.qc_inspections?.inspection_type || ""
    ).toLowerCase() === "inbound"
  )
  .forEach(sample => {
    const palletNumber =
      String(sample.pallet_number || "").trim();

    if (!palletNumber) return;

    inspectionByPallet[palletNumber] = {
      qc_grade: sample.qc_grade || "",
      quality: sample.quality || "",
      condition: sample.condition || "",
      source_sheet_id:
        sample.qc_inspections?.source_sheet_id || ""
    };
  });

console.log(
  "🔎 PALLET MAP:",
  container.container,
  inspectionByPallet
);

const pendingLotGroups = Object.values(
  lines
    .filter(x => !String(x.lot || "").trim())
    .reduce((acc, x) => {
      const key = [
        x.commodity || "",
        x.variety || ""
      ].join("|");

      if (!acc[key]) {
        acc[key] = {
          commodity: x.commodity || "",
          variety: x.variety || "",
          pallets: 0,
          boxes: 0
        };
      }

      acc[key].pallets += 1;
      acc[key].boxes += Number(x.boxes || 0);

      return acc;
    }, {})
);

const groupedLines = Object.values(
  lines.reduce((acc, x) => {
    const key = [
      x.lot,
      x.commodity,
      x.variety,
      x.subgrower,
      x.pack_date,
      x.pack_style,
      x.size,
      x.label
    ].join("|");

    if (!acc[key]) {
      acc[key] = {
        lot: x.lot,
        commodity: x.commodity,
        variety: x.variety,
        subgrower: x.subgrower,
        pack_date: x.pack_date,
        pack_style: x.pack_style,
        size: x.size,
        label: x.label,
        recorder_code: x.recorder_code,
        temp_rec_loc: x.temp_rec_loc,
        condition: x.condition,
        pallet_numbers: [],
        pallets: 0,
        boxes: 0
      };
    }

    acc[key].pallets += 1;
    acc[key].boxes += Number(x.boxes || 0);
    if (x.pallet_number) {
  acc[key].pallet_numbers.push(x.pallet_number);
}

    return acc;
  }, {})
);

  return `
    <tr class="arrivalDetailRow">
      <td colspan="11">
        <div class="arrivalDetailBox">
          <h3>📦 Container Composition</h3>

        ${releaseDetails.items.length || releaseDetails.sourceStatus ? `
        <div class="arrivalReleaseBox">
        <strong>Treatment & Release</strong>

         <div class="arrivalReleaseItems">
         ${releaseDetails.items.map(item => `
         <span class="arrivalReleaseBadge ${item.type}">
          ${
            item.type === "critical" ? "🔴" :
            item.type === "success" ? "🟢" :
            item.type === "warning" ? "🟡" :
            "❄️"
          }
          ${item.label}
          </span>
         `).join("")}
         </div>

         ${releaseDetails.sourceStatus ? `
         <div class="arrivalReleaseSource">
         JK Fresh Status: ${releaseDetails.sourceStatus}
         </div>
         ` : ""}
          </div>
         ` : ""}

          ${treatmentAlert ? `
          <div class="arrivalTreatmentAlert ${treatmentAlert.level}">
          <strong>${escapeHtml(treatmentAlert.label)}</strong>
          ${treatmentAlert.detail
          ? `<span>${escapeHtml(treatmentAlert.detail)}</span>`
          : ""}
          </div>
          ` : ""}

          ${!isHistoricalView ? `
          <div class="containerTempRow">
          <span><strong>🌡 Set Temperature</strong></span>

          <input
          type="text"
          id="set-temp-${container.id}"
          value="${container.set_temperature || ""}"
          placeholder="e.g. 34°F"
          />

          <button
          class="secondaryBtn"
          onclick="saveContainerSetTemperature('${container.id}')">
          Save
         </button>
         </div>

         ${pendingLotGroups.length ? `
         <div class="lotPendingBox">
         <strong>⚠ Lot Pending Assignment</strong>

         ${pendingLotGroups.map(g => `
         <div class="lotPendingRow">
         <span>
          ${g.commodity || "-"} / ${g.variety || "-"}
          · ${g.pallets} pallets
          · ${g.boxes.toLocaleString()} cases
         </span>

        <input
          type="text"
          placeholder="Enter Lot"
          id="lot-${lines[0]?.container_id}-${g.commodity}-${g.variety}"
        />

        <button
          class="secondaryBtn"
          onclick="assignManifestLot(
            '${lines[0]?.container_id}',
            '${String(g.commodity).replace(/'/g, "\\'")}',
            '${String(g.variety).replace(/'/g, "\\'")}'
          )">
          Assign Lot
        </button>
      </div>
    `).join("")}
  </div>
` : ""}
` : ""}

${isHistoricalView && inspectedPalletCount > 0 ? `
  <div class="arrivalInspectionCoverage">
    <div>
      <strong>🔎 Inbound Inspection</strong>
    </div>

    <div>
      <strong>${inspectedPalletCount} of ${manifestPalletCount}</strong>
      pallets sampled ·
      <strong>${inspectionCoverage}% coverage</strong>
    </div>

    <div>
      ${notSampledPalletCount} pallets not sampled
    </div>
  </div>
` : ""}

<div class="arrivalDetailSummary">
            <span>${uniqueLots.length} Lots</span>
            <span>${uniqueSubgrowers.length} Subgrowers</span>
            <span>${uniquePackDates.length} Pack Dates</span>
            <span>${totalBoxes.toLocaleString()} Boxes</span>
            ${tempRecorderCount ? `
  <span>🌡 ${tempRecorderCount} Temp Recorder${tempRecorderCount !== 1 ? "s" : ""}</span>
` : ""}
          </div>

          <table class="arrivalDetailTable">
            <thead>
              <tr>
                <thead>
                <tr>
              <th>Lot</th>
              <th>Commodity</th>
              <th>Variety</th>
              <th>Subgrower</th>
              <th>Pack Date</th>
              <th>Pack</th>
              <th>Size</th>
              <th>Pallets</th>
              <th>Cases</th>
              <th>Pallet Numbers</th>
              <th>Label</th>
              <th>Condition</th>
              </tr>
              </thead>
            <tbody>
              ${groupedLines.map(x => `
                <tr>
                  <td>${x.lot || "-"}</td>
                  <td>${x.commodity || "-"}</td>
                  <td>${x.variety || "-"}</td>
                  <td>${x.subgrower || "-"}</td>
                  <td>${x.pack_date || "-"}</td>
                  <td>${x.pack_style || "-"}</td>
                  <td>${x.size || "-"}</td>
                  <td>${x.pallets}</td>
                  <td>${Number(x.boxes || 0).toLocaleString()}</td>
                  <td>
  <div class="palletInspectionList">
    ${[...new Set(x.pallet_numbers)]
      .map(pallet => {
        const palletNumber = String(pallet || "").trim();
        const inspection = inspectionByPallet[palletNumber];

        return inspection
          ? `
            <span class="palletSampled">
              ✓ ${palletNumber}
              ${inspection.qc_grade
  ? `
    <strong class="qcGradeBadge ${getQcGradeColorClass(inspection.qc_grade)}">
      ${inspection.qc_grade}
    </strong>
  `
  : ""}
            </span>
          `
          : `
            <span class="palletNotSampled">
              ${palletNumber}
            </span>
          `;
      })
      .join("") || "-"}
  </div>
</td>
                  <td>${x.label || "-"}</td>
                  <td>
  ${
    String(x.condition || "").trim().toLowerCase() === "temp recorder"
      ? `<span class="tempRecorderBadge">🌡 Temp Recorder</span>`
      : (x.condition || "-")
  }
</td>
                  </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  `;
}

window.assignManifestLot = async function assignManifestLot(
  containerId,
  commodity,
  variety
) {
  const inputId = `lot-${containerId}-${commodity}-${variety}`;
  const input = document.getElementById(inputId);

  if (!input) {
    alert("Lot input not found.");
    return;
  }

  const newLot = String(input.value || "").trim();

  if (!newLot) {
    alert("Please enter a Lot number.");
    return;
  }

  const { data: affectedLines, error: lookupError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .select("id, lot")
      .eq("container_id", containerId)
      .eq("commodity", commodity)
      .eq("variety", variety);

  if (lookupError) {
    console.error("Lot lookup error:", lookupError);
    alert("Unable to find manifest lines.");
    return;
  }

  if (!affectedLines?.length) {
    alert("No matching manifest lines found.");
    return;
  }

  const previousLots = [
    ...new Set(
      affectedLines
        .map(x => String(x.lot || "").trim())
        .filter(Boolean)
    )
  ];

  const { error: updateError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .update({
        lot: newLot,
        lot_source: "manual",
        lot_updated_at: new Date().toISOString()
      })
      .eq("container_id", containerId)
      .eq("commodity", commodity)
      .eq("variety", variety);

  if (updateError) {
    console.error("Lot assignment error:", updateError);
    alert("Unable to assign Lot: " + updateError.message);
    return;
  }

  const { data: allLines, error: allLinesError } =
    await supabaseClient
      .from("arrival_manifest_lines")
      .select("lot")
      .eq("container_id", containerId);

  if (!allLinesError) {
    const lots = [
      ...new Set(
        (allLines || [])
          .map(x => String(x.lot || "").trim())
          .filter(Boolean)
      )
    ];

    await supabaseClient
      .from("arrival_containers")
      .update({
        lot: lots.join(", ")
      })
      .eq("id", containerId);
  }

  if (previousLots.length) {
    alert(
      `Lot updated successfully.\n\n` +
      `${previousLots.join(", ")} → ${newLot}`
    );
  } else {
    alert(`Lot ${newLot} assigned successfully.`);
  }

  await loadInboundArrivals();
};

window.saveContainerSetTemperature = async function saveContainerSetTemperature(containerId) {
  const input = document.getElementById(`set-temp-${containerId}`);

  if (!input) {
    alert("Set temperature input not found.");
    return;
  }

  const value = String(input.value || "").trim();

  const { error } = await supabaseClient
    .from("arrival_containers")
    .update({
      set_temperature: value
    })
    .eq("id", containerId);

  if (error) {
    console.error("Set temperature save error:", error);
    alert("Unable to save set temperature: " + error.message);
    return;
  }

  alert(
    value
      ? `Set Temperature saved: ${value}`
      : "Set Temperature cleared."
  );

  await loadInboundArrivals();
};

async function loadInboundArrivals() {
  console.log("Loading arrivals...");

  const tbody = $("inboundTableBody");
  if (!tbody) return;

  let arrivalsQuery = supabaseClient
  .from("arrival_containers")
  .select("*");

if (currentArrivalView === "live") {
  arrivalsQuery = arrivalsQuery
    .eq("active", true)
    .eq("data_type", "live")
    .not("status", "in", '("Report Sent","Cancelled / Diverted")');
}

if (currentArrivalView === "historical") {
  arrivalsQuery = arrivalsQuery
    .eq("data_type", "historical");
}

if (currentArrivalView === "all") {
  // show all arrival records
}

const { data, error } = await arrivalsQuery;

  const arrivalIds = (data || []).map(r => r.id);

let manifestLines = [];
let manifestError = null;
let offset = 0;

while (true) {
  const { data: batch, error } = await supabaseClient
    .from("arrival_manifest_lines")
    .select("*")
    .in("container_id", arrivalIds)
    .order("id", { ascending: true })
    .range(offset, offset + 999);

  if (error) {
    manifestError = error;
    break;
  }

  manifestLines.push(...(batch || []));

  if (!batch || batch.length < 1000) break;

  offset += 1000;
}
  console.log("🔎 MANIFEST LINES LOADED:", manifestLines?.length);

if (manifestError) {
  console.error("Manifest lines error:", manifestError);
}

const { data: inspectionSamples, error: inspectionSamplesError } =
  await supabaseClient
    .from("qc_inspection_samples")
    .select(`
      id,
      inspection_id,
      pallet_number,
      qc_grade,
      quality,
      condition,
      qc_inspections!inner (
        id,
        arrival_container_id,
        source_sheet_id,
        inspection_type
      )
    `);

if (inspectionSamplesError) {
  console.error(
    "Inspection samples error:",
    inspectionSamplesError
  );
}

console.log(
  "🔎 SHERLOCK INSPECTION SAMPLES:",
  inspectionSamples
);

    console.log("Supabase returned:", data);
    console.log(
  "🫘 CT CONTAINERS CHECK:",
  (data || [])
    .filter(r =>
      ["TTNU8149719", "MNBU4508502"].includes(r.container)
    )
    .map(r => ({
      container: r.container,
      active: r.active,
      data_type: r.data_type,
      status: r.status,
      eta: r.eta,
      warehouse_eta: r.warehouse_eta
    }))
);
    console.log("Supabase error:", error);

  if (error) {
    console.error("Load arrivals error:", error);
    tbody.innerHTML = `<tr><td colspan="11">Error loading arrivals.</td></tr>`;
    return;
  }

  if (!data || !data.length) {
  tbody.innerHTML = `<tr><td colspan="11">No arrivals found.</td></tr>`;
  return;
}

const linesByContainerId = {};

(manifestLines || []).forEach(line => {
  if (!line.container_id) return;

  if (!linesByContainerId[line.container_id]) {
    linesByContainerId[line.container_id] = [];
  }

  linesByContainerId[line.container_id].push(line);
});

const inspectionSamplesByContainerId = {};
console.log(
  "🔎 SHERLOCK SUDU8234302:",
  (manifestLines || []).filter(line =>
    line.container_id ===
    data.find(r =>
      r.container === "SUDU8234302" &&
      String(r.po) === "8458"
    )?.id
  )
);

(inspectionSamples || []).forEach(sample => {
  const containerId =
    sample.qc_inspections?.arrival_container_id;

  if (!containerId) return;

  if (!inspectionSamplesByContainerId[containerId]) {
    inspectionSamplesByContainerId[containerId] = [];
  }

  inspectionSamplesByContainerId[containerId].push(sample);
});

console.log(
  "🔎 SHERLOCK BY CONTAINER:",
  inspectionSamplesByContainerId
);

const today = new Date();
today.setHours(0, 0, 0, 0);

const startDate = new Date(today);
startDate.setDate(startDate.getDate() - 7);

const sortedData = data.sort((a, b) => {
  const dateA = a.warehouse_eta
    ? parseEtaDate(a.warehouse_eta)
    : null;

  const dateB = b.warehouse_eta
    ? parseEtaDate(b.warehouse_eta)
    : null;

  // Containers without Warehouse ETA go last
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;

  // History: newest first
  if (currentArrivalView === "historical") {
    return dateB - dateA;
  }

  // Arrivals: earliest first
  return dateA - dateB;
});

renderArrivalHealthSummary(sortedData);


console.log("🕵️ AVENGERS FILTER:", {
  filter: currentArrivalHealthFilter,
  containerInSortedData: sortedData.some(
    r => r.container === "SUDU8234302"
  ),
  containerPO: sortedData.find(
    r => r.container === "SUDU8234302"
  )?.po
});

const healthFilteredData =
  currentArrivalHealthFilter === "all"
    ? sortedData
    : sortedData.filter(r => {
        if (currentArrivalHealthFilter === "delayed") {
          return isArrivalAttention(r);
        }
if (currentArrivalHealthFilter === "today") {
  return Boolean(r.warehouse_eta) &&
         getEtaHealth(r.warehouse_eta) === "today";
}
        return getEtaHealth(r.warehouse_eta || r.eta) === currentArrivalHealthFilter;
      });

const searchValue = ($("arrivalSearch")?.value || "").toLowerCase().trim();

const tableData = healthFilteredData.filter(r => {
  const lines = linesByContainerId[r.id] || [];
  if (r.container === "SUDU8234302") {
  console.log("🔎 SHERLOCK RENDER:", {
    containerId: r.id,
    palletsFound: lines.length,
    lot: r.lot
  });
}

const text = [
  r.container,
  r.po,
  r.grower,
  r.origin,
  r.status,
  r.priority,
  r.treatment,
  r.source_status,

  ...lines.map(x => x.lot),
  ...lines.map(x => x.commodity),
  ...lines.map(x => x.variety),
  ...lines.map(x => x.subgrower),
  ...lines.map(x => x.label),
  ...lines.map(x => x.pack_date),
  ...lines.map(x => x.pallet_number)
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

return !searchValue || text.includes(searchValue);
});

  if (!tableData.length) {
  tbody.innerHTML = `<tr><td colspan="11">No arrivals in this category.</td></tr>`;
  return;
}

  tbody.innerHTML = tableData.map(r => {
  const lines = linesByContainerId[r.id] || [];

  const inspectionSamplesForContainer =
  inspectionSamplesByContainerId[r.id] || [];

  const treatmentAlert = getArrivalTreatmentAlert(r);

  const lotSummary =
    [...new Set(lines.map(x => x.lot).filter(Boolean))].join(", ") ||
    r.lot ||
    "-";

  const commoditySummary =
    [...new Set(lines.map(x => x.commodity).filter(Boolean))].join(", ") ||
    r.commodity ||
    "-";

  const varietySummary =
    [...new Set(lines.map(x => x.variety).filter(Boolean))].join(", ") ||
    r.variety ||
    "-";

    return `
<tr class="arrivalRow priority-${String(r.priority || "Normal").toLowerCase()}">
  <td>
    <button
      class="expandBtn"
      onclick="toggleArrivalDetails('${r.id}')">
      ${expandedArrivalId === r.id ? "▼" : "▶"}
      </button>
      </td>

      <td>${r.eta || "-"}</td>

<td>
  <input
    type="text"
    value="${r.warehouse || ""}"
    placeholder="WH"
    class="${r.warehouse ? "arrival-field-filled" : ""}"
    data-id="${r.id}"
    onchange="window.updateArrivalField(this.dataset.id, 'warehouse', this.value)"
  >
</td>

<td>
  <input
    type="date"
    value="${r.warehouse_eta || ""}"
    class="${r.warehouse_eta ? "arrival-field-filled" : ""}"
    data-id="${r.id}"
    onchange="window.updateArrivalField(this.dataset.id, 'warehouse_eta', this.value)"
  >
</td>

<td>
  <input
    type="text"
    value="${r.door || ""}"
    placeholder="Door"
    class="${r.door ? "arrival-field-filled" : ""}"
    data-id="${r.id}"
    onchange="window.updateArrivalField(this.dataset.id, 'door', this.value)"
  >
</td>

<td>
  <div>${r.container || "-"}</div>

      ${treatmentAlert ? `
      <div class="arrivalTreatmentBadge ${treatmentAlert.level}">
      ${treatmentAlert.label}
      </div>
      ` : ""}
      </td>
      <td>${r.po || "-"}</td>
      <td>${lotSummary}</td>
      <td>${r.grower || "-"}</td>
      <td>${commoditySummary}</td>
      <td>${varietySummary}</td>
      <td>${r.origin || "-"}</td>
      ${currentArrivalView === "historical"
  ? `
    <td>
      <button
        class="secondaryBtn"
        onclick="openArrivalNotes('${r.id}')">
        💬 Arrival Notes
      </button>
    </td>
  `
  : `
    <td>
      <select
  data-id="${r.id}"
  ${typeof hasPermission === "function" && !hasPermission("arrivals.edit_status") ? "disabled" : ""}
  onchange="window.updateArrivalField(this.dataset.id, 'status', this.value)">
        <option value="">Select Status</option>
        <option value="Expected" ${r.status === "Expected" ? "selected" : ""}>Expected</option>
        <option value="At Door" ${r.status === "At Door" ? "selected" : ""}>🟢 At Door</option>
        <option value="Sampling" ${r.status === "Sampling" ? "selected" : ""}>🟡 Sampling</option>
        <option value="Inspection Finished" ${r.status === "Inspection Finished" ? "selected" : ""}>✅ Inspection Finished</option>
        <option value="Report Sent" ${r.status === "Report Sent" ? "selected" : ""}>📧 Report Sent</option>
        <option value="Cancelled / Diverted" ${r.status === "Cancelled / Diverted" ? "selected" : ""}>🚫 Cancelled / Diverted</option>
      </select>
    </td>

    <td>
    <div style="display:flex; align-items:center; gap:4px; white-space:nowrap;">
      <select
  data-id="${r.id}"
  ${typeof hasPermission === "function" && !hasPermission("arrivals.edit_priority") ? "disabled" : ""}
  onchange="window.updateArrivalField(this.dataset.id, 'priority', this.value)">
        <option value="Low" ${r.priority === "Low" ? "selected" : ""}>Low</option>
        <option value="Normal" ${!r.priority || r.priority === "Normal" || r.priority === "High" ? "selected" : ""}>Normal</option>
        <option value="Critical" ${r.priority === "Critical" ? "selected" : ""}>Critical</option>
        <option value="Lotted" ${r.priority === "Lotted" ? "selected" : ""}>Lotted</option>
      </select>
      ${r.warehouse_eta ? `
  <button
    type="button"
    class="secondaryBtn"
    style="margin-left:4px; padding:3px 6px; min-width:auto;"
    title="Arrival Notes"
    onclick="openArrivalNotes('${r.id}')">
    💬
  </button>
` : ""}
    </td>
  `
}
    </tr>
    ${(() => {
  
    return expandedArrivalId === r.id
    ? renderArrivalDetails(
        lines,
        r,
        inspectionSamplesForContainer
      )
    : "";
})()}

    `;
}).join("");
}

window.updateArrivalField = async function updateArrivalField(id, field, value) {
    const requiredPermission = {
    status: "arrivals.edit_status",
    priority: "arrivals.edit_priority",
    eta: "arrivals.edit_eta",
    door: "arrivals.edit_status"
  }[field];

  if (
    requiredPermission &&
    typeof hasPermission === "function" &&
    !hasPermission(requiredPermission)
  ) {
    console.warn(
      `Permission denied: ${requiredPermission}`
    );

    alert("You do not have permission to modify this field.");
    return;
  }
  const {
  data: { user },
  error: userError
} = await supabaseClient.auth.getUser();

if (userError) {
  console.error("Unable to read authenticated user:", userError);
}

const changedBy = user?.email || "unknown";
  let previousStatus = null;

if (field === "status") {
  const { data: currentStatusRow, error: currentStatusError } =
    await supabaseClient
      .from("arrival_containers")
      .select("status")
      .eq("id", id)
      .single();

  if (currentStatusError) {
    console.error("Error reading current arrival status:", currentStatusError);
    alert("Unable to read current arrival status.");
    return;
  }

  previousStatus = currentStatusRow?.status || "";
}
  console.log("Updating:", id, field, value);

  const updates = {
    [field]: value
  };

  if (
  field === "status" &&
  value === "At Door"
) {
  const { data: currentArrival, error: arrivalCheckError } =
    await supabaseClient
      .from("arrival_containers")
      .select("actual_arrival_date")
      .eq("id", id)
      .single();

  if (arrivalCheckError) {
    console.error("Error checking actual arrival date:", arrivalCheckError);
  } else if (!currentArrival?.actual_arrival_date) {
    updates.actual_arrival_date = new Date().toISOString();
  }
}

  if (
  field === "status" &&
  (value === "Report Sent" || value === "Cancelled / Diverted")
) {
  updates.active = false;
  updates.data_type = "historical";
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

  if (
  field === "status" &&
  previousStatus !== value
) {
  const { error: historyError } =
    await supabaseClient
      .from("arrival_status_history")
      .insert({
        container_id: id,
        previous_status: previousStatus,
        new_status: value,
        changed_by: changedBy,
        is_correction: false
      });

  if (historyError) {
    console.error("Status history error:", historyError);
  }
}
  await loadInboundArrivals();
}

window.toggleArrivalDetails = function(id){

    if(expandedArrivalId === id){
        expandedArrivalId = null;
    }else{
        expandedArrivalId = id;
    }

    loadInboundArrivals();

}

async function loadAdminUsers() {
  const container = document.querySelector(
    "#adminTab-users .adminUsersPlaceholder"
  );

  if (!container) return;

  container.innerHTML = `
    <h3>👥 Users & Access</h3>
    <p>Loading users...</p>
  `;

  const { data: users, error } = await supabaseClient
    .from("user_roles")
    .select(`
      id,
      email,
      role,
      access_group,
      is_active,
      role_template_id
    `)
    .order("email");

  if (error) {
    console.error("Admin users error:", error);

    container.innerHTML = `
      <h3>👥 Users & Access</h3>
      <p style="color:#991b1b;">
        Unable to load users.
      </p>
    `;

    return;
  }

  const realUsers = (users || []).filter(user =>
    user.email &&
    user.email.includes("@")
  );

  container.innerHTML = `
    <div class="adminUsersHeader">
      <div>
        <h3>👥 Users & Access</h3>
        <p>
          Manage internal and external users, roles,
          and individual permissions.
        </p>
      </div>

      <button
      class="primaryBtn"
      onclick="openAdminAddUser()"
      >
      + Add User
      </button>
      </div>

    <div class="qaTableWrap">
      <table class="qaTable adminUsersTable">
        <thead>
          <tr>
            <th>User</th>
            <th>Access Group</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          ${
            realUsers.length
              ? realUsers.map(user => `
                  <tr>
                    <td>
                      <strong>
                        ${escapeHtml(user.email)}
                      </strong>
                    </td>

                    <td>
                      ${
                        user.access_group === "pacific"
                          ? "Pacific Internal"
                          : user.access_group === "external"
                            ? "External"
                            : "-"
                      }
                    </td>

                    <td>
                      ${escapeHtml(user.role || "-")}
                    </td>

                    <td>
                      ${
                        user.is_active
                          ? `<span class="tag">Active</span>`
                          : `<span class="tag">Inactive</span>`
                      }
                    </td>

                    <td>
<button
  class="secondaryBtn"
  onclick="openAdminUserManage('${user.id}')"
>
  Manage
</button>
</td>
</tr>
`).join("")
: `
<tr>
<td colspan="5">
No users found.
</td>
</tr>
`
}
</tbody>
</table>
</div>
`;
}

window.openAdminAddUser = async function openAdminAddUser() {

  const { data: roleTemplates, error: roleTemplatesError } =
    await supabaseClient
      .from("role_templates")
      .select("id, access_group, role_name, description")
      .eq("is_active", true)
      .order("access_group")
      .order("role_name");

  if (roleTemplatesError) {
    console.error("Role templates error:", roleTemplatesError);
    alert("Unable to load role templates.");
    return;
  }

  console.log("👥 AVAILABLE ROLE TEMPLATES:", roleTemplates);

  $("modalContent").innerHTML = `
  <div class="adminPermissionModal">

    <div class="adminPermissionHeader">
      <div>
        <h2>➕ Add User</h2>
        <p>Create a new QC Hub user.</p>
      </div>
    </div>

    <div style="display:grid; gap:16px; margin-top:24px;">

      <div>
        <label><b>Email</b></label>
        <input
          id="adminNewUserEmail"
          type="email"
          placeholder="name@company.com"
          style="width:100%; margin-top:6px;"
        >
      </div>

      <div>
        <label><b>Access Group</b></label>
        <select
          id="adminNewUserAccessGroup"
          style="width:100%; margin-top:6px;"
        >
          <option value="">Select access group...</option>
          <option value="pacific">Pacific Internal</option>
          <option value="external">External</option>
        </select>
      </div>

      <div>
        <label><b>Role</b></label>
        <select
          id="adminNewUserRole"
          style="width:100%; margin-top:6px;"
          disabled
        >
          <option value="">Select access group first...</option>
        </select>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px;">
        <button
          class="primaryBtn"
          id="adminCreateUserBtn"
        >
          Create User
        </button>
      </div>
    </div>

  </div>
`;

  $("modal").showModal();

  const accessGroupSelect = $("adminNewUserAccessGroup");
const roleSelect = $("adminNewUserRole");

accessGroupSelect.onchange = () => {
  const accessGroup = accessGroupSelect.value;

  const availableRoles = roleTemplates.filter(
    role => role.access_group === accessGroup
  );

  roleSelect.innerHTML = `
    <option value="">Select role...</option>
    ${availableRoles.map(role => `
      <option value="${role.id}">
        ${role.role_name}
      </option>
    `).join("")}
  `;

  roleSelect.disabled = !accessGroup;
};
  $("adminCreateUserBtn").onclick = async () => {
    const email = $("adminNewUserEmail").value.trim().toLowerCase();
    const roleTemplateId = $("adminNewUserRole").value;

    const selectedTemplate = roleTemplates.find(
      role => role.id === roleTemplateId
    );

if (!email || !selectedTemplate) {
  alert("Please enter an email and select a role.");
  return;
}

    console.log("🧪 NEW USER PREVIEW:", {
      email,
      access_group: selectedTemplate?.access_group,
      role: selectedTemplate?.role_name,
      role_template_id: selectedTemplate?.id
    });
    const { data, error } = await supabaseClient.functions.invoke(
  "invite-qc-user",
  {
    body: {
      email,
      role_template_id: selectedTemplate?.id
    }
  }
);

console.log("📨 INVITE RESULT:", data, error);
if (error) {
  console.error("Invite user error:", error);

  if (error.context?.status === 409) {
    alert("User already exists in QC Hub.");
  } else {
    alert("Unable to create user.");
  }

  return;
}

alert(`Invitation sent to ${email}`);
$("modal").close();
await loadAdminUsers();
  };
};

window.openAdminUserManage = async function openAdminUserManage(userRoleId) {

  const { data: user, error: userError } = await supabaseClient
    .from("user_roles")
    .select(`
      id,
      email,
      role,
      access_group,
      is_active,
      role_template_id
    `)
    .eq("id", userRoleId)
    .single();

  if (userError || !user) {
    console.error("User lookup error:", userError);
    alert("Unable to load user.");
    return;
  }


  const { data: catalog, error: catalogError } = await supabaseClient
    .from("permission_catalog")
    .select(`
      permission_key,
      permission_name,
      module_name,
      description
    `)
    .order("module_name")
    .order("permission_name");

  if (catalogError) {
    console.error("Permission catalog error:", catalogError);
    alert("Unable to load permission catalog.");
    return;
  }


  const { data: templatePermissions, error: templateError } =
    await supabaseClient
      .from("role_template_permissions")
      .select(`
        permission_key,
        is_allowed
      `)
      .eq("role_template_id", user.role_template_id);

  if (templateError) {
    console.error("Template permissions error:", templateError);
    alert("Unable to load role permissions.");
    return;
  }


  const { data: overrides, error: overridesError } =
    await supabaseClient
      .from("user_permissions")
      .select(`
        permission_key,
        is_allowed
      `)
      .eq("user_role_id", user.id);

  if (overridesError) {
    console.error("User overrides error:", overridesError);
    alert("Unable to load individual permissions.");
    return;
  }


  const templateMap = {};

  (templatePermissions || []).forEach(item => {
    templateMap[item.permission_key] = item.is_allowed;
  });


  const overrideMap = {};

  (overrides || []).forEach(item => {
    overrideMap[item.permission_key] = item.is_allowed;
  });


  const permissionRows = (catalog || []).map(permission => {

    const inheritedAllowed =
      templateMap[permission.permission_key] === true;

    const hasOverride =
      Object.prototype.hasOwnProperty.call(
        overrideMap,
        permission.permission_key
      );

    const overrideValue = hasOverride
      ? overrideMap[permission.permission_key]
      : null;

    const effectiveAllowed = hasOverride
      ? overrideValue
      : inheritedAllowed;

    const selectedMode = hasOverride
      ? overrideValue
        ? "allow"
        : "deny"
      : "inherited";

    return {
      ...permission,
      inheritedAllowed,
      effectiveAllowed,
      selectedMode
    };
  });


  $("modalContent").innerHTML = `
    <div class="adminPermissionModal">

      <div class="adminPermissionHeader">
        <div>
          <h2>👤 Manage User</h2>
          <p>${escapeHtml(user.email)}</p>
        </div>

        <span class="tag">
          ${user.is_active ? "Active" : "Inactive"}
        </span>
      </div>


      <div class="adminUserSummary">

        <div>
          <span>Access Group</span>
          <strong>
            ${
              user.access_group === "pacific"
                ? "Pacific Internal"
                : user.access_group === "external"
                  ? "External"
                  : "-"
            }
          </strong>
        </div>

        <div>
          <span>Role Template</span>
          <strong>${escapeHtml(user.role || "-")}</strong>
        </div>

      </div>


      <div
        style="
          margin:18px 0;
          padding:12px 14px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          border-radius:10px;
          font-size:13px;
          color:#475569;
        "
      >
        <strong>Inherited</strong> uses the Role Template default.
        <strong>Allow</strong> grants access only to this user.
        <strong>Deny</strong> removes access only from this user.
      </div>


      <div class="qaTableWrap">

        <table class="qaTable">

          <thead>
            <tr>
              <th>Module</th>
              <th>Permission</th>
              <th>Role Default</th>
              <th>User Setting</th>
              <th>Effective Access</th>
            </tr>
          </thead>

          <tbody>

            ${
              permissionRows.map(permission => `
                <tr>

                  <td>
                    ${escapeHtml(permission.module_name)}
                  </td>

                  <td>
                    <strong>
                      ${escapeHtml(permission.permission_name)}
                    </strong>

                    <div
                      style="
                        margin-top:3px;
                        font-size:11px;
                        color:#94a3b8;
                      "
                    >
                      ${escapeHtml(permission.permission_key)}
                    </div>
                  </td>

                  <td>
                    ${
                      permission.inheritedAllowed
                        ? `<span class="tag">✓ Allowed</span>`
                        : `<span style="color:#94a3b8;">Not Included</span>`
                    }
                  </td>

                  <td>

                    <select
                      class="adminPermissionSelect"
                      data-permission-key="${escapeHtml(permission.permission_key)}"
                      data-inherited="${permission.inheritedAllowed ? "true" : "false"}"
                      onchange="updateAdminPermissionPreview(this)"
                    >

                      <option
  value="inherited"
  ${
    permission.selectedMode === "inherited"
      ? "selected"
      : ""
  }
>
  Inherited (${permission.inheritedAllowed ? "Allowed" : "Denied"})
</option>

                      <option
                        value="allow"
                        ${
                          permission.selectedMode === "allow"
                            ? "selected"
                            : ""
                        }
                      >
                        Allow
                      </option>

                      <option
                        value="deny"
                        ${
                          permission.selectedMode === "deny"
                            ? "selected"
                            : ""
                        }
                      >
                        Deny
                      </option>

                    </select>

                  </td>

                  <td>
                    <span
                      class="adminEffectivePermission tag"
                    >
                      ${
                        permission.effectiveAllowed
                          ? "✓ Allowed"
                          : "✕ Denied"
                      }
                    </span>
                  </td>

                </tr>
              `).join("")
            }

          </tbody>

        </table>

      </div>


      <div
        style="
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:20px;
        "
      >

        <button
          class="secondaryBtn"
          onclick="document.getElementById('modal').close()"
        >
          Cancel
        </button>

        <button
          class="primaryBtn"
          onclick="saveAdminUserPermissions('${user.id}')"
        >
          Save Permissions
        </button>

      </div>

    </div>
  `;

  $("modal").showModal();
};

window.updateAdminPermissionPreview =
function updateAdminPermissionPreview(select) {

  const row = select.closest("tr");
  const badge = row?.querySelector(
    ".adminEffectivePermission"
  );

  if (!badge) return;

  const inherited =
    select.dataset.inherited === "true";

  let allowed = inherited;

  if (select.value === "allow") {
    allowed = true;
  }

  if (select.value === "deny") {
    allowed = false;
  }

  badge.textContent = allowed
    ? "✓ Allowed"
    : "✕ Denied";
};

window.saveAdminUserPermissions =
async function saveAdminUserPermissions(userRoleId) {

  const selects = [
    ...document.querySelectorAll(
      ".adminPermissionSelect"
    )
  ];

  const overridesToSave = [];
  const inheritedKeys = [];

  selects.forEach(select => {

    const permissionKey =
      select.dataset.permissionKey;

    const mode = select.value;

    if (mode === "inherited") {
      inheritedKeys.push(permissionKey);
      return;
    }

    overridesToSave.push({
      user_role_id: userRoleId,
      permission_key: permissionKey,
      is_allowed: mode === "allow"
    });

  });


  if (inheritedKeys.length) {

    const { error: deleteError } =
      await supabaseClient
        .from("user_permissions")
        .delete()
        .eq("user_role_id", userRoleId)
        .in("permission_key", inheritedKeys);

    if (deleteError) {
      console.error(
        "Permission reset error:",
        deleteError
      );

      alert(
        "Unable to reset inherited permissions."
      );

      return;
    }

  }


  if (overridesToSave.length) {

    const { error: saveError } =
      await supabaseClient
        .from("user_permissions")
        .upsert(
          overridesToSave,
          {
            onConflict:
              "user_role_id,permission_key"
          }
        );

    if (saveError) {
      console.error(
        "Permission save error:",
        saveError
      );

      alert(
        "Unable to save permissions."
      );

      return;
    }

  }


  alert("User permissions saved successfully.");

  await openAdminUserManage(userRoleId);
};

function openAdminTab(tabName) {
  // Hide all admin tab content
  document.querySelectorAll(".adminTabContent").forEach(section => {
    section.style.display = "none";
  });

  // Remove active state from all admin tab buttons
  document.querySelectorAll(".adminTab").forEach(button => {
    button.classList.remove("active");
  });

  // Show selected tab
  const selectedSection = document.getElementById(
    `adminTab-${tabName}`
  );

  if (selectedSection) {
    selectedSection.style.display = "";
  }

  // Highlight selected tab button
  const selectedButton = document.querySelector(
    `[data-admin-tab="${tabName}"]`
  );

  if (selectedButton) {
    selectedButton.classList.add("active");
  }

if (tabName === "users") {
  loadAdminUsers();
}
}

load();
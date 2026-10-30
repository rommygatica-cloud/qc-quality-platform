// 🫘 GARBANCITO — QA MANAGEMENT
// Storage Quality & Reinspection Monitoring

window.openQAManagement = async function () {
  const container = document.getElementById("qaModuleContent");
  if (!container) return;

  // 🫘 QA MANAGEMENT — LOAD CURRENT FAMOUS INVENTORY
  let inventoryRows = [];

  try {
    inventoryRows = await loadFamousInventoryFromSupabase();

    console.log("🍇 QA Management — Famous Inventory:", inventoryRows.length);

  } catch (error) {
    console.error("❌ QA Inventory Load Error:", error);
  }

// 🫘 QA MANAGEMENT — GROUP CURRENT INVENTORY
const inventoryGroups = new Map();

inventoryRows.forEach(row => {
  const key = JSON.stringify([
    row.lot,
    row.gs1lot,
    row.commodity,
    row.variety,
    row.grower
  ]);

  if (!inventoryGroups.has(key)) {
    inventoryGroups.set(key, {
      po: row.lot,
      lot: row.gs1lot,
      commodity: row.commodity,
      variety: row.variety,
      grower: row.grower,
      pallets: new Set(),
      boxes: 0,
      rows: []
    });
  }

  const group = inventoryGroups.get(key);

  if (row.pallet) {
    group.pallets.add(String(row.pallet).trim());
  }

  group.boxes += Number(row.boxes) || 0;
  group.rows.push(row);
});

const groupedInventory = [...inventoryGroups.values()];


// 🫘 QA MANAGEMENT — DECOFRUT QC SCORES
const qcRows = await loadDecofrutScoresFromSupabase();

const normalizeQC = value =>
  String(value ?? "").trim().toUpperCase();

const qcKey = (pallet, lot, grower) => [
  normalizeQC(pallet).replace(/^[GFJ](?=\d)/, ""),
  normalizeQC(lot).replace(/-\d+$/, ""),
  normalizeQC(grower)
].join("|");

const qcLookup = new Map();

qcRows.forEach(q => {
  const key = qcKey(q.Pallet, q["Lot Number"], q.Grower);

  if (!qcLookup.has(key)) {
    qcLookup.set(key, q.QC);
  }
});

inventoryRows.forEach(row => {
  const key = qcKey(row.pallet, row.gs1lot, row.grower);
  row.qaQcScore = qcLookup.get(key) || "";
});

// 🫘 QA MANAGEMENT — QC SUMMARY BY INVENTORY GROUP
groupedInventory.forEach(group => {

  const scores = group.rows
    .map(r => String(r.qaQcScore || "").trim().toUpperCase())
    .filter(Boolean);

  group.qcSummary = scores.length
    ? [...new Set(scores)].sort().join(", ")
    : "QC Pending";

  group.qcCoverage = `${scores.length}/${group.rows.length}`;

});

  container.innerHTML = `
    <section class="qaPanel">
      <div class="qaPanelHeader">
        <div>
          <h2>🍇 QA Management</h2>
          <p>Storage Quality & Reinspection Monitoring</p>
        </div>
      </div>

      <div class="qaKpiGrid">
        <article class="stat">
          <b>${new Set(inventoryRows.map(r => String(r.pallet || "").trim()).filter(Boolean)).size}</b>
          <span>Available Pallets</span>
        </article>

        <article class="stat">
          <b>—</b>
          <span>Due for Reinspection</span>
        </article>

        <article class="stat">
          <b>—</b>
          <span>Overdue</span>
        </article>

        <article class="stat">
          <b>—</b>
          <span>Quality Alerts</span>
        </article>
      </div>

      <div class="qaPanel" style="margin-top:24px;">
  <h3>📦 Current Storage Inventory</h3>
  <p style="color:#64748b;">
    Active Famous inventory · Storage Quality Monitoring
  </p>

  <div class="qaTableWrap" style="margin-top:18px;">
    <table class="qaTable">
      <thead>
        <tr>
          <th>PO</th>
          <th>Lot</th>
          <th>Commodity</th>
          <th>Variety</th>
          <th>Grower</th>
          <th>Pallet</th>
          <th>Ageing</th>
          <th>QC Score</th>
          <th>Boxes</th>
        </tr>
      </thead>

      <tbody>
  ${groupedInventory.map((group, index) => `
    <tr
  style="cursor:pointer;"
  onclick="this.nextElementSibling.hidden = !this.nextElementSibling.hidden"
  title="Click to view pallets"
>
  <td>▶ ${escapeHtml(group.po)}</td>
      <td>${escapeHtml(group.lot)}</td>
      <td>${escapeHtml(group.commodity)}</td>
      <td>${escapeHtml(group.variety)}</td>
      <td>${escapeHtml(group.grower)}</td>
      <td>${group.pallets.size} pallets</td>
      <td>${Math.max(...group.rows.map(r => Number(getInventoryAgeing(r.receivingdate)) || 0))} days</td>
      <td>
  <span title="${group.qcCoverage} inventory records with QC score">
    ${escapeHtml(group.qcSummary)}
  </span>
</td>
      <td>${group.boxes.toLocaleString()}</td>
    </tr>
    <tr hidden>
  <td colspan="9" style="padding:16px; background:#f8fafc;">

    <div style="font-weight:600; margin-bottom:12px;">
      📦 Pallet Details — ${group.pallets.size} pallets
    </div>

    <div class="qaTableWrap">
      <table class="qaTable">
        <thead>
          <tr>
            <th>Pallet ID</th>
            <th>Size</th>
            <th>Package</th>
            <th>Receiving Date</th>
            <th>Ageing</th>
            <th>QC Score</th>
            <th>Boxes</th>
          </tr>
        </thead>

        <tbody>
          ${group.rows.map(r => `
            <tr>
              <td>${escapeHtml(r.pallet)}</td>
              <td>${escapeHtml(r.size)}</td>
              <td>${escapeHtml(r.package)}</td>
              <td>${
  r.receivingdate
    ? new Date(r.receivingdate).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "2-digit",
        day: "2-digit",
        year: "numeric"
      })
    : "—"
}</td>
              <td>${getInventoryAgeing(r.receivingdate)} days</td>
              <td>${escapeHtml(r.qaQcScore || "QC Pending")}</td>
              <td>${Number(r.boxes || 0).toLocaleString()}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

  </td>
</tr>
  `).join("")}
</tbody>
    </table>
  </div>

  <p style="margin-top:12px; color:#64748b; font-size:13px;">
    ${groupedInventory.length} inventory groups · Current Famous inventory.
  </p>
</div>
    </section>
  `;
};
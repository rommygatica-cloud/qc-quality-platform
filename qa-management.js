// 🫘 GARBANCITO — QA MANAGEMENT

// 🫘 QA MANAGEMENT — MODULE NAVIGATION

window.openQAModule = function (module) {
  const home = document.getElementById("qaHomeGrid");
  const content = document.getElementById("qaModuleContent");

  if (!home || !content) return;

  home.style.display = "none";
  content.innerHTML = "";

  if (module === "inventory") {
    window.openQAManagement();
    return;
  }

// 🫘 QA MANAGEMENT — REINSPECTION SETTINGS
if (module === "settings") {
  window.openQAReinspectionSettings();
  return;
}

  const titles = {
    history: "📚 Quality History",
    settings: "⚙️ Reinspection Settings",
    intelligence: "📊 Quality Intelligence"
  };

  content.innerHTML = `
    <section class="qaPanel">

      <button
        class="secondaryBtn"
        onclick="backToQAHome()">
        ← Back
      </button>

      <h2 style="margin-top:20px;">
        ${titles[module] || "QA Management"}
      </h2>

      <p>Module under development.</p>

    </section>
  `;
};

window.backToQAHome = function () {
  const home = document.getElementById("qaHomeGrid");
  const content = document.getElementById("qaModuleContent");

  if (home) home.style.display = "";
  if (content) content.innerHTML = "";
};

// 🫘 QA MANAGEMENT — REINSPECTION SETTINGS

window.openQAReinspectionSettings = async function () {
  const container = document.getElementById("qaModuleContent");
  if (!container) return;

// 🫘 LOAD REINSPECTION RULES FROM SUPABASE
const { data: reinspectionRules, error: rulesError } =
  await supabaseClient
    .from("qa_reinspection_rules")
    .select("*")
    .order("commodity")
    .order("origin")
    .order("variety")
    .order("condition_score");

if (rulesError) {
  console.error("❌ Reinspection Rules Load Error:", rulesError);
  alert("Unable to load reinspection rules.");
  return;
}

console.log(
  "🫘 Reinspection Rules Loaded:",
  reinspectionRules?.length ?? 0
);

// 🫘 GROUP REINSPECTION RULES BY COMMODITY / ORIGIN / VARIETY
const rulesByVariety = new Map();

(reinspectionRules || []).forEach(rule => {
  const key = JSON.stringify([
    rule.commodity,
    rule.origin,
    rule.variety
  ]);

  if (!rulesByVariety.has(key)) {
    rulesByVariety.set(key, {
      commodity: rule.commodity,
      origin: rule.origin,
      variety: rule.variety,
      conditions: {}
    });
  }

  rulesByVariety.get(key).conditions[rule.condition_score] = {
    min: rule.min_days,
    max: rule.max_days
  };
});

const groupedRules = [...rulesByVariety.values()];

// 🫘 REINSPECTION SETTINGS — OPEN EDIT FORM
window.editQAReinspectionRule = function (key) {
  const [commodity, origin, variety] = JSON.parse(key);

  const group = groupedRules.find(r =>
    r.commodity === commodity &&
    r.origin === origin &&
    r.variety === variety
  );

  if (!group) return;

  // Open the existing form
  if (!document.getElementById("qaRuleForm")) {
    document.getElementById("qaAddReinspectionRule")?.click();
  }
  // 🫘 STORE ORIGINAL RULE KEY FOR EDITING
window.qaEditingRuleKey = {
  commodity,
  origin,
  variety
};

  document.getElementById("qaRuleCommodity").value = commodity;
  document.getElementById("qaRuleOrigin").value = origin;
  document.getElementById("qaRuleVariety").value = variety;

  // 🫘 LOCK RULE IDENTITY DURING EDITING
[
  "qaRuleCommodity",
  "qaRuleOrigin",
  "qaRuleVariety"
].forEach(id => {
  document.getElementById(id).readOnly = true;
});

  [1, 2, 3].forEach(condition => {
    const rule = group.conditions[condition];

    document.getElementById(`qaRuleMin${condition}`).value =
      rule?.min ?? "";

    document.getElementById(`qaRuleMax${condition}`).value =
      rule?.max ?? "";
  });

  // Prevent inserting duplicate rules until UPDATE is implemented
  const saveButton = document.getElementById("qaSaveNewRule");
  saveButton.disabled = false;
saveButton.textContent = "💾 Save Changes";

  document.querySelector("#qaRuleForm h3").textContent =
    "✏️ Edit Reinspection Rule";
};

console.log(
  "🍇 Reinspection Variety Groups:",
  groupedRules.length
);

  container.innerHTML = `
    <section class="qaPanel">

      <button
        type="button"
        class="secondaryBtn"
        onclick="backToQAHome()">
        ← Back to QA Management
      </button>

      <div class="qaPanelHeader" style="margin-top:24px;">
        <div>
          <h2>⚙️ Reinspection Settings</h2>
          <p>
            Configure reinspection intervals by commodity,
            origin, variety and condition.
          </p>
        </div>
      </div>
${hasPermission("reinspection_rules.edit") ? `
  <div style="
    display:flex;
    justify-content:flex-end;
    margin-top:20px;
    margin-bottom:12px;
  ">
    <button
      type="button"
      class="primaryBtn"
      id="qaAddReinspectionRule">
      ➕ Add Rule
    </button>
  </div>
` : ""}
      <div class="qaTableWrap" style="margin-top:24px;">
        <table class="qaTable">
          <thead>
            <tr>
              <th>Commodity</th>
              <th>Origin</th>
              <th>Variety</th>
              <th>Condition 1</th>
              <th>Condition 2</th>
              <th>Condition 3</th>
              ${hasPermission("reinspection_rules.edit") ? "<th>Actions</th>" : ""}
            </tr>
          </thead>

          <tbody id="qaReinspectionRulesBody">
  ${groupedRules.length
    ? groupedRules.map(group => {

        const formatDays = condition => {
          const rule = group.conditions[condition];

          if (!rule) return "—";

          return rule.min === rule.max
            ? `${rule.min} days`
            : `${rule.min}–${rule.max} days`;
        };

        return `
          <tr>
            <td>${escapeHtml(group.commodity)}</td>
            <td>${escapeHtml(group.origin)}</td>
            <td>${escapeHtml(group.variety)}</td>
            <td>${formatDays(1)}</td>
            <td>${formatDays(2)}</td>
            <td>${formatDays(3)}</td>
          ${hasPermission("reinspection_rules.edit") ? `
  <td>
    <button
      type="button"
      class="secondaryBtn"
      onclick='window.editQAReinspectionRule(${JSON.stringify(JSON.stringify([group.commodity, group.origin, group.variety]))})'>
      ✏️ Edit
    </button>
  </td>
` : ""}
</tr>
        `;
      }).join("")
    : `
      <tr>
        <td colspan="6" style="text-align:center;">
          No reinspection rules configured yet.
        </td>
      </tr>
    `}
</tbody>
        </table>
      </div>

    </section>
  `;
  // 🫘 REINSPECTION SETTINGS — ADD RULE FORM
document.getElementById("qaAddReinspectionRule")
  ?.addEventListener("click", () => {

    // 🫘 RESET EDIT MODE WHEN ADDING A NEW RULE
window.qaEditingRuleKey = null;

    const existingForm = document.getElementById("qaRuleForm");

if (existingForm) {
  existingForm.remove();
}

    const form = document.createElement("div");
    form.id = "qaRuleForm";
    form.className = "qaPanel";
    form.style.marginTop = "20px";

    form.innerHTML = `
      <h3>➕ New Reinspection Rule</h3>

      <div style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
        gap:14px;
        margin-top:18px;
      ">

        <label>
          Commodity
          <input id="qaRuleCommodity" type="text"
                 placeholder="Grapes">
        </label>

        <label>
          Origin
          <input id="qaRuleOrigin" type="text"
                 placeholder="Peru">
        </label>

        <label>
          Variety
          <input id="qaRuleVariety" type="text"
                 placeholder="Autumn Crisp">
        </label>

      </div>

      <h4 style="margin-top:24px;">Reinspection Frequency (Days)</h4>

      <div style="
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:16px;
      ">

        ${[1, 2, 3].map(condition => `
          <div>
            <strong>Condition ${condition}</strong>

            <label style="display:block;margin-top:10px;">
              Minimum Days
              <input
                type="number"
                min="0"
                id="qaRuleMin${condition}"
                style="width:100%;box-sizing:border-box;">
            </label>

            <label style="display:block;margin-top:10px;">
              Maximum Days
              <input
                type="number"
                min="0"
                id="qaRuleMax${condition}"
                style="width:100%;box-sizing:border-box;">
            </label>
          </div>
        `).join("")}

      </div>

      <div style="margin-top:24px;">
        <button type="button"
                class="primaryBtn"
                id="qaSaveNewRule">
          💾 Save Rule
        </button>

        <button type="button"
                class="secondaryBtn"
                onclick="window.qaEditingRuleKey = null; document.getElementById('qaRuleForm').remove()">
          Cancel
        </button>
      </div>
    `;

    document.getElementById("qaReinspectionRulesBody")
      ?.closest(".qaTableWrap")
      ?.before(form);

// 🫘 REINSPECTION SETTINGS — SAVE NEW RULE
document.getElementById("qaRuleForm")?.addEventListener("click", async (event) => {
  if (event.target.id !== "qaSaveNewRule") return;

    if (!hasPermission("reinspection_rules.edit")) {
      alert("You do not have permission to edit reinspection rules.");
      return;
    }

    const value = id =>
      document.getElementById(id)?.value.trim() || "";

    const commodity = value("qaRuleCommodity");
    const origin = value("qaRuleOrigin");
    const variety = value("qaRuleVariety");

    if (!commodity || !origin || !variety) {
      alert("Please enter Commodity, Origin and Variety.");
      return;
    }

    const records = [];

    for (const condition of [1, 2, 3]) {
      const minText = value(`qaRuleMin${condition}`);
      const maxText = value(`qaRuleMax${condition}`);

      const min = Number(minText);
      const max = Number(maxText);

      if (
        !minText || !maxText ||
        !Number.isInteger(min) ||
        !Number.isInteger(max) ||
        min < 0 || max < min
      ) {
        alert(`Invalid days for Condition ${condition}.`);
        return;
      }

      records.push({
        commodity,
        origin,
        variety,
        condition_score: condition,
        min_days: min,
        max_days: max
      });
    }

    const button = document.getElementById("qaSaveNewRule");
    button.disabled = true;

    try {
      let error = null;

if (window.qaEditingRuleKey) {
  // 🫘 EDIT MODE — ATOMIC UPDATE
  const original = window.qaEditingRuleKey;

  const result = await supabaseClient.rpc(
    "update_qa_reinspection_rules",
    {
      p_commodity: original.commodity,
      p_origin: original.origin,
      p_variety: original.variety,
      p_rules: records.map(record => ({
        condition_score: record.condition_score,
        min_days: record.min_days,
        max_days: record.max_days
      }))
    }
  );

  error = result.error;
} else {
  // 🫘 ADD MODE — INSERT NEW RULES
  const result = await supabaseClient
    .from("qa_reinspection_rules")
    .insert(records);

  error = result.error;
}

      if (error) throw error;

      alert(
  window.qaEditingRuleKey
    ? "Reinspection rules updated successfully."
    : "Reinspection rules saved successfully."
);

window.qaEditingRuleKey = null;
      await window.openQAReinspectionSettings();

    } catch (error) {
      console.error("❌ Reinspection Rule Save Error:", error);
      alert("Unable to save rules: " + error.message);
      button.disabled = false;
    }
    });
  });
};

// 🫘 QA MANAGEMENT — INSPECTION VALIDATIONS
async function loadQCInspectionValidations() {
  const { data, error } = await supabaseClient
    .from("qc_inspection_validations")
    .select(`
      id,
      inspection_id,
      validation_status,
      related_inspection_id,
      validation_reason,
      validated_by,
      validated_at
    `)
    .order("validated_at", { ascending: false });

  if (error) {
    console.error("❌ QC Validation Load Error:", error);
    return [];
  }

  return data || [];
}
// Storage Quality & Reinspection Monitoring
window.openQAManagement = async function () {
  const container = document.getElementById("qaModuleContent");
  const home = document.getElementById("qaHomeGrid");

  if (!container) return;

  if (home) home.style.display = "none";

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
window.qaGroupedInventory = groupedInventory;

// 🫘 QA MANAGEMENT — LOAD INSPECTION VALIDATIONS
const inspectionValidations = await loadQCInspectionValidations();
const canValidateInspections = hasPermission("inspections.validate");

// 🫘 QA MANAGEMENT — LOAD INSPECTION HEADERS
const { data: inspectionHeaders, error: inspectionError } =
  await supabaseClient
    .from("qc_inspections")
    .select(`
      id,
      source_sheet_id,
      inspection_type,
      inspection_date,
      container,
      po_number,
      lot_number,
      receiving_entry,
      grower,
      commodity,
      variety
    `);

if (inspectionError) {
  console.error("❌ QA Inspection Load Error:", inspectionError);
}

console.log(
  "🔬 QA Inspection Headers:",
  inspectionHeaders?.length ?? 0
);

// 🫘 QA MANAGEMENT — POSSIBLE DUPLICATE CANDIDATES
const duplicateGroups = new Map();

(inspectionHeaders || [])
  .filter(r => r.inspection_type === "Inbound")
  .forEach(r => {

    const key = [
      r.inspection_date,
      r.container,
      r.lot_number || r.receiving_entry,
      r.grower,
      r.commodity,
      r.variety
    ]
      .map(v => String(v || "").trim().toUpperCase())
      .join("|");

    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }

    duplicateGroups.get(key).push(r);
  });

const possibleDuplicates = [...duplicateGroups.values()]
  .filter(group => group.length > 1);

console.log(
  "🔎 Possible Duplicate Groups:",
  possibleDuplicates.length
);

// 🔬 QA MANAGEMENT — DUPLICATE SAMPLE COMPARISON
const candidateInspectionIds = possibleDuplicates
  .flat()
  .map(r => r.id);

const { data: duplicateSamples, error: duplicateSamplesError } =
  await supabaseClient
    .from("qc_inspection_samples")
    .select("inspection_id, pallet_number, sample_number")
    .in("inspection_id", candidateInspectionIds);

if (duplicateSamplesError) {
  console.error("❌ Error loading duplicate samples:", duplicateSamplesError);
}

console.log(
  "🔬 Duplicate Candidate Samples:",
  duplicateSamples?.length ?? 0
);

const sampleCounts = new Map();

(duplicateSamples || []).forEach(s => {
  sampleCounts.set(
    s.inspection_id,
    (sampleCounts.get(s.inspection_id) || 0) + 1
  );
});

console.log(
  "🔬 Candidate Reports:",
  candidateInspectionIds.length,
  "| Reports With Samples:",
  sampleCounts.size,
  "| Total Samples:",
  duplicateSamples?.length ?? 0
);

// 🔬 Compare pallet and sample combinations
const samplesByInspection = new Map();

(duplicateSamples || []).forEach(s => {
  if (!samplesByInspection.has(s.inspection_id)) {
    samplesByInspection.set(s.inspection_id, []);
  }

  samplesByInspection.get(s.inspection_id).push(
    `${s.pallet_number}|${s.sample_number}`
  );
});

const confirmedSampleMatches = possibleDuplicates.filter(group => {
  const signatures = group.map(inspection => {
    const samples = samplesByInspection.get(inspection.id) || [];

    return JSON.stringify([...samples].sort());
  });

  return signatures[0] !== "[]" &&
    signatures.every(signature => signature === signatures[0]);
});

// 🫘 QA MANAGEMENT — PENDING DUPLICATE REVIEWS
const pendingDuplicateGroups = confirmedSampleMatches.filter(group => {
  return !group.every(inspection =>
    inspectionValidations.some(
      v => v.inspection_id === inspection.id
    )
  );
});

console.log(
  "🔎 Pending Duplicate Reviews:",
  pendingDuplicateGroups.length
);

console.log(
  "🔬 Possible Duplicates — Matching Samples:",
  confirmedSampleMatches.length
);

// 🔬 Make duplicate groups available for QC review
window.qaDuplicateReviewGroups = confirmedSampleMatches;

console.log(
  "🔐 QA Inspection Validations:",
  inspectionValidations.length
);

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
    <button
  type="button"
  class="secondaryBtn"
  onclick="backToQAHome()"
  style="margin-bottom:20px;">
  ← Back to QA Management
</button>
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
            <!-- 🔬 QA MANAGEMENT — POSSIBLE DUPLICATES -->
      <div class="qaPanel" style="margin-top:24px; ${canValidateInspections && pendingDuplicateGroups.length > 0 ? "" : "display:none;"}">
        <h3>🔎 Possible Duplicate Inspections</h3>

        <p style="color:#64748b;">
          Inbound inspections with matching lot, container,
          grower, variety and sample identifiers.
          Pending QC validation.
        </p>

        <div class="qaTableWrap" style="margin-top:18px;">
          <table class="qaTable">
            <thead>
              <tr>
                <th>Container</th>
                <th>Lot</th>
                <th>Grower</th>
                <th>Variety</th>
                <th>IdSheets</th>
                <th>Status</th>
                ${canValidateInspections ? "<th>Action</th>" : ""}
              </tr>
            </thead>

            <tbody>
              ${pendingDuplicateGroups.map(group => `
                <tr>
                  <td>${escapeHtml(group[0].container)}</td>
                  <td>${escapeHtml(group[0].lot_number || group[0].receiving_entry)}</td>
                  <td>${escapeHtml(group[0].grower)}</td>
                  <td>${escapeHtml(group[0].variety)}</td>
                  <td>${group.map(r => escapeHtml(r.source_sheet_id)).join(" / ")}</td>
                  <td>
 ${
  (() => {
    const latest = group.map(r =>
      inspectionValidations.find(v =>
        v.inspection_id === r.id
      )
    );

    if (latest.every(v => !v)) {
      return "🟠 Pending Review";
    }

    if (latest.some(v => !v)) {
      return "🟡 Partially Validated";
    }

    const valid = latest.filter(
      v => v.validation_status === "valid"
    ).length;

    const excluded = latest.filter(
      v => v.validation_status === "excluded"
    ).length;

    return `✅ Validated — ${valid} Valid / ${excluded} Excluded`;
  })()
}
</td>
${canValidateInspections ? `
  <td>
    <button
      type="button"
      class="qaReviewBtn"
      data-group-index="${confirmedSampleMatches.indexOf(group)}"
      onclick="window.openQADuplicateReview(Number(this.dataset.groupIndex))"
      title="Review duplicate inspection reports"
    >
      🔍 Review
    </button>
  </td>
` : ""}
</tr>
`).join("")}
</tbody>
</table>
</div>

        <p style="margin-top:12px; color:#64748b; font-size:13px;">
          ${pendingDuplicateGroups.length} groups pending QC validation.
          No inspections have been automatically excluded.
        </p>
      </div>

    <div style="display:flex; justify-content:flex-end; margin-bottom:16px;">
    <button
    type="button"
    class="primaryBtn"
    id="qaCreateReinspectionRequest"
    >
    📋 Create Reinspection Request
    </button>
    </div>

  <h3>📦 Current Storage Inventory</h3>
  <p style="color:#64748b;">
    Active Famous inventory · Storage Quality Monitoring
  </p>

  <div class="qaTableWrap" style="margin-top:18px;">
    <table class="qaTable">
      <thead>
        <tr>
          <th>☑</th>
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
<td onclick="event.stopPropagation()">
  <input
    type="checkbox"
    class="qaReinspectionSelect"
    data-group-index="${index}"
  >
</td>
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
  <td colspan="10" style="padding:16px; background:#f8fafc;">

    <div style="font-weight:600; margin-bottom:12px;">
      📦 Pallet Details — ${group.pallets.size} pallets
    </div>

    <div class="qaTableWrap">
      <table class="qaTable">
        <thead>
          <tr>
            <th>☑</th>
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
    <td>
    <input
    type="checkbox"
    class="qaPalletSelect"
    data-pallet-id="${escapeHtml(r.pallet)}"
    data-group-index="${index}"
    >
    </td>
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

     document.getElementById("qaCreateReinspectionRequest")
    ?.addEventListener("click", () => {

    const selectedLots = [
      ...document.querySelectorAll(".qaReinspectionSelect:checked")
    ];

    const selectedPallets = [
  ...document.querySelectorAll(".qaPalletSelect:checked")
];

console.table(
  selectedPallets.map(pallet => {
    const group = window.qaGroupedInventory?.[
      Number(pallet.dataset.groupIndex)
    ];

const palletData = group?.rows.find(
  r => String(r.pallet).trim() === pallet.dataset.palletId
);

    return {
      palletId: pallet.dataset.palletId,
      po: group?.po,
      gs1lot: group?.lot,
      grower: group?.grower,
      variety: group?.variety
    };
  })
);

alert(
  `${selectedLots.length} lot(s) selected.\n` +
  `${selectedPallets.length} specific pallet(s) selected.`
);

    });

};

// 🔬 QA MANAGEMENT — INSPECTION REVIEW
window.openQADuplicateReview = async function (groupIndex) {
  if (!hasPermission("inspections.validate")) {
    alert("You do not have permission to validate inspections.");
    return;
  }

  const group = window.qaDuplicateReviewGroups?.[groupIndex];
  window.qaActiveReviewGroup = group;

  if (!group) {
    console.error("QC review group not found:", groupIndex);
    return;
  }

// 🔬 Load samples for inspection comparison
const inspectionIds = group.map(r => r.id);

const { data: reviewSamples, error: reviewSamplesError } =
  await supabaseClient
    .from("qc_inspection_samples")
    .select("id, inspection_id, pallet_number, sample_number")
    .in("inspection_id", inspectionIds);

if (reviewSamplesError) {
  console.error("❌ Error loading review samples:", reviewSamplesError);
  return;
}

console.log("🔬 Review Samples Loaded:", reviewSamples.length);

// 🔬 Load defects for both inspection reports
const sampleIds = reviewSamples.map(s => s.id);

const { data: reviewDefects, error: reviewDefectsError } =
  await supabaseClient
    .from("qc_inspection_defects")
    .select("sample_id, defect_name, defect_value, unit")
    .in("sample_id", sampleIds);

if (reviewDefectsError) {
  console.error("❌ Error loading review defects:", reviewDefectsError);
  return;
}

console.log("🔬 Review Defects Loaded:", reviewDefects.length);

// 🍇 Compare Shatter (%) by inspection
const shatterComparison = group.map(inspection => {
  const sampleIds = reviewSamples
    .filter(s => s.inspection_id === inspection.id)
    .map(s => s.id);

  const values = reviewDefects
    .filter(d =>
      sampleIds.includes(d.sample_id) &&
      d.defect_name === "Shatter (%)"
    )
    .map(d => Number(d.defect_value))
    .filter(Number.isFinite);

  return {
    IdSheet: inspection.source_sheet_id,
    Samples: sampleIds.length,
    ShatterReadings: values.length,
    AverageShatter: values.length
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) + "%"
      : "No data",
    Minimum: values.length ? Math.min(...values) : "—",
    Maximum: values.length ? Math.max(...values) : "—"
  };
});

console.table(shatterComparison);

// 🔬 QA MANAGEMENT — ALL DEFECTS COMPARISON
const defectTypes = [...new Map(
  reviewDefects.map(d => [
    `${d.defect_name}|${d.unit ?? ""}`,
    {
      name: d.defect_name,
      unit: d.unit
    }
  ])
).values()];

console.log(
  "🔬 Different Defect Types:",
  defectTypes.length
);

console.table(defectTypes);

// 🔬 Compare all inspection measurements
const allMeasurementsComparison = defectTypes.map(type => {
  const result = {
    Measurement: type.name,
    Unit: type.unit || "—"
  };

  group.forEach(inspection => {
    const sampleIds = new Set(
      reviewSamples
        .filter(s => s.inspection_id === inspection.id)
        .map(s => s.id)
    );

    const values = reviewDefects
      .filter(d =>
        sampleIds.has(d.sample_id) &&
        d.defect_name === type.name &&
        d.unit === type.unit
      )
      .map(d => d.defect_value)
      .filter(v => v !== null && v !== "");

    const numbers = values.map(Number);

    result[`IdSheet ${inspection.source_sheet_id}`] =
      !values.length
        ? "No data"
        : numbers.every(Number.isFinite) &&
          type.name !== "Pallet Type"
          ? (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)
          : [...new Set(values)].join(", ");
  });

  return result;
});

console.table(allMeasurementsComparison);

// 🔬 QA MANAGEMENT — SAMPLE-LEVEL COMPARISON
const sampleMeasurements = new Map();

reviewSamples.forEach(sample => {
  const inspection = group.find(
    r => r.id === sample.inspection_id
  );

  if (!inspection) return;

  const sampleKey = [
    String(sample.pallet_number ?? "").trim().toUpperCase(),
    String(sample.sample_number ?? "").trim()
  ].join("|");

  const measurements = reviewDefects
    .filter(d => d.sample_id === sample.id)
    .map(d => ({
      name: d.defect_name,
      value: d.defect_value,
      unit: d.unit
    }));

  sampleMeasurements.set(
    `${inspection.source_sheet_id}|${sampleKey}`,
    measurements
  );
});

console.log(
  "🔬 Sample Measurement Groups:",
  sampleMeasurements.size
);

// 🔬 Compare individual measurements between reports
const sampleDifferences = [];

if (group.length === 2) {
  const [reportA, reportB] = group;

  const prefixA = `${reportA.source_sheet_id}|`;
  const prefixB = `${reportB.source_sheet_id}|`;

  for (const [key, measurementsA] of sampleMeasurements) {
    if (!key.startsWith(prefixA)) continue;

    const sampleKey = key.slice(prefixA.length);
    const measurementsB = sampleMeasurements.get(prefixB + sampleKey);

    if (!measurementsB) continue;

    const measurementNames = new Set([
      ...measurementsA.map(m => `${m.name}|${m.unit ?? ""}`),
      ...measurementsB.map(m => `${m.name}|${m.unit ?? ""}`)
    ]);

    for (const measurementKey of measurementNames) {
      const getValues = measurements =>
        measurements
          .filter(m => `${m.name}|${m.unit ?? ""}` === measurementKey)
          .map(m => String(m.value ?? ""))
          .sort();

      const valuesA = getValues(measurementsA);
      const valuesB = getValues(measurementsB);

      if (JSON.stringify(valuesA) !== JSON.stringify(valuesB)) {
        sampleDifferences.push({
          PalletSample: sampleKey,
          Measurement: measurementKey.split("|")[0],
          [reportA.source_sheet_id]: valuesA.join(", ") || "—",
          [reportB.source_sheet_id]: valuesB.join(", ") || "—"
        });
      }
    }
  }
}

console.log("🔬 Individual Measurement Differences:", sampleDifferences.length);
console.table(sampleDifferences);

  console.table(
    group.map(r => ({
      IdSheet: r.source_sheet_id,
      Container: r.container,
      Lot: r.lot_number || r.receiving_entry,
      Grower: r.grower,
      Variety: r.variety
    }))
  );

  // 🔬 QA MANAGEMENT — REVIEW WINDOW
document.getElementById("qaDuplicateModal")?.remove();

const modal = document.createElement("div");
modal.id = "qaDuplicateModal";

modal.style.cssText = `
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  display: flex;
  align-items: safe center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
`;

modal.innerHTML = `
  <div style="
  background:white;
  padding:20px;
  border-radius:12px;
  width:100%;
  max-width:900px;
  max-height:85vh;
  overflow-y:auto;
  box-sizing:border-box;
">
    <h2>🔬 Inspection Review</h2>
    <p>Compare inspection reports before validation.</p>
    <div style="margin:16px 0; overflow-x:auto;">
  <h3>🔬 Inspection Measurements Comparison</h3>

  <table class="qaTable">
    <thead>
      <tr>
        <th>Measurement</th>
        <th>Unit</th>
        ${group.map(r => `
          <th>IdSheet ${escapeHtml(r.source_sheet_id)}</th>
        `).join("")}
      </tr>
    </thead>

    <tbody>
      ${allMeasurementsComparison.map(row => {
        const values = group.map(
          r => row[`IdSheet ${r.source_sheet_id}`]
        );

        const isDifferent = new Set(values).size > 1;

        return `
          <tr style="${isDifferent ? 'background:#fff3e0;' : ''}">
            <td>${escapeHtml(row.Measurement)}</td>
            <td>${escapeHtml(row.Unit)}</td>
            ${values.map(value => `
              <td style="${isDifferent ? 'font-weight:700;' : ''}">
                ${escapeHtml(String(value ?? "—"))}
              </td>
            `).join("")}
          </tr>
        `;
      }).join("")}
    </tbody>
  </table>

  <p style="margin-top:12px; color:#64748b; font-size:13px;">
    Highlighted rows indicate differences between inspection averages.
    Values are displayed using their recorded measurement units.
  </p>
</div>
<div style="margin:20px 0; overflow-x:auto;">
  <h3>🔎 Individual Measurement Differences</h3>

  ${sampleDifferences.length ? `
    <table class="qaTable">
      <thead>
        <tr>
          <th>Pallet / Sample</th>
          <th>Measurement</th>
          ${group.map(r => `
            <th>IdSheet ${escapeHtml(r.source_sheet_id)}</th>
          `).join("")}
        </tr>
      </thead>

      <tbody>
        ${sampleDifferences.map(row => `
          <tr>
            <td>${escapeHtml(row.PalletSample)}</td>
            <td>${escapeHtml(row.Measurement)}</td>
            ${group.map(r => `
              <td>${escapeHtml(
                String(row[r.source_sheet_id] ?? "—")
              )}</td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  ` : `
    <p>No individual measurement differences detected.</p>
  `}
</div>
    <div style="display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:20px 0;">
  ${group.map(r => `
    <div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px;">
      <h3>📋 IdSheet ${escapeHtml(r.source_sheet_id)}</h3>
      <p><strong>Container:</strong> ${escapeHtml(r.container)}</p>
      <p><strong>Lot:</strong> ${escapeHtml(r.lot_number || r.receiving_entry)}</p>
      <p><strong>Variety:</strong> ${escapeHtml(r.variety)}</p>
      <p><strong>Grower:</strong> ${escapeHtml(r.grower)}</p>
    </div>
  `).join("")}
</div>

<!-- 🔐 QC VALIDATION DECISION -->
<div style="margin:20px 0; padding:16px; border:1px solid #e2e8f0; border-radius:10px;">

  <h3>🔐 QC Validation Decision</h3>

  <p style="color:#64748b; font-size:13px;">
    Select which inspection reports should be considered valid.
  </p>

  <select id="qaValidationDecision"
          style="width:100%; padding:10px; margin:12px 0;">

    <option value="">Select a decision...</option>

    ${group.map(r => `
      <option value="${escapeHtml(r.id)}">
        Keep IdSheet ${escapeHtml(r.source_sheet_id)}
      </option>
    `).join("")}

    <option value="both">Keep Both Reports</option>

  </select>

  <label for="qaValidationReason">
    <strong>Validation Reason</strong>
  </label>

  <textarea
    id="qaValidationReason"
    rows="3"
    placeholder="Explain the reason for this decision..."
    style="width:100%; padding:10px; margin-top:8px; box-sizing:border-box;"
  ></textarea>

  <p style="font-size:12px; color:#64748b; margin-top:10px;">
    Validation decisions are recorded with user, date, and reason.
    Original inspection reports are preserved.
  </p>

<button
  type="button"
  id="qaSaveValidation"
  style="margin-top:12px; padding:10px 16px;"
>
  💾 Save Validation
</button>

</div>

    <button type="button" id="qaCloseReview">Close</button>
  </div>
`;

document.body.appendChild(modal);

modal.querySelector("#qaCloseReview").onclick = () => modal.remove();
// 🔐 Connect validation button
modal.querySelector("#qaSaveValidation").onclick =
  window.saveQADuplicateValidation;
};

// 🔐 QA MANAGEMENT — VALIDATION SAVE HANDLER
window.saveQADuplicateValidation = async function () {
  if (!hasPermission("inspections.validate")) {
    alert("You do not have permission to validate inspections.");
    return;
  }

  console.log("🔐 QC validation permission verified.");
  const decision = document.getElementById("qaValidationDecision")?.value;
const reason = document.getElementById("qaValidationReason")?.value.trim();

if (!decision || !reason) {
  alert("Please select a decision and enter a validation reason.");
  return;
}

console.log("🔐 QC Validation Preview:", {
  decision,
  reason
});

// 🔐 Determine which reports are valid or excluded
const group = window.qaActiveReviewGroup || [];

if (!group.length) {
  alert("No inspection group selected.");
  return;
}

if (decision !== "both" && !group.some(r => r.id === decision)) {
  alert("Invalid inspection selection.");
  return;
}

const validationPreview = group.map(r => ({
  IdSheet: r.source_sheet_id,
  InspectionId: r.id,
  Status: decision === "both" || decision === r.id
    ? "valid"
    : "excluded",
  Reason: reason
}));

console.table(validationPreview);
// 🔐 Prepare validation records for Supabase
const validationRecords = group.map(r => ({
  inspection_id: r.id,
  validation_status:
    decision === "both" || decision === r.id
      ? "valid"
      : "excluded",
  related_inspection_id:
    group.find(other => other.id !== r.id)?.id || null,
  validation_reason: reason
}));

console.log(
  "🔐 Supabase Validation Records — Preview Only:",
  validationRecords
);
// 🔐 Verify the selected inspection group
console.log(
  "🔐 Validation Group:",
  group.map(r => r.source_sheet_id).join(" / ")
);

// 🔐 Prevent simultaneous validation submissions
if (window.qaValidationSaving) return;

// 🔐 Save both validation decisions atomically
const confirmed = window.confirm(
  "Save this QC validation decision?\n\n" +
  "This will affect which reports are considered valid."
);

if (!confirmed) return;
// 🔐 Lock validation while saving
window.qaValidationSaving = true;

try {
  const { error } = await supabaseClient.rpc(
    "save_qc_duplicate_validation",
    {
      p_inspection_a: group[0].id,
      p_inspection_b: group[1].id,
      p_keep_inspection: decision === "both" ? null : decision,
      p_reason: reason
    }
  );

  if (error) throw error;

  alert("QC validation saved successfully.");
  document.getElementById("qaDuplicateModal")?.remove();
  await window.openQAManagement();

} catch (error) {
  console.error("❌ QC validation failed:", error);
  alert("Validation failed: " + (error.message || "Unexpected error"));

} finally {
  window.qaValidationSaving = false;
}

};
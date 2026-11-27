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

// 🫘 QA MANAGEMENT — FAMOUS LOT FORMAT DIAGNOSTIC

const lotFormatSummary = {
  "GS1 with suffix": 0,
  "No suffix": 0,
  "Empty": 0
};

const lotFormatExamples = {
  "GS1 with suffix": new Set(),
  "No suffix": new Set(),
  "Empty": new Set()
};

inventoryRows.forEach(row => {

  const gs1 = String(row.gs1lot ?? "").trim();

  let format = "No suffix";

  if (!gs1) {
    format = "Empty";
  } else if (/-\d+$/.test(gs1)) {
    format = "GS1 with suffix";
  }

  lotFormatSummary[format]++;

  if (lotFormatExamples[format].size < 5) {
    lotFormatExamples[format].add(gs1 || "(empty)");
  }

});

console.log("🫘 FAMOUS — LOT FORMAT SUMMARY");

console.table(
  Object.entries(lotFormatSummary).map(([format, count]) => ({
    Format: format,
    Records: count,
    Examples: [...lotFormatExamples[format]].join(", ")
  }))
);

  } catch (error) {
    console.error("❌ QA Inventory Load Error:", error);
  }

  // 🫘 QA MANAGEMENT — AVAILABLE WAREHOUSE LOCATIONS
const qaLocations = [...new Set(
  inventoryRows
    .map(r => String(r.location || "").trim())
    .filter(Boolean)
)].sort();

// 🫘 QA MANAGEMENT — SELECTED LOCATION
window.qaSelectedLocation = window.qaSelectedLocation || "";

// 🫘 QA MANAGEMENT — FILTER INVENTORY BY LOCATION
if (window.qaSelectedLocation) {
  inventoryRows = inventoryRows.filter(
    r => String(r.location || "").trim() === window.qaSelectedLocation
  );
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
// 🫘 QA MANAGEMENT — INVENTORY FILTERS
window.qaInventoryFilter = window.qaInventoryFilter || "ALL";
window.qaInventorySearch = window.qaInventorySearch || "";

// 🫘 QA MANAGEMENT — WALMART SCAN FROM ARRIVAL HISTORY

const { data: walmartScanRecords, error: walmartScanError } =
  await supabaseClient
    .from("walmart_scan_verifications")
    .select(`
      result,
      verified_at,
      manifest_line_id,
      arrival_manifest_lines (
        po,
        lot,
        pallet_number,
        grower,
        variety
      )
    `);

if (walmartScanError) {
  console.error("❌ QA Walmart Scan Load Error:", walmartScanError);
}

console.log(
  "🫘 QA WALMART SCAN RECORDS:",
  walmartScanRecords?.length || 0,
  walmartScanRecords
);

console.table(
  (walmartScanRecords || []).map(record => {
    const manifest = record.arrival_manifest_lines;

    const matchingPallet = inventoryRows.find(row =>
      String(row.pallet || "").trim() ===
        String(manifest?.pallet_number || "").trim() &&
      String(row.lot || "").trim() ===
        String(manifest?.po || "").trim() &&
      String(row.gs1lot || "").trim() ===
        String(manifest?.lot || "").trim()
    );

    return {
      pallet: manifest?.pallet_number,
      po: manifest?.po,
      gs1: manifest?.lot,
      result: record.result,
      inFamous: matchingPallet ? "YES" : "NO"
    };
  })
);

// 🫘 WALMART SCAN — MATCH VERIFIED PALLETS TO FAMOUS

const walmartScanByPallet = new Map();

(walmartScanRecords || []).forEach(record => {
  const manifest = record.arrival_manifest_lines;
  if (!manifest) return;

  const key = [
    manifest.po,
    manifest.lot,
    manifest.pallet_number
  ].map(v => String(v || "").trim()).join("|");

  const existing = walmartScanByPallet.get(key);

  if (
    !existing ||
    new Date(record.verified_at) > new Date(existing.verified_at)
  ) {
    walmartScanByPallet.set(key, record);
  }
});

window.qaWalmartScanByPallet = walmartScanByPallet;

console.log(
  "🫘 WALMART SCAN — INDEXED PALLETS:",
  walmartScanByPallet.size
);

// 🫘 QA MANAGEMENT — LOAD REINSPECTION RULES

const { data: qaReinspectionRules, error: qaRulesError } =
  await supabaseClient
    .from("qa_reinspection_rules")
    .select(`
      commodity,
      origin,
      variety,
      condition_score,
      min_days,
      max_days
    `);

if (qaRulesError) {
  console.error("❌ Reinspection Rules Error:", qaRulesError);
}

const reinspectionRules = qaReinspectionRules || [];

console.log(
  "🫘 REINSPECTION ENGINE — RULES LOADED:",
  reinspectionRules.length
);

// 🫘 QA MANAGEMENT — LOAD INSPECTION VALIDATIONS
const inspectionValidations = await loadQCInspectionValidations();
const canValidateInspections = hasPermission("inspections.validate");

// 🫘 REINSPECTION ENGINE — INSPECTION SCORE STRUCTURE

const { data: qaScoreSamples, error: qaScoreError } =
  await supabaseClient
    .from("qc_inspection_samples")
    .select("*")
    .limit(3);

if (qaScoreError) {
  console.error("❌ Inspection Score Structure Error:", qaScoreError);
} else {
  console.log(
    "🫘 REINSPECTION ENGINE — SAMPLE FIELDS:",
    Object.keys(qaScoreSamples?.[0] || {})
  );

  console.table(qaScoreSamples || []);
}

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

// 🫘 REINSPECTION ENGINE — LOAD INSPECTION SAMPLE SCORES

const qaInspectionIds = (inspectionHeaders || [])
  .map(r => r.id)
  .filter(Boolean);

const qaInspectionSamples = [];

let qaSampleLoadFailed = false;

for (let i = 0; i < qaInspectionIds.length; i += 100) {

  const batch = qaInspectionIds.slice(i, i + 100);

  const { data, error } = await supabaseClient
    .from("qc_inspection_samples")
    .select(`
  id,
  inspection_id,
  pallet_number,
  lot_number,
  origin,
  quality,
  condition,
  qc_grade,
  comments
`)
    .in("inspection_id", batch);

  if (error) {
    console.error("❌ Reinspection Sample Load Error:", error);
    qaSampleLoadFailed = true;
    break;
  }

  qaInspectionSamples.push(...(data || []));
}

console.log(
  "🫘 REINSPECTION ENGINE — SAMPLES LOADED:",
  qaInspectionSamples.length
);

if (qaSampleLoadFailed) {
  console.warn(
    "⚠️ Reinspection sample data incomplete. Do not calculate due dates."
  );
}

// 🫘 QA MANAGEMENT — LOAD PALLET TYPES FROM DECOFRUT

const qaSampleIds = qaInspectionSamples
  .map(sample => sample.id)
  .filter(Boolean);

const qaPalletTypeRecords = [];
let qaPalletTypeLoadFailed = false;

for (let i = 0; i < qaSampleIds.length; i += 100) {

  const batch = qaSampleIds.slice(i, i + 100);

  const { data, error } = await supabaseClient
    .from("qc_inspection_defects")
    .select("sample_id, defect_value")
    .eq("defect_name", "Pallet Type")
    .in("sample_id", batch);

  if (error) {
    console.error("❌ Pallet Type Load Error:", error);
    qaPalletTypeLoadFailed = true;
    break;
  }

  qaPalletTypeRecords.push(...(data || []));
}

const qaPalletTypesBySample = new Map();

qaPalletTypeRecords.forEach(record => {

  const value = String(record.defect_value ?? "").trim();

  if (value) {
    qaPalletTypesBySample.set(
      String(record.sample_id),
      value
    );
  }

});

qaInspectionSamples.forEach(sample => {
  sample.qaPalletType =
    qaPalletTypesBySample.get(String(sample.id)) || null;
});

// 🫘 REINSPECTION ENGINE — SAMPLES BY INSPECTION

const qaSamplesByInspection = new Map();

qaInspectionSamples.forEach(sample => {

  const inspectionId = String(sample.inspection_id);

  if (!qaSamplesByInspection.has(inspectionId)) {
    qaSamplesByInspection.set(inspectionId, []);
  }

  qaSamplesByInspection.get(inspectionId).push(sample);

});

// 🫘 ATTACH SAMPLE SCORES TO INSPECTION HEADERS

(inspectionHeaders || []).forEach(inspection => {

  const samples =
    qaSamplesByInspection.get(String(inspection.id)) || [];

  const conditions = samples
    .map(sample => Number(sample.condition))
    .filter(condition =>
      Number.isInteger(condition) &&
      condition >= 1 &&
      condition <= 4
    );

  inspection.qaSamples = samples;

  inspection.qaConditions = [...new Set(conditions)]
    .sort((a, b) => a - b);

  inspection.qaWorstCondition = conditions.length
    ? Math.max(...conditions)
    : null;

  inspection.qaConditionCoverage =
    `${conditions.length}/${samples.length}`;

});

// 🫘 REINSPECTION ENGINE — PALLET CONDITION BY INSPECTION

(inspectionHeaders || []).forEach(inspection => {

  const palletConditions = new Map();

  (inspection.qaSamples || []).forEach(sample => {

    const pallet = String(sample.pallet_number ?? "")
      .trim()
      .toUpperCase();

    const condition = Number(sample.condition);

    if (
      !pallet ||
      sample.condition === null ||
      sample.condition === undefined ||
      sample.condition === "" ||
      !Number.isInteger(condition) ||
      condition < 1 ||
      condition > 4
    ) return;

    if (!palletConditions.has(pallet)) {
      palletConditions.set(pallet, []);
    }

    palletConditions.get(pallet).push(condition);

  });

  inspection.qaPalletConditions = new Map(
    [...palletConditions.entries()].map(([pallet, conditions]) => [
      pallet,
      Math.max(...conditions)
    ])
  );

});

// 🫘 REINSPECTION ENGINE — CHRONOLOGICAL INSPECTION HISTORY

const qaInspectionHistory = (inspectionHeaders || [])
  .filter(r =>
    r.inspection_date &&
    ["INBOUND", "REINSPECTION"].includes(
      String(r.inspection_type || "").trim().toUpperCase()
    )
  )
  .sort((a, b) =>
    b.inspection_date.localeCompare(a.inspection_date)
  );

console.log(
  "🫘 REINSPECTION ENGINE — INSPECTION HISTORY:",
  qaInspectionHistory.length
);

// 🫘 QA MANAGEMENT — INSPECTION HISTORY DIAGNOSTIC

const qaInspectionTypes = {};

(inspectionHeaders || []).forEach(inspection => {

  const type = String(
    inspection.inspection_type || "UNKNOWN"
  ).trim();

  if (!qaInspectionTypes[type]) {
    qaInspectionTypes[type] = {
      type,
      total: 0,
      withDate: 0,
      withLot: 0,
      withContainer: 0
    };
  }

  const summary = qaInspectionTypes[type];

  summary.total++;

  if (inspection.inspection_date) {
    summary.withDate++;
  }

  if (inspection.lot_number || inspection.receiving_entry) {
    summary.withLot++;
  }

  if (inspection.container) {
    summary.withContainer++;
  }

});

console.log("🫘 INSPECTION HISTORY — DATA COVERAGE");
console.table(Object.values(qaInspectionTypes));

// 🫘 QA MANAGEMENT — REINSPECTION IDENTIFIERS

const qaReinspectionRecords = (inspectionHeaders || [])
  .filter(r =>
    String(r.inspection_type || "")
      .trim()
      .toLowerCase() === "reinspection"
  )
  .map(r => ({
    Date: r.inspection_date,
    PO: r.po_number,
    Lot: r.lot_number,
    ReceivingEntry: r.receiving_entry,
    Grower: r.grower,
    Commodity: r.commodity,
    Variety: r.variety,
    Container: r.container
  }));

console.log("🫘 REINSPECTION — IDENTIFIER REVIEW");
console.table(qaReinspectionRecords);

// 🫘 QA MANAGEMENT — REINSPECTION VS FAMOUS MATCH DIAGNOSTIC

const normalizeMatch = value =>
  String(value ?? "").trim().toUpperCase();

const getBaseGS1 = value =>
  normalizeMatch(value).replace(/-\d+$/, "");

const qaReinspectionMatches = qaReinspectionRecords.map(r => {

  const candidates = inventoryRows.filter(p =>
    getBaseGS1(p.gs1lot) === getBaseGS1(r.Lot) &&
    normalizeMatch(p.grower) === normalizeMatch(r.Grower) &&
    normalizeMatch(p.variety) === normalizeMatch(r.Variety) &&
    ["GP", "GRAPES"].includes(normalizeMatch(p.commodity))
  );

  const groups = new Set(
    candidates.map(p =>
      JSON.stringify([
        p.lot,
        p.gs1lot,
        p.grower,
        p.variety
      ])
    )
  );

  return {
    Date: r.Date,
    DecofrutLot: r.Lot,
    Grower: r.Grower,
    Variety: r.Variety,
    MatchingPallets: new Set(
      candidates.map(p => String(p.pallet || "").trim())
        .filter(Boolean)
    ).size,
    MatchingGroups: groups.size,
    FamousGS1: [
      ...new Set(candidates.map(p => p.gs1lot))
    ].join(", ") || "NOT FOUND",
    Status:
      groups.size === 1 ? "ONE GROUP" :
      groups.size > 1 ? "REVIEW MATCH" :
      "NOT IN LIVE INVENTORY"
  };
});

console.log("🫘 REINSPECTION — FAMOUS MATCH RESULTS");
console.table(qaReinspectionMatches);

// 🫘 REINSPECTION ENGINE — INVENTORY HISTORY MATCHING

const qaNormalize = value =>
  String(value ?? "").trim().toUpperCase();

const qaBaseLot = value =>
  qaNormalize(value).replace(/-\d{2}$/, "");

// 🫘 REINSPECTION ENGINE — EXCLUDE INVALID INSPECTIONS

const excludedInspectionIds = new Set(
  (inspectionValidations || [])
    .filter(validation =>
      String(validation.validation_status || "")
        .trim()
        .toLowerCase() === "excluded"
    )
    .map(validation => String(validation.inspection_id))
);

const qaValidInspectionHistory = qaInspectionHistory.filter(
  inspection =>
    !excludedInspectionIds.has(String(inspection.id))
);

groupedInventory.forEach(group => {

  const exactMatches = qaValidInspectionHistory.filter(inspection =>
    qaNormalize(inspection.lot_number) === qaNormalize(group.lot) &&
    qaNormalize(inspection.grower) === qaNormalize(group.grower) &&
    qaNormalize(inspection.variety) === qaNormalize(group.variety) &&
    (
      ["GP", "GRAPES"].includes(qaNormalize(group.commodity))
        ? qaNormalize(inspection.commodity) === "GRAPES"
        : qaNormalize(inspection.commodity) === qaNormalize(group.commodity)
    )
  );

  // Historical GS1 without verification suffix: candidates only
  const historicalCandidates = qaValidInspectionHistory.filter(inspection =>
    qaNormalize(inspection.lot_number) !== qaNormalize(group.lot) &&
    qaBaseLot(inspection.lot_number) === qaBaseLot(group.lot) &&
    qaNormalize(inspection.grower) === qaNormalize(group.grower) &&
    qaNormalize(inspection.variety) === qaNormalize(group.variety) &&
    (
      ["GP", "GRAPES"].includes(qaNormalize(group.commodity))
        ? qaNormalize(inspection.commodity) === "GRAPES"
        : qaNormalize(inspection.commodity) === qaNormalize(group.commodity)
    )
  );

  group.qaInspectionHistory = exactMatches;
  group.qaHistoricalCandidates = historicalCandidates;

  group.qaLastInspection = exactMatches[0] || null;

  group.qaReinspectionCount = exactMatches.filter(
    inspection =>
      qaNormalize(inspection.inspection_type) === "REINSPECTION"
  ).length;

  // 🫘 REINSPECTION ENGINE — EXACT PALLET MATCHES

  const normalizePallet = value => {
  const pallet = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^[GFJ](?=\d)/, "");

  // Famous: 1000114463 → 114463
  // Decofrut: 114463 → 114463
  if (/^\d+$/.test(pallet) && pallet.length >= 6) {
    return pallet.slice(-6);
  }

  return pallet;
};

  group.rows.forEach(row => {

    const palletId = normalizePallet(row.pallet);

    const matchingInspections = exactMatches
      .filter(inspection =>
        [...(inspection.qaPalletConditions?.keys() || [])]
          .some(pallet =>
            normalizePallet(pallet) === palletId
          )
      )
      .map(inspection => {

        const palletEntry = [
          ...(inspection.qaPalletConditions?.entries() || [])
        ].find(([pallet]) =>
          normalizePallet(pallet) === palletId
        );

        const palletSamples = (inspection.qaSamples || []).filter(sample =>
  normalizePallet(sample.pallet_number) === palletId
);

const qcGrades = [...new Set(
  palletSamples
    .map(sample => {
      const quality = String(sample.quality || "").trim().toUpperCase();
      const condition = sample.condition;

      return /^[A-D]$/.test(quality) &&
        /^[1-4]$/.test(String(condition))
          ? `${quality}${condition}`
          : "";
    })
    .filter(Boolean)
)];

return {
  inspectionId: inspection.id,
  date: inspection.inspection_date,
  type: inspection.inspection_type,
  condition: palletEntry?.[1] ?? null,
  qcGrade: qcGrades.join(", ")
};

      });

    row.qaPalletInspectionHistory = matchingInspections;

    row.qaLastPalletInspection =
      matchingInspections[0] || null;

  });

  }); // 🫘 END INVENTORY HISTORY MATCHING

  // 🫘 REINSPECTION ENGINE — HISTORICAL PALLET MATCH DIAGNOSTIC

const qaHistoricalPalletMatches = [];

groupedInventory.forEach(group => {

  group.rows.forEach(row => {

    const palletId = String(row.pallet ?? "")
      .trim()
      .toUpperCase()
      .replace(/^[GFJ](?=\d)/, "");

    const matches = (group.qaHistoricalCandidates || [])
      .filter(inspection =>
        [...(inspection.qaPalletConditions?.keys() || [])]
          .some(pallet =>
            String(pallet ?? "")
              .trim()
              .toUpperCase()
              .replace(/^[GFJ](?=\d)/, "") === palletId
          )
      );

    if (matches.length) {
      qaHistoricalPalletMatches.push({
        FamousLot: group.lot,
        Pallet: row.pallet,
        InspectionDate: matches[0].inspection_date,
        InspectionType: matches[0].inspection_type
      });
    }

  });

});

console.log(
  "🫘 HISTORICAL PALLET MATCHES:",
  qaHistoricalPalletMatches.length
);

console.table(qaHistoricalPalletMatches.slice(0, 10));

  // 🫘 REINSPECTION ENGINE — PALLET MATCH COVERAGE

const qaPalletMatchSummary = {
  totalPallets: 0,
  matchedPallets: 0,
  unmatchedPallets: 0,
  withReinspection: 0
};

groupedInventory.forEach(group => {
  group.rows.forEach(row => {

    qaPalletMatchSummary.totalPallets++;

    if (row.qaLastPalletInspection) {
      qaPalletMatchSummary.matchedPallets++;

      if (
        row.qaPalletInspectionHistory.some(
          inspection =>
            String(inspection.type).toUpperCase() === "REINSPECTION"
        )
      ) {
        qaPalletMatchSummary.withReinspection++;
      }

    } else {
      qaPalletMatchSummary.unmatchedPallets++;
    }

  });
});

console.log(
  "🫘 REINSPECTION ENGINE — PALLET MATCH COVERAGE"
);

console.table(qaPalletMatchSummary);

// 🫘 REINSPECTION ENGINE — INITIAL PALLET STATUS

groupedInventory.forEach(group => {

  group.rows.forEach(row => {

    const lastInspection = row.qaLastPalletInspection;

    row.qaReinspectionStatus = lastInspection
      ? "PENDING_RULE_EVALUATION"
      : group.qaHistoricalCandidates?.length
        ? "REVIEW_MATCH"
        : "QC_DATA_PENDING";

    row.qaNextReinspectionDate = null;
    row.qaReinspectionDeadline = null;

  });

});

groupedInventory.forEach(group => {

  const lastInspection = group.qaLastInspection;

  const origin = String(
    group.rows.find(r => r.region)?.region || ""
  ).trim().toUpperCase();

  const commodity = String(group.commodity || "")
    .trim().toUpperCase();

  const normalizedCommodity =
    commodity === "GP" ? "GRAPES" : commodity;

  const rule = reinspectionRules.find(r =>
    String(r.commodity || "").trim().toUpperCase() === normalizedCommodity &&
    String(r.origin || "").trim().toUpperCase() === origin &&
    String(r.variety || "").trim().toUpperCase() ===
      String(group.variety || "").trim().toUpperCase() &&
    Number(r.condition_score) ===
      Number(lastInspection?.qaWorstCondition)
  );

  group.qaReinspectionStatus = "QC_DATA_PENDING";
  group.qaNextReinspectionDate = null;
  group.qaReinspectionDeadline = null;

  if (!lastInspection) {
    if (group.qaHistoricalCandidates?.length) {
      group.qaReinspectionStatus = "REVIEW_MATCH";
    }
    return;
  }

  if (!lastInspection.inspection_date || !lastInspection.qaWorstCondition) {
    return;
  }

  if (!rule) {
    group.qaReinspectionStatus = "RULE_MISSING";
    return;
  }

  const lastDate = new Date(`${lastInspection.inspection_date}T12:00:00`);

  const dueDate = new Date(lastDate);
  dueDate.setDate(dueDate.getDate() + Number(rule.min_days));

  const deadline = new Date(lastDate);
  deadline.setDate(deadline.getDate() + Number(rule.max_days));

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  group.qaNextReinspectionDate = dueDate;
  group.qaReinspectionDeadline = deadline;

  if (today < dueDate) {
    group.qaReinspectionStatus = "UP_TO_DATE";
  } else if (today <= deadline) {
    group.qaReinspectionStatus = "DUE";
  } else {
    group.qaReinspectionStatus = "OVERDUE";
  }

});

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

// 🫘 REINSPECTION ENGINE — QUALITY & CONDITION PARSER

const parseQCScore = value => {

  const qc = String(value ?? "")
    .trim()
    .toUpperCase();

  const match = qc.match(/^([A-D])([1-4])$/);

  if (!match) {
    return {
      quality: null,
      condition: null
    };
  }

  return {
    quality: match[1],
    condition: Number(match[2])
  };

};

// 🫘 QA MANAGEMENT — DECOFRUT QC SCORES
const qcRows = await loadDecofrutScoresFromSupabase();

// 🫘 REINSPECTION ENGINE — QC DATA STRUCTURE
console.log("🫘 QC SCORE — AVAILABLE FIELDS");

if (qcRows.length > 0) {
  console.log(Object.keys(qcRows[0]));
  console.table(qcRows.slice(0, 3));
}

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

// 🫘 REINSPECTION ENGINE — CONDITION SCORES BY LOT

const conditions = group.rows
  .map(row => parseQCScore(row.qaQcScore).condition)
  .filter(condition => condition !== null);

group.qaConditions = [...new Set(conditions)]
  .sort((a, b) => a - b);

group.qaWorstCondition = conditions.length
  ? Math.max(...conditions)
  : null;

group.qaConditionCoverage =
  `${conditions.length}/${group.rows.length}`;

  }); // 🫘 END QC SUMMARY BY INVENTORY GROUP

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
        <article class="stat qaFilterCard"
  data-filter="ALL"
  style="cursor:pointer;"
  title="Show all available inventory">
          <b>${new Set(inventoryRows.map(r => String(r.pallet || "").trim()).filter(Boolean)).size}</b>
          <span>Available Pallets</span>
        </article>

        <article class="stat qaFilterCard"
  data-filter="DUE"
  style="cursor:pointer;"
  title="Show lots due for reinspection">
  <b>${groupedInventory.filter(
    group => group.qaReinspectionStatus === "DUE"
  ).length}</b>
  <span>Due for Reinspection</span>
</article>

        <article class="stat qaFilterCard"
  data-filter="OVERDUE"
  style="cursor:pointer;"
  title="Show overdue lots">
  <b>${groupedInventory.filter(
    group => group.qaReinspectionStatus === "OVERDUE"
  ).length}</b>
  <span>Overdue</span>
</article>

        <article class="stat qaFilterCard"
  data-filter="QUALITY_ALERT"
  style="cursor:pointer;"
  title="Show lots with Condition 3 or 4">
  <b>${groupedInventory.filter(group =>
    [3, 4].includes(
      Number(group.qaLastInspection?.qaWorstCondition)
    )
  ).length}</b>
  <span>Quality Alerts</span>
</article>
</div> <!-- 🫘 END QA KPI GRID -->
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

        <div style="margin-bottom:18px;">
        <label for="qaLocationFilter" style="font-weight:600;">
       📍 Location
        </label>

        <select id="qaLocationFilter"
        style="display:block; margin-top:8px; padding:10px; border-radius:10px;">
        <option value="">All Locations</option>
    ${qaLocations.map(loc => `
<option value="${escapeHtml(loc)}" ${loc === window.qaSelectedLocation ? "selected" : ""}>${escapeHtml(loc)}</option>
      `).join("")}
  </select>
</div>

  <h3>📦 Current Storage Inventory</h3>
  <!-- 🫘 QA MANAGEMENT — INVENTORY SEARCH -->
<div style="margin:16px 0;">
  <input
    type="search"
    id="qaInventorySearch"
    placeholder="🔎 Search PO, GS1 Lot, Grower, Variety or Pallet..."
    style="
      width:100%;
      padding:12px 16px;
      border:1px solid #cbd5e1;
      border-radius:10px;
      font-size:14px;
      box-sizing:border-box;
    "
  >
</div>
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
          <th>Last Inspection</th>
          <th>🔬 Reinspections</th>
          <th>Reinspection Status</th>
          <th>Boxes</th>
        </tr>
      </thead>

      <tbody>
 ${groupedInventory.map((group, index) => `
  <tr
    class="qaInventoryGroupRow"
    data-group-index="${index}"
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
<!-- 🫘 REINSPECTION COUNT -->
<td>
  ${
    group.qaReinspectionCount > 1
      ? "🟣"
      : group.qaReinspectionCount === 1
        ? "🔵"
        : "⚪"
  }
  ${group.qaReinspectionCount || 0}
</td>
<td>
  ${
    group.qaReinspectionStatus === "UP_TO_DATE"
  ? "🟢 Up to Date"
  : group.qaReinspectionStatus === "DUE"
    ? "🟡 Due"
    : group.qaReinspectionStatus === "OVERDUE"
      ? "🔴 Overdue"
      : group.qaReinspectionStatus === "RULE_MISSING"
        ? "🟠 Rule Missing"
        : group.qaReinspectionStatus === "REVIEW_MATCH"
          ? "🟠 Review Match"
          : "🔵 QC Data Pending"
  }
</td>
<td>
  ${(() => {
  const lastDate = group.qaLastInspection?.inspection_date || "";

  return lastDate
    ? new Date(`${lastDate}T12:00:00`).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric"
      })
    : "QC Data Pending";
})()}
</td>
      <td>${group.boxes.toLocaleString()}</td>
    </tr>
    <tr class="qaInventoryDetailRow" hidden>
  <td colspan="13" style="padding:16px; background:#f8fafc;">

    <div style="font-weight:600; margin-bottom:12px;">
      📦 Pallet Details — ${group.pallets.size} pallets
    </div>

<!-- 🫘 QA MANAGEMENT — PALLET OPERATIONAL SUMMARY -->

<div style="
  display:flex;
  flex-wrap:wrap;
  align-items:flex-start;
  gap:10px;
  margin-bottom:12px;
">

  <!-- PALLET TYPE -->
  <div style="
    flex:1;
    min-width:180px;
    padding:14px;
    background:#f1f5f9;
    border-radius:10px;
  ">
    <strong>🪵 Pallet Type</strong>
    <div style="margin-top:8px;">
      ${
        (() => {
          const types = [
            ...new Set(
              (group.qaInspectionHistory || [])
                .flatMap(inspection => inspection.qaSamples || [])
                .map(sample => sample.qaPalletType)
                .filter(Boolean)
            )
          ];

          return types.length
            ? types.map(type => escapeHtml(type)).join(", ")
            : "Not Available";
        })()
      }
    </div>
  </div>

  <!-- WALMART BAGS -->
<div style="
  flex:1;
  min-width:180px;
  padding:14px;
  background:#f1f5f9;
  border-radius:10px;
">
  <strong>🛍️ Walmart Bags</strong>

  <div style="margin-top:8px;">
    ${(() => {
      let pass = 0;
      let fail = 0;
      let notVerified = 0;

      group.pallets.forEach(pallet => {
        const key = [
          group.po,
          group.lot,
          pallet
        ].map(v => String(v || "").trim()).join("|");

        const verification = window.qaWalmartScanByPallet?.get(key);
        const result = String(verification?.result || "").toLowerCase();

        if (result === "pass") {
          pass++;
        } else if (result === "fail") {
          fail++;
        } else {
          notVerified++;
        }
      });

      return [
        pass ? `🟢 ${pass} Pass` : "",
        fail ? `🔴 ${fail} Fail` : "",
        notVerified ? `⚪ ${notVerified} Not Verified` : ""
      ].filter(Boolean).join(" · ");
    })()}
  </div>
</div>

  <!-- ADDITIONAL COMMENTS -->
  <div style="
    flex:1;
    min-width:180px;
    padding:14px;
    background:#f1f5f9;
    border-radius:10px;
  ">
    <div style="margin-top:8px;">
  <button
    type="button"
    class="secondaryBtn qaCommentsBtn"
    data-group-index="${index}"
    onclick="event.stopPropagation()"
    style="display:flex;align-items:center;gap:8px;"
  >
    💬 Comments
  </button>
</div>
  </div>

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
            <th>Last QC Date</th>
            <th>Last Condition</th>
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

<td>
  ${r.qaLastPalletInspection?.date
  ? new Date(`${r.qaLastPalletInspection.date}T12:00:00`)
      .toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric"
      })
  : "—"}
</td>

<td>
  ${escapeHtml(r.qaLastPalletInspection?.qcGrade || "—")}
</td>

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

// 🫘 QA MANAGEMENT — INVENTORY SEARCH ENGINE

const qaSearchInput = document.getElementById("qaInventorySearch");

if (qaSearchInput) {

  qaSearchInput.value = window.qaInventorySearch || "";

  qaSearchInput.addEventListener("input", () => {

    const search = qaSearchInput.value.trim().toUpperCase();

    window.qaInventorySearch = qaSearchInput.value;

    document.querySelectorAll(".qaInventoryGroupRow").forEach(row => {

      const index = Number(row.dataset.groupIndex);
      const group = window.qaGroupedInventory?.[index];

      if (!group) return;

      const searchableText = [
        group.po,
        group.lot,
        group.commodity,
        group.variety,
        group.grower,
        ...group.pallets
      ].join(" ").toUpperCase();

      const activeFilter = window.qaInventoryFilter || "ALL";

const matchesCard =
  activeFilter === "ALL" ||
  (activeFilter === "DUE" &&
    group.qaReinspectionStatus === "DUE") ||
  (activeFilter === "OVERDUE" &&
    group.qaReinspectionStatus === "OVERDUE") ||
  (activeFilter === "QUALITY_ALERT" &&
    [3, 4].includes(
      Number(group.qaLastInspection?.qaWorstCondition)
    ));

const matches = searchableText.includes(search) && matchesCard;

      row.style.display = matches ? "" : "none";

      const detailRow = row.nextElementSibling;

      if (detailRow && !matches) {
        detailRow.hidden = true;
      }

      if (detailRow) {
        detailRow.style.display = matches ? "" : "none";
      }

    });

  });

}

// 🫘 QA MANAGEMENT — QUALITY ALERT CARD FILTER

document.querySelector('[data-filter="QUALITY_ALERT"]')
  ?.addEventListener("click", () => {

    const active = window.qaInventoryFilter === "QUALITY_ALERT";

    window.qaInventoryFilter = active ? "ALL" : "QUALITY_ALERT";

    document.querySelectorAll(".qaInventoryGroupRow").forEach(row => {

      const index = Number(row.dataset.groupIndex);
      const group = window.qaGroupedInventory?.[index];

      if (!group) return;

      const isAlert = [3, 4].includes(
        Number(group.qaLastInspection?.qaWorstCondition)
      );

      const matchesSearch = [
        group.po,
        group.lot,
        group.commodity,
        group.variety,
        group.grower,
        ...group.pallets
      ].join(" ").toUpperCase().includes(
        (window.qaInventorySearch || "").trim().toUpperCase()
      );

      const visible =
        (window.qaInventoryFilter === "ALL" || isAlert) &&
        matchesSearch;

      row.style.display = visible ? "" : "none";

      const detailRow = row.nextElementSibling;

      if (detailRow) {
        detailRow.style.display = visible ? "" : "none";

        if (!visible) {
          detailRow.hidden = true;
        }
      }

    });

  });

// 🫘 QA MANAGEMENT — DUE CARD FILTER

document.querySelector('[data-filter="DUE"]')
  ?.addEventListener("click", () => {

    const active = window.qaInventoryFilter === "DUE";

    window.qaInventoryFilter = active ? "ALL" : "DUE";

    document.querySelectorAll(".qaInventoryGroupRow").forEach(row => {

      const index = Number(row.dataset.groupIndex);
      const group = window.qaGroupedInventory?.[index];

      if (!group) return;

      const matchesDue =
        group.qaReinspectionStatus === "DUE";

      const matchesSearch = [
        group.po,
        group.lot,
        group.commodity,
        group.variety,
        group.grower,
        ...group.pallets
      ].join(" ").toUpperCase().includes(
        (window.qaInventorySearch || "").trim().toUpperCase()
      );

      const visible =
        (window.qaInventoryFilter === "ALL" || matchesDue) &&
        matchesSearch;

      row.style.display = visible ? "" : "none";

      const detailRow = row.nextElementSibling;

      if (detailRow) {
        detailRow.style.display = visible ? "" : "none";

        if (!visible) {
          detailRow.hidden = true;
        }
      }

    });

  });

// 🫘 QA MANAGEMENT — OVERDUE CARD FILTER

document.querySelector('[data-filter="OVERDUE"]')
  ?.addEventListener("click", () => {

    const active = window.qaInventoryFilter === "OVERDUE";

    window.qaInventoryFilter = active ? "ALL" : "OVERDUE";

    document.querySelectorAll(".qaInventoryGroupRow").forEach(row => {

      const index = Number(row.dataset.groupIndex);
      const group = window.qaGroupedInventory?.[index];

      if (!group) return;

      const matchesOverdue =
        group.qaReinspectionStatus === "OVERDUE";

      const matchesSearch = [
        group.po,
        group.lot,
        group.commodity,
        group.variety,
        group.grower,
        ...group.pallets
      ].join(" ").toUpperCase().includes(
        (window.qaInventorySearch || "").trim().toUpperCase()
      );

      const visible =
        (window.qaInventoryFilter === "ALL" || matchesOverdue) &&
        matchesSearch;

      row.style.display = visible ? "" : "none";

      const detailRow = row.nextElementSibling;

      if (detailRow) {
        detailRow.style.display = visible ? "" : "none";

        if (!visible) {
          detailRow.hidden = true;
        }
      }
    });
  });

// 🫘 QA MANAGEMENT — SHOW ALL INVENTORY

document.querySelector('[data-filter="ALL"]')
  ?.addEventListener("click", () => {

    window.qaInventoryFilter = "ALL";
    window.qaInventorySearch = "";

    const searchInput = document.getElementById("qaInventorySearch");
    if (searchInput) searchInput.value = "";

    document.querySelectorAll(".qaInventoryGroupRow").forEach(row => {

      row.style.display = "";

      const detailRow = row.nextElementSibling;

      if (detailRow) {
        detailRow.style.display = "";
        detailRow.hidden = true;
      }

    });

  });

// 🫘 QA MANAGEMENT — ACTIVE FILTER CARD HIGHLIGHT

function updateQAFilterCardHighlight() {
  const activeFilter = window.qaInventoryFilter || "ALL";

  document.querySelectorAll(".qaFilterCard").forEach(card => {
    const isActive = card.dataset.filter === activeFilter;

    card.style.border = isActive
      ? "2px solid #7c3aed"
      : "2px solid transparent";

    card.style.boxShadow = isActive
      ? "0 0 0 3px rgba(124,58,237,0.12)"
      : "";

    card.style.transition = "all 0.2s ease";
  });
}

// 🫘 QA MANAGEMENT — UPDATE ACTIVE CARD HIGHLIGHT

document.querySelectorAll(".qaFilterCard").forEach(card => {
  card.addEventListener("click", () => {
    updateQAFilterCardHighlight();
  });
});

// Highlight current selection when QA loads
updateQAFilterCardHighlight();

// 🫘 QA MANAGEMENT — COMMENTS MODAL

document.querySelectorAll(".qaCommentsBtn").forEach(button => {

  button.addEventListener("click", async event => {

    event.stopPropagation();

    const groupIndex = Number(button.dataset.groupIndex);
    const group = window.qaGroupedInventory?.[groupIndex];

    if (!group) return;

    document.getElementById("qaCommentsModal")?.remove();

    const modal = document.createElement("div");
    modal.id = "qaCommentsModal";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      background:rgba(15,23,42,0.65);
      display:flex;
      align-items:center;
      justify-content:center;
      z-index:9999;
      padding:20px;
    `;

    modal.innerHTML = `
      <div style="
        background:white;
        padding:24px;
        border-radius:14px;
        width:100%;
        max-width:600px;
        max-height:85vh;
        overflow-y:auto;
        box-sizing:border-box;
      ">

        <h3>💬 QA Comments</h3>

        <p style="margin:12px 0;">
          <strong>GS1:</strong> ${escapeHtml(group.lot)}<br>
          <strong>Grower:</strong> ${escapeHtml(group.grower)}<br>
          <strong>Variety:</strong> ${escapeHtml(group.variety)}
        </p>

        <h4>Comment History</h4>

        <div id="qaCommentsHistory" style="
          background:#f8fafc;
          padding:14px;
          border-radius:8px;
          margin-bottom:18px;
          color:#64748b;
        ">
          Comments not loaded yet.
        </div>

        <label for="qaNewComment">
          <strong>Add Comment</strong>
        </label>

        <textarea
          id="qaNewComment"
          rows="4"
          placeholder="Enter QC observations..."
          style="
            width:100%;
            padding:12px;
            margin-top:8px;
            border:1px solid #cbd5e1;
            border-radius:8px;
            box-sizing:border-box;
          "
        ></textarea>

        <div style="
          display:flex;
          justify-content:flex-end;
          gap:10px;
          margin-top:18px;
        ">
        <button
        type="button"
        class="primaryBtn"
        id="qaSaveComment">
      💾 Save Comment
        </button>

          <button
            type="button"
            class="secondaryBtn"
            id="qaCloseComments">
            Close
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

// 🫘 QA MANAGEMENT — LOAD COMMENT HISTORY

const historyContainer = modal.querySelector("#qaCommentsHistory");

const { data: qaComments, error: qaCommentsError } =
  await supabaseClient
    .from("qa_inventory_comments")
    .select("comment, created_at, created_by")
    .eq("po", String(group.po))
    .eq("gs1_lot", String(group.lot))
    .eq("grower", String(group.grower))
    .eq("variety", String(group.variety))
    .is("pallet_number", null)
    .order("created_at", { ascending: false });

if (qaCommentsError) {
  console.error("❌ QA Comments Load Error:", qaCommentsError);
  historyContainer.textContent = "Unable to load comments.";
} else if (!qaComments?.length) {
  historyContainer.textContent = "No comments recorded yet.";
} else {
  historyContainer.innerHTML = qaComments.map(item => `
    <div style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
      <small style="color:#64748b;">
        ${new Date(item.created_at).toLocaleString()}
      </small>
      <div style="margin-top:6px;">
        ${escapeHtml(item.comment)}
      </div>
    </div>
  `).join("");
}

// 🫘 QA MANAGEMENT — SAVE OPERATIONAL COMMENT

modal.querySelector("#qaSaveComment").addEventListener("click", async () => {

  const commentInput = modal.querySelector("#qaNewComment");
  const saveButton = modal.querySelector("#qaSaveComment");
  const comment = commentInput.value.trim();

  if (!comment) {
    alert("Please enter a comment.");
    return;
  }

  if (saveButton.disabled) return;

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {

    const { data: authData, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError || !authData?.user) {
      throw new Error("You must be logged in to save comments.");
    }

    const { error } = await supabaseClient
      .from("qa_inventory_comments")
      .insert({
        location: window.qaSelectedLocation || "All Locations",
        po: String(group.po),
        gs1_lot: String(group.lot),
        grower: String(group.grower),
        variety: String(group.variety),
        pallet_number: null,
        comment: comment,
        created_by: authData.user.id
      });

    if (error) throw error;

    commentInput.value = "";

    // 🫘 REFRESH COMMENT HISTORY
    const { data: updatedComments, error: refreshError } =
      await supabaseClient
        .from("qa_inventory_comments")
        .select("comment, created_at, created_by")
        .eq("po", String(group.po))
        .eq("gs1_lot", String(group.lot))
        .eq("grower", String(group.grower))
        .eq("variety", String(group.variety))
        .is("pallet_number", null)
        .order("created_at", { ascending: false });

    if (refreshError) throw refreshError;

    const historyContainer = modal.querySelector("#qaCommentsHistory");

    historyContainer.innerHTML = (updatedComments || []).map(item => `
      <div style="
        padding:10px 0;
        border-bottom:1px solid #e2e8f0;
      ">
        <small style="color:#64748b;">
          ${new Date(item.created_at).toLocaleString()}
        </small>
        <div style="margin-top:6px; white-space:pre-wrap;">
          ${escapeHtml(item.comment)}
        </div>
      </div>
    `).join("") || "No comments recorded yet.";

  } catch (error) {

    console.error("❌ QA Comment Save Error:", error);
    alert("Unable to save comment: " + error.message);

  } finally {

    saveButton.disabled = false; 
    saveButton.textContent = "💾 Save Comment";

  }

});

    modal.querySelector("#qaCloseComments").onclick = () => {
      modal.remove();
    };

  });

});

     document.getElementById("qaCreateReinspectionRequest")
    ?.addEventListener("click", () => {

      // 🫘 REQUIRE LOCATION BEFORE CREATING REINSPECTION REQUEST
if (!window.qaSelectedLocation) {
  alert("Please select a specific Location before creating a Reinspection Request.");
  document.getElementById("qaLocationFilter")?.focus();
  return;
}

    const selectedLots = [
      ...document.querySelectorAll(".qaReinspectionSelect:checked")
    ];

    const selectedPallets = [
  ...document.querySelectorAll(".qaPalletSelect:checked")
];

// 🫘 REINSPECTION REQUEST — REQUIRE PALLET OR LOT SELECTION
if (selectedLots.length === 0 && selectedPallets.length === 0) {
  alert("Please select at least one lot or pallet.");
  return;
}

// 🫘 REINSPECTION REQUEST — STORE SPECIFIC PALLETS
const requestedSpecificPallets = [];

// 🫘 REINSPECTION REQUEST — STORE REQUESTED QUANTITIES
const requestedLotQuantities = [];

// 🫘 REINSPECTION REQUEST — PALLET QUANTITY
selectedLots.forEach(lot => {
  const groupIndex = Number(lot.dataset.groupIndex);

  const hasSpecificPallets = selectedPallets.some(
    pallet => Number(pallet.dataset.groupIndex) === groupIndex
  );

  if (hasSpecificPallets) return;

  const group = window.qaGroupedInventory?.[groupIndex];
  if (!group) return;

  const quantity = prompt(
    `How many pallets do you want to reinspect?\n\n` +
    `Lot: ${group.lot}\n` +
    `Available pallets: ${group.pallets.size}`,
    "1"
  );

// 🫘 VALIDATE REQUESTED PALLET QUANTITY
if (quantity === null) return;

const requestedQty = Number(quantity);

if (
  !Number.isInteger(requestedQty) ||
  requestedQty < 1 ||
  requestedQty > group.pallets.size
) {
  alert(
    `Invalid pallet quantity.\n` +
    `Please enter a number between 1 and ${group.pallets.size}.`
  );
  return;
}

// 🫘 SAVE REQUESTED LOT QUANTITY
requestedLotQuantities.push({
  groupIndex,
  po: group.po,
  lot: group.lot,
  grower: group.grower,
  variety: group.variety,
  location: window.qaSelectedLocation,
  quantity: requestedQty
});

console.table(requestedLotQuantities);

  console.log("📋 Requested Pallet Quantity:", {
    lot: group.lot,
    quantity
  });
});

console.table(
  selectedPallets.map(pallet => {
    const group = window.qaGroupedInventory?.[
      Number(pallet.dataset.groupIndex)
    ];

const palletData = group?.rows.find(
  r => String(r.pallet).trim() === pallet.dataset.palletId
);

console.log("📦 Pallet Details:", {
  pallet: palletData?.pallet,
  poolId: palletData?.vref,
  size: palletData?.size,
  package: palletData?.package,
  label: palletData?.label,
  warehouse: palletData?.location
});

// 🫘 SAVE SPECIFIC PALLET FOR REINSPECTION REQUEST
if (palletData) {
  requestedSpecificPallets.push({
    pallet: palletData.pallet,
    po: group.po,
    lot: group.lot,
    grower: group.grower,
    variety: group.variety,
    poolId: palletData.vref,
    size: palletData.size,
    package: palletData.package,
    label: palletData.label,
    location: palletData.location,
    boxes: palletData.boxes
  });
  
}  

    return {
      palletId: pallet.dataset.palletId,
      po: group?.po,
      gs1lot: group?.lot,
      grower: group?.grower,
      variety: group?.variety
    };
  })
);

// 🫘 REINSPECTION REQUEST — SPECIFIC PALLETS SUMMARY
console.log("📦 Specific Pallets Selected:");
console.table(requestedSpecificPallets);

// 🫘 REINSPECTION REQUEST — PREVIEW DATA
const reinspectionRequest = {
  location: window.qaSelectedLocation,
  requestedLots: requestedLotQuantities,
  specificPallets: requestedSpecificPallets
};

// 🫘 REINSPECTION REQUEST — WAREHOUSE FORMAT
reinspectionRequest.format =
  reinspectionRequest.location === "Eastern Propak"
    ? "EPP_INSPECTION_SHEET"
    : "FAMOUS_INVENTORY";

    // 🫘 REINSPECTION REQUEST — EPP INSPECTION SHEET

// 🫘 EPP — COMMODITY DISPLAY NAMES
const eppCommodityNames = {
  GP: "GRAPES",
  CH: "CHERRIES",
  LE: "LEMONS",
  MD: "MANDARINS",
  OR: "ORANGES",
  PH: "PEACHES",
  PL: "PLUMS",
  AC: "APRICOTS",
  CL: "CLEMENTINES",
  NE: "NECTARINES",
  PT: "PLUOTS",
};

const getEppCommodity = value => {
  const code = String(value || "").trim().toUpperCase();
  return eppCommodityNames[code] || code;
};

// 🫘 EPP — UPDATED INSPECTION SHEET COLUMNS
const eppColumns = [
  "Pallet",
  "Commodity",
  "Poolid",
  "GS1",
  "Size",
  "Variety/Label"
];

const eppRows = [];

// SPECIFIC PALLETS — ONE ROW PER PALLET
reinspectionRequest.specificPallets.forEach(p => {
  const group = window.qaGroupedInventory.find(
    g => g.po === p.po &&
         g.lot === p.lot &&
         g.grower === p.grower &&
         g.variety === p.variety
  );

  const palletData = group?.rows.find(
    r => String(r.pallet).trim() === String(p.pallet).trim()
  );

  eppRows.push({
    Pallet: String(p.pallet),
    Commodity: getEppCommodity(palletData?.commodity),
    Poolid: p.poolId || "",
    GS1: p.lot || "",
    Size: p.size || "",
    "Variety/Label": `${p.variety || ""} / ${p.grower || ""}`
  });
});

// QUANTITY REQUESTS — ONE ROW PER LOT
reinspectionRequest.requestedLots.forEach(r => {
  const group = window.qaGroupedInventory[r.groupIndex];

  if (!group) return;

  const poolIds = [...new Set(
    group.rows.map(p => String(p.vref || "").trim())
  )];

  const sizes = [...new Set(
    group.rows.map(p => String(p.size || "").trim())
  )];

  const labels = [...new Set(
    group.rows.map(p => String(p.label || "").trim())
  )];

  eppRows.push({
    Pallet: String(r.quantity),
    Commodity: getEppCommodity(group.commodity),
    Poolid: poolIds.length === 1 ? poolIds[0] : "VERIFY",
    GS1: r.lot || "",
    Size: sizes.length === 1 ? sizes[0] : "VERIFY",
    "Variety/Label": `${r.variety || ""} / ${r.grower || ""}`
  });
});

reinspectionRequest.eppColumns = eppColumns;
reinspectionRequest.eppRows = eppRows;

console.table(eppRows);

console.log("📋 Reinspection Request Preview:", reinspectionRequest);

// 🫘 REINSPECTION REQUEST — PREVIEW WINDOW
document.getElementById("qaRequestPreview")?.remove();

const preview = document.createElement("div");
preview.id = "qaRequestPreview";

preview.style.cssText = `
  position:fixed;
  inset:0;
  background:rgba(15,23,42,0.65);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:20px;
  z-index:9999;
`;

preview.innerHTML = `
  <div style="
    background:white;
    border-radius:14px;
    padding:28px;
    width:96vw;
    max-width:1400px;
    max-height:92vh;
    overflow-y:auto;
    overflow-x:hidden;
    box-sizing:border-box;
  ">
    <h2>📋 Reinspection Request Preview</h2>
    <p><strong>📍 Location:</strong> ${escapeHtml(reinspectionRequest.location)}</p>

    <p>
      ${reinspectionRequest.requestedLots.length} lot requests ·
      ${reinspectionRequest.specificPallets.length} specific pallets
    </p>

<!-- 🫘 EPP — OFFICIAL INSPECTION SHEET -->
${reinspectionRequest.format === "EPP_INSPECTION_SHEET" ? `

  <div style="
    margin-top:24px;
    padding:18px;
    border:1px solid #cbd5e1;
    border-radius:10px;
    background:#f8fafc;
  ">

    <h3 style="margin-bottom:18px;">
      📋 Eastern Propak — Inspection Sheet
    </h3>

<!-- 🫘 EPP — INSPECTION TYPE -->
<div style="
  display:flex;
  align-items:center;
  gap:12px;
  margin-bottom:20px;
  padding:12px;
  background:#ffffff;
  border:1px solid #e2e8f0;
  border-radius:8px;
">
  <strong>Inspection Type:</strong>

  <select id="qaEppInspectionType"
    style="padding:8px; border-radius:6px;">
    <option value="Inbound Insp">Inbound Insp</option>
    <option value="Re-inspection" selected>Re-inspection</option>
    <option value="OUTBOUND">OUTBOUND</option>
    <option value="Survey">Survey</option>
    <option value="USDA 8E">USDA 8E</option>
  </select>
</div>

    <div style="
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      margin-bottom:20px;
    ">

      <label>
        Date
        <input
          type="date"
          id="qaEppDate"
          style="width:100%;box-sizing:border-box;"
        >
      </label>

      <label>
        Inspector
        <input
          type="text"
          id="qaEppInspector"
          placeholder="Inspector name"
          style="width:100%;box-sizing:border-box;"
        >
      </label>

      <label>
        Forklift Driver
        <input
          type="text"
          id="qaEppDriver"
          placeholder="Driver name"
          style="width:100%;box-sizing:border-box;"
        >
      </label>

      <label>
        Lotid
        <input
          type="text"
          id="qaEppLotid"
          placeholder="Lot ID"
          style="width:100%;box-sizing:border-box;"
        >
      </label>

    </div>

    <div style="
  width:100%;
  max-width:100%;
  overflow-x:auto;
  margin-top:16px;
  border:1px solid #e2e8f0;
  border-radius:10px;
">
  <table
    class="qaTable"
    id="qaEppRequestTable"
    style="
      width:100%;
      min-width:900px;
      table-layout:auto;
      border-collapse:collapse;
    "
  >

        <thead>
          <tr>
            ${eppColumns.map(col => `
              <th>${escapeHtml(col)}</th>
            `).join("")}
          </tr>
        </thead>

        <tbody>
          ${eppRows.map(row => `
            <tr>
              ${eppColumns.map(col => `
                <td>
                  ${escapeHtml(String(row[col] ?? ""))}
                </td>
              `).join("")}
            </tr>
          `).join("")}
        </tbody>

      </table>
    </div>

    ${eppRows.some(row =>
      Object.values(row).some(value =>
        String(value).includes("VERIFY")
      )
    ) ? `
      <p style="
        margin-top:12px;
        color:#b45309;
        font-weight:600;
      ">
        ⚠️ Some fields require verification before submitting
        this inspection request.
      </p>
    ` : ""}

<!-- 🫘 EPP — REQUEST ACTIONS -->
<div style="
  display:flex;
  flex-wrap:wrap;
  gap:12px;
  margin-top:18px;
">

  <button
    type="button"
    class="primaryBtn"
    id="qaCopyFormattedEmail"
  >
    📋 Copy Formatted Email
  </button>

  <button
    type="button"
    class="primaryBtn"
    id="qaDownloadEppExcel"
  >
    📥 Download Excel
  </button>

</div>

` : ""}

    <!-- 🫘 REINSPECTION REQUEST — LOT QUANTITIES -->
${reinspectionRequest.format !== "EPP_INSPECTION_SHEET" && reinspectionRequest.requestedLots.length ? `
  <h3 style="margin-top:24px;">📦 Pallets by Lot</h3>

  <div class="qaTableWrap">
    <table class="qaTable">
      <thead>
        <tr>
          <th>PO</th>
          <th>Lot</th>
          <th>Grower</th>
          <th>Variety</th>
          <th>Requested Pallets</th>
        </tr>
      </thead>
      <tbody>
        ${reinspectionRequest.requestedLots.map(r => `
          <tr>
            <td>${escapeHtml(r.po)}</td>
            <td>${escapeHtml(r.lot)}</td>
            <td>${escapeHtml(r.grower)}</td>
            <td>${escapeHtml(r.variety)}</td>
            <td><strong>${r.quantity}</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
` : ""}

    <!-- 🫘 REINSPECTION REQUEST — SPECIFIC PALLETS -->
${reinspectionRequest.format !== "EPP_INSPECTION_SHEET" && reinspectionRequest.specificPallets.length ? `
  <h3 style="margin-top:24px;">📦 Specific Pallets</h3>

  <div class="qaTableWrap">
    <table class="qaTable">
      <thead>
        <tr>
          <th>Pallet</th>
          <th>PO</th>
          <th>Lot</th>
          <th>Grower</th>
          <th>Variety</th>
          <th>Size</th>
          <th>Package</th>
          <th>Pool ID</th>
          <th>Label</th>
          <th>Boxes</th>
        </tr>
      </thead>
      <tbody>
        ${reinspectionRequest.specificPallets.map(p => `
          <tr>
            <td>${escapeHtml(p.pallet)}</td>
            <td>${escapeHtml(p.po)}</td>
            <td>${escapeHtml(p.lot)}</td>
            <td>${escapeHtml(p.grower)}</td>
            <td>${escapeHtml(p.variety)}</td>
            <td>${escapeHtml(p.size)}</td>
            <td>${escapeHtml(p.package)}</td>
            <td>${escapeHtml(p.poolId)}</td>
            <td>${escapeHtml(p.label)}</td>
<td>${Number(p.boxes || 0).toLocaleString()}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
` : ""}

<button
  type="button"
  class="primaryBtn"
  id="qaGenerateReinspectionEmail"
  style="margin-top:18px; margin-right:10px;"
>
  ✉️ Generate Email
</button>

    <button type="button" class="secondaryBtn"
      id="qaCloseRequestPreview">
      Cancel
    </button>
  </div>
`;

document.body.appendChild(preview);

// 🫘 EPP — DEFAULT INSPECTION DATE
const qaEppDateInput = document.getElementById("qaEppDate");

if (qaEppDateInput) {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  );

  qaEppDateInput.value = localDate.toISOString().slice(0, 10);
}

document.getElementById("qaCloseRequestPreview")
  ?.addEventListener("click", () => preview.remove());

// 🫘 QA MANAGEMENT — GENERATE REINSPECTION EMAIL
document.getElementById("qaGenerateReinspectionEmail")
  ?.addEventListener("click", () => {

    const location = reinspectionRequest.location;

    const isEPP =
      reinspectionRequest.format === "EPP_INSPECTION_SHEET";

    const date =
      document.getElementById("qaEppDate")?.value ||
      new Date().toLocaleDateString("en-CA");

    const inspector =
      document.getElementById("qaEppInspector")
        ?.value.trim() || "";

    // 🫘 INSPECTION TYPE — DYNAMIC SUBJECT
    const inspectionType =
      document.getElementById("qaEppInspectionType")?.value ||
      "Re-inspection";

    const inspectionNames = {
      "Re-inspection": "Reinspection",
      "Inbound Insp": "Inbound",
      "OUTBOUND": "Outbound",
      "Survey": "Survey",
      "USDA 8E": "USDA 8E"
    };

    const requestType =
      inspectionNames[inspectionType] || inspectionType;

    // 🫘 EPP — REQUIRED FIELDS
    if (isEPP && (!date || !inspector)) {
      alert("Please complete Date and Inspector.");
      return;
    }

    // 🫘 GREETING BASED ON LOCAL TIME
    const hour = new Date().getHours();

    const greeting =
      hour < 12 ? "good morning" : "good afternoon";

    // 🫘 DYNAMIC SUBJECT
    const subject =
      `${requestType} Request - ${location} - ${date}`;

    let requestDetails = "";

        if (isEPP) {

      // 🫘 EPP — FORMATTED PLAIN-TEXT REQUEST
      const widths = [17, 14, 17, 15, 12, 32];

      const formatCell = (value, width) =>
        String(value ?? "").padEnd(width, " ");

      const formatRow = row =>
        eppColumns.map((col, index) =>
          formatCell(row[col], widths[index])
        ).join("  ");

      const header = formatRow(
        Object.fromEntries(
          eppColumns.map(col => [col, col])
        )
      );

      const separator = "-".repeat(header.length);

      const rows = eppRows.map(formatRow);

      requestDetails = [
        "PACIFIC TRELLIS — INSPECTION SHEET",
        "",
        `Date: ${date}`,
        `Inspector: ${inspector}`,
        `Inspection Type: ${inspectionType}`,
        "",
        header,
        separator,
        ...rows
      ].join("\n");

    } else {

      // 🫘 OTHER WAREHOUSES — FAMOUS REFERENCES
      const lotDetails = reinspectionRequest.requestedLots.map(r =>
        `${r.quantity} pallet(s) | PO ${r.po} | ` +
        `GS1 ${r.lot} | ${r.variety} / ${r.grower}`
      );

      const palletDetails = reinspectionRequest.specificPallets.map(p =>
        `Pallet ${p.pallet} | PO ${p.po} | ` +
        `GS1 ${p.lot} | ${p.variety} / ${p.grower} | ` +
        `Size ${p.size || "-"} | Pool ID ${p.poolId || "-"}`
      );

      requestDetails = [
        ...lotDetails,
        ...palletDetails
      ].join("\n");
    }

    // 🫘 EMAIL BODY — NO DUPLICATE INSPECTION SHEET
const body = [
  `Hi ${isEPP ? "EPP Team" : "Team"}, ${greeting},`,
  "",
  "Could you please stage the following request:",
  "",
  isEPP
    ? "[Paste Inspection Sheet here]"
    : requestDetails,
  "",
  "Please confirm.",
  "",
  "Thank you in advance.",
  "",
  "Best regards,"
].join("\n");

    // 🫘 QA MANAGEMENT — WAREHOUSE DISTRIBUTION LISTS
const warehouseEmails = {
  "Eastern Propak": {
    to: ["inspections@easternpropak.com"],
    cc: [
      "dmendez@easternpropak.com",
      "amendez@easternpropak.com",
      "qualitycoordination@pacifictrellisfruit.com"
    ]
  }
};

// 🫘 GET DISTRIBUTION LIST FOR SELECTED LOCATION
const recipients = warehouseEmails[location] || {
  to: [],
  cc: []
};

// 🫘 OPEN OUTLOOK DRAFT
const to = recipients.to.join(",");
const cc = recipients.cc.join(",");

const mailto =
  `mailto:${to}` +
  `?cc=${encodeURIComponent(cc)}` +
  `&subject=${encodeURIComponent(subject)}` +
  `&body=${encodeURIComponent(body)}`;

window.location.href = mailto;

  }); // 🫘 END GENERATE EMAIL

// 🫘 EPP — COPY FORMATTED EMAIL FOR OUTLOOK
document.getElementById("qaCopyFormattedEmail")
  ?.addEventListener("click", async () => {

    const date = document.getElementById("qaEppDate")?.value || "";
    const inspector =
      document.getElementById("qaEppInspector")?.value.trim() || "";

    const driver =
      document.getElementById("qaEppDriver")?.value.trim() || "";

    const lotid =
      document.getElementById("qaEppLotid")?.value.trim() || "";

    const inspectionType =
      document.getElementById("qaEppInspectionType")?.value ||
      "Re-inspection";

    if (!date || !inspector) {
      alert("Please complete Date and Inspector.");
      return;
    }

    const requestTypes = {
      "Re-inspection": "REINSPECTION",
      "Inbound Insp": "INBOUND",
      "OUTBOUND": "OUTBOUND",
      "Survey": "SURVEY",
      "USDA 8E": "USDA 8E"
    };

    const requestType =
      requestTypes[inspectionType] || inspectionType.toUpperCase();

    const [year, month, day] = date.split("-");

    const subject =
      `REQUEST PACIFIC TRELLIS - ${requestType} - ${month}/${day}/${year.slice(-2)}`;

    const greeting =
      new Date().getHours() < 12
        ? "good morning"
        : "good afternoon";

    // 🫘 EPP — COPY ONLY THE INSPECTION SHEET
const html = `
  <div style="
    font-family:Arial,sans-serif;
    font-size:13px;
    color:#222;
    max-width:1050px;
  ">

    <h2 style="
      font-size:20px;
      font-weight:700;
      text-align:center;
      margin:0 0 20px;
    ">
      PACIFIC TRELLIS — INSPECTION SHEET
    </h2>

    <table style="
      width:100%;
      border-collapse:collapse;
      margin-bottom:20px;
      font-size:13px;
    ">
      <tr>
        <td style="padding:8px;">
          <strong>DATE:</strong> ${escapeHtml(date)}
        </td>

        <td style="padding:8px;">
          <strong>Inspector:</strong> ${escapeHtml(inspector)}
        </td>

        <td style="padding:8px;">
          <strong>Type:</strong> ${escapeHtml(inspectionType)}
        </td>
      </tr>

      <tr>
        <td style="padding:8px;">
          <strong>FORKLIFT DRIVER:</strong> ${escapeHtml(driver)}
        </td>

        <td style="padding:8px;">
          <strong>Lotid:</strong> ${escapeHtml(lotid)}
        </td>

        <td></td>
      </tr>
    </table>

    <table style="
      width:100%;
      border-collapse:collapse;
      font-size:13px;
    ">

      <thead>
        <tr>
          ${eppColumns.map(col => `
            <th style="
              border:1px solid #888;
              padding:10px;
              text-align:center;
              font-weight:700;
            ">
              ${escapeHtml(col)}
            </th>
          `).join("")}
        </tr>
      </thead>

      <tbody>
        ${eppRows.map(row => `
          <tr>
            ${eppColumns.map(col => `
              <td style="
                border:1px solid #888;
                padding:10px;
                text-align:center;
              ">
                ${escapeHtml(String(row[col] ?? ""))}
              </td>
            `).join("")}
          </tr>
        `).join("")}
      </tbody>

    </table>

  </div>
`;

   const plainText = [
  "PACIFIC TRELLIS — INSPECTION SHEET",
  "",
  `Date: ${date}`,
  `Inspector: ${inspector}`,
  `Inspection Type: ${inspectionType}`,
  `Forklift Driver: ${driver}`,
  `Lotid: ${lotid}`,
  "",
  eppColumns.join("\t"),
  ...eppRows.map(row =>
    eppColumns.map(col => String(row[col] ?? "")).join("\t")
  )
].join("\n");

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], {
            type: "text/html"
          }),
          "text/plain": new Blob([plainText], {
            type: "text/plain"
          })
        })
      ]);

      alert(
        "Formatted email copied!\n\n" +
        `Subject:\n${subject}\n\n` +
        "Open Outlook, create a new email and paste with Ctrl + V."
      );

    } catch (error) {
      console.error("Formatted email copy error:", error);
      alert("Unable to copy formatted email. Check clipboard permissions.");
    }

  });

  // 🫘 EPP — EXPORT OFFICIAL INSPECTION SHEET TO EXCEL
document.getElementById("qaDownloadEppExcel")
  ?.addEventListener("click", () => {

    // Read current form values
    const date = document.getElementById("qaEppDate")?.value || "";
    const inspector =
      document.getElementById("qaEppInspector")?.value.trim() || "";
    const driver =
      document.getElementById("qaEppDriver")?.value.trim() || "";
    const lotid =
      document.getElementById("qaEppLotid")?.value.trim() || "";
    const inspectionType =
      document.getElementById("qaEppInspectionType")?.value || "Re-inspection";

    // 🫘 EPP — REQUIRED FIELDS: DATE AND INSPECTOR ONLY
if (!date || !inspector) {
  alert("Please complete Date and Inspector before downloading.");
  return;
}  

    const sheetData = [
      ["EASTERN PROPAK — INSPECTION SHEET"],
      [],
      ["Date", date, "", "Inspection Type", inspectionType],
      ["Inspector", inspector],
      ["Forklift Driver", driver],
      ["Lotid", lotid],
      [],
      eppColumns,
      ...eppRows.map(row =>
        eppColumns.map(col => String(row[col] ?? ""))
      )
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Keep identifiers as text, including pallet IDs and GS1 lots
    const range = XLSX.utils.decode_range(worksheet["!ref"]);

    for (let row = 7; row <= range.e.r; row++) {
      for (let col = 0; col < eppColumns.length; col++) {
        const address = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[address];

        if (cell) {
          cell.t = "s";
          cell.v = String(cell.v ?? "");
        }
      }
    }

    // Column widths match the seven EPP fields
    worksheet["!cols"] = [
      { wch: 17 }, // Pallet
      { wch: 17 }, // Commodity
      { wch: 20 }, // Poolid
      { wch: 18 }, // GS1
      { wch: 18 }, // Size
      { wch: 34 }  // Variety/Label
    ];

    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: eppColumns.length - 1 }
      }
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Inspection Sheet"
    );

    const safeDate = date || new Date().toISOString().slice(0, 10);

    XLSX.writeFile(
      workbook,
      `EPP_Reinspection_Request_${safeDate}.xlsx`
    );
  });

// 🫘 EPP — COPY INSPECTION SHEET TO EXCEL

document.getElementById("qaCopyEppRequest")
  ?.addEventListener("click", async () => {

    const rows = [
      eppColumns,
      ...eppRows.map(row =>
        eppColumns.map(col => String(row[col] ?? ""))
      )
    ];

    const text = rows
      .map(row => row.join("\t"))
      .join("\n");

    try {

      await navigator.clipboard.writeText(text);

      alert(
        "Inspection Sheet copied successfully.\n" +
        "You can paste it directly into Excel."
      );

    } catch (error) {

      console.error("❌ Copy Inspection Sheet Error:", error);

      alert(
        "Unable to copy the Inspection Sheet. " +
        "Please check clipboard permissions."
      );
    }

  });

    });

// 🫘 QA MANAGEMENT — REINSPECTION EMAIL

// Email generation is handled inside the request preview.

// 🫘 QA MANAGEMENT — LOCATION FILTER EVENT
document.getElementById("qaLocationFilter")
  ?.addEventListener("change", async function () {
    window.qaSelectedLocation = this.value;
    await window.openQAManagement();
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

// 🫘 QA MANAGEMENT — LOAD COMMENT HISTORY

const historyContainer =
  modal.querySelector("#qaCommentsHistory");

const { data: qaComments, error: qaCommentsError } =
  await supabaseClient
    .from("qa_inventory_comments")
    .select("comment, created_at, created_by")
    .eq("po", String(group.po))
    .eq("gs1_lot", String(group.lot))
    .eq("grower", String(group.grower))
    .eq("variety", String(group.variety))
    .is("pallet_number", null)
    .order("created_at", { ascending: false });

if (qaCommentsError) {

  console.error("❌ QA Comments Load Error:", qaCommentsError);

  historyContainer.textContent =
    "Unable to load comments.";

} else if (!qaComments?.length) {

  historyContainer.textContent =
    "No comments recorded yet.";

} else {

  historyContainer.innerHTML = qaComments.map(item => `

    <div style="
      padding:10px 0;
      border-bottom:1px solid #e2e8f0;
    ">
      <small style="color:#64748b;">
        ${new Date(item.created_at).toLocaleString()}
      </small>

      <div style="margin-top:6px;">
        ${escapeHtml(item.comment)}
      </div>
    </div>

  `).join("");

}

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
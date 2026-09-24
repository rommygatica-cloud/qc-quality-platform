function inspectionClean(value) {
  return String(value ?? "").trim();
}

function inspectionNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim()
  );

  return Number.isFinite(n) ? n : null;
}

function inspectionDate(value) {
  if (!value) return null;

  // Excel serial
  const numeric = Number(value);

  if (
    typeof XLSX !== "undefined" &&
    Number.isFinite(numeric) &&
    numeric > 30000
  ) {
    const parsed = XLSX.SSF.parse_date_code(numeric);

    if (!parsed) return null;

    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  // JS Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0")
    ].join("-");
  }

  const text = inspectionClean(value);

  if (!text) return null;

  const parsed = new Date(text);

  if (!isNaN(parsed.getTime())) {
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, "0"),
      String(parsed.getDate()).padStart(2, "0")
    ].join("-");
  }

  return null;
}

function inspectionGet(row, names) {
  const keys = Object.keys(row || {});

  for (const name of names) {
    const match = keys.find(
      key =>
        key.trim().toLowerCase() ===
        String(name).trim().toLowerCase()
    );

    if (match) {
      return row[match];
    }
  }

  return "";
}

function normalizeInspectionCommodity(value) {
  const text = inspectionClean(value).toUpperCase();

  const map = {
    GRAPE: "Grapes",
    GRAPES: "Grapes",
    MANDARIN: "Mandarins",
    MANDARINS: "Mandarins",
    ORANGE: "Oranges",
    ORANGES: "Oranges",
    LEMON: "Lemons",
    LEMONS: "Lemons",
    CHERRY: "Cherries",
    CHERRIES: "Cherries",
    APRICOT: "Apricots",
    APRICOTS: "Apricots",
    PEACH: "Peaches",
    PEACHES: "Peaches",
    NECTARINE: "Nectarines",
    NECTARINES: "Nectarines",
    PLUM: "Plums",
    PLUMS: "Plums"
  };

  return map[text] || inspectionClean(value);
}

const QC_INSPECTION_TYPES = [
  "Inbound",
  "Reinspection",
  "Outside Purchase",
  "Transfer",
  "Rejection",
  "Repack Inspection"
];

function normalizeInspectionType(value) {
  const text = String(value || "").trim().toLowerCase();

  const map = {
    inbound: "Inbound",
    reinspection: "Reinspection",
    reinspections: "Reinspection",

    "outside purchase": "Outside Purchase",
    outsidepurchase: "Outside Purchase",
    osp: "Outside Purchase",

    transfer: "Transfer",
    transfers: "Transfer",

    rejection: "Rejection",
    rejections: "Rejection",

    repack: "Repack Inspection",
    "repack inspection": "Repack Inspection"
  };

  return map[text] || "";
}

function normalizeInboundInspectionRow(row, sourceRowNumber) {
  return {
    inspection: {
      source: "Decofrut",
      inspection_type: "Inbound",

      source_sheet_id:
        inspectionClean(
          inspectionGet(row, ["IdSheet"])
        ),

      container:
        inspectionClean(
          inspectionGet(row, [
            "Container/Hatch.",
            "Container/Hatch_"
          ])
        ),

      po_number:
        inspectionClean(
          inspectionGet(row, [
            "PO Number",
            "PO / Vessel / Truck"
          ])
        ),

      lot_number:
        inspectionClean(
          inspectionGet(row, ["Lot Number"])
        ),

      grower:
        inspectionClean(
          inspectionGet(row, ["Grower"])
        ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, ["Specie"])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      origin:
        inspectionClean(
          inspectionGet(row, ["Origin Region", "COO"])
        ),

      location:
        inspectionClean(
          inspectionGet(row, ["Port"])
        ),

      inspection_date:
        inspectionDate(
          inspectionGet(row, ["Inspection Date"])
        )
    },

    sample: {
      sample_number:
        inspectionClean(
          inspectionGet(row, ["Samples"])
        ),

      pallet_number:
        inspectionClean(
          inspectionGet(row, ["Pallet No"])
        ),
grower:
  inspectionClean(
    inspectionGet(row, ["Grower"])
  ),

lot_number:
  inspectionClean(
    inspectionGet(row, ["Lot Number"])
  ),

origin:
  inspectionClean(
    inspectionGet(row, ["Origin Region", "COO"])
  ),

inspection_date:
  inspectionDate(
    inspectionGet(row, ["Inspection Date"])
  ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, ["Specie"])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      size:
        inspectionClean(
          inspectionGet(row, ["Size"])
        ),

      label:
        inspectionClean(
          inspectionGet(row, ["Label"])
        ),

      pack_style:
        inspectionClean(
          inspectionGet(row, ["Package"])
        ),

      packing_date:
        inspectionDate(
          inspectionGet(row, ["Packing Date"])
        ),

      cases_per_pallet:
        inspectionNumber(
          inspectionGet(row, ["Cases/Pallet"])
        ),

      qc_grade:
        inspectionClean(
          inspectionGet(row, ["QcGrade"])
        ),

      quality:
        inspectionClean(
          inspectionGet(row, ["Quality"])
        ),

      condition:
        inspectionClean(
          inspectionGet(row, ["Condition"])
        ),

      opening:
        inspectionClean(
          inspectionGet(row, ["Opening"])
        ),

      pulp_temperature:
        inspectionNumber(
          inspectionGet(row, [
            "Temperature °F",
            "Pulp Temperature"
          ])
        ),

      brix:
        inspectionNumber(
          inspectionGet(row, ["° Brix"])
        ),

      firmness: null,

      comments:
        inspectionClean(
          inspectionGet(row, ["Comments"])
        ),

      source_row_number: sourceRowNumber
    },

    raw: row
  };
}
function normalizeReinspectionRow(row, sourceRowNumber) {
  return {
    inspection: {
      source: "Decofrut",
      inspection_type: "Reinspection",

      source_sheet_id:
        inspectionClean(
          inspectionGet(row, ["IdSheet"])
        ),

      container: "",

      po_number:
        inspectionClean(
          inspectionGet(row, [
            "PO Number",
            "PO Number."
          ])
        ),

      lot_number:
        inspectionClean(
          inspectionGet(row, ["Lot Number"])
        ),

      grower:
        inspectionClean(
          inspectionGet(row, ["Grower"])
        ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, ["Specie"])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      origin:
        inspectionClean(
          inspectionGet(row, ["COO"])
        ),

      location:
        inspectionClean(
          inspectionGet(row, ["Location or Warehouse"])
        ),

      inspection_date:
        inspectionDate(
          inspectionGet(row, ["Inspection Date"])
        ),

      arrival_date:
        inspectionDate(
          inspectionGet(row, ["Arrival Date"])
        )
    },

    sample: {
      sample_number:
        inspectionClean(
          inspectionGet(row, ["Samples"])
        ),

      pallet_number:
        inspectionClean(
          inspectionGet(row, ["Pallet No"])
        ),

      grower:
        inspectionClean(
          inspectionGet(row, ["Grower"])
        ),

      lot_number:
        inspectionClean(
          inspectionGet(row, ["Lot Number"])
        ),

      origin:
        inspectionClean(
          inspectionGet(row, ["COO"])
        ),

      inspection_date:
        inspectionDate(
          inspectionGet(row, ["Inspection Date"])
        ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, ["Specie"])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      size:
        inspectionClean(
          inspectionGet(row, ["Size"])
        ),

      label: "",

      pack_style:
        inspectionClean(
          inspectionGet(row, ["Package"])
        ),

      packing_date:
        inspectionDate(
          inspectionGet(row, ["Packing Date"])
        ),

      cases_per_pallet:
        inspectionNumber(
          inspectionGet(row, ["Cases/Pallet"])
        ),

      qc_grade:
        inspectionClean(
          inspectionGet(row, ["QcGrade"])
        ),

      quality:
        inspectionClean(
          inspectionGet(row, ["Quality"])
        ),

      condition:
        inspectionClean(
          inspectionGet(row, ["Condition"])
        ),

      opening:
        inspectionClean(
          inspectionGet(row, ["Opening"])
        ),

      pulp_temperature:
        inspectionNumber(
          inspectionGet(row, [
            "Pulp Temperature",
            "Temperature °F"
          ])
        ),

      brix:
        inspectionNumber(
          inspectionGet(row, ["° Brix"])
        ),

      firmness: null,

      comments:
        inspectionClean(
          inspectionGet(row, ["Comments"])
        ),

      source_row_number: sourceRowNumber
    },

    raw: row
  };
}

function normalizeGenericInspectionRow(
  row,
  sourceRowNumber,
  inspectionType
) {
  return {
    inspection: {
      source: "Decofrut",

      inspection_type:
        normalizeInspectionType(inspectionType) ||
        inspectionType,

      source_sheet_id:
        inspectionClean(
          inspectionGet(row, ["IdSheet"])
        ),

      container:
        inspectionClean(
          inspectionGet(row, [
            "Container/Hatch.",
            "Container/Hatch_",
            "Container"
          ])
        ),

      po_number:
        inspectionClean(
          inspectionGet(row, [
            "PO Number",
            "PO Number.",
            "PO / Vessel / Truck",
            "PO"
          ])
        ),

      lot_number:
        inspectionClean(
          inspectionGet(row, [
            "Lot Number",
            "Lot"
          ])
        ),

      grower:
        inspectionClean(
          inspectionGet(row, ["Grower"])
        ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, [
            "Specie",
            "Commodity"
          ])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      origin:
        inspectionClean(
          inspectionGet(row, [
            "Origin Region",
            "COO",
            "Origin"
          ])
        ),

      location:
        inspectionClean(
          inspectionGet(row, [
            "Port",
            "Location or Warehouse",
            "Location"
          ])
        ),

      inspection_date:
        inspectionDate(
          inspectionGet(row, [
            "Inspection Date",
            "Date"
          ])
        ),

      arrival_date:
        inspectionDate(
          inspectionGet(row, [
            "Arrival Date"
          ])
        )
    },

    sample: {
      sample_number:
        inspectionClean(
          inspectionGet(row, [
            "Samples",
            "Sample"
          ])
        ),

      pallet_number:
        inspectionClean(
          inspectionGet(row, [
            "Pallet No",
            "Pallet"
          ])
        ),

      grower:
        inspectionClean(
          inspectionGet(row, ["Grower"])
        ),

      lot_number:
        inspectionClean(
          inspectionGet(row, [
            "Lot Number",
            "Lot"
          ])
        ),

      origin:
        inspectionClean(
          inspectionGet(row, [
            "Origin Region",
            "COO",
            "Origin"
          ])
        ),

      inspection_date:
        inspectionDate(
          inspectionGet(row, [
            "Inspection Date",
            "Date"
          ])
        ),

      commodity:
        normalizeInspectionCommodity(
          inspectionGet(row, [
            "Specie",
            "Commodity"
          ])
        ),

      variety:
        inspectionClean(
          inspectionGet(row, ["Variety"])
        ),

      size:
        inspectionClean(
          inspectionGet(row, ["Size"])
        ),

      label:
        inspectionClean(
          inspectionGet(row, ["Label"])
        ),

      pack_style:
        inspectionClean(
          inspectionGet(row, [
            "Package",
            "Pack Style"
          ])
        ),

      packing_date:
        inspectionDate(
          inspectionGet(row, [
            "Packing Date"
          ])
        ),

      cases_per_pallet:
        inspectionNumber(
          inspectionGet(row, [
            "Cases/Pallet"
          ])
        ),

      qc_grade:
        inspectionClean(
          inspectionGet(row, [
            "QcGrade",
            "QC Grade"
          ])
        ),

      quality:
        inspectionClean(
          inspectionGet(row, ["Quality"])
        ),

      condition:
        inspectionClean(
          inspectionGet(row, ["Condition"])
        ),

      opening:
        inspectionClean(
          inspectionGet(row, ["Opening"])
        ),

      pulp_temperature:
        inspectionNumber(
          inspectionGet(row, [
            "Pulp Temperature",
            "Temperature °F"
          ])
        ),

      brix:
        inspectionNumber(
          inspectionGet(row, [
            "° Brix",
            "Brix"
          ])
        ),

      firmness: null,

      comments:
        inspectionClean(
          inspectionGet(row, [
            "Comments",
            "QC Comments"
          ])
        ),

      source_row_number: sourceRowNumber
    },

    raw: row
  };
}

const INSPECTION_NON_DEFECT_FIELDS = new Set([
  "specie",
  "boxes",
  "kneto",
  "po number",
  "po number.",
  "po / vessel / truck",
  "container/hatch.",
  "container/hatch_",
  "port",
  "location or warehouse",
  "inspection date",
  "arrival date",
  "packing date",
  "packing date_1",
  "variety",
  "exporter",
  "package",
  "grower",
  "subgrower",
  "label",
  "size",
  "lot number",
  "idsheet",
  "samples",
  "qcgrade",
  "pallet no",
  "cases/pallet",
  "case net weight (kg)",
  "case net weight (lb)",
  "case net weight (lbs)",
  "barcode",
  "coo",
  "origin region",
  "bilingual",
  "bilingual (yes/no)",
  "lids",
  "lids (yes/no)",
  "traceability",
  "traceability (y/n)",
  "pallet type (1-3)",
  "temperature °f",
  "pulp temperature",
  "plu code",
  "plu number",
  "plu match",
  "opening",
  "° brix",
  "color",
  "number of bags",
  "quantity (bags/clam)",
  "nº bunches",
  "10 berries weight (lbs)",
  "10 berries weight (gr)",
  "sample count",
  "sizing low avg",
  "sizing high avg",
  "nº bunches undersize",
  "nº bunches undersize(b)",
  "weight bunch undersize",
  "undersize (%)",
  "stem condition",
  "stem condition (1-5)",
  "texture",
  "texture (1-5)",
  "clamshell weight (lb)",
  "clamshells weight (lb)",
  "quality",
  "condition",
  "comments"
]);

const INSPECTION_IGNORE_FIELDS = new Set([
  "",
  "id",
  "created at",
  "updated at"
]);

const INSPECTION_METRIC_FIELDS = new Set([
  // General
  "temperature °f",
  "pulp temperature",
  "° brix",
  "brix",
  "case net weight",
  "case net weight (kg)",
  "case net weight (lb)",
  "case net weight (lbs)",
  "sample count",

  // Citrus
  "labeled net weight",
  "weight box",
  "underweight (%)",
  "size (0-1-2)",
  "count cut fruit (u)",
  "undersize fruits (%)",
  "sensitive fruits (%)",
  "fruits to 3 lb",
  "fruits to 2 lb",
  "frutos a 3 lb",
  "frutos a 2 lb",

  // Cherries
  "° brix min",
  "° brix max",
  "° brix avg",
  "mm rng. min",
  "mm rng. max",
  "over size (u)",
  "in size (u)",
  "under size (u)",
  "durofel min",
  "durofel max",
  "durofel avg",

  // Stone Fruit
  "diameter",
  "diameter (mm)",
  "firmness",
  "firmness low",
  "firmness high",
  "firmness avg",
  "color cover (%)",
  "blush avg (%)",

  // Grapes / Packaging / Sizing
  "10 berries weight (lbs)",
  "10 berries weight (gr)",
  "sizing low avg",
  "sizing high avg",
  "number of bags",
  "quantity (bags/clam)",
  "nº bunches",
  "nº bunches undersize",
  "nº bunches undersize(b)",
  "weight bunch undersize",
  "undersize (%)",
  "clamshell weight (lb)",
  "clamshells weight (lb)",

  // Compliance
  "% plu",
  "plu %"
]);

const INSPECTION_ATTRIBUTE_FIELDS = new Set([
  // General
  "color",
  "ground color",
  "ground color (1-5)",
  "% color cover",
  "open appearance",
  "open appearance (1-4)",
  "pallet type (1-3)",
  "variety manifest match",

  // PLU / Barcode / Compliance
  "plu code",
  "plu number",
  "plu match",
  "plu/barcode",
  "plu",
  "barcode",
  "bar code",
  "bilingual",
  "bilingual (yes/no)",
  "lids",
  "lids (yes/no)",
  "traceability",
  "traceability (y/n)",

  // Citrus
  "internal quality (1-4)",
  "kind of decay",

  // Cherries
  "taste",
  "color full (u)",
  "color checkered (u)",
  "color low (u)",
  "texture",
  "texture (1-5)",
  "texture crisp (u)",
  "texture firm (u)",
  "texture semi firm (u)",
  "texture soft (u)",
  "stem condition",
  "stem condition (1-5)",
  "stem pulled (u)",
  "stem green (u)",
  "stem brown (u)"
]);

function normalizeInspectionFieldName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()

    // Normaliza espacios especiales de Excel
    .replace(/\u00a0/g, " ")

    // Convierte múltiples espacios en uno
    .replace(/\s+/g, " ")

    // Quita espacios antes de paréntesis
    .replace(/\s+\(/g, " (")

    // Quita punto final
    .replace(/\.+$/g, "")

    .trim();
}

const INSPECTION_CANONICAL_FIELD_MAP = {
  // -------------------------
  // Identity / Metadata
  // -------------------------
  "specie": "commodity",
  "commodity": "commodity",

  "grower": "grower",
  "subgrower": "subgrower",

  "variety": "variety",

  "lot number": "lot_number",
  "lot": "lot_number",

  "po number": "po_number",
  "po number.": "po_number",
  "po / vessel / truck": "po_number",
  "po": "po_number",

  "container/hatch": "container",
  "container/hatch_": "container",
  "container/hatch.": "container",
  "container": "container",

  "idsheet": "source_sheet_id",

  "inspection date": "inspection_date",
  "arrival date": "arrival_date",
  "packing date": "packing_date",
  "packing date_1": "packing_date",

  "pallet no": "pallet_number",
  "pallet": "pallet_number",

  "samples": "sample_number",
  "sample": "sample_number",

  "qcgrade": "qc_grade",
  "qc grade": "qc_grade",

  "origin region": "origin",
  "coo": "origin",
  "origin": "origin",

  // -------------------------
  // Core measurements
  // -------------------------
  "° brix": "brix",
  "brix": "brix",

  "° brix min": "brix_min",
  "° brix max": "brix_max",
  "° brix avg": "brix_avg",

  "temperature °f": "pulp_temperature_f",
  "pulp temperature": "pulp_temperature_f",

  "diameter": "diameter_mm",
  "diameter (mm)": "diameter_mm",

  "firmness": "firmness",
  "firmness low": "firmness_low",
  "firmness high": "firmness_high",
  "firmness avg": "firmness_avg",

  "durofel min": "durofel_min",
  "durofel max": "durofel_max",
  "durofel avg": "durofel_avg",

  "case net weight": "case_net_weight",
  "case net weight (kg)": "case_net_weight_kg",
  "case net weight (lb)": "case_net_weight_lb",
  "case net weight (lbs)": "case_net_weight_lb",

  "labeled net weight": "labeled_net_weight",
  "weight box": "box_weight",

  "sample count": "sample_count",

  // -------------------------
  // Sizing
  // -------------------------
  "mm rng. min": "size_mm_min",
  "mm rng. max": "size_mm_max",

  "sizing low avg": "sizing_low_avg",
  "sizing high avg": "sizing_high_avg",

  "over size (u)": "oversize_count",
  "in size (u)": "insize_count",
  "under size (u)": "undersize_count",

  "undersize (%)": "undersize_pct",
  "undersize fruits (%)": "undersize_pct",

  // -------------------------
  // PLU / compliance
  // -------------------------
  "plu %": "plu_pct",
  "% plu": "plu_pct",

  "plu code": "plu_code",
  "plu number": "plu_code",
  "plu": "plu_code",

  "barcode": "barcode",
  "bar code": "barcode",
  "plu/barcode": "plu_barcode_check",

  "variety manifest match": "variety_manifest_match",

  // -------------------------
  // Appearance / color
  // -------------------------
  "open appearance": "open_appearance",
  "open appearance (1-4)": "open_appearance",

  "ground color": "ground_color",
  "ground color (1-5)": "ground_color",

  "color": "color",
  "% color cover": "color_cover_pct",
  "color cover (%)": "color_cover_pct",
  "blush avg (%)": "blush_pct",

  // -------------------------
  // Cherries
  // -------------------------
  "taste": "taste",

  "color full (u)": "color_full_count",
  "color checkered (u)": "color_checkered_count",
  "color low (u)": "color_low_count",

  "texture crisp (u)": "texture_crisp_count",
  "texture firm (u)": "texture_firm_count",
  "texture semi firm (u)": "texture_semi_firm_count",
  "texture soft (u)": "texture_soft_count",

  "stem pulled (u)": "stem_pulled_count",
  "stem green (u)": "stem_green_count",
  "stem brown (u)": "stem_brown_count",

  // -------------------------
  // Citrus
  // -------------------------
  "internal quality (1-4)": "internal_quality",
  "kind of decay": "decay_type",

  "count cut fruit (u)": "cut_fruit_count",
  "sensitive fruits (%)": "sensitive_fruit_pct",

  "fruits to 3 lb": "fruits_per_3lb",
  "frutos a 3 lb": "fruits_per_3lb",

  "fruits to 2 lb": "fruits_per_2lb",
  "frutos a 2 lb": "fruits_per_2lb",

  "underweight (%)": "underweight_pct"
};

function getCanonicalInspectionField(column) {
  const normalized =
    normalizeInspectionFieldName(column);

  return (
    INSPECTION_CANONICAL_FIELD_MAP[normalized] ||
    normalized
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

function classifyInspectionField(column) {
  const normalized =
    normalizeInspectionFieldName(column);

  if (
    INSPECTION_IGNORE_FIELDS.has(normalized)
  ) {
    return "ignore";
  }

  if (
    INSPECTION_NON_DEFECT_FIELDS.has(normalized)
  ) {
    if (
      INSPECTION_METRIC_FIELDS.has(normalized)
    ) {
      return "metric";
    }

    if (
      INSPECTION_ATTRIBUTE_FIELDS.has(normalized)
    ) {
      return "attribute";
    }

    return "metadata";
  }

  if (
    INSPECTION_METRIC_FIELDS.has(normalized)
  ) {
    return "metric";
  }

  if (
    INSPECTION_ATTRIBUTE_FIELDS.has(normalized)
  ) {
    return "attribute";
  }

  return "defect";
}

function extractInspectionMetrics(row) {
  const metrics = [];

  Object.entries(row || {}).forEach(
    ([column, rawValue]) => {
      const classification =
        classifyInspectionField(column);

      if (
        classification !== "metric" &&
        classification !== "attribute"
      ) {
        return;
      }

      const cleanValue =
        inspectionClean(rawValue);

      if (!cleanValue) return;

      const numericValue =
        inspectionNumber(rawValue);

      metrics.push({
        metric_name: String(column).trim(),
        normalized_metric:
        
        getCanonicalInspectionField(column),

        metric_value:
          numericValue !== null
            ? numericValue
            : null,

        text_value:
          numericValue === null
            ? cleanValue
            : null,

        unit:
          String(column).includes("%")
            ? "%"
            : null,

        metric_group:
          classification,

        source_column:
          String(column).trim()
      });
    }
  );

  return metrics;
}

function extractInspectionDefects(row) {
  const defects = [];

  Object.entries(row || {}).forEach(([column, rawValue]) => {
    const cleanColumn = String(column || "").trim();
    if (
  !cleanColumn ||
  classifyInspectionField(cleanColumn) !== "defect"
) {
  return;
}

    const value = inspectionNumber(rawValue);

    if (value === null || value === 0) {
      return;
    }

    defects.push({
      defect_name: cleanColumn,
      normalized_defect: null,
      defect_value: value,
      unit:
        cleanColumn.includes("%")
          ? "%"
          : null,
      defect_group: null,
      source_column: cleanColumn
    });
  });

  return defects;
}

async function buildInspectionDryRun(
  file,
  inspectionType = "auto"
) {
  const buffer = await file.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array"
  });

  const output = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: ""
    });

    const lowerSheetName =
  sheetName.toLowerCase();

let detectedType = "";

if (lowerSheetName.includes("reinspection")) {
  detectedType = "Reinspection";

} else if (lowerSheetName.includes("inbound")) {
  detectedType = "Inbound";

} else if (
  lowerSheetName.includes("outside purchase") ||
  lowerSheetName.includes("outsidepurchase") ||
  lowerSheetName.includes("osp")
) {
  detectedType = "Outside Purchase";

} else if (lowerSheetName.includes("transfer")) {
  detectedType = "Transfer";

} else if (lowerSheetName.includes("rejection")) {
  detectedType = "Rejection";

} else if (lowerSheetName.includes("repack")) {
  detectedType = "Repack Inspection";
}

const requestedType =
  inspectionType === "auto"
    ? ""
    : normalizeInspectionType(inspectionType);

const resolvedType =
  requestedType || detectedType;

// Si estamos en Auto y el nombre de la hoja
// no identifica el workflow, no adivinamos.
if (!resolvedType) {
  console.warn(
    `Inspection type could not be detected for sheet "${sheetName}".`
  );

  continue;
}

rows.forEach((row, index) => {
  let normalized;

  if (resolvedType === "Inbound") {

    normalized =
      normalizeInboundInspectionRow(
        row,
        index + 2
      );

  } else if (resolvedType === "Reinspection") {

    normalized =
      normalizeReinspectionRow(
        row,
        index + 2
      );

  } else {

    normalized =
      normalizeGenericInspectionRow(
        row,
        index + 2,
        resolvedType
      );
  }

  normalized.defects =
    extractInspectionDefects(row);

  normalized.metrics =
    extractInspectionMetrics(row);

    output.push(normalized);
});

  // Cierra el for de workbook.SheetNames
  }

  return output;
}

window.buildInspectionDryRun =
  buildInspectionDryRun;

  function groupInspectionDryRunBySheet(rows = []) {
  const groups = {};

  rows.forEach(row => {
    const sheetId = row?.inspection?.source_sheet_id;

    if (!sheetId) return;

    if (!groups[sheetId]) {
      groups[sheetId] = [];
    }

    groups[sheetId].push(row);
  });

  return Object.entries(groups).map(([sheetId, records]) => {
    const unique = values =>
      [...new Set(
        values
          .map(v => String(v ?? "").trim())
          .filter(Boolean)
      )];

    const inspectionTypes = unique(
      records.map(x => x.inspection.inspection_type)
    );

    const inspectionDates = unique(
      records.map(x => x.inspection.inspection_date)
    );

    const containers = unique(
      records.map(x => x.inspection.container)
    );

    const poNumbers = unique(
      records.map(x => x.inspection.po_number)
    );

    const lots = unique(
      records.map(x => x.inspection.lot_number)
    );

    const growers = unique(
      records.map(x => x.inspection.grower)
    );

    const commodities = unique(
      records.map(x => x.inspection.commodity)
    );

    const varieties = unique(
      records.map(x => x.sample.variety)
    );

    const pallets = unique(
      records.map(x => x.sample.pallet_number)
    );

    const grades = unique(
      records.map(x => x.sample.qc_grade)
    );

    const defectNames = unique(
      records.flatMap(x =>
        (x.defects || []).map(d => d.defect_name)
      )
    );

    const mixedFields = [];

    if (inspectionTypes.length > 1)
      mixedFields.push("inspection_type");

    if (inspectionDates.length > 1)
      mixedFields.push("inspection_date");

    if (containers.length > 1)
      mixedFields.push("container");

    if (poNumbers.length > 1)
      mixedFields.push("po");

    if (lots.length > 1)
      mixedFields.push("lot");

    if (growers.length > 1)
      mixedFields.push("grower");

    if (commodities.length > 1)
      mixedFields.push("commodity");

    if (varieties.length > 1)
      mixedFields.push("variety");

    return {
      sourceSheetId: sheetId,

      classification:
        mixedFields.length
          ? "mixed"
          : "simple",

      mixedFields,

      sampleCount: records.length,
      palletCount: pallets.length,

      inspectionTypes,
      inspectionDates,
      containers,
      poNumbers,
      lots,
      growers,
      commodities,
      varieties,
      grades,
      defectNames,

      records
    };
  });
}

window.groupInspectionDryRunBySheet =
  groupInspectionDryRunBySheet;

  async function saveSingleInspectionGroup(group) {
  if (!group || !group.sourceSheetId || !group.records?.length) {
    throw new Error("Invalid inspection group.");
  }

  const first = group.records[0];

  const sourceSheetId = group.sourceSheetId;
  const inspectionType =
    first.inspection.inspection_type || "";

  // 1) Revisar si ya existe
  const { data: existingInspection, error: existingError } =
    await supabaseClient
      .from("qc_inspections")
      .select("id, source_sheet_id, inspection_type")
      .eq("source_sheet_id", sourceSheetId)
      .eq("inspection_type", inspectionType)
      .maybeSingle();

  if (existingError) {
    console.error("Inspection duplicate check error:", existingError);
    throw existingError;
  }

  if (existingInspection) {
    return {
      status: "skipped",
      reason: "already_exists",
      inspectionId: existingInspection.id,
      sourceSheetId
    };
  }

  // 2) Preparar cabecera
  const inspectionRow = {
    source: first.inspection.source || "Decofrut",
    inspection_type: inspectionType,
    source_sheet_id: sourceSheetId,

    container:
      group.containers.length === 1
        ? group.containers[0]
        : "",

    po_number:
      group.poNumbers.length === 1
        ? group.poNumbers[0]
        : "",

    lot_number:
      group.lots.length === 1
        ? group.lots[0]
        : "",

    grower:
      group.growers.length === 1
        ? group.growers[0]
        : "",

    commodity:
      group.commodities.length === 1
        ? group.commodities[0]
        : "",

    variety:
      group.varieties.length === 1
        ? group.varieties[0]
        : "",

    origin:
      first.inspection.origin || "",

    location:
      first.inspection.location || "",

    inspection_date:
      group.inspectionDates.length === 1
        ? group.inspectionDates[0]
        : null,

    arrival_date:
      first.inspection.arrival_date || null,

    qc_grade: "",
    quality: "",
    condition: "",
    comments: ""
  };

  // 3) Intentar enlazar con Arrival existente
  if (inspectionRow.container) {
    const { data: arrivalMatch, error: arrivalError } =
      await supabaseClient
        .from("arrival_containers")
        .select("id")
        .eq("container", inspectionRow.container)
        .maybeSingle();

    if (!arrivalError && arrivalMatch?.id) {
      inspectionRow.arrival_container_id =
        arrivalMatch.id;
    }
  }

  // 4) Crear inspección
  const { data: savedInspection, error: insertInspectionError } =
    await supabaseClient
      .from("qc_inspections")
      .insert(inspectionRow)
      .select()
      .single();

  if (insertInspectionError) {
    console.error(
      "Inspection insert error:",
      insertInspectionError
    );
    throw insertInspectionError;
  }

  // 5) Crear samples
  for (const record of group.records) {
    const sampleRow = {
      inspection_id: savedInspection.id,

      sample_number:
        record.sample.sample_number || "",

      pallet_number:
        record.sample.pallet_number || "",

      grower:
        record.sample.grower || "",

      lot_number:
        record.sample.lot_number || "",

      origin:
        record.sample.origin || "",

      inspection_date:
        record.sample.inspection_date || null,

      commodity:
        record.sample.commodity || "",

      variety:
        record.sample.variety || "",

      size:
        record.sample.size || "",

      label:
        record.sample.label || "",

      pack_style:
        record.sample.pack_style || "",

      packing_date:
        record.sample.packing_date || null,

      cases_per_pallet:
        record.sample.cases_per_pallet,

      qc_grade:
        record.sample.qc_grade || "",

      quality:
        record.sample.quality || "",

      condition:
        record.sample.condition || "",

      opening:
        record.sample.opening || "",

      pulp_temperature:
        record.sample.pulp_temperature,

      brix:
        record.sample.brix,

      firmness:
        record.sample.firmness,

      comments:
        record.sample.comments || "",

      source_row_number:
        record.sample.source_row_number
    };

    const { data: savedSample, error: sampleError } =
      await supabaseClient
        .from("qc_inspection_samples")
        .insert(sampleRow)
        .select()
        .single();

    if (sampleError) {
      console.error(
        "Sample insert error:",
        sampleRow,
        sampleError
      );
      throw sampleError;
    }

    // 6) Crear defectos del sample
    const defectRows = (record.defects || []).map(defect => ({
      sample_id: savedSample.id,
      defect_name: defect.defect_name,
      normalized_defect:
        defect.normalized_defect || null,
      defect_value:
        defect.defect_value,
      unit:
        defect.unit || null,
      defect_group:
        defect.defect_group || null,
      source_column:
        defect.source_column || ""
    }));

    if (defectRows.length) {
      const { error: defectsError } =
        await supabaseClient
          .from("qc_inspection_defects")
          .insert(defectRows);

      if (defectsError) {
        console.error(
          "Defects insert error:",
          defectsError
        );
        throw defectsError;
      }
    }
  }

  return {
    status: "inserted",
    inspectionId: savedInspection.id,
    sourceSheetId,
    samplesInserted: group.records.length
  };
}

window.saveSingleInspectionGroup =
  saveSingleInspectionGroup;
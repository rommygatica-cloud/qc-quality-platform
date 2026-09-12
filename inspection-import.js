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

function extractInspectionDefects(row) {
  const defects = [];

  Object.entries(row || {}).forEach(([column, rawValue]) => {
    const cleanColumn = String(column || "").trim();
    const normalizedColumn = cleanColumn.toLowerCase();

    if (
      !cleanColumn ||
      INSPECTION_NON_DEFECT_FIELDS.has(normalizedColumn)
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
async function buildInspectionDryRun(file) {
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

    const isInbound =
      sheetName.toLowerCase().includes("inbound");

    const isReinspection =
      sheetName.toLowerCase().includes("reinspection");

    if (!isInbound && !isReinspection) {
      continue;
    }

    rows.forEach((row, index) => {
      const normalized = isInbound
        ? normalizeInboundInspectionRow(
            row,
            index + 2
          )
        : normalizeReinspectionRow(
            row,
            index + 2
          );

      normalized.defects =
        extractInspectionDefects(row);

      output.push(normalized);
    });
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
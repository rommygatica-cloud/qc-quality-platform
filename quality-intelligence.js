function qiUnique(values) {
  return [...new Set(
    (values || [])
      .map(v => String(v || "").trim())
      .filter(Boolean)
  )];
}

function qiParseDate(value) {
  const text = String(value || "").trim();

  if (!text) return null;

  // Expected QC Hub format: 19-Aug-26
  const parts = text.split("-");

  if (parts.length === 3) {
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

    let year = Number(parts[2]);

    if (year < 100) {
      year += 2000;
    }

    if (
      day &&
      month !== undefined &&
      year
    ) {
      return new Date(year, month, day);
    }
  }

  const fallback = new Date(text);

  return isNaN(fallback.getTime())
    ? null
    : fallback;
}

function qiDaysBetween(start, end = new Date()) {
  if (!start || !end) return null;

  const startDate =
    start instanceof Date
      ? new Date(start)
      : qiParseDate(start);

  const endDate =
    end instanceof Date
      ? new Date(end)
      : qiParseDate(end);

  if (!startDate || !endDate) return null;

  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return Math.floor(
    (endDate - startDate) /
    (1000 * 60 * 60 * 24)
  );
}

function qiGetTreatmentProfile(arrival) {
  const treatment = String(
    arrival?.treatment || ""
  ).trim();

  const sourceStatus = String(
    arrival?.source_status || ""
  ).trim();

  const treatmentUpper = treatment.toUpperCase();
  const statusUpper = sourceStatus.toUpperCase();

  const coldTreatment =
    treatmentUpper.includes("CTIT") ||
    treatmentUpper.includes("COLD TREATMENT");

  const ctPassed =
    statusUpper.includes("PASSED COLD TREATMENT");

  const ctFailed =
    statusUpper.includes("FAILED COLD TREATMENT") ||
    statusUpper.includes("CT FAILED") ||
    (
      statusUpper.includes("FAILED") &&
      statusUpper.includes("COLD TREATMENT")
    );

  const inspectionPending =
    statusUpper.includes("PENDING INSPECTION");

  const usdaPending =
    statusUpper.includes("USDA") &&
    statusUpper.includes("PENDING");

  return {
    code: treatment,
    sourceStatus,
    coldTreatment,
    ctPassed,
    ctFailed,
    inspectionPending,
    usdaPending
  };
}

function buildArrivalIntelligence(
  arrival,
  manifestLines = []
) {
  const lines = Array.isArray(manifestLines)
    ? manifestLines
    : [];

  const packDates = qiUnique(
    lines.map(x => x.pack_date)
  );

  const parsedPackDates = packDates
    .map(qiParseDate)
    .filter(Boolean)
    .sort((a, b) => a - b);

  const oldestPackDate =
    parsedPackDates[0] || null;

  const newestPackDate =
    parsedPackDates[
      parsedPackDates.length - 1
    ] || null;

  const pallets = qiUnique(
    lines.map(x => x.pallet_number)
  );

  const cases = lines.reduce(
    (sum, x) =>
      sum + (Number(x.boxes) || 0),
    0
  );

  const tempRecorders = lines.filter(
    x =>
      String(x.condition || "")
        .trim()
        .toLowerCase() ===
      "temp recorder"
  );

  const treatment =
    qiGetTreatmentProfile(arrival);

  const riskReasons = [];

  if (treatment.ctFailed) {
    riskReasons.push("Cold treatment failed");
  }

  if (treatment.inspectionPending) {
    riskReasons.push("Inspection pending");
  }

  if (treatment.usdaPending) {
    riskReasons.push("USDA pending");
  }

  if (!lines.length) {
    riskReasons.push("Manifest not loaded");
  }

  const actualArrivalDate =
  arrival?.actual_arrival_date
    ? new Date(arrival.actual_arrival_date)
    : null;

const currentDate = new Date();

const ageAtArrivalMaxDays =
  oldestPackDate && actualArrivalDate
    ? qiDaysBetween(
        oldestPackDate,
        actualArrivalDate
      )
    : null;

const ageAtArrivalMinDays =
  newestPackDate && actualArrivalDate
    ? qiDaysBetween(
        newestPackDate,
        actualArrivalDate
      )
    : null;

const currentAgeMaxDays =
  oldestPackDate
    ? qiDaysBetween(
        oldestPackDate,
        currentDate
      )
    : null;

const currentAgeMinDays =
  newestPackDate
    ? qiDaysBetween(
        newestPackDate,
        currentDate
      )
    : null;

  let riskLevel = "normal";

  if (treatment.ctFailed) {
    riskLevel = "critical";
  } else if (
    treatment.inspectionPending ||
    treatment.usdaPending
  ) {
    riskLevel = "attention";
  }

  return {
    identity: {
      id: arrival?.id || "",
      container:
        arrival?.container || "",
      po: arrival?.po || "",
      lot: arrival?.lot || "",
      grower:
        arrival?.grower || "",
      commodity:
        arrival?.commodity || "",
      origin:
        arrival?.origin || ""
    },

    dates: {
      eta: arrival?.eta || "",
      actualArrival:
        arrival?.actual_arrival_date ||
        null,
      closedAt:
        arrival?.closed_at || null
    },

    composition: {
      pallets: pallets.length,
      cases,
      lots: qiUnique(
        lines.map(x => x.lot)
      ),
      commodities: qiUnique(
        lines.map(x => x.commodity)
      ),
      varieties: qiUnique(
        lines.map(x => x.variety)
      ),
      sizes: qiUnique(
        lines.map(x => x.size)
      ),
      packStyles: qiUnique(
        lines.map(x => x.pack_style)
      ),
      labels: qiUnique(
        lines.map(x => x.label)
      ),
      subgrowers: qiUnique(
        lines.map(x => x.subgrower)
      )
    },

    productAge: {
  packDates,

  oldestPackDate:
    oldestPackDate
      ? oldestPackDate.toISOString()
      : null,

  newestPackDate:
    newestPackDate
      ? newestPackDate.toISOString()
      : null,

  ageAtArrival: {
    minDays: ageAtArrivalMinDays,
    maxDays: ageAtArrivalMaxDays
  },

  currentAge: {
    minDays: currentAgeMinDays,
    maxDays: currentAgeMaxDays
  }
},

    temperature: {
      setTemperature:
        arrival?.set_temperature || "",
      tempRecorderCount:
        tempRecorders.length
    },

    treatment,

    workflow: {
      qcStatus:
        arrival?.status || "",
      priority:
        arrival?.priority || "",
      active:
        arrival?.active ?? null
    },

    quality: {
      score: null,
      mainDefects: [],
      pulpTemperature: null,
      recorderRange: null
    },

    discrepancies: [],

    risk: {
      level: riskLevel,
      reasons: riskReasons
    }
  };
}

window.buildArrivalIntelligence =
  buildArrivalIntelligence;
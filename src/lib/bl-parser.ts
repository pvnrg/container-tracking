import { BlType, DischargePort } from "@prisma/client"

import { DISCHARGE_PORT_LABELS } from "@/lib/shipment-labels"

export type ParsedContainer = {
  containerNumber?: string
  containerType?: string
  sealNumber?: string
  tareWeightKg?: string
  grossWeightKg?: string
  inventoryReference?: string
  itemQuantity?: string
}

export type ParsedShipmentFields = {
  blNumber?: string
  blType?: BlType
  shippingLine?: string
  vesselName?: string
  voyageNumber?: string
  bookingRef?: string
  originCountry?: string
  originPort?: string
  dischargePort?: DischargePort
  shipperName?: string
  consigneeName?: string
  notifyParty?: string
  containers: ParsedContainer[]
}

// Longer / unambiguous names first so a substring match can't be shadowed by a
// shorter alias. Deliberately excludes short acronyms (ONE, ZIM, HMM, PIL) --
// they collide with common Bill of Lading boilerplate text ("...ONE original
// bill of lading...") and would misfire more often than they'd help.
const CARRIER_ALIASES: Array<[RegExp, string]> = [
  [/MEDITERRANEAN SHIPPING COMPANY|\bMSC\b/i, "MSC"],
  [/MAERSK/i, "Maersk"],
  [/CMA\s*CGM/i, "CMA CGM"],
  [/HAPAG[-\s]?LLOYD/i, "Hapag-Lloyd"],
  [/COSCO/i, "COSCO Shipping"],
  [/EVERGREEN/i, "Evergreen"],
  [/OCEAN NETWORK EXPRESS/i, "Ocean Network Express (ONE)"],
  [/YANG MING/i, "Yang Ming"],
  [/WAN HAI/i, "Wan Hai"],
  [/\bOOCL\b/i, "OOCL"],
]

const STOP_LABELS = [
  /\bCONSIGNEE\b/i,
  /\bNOTIFY\s*PARTIES?\b/i,
  /\bSHIPPER\b/i,
  /\bVESSEL\b/i,
  /\bPORT\s+OF\b/i,
  /\bBOOKING\b/i,
  /\bB\/?L\s*(NO\.?|NUMBER|#)/i,
  /\bPARTICULARS\b/i,
  /\bCONTAINER\s*(NO\.?|NUMBER)/i,
]

// Real Bill of Lading forms lay fields out as side-by-side boxes (Vessel |
// Port of Loading | Place of Receipt, or Shipper | Carrier's Endorsements).
// OCR reads a page left-to-right per physical text line, so it frequently
// flattens two neighboring boxes' text onto what looks like one "line" here.
// If the text right after a label matches one of these, it's almost always
// the START of an adjacent box's heading or boilerplate, not this field's
// value -- so it should be discarded in favor of the line(s) below instead.
const LABEL_BLEED = /\bPORT\s+OF\b|\bPLACE\s+OF\b|\bCARRIER'?S\b|\bAGENT/i

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
}

function findAfterLabel(
  lines: string[],
  labelRegex: RegExp
): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(labelRegex)
    if (!match) continue

    const rest = lines[i]
      .slice((match.index ?? 0) + match[0].length)
      .replace(/^[:\-.\s]+/, "")
      .trim()
    if (rest && !LABEL_BLEED.test(rest)) return rest

    for (let j = i + 1; j < Math.min(lines.length, i + 3); j++) {
      if (lines[j]) return lines[j]
    }
  }
  return undefined
}

// Shipper/Consignee/Notify Party boxes consistently print the label with
// explanatory text or a neighboring box's heading immediately after it on
// the same OCR'd line, with the real value only starting on the next line --
// so unlike findAfterLabel, the same-line remainder is never trustworthy
// here and is skipped entirely.
function findBlockAfterLabel(
  lines: string[],
  labelRegex: RegExp,
  maxLines = 5
): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRegex.test(lines[i])) continue

    const collected: string[] = []
    for (let j = i + 1; j < lines.length && collected.length < maxLines; j++) {
      if (STOP_LABELS.some((stop) => stop.test(lines[j]))) break
      collected.push(lines[j])
    }

    if (collected.length) return collected.join(", ")
  }
  return undefined
}

// A "City, Country"-shaped token. The negative lookbehind stops a match from
// starting mid-word (e.g. off the tail of a voyage code like "MAG22R" right
// before "ENNORE, INDIA") by requiring a true word boundary at the start.
const PLACE_PATTERN =
  /(?<![A-Za-z0-9])[A-Z][A-Za-z.'\- ]{1,30},\s*[A-Z][A-Za-z.'\- ]{1,30}/

// Isolates a "City, Country"-shaped token from a candidate line, dropping
// any trailing junk from a neighboring column (e.g. "XXXXXXXXXXXXXXXX"
// placeholders, or the next box's heading) that rode along with it.
function extractPlaceValue(rawLine: string | undefined): string | undefined {
  if (!rawLine) return undefined
  const match = rawLine.match(PLACE_PATTERN)
  const value = match ? match[0] : rawLine.split(/\s{2,}|[|\t]/)[0]
  // Forms print unused fields as a run of "X" placeholders (e.g. an unused
  // "Place of Receipt" column) -- the country-name character class can't
  // help but treat that run as more letters, so trim it off explicitly.
  return value?.replace(/\s*X{3,}.*$/i, "").trim() || undefined
}

// Drops a trailing "City, Country" segment (and anything after it) that
// belongs to the next column over on the same flattened Vessel/Port row.
function stripTrailingPlace(rawLine: string | undefined): string | undefined {
  if (!rawLine) return undefined
  const match = rawLine.match(PLACE_PATTERN)
  if (match && typeof match.index === "number") {
    return rawLine.slice(0, match.index).trim() || undefined
  }
  return rawLine.trim()
}

// Booking/BL references are short alphanumeric codes (a few letters then
// several digits, e.g. "EBKG17466733"). Matching that shape directly skips
// past a neighboring column's value riding along on the same flattened row
// far more reliably than splitting on whitespace.
function extractCode(rawLine: string | undefined): string | undefined {
  if (!rawLine) return undefined
  const match = rawLine.match(/\b[A-Z]{2,6}\d{5,12}\b/)
  return match ? match[0] : rawLine.split(/\s{2,}|[|\t]/)[0]?.trim()
}

function matchDischargePort(text: string | undefined): DischargePort | undefined {
  if (!text) return undefined
  const normalized = text.toLowerCase()
  for (const [key, label] of Object.entries(DISCHARGE_PORT_LABELS) as Array<
    [DischargePort, string]
  >) {
    const city = label.split(",")[0].trim().toLowerCase()
    if (normalized.includes(city)) return key
  }
  return undefined
}

// "Sea Waybill" is its own document title, checked first so a waybill never
// falls through to the "Bill of Lading" fallback below.
function detectBlType(text: string): BlType | undefined {
  const upper = text.toUpperCase()
  if (/SEA\s*WAYBILL/.test(upper)) return "SEA_WAYBILL"
  if (/BILL\s+OF\s+LADING/.test(upper)) return "ORIGINAL"
  return undefined
}

function deriveCountry(port: string | undefined): string | undefined {
  if (!port) return undefined
  const parts = port.split(",")
  if (parts.length < 2) return undefined
  return parts[parts.length - 1].trim()
}

function findShippingLine(text: string): string | undefined {
  for (const [regex, canonical] of CARRIER_ALIASES) {
    if (regex.test(text)) return canonical
  }
  return undefined
}

// Spelled-out container type words, for carriers that print "40' HIGH CUBE"
// instead of the short code "40HC".
const CONTAINER_TYPE_WORDS: Array<[RegExp, string]> = [
  [/\bHIGH[\s-]?CUBE\b/i, "HC"],
  [/\bGENERAL\s*PURPOSE\b|\bDRY\s*VAN\b/i, "GP"],
  [/\bOPEN\s*TOP\b/i, "OT"],
  [/\bFLAT\s*RACK\b/i, "FR"],
  [/\bREFRIGERATED\b|\bREEFER\b/i, "RF"],
  [/\bTANK\b/i, "TK"],
]

function detectContainerType(text: string): string | undefined {
  const shortCodeMatch = text.match(/\b(20|40|45)\s?[-']?\s?(GP|DC|HC|HQ|RF|OT|FR)\b/i)
  if (shortCodeMatch) {
    return `${shortCodeMatch[1]}${shortCodeMatch[2].toUpperCase()}`
  }

  for (const [pattern, code] of CONTAINER_TYPE_WORDS) {
    const wordMatch = text.match(pattern)
    if (wordMatch && typeof wordMatch.index === "number") {
      // Look for the size number immediately before the type word (e.g.
      // "40' HIGH CUBE") rather than anywhere in the container's card, so
      // an unrelated "40.000" measurement elsewhere in the row can't be
      // mistaken for the container's size.
      const before = text.slice(Math.max(0, wordMatch.index - 15), wordMatch.index)
      const sizeMatch = before.match(/\b(20|40|45)\b/)
      return sizeMatch ? `${sizeMatch[1]}${code}` : code
    }
  }
  return undefined
}

function extractContainers(lines: string[]): ParsedContainer[] {
  const containerLineRegex = /\b([A-Z]{4})\s?(\d{7})\b/
  const seen = new Set<string>()
  const containers: ParsedContainer[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(containerLineRegex)
    if (!match) continue

    const number = `${match[1]}${match[2]}`
    if (seen.has(number)) continue
    seen.add(number)

    // Some carriers print a compact table row per container; others print a
    // "card" per container with type/seal/tare weight spread over several
    // lines below the number. Gather everything up to the next container's
    // number (capped, so a missing next marker can't run away) to cover
    // both without bleeding into a neighboring container's card.
    const cardLines: string[] = [lines[i]]
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      if (containerLineRegex.test(lines[j])) break
      cardLines.push(lines[j])
    }
    const card = cardLines.join(" ")

    const containerType = detectContainerType(card)
    const sealMatch = card.match(
      /\bSEAL\s*NUMB\w*\s*:?\s*(.*?)\s*(?=\bTARE\s*WEIGHT\b|$)/i
    )
    const tareMatch = card.match(/\bTARE\s*WEIGHT\s*[:\-]?\s*([\d,.]+)/i)

    // The goods description and this container's own gross weight are on
    // its own OCR'd row (read across the full table width as one line),
    // ahead of the seal/tare details that follow on lines below.
    const ownLineRest = lines[i]
      .slice((match.index ?? 0) + match[0].length)
      .trim()
    const grossMatch = ownLineRest.match(/([\d,]+\.\d{2,3})\s*kgs?\.?/i)
    const inventoryReference = grossMatch
      ? ownLineRest.slice(0, grossMatch.index).trim() || undefined
      : ownLineRest || undefined
    const quantityMatch = inventoryReference?.match(/^(\d+)\s+[A-Za-z]+\(S\)/i)

    containers.push({
      containerNumber: number,
      containerType,
      sealNumber: sealMatch?.[1]?.trim() || undefined,
      tareWeightKg: tareMatch ? tareMatch[1].replace(/,/g, "") : undefined,
      grossWeightKg: grossMatch ? grossMatch[1].replace(/,/g, "") : undefined,
      inventoryReference,
      itemQuantity: quantityMatch?.[1],
    })
  }

  return containers
}

export function parseShipmentDocument(text: string): ParsedShipmentFields {
  const lines = normalizeLines(text)

  const blNumber = findAfterLabel(
    lines,
    /\b(B\/?L|BILL\s+OF\s+LADING)\s*(NO\.?|NUMBER|#)\s*[:\-]?/i
  )
  const bookingRef = extractCode(
    findAfterLabel(lines, /\bBOOKING\s+(NO\.?|NUMBER|REF(ERENCE)?)\b\s*[:\-]?/i)
  )
  const originPort = extractPlaceValue(
    findAfterLabel(lines, /\bPORT\s+OF\s+LOADING\b\s*[:\-]?/i)
  )
  const dischargePortText = extractPlaceValue(
    findAfterLabel(lines, /\bPORT\s+OF\s+DISCHARGE\b\s*[:\-]?/i)
  )

  const vesselVoyageRaw = stripTrailingPlace(
    findAfterLabel(
      lines,
      /\bVESSEL\b\s*(?:(?:\/|AND|&)\s*VOYAGE\s*(NO\.?|NUMBER)?)?\s*[:\-]?/i
    )
  )
  let vesselName: string | undefined
  let voyageNumber: string | undefined
  if (vesselVoyageRaw) {
    // Vessel and voyage are printed together as either "NAME / CODE" or
    // "NAME - CODE" -- a voyage code is a short alphanumeric suffix (e.g.
    // "MA622R"), which distinguishes it from a hyphen inside the vessel
    // name itself.
    const separatorMatch = vesselVoyageRaw.match(
      /^(.*?)\s*[/-]\s*([A-Z0-9]{3,10})$/i
    )
    if (separatorMatch) {
      vesselName = separatorMatch[1].trim() || undefined
      voyageNumber = separatorMatch[2].trim() || undefined
    } else {
      vesselName = vesselVoyageRaw
    }
  }
  if (!voyageNumber) {
    voyageNumber = stripTrailingPlace(
      findAfterLabel(lines, /\bVOYAGE\s*(NO\.?|NUMBER)?\b\s*[:\-]?/i)
    )
  }

  return {
    blNumber,
    blType: detectBlType(text),
    shippingLine: findShippingLine(text),
    vesselName,
    voyageNumber,
    bookingRef,
    originPort,
    originCountry: deriveCountry(originPort),
    dischargePort: matchDischargePort(dischargePortText),
    shipperName: findBlockAfterLabel(lines, /\bSHIPPER\b\s*[:\-]?/i),
    consigneeName: findBlockAfterLabel(lines, /\bCONSIGNEE\b\s*[:\-]?/i),
    notifyParty: findBlockAfterLabel(lines, /\bNOTIFY\s*PARTIES?\b\s*[:\-]?/i),
    containers: extractContainers(lines),
  }
}

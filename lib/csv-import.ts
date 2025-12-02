import { Property } from "@/types"

/**
 * Property field types that can be imported from CSV
 */
export type PropertyField =
  | "address"
  | "type"
  | "status"
  | "mortgageHolder"
  | "purchasePrice"
  | "currentEstValue"
  | "monthlyMortgagePayment"
  | "monthlyInsurance"
  | "monthlyPropertyTax"
  | "monthlyOtherCosts"
  | "monthlyGrossRent"

/**
 * Required fields for property import
 */
export const REQUIRED_FIELDS: PropertyField[] = ["address"]

/**
 * Field mapping: maps internal PropertyField -> CSV header name
 */
export type PropertyFieldMapping = Partial<Record<PropertyField, string>>

/**
 * Infer which PropertyField a CSV header represents based on fuzzy matching
 */
export function inferPropertyFieldFromHeader(header: string): PropertyField | null {
  if (!header || typeof header !== "string") return null

  const h = header.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "")

  // Address variations
  if (
    h.includes("address") ||
    h.includes("street") ||
    h.includes("location") ||
    h === "addr" ||
    h === "property address"
  ) {
    return "address"
  }

  // Type variations
  if (
    h.includes("type") ||
    h.includes("property type") ||
    h.includes("kind") ||
    h === "prop type"
  ) {
    return "type"
  }

  // Status variations
  if (
    h.includes("status") ||
    h.includes("condition") ||
    h.includes("state") ||
    h === "occupancy"
  ) {
    return "status"
  }

  // Mortgage Holder variations
  if (
    h.includes("mortgage holder") ||
    h.includes("lender") ||
    h.includes("bank") ||
    h.includes("mortgage bank") ||
    h.includes("loan provider")
  ) {
    return "mortgageHolder"
  }

  // Purchase Price variations
  if (
    h.includes("purchase price") ||
    h.includes("purchase") ||
    h.includes("acquisition") ||
    h.includes("buy price") ||
    h.includes("cost") ||
    h === "price"
  ) {
    return "purchasePrice"
  }

  // Current Est. Value variations
  if (
    h.includes("current value") ||
    h.includes("estimated value") ||
    h.includes("est value") ||
    h.includes("market value") ||
    h.includes("appraised value") ||
    h.includes("current est")
  ) {
    return "currentEstValue"
  }

  // Monthly Mortgage Payment variations
  if (
    h.includes("monthly mortgage") ||
    h.includes("mortgage payment") ||
    h.includes("p&i") ||
    h.includes("principal interest") ||
    h.includes("loan payment")
  ) {
    return "monthlyMortgagePayment"
  }

  // Monthly Insurance variations
  if (
    h.includes("monthly insurance") ||
    h.includes("insurance") ||
    h.includes("home insurance") ||
    h.includes("property insurance")
  ) {
    return "monthlyInsurance"
  }

  // Monthly Property Tax variations
  if (
    h.includes("property tax") ||
    h.includes("monthly tax") ||
    h.includes("tax") ||
    h.includes("real estate tax")
  ) {
    return "monthlyPropertyTax"
  }

  // Monthly Other Costs variations
  if (
    h.includes("other costs") ||
    h.includes("other expenses") ||
    h.includes("misc costs") ||
    h.includes("additional costs") ||
    h.includes("hoa") ||
    h.includes("maintenance")
  ) {
    return "monthlyOtherCosts"
  }

  // Monthly Gross Rent variations
  if (
    h.includes("gross rent") ||
    h.includes("monthly rent") ||
    h.includes("rent") ||
    h.includes("income") ||
    h.includes("revenue") ||
    h.includes("rental income")
  ) {
    return "monthlyGrossRent"
  }

  return null
}

/**
 * Generate initial field mapping from CSV headers
 */
export function generateInitialMapping(headers: string[]): PropertyFieldMapping {
  const mapping: PropertyFieldMapping = {}
  const usedFields = new Set<PropertyField>()

  // Process headers in order, only assign if field hasn't been used
  headers.forEach((header) => {
    if (!header || header.trim() === "") return

    const inferred = inferPropertyFieldFromHeader(header)
    if (inferred && !usedFields.has(inferred)) {
      mapping[inferred] = header
      usedFields.add(inferred)
    }
  })

  return mapping
}

/**
 * Safely parse a number from CSV value
 */
export function parseNumber(value: any): number {
  if (value === null || value === undefined || value === "") return 0

  // Handle string values
  if (typeof value === "string") {
    // Remove currency symbols, commas, and whitespace
    const cleaned = value.replace(/[$,\s]/g, "").trim()
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed
  }

  // Handle number values
  if (typeof value === "number") {
    return isFinite(value) ? value : 0
  }

  return 0
}

/**
 * Safely parse status from CSV value
 */
export function parseStatus(value: any): Property["status"] {
  if (!value || typeof value !== "string") return "vacant"

  const statusValue = value.toLowerCase().trim()

  const statusMap: Record<string, Property["status"]> = {
    rented: "rented",
    rent: "rented",
    occupied: "rented",
    tenant: "rented",
    vacant: "vacant",
    vacancy: "vacant",
    empty: "vacant",
    available: "vacant",
    "under_maintenance": "under_maintenance",
    maintenance: "under_maintenance",
    repair: "under_maintenance",
    repairing: "under_maintenance",
    sold: "sold",
    sale: "sold",
    closed: "sold",
  }

  return statusMap[statusValue] || "vacant"
}

/**
 * Safely parse a string from CSV value
 */
export function parseString(value: any): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  return String(value).trim()
}

/**
 * Map a CSV row to a Property object using the field mapping
 */
export function mapCsvRowToProperty(
  row: string[],
  headers: string[],
  mapping: PropertyFieldMapping
): Partial<Property> {
  // Create a lookup map: header -> value
  const rowData: Record<string, string> = {}
  headers.forEach((header, index) => {
    if (header && row[index] !== undefined) {
      // Remove quotes and trim
      const value = String(row[index] || "")
        .replace(/^["']|["']$/g, "")
        .trim()
      rowData[header] = value
    }
  })

  // Helper to get mapped value
  const get = (field: PropertyField): string | undefined => {
    const header = mapping[field]
    if (!header) return undefined
    return rowData[header]
  }

  // Build property with safe defaults
  const property: Partial<Property> = {
    address: parseString(get("address")) || "",
    type: parseString(get("type")) || "",
    status: parseStatus(get("status")),
    mortgageHolder: parseString(get("mortgageHolder")) || undefined,
    purchasePrice: parseNumber(get("purchasePrice")),
    currentEstValue: parseNumber(get("currentEstValue")),
    monthlyMortgagePayment: parseNumber(get("monthlyMortgagePayment")),
    monthlyInsurance: parseNumber(get("monthlyInsurance")),
    monthlyPropertyTax: parseNumber(get("monthlyPropertyTax")),
    monthlyOtherCosts: parseNumber(get("monthlyOtherCosts")),
    monthlyGrossRent: parseNumber(get("monthlyGrossRent")),
    rentRoll: [],
    workRequests: [],
  }

  return property
}

/**
 * Validate that required fields are mapped
 */
export function validateMapping(
  mapping: PropertyFieldMapping,
  requiredFields: PropertyField[] = REQUIRED_FIELDS
): { valid: boolean; missingFields: PropertyField[] } {
  const missingFields = requiredFields.filter((field) => !mapping[field])

  return {
    valid: missingFields.length === 0,
    missingFields,
  }
}


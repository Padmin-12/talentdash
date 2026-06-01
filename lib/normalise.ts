import aliases from './aliases.json'

// ─── Legal suffixes to strip from company names ───────────────────────────────
const LEGAL_SUFFIXES = [
  'pvt ltd',
  'pvt. ltd.',
  'pvt. ltd',
  'pvt ltd.',
  'private limited',
  'private ltd',
  ' ltd.',
  ' ltd',
  ' inc.',
  ' inc',
  ' llc',
  ' llp',
  ' corp.',
  ' corp',
  ' co.',
  ' co',
  ' bpo',
  '.com',
  ' technologies',
  ' technology',
  ' tech',
  ' india',
  ' web services',
  ' internet',
  ' platforms',
  ' solutions',
  ' services',
  ' systems',
  ' group',
  ' global',
]

/**
 * Layer 1: Programmatic normalisation
 * - Lowercase + trim
 * - Strip legal suffixes (order matters — longest first within groups)
 * - Strip punctuation
 * - Collapse multiple spaces
 */
function programmaticNormalise(raw: string): string {
  let name = raw.toLowerCase().trim()

  // Strip legal suffixes (multiple passes to handle compound suffixes like "pvt ltd.")
  let prevName = ''
  while (prevName !== name) {
    prevName = name
    for (const suffix of LEGAL_SUFFIXES) {
      if (name.endsWith(suffix)) {
        name = name.slice(0, name.length - suffix.length).trim()
      }
    }
  }

  // Strip punctuation (keep alphanumeric + spaces + hyphens)
  name = name.replace(/[^a-z0-9 -]/g, '').trim()

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim()

  return name
}

/**
 * Layer 2: Alias lookup
 * Handles known variants that programmatic rules can't resolve:
 * "tata consultancy" → "tcs", "amazon.com" → "amazon", etc.
 */
function aliasLookup(normalised: string): string {
  const aliasMap = aliases as Record<string, string>
  return aliasMap[normalised] ?? normalised
}

/**
 * Full normalisation: programmatic rules → alias lookup
 *
 * Examples:
 *   "Google India Pvt. Ltd."  → "google"
 *   "GOOGLE"                  → "google"
 *   "Google  " (trailing)     → "google"
 *   "Tata Consultancy Services" → "tcs"
 *   "TCS Ltd."                → "tcs"
 *   "amazon.com"              → "amazon"
 *   "Amazon Web Services"     → "aws"
 *   "Infosys BPO"             → "infosys"
 *   "Wipro Technologies"      → "wipro"
 *   "Flipkart Internet Pvt Ltd" → "flipkart"
 */
export function normaliseCompanyName(raw: string): string {
  const step1 = programmaticNormalise(raw)
  const step2 = aliasLookup(step1)
  return step2
}

/**
 * Converts a normalised company name to a URL-safe slug.
 * "amazon web services" → "amazon-web-services"
 * "tcs" → "tcs"
 */
export function toSlug(normalised: string): string {
  return normalised.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

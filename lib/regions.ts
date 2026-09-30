// Regions for where-to-watch (PRD F1: editable in Settings). ISO 3166-1
// alpha-2 codes, named in the viewer's language by Intl.DisplayNames.
export const REGION_CODES = [
  "AD", "AE", "AG", "AL", "AO", "AR", "AT", "AU", "AZ", "BA", "BB", "BE", "BF", "BG", "BH", "BM", "BO", "BR", "BS", "BY", "BZ",
  "CA", "CD", "CH", "CI", "CL", "CM", "CO", "CR", "CU", "CV", "CY", "CZ", "DE", "DK", "DO", "DZ", "EC", "EE", "EG", "ES", "FI",
  "FJ", "FR", "GB", "GF", "GH", "GI", "GQ", "GR", "GT", "GY", "HK", "HN", "HR", "HU", "ID", "IE", "IL", "IN", "IQ", "IS", "IT",
  "JM", "JO", "JP", "KE", "KR", "KW", "LB", "LC", "LI", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MG", "MK", "ML", "MT",
  "MU", "MW", "MX", "MY", "MZ", "NE", "NG", "NI", "NL", "NO", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PS", "PT",
  "PY", "QA", "RO", "RS", "RU", "SA", "SC", "SE", "SG", "SI", "SK", "SM", "SN", "SV", "TC", "TD", "TH", "TN", "TR", "TT", "TW",
  "TZ", "UA", "UG", "US", "UY", "VA", "VE", "XK", "YE", "ZA", "ZM", "ZW",
] as const;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export function regionName(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every region, sorted by name. */
export function regionOptions(): Array<{ code: string; name: string }> {
  return REGION_CODES.map((code) => ({ code, name: regionName(code) })).sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function isRegion(value: string): boolean {
  return (REGION_CODES as readonly string[]).includes(value);
}

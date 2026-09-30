/**
 * Fucil identifies discos by short code and reports a separate row per meter
 * type (AEDC exists as both Prepaid and Postpaid), while the bot stores the
 * human name the customer picked from the menu. This maps between the two.
 *
 * Codes below are the ones Fucil actually returns from `GET /discos`. Anything
 * absent there cannot be vended, so it is deliberately not listed.
 */

export type DiscoDefinition = {
  code: string;
  name: string;
  aliases: string[];
};

/** `code` is what Fucil expects; `aliases` covers names seen in the wild. */
export const DISCO_DEFINITIONS: DiscoDefinition[] = [
  { code: 'AEDC', name: 'Abuja Electric', aliases: ['abuja', 'aedc', 'abuja electric', 'abuja electricity', 'abuja electricity distribution', 'aedc plc'] },
  { code: 'EKEDC', name: 'Eko Electric', aliases: ['eko', 'ekedc', 'eko electric', 'ekodis', 'ekodis co', 'eko disco', 'ekedco', 'eko electricity distribution'] },
  { code: 'KEDCO', name: 'Kano Electric', aliases: ['kano', 'kedco', 'kano electric', 'kanodis', 'kanodis co', 'kano disco', 'kano electricity distribution'] },
  { code: 'JEDC', name: 'Jos Electric', aliases: ['jos', 'jedc', 'jos electric', 'jos electricity', 'jos electricity distribution'] },
  { code: 'APLE', name: 'Aple Electric', aliases: ['aple', 'aple electric', 'aple electricity', 'abuja prepaid', 'aple plc'] }
];

/** Lowercased, punctuation-free key for tolerant matching. */
const normalizeKey = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const definitionByAlias = new Map<string, DiscoDefinition>();
for (const definition of DISCO_DEFINITIONS) {
  definitionByAlias.set(normalizeKey(definition.name), definition);
  for (const alias of definition.aliases) {
    definitionByAlias.set(normalizeKey(alias), definition);
  }
}

const KNOWN_CODES = new Set(DISCO_DEFINITIONS.map((definition) => definition.code));

/**
 * Resolves a stored distribution company to a Fucil disco code.
 * Returns null when the value matches no known disco, so callers can refuse
 * the purchase instead of vending against the wrong provider.
 */
export const toDiscoCode = (value: string | null | undefined): string | null => {
  if (!value) return null;

  const key = normalizeKey(value);
  if (!key) return null;

  const direct = definitionByAlias.get(key);
  if (direct) return direct.code;

  // Prefix match catches truncations like "Ikeja Elec" or "Port Harcourt".
  for (const definition of DISCO_DEFINITIONS) {
    const candidates = [definition.name, ...definition.aliases].map(normalizeKey);
    if (candidates.some((candidate) => candidate.startsWith(key) || key.startsWith(candidate))) {
      return definition.code;
    }
  }

  // An uppercase Fucil code stored directly: pass it through if we know it.
  const upper = value.trim().toUpperCase();
  if (KNOWN_CODES.has(upper)) return upper;

  return null;
};

/** Human-readable label for a stored distribution company. */
export const discoName = (value: string | null | undefined): string => {
  const code = toDiscoCode(value);
  return DISCO_DEFINITIONS.find((definition) => definition.code === code)?.name ?? value ?? 'Unknown';
};

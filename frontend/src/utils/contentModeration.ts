/**
 * Content Moderation & Profanity Filtering for K10 Hub
 * 
 * Ensures K10 Hub remains a safe, welcoming, educational, and professional
 * platform for learners, educators, makers, and hobbyists of all age groups.
 */

// ─── Prohibited Words & Inappropriate Terms ─────────────────────────────────────
// Comprehensive list of vulgarity, profanity, slurs, sexually explicit, and abusive terms.
const INAPPROPRIATE_TERMS: string[] = [
  // Profanities & Vulgarities
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckin', 'fck', 'fuk', 'f*ck', 'motherfucker',
  'shit', 'shitty', 'shitting', 'bullshit', 'sh*t', 'sh1t',
  'bitch', 'bitches', 'bitching', 'b*tch', 'b!tch',
  'asshole', 'assholes', 'arsehole', 'a$$hole', 'ashole',
  'bastard', 'bastards',
  'crap', 'crappy',
  'dick', 'dicks', 'dickhead', 'd1ck',
  'pussy', 'pussies', 'p*ssy',
  'cock', 'cocksucker',
  'cunt', 'cunts', 'c*nt',
  'twat', 'wanker', 'wankers', 'prick', 'pricks',
  'slut', 'sluts', 'whore', 'whores',
  'damn', 'goddamn',

  // Hate speech, Slurs, and Harassment
  'nigger', 'niggers', 'nigga', 'niggas', 'n1gger', 'n!gger',
  'faggot', 'faggots', 'fag', 'fags',
  'retard', 'retarded', 'retards',
  'kike', 'chink', 'spic', 'wetback', 'gook',
  'tranny', 'shemale',
  'kill yourself', 'kys', 'die in a fire',

  // Explicit / Adult / NSFW
  'porn', 'porno', 'pornography', 'xxx', 'hentai', 'nsfw', 'xhamster', 'pornhub',
  'blowjob', 'handjob', 'cumshot', 'deepthroat', 'gangbang',
  'dildo', 'vibrator', 'masturbate', 'masturbation',
  'penis', 'vagina', 'clitoris', 'boobs', 'tits', 'naked', 'nude', 'nudes',
  'orgasm', 'ejaculation', 'erotic', 'erotica',

  // Violence / Harm / Illegal
  'pedophile', 'pedo', 'cp', 'childporn', 'suicide',
];

// Exact word match patterns for short ambiguous words that must have strict boundaries
const STRICT_WORD_PATTERNS: RegExp[] = [
  /\b(?:ass|asses)\b/i,
  /\b(?:cock)\b/i,
  /\b(?:tit|tits)\b/i,
  /\b(?:piss|pissed|pissing)\b/i,
  /\b(?:butt)\b/i,
  /\b(?:cum)\b/i,
];

// Dangerous / Inappropriate URL protocols & domains
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:',
  'file:',
  'about:',
  'blob:',
];

const INAPPROPRIATE_DOMAIN_PATTERNS = [
  /porn/i,
  /xxx/i,
  /hentai/i,
  /sex/i,
  /casino/i,
  /gamble/i,
  /betting/i,
  /warez/i,
  /torrent/i,
];

// ─── Text Normalization Helpers ────────────────────────────────────────────────
/**
 * Normalizes leetspeak and spaced-out letters for pattern matching.
 * e.g., "f.u.c.k" -> "fuck", "sh!t" -> "shit", "b!tch" -> "bitch"
 */
function normalizeLeetSpeak(text: string): string {
  return text
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/4/g, 'a')
    .replace(/\$/g, 's')
    .replace(/5/g, 's')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/\|/g, 'l');
}

/**
 * Strips non-alphanumeric separators inside words (e.g. "f-u-c-k" or "f.u.c.k")
 */
function stripSeparators(text: string): string {
  return text.replace(/([a-zA-Z0-9])[.\-_*~^#\s]+([a-zA-Z0-9])/g, '$1$2');
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Checks if a string contains any inappropriate or profane words.
 */
export function containsInappropriateWords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;

  const rawLower = text.toLowerCase();
  const normalized = normalizeLeetSpeak(text);
  const stripped = stripSeparators(normalized);

  // 1. Check strict word patterns
  for (const pattern of STRICT_WORD_PATTERNS) {
    if (pattern.test(rawLower) || pattern.test(normalized)) {
      return true;
    }
  }

  // 2. Check full term list with word boundary or boundary-safe regex
  for (const term of INAPPROPRIATE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (termRegex.test(rawLower) || termRegex.test(normalized) || termRegex.test(stripped)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a list of detected inappropriate words from text.
 */
export function getInappropriateWords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const found: Set<string> = new Set();
  const rawLower = text.toLowerCase();
  const normalized = normalizeLeetSpeak(text);

  for (const pattern of STRICT_WORD_PATTERNS) {
    const match = rawLower.match(pattern) || normalized.match(pattern);
    if (match) {
      found.add(match[0].toLowerCase());
    }
  }

  for (const term of INAPPROPRIATE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (termRegex.test(rawLower) || termRegex.test(normalized)) {
      found.add(term.toLowerCase());
    }
  }

  return Array.from(found);
}

/**
 * Automatically masks / censors bad words in text with asterisks.
 * e.g., "This is fucking awesome" -> "This is f***ing awesome"
 * e.g., "shit" -> "****"
 */
export function censorBadWords(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // Mask strict patterns
  for (const pattern of STRICT_WORD_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), (match) => {
      return '*'.repeat(match.length);
    });
  }

  // Mask general inappropriate terms
  for (const term of INAPPROPRIATE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    sanitized = sanitized.replace(termRegex, (match) => {
      if (match.length <= 3) {
        return '*'.repeat(match.length);
      }
      return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
    });
  }

  return sanitized;
}

/**
 * Validates text input. Returns whether it is valid, an error message if inappropriate,
 * and the cleaned/censored text.
 */
export function validateContent(
  text: string,
  fieldName = 'Content'
): { isValid: boolean; error?: string; cleanText: string } {
  const cleanText = censorBadWords(text.trim());
  const badWords = getInappropriateWords(text);

  if (badWords.length > 0) {
    return {
      isValid: false,
      error: `Inappropriate language detected in ${fieldName}. Please maintain a friendly, professional tone suitable for all age groups.`,
      cleanText,
    };
  }

  return {
    isValid: true,
    cleanText,
  };
}

/**
 * Validates links and URL insertions.
 * Blocks javascript:, data:, and inappropriate/unsafe domains or text in URLs.
 */
export function validateUrl(
  url: string,
  fieldName = 'URL'
): { isValid: boolean; error?: string; cleanUrl: string } {
  if (!url || typeof url !== 'string') {
    return { isValid: true, cleanUrl: '' };
  }

  const trimmed = url.trim();

  // 1. Check dangerous protocols
  for (const proto of DANGEROUS_PROTOCOLS) {
    if (trimmed.toLowerCase().startsWith(proto)) {
      return {
        isValid: false,
        error: `Insecure or prohibited protocol in ${fieldName}. Only standard web links (https:// or http://) are allowed.`,
        cleanUrl: '',
      };
    }
  }

  // 2. Check for inappropriate terms inside URL
  if (containsInappropriateWords(trimmed)) {
    return {
      isValid: false,
      error: `Inappropriate terms detected in ${fieldName}.`,
      cleanUrl: '',
    };
  }

  // 3. Check for inappropriate domains
  for (const pattern of INAPPROPRIATE_DOMAIN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        error: `The domain in ${fieldName} is not permitted on this platform.`,
        cleanUrl: '',
      };
    }
  }

  return {
    isValid: true,
    cleanUrl: trimmed,
  };
}

/**
 * Content Moderation & Profanity Filtering for K10 Hub (Backend)
 * 
 * Ensures K10 Hub remains a safe, welcoming, educational, and professional
 * platform for learners, educators, makers, and hobbyists of all age groups.
 */

const INAPPROPRIATE_TERMS: string[] = [
  // Profanities & Vulgarities
  'fuck', 'fucking', 'fcked', 'fucker', 'fuckin', 'fck', 'fuk', 'f*ck', 'motherfucker',
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

const STRICT_WORD_PATTERNS: RegExp[] = [
  /\b(?:ass|asses)\b/i,
  /\b(?:cock)\b/i,
  /\b(?:tit|tits)\b/i,
  /\b(?:piss|pissed|pissing)\b/i,
  /\b(?:butt)\b/i,
  /\b(?:cum)\b/i,
];

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

export function containsInappropriateWords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const rawLower = text.toLowerCase();
  const normalized = normalizeLeetSpeak(text);

  for (const pattern of STRICT_WORD_PATTERNS) {
    if (pattern.test(rawLower) || pattern.test(normalized)) return true;
  }

  for (const term of INAPPROPRIATE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (termRegex.test(rawLower) || termRegex.test(normalized)) return true;
  }

  return false;
}

export function censorBadWords(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let sanitized = text;

  for (const pattern of STRICT_WORD_PATTERNS) {
    sanitized = sanitized.replace(new RegExp(pattern.source, 'gi'), (match) => '*'.repeat(match.length));
  }

  for (const term of INAPPROPRIATE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    sanitized = sanitized.replace(termRegex, (match) => {
      if (match.length <= 3) return '*'.repeat(match.length);
      return match[0] + '*'.repeat(match.length - 2) + match[match.length - 1];
    });
  }

  return sanitized;
}

export function validateUrl(url: string, fieldName = 'URL'): { isValid: boolean; error?: string; cleanUrl: string } {
  if (!url || typeof url !== 'string') return { isValid: true, cleanUrl: '' };
  const trimmed = url.trim();

  for (const proto of DANGEROUS_PROTOCOLS) {
    if (trimmed.toLowerCase().startsWith(proto)) {
      return { isValid: false, error: `Insecure or prohibited protocol in ${fieldName}.`, cleanUrl: '' };
    }
  }

  if (containsInappropriateWords(trimmed)) {
    return { isValid: false, error: `Inappropriate terms detected in ${fieldName}.`, cleanUrl: '' };
  }

  for (const pattern of INAPPROPRIATE_DOMAIN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isValid: false, error: `Disallowed domain in ${fieldName}.`, cleanUrl: '' };
    }
  }

  return { isValid: true, cleanUrl: trimmed };
}

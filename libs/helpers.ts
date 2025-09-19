import { converter, formatHex, formatHex8, formatRgb, parse } from "culori";
import resolveConfig from "tailwindcss/resolveConfig";

import {
  COLOR_FORMATS,
  DEFAULT_COLOR_FORMAT,
  type ColorFormat,
} from "./conversion";

const DEFAULT_CLASS_SELECTOR = ".yourClass";
const INDENT = "  ";

const BREAKPOINT_MEDIA: Record<BreakpointVariant, string> = {
  sm: "@media (min-width: 640px)",
  md: "@media (min-width: 768px)",
  lg: "@media (min-width: 1024px)",
  xl: "@media (min-width: 1280px)",
  "2xl": "@media (min-width: 1536px)",
};

const PSEUDO_CLASS_MAP: Record<PseudoVariant, string> = {
  hover: ":hover",
  focus: ":focus",
  "focus-visible": ":focus-visible",
  "focus-within": ":focus-within",
  active: ":active",
  visited: ":visited",
  disabled: ":disabled",
  checked: ":checked",
  first: ":first-child",
  last: ":last-child",
  odd: ":nth-child(odd)",
  even: ":nth-child(even)",
};

type BreakpointVariant = "sm" | "md" | "lg" | "xl" | "2xl";

type PseudoVariant =
  | "hover"
  | "focus"
  | "focus-visible"
  | "focus-within"
  | "active"
  | "visited"
  | "disabled"
  | "checked"
  | "first"
  | "last"
  | "odd"
  | "even";

interface ParsedToken {
  baseClass: string;
  breakpoints: BreakpointVariant[];
  pseudos: PseudoVariant[];
  important: boolean;
}

interface DeclarationBucket {
  items: string[];
  seen: Set<string>;
}

type DeclarationBuckets = Map<string, DeclarationBucket>;
type BreakpointBuckets = Map<BreakpointVariant, DeclarationBuckets>;

interface UtilityData {
  declarations: string[];
  atRules: string[];
}

type UtilityDataMap = Map<string, UtilityData>;

export interface ConversionOptions {
  className?: string;
  colorFormat?: ColorFormat;
}

const BREAKPOINT_ORDER: BreakpointVariant[] = ["sm", "md", "lg", "xl", "2xl"];

// Tailwind internals are CommonJS modules without type definitions.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createContext } = require("tailwindcss/lib/lib/setupContextUtils") as {
  createContext: (config: unknown, changedContent?: unknown, root?: unknown) => unknown;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateRules } = require("tailwindcss/lib/lib/generateRules") as {
  generateRules: (classNames: string[], context: unknown) => Array<[unknown, UtilityNode]>;
};

type PostCssRule = {
  type: "rule";
  raws?: {
    tailwind?: {
      classCandidate?: string;
    };
  };
  walkDecls: (callback: (decl: { prop: string; value: string }) => void) => void;
};

type PostCssAtRule = {
  type: "atrule";
  raws?: {
    tailwind?: {
      classCandidate?: string;
    };
  };
  toString: () => string;
};

type UtilityNode = PostCssRule | PostCssAtRule;

let cachedTailwindConfig: unknown | null = null;
let cachedTailwindContext: unknown | null = null;

const utilityCache: Map<string, UtilityData> = new Map();

const convertToRgb = converter("rgb");
const convertToOklch = converter("oklch");

const getTailwindConfig = (): unknown => {
  if (!cachedTailwindConfig) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const userConfig = require("../tailwind.config.js");
    cachedTailwindConfig = resolveConfig(userConfig);
  }

  return cachedTailwindConfig;
};

const getTailwindContext = (): unknown => {
  if (!cachedTailwindContext) {
    cachedTailwindContext = createContext(getTailwindConfig());
  }

  return cachedTailwindContext;
};

const loadUtilityData = (classNames: string[]): UtilityDataMap => {
  const uniqueClassNames = Array.from(new Set(classNames));
  const missingClassNames = uniqueClassNames.filter((className) => !utilityCache.has(className));

  if (missingClassNames.length > 0) {
    const context = getTailwindContext();
    const generated = generateRules(missingClassNames, context);

    for (const [, node] of generated) {
      const rawCandidate = node?.raws?.tailwind?.classCandidate;
      if (!rawCandidate) {
        continue;
      }

      let entry = utilityCache.get(rawCandidate);
      if (!entry) {
        entry = { declarations: [], atRules: [] };
        utilityCache.set(rawCandidate, entry);
      }

      if (node.type === "atrule") {
        const serialized = node.toString().trim();
        if (serialized && !entry.atRules.includes(serialized)) {
          entry.atRules.push(serialized);
        }
        continue;
      }

      if (node.type === "rule") {
        const targetEntry = entry;
        if (!targetEntry) {
          continue;
        }

        node.walkDecls(({ prop, value }) => {
          const declaration = `${prop}: ${value};`;
          if (targetEntry.declarations.includes(declaration)) {
            return;
          }

          targetEntry.declarations.push(declaration);
        });
      }
    }
  }

  const result: UtilityDataMap = new Map();
  for (const className of uniqueClassNames) {
    const cachedEntry = utilityCache.get(className);
    if (!cachedEntry) {
      continue;
    }

    result.set(className, {
      declarations: [...cachedEntry.declarations],
      atRules: [...cachedEntry.atRules],
    });
  }

  return result;
};

export const getConvertedClasses = (
  input: string,
  options: ConversionOptions = {}
): string => {
  if (typeof input !== "string") {
    return "";
  }

  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return "";
  }

  const classSelector = normalizeClassSelector(options.className);
  const tokens = trimmedInput
    .replace(/\s+/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  const parsedTokens = tokens
    .map((token) => parseToken(token))
    .filter((token): token is ParsedToken => token !== null);

  if (parsedTokens.length === 0) {
    return "";
  }

  const utilityData = loadUtilityData(parsedTokens.map((token) => token.baseClass));

  const colorFormat = normalizeColorFormat(options.colorFormat);

  const rootBuckets: DeclarationBuckets = new Map();
  const breakpointBuckets: BreakpointBuckets = new Map();
  const globalAtRules: Set<string> = new Set();

  for (const token of parsedTokens) {
    const data = utilityData.get(token.baseClass);
    if (!data) {
      continue;
    }

    const atRules = applyColorFormatToAtRules(data.atRules, colorFormat);
    atRules.forEach((rule) => globalAtRules.add(rule));

    const baseDeclarations = token.important
      ? data.declarations.map(applyImportantFlag)
      : [...data.declarations];

    const declarations = applyColorFormatToDeclarations(
      baseDeclarations,
      colorFormat
    );

    if (declarations.length === 0) {
      continue;
    }

    const pseudoKey = formatPseudoKey(token.pseudos);

    if (token.breakpoints.length === 0) {
      appendDeclarations(rootBuckets, pseudoKey, declarations);
      continue;
    }

    for (const breakpoint of token.breakpoints) {
      if (!BREAKPOINT_MEDIA[breakpoint]) {
        continue;
      }

      let bucket = breakpointBuckets.get(breakpoint);
      if (!bucket) {
        bucket = new Map();
        breakpointBuckets.set(breakpoint, bucket);
      }

      appendDeclarations(bucket, pseudoKey, declarations);
    }
  }

  const sections: string[] = [];

  if (globalAtRules.size > 0) {
    sections.push(...Array.from(globalAtRules));
  }

  const rootKeys = sortPseudoKeys(Array.from(rootBuckets.keys()));
  for (const pseudoKey of rootKeys) {
    const bucket = rootBuckets.get(pseudoKey);
    if (!bucket || bucket.items.length === 0) {
      continue;
    }

    sections.push(formatRuleBlock(`${classSelector}${pseudoKey}`, bucket.items));
  }

  for (const breakpoint of BREAKPOINT_ORDER) {
    const pseudoBuckets = breakpointBuckets.get(breakpoint);
    if (!pseudoBuckets) {
      continue;
    }

    const pseudoKeys = sortPseudoKeys(Array.from(pseudoBuckets.keys()));
    if (pseudoKeys.length === 0) {
      continue;
    }

    const innerBlocks: string[] = [];
    for (const pseudoKey of pseudoKeys) {
      const bucket = pseudoBuckets.get(pseudoKey);
      if (!bucket || bucket.items.length === 0) {
        continue;
      }

      innerBlocks.push(
        formatRuleBlock(`${classSelector}${pseudoKey}`, bucket.items, 1)
      );
    }

    if (innerBlocks.length === 0) {
      continue;
    }

    sections.push(
      `${BREAKPOINT_MEDIA[breakpoint]} {\n${innerBlocks.join("\n\n")}\n}`
    );
  }

  return sections.join("\n\n").trim();
};

const parseToken = (token: string): ParsedToken | null => {
  const segments = splitVariants(token);
  if (segments.length === 0) {
    return null;
  }

  let rawBaseClass = segments.pop();
  if (!rawBaseClass) {
    return null;
  }

  let important = false;
  if (rawBaseClass.startsWith("!")) {
    important = true;
    rawBaseClass = rawBaseClass.slice(1);
  }

  const baseClass = rawBaseClass.trim();
  if (!baseClass) {
    return null;
  }

  const breakpoints: BreakpointVariant[] = [];
  const pseudos: PseudoVariant[] = [];

  for (const segment of segments) {
    if (isBreakpointVariant(segment)) {
      breakpoints.push(segment);
      continue;
    }

    if (isPseudoVariant(segment)) {
      pseudos.push(segment);
      continue;
    }

    return null;
  }

  return { baseClass, breakpoints, pseudos, important };
};

const splitVariants = (token: string): string[] => {
  const result: string[] = [];
  let buffer = "";
  let bracketDepth = 0;

  for (let index = 0; index < token.length; index += 1) {
    const char = token[index];

    if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
    }

    if (char === ":" && bracketDepth === 0) {
      result.push(buffer);
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer) {
    result.push(buffer);
  }

  return result;
};

const formatPseudoKey = (pseudos: PseudoVariant[]): string =>
  pseudos.map((pseudo) => PSEUDO_CLASS_MAP[pseudo]).join("");

const sortPseudoKeys = (keys: string[]): string[] => {
  return keys.sort((a, b) => {
    if (a === b) {
      return 0;
    }

    if (a === "") {
      return -1;
    }

    if (b === "") {
      return 1;
    }

    return a.localeCompare(b);
  });
};

const appendDeclarations = (
  buckets: DeclarationBuckets,
  pseudoKey: string,
  declarations: string[]
): void => {
  let bucket = buckets.get(pseudoKey);
  if (!bucket) {
    bucket = { items: [], seen: new Set() };
    buckets.set(pseudoKey, bucket);
  }

  for (const declaration of declarations) {
    if (bucket.seen.has(declaration)) {
      continue;
    }

    bucket.seen.add(declaration);
    bucket.items.push(declaration);
  }
};

const COLOR_FORMAT_SET = new Set<ColorFormat>(COLOR_FORMATS);

const COLOR_TOKEN_PATTERN =
  /(?:#(?:[0-9a-fA-F]{3,8})|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|rgb)\((?:[^)(]+|\((?:[^)(]+|\([^)(]*\))*\))*\))/g;

const TAILWIND_VAR_PATTERN = /var\(--[\w-]+(?:,\s*([^)]+))?\)/g;

const normalizeColorFormat = (format?: string): ColorFormat => {
  if (!format) {
    return DEFAULT_COLOR_FORMAT;
  }

  const normalized = format.toLowerCase() as ColorFormat;
  return COLOR_FORMAT_SET.has(normalized)
    ? normalized
    : DEFAULT_COLOR_FORMAT;
};

const applyColorFormatToDeclarations = (
  declarations: string[],
  format: ColorFormat
): string[] => {
  if (format === "original") {
    return declarations;
  }

  return declarations.map((declaration) =>
    applyColorFormatToDeclaration(declaration, format)
  );
};

const applyColorFormatToDeclaration = (
  declaration: string,
  format: ColorFormat
): string => {
  const separatorIndex = declaration.indexOf(":");
  if (separatorIndex === -1) {
    return declaration;
  }

  const property = declaration.slice(0, separatorIndex).trimEnd();
  let value = declaration.slice(separatorIndex + 1).trim();

  if (!value) {
    return declaration;
  }

  if (value.endsWith(";")) {
    value = value.slice(0, -1).trimEnd();
  }

  let importantSuffix = "";
  if (value.endsWith("!important")) {
    importantSuffix = " !important";
    value = value.slice(0, -10).trimEnd();
  }

  const converted = convertColorTokens(value, format);
  if (!converted.changed) {
    return declaration;
  }

  return `${property}: ${converted.value}${importantSuffix};`;
};

const applyColorFormatToAtRules = (
  atRules: string[],
  format: ColorFormat
): string[] => {
  if (format === "original") {
    return atRules;
  }

  return atRules.map((rule) => convertColorTokens(rule, format).value);
};

const convertColorTokens = (
  value: string,
  format: ColorFormat
): { value: string; changed: boolean } => {
  let changed = false;

  const replaced = value.replace(COLOR_TOKEN_PATTERN, (match) => {
    const converted = convertSingleColorToken(match, format);
    if (!converted) {
      return match;
    }

    changed = true;
    return converted;
  });

  return { value: replaced, changed };
};

const convertSingleColorToken = (
  token: string,
  format: ColorFormat
): string | null => {
  const sanitized = token.replace(TAILWIND_VAR_PATTERN, (_match, fallback) => {
    if (typeof fallback === "string" && fallback.trim().length > 0) {
      return fallback.trim();
    }

    return "1";
  });

  const parsedColor = parse(sanitized);
  if (!parsedColor) {
    return null;
  }

  switch (format) {
    case "rgb":
      return formatRgbColor(parsedColor);
    case "hex":
      return formatHexColor(parsedColor);
    case "oklch":
      return formatOklchColor(parsedColor);
    default:
      return null;
  }
};

const formatRgbColor = (color: unknown): string | null => {
  const rgbColor = convertToRgb(color);
  if (!rgbColor) {
    return null;
  }

  return formatRgb(rgbColor);
};

const formatHexColor = (color: unknown): string | null => {
  const rgbColor = convertToRgb(color);
  if (!rgbColor) {
    return null;
  }

  if (typeof rgbColor.alpha === "number" && rgbColor.alpha < 1) {
    return formatHex8(rgbColor);
  }

  return formatHex(rgbColor);
};

const formatOklchColor = (color: unknown): string | null => {
  const oklchColor = convertToOklch(color);
  if (!oklchColor) {
    return null;
  }

  const l = formatNumber(oklchColor.l, 4);
  const c = formatNumber(oklchColor.c, 4);
  const h = formatNumber(oklchColor.h ?? 0, 2);
  const alpha =
    typeof oklchColor.alpha === "number" ? oklchColor.alpha : undefined;

  const alphaPart =
    typeof alpha === "number" && alpha < 1
      ? ` / ${formatNumber(alpha, 4)}`
      : "";

  return `oklch(${l} ${c} ${h}${alphaPart})`;
};

const formatNumber = (value: number, precision: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const factor = 10 ** precision;
  const rounded = Math.round(value * factor) / factor;
  return Number.parseFloat(rounded.toString()).toString();
};

const formatRuleBlock = (
  selector: string,
  declarations: string[],
  indentLevel = 0
): string => {
  const indent = INDENT.repeat(indentLevel);
  const innerIndent = INDENT.repeat(indentLevel + 1);

  const lines = declarations.map((declaration) => `${innerIndent}${declaration}`);

  return `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
};

const normalizeClassSelector = (className?: string): string => {
  if (!className) {
    return DEFAULT_CLASS_SELECTOR;
  }

  const trimmed = className.trim();
  if (!trimmed) {
    return DEFAULT_CLASS_SELECTOR;
  }

  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
};

const applyImportantFlag = (declaration: string): string => {
  const trimmed = declaration.trim();

  if (!trimmed.endsWith(";")) {
    return `${trimmed} !important;`;
  }

  const withoutSemicolon = trimmed.slice(0, -1).trimEnd();
  if (withoutSemicolon.endsWith("!important")) {
    return trimmed;
  }

  return `${withoutSemicolon} !important;`;
};

const isBreakpointVariant = (value: string): value is BreakpointVariant =>
  Object.prototype.hasOwnProperty.call(BREAKPOINT_MEDIA, value);

const isPseudoVariant = (value: string): value is PseudoVariant =>
  Object.prototype.hasOwnProperty.call(PSEUDO_CLASS_MAP, value);

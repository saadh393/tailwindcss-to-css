export type ColorFormat = "original" | "rgb" | "hex" | "oklch";

export const DEFAULT_COLOR_FORMAT: ColorFormat = "original";

export const COLOR_FORMATS: readonly ColorFormat[] = [
  "original",
  "rgb",
  "hex",
  "oklch",
];

export interface ColorFormatOption {
  value: ColorFormat;
  label: string;
  description?: string;
}

export const COLOR_FORMAT_OPTIONS: readonly ColorFormatOption[] = [
  {
    value: "original",
    label: "Tailwind default",
    description: "Keep Tailwind's native CSS output",
  },
  {
    value: "rgb",
    label: "RGB",
    description: "Convert colors to rgb()/rgba() values",
  },
  {
    value: "hex",
    label: "HEX",
    description: "Use #RRGGBB or #RRGGBBAA notation",
  },
  {
    value: "oklch",
    label: "OKLCH",
    description: "Output perceptual oklch() colors",
  },
];

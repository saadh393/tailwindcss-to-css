import { COLOR_FORMAT_OPTIONS, type ColorFormat } from '../libs/conversion';

interface ColorFormatSelectorProps {
  value: ColorFormat;
  onChange: (format: ColorFormat) => void;
  options?: typeof COLOR_FORMAT_OPTIONS;
}

const ColorFormatSelector = ({
  value,
  onChange,
  options = COLOR_FORMAT_OPTIONS,
}: ColorFormatSelectorProps) => {
  return (
    <div className="flex flex-col gap-1 text-gray-300">
      <label className="text-sm font-medium text-gray-400" htmlFor="color-format">
        Color format
      </label>
      <select
        id="color-format"
        className="bg-[#111] border border-gray-700 rounded px-2 py-1 text-sm focus:outline-none focus:border-gray-500"
        value={value}
        onChange={(event) => onChange(event.target.value as ColorFormat)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500">
        {options.find((option) => option.value === value)?.description}
      </p>
    </div>
  );
};

export default ColorFormatSelector;

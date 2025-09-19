import { COLOR_FORMAT_OPTIONS, type ColorFormat } from '../libs/conversion';

interface ColorFormatSelectorProps {
  value: ColorFormat;
  onChange: (format: ColorFormat) => void;
  options?: typeof COLOR_FORMAT_OPTIONS;
  className?: string;
  label?: string;
  id?: string;
}

const ColorFormatSelector = ({
  value,
  onChange,
  options = COLOR_FORMAT_OPTIONS,
  className,
  label = 'Color Output Format',
  id = 'color-format',
}: ColorFormatSelectorProps) => {
  const selectedOption = options.find((option) => option.value === value);

  const containerClassName = ['flex flex-col gap-2 text-gray-300', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName}>
      <label className="text-sm font-medium text-gray-200" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className="rounded-lg border border-[#1f2937] bg-[#151b29] px-3 py-2 text-sm text-gray-200 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        value={value}
        onChange={(event) => onChange(event.target.value as ColorFormat)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selectedOption?.description ? (
        <p className="text-xs text-gray-500">{selectedOption.description}</p>
      ) : null}
    </div>
  );
};

export default ColorFormatSelector;

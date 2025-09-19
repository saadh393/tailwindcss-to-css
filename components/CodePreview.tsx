import { Highlight, themes, type Language } from 'prism-react-renderer';

interface CodePreviewProps {
  value: string;
  language?: 'css' | 'html' | 'javascript' | 'json' | 'tsx' | 'typescript';
  placeholder?: string;
  className?: string;
  id?: string;
}

const CodePreview = ({
  value,
  language = 'css',
  placeholder = '.your-class { /* styles */ }',
  className,
  id,
}: CodePreviewProps) => {
  const hasContent = value.trim().length > 0;

  return (
    <div
      id={id}
      className={[
        'relative min-h-[260px] rounded-xl border border-[#1f2937] bg-[#101827] text-sm font-mono text-gray-200',
        'shadow-inner shadow-black/10',
        'overflow-auto',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasContent ? (
        <Highlight
          code={value}
          language={language as Language}
          theme={themes.nightOwl}
        >
          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${highlightClassName} m-0 h-full w-full bg-transparent px-4 py-4 text-sm`}
              style={style}
            >
              {tokens.map((line, lineIndex) => (
                <div key={lineIndex} {...getLineProps({ line })}>
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      ) : (
        <div className="px-4 py-4 text-sm text-gray-500">{placeholder}</div>
      )}
    </div>
  );
};

export default CodePreview;

import { ClipboardCopyIcon } from "@heroicons/react/outline";
import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import GitHubButton from "react-github-button";
import { toast } from "sonner";
import CodePreview from "../components/CodePreview";
import ColorFormatSelector from "../components/ColorFormatSelector";
import { COLOR_FORMATS, DEFAULT_COLOR_FORMAT, type ColorFormat } from "../libs/conversion";
import Logo from "../public/logo.svg";

const STORAGE_KEYS = {
  colorFormat: "ttcss:color-format",
  className: "ttcss:class-name",
};

export default function App() {
  const [input, setInput] = useState("");

  const [result, setResult] = useState("");
  const [colorFormat, setColorFormat] = useState<ColorFormat>(DEFAULT_COLOR_FORMAT);
  const [defaultClassName, setDefaultClassName] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [manualTrigger, setManualTrigger] = useState(0);
  const prefsLoadedRef = useRef(false);

  const trimmedClassName = useMemo(() => defaultClassName.trim() || undefined, [defaultClassName]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedFormat = window.localStorage.getItem(STORAGE_KEYS.colorFormat);
      if (storedFormat && (COLOR_FORMATS as readonly string[]).includes(storedFormat)) {
        setColorFormat(storedFormat as ColorFormat);
      }

      const storedClassName = window.localStorage.getItem(STORAGE_KEYS.className);
      if (storedClassName) {
        setDefaultClassName(storedClassName);
      }
    } catch (error) {
      console.error("Failed to read saved preferences", error);
    } finally {
      prefsLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!prefsLoadedRef.current || typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEYS.colorFormat, colorFormat);
    } catch (error) {
      console.error("Failed to persist color format", error);
    }
  }, [colorFormat]);

  useEffect(() => {
    if (!prefsLoadedRef.current || typeof window === "undefined") {
      return;
    }

    try {
      const trimmed = defaultClassName.trim();
      if (trimmed) {
        window.localStorage.setItem(STORAGE_KEYS.className, trimmed);
      } else {
        window.localStorage.removeItem(STORAGE_KEYS.className);
      }
    } catch (error) {
      console.error("Failed to persist default class name", error);
    }
  }, [defaultClassName]);

  useEffect(() => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      setResult("");
      setIsConverting(false);
      return;
    }

    const controller = new AbortController();
    let canceled = false;

    const convert = async () => {
      if (!canceled) {
        setIsConverting(true);
      }

      try {
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: trimmedInput,
            colorFormat,
            className: trimmedClassName,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to convert input");
        }

        const data: { css?: string } = await response.json();

        if (!canceled) {
          setResult(data.css ?? "");
        }
      } catch (error) {
        if (controller.signal.aborted || canceled) {
          return;
        }

        console.error("Conversion error", error);
        setResult("");
        toast.error("Unable to convert classes");
      } finally {
        if (!canceled) {
          setIsConverting(false);
        }
      }
    };

    convert();

    return () => {
      canceled = true;
      controller.abort();
    };
  }, [input, colorFormat, trimmedClassName, manualTrigger]);

  const handleConvertClick = () => {
    setManualTrigger((value) => value + 1);
  };

  return (
    <main className="min-h-screen bg-[#0b1220] text-gray-200">
      <Head>
        <title>Tailwind To CSS</title>
        <meta name="description" content="Tailwind To CSS" />
        <link rel="icon" href="/logo.svg" />
        <meta name="google-site-verification" content="0AF5grfAZJ4fXWWuM-nyXMHJh1hHSn5Mv2__fgIbUwU" />
      </Head>

      <nav className="border-b border-[#151b29] bg-[#111826]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-gray-100">
            <Image src={Logo} alt="Tailwind-to-CSS logo" height={35} width={35} />
            <span className="tracking-wide">TailwindCSS to CSS</span>
          </div>
          <div className="flex items-center gap-3">
            <GitHubButton type="stargazers" namespace="saadh393" repo="tailwindcss-to-css" />
          </div>
        </div>
      </nav>

      <section className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-12">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-white md:text-4xl">TailwindCSS to CSS Converter</h1>
          <p className="mt-3 text-sm text-gray-400 md:text-base">
            Instantly convert your Tailwind CSS classes into clean, raw CSS.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300" htmlFor="tailwind-input">
              TailwindCSS Input
            </label>
            <textarea
              id="tailwind-input"
              className="min-h-[260px] resize-y rounded-xl border border-[#1f2937] bg-[#101827] px-4 py-3 text-sm text-gray-200 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="e.g. bg-blue-500 text-white p-4"
              autoFocus
            ></textarea>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-300" htmlFor="css-output">
              CSS Output
            </label>
            <div className="relative">
              <CodePreview
                id="css-output"
                value={result}
                language="css"
                className="h-full w-full"
                placeholder=".yourClass { /* styles will appear here */ }"
              />
              <CopyToClipboard text={result} onCopy={() => toast.success("Copied!")}>
                <button
                  type="button"
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-[#1f2937] bg-[#161f2f] px-3 py-2 text-xs font-medium text-gray-300 transition hover:border-blue-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <ClipboardCopyIcon className="h-4 w-4" />
                  <span>Copy CSS</span>
                </button>
              </CopyToClipboard>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1f2937] bg-[#101827] px-5 py-6 shadow-lg shadow-black/20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Conversion Options</h2>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            <ColorFormatSelector value={colorFormat} onChange={setColorFormat} className="text-gray-200" />
            <div className="flex flex-col gap-2 text-gray-300">
              <label className="text-sm font-medium text-gray-200" htmlFor="default-class-name">
                Default Class Name
              </label>
              <input
                id="default-class-name"
                type="text"
                value={defaultClassName}
                onChange={(event) => setDefaultClassName(event.target.value)}
                placeholder="(optional)"
                className="rounded-lg border border-[#1f2937] bg-[#151b29] px-3 py-2 text-sm text-gray-200 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500">
                Provide a custom selector like <code>.container</code>; defaults to <code>.yourClass</code>.
              </p>
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleConvertClick}
              disabled={isConverting || input.trim().length === 0}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/60 disabled:cursor-not-allowed disabled:bg-blue-600/40 md:w-auto"
            >
              {isConverting ? "Converting…" : "Convert"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

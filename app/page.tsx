"use client";

import { preload, removeBackground, type Config } from "@imgly/background-removal";
import { useEffect, useMemo, useState } from "react";

const removerConfig: Config = {
  model: "isnet",
  device: "gpu",
  output: {
    format: "image/png",
    quality: 1,
  },
};

export default function Home() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("drop a pic and we will clean it up.");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const outputName = useMemo(() => {
    if (!inputFile) {
      return "image-transparent.png";
    }

    const dot = inputFile.name.lastIndexOf(".");
    const base = dot > 0 ? inputFile.name.slice(0, dot) : inputFile.name;
    return `${base}-transparent.png`;
  }, [inputFile]);

  useEffect(() => {
    preload(removerConfig).catch(() => {
      // Preload can fail when users are offline.
    });
  }, []);

  useEffect(() => {
    return () => {
      if (inputUrl) {
        URL.revokeObjectURL(inputUrl);
      }
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [inputUrl, outputUrl]);

  function onFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    if (inputUrl) {
      URL.revokeObjectURL(inputUrl);
    }

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    setError(null);
    setProgress(0);
    setInputFile(file);
    setInputUrl(URL.createObjectURL(file));
    setOutputUrl(null);
    setStatus("ready when you are.");
  }

  async function processImage() {
    if (!inputFile) {
      setError("choose an image first.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStatus("loading model and assets...");

    try {
      const blob = await removeBackground(inputFile, {
        ...removerConfig,
        progress: (key, current, total) => {
          const safeTotal = total <= 0 ? 1 : total;
          const ratio = Math.min(current / safeTotal, 1);
          setProgress(Math.round(ratio * 100));

          if (key.startsWith("fetch:")) {
            setStatus(`downloading model assets (${Math.round(ratio * 100)}%)...`);
          } else {
            setStatus("cutting subject from background...");
          }
        },
      });

      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }

      setOutputUrl(URL.createObjectURL(blob));
      setProgress(100);
      setStatus("done. transparent png is ready.");
    } catch (cause) {
      console.error(cause);
      setError("background removal failed. try a clearer image or run it again.");
      setStatus("could not process this image.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="app-shell">
      <div className="ambient-orb ambient-one" />
      <div className="ambient-orb ambient-two" />

      <section className="hero">
        <p className="eyebrow">100% free • browser only • chill local ai</p>
        <h1>victor diddy background remover</h1>
        <p className="hero-copy">
          jus a little off the top bruh
        </p>
      </section>

      <section className="studio-card">
        <div className="file-picker" role="group" aria-label="image file picker">
          <label htmlFor="image-upload" className="file-trigger">
            choose image
          </label>
          <span className="file-name">{inputFile?.name ?? "no file chosen"}</span>
          <input
            id="image-upload"
            className="file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onFileChange(event.target.files?.[0])}
          />
        </div>

        <div className="actions">
          <button
            type="button"
            className="primary-btn"
            onClick={processImage}
            disabled={!inputFile || isProcessing}
          >
            {isProcessing ? "processing..." : "remove background"}
          </button>
          <a
            className={`download-btn ${!outputUrl ? "disabled" : ""}`}
            href={outputUrl ?? undefined}
            download={outputName}
            aria-disabled={!outputUrl}
          >
            download png
          </a>
        </div>

        <div className="status-wrap">
          <p>{status}</p>
          {isProcessing ? (
            <div className="progress-track" role="progressbar" aria-valuenow={progress}>
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="preview-grid">
          {/* Blob URL previews are not compatible with Next/Image optimization pipeline. */}
          {/* eslint-disable @next/next/no-img-element */}
          <figure>
            <figcaption>original</figcaption>
            <div className="image-frame">
              {inputUrl ? <img src={inputUrl} alt="original upload" /> : <p>no image yet</p>}
            </div>
          </figure>

          <figure>
            <figcaption>background removed</figcaption>
            <div className="image-frame checkerboard">
              {outputUrl ? (
                <img src={outputUrl} alt="transparent background result" />
              ) : (
                <p>result appears here</p>
              )}
            </div>
          </figure>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </section>
    </main>
  );
}

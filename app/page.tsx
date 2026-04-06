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

type PromptAdjustments = {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
  hueRotate: number;
  sharpen: number;
};

function getAdjustmentsFromPrompt(prompt: string): {
  adjustments: PromptAdjustments;
  detected: boolean;
} {
  const input = prompt.toLowerCase();
  const adjustments: PromptAdjustments = {
    brightness: 1,
    contrast: 1,
    saturate: 1,
    blur: 0,
    hueRotate: 0,
    sharpen: 0,
  };
  let detected = false;

  if (input.includes("bright") || input.includes("light")) {
    adjustments.brightness += 0.12;
    detected = true;
  }
  if (input.includes("dark")) {
    adjustments.brightness -= 0.12;
    detected = true;
  }
  if (input.includes("contrast")) {
    adjustments.contrast += 0.14;
    detected = true;
  }
  if (input.includes("vibrant") || input.includes("saturat") || input.includes("color")) {
    adjustments.saturate += 0.2;
    detected = true;
  }
  if (input.includes("desatur") || input.includes("muted")) {
    adjustments.saturate -= 0.15;
    detected = true;
  }
  if (input.includes("smooth") || input.includes("denoise")) {
    adjustments.blur += 0.55;
    detected = true;
  }
  if (input.includes("sharp") || input.includes("crisp") || input.includes("detail")) {
    adjustments.sharpen += 0.75;
    detected = true;
  }
  if (input.includes("warm")) {
    adjustments.hueRotate -= 7;
    detected = true;
  }
  if (input.includes("cool")) {
    adjustments.hueRotate += 7;
    detected = true;
  }

  const brightnessMatch = input.match(/brightness\s*(\d{2,3})/);
  if (brightnessMatch) {
    adjustments.brightness = Number(brightnessMatch[1]) / 100;
    detected = true;
  }

  const contrastMatch = input.match(/contrast\s*(\d{2,3})/);
  if (contrastMatch) {
    adjustments.contrast = Number(contrastMatch[1]) / 100;
    detected = true;
  }

  const saturationMatch = input.match(/saturation\s*(\d{2,3})|saturate\s*(\d{2,3})/);
  if (saturationMatch) {
    const value = saturationMatch[1] ?? saturationMatch[2];
    if (value) {
      adjustments.saturate = Number(value) / 100;
      detected = true;
    }
  }

  adjustments.brightness = Math.min(Math.max(adjustments.brightness, 0.6), 1.7);
  adjustments.contrast = Math.min(Math.max(adjustments.contrast, 0.6), 1.8);
  adjustments.saturate = Math.min(Math.max(adjustments.saturate, 0.4), 2);
  adjustments.blur = Math.min(Math.max(adjustments.blur, 0), 3);
  adjustments.hueRotate = Math.min(Math.max(adjustments.hueRotate, -20), 20);
  adjustments.sharpen = Math.min(Math.max(adjustments.sharpen, 0), 1.5);

  return {
    adjustments,
    detected,
  };
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("failed to load image"));
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function applySharpen(imageData: ImageData, amount: number): ImageData {
  const source = imageData.data;
  const output = new Uint8ClampedArray(source);
  const { width, height } = imageData;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let idx = 0;

        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + channel;
            sum += source[pixelIndex] * kernel[idx];
            idx += 1;
          }
        }

        const center = (y * width + x) * 4 + channel;
        const blended = source[center] * (1 - amount) + sum * amount;
        output[center] = Math.min(255, Math.max(0, blended));
      }
    }
  }

  return new ImageData(output, width, height);
}

async function applyPromptFix(imageBlob: Blob, prompt: string): Promise<Blob> {
  const plan = getAdjustmentsFromPrompt(prompt);
  const adjustments = plan.detected
    ? plan.adjustments
    : {
        ...plan.adjustments,
        brightness: 1.06,
        contrast: 1.14,
        saturate: 1.1,
        sharpen: 0.8,
      };
  const image = await blobToImage(imageBlob);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("canvas context unavailable");
  }

  context.filter = `brightness(${adjustments.brightness}) contrast(${adjustments.contrast}) saturate(${adjustments.saturate}) blur(${adjustments.blur}px) hue-rotate(${adjustments.hueRotate}deg)`;
  context.drawImage(image, 0, 0, image.width, image.height);

  if (adjustments.sharpen > 0) {
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const sharpened = applySharpen(data, adjustments.sharpen * 0.45);
    context.putImageData(sharpened, 0, 0);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("unable to encode image"));
        return;
      }
      resolve(blob);
    }, "image/png", 1);
  });
}

export default function Home() {
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [sourceOriginalUrl, setSourceOriginalUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFixingOutput, setIsFixingOutput] = useState(false);
  const [fixPrompt, setFixPrompt] = useState("");
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
      if (sourceOriginalUrl) {
        URL.revokeObjectURL(sourceOriginalUrl);
      }
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [inputUrl, outputUrl, sourceOriginalUrl]);

  function onFileChange(file: File | undefined) {
    if (!file) {
      return;
    }

    if (inputUrl) {
      URL.revokeObjectURL(inputUrl);
    }

    if (sourceOriginalUrl) {
      URL.revokeObjectURL(sourceOriginalUrl);
    }

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
    }

    const nextInputUrl = URL.createObjectURL(file);

    setError(null);
    setProgress(0);
    setInputFile(file);
    setSourceBlob(file);
    setInputUrl(nextInputUrl);
    setSourceOriginalUrl(nextInputUrl);
    setOutputUrl(null);
    setOutputBlob(null);
    setFixPrompt("");
    setStatus("ready when you are.");
  }

  async function applyFixToResult(prompt: string) {
    if (!outputBlob || !prompt.trim()) {
      return;
    }

    setIsFixingOutput(true);
    setError(null);

    try {
      const fixedBlob = await applyPromptFix(outputBlob, prompt);
      const fixedUrl = URL.createObjectURL(fixedBlob);

      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }

      setOutputBlob(fixedBlob);
      setOutputUrl(fixedUrl);
      setStatus("applied your fix to output.");
    } catch (cause) {
      console.error(cause);
      setError("could not apply that output fix prompt.");
    } finally {
      setIsFixingOutput(false);
    }
  }

  async function processImage() {
    if (!sourceBlob) {
      setError("choose an image first.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setStatus("loading model and assets...");

    try {
      const blob = await removeBackground(sourceBlob, {
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
      setOutputBlob(blob);
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

  async function handleApplyFix() {
    const prompt = fixPrompt.trim();
    if (!prompt) {
      setError("type a fix prompt first.");
      return;
    }
    await applyFixToResult(prompt);
  }

  function clearPrompt() {
    setFixPrompt("");
    setError(null);
    setStatus("prompt cleared.");
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
            className="primary-btn primary-btn-main"
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

        <div className="fix-composer">
          <label htmlFor="fix-prompt">one text box that does some stuff sometimes but lowk does nothing sponsored by andrew ng</label>
          <div className="fix-bar" role="group" aria-label="image fix prompt">
            <span className="fix-prefix" aria-hidden="true">
              +
            </span>
            <input
              id="fix-prompt"
              type="text"
              value={fixPrompt}
              placeholder="ask anything: brighter, smooth edges, more contrast"
              onChange={(event) => setFixPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleApplyFix();
                }
              }}
            />
          </div>
          <div className="fix-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void handleApplyFix()}
              disabled={!outputBlob || !fixPrompt.trim() || isFixingOutput}
            >
              {isFixingOutput ? "applying..." : "apply to output"}
            </button>
            <button
              type="button"
              className="secondary-btn ghost"
              onClick={clearPrompt}
              disabled={isFixingOutput || !fixPrompt}
            >
              clear
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

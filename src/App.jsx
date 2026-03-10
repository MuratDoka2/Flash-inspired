import { useState, useRef, useEffect, useCallback } from "react";

const COLORS = {
  bg: "#1a1a2e",
  panel: "#16213e",
  panelLight: "#0f3460",
  stage: "#0d0d0d",
  accent: "#e94560",
  accentBlue: "#00b4d8",
  accentGold: "#ffd60a",
  accentGreen: "#44ff88",
  text: "#e0e0e0",
  textDim: "#888",
  border: "#2a2a4a",
};

const DEFAULT_SCRIPT = `// Flash-style animation script
// Use 'ctx' (CanvasRenderingContext2D) and 'frame' (current frame number)

const t = frame / 60;

// Background
ctx.fillStyle = '#0d0d0d';
ctx.fillRect(0, 0, 550, 400);

// Animated circle
const x = 275 + Math.sin(t * 2) * 120;
const y = 200 + Math.cos(t * 1.5) * 80;
const r = 30 + Math.sin(t * 3) * 10;

const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
grad.addColorStop(0, '#ffd60a');
grad.addColorStop(1, '#e94560');
ctx.fillStyle = grad;
ctx.beginPath();
ctx.arc(x, y, r, 0, Math.PI * 2);
ctx.fill();

// Trail
for (let i = 1; i <= 5; i++) {
  const tx = 275 + Math.sin((t - i * 0.05) * 2) * 120;
  const ty = 200 + Math.cos((t - i * 0.05) * 1.5) * 80;
  ctx.globalAlpha = 0.15 / i;
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.arc(tx, ty, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}
ctx.globalAlpha = 1;

// Text
ctx.fillStyle = '#e0e0e0';
ctx.font = 'bold 14px monospace';
ctx.fillText('Frame: ' + frame, 10, 20);
`;

const TOTAL_FRAMES = 120;
const W = 550;
const H = 400;

const BRUSH_COLORS = [
  "#ffffff",
  "#e94560",
  "#ffd60a",
  "#00b4d8",
  "#44ff88",
  "#ff6b35",
  "#c77dff",
];
const BRUSH_SIZES = [1, 2, 4, 8, 14];

export default function FlashTool() {
  const canvasRef = useRef(null);
  const sketchRef = useRef(null);
  const animRef = useRef(null);

  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [error, setError] = useState(null);

  const [sketchMode, setSketchMode] = useState(false);
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(2);
  const [onionSkin, setOnionSkin] = useState(true);
  const [eraser, setEraser] = useState(false);

  const sketchFrames = useRef({});
  const [sketchKeys, setSketchKeys] = useState([]);

  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const frameRef = useRef(0);
  const playingRef = useRef(false);
  const scriptRef = useRef(script);
  const onionRef = useRef(onionSkin);

  useEffect(() => {
    scriptRef.current = script;
  }, [script]);
  useEffect(() => {
    onionRef.current = onionSkin;
  }, [onionSkin]);

  // ─── Render sketch overlay ────────────────────────────────────────────────
  const renderSketch = useCallback((f) => {
    const sc = sketchRef.current;
    if (!sc) return;
    const ctx = sc.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    if (onionRef.current) {
      const prevFrames = Object.keys(sketchFrames.current)
        .map(Number)
        .filter((k) => k < f)
        .sort((a, b) => b - a);
      if (prevFrames.length > 0) {
        ctx.globalAlpha = 0.22;
        ctx.putImageData(sketchFrames.current[prevFrames[0]], 0, 0);
        ctx.globalAlpha = 1;
      }
    }

    if (sketchFrames.current[f]) {
      ctx.putImageData(sketchFrames.current[f], 0, 0);
    }
  }, []);

  // ─── Run script ───────────────────────────────────────────────────────────
  const runScript = useCallback((f) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    try {
      new Function("ctx", "frame", scriptRef.current)(ctx, f);
      setError(null);
    } catch (e) {
      setError(e.message);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e94560";
      ctx.font = "13px monospace";
      ctx.fillText("✕ " + e.message, 10, 30);
    }
  }, []);

  useEffect(() => {
    runScript(frame);
    renderSketch(frame);
  }, [frame, runScript, renderSketch]);
  useEffect(() => {
    renderSketch(frame);
  }, [onionSkin]);

  // ─── Playback ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const interval = 1000 / 24;
    const tick = (now) => {
      if (!playingRef.current) return;
      if (now - last >= interval) {
        last = now;
        frameRef.current = (frameRef.current + 1) % TOTAL_FRAMES;
        setFrame(frameRef.current);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    playingRef.current = true;
    animRef.current = requestAnimationFrame(tick);
    return () => {
      playingRef.current = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [playing]);

  const togglePlay = () => {
    if (!playing) frameRef.current = frame;
    setPlaying((p) => !p);
  };
  const stop = () => {
    setPlaying(false);
    setFrame(0);
    frameRef.current = 0;
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.round(
      ((e.clientX - rect.left) / rect.width) * (TOTAL_FRAMES - 1),
    );
    frameRef.current = f;
    setFrame(f);
  };

  // ─── Drawing ──────────────────────────────────────────────────────────────
  const getPos = (e) => {
    const sc = sketchRef.current;
    const rect = sc.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = (e) => {
    if (!sketchMode) return;
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    // Show clean frame data before drawing
    const sc = sketchRef.current;
    const ctx = sc.getContext("2d");
    ctx.clearRect(0, 0, W, H);
    if (sketchFrames.current[frame])
      ctx.putImageData(sketchFrames.current[frame], 0, 0);
  };

  const onPointerMove = (e) => {
    if (!sketchMode || !isDrawing.current) return;
    e.preventDefault();
    const sc = sketchRef.current;
    const ctx = sc.getContext("2d");
    const pos = getPos(e);

    // Restore current frame then draw stroke on top
    ctx.clearRect(0, 0, W, H);
    if (sketchFrames.current[frame])
      ctx.putImageData(sketchFrames.current[frame], 0, 0);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
    }

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";

    // Persist to frame store
    sketchFrames.current[frame] = ctx.getImageData(0, 0, W, H);
    setSketchKeys(Object.keys(sketchFrames.current).map(Number));
    lastPos.current = pos;

    // Re-composite with onion skin
    renderSketch(frame);
  };

  const onPointerUp = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearSketch = () => {
    delete sketchFrames.current[frame];
    setSketchKeys(Object.keys(sketchFrames.current).map(Number));
    sketchRef.current?.getContext("2d").clearRect(0, 0, W, H);
  };

  const markers = Array.from({ length: 12 }, (_, i) =>
    Math.round((i / 11) * (TOTAL_FRAMES - 1)),
  );
  const hasSketch = sketchKeys.includes(frame);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'Courier New', monospace",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          background: COLORS.panel,
          borderBottom: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            background: COLORS.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: "bold",
            color: "#fff",
            clipPath: "polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%)",
          }}
        >
          F
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: "bold",
            letterSpacing: 2,
            color: COLORS.accentGold,
          }}
        >
          FLASH.JS
        </span>
        <span style={{ fontSize: 10, color: COLORS.textDim }}>
          browser animation tool
        </span>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          {error && (
            <span
              style={{
                fontSize: 10,
                color: COLORS.accent,
                background: "#2a0a10",
                padding: "2px 8px",
              }}
            >
              ⚠ Script Error
            </span>
          )}
          <span style={{ fontSize: 10, color: COLORS.textDim }}>
            {TOTAL_FRAMES} frames · 24fps
          </span>
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Stage panel */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
            padding: 16,
            background: "#111122",
            borderRight: `1px solid ${COLORS.border}`,
          }}
        >
          {/* Sketch toolbar */}
          <div
            style={{
              width: W,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              padding: "6px 10px",
              minHeight: 36,
              background: sketchMode ? COLORS.panel : "transparent",
              border: `1px solid ${sketchMode ? COLORS.accentBlue + "66" : "transparent"}`,
              transition: "all 0.2s",
              flexWrap: "wrap",
            }}
          >
            {sketchMode ? (
              <>
                {BRUSH_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => {
                      setBrushColor(c);
                      setEraser(false);
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      background: c,
                      cursor: "pointer",
                      borderRadius: 2,
                      border:
                        brushColor === c && !eraser
                          ? `2px solid #fff`
                          : `1px solid #555`,
                    }}
                  />
                ))}
                <div
                  style={{ width: 1, height: 20, background: COLORS.border }}
                />
                {BRUSH_SIZES.map((s) => (
                  <div
                    key={s}
                    onClick={() => setBrushSize(s)}
                    style={{
                      width: Math.max(10, s * 2 + 6),
                      height: Math.max(10, s * 2 + 6),
                      borderRadius: "50%",
                      background:
                        brushSize === s
                          ? eraser
                            ? "#888"
                            : brushColor
                          : "#333",
                      cursor: "pointer",
                      border:
                        brushSize === s ? "1px solid #fff" : "1px solid #444",
                      flexShrink: 0,
                    }}
                  />
                ))}
                <div
                  style={{ width: 1, height: 20, background: COLORS.border }}
                />
                <button
                  onClick={() => setEraser((v) => !v)}
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    cursor: "pointer",
                    letterSpacing: 1,
                    background: eraser ? COLORS.accentGold : "transparent",
                    color: eraser ? "#000" : COLORS.textDim,
                    border: `1px solid ${eraser ? COLORS.accentGold : COLORS.border}`,
                  }}
                >
                  ✦ ERASE
                </button>
                <button
                  onClick={() => setOnionSkin((v) => !v)}
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    cursor: "pointer",
                    letterSpacing: 1,
                    background: onionSkin ? "#00b4d822" : "transparent",
                    color: onionSkin ? COLORS.accentBlue : COLORS.textDim,
                    border: `1px solid ${onionSkin ? COLORS.accentBlue : COLORS.border}`,
                  }}
                >
                  ◎ ONION
                </button>
                <button
                  onClick={clearSketch}
                  style={{
                    fontSize: 9,
                    padding: "2px 7px",
                    cursor: "pointer",
                    letterSpacing: 1,
                    background: "transparent",
                    color: COLORS.accent,
                    border: `1px solid ${COLORS.accent}66`,
                    marginLeft: "auto",
                  }}
                >
                  ✕ CLEAR
                </button>
              </>
            ) : (
              <span
                style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 1 }}
              >
                {hasSketch
                  ? `✏ frame ${frame} has a sketch keyframe`
                  : "click SKETCH KF to draw on this frame"}
              </span>
            )}
          </div>

          {/* Canvases */}
          <div
            style={{
              border: `2px solid ${sketchMode ? COLORS.accentBlue : COLORS.panelLight}`,
              boxShadow: sketchMode
                ? `0 0 24px ${COLORS.accentBlue}55`
                : `0 0 30px #00000088`,
              position: "relative",
              transition: "all 0.2s",
            }}
          >
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              style={{ display: "block", background: COLORS.stage }}
            />
            <canvas
              ref={sketchRef}
              width={W}
              height={H}
              onMouseDown={onPointerDown}
              onMouseMove={onPointerMove}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={onPointerDown}
              onTouchMove={onPointerMove}
              onTouchEnd={onPointerUp}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                cursor: sketchMode
                  ? eraser
                    ? "cell"
                    : "crosshair"
                  : "default",
                pointerEvents: sketchMode ? "all" : "none",
              }}
            />
            {sketchMode && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  fontSize: 9,
                  letterSpacing: 2,
                  padding: "2px 8px",
                  background: COLORS.accentBlue,
                  color: "#000",
                  fontWeight: "bold",
                }}
              >
                ✏ SKETCH MODE
              </div>
            )}
            <div
              style={{
                position: "absolute",
                bottom: 6,
                right: 8,
                fontSize: 10,
                color: "#ffffff33",
                pointerEvents: "none",
              }}
            >
              {String(frame).padStart(3, "0")} / {TOTAL_FRAMES - 1}
            </div>
          </div>

          {/* Transport + sketch toggle */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
              alignItems: "center",
              width: W,
            }}
          >
            {[
              {
                label: "◀◀",
                action: () => {
                  setFrame(0);
                  frameRef.current = 0;
                  setPlaying(false);
                },
              },
              {
                label: playing ? "⏸" : "▶",
                action: togglePlay,
                active: playing,
              },
              { label: "⏹", action: stop },
            ].map((btn) => (
              <button
                key={btn.label}
                onClick={btn.action}
                style={{
                  background: btn.active ? COLORS.accent : COLORS.panelLight,
                  color: btn.active ? "#fff" : COLORS.text,
                  border: `1px solid ${btn.active ? COLORS.accent : COLORS.border}`,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "monospace",
                  letterSpacing: 1,
                }}
              >
                {btn.label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setSketchMode((s) => !s)}
              style={{
                background: sketchMode ? COLORS.accentBlue : "transparent",
                color: sketchMode ? "#000" : COLORS.accentBlue,
                border: `2px solid ${COLORS.accentBlue}`,
                padding: "5px 14px",
                cursor: "pointer",
                fontSize: 11,
                fontFamily: "monospace",
                letterSpacing: 1,
                fontWeight: "bold",
                transition: "all 0.15s",
              }}
            >
              {sketchMode ? "✏ SKETCHING" : "✏ SKETCH KF"}
            </button>
          </div>

          {/* Timeline */}
          <div style={{ width: W, marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 9,
                color: COLORS.textDim,
                marginBottom: 2,
              }}
            >
              {markers.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div
              onClick={handleTimelineClick}
              style={{
                width: "100%",
                height: 28,
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                cursor: "col-resize",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {Array.from({ length: TOTAL_FRAMES }, (_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${(i / (TOTAL_FRAMES - 1)) * 100}%`,
                    top: i % 10 === 0 ? 0 : 10,
                    width: 1,
                    height: i % 10 === 0 ? 28 : 8,
                    background: i % 10 === 0 ? COLORS.border : "#2a2a3a",
                  }}
                />
              ))}

              {/* Sketch keyframe diamonds */}
              {sketchKeys.map((kf) => (
                <div
                  key={kf}
                  title={`Sketch keyframe: ${kf}`}
                  style={{
                    position: "absolute",
                    left: `${(kf / (TOTAL_FRAMES - 1)) * 100}%`,
                    top: "50%",
                    transform: "translate(-50%, -50%) rotate(45deg)",
                    width: kf === frame ? 11 : 7,
                    height: kf === frame ? 11 : 7,
                    background:
                      kf === frame
                        ? COLORS.accentBlue
                        : `${COLORS.accentBlue}88`,
                    border: `1px solid ${COLORS.accentBlue}`,
                    zIndex: 2,
                    transition: "all 0.1s",
                  }}
                />
              ))}

              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: `${(frame / (TOTAL_FRAMES - 1)) * 100}%`,
                  height: "100%",
                  background: `${COLORS.accent}22`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${(frame / (TOTAL_FRAMES - 1)) * 100}%`,
                  top: 0,
                  width: 2,
                  height: "100%",
                  background: COLORS.accent,
                  transform: "translateX(-1px)",
                  zIndex: 3,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: `8px solid ${COLORS.accent}`,
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: 9,
                color: COLORS.textDim,
                marginTop: 3,
                textAlign: "right",
              }}
            >
              {sketchKeys.length > 0
                ? `${sketchKeys.length} sketch kf${sketchKeys.length !== 1 ? "s" : ""} · ${hasSketch ? "✏ sketch on this frame" : "no sketch on frame " + frame}`
                : "no sketch keyframes yet"}
            </div>
          </div>
        </div>

        {/* Script Editor */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "6px 12px",
              background: COLORS.panel,
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: COLORS.accentBlue,
                letterSpacing: 2,
              }}
            >
              SCRIPT EDITOR
            </span>
            <span style={{ fontSize: 9, color: COLORS.textDim }}>main.js</span>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => {
                  setScript(DEFAULT_SCRIPT);
                  setError(null);
                }}
                style={{
                  fontSize: 9,
                  padding: "2px 8px",
                  background: "transparent",
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.textDim,
                  cursor: "pointer",
                  letterSpacing: 1,
                }}
              >
                RESET
              </button>
            </div>
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 36,
                background: "#12122a",
                borderRight: `1px solid ${COLORS.border}`,
                padding: "12px 0",
                overflow: "hidden",
                userSelect: "none",
              }}
            >
              {script.split("\n").map((_, i) => (
                <div
                  key={i}
                  style={{
                    height: 20,
                    lineHeight: "20px",
                    textAlign: "right",
                    paddingRight: 8,
                    fontSize: 11,
                    color: COLORS.textDim,
                  }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              spellCheck={false}
              style={{
                position: "absolute",
                left: 36,
                right: 0,
                top: 0,
                bottom: 0,
                background: "#0e0e22",
                color: error ? "#ffaaaa" : COLORS.text,
                border: "none",
                outline: "none",
                resize: "none",
                fontFamily: "'Courier New', monospace",
                fontSize: 12,
                lineHeight: "20px",
                padding: 12,
                tabSize: 2,
              }}
            />
          </div>
          <div
            style={{
              height: 60,
              background: "#0a0a18",
              borderTop: `1px solid ${COLORS.border}`,
              padding: "6px 12px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: COLORS.accentBlue,
                letterSpacing: 2,
                marginBottom: 4,
              }}
            >
              CONSOLE
            </div>
            {error ? (
              <div style={{ fontSize: 11, color: COLORS.accent }}>
                ⚠ {error}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: COLORS.accentGreen }}>
                ✓ Script OK · frame {frame} · {TOTAL_FRAMES}f total
                {hasSketch && (
                  <span style={{ color: COLORS.accentBlue }}>
                    {" "}
                    · ✏ sketch keyframe
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

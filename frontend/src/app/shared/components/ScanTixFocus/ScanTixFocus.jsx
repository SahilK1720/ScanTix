import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import "./ScanTixFocus.css";

/**
 * ScanTixFocus
 * Applies a TrueFocus-style sequential character highlight to the "ScanTix" logo.
 *
 * Props:
 *  - manualMode          {boolean}  — hover to focus instead of auto-cycling
 *  - blurAmount          {number}   — blur applied to non-focused characters (px)
 *  - borderColor         {string}   — corner bracket color (CSS color string)
 *  - glowColor           {string}   — glow/shadow color (CSS color string)
 *  - animationDuration   {number}   — transition duration in seconds
 *  - pauseBetweenAnimations {number} — pause between character changes (seconds)
 */
export default function ScanTixFocus({
  manualMode = false,
  blurAmount = 3,
  borderColor = "var(--stf-border, #4f8ef7)",
  glowColor = "var(--stf-glow, rgba(79,142,247,0.6))",
  animationDuration = 0.4,
  pauseBetweenAnimations = 0.5,
}) {
  const parts = ["Pick", "My", "Seats"];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);
  const partRefs = useRef([]);
  const [focusRect, setFocusRect] = useState(null);
  const intervalRef = useRef(null);

  // ── Update the focus frame position whenever currentIndex changes ──────────
  const updateFocusRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    if (currentIndex === parts.length) {
      setFocusRect({
        x: -4,
        y: -4,
        width: containerRect.width + 8,
        height: containerRect.height + 8,
      });
    } else {
      const part = partRefs.current[currentIndex];
      if (!part) return;

      const partRect = part.getBoundingClientRect();

      setFocusRect({
        width: partRect.width,
        height: partRect.height,
        x: partRect.left - containerRect.left,
        y: partRect.top - containerRect.top,
      });
    }
  }, [currentIndex, parts.length]);

  useEffect(() => {
    updateFocusRect();
  }, [currentIndex, updateFocusRect]);

  // ── Auto-cycle in non-manual mode ──────────────────────────────────────────
  useEffect(() => {
    if (manualMode) return;

    const start = () => {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % (parts.length + 1));
      }, (animationDuration + pauseBetweenAnimations) * 1000);
    };

    start();
    return () => clearInterval(intervalRef.current);
  }, [manualMode, animationDuration, pauseBetweenAnimations, parts.length]);

  // ── Handle hover focus ─────────────────────────────────────────────────────
  const handleMouseEnter = (index) => {
    if (!manualMode) return;
    setIsHovered(true);
    setCurrentIndex(index);
  };

  const handleMouseLeave = () => {
    if (!manualMode) return;
    setIsHovered(false);
  };

  return (
    <span className="stf-root" ref={containerRef} aria-label="PickMySeats">
      {parts.map((part, index) => (
        <span
          key={index}
          ref={(el) => (partRefs.current[index] = el)}
          className={`stf-part ${index === 0 ? "part-gradient" : ""}`}
          style={{
            filter:
              (currentIndex === parts.length || index === currentIndex)
                ? "blur(0px)"
                : `blur(${blurAmount}px)`,
            transition: `filter ${animationDuration}s ease`,
          }}
          onMouseEnter={() => handleMouseEnter(index)}
          onMouseLeave={handleMouseLeave}
        >
          {part}
        </span>
      ))}

      {/* Animated corner-bracket focus frame */}
      {focusRect && (
        <motion.span
          className="stf-frame"
          animate={{
            x: focusRect.x,
            y: focusRect.y,
            width: focusRect.width,
            height: focusRect.height,
            opacity: 1,
          }}
          initial={false}
          transition={{
            duration: animationDuration,
            ease: "easeInOut",
          }}
          style={{
            "--stf-border-color": borderColor,
            "--stf-glow-color": glowColor,
          }}
          aria-hidden="true"
        >
          {/* Corners */}
          <span className="stf-corner stf-tl" />
          <span className="stf-corner stf-tr" />
          <span className="stf-corner stf-bl" />
          <span className="stf-corner stf-br" />
        </motion.span>
      )}
    </span>
  );
}

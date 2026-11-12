"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { X } from "lucide-react";

type SmoothInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  onClear?: () => void;
};

export function SmoothInput({
  className = "",
  value,
  defaultValue = "",
  onChange,
  onFocus,
  onBlur,
  onClear,
  placeholder = "Search title, author, ID",
  ...props
}: SmoothInputProps) {
  const [internalValue, setInternalValue] = useState(String(defaultValue));
  const [focused, setFocused] = useState(false);
  const caretX = useMotionValue(12);
  const caretOpacity = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  const springCaretX = useSpring(
    caretX,
    reduced
      ? { stiffness: 10000, damping: 100, mass: 0.1 }
      : { stiffness: 500, damping: 32, mass: 0.45 },
  );

  const isControlled = value !== undefined;
  const inputValue = isControlled ? String(value) : internalValue;

  const updateCaret = useCallback((target: HTMLInputElement) => {
    const measureSpan = measureRef.current;
    if (!measureSpan) return;

    const styles = window.getComputedStyle(target);
    measureSpan.style.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    measureSpan.style.letterSpacing = styles.letterSpacing;

    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? 0;
    const hasSelection = selectionStart !== selectionEnd;
    const caretIndex =
      target.selectionDirection === "backward" ? selectionStart : selectionEnd;

    measureSpan.textContent = target.value.slice(0, caretIndex);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const absoluteWidth =
      caretIndex > 0 ? measureSpan.offsetWidth + paddingLeft : paddingLeft;

    const maxScroll = Math.max(0, target.scrollWidth - target.clientWidth);
    const visibleRight = target.scrollLeft + target.clientWidth - paddingRight;
    const visibleLeft = target.scrollLeft + paddingLeft;

    if (absoluteWidth > visibleRight) {
      target.scrollLeft = Math.min(
        absoluteWidth - target.clientWidth + paddingRight,
        maxScroll,
      );
    } else if (absoluteWidth < visibleLeft) {
      target.scrollLeft = Math.max(0, absoluteWidth - paddingLeft);
    }

    const caretPosition = absoluteWidth - target.scrollLeft;
    const minX = paddingLeft - 1;
    const maxX = Math.max(minX, target.clientWidth - paddingRight);
    caretX.set(Math.min(Math.max(caretPosition, minX), maxX));

    const visible = caretPosition >= minX && caretPosition <= maxX + 1;
    caretOpacity.set(!visible || hasSelection ? 0 : 1);
  }, [caretOpacity, caretX]);

  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement === input) {
      updateCaret(input);
    }
  }, [inputValue, updateCaret]);

  useEffect(() => {
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container) return;

    const syncIfFocused = () => {
      if (document.activeElement === input) updateCaret(input);
    };
    const onSelection = () => {
      if (document.activeElement !== input) return;
      requestAnimationFrame(syncIfFocused);
    };

    document.addEventListener("selectionchange", onSelection);
    input.addEventListener("scroll", syncIfFocused);
    document.fonts?.ready.then(syncIfFocused).catch(() => {});
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncIfFocused) : null;
    ro?.observe(container);

    return () => {
      document.removeEventListener("selectionchange", onSelection);
      input.removeEventListener("scroll", syncIfFocused);
      ro?.disconnect();
    };
  }, [updateCaret]);

  const handleClear = () => {
    if (!isControlled) setInternalValue("");
    if (onClear) {
      onClear();
    } else {
      onChange?.({
        target: { value: "" },
        currentTarget: { value: "" },
      } as ChangeEvent<HTMLInputElement>);
    }
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        updateCaret(inputRef.current);
      }
    });
  };

  return (
    <div
      ref={containerRef}
      className={`smooth-input-wrap${focused ? " is-focused" : ""} ${className}`}
    >
      <input
        {...props}
        ref={inputRef}
        type="text"
        role="searchbox"
        placeholder={placeholder}
        value={inputValue}
        className="smooth-input"
        style={{ caretColor: "transparent" }}
        onChange={(e) => {
          if (!isControlled) setInternalValue(e.target.value);
          onChange?.(e);
          requestAnimationFrame(() => updateCaret(e.target));
        }}
        onFocus={(e) => {
          setFocused(true);
          requestAnimationFrame(() => updateCaret(e.target));
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          caretOpacity.set(0);
          onBlur?.(e);
        }}
      />
      <span ref={measureRef} aria-hidden="true" className="smooth-input-measure" />
      <motion.span
        aria-hidden="true"
        className="smooth-input-caret"
        style={{ x: springCaretX, opacity: caretOpacity }}
      />
      {inputValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="smooth-input-clear"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton — loading placeholder showing expected shape of content.
 * Inspired by HeroUI Skeleton: https://www.heroui.com/docs/components/skeleton
 *
 * Usage:
 * - Standalone: <Skeleton className="my-class" style={{ width: 100, height: 20 }} />
 * - With children for shape: <Skeleton><div>...</div></Skeleton> — children define size, hidden until isLoaded
 * - Loaded state: <Skeleton isLoaded>{content}</Skeleton> — shows children, hides skeleton
 */
import React from "react";
import "../../styles/ui/skeleton.css";

export default function Skeleton({
  children,
  isLoaded = false,
  disableAnimation = false,
  className = "",
  style,
  ...props
}) {
  const baseClass = "skeleton";
  const loadedClass = isLoaded ? "skeleton--loaded" : "";
  const noAnimClass = disableAnimation ? "skeleton--no-animation" : "";
  const cls = [baseClass, loadedClass, noAnimClass, className].filter(Boolean).join(" ");

  return (
    <div
      className={cls}
      style={style}
      data-loaded={isLoaded}
      {...props}
    >
      <span className="skeleton__base" aria-hidden />
      {children != null && (
        <span className="skeleton__content">
          {children}
        </span>
      )}
    </div>
  );
}

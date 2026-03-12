import React from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import "tippy.js/animations/shift-away.css";

const defaultProps = {
  animation: "shift-away",
  delay: [200, 0],
  placement: "top",
  arrow: true,
};

/**
 * Reusable tooltip wrapping Tippy. Use instead of title/aria-label for richer UI.
 * Keep aria-label on the child when needed for screen readers.
 */
export default function Tooltip({ content, children, ...rest }) {
  if (content == null || content === "") return children;
  return (
    <Tippy content={content} {...defaultProps} {...rest}>
      {children}
    </Tippy>
  );
}

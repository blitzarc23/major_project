// client/src/components/Tooltip.tsx
"use client";
import React, { useState } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ text, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute ${positionClasses[position]} z-50 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none
            bg-gray-900 text-white shadow-xl border border-gray-700`}
        >
          {text}
          {/* Arrow */}
          <span
            className={`absolute w-2 h-2 bg-gray-900 border-gray-700 rotate-45
              ${position === "top" ? "top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-b border-r" : ""}
              ${position === "bottom" ? "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-t border-l" : ""}
              ${position === "left" ? "left-full top-1/2 -translate-y-1/2 -translate-x-1/2 border-t border-r" : ""}
              ${position === "right" ? "right-full top-1/2 -translate-y-1/2 translate-x-1/2 border-b border-l" : ""}
            `}
          />
        </div>
      )}
    </div>
  );
}
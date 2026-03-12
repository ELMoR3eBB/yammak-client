import React from "react";

export function EyeIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7S2.2 12 2.2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function EyeOffIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7S2.2 12 2.2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.9"
      />
      <path
        d="M4 4l16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlusIcon({ className = "" }) {
  return (
    <svg className={className} width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clip-path="url(#clip0_0_3)">
        <path d="M486.398 230.4H281.601V25.5984C281.601 11.4708 270.131 0 255.998 0C241.871 0 230.4 11.4708 230.4 25.5984V230.4H25.5984C11.4708 230.4 0 241.871 0 255.998C0 270.131 11.4708 281.601 25.5984 281.601H230.4V486.398C230.4 500.53 241.871 512.001 255.998 512.001C270.131 512.001 281.601 500.53 281.601 486.398V281.601H486.398C500.53 281.601 512.001 270.131 512.001 255.998C512.001 241.871 500.53 230.4 486.398 230.4Z" fill="currentcolor" />
      </g>
      <defs>
        <clipPath id="clip0_0_3">
          <rect width="512" height="512" fill="white" />
        </clipPath>
      </defs>
    </svg>

  )
}

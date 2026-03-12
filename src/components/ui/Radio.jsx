import React from "react";
import styled from "styled-components";

const Radio = ({ name, value, onChange, options = [], disabled, className }) => {
  return (
    <StyledWrapper className={className}>
      <div className="radio-input">
        {options.map((opt) => (
          <label key={opt.value} className={`label ${disabled ? "disabled" : ""}`}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => !disabled && onChange?.(opt.value)}
              disabled={disabled}
            />
            <span className="text">{opt.label}</span>
          </label>
        ))}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  --radio-bg: var(--st-bg-elevated, #0f0f12);
  --radio-surface: var(--st-surface, rgba(255, 255, 255, 0.03));
  --radio-border: var(--st-border, rgba(255, 255, 255, 0.06));
  --radio-text: var(--st-text, rgba(255, 255, 255, 0.92));
  --radio-accent: var(--st-accent, #fbbf24);
  --radio-radius: var(--st-radius, 8px);
  --radio-ease: var(--st-ease, cubic-bezier(0.4, 0, 0.2, 1));

  .radio-input {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .radio-input * {
    box-sizing: border-box;
    padding: 0;
    margin: 0;
  }

  .radio-input label {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 0 20px;
    width: 100%;
    max-width: 320px;
    cursor: pointer;
    height: 50px;
    position: relative;
    transition: opacity 0.2s var(--radio-ease);
  }

  .radio-input label:hover:not(.disabled) {
    opacity: 0.95;
  }

  .radio-input label.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .radio-input label::before {
    position: absolute;
    content: "";
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: 45px;
    z-index: -1;
    transition: background-color 0.25s var(--radio-ease), border-color 0.25s var(--radio-ease), height 0.25s var(--radio-ease);
    border-radius: var(--radio-radius);
    border: 2px solid transparent;
    background-color: transparent;
  }

  .radio-input label:hover:not(.disabled)::before {
    background-color: var(--radio-surface);
  }

  .radio-input .label:has(input:checked)::before {
    background-color: rgba(251, 191, 36, 0.08);
    height: 50px;
  }

  .radio-input .label .text {
    color: var(--radio-text);
    font-size: 14px;
    transition: color 0.2s var(--radio-ease);
  }

  .radio-input .label input[type="radio"] {
    background-color: var(--radio-bg);
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
    border: 2px solid var(--radio-border);
    position: relative;
    transition: background-color 0.25s var(--radio-ease), border-color 0.25s var(--radio-ease), box-shadow 0.25s var(--radio-ease);
  }

  .radio-input .label input[type="radio"]:hover:not(:disabled) {
    border-color: rgba(251, 191, 36, 0.4);
  }

  .radio-input .label input[type="radio"]:checked {
    background-color: var(--radio-accent);
    border-color: var(--radio-accent);
    -webkit-animation: radioPulse 0.7s forwards;
    animation: radioPulse 0.7s forwards;
  }

  .radio-input .label input[type="radio"]::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: transform 0.2s var(--radio-ease);
    background-color: #09090b;
    transform: translate(-50%, -50%) scale(0);
  }

  .radio-input .label input[type="radio"]:checked::before {
    transform: translate(-50%, -50%) scale(1);
  }

  @keyframes radioPulse {
    0% {
      box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.35);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(251, 191, 36, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
    }
  }
`;

export default Radio;

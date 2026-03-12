import React from "react";
import styled from "styled-components";

const Switch = ({ checked, onChange, disabled }) => {
  return (
    <StyledWrapper data-disabled={disabled ? "1" : "0"}>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => {
            if (disabled) return;
            onChange?.(e.target.checked);
          }}
          disabled={disabled}
        />
        <div className="toggle-switch-background">
          <div className="toggle-switch-handle" />
        </div>
      </label>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 52px;
    height: 28px;
    cursor: pointer;
  }

  .toggle-switch input {
    display: none;
  }

  .toggle-switch-background {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-switch-handle {
    position: absolute;
    top: 2px;
    left: 3px;
    width: 22px;
    height: 22px;
    background: #ffffff;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35), 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
      background 0.25s ease,
      box-shadow 0.3s ease;
  }

  /* ON state */
  .toggle-switch input:checked + .toggle-switch-background {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    border-color: rgba(251, 191, 36, 0.8);
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.35);
  }

  .toggle-switch input:checked + .toggle-switch-background .toggle-switch-handle {
    transform: translateX(23px);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3), 0 0 8px rgba(251, 191, 36, 0.3);
  }

  /* disabled */
  &[data-disabled="1"] .toggle-switch {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

export default Switch;
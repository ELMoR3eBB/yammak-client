import React from "react";

export default function KpiCard({ title, value, icon: Icon, hint }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className="kpi-icon">
          <Icon size={18} />
        </div>
        <div className="kpi-title">{title}</div>
      </div>

      <div className="kpi-value">{value}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
    </div>
  );
}

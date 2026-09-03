"use client";

import { useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";
import { monthLabel } from "@/lib/planning/dates";
import type { ProjectionMonth } from "@/lib/planning/types";

type Range = 12 | 36 | 60;

export function ProjectionChart({ months, selectedMonth, onSelectMonth, onInspectMonth }: { months: ProjectionMonth[]; selectedMonth?: string; onSelectMonth: (month: ProjectionMonth) => void; onInspectMonth: (month: ProjectionMonth) => void }) {
  const [range, setRange] = useState<Range>(60);
  const svgRef = useRef<SVGSVGElement>(null);
  const visible = useMemo(() => months.slice(0, Math.min(range, months.length)), [months, range]);
  const width = 720;
  const height = 230;
  const pad = { left: 18, right: 18, top: 20, bottom: 28 };
  const values = visible.map((item) => item.closingAvailableLiquidity);
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const span = Math.max(1, maximum - minimum);
  const points = visible.map((item, index) => ({
    item,
    x: pad.left + index * ((width - pad.left - pad.right) / Math.max(1, visible.length - 1)),
    y: pad.top + (maximum - item.closingAvailableLiquidity) / span * (height - pad.top - pad.bottom),
  }));
  const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = points.length ? `${line} L${points.at(-1)!.x},${height - pad.bottom} L${points[0].x},${height - pad.bottom} Z` : "";
  const selected = points.find((point) => point.item.month === selectedMonth) ?? points.at(-1);

  function chooseAt(clientX: number) {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds || !visible.length) return;
    const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const index = Math.round(ratio * (visible.length - 1));
    onSelectMonth(visible[index]);
  }

  return <section className="plan-chart-card card">
    <header>
      <div><span>Available liquidity</span><strong>{formatMoney(selected?.item.closingAvailableLiquidity ?? 0, true)}</strong><small>{selected ? monthLabel(selected.item.month, { month: "long", year: "numeric" }) : ""}</small></div>
      <div className="plan-range" aria-label="Projection range">
        {([12, 36, 60] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item === 12 ? "1Y" : item === 36 ? "3Y" : "5Y"}</button>)}
      </div>
    </header>
    <div className="plan-chart-wrap">
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projected available liquidity by month"
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); chooseAt(event.clientX); }}
        onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseAt(event.clientX); }}>
        <defs>
          <linearGradient id="plan-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".24" /><stop offset="1" stopColor="var(--accent)" stopOpacity=".02" /></linearGradient>
        </defs>
        <line className="plan-chart-grid" x1={pad.left} y1={height - pad.bottom} x2={width - pad.right} y2={height - pad.bottom} />
        {minimum < 0 ? <line className="plan-chart-zero" x1={pad.left} y1={pad.top + maximum / span * (height - pad.top - pad.bottom)} x2={width - pad.right} y2={pad.top + maximum / span * (height - pad.top - pad.bottom)} /> : null}
        <path className="plan-chart-area" d={area} />
        <path className="plan-chart-line" d={line} />
        {points.filter((point) => point.item.events.length).map((point) => <circle key={point.item.month} className="plan-chart-event" cx={point.x} cy={point.y} r="4" />)}
        {selected ? <><line className="plan-chart-cursor" x1={selected.x} y1={pad.top} x2={selected.x} y2={height - pad.bottom} /><circle className="plan-chart-selected" cx={selected.x} cy={selected.y} r="6" /></> : null}
        <text className="plan-chart-label" x={pad.left} y={height - 7}>{visible[0]?.month.slice(0, 4)}</text>
        <text className="plan-chart-label" textAnchor="end" x={width - pad.right} y={height - 7}>{visible.at(-1)?.month.slice(0, 4)}</text>
      </svg>
    </div>
    <button className="plan-chart-detail" onClick={() => selected && onInspectMonth(selected.item)}>View selected month breakdown</button>
  </section>;
}

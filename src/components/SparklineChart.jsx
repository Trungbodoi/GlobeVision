import { useId } from "react";
import "./SparklineChart.css";

/**
 * Biểu đồ xu hướng SVG siêu nhẹ cho chuỗi thời gian World Bank
 * @param {Array<{ year: number, value: number }>} history
 * @param {string} unit
 * @param {string} color
 */
function SparklineChart({ history = [], unit = "", color = "#339af0" }) {
  const gradientId = useId();

  if (!history || history.length < 2) {
    return null;
  }

  const values = history.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 280;
  const height = 64;
  const paddingX = 8;
  const paddingY = 8;

  const points = history.map((item, index) => {
    const x = paddingX + (index / (history.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((item.value - minVal) / range) * (height - paddingY * 2);
    return { x, y, ...item };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const firstYear = history[0].year;
  const lastYear = history[history.length - 1].year;

  return (
    <div className="sparkline-container" aria-hidden="true">
      <svg className="sparkline-svg" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#${gradientId})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
        {points.map((pt) => (
          <circle key={pt.year} cx={pt.x} cy={pt.y} r="2.8" fill={color} />
        ))}
      </svg>
      <div className="sparkline-labels">
        <span>{firstYear}</span>
        <span className="sparkline-range-hint">
          {history[history.length - 1].value.toLocaleString()} {unit}
        </span>
        <span>{lastYear}</span>
      </div>
    </div>
  );
}

export default SparklineChart;

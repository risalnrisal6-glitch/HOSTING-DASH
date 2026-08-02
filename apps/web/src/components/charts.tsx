"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

ChartJS.defaults.color = "#94a3b8";
ChartJS.defaults.font.family = "Inter, system-ui, sans-serif";

const gridColor = "rgba(148,163,184,0.08)";
const tickColor = "#64748b";

export interface SeriesPoint {
  label: string;
  value: number;
}

function baseOptions(): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(13,15,33,0.95)",
        borderColor: "rgba(139,92,246,0.3)",
        borderWidth: 1,
        titleColor: "#e2e8f0",
        bodyColor: "#94a3b8",
        padding: 12,
        displayColors: false,
      },
    },
    scales: {
      x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 5 } },
    },
  };
}

const gradients: Record<string, [string, string]> = {
  violet: ["rgba(139,92,246,0.35)", "rgba(139,92,246,0)"],
  blue: ["rgba(59,130,246,0.35)", "rgba(59,130,246,0)"],
  cyan: ["rgba(34,211,238,0.3)", "rgba(34,211,238,0)"],
  emerald: ["rgba(52,211,153,0.3)", "rgba(52,211,153,0)"],
};

export function LineChart({ data, color = "violet", height = 220, label }: { data: SeriesPoint[]; color?: keyof typeof gradients; height?: number; label?: string }) {
  const ctx = { ctx: { createLinearGradient: () => ({ addColorStop: () => undefined }) } as unknown as CanvasRenderingContext2D };
  const grad = (context: any) => {
    const chart = context.chart;
    const { ctx: c } = chart;
    const g = c.createLinearGradient(0, 0, 0, chart.height || height);
    const [c1, c2] = gradients[color] || gradients.violet;
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    return g;
  };
  return (
    <div style={{ height }} className="relative w-full">
      <Line
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              label: label,
              data: data.map((d) => d.value),
              borderColor: color === "violet" ? "#8b5cf6" : color === "blue" ? "#3b82f6" : color === "cyan" ? "#22d3ee" : "#34d399",
              backgroundColor: grad as never,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointHoverBackgroundColor: "#fff",
              tension: 0.4,
              fill: true,
            },
          ],
        }}
        options={baseOptions()}
      />
    </div>
  );
}

export function Sparkline({ data, color = "#8b5cf6", height = 48 }: { data: number[]; color?: string; height?: number }) {
  return (
    <div style={{ height }}>
      <Line
        data={{
          labels: data.map((_, i) => i),
          datasets: [{ data, borderColor: color, borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false }],
        }}
        options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }}
      />
    </div>
  );
}

export function Donut({ values, labels, colors, centerLabel }: { values: number[]; labels: string[]; colors: string[]; centerLabel?: string }) {
  return (
    <div className="relative mx-auto h-44 w-44">
      <Doughnut
        data={{ labels, datasets: [{ data: values, backgroundColor: colors, borderColor: "rgba(5,6,15,0.9)", borderWidth: 3, hoverOffset: 6 }] }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: { legend: { display: false }, tooltip: { backgroundColor: "rgba(13,15,33,0.95)", borderColor: "rgba(139,92,246,0.3)", borderWidth: 1 } },
        }}
      />
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-slate-100">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

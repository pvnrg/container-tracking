// Flat-isometric shipping containers, hand-plotted on a 2:1 (30°) projection.
// Local unit box: width 100 / depth 50 / height 40, drawn in each container's
// own coordinate space, then positioned with a translate per instance so the
// three boxes read as a stack resting on the same ground plane.
const TOP_FACE = "0,-40 86.6,10 43.3,35 -43.3,-15"
const FACE_X = "86.6,50 43.3,75 43.3,35 86.6,10"
const FACE_Y = "-43.3,25 43.3,75 43.3,35 -43.3,-15"

const FACE_X_RIBS = [
  { x: 77.9, yb: 55, yt: 15 },
  { x: 69.3, yb: 60, yt: 20 },
  { x: 60.55, yb: 65, yt: 25 },
  { x: 51.96, yb: 70, yt: 30 },
]

const FACE_Y_RIBS = [
  { x: -25.98, yb: 35, yt: -5 },
  { x: -8.66, yb: 45, yt: 5 },
  { x: 8.66, yb: 55, yt: 15 },
  { x: 25.98, yb: 65, yt: 25 },
]

const CONTAINER_COLORS = {
  chart1: { top: "fill-chart-1/90", faceX: "fill-chart-1/65", faceY: "fill-chart-1/40" },
  chart3: { top: "fill-chart-3/90", faceX: "fill-chart-3/65", faceY: "fill-chart-3/40" },
  chart5: { top: "fill-chart-5/90", faceX: "fill-chart-5/65", faceY: "fill-chart-5/40" },
} as const

function Container({
  ox,
  oy,
  color,
  withDoor,
}: {
  ox: number
  oy: number
  color: keyof typeof CONTAINER_COLORS
  withDoor?: boolean
}) {
  const c = CONTAINER_COLORS[color]
  return (
    <g transform={`translate(${ox},${oy})`}>
      <polygon points={FACE_Y} className={`${c.faceY} stroke-foreground/20`} strokeWidth="1.2" />
      <polygon points={FACE_X} className={`${c.faceX} stroke-foreground/20`} strokeWidth="1.2" />
      <polygon points={TOP_FACE} className={`${c.top} stroke-foreground/20`} strokeWidth="1.2" />

      {FACE_Y_RIBS.map((r) => (
        <line
          key={`y-${r.x}`}
          x1={r.x}
          y1={r.yb}
          x2={r.x}
          y2={r.yt}
          className="stroke-foreground/15"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      ))}
      {FACE_X_RIBS.map((r) => (
        <line
          key={`x-${r.x}`}
          x1={r.x}
          y1={r.yb}
          x2={r.x}
          y2={r.yt}
          className="stroke-foreground/15"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      ))}

      {withDoor && (
        <>
          <polygon
            points="79.7,50 50.1,67 50.1,35 79.7,18"
            fill="none"
            className="stroke-foreground/30"
            strokeWidth="1.4"
          />
          <line
            x1="79.7"
            y1="34"
            x2="50.1"
            y2="51"
            className="stroke-foreground/30"
            strokeWidth="1.4"
          />
          <circle cx="70.8" cy="39.1" r="1.6" className="fill-foreground/40" />
          <circle cx="59" cy="45.9" r="1.6" className="fill-foreground/40" />
        </>
      )}
    </g>
  )
}

export function ContainerStackIllustration({
  className,
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 260 220"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="125" cy="200" rx="90" ry="14" className="fill-foreground/8" />

      <Container ox={60} oy={80} color="chart1" withDoor />
      <Container ox={146.6} oy={130} color="chart3" />
      <Container ox={103.3} oy={65} color="chart5" />
    </svg>
  )
}

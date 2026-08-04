import type { I8085MachineCycle } from "@/lib/8085/timing";

type TimingDiagramProps = {
  cycle: I8085MachineCycle;
  selectedTState: number;
  onTStateChange: (value: number) => void;
  accent: string;
  border: string;
  panel: string;
  text: string;
  textMuted: string;
};

const LABEL_WIDTH = 60;
const STATE_WIDTH = 52;
const HEADER_HEIGHT = 22;
const ROW_HEIGHT = 26;

const hex = (value: number, digits: number) =>
  value.toString(16).toUpperCase().padStart(digits, "0");

const digitalPath = (values: boolean[], row: number) => {
  const high = HEADER_HEIGHT + row * ROW_HEIGHT + 7;
  const low = HEADER_HEIGHT + row * ROW_HEIGHT + 19;
  let path = `M ${LABEL_WIDTH} ${values[0] ? high : low}`;
  for (let index = 0; index < values.length; index++) {
    const end = LABEL_WIDTH + (index + 1) * STATE_WIDTH;
    path += ` H ${end}`;
    const next = values[index + 1];
    if (next !== undefined && next !== values[index]) {
      path += ` V ${next ? high : low}`;
    }
  }
  return path;
};

const clockPath = (states: number) => {
  const high = HEADER_HEIGHT + 7;
  const low = HEADER_HEIGHT + 19;
  let path = `M ${LABEL_WIDTH} ${high}`;
  for (let index = 0; index < states; index++) {
    const start = LABEL_WIDTH + index * STATE_WIDTH;
    const middle = start + STATE_WIDTH / 2;
    const end = start + STATE_WIDTH;
    path += ` H ${middle} V ${low} H ${end}`;
    if (index < states - 1) path += ` V ${high}`;
  }
  return path;
};

type BusSegment = {
  start: number;
  end: number;
  label: string;
};

function BusWave({
  row,
  segments,
  accent,
  text,
}: {
  row: number;
  segments: BusSegment[];
  accent: string;
  text: string;
}) {
  const center = HEADER_HEIGHT + row * ROW_HEIGHT + ROW_HEIGHT / 2;
  return segments.map((segment, index) => {
    const x1 = LABEL_WIDTH + segment.start * STATE_WIDTH;
    const x2 = LABEL_WIDTH + segment.end * STATE_WIDTH;
    const notch = Math.min(7, (x2 - x1) / 5);
    const path = [
      `M ${x1} ${center}`,
      `L ${x1 + notch} ${center - 7}`,
      `L ${x2 - notch} ${center - 7}`,
      `L ${x2} ${center}`,
      `L ${x2 - notch} ${center + 7}`,
      `L ${x1 + notch} ${center + 7}`,
      "Z",
    ].join(" ");
    return (
      <g key={`${segment.label}-${index}`}>
        <path d={path} fill={`${accent}12`} stroke={accent} strokeWidth="1.2" />
        <text
          x={(x1 + x2) / 2}
          y={center + 3}
          fill={text}
          textAnchor="middle"
          fontSize="8"
          fontFamily="monospace"
        >
          {segment.label}
        </text>
      </g>
    );
  });
}

export function TimingDiagram({
  cycle,
  selectedTState,
  onTStateChange,
  accent,
  border,
  panel,
  text,
  textMuted,
}: TimingDiagramProps) {
  const states = Array.from({ length: cycle.tStates }, (_, index) => index + 1);
  const width = LABEL_WIDTH + cycle.tStates * STATE_WIDTH;
  const height = HEADER_HEIGHT + 9 * ROW_HEIGHT;
  const busActive = cycle.address !== undefined;
  const readValues = states.map(
    (state) => !(cycle.rd && state > 1 && state <= 3),
  );
  const writeValues = states.map(
    (state) => !(cycle.wr && state > 1 && state <= 3),
  );
  const addressSegments: BusSegment[] = busActive
    ? [
        {
          start: 0,
          end: cycle.tStates,
          label: `A15-A8 ${hex((cycle.address ?? 0) >> 8, 2)}`,
        },
      ]
    : [{ start: 0, end: cycle.tStates, label: "HIGH-Z" }];
  const dataSegments: BusSegment[] = busActive
    ? [
        {
          start: 0,
          end: 1,
          label: `A7-A0 ${hex(cycle.address ?? 0, 2)}`,
        },
        {
          start: 1,
          end: cycle.tStates,
          label:
            cycle.data === undefined ? "HIGH-Z" : `DATA ${hex(cycle.data, 2)}`,
        },
      ]
    : [{ start: 0, end: cycle.tStates, label: "HIGH-Z" }];
  const rowLabels = [
    "CLOCK",
    "A15-A8",
    "ALE",
    "AD7-AD0",
    "IO/M",
    "S1",
    "S0",
    "RD̅",
    "WR̅",
  ];

  return (
    <div className="min-w-0 overflow-x-auto rounded">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block min-w-[320px]"
        style={{ width: Math.max(320, width), backgroundColor: panel }}
        aria-label={`${cycle.label} timing waveform`}
        role="img"
      >
        <rect width={width} height={height} fill={panel} />
        <rect
          x={LABEL_WIDTH + (selectedTState - 1) * STATE_WIDTH}
          y={0}
          width={STATE_WIDTH}
          height={height}
          fill={`${accent}12`}
        />

        {states.map((state, index) => {
          const x = LABEL_WIDTH + index * STATE_WIDTH;
          return (
            <g
              key={state}
              role="button"
              tabIndex={0}
              aria-label={`Select T${state}`}
              onClick={() => onTStateChange(state)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onTStateChange(state);
                }
              }}
              className="cursor-pointer"
            >
              <rect
                x={x}
                y={0}
                width={STATE_WIDTH}
                height={height}
                fill="transparent"
              />
              <line
                x1={x}
                y1={0}
                x2={x}
                y2={height}
                stroke={border}
                strokeWidth="1"
              />
              <text
                x={x + STATE_WIDTH / 2}
                y={15}
                fill={selectedTState === state ? accent : textMuted}
                textAnchor="middle"
                fontSize="8"
                fontFamily="monospace"
                fontWeight={selectedTState === state ? 700 : 400}
              >
                T{state}
              </text>
            </g>
          );
        })}

        <line x1={width} y1={0} x2={width} y2={height} stroke={border} />
        <line
          x1={LABEL_WIDTH}
          y1={0}
          x2={LABEL_WIDTH}
          y2={height}
          stroke={border}
        />

        {rowLabels.map((label, index) => {
          const y = HEADER_HEIGHT + index * ROW_HEIGHT;
          return (
            <g key={label}>
              <line
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={border}
                strokeWidth="1"
              />
              <text
                x={8}
                y={y + 17}
                fill={textMuted}
                fontSize="8"
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
        <line x1={0} y1={height} x2={width} y2={height} stroke={border} />

        <path
          d={clockPath(cycle.tStates)}
          fill="none"
          stroke={accent}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <BusWave
          row={1}
          segments={addressSegments}
          accent={accent}
          text={text}
        />
        <path
          d={digitalPath(
            states.map((state) => busActive && state === 1),
            2,
          )}
          fill="none"
          stroke={accent}
          strokeWidth="1.7"
        />
        <BusWave row={3} segments={dataSegments} accent={accent} text={text} />
        <path
          d={digitalPath(
            states.map(() => cycle.ioM === 1),
            4,
          )}
          fill="none"
          stroke={text}
          strokeWidth="1.5"
        />
        <path
          d={digitalPath(
            states.map(() => cycle.s1 === 1),
            5,
          )}
          fill="none"
          stroke={text}
          strokeWidth="1.5"
        />
        <path
          d={digitalPath(
            states.map(() => cycle.s0 === 1),
            6,
          )}
          fill="none"
          stroke={text}
          strokeWidth="1.5"
        />
        <path
          d={digitalPath(readValues, 7)}
          fill="none"
          stroke={cycle.rd ? accent : textMuted}
          strokeWidth="1.7"
        />
        <path
          d={digitalPath(writeValues, 8)}
          fill="none"
          stroke={cycle.wr ? accent : textMuted}
          strokeWidth="1.7"
        />
      </svg>
    </div>
  );
}

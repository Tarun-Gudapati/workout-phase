/* Stylized front/back body map. Paths are the right half of each figure; the left half is mirrored. */

const MuscleMap = (() => {
  const FRONT = [
    ["traps", "M4.5,21 Q9,26 17,28.5 L5,29 Z"],
    ["side delts", "M17,28.5 Q26,27 29.5,34 Q31,40 28.5,45 L25.5,43 Q25,35 19,31 Z"],
    ["front delts", "M17.5,30.5 Q24,33 25.5,43 L23,47 Q19,41 15.5,32.5 Z"],
    ["chest", "M1,30 L15,30.5 Q20,38 22.5,46 Q18,52.5 10,52.5 Q4,52.5 1,50.5 Z"],
    ["biceps", "M23,48 L28.5,45.5 Q31.5,55 30.5,65.5 L25.5,67.5 Q22,57 23,48 Z"],
    ["forearms", "M25.5,69 L30.5,67 Q34.5,78 33.5,90 L28.5,91 Q25,80 25.5,69 Z"],
    ["", "M28.5,92 L33.5,91 Q35.5,96 33,101 Q29.5,102 28,97 Z"],
    ["core", "M1,54 L11,54 Q15,55 16,59 Q20,64 19.5,74 L15.5,85 Q10,89 1,90.5 Z"],
    ["", "M1,91.5 Q10,90 16,86 L20,93 Q14,96 8,99 L1,101 Z"],
    ["quads", "M8,100 Q14,97 20.5,94 Q24,108 22.5,126 Q21,138 18,143 L11,143 Q7,124 8,100 Z"],
    ["adductors", "M1.5,102 L7,100.5 Q6.5,121 10,140 Q4,128 2.5,116 Z"],
    ["", "M11,144 L18,144 Q19.5,148 18.5,151 L11,151 Q10,147 11,144 Z"],
    ["calves", "M18.5,152 Q22.5,160 20.5,172 L18.6,169 Q19.2,160 18.5,152 Z"],
    ["calves", "M10.5,152 Q8.5,160 10,170 L11,165 Q10.6,158 10.5,152 Z"],
    ["", "M11.5,152 L17.8,152 Q18.8,160 18.2,170 Q17,180 16.5,186 L13,186 Q11.6,176 11.3,166 Q11,158 11.5,152 Z"],
    ["", "M12.5,187 L17,187 Q20,191 22,195 L12,195 Z"],
  ];
  const BACK = [
    ["traps", "M0,19 L4.5,19 Q8,25 17,28.5 Q11,31.5 8,37 L0,47 Z"],
    ["side delts", "M17,28.5 Q26,27 29.5,34 Q31,40 28.5,45 L27,40 Q24.5,32 19,30 Z"],
    ["rear delts", "M18.5,30.5 Q24,32.5 26.5,40 L27,44.5 Q22,40.5 17,34.5 Z"],
    ["upper back", "M0,48.5 L8.5,38 Q12,32.5 16.5,35 Q21,40 20.5,46 Q14,51 7,55.5 L0,59 Z"],
    ["lats", "M7.5,56.5 Q14,52 20.5,47.5 Q22.5,52 21.5,60 Q18.5,71 14.5,81 L5,83 Q5.5,70 7.5,56.5 Z"],
    ["lower back", "M0,60 L6.8,57 Q4.8,70 4.5,83.5 L14.5,82 L15.5,88.5 L0,90 Z"],
    ["triceps", "M22,47 L28.5,45.5 Q31.5,55 30.5,65.5 L25.5,67.5 Q21.5,57 22,47 Z"],
    ["forearms", "M25.5,69 L30.5,67 Q34.5,78 33.5,90 L28.5,91 Q25,80 25.5,69 Z"],
    ["", "M28.5,92 L33.5,91 Q35.5,96 33,101 Q29.5,102 28,97 Z"],
    ["glutes", "M0,91 L15.5,89.5 Q21,95 20.5,104 Q18,113 10,113.5 Q3,113 0,110 Z"],
    ["hamstrings", "M3.5,114.5 L10,114.5 Q18,114 20.5,106 Q23,122 19.5,141 L11.5,142 Q6.5,128 3.5,114.5 Z"],
    ["adductors", "M1,111 L2.8,114.5 Q6.5,129 10.6,141 L8,140 Q2.5,127 1,111 Z"],
    ["", "M11.5,143 L19,142 Q19.5,147 18.5,150 L11,150 Q10.4,146 11.5,143 Z"],
    ["calves", "M10.5,151 L19,151 Q22.5,160 20,172 Q17.5,177 14.5,178 Q11,174 10.3,165 Q9.8,157 10.5,151 Z"],
    ["", "M13.2,179 L19.5,173.5 L18,186 L13.5,186 Z"],
    ["", "M12.5,187 L17.5,187 Q19,191 19,195 L12,195 Z"],
  ];
  const CORE_LINES = "M2,63 L13,63 M2,72 L15,72 M2,81 L13,81";

  const REGIONS = [...new Set([...FRONT, ...BACK].map(([m]) => m).filter(Boolean))];

  function figure(parts, x, cls, extra = "") {
    const half = parts.map(([m, d]) => `<path d="${d}" class="${m ? cls(m) : "b"}"/>`).join("") + extra;
    return `<g transform="translate(${x} 4)">
      <ellipse cx="0" cy="9.5" rx="7.5" ry="9.5" class="b"/><path d="M-4.5,18 L4.5,18 L5,28 L-5,28 Z" class="b"/>
      <g>${half}</g><g transform="scale(-1 1)">${half}</g></g>`;
  }

  function label(primary, secondary) {
    return `Main: ${primary}.${secondary.length ? ` Helpers: ${secondary.join(", ")}.` : ""}`;
  }

  function svg(primary, secondary = []) {
    const cls = (m) => (m === primary ? "m p" : secondary.includes(m) ? "m s" : "m");
    const lines = `<path d="${CORE_LINES}" class="ln"/>`;
    return `<svg class="mm" viewBox="0 0 160 214" role="img" aria-label="Muscle map. ${label(primary, secondary)}">
      ${figure(FRONT, 42, cls, lines)}${figure(BACK, 118, cls)}
      <text x="42" y="211" class="mm-t">FRONT</text><text x="118" y="211" class="mm-t">BACK</text>
    </svg>`;
  }

  return { svg, label, REGIONS };
})();

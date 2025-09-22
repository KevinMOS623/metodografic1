/* app.js
 - Método gráfico (2 variables) en JavaScript puro.
 - Guardar en la misma carpeta que index.html y styles.css
*/

(() => {
  // ---------- CONFIG ----------
  const SVG_W = 760;
  const SVG_H = 480;
  const PADDING = 48;

  // colour theme (simple)
  const COLORS = {
    eje: "#666",
    restriccion: "#140365ff",
    restriccionDash: "4 4",
    factibleFill: "#16a34a",
    vertexFill: "#1d4ed8",
    vertexText: "#000",
    grid: "#1e8de2ff"
  };

  // ---------- ELEMENTS ----------
  const constraintsList = document.getElementById("constraintsList");
  const addConstraintBtn = document.getElementById("addConstraint");
  const clearConstraintsBtn = document.getElementById("clearConstraints");
  const computeBtn = document.getElementById("computeBtn");
  const clearBtn = document.getElementById("clearBtn");
  const exportCSV = document.getElementById("exportCSV");
  const svgWrap = document.getElementById("svgWrap");
  const pointsTableBody = document.querySelector("#pointsTable tbody");
  const axInput = document.getElementById("ax");
  const byInput = document.getElementById("by");
  const optType = document.getElementById("optType");
  const nonNeg = document.getElementById("nonNeg");

  // ---------- APP STATE ----------
  let constraints = [
    { a: 1, b: 0, op: "<=", c: 6 },
    { a: 0, b: 1, op: "<=", c: 4 }
  ];
  let points = []; // vertices with {x,y,value}

  // ---------- UTIL: DOM helpers ----------
  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    children.forEach(c => {
      if (c == null) return;
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  // ---------- UI: constraints list ----------
  function renderConstraints() {
    constraintsList.innerHTML = "";
    constraints.forEach((c, i) => {
      const row = el("div", { class: "row", style: "margin-top:6px" });
      const a = el("input", { type: "number", step: "any", value: c.a });
      a.addEventListener("input", () => { c.a = parseFloat(a.value) || 0; });
      const plus = el("span", {}, "x +");
      const b = el("input", { type: "number", step: "any", value: c.b });
      b.addEventListener("input", () => { c.b = parseFloat(b.value) || 0; });
      const ylbl = el("span", {}, "y");
      const op = el("select");
      ["<=", ">=", "="].forEach(o => { const oel = el("option", { value: o }, o); if (o===c.op) oel.selected = true; op.appendChild(oel); });
      op.addEventListener("change", () => { c.op = op.value; });
      const cc = el("input", { type: "number", step: "any", value: c.c });
      cc.addEventListener("input", () => { c.c = parseFloat(cc.value) || 0; });
      const del = el("button", {}, "X");
      del.addEventListener("click", () => { constraints.splice(i,1); renderConstraints(); });
      row.appendChild(a); row.appendChild(plus); row.appendChild(b); row.appendChild(ylbl); row.appendChild(op); row.appendChild(cc); row.appendChild(del);
      constraintsList.appendChild(row);
    });
  }

  addConstraintBtn.addEventListener("click", () => {
    constraints.push({ a: 0, b: 0, op: "<=", c: 0 });
    renderConstraints();
  });
  clearConstraintsBtn.addEventListener("click", () => { constraints = []; renderConstraints(); });

  // ---------- MATH UTILITIES ----------
  function intersect(line1, line2) {
    // line: {a,b,c} representing a x + b y = c
    const a1 = line1.a, b1 = line1.b, c1 = line1.c;
    const a2 = line2.a, b2 = line2.b, c2 = line2.c;
    const det = a1*b2 - a2*b1;
    if (Math.abs(det) < 1e-12) return null;
    const x = (c1*b2 - c2*b1) / det;
    const y = (a1*c2 - a2*c1) / det;
    if (!isFinite(x) || !isFinite(y)) return null;
    return { x: Number(x.toFixed(9)), y: Number(y.toFixed(9)) };
  }

  function satisfies(pt, cons) {
    const val = cons.a * pt.x + cons.b * pt.y;
    if (cons.op === "<=") return val <= cons.c + 1e-9;
    if (cons.op === ">=") return val >= cons.c - 1e-9;
    return Math.abs(val - cons.c) < 1e-9;
  }

  function computeVertices() {
    // Build equality lines for constraints
    const lines = constraints.map(r => ({ a: r.a, b: r.b, c: r.c, op: r.op }));
    const cand = [];

    // intersections pairwise
    for (let i=0;i<lines.length;i++){
      for (let j=i+1;j<lines.length;j++){
        const p = intersect(lines[i], lines[j]);
        if (p) cand.push(p);
      }
    }

    // axis intercepts (x=0 or y=0) if applicable
    for (const l of lines) {
      if (Math.abs(l.b) > 1e-12) cand.push({ x:0, y: l.c / l.b });
      if (Math.abs(l.a) > 1e-12) cand.push({ x: l.c / l.a, y: 0 });
    }

    // include origin
    cand.push({ x:0, y:0 });

    // remove duplicates (by rounded key) and filter feasible
    const seen = new Set();
    const feasible = [];
    for (const p of cand) {
      if (!isFinite(p.x) || !isFinite(p.y)) continue;
      const key = `${p.x.toFixed(9)}_${p.y.toFixed(9)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // non-negativity
      if (nonNeg.checked && (p.x < -1e-9 || p.y < -1e-9)) continue;
      const ok = constraints.every(cons => satisfies(p, cons));
      if (ok) feasible.push({ x: Number(p.x), y: Number(p.y) });
    }

    // If no constraints, return empty
    if (feasible.length === 0) return [];

    // Sort CCW for polygon drawing
    const cx = feasible.reduce((s,p) => s + p.x, 0) / feasible.length;
    const cy = feasible.reduce((s,p) => s + p.y, 0) / feasible.length;
    feasible.sort((p1,p2) => Math.atan2(p1.y-cy, p1.x-cx) - Math.atan2(p2.y-cy, p2.x-cx));
    return feasible;
  }

  // ---------- SVG Helpers ----------
  function createSVG() {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", "100%");
    s.setAttribute("viewBox", `0 0 ${SVG_W} ${SVG_H}`);
    return s;
  }

  function toSvgX(x, maxX) { return PADDING + (x / maxX) * (SVG_W - PADDING*2); }
  function toSvgY(y, maxY) { return SVG_H - (PADDING + (y / maxY) * (SVG_H - PADDING*2)); }

  function drawGrid(svg, maxX, maxY) {
    // light grid lines and axis marks
    const nx = 6, ny = 6;
    for (let i=0;i<=nx;i++){
      const vx = (maxX/nx)*i;
      const x = toSvgX(vx, maxX);
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      line.setAttribute("y1", toSvgY(0, maxY)); line.setAttribute("y2", toSvgY(maxY, maxY));
      line.setAttribute("stroke", COLORS.grid); line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
      const txt = document.createElementNS(svg.namespaceURI, "text");
      txt.setAttribute("x", x); txt.setAttribute("y", toSvgY(0, maxY) + 14);
      txt.setAttribute("font-size", "11"); txt.setAttribute("text-anchor", "middle");
      txt.textContent = vx.toFixed(1);
      svg.appendChild(txt);
    }
    for (let j=0;j<=ny;j++){
      const vy = (maxY/ny)*j;
      const y = toSvgY(vy, maxY);
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("y1", y); line.setAttribute("y2", y);
      line.setAttribute("x1", toSvgX(0, maxX)); line.setAttribute("x2", toSvgX(maxX, maxX));
      line.setAttribute("stroke", COLORS.grid); line.setAttribute("stroke-width", "1");
      svg.appendChild(line);
      const txt = document.createElementNS(svg.namespaceURI, "text");
      txt.setAttribute("x", toSvgX(0, maxX) - 8); txt.setAttribute("y", y + 4);
      txt.setAttribute("font-size", "11"); txt.setAttribute("text-anchor", "end");
      txt.textContent = vy.toFixed(1);
      svg.appendChild(txt);
    }
  }

  // ---------- RENDER ----------
  function renderGraph() {
    // compute feasible vertices
    const verts = computeVertices();
    // evaluate objective and build points list
    const a = parseFloat(axInput.value) || 0;
    const b = parseFloat(byInput.value) || 0;
    const isMax = optType.value === "max";

    points = verts.map(v => ({ x: v.x, y: v.y, z: a*v.x + b*v.y }));

    // Determine bounds (maxX,maxY) to fit all constraints & points
    let maxX = 10, maxY = 10;
    for (const c of constraints) {
      if (Math.abs(c.a) > 1e-12) maxX = Math.max(maxX, Math.abs(c.c / (c.a || 1)) * 1.2);
      if (Math.abs(c.b) > 1e-12) maxY = Math.max(maxY, Math.abs(c.c / (c.b || 1)) * 1.2);
    }
    for (const p of points) { maxX = Math.max(maxX, Math.abs(p.x) * 1.2); maxY = Math.max(maxY, Math.abs(p.y) * 1.2); }

    // Build SVG
    svgWrap.innerHTML = "";
    const svg = createSVG();
    // axes
    const axisX = document.createElementNS(svg.namespaceURI, "line");
    axisX.setAttribute("x1", toSvgX(0, maxX)); axisX.setAttribute("y1", toSvgY(0, maxY));
    axisX.setAttribute("x2", toSvgX(maxX, maxX)); axisX.setAttribute("y2", toSvgY(0, maxY));
    axisX.setAttribute("stroke", COLORS.eje); svg.appendChild(axisX);
    const axisY = document.createElementNS(svg.namespaceURI, "line");
    axisY.setAttribute("x1", toSvgX(0, maxX)); axisY.setAttribute("y1", toSvgY(0, maxY));
    axisY.setAttribute("x2", toSvgX(0, maxX)); axisY.setAttribute("y2", toSvgY(maxY, maxY));
    axisY.setAttribute("stroke", COLORS.eje); svg.appendChild(axisY);

    // grid
    drawGrid(svg, maxX, maxY);

    // plot constraint lines (as boundary lines)
    constraints.forEach((cons, idx) => {
      // represent ax + by = c as two points within bounds
      let p1 = null, p2 = null;
      if (Math.abs(cons.b) > 1e-12) p1 = { x: 0, y: cons.c / cons.b };
      else p1 = { x: cons.c / cons.a, y: 0 };
      if (Math.abs(cons.a) > 1e-12) p2 = { x: cons.c / cons.a, y: 0 };
      else p2 = { x: 0, y: cons.c / cons.b };
      const line = document.createElementNS(svg.namespaceURI, "line");
      line.setAttribute("x1", toSvgX(p1.x, maxX)); line.setAttribute("y1", toSvgY(p1.y, maxY));
      line.setAttribute("x2", toSvgX(p2.x, maxX)); line.setAttribute("y2", toSvgY(p2.y, maxY));
      line.setAttribute("stroke", COLORS.restriccion);
      line.setAttribute("stroke-dasharray", COLORS.restriccionDash);
      svg.appendChild(line);
      // label op
      const midX = (toSvgX(p1.x, maxX) + toSvgX(p2.x, maxX)) / 2;
      const midY = (toSvgY(p1.y, maxY) + toSvgY(p2.y, maxY)) / 2;
      const t = document.createElementNS(svg.namespaceURI, "text");
      t.setAttribute("x", midX); t.setAttribute("y", midY); t.setAttribute("font-size", "12");
      t.setAttribute("text-anchor", "middle"); t.textContent = cons.op;
      svg.appendChild(t);
    });

    // feasible polygon
    if (points.length >= 3) {
      const poly = document.createElementNS(svg.namespaceURI, "polygon");
      poly.setAttribute("points", points.map(p => `${toSvgX(p.x, maxX)},${toSvgY(p.y, maxY)}`).join(" "));
      poly.setAttribute("fill", COLORS.factibleFill);
      poly.setAttribute("fill-opacity", "0.18");
      svg.appendChild(poly);
    }

    // vertices
    points.forEach(p => {
      const c = document.createElementNS(svg.namespaceURI, "circle");
      c.setAttribute("cx", toSvgX(p.x, maxX)); c.setAttribute("cy", toSvgY(p.y, maxY));
      c.setAttribute("r", 4); c.setAttribute("fill", COLORS.vertexFill);
      svg.appendChild(c);
      const t = document.createElementNS(svg.namespaceURI, "text");
      t.setAttribute("x", toSvgX(p.x, maxX) + 8); t.setAttribute("y", toSvgY(p.y, maxY) - 6);
      t.setAttribute("font-size", "12"); t.setAttribute("fill", COLORS.vertexText);
      t.textContent = `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;
      svg.appendChild(t);
    });

    svgWrap.appendChild(svg);

    // Fill table
    renderPointsTable();
  }

  // ---------- Table rendering & edit ----------
  function renderPointsTable() {
    pointsTableBody.innerHTML = "";
    points.forEach((p, idx) => {
      const tr = document.createElement("tr");
      // x cell (editable)
      const tdX = document.createElement("td");
      const inX = document.createElement("input"); inX.type = "number"; inX.step="any"; inX.value = p.x;
      inX.addEventListener("change", () => {
        p.x = parseFloat(inX.value) || 0;
        p.z = (parseFloat(axInput.value)||0)*p.x + (parseFloat(byInput.value)||0)*p.y;
        renderGraph(); // re-render to update positions & polygon
      });
      tdX.appendChild(inX);
      // y
      const tdY = document.createElement("td");
      const inY = document.createElement("input"); inY.type = "number"; inY.step="any"; inY.value = p.y;
      inY.addEventListener("change", () => {
        p.y = parseFloat(inY.value) || 0;
        p.z = (parseFloat(axInput.value)||0)*p.x + (parseFloat(byInput.value)||0)*p.y;
        renderGraph();
      });
      tdY.appendChild(inY);
      // z (read-only)
      const tdZ = document.createElement("td");
      tdZ.textContent = p.z !== undefined ? p.z.toFixed(6) : ((parseFloat(axInput.value)||0)*p.x + (parseFloat(byInput.value)||0)*p.y).toFixed(6);
      tr.appendChild(tdX); tr.appendChild(tdY); tr.appendChild(tdZ);
      pointsTableBody.appendChild(tr);
    });

    // show best value (highlight) - just an alert button for simplicity
    if (points.length > 0) {
      const a = parseFloat(axInput.value) || 0;
      const b = parseFloat(byInput.value) || 0;
      const best = points.reduce((acc,p) => {
        const val = a*p.x + b*p.y;
        if (!acc) return {p, val};
        if (optType.value === "max") return val > acc.val ? {p, val} : acc;
        return val < acc.val ? {p, val} : acc;
      }, null);
      if (best) {
        // append summary row
        const tr = document.createElement("tr");
        tr.style.background = "#f8fafc";
        const td = document.createElement("td"); td.colSpan=3;
        td.textContent = `Mejor punto (${best.p.x.toFixed(3)}, ${best.p.y.toFixed(3)}) -> Z = ${best.val.toFixed(6)} (${optType.value})`;
        tr.appendChild(td); pointsTableBody.appendChild(tr);
      }
    }
  }

  // ---------- CSV EXPORT ----------
  function downloadCSV() {
    if (!points || points.length===0) return alert("No hay puntos para exportar. Genere el gráfico primero.");
    let csv = "x,y,z\n";
    points.forEach(p => { csv += `${p.x},${p.y},${(parseFloat(axInput.value)||0)*p.x + (parseFloat(byInput.value)||0)*p.y}\n`; });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "coordenadas.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- EVENTS ----------
  computeBtn.addEventListener("click", () => {
    try {
      renderGraph();
    } catch (err) {
      console.error(err); alert("Error al calcular: " + err.message);
    }
  });
  clearBtn.addEventListener("click", () => { svgWrap.innerHTML = ""; pointsTableBody.innerHTML = ""; points = []; });
  exportCSV.addEventListener("click", downloadCSV);

  // method selector -> basic behavior
  document.getElementById("methodSelector").addEventListener("change", (e) => {
    const val = e.target.value;
    if (val !== "grafico") {
      alert(`Has seleccionado "${val}". Actualmente esta app implementa el método gráfico. Las otras opciones son plantillas para ampliar.`)
    }
  });

  // initial render
  renderConstraints();
  // draw initial simple graph
  renderGraph();

})();

(function () {
  const vscode = acquireVsCodeApi();
  console.log("vscode api:", vscode);
  const state = { cy: null };
  window.__STATE__ = state;

  const titleEl = document.getElementById("stage-title");
  const statsEl = document.getElementById("stage-stats");

  function post(type, payload) {
    vscode.postMessage({ type, payload });
  }
  function log(message) {
    post("log", { message });
  }

  const palette = {
    app: "#1f77b4",
    "pkg.io": "#2ca02c",
    "pkg.mathlib": "#9467bd",
    default: "#007acc",
  };

  function colorFor(group) {
    return palette[group] || palette.default;
  }

  function toElements(graph) {
    const nodes = (graph.nodes || []).map((n) => ({
      data: { id: n.id, label: n.label, type: n.type, group: n.group },
      classes: n.group ? `g-${n.group.replace(/[^a-zA-Z0-9_-]/g, "_")}` : "",
    }));
    const edges = (graph.edges || []).map((e) => ({
      data: {
        id: e.source + "->" + e.target,
        source: e.source,
        target: e.target,
        type: e.type,
      },
    }));
    return nodes.concat(edges);
  }

  function applyStyles(cy) {
    const baseStyles = [
      {
        selector: "node",
        style: {
          label: "data(label)",
          "background-color": "#007acc",
          color: "#fff",
          "text-valign": "center",
          "text-halign": "center",
          "font-size": 10,
          width: "label",
          height: "label",
          padding: 10,
          shape: "round-rectangle",
        },
      },
      {
        selector: "edge",
        style: {
          width: 2,
          "line-color": "#aaa",
          "target-arrow-color": "#aaa",
          "curve-style": "straight",
          "target-arrow-shape": "triangle",
        },
      },
      { selector: ".faded", style: { opacity: 0.15 } },
      {
        selector: ".highlighted",
        style: {
          "line-color": "#ff9800",
          "target-arrow-color": "#ff9800",
          width: 3,
        },
      },
    ];

    cy.style(baseStyles);

    const groups = new Set(
      cy
        .nodes()
        .map((n) => n.data("group"))
        .filter(Boolean)
    );
    groups.forEach((g) => {
      cy.style()
        .selector(`node[group = "${g}"]`)
        .style("background-color", colorFor(g))
        .update();
    });
  }

  function fit(cy) {
    cy.fit(undefined, 30);
  }

  function render(graph) {
    const t0 = performance.now();
    const container = document.getElementById("cy");
    state.cy?.destroy();

    // 1) Construct without layout to measure layout separately
    const cy = (state.cy = cytoscape({
      container,
      elements: toElements(graph),
      style: [],
      wheelSensitivity: 0.15,
    }));

    applyStyles(cy);

    // 2) Measure layout time explicitly
    const tLayoutStart = performance.now();
    const layout = cy.layout({ name: "cose", animate: false });
    layout.on("layoutstop", () => {
      const tLayoutEnd = performance.now();
      fit(cy);
      log(`[metrics] layout=${(tLayoutEnd - tLayoutStart).toFixed(1)} ms`);
    });
    layout.run();

    // 3) Interactions (unchanged)
    cy.on("tap", "node", (evt) => {
      const e = evt.originalEvent;
      const n = evt.target;
      if (e && (e.ctrlKey || e.metaKey)) {
        const neighborhood = n.closedNeighborhood();
        cy.elements().addClass("faded");
        neighborhood.removeClass("faded");
        neighborhood.filter("edge").addClass("highlighted");
        log(`highlight ${n.id()}`);
      } else {
        post("drill", { id: n.id() });
        cy.elements().removeClass("faded highlighted");
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "r") {
        const tReLayoutStart = performance.now();
        const rel = cy.layout({ name: "cose", animate: false });
        rel.on("layoutstop", () => {
          const tReLayoutEnd = performance.now();
          fit(cy);
          log(
            `[metrics] relayout=${(tReLayoutEnd - tReLayoutStart).toFixed(
              1
            )} ms`
          );
        });
        rel.run();
      }
    });

    cy.on("cxttap", "node", (evt) => {
      const id = evt.target.id();
      post("openInEditor", { id });
    });

    let to = null;
    window.addEventListener("resize", () => {
      if (to) {
        cancelAnimationFrame(to);
      }
      to = requestAnimationFrame(() => fit(cy));
    });

    const t1 = performance.now();
    log(
      `[metrics] render(total)=${(t1 - t0).toFixed(1)} ms nodes=${
        graph?.nodes?.length || 0
      } edges=${graph?.edges?.length || 0}`
    );
  }

  // Single message handler with export support
  function exportBlob(kind) {
    if (!state.cy) {
      return;
    }
    if (kind === "png") {
      const dataUrl = state.cy.png({
        full: true,
        scale: 2,
        bg: getComputedStyle(document.body).backgroundColor,
      });
      post("export:result", { kind: "png", dataUrl });
    } else if (kind === "svg") {
      const svgStr = state.cy.svg({ full: true, scale: 1 }); // requires cytoscape-svg plugin
      post("export:result", { kind: "svg", svg: svgStr });
    }
  }

  window.addEventListener("message", (event) => {
    const { type, payload } = event.data || {};
    if (type === "render:graph" && payload && payload.nodes && payload.edges) {
      // update title and stats
      if (titleEl) {
        titleEl.textContent = "Stage 04 — Import Graph (Live)";
      }
      if (statsEl && payload.meta && payload.meta.stats) {
        const s = payload.meta.stats;
        statsEl.textContent = `files: ${s.files}  edges: ${s.edges}  scanned: ${s.scanned}`;
      }
      render(payload);
    }
    if (type === "export:png") {
      exportBlob("png");
    }
    if (type === "export:svg") {
      exportBlob("svg");
    }
  });

  function bindExportButton() {
    const btn = document.getElementById("export-json");
    if (!btn) {
      return;
    }

    btn.addEventListener("click", () => {
      console.log("[webview] button clicked!");
      console.log(state.cy.edges());
      const edges = state.cy.edges().map((e) => ({
        source: e.data("source"),
        target: e.data("target"),
      }));
      post("export:edges", edges);
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    bindExportButton();
  });

  post("ready");
})();

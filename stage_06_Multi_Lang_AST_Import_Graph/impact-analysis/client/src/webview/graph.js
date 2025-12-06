/* global cytoscape, acquireVsCodeApi */
(function () {
  // ---------- VS Code bridge ----------
  const vscode =
    typeof acquireVsCodeApi === "function"
      ? acquireVsCodeApi()
      : { postMessage() {} };
  const post = (type, payload) => {
    try {
      vscode.postMessage({ type, payload });
    } catch {}
  };
  const log = (msg) => post("log", { message: String(msg) });

  // ---------- runtime ----------
  const state = { cy: null, inited: false };
  const titleEl = document.getElementById("stage-title");
  const statsEl = document.getElementById("stage-stats");

  window.__STATE__ = state;

  // ---------- init once ----------
  function ensureInstance() {
    if (state.inited && state.cy) {
      return state.cy;
    }

    const container = document.getElementById("cy");
    if (!container || typeof cytoscape !== "function") {
      console.error("[graph] container or cytoscape missing");
      return null;
    }

    const cy = cytoscape({
      container,
      wheelSensitivity: 0.15,
      style: [
        // base styles
        {
          selector: "node",
          style: {
            "background-color": "#1e88e5",
            width: 28,
            height: 18,
            label: "data(label)",
            color: "#fff",
            "font-size": 10,
            "text-valign": "center",
            "text-halign": "center",
            "text-outline-width": 2,
            "text-outline-color": "#1565c0",
            shape: "round-rectangle",
          },
        },
        {
          selector: 'node[lang = "ts"]',
          style: {
            "background-color": "#4FC3F7",
          },
        },
        {
          selector: 'node[lang = "js"]',
          style: {
            "background-color": "#FFEE58",
          },
        },
        {
          selector: 'node[lang = "py"]',
          style: {
            "background-color": "#81C784",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#90caf9",
            "target-arrow-color": "#90caf9",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        // highlight styles (split for node / edge)
        {
          selector: "node.hl",
          style: {
            "background-color": "#ffd54f",
            "text-outline-color": "#ffb300",
            "border-width": 2,
            "border-color": "#ffca28",
            // 注意：不改 width/height，避免把节点压扁
          },
        },
        {
          selector: "edge.hl",
          style: {
            "line-color": "#ffca28",
            "target-arrow-color": "#ffca28",
            width: 3,
          },
        },
        // dim styles
        {
          selector: ".dim",
          style: { opacity: 0.25 },
        },
      ],
    });

    // 深色背景
    cy.container().style.background = "#0f111a";

    // ---------- highlight helpers ----------
    let lastNeighborhood = null;
    let lastNode = null;

    function clearHighlight() {
      const eles = state.cy?.elements();
      if (eles) {
        eles.removeClass("hl");
        eles.removeClass("dim");
      }
      lastNeighborhood = null;
      lastNode = null;
    }

    function highlightNeighborhood(n) {
      clearHighlight();
      if (!n) {
        return;
      }
      const nb = n.closedNeighborhood();
      nb.nodes().addClass("hl");
      nb.edges().addClass("hl");
      // 其它全部淡化
      cy.elements().difference(nb).addClass("dim");
      lastNeighborhood = nb;
      lastNode = n;
    }

    cy.on("layoutstop", () => {
      console.log("[GLOBAL] layout finished");
      window.__CY_READY__ = true;
    });

    // 屏蔽原生右键菜单
    cy.container().addEventListener("contextmenu", (e) => e.preventDefault());

    // 左键：Ctrl/⌘ 高亮切换；普通点击走 drill
    cy.on("tap", "node", (evt) => {
      const e = evt.originalEvent;
      const isCtrl = !!(e && (e.ctrlKey || e.metaKey));
      const n = evt.target;

      if (isCtrl) {
        if (lastNode && lastNode.id() === n.id()) {
          clearHighlight();
        } else {
          highlightNeighborhood(n);
        }
        return; // 不触发 openInEditor
      }

      // 普通左键 → Drill
      post("drill", { id: n.data("id") });
    });

    // 点击空白 & Esc 还原
    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        clearHighlight();
      }
    });

    // 小工具：重新跑一次布局并自适应视野
    function runLayout() {
      const t0 = performance.now();
      const layout = cy.layout({ name: "cose", animate: false });

      layout.run();
      while (!window.__CY_READY__) {}
      cy.resize();
      cy.fit(undefined, 32);
      cy.center();
      log(`[metrics] relayout=${(performance.now() - t0).toFixed(1)} ms`);
    }

    // 键盘：按 R 重新布局（不区分大小写）
    window.addEventListener("keydown", (e) => {
      // 检测用户是否正在输入框中打字。如果是，就直接返回，不执行其他逻辑（如自定义快捷键）。这可以防止干扰用户的正常输入行为。
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return;
      }

      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        try {
          runLayout();
        } catch {
          /* empty */
        }
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        clearHighlight();
      }
    });

    // add custom tooltip
    const tooltip = createTooltip();

    // 鼠标移入节点：显示 tooltip
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const path = node.data("path");
      if (!path) {
        return;
      }

      const e = event.originalEvent;
      if (!e) {
        return;
      }

      tooltip.show(path, e.clientX, e.clientY);
    });

    // 在节点上移动：更新位置
    cy.on("mousemove", "node", (event) => {
      const e = event.originalEvent;
      if (!e) {
        return;
      }

      tooltip.move(e.clientX, e.clientY);
    });

    // 移出节点：隐藏 tooltip
    cy.on("mouseout", "node", () => {
      tooltip.hide();
    });

    // 视图缩放或拖动画布时隐藏 tooltip（避免残留）
    cy.on("pan zoom", () => {
      tooltip.hide();
    });

    // export for DevTools
    window.cy = cy;
    state.cy = cy;
    window.relayout = runLayout;
    state.inited = true;
    return cy;
  }

  // ---------- data mapping ----------
  function toElements(graph) {
    const nodes = (graph?.nodes ?? []).map((n) => ({
      group: "nodes",
      data: {
        id: n.id,
        label: n.label || n.id,
        path: n.path || n.id, // 换成 path
        lang: n.lang,
      },
    }));
    const edges = (graph?.edges ?? []).map((e) => ({
      group: "edges",
      data: {
        id: e.id || `${e.source}>${e.target}`,
        source: e.source,
        target: e.target,
      },
    }));
    return [...nodes, ...edges];
  }

  // ---------- render ----------
  function renderFromAst(graph) {
    const cy = ensureInstance();
    if (!cy) {
      return;
    }

    if (titleEl) {
      titleEl.textContent = "stage_05_AST_Import_Parser";
    }
    const stats = graph?.meta?.stats || graph?.stats;
    if (statsEl && stats) {
      statsEl.textContent = `files: ${stats.files}  edges: ${stats.edges}  parsed : ${stats.parsed}`;
    }

    const t0 = performance.now();
    const elements = toElements(graph);

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
      // 清理任何残留高亮/淡化
      cy.elements().removeClass("hl").removeClass("dim");
    });

    // 布局 + 视野
    const tLayoutStart = performance.now();
    const layout = cy.layout({ name: "cose", animate: false });

    layout.run();
    while (!window.__CY_READY__) {}
    cy.resize();
    cy.fit(undefined, 32);
    cy.center();
    const t1 = performance.now();
    log(
      `[metrics] render(total)=${(t1 - t0).toFixed(1)} ms nodes=${
        cy.nodes().length
      } edges=${cy.edges().length}`
    );
  }

  // ---------- export ----------
  function exportPNG() {
    const cy = ensureInstance();
    if (!cy) {
      return;
    }
    const dataUrl = cy.png({
      full: true,
      scale: 2,
      bg: getComputedStyle(document.body).backgroundColor,
    });
    post("savePNG", { dataUrl, suggested: "impact-graph.png" });
    post("export:result", { kind: "png", dataUrl }); // 兼容另一条回传协议
  }

  // ---------- message pump ----------
  window.addEventListener("message", (e) => {
    const { type, payload } = e.data || {};
    if (!type) {
      return;
    }

    if (type === "render:graph" && payload) {
      renderFromAst(payload);
      return;
    }
    if (type === "render") {
      return;
    } // 旧路径忽略
    if (type === "exportPNG" || type === "export:png") {
      exportPNG();
      return;
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("export-json");
    if (btn) {
      btn.addEventListener("click", () => {
        if (!window.__CY_READY__) {
          console.log("Please wait… graph layout not finished.");
          return;
        }

        const edges = state.cy.edges().map((e) => ({
          source: e.data("source"),
          target: e.data("target"),
        }));

        post("export:edges", edges);
      });
    }
  });

  function createTooltip() {
    const el = document.createElement("div");
    el.className = "impact-tooltip";
    document.body.appendChild(el);

    let visible = false;

    function show(text, x, y) {
      if (!text) {
        return;
      }
      el.textContent = text;
      el.style.left = `${x + 12}px`;
      el.style.top = `${y + 12}px`;
      if (!visible) {
        el.style.display = "block";
        visible = true;
      }
    }

    function move(x, y) {
      if (!visible) {
        return;
      }
      el.style.left = `${x + 12}px`;
      el.style.top = `${y + 12}px`;
    }

    function hide() {
      if (!visible) {
        return;
      }
      el.style.display = "none";
      visible = false;
    }

    return { show, move, hide };
  }

  // ready
  ensureInstance();
  post("ready");
})();

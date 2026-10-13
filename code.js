(() => {
  // code.ts
  var TOOL_ID = "a14e05fc-3359-442e-9517-a207dd14633d";
  var DISPLAY_NAME = "RTL - V2.0 — Create translated RTL/LTR preview";
  var PARAMS_KEY = TOOL_ID + ":params";
  var DEFAULTS = { language: "Arabic", direction: "Auto" };
  var LANGUAGE_PROFILES = {
    English: { code: "en", script: "Latin", rtl: false, fonts: ["Noto Sans"] },
    French: { code: "fr", script: "Latin", rtl: false, fonts: ["Noto Sans"] },
    German: { code: "de", script: "Latin", rtl: false, fonts: ["Noto Sans"] },
    Spanish: { code: "es", script: "Latin", rtl: false, fonts: ["Noto Sans"] },
    Arabic: { code: "ar", script: "Arabic", rtl: true, fonts: ["Noto Sans Arabic"] },
    Hebrew: { code: "he", script: "Hebrew", rtl: true, fonts: ["Noto Sans Hebrew"] },
    Persian: { code: "fa", script: "Arabic", rtl: true, fonts: ["Noto Sans Arabic"] },
    Urdu: { code: "ur", script: "Arabic", rtl: true, fonts: ["Noto Sans Arabic"] },
    Russian: { code: "ru", script: "Cyrillic", rtl: false, fonts: ["Noto Sans"] },
    Ukrainian: { code: "uk", script: "Cyrillic", rtl: false, fonts: ["Noto Sans"] },
    Bulgarian: { code: "bg", script: "Cyrillic", rtl: false, fonts: ["Noto Sans"] },
    Hindi: { code: "hi", script: "Devanagari", rtl: false, fonts: ["Noto Sans Devanagari"] },
    Bengali: { code: "bn", script: "Bengali", rtl: false, fonts: ["Noto Sans Bengali"] },
    Tamil: { code: "ta", script: "Tamil", rtl: false, fonts: ["Noto Sans Tamil"] },
    Telugu: { code: "te", script: "Telugu", rtl: false, fonts: ["Noto Sans Telugu"] },
    "Chinese Simplified": { code: "zh-CN", script: "Simplified Chinese", rtl: false, fonts: ["Noto Sans SC", "Noto Sans CJK SC"] },
    "Chinese Traditional": { code: "zh-TW", script: "Traditional Chinese", rtl: false, fonts: ["Noto Sans TC", "Noto Sans CJK TC"] },
    Japanese: { code: "ja", script: "Japanese", rtl: false, fonts: ["Noto Sans JP", "Noto Sans CJK JP"] },
    Korean: { code: "ko", script: "Korean", rtl: false, fonts: ["Noto Sans KR", "Noto Sans CJK KR"] },
    Thai: { code: "th", script: "Thai", rtl: false, fonts: ["Noto Sans Thai"] }
  };
  function createReport(mirrored = false) {
    return {
      mirrored,
      entries: {
        "Auto Layout": { changed: 0, failed: 0, notes: [] },
        Frames: { changed: 0, failed: 0, notes: [] },
        "Nested layouts": { changed: 0, failed: 0, notes: [] },
        Groups: { changed: 0, failed: 0, notes: [] },
        Components: { changed: 0, failed: 0, notes: [] },
        Instances: { changed: 0, failed: 0, notes: [] },
        "Protected visuals": { changed: 0, failed: 0, notes: [] },
        "Directional icons": { changed: 0, failed: 0, notes: [] },
        "Text alignment": { changed: 0, failed: 0, notes: [] },
        Typography: { changed: 0, failed: 0, notes: [] }
      }
    };
  }
  function recordFailure(report, keys, node, cause) {
    const detail = `${node.name || node.type}: ${cause instanceof Error ? cause.message : String(cause)}`;
    for (const key of keys) {
      report.entries[key].failed += 1;
      if (report.entries[key].notes.length < 3) report.entries[key].notes.push(detail);
    }
  }
  function reportRows(report, translated, translationFailed, translationNotes) {
    const order = ["Auto Layout", "Frames", "Nested layouts", "Groups", "Components", "Instances", "Protected visuals", "Directional icons", "Text alignment", "Typography"];
    const rows = order.map((area) => {
      const entry = report.entries[area];
      const defaultNote = !report.mirrored && area !== "Instances" && area !== "Text alignment" ? "Already matched target direction" : "—";
      return { area, changed: entry.changed, failed: entry.failed, note: entry.notes.join(" · ") || defaultNote };
    });
    rows.push({ area: "Translation", changed: translated, failed: translationFailed, note: translationNotes.join(" · ") || "—" });
    return rows;
  }
  var activeReport = createReport();
  var cachedFonts = null;
  var fontMappingNotes = [];
  var includeHiddenLayers = false;
  var activeLoaders = [];
  var loaderTimer = null;
  var loaderDotPhase = 0;
  function solidPaint(r, g, b, opacity = 1) {
    return { type: "SOLID", color: { r, g, b }, opacity };
  }
  function hideLoadingOverlays() {
    if (loaderTimer != null) {
      clearInterval(loaderTimer);
      loaderTimer = null;
    }
    for (const loader of activeLoaders) {
      if (!loader.target.removed) loader.target.locked = loader.wasLocked;
      if (!loader.overlay.removed) loader.overlay.remove();
    }
    activeLoaders = [];
  }
  function showLoadingOverlays(targets) {
    hideLoadingOverlays();
    loaderDotPhase = 0;
    for (const target of targets) {
      const box = target.absoluteBoundingBox;
      if (box == null || box.width <= 0 || box.height <= 0) continue;
      const overlay = figma.createFrame();
      overlay.name = "Translation in progress";
      overlay.resize(box.width, box.height);
      overlay.x = box.x;
      overlay.y = box.y;
      overlay.fills = [solidPaint(0.07, 0.08, 0.1, 0.28)];
      overlay.clipsContent = true;
      const panelWidth = Math.min(80, Math.max(48, box.width - 16));
      const panelHeight = Math.min(40, Math.max(32, box.height - 16));
      const panel = figma.createFrame();
      overlay.appendChild(panel);
      panel.name = "Three-dot loader";
      panel.resize(panelWidth, panelHeight);
      panel.x = Math.max(0, (box.width - panelWidth) / 2);
      panel.y = Math.max(0, (box.height - panelHeight) / 2);
      panel.cornerRadius = panelHeight / 2;
      panel.fills = [solidPaint(1, 1, 1)];
      const dotSize = 8;
      const dotGap = 8;
      const dotsWidth = dotSize * 3 + dotGap * 2;
      const dotsX = (panelWidth - dotsWidth) / 2;
      const dotsY = (panelHeight - dotSize) / 2;
      const dots = [figma.createEllipse(), figma.createEllipse(), figma.createEllipse()];
      dots.forEach((dot, index) => {
        panel.appendChild(dot);
        dot.name = `Progress dot ${index + 1}`;
        dot.resize(dotSize, dotSize);
        dot.x = dotsX + index * (dotSize + dotGap);
        dot.y = dotsY;
        dot.fills = [solidPaint(0.2, 0.2, 0.24)];
        dot.opacity = index === 0 ? 1 : index === 1 ? 0.45 : 0.2;
      });
      const wasLocked = target.locked;
      target.locked = true;
      overlay.locked = true;
      activeLoaders.push({ overlay, dots, target, wasLocked });
    }
    if (activeLoaders.length > 0) {
      loaderTimer = setInterval(() => {
        for (const loader of activeLoaders) {
          loader.dots.forEach((dot, index) => {
            if (!dot.removed) {
              const distance = (index - loaderDotPhase + 3) % 3;
              dot.opacity = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.2;
            }
          });
        }
        loaderDotPhase = (loaderDotPhase + 1) % 3;
      }, 280);
    }
  }
  function topLevelSelection() {
    const selection = [...figma.currentPage.selection];
    const selectedIds = new Set(selection.map((node) => node.id));
    return selection.filter((node) => {
      let parent = node.parent;
      while (parent != null && parent.type !== "PAGE" && parent.type !== "DOCUMENT") {
        if (selectedIds.has(parent.id)) return false;
        parent = parent.parent;
      }
      return true;
    });
  }
  function normalizeParams(input) {
    const value = input == null ? void 0 : input.language;
    const language = value != null && Object.prototype.hasOwnProperty.call(LANGUAGE_PROFILES, value) ? value : "Arabic";
    const direction = (input == null ? void 0 : input.direction) === "RTL" || (input == null ? void 0 : input.direction) === "LTR" ? input.direction : "Auto";
    return { language, direction };
  }
  function readParams() {
    try {
      return normalizeParams(JSON.parse(figma.root.getPluginData(PARAMS_KEY)));
    } catch (e) {
      return DEFAULTS;
    }
  }
  function writeParams(params) {
    figma.root.setPluginData(PARAMS_KEY, JSON.stringify(params));
  }
  function escapeAttribute(value) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }
  function collectTextNodes(nodes = figma.currentPage.selection) {
    const found = /* @__PURE__ */ new Map();
    const visit = (node) => {
      if (!includeHiddenLayers && !node.visible) return;
      if (node.type === "TEXT") found.set(node.id, node);
      if ("children" in node) {
        for (const child of node.children) visit(child);
      }
    };
    for (const node of nodes) {
      if (includeHiddenLayers || isVisibleInTree(node)) visit(node);
    }
    return [...found.values()].filter((node) => node.characters.trim().length > 0);
  }
  function isVisibleInTree(node) {
    let current = node;
    while (current != null && current.type !== "PAGE" && current.type !== "DOCUMENT") {
      if ("visible" in current && !current.visible) return false;
      current = current.parent;
    }
    return true;
  }
  function resolveDirection(language, direction) {
    if (direction !== "Auto") return direction;
    return LANGUAGE_PROFILES[language].rtl ? "RTL" : "LTR";
  }
  function detectDirection(nodes) {
    var _a;
    let rtl = 0;
    let ltr = 0;
    for (const node of collectTextNodes(nodes)) {
      for (const character of node.characters) {
        const code = (_a = character.codePointAt(0)) != null ? _a : 0;
        if (code >= 1424 && code <= 2303 || code >= 64285 && code <= 65023 || code >= 65136 && code <= 65279) rtl += 1;
        else if (code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 192 && code <= 687 || code >= 1024 && code <= 1327 || code >= 2304 && code <= 3711 || code >= 12352 && code <= 12543 || code >= 13312 && code <= 40959 || code >= 44032 && code <= 55215) ltr += 1;
      }
    }
    return rtl > ltr ? "RTL" : "LTR";
  }
  function swapMinMax(value) {
    if (value === "MIN") return "MAX";
    if (value === "MAX") return "MIN";
    return value;
  }
  function setTextDirection(node, direction) {
    if (node.textAlignHorizontal === "CENTER" || node.textAlignHorizontal === "JUSTIFIED") return false;
    const next = direction === "RTL" ? "RIGHT" : "LEFT";
    if (node.textAlignHorizontal === next) return false;
    node.textAlignHorizontal = next;
    return true;
  }
  function containsText(node) {
    if (!("children" in node)) return false;
    return node.findOne((child) => child.type === "TEXT") != null;
  }
  function hasVisualFill(node) {
    if (!("fills" in node) || !Array.isArray(node.fills)) return false;
    return node.fills.some((fill) => fill.type === "IMAGE" || fill.type === "VIDEO");
  }
  function isProtectedVisual(node) {
    const name = node.name.toLowerCase().replace(/[_/\\.-]+/g, " ");
    const protectedMeaning = /\b(logo|wordmark|logomark|photo|photograph|avatar|flag|illustration|artwork|brandmark)\b/.test(name);
    const collectionMeaning = /\b(gallery|list|grid|section|container|row|column|collection)\b/.test(name);
    if (protectedMeaning && !collectionMeaning) return true;
    const directionalMeaning = /\b(arrow|chevron|caret|angle|back|forward|next|previous|prev|directional)\b/.test(name);
    if (directionalMeaning) return false;
    if (hasVisualFill(node)) return true;
    if (!("children" in node) || containsText(node) || collectionMeaning) return false;
    const vectorParts = node.findAll((child) => child.type === "VECTOR" || child.type === "BOOLEAN_OPERATION");
    if (node.width <= 64 && node.height <= 64 && vectorParts.length > 0) return true;
    const genericName = /^(group|frame|component|instance|icon|vector|path|shape)( \d+)?$/.test(name);
    if (genericName) return false;
    return vectorParts.length >= 3;
  }
  function isDirectionalIcon(node) {
    const supported = node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION" || node.type === "LINE" || node.type === "POLYGON" || node.type === "STAR" || node.type === "ELLIPSE" || node.type === "GROUP" || node.type === "FRAME" || node.type === "COMPONENT";
    if (!supported) return false;
    if (containsText(node)) return false;
    const name = node.name.toLowerCase().replace(/[_/\\.-]+/g, " ");
    const navigationMeaning = /\b(back|forward|next|previous|prev|directional)\b/.test(name);
    const directionalShape = /\b(arrow|chevron|caret|angle)\b/.test(name);
    const horizontalMeaning = /\b(left|right|start|end|back|forward|next|previous|prev)\b/.test(name);
    if (!(navigationMeaning || directionalShape && horizontalMeaning)) return false;
    if (node.type === "GROUP" || node.type === "FRAME" || node.type === "COMPONENT") {
      return /\b(icon|glyph|arrow|chevron|caret|angle)\b/.test(name);
    }
    return true;
  }
  function mirrorDirectionalIcon(node) {
    const transform = node.relativeTransform;
    const width = node.width;
    node.relativeTransform = [
      [-transform[0][0], transform[0][1], transform[0][0] * width + transform[0][2]],
      [-transform[1][0], transform[1][1], transform[1][0] * width + transform[1][2]]
    ];
  }
  function reverseChildren(container, children) {
    const automatic = children.filter((child) => (includeHiddenLayers || child.visible) && (!("layoutPositioning" in child) || child.layoutPositioning !== "ABSOLUTE")).reverse();
    let index = 0;
    const reordered = children.map((child) => {
      if (!includeHiddenLayers && !child.visible) return child;
      if ("layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE") return child;
      const replacement = automatic[index];
      index += 1;
      return replacement != null ? replacement : child;
    });
    reordered.forEach((child, childIndex) => container.insertChild(childIndex, child));
  }
  function mirrorFreeformChildren(container, children) {
    const width = container.width;
    let leftAnchor = null;
    let rightAnchor = null;
    if (container.type === "GROUP") {
      leftAnchor = figma.createRectangle();
      rightAnchor = figma.createRectangle();
      leftAnchor.resize(0.01, 0.01);
      rightAnchor.resize(0.01, 0.01);
      leftAnchor.opacity = 0;
      rightAnchor.opacity = 0;
      container.appendChild(leftAnchor);
      container.appendChild(rightAnchor);
      leftAnchor.x = 0;
      leftAnchor.y = 0;
      rightAnchor.x = Math.max(0, width - 0.01);
      rightAnchor.y = Math.max(0, container.height - 0.01);
    }
    const positions = children.map((child) => ({ child, x: width - child.x - child.width }));
    for (const position of positions) position.child.x = position.x;
    leftAnchor == null ? void 0 : leftAnchor.remove();
    rightAnchor == null ? void 0 : rightAnchor.remove();
  }
  function layoutReportKeys(node, depth) {
    const keys = [];
    if ("layoutMode" in node && node.layoutMode !== "NONE") keys.push("Auto Layout");
    if (node.type === "FRAME") keys.push("Frames");
    if (node.type === "GROUP") keys.push("Groups");
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") keys.push("Components");
    if (depth > 0 && "children" in node) keys.push("Nested layouts");
    return keys;
  }
  function adaptLayout(node, direction, shouldMirror, report, depth = 0) {
    if (!includeHiddenLayers && !node.visible) return;
    if (isProtectedVisual(node)) {
      report.entries["Protected visuals"].changed += 1;
      if (report.entries["Protected visuals"].notes.length === 0) report.entries["Protected visuals"].notes.push("Position may change; visual orientation preserved");
      return;
    }
    if (node.type === "TEXT") {
      try {
        if (setTextDirection(node, direction)) report.entries["Text alignment"].changed += 1;
      } catch (cause) {
        recordFailure(report, ["Text alignment"], node, cause);
      }
      return;
    }
    if (shouldMirror && isDirectionalIcon(node)) {
      try {
        mirrorDirectionalIcon(node);
        report.entries["Directional icons"].changed += 1;
      } catch (cause) {
        recordFailure(report, ["Directional icons"], node, cause);
      }
      return;
    }
    if (!("children" in node)) return;
    const allChildren = [...node.children];
    const children = allChildren.filter((child) => includeHiddenLayers || child.visible);
    const keys = layoutReportKeys(node, depth);
    if (shouldMirror && children.length > 0) {
      try {
        if ("layoutMode" in node) {
          const left = node.paddingLeft;
          node.paddingLeft = node.paddingRight;
          node.paddingRight = left;
          if (node.layoutMode === "HORIZONTAL") {
            reverseChildren(node, allChildren);
            if (node.primaryAxisAlignItems === "MIN" || node.primaryAxisAlignItems === "MAX" || node.primaryAxisAlignItems === "CENTER") {
              node.primaryAxisAlignItems = swapMinMax(node.primaryAxisAlignItems);
            }
            const absoluteChildren = children.filter((child) => "layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE");
            mirrorFreeformChildren(node, absoluteChildren);
          } else if (node.layoutMode === "VERTICAL") {
            if (node.counterAxisAlignItems !== "BASELINE") node.counterAxisAlignItems = swapMinMax(node.counterAxisAlignItems);
            const absoluteChildren = children.filter((child) => "layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE");
            mirrorFreeformChildren(node, absoluteChildren);
          } else if (node.layoutMode === "GRID") {
            if (!includeHiddenLayers && allChildren.some((child) => !child.visible)) {
              throw new Error("Grid column reversal skipped to preserve excluded hidden layers. Enable Include hidden layers to convert the entire grid.");
            }
            for (let insertionIndex = node.gridColumnCount; insertionIndex > 1; insertionIndex -= 1) {
              node.reorderColumns({ fromIndices: [0], insertionIndex });
            }
          } else {
            mirrorFreeformChildren(node, children);
          }
        } else {
          mirrorFreeformChildren(node, children);
        }
        for (const key of keys) report.entries[key].changed += 1;
      } catch (cause) {
        recordFailure(report, keys.length > 0 ? keys : ["Nested layouts"], node, cause);
      }
    }
    for (const child of children) adaptLayout(child, direction, shouldMirror, report, depth + 1);
  }
  function detachInstancesDeep(node, report) {
    if (!includeHiddenLayers && !node.visible) return node;
    let editable = node;
    if (editable.type === "INSTANCE") {
      try {
        editable = editable.detachInstance();
        report.entries.Instances.changed += 1;
      } catch (cause) {
        recordFailure(report, ["Instances"], editable, cause);
        return editable;
      }
    }
    if ("children" in editable) {
      for (const child of [...editable.children]) detachInstancesDeep(child, report);
    }
    return editable;
  }
  async function createPreviewCopies(direction, language) {
    const selection = topLevelSelection().filter((node) => includeHiddenLayers || isVisibleInTree(node));
    const sourceDirection = detectDirection(selection);
    const report = createReport(sourceDirection !== direction);
    const bounds = selection.map((node) => node.absoluteBoundingBox).filter((box) => box != null);
    const left = bounds.length > 0 ? Math.min(...bounds.map((box) => box.x)) : 0;
    const right = bounds.length > 0 ? Math.max(...bounds.map((box) => box.x + box.width)) : left;
    const offsetX = right - left + 80;
    const copies = selection.map((node) => {
      const box = node.absoluteBoundingBox;
      const cloned = node.clone();
      figma.currentPage.appendChild(cloned);
      const copy = detachInstancesDeep(cloned, report);
      copy.name = `${node.name} - ${direction} - ${language}`;
      if (box != null) {
        copy.x = box.x + offsetX;
        copy.y = box.y;
      } else {
        copy.x += offsetX;
      }
      adaptLayout(copy, direction, sourceDirection !== direction, report);
      copy.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
      return copy;
    });
    figma.currentPage.selection = copies;
    if (copies.length > 0) figma.viewport.scrollAndZoomIntoView(copies);
    return { copies, report };
  }
  function fontSupportsLanguage(family, language) {
    const name = family.toLowerCase();
    const script = LANGUAGE_PROFILES[language].script;
    if (script === "Latin") return true;
    if (script === "Cyrillic") return /cyrillic/.test(name) || ["roboto", "inter", "noto sans", "arial", "tahoma", "times new roman", "open sans"].includes(name);
    if (script === "Hebrew") return /hebrew|david|frank ruehl/.test(name) || name === "arial" || name === "tahoma";
    if (script === "Arabic") return /arabic|naskh|kufi|amiri|cairo|tajawal|almarai|scheherazade|geeza|damascus|al bayan|urdu|persian|nastaliq/.test(name) || name === "arial" || name === "tahoma";
    if (script === "Devanagari") return /devanagari|hindi|mangal|nirmala|aparajita|kokila|utsaah|sanskrit/.test(name);
    if (script === "Bengali") return /bengali|bangla|vrinda|shonar/.test(name);
    if (script === "Tamil") return /tamil|latha|vijaya/.test(name);
    if (script === "Telugu") return /telugu|gautami|vani/.test(name);
    if (script === "Simplified Chinese") return /simplified|hans|source han sans sc|noto sans (cjk )?sc|noto serif sc|pingfang sc|microsoft yahei|simhei|simsun|heiti sc/.test(name);
    if (script === "Traditional Chinese") return /traditional|hant|source han sans tc|noto sans (cjk )?tc|noto serif tc|pingfang tc|microsoft jhenghei/.test(name);
    if (script === "Japanese") return /japanese|noto sans (cjk )?jp|source han sans jp|hiragino|meiryo|yu gothic|ipa gothic/.test(name);
    if (script === "Korean") return /korean|noto sans (cjk )?kr|source han sans kr|malgun|nanum|apple sd gothic/.test(name);
    return /thai|leelawadee|sarabun|angsana|cordia|tahoma/.test(name);
  }
  function notoFamilies(language) {
    return LANGUAGE_PROFILES[language].fonts;
  }
  function mappedStyle(font) {
    const family = font.family.toLowerCase();
    const style = font.style.toLowerCase().replace(/[\s-]+/g, "");
    if (family === "roboto") {
      if (style === "regular") return "Regular";
      if (style === "medium") return "Medium";
      if (style === "bold") return "Bold";
    }
    if (family.startsWith("pp right grotesk")) {
      if (style === "widemedium" || family.includes("wide medium") && style === "medium") return "ExtraBold";
      if (style === "wideblack" || family.includes("wide black") && style === "black") return "Black";
    }
    return null;
  }
  async function automaticFont(original, language, nodeName) {
    const configuredStyle = mappedStyle(original);
    const requestedStyle = configuredStyle != null ? configuredStyle : "Regular";
    if (cachedFonts == null) cachedFonts = await figma.listAvailableFontsAsync();
    const normalize = (value) => value.toLowerCase().replace(/[\s-]+/g, "");
    const families = notoFamilies(language);
    const exact = cachedFonts.find((font) => families.includes(font.fontName.family) && normalize(font.fontName.style) === normalize(requestedStyle));
    if (exact != null) {
      if (configuredStyle == null) fontMappingNotes.push({ area: nodeName, changed: 1, failed: 0, note: `${original.family} ${original.style} has no configured mapping; used ${exact.fontName.family} Regular.` });
      return exact.fontName;
    }
    const regular = cachedFonts.find((font) => families.includes(font.fontName.family) && normalize(font.fontName.style) === "regular");
    if (regular == null) throw new Error(`${nodeName}: ${families.join(" / ")} Regular is unavailable. Text left unchanged; enable or install the required Noto font.`);
    fontMappingNotes.push({ area: nodeName, changed: 1, failed: 0, note: `${original.family} ${original.style} → ${regular.fontName.family} Regular: mapped ${requestedStyle} unavailable.` });
    return regular.fontName;
  }
  async function startTranslation(language, direction) {
    fontMappingNotes = [];
    const preview = await createPreviewCopies(direction, language);
    activeReport = preview.report;
    const nodes = collectTextNodes(preview.copies);
    const items = nodes.map((node) => ({ id: node.id, text: node.characters }));
    showLoadingOverlays(preview.copies);
    figma.ui.postMessage({ type: "translate-items", language, targetLanguageCode: LANGUAGE_PROFILES[language].code, direction, items });
  }
  async function replaceTextPreservingTypography(node, text, language) {
    const currentFonts = node.characters.length > 0 ? node.getRangeAllFontNames(0, node.characters.length) : [];
    await Promise.all(currentFonts.map((font) => figma.loadFontAsync(font)));
    const originalLength = node.characters.length;
    const segments = node.getStyledTextSegments(["fontName"]);
    const plans = [];
    for (const segment of segments) {
      const replacement = !fontSupportsLanguage(segment.fontName.family, language);
      const font = replacement ? await automaticFont(segment.fontName, language, node.name) : segment.fontName;
      await figma.loadFontAsync(font);
      plans.push({ segment, font, replacement });
    }
    for (let index = plans.length - 1; index >= 0; index -= 1) {
      const plan = plans[index];
      if (plan == null) continue;
      const start = Math.round(plan.segment.start / originalLength * text.length);
      const end = index === plans.length - 1 ? text.length : Math.round(plan.segment.end / originalLength * text.length);
      const piece = text.slice(start, end);
      if (piece.length > 0) node.insertCharacters(plan.segment.start, piece, "AFTER");
      node.deleteCharacters(plan.segment.start + piece.length, plan.segment.end + piece.length);
      if (piece.length > 0 && plan.replacement) node.setRangeFontName(plan.segment.start, plan.segment.start + piece.length, plan.font);
    }
    return plans.some((plan) => plan.replacement);
  }
  async function applyTranslations(language, direction, results) {
    let updated = 0;
    let skipped = 0;
    const translationNotes = [];
    for (const result of results) {
      if (result.error != null || result.text.length === 0) {
        skipped += 1;
        if (result.error != null && translationNotes.length < 3) translationNotes.push(result.error);
        continue;
      }
      const node = await figma.getNodeByIdAsync(result.id);
      if (node == null || node.type !== "TEXT" || node.removed) {
        skipped += 1;
        continue;
      }
      try {
        const fallbackApplied = result.preserved ? false : await replaceTextPreservingTypography(node, result.text, language);
        if (fallbackApplied) activeReport.entries.Typography.changed += 1;
        await Promise.all(node.getRangeAllFontNames(0, node.characters.length).map((font) => figma.loadFontAsync(font)));
        setTextDirection(node, direction);
        node.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
        updated += 1;
      } catch (cause) {
        skipped += 1;
        recordFailure(activeReport, ["Typography"], node, cause);
        if (translationNotes.length < 3) translationNotes.push(cause instanceof Error ? cause.message : String(cause));
      }
    }
    hideLoadingOverlays();
    if (updated === 0) {
      figma.notify("No text could be translated", { error: true });
    } else {
      const detail = skipped > 0 ? `; ${skipped} skipped` : "";
      figma.notify(`Created ${direction} preview with ${updated} translated text layer${updated === 1 ? "" : "s"}${detail}`);
    }
    figma.ui.postMessage({
      type: "complete",
      updated,
      skipped,
      fallbackApplied: activeReport.entries.Typography.changed > 0,
      fallbackFont: "automatic Noto mappings",
      direction,
      summary: [...reportRows(activeReport, updated, skipped, translationNotes).filter((row) => row.failed > 0), ...fontMappingNotes]
    });
  }
  var initialParams = readParams();
  var html = `<!doctype html>
<html>
<head>
  <script>
    try { window.localStorage.getItem('x') } catch (e) {
      const store = new Map()
      Object.defineProperty(window, 'localStorage', { value: {
        getItem: (k) => store.has(k) ? store.get(k) : null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
        key: (i) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size }
      }, configurable: true })
    }
  <\/script>
  <style>
    :root {
      color-scheme: dark;
      --panel: var(--figma-color-bg, #2c2c2c);
      --control: var(--figma-color-bg-secondary, #2c2c2c);
      --border: var(--figma-color-border, #484848);
      --text: var(--figma-color-text, #f5f5f5);
      --secondary: var(--figma-color-text-secondary, #b8b8b8);
      --accent: var(--figma-color-bg-brand, #0c8ce9);
      --danger: var(--figma-color-text-danger, #ff6b6b);
      font: 13px/1.4 Inter, "Helvetica Neue", Arial, sans-serif;
      color: var(--text);
      background: var(--panel);
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-width: 320px; margin: 0; padding: 0; background: var(--panel); color: var(--text); }
    body { overflow-x: hidden; }
    button, input, select { font: inherit; }
    #plugin-root { display: flex; flex-direction: column; width: 100%; min-height: 260px; }
    .plugin-content { padding: 16px 16px 12px; }
    .section-title { margin: 0 0 16px; font-size: 12px; line-height: 16px; font-weight: 600; letter-spacing: .01em; }
    .field-list { display: grid; gap: 8px; }
    .field-row { display: grid; grid-template-columns: minmax(108px, 1fr) minmax(0, 1.9fr); align-items: center; gap: 12px; min-width: 0; }
    .field-row label { color: var(--secondary); font-size: 12px; }
    .select-wrap { position: relative; min-width: 0; }
    .select-wrap::after { position: absolute; top: 15px; right: 14px; width: 7px; height: 7px; border-right: 2px solid var(--text); border-bottom: 2px solid var(--text); content: ""; pointer-events: none; transform: rotate(45deg); }
    select {
      display: block; width: 100%; height: 40px; padding: 0 36px 0 12px;
      appearance: none; color: var(--text); background: var(--control);
      border: 1px solid var(--border); border-radius: 7px; outline: none;
    }
    select:hover { border-color: color-mix(in srgb, var(--border), var(--text) 25%); }
    select:focus-visible, input:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    #message, #preview-note, #automatic-font-note, #font-status { color: var(--secondary); font-size: 11px; line-height: 16px; }
    #message { min-height: 16px; margin-top: 8px; }
    .checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: var(--secondary); font-size: 11px; line-height: 18px; cursor: pointer; }
    .checkbox-row input { width: 16px; height: 16px; flex: 0 0 16px; margin: 0; accent-color: var(--accent); }
    #preview-note { margin-top: 12px; }
    #automatic-font-note { margin-top: 8px; }
    #error { display: none; margin-top: 8px; color: var(--danger); font-size: 11px; line-height: 16px; }
    #font-status { display: none; margin-top: 8px; }
    #summary { display: none; margin-top: 12px; }
    #summary-title { margin-bottom: 6px; font-size: 11px; line-height: 16px; font-weight: 600; }
    .summary-scroll { max-height: 180px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; line-height: 14px; }
    th, td { padding: 6px; border: 1px solid var(--border); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { color: var(--secondary); font-weight: 600; }
    th:nth-child(1), td:nth-child(1) { width: 24%; }
    th:nth-child(2), td:nth-child(2) { width: 13%; text-align: center; }
    .plugin-footer { position: sticky; bottom: 0; display: flex; justify-content: flex-end; padding: 12px; border-top: 1px solid var(--border); background: var(--panel); }
    #translate { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; max-width: 100%; padding: 0 14px; border: 0; border-radius: 7px; color: #fff; background: var(--accent); font-weight: 500; cursor: pointer; }
    #translate:hover:not(:disabled) { filter: brightness(1.08); }
    #translate:disabled { color: var(--secondary); background: var(--figma-color-bg-disabled, #444); cursor: default; }
    #translate[data-busy="true"]::before { width: 13px; height: 13px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; content: ""; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 360px) {
      .plugin-content { padding-right: 12px; padding-left: 12px; }
      .field-row { grid-template-columns: minmax(90px, .8fr) minmax(0, 1.2fr); gap: 8px; }
    }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; } }
  </style>
</head>
<body>
  <div id="plugin-root">
    <main class="plugin-content">
      <h1 class="section-title">Translation</h1>
      <div class="field-list">
        <div class="field-row">
          <label for="language">Translate to</label>
          <div class="select-wrap">
            <select id="language" value="Arabic" aria-label="Translate to">
              <optgroup label="LTR · Latin">
                <option value="English">English</option><option value="French">French</option>
                <option value="German">German</option><option value="Spanish">Spanish</option>
              </optgroup>
              <optgroup label="RTL">
                <option value="Arabic" selected>Arabic</option><option value="Hebrew">Hebrew</option>
                <option value="Persian">Persian</option><option value="Urdu">Urdu</option>
              </optgroup>
              <optgroup label="LTR · Cyrillic">
                <option value="Russian">Russian</option><option value="Ukrainian">Ukrainian</option><option value="Bulgarian">Bulgarian</option>
              </optgroup>
              <optgroup label="LTR · Indic">
                <option value="Hindi">Hindi</option><option value="Bengali">Bengali</option>
                <option value="Tamil">Tamil</option><option value="Telugu">Telugu</option>
              </optgroup>
              <optgroup label="LTR · CJK">
                <option value="Chinese Simplified">Chinese Simplified</option><option value="Chinese Traditional">Chinese Traditional</option>
                <option value="Japanese">Japanese</option><option value="Korean">Korean</option>
              </optgroup>
              <optgroup label="LTR · Other"><option value="Thai">Thai</option></optgroup>
            </select>
          </div>
        </div>
        <div class="field-row">
          <label for="direction">Layout direction</label>
          <div class="select-wrap">
            <select id="direction" value="Auto" aria-label="Layout direction">
              <option value="Auto" selected>Auto from language</option>
              <option value="RTL">Right to left</option>
              <option value="LTR">Left to right</option>
            </select>
          </div>
        </div>
      </div>
      <div id="message" aria-live="polite">Select text layers or a container with text.</div>
      <label class="checkbox-row" for="include-hidden">
        <input id="include-hidden" type="checkbox"><span>Include hidden layers</span>
      </label>
      <div id="preview-note">Creates an editable duplicate and adapts nested Auto Layout, frames, groups, components, and instances. Originals stay untouched.</div>
      <div id="automatic-font-note">Unsupported fonts are replaced automatically using language-specific Noto families and configured weights.</div>
      <div id="error" role="alert"></div>
      <div id="font-status" aria-live="polite"></div>
      <section id="summary" aria-live="polite">
        <div id="summary-title">Conversion issues &amp; exceptions</div>
        <div class="summary-scroll">
          <table>
            <thead><tr><th>Area / text</th><th>Issues</th><th>What didn’t work</th></tr></thead>
            <tbody id="summary-body"></tbody>
          </table>
        </div>
      </section>
    </main>
    <footer class="plugin-footer">
      <button id="translate" type="button" disabled>Create translated preview</button>
    </footer>
  </div>
  <script>
    const button = document.getElementById('translate')
    const language = document.getElementById('language')
    const direction = document.getElementById('direction')
    const includeHidden = document.getElementById('include-hidden')
    const message = document.getElementById('message')
    const error = document.getElementById('error')
    const fontStatus = document.getElementById('font-status')
    const summary = document.getElementById('summary')
    const summaryBody = document.getElementById('summary-body')
    language.value = language.getAttribute('value') || language.value
    direction.value = direction.getAttribute('value') || direction.value
    const ISO_CURRENCY_CODES = new Set('AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWL'.split(' '))

    function isStandaloneCurrencyCode(text) {
      const value = String(text).trim()
      return /^[A-Z]{3}$/.test(value) && ISO_CURRENCY_CODES.has(value)
    }

    function post(payload) {
      parent.postMessage({ pluginMessage: payload }, '*')
    }

    function setBusy(busy) {
      includeHidden.disabled = busy
      button.dataset.busy = String(busy)
      if (busy) button.setAttribute('disabled', '')
      else button.removeAttribute('disabled')
      button.textContent = busy ? 'Creating preview…' : 'Create translated preview'
    }

    function chunks(text, maxLength) {
      const output = []
      let remaining = text
      while (remaining.length > maxLength) {
        let cut = remaining.lastIndexOf(' ', maxLength)
        if (cut < maxLength * 0.6) cut = maxLength
        output.push(remaining.slice(0, cut))
        remaining = remaining.slice(cut)
      }
      if (remaining) output.push(remaining)
      return output
    }

    async function translateText(text, target) {
      const translated = []
      for (const part of chunks(text, 4000)) {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
          encodeURIComponent(target) + '&dt=t&q=' + encodeURIComponent(part)
        const response = await fetch(url)
        if (!response.ok) throw new Error('Translation service returned ' + response.status)
        const data = await response.json()
        const value = Array.isArray(data[0]) ? data[0].map((segment) => segment[0] || '').join('') : ''
        if (!value) throw new Error('No translation returned')
        translated.push(value)
      }
      return translated.join('')
    }

    button.addEventListener('click', () => {
      error.style.display = 'none'
      fontStatus.style.display = 'none'
      summary.style.display = 'none'
      summaryBody.replaceChildren()
      setBusy(true)
      post({ type: 'translate', language: String(language.value), direction: String(direction.value), includeHidden: includeHidden.checked })
    })

    includeHidden.addEventListener('change', () => post({ type: 'include-hidden', includeHidden: includeHidden.checked }))

    window.onmessage = async (event) => {
      const msg = event.data && event.data.pluginMessage
      if (!msg) return
      if (msg.type === 'selection-state') {
        const count = Number(msg.count) || 0
        message.textContent = count > 0 ? count + ' text layer' + (count === 1 ? '' : 's') + ' selected' : 'Select text layers or a container with text.'
        if (count > 0) button.removeAttribute('disabled')
        else button.setAttribute('disabled', '')
        return
      }
      if (msg.type === 'translate-items') {
        const target = msg.targetLanguageCode
        const results = []
        for (const item of msg.items) {
          if (isStandaloneCurrencyCode(item.text)) {
            results.push({ id: item.id, text: item.text, preserved: true })
            continue
          }
          try {
            results.push({ id: item.id, text: await translateText(item.text, target) })
          } catch (cause) {
            results.push({ id: item.id, text: '', error: cause instanceof Error ? cause.message : String(cause) })
          }
        }
        post({ type: 'translation-results', language: msg.language, direction: msg.direction, results })
        return
      }
      if (msg.type === 'complete') {
        setBusy(false)
        if (Array.isArray(msg.summary) && msg.summary.length > 0) {
          for (const row of msg.summary) {
            const tr = document.createElement('tr')
            for (const value of [row.area, row.failed || row.changed, row.note]) {
              const td = document.createElement('td')
              td.textContent = String(value)
              tr.appendChild(td)
            }
            summaryBody.appendChild(tr)
          }
          summary.style.display = 'block'
        }
        if (msg.updated === 0) {
          error.textContent = 'Translation failed. Check your connection and try again.'
          error.style.display = 'block'
        } else if (!Array.isArray(msg.summary) || msg.summary.length === 0) {
          fontStatus.textContent = 'No conversion issues reported.'
          fontStatus.style.display = 'block'
        }
      }
    }

    const root = document.getElementById('plugin-root')
    if (root && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => post({ type: 'resize', height: Math.ceil(root.getBoundingClientRect().height) })).observe(root)
    }
  <\/script>
</body>
</html>
`;
  html = html.replace(/(id="language"[^>]*\bvalue=")[^"]*(")/, "$1" + escapeAttribute(initialParams.language) + "$2");
  html = html.replace(/(id="direction"[^>]*\bvalue=")[^"]*(")/, "$1" + escapeAttribute(initialParams.direction) + "$2");
  figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME });
  figma.showUI(html, { width: 420, height: 520 });
  function sendSelectionState() {
    const count = collectTextNodes().length;
    figma.ui.postMessage({ type: "selection-state", count });
  }
  sendSelectionState();
  figma.on("selectionchange", sendSelectionState);
  figma.ui.onmessage = async (message) => {
    if (message.type === "include-hidden") {
      includeHiddenLayers = message.includeHidden === true;
      sendSelectionState();
      return;
    }
    if (message.type === "resize") {
      figma.ui.resize(420, Math.max(260, Math.min(760, Math.round(message.height))));
      return;
    }
    if (message.type === "translate") {
      includeHiddenLayers = message.includeHidden === true;
      const params = normalizeParams({ language: message.language, direction: message.direction });
      const direction = resolveDirection(params.language, params.direction);
      writeParams(params);
      const sourceNodes = collectTextNodes();
      if (sourceNodes.length === 0) {
        figma.notify("Select text layers or a container with text", { error: true });
        figma.ui.postMessage({ type: "complete", updated: 0, skipped: 0, fallbackApplied: false, fallbackFont: null, direction, summary: [] });
        return;
      }
      await startTranslation(params.language, direction);
      return;
    }
    if (message.type === "translation-results") {
      await applyTranslations(message.language, message.direction, message.results);
    }
  };
})();

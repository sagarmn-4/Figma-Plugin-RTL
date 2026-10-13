type Language = 'English' | 'French' | 'German' | 'Spanish' | 'Arabic' | 'Hebrew' | 'Persian' | 'Urdu' | 'Russian' | 'Ukrainian' | 'Bulgarian' | 'Hindi' | 'Bengali' | 'Tamil' | 'Telugu' | 'Chinese Simplified' | 'Chinese Traditional' | 'Japanese' | 'Korean' | 'Thai'
type DirectionChoice = 'Auto' | 'RTL' | 'LTR'
type ResolvedDirection = 'RTL' | 'LTR'
type Params = { language: Language; direction: DirectionChoice }
type TranslationItem = { id: string; text: string }
type TranslationResult = { id: string; text: string; error?: string; preserved?: boolean }
type ActiveLoader = { overlay: FrameNode; dots: [EllipseNode, EllipseNode, EllipseNode]; target: SceneNode; wasLocked: boolean }
type ReportKey = 'Auto Layout' | 'Frames' | 'Nested layouts' | 'Groups' | 'Components' | 'Instances' | 'Protected visuals' | 'Directional icons' | 'Text alignment' | 'Typography'
type ReportEntry = { changed: number; failed: number; notes: string[] }
type ConversionReport = { mirrored: boolean; entries: Record<ReportKey, ReportEntry> }
type SummaryRow = { area: string; changed: number; failed: number; note: string }
type UiMessage =
  | { type: 'translate'; language: Language; direction: DirectionChoice; includeHidden?: boolean }
  | { type: 'include-hidden'; includeHidden: boolean }
  | { type: 'translation-results'; language: Language; direction: ResolvedDirection; results: TranslationResult[] }
  | { type: 'resize'; height: number }

const TOOL_ID = 'a14e05fc-3359-442e-9517-a207dd14633d'
const DISPLAY_NAME = 'RTL - V2.0 — Create translated RTL/LTR preview'
const PARAMS_KEY = TOOL_ID + ':params'
const DEFAULTS: Params = { language: 'Arabic', direction: 'Auto' }
type Script = 'Latin' | 'Arabic' | 'Hebrew' | 'Cyrillic' | 'Devanagari' | 'Bengali' | 'Tamil' | 'Telugu' | 'Simplified Chinese' | 'Traditional Chinese' | 'Japanese' | 'Korean' | 'Thai'
const LANGUAGE_PROFILES: Record<Language, { code: string; script: Script; rtl: boolean; fonts: string[] }> = {
  English: { code: 'en', script: 'Latin', rtl: false, fonts: ['Noto Sans'] },
  French: { code: 'fr', script: 'Latin', rtl: false, fonts: ['Noto Sans'] },
  German: { code: 'de', script: 'Latin', rtl: false, fonts: ['Noto Sans'] },
  Spanish: { code: 'es', script: 'Latin', rtl: false, fonts: ['Noto Sans'] },
  Arabic: { code: 'ar', script: 'Arabic', rtl: true, fonts: ['Noto Sans Arabic'] },
  Hebrew: { code: 'he', script: 'Hebrew', rtl: true, fonts: ['Noto Sans Hebrew'] },
  Persian: { code: 'fa', script: 'Arabic', rtl: true, fonts: ['Noto Sans Arabic'] },
  Urdu: { code: 'ur', script: 'Arabic', rtl: true, fonts: ['Noto Sans Arabic'] },
  Russian: { code: 'ru', script: 'Cyrillic', rtl: false, fonts: ['Noto Sans'] },
  Ukrainian: { code: 'uk', script: 'Cyrillic', rtl: false, fonts: ['Noto Sans'] },
  Bulgarian: { code: 'bg', script: 'Cyrillic', rtl: false, fonts: ['Noto Sans'] },
  Hindi: { code: 'hi', script: 'Devanagari', rtl: false, fonts: ['Noto Sans Devanagari'] },
  Bengali: { code: 'bn', script: 'Bengali', rtl: false, fonts: ['Noto Sans Bengali'] },
  Tamil: { code: 'ta', script: 'Tamil', rtl: false, fonts: ['Noto Sans Tamil'] },
  Telugu: { code: 'te', script: 'Telugu', rtl: false, fonts: ['Noto Sans Telugu'] },
  'Chinese Simplified': { code: 'zh-CN', script: 'Simplified Chinese', rtl: false, fonts: ['Noto Sans SC', 'Noto Sans CJK SC'] },
  'Chinese Traditional': { code: 'zh-TW', script: 'Traditional Chinese', rtl: false, fonts: ['Noto Sans TC', 'Noto Sans CJK TC'] },
  Japanese: { code: 'ja', script: 'Japanese', rtl: false, fonts: ['Noto Sans JP', 'Noto Sans CJK JP'] },
  Korean: { code: 'ko', script: 'Korean', rtl: false, fonts: ['Noto Sans KR', 'Noto Sans CJK KR'] },
  Thai: { code: 'th', script: 'Thai', rtl: false, fonts: ['Noto Sans Thai'] }
}

function createReport(mirrored = false): ConversionReport {
  return {
    mirrored,
    entries: {
      'Auto Layout': { changed: 0, failed: 0, notes: [] },
      Frames: { changed: 0, failed: 0, notes: [] },
      'Nested layouts': { changed: 0, failed: 0, notes: [] },
      Groups: { changed: 0, failed: 0, notes: [] },
      Components: { changed: 0, failed: 0, notes: [] },
      Instances: { changed: 0, failed: 0, notes: [] },
      'Protected visuals': { changed: 0, failed: 0, notes: [] },
      'Directional icons': { changed: 0, failed: 0, notes: [] },
      'Text alignment': { changed: 0, failed: 0, notes: [] },
      Typography: { changed: 0, failed: 0, notes: [] }
    }
  }
}

function recordFailure(report: ConversionReport, keys: readonly ReportKey[], node: SceneNode, cause: unknown): void {
  const detail = `${node.name || node.type}: ${cause instanceof Error ? cause.message : String(cause)}`
  for (const key of keys) {
    report.entries[key].failed += 1
    if (report.entries[key].notes.length < 3) report.entries[key].notes.push(detail)
  }
}

function reportRows(report: ConversionReport, translated: number, translationFailed: number, translationNotes: string[]): SummaryRow[] {
  const order: ReportKey[] = ['Auto Layout', 'Frames', 'Nested layouts', 'Groups', 'Components', 'Instances', 'Protected visuals', 'Directional icons', 'Text alignment', 'Typography']
  const rows: SummaryRow[] = order.map((area) => {
    const entry = report.entries[area]
    const defaultNote = !report.mirrored && area !== 'Instances' && area !== 'Text alignment' ? 'Already matched target direction' : '—'
    return { area, changed: entry.changed, failed: entry.failed, note: entry.notes.join(' · ') || defaultNote }
  })
  rows.push({ area: 'Translation', changed: translated, failed: translationFailed, note: translationNotes.join(' · ') || '—' })
  return rows
}

let activeReport = createReport()
let cachedFonts: Font[] | null = null
let fontMappingNotes: SummaryRow[] = []
let includeHiddenLayers = false
let activeLoaders: ActiveLoader[] = []
let loaderTimer: number | null = null
let loaderDotPhase = 0

function solidPaint(r: number, g: number, b: number, opacity = 1): SolidPaint {
  return { type: 'SOLID', color: { r, g, b }, opacity }
}

function hideLoadingOverlays(): void {
  if (loaderTimer != null) {
    clearInterval(loaderTimer)
    loaderTimer = null
  }
  for (const loader of activeLoaders) {
    if (!loader.target.removed) loader.target.locked = loader.wasLocked
    if (!loader.overlay.removed) loader.overlay.remove()
  }
  activeLoaders = []
}

function showLoadingOverlays(targets: readonly SceneNode[]): void {
  hideLoadingOverlays()
  loaderDotPhase = 0
  for (const target of targets) {
    const box = target.absoluteBoundingBox
    if (box == null || box.width <= 0 || box.height <= 0) continue
    const overlay = figma.createFrame()
    overlay.name = 'Translation in progress'
    overlay.resize(box.width, box.height)
    overlay.x = box.x
    overlay.y = box.y
    overlay.fills = [solidPaint(0.07, 0.08, 0.1, 0.28)]
    overlay.clipsContent = true

    const panelWidth = Math.min(80, Math.max(48, box.width - 16))
    const panelHeight = Math.min(40, Math.max(32, box.height - 16))
    const panel = figma.createFrame()
    overlay.appendChild(panel)
    panel.name = 'Three-dot loader'
    panel.resize(panelWidth, panelHeight)
    panel.x = Math.max(0, (box.width - panelWidth) / 2)
    panel.y = Math.max(0, (box.height - panelHeight) / 2)
    panel.cornerRadius = panelHeight / 2
    panel.fills = [solidPaint(1, 1, 1)]

    const dotSize = 8
    const dotGap = 8
    const dotsWidth = dotSize * 3 + dotGap * 2
    const dotsX = (panelWidth - dotsWidth) / 2
    const dotsY = (panelHeight - dotSize) / 2
    const dots: [EllipseNode, EllipseNode, EllipseNode] = [figma.createEllipse(), figma.createEllipse(), figma.createEllipse()]
    dots.forEach((dot, index) => {
      panel.appendChild(dot)
      dot.name = `Progress dot ${index + 1}`
      dot.resize(dotSize, dotSize)
      dot.x = dotsX + index * (dotSize + dotGap)
      dot.y = dotsY
      dot.fills = [solidPaint(0.2, 0.2, 0.24)]
      dot.opacity = index === 0 ? 1 : index === 1 ? 0.45 : 0.2
    })

    const wasLocked = target.locked
    target.locked = true
    overlay.locked = true
    activeLoaders.push({ overlay, dots, target, wasLocked })
  }
  if (activeLoaders.length > 0) {
    loaderTimer = setInterval(() => {
      for (const loader of activeLoaders) {
        loader.dots.forEach((dot, index) => {
          if (!dot.removed) {
            const distance = (index - loaderDotPhase + 3) % 3
            dot.opacity = distance === 0 ? 1 : distance === 1 ? 0.45 : 0.2
          }
        })
      }
      loaderDotPhase = (loaderDotPhase + 1) % 3
    }, 280)
  }
}

function topLevelSelection(): SceneNode[] {
  const selection = [...figma.currentPage.selection]
  const selectedIds = new Set(selection.map((node) => node.id))
  return selection.filter((node) => {
    let parent = node.parent
    while (parent != null && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
      if (selectedIds.has(parent.id)) return false
      parent = parent.parent
    }
    return true
  })
}

function normalizeParams(input: Partial<Params> | null | undefined): Params {
  const value = input?.language
  const language: Language = value != null && Object.prototype.hasOwnProperty.call(LANGUAGE_PROFILES, value) ? value : 'Arabic'
  const direction: DirectionChoice = input?.direction === 'RTL' || input?.direction === 'LTR' ? input.direction : 'Auto'
  return { language, direction }
}

function readParams(): Params {
  try {
    return normalizeParams(JSON.parse(figma.root.getPluginData(PARAMS_KEY)) as Partial<Params>)
  } catch {
    return DEFAULTS
  }
}

function writeParams(params: Params): void {
  figma.root.setPluginData(PARAMS_KEY, JSON.stringify(params))
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function collectTextNodes(nodes: readonly SceneNode[] = figma.currentPage.selection): TextNode[] {
  const found = new Map<string, TextNode>()
  const visit = (node: SceneNode): void => {
    if (!includeHiddenLayers && !node.visible) return
    if (node.type === 'TEXT') found.set(node.id, node)
    if ('children' in node) {
      for (const child of node.children) visit(child)
    }
  }
  for (const node of nodes) {
    if (includeHiddenLayers || isVisibleInTree(node)) visit(node)
  }
  return [...found.values()].filter((node) => node.characters.trim().length > 0)
}

function isVisibleInTree(node: SceneNode): boolean {
  let current: BaseNode | null = node
  while (current != null && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    if ('visible' in current && !current.visible) return false
    current = current.parent
  }
  return true
}

function resolveDirection(language: Language, direction: DirectionChoice): ResolvedDirection {
  if (direction !== 'Auto') return direction
  return LANGUAGE_PROFILES[language].rtl ? 'RTL' : 'LTR'
}

function detectDirection(nodes: readonly SceneNode[]): ResolvedDirection {
  let rtl = 0
  let ltr = 0
  for (const node of collectTextNodes(nodes)) {
    for (const character of node.characters) {
      const code = character.codePointAt(0) ?? 0
      if ((code >= 0x0590 && code <= 0x08ff) || (code >= 0xfb1d && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff)) rtl += 1
      else if ((code >= 0x0041 && code <= 0x005a) || (code >= 0x0061 && code <= 0x007a) || (code >= 0x00c0 && code <= 0x02af) || (code >= 0x0400 && code <= 0x052f) || (code >= 0x0900 && code <= 0x0e7f) || (code >= 0x3040 && code <= 0x30ff) || (code >= 0x3400 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af)) ltr += 1
    }
  }
  return rtl > ltr ? 'RTL' : 'LTR'
}

function swapMinMax(value: 'MIN' | 'MAX' | 'CENTER'): 'MIN' | 'MAX' | 'CENTER' {
  if (value === 'MIN') return 'MAX'
  if (value === 'MAX') return 'MIN'
  return value
}

function setTextDirection(node: TextNode, direction: ResolvedDirection): boolean {
  if (node.textAlignHorizontal === 'CENTER' || node.textAlignHorizontal === 'JUSTIFIED') return false
  const next = direction === 'RTL' ? 'RIGHT' : 'LEFT'
  if (node.textAlignHorizontal === next) return false
  node.textAlignHorizontal = next
  return true
}

function containsText(node: SceneNode): boolean {
  if (!('children' in node)) return false
  return node.findOne((child) => child.type === 'TEXT') != null
}

function hasVisualFill(node: SceneNode): boolean {
  if (!('fills' in node) || !Array.isArray(node.fills)) return false
  return node.fills.some((fill) => fill.type === 'IMAGE' || fill.type === 'VIDEO')
}

function isProtectedVisual(node: SceneNode): boolean {
  const name = node.name.toLowerCase().replace(/[_/\\.-]+/g, ' ')
  const protectedMeaning = /\b(logo|wordmark|logomark|photo|photograph|avatar|flag|illustration|artwork|brandmark)\b/.test(name)
  const collectionMeaning = /\b(gallery|list|grid|section|container|row|column|collection)\b/.test(name)
  if (protectedMeaning && !collectionMeaning) return true
  const directionalMeaning = /\b(arrow|chevron|caret|angle|back|forward|next|previous|prev|directional)\b/.test(name)
  if (directionalMeaning) return false
  if (hasVisualFill(node)) return true
  if (!('children' in node) || containsText(node) || collectionMeaning) return false
  const vectorParts = node.findAll((child) => child.type === 'VECTOR' || child.type === 'BOOLEAN_OPERATION')
  if (node.width <= 64 && node.height <= 64 && vectorParts.length > 0) return true
  const genericName = /^(group|frame|component|instance|icon|vector|path|shape)( \d+)?$/.test(name)
  if (genericName) return false
  return vectorParts.length >= 3
}

function isDirectionalIcon(node: SceneNode): boolean {
  const supported = node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'LINE' || node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'ELLIPSE' || node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT'
  if (!supported) return false
  if (containsText(node)) return false
  const name = node.name.toLowerCase().replace(/[_/\\.-]+/g, ' ')
  const navigationMeaning = /\b(back|forward|next|previous|prev|directional)\b/.test(name)
  const directionalShape = /\b(arrow|chevron|caret|angle)\b/.test(name)
  const horizontalMeaning = /\b(left|right|start|end|back|forward|next|previous|prev)\b/.test(name)
  if (!(navigationMeaning || (directionalShape && horizontalMeaning))) return false
  if (node.type === 'GROUP' || node.type === 'FRAME' || node.type === 'COMPONENT') {
    return /\b(icon|glyph|arrow|chevron|caret|angle)\b/.test(name)
  }
  return true
}

function mirrorDirectionalIcon(node: SceneNode): void {
  const transform = node.relativeTransform
  const width = node.width
  node.relativeTransform = [
    [-transform[0][0], transform[0][1], transform[0][0] * width + transform[0][2]],
    [-transform[1][0], transform[1][1], transform[1][0] * width + transform[1][2]]
  ]
}

function reverseChildren(container: ChildrenMixin, children: readonly SceneNode[]): void {
  const automatic = children.filter((child) => (includeHiddenLayers || child.visible) && (!('layoutPositioning' in child) || child.layoutPositioning !== 'ABSOLUTE')).reverse()
  let index = 0
  const reordered = children.map((child) => {
    if (!includeHiddenLayers && !child.visible) return child
    if ('layoutPositioning' in child && child.layoutPositioning === 'ABSOLUTE') return child
    const replacement = automatic[index]
    index += 1
    return replacement ?? child
  })
  reordered.forEach((child, childIndex) => container.insertChild(childIndex, child))
}

function mirrorFreeformChildren(container: SceneNode & ChildrenMixin, children: readonly SceneNode[]): void {
  const width = container.width
  let leftAnchor: RectangleNode | null = null
  let rightAnchor: RectangleNode | null = null
  if (container.type === 'GROUP') {
    leftAnchor = figma.createRectangle()
    rightAnchor = figma.createRectangle()
    leftAnchor.resize(0.01, 0.01)
    rightAnchor.resize(0.01, 0.01)
    leftAnchor.opacity = 0
    rightAnchor.opacity = 0
    container.appendChild(leftAnchor)
    container.appendChild(rightAnchor)
    leftAnchor.x = 0
    leftAnchor.y = 0
    rightAnchor.x = Math.max(0, width - 0.01)
    rightAnchor.y = Math.max(0, container.height - 0.01)
  }
  const positions = children.map((child) => ({ child, x: width - child.x - child.width }))
  for (const position of positions) position.child.x = position.x
  leftAnchor?.remove()
  rightAnchor?.remove()
}

function layoutReportKeys(node: SceneNode, depth: number): ReportKey[] {
  const keys: ReportKey[] = []
  if ('layoutMode' in node && node.layoutMode !== 'NONE') keys.push('Auto Layout')
  if (node.type === 'FRAME') keys.push('Frames')
  if (node.type === 'GROUP') keys.push('Groups')
  if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') keys.push('Components')
  if (depth > 0 && 'children' in node) keys.push('Nested layouts')
  return keys
}

function adaptLayout(node: SceneNode, direction: ResolvedDirection, shouldMirror: boolean, report: ConversionReport, depth = 0): void {
  if (!includeHiddenLayers && !node.visible) return
  if (isProtectedVisual(node)) {
    report.entries['Protected visuals'].changed += 1
    if (report.entries['Protected visuals'].notes.length === 0) report.entries['Protected visuals'].notes.push('Position may change; visual orientation preserved')
    return
  }
  if (node.type === 'TEXT') {
    try {
      if (setTextDirection(node, direction)) report.entries['Text alignment'].changed += 1
    } catch (cause) {
      recordFailure(report, ['Text alignment'], node, cause)
    }
    return
  }
  if (shouldMirror && isDirectionalIcon(node)) {
    try {
      mirrorDirectionalIcon(node)
      report.entries['Directional icons'].changed += 1
    } catch (cause) {
      recordFailure(report, ['Directional icons'], node, cause)
    }
    return
  }
  if (!('children' in node)) return

  const allChildren = [...node.children]
  const children = allChildren.filter((child) => includeHiddenLayers || child.visible)
  const keys = layoutReportKeys(node, depth)
  if (shouldMirror && children.length > 0) {
    try {
      if ('layoutMode' in node) {
        const left = node.paddingLeft
        node.paddingLeft = node.paddingRight
        node.paddingRight = left
        if (node.layoutMode === 'HORIZONTAL') {
          reverseChildren(node, allChildren)
          if (node.primaryAxisAlignItems === 'MIN' || node.primaryAxisAlignItems === 'MAX' || node.primaryAxisAlignItems === 'CENTER') {
            node.primaryAxisAlignItems = swapMinMax(node.primaryAxisAlignItems)
          }
          const absoluteChildren = children.filter((child) => 'layoutPositioning' in child && child.layoutPositioning === 'ABSOLUTE')
          mirrorFreeformChildren(node, absoluteChildren)
        } else if (node.layoutMode === 'VERTICAL') {
          if (node.counterAxisAlignItems !== 'BASELINE') node.counterAxisAlignItems = swapMinMax(node.counterAxisAlignItems)
          const absoluteChildren = children.filter((child) => 'layoutPositioning' in child && child.layoutPositioning === 'ABSOLUTE')
          mirrorFreeformChildren(node, absoluteChildren)
        } else if (node.layoutMode === 'GRID') {
          if (!includeHiddenLayers && allChildren.some((child) => !child.visible)) {
            throw new Error('Grid column reversal skipped to preserve excluded hidden layers. Enable Include hidden layers to convert the entire grid.')
          }
          for (let insertionIndex = node.gridColumnCount; insertionIndex > 1; insertionIndex -= 1) {
            node.reorderColumns({ fromIndices: [0], insertionIndex })
          }
        } else {
          mirrorFreeformChildren(node, children)
        }
      } else {
        mirrorFreeformChildren(node, children)
      }
      for (const key of keys) report.entries[key].changed += 1
    } catch (cause) {
      recordFailure(report, keys.length > 0 ? keys : ['Nested layouts'], node, cause)
    }
  }

  for (const child of children) adaptLayout(child, direction, shouldMirror, report, depth + 1)
}

function detachInstancesDeep(node: SceneNode, report: ConversionReport): SceneNode {
  if (!includeHiddenLayers && !node.visible) return node
  let editable = node
  if (editable.type === 'INSTANCE') {
    try {
      editable = editable.detachInstance()
      report.entries.Instances.changed += 1
    } catch (cause) {
      recordFailure(report, ['Instances'], editable, cause)
      return editable
    }
  }
  if ('children' in editable) {
    for (const child of [...editable.children]) detachInstancesDeep(child, report)
  }
  return editable
}

async function createPreviewCopies(direction: ResolvedDirection, language: Language): Promise<{ copies: SceneNode[]; report: ConversionReport }> {
  const selection = topLevelSelection().filter((node) => includeHiddenLayers || isVisibleInTree(node))
  const sourceDirection = detectDirection(selection)
  const report = createReport(sourceDirection !== direction)
  const bounds = selection.map((node) => node.absoluteBoundingBox).filter((box): box is Rect => box != null)
  const left = bounds.length > 0 ? Math.min(...bounds.map((box) => box.x)) : 0
  const right = bounds.length > 0 ? Math.max(...bounds.map((box) => box.x + box.width)) : left
  const offsetX = right - left + 80

  const copies = selection.map((node): SceneNode => {
    const box = node.absoluteBoundingBox
    const cloned = node.clone()
    figma.currentPage.appendChild(cloned)
    const copy = detachInstancesDeep(cloned, report)
    copy.name = `${node.name} - ${direction} - ${language}`
    if (box != null) {
      copy.x = box.x + offsetX
      copy.y = box.y
    } else {
      copy.x += offsetX
    }
    adaptLayout(copy, direction, sourceDirection !== direction, report)
    copy.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
    return copy
  })

  figma.currentPage.selection = copies
  if (copies.length > 0) figma.viewport.scrollAndZoomIntoView(copies)
  return { copies, report }
}

function fontSupportsLanguage(family: string, language: Language): boolean {
  const name = family.toLowerCase()
  const script = LANGUAGE_PROFILES[language].script
  if (script === 'Latin') return true
  if (script === 'Cyrillic') return /cyrillic/.test(name) || ['roboto', 'inter', 'noto sans', 'arial', 'tahoma', 'times new roman', 'open sans'].includes(name)
  if (script === 'Hebrew') return /hebrew|david|frank ruehl/.test(name) || name === 'arial' || name === 'tahoma'
  if (script === 'Arabic') return /arabic|naskh|kufi|amiri|cairo|tajawal|almarai|scheherazade|geeza|damascus|al bayan|urdu|persian|nastaliq/.test(name) || name === 'arial' || name === 'tahoma'
  if (script === 'Devanagari') return /devanagari|hindi|mangal|nirmala|aparajita|kokila|utsaah|sanskrit/.test(name)
  if (script === 'Bengali') return /bengali|bangla|vrinda|shonar/.test(name)
  if (script === 'Tamil') return /tamil|latha|vijaya/.test(name)
  if (script === 'Telugu') return /telugu|gautami|vani/.test(name)
  if (script === 'Simplified Chinese') return /simplified|hans|source han sans sc|noto sans (cjk )?sc|noto serif sc|pingfang sc|microsoft yahei|simhei|simsun|heiti sc/.test(name)
  if (script === 'Traditional Chinese') return /traditional|hant|source han sans tc|noto sans (cjk )?tc|noto serif tc|pingfang tc|microsoft jhenghei/.test(name)
  if (script === 'Japanese') return /japanese|noto sans (cjk )?jp|source han sans jp|hiragino|meiryo|yu gothic|ipa gothic/.test(name)
  if (script === 'Korean') return /korean|noto sans (cjk )?kr|source han sans kr|malgun|nanum|apple sd gothic/.test(name)
  return /thai|leelawadee|sarabun|angsana|cordia|tahoma/.test(name)
}

function notoFamilies(language: Language): string[] {
  return LANGUAGE_PROFILES[language].fonts
}

function mappedStyle(font: FontName): string | null {
  const family = font.family.toLowerCase()
  const style = font.style.toLowerCase().replace(/[\s-]+/g, '')
  if (family === 'roboto') {
    if (style === 'regular') return 'Regular'
    if (style === 'medium') return 'Medium'
    if (style === 'bold') return 'Bold'
  }
  if (family.startsWith('pp right grotesk')) {
    if (style === 'widemedium' || (family.includes('wide medium') && style === 'medium')) return 'ExtraBold'
    if (style === 'wideblack' || (family.includes('wide black') && style === 'black')) return 'Black'
  }
  return null
}

async function automaticFont(original: FontName, language: Language, nodeName: string): Promise<FontName> {
  const configuredStyle = mappedStyle(original)
  const requestedStyle = configuredStyle ?? 'Regular'
  if (cachedFonts == null) cachedFonts = await figma.listAvailableFontsAsync()
  const normalize = (value: string): string => value.toLowerCase().replace(/[\s-]+/g, '')
  const families = notoFamilies(language)
  const exact = cachedFonts.find((font) => families.includes(font.fontName.family) && normalize(font.fontName.style) === normalize(requestedStyle))
  if (exact != null) {
    if (configuredStyle == null) fontMappingNotes.push({ area: nodeName, changed: 1, failed: 0, note: `${original.family} ${original.style} has no configured mapping; used ${exact.fontName.family} Regular.` })
    return exact.fontName
  }
  const regular = cachedFonts.find((font) => families.includes(font.fontName.family) && normalize(font.fontName.style) === 'regular')
  if (regular == null) throw new Error(`${nodeName}: ${families.join(' / ')} Regular is unavailable. Text left unchanged; enable or install the required Noto font.`)
  fontMappingNotes.push({ area: nodeName, changed: 1, failed: 0, note: `${original.family} ${original.style} → ${regular.fontName.family} Regular: mapped ${requestedStyle} unavailable.` })
  return regular.fontName
}

async function startTranslation(language: Language, direction: ResolvedDirection): Promise<void> {
  fontMappingNotes = []
  const preview = await createPreviewCopies(direction, language)
  activeReport = preview.report
  const nodes = collectTextNodes(preview.copies)
  const items: TranslationItem[] = nodes.map((node) => ({ id: node.id, text: node.characters }))
  showLoadingOverlays(preview.copies)
  figma.ui.postMessage({ type: 'translate-items', language, targetLanguageCode: LANGUAGE_PROFILES[language].code, direction, items })
}

async function replaceTextPreservingTypography(node: TextNode, text: string, language: Language): Promise<boolean> {
  const currentFonts = node.characters.length > 0 ? node.getRangeAllFontNames(0, node.characters.length) : []
  await Promise.all(currentFonts.map((font) => figma.loadFontAsync(font)))
  const originalLength = node.characters.length
  const segments = node.getStyledTextSegments(['fontName'])
  const plans = []
  for (const segment of segments) {
    const replacement = !fontSupportsLanguage(segment.fontName.family, language)
    const font = replacement ? await automaticFont(segment.fontName, language, node.name) : segment.fontName
    await figma.loadFontAsync(font)
    plans.push({ segment, font, replacement })
  }
  // Replace ranges backwards so every inserted range inherits its original typography.
  for (let index = plans.length - 1; index >= 0; index -= 1) {
    const plan = plans[index]
    if (plan == null) continue
    const start = Math.round(plan.segment.start / originalLength * text.length)
    const end = index === plans.length - 1 ? text.length : Math.round(plan.segment.end / originalLength * text.length)
    const piece = text.slice(start, end)
    if (piece.length > 0) node.insertCharacters(plan.segment.start, piece, 'AFTER')
    node.deleteCharacters(plan.segment.start + piece.length, plan.segment.end + piece.length)
    if (piece.length > 0 && plan.replacement) node.setRangeFontName(plan.segment.start, plan.segment.start + piece.length, plan.font)
  }
  return plans.some((plan) => plan.replacement)
}

async function applyTranslations(language: Language, direction: ResolvedDirection, results: TranslationResult[]): Promise<void> {
  let updated = 0
  let skipped = 0
  const translationNotes: string[] = []

  for (const result of results) {
    if (result.error != null || result.text.length === 0) {
      skipped += 1
      if (result.error != null && translationNotes.length < 3) translationNotes.push(result.error)
      continue
    }
    const node = await figma.getNodeByIdAsync(result.id)
    if (node == null || node.type !== 'TEXT' || node.removed) {
      skipped += 1
      continue
    }
    try {
      const fallbackApplied = result.preserved ? false : await replaceTextPreservingTypography(node, result.text, language)
      if (fallbackApplied) activeReport.entries.Typography.changed += 1
      await Promise.all(node.getRangeAllFontNames(0, node.characters.length).map((font) => figma.loadFontAsync(font)))
      setTextDirection(node, direction)
      node.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
      updated += 1
    } catch (cause) {
      skipped += 1
      recordFailure(activeReport, ['Typography'], node, cause)
      if (translationNotes.length < 3) translationNotes.push(cause instanceof Error ? cause.message : String(cause))
    }
  }

  hideLoadingOverlays()

  if (updated === 0) {
    figma.notify('No text could be translated', { error: true })
  } else {
    const detail = skipped > 0 ? `; ${skipped} skipped` : ''
    figma.notify(`Created ${direction} preview with ${updated} translated text layer${updated === 1 ? '' : 's'}${detail}`)
  }
  figma.ui.postMessage({
    type: 'complete',
    updated,
    skipped,
    fallbackApplied: activeReport.entries.Typography.changed > 0,
    fallbackFont: 'automatic Noto mappings',
    direction,
    summary: [...reportRows(activeReport, updated, skipped, translationNotes).filter((row) => row.failed > 0), ...fontMappingNotes]
  })
}

const initialParams = readParams()
let html = __html__
html = html.replace(/(id="language"[^>]*\bvalue=")[^"]*(")/, '$1' + escapeAttribute(initialParams.language) + '$2')
html = html.replace(/(id="direction"[^>]*\bvalue=")[^"]*(")/, '$1' + escapeAttribute(initialParams.direction) + '$2')
figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(html, { width: 420, height: 520 })

function sendSelectionState(): void {
  const count = collectTextNodes().length
  figma.ui.postMessage({ type: 'selection-state', count })
}

sendSelectionState()
figma.on('selectionchange', sendSelectionState)

figma.ui.onmessage = async (message: UiMessage): Promise<void> => {
  if (message.type === 'include-hidden') {
    includeHiddenLayers = message.includeHidden === true
    sendSelectionState()
    return
  }
  if (message.type === 'resize') {
    figma.ui.resize(420, Math.max(260, Math.min(760, Math.round(message.height))))
    return
  }
  if (message.type === 'translate') {
    includeHiddenLayers = message.includeHidden === true
    const params = normalizeParams({ language: message.language, direction: message.direction })
    const direction = resolveDirection(params.language, params.direction)
    writeParams(params)
    const sourceNodes = collectTextNodes()
    if (sourceNodes.length === 0) {
      figma.notify('Select text layers or a container with text', { error: true })
      figma.ui.postMessage({ type: 'complete', updated: 0, skipped: 0, fallbackApplied: false, fallbackFont: null, direction, summary: [] })
      return
    }
    await startTranslation(params.language, direction)
    return
  }
  if (message.type === 'translation-results') {
    await applyTranslations(message.language, message.direction, message.results)
  }
}

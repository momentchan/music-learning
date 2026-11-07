/** Skill graph (spec §4). IDs are stable; never reuse an ID for different content. */

export type Availability = 'available' | 'preview' | 'planned'

export interface LessonContent {
  definition: string
  why: string
  example: string
  mistake: string
  visual?:
    | { kind: 'fretboard'; positions: [number, number, string][]; caption: string }
    | { kind: 'shape'; shapeIds: string[]; caption: string }
    | { kind: 'pattern'; pattern: string; caption: string }
}

export interface BridgeTask { id: string; text: string; minutes: number }

export interface SkillNode {
  id: string
  tier: 1 | 2 | 3
  title: string
  summary: string
  prerequisites: string[]
  canDo: string[]
  availability: Availability
  /** Phase in which a planned node is scheduled (spec §15). */
  plannedPhase?: 'B' | 'C' | 'D'
  estimatedMinutes: number
  related: string[]
  content?: LessonContent
  bridge?: BridgeTask
}

const T1: SkillNode[] = [
  {
    id: 'fret.open', tier: 1, title: '空弦與調音 Open Strings', summary: '六條空弦的音名與弦的編號。',
    prerequisites: [], canDo: ['不看就說出第 1–6 弦的空弦音'], availability: 'available', estimatedMinutes: 3, related: ['fret.naturals.low'],
    content: {
      definition: '標準調音由最粗（第 6 弦）到最細（第 1 弦）是 E A D G B E。弦的編號從細到粗：第 1 弦是最細的高音 E。',
      why: '所有指板上的音名都從空弦往上數。說錯弦號或空弦音，後面每個位置都會跟著錯。',
      example: '第 5 弦空弦是 A；在第 5 弦按第 2 格就是 B。',
      mistake: '把「第 1 弦」當成最粗的弦。第 1 弦是最細、音最高的那條。',
      visual: { kind: 'fretboard', positions: [[6, 0, 'E'], [5, 0, 'A'], [4, 0, 'D'], [3, 0, 'G'], [2, 0, 'B'], [1, 0, 'E']], caption: '六條空弦：E A D G B E' },
    },
    bridge: { id: 'bridge.fret.open', minutes: 1, text: '拿起吉他，從第 6 弦到第 1 弦逐條彈空弦，每彈一條就唸出音名（E、A、D、G、B、E）。再反過來從第 1 弦唸回第 6 弦。' },
  },
  {
    id: 'chord.diagram', tier: 1, title: '讀和弦圖 Chord Diagrams', summary: '看懂和弦圖上的弦、格、指法、× 與 ○。',
    prerequisites: ['fret.open'], canDo: ['看和弦圖說出每條弦按第幾格、用哪根手指、哪些弦不彈'], availability: 'available', estimatedMinutes: 3, related: ['chord.open'],
    content: {
      definition: '和弦圖是把吉他立起來、琴頭朝上看：直線是弦（左邊第 6 弦、右邊第 1 弦），橫線是琴格，最上方粗線是琴枕。圓點是按壓位置，數字是手指（1 食指、2 中指、3 無名指、4 小指）；× = 不彈，○ = 彈空弦。',
      why: '幾乎所有和弦教材都用這種圖。看得懂，才能自己學新和弦。',
      example: 'C 和弦：× 3 2 0 1 0 —— 第 6 弦不彈，第 5 弦第 3 格（無名指）、第 4 弦第 2 格（中指）、第 3 弦空弦、第 2 弦第 1 格（食指）、第 1 弦空弦。',
      mistake: '把和弦圖左右看反。左邊永遠是最粗的第 6 弦，和本 App 的直式指板方向相同。',
      visual: { kind: 'shape', shapeIds: ['C'], caption: 'C 和弦圖' },
    },
    bridge: { id: 'bridge.chord.diagram', minutes: 2, text: '照著 C 和弦圖，一根手指一根手指慢慢放好。從第 5 弦開始逐條彈，確認每條弦都清楚、第 6 弦沒有彈到。' },
  },
  {
    id: 'chord.open', tier: 1, title: '開放和弦 Open Chords', summary: 'C A G E D、Am Em Dm，以及常用屬七和弦。',
    prerequisites: ['chord.diagram'], canDo: ['看指型認出 C A G E D Am Em Dm', '說出指型中每個按壓位置是根音、三音還是五音'], availability: 'available', estimatedMinutes: 5, related: ['chord.changes', 'triad.basic'],
    content: {
      definition: '開放和弦是在第 0–3 格、使用空弦的和弦指型。每個和弦由根音、三音、五音組成；屬七和弦再多一個七音。',
      why: '大部分流行與民謠歌曲用這幾個和弦就能彈。知道每個音是根音還是三音，之後學封閉和弦、即興時都用得到。',
      example: 'G 和弦（3 2 0 0 0 3）：第 6 弦第 3 格是根音 G，第 5 弦第 2 格是三音 B，第 4 弦空弦是五音 D。',
      mistake: '以為最高的音就是根音。開放和弦的根音通常是最低的發聲音，例如 Am 的根音是第 5 弦空弦 A。',
      visual: { kind: 'shape', shapeIds: ['G', 'Em', 'D'], caption: 'G、Em、D 開放指型' },
    },
    bridge: { id: 'bridge.chord.open', minutes: 3, text: '彈 G → Em → C → D，每個和弦刷 4 下。換和弦時先移動最遠的手指，能留在原地的手指就不要抬起來（例如 G 到 Em：食指一直留在第 5 弦第 2 格）。' },
  },
  {
    id: 'rhythm.pulse', tier: 1, title: '拍子與數拍 Pulse & Counting', summary: '四分與八分音符，數「1 & 2 & 3 & 4 &」。',
    prerequisites: [], canDo: ['跟著節拍器點出四分與八分音符，80% 以上落在節拍窗口內'], availability: 'available', estimatedMinutes: 3, related: ['rhythm.strum'],
    content: {
      definition: '拍子（pulse）是音樂裡穩定的心跳。4/4 拍每小節 4 拍；每拍再分成兩半就是八分音符，數成「1 & 2 & 3 & 4 &」。',
      why: '節奏穩定比彈得快重要。聽眾最先注意到的通常是節奏不穩，而不是音彈錯。',
      example: '在 60 BPM 下一拍 1 秒，八分音符每 0.5 秒一下：「1」在拍子開頭，「&」在正中間。',
      mistake: '只在有聲音時才數拍。休止的地方也要在心裡繼續數，否則下一拍就會進早或進晚。',
      visual: { kind: 'pattern', pattern: 'DUDUDUDU', caption: '1 & 2 & 3 & 4 &' },
    },
    bridge: { id: 'bridge.rhythm.pulse', minutes: 2, text: '打開節拍器 70 BPM，悶住弦（左手輕放在弦上），右手跟著每拍往下刷一下，嘴裡數「1 2 3 4」。再改成每拍下上各一下，數「1 & 2 & 3 & 4 &」。' },
  },
  {
    id: 'rhythm.strum', tier: 1, title: '刷法節奏 Strumming Patterns', summary: '下撥與上撥、鐘擺式右手、常見刷法。',
    prerequisites: ['rhythm.pulse'], canDo: ['在 70–80 BPM 用 D/U 正確點出 D DU UDU 刷法'], availability: 'available', estimatedMinutes: 4, related: ['chord.changes'],
    content: {
      definition: '刷法是在一小節裡安排下撥（D）、上撥（U）和空刷。右手像鐘擺持續擺動：正拍往下、反拍「&」往上，沒有聲音的地方手照樣擺、只是不碰弦。',
      why: '持續擺動讓節奏有穩定的參考點，複雜一點的刷法也不會亂掉。',
      example: '民謠刷法 D DU UDU：1 下、2 下、2& 上、3 空刷（手往下但不碰弦）、3& 上、4 下、4& 上。',
      mistake: '休止時右手停住。停下來後要重新起動，節奏就會不穩。',
      visual: { kind: 'pattern', pattern: 'D.DU.UDU', caption: 'D DU UDU' },
    },
    bridge: { id: 'bridge.rhythm.strum', minutes: 3, text: '節拍器 70 BPM，按住 G 和弦，彈 D DU UDU 四小節不中斷。穩了之後換成 G → C 每小節換一次。' },
  },
  {
    id: 'fret.naturals.low', tier: 1, title: '第 6、5 弦的自然音 Notes on Strings 6 & 5', summary: '第 6 與第 5 弦 0–12 格的 A–G。',
    prerequisites: ['fret.open'], canDo: ['在 3 秒內說出第 6、5 弦任一自然音的位置，近 20 題正確率 ≥ 90%'], availability: 'available', estimatedMinutes: 4, related: ['fret.naturals.all', 'chord.barre'],
    content: {
      definition: '自然音是沒有升降記號的 A B C D E F G。相鄰自然音之間通常隔 2 格（全音），只有 E–F 和 B–C 只隔 1 格（半音）。',
      why: '第 6、5 弦是封閉和弦與大部分指型的根音弦。記住這兩條弦，就能在任何把位找到和弦的根音。',
      example: '第 6 弦：E(0) F(1) G(3) A(5) B(7) C(8) D(10) E(12)。第 5 弦：A(0) B(2) C(3) D(5) E(7) F(8) G(10) A(12)。',
      mistake: '每個音都隔 2 格地數下去，結果過了 E–F 或 B–C 就差一格。',
      visual: { kind: 'fretboard', positions: [[6, 0, 'E'], [6, 1, 'F'], [6, 3, 'G'], [6, 5, 'A'], [6, 7, 'B'], [6, 8, 'C'], [6, 10, 'D'], [6, 12, 'E'], [5, 0, 'A'], [5, 2, 'B'], [5, 3, 'C'], [5, 5, 'D'], [5, 7, 'E'], [5, 8, 'F'], [5, 10, 'G'], [5, 12, 'A']], caption: '第 6、5 弦的自然音' },
    },
    bridge: { id: 'bridge.fret.naturals.low', minutes: 2, text: '在第 6 弦依序彈 E F G A B C D E（0 1 3 5 7 8 10 12 格），邊彈邊唸音名。再在第 5 弦做一次。最後隨機挑一個音，閉眼找到它。' },
  },
  {
    id: 'fret.naturals.all', tier: 1, title: '全部弦的自然音 Natural Notes Everywhere', summary: '六條弦 0–12 格的自然音。',
    prerequisites: ['fret.naturals.low'], canDo: ['在任一弦上找到指定自然音，正確率 ≥ 90%'], availability: 'available', estimatedMinutes: 5, related: ['fret.octaves'],
    content: {
      definition: '每條弦的規則都一樣：從空弦音往上數，全音隔 2 格、E–F 與 B–C 隔 1 格。第 12 格是空弦的高八度，之後重複。',
      why: '找得到每條弦上的音，才能把音階、和弦音和旋律放到指板上任何位置。',
      example: '第 3 弦（G）：A 在第 2 格、B 在第 4 格、C 在第 5 格。',
      mistake: '只靠「數格子」。數格子慢又容易錯；用已經知道的音當地標，再看 E–F、B–C 是不是只隔一格。',
    },
    bridge: { id: 'bridge.fret.naturals.all', minutes: 3, text: '挑一個音（例如 C），在六條弦上各找出一個 C 並彈出來，從第 6 弦到第 1 弦，再從第 1 弦回到第 6 弦。' },
  },
  {
    id: 'fret.accidentals', tier: 1, title: '升降與同音異名 Sharps, Flats & Enharmonics', summary: 'C♯/D♭ 等黑鍵音的位置與寫法。',
    prerequisites: ['fret.naturals.low'], canDo: ['找到任一弦上的升降音，並知道同一個位置可以有兩種寫法'], availability: 'available', estimatedMinutes: 4, related: ['interval.basics'],
    content: {
      definition: '升記號（♯）高半音、降記號（♭）低半音。同一個音高可以有不同寫法，例如 C♯ 與 D♭，稱為同音異名（enharmonic）。',
      why: '在指板上它們是同一格；但在樂理上要看調性選擇寫法，例如 A 大調寫 C♯，不寫 D♭。',
      example: '第 6 弦第 2 格是 F♯ / G♭；第 5 弦第 1 格是 A♯ / B♭。',
      mistake: '以為 E♯ 或 B♯ 不存在。它們存在，只是和 F、C 同音（例如 F♯ 大調的第 7 級是 E♯）。',
    },
    bridge: { id: 'bridge.fret.accidentals', minutes: 2, text: '在第 6 弦從空弦一格一格往上彈到第 12 格，唸出每一格的音名（升降音兩種名字都唸）。' },
  },
  {
    id: 'fret.octaves', tier: 1, title: '八度形狀 Octave Shapes', summary: '隔一條弦的八度，與 G–B 弦的例外。',
    prerequisites: ['fret.naturals.low'], canDo: ['從第 6、5、4、3 弦上的任一音，立刻找到高八度的位置'], availability: 'available', estimatedMinutes: 3, related: ['fret.naturals.all', 'interval.shapes'],
    content: {
      definition: '同一個音高一個八度，在隔一條弦的地方：第 6 → 4 弦、第 5 → 3 弦要往高把位移 2 格；第 4 → 2 弦、第 3 → 1 弦要移 3 格。',
      why: '八度形狀把第 6、5 弦的音名「搬」到其他弦上，是記住整個指板最快的方法。',
      example: '第 6 弦第 3 格 G → 第 4 弦第 5 格 G。第 4 弦第 2 格 E → 第 2 弦第 5 格 E。',
      mistake: '跨過 G–B 弦時還是只移 2 格。第 3 弦和第 2 弦只差大三度（其他相鄰弦都是完全四度），所以要多移一格。',
      visual: { kind: 'fretboard', positions: [[6, 3, 'G'], [4, 5, 'G'], [5, 3, 'C'], [3, 5, 'C'], [4, 2, 'E'], [2, 5, 'E']], caption: '八度形狀：+2 格，跨 G–B 弦 +3 格' },
    },
    bridge: { id: 'bridge.fret.octaves', minutes: 2, text: '用食指彈第 6 弦第 5 格（A），無名指彈第 4 弦第 7 格（A）。保持這個形狀往上滑，每到一格唸出音名。' },
  },
  {
    id: 'interval.basics', tier: 1, title: '音程基礎 Intervals', summary: '用字母數度數、用半音數決定性質。',
    prerequisites: ['fret.accidentals'], canDo: ['在任一根音上建構 M3、m3、P4、P5 並拼對字母'], availability: 'available', estimatedMinutes: 5, related: ['interval.shapes', 'triad.basic'],
    content: {
      definition: '音程是兩個音的距離。度數看字母（C 到 E：C-D-E 共 3 個字母 → 三度）；性質看半音數（C 到 E 是 4 個半音 → 大三度 M3；C 到 E♭ 是 3 個 → 小三度 m3）。',
      why: '和弦、音階、旋律都由音程構成。懂音程，就能自己推出任何和弦的組成音。',
      example: 'D 往上大三度：先數字母 D-E-F（三度）→ F，再調整半音：D 到 F 是 3 個半音，大三度要 4 個 → F♯。',
      mistake: '只數半音，寫成 D 到 G♭。G♭ 和 F♯ 同音，但 D-G 是四度，所以 D 往上大三度要寫 F♯。',
    },
    bridge: { id: 'bridge.interval.basics', minutes: 2, text: '在第 5 弦第 3 格彈 C，然後在同一條弦往上 3 格（E♭，小三度）與 4 格（E，大三度）各彈一次，比較兩者的聲音。' },
  },
  {
    id: 'interval.shapes', tier: 1, title: '指板上的音程形狀 Interval Shapes', summary: '從二度到八度，使用相鄰弦與隔弦的實用位置。',
    prerequisites: ['interval.basics', 'fret.naturals.all'], canDo: ['從根音找出二至八度，並處理跨 G–B 弦的形狀差異'], availability: 'available', estimatedMinutes: 4, related: ['triad.stringsets'],
    content: {
      definition: '相鄰弦大多相差完全四度（5 個半音），所以同一格的上一條弦是 P4，往高把位 2 格是 P5，往低把位 1 格是 M3、2 格是 m3。G–B 弦只差大三度，所以形狀要往高把位多移一格。六度到八度改用隔一條弦的位置，減少左手伸展。',
      why: '用形狀思考比一個一個數半音快得多。和弦與音階在指板上的樣子都是這些形狀組合起來的。',
      example: '根音在第 5 弦第 3 格（C）：大三度 E 在第 4 弦第 2 格；完全五度 G 在第 4 弦第 5 格；大六度 A 在第 3 弦第 2 格，小七度 B♭ 在第 3 弦第 3 格，八度 C 在第 3 弦第 5 格。',
      mistake: '在第 3 → 2 弦用和其他弦一樣的形狀，結果低了半音。',
    },
    bridge: { id: 'bridge.interval.shapes', minutes: 2, text: '第 6 弦第 5 格（A）+ 第 5 弦第 7 格（E）一起彈：這是完全五度（強力和弦）。保持形狀往上移，換到第 5、4 弦再試一次。' },
  },
  {
    id: 'triad.basic', tier: 1, title: '三和弦 Triads', summary: '大、小、減、增三和弦的組成。',
    prerequisites: ['interval.basics'], canDo: ['寫出任一根音的大、小三和弦組成音，並拼對字母'], availability: 'available', estimatedMinutes: 5, related: ['chord.open', 'key.diatonic'],
    content: {
      definition: '三和弦由根音、三音、五音組成，隔一個字母疊一個音（例如 C-E-G）。大三和弦 = 大三度 + 小三度；小三和弦 = 小三度 + 大三度；減三和弦 = 兩個小三度；增三和弦 = 兩個大三度。',
      why: '每個開放和弦、封閉和弦都只是三和弦的不同排列。懂組成音，就懂你按的每一根手指在做什麼。',
      example: 'A 大三和弦 = A C♯ E；A 小三和弦 = A C E —— 只差三音的半音。',
      mistake: '寫成 A D♭ E。D♭ 和 C♯ 同音，但三和弦要隔字母疊（A-C-E），所以要寫 C♯。',
    },
    bridge: { id: 'bridge.triad.basic', minutes: 2, text: '彈開放 E 和弦，再把第 3 弦第 1 格的食指抬起來變成 Em。聽出只差一個音（三音 G♯ → G）帶來的明亮/陰暗差別。' },
  },
  {
    id: 'scale.major', tier: 1, title: '大調音階 Major Scale', summary: '全全半全全全半與音階級數。',
    prerequisites: ['interval.basics'], canDo: ['寫出 0–4 個升降記號的大調音階，說出任一級數的音'], availability: 'available', estimatedMinutes: 4, related: ['key.diatonic', 'scale.penta1'],
    content: {
      definition: '大調音階有 7 個音，排列是 全-全-半-全-全-全-半，每個字母剛好用一次。音階中的位置叫級數（1–7）；第 5 級是屬音，第 7 級是導音（比主音低半音）。',
      why: '調性、順階和弦、旋律和即興都以大調音階為參考。',
      example: 'G 大調：G A B C D E F♯ —— E 到 F♯ 是全音、F♯ 到 G 是半音。',
      mistake: '寫成 G A B C D E G♭。每個字母只能用一次，所以第 7 級要寫 F♯。',
    },
    bridge: { id: 'bridge.scale.major', minutes: 2, text: '在第 5 弦第 3 格（C）開始，只用一條弦往上彈 C 大調音階：+2 +2 +1 +2 +2 +2 +1 格。聽聽最後半音回到主音的「回家」感。' },
  },
  {
    id: 'key.diatonic', tier: 1, title: '調性與順階和弦 Keys & Diatonic Chords', summary: '調號、I ii iii IV V vi vii°。',
    prerequisites: ['scale.major', 'triad.basic'], canDo: ['說出 C G D A E F 大調的順階三和弦與級數'], availability: 'available', estimatedMinutes: 5, related: ['harmony.basic', 'key.circle'],
    content: {
      definition: '在大調音階每個音上，只用調內音疊三和弦，得到 7 個順階和弦：I ii iii IV V vi vii°（大-小-小-大-大-小-減）。大寫羅馬數字代表大三和弦，小寫是小三和弦，° 是減三和弦。',
      why: '流行歌大多只用調內和弦。用級數思考，就能把一首歌移到任何調，也能預測下一個和弦。',
      example: 'G 大調：G Am Bm C D Em F♯°。I–V–vi–IV = G–D–Em–C。',
      mistake: '以為某個和弦的級數是固定的。Em 在 G 大調是 vi，在 C 大調是 iii，在 D 大調是 ii。',
    },
    bridge: { id: 'bridge.key.diatonic', minutes: 2, text: '在 G 大調彈 I–IV–V–I（G–C–D–G），再彈 I–V–vi–IV（G–D–Em–C）。唸出每個和弦的級數。' },
  },
  {
    id: 'harmony.basic', tier: 1, title: '和弦進行與功能 Progressions & Function', summary: '主、下屬、屬功能與常見進行。',
    prerequisites: ['key.diatonic'], canDo: ['在 4 和弦進行中標出 I、IV、V、vi'], availability: 'available', estimatedMinutes: 4, related: ['harmony.cadences'],
    content: {
      definition: '和弦在調裡扮演不同角色：主功能（I，穩定、像家）、下屬功能（ii、IV，離開家）、屬功能（V、vii°，有張力、想回家）。這是常見的分析框架，不是每首歌都必須遵守的規則。',
      why: '理解功能就能聽懂和弦進行的「方向感」，寫歌或即興時也知道張力在哪裡。',
      example: 'C 大調 C–F–G–C 是 I–IV–V–I：家 → 離開 → 張力 → 回家。',
      mistake: '以為 vi 或 iii 只有一種功能。vi 常有主功能的色彩，也常像下屬功能一樣通往 V；這要看上下文。',
    },
    bridge: { id: 'bridge.harmony.basic', minutes: 3, text: '彈 C–Am–F–G（I–vi–IV–V）兩次，最後停在 G 不解決，感受那個「還沒結束」的張力，再彈 C 回家。' },
  },
  {
    id: 'ear.basic', tier: 1, title: '基礎聽力 Ear Training Basics', summary: '大小三和弦與常用音程。',
    prerequisites: ['triad.basic'], canDo: ['分辨大三和弦與小三和弦、大三度與小三度，正確率 ≥ 85%'], availability: 'available', estimatedMinutes: 3, related: ['interval.basics'],
    content: {
      definition: '聽力訓練把樂理和聲音連起來：先分辨大、小三和弦的明暗，再分辨常用音程。',
      why: '聽得出來，才能扒歌、即興，並知道自己彈的音對不對。',
      example: '大三和弦聽起來較明亮，小三和弦較暗；它們只差三音的半音。',
      mistake: '只聽一次就猜。可以重播，先唱出根音再比較三音。',
    },
    bridge: { id: 'bridge.ear.basic', minutes: 2, text: '輪流彈 A 和 Am、E 和 Em，閉上眼睛請自己（或朋友）隨機彈一個，猜是大還是小。' },
  },
  {
    id: 'chord.changes', tier: 1, title: '換和弦 Chord Changes', summary: '樞紐手指、定位手指與一分鐘換和弦。',
    prerequisites: ['chord.open', 'rhythm.strum'], canDo: ['兩個開放和弦之間每分鐘換 ≥ 30 次'], availability: 'planned', plannedPhase: 'B', estimatedMinutes: 4, related: ['chord.open'],
  },
  {
    id: 'scale.penta1', tier: 1, title: '五聲音階第一把位 Pentatonic Box 1', summary: '小調五聲與大調五聲的關係。',
    prerequisites: ['scale.major', 'fret.naturals.low'], canDo: ['在任一調彈出小調五聲第一把位'], availability: 'planned', plannedPhase: 'C', estimatedMinutes: 4, related: ['scale.positions'],
  },
  {
    id: 'key.circle', tier: 1, title: '五度圈 Circle of Fifths', summary: '調與調之間的關係、關係小調。',
    prerequisites: ['key.diatonic'], canDo: ['在五度圈上找到任一調的屬調、下屬調與關係小調'], availability: 'planned', plannedPhase: 'C', estimatedMinutes: 4, related: ['harmony.secondary-dom'],
  },
]

const planned = (id: string, tier: 2 | 3, title: string, summary: string, prerequisites: string[], phase: 'C' | 'D'): SkillNode =>
  ({ id, tier, title, summary, prerequisites, canDo: [], availability: 'planned', plannedPhase: phase, estimatedMinutes: 5, related: [] })

const T2: SkillNode[] = [
  planned('chord.barre', 2, '封閉和弦 Barre Chords', 'E 型與 A 型可移動和弦。', ['chord.open', 'fret.naturals.low'], 'C'),
  planned('fret.caged', 2, 'CAGED 系統', '五個指型把整個指板連起來。', ['chord.barre', 'fret.octaves'], 'C'),
  planned('scale.positions', 2, '音階把位 Scale Positions', '五聲音階五個把位、大調每弦三音。', ['scale.penta1', 'fret.caged'], 'C'),
  planned('chord.seventh', 2, '七和弦 Seventh Chords', 'maj7、m7、7、m7♭5、dim7 與指型。', ['triad.basic', 'chord.open'], 'C'),
  planned('chord.sus-add6', 2, '掛留、加音與六和弦', 'sus2、sus4、add9、6、m6。', ['triad.basic'], 'C'),
  planned('triad.stringsets', 2, '弦組上的三和弦 Triads on String Sets', '1–3、2–4、3–5 弦組與轉位。', ['triad.basic', 'interval.shapes'], 'C'),
  planned('harmony.cadences', 2, '終止式 Cadences', '正格、半終止、變格終止。', ['harmony.basic'], 'C'),
  planned('harmony.ii-V-I', 2, 'ii–V–I', '爵士與流行最常見的終止進行。', ['harmony.basic', 'chord.seventh'], 'C'),
  planned('harmony.minor-keys', 2, '小調 Minor Keys', '自然、和聲、旋律小調。', ['key.diatonic'], 'C'),
  planned('voice.common-tones', 2, '共同音 Common Tones', '和弦之間不動的音。', ['key.diatonic'], 'C'),
  planned('voice.guide-tones', 2, '引導音 Guide Tones', '三音與七音的移動。', ['chord.seventh'], 'C'),
  planned('improv.targets', 2, '目標音 Target Notes', '在強拍落在和弦音上。', ['triad.basic', 'scale.penta1'], 'C'),
  planned('scale.modes', 2, '調式 Modes', '母音階與平行調式兩種角度。', ['scale.major', 'key.diatonic'], 'C'),
  planned('rhythm.sixteenths', 2, '十六分音符', '1 e & a。', ['rhythm.strum'], 'C'),
  planned('rhythm.syncopation', 2, '切分音 Syncopation', '強調反拍。', ['rhythm.strum'], 'C'),
  planned('rhythm.triplets-swing', 2, '三連音與搖擺', 'Triplets、Swing、Shuffle。', ['rhythm.strum'], 'C'),
  planned('ear.sevenths', 2, '聽七和弦', 'maj7、m7、7、m7♭5。', ['ear.basic'], 'C'),
  planned('ear.cadences', 2, '聽終止式', 'V–I、IV–I、I–V。', ['ear.basic', 'harmony.basic'], 'C'),
  planned('ear.degrees', 2, '聽音階級數', '相對主音辨認級數。', ['ear.basic', 'scale.major'], 'C'),
  planned('ear.bass-motion', 2, '聽低音進行', '四度、五度、級進。', ['ear.basic'], 'C'),
]

const T3: SkillNode[] = [
  planned('harmony.secondary-dom', 3, '次屬和弦 Secondary Dominants', 'V/x 與 vii°/x。', ['harmony.cadences', 'key.circle'], 'D'),
  planned('harmony.borrowed', 3, '借用和弦 Borrowed Chords', '從同主音小調借來的色彩。', ['harmony.minor-keys'], 'D'),
  planned('harmony.tritone-sub', 3, '三全音代理 Tritone Substitution', 'subV7。', ['harmony.secondary-dom'], 'D'),
  planned('harmony.modulation', 3, '轉調與調性化 Modulation', '短暫轉向與真正轉調。', ['harmony.secondary-dom'], 'D'),
  planned('chord.extensions', 3, '延伸和弦 Extensions', '9、11、13 與變化音。', ['chord.seventh'], 'D'),
  planned('chord.drop2', 3, 'Drop 2 聲位', '吉他上最常用的七和弦聲位。', ['chord.seventh', 'triad.stringsets'], 'D'),
  planned('chord.slash', 3, '分割和弦 Slash Chords', 'G/B 與低音線。', ['triad.stringsets'], 'D'),
  planned('improv.approach', 3, '經過音與包圍音 Approach Notes', '半音、級進、包圍。', ['improv.targets'], 'D'),
  planned('improv.motif', 3, '動機發展 Motif', '重複、變化、發展。', ['improv.targets'], 'D'),
  planned('improv.phrase', 3, '樂句 Phrasing', '問答、樂句長度。', ['improv.motif'], 'D'),
  planned('analysis.progression', 3, '和弦進行分析 Song Analysis', '內建與自訂進行的分析。', ['harmony.cadences'], 'D'),
  planned('compose.progression', 3, '寫和弦進行 Composition', '4 小節與 8 小節。', ['analysis.progression'], 'D'),
  planned('compose.melody-harmonize', 3, '為旋律配和弦', '從旋律選和弦。', ['compose.progression'], 'D'),
  planned('compose.reharm', 3, '重配和聲 Reharmonization', '代理、插入次屬、借用。', ['harmony.borrowed', 'harmony.tritone-sub'], 'D'),
  planned('rhythm.dictation', 3, '節奏聽寫', '聽寫一小節節奏。', ['rhythm.syncopation'], 'D'),
  planned('rhythm.polyrhythm', 3, '複節奏 Polyrhythm', '3 對 2。', ['rhythm.triplets-swing'], 'D'),
  planned('ear.progression-dictation', 3, '和弦進行聽寫', '聽出 4 和弦進行。', ['ear.cadences'], 'D'),
  planned('ear.melody-dictation', 3, '旋律聽寫', '短旋律聽寫。', ['ear.degrees'], 'D'),
  planned('fret.alt-tunings', 3, '變格調音 Alternate Tunings', 'Drop D、DADGAD、Open G。', ['fret.naturals.all'], 'D'),
]

export const NODES: readonly SkillNode[] = [...T1, ...T2, ...T3]
const index = new Map(NODES.map(n => [n.id, n]))
export const nodeById = (id: string): SkillNode | undefined => index.get(id)
export const availableNodes = () => NODES.filter(n => n.availability === 'available')

/** Still in the engine so older records resolve, but not shown or scheduled. */
export const UNLISTED_NODE_IDS = new Set(['fret.octaves'])

export interface Pathway { id: string; short: string; title: string; description: string; steps: string[] }
export const PATHWAYS: readonly Pathway[] = [
  { id: 'start', short: '★ 從這裡開始', title: '★ 從這裡開始 Start Here', description: '給已經能用封閉和弦伴奏的人。先把每條弦的音名補完，再把大調級數、順階和功能練穩。即興、進階聽力和寫歌排在這之後，不會一開始全部塞進來。',
    steps: ['fret.naturals.all', 'fret.accidentals', 'interval.shapes', 'scale.major', 'key.diatonic', 'harmony.basic'] },
  { id: 'foundations', short: '複習基礎', title: '可選複習 · 空弦、開放和弦、基本刷法', description: '已經會伴奏的人可以整段跳過。空弦音名、開放和弦指型和基本刷法留在這裡，不進每日新內容。',
    steps: ['fret.open', 'chord.diagram', 'chord.open', 'rhythm.pulse', 'rhythm.strum', 'fret.naturals.low', 'interval.basics', 'triad.basic', 'ear.basic'] },
  { id: 'fretboard', short: 'A 指板', title: 'A — 指板精通 Fretboard Mastery', description: '補完每條弦的音名、升降與音程形狀，再到弦組三和弦、CAGED 和把位。',
    steps: ['fret.naturals.all', 'fret.accidentals', 'interval.shapes', 'triad.stringsets', 'fret.caged', 'scale.positions'] },
  { id: 'harmony', short: 'B 和聲', title: 'B — 理解和聲 Harmony Understanding', description: '先把音階級數和順階練穩，再往功能、終止、次屬、借用與共同音走。',
    steps: ['scale.major', 'key.diatonic', 'harmony.basic', 'harmony.cadences', 'harmony.secondary-dom', 'harmony.borrowed', 'voice.common-tones'] },
  { id: 'improv', short: 'C 即興', title: 'C — 即興基礎 Improvisation', description: '等指板音程和順階穩了再走這條。五聲把位、目標音、引導音和樂句還沒開放。',
    steps: ['interval.shapes', 'scale.penta1', 'scale.positions', 'improv.targets', 'voice.guide-tones', 'improv.approach', 'improv.phrase'] },
  { id: 'compose', short: 'D 作曲', title: 'D — 作曲與分析 Composition & Analysis', description: '寫歌用的是級數和功能，不是更多指型。終止、代理和重配和聲還沒開放。',
    steps: ['key.diatonic', 'harmony.basic', 'harmony.cadences', 'voice.common-tones', 'harmony.tritone-sub', 'compose.reharm'] },
]

// JOIN US demo SPA (Phase 0/1 static)
// Routing, state, simple views; expand features incrementally per TODOs

;(function() {
  const routes = {
    '': LandingView,
    '#/login': LoginView,
    '#/profile': ProfileView,
    '#/home': HomeView,
    '#/chat': ChatView,
    '#/admin': AdminView,
  }

  const state = createState()

  function navigate(hash) {
    if (!hash) hash = location.hash || ''
    const route = hash.split('?')[0]
    const view = routes[route] || NotFoundView
    const app = document.getElementById('app')
    app.innerHTML = ''
    app.appendChild(Nav())
    app.appendChild(view({ state, navigate, hash }))
  }

  window.addEventListener('hashchange', () => navigate())
  window.addEventListener('load', () => navigate())

  // ---------- State ----------
  function createState() {
    const storageKey = 'joinus_demo_state_v1'
    const initial = {
      auth: { userId: null, phoneOrEmail: null, isAuthed: false },
      profile: { handle: '', ageRange: '20s', icon: '🍺', drinks: ['beer'], groupSize: 1 },
      presence: { isActiveNow: false, lastSeenAt: null },
      location: { lat: null, lng: null },
      filters: { radiusKm: 10, ages: [], drinks: [], groupSizes: [] },
      likes: [],
      matches: [],
      messages: {},
      reports: [],
      users: [], // seeded users including self shadow
      admin: { resetAt: null }
    }
    try {
      const raw = localStorage.getItem(storageKey)
      const data = raw ? JSON.parse(raw) : initial
      return {
        get: () => data,
        set: (updater) => {
          const next = typeof updater === 'function' ? updater(data) : updater
          Object.assign(data, next)
          localStorage.setItem(storageKey, JSON.stringify(data))
          return data
        },
        save: () => localStorage.setItem(storageKey, JSON.stringify(data)),
        reset: () => { localStorage.removeItem(storageKey); location.reload() },
      }
    } catch (e) {
      console.error(e)
      return { get: () => initial, set: () => {}, save: () => {}, reset: () => {} }
    }
  }

  // ---------- Components ----------
  function Nav() {
    const nav = el('div', { class: 'nav' })
    const left = el('div', { class: 'row' },
      el('div', { class: 'brand' }, 'JOIN US デモ'),
      el('span', { class: 'pill' }, 'ブラウザ完結')
    )
    const right = el('div', { class: 'row' })
    right.appendChild(btn('LP', () => go('')))
    right.appendChild(btn('Home', () => go('#/home')))
    right.appendChild(btn('Admin', () => go('#/admin')))
    nav.append(left, right)
    return nav
  }

  function LandingView() {
    const c = el('div', { class: 'cta' })
    c.append(
      el('h1', {}, '今夜、飲み友だち。アプリいりません。'),
      el('p', { class: 'muted' }, 'ブラウザで、いま近くの相手とサクッと乾杯。毎朝リセットで“今日モード”。'),
      buttonPrimary('今夜の相手を見つける', () => go('#/login')),
      el('div', { class: 'footer' }, '社内デモ用 — OTPはモックです（コード 123456）')
    )
    return c
  }

  function LoginView({ state }) {
    const s = state.get()
    const wrap = el('div', { class: 'card stack' })
    wrap.append(el('h2', {}, 'ログイン（OTPデモ）'))

    const input = textField('電話番号またはメール', s.auth.phoneOrEmail || '')
    const sendBtn = buttonPrimary('コード送信', () => toast('コードを送信しました（デモ固定: 123456）'))
    const code = textField('コード（123456）', '')
    const verify = buttonSecondary('認証する', () => {
      if (code.value.trim() === '123456') {
        s.auth.isAuthed = true
        s.auth.phoneOrEmail = input.value.trim()
        s.auth.userId = s.auth.userId || 'u_' + Math.random().toString(36).slice(2, 10)
        state.save()
        go('#/profile')
      } else {
        toast('コードが違います')
      }
    })

    wrap.append(input.label, input.input, sendBtn, code.label, code.input, verify)
    return wrap
  }

  function ProfileView({ state }) {
    const s = state.get()
    if (!s.auth.isAuthed) return Redirect('#/login')
    const wrap = el('div', { class: 'card stack' })
    wrap.append(el('h2', {}, 'プロフィール（最小）'))

    const name = textField('ニックネーム', s.profile.handle)
    const age = selectField('年代', ['20s','30s','40s','50+'], s.profile.ageRange)
    const icon = selectField('アイコン', ['🍺','🥃','🍶','🍷','🍻','🍸'], s.profile.icon)
    const drinks = multiPills('飲みたいお酒', ['beer','whisky','sake','wine','highball','sour'], s.profile.drinks)
    const group = selectField('人数', ['1','2','3'], String(s.profile.groupSize))

    const saveBtn = buttonPrimary('保存してホームへ', () => {
      s.profile.handle = name.value.trim() || 'ゲスト'
      s.profile.ageRange = age.value
      s.profile.icon = icon.value
      s.profile.drinks = drinks.get()
      s.profile.groupSize = parseInt(group.value, 10)
      ensureSelfInUsers(s)
      state.save()
      go('#/home')
    })

    wrap.append(
      name.label, name.input,
      age.label, age.select,
      icon.label, icon.select,
      drinks.label, drinks.container,
      group.label, group.select,
      saveBtn
    )
    return wrap
  }

  function HomeView({ state }) {
    const s = state.get()
    if (!s.auth.isAuthed) return Redirect('#/login')
    ensureSelfInUsers(s)
    const wrap = el('div', { class: 'stack' })

    // Presence + location
    const cardPresence = el('div', { class: 'card stack' })
    const toggle = checkboxRow('今飲む', s.presence.isActiveNow, (val) => {
      s.presence.isActiveNow = val
      s.presence.lastSeenAt = Date.now()
      state.save()
      renderList()
    })
    const locRow = el('div', { class: 'row' })
    const locBtn = buttonSecondary('位置を取得', () => requestLocation(state).then(renderList))
    locRow.append(locBtn, el('span', { class: 'pill' }, locationSummary(s.location)))
    cardPresence.append(el('h3', {}, 'プレゼンス'), toggle, locRow)

    // Filters
    const cardFilter = el('div', { class: 'card stack' })
    const radius = selectField('距離（km）', ['5','10','20'], String(s.filters.radiusKm))
    radius.select.addEventListener('change', () => { s.filters.radiusKm = parseInt(radius.value, 10); state.save(); renderList() })
    cardFilter.append(el('h3', {}, '絞り込み'), radius.label, radius.select)

    // List
    const listCard = el('div', { class: 'card stack' })
    const list = el('div', { class: 'list', id: 'nearby-list' })
    listCard.append(el('h3', {}, '近くの参加者'), list)

    wrap.append(cardPresence, cardFilter, listCard)

    // ensure seed users
    if (!s.users || s.users.length < 5) seedDemoUsers(state, 24)

    function renderList() {
      const s2 = state.get()
      list.innerHTML = ''
      const me = selfUser(s2)
      const candidates = s2.users.filter(u => u.id !== me.id && u.presence.isActiveNow)
      const nearby = candidates
        .map(u => ({ u, d: distanceKm(me.location, u.location) }))
        .filter(x => x.d != null && x.d <= s2.filters.radiusKm)
        .sort((a,b) => a.d - b.d)

      if (nearby.length === 0) {
        list.append(el('div', { class: 'muted' }, '近くに参加者がいません。距離を広げるか、seedを追加してください。'))
        return
      }

      nearby.forEach(({ u, d }) => {
        const card = el('div', { class: 'user-card' })
        card.append(
          el('div', { class: 'avatar' }, u.profile.icon || '👤'),
          el('div', { class: 'stack' },
            el('div', {}, `${u.profile.handle} ・ ${u.profile.ageRange} ・ ${u.profile.groupSize}名`),
            el('div', { class: 'row' },
              el('span', { class: 'pill' }, `${d.toFixed(1)} km`),
              el('span', { class: 'pill' }, drinksEmoji(u.profile.drinks))
            )
          ),
          btn('いいね', () => likeUser(state, me.id, u.id)),
          btn('詳細', () => go(`#/chat?with=${u.id}`))
        )
        list.append(card)
      })
    }

    setTimeout(renderList)
    return wrap
  }

  function ChatView({ state, hash }) {
    const s = state.get()
    if (!s.auth.isAuthed) return Redirect('#/login')
    const params = new URLSearchParams(hash.split('?')[1] || '')
    const withId = params.get('with')
    const me = selfUser(s)
    const other = s.users.find(u => u.id === withId)
    const wrap = el('div', { class: 'stack' })

    if (!other) return el('div', {}, '相手が見つかりません')

    const matchId = getOrCreateMatch(state, me.id, other.id)
    const thread = s.messages[matchId] || []

    const header = el('div', { class: 'card row' },
      el('div', { class: 'avatar' }, other.profile.icon),
      el('div', { class: 'stack' }, el('strong', {}, other.profile.handle), el('span', { class: 'muted' }, 'チャット（デモ保存は直近50件）'))
    )

    const list = el('div', { class: 'card stack' })
    thread.slice(-50).forEach(m => list.append(el('div', {}, `${m.from === me.id ? 'あなた' : other.profile.handle}: ${m.text}`)))

    const inputRow = el('div', { class: 'row' })
    const input = textInput('メッセージ...')
    const send = buttonPrimary('送信', () => {
      postMessage(state, matchId, me.id, input.value)
      input.value = ''
      go(`#/chat?with=${other.id}`)
    })
    const canned = buttonSecondary('定型: 今から行けます？', () => { input.value = '今から◯◯に行けます？'; })
    const share = buttonSecondary('URL共有', () => { const url = prompt('共有するURL（地図/オンライン）'); if (url) { input.value = url } })

    const reportBtn = buttonDanger('通報', () => { const reason = prompt('理由を選択/入力'); if (reason) { addReport(state, me.id, other.id, reason); toast('通報を記録しました'); }})
    const blockBtn = buttonDanger('ブロック', () => { blockUser(state, me.id, other.id); toast('ブロックしました（相互非表示）') })

    inputRow.append(input, send)
    const tools = el('div', { class: 'row' }, canned, share, reportBtn, blockBtn)

    wrap.append(header, list, el('div', { class: 'card stack' }, tools, inputRow))
    return wrap
  }

  function AdminView({ state }) {
    const s = state.get()
    const wrap = el('div', { class: 'stack' })
    const card = el('div', { class: 'card stack' })
    card.append(el('h2', {}, '管理（デモ）'))
    card.append(el('div', {}, `ユーザー数: ${s.users.length} / マッチ: ${s.matches.length} / 通報: ${s.reports.length}`))
    const seedBtn = buttonSecondary('ダミーseedを追加（+10）', () => { seedDemoUsers(state, 10); toast('追加しました'); })
    const resetBtn = buttonDanger('強制リセット（朝5時相当）', () => { state.reset() })
    const viewReports = el('div', { class: 'card stack' })
    viewReports.append(el('h3', {}, '通報ログ'))
    s.reports.slice().reverse().forEach(r => viewReports.append(el('div', {}, `${r.createdAtStr} ${r.reporter} -> ${r.target}: ${r.reason}`)))
    card.append(seedBtn, resetBtn)
    wrap.append(card, viewReports)
    return wrap
  }

  function NotFoundView() { return el('div', {}, 'ページが見つかりません') }

  // ---------- Helpers ----------
  function go(hash) { location.hash = hash }
  function Redirect(hash) { go(hash); return el('div') }

  function el(tag, attrs, ...children) {
    const element = document.createElement(tag)
    if (attrs) Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') element.className = v
      else if (k === 'for') element.htmlFor = v
      else element.setAttribute(k, v)
    })
    children.flat().forEach(c => {
      element.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)
    })
    return element
  }

  function btn(text, onClick) { const b = el('button', {}, text); b.addEventListener('click', onClick); return b }
  function buttonPrimary(text, onClick) { const b = btn(text, onClick); return b }
  function buttonSecondary(text, onClick) { const b = el('button', { class: 'secondary' }, text); b.addEventListener('click', onClick); return b }
  function buttonDanger(text, onClick) { const b = el('button', { class: 'danger' }, text); b.addEventListener('click', onClick); return b }

  function textField(labelText, value) {
    const label = el('label', {}, labelText)
    const input = el('input', { type: 'text', value })
    return { label, input, get value() { return input.value }, set value(v){ input.value = v } }
  }
  function textInput(placeholder) { return el('input', { type: 'text', placeholder }) }
  function selectField(labelText, options, value) {
    const label = el('label', {}, labelText)
    const select = el('select')
    options.forEach(o => select.appendChild(el('option', { value: o, selected: String(o) === String(value) ? '' : null }, o)))
    return { label, select, get value(){ return select.value } }
  }
  function multiPills(labelText, options, selected) {
    const label = el('label', {}, labelText)
    const container = el('div', { class: 'row', style: 'flex-wrap: wrap' })
    const set = new Set(selected)
    options.forEach(o => {
      const p = el('button', { class: set.has(o) ? '' : 'ghost' }, o)
      p.addEventListener('click', (e) => { e.preventDefault(); if (set.has(o)) set.delete(o); else set.add(o); p.className = set.has(o) ? '' : 'ghost' })
      container.appendChild(p)
    })
    return { label, container, get(){ return Array.from(set) } }
  }

  function toast(msg) {
    const t = el('div', { class: 'toast' }, msg)
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2000)
  }

  function ensureSelfInUsers(s) {
    const id = s.auth.userId
    if (!id) return
    let me = s.users.find(u => u.id === id)
    if (!me) {
      me = { id, profile: JSON.parse(JSON.stringify(s.profile)), presence: JSON.parse(JSON.stringify(s.presence)), location: JSON.parse(JSON.stringify(s.location)), blocked: [] }
      s.users.push(me)
    } else {
      me.profile = JSON.parse(JSON.stringify(s.profile))
      me.presence = JSON.parse(JSON.stringify(s.presence))
      me.location = JSON.parse(JSON.stringify(s.location))
    }
  }

  function selfUser(s) { return s.users.find(u => u.id === s.auth.userId) }

  async function requestLocation(state) {
    const s = state.get()
    if (navigator.geolocation) {
      return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition((pos) => {
          s.location.lat = pos.coords.latitude
          s.location.lng = pos.coords.longitude
          ensureSelfInUsers(s)
          state.save(); resolve()
        }, () => { manualLocationPrompt(state).then(resolve) })
      })
    } else {
      await manualLocationPrompt(state)
    }
  }

  async function manualLocationPrompt(state) {
    const s = state.get()
    const lat = parseFloat(prompt('緯度を入力（例: 35.6804）') || '')
    const lng = parseFloat(prompt('経度を入力（例: 139.7690）') || '')
    if (!isNaN(lat) && !isNaN(lng)) {
      s.location.lat = lat; s.location.lng = lng; ensureSelfInUsers(s); state.save()
    }
  }

  function locationSummary(loc) {
    if (loc.lat == null || loc.lng == null) return '未取得'
    return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`
  }

  function distanceKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return null
    const R = 6371
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2)
    const d = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x))
    return R * d
  }
  function toRad(d) { return d * Math.PI / 180 }

  function drinksEmoji(drinks) {
    const map = { beer: '🍺', whisky: '🥃', sake: '🍶', wine: '🍷', highball: '🥃', sour: '🍹' }
    return drinks.map(d => map[d] || '🍻').join(' ')
  }

  // Likes / matches / messages / block / report
  function likeUser(state, fromId, toId) {
    const s = state.get()
    if (!s.likes.find(l => l.from === fromId && l.to === toId)) {
      s.likes.push({ from: fromId, to: toId, createdAt: Date.now() })
    }
    // mutual?
    const mutual = s.likes.find(l => l.from === toId && l.to === fromId)
    if (mutual) {
      const id = getOrCreateMatch(state, fromId, toId)
      toast('マッチ成立！チャットを開始できます')
      go(`#/chat?with=${toId}`)
      return id
    }
    state.save()
  }

  function getOrCreateMatch(state, a, b) {
    const s = state.get()
    let m = s.matches.find(m => (m.a === a && m.b === b) || (m.a === b && m.b === a))
    if (!m) { m = { id: 'm_' + Math.random().toString(36).slice(2,9), a, b, createdAt: Date.now(), isActive: true }; s.matches.push(m); state.save() }
    return m.id
  }

  function postMessage(state, matchId, fromId, text) {
    const s = state.get()
    if (!s.messages[matchId]) s.messages[matchId] = []
    s.messages[matchId].push({ id: 'msg_' + Math.random().toString(36).slice(2,9), matchId, from: fromId, text, createdAt: Date.now() })
    if (s.messages[matchId].length > 50) s.messages[matchId] = s.messages[matchId].slice(-50)
    state.save()
  }

  function addReport(state, reporterId, targetId, reason) {
    const s = state.get()
    s.reports.push({ id: 'r_' + Math.random().toString(36).slice(2,9), reporter: reporterId, target: targetId, reason, createdAt: Date.now(), createdAtStr: new Date().toLocaleString() })
    state.save()
  }

  function blockUser(state, meId, otherId) {
    const s = state.get()
    const me = s.users.find(u => u.id === meId)
    const other = s.users.find(u => u.id === otherId)
    me.blocked = me.blocked || []
    other.blocked = other.blocked || []
    if (!me.blocked.includes(otherId)) me.blocked.push(otherId)
    if (!other.blocked.includes(meId)) other.blocked.push(meId)
    state.save()
  }

  // Seeding
  function seedDemoUsers(state, count) {
    const s = state.get()
    const centers = [
      { lat: 35.6812, lng: 139.7671 }, // Tokyo
      { lat: 34.6937, lng: 135.5023 }, // Osaka
      { lat: 35.1709, lng: 136.8815 }, // Nagoya
    ]
    const icons = ['🍺','🥃','🍶','🍷','🍸','🍻']
    const ages = ['20s','30s','40s','50+']
    const drinks = ['beer','whisky','sake','wine','highball','sour']
    for (let i = 0; i < count; i++) {
      const c = centers[Math.floor(Math.random()*centers.length)]
      const id = 'seed_' + Math.random().toString(36).slice(2,10)
      const u = {
        id,
        profile: {
          handle: 'ユーザー' + id.slice(-4),
          ageRange: ages[Math.floor(Math.random()*ages.length)],
          icon: icons[Math.floor(Math.random()*icons.length)],
          drinks: shuffle(drinks).slice(0, 2),
          groupSize: 1 + Math.floor(Math.random()*3)
        },
        presence: { isActiveNow: Math.random() < 0.8, lastSeenAt: Date.now() },
        location: jitter(c, 0.2), // ~200m jitter
        blocked: []
      }
      s.users.push(u)
    }
    state.save()
  }

  function jitter(center, km) {
    const dn = (Math.random()-0.5) * km
    const de = (Math.random()-0.5) * km
    const dLat = dn / 110.574
    const dLng = de / (111.320 * Math.cos(center.lat * Math.PI/180))
    return { lat: center.lat + dLat, lng: center.lng + dLng }
  }

  function shuffle(arr) { return arr.slice().sort(() => Math.random() - 0.5) }

  // Daily reset at 5:00 JST (client-side simulation)
  setInterval(() => {
    const s = state.get()
    const now = new Date()
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    if (jstNow.getHours() === 5 && jstNow.getMinutes() === 0) {
      state.reset()
    }
  }, 30000)
})()



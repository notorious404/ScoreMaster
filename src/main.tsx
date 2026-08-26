import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp,
  Dices, Download, History, Moon, Plus, RotateCw, Settings, Shield, Sun, Trophy,
  Undo2, Users, WifiOff, X, Crown, Sparkles, Award, Zap, Target, Flame,
  Printer, Share2, FileText, Home, Play, XCircle, Trash2, ShieldCheck
} from 'lucide-react'
import './styles.css'

type ExtraType = 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty'
type WicketType = 'Bowled' | 'Caught' | 'LBW' | 'Run out' | 'Stumped' | 'Hit wicket' | 'Retired hurt' | 'Retired out'
type Delivery = {
  id: string
  innings: 1 | 2
  over: number
  ball: number
  striker: string
  nonStriker: string
  bowler: string
  batterRuns: number
  extras: number
  extraType?: ExtraType
  wicket?: { type: WicketType; batter: string; fielder?: string }
  newBatter?: string
  timestamp: number
  commentary: string
}
type Player = { id: string; name: string; number: string; role: string }
type Team = { id: string; name: string; players: Player[]; captainId?: string }
type TossDetail = { caller: string; call: 'Heads' | 'Tails'; result: 'Heads' | 'Tails'; winnerId: string; decision: 'bat' | 'bowl' }

type MatchRules = {
  countWideExtra: boolean
  countNoBallExtra: boolean
  freeHitOnNoBall: boolean
}

type InningsOpeners = {
  striker: string
  nonStriker: string
  bowler: string
}

type Match = {
  id: string
  name: string
  tournament: string
  venue: string
  date: string
  overs: number
  ballType: string
  matchType: string
  teams: [Team, Team]
  battingFirst: 0 | 1
  toss?: TossDetail
  rules: MatchRules
  currentInnings: 1 | 2
  openers: { 1?: InningsOpeners; 2?: InningsOpeners }
  activeBowlerId?: string
  deliveries: Delivery[]
  isCompleted?: boolean
  createdAt: number
}

type BatterStat = { runs: number; balls: number; fours: number; sixes: number; dots: number; out?: Delivery['wicket'] }
type Snapshot = {
  runs: number
  wickets: number
  legalBalls: number
  currentOver: number
  ballInOver: number
  batters: Record<string, BatterStat>
  bowlers: Record<string, { balls: number; runs: number; wickets: number; wides: number; noBalls: number }>
  extras: Record<string, number>
  partnerships: { a: string; b: string; runs: number; balls: number }[]
  currentPair: { striker: string; nonStriker: string }
  currentBowlerId: string
  overs: { number: number; deliveries: Delivery[]; runs: number }[]
  isFreeHit: boolean
  isCompleted: boolean
}

const defaultPlayerNames = ['Aarav Sharma', 'Rohit Kumar', 'Virat Singh', 'KL Rahul', 'Hardik Patel', 'Rishabh Pant', 'Ravindra Jadeja', 'Jasprit Bumrah', 'Mohammed Shami', 'Kuldeep Yadav', 'Yuzvendra Chahal']

const seedPlayers = (prefix: string, count = 11): Player[] => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}-${i + 1}`,
  name: defaultPlayerNames[i % defaultPlayerNames.length] ? `${defaultPlayerNames[i % defaultPlayerNames.length]}${i >= 11 ? ` ${i + 1}` : ''}` : `${prefix} Player ${i + 1}`,
  number: `${i + 1}`,
  role: i === 0 ? 'Batter' : i === 1 ? 'Wicketkeeper' : i < 6 ? 'Batter' : i < 8 ? 'All-rounder' : 'Bowler'
}))

const starterMatch = (): Match => {
  const teamA: Team = { id: 'team-a', name: 'Royal Strikers', players: seedPlayers('Royal', 11), captainId: 'Royal-1' }
  const teamB: Team = { id: 'team-b', name: 'Super Kings', players: seedPlayers('Super', 11), captainId: 'Super-1' }
  return {
    id: crypto.randomUUID(),
    name: 'Sunday Super Clash',
    tournament: 'Premier Champions Trophy',
    venue: 'National Cricket Arena',
    date: new Date().toISOString().slice(0, 10),
    overs: 20,
    ballType: 'White Ball',
    matchType: 'T20 Match',
    teams: [teamA, teamB],
    battingFirst: 0,
    toss: { caller: 'team-a', call: 'Heads', result: 'Heads', winnerId: 'team-a', decision: 'bat' },
    rules: {
      countWideExtra: true,
      countNoBallExtra: true,
      freeHitOnNoBall: true
    },
    currentInnings: 1,
    openers: {},
    deliveries: [],
    createdAt: Date.now()
  }
}

function getPlayerNameWithCaptain(player: Player, team: Team) {
  if (team.captainId === player.id) {
    return `${player.name} 👑 (C)`
  }
  return player.name
}

function replayInnings(match: Match, inningsNum: 1 | 2): Snapshot {
  const deliveries = match.deliveries.filter(d => (d.innings ?? 1) === inningsNum)
  const battingTeamIdx = inningsNum === 1 ? match.battingFirst : ((1 - match.battingFirst) as 0 | 1)
  const battingTeam = match.teams[battingTeamIdx]
  const bowlingTeam = match.teams[1 - battingTeamIdx]
  const openers = match.openers[inningsNum]

  const batters: Record<string, BatterStat> = {}
  const bowlers: Snapshot['bowlers'] = {}
  const extras: Record<string, number> = { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 }
  const partnershipMap = new Map<string, { a: string; b: string; runs: number; balls: number }>()
  let runs = 0
  let wickets = 0
  let legalBalls = 0
  const overs: Snapshot['overs'] = []

  let pair = openers
    ? { striker: openers.striker, nonStriker: openers.nonStriker }
    : { striker: battingTeam.players[0]?.id ?? 'p1', nonStriker: battingTeam.players[1]?.id ?? 'p2' }

  let currentBowlerId = openers?.bowler ?? bowlingTeam.players[0]?.id ?? 'b1'
  let isFreeHit = false

  for (const d of deliveries) {
    currentBowlerId = d.bowler
    const batter = batters[d.striker] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0 }
    const bowler = bowlers[d.bowler] ??= { balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 }
    const legal = !d.extraType || !['wide', 'noBall', 'penalty'].includes(d.extraType)
    const teamRuns = d.batterRuns + d.extras
    runs += teamRuns
    legalBalls += legal ? 1 : 0

    if (legal) {
      batter.balls++
      bowler.balls++
    } else if (d.extraType === 'wide') {
      bowler.wides++
    }

    batter.runs += d.batterRuns
    batter.fours += d.batterRuns === 4 ? 1 : 0
    batter.sixes += d.batterRuns === 6 ? 1 : 0
    batter.dots += d.batterRuns === 0 && d.extras === 0 ? 1 : 0

    if (d.extraType) extras[d.extraType] = (extras[d.extraType] ?? 0) + d.extras
    bowler.runs += d.batterRuns + (d.extraType === 'bye' || d.extraType === 'legBye' ? 0 : d.extras)
    if (d.extraType === 'noBall') bowler.noBalls++

    const partnershipKey = [d.striker, d.nonStriker].sort().join('|')
    const partnership = partnershipMap.get(partnershipKey) ?? { a: d.striker, b: d.nonStriker, runs: 0, balls: 0 }
    partnership.runs += teamRuns
    partnership.balls += legal ? 1 : 0
    partnershipMap.set(partnershipKey, partnership)

    if (d.wicket) {
      wickets++
      batter.out = d.wicket
      if (!['Run out', 'Retired hurt', 'Retired out'].includes(d.wicket.type)) bowler.wickets++
      if (d.newBatter) {
        pair = d.wicket.batter === d.striker ? { striker: d.newBatter, nonStriker: d.nonStriker } : { striker: d.striker, nonStriker: d.newBatter }
      }
    }

    const over = overs.find(item => item.number === d.over) ?? { number: d.over, deliveries: [], runs: 0 }
    over.deliveries.push(d)
    over.runs += teamRuns
    if (!overs.includes(over)) overs.push(over)

    const totalRuns = d.batterRuns + d.extras
    if (totalRuns % 2 === 1) pair = { striker: pair.nonStriker, nonStriker: pair.striker }
    if (legal && d.ball === 6) pair = { striker: pair.nonStriker, nonStriker: pair.striker }

    if (d.extraType === 'noBall' && match.rules.freeHitOnNoBall) {
      isFreeHit = true
    } else if (legal) {
      isFreeHit = false
    }
  }

  const isCompleted = legalBalls >= match.overs * 6 || wickets >= Math.max(1, battingTeam.players.length - 1)

  return {
    runs,
    wickets,
    legalBalls,
    currentOver: Math.floor(legalBalls / 6) + 1,
    ballInOver: legalBalls % 6,
    batters,
    bowlers,
    extras,
    partnerships: [...partnershipMap.values()],
    currentPair: pair,
    currentBowlerId,
    overs,
    isFreeHit,
    isCompleted
  }
}

function getMatchState(match: Match) {
  const snap1 = replayInnings(match, 1)
  const snap2 = replayInnings(match, 2)

  const team1Idx = match.battingFirst
  const team2Idx = (1 - match.battingFirst) as 0 | 1
  const team1 = match.teams[team1Idx]
  const team2 = match.teams[team2Idx]

  const target = snap1.runs + 1

  let isMatchCompleted = Boolean(match.isCompleted)
  let winnerMessage = ''
  let winnerTeam: Team | null = null

  if (match.isCompleted || match.currentInnings === 2) {
    if (snap2.runs >= target) {
      isMatchCompleted = true
      winnerTeam = team2
      const wicketsLeft = (team2.players.length - 1) - snap2.wickets
      winnerMessage = `${team2.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}!`
    } else if (snap2.isCompleted || match.isCompleted) {
      isMatchCompleted = true
      if (snap2.runs < snap1.runs) {
        winnerTeam = team1
        const runDiff = snap1.runs - snap2.runs
        winnerMessage = `${team1.name} won by ${runDiff} run${runDiff === 1 ? '' : 's'}!`
      } else if (snap2.runs > snap1.runs) {
        winnerTeam = team2
        const wicketsLeft = (team2.players.length - 1) - snap2.wickets
        winnerMessage = `${team2.name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}!`
      } else {
        winnerMessage = `Match Tied! Both teams scored ${snap1.runs} runs.`
      }
    }
  }

  return {
    snap1,
    snap2,
    target,
    isMatchCompleted,
    winnerMessage,
    winnerTeam,
    currentSnap: match.currentInnings === 1 ? snap1 : snap2
  }
}

/* Hidden IFrame PDF Print function to prevent browser popup blocking */
function printMatchPdf(match: Match) {
  const snap1 = replayInnings(match, 1)
  const snap2 = replayInnings(match, 2)
  const matchState = getMatchState(match)
  const team1 = match.teams[match.battingFirst]
  const team2 = match.teams[1 - match.battingFirst]

  let iframe = document.getElementById('scoremaster-print-frame') as HTMLIFrameElement
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'scoremaster-print-frame'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow?.document
  if (!doc) return

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${match.name} - Official Match Scorecard Report</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800;900&display=swap');
          body { font-family: 'Plus Jakarta Sans', sans-serif; color: #0f172a; margin: 0; padding: 36px; background: #fff; }
          .header { text-align: center; border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 28px; font-weight: 900; color: #0284c7; letter-spacing: -0.5px; }
          .subtitle { font-size: 11px; letter-spacing: 2px; color: #64748b; text-transform: uppercase; margin-top: 3px; font-weight: 800; }
          .match-title { font-size: 22px; font-weight: 800; margin: 14px 0 4px; }
          .meta { font-size: 13px; color: #64748b; font-weight: 600; }
          .result-banner { background: linear-gradient(135deg, #091324 0%, #16243d 100%); color: #fff; padding: 18px 24px; border-radius: 14px; margin: 24px 0; text-align: center; }
          .result-banner h2 { margin: 0; font-size: 22px; color: #f59e0b; font-weight: 800; }
          .result-banner p { margin: 6px 0 0; font-size: 13px; color: #cbd5e1; }
          .section-title { font-size: 16px; font-weight: 800; color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin: 28px 0 12px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th { background: #f8fafc; text-align: left; padding: 10px 12px; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
          td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
          tr:nth-child(even) { background: #f8fafc; }
          .num { text-align: right; font-weight: 600; }
          .bold { font-weight: 700; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 40px; padding-top: 16px; font-weight: 600; }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">ScoreMaster Pro</div>
          <div class="subtitle">OFFICIAL CRICKET MATCH SCORECARD REPORT</div>
          <div class="match-title">${match.name} · ${match.tournament}</div>
          <div class="meta">${match.venue} · ${match.date} · ${match.matchType} (${match.overs} Overs)</div>
        </div>

        ${matchState.winnerMessage ? `
          <div class="result-banner">
            <h2>🏆 ${matchState.winnerMessage}</h2>
            <p>Toss: ${match.teams.find(t => t.id === match.toss?.winnerId)?.name} won toss and elected to ${match.toss?.decision}</p>
          </div>
        ` : ''}

        <!-- 1ST INNINGS BATTING -->
        <div class="section-title">1st Innings: ${team1.name} — ${snap1.runs}/${snap1.wickets} (${Math.floor(snap1.legalBalls / 6)}.${snap1.legalBalls % 6} Overs)</div>
        <table>
          <thead>
            <tr>
              <th>Batter</th>
              <th>Status</th>
              <th class="num">R</th>
              <th class="num">B</th>
              <th class="num">4s</th>
              <th class="num">6s</th>
              <th class="num">SR</th>
            </tr>
          </thead>
          <tbody>
            ${team1.players.map(p => {
              const s = snap1.batters[p.id]
              const name = p.id === team1.captainId ? `${p.name} 👑 (C)` : p.name
              const sr = s?.balls ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0'
              return `
                <tr>
                  <td class="bold">${name} <small style="color: #64748b;">(${p.role})</small></td>
                  <td>${s?.out ? s.out.type : s?.balls ? 'Not Out' : 'Did Not Bat'}</td>
                  <td class="num bold">${s?.runs ?? 0}</td>
                  <td class="num">${s?.balls ?? 0}</td>
                  <td class="num">${s?.fours ?? 0}</td>
                  <td class="num">${s?.sixes ?? 0}</td>
                  <td class="num">${sr}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <!-- 1ST INNINGS BOWLING -->
        <table>
          <thead>
            <tr>
              <th>Bowler (${team2.name})</th>
              <th class="num">O</th>
              <th class="num">R</th>
              <th class="num">W</th>
              <th class="num">Wd</th>
              <th class="num">Nb</th>
              <th class="num">Econ</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(snap1.bowlers).map(([id, s]) => {
              const bowlerPlayer = team2.players.find(p => p.id === id)
              const name = bowlerPlayer ? (bowlerPlayer.id === team2.captainId ? `${bowlerPlayer.name} 👑 (C)` : bowlerPlayer.name) : id
              const econ = s.balls ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00'
              return `
                <tr>
                  <td class="bold">${name}</td>
                  <td class="num">${Math.floor(s.balls / 6)}.${s.balls % 6}</td>
                  <td class="num">${s.runs}</td>
                  <td class="num bold">${s.wickets}</td>
                  <td class="num">${s.wides}</td>
                  <td class="num">${s.noBalls}</td>
                  <td class="num">${econ}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <!-- 2ND INNINGS BATTING -->
        <div class="section-title">2nd Innings: ${team2.name} — ${snap2.runs}/${snap2.wickets} (${Math.floor(snap2.legalBalls / 6)}.${snap2.legalBalls % 6} Overs)</div>
        <table>
          <thead>
            <tr>
              <th>Batter</th>
              <th>Status</th>
              <th class="num">R</th>
              <th class="num">B</th>
              <th class="num">4s</th>
              <th class="num">6s</th>
              <th class="num">SR</th>
            </tr>
          </thead>
          <tbody>
            ${team2.players.map(p => {
              const s = snap2.batters[p.id]
              const name = p.id === team2.captainId ? `${p.name} 👑 (C)` : p.name
              const sr = s?.balls ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0'
              return `
                <tr>
                  <td class="bold">${name} <small style="color: #64748b;">(${p.role})</small></td>
                  <td>${s?.out ? s.out.type : s?.balls ? 'Not Out' : 'Did Not Bat'}</td>
                  <td class="num bold">${s?.runs ?? 0}</td>
                  <td class="num">${s?.balls ?? 0}</td>
                  <td class="num">${s?.fours ?? 0}</td>
                  <td class="num">${s?.sixes ?? 0}</td>
                  <td class="num">${sr}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <!-- 2ND INNINGS BOWLING -->
        <table>
          <thead>
            <tr>
              <th>Bowler (${team1.name})</th>
              <th class="num">O</th>
              <th class="num">R</th>
              <th class="num">W</th>
              <th class="num">Wd</th>
              <th class="num">Nb</th>
              <th class="num">Econ</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(snap2.bowlers).map(([id, s]) => {
              const bowlerPlayer = team1.players.find(p => p.id === id)
              const name = bowlerPlayer ? (bowlerPlayer.id === team1.captainId ? `${bowlerPlayer.name} 👑 (C)` : bowlerPlayer.name) : id
              const econ = s.balls ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00'
              return `
                <tr>
                  <td class="bold">${name}</td>
                  <td class="num">${Math.floor(s.balls / 6)}.${s.balls % 6}</td>
                  <td class="num">${s.runs}</td>
                  <td class="num bold">${s.wickets}</td>
                  <td class="num">${s.wides}</td>
                  <td class="num">${s.noBalls}</td>
                  <td class="num">${econ}</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated by ScoreMaster Pro · ${new Date().toLocaleString()}
        </div>
      </body>
    </html>
  `

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
  }, 350)
}

const shareMatchScorecard = async (match: Match, onFlash?: (msg: string) => void) => {
  const snap1 = replayInnings(match, 1)
  const snap2 = replayInnings(match, 2)
  const matchState = getMatchState(match)
  const team1 = match.teams[match.battingFirst]
  const team2 = match.teams[1 - match.battingFirst]

  const shareText = `🏏 ScoreMaster Match Result 🏏\n` +
    `${match.name} (${match.venue})\n` +
    `🏆 ${matchState.winnerMessage || 'Match Completed'}\n\n` +
    `1st Innings: ${team1.name} ${snap1.runs}/${snap1.wickets} (${Math.floor(snap1.legalBalls / 6)}.${snap1.legalBalls % 6} ov)\n` +
    `2nd Innings: ${team2.name} ${snap2.runs}/${snap2.wickets} (${Math.floor(snap2.legalBalls / 6)}.${snap2.legalBalls % 6} ov)`

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${match.name} Scorecard`,
        text: shareText
      })
    } catch {
      // User cancelled share
    }
  } else {
    try {
      await navigator.clipboard.writeText(shareText)
      if (onFlash) onFlash('Match scorecard text copied to clipboard!')
    } catch {
      // Fallback
    }
  }
}

const db = {
  save: (match: Match) => new Promise<void>(resolve => {
    const request = indexedDB.open('scoremaster', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' })
    request.onsuccess = () => {
      const tx = request.result.transaction('matches', 'readwrite')
      tx.objectStore('matches').put(match)
      tx.oncomplete = () => resolve()
    }
  }),
  delete: (id: string) => new Promise<void>(resolve => {
    const request = indexedDB.open('scoremaster', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' })
    request.onsuccess = () => {
      const tx = request.result.transaction('matches', 'readwrite')
      tx.objectStore('matches').delete(id)
      tx.oncomplete = () => resolve()
    }
  }),
  load: () => new Promise<Match[]>((resolve) => {
    const request = indexedDB.open('scoremaster', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' })
    request.onsuccess = () => {
      const tx = request.result.transaction('matches', 'readonly')
      const get = tx.objectStore('matches').getAll()
      get.onsuccess = () => resolve(get.result)
    }
    request.onerror = () => resolve([])
  })
}

const exportMatch = (match: Match) => {
  const blob = new Blob([JSON.stringify(match, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${match.date}_${match.teams[0].name}_vs_${match.teams[1].name}.json`.replace(/\s+/g, '_')
  anchor.click()
  URL.revokeObjectURL(url)
}

const exportCsv = (match: Match) => {
  const header = 'Innings,Over,Ball,Striker,Non-striker,Bowler,Batter runs,Extras,Extra type,Wicket,Commentary'
  const rows = match.deliveries.map(d => [d.innings ?? 1, d.over, d.ball, d.striker, d.nonStriker, d.bowler, d.batterRuns, d.extras, d.extraType ?? '', d.wicket?.type ?? '', d.commentary].map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${match.date}_${match.teams[0].name}_vs_${match.teams[1].name}.csv`.replace(/\s+/g, '_')
  anchor.click()
  URL.revokeObjectURL(url)
}

function ConfettiCanvas() {
  useEffect(() => {
    const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: { x: number; y: number; vx: number; vy: number; size: number; color: string; rotation: number; vRot: number }[] = []
    const colors = ['#0284c7', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#10b981']

    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: (Math.random() - 0.5) * 7,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 10 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12
      })
    }

    let animId: number
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.vRot
        if (p.y > canvas.height) {
          p.y = -20
          p.x = Math.random() * canvas.width
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()
      })
      animId = requestAnimationFrame(render)
    }
    render()

    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas id="confetti-canvas" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 150 }} />
}

function App() {
  const [match, setMatch] = useState<Match>(() => starterMatch())
  const [view, setView] = useState<'home' | 'live' | 'scorecard' | 'analytics' | 'history' | 'settings'>('home')
  const [undo, setUndo] = useState<Match[]>([])
  const [redo, setRedo] = useState<Match[]>([])
  const [showSetup, setShowSetup] = useState(false)
  const [showCelebration, setShowCelebration] = useState(true)
  const [wicketOpen, setWicketOpen] = useState(false)
  const [endMatchConfirmOpen, setEndMatchConfirmOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const [dark, setDark] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])

  const matchState = useMemo(() => getMatchState(match), [match])
  const { snap1, snap2, target, isMatchCompleted, winnerMessage, currentSnap } = matchState

  const battingTeamIdx = match.currentInnings === 1 ? match.battingFirst : ((1 - match.battingFirst) as 0 | 1)
  const bowlingTeamIdx = (1 - battingTeamIdx) as 0 | 1
  const battingTeam = match.teams[battingTeamIdx]
  const bowlingTeam = match.teams[bowlingTeamIdx]

  const activeBowlerId = match.activeBowlerId ?? currentSnap.currentBowlerId ?? bowlingTeam.players[0]?.id
  const currentBowler = currentSnap.bowlers[activeBowlerId] ?? { balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 }

  const openersNeeded = !match.openers[match.currentInnings]

  const deliveriesInCurrentInnings = match.deliveries.filter(d => (d.innings ?? 1) === match.currentInnings)
  const isOverEnded = currentSnap.legalBalls > 0 && currentSnap.legalBalls % 6 === 0 && deliveriesInCurrentInnings.length > 0 && !match.activeBowlerId && !currentSnap.isCompleted && !isMatchCompleted

  const showInnings1Summary = match.currentInnings === 1 && snap1.isCompleted && !isMatchCompleted

  useEffect(() => {
    db.load().then(setMatches).catch(() => undefined)
  }, [])

  useEffect(() => {
    db.save(match).catch(() => undefined)
  }, [match])

  useEffect(() => {
    if (flash) {
      const timer = window.setTimeout(() => setFlash(''), 1500)
      return () => window.clearTimeout(timer)
    }
  }, [flash])

  const importMatch = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as Match
        if (!imported.id || !Array.isArray(imported.deliveries) || !imported.teams?.length) throw new Error('Invalid match')
        setMatch(imported)
        setShowCelebration(true)
        setMatches(history => [imported, ...history.filter(item => item.id !== imported.id)])
        setShowSetup(false)
        setView('live')
      } catch {
        setFlash('Import failed')
      }
    }
    reader.readAsText(file)
  }

  const commit = (next: Match, effect?: string) => {
    setUndo(history => [...history.slice(-30), match])
    setRedo([])
    setMatch(next)
    if (effect) setFlash(effect)
  }

  const record = (batterRuns: number, extraType?: ExtraType, userExtras = 0, wicket?: Delivery['wicket'], newBatter?: string) => {
    const innings = match.currentInnings
    const currentDeliveries = match.deliveries.filter(d => (d.innings ?? 1) === innings)
    const legalBefore = currentDeliveries.filter(d => !d.extraType || !['wide', 'noBall', 'penalty'].includes(d.extraType)).length

    const over = Math.floor(legalBefore / 6) + 1
    const ball = (legalBefore % 6) + 1

    const striker = currentSnap.currentPair.striker
    const nonStriker = currentSnap.currentPair.nonStriker
    const bowler = activeBowlerId

    let calculatedExtras = userExtras
    if (extraType === 'wide') {
      calculatedExtras = (match.rules.countWideExtra ? 1 : 0) + userExtras
    } else if (extraType === 'noBall') {
      calculatedExtras = (match.rules.countNoBallExtra ? 1 : 0) + userExtras
    }

    let label = ''
    if (wicket) {
      label = `Wicket: ${wicket.type}`
    } else if (extraType) {
      label = `${extraType === 'wide' ? 'Wide' : extraType === 'noBall' ? 'No Ball' : extraType} (+${calculatedExtras})`
    } else if (batterRuns === 4) {
      label = 'FOUR'
    } else if (batterRuns === 6) {
      label = 'SIX'
    } else {
      label = `${batterRuns} run${batterRuns === 1 ? '' : 's'}`
    }

    const delivery: Delivery = {
      id: crypto.randomUUID(),
      innings,
      over,
      ball,
      striker,
      nonStriker,
      bowler,
      batterRuns,
      extras: calculatedExtras,
      extraType,
      wicket,
      newBatter,
      timestamp: Date.now(),
      commentary: `${over}.${ball} — ${label}`
    }

    const updatedDeliveries = [...match.deliveries, delivery]
    const updatedMatch: Match = { ...match, deliveries: updatedDeliveries }

    const isLegal = !extraType || !['wide', 'noBall', 'penalty'].includes(extraType)
    const newLegalCount = legalBefore + (isLegal ? 1 : 0)
    if (isLegal && newLegalCount % 6 === 0 && newLegalCount < match.overs * 6) {
      updatedMatch.activeBowlerId = undefined
    }

    commit(updatedMatch, label)
  }

  const handleEndMatchConfirm = () => {
    const updatedMatch: Match = { ...match, isCompleted: true }
    commit(updatedMatch, 'Match Ended')
    setShowCelebration(true)
    setMatches(h => [updatedMatch, ...h.filter(m => m.id !== updatedMatch.id)])
    setEndMatchConfirmOpen(false)
  }

  const handleDeleteMatch = async (id: string) => {
    await db.delete(id)
    setMatches(history => history.filter(m => m.id !== id))
    setFlash('Match deleted')
  }

  const undoLast = () => {
    const previous = undo.at(-1)
    if (!previous) return
    setRedo(history => [...history, match])
    setUndo(history => history.slice(0, -1))
    setMatch(previous)
  }

  const redoLast = () => {
    const next = redo.at(-1)
    if (!next) return
    setUndo(history => [...history, match])
    setRedo(history => history.slice(0, -1))
    setMatch(next)
  }

  const editDelivery = (id: string, runs: number) => {
    const updated = match.deliveries.map(d => d.id === id ? { ...d, batterRuns: runs, extras: 0, extraType: undefined, commentary: `${d.over}.${d.ball} — ${runs === 4 ? 'FOUR' : runs === 6 ? 'SIX' : `${runs} run${runs === 1 ? '' : 's'}`}` } : d)
    commit({ ...match, deliveries: updated })
    setEditId(null)
  }

  const getBatterDisplayName = (id: string) => {
    const p = battingTeam.players.find(player => player.id === id)
    return p ? getPlayerNameWithCaptain(p, battingTeam) : id
  }

  const currentPairNames = [getBatterDisplayName(currentSnap.currentPair.striker), getBatterDisplayName(currentSnap.currentPair.nonStriker)]

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <header className="topbar">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
          <div className="brand-mark"><Activity size={24} /></div>
          <div>
            <strong>ScoreMaster</strong>
            <span>PRO CRICKET SCORER</span>
          </div>
        </div>
        <div className="top-actions">
          <span className="offline"><WifiOff size={15} /> Offline Ready</span>
          <button className="primary" style={{ padding: '8px 16px' }} onClick={() => { setShowSetup(true); setShowCelebration(true) }}>
            <Plus size={16} /> Start Match
          </button>
          <button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(v => !v)}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <div className="shell">
        <aside className="sidebar">
          <div className="match-chip">
            <div className="live-dot" />
            <div>
              <strong>{match.name}</strong>
              <small>{match.venue} · {match.matchType}</small>
            </div>
          </div>
          <nav>
            {[
              ['home', Home, 'Home'],
              ['live', Activity, 'Live Scoring'],
              ['scorecard', BookOpen, 'Scorecard'],
              ['analytics', BarChart3, 'Analytics'],
              ['history', History, 'Match History'],
              ['settings', Settings, 'Settings']
            ].map(([key, Icon, label]) => (
              <button
                className={view === key ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(key as typeof view)}
                key={key as string}
              >
                <Icon size={18} />
                {label}
                <ChevronRight size={14} />
              </button>
            ))}
          </nav>
          <div className="sidebar-foot">
            <Shield size={16} />
            <span>Auto-saved locally</span>
          </div>
        </aside>

        <main className="main">
          {view === 'home' && (
            <HomeView
              match={match}
              matches={matches}
              onStartNewMatch={() => { setShowSetup(true); setShowCelebration(true) }}
              onOpenMatch={m => { setMatch(m); setShowCelebration(true); setView('scorecard') }}
              onResumeMatch={m => { setMatch(m); setView('live') }}
              onFlash={setFlash}
            />
          )}
          {view === 'live' && (
            <Live
              match={match}
              snap={currentSnap}
              snap1={snap1}
              battingTeam={battingTeam}
              bowlingTeam={bowlingTeam}
              pair={currentPairNames}
              currentBowler={currentBowler}
              activeBowlerId={activeBowlerId}
              record={record}
              undoLast={undoLast}
              redoLast={redoLast}
              canUndo={undo.length > 0}
              canRedo={redo.length > 0}
              onWicket={() => setWicketOpen(true)}
              onEndMatch={() => setEndMatchConfirmOpen(true)}
              deliveries={match.deliveries.filter(d => (d.innings ?? 1) === match.currentInnings)}
              onEdit={setEditId}
              target={match.currentInnings === 2 ? target : undefined}
            />
          )}
          {view === 'scorecard' && <Scorecard match={match} snap1={snap1} snap2={snap2} onFlash={setFlash} />}
          {view === 'analytics' && <Analytics match={match} snap={currentSnap} />}
          {view === 'history' && (
            <HistoryView
              matches={matches}
              current={match}
              onOpen={m => { setMatch(m); setShowCelebration(true); setView('scorecard') }}
              onResume={m => { setMatch(m); setView('live') }}
              onNewMatch={() => { setShowSetup(true); setShowCelebration(true) }}
              onDelete={handleDeleteMatch}
              onFlash={setFlash}
            />
          )}
          {view === 'settings' && <SettingsView dark={dark} setDark={setDark} importMatch={importMatch} exportCurrent={() => exportMatch(match)} />}
        </main>
      </div>

      {showSetup && (
        <Setup
          match={match}
          onStart={(next) => {
            setMatch(next)
            setShowCelebration(true)
            setMatches(h => [next, ...h.filter(m => m.id !== next.id)])
            setShowSetup(false)
            setView('live')
          }}
          onClose={() => setShowSetup(false)}
        />
      )}

      {/* Opening Batters & Bowlers Picker Dialog */}
      {openersNeeded && !showSetup && view === 'live' && (
        <SelectOpenersDialog
          match={match}
          battingTeam={battingTeam}
          bowlingTeam={bowlingTeam}
          onConfirm={(striker, nonStriker, bowler) => {
            setMatch(m => ({
              ...m,
              openers: {
                ...m.openers,
                [m.currentInnings]: { striker, nonStriker, bowler }
              },
              activeBowlerId: bowler
            }))
          }}
        />
      )}

      {/* Select Next Bowler for Over completion */}
      {isOverEnded && !openersNeeded && !showSetup && view === 'live' && (
        <SelectBowlerDialog
          bowlingTeam={bowlingTeam}
          currentBowlerId={activeBowlerId}
          overNumber={currentSnap.currentOver}
          onConfirm={(bowlerId) => {
            setMatch(m => ({ ...m, activeBowlerId: bowlerId }))
          }}
        />
      )}

      {/* 1st Innings Completed Summary Dialog */}
      {showInnings1Summary && !showSetup && view === 'live' && (
        <Innings1SummaryDialog
          snap1={snap1}
          battingTeam={match.teams[match.battingFirst]}
          bowlingTeam={match.teams[1 - match.battingFirst]}
          target={target}
          overs={match.overs}
          onStartInnings2={() => {
            setMatch(m => ({ ...m, currentInnings: 2, activeBowlerId: undefined }))
          }}
        />
      )}

      {/* End Match Early Confirmation Dialog */}
      {endMatchConfirmOpen && (
        <EndMatchConfirmDialog
          match={match}
          onConfirm={handleEndMatchConfirm}
          onClose={() => setEndMatchConfirmOpen(false)}
        />
      )}

      {/* Winning Celebration Modal with Close Cross Button */}
      {isMatchCompleted && showCelebration && !showSetup && (
        <WinningCelebrationDialog
          winnerMessage={winnerMessage}
          winnerTeam={matchState.winnerTeam}
          snap1={snap1}
          snap2={snap2}
          match={match}
          onClose={() => setShowCelebration(false)}
          onViewScorecard={() => { setView('scorecard'); setShowCelebration(false) }}
          onNewMatch={() => { setShowSetup(true); setShowCelebration(false) }}
          onFlash={setFlash}
        />
      )}

      {wicketOpen && (
        <WicketDialog
          team={battingTeam}
          current={currentSnap.currentPair.striker}
          onClose={() => setWicketOpen(false)}
          onSave={(w, newBatter) => {
            record(0, undefined, 0, w, newBatter)
            setWicketOpen(false)
          }}
        />
      )}

      {editId && (
        <EditDialog
          delivery={match.deliveries.find(d => d.id === editId)!}
          onClose={() => setEditId(null)}
          onSave={runs => editDelivery(editId, runs)}
        />
      )}

      {flash && (
        <div className={`flash ${flash === 'SIX' ? 'six' : flash === 'FOUR' ? 'four' : flash.startsWith('Wicket') ? 'wicket' : flash.startsWith('FREE') ? 'free-hit' : 'toast'}`}>
          {flash}
        </div>
      )}
    </div>
  )
}

/* Home Landing Page Component */
function HomeView({ match, matches, onStartNewMatch, onOpenMatch, onResumeMatch, onFlash }: { match: Match; matches: Match[]; onStartNewMatch: () => void; onOpenMatch: (m: Match) => void; onResumeMatch: (m: Match) => void; onFlash?: (msg: string) => void }) {
  const totalMatches = matches.length
  const totalDeliveries = matches.reduce((sum, m) => sum + m.deliveries.length, 0)
  const totalRuns = matches.reduce((sum, m) => sum + m.deliveries.reduce((dSum, d) => dSum + d.batterRuns + d.extras, 0), 0)

  return (
    <div className="page">
      <div className="home-hero">
        <div>
          <div className="home-badge"><Sparkles size={16} /> PROFESSIONAL CRICKET SCORER SUITE</div>
          <h1>ScoreMaster Pro</h1>
          <p className="home-tagline">
            Complete live cricket scoring, automated PDF scorecards, customizable extra rules, 3D fairplay toss, and victory celebrations.
          </p>
          <div className="home-hero-btns">
            <button className="primary large hero-btn" onClick={onStartNewMatch}>
              <Play size={20} /> Start New Match
            </button>
            {match && !match.isCompleted && match.deliveries.length > 0 && (
              <button className="ghost large hero-btn" onClick={() => onResumeMatch(match)}>
                <Activity size={20} /> Resume Live Match
              </button>
            )}
          </div>
        </div>
        <div className="home-hero-graphic">
          <div className="hero-icon-card"><Trophy size={48} /></div>
          <div className="hero-stat-pill">
            <strong>{totalMatches || 1}</strong> Matches Saved
          </div>
        </div>
      </div>

      {/* Feature Highlight Cards */}
      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon" style={{ background: 'rgba(2, 132, 199, 0.12)', color: 'var(--accent)' }}><Activity size={24} /></div>
          <h3>Live Ball-by-Ball</h3>
          <p>Instant scoring with custom boundary animations, free-hit tracking, over completions & opener prompts.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon" style={{ background: 'rgba(13, 148, 136, 0.12)', color: 'var(--teal)' }}><Printer size={24} /></div>
          <h3>PDF Scorecards</h3>
          <p>One-click PDF generation & sharing containing full 1st & 2nd innings batting & bowling scorecards.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}><Crown size={24} /></div>
          <h3>Captains & Rules</h3>
          <p>Assign team captains with 👑 badges, configure wide/no-ball extra rules, and flip a 3D fairplay coin.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}><ShieldCheck size={24} /></div>
          <h3>Offline Auto-Save</h3>
          <p>All matches auto-saved securely on your device using IndexedDB with JSON backup & CSV exports.</p>
        </div>
      </div>

      {/* Recent Matches Showcase */}
      <div className="recent-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Recent Matches</h2>
          <button className="ghost" onClick={onStartNewMatch}><Plus size={16} /> New Match</button>
        </div>

        <div className="recent-list">
          {matches.slice(0, 3).map(m => {
            const r1 = replayInnings(m, 1)
            const r2 = replayInnings(m, 2)
            const matchState = getMatchState(m)

            return (
              <div className="recent-card" key={m.id}>
                <div className="recent-head">
                  <strong>{m.name}</strong>
                  <span className="recent-date">{m.date} · {m.matchType}</span>
                </div>
                <div className="recent-scores">
                  <div className="recent-team">
                    <span>{m.teams[0].name}</span>
                    <strong>{r1.runs}/{r1.wickets}</strong>
                  </div>
                  <div className="recent-vs">VS</div>
                  <div className="recent-team">
                    <span>{m.teams[1].name}</span>
                    <strong>{r2.runs}/{r2.wickets}</strong>
                  </div>
                </div>

                {matchState.winnerMessage && (
                  <div className="recent-winner">🏆 {matchState.winnerMessage}</div>
                )}

                <div className="recent-actions">
                  <button className="ghost" style={{ flex: 1 }} onClick={() => onOpenMatch(m)}>
                    <BookOpen size={15} /> Scorecard
                  </button>
                  <button className="primary" style={{ flex: 1 }} onClick={() => printMatchPdf(m)}>
                    <Printer size={15} /> Export PDF
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Live({
  match, snap, snap1, battingTeam, bowlingTeam, pair, currentBowler, activeBowlerId, record,
  undoLast, redoLast, canUndo, canRedo, onWicket, onEndMatch, deliveries, onEdit, target
}: {
  match: Match
  snap: Snapshot
  snap1: Snapshot
  battingTeam: Team
  bowlingTeam: Team
  pair: string[]
  currentBowler: Snapshot['bowlers'][string]
  activeBowlerId?: string
  record: (runs: number, type?: ExtraType, userExtras?: number) => void
  undoLast: () => void
  redoLast: () => void
  canUndo: boolean
  canRedo: boolean
  onWicket: () => void
  onEndMatch: () => void
  deliveries: Delivery[]
  onEdit: (id: string) => void
  target?: number
}) {
  const strikerId = snap.currentPair.striker
  const nonId = snap.currentPair.nonStriker
  const striker = snap.batters[strikerId] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0 }
  const non = snap.batters[nonId] ?? { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0 }
  const legal = snap.legalBalls
  const crr = legal ? (snap.runs / (legal / 6)).toFixed(2) : '0.00'
  const over = snap.overs.at(-1)

  const activeBowlerPlayer = bowlingTeam.players.find(p => p.id === activeBowlerId) ?? bowlingTeam.players[0]
  const tossWinnerTeam = match.toss ? match.teams.find(t => t.id === match.toss?.winnerId) : undefined

  const runsNeeded = target ? target - snap.runs : 0
  const ballsRemaining = match.overs * 6 - legal
  const rrr = target && ballsRemaining > 0 ? (runsNeeded / (ballsRemaining / 6)).toFixed(2) : '0.00'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            INNINGS {match.currentInnings} OF 2 · {match.ballType.toUpperCase()}
          </p>
          <h1>
            {battingTeam.name}
            {battingTeam.captainId && (
              <small className="captain-tag"><Crown size={14} /> Captain: {battingTeam.players.find(p => p.id === battingTeam.captainId)?.name}</small>
            )}
          </h1>
        </div>
        <div className="head-actions">
          <button className="danger-btn" onClick={onEndMatch}><XCircle size={16} /> End Match</button>
          <button className="ghost" onClick={undoLast} disabled={!canUndo}><Undo2 size={16} /> Undo</button>
          <button className="ghost" onClick={redoLast} disabled={!canRedo}><RotateCw size={16} /> Redo</button>
        </div>
      </div>

      <section className="score-hero">
        <div>
          <div className="score-line">
            <span>{snap.runs}</span>
            <small>/{snap.wickets}</small>
          </div>
          <div className="overs">
            {Math.floor(legal / 6)}.{legal % 6} Overs <i>·</i> CRR {crr}
          </div>

          {target && (
            <div className="target-badge">
              <Target size={14} /> Target: <strong>{target}</strong> · Need {runsNeeded} runs off {ballsRemaining} balls (RRR {rrr})
            </div>
          )}

          {match.currentInnings === 2 && (
            <div className="inn1-mini-stat">
              1st Innings: {match.teams[match.battingFirst].name} {snap1.runs}/{snap1.wickets} ({Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} ov)
            </div>
          )}

          {match.toss && tossWinnerTeam && !target && (
            <div className="toss-meta-badge">
              <Dices size={13} /> {tossWinnerTeam.name} won toss & elected to {match.toss.decision} first
            </div>
          )}
        </div>
        <div className="match-meta">
          <span>{match.name}</span>
          <strong>{match.overs} Overs Match</strong>
          <small>{match.venue} · {match.date}</small>
        </div>
      </section>

      {snap.isFreeHit && (
        <div className="free-hit-banner">
          <Zap size={18} /> FREE HIT IN PROGRESS! Batter can only be dismissed by Run Out!
        </div>
      )}

      <div className="score-grid">
        <section className="panel bat-panel">
          <div className="panel-title">
            <span>BATTERS ON STRIKE</span>
            <span className="muted">R · B · 4s · 6s · SR</span>
          </div>
          <BatterRow name={pair[0]} stat={striker} active />
          <BatterRow name={pair[1]} stat={non} />
          <div className="partnership">
            <span>PARTNERSHIP</span>
            <strong>{snap.partnerships.at(-1)?.runs ?? 0} <small>runs</small></strong>
            <small>{pair.join(' & ')} · {snap.partnerships.at(-1)?.balls ?? 0} balls</small>
          </div>
        </section>

        <section className="panel bowl-panel">
          <div className="panel-title">
            <span>CURRENT BOWLER</span>
            <span className="muted">{bowlingTeam.name}</span>
          </div>
          <div className="bowler-name">
            {activeBowlerPlayer ? getPlayerNameWithCaptain(activeBowlerPlayer, bowlingTeam) : 'Bowler'}
          </div>
          <div className="bowler-fig">
            <strong>{Math.floor(currentBowler.balls / 6)}.{currentBowler.balls % 6}</strong>
            <span>-</span>
            <strong>{currentBowler.runs}</strong>
            <span>-</span>
            <strong>{currentBowler.wickets}</strong>
          </div>
          <div className="bowler-labels">
            <span>OVERS</span>
            <span>RUNS</span>
            <span>WICKETS</span>
          </div>
          <div className="economy">
            Economy <strong>{currentBowler.balls ? (currentBowler.runs / (currentBowler.balls / 6)).toFixed(2) : '0.00'}</strong>
          </div>
        </section>
      </div>

      <section className="panel scorer">
        <div className="panel-title">
          <span>RECORD DELIVERY</span>
          <span className="muted">Over {snap.currentOver}.{snap.ballInOver + 1} · {pair[0]} on strike</span>
        </div>
        <div className="run-buttons">
          <button className="score-btn dot" onClick={() => record(0)}>0</button>
          <button className="score-btn run" onClick={() => record(1)}>1</button>
          <button className="score-btn run" onClick={() => record(2)}>2</button>
          <button className="score-btn run" onClick={() => record(3)}>3</button>
          <button className="score-btn boundary four" onClick={() => record(4)}>4 🔥</button>
          <button className="score-btn boundary six" onClick={() => record(6)}>6 🚀</button>
        </div>
        <div className="event-buttons">
          <button onClick={onWicket} className="danger"><Trophy size={16} /> Wicket</button>
          <button onClick={() => record(0, 'wide', 0)}>Wide ({match.rules.countWideExtra ? '+1' : '0'})</button>
          <button onClick={() => record(0, 'noBall', 0)}>No Ball ({match.rules.countNoBallExtra ? '+1' : '0'})</button>
          <button onClick={() => record(0, 'bye', 1)}>Bye (+1)</button>
          <button onClick={() => record(0, 'legBye', 1)}>Leg Bye (+1)</button>
          <button onClick={() => record(0, 'penalty', 5)}>Penalty (+5)</button>
        </div>
      </section>

      <div className="lower-grid">
        <section className="panel over-panel">
          <div className="panel-title">
            <span>CURRENT OVER {over?.number ?? 1}</span>
            <span className="muted">{over?.runs ?? 0} runs in over</span>
          </div>
          <div className="balls">
            {(over?.deliveries ?? []).map(d => (
              <button key={d.id} onClick={() => onEdit(d.id)} className={d.wicket ? 'ball wicket-ball' : d.batterRuns === 4 ? 'ball four-ball' : d.batterRuns === 6 ? 'ball six-ball' : 'ball'}>
                {d.wicket ? 'W' : d.extraType === 'wide' ? 'Wd' : d.extraType === 'noBall' ? 'Nb' : d.batterRuns}
              </button>
            ))}
            {Array.from({ length: Math.max(0, 6 - (over?.deliveries.length ?? 0)) }).map((_, i) => (
              <span className="ball empty" key={i}>·</span>
            ))}
          </div>
          <div className="over-note">
            <span className="live-dot" /> Click any ball to edit · Legal delivery {snap.ballInOver}/6
          </div>
        </section>

        <section className="panel timeline">
          <div className="panel-title">
            <span>LIVE COMMENTARY</span>
            <span className="muted">LATEST FIRST</span>
          </div>
          {deliveries.slice(-5).reverse().map(d => (
            <button className="commentary" key={d.id} onClick={() => onEdit(d.id)}>
              <strong>{d.over}.{d.ball}</strong>
              <span>{d.commentary.split('—')[1]}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </section>
      </div>
    </div>
  )
}

function BatterRow({ name, stat, active }: { name: string; stat: BatterStat; active?: boolean }) {
  const sr = stat.balls ? ((stat.runs / stat.balls) * 100).toFixed(1) : '0.0'
  return (
    <div className={active ? 'batter active' : 'batter'}>
      <div className="batter-name">
        {active && <span className="striker">*</span>}
        {name}
      </div>
      <strong>{stat.runs}</strong>
      <span>{stat.balls}</span>
      <span>{stat.fours}</span>
      <span>{stat.sixes}</span>
      <span className="sr">{sr}</span>
    </div>
  )
}

function Scorecard({ match, snap1, snap2, onFlash }: { match: Match; snap1: Snapshot; snap2: Snapshot; onFlash?: (msg: string) => void }) {
  const team1 = match.teams[match.battingFirst]
  const team2 = match.teams[1 - match.battingFirst]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">OFFICIAL MATCH REPORT · {match.date}</p>
          <h1>Match Scorecard</h1>
        </div>
        <div className="head-actions">
          <button className="primary" onClick={() => printMatchPdf(match)}><Printer size={16} /> PDF Scorecard</button>
          <button className="ghost" onClick={() => shareMatchScorecard(match, onFlash)}><Share2 size={16} /> Share</button>
          <button className="ghost" onClick={() => exportCsv(match)}>Export CSV</button>
          <button className="ghost" onClick={() => exportMatch(match)}><Download size={16} /> JSON Backup</button>
        </div>
      </div>

      {/* 1st Innings */}
      <h2 style={{ fontSize: 20, margin: '24px 0 12px', color: 'var(--accent)' }}>
        1st Innings: {team1.name} — {snap1.runs}/{snap1.wickets} ({Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} Overs)
      </h2>
      <section className="panel table-panel">
        <div className="table-title">
          <span>{team1.name} Batting Performance</span>
          <span>Runs · Balls · 4s · 6s · SR</span>
        </div>
        {team1.players.map(p => {
          const s = snap1.batters[p.id]
          return (
            <div className="table-row" key={p.id}>
              <strong>{getPlayerNameWithCaptain(p, team1)} <small style={{ color: 'var(--muted)', fontWeight: 500 }}>({p.role})</small></strong>
              <span>{s?.runs ?? 0}</span>
              <span>{s?.balls ?? 0}</span>
              <span>{s?.fours ?? 0}</span>
              <span>{s?.sixes ?? 0}</span>
              <span>{s?.balls ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0'}</span>
              <small>{s?.out ? s.out.type : s?.balls ? 'Not Out' : 'Did Not Bat'}</small>
            </div>
          )
        })}
      </section>

      {/* 2nd Innings */}
      <h2 style={{ fontSize: 20, margin: '36px 0 12px', color: 'var(--teal)' }}>
        2nd Innings: {team2.name} — {snap2.runs}/{snap2.wickets} ({Math.floor(snap2.legalBalls / 6)}.{snap2.legalBalls % 6} Overs)
      </h2>
      <section className="panel table-panel">
        <div className="table-title">
          <span>{team2.name} Batting Performance</span>
          <span>Runs · Balls · 4s · 6s · SR</span>
        </div>
        {team2.players.map(p => {
          const s = snap2.batters[p.id]
          return (
            <div className="table-row" key={p.id}>
              <strong>{getPlayerNameWithCaptain(p, team2)} <small style={{ color: 'var(--muted)', fontWeight: 500 }}>({p.role})</small></strong>
              <span>{s?.runs ?? 0}</span>
              <span>{s?.balls ?? 0}</span>
              <span>{s?.fours ?? 0}</span>
              <span>{s?.sixes ?? 0}</span>
              <span>{s?.balls ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0'}</span>
              <small>{s?.out ? s.out.type : s?.balls ? 'Not Out' : 'Did Not Bat'}</small>
            </div>
          )
        })}
      </section>
    </div>
  )
}

function Analytics({ match, snap }: { match: Match; snap: Snapshot }) {
  const max = Math.max(...snap.overs.map(o => o.runs), 1)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">PERFORMANCE LAB</p>
          <h1>Match Analytics</h1>
        </div>
        <div className="tag"><BarChart3 size={15} /> Calculated from {match.deliveries.length} deliveries</div>
      </div>

      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-title">
            <span>RUNS PER OVER (CURRENT INNINGS)</span>
            <span className="muted">MANHATTAN CHART</span>
          </div>
          <div className="chart">
            {snap.overs.map(o => (
              <div className="bar-wrap" key={o.number}>
                <div className="bar" style={{ height: `${Math.max(6, (o.runs / max) * 160)}px` }}>
                  <span>{o.runs}</span>
                </div>
                <small>Ov {o.number}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel insight-panel">
          <div className="panel-title"><span>KEY HIGHLIGHTS</span></div>
          <div className="insight">
            <strong>{snap.runs ? (snap.runs / Math.max(snap.legalBalls, 1) * 6).toFixed(2) : '0.00'}</strong>
            <span>Current Run Rate</span>
          </div>
          <div className="insight">
            <strong>{snap.legalBalls ? Math.round((Object.values(snap.batters).reduce((sum, s) => sum + s.dots, 0) / snap.legalBalls) * 100) : 0}%</strong>
            <span>Dot Ball Percentage</span>
          </div>
          <div className="insight">
            <strong>{Object.values(snap.batters).reduce((sum, s) => sum + s.fours, 0)} / {Object.values(snap.batters).reduce((sum, s) => sum + s.sixes, 0)}</strong>
            <span>Boundaries (Fours / Sixes)</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function HistoryView({ matches, current, onOpen, onResume, onNewMatch, onDelete, onFlash }: { matches: Match[]; current: Match; onOpen: (m: Match) => void; onResume: (m: Match) => void; onNewMatch: () => void; onDelete: (id: string) => void; onFlash?: (msg: string) => void }) {
  const list = matches.some(m => m.id === current.id) ? matches : [current, ...matches]
  const sortedList = [...list].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">MATCH ARCHIVE</p>
          <h1>Saved Match History</h1>
        </div>
        <button className="primary" onClick={onNewMatch}><Plus size={17} /> Start New Match</button>
      </div>

      <div className="history-list">
        {sortedList.map(m => {
          const r1 = replayInnings(m, 1)
          const r2 = replayInnings(m, 2)
          const isOngoing = !m.isCompleted

          return (
            <div className="history-item-row" key={m.id}>
              <div className="history-item-main" onClick={() => onOpen(m)}>
                <div className="history-date">
                  {m.date}
                  <small>{m.matchType} {isOngoing ? '· LIVE' : ''}</small>
                </div>
                <div className="history-teams">
                  <strong>{m.teams[0].name}</strong>
                  <span>VS</span>
                  <strong>{m.teams[1].name}</strong>
                </div>
                <div className="history-score">
                  Inn 1: {r1.runs}/{r1.wickets} | Inn 2: {r2.runs}/{r2.wickets}
                </div>
              </div>

              <div className="history-item-actions">
                {isOngoing && (
                  <button className="icon-btn-text primary-btn" title="Resume Live Scoring" onClick={() => onResume(m)}>
                    <Play size={14} /> Resume
                  </button>
                )}
                <button
                  className="icon-btn-text primary-subtle"
                  title="Export PDF Scorecard"
                  onClick={() => printMatchPdf(m)}
                >
                  <Printer size={14} /> PDF
                </button>
                <button
                  className="icon-btn-text ghost-subtle"
                  title="Share Scorecard"
                  onClick={() => shareMatchScorecard(m, onFlash)}
                >
                  <Share2 size={14} /> Share
                </button>
                <button
                  className="icon-btn-text danger-subtle"
                  title="Delete Match"
                  onClick={() => onDelete(m.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SettingsView({ dark, setDark, importMatch, exportCurrent }: { dark: boolean; setDark: (v: boolean) => void; importMatch: (file: File) => void; exportCurrent: () => void }) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h1>App Settings</h1>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="setting">
          <div>
            <strong>Appearance Theme</strong>
            <small>Toggle light/dark mode for daylight ground conditions</small>
          </div>
          <button className="toggle" onClick={() => setDark(!dark)}>
            {dark ? <Moon size={16} /> : <Sun size={16} />} {dark ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>
        <div className="setting">
          <div>
            <strong>Animations & Celebration Effects</strong>
            <small>Confetti fireworks and boundary popups</small>
          </div>
          <button className="toggle on"><Check size={16} /> Enabled</button>
        </div>
        <div className="setting">
          <div>
            <strong>Data Storage</strong>
            <small>Matches are saved securely on this device via IndexedDB</small>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="toggle" onClick={exportCurrent}><Download size={16} /> Export JSON</button>
            <label className="toggle" style={{ cursor: 'pointer' }}>
              <Download size={16} /> Import JSON
              <input type="file" accept="application/json" hidden onChange={e => { const file = e.target.files?.[0]; if (file) importMatch(file) }} />
            </label>
          </div>
        </div>
      </section>
    </div>
  )
}

/* Multi-Step Setup Modal Wizard with 50/50 Coin Toss Fix */
function Setup({ match, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [draft, setDraft] = useState<Match>(match)

  const [tossCaller, setTossCaller] = useState<0 | 1>(0)
  const [tossCall, setTossCall] = useState<'Heads' | 'Tails'>('Heads')
  const [isSpinning, setIsSpinning] = useState(false)
  const [tossResult, setTossResult] = useState<'Heads' | 'Tails' | null>(null)
  const [tossWinnerIndex, setTossWinnerIndex] = useState<0 | 1 | null>(null)
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null)
  const [coinRotation, setCoinRotation] = useState(0)

  const updateTeamName = (index: 0 | 1, name: string) => {
    setDraft(m => ({
      ...m,
      teams: m.teams.map((t, i) => i === index ? { ...t, name } : t) as [Team, Team]
    }))
  }

  const setCaptain = (teamIndex: 0 | 1, captainId: string) => {
    setDraft(m => ({
      ...m,
      teams: m.teams.map((t, i) => i === teamIndex ? { ...t, captainId } : t) as [Team, Team]
    }))
  }

  const setPlayerCount = (index: 0 | 1, count: number) => {
    setDraft(m => ({
      ...m,
      teams: m.teams.map((t, i) => {
        if (i !== index) return t
        const currentPlayers = t.players
        const prefix = index === 0 ? 'Team1' : 'Team2'
        const updated = Array.from({ length: count }, (_, idx) => {
          if (currentPlayers[idx]) return currentPlayers[idx]
          return {
            id: `${prefix}-${idx + 1}-${Date.now()}`,
            name: `${prefix} Player ${idx + 1}`,
            number: `${idx + 1}`,
            role: 'Batter'
          }
        })
        const newCaptainId = t.captainId && updated.some(p => p.id === t.captainId) ? t.captainId : updated[0]?.id
        return { ...t, players: updated, captainId: newCaptainId }
      }) as [Team, Team]
    }))
  }

  const updatePlayer = (teamIndex: 0 | 1, playerIndex: number, field: keyof Player, value: string) => {
    setDraft(m => ({
      ...m,
      teams: m.teams.map((t, i) => {
        if (i !== teamIndex) return t
        const players = t.players.map((p, pIdx) => pIdx === playerIndex ? { ...p, [field]: value } : p)
        return { ...t, players }
      }) as [Team, Team]
    }))
  }

  const handleFlipCoin = () => {
    if (isSpinning) return
    setIsSpinning(true)
    setTossResult(null)
    setTossWinnerIndex(null)
    setTossDecision(null)

    // True 50/50 random roll
    const result: 'Heads' | 'Tails' = Math.random() < 0.5 ? 'Heads' : 'Tails'
    const winner = (tossCall === result) ? tossCaller : ((1 - tossCaller) as 0 | 1)

    // 1800deg for Heads, 1980deg for Tails (180deg flip)
    const targetRotation = coinRotation + (result === 'Heads' ? 1800 : 1980)
    setCoinRotation(targetRotation)

    setTimeout(() => {
      setTossResult(result)
      setTossWinnerIndex(winner)
      setIsSpinning(false)
    }, 1500)
  }

  const handleSelectDecision = (decision: 'bat' | 'bowl') => {
    setTossDecision(decision)
    if (tossWinnerIndex !== null) {
      const battingFirstIndex = decision === 'bat' ? tossWinnerIndex : ((1 - tossWinnerIndex) as 0 | 1)
      setDraft(m => ({
        ...m,
        battingFirst: battingFirstIndex,
        toss: {
          caller: draft.teams[tossCaller].id,
          call: tossCall,
          result: tossResult ?? 'Heads',
          winnerId: draft.teams[tossWinnerIndex].id,
          decision
        }
      }))
    }
  }

  const isStep1Valid = draft.name.trim() && draft.overs > 0
  const isStep2Valid = draft.teams[0].name.trim() && draft.teams[0].players.every(p => p.name.trim()) && Boolean(draft.teams[0].captainId)
  const isStep3Valid = draft.teams[1].name.trim() && draft.teams[1].players.every(p => p.name.trim()) && Boolean(draft.teams[1].captainId)
  const isStep4Valid = tossWinnerIndex !== null && tossDecision !== null

  return (
    <div className="setup-backdrop">
      <div className="setup">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="setup-brand">
            <div className="brand-mark"><Activity size={22} /></div>
            <div>
              <strong>ScoreMaster Setup</strong>
              <span>NEW MATCH CREATION WIZARD</span>
            </div>
          </div>
          {onClose && (
            <button className="icon-btn" onClick={onClose}><X size={20} /></button>
          )}
        </div>

        {/* 4-Step Progress Bar */}
        <div className="setup-progress">
          <div className={`step-node ${step > 1 ? 'done' : step === 1 ? 'current' : ''}`}>
            <span>1</span>
            <div className="step-label">Details</div>
          </div>
          <i />
          <div className={`step-node ${step > 2 ? 'done' : step === 2 ? 'current' : ''}`}>
            <span>2</span>
            <div className="step-label">{draft.teams[0].name || 'Team 1'}</div>
          </div>
          <i />
          <div className={`step-node ${step > 3 ? 'done' : step === 3 ? 'current' : ''}`}>
            <span>3</span>
            <div className="step-label">{draft.teams[1].name || 'Team 2'}</div>
          </div>
          <i />
          <div className={`step-node ${step === 4 ? 'current' : ''}`}>
            <span>4</span>
            <div className="step-label">Toss</div>
          </div>
        </div>

        {/* STEP 1: Match Details & Rules */}
        {step === 1 && (
          <div>
            <p className="eyebrow">STEP 1 OF 4 · MATCH CONFIGURATION & RULES</p>
            <h2>Match Details & Scoring Rules</h2>
            <p className="setup-copy">Set tournament name, overs, venue, and extra run rules.</p>

            <div className="form-grid">
              <label>
                Match Name
                <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Finals 2026" />
              </label>
              <label>
                Tournament / Series
                <input value={draft.tournament} onChange={e => setDraft({ ...draft, tournament: e.target.value })} placeholder="e.g. City Championship" />
              </label>
              <label>
                Venue Ground
                <input value={draft.venue} onChange={e => setDraft({ ...draft, venue: e.target.value })} placeholder="e.g. National Stadium" />
              </label>
              <label>
                Date
                <input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
              </label>
              <label>
                Match Format
                <select value={draft.matchType} onChange={e => setDraft({ ...draft, matchType: e.target.value })}>
                  <option>T20 Match</option>
                  <option>ODI (50 Overs)</option>
                  <option>10-Over Sprint</option>
                  <option>Gully / Street Cricket</option>
                  <option>Custom Match</option>
                </select>
              </label>
              <label>
                Overs Limit
                <input type="number" min="1" max="100" value={draft.overs} onChange={e => setDraft({ ...draft, overs: Math.max(1, Number(e.target.value)) })} />
              </label>
            </div>

            {/* Custom Rules Options */}
            <div className="rules-section">
              <h3 style={{ fontSize: 16, margin: '24px 0 12px', color: 'var(--accent)' }}>🏏 Extra Run & Free Hit Settings</h3>
              <div className="rules-grid">
                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={draft.rules.countWideExtra}
                    onChange={e => setDraft({ ...draft, rules: { ...draft.rules, countWideExtra: e.target.checked } })}
                  />
                  <div>
                    <strong>Count +1 Extra Run for Wide</strong>
                    <small>Standard international rule gives 1 penalty run for a wide</small>
                  </div>
                </label>

                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={draft.rules.countNoBallExtra}
                    onChange={e => setDraft({ ...draft, rules: { ...draft.rules, countNoBallExtra: e.target.checked } })}
                  />
                  <div>
                    <strong>Count +1 Extra Run for No-Ball</strong>
                    <small>Standard international rule gives 1 penalty run for a no-ball</small>
                  </div>
                </label>

                <label className="checkbox-card">
                  <input
                    type="checkbox"
                    checked={draft.rules.freeHitOnNoBall}
                    onChange={e => setDraft({ ...draft, rules: { ...draft.rules, freeHitOnNoBall: e.target.checked } })}
                  />
                  <div>
                    <strong>Grant Free Hit on No-Ball</strong>
                    <small>Subsequent delivery after a No-Ball is a Free Hit (batter cannot be out)</small>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Team 1 Roster & Captain Selection */}
        {step === 2 && (
          <div>
            <p className="eyebrow">STEP 2 OF 4 · FIRST TEAM ROSTER & CAPTAIN</p>
            <h2>Configure {draft.teams[0].name}</h2>
            <p className="setup-copy">Set team name, select squad size, assign team captain, and enter player details.</p>

            <div className="roster-header">
              <label style={{ flex: 1, maxWidth: 280 }}>
                Team 1 Name
                <input value={draft.teams[0].name} onChange={e => updateTeamName(0, e.target.value)} placeholder="Team 1 Name" />
              </label>
              <label style={{ flex: 1, maxWidth: 280 }}>
                👑 Select Team Captain
                <select
                  value={draft.teams[0].captainId ?? draft.teams[0].players[0]?.id}
                  onChange={e => setCaptain(0, e.target.value)}
                >
                  {draft.teams[0].players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ width: 130 }}>
                Squad Size
                <select value={draft.teams[0].players.length} onChange={e => setPlayerCount(0, Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 2).map(n => (
                    <option key={n} value={n}>{n} Players</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="roster-grid">
              {draft.teams[0].players.map((p, idx) => {
                const isCaptain = draft.teams[0].captainId === p.id
                return (
                  <div key={p.id} className={`player-card-input ${isCaptain ? 'is-captain' : ''}`}>
                    <div className="player-num">#{idx + 1}</div>
                    <input
                      value={p.name}
                      onChange={e => updatePlayer(0, idx, 'name', e.target.value)}
                      placeholder={`Player ${idx + 1} Name`}
                    />
                    <select value={p.role} onChange={e => updatePlayer(0, idx, 'role', e.target.value)}>
                      <option>Batter</option>
                      <option>Bowler</option>
                      <option>All-rounder</option>
                      <option>Wicketkeeper</option>
                    </select>
                    <button
                      className={`captain-btn ${isCaptain ? 'active' : ''}`}
                      title={isCaptain ? 'Team Captain' : 'Make Captain'}
                      onClick={() => setCaptain(0, p.id)}
                    >
                      <Crown size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Team 2 Roster & Captain Selection */}
        {step === 3 && (
          <div>
            <p className="eyebrow">STEP 3 OF 4 · SECOND TEAM ROSTER & CAPTAIN</p>
            <h2>Configure {draft.teams[1].name}</h2>
            <p className="setup-copy">Set team name, select squad size, assign team captain, and enter player details.</p>

            <div className="roster-header">
              <label style={{ flex: 1, maxWidth: 280 }}>
                Team 2 Name
                <input value={draft.teams[1].name} onChange={e => updateTeamName(1, e.target.value)} placeholder="Team 2 Name" />
              </label>
              <label style={{ flex: 1, maxWidth: 280 }}>
                👑 Select Team Captain
                <select
                  value={draft.teams[1].captainId ?? draft.teams[1].players[0]?.id}
                  onChange={e => setCaptain(1, e.target.value)}
                >
                  {draft.teams[1].players.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ width: 130 }}>
                Squad Size
                <select value={draft.teams[1].players.length} onChange={e => setPlayerCount(1, Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 2).map(n => (
                    <option key={n} value={n}>{n} Players</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="roster-grid">
              {draft.teams[1].players.map((p, idx) => {
                const isCaptain = draft.teams[1].captainId === p.id
                return (
                  <div key={p.id} className={`player-card-input ${isCaptain ? 'is-captain' : ''}`}>
                    <div className="player-num">#{idx + 1}</div>
                    <input
                      value={p.name}
                      onChange={e => updatePlayer(1, idx, 'name', e.target.value)}
                      placeholder={`Player ${idx + 1} Name`}
                    />
                    <select value={p.role} onChange={e => updatePlayer(1, idx, 'role', e.target.value)}>
                      <option>Batter</option>
                      <option>Bowler</option>
                      <option>All-rounder</option>
                      <option>Wicketkeeper</option>
                    </select>
                    <button
                      className={`captain-btn ${isCaptain ? 'active' : ''}`}
                      title={isCaptain ? 'Team Captain' : 'Make Captain'}
                      onClick={() => setCaptain(1, p.id)}
                    >
                      <Crown size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Interactive Fairplay Coin Toss */}
        {step === 4 && (
          <div>
            <p className="eyebrow">STEP 4 OF 4 · FAIRPLAY COIN TOSS</p>
            <h2>The Official Toss</h2>
            <p className="setup-copy">Randomized 50/50 fair coin toss to decide who bats or bowls first.</p>

            <div className="toss-card">
              <div className="toss-selectors">
                <label>
                  Calling Team
                  <select value={tossCaller} onChange={e => setTossCaller(Number(e.target.value) as 0 | 1)} disabled={isSpinning || tossWinnerIndex !== null}>
                    <option value={0}>{draft.teams[0].name}</option>
                    <option value={1}>{draft.teams[1].name}</option>
                  </select>
                </label>
                <label>
                  Call Choice
                  <select value={tossCall} onChange={e => setTossCall(e.target.value as 'Heads' | 'Tails')} disabled={isSpinning || tossWinnerIndex !== null}>
                    <option value="Heads">Heads</option>
                    <option value="Tails">Tails</option>
                  </select>
                </label>
              </div>

              {/* 3D Animated Coin */}
              <div className="coin-stage">
                <div className="coin" style={{ transform: `rotateY(${coinRotation}deg)` }}>
                  <div className="coin-face coin-heads">
                    <span style={{ fontSize: 24 }}>🪙</span>
                    HEADS
                  </div>
                  <div className="coin-face coin-tails">
                    <span style={{ fontSize: 24 }}>🏏</span>
                    TAILS
                  </div>
                </div>
              </div>

              {tossWinnerIndex === null ? (
                <button className="primary large" onClick={handleFlipCoin} disabled={isSpinning}>
                  <Dices size={20} /> {isSpinning ? 'Flipping Coin...' : 'Flip Coin Now'}
                </button>
              ) : (
                <div className="toss-result-box">
                  <h3 style={{ margin: 0, color: 'var(--teal)', fontSize: 22 }}>
                    Toss Result: {tossResult}!
                  </h3>
                  <p style={{ margin: '8px 0 16px', fontWeight: 700, fontSize: 16 }}>
                    🎉 {draft.teams[tossWinnerIndex].name} won the toss!
                  </p>

                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px' }}>Select Decision:</p>
                  <div className="toss-decision-btns">
                    <button
                      className={tossDecision === 'bat' ? 'primary' : 'ghost'}
                      onClick={() => handleSelectDecision('bat')}
                    >
                      Elect to Bat
                    </button>
                    <button
                      className={tossDecision === 'bowl' ? 'primary' : 'ghost'}
                      onClick={() => handleSelectDecision('bowl')}
                    >
                      Elect to Bowl
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wizard Action Footer */}
        <div className="setup-footer">
          <div>
            {step > 1 && (
              <button className="ghost" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3 | 4)}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {step === 1 && (
              <button className="primary large" onClick={() => setStep(2)} disabled={!isStep1Valid}>
                Next: {draft.teams[0].name || 'Team 1'} Roster <ChevronRight size={18} />
              </button>
            )}
            {step === 2 && (
              <button className="primary large" onClick={() => setStep(3)} disabled={!isStep2Valid}>
                Next: {draft.teams[1].name || 'Team 2'} Roster <ChevronRight size={18} />
              </button>
            )}
            {step === 3 && (
              <button className="primary large" onClick={() => setStep(4)} disabled={!isStep3Valid}>
                Next: Fairplay Coin Toss <ChevronRight size={18} />
              </button>
            )}
            {step === 4 && (
              <button className="primary large" onClick={() => onStart(draft)} disabled={!isStep4Valid}>
                Start Live Match <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* Dialog to Select Opening Batters & Bowler at Innings Start */
function SelectOpenersDialog({ match, battingTeam, bowlingTeam, onConfirm }: { match: Match; battingTeam: Team; bowlingTeam: Team; onConfirm: (striker: string, nonStriker: string, bowler: string) => void }) {
  const [striker, setStriker] = useState(battingTeam.players[0]?.id ?? '')
  const [nonStriker, setNonStriker] = useState(battingTeam.players[1]?.id ?? '')
  const [bowler, setBowler] = useState(bowlingTeam.players[0]?.id ?? '')

  const isValid = striker && nonStriker && bowler && striker !== nonStriker

  return (
    <div className="dialog-backdrop">
      <div className="dialog large-dialog">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">INNINGS {match.currentInnings} INITIAL SETUP</p>
            <h2>Select Opening Players</h2>
          </div>
        </div>
        <p className="setup-copy" style={{ margin: '0 0 16px' }}>
          Choose the Striker, Non-Striker for <strong>{battingTeam.name}</strong>, and Opening Bowler for <strong>{bowlingTeam.name}</strong>.
        </p>

        <div className="form-grid">
          <label>
            🏏 Striker Batter
            <select value={striker} onChange={e => setStriker(e.target.value)}>
              {battingTeam.players.map(p => (
                <option key={p.id} value={p.id}>{getPlayerNameWithCaptain(p, battingTeam)}</option>
              ))}
            </select>
          </label>

          <label>
            🏏 Non-Striker Batter
            <select value={nonStriker} onChange={e => setNonStriker(e.target.value)}>
              {battingTeam.players.filter(p => p.id !== striker).map(p => (
                <option key={p.id} value={p.id}>{getPlayerNameWithCaptain(p, battingTeam)}</option>
              ))}
            </select>
          </label>
        </div>

        <label style={{ marginTop: 16 }}>
          ⚡ Opening Bowler
          <select value={bowler} onChange={e => setBowler(e.target.value)}>
            {bowlingTeam.players.map(p => (
              <option key={p.id} value={p.id}>{getPlayerNameWithCaptain(p, bowlingTeam)} ({p.role})</option>
            ))}
          </select>
        </label>

        <div className="dialog-actions">
          <button className="primary large" disabled={!isValid} onClick={() => onConfirm(striker, nonStriker, bowler)}>
            Confirm & Start Innings <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Dialog to Select Next Bowler after an Over ends */
function SelectBowlerDialog({ bowlingTeam, currentBowlerId, overNumber, onConfirm }: { bowlingTeam: Team; currentBowlerId?: string; overNumber: number; onConfirm: (bowlerId: string) => void }) {
  const [selected, setSelected] = useState(bowlingTeam.players.find(p => p.id !== currentBowlerId)?.id ?? bowlingTeam.players[0]?.id ?? '')

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">OVER COMPLETED</p>
            <h2>Select Bowler for Over {overNumber}</h2>
          </div>
        </div>
        <p className="setup-copy" style={{ margin: '0 0 16px' }}>
          Over {overNumber - 1} is finished! Select the player coming in to bowl Over {overNumber} for <strong>{bowlingTeam.name}</strong>.
        </p>

        <label>
          ⚡ Next Bowler
          <select value={selected} onChange={e => setSelected(e.target.value)}>
            {bowlingTeam.players.map(p => (
              <option key={p.id} value={p.id}>
                {getPlayerNameWithCaptain(p, bowlingTeam)} {p.id === currentBowlerId ? '(Bowled Previous Over)' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="dialog-actions">
          <button className="primary" onClick={() => onConfirm(selected)}>
            Confirm Bowler <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Dialog showing 1st Innings Score & Target before starting 2nd Innings */
function Innings1SummaryDialog({ snap1, battingTeam, bowlingTeam, target, overs, onStartInnings2 }: { snap1: Snapshot; battingTeam: Team; bowlingTeam: Team; target: number; overs: number; onStartInnings2: () => void }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog large-dialog text-center">
        <div className="trophy-badge"><Flame size={32} /></div>
        <p className="eyebrow" style={{ marginTop: 12 }}>1ST INNINGS COMPLETED</p>
        <h2 style={{ fontSize: 26, margin: '4px 0 12px' }}>{battingTeam.name} Innings Finished</h2>

        <div className="inn-summary-card">
          <div className="score">{snap1.runs}/{snap1.wickets}</div>
          <div className="meta">{Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} Overs · CRR {snap1.legalBalls ? (snap1.runs / (snap1.legalBalls / 6)).toFixed(2) : '0.00'}</div>
        </div>

        <div className="target-summary-card">
          <strong>TARGET FOR {bowlingTeam.name.toUpperCase()}</strong>
          <div className="target-score">{target} Runs</div>
          <small>Need {target} runs from {overs * 6} balls to win</small>
        </div>

        <div className="dialog-actions" style={{ justifyContent: 'center', marginTop: 24 }}>
          <button className="primary large" onClick={onStartInnings2}>
            Start 2nd Innings Scoring <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* End Match Confirmation Dialog */
function EndMatchConfirmDialog({ match, onConfirm, onClose }: { match: Match; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog text-center">
        <div className="trophy-badge" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
          <XCircle size={36} />
        </div>
        <h2 style={{ fontSize: 22, margin: '16px 0 8px', color: '#ef4444' }}>End Match Early?</h2>
        <p className="setup-copy" style={{ margin: '0 0 20px' }}>
          Are you sure you want to end <strong>{match.name}</strong> now? Current figures will be finalized and saved to Match History.
        </p>

        <div className="dialog-actions" style={{ justifyContent: 'center', gap: 12 }}>
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="danger-btn large" onClick={onConfirm}>Yes, End Match & Save</button>
        </div>
      </div>
    </div>
  )
}

/* Celebration Dialog on Winning Match with Close Cross Button */
function WinningCelebrationDialog({ winnerMessage, winnerTeam, snap1, snap2, match, onClose, onViewScorecard, onNewMatch, onFlash }: { winnerMessage: string; winnerTeam: Team | null; snap1: Snapshot; snap2: Snapshot; match: Match; onClose: () => void; onViewScorecard: () => void; onNewMatch: () => void; onFlash?: (msg: string) => void }) {
  return (
    <div className="dialog-backdrop">
      <ConfettiCanvas />
      <div className="dialog celebration-dialog">
        <button className="icon-btn close-celebration-btn" aria-label="Close celebration dialog" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="winner-crown-icon">
          <Trophy size={48} />
        </div>
        <p className="eyebrow" style={{ color: '#f59e0b', fontSize: 13, letterSpacing: 3 }}>MATCH CONCLUDED</p>
        <h1 className="winner-heading">{winnerMessage}</h1>

        <div className="final-scorecard-mini">
          <div className="mini-team">
            <strong>{match.teams[match.battingFirst].name} (1st Inn)</strong>
            <span>{snap1.runs}/{snap1.wickets} ({Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} ov)</span>
          </div>
          <div className="mini-vs">VS</div>
          <div className="mini-team">
            <strong>{match.teams[1 - match.battingFirst].name} (2nd Inn)</strong>
            <span>{snap2.runs}/{snap2.wickets} ({Math.floor(snap2.legalBalls / 6)}.{snap2.legalBalls % 6} ov)</span>
          </div>
        </div>

        <div className="saved-badge">
          <Check size={16} /> Match saved to history automatically
        </div>

        <div className="celebration-actions">
          <button className="primary" onClick={() => printMatchPdf(match)}>
            <Printer size={16} /> Export PDF Scorecard
          </button>
          <button className="ghost" onClick={() => shareMatchScorecard(match, onFlash)}>
            <Share2 size={16} /> Share Scorecard
          </button>
          <button className="ghost" onClick={onViewScorecard}>
            Full Scorecard
          </button>
          <button className="primary" onClick={onNewMatch}>
            New Match <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function WicketDialog({ team, current, onClose, onSave }: { team: Team; current: string; onClose: () => void; onSave: (w: Delivery['wicket'], next: string) => void }) {
  const [type, setType] = useState<WicketType>('Bowled')
  const [batter, setBatter] = useState(current)
  const [next, setNext] = useState(team.players.find(p => p.id !== current)?.id ?? '')

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">DELIVERY EVENT</p>
            <h2>Record Wicket</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <label>
          Dismissal Type
          <select value={type} onChange={e => setType(e.target.value as WicketType)}>
            {['Bowled', 'Caught', 'LBW', 'Run out', 'Stumped', 'Hit wicket', 'Retired hurt', 'Retired out'].map(v => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Dismissed Batter
          <select value={batter} onChange={e => setBatter(e.target.value)}>
            {team.players.map(p => <option key={p.id} value={p.id}>{getPlayerNameWithCaptain(p, team)}</option>)}
          </select>
        </label>
        <label>
          Next Batter Coming In
          <select value={next} onChange={e => setNext(e.target.value)}>
            {team.players.filter(p => p.id !== batter).map(p => <option key={p.id} value={p.id}>{getPlayerNameWithCaptain(p, team)}</option>)}
          </select>
        </label>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave({ type, batter }, next)}>Confirm Wicket</button>
        </div>
      </div>
    </div>
  )
}

function EditDialog({ delivery, onClose, onSave }: { delivery: Delivery; onClose: () => void; onSave: (runs: number) => void }) {
  const [runs, setRuns] = useState(delivery.batterRuns)

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">EDIT DELIVERY · {delivery.over}.{delivery.ball}</p>
            <h2>Change Decision</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="warning">
          <CircleHelp size={17} /> Changing this delivery rebuilds the entire innings and updates subsequent figures.
        </p>
        <div className="edit-runs">
          {[0, 1, 2, 3, 4, 6].map(n => (
            <button className={runs === n ? 'selected' : ''} onClick={() => setRuns(n)} key={n}>{n}</button>
          ))}
        </div>
        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={() => onSave(runs)}>Save Correction</button>
        </div>
      </div>
    </div>
  )
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

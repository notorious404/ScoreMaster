import { StrictMode, useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Activity, BarChart3, BookOpen, Check, ChevronLeft, ChevronRight, CircleHelp,
  Dices, Download, History, Moon, Plus, RotateCw, Settings, Shield, Sun, Trophy,
  Undo2, Users, WifiOff, X, Crown, Sparkles, Award, Zap, Target, Flame,
  Printer, Share2, FileText, Home, Play, XCircle, Trash2, ShieldCheck, Pin, PinOff
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
  isPinned?: boolean
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

const blankMatch = (): Match => {
  const teamA: Team = { id: 'team-a', name: 'Team 1', players: seedPlayers('Team1', 11), captainId: 'Team1-1' }
  const teamB: Team = { id: 'team-b', name: 'Team 2', players: seedPlayers('Team2', 11), captainId: 'Team2-1' }
  return {
    id: crypto.randomUUID(),
    name: 'New Cricket Match',
    tournament: 'Tournament',
    venue: 'Main Ground',
    date: new Date().toISOString().slice(0, 10),
    overs: 20,
    ballType: 'White Ball',
    matchType: 'T20 Match',
    teams: [teamA, teamB],
    battingFirst: 0,
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
  const emptySnap: Snapshot = {
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    currentOver: 1,
    ballInOver: 0,
    batters: {},
    bowlers: {},
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 },
    partnerships: [],
    currentPair: { striker: 'p1', nonStriker: 'p2' },
    currentBowlerId: 'b1',
    overs: [],
    isFreeHit: false,
    isCompleted: false
  }

  if (!match || !Array.isArray(match.teams) || match.teams.length < 2) return emptySnap

  const deliveries = (match.deliveries || []).filter(d => (d?.innings ?? 1) === inningsNum)
  const battingFirst = match.battingFirst ?? 0
  const battingTeamIdx = inningsNum === 1 ? battingFirst : ((1 - battingFirst) as 0 | 1)
  const battingTeam = match.teams[battingTeamIdx] ?? match.teams[0]
  const bowlingTeam = match.teams[1 - battingTeamIdx] ?? match.teams[1]
  if (!battingTeam || !bowlingTeam) return emptySnap

  const openers = match.openers ? match.openers[inningsNum] : undefined

  const p1 = battingTeam.players?.[0]?.id ?? 'p1'
  const p2 = battingTeam.players?.[1]?.id ?? 'p2'
  const b1 = bowlingTeam.players?.[0]?.id ?? 'b1'

  const batters: Record<string, BatterStat> = {}
  const bowlers: Snapshot['bowlers'] = {}
  const extras: Record<string, number> = { wide: 0, noBall: 0, bye: 0, legBye: 0, penalty: 0 }
  const partnershipMap = new Map<string, { a: string; b: string; runs: number; balls: number }>()
  let runs = 0
  let wickets = 0
  let legalBalls = 0
  const overs: Snapshot['overs'] = []

  let pair = (openers && openers.striker && openers.nonStriker)
    ? { striker: openers.striker, nonStriker: openers.nonStriker }
    : { striker: p1, nonStriker: p2 }

  let currentBowlerId = openers?.bowler ?? b1
  let isFreeHit = false

  for (const d of deliveries) {
    if (!d || !d.striker || !d.bowler) continue
    currentBowlerId = d.bowler
    const batter = batters[d.striker] ??= { runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0 }
    const bowler = bowlers[d.bowler] ??= { balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 }
    const legal = !d.extraType || !['wide', 'noBall', 'penalty'].includes(d.extraType)
    const teamRuns = (d.batterRuns ?? 0) + (d.extras ?? 0)
    runs += teamRuns
    legalBalls += legal ? 1 : 0

    if (legal) {
      batter.balls++
      bowler.balls++
    } else if (d.extraType === 'wide') {
      bowler.wides++
    }

    batter.runs += d.batterRuns ?? 0
    batter.fours += d.batterRuns === 4 ? 1 : 0
    batter.sixes += d.batterRuns === 6 ? 1 : 0
    batter.dots += d.batterRuns === 0 && (d.extras ?? 0) === 0 ? 1 : 0

    if (d.extraType) extras[d.extraType] = (extras[d.extraType] ?? 0) + (d.extras ?? 0)
    bowler.runs += (d.batterRuns ?? 0) + (d.extraType === 'bye' || d.extraType === 'legBye' ? 0 : (d.extras ?? 0))
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

    const totalRuns = (d.batterRuns ?? 0) + (d.extras ?? 0)
    if (totalRuns % 2 === 1) pair = { striker: pair.nonStriker, nonStriker: pair.striker }
    if (legal && d.ball === 6) pair = { striker: pair.nonStriker, nonStriker: pair.striker }

    if (d.extraType === 'noBall' && match.rules?.freeHitOnNoBall) {
      isFreeHit = true
    } else if (legal) {
      isFreeHit = false
    }
  }

  const maxOvers = match.overs ?? 20
  const maxWickets = Math.max(1, (battingTeam.players?.length ?? 11) - 1)
  const isCompleted = legalBalls >= maxOvers * 6 || wickets >= maxWickets

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
  const safeMatch = match && Array.isArray(match.teams) && match.teams.length === 2 ? match : blankMatch()
  const snap1 = replayInnings(safeMatch, 1)
  const snap2 = replayInnings(safeMatch, 2)

  const team1Idx = safeMatch.battingFirst ?? 0
  const team2Idx = (1 - team1Idx) as 0 | 1
  const team1 = safeMatch.teams[team1Idx]
  const team2 = safeMatch.teams[team2Idx]

  const target = snap1.runs + 1

  let isMatchCompleted = Boolean(safeMatch.isCompleted)
  let winnerMessage = ''
  let winnerTeam: Team | null = null

  const currentInnings = safeMatch.currentInnings ?? 1

  if (safeMatch.isCompleted || currentInnings === 2) {
    if (snap2.runs >= target) {
      isMatchCompleted = true
      winnerTeam = team2
      const wicketsLeft = ((team2?.players?.length ?? 11) - 1) - snap2.wickets
      winnerMessage = `${team2?.name ?? 'Team 2'} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}!`
    } else if (snap2.isCompleted || safeMatch.isCompleted) {
      isMatchCompleted = true
      if (snap2.runs < snap1.runs) {
        winnerTeam = team1
        const runDiff = snap1.runs - snap2.runs
        winnerMessage = `${team1?.name ?? 'Team 1'} won by ${runDiff} run${runDiff === 1 ? '' : 's'}!`
      } else if (snap2.runs > snap1.runs) {
        winnerTeam = team2
        const wicketsLeft = ((team2?.players?.length ?? 11) - 1) - snap2.wickets
        winnerMessage = `${team2?.name ?? 'Team 2'} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? '' : 's'}!`
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
    currentSnap: currentInnings === 1 ? snap1 : snap2
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
  clearAll: () => new Promise<void>(resolve => {
    const request = indexedDB.open('scoremaster', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('matches', { keyPath: 'id' })
    request.onsuccess = () => {
      const tx = request.result.transaction('matches', 'readwrite')
      tx.objectStore('matches').clear()
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
  const [match, setMatch] = useState<Match>(() => blankMatch())
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

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

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
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    })

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    } else {
      setShowInstallModal(true)
    }
  }

  useEffect(() => {
    db.load().then(loaded => {
      const realMatches = loaded.filter(m => m.name !== 'Sunday Super Clash')
      if (realMatches.length !== loaded.length) {
        db.clearAll().then(() => {
          realMatches.forEach(m => db.save(m))
        }).catch(() => undefined)
      }
      setMatches(realMatches)
      if (realMatches.length > 0) {
        setMatch(realMatches[0])
      }
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (match.deliveries.length > 0 || matches.some(m => m.id === match.id)) {
      db.save(match).catch(() => undefined)
    }
  }, [match, matches])

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

  const handleTogglePin = (id: string) => {
    setMatches(history => history.map(m => {
      if (m.id === id) {
        const updated = { ...m, isPinned: !m.isPinned }
        db.save(updated).catch(() => undefined)
        return updated
      }
      return m
    }))
    if (match.id === id) {
      setMatch(m => ({ ...m, isPinned: !m.isPinned }))
    }
  }

  const handleClearAllMatches = async () => {
    await db.clearAll()
    setMatches([])
    setFlash('Match history cleared')
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

  const hasActiveDeliveries = match.deliveries.length > 0

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
          <button className="primary-subtle icon-btn-text install-btn" onClick={handleInstallApp}>
            <Download size={15} /> {isInstalled ? 'App Installed' : 'Install App'}
          </button>
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
            <div className={hasActiveDeliveries ? "live-dot" : "live-dot idle"} />
            <div>
              <strong>{hasActiveDeliveries ? match.name : "No Active Match"}</strong>
              <small>{hasActiveDeliveries ? `${match.venue} · ${match.matchType}` : "Click Start Match"}</small>
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
              onInstallApp={handleInstallApp}
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
          {view === 'analytics' && (
            <Analytics
              matches={matches}
              currentMatch={match}
              onSelectMatch={m => { setMatch(m); setView('analytics') }}
            />
          )}
          {view === 'history' && (
            <HistoryView
              matches={matches}
              current={match}
              onOpen={m => { setMatch(m); setShowCelebration(true); setView('scorecard') }}
              onResume={m => { setMatch(m); setView('live') }}
              onNewMatch={() => { setShowSetup(true); setShowCelebration(true) }}
              onDelete={handleDeleteMatch}
              onTogglePin={handleTogglePin}
              onClearAll={handleClearAllMatches}
              onFlash={setFlash}
            />
          )}
          {view === 'settings' && (
            <SettingsView
              dark={dark}
              setDark={setDark}
              importMatch={importMatch}
              exportCurrent={() => exportMatch(match)}
              onInstallApp={handleInstallApp}
            />
          )}
        </main>
      </div>

      {showInstallModal && (
        <InstallAppGuideDialog
          onClose={() => setShowInstallModal(false)}
          onInstall={deferredPrompt ? handleInstallApp : undefined}
        />
      )}

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
          onClose={() => setView('home')}
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
          onClose={() => setView('home')}
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
          onClose={() => setView('scorecard')}
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

function InstallAppGuideDialog({ onClose, onInstall }: { onClose: () => void; onInstall?: () => void }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog install-guide-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="stadium-badge" style={{ width: 44, height: 44, margin: 0 }}><Download size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>Install ScoreMaster App</h2>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>100% offline scoring on Android, iPhone, Mac, or Windows</p>
            </div>
          </div>
          <button className="icon-btn-text ghost" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="install-guide-body">
          <div className="install-benefit-card">
            <ShieldCheck size={24} style={{ color: 'var(--teal)', flex: 'none' }} />
            <div>
              <strong>100% Local Device Storage & Offline Ready</strong>
              <span>All scorecards, team rosters, and match history are stored strictly on your local device via IndexedDB. Internet connection is NEVER required!</span>
            </div>
          </div>

          <div className="install-steps-grid">
            <div className="install-step-card">
              <div className="step-tag">Desktop / Chrome / Edge</div>
              <h4>Direct 1-Click Install</h4>
              <p>Click the <strong>"Install App"</strong> button in your browser address bar or click below.</p>
              {onInstall && (
                <button className="primary install-cta-btn" onClick={onInstall}>
                  <Download size={16} /> Click to Install Now
                </button>
              )}
            </div>

            <div className="install-step-card">
              <div className="step-tag">iPhone / iPad (Safari)</div>
              <h4>Add to Home Screen</h4>
              <ol className="install-list">
                <li>Tap the <strong>Share button</strong> ( 📤 ) in Safari.</li>
                <li>Scroll down and tap <strong>"Add to Home Screen"</strong> ( ➕ ).</li>
                <li>Tap <strong>Add</strong> at top right.</li>
              </ol>
            </div>

            <div className="install-step-card">
              <div className="step-tag">Android (Chrome)</div>
              <h4>Add to Home Screen</h4>
              <ol className="install-list">
                <li>Tap the <strong>3 dots menu</strong> ( ⋮ ) in Chrome.</li>
                <li>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="dialog-actions" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

/* Home Landing Page Component */
function HomeView({ match, matches, onStartNewMatch, onOpenMatch, onResumeMatch, onInstallApp, onFlash }: { match: Match; matches: Match[]; onStartNewMatch: () => void; onOpenMatch: (m: Match) => void; onResumeMatch: (m: Match) => void; onInstallApp?: () => void; onFlash?: (msg: string) => void }) {
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
            {onInstallApp && (
              <button className="primary-subtle large hero-btn" onClick={onInstallApp}>
                <Download size={18} /> Install App (100% Offline)
              </button>
            )}
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
            <strong>{totalMatches}</strong> Matches Saved
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
          <h3>100% Offline Ready</h3>
          <p>All matches auto-saved securely on your device using IndexedDB with JSON backup & CSV exports.</p>
        </div>
      </div>

      {/* Recent Matches Showcase */}
      <div className="recent-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Recent Matches</h2>
          <button className="ghost" onClick={onStartNewMatch}><Plus size={16} /> New Match</button>
        </div>

        {matches.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            No saved matches yet. Click <strong>Start New Match</strong> to begin scoring your first match!
          </div>
        ) : (
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
                      <span>{m?.teams?.[0]?.name ?? 'Team 1'}</span>
                      <strong>{r1.runs}/{r1.wickets}</strong>
                    </div>
                    <div className="recent-vs">VS</div>
                    <div className="recent-team">
                      <span>{m?.teams?.[1]?.name ?? 'Team 2'}</span>
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
                      <Printer size={15} /> PDF
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsView({ dark, setDark, importMatch, exportCurrent, onInstallApp }: { dark: boolean; setDark: (v: boolean) => void; importMatch: (file: File) => void; exportCurrent: () => void; onInstallApp?: () => void }) {
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
            <strong>Offline App Installation (PWA)</strong>
            <small>Install ScoreMaster onto your home screen or desktop for 100% offline access</small>
          </div>
          <button className="toggle primary-subtle" onClick={onInstallApp}>
            <Download size={16} /> Install App
          </button>
        </div>
        <div className="setting">
          <div>
            <strong>Local Storage Security</strong>
            <small>100% stored on local device (IndexedDB) with zero internet dependency</small>
          </div>
          <button className="toggle on"><ShieldCheck size={16} /> Secured Locally</button>
        </div>
        <div className="setting">
          <div>
            <strong>Backup & Data Transfer</strong>
            <small>Export or import match files in JSON format</small>
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

  const totalExtras1 = Object.values(snap1.extras).reduce((sum, n) => sum + n, 0)
  const totalExtras2 = Object.values(snap2.extras).reduce((sum, n) => sum + n, 0)

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

      {/* 1st Innings Batting */}
      <h2 style={{ fontSize: 20, margin: '24px 0 12px', color: 'var(--accent)' }}>
        1st Innings: {team1.name} — {snap1.runs}/{snap1.wickets} ({Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} Overs)
      </h2>
      <section className="panel table-panel">
        <div className="table-title">
          <span>🏏 {team1.name} Batting Performance</span>
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
        <div className="scorecard-extras-row">
          <strong>Extras: {totalExtras1} runs</strong>
          <small>(Wides: {snap1.extras.wide ?? 0}, No Balls: {snap1.extras.noBall ?? 0}, Byes: {snap1.extras.bye ?? 0}, Leg Byes: {snap1.extras.legBye ?? 0})</small>
        </div>
      </section>

      {/* 1st Innings Bowling */}
      <section className="panel table-panel" style={{ marginTop: 16 }}>
        <div className="table-title">
          <span>⚡ {team2.name} Bowling Figures</span>
          <span>Overs · Runs · Wickets · Econ</span>
        </div>
        {Object.entries(snap1.bowlers).length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No bowling overs recorded in 1st Innings yet</div>
        ) : (
          Object.entries(snap1.bowlers).map(([id, s]) => {
            const bowlerPlayer = team2.players.find(p => p.id === id)
            const name = bowlerPlayer ? getPlayerNameWithCaptain(bowlerPlayer, team2) : id
            const econ = s.balls ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00'

            return (
              <div className="table-row" key={id}>
                <strong>{name}</strong>
                <span>{Math.floor(s.balls / 6)}.{s.balls % 6} ov</span>
                <span>{s.runs} r</span>
                <span className="bold-stat">{s.wickets} w</span>
                <span>Econ {econ}</span>
                <small>Wd: {s.wides} · Nb: {s.noBalls}</small>
              </div>
            )
          })
        )}
      </section>

      {/* 2nd Innings Batting */}
      <h2 style={{ fontSize: 20, margin: '36px 0 12px', color: 'var(--teal)' }}>
        2nd Innings: {team2.name} — {snap2.runs}/{snap2.wickets} ({Math.floor(snap2.legalBalls / 6)}.{snap2.legalBalls % 6} Overs)
      </h2>
      <section className="panel table-panel">
        <div className="table-title">
          <span>🏏 {team2.name} Batting Performance</span>
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
        <div className="scorecard-extras-row">
          <strong>Extras: {totalExtras2} runs</strong>
          <small>(Wides: {snap2.extras.wide ?? 0}, No Balls: {snap2.extras.noBall ?? 0}, Byes: {snap2.extras.bye ?? 0}, Leg Byes: {snap2.extras.legBye ?? 0})</small>
        </div>
      </section>

      {/* 2nd Innings Bowling */}
      <section className="panel table-panel" style={{ marginTop: 16 }}>
        <div className="table-title">
          <span>⚡ {team1.name} Bowling Figures</span>
          <span>Overs · Runs · Wickets · Econ</span>
        </div>
        {Object.entries(snap2.bowlers).length === 0 ? (
          <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>No bowling overs recorded in 2nd Innings yet</div>
        ) : (
          Object.entries(snap2.bowlers).map(([id, s]) => {
            const bowlerPlayer = team1.players.find(p => p.id === id)
            const name = bowlerPlayer ? getPlayerNameWithCaptain(bowlerPlayer, team1) : id
            const econ = s.balls ? (s.runs / (s.balls / 6)).toFixed(2) : '0.00'

            return (
              <div className="table-row" key={id}>
                <strong>{name}</strong>
                <span>{Math.floor(s.balls / 6)}.{s.balls % 6} ov</span>
                <span>{s.runs} r</span>
                <span className="bold-stat">{s.wickets} w</span>
                <span>Econ {econ}</span>
                <small>Wd: {s.wides} · Nb: {s.noBalls}</small>
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}

function ScoringDonutChart({ fours, sixes, runningRuns, extras }: { fours: number; sixes: number; runningRuns: number; extras: number }) {
  const fourRuns = fours * 4
  const sixRuns = sixes * 6
  const total = fourRuns + sixRuns + runningRuns + extras

  if (total === 0) {
    return (
      <div className="empty-donut-box">
        <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>No runs scored in this innings yet</div>
      </div>
    )
  }

  const pFours = (fourRuns / total) * 100
  const pSixes = (sixRuns / total) * 100
  const pRunning = (runningRuns / total) * 100
  const pExtras = (extras / total) * 100

  const r = 38
  const circ = 2 * Math.PI * r

  const sFours = (pFours / 100) * circ
  const sSixes = (pSixes / 100) * circ
  const sRunning = (pRunning / 100) * circ
  const sExtras = (pExtras / 100) * circ

  let offset = 0
  const oFours = offset
  offset -= sFours
  const oSixes = offset
  offset -= sSixes
  const oRunning = offset
  offset -= sRunning
  const oExtras = offset

  return (
    <div className="donut-chart-container">
      <div className="donut-svg-stage">
        <svg width="150" height="150" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--line)" strokeWidth="14" />
          {sFours > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#ea580c" strokeWidth="14" strokeDasharray={`${sFours} ${circ - sFours}`} strokeDashoffset={oFours} />}
          {sSixes > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#0d9488" strokeWidth="14" strokeDasharray={`${sSixes} ${circ - sSixes}`} strokeDashoffset={oSixes} />}
          {sRunning > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#0284c7" strokeWidth="14" strokeDasharray={`${sRunning} ${circ - sRunning}`} strokeDashoffset={oRunning} />}
          {sExtras > 0 && <circle cx="50" cy="50" r={r} fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray={`${sExtras} ${circ - sExtras}`} strokeDashoffset={oExtras} />}
        </svg>
        <div className="donut-center-text">
          <strong>{total}</strong>
          <small>RUNS</small>
        </div>
      </div>

      <div className="donut-legend-grid">
        <div className="donut-legend-item">
          <span className="legend-chip" style={{ background: '#ea580c' }} />
          <div><strong>Fours (4s)</strong><span>{fourRuns} pts ({pFours.toFixed(0)}%)</span></div>
        </div>
        <div className="donut-legend-item">
          <span className="legend-chip" style={{ background: '#0d9488' }} />
          <div><strong>Sixes (6s)</strong><span>{sixRuns} pts ({pSixes.toFixed(0)}%)</span></div>
        </div>
        <div className="donut-legend-item">
          <span className="legend-chip" style={{ background: '#0284c7' }} />
          <div><strong>Singles / 2s / 3s</strong><span>{runningRuns} pts ({pRunning.toFixed(0)}%)</span></div>
        </div>
        <div className="donut-legend-item">
          <span className="legend-chip" style={{ background: '#f59e0b' }} />
          <div><strong>Extras</strong><span>{extras} pts ({pExtras.toFixed(0)}%)</span></div>
        </div>
      </div>
    </div>
  )
}

function getTopBatter(snap: Snapshot, team: Team) {
  const entries = Object.entries(snap.batters)
  if (!entries.length) return null
  entries.sort((a, b) => b[1].runs - a[1].runs || a[1].balls - b[1].balls)
  const [id, stat] = entries[0]
  const player = team.players.find(p => p.id === id)
  return { player, stat, id }
}

function getTopBowler(snap: Snapshot, team: Team) {
  const entries = Object.entries(snap.bowlers)
  if (!entries.length) return null
  entries.sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs)
  const [id, stat] = entries[0]
  const player = team.players.find(p => p.id === id)
  return { player, stat, id }
}

function Analytics({ matches, currentMatch, onSelectMatch }: { matches: Match[]; currentMatch: Match; onSelectMatch?: (m: Match) => void }) {
  const allMatches = useMemo(() => {
    const list = matches.some(m => m.id === currentMatch.id) ? matches : [currentMatch, ...matches]
    return list.filter(m => m && m.teams?.length === 2)
  }, [matches, currentMatch])

  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'inn1' | 'inn2' | 'compare'>('inn1')

  const selectedMatch = allMatches.find(m => m.id === selectedMatchId) ?? null

  const matchState = useMemo(() => {
    if (!selectedMatch) return null
    return {
      snap1: replayInnings(selectedMatch, 1),
      snap2: replayInnings(selectedMatch, 2),
      state: getMatchState(selectedMatch)
    }
  }, [selectedMatch])

  if (!selectedMatch || !matchState) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">PERFORMANCE LAB</p>
            <h1>Match Analytics</h1>
          </div>
          <div className="tag"><BarChart3 size={15} /> {allMatches.length} Matches Available</div>
        </div>

        <div className="panel select-analytics-prompt">
          <div className="stadium-badge"><Trophy size={42} /></div>
          <h2>Select a Match to Analyze</h2>
          <p className="setup-copy" style={{ maxWidth: 520, margin: '8px auto 24px' }}>
            Choose any match from your cricket history below to inspect over-by-over Manhattan charts, dot ball counts, boundary ratios, extras, and top batter/bowler spells.
          </p>

          <div className="analytics-match-picker-grid">
            {allMatches.map(m => {
              const r1 = replayInnings(m, 1)
              const r2 = replayInnings(m, 2)

              return (
                <div className="analytics-match-card" key={m.id} onClick={() => setSelectedMatchId(m.id)}>
                  <div className="card-head">
                    <strong>{m.name}</strong>
                    <span>{m.date}</span>
                  </div>
                  <div className="card-teams">
                    <div>{m?.teams?.[0]?.name ?? 'Team 1'} <strong>{r1.runs}/{r1.wickets}</strong></div>
                    <small>vs</small>
                    <div>{m?.teams?.[1]?.name ?? 'Team 2'} <strong>{r2.runs}/{r2.wickets}</strong></div>
                  </div>
                  <div className="card-foot">
                    <span>{m.matchType} · {m.overs} Overs</span>
                    <button className="primary-subtle icon-btn-text">
                      Analyze Match <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })}

            {allMatches.length === 0 && (
              <div className="empty-analytics-card" style={{ gridColumn: '1 / -1' }}>
                <BarChart3 size={48} style={{ color: 'var(--muted)', opacity: 0.6 }} />
                <h3>No saved matches found</h3>
                <p>Start a new match to record live scores and view performance analytics.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const { snap1, snap2, state } = matchState
  const currentSnap = state.currentSnap
  const hasInnings2 = selectedMatch.deliveries.some(d => d.innings === 2) || selectedMatch.currentInnings === 2

  const team1 = selectedMatch.teams[selectedMatch.battingFirst]
  const team2 = selectedMatch.teams[1 - selectedMatch.battingFirst]

  const activeSnap = tab === 'inn1' ? snap1 : tab === 'inn2' ? snap2 : currentSnap
  const activeTeam = tab === 'inn1' ? team1 : team2
  const opponentTeam = tab === 'inn1' ? team2 : team1

  const totalDeliveries = selectedMatch.deliveries.length

  // Calculate metrics
  const totalDots = Object.values(activeSnap.batters).reduce((sum, s) => sum + s.dots, 0)
  const dotPct = activeSnap.legalBalls ? Math.round((totalDots / activeSnap.legalBalls) * 100) : 0

  const totalFours = Object.values(activeSnap.batters).reduce((sum, s) => sum + s.fours, 0)
  const totalSixes = Object.values(activeSnap.batters).reduce((sum, s) => sum + s.sixes, 0)
  const boundaryRuns = totalFours * 4 + totalSixes * 6
  const boundaryPct = activeSnap.runs ? Math.round((boundaryRuns / activeSnap.runs) * 100) : 0

  const totalExtras = Object.values(activeSnap.extras).reduce((sum, count) => sum + count, 0)

  const topBatter = getTopBatter(activeSnap, activeTeam)
  const topBowler = getTopBowler(activeSnap, opponentTeam)

  const maxRunsPerOver = Math.max(...activeSnap.overs.map(o => o.runs), 6)
  const avgRpo = activeSnap.legalBalls ? (activeSnap.runs / (activeSnap.legalBalls / 6)) : 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">PERFORMANCE LAB · ANALYZING MATCH</p>
          <h1>{selectedMatch.name}</h1>
        </div>
        <div className="head-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            className="match-select-dropdown"
            value={selectedMatchId}
            onChange={e => {
              if (e.target.value === '') setSelectedMatchId(null)
              else setSelectedMatchId(e.target.value)
            }}
          >
            <option value="">-- Switch Match --</option>
            {allMatches.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.teams[0].name} vs {m.teams[1].name})</option>
            ))}
          </select>
          <button className="ghost" onClick={() => setSelectedMatchId(null)}>
            Change Match
          </button>
        </div>
      </div>

      {/* Innings Selector Tabs */}
      <div className="analytics-tabs-row">
        <button
          className={`tab-btn ${tab === 'inn1' ? 'active' : ''}`}
          onClick={() => setTab('inn1')}
        >
          1st Innings: {team1.name} ({snap1.runs}/{snap1.wickets})
        </button>
        <button
          className={`tab-btn ${tab === 'inn2' ? 'active' : ''}`}
          onClick={() => setTab('inn2')}
        >
          2nd Innings: {team2.name} ({snap2.runs}/{snap2.wickets})
        </button>
        {hasInnings2 && (
          <button
            className={`tab-btn ${tab === 'compare' ? 'active' : ''}`}
            onClick={() => setTab('compare')}
          >
            📊 Compare Both Innings
          </button>
        )}
      </div>

      {tab !== 'compare' ? (
        activeSnap.legalBalls === 0 && activeSnap.overs.length === 0 ? (
          <div className="panel empty-analytics-card">
            <BarChart3 size={48} style={{ color: 'var(--muted)', opacity: 0.6 }} />
            <h3>No delivery data recorded yet for {activeTeam.name}</h3>
            <p>Balls recorded during Live Scoring will generate real-time Manhattan charts, run rates, boundary stats, and bowler spell analysis.</p>
          </div>
        ) : (
          <div className="analytics-content">
            {/* Top Overview Cards */}
            <div className="analytics-stat-grid">
              <div className="analytics-card">
                <div className="card-label">TOTAL SCORE</div>
                <div className="card-val">{activeSnap.runs}/{activeSnap.wickets}</div>
                <div className="card-sub">{Math.floor(activeSnap.legalBalls / 6)}.{activeSnap.legalBalls % 6} Overs</div>
              </div>
              <div className="analytics-card">
                <div className="card-label">RUN RATE</div>
                <div className="card-val">{activeSnap.legalBalls ? (activeSnap.runs / (activeSnap.legalBalls / 6)).toFixed(2) : '0.00'}</div>
                <div className="card-sub">Runs Per Over</div>
              </div>
              <div className="analytics-card">
                <div className="card-label">DOT BALLS</div>
                <div className="card-val">{dotPct}%</div>
                <div className="card-sub">{totalDots} Dots out of {activeSnap.legalBalls} balls</div>
              </div>
              <div className="analytics-card">
                <div className="card-label">BOUNDARIES</div>
                <div className="card-val">{totalFours}x4 · {totalSixes}x6</div>
                <div className="card-sub">{boundaryRuns} runs ({boundaryPct}% of score)</div>
              </div>
            </div>

            {/* Manhattan Chart & Donut Chart Section */}
            <div className="analytics-two-col">
              <section className="panel chart-panel" style={{ flex: 1.4 }}>
                <div className="panel-title">
                  <span>RUNS PER OVER — {activeTeam.name.toUpperCase()}</span>
                  <span className="muted">MANHATTAN BAR CHART</span>
                </div>
                <div className="chart-wrapper">
                  <div className="chart">
                    {activeSnap.overs.map(o => {
                      const height = Math.max(12, (o.runs / maxRunsPerOver) * 160)
                      const isBigOver = o.runs >= 12
                      const wicketsInOver = o.deliveries.filter(d => d.wicket).length

                      return (
                        <div className="bar-wrap" key={o.number}>
                          <div
                            className={`bar ${isBigOver ? 'high-run' : o.runs === 0 ? 'maiden' : ''}`}
                            style={{ height: `${height}px` }}
                          >
                            <span>{o.runs}</span>
                            {wicketsInOver > 0 && <div className="wicket-indicator">W</div>}
                          </div>
                          <small>Ov {o.number}</small>
                        </div>
                      )
                    })}
                  </div>
                  <div className="chart-legend">
                    <span>Avg RPO: <strong>{avgRpo.toFixed(2)}</strong></span>
                    <span><i className="legend-dot high" /> Big Over (12+ runs)</span>
                    <span><i className="legend-dot wicket" /> Wicket Fallen</span>
                  </div>
                </div>
              </section>

              {/* Scoring Distribution Donut Chart */}
              <section className="panel insight-panel" style={{ flex: 1 }}>
                <div className="panel-title">
                  <span>SCORING RUN DISTRIBUTION</span>
                  <span className="muted">PIE / DONUT CHART</span>
                </div>
                <ScoringDonutChart
                  fours={totalFours}
                  sixes={totalSixes}
                  runningRuns={Math.max(0, activeSnap.runs - boundaryRuns - totalExtras)}
                  extras={totalExtras}
                />
              </section>
            </div>

            {/* Highlights Grid */}
            <div className="analytics-grid">
              {/* Extras Breakdown */}
              <section className="panel insight-panel">
                <div className="panel-title"><span>EXTRAS BREAKDOWN</span><span className="muted">Total: {totalExtras} Runs</span></div>
                <div className="extras-flex">
                  <div className="extra-pill"><strong>{activeSnap.extras.wide ?? 0}</strong><span>Wides</span></div>
                  <div className="extra-pill"><strong>{activeSnap.extras.noBall ?? 0}</strong><span>No Balls</span></div>
                  <div className="extra-pill"><strong>{activeSnap.extras.bye ?? 0}</strong><span>Byes</span></div>
                  <div className="extra-pill"><strong>{activeSnap.extras.legBye ?? 0}</strong><span>Leg Byes</span></div>
                  <div className="extra-pill"><strong>{activeSnap.extras.penalty ?? 0}</strong><span>Penalties</span></div>
                </div>
              </section>

              {/* Top Batter */}
              {topBatter && topBatter.player && (
                <section className="panel performer-card">
                  <div className="panel-title"><span>TOP BATTER</span><span className="muted">{activeTeam.name}</span></div>
                  <div className="performer-body">
                    <div className="performer-name">🏆 {getPlayerNameWithCaptain(topBatter.player, activeTeam)}</div>
                    <div className="performer-main-stat">{topBatter.stat.runs} <small>runs</small></div>
                    <div className="performer-sub-stats">
                      <span>{topBatter.stat.balls} balls</span> · <span>SR {topBatter.stat.balls ? ((topBatter.stat.runs / topBatter.stat.balls) * 100).toFixed(1) : '0.0'}</span> · <span>{topBatter.stat.fours}x4 / {topBatter.stat.sixes}x6</span>
                    </div>
                  </div>
                </section>
              )}

              {/* Top Bowler */}
              {topBowler && topBowler.player && (
                <section className="panel performer-card">
                  <div className="panel-title"><span>TOP BOWLER</span><span className="muted">{opponentTeam.name}</span></div>
                  <div className="performer-body">
                    <div className="performer-name">⚡ {getPlayerNameWithCaptain(topBowler.player, opponentTeam)}</div>
                    <div className="performer-main-stat">{topBowler.stat.wickets} <small>wickets</small></div>
                    <div className="performer-sub-stats">
                      <span>{Math.floor(topBowler.stat.balls / 6)}.{topBowler.stat.balls % 6} Overs</span> · <span>{topBowler.stat.runs} Runs</span> · <span>Econ {topBowler.stat.balls ? (topBowler.stat.runs / (topBowler.stat.balls / 6)).toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )
      ) : (
        /* Comparison View */
        <div className="analytics-content">
          <section className="panel chart-panel">
            <div className="panel-title"><span>INNINGS COMPARISON — RUNS PER OVER</span></div>
            <div className="compare-grid">
              <div className="compare-team-box">
                <h3 style={{ color: 'var(--accent)', margin: '0 0 10px' }}>1st Innings: {team1.name}</h3>
                <div className="compare-stat-row">
                  <span>Score</span><strong>{snap1.runs}/{snap1.wickets} ({Math.floor(snap1.legalBalls / 6)}.{snap1.legalBalls % 6} ov)</strong>
                </div>
                <div className="compare-stat-row">
                  <span>Run Rate</span><strong>{snap1.legalBalls ? (snap1.runs / (snap1.legalBalls / 6)).toFixed(2) : '0.00'}</strong>
                </div>
                <div className="compare-stat-row">
                  <span>Boundaries</span><strong>{Object.values(snap1.batters).reduce((s, b) => s + b.fours, 0)}x4 · {Object.values(snap1.batters).reduce((s, b) => s + b.sixes, 0)}x6</strong>
                </div>
              </div>

              <div className="compare-team-box">
                <h3 style={{ color: 'var(--teal)', margin: '0 0 10px' }}>2nd Innings: {team2.name}</h3>
                <div className="compare-stat-row">
                  <span>Score</span><strong>{snap2.runs}/{snap2.wickets} ({Math.floor(snap2.legalBalls / 6)}.{snap2.legalBalls % 6} ov)</strong>
                </div>
                <div className="compare-stat-row">
                  <span>Run Rate</span><strong>{snap2.legalBalls ? (snap2.runs / (snap2.legalBalls / 6)).toFixed(2) : '0.00'}</strong>
                </div>
                <div className="compare-stat-row">
                  <span>Boundaries</span><strong>{Object.values(snap2.batters).reduce((s, b) => s + b.fours, 0)}x4 · {Object.values(snap2.batters).reduce((s, b) => s + b.sixes, 0)}x6</strong>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function HistoryView({
  matches, current, onOpen, onResume, onNewMatch, onDelete, onTogglePin, onClearAll, onFlash
}: {
  matches: Match[]
  current: Match
  onOpen: (m: Match) => void
  onResume: (m: Match) => void
  onNewMatch: () => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onClearAll: () => void
  onFlash?: (msg: string) => void
}) {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const list = matches.some(m => m.id === current.id) ? matches : (current.deliveries.length > 0 ? [current, ...matches] : matches)

  // Sort pinned matches first, then by createdAt descending
  const sortedList = [...list].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return b.createdAt - a.createdAt
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">MATCH ARCHIVE</p>
          <h1>Saved Match History</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {sortedList.length > 0 && (
            <button
              className="ghost"
              onClick={() => setClearConfirmOpen(true)}
              style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={16} /> Clear All History
            </button>
          )}
          <button className="primary" onClick={onNewMatch}><Plus size={17} /> Start New Match</button>
        </div>
      </div>

      {sortedList.length === 0 ? (
        <div className="panel empty-history-card">
          <div className="stadium-badge"><Trophy size={44} /></div>
          <h2>Match History is Empty</h2>
          <p className="setup-copy" style={{ maxWidth: 460, margin: '8px auto 20px' }}>
            You have no saved or active matches in your archive. Start a new match to record live scores, generate PDF scorecards, and track cricket analytics!
          </p>
          <button className="primary large" onClick={onNewMatch}>
            <Plus size={18} /> Start First Match
          </button>
        </div>
      ) : (
        <div className="history-list">
          {sortedList.map(m => {
            const r1 = replayInnings(m, 1)
            const r2 = replayInnings(m, 2)
            const isOngoing = !m.isCompleted

            return (
              <div className={`history-item-row ${m.isPinned ? 'is-pinned' : ''}`} key={m.id}>
                {m.isPinned && (
                  <div className="pin-badge">📌 PINNED</div>
                )}
                <div className="history-item-main" onClick={() => onOpen(m)}>
                  <div className="history-date">
                    {m.date}
                    <small>{m.matchType} {isOngoing ? '· LIVE' : ''}</small>
                  </div>
                  <div className="history-teams">
                    <strong>{m?.teams?.[0]?.name ?? 'Team 1'}</strong>
                    <span>VS</span>
                    <strong>{m?.teams?.[1]?.name ?? 'Team 2'}</strong>
                  </div>
                  <div className="history-score">
                    Inn 1: {r1.runs}/{r1.wickets} | Inn 2: {r2.runs}/{r2.wickets}
                  </div>
                </div>

                <div className="history-item-actions">
                  <button
                    className={`icon-btn-text ${m.isPinned ? 'pinned-active' : 'ghost-subtle'}`}
                    title={m.isPinned ? 'Unpin Match' : 'Pin Match to Top'}
                    onClick={() => onTogglePin(m.id)}
                  >
                    <Pin size={14} /> {m.isPinned ? 'Pinned' : 'Pin'}
                  </button>
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
      )}

      {/* Clear All History Confirmation Dialog */}
      {clearConfirmOpen && (
        <div className="dialog-backdrop">
          <div className="dialog text-center">
            <div className="trophy-badge" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
              <Trash2 size={36} />
            </div>
            <h2 style={{ fontSize: 22, margin: '16px 0 8px', color: '#ef4444' }}>Clear All Match History?</h2>
            <p className="setup-copy" style={{ margin: '0 0 20px' }}>
              Are you sure you want to delete <strong>all saved matches</strong> from history? This action cannot be undone.
            </p>
            <div className="dialog-actions" style={{ justifyContent: 'center', gap: 12 }}>
              <button className="ghost" onClick={() => setClearConfirmOpen(false)}>Cancel</button>
              <button
                className="danger-btn large"
                onClick={() => {
                  onClearAll()
                  setClearConfirmOpen(false)
                }}
              >
                Yes, Clear All Matches
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* Multi-Step Setup Modal Wizard with 50/50 Coin Toss Fix */
function Setup({ match, onStart, onClose }: { match: Match; onStart: (m: Match) => void; onClose?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [draft, setDraft] = useState<Match>(match)
  const [oversInput, setOversInput] = useState<string>(String(match.overs))

  const [tossCaller, setTossCaller] = useState<0 | 1>(0)
  const [tossCall, setTossCall] = useState<'Heads' | 'Tails'>('Heads')
  const [isSpinning, setIsSpinning] = useState(false)
  const [tossResult, setTossResult] = useState<'Heads' | 'Tails' | null>(null)
  const [tossWinnerIndex, setTossWinnerIndex] = useState<0 | 1 | null>(null)
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null)
  const [coinRotation, setCoinRotation] = useState(0)

  const handleOversChange = (val: string) => {
    setOversInput(val)
    const parsed = parseInt(val, 10)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 200) {
      setDraft(m => ({ ...m, overs: parsed }))
    }
  }

  const handlePresetOvers = (num: number) => {
    setOversInput(String(num))
    setDraft(m => ({ ...m, overs: num }))
  }

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
            <button className="icon-btn" aria-label="Close setup modal" onClick={onClose}><X size={20} /></button>
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
                <select value={draft.matchType} onChange={e => {
                  const format = e.target.value
                  let defaultOvers = draft.overs
                  if (format === 'T20 Match') defaultOvers = 20
                  else if (format === 'ODI (50 Overs)') defaultOvers = 50
                  else if (format === '10-Over Sprint') defaultOvers = 10
                  setDraft({ ...draft, matchType: format, overs: defaultOvers })
                  setOversInput(String(defaultOvers))
                }}>
                  <option>T20 Match</option>
                  <option>ODI (50 Overs)</option>
                  <option>10-Over Sprint</option>
                  <option>Gully / Street Cricket</option>
                  <option>Custom Match</option>
                </select>
              </label>
              <div className="overs-input-group">
                <label>
                  Overs Limit (Write manually or pick preset)
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={oversInput}
                    onChange={e => handleOversChange(e.target.value)}
                    onBlur={() => {
                      const parsed = parseInt(oversInput, 10)
                      if (isNaN(parsed) || parsed < 1) {
                        setOversInput('20')
                        setDraft(m => ({ ...m, overs: 20 }))
                      }
                    }}
                    placeholder="Enter overs count"
                  />
                </label>
                <div className="preset-chips">
                  {[5, 10, 15, 20, 50].map(num => (
                    <button
                      key={num}
                      type="button"
                      className={`chip ${draft.overs === num ? 'active' : ''}`}
                      onClick={() => handlePresetOvers(num)}
                    >
                      {num} Ov {num === 20 ? '(T20)' : num === 50 ? '(ODI)' : ''}
                    </button>
                  ))}
                </div>
              </div>
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
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {step > 1 && (
              <button className="ghost" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3 | 4)}>
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {onClose && (
              <button
                className="ghost"
                onClick={onClose}
                style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <X size={16} /> Cancel Setup
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
function SelectOpenersDialog({ match, battingTeam, bowlingTeam, onConfirm, onClose }: { match: Match; battingTeam: Team; bowlingTeam: Team; onConfirm: (striker: string, nonStriker: string, bowler: string) => void; onClose?: () => void }) {
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
          {onClose && (
            <button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
          )}
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
          {onClose && (
            <button className="ghost" onClick={onClose}>
              <X size={16} /> Cancel & Go Home
            </button>
          )}
          <button className="primary large" disabled={!isValid} onClick={() => onConfirm(striker, nonStriker, bowler)}>
            Confirm & Start Innings <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Dialog to Select Next Bowler after an Over ends */
function SelectBowlerDialog({ bowlingTeam, currentBowlerId, overNumber, onConfirm, onClose }: { bowlingTeam: Team; currentBowlerId?: string; overNumber: number; onConfirm: (bowlerId: string) => void; onClose?: () => void }) {
  const [selected, setSelected] = useState(bowlingTeam.players.find(p => p.id !== currentBowlerId)?.id ?? bowlingTeam.players[0]?.id ?? '')

  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <div className="dialog-head">
          <div>
            <p className="eyebrow">OVER COMPLETED</p>
            <h2>Select Bowler for Over {overNumber}</h2>
          </div>
          {onClose && (
            <button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button>
          )}
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
          {onClose && (
            <button className="ghost" onClick={onClose}>Cancel</button>
          )}
          <button className="primary" onClick={() => onConfirm(selected)}>
            Confirm Bowler <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/* Dialog showing 1st Innings Score & Target before starting 2nd Innings */
function Innings1SummaryDialog({ snap1, battingTeam, bowlingTeam, target, overs, onStartInnings2, onClose }: { snap1: Snapshot; battingTeam: Team; bowlingTeam: Team; target: number; overs: number; onStartInnings2: () => void; onClose?: () => void }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog large-dialog text-center" style={{ position: 'relative' }}>
        {onClose && (
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose} style={{ position: 'absolute', top: 20, right: 20 }}>
            <X size={18} />
          </button>
        )}
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

        <div className="dialog-actions" style={{ justifyContent: 'center', gap: 12, marginTop: 24 }}>
          {onClose && (
            <button className="ghost" onClick={onClose}>View Scorecard</button>
          )}
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

function SafeApp() {
  try {
    return <App />
  } catch (err) {
    console.error("ScoreMaster Render Error:", err)
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif', background: '#091324', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>ScoreMaster</h2>
        <p style={{ color: '#94a3b8', maxWidth: 460, marginBottom: 24 }}>App loaded. Click below to refresh local state.</p>
        <button
          onClick={() => { localStorage.clear(); window.location.reload() }}
          style={{ background: '#0284c7', color: '#fff', border: 0, padding: '12px 24px', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}
        >
          Reset Local Cache & Reload
        </button>
      </div>
    )
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SafeApp />
  </StrictMode>
)

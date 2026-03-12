/**
 * Gaming page — Mafia / Werewolf and future games.
 * Real-time multiplayer; players are employees. Stats and leaderboard.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Gamepad2, Users, Trophy, PlusCircle, LogOut, Play, Loader2, Moon, Sun, Skull, Heart, UserCircle, Bot, XCircle, MessageCircle, ArrowLeft } from "lucide-react";
import { useNotification } from "../../NotificationProvider";
import { useLanguage } from "../../../contexts/LanguageContext";
import "../../../styles/pages/gaming/gaming.css";

const BACKGAMMON_DISABLED = true;

const rid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const MIN_PLAYERS = 6;
const MAX_PLAYERS = 18;

const ROLES = {
  mafia: { key: "gaming.roleMafia", Icon: Skull },
  villager: { key: "gaming.roleVillager", Icon: UserCircle },
  doctor: { key: "gaming.roleDoctor", Icon: Heart },
};
const NIGHT_COUNTDOWN_SEC = 10;

function getRoleLabel(role, t) {
  if (!role || !ROLES[role]) return role ?? "";
  return t(ROLES[role].key);
}

export default function Gaming({ account, onNavigate }) {
  const notify = useNotification();
  const { t } = useLanguage();
  const [view, setView] = useState("menu"); // menu | create | join | lobby | game | leaderboard | backgammonJoin | backgammonLobby | backgammonGame
  const [lobbies, setLobbies] = useState([]);
  const [loadingLobbies, setLoadingLobbies] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [backgammonState, setBackgammonState] = useState(null);
  const [backgammonLobbies, setBackgammonLobbies] = useState([]);
  const [loadingBackgammonLobbies, setLoadingBackgammonLobbies] = useState(false);
  const requestIdRef = useRef(null);
  const gameIdRef = useRef(null);
  const backgammonGameIdRef = useRef(null);

  const myId = String(account?.id ?? account?._id ?? "");

  const send = useCallback((type, payload = {}) => {
    if (!window.api?.wsSend) return;
    requestIdRef.current = rid();
    window.api.wsSend({ type, requestId: requestIdRef.current, payload });
  }, []);

  useEffect(() => {
    if (!window.api?.onWsMessage) return;
    const unsub = window.api.onWsMessage((msg) => {
      if (msg?.type === "gaming:mafia:list" && msg?.requestId === requestIdRef.current) {
        setLobbies(Array.isArray(msg.games) ? msg.games : []);
        setLoadingLobbies(false);
      }
      if (msg?.type === "gaming:mafia:create:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) {
          setGameState(msg.state);
          gameIdRef.current = msg.gameId;
          setView("lobby");
        } else {
          notify?.error?.(msg.error || "Failed to create game");
        }
      }
      if (msg?.type === "gaming:mafia:join:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) {
          setGameState(msg.state);
          gameIdRef.current = msg.gameId;
          setView("lobby");
          setJoinError("");
        } else {
          setJoinError(msg.error || "Join failed");
        }
      }
      if (msg?.type === "gaming:mafia:leave:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok) {
          setGameState(null);
          gameIdRef.current = null;
          setView("menu");
        }
      }
      if (msg?.type === "gaming:mafia:addBot:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) setGameState(msg.state);
        else if (!msg.ok) notify?.error?.(msg.error || "Could not add bot");
      }
      if (msg?.type === "gaming:mafia:removeBot:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) setGameState(msg.state);
        else if (!msg.ok) notify?.error?.(msg.error || "Could not remove bot");
      }
      if (msg?.type === "gaming:mafia:start:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) {
          setGameState(msg.state);
          setView("game");
        } else {
          notify?.error?.(msg.error || "Start failed");
        }
      }
      if (msg?.type === "gaming:mafia:state") {
        if (msg.state) {
          setGameState(msg.state);
          if (msg.state.status === "playing" && view === "lobby") setView("game");
        } else {
          setGameState(null);
          gameIdRef.current = null;
          setView("menu");
        }
      }
      if (msg?.type === "gaming:mafia:chat:message" && msg.message) {
        setGameState((prev) => {
          if (!prev?.gameId) return prev;
          return { ...prev, chatMessages: [...(prev.chatMessages || []), msg.message] };
        });
      }
      if (msg?.type === "gaming:mafia:leaderboard" && msg?.requestId === requestIdRef.current) {
        setLeaderboard(Array.isArray(msg.leaderboard) ? msg.leaderboard : []);
        setLoadingLeaderboard(false);
      }
      if (msg?.type === "gaming:backgammon:list" && msg?.requestId === requestIdRef.current) {
        setBackgammonLobbies(Array.isArray(msg.games) ? msg.games : []);
        setLoadingBackgammonLobbies(false);
      }
      if (msg?.type === "gaming:backgammon:create:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) {
          setBackgammonState(msg.state);
          backgammonGameIdRef.current = msg.gameId;
          setView("backgammonLobby");
        } else {
          notify?.error?.(msg.error || "Failed to create game");
        }
      }
      if (msg?.type === "gaming:backgammon:join:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok && msg.state) {
          setBackgammonState(msg.state);
          backgammonGameIdRef.current = msg.gameId;
          setJoinError("");
          setView(msg.state.status === "playing" && msg.state.board ? "backgammonGame" : "backgammonLobby");
        } else {
          setJoinError(msg.error || "Join failed");
        }
      }
      if (msg?.type === "gaming:backgammon:leave:result" && msg?.requestId === requestIdRef.current) {
        if (msg.ok) {
          setBackgammonState(null);
          backgammonGameIdRef.current = null;
          setView("menu");
        }
      }
      if (msg?.type === "gaming:backgammon:state" && msg.state !== undefined) {
        setBackgammonState(msg.state);
        if (msg.state?.status === "playing" && msg.state?.board) setView("backgammonGame");
        if (!msg.state) {
          backgammonGameIdRef.current = null;
          setView("menu");
        }
      }
      if (msg?.type === "gaming:backgammon:undo:result" && msg.ok === false && msg.error) {
        notify?.error?.(msg.error);
      }
    });
    return () => unsub?.();
  }, [notify, view]);

  const fetchLobbies = useCallback(() => {
    setLoadingLobbies(true);
    send("gaming:mafia:list");
  }, [send]);

  const fetchLeaderboard = useCallback(() => {
    setLoadingLeaderboard(true);
    send("gaming:mafia:leaderboard", { limit: 25 });
  }, [send]);

  useEffect(() => {
    if (view === "join" || view === "menu") fetchLobbies();
  }, [view, fetchLobbies]);

  useEffect(() => {
    if (view === "leaderboard") fetchLeaderboard();
  }, [view, fetchLeaderboard]);

  const handleCreate = () => {
    send("gaming:mafia:create");
  };

  const handleJoin = (codeFromList) => {
    setJoinError("");
    const code = (codeFromList ?? joinCode).toString().trim().toUpperCase();
    if (!code) {
      setJoinError("Enter game code");
      return;
    }
    send("gaming:mafia:join", { gameId: code });
  };

  const handleLeave = () => {
    send("gaming:mafia:leave", { gameId: gameIdRef.current });
  };

  const handleStart = () => {
    if (gameState?.players?.length < MIN_PLAYERS) {
      notify?.error?.(`Minimum ${MIN_PLAYERS} players to start`);
      return;
    }
    send("gaming:mafia:start", { gameId: gameState?.gameId });
  };

  const handleAddBot = () => {
    send("gaming:mafia:addBot", { gameId: gameState?.gameId });
  };

  const handleRemoveBot = (botEmployeeId) => {
    send("gaming:mafia:removeBot", { gameId: gameState?.gameId, botEmployeeId });
  };

  const fetchBackgammonLobbies = useCallback(() => {
    setLoadingBackgammonLobbies(true);
    send("gaming:backgammon:list");
  }, [send]);

  const handleBackgammonCreate = () => {
    send("gaming:backgammon:create");
  };

  const handleBackgammonJoin = (codeFromList) => {
    setJoinError("");
    const code = (codeFromList ?? joinCode).toString().trim().toUpperCase();
    if (!code) {
      setJoinError("Enter game code");
      return;
    }
    send("gaming:backgammon:join", { gameId: code });
  };

  const handleBackgammonLeave = () => {
    send("gaming:backgammon:leave", { gameId: backgammonGameIdRef.current });
  };

  const isHost = gameState && String(gameState.hostEmployeeId) === myId;

  useEffect(() => {
    if (view === "backgammonJoin") fetchBackgammonLobbies();
  }, [view, fetchBackgammonLobbies]);

  useEffect(() => {
    if (BACKGAMMON_DISABLED && (view === "backgammonJoin" || view === "backgammonLobby" || view === "backgammonGame")) {
      setView("menu");
    }
  }, [BACKGAMMON_DISABLED, view]);

  if (view === "lobby" && gameState) {
    return (
      <MafiaLobby
        gameState={gameState}
        myId={myId}
        onLeave={handleLeave}
        onStart={handleStart}
        onAddBot={handleAddBot}
        onRemoveBot={handleRemoveBot}
        isHost={isHost}
        t={t}
      />
    );
  }

  if (view === "game" && gameState) {
    return (
      <MafiaGame
        gameState={gameState}
        myId={myId}
        onLeave={handleLeave}
        t={t}
      />
    );
  }

  if (view === "backgammonLobby") {
    if (backgammonState) {
      return (
        <BackgammonLobby
          state={backgammonState}
          myId={myId}
          onLeave={handleBackgammonLeave}
          t={t}
        />
      );
    }
    return (
      <div className="gamingPage gamingLobby">
        <div className="gamingContent"><Loader2 size={24} className="spin" /> {t("common.loading")}</div>
      </div>
    );
  }

  if (view === "backgammonGame" && backgammonState) {
    return (
      <BackgammonGame
        state={backgammonState}
        gameId={backgammonGameIdRef.current}
        myId={myId}
        onLeave={handleBackgammonLeave}
        send={send}
        t={t}
      />
    );
  }

  if (view === "backgammonJoin") {
    return (
      <div className="gamingPage">
        <header className="gamingHeader">
          <button type="button" className="gamingBackBtn" onClick={() => setView("menu")} aria-label={t("common.back")}>
            <ArrowLeft size={18} aria-hidden />
            <span>{t("common.back")}</span>
          </button>
          <h1 className="gamingTitle">{t("gaming.joinGame")} — {t("gaming.backgammon")}</h1>
        </header>
        <div className="gamingContent">
          <div className="gamingJoinCard">
            <label className="gamingLabel">{t("gaming.gameCode")}</label>
            <input
              type="text"
              className="gamingInput"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={8}
            />
            {joinError && <p className="gamingError">{joinError}</p>}
            <button type="button" className="gamingBtn gamingBtnPrimary" onClick={() => handleBackgammonJoin()}>
              {t("gaming.join")}
            </button>
          </div>
          <div className="gamingLobbyList">
            <h3>{t("gaming.openLobbies")}</h3>
            {loadingBackgammonLobbies ? (
              <p><Loader2 size={18} className="spin" /> {t("common.loading")}</p>
            ) : (
              <ul>
                {backgammonLobbies.map((g) => (
                  <li key={g.gameId}>
                    <span>{g.hostName} — {g.playerCount}/2</span>
                    <button type="button" className="gamingBtn gamingBtnSmall" onClick={() => handleBackgammonJoin(g.gameId)}>
                      {t("gaming.join")}
                    </button>
                  </li>
                ))}
                {backgammonLobbies.length === 0 && !loadingBackgammonLobbies && (
                  <p className="gamingMuted">{t("gaming.noLobbies")}</p>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "leaderboard") {
    return (
      <div className="gamingPage">
        <header className="gamingHeader">
          <button type="button" className="gamingBackBtn" onClick={() => setView("menu")} aria-label={t("common.back")}>
            <ArrowLeft size={18} aria-hidden />
            <span>{t("common.back")}</span>
          </button>
          <h1 className="gamingTitle">
            <Trophy size={22} />
            {t("gaming.leaderboard")}
          </h1>
        </header>
        <div className="gamingContent">
          {loadingLeaderboard ? (
            <div className="gamingLoading"><Loader2 size={24} className="spin" /> {t("common.loading")}</div>
          ) : (
            <div className="gamingLeaderboard">
              <table className="gamingLeaderboardTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("gaming.player")}</th>
                    <th>{t("gaming.gamesPlayed")}</th>
                    <th>{t("gaming.winsVillage")}</th>
                    <th>{t("gaming.winsMafia")}</th>
                    <th>{t("gaming.totalWins")}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, i) => (
                    <tr key={row.employeeId || i}>
                      <td>{i + 1}</td>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.gamesPlayed}</td>
                      <td>{row.winsAsVillage}</td>
                      <td>{row.winsAsMafia}</td>
                      <td><strong>{row.totalWins}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leaderboard.length === 0 && !loadingLeaderboard && (
                <p className="gamingEmpty">{t("gaming.noLeaderboardYet")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === "join") {
    return (
      <div className="gamingPage">
        <header className="gamingHeader">
          <button type="button" className="gamingBackBtn" onClick={() => setView("menu")} aria-label={t("common.back")}>
            <ArrowLeft size={18} aria-hidden />
            <span>{t("common.back")}</span>
          </button>
          <h1 className="gamingTitle">{t("gaming.joinGame")}</h1>
        </header>
        <div className="gamingContent">
          <div className="gamingJoinCard">
            <label className="gamingLabel">{t("gaming.gameCode")}</label>
            <input
              type="text"
              className="gamingInput"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              maxLength={8}
              autoFocus
            />
            {joinError && <p className="gamingError">{joinError}</p>}
            <button type="button" className="gamingBtn gamingBtnPrimary" onClick={handleJoin}>
              {t("gaming.join")}
            </button>
          </div>
          <div className="gamingLobbyList">
            <h3>{t("gaming.openLobbies")}</h3>
            {loadingLobbies ? (
              <p><Loader2 size={18} className="spin" /> {t("common.loading")}</p>
            ) : (
              <ul>
                {lobbies.map((g) => (
                  <li key={g.gameId}>
                    <span>{g.hostName} — {g.playerCount}/{MAX_PLAYERS}</span>
                    <button type="button" className="gamingBtn gamingBtnSmall" onClick={() => handleJoin(g.gameId)}>
                      {t("gaming.join")}
                    </button>
                  </li>
                ))}
                {lobbies.length === 0 && !loadingLobbies && <li className="gamingMuted">{t("gaming.noLobbies")}</li>}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gamingPage">
      <header className="gamingHeader">
        <div className="gamingHeaderIcon">
          <Gamepad2 size={24} />
        </div>
        <h1 className="gamingTitle">{t("gaming.title")}</h1>
        <p className="gamingSubtitle">{t("gaming.subtitle")}</p>
      </header>
      <div className="gamingContent">
        <section className="gamingCard gamingCardMafia">
          <h2 className="gamingCardTitle">Mafia / Werewolf</h2>
          <p className="gamingCardDesc">
            {t("gaming.mafiaDesc")} {MIN_PLAYERS}–{MAX_PLAYERS} {t("gaming.players")}.
          </p>
          <div className="gamingCardActions">
            <button type="button" className="gamingBtn gamingBtnPrimary" onClick={handleCreate}>
              <PlusCircle size={18} /> {t("gaming.createGame")}
            </button>
            <button type="button" className="gamingBtn gamingBtnSecondary" onClick={() => setView("join")}>
              <Users size={18} /> {t("gaming.joinGame")}
            </button>
          </div>
        </section>
        <section className={`gamingCard gamingCardBackgammon ${BACKGAMMON_DISABLED ? "gamingCardDisabled" : ""}`}>
          <h2 className="gamingCardTitle">{t("gaming.backgammon")}</h2>
          <p className="gamingCardDesc">{t("gaming.backgammonDesc")}</p>
          {BACKGAMMON_DISABLED ? (
            <p className="gamingCardDisabledText">{t("gaming.backgammonDisabled")}</p>
          ) : (
            <div className="gamingCardActions">
              <button type="button" className="gamingBtn gamingBtnPrimary" onClick={handleBackgammonCreate}>
                <PlusCircle size={18} /> {t("gaming.createGame")}
              </button>
              <button type="button" className="gamingBtn gamingBtnSecondary" onClick={() => { setView("backgammonJoin"); setJoinError(""); }}>
                <Users size={18} /> {t("gaming.joinGame")}
              </button>
            </div>
          )}
        </section>
        <section className="gamingCard">
          <button type="button" className="gamingBtn gamingBtnSecondary" onClick={() => setView("leaderboard")}>
            <Trophy size={18} /> {t("gaming.leaderboard")}
          </button>
        </section>
        <section className="gamingRules">
          <h3>{t("gaming.rulesTitle")}</h3>
          <ul>
            <li>{t("gaming.rule1")}</li>
            <li>{t("gaming.rule2")}</li>
            <li>{t("gaming.rule3")}</li>
            <li>{t("gaming.rule4")}</li>
            <li>{t("gaming.rule5")}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function MafiaLobby({ gameState, myId, onLeave, onStart, isHost, onAddBot, onRemoveBot, t }) {
  const players = gameState?.players ?? [];
  const botCount = players.filter((p) => p.isBot).length;
  const canStart = isHost && players.length >= MIN_PLAYERS;
  const [removingBotId, setRemovingBotId] = useState(null);

  const handleRemoveBotClick = () => {
    const bots = players.filter((p) => p.isBot);
    if (bots.length === 0) return;
    const toRemove = bots[bots.length - 1];
    setRemovingBotId(toRemove.employeeId);
  };

  return (
    <div className="gamingPage gamingLobby">
      <header className="gamingHeader">
        <h1 className="gamingTitle">{t("gaming.lobby")} — {gameState?.gameId}</h1>
        <p className="gamingSubtitle">{t("gaming.shareCode")}</p>
        <div className="gamingLobbyActions">
          {isHost && (
            <>
              <button type="button" className={`gamingBtn gamingBtnPrimary ${canStart ? "gamingBtn--ready" : ""}`} onClick={onStart} disabled={!canStart}>
                <Play size={18} /> {t("gaming.startGame")}
              </button>
              <button type="button" className="gamingBtn gamingBtnSecondary" onClick={onAddBot} disabled={players.length >= MAX_PLAYERS}>
                <Bot size={18} /> {t("gaming.addBot")}
              </button>
              {botCount > 0 && (
                <button type="button" className="gamingBtn gamingBtnSecondary" onClick={handleRemoveBotClick} disabled={!!removingBotId}>
                  <XCircle size={18} /> {t("gaming.removeBot")}
                </button>
              )}
            </>
          )}
          {!canStart && isHost && players.length < MIN_PLAYERS && (
            <span className="gamingMuted">{t("gaming.needMorePlayers").replace("{{min}}", MIN_PLAYERS).replace("{{current}}", players.length)}</span>
          )}
          <button type="button" className="gamingBtn gamingBtnDanger" onClick={onLeave}>
            <LogOut size={18} /> {t("gaming.leave")}
          </button>
        </div>
      </header>
      <div className="gamingContent">
        <p className="gamingLobbyHint">{t("gaming.botsHint")}</p>
        <ul className="gamingPlayerList">
          {players.map((p, i) => (
            <li
              key={p.employeeId || i}
              className={`${String(p.employeeId) === myId ? "isYou" : ""} ${removingBotId === p.employeeId ? "gamingPlayerItem--exiting" : ""}`}
              onAnimationEnd={removingBotId === p.employeeId ? () => { onRemoveBot(p.employeeId); setRemovingBotId(null); } : undefined}
            >
              <span className="gamingPlayerName">
                {p.name}
                {p.isBot && <span className="gamingBotBadge"><Bot size={12} /> {t("gaming.bot")}</span>}
                {String(p.employeeId) === myId && ` (${t("gaming.you")})`}
              </span>
            </li>
          ))}
        </ul>
        <p className="gamingMuted">{players.length} / {MAX_PLAYERS} {t("gaming.players")}</p>
      </div>
    </div>
  );
}

function formatChatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  return sameDay ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MafiaGame({ gameState, myId, onLeave, t }) {
  const [nightTarget, setNightTarget] = useState(null);
  const [dayVote, setDayVote] = useState(null);
  const [nightCountdown, setNightCountdown] = useState(NIGHT_COUNTDOWN_SEC);
  const [chatInput, setChatInput] = useState("");
  const requestIdRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const lastNightRoundRef = useRef(null);
  const lastCountdownSecondRef = useRef(null);
  const chatListRef = useRef(null);

  const send = useCallback((type, payload) => {
    if (!window.api?.wsSend) return;
    requestIdRef.current = rid();
    window.api.wsSend({ type, requestId: requestIdRef.current, payload: { gameId: gameState?.gameId, ...payload } });
  }, [gameState?.gameId]);

  const phase = gameState?.phase;
  const status = gameState?.status;
  const round = gameState?.round ?? 1;
  const phaseStartsAt = gameState?.phaseStartsAt;
  const players = gameState?.players ?? [];
  const mafiaTeammates = gameState?.mafiaTeammates ?? [];
  const alivePlayers = players.filter((p) => p.alive);
  const myRole = gameState?.yourRole;
  const needNightAction = gameState?.needNightAction;
  const needDayVote = gameState?.needDayVote;
  const winner = gameState?.winner;
  const lastNightDeath = gameState?.lastNightDeath;
  const lastDayLynch = gameState?.lastDayLynch;
  const chatMessages = gameState?.chatMessages ?? [];

  const phaseStartsAtMs = phaseStartsAt != null ? Number(phaseStartsAt) : null;
  const showNightCountdown = phase === "night" && Number.isFinite(phaseStartsAtMs) && (Date.now() - phaseStartsAtMs) < NIGHT_COUNTDOWN_SEC * 1000;

  useEffect(() => {
    if (phase !== "night") {
      lastNightRoundRef.current = null;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }
    const startMs = phaseStartsAtMs;
    if (startMs == null || !Number.isFinite(startMs)) return;
    const elapsed = (Date.now() - startMs) / 1000;
    setNightCountdown(Math.max(0, Math.ceil(NIGHT_COUNTDOWN_SEC - elapsed)));
    const tick = () => {
      const elapsedSec = (Date.now() - startMs) / 1000;
      const remaining = Math.max(0, Math.ceil(NIGHT_COUNTDOWN_SEC - elapsedSec));
      const currentSecond = Math.floor(elapsedSec);
      if (remaining >= 4 || remaining === 0) {
        setNightCountdown(remaining);
        lastCountdownSecondRef.current = currentSecond;
      } else {
        if (lastCountdownSecondRef.current !== currentSecond) {
          lastCountdownSecondRef.current = currentSecond;
          setNightCountdown(remaining);
        }
      }
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        if (window.api?.wsSend && gameState?.gameId) {
          window.api.wsSend({ type: "gaming:mafia:state", requestId: rid(), payload: { gameId: gameState.gameId } });
        }
      }
    };
    tick();
    countdownIntervalRef.current = setInterval(tick, 200);
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [phase, phaseStartsAtMs, round]);

  useEffect(() => {
    if (chatListRef.current && chatMessages.length) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages.length]);

  const handleNightSubmit = () => {
    if (needNightAction && (myRole === "mafia" || myRole === "doctor")) {
      send("gaming:mafia:night", { targetEmployeeId: nightTarget || null });
      setNightTarget(null);
    }
  };

  const handleDayVoteSubmit = () => {
    if (needDayVote && dayVote) {
      send("gaming:mafia:day", { targetEmployeeId: dayVote });
      setDayVote(null);
    }
  };

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text || !needDayVote || phase !== "day") return;
    send("gaming:mafia:chat", { text });
    setChatInput("");
  };

  if (status === "finished") {
    const won = (winner === "village" && myRole !== "mafia") || (winner === "mafia" && myRole === "mafia");
    const byRole = { mafia: [], doctor: [], villager: [] };
    players.forEach((p) => {
      if (p.role && byRole[p.role]) byRole[p.role].push(p);
    });

    return (
      <div className="gamingPage gamingGame gamingGameOver">
        <div className="gamingContent gamingGameOverContent">
          <div className={`gamingGameOverCard ${won ? "gamingGameOverCard--won" : "gamingGameOverCard--lost"}`}>
            <div className={`gamingGameOverIcon ${won ? "won" : "lost"}`}>
              {won ? <Trophy size={48} /> : <Skull size={40} />}
            </div>
            <h2 className="gamingGameOverTitle">{won ? t("gaming.youWon") : t("gaming.youLost")}</h2>
            {!won && <p className="gamingGameOverHint">{t("gaming.betterLuckNextTime")}</p>}
            <p className={`gamingGameOverSub gamingResult ${winner}`}>
              {winner === "village" ? t("gaming.villageWins") : t("gaming.mafiaWins")}
            </p>
          </div>
          <section className="gamingStatsByRole" aria-label={t("gaming.roundSummary")}>
            <h3 className="gamingStatsByRoleTitle">{t("gaming.rolesRevealed")}</h3>
            <div className="gamingStatsByRoleGrid">
              {byRole.mafia.length > 0 && (
                <div className="gamingStatsGroup gamingStatsGroup--mafia">
                  <h4><Skull size={18} /> {t("gaming.roleMafia")}</h4>
                  <ul>
                    {byRole.mafia.map((p, i) => (
                      <li key={p.employeeId || i} className={!p.alive ? "eliminated" : ""}>
                        <span className="gamingStatsName">{p.name}</span>
                        <span className="gamingStatsMeta">
                          {p.isBot && <span className="gamingBotBadge"><Bot size={12} /> {t("gaming.bot")}</span>}
                          {!p.alive && <span className="gamingStatsDead"><Skull size={12} /> {t("gaming.eliminated")}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {byRole.doctor.length > 0 && (
                <div className="gamingStatsGroup gamingStatsGroup--doctor">
                  <h4><Heart size={18} /> {getRoleLabel("doctor", t)}</h4>
                  <ul>
                    {byRole.doctor.map((p, i) => (
                      <li key={p.employeeId || i} className={!p.alive ? "eliminated" : ""}>
                        <span className="gamingStatsName">{p.name}</span>
                        <span className="gamingStatsMeta">
                          {p.isBot && <span className="gamingBotBadge"><Bot size={12} /> {t("gaming.bot")}</span>}
                          {!p.alive && <span className="gamingStatsDead"><Skull size={12} /> {t("gaming.eliminated")}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {byRole.villager.length > 0 && (
                <div className="gamingStatsGroup gamingStatsGroup--villager">
                  <h4><UserCircle size={18} /> {t("gaming.roleVillagers")}</h4>
                  <ul>
                    {byRole.villager.map((p, i) => (
                      <li key={p.employeeId || i} className={!p.alive ? "eliminated" : ""}>
                        <span className="gamingStatsName">{p.name}</span>
                        <span className="gamingStatsMeta">
                          {p.isBot && <span className="gamingBotBadge"><Bot size={12} /> {t("gaming.bot")}</span>}
                          {!p.alive && <span className="gamingStatsDead"><Skull size={12} /> {t("gaming.eliminated")}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
          <button type="button" className="gamingBtn gamingBtnPrimary gamingGameOverBackBtn" onClick={onLeave}>
            {t("gaming.backToMenu")}
          </button>
        </div>
      </div>
    );
  }

  const RoleIcon = myRole && ROLES[myRole]?.Icon ? ROLES[myRole].Icon : UserCircle;

  return (
    <div className="gamingPage gamingGame">
      <header className="gamingHeader">
        <h1 className="gamingTitle">
          {phase === "night" ? <Moon size={22} className="gamingPhaseIcon gamingPhaseIcon--night" /> : <Sun size={22} className="gamingPhaseIcon gamingPhaseIcon--day" />}
          {phase === "night" ? t("gaming.phaseNight") : t("gaming.phaseDay")} — {t("gaming.round")} {round}
        </h1>
        <p className="gamingYourRole">
          <RoleIcon size={16} className={`role-icon role-${myRole}`} />
          {t("gaming.yourRole")}: <strong className={`role-${myRole}`}>{getRoleLabel(myRole, t)}</strong>
        </p>
        {mafiaTeammates.length > 0 && (
          <div className="gamingMafiaTeammates">
            <span className="gamingMafiaTeammatesLabel"><Skull size={14} /> {t("gaming.yourTeam")}:</span>
            <span className="gamingMafiaTeammatesNames">{mafiaTeammates.map((m) => m.name).join(", ")}</span>
          </div>
        )}
        <button type="button" className="gamingLeaveBtn" onClick={onLeave} aria-label="Leave">{t("gaming.leave")}</button>
      </header>
      <div className="gamingContent">
        {showNightCountdown && (
          <div className={`gamingNightCountdown ${nightCountdown <= 3 && nightCountdown >= 1 ? "gamingNightCountdown--critical" : ""}`} aria-live="polite">
            <Moon size={40} className="gamingNightCountdownIcon" />
            <p className="gamingNightCountdownLabel">{t("gaming.nightBeginsIn")}</p>
            <div className="gamingNightCountdownNumberWrap" aria-hidden="true">
              <span key={nightCountdown} className={`gamingNightCountdownNumber ${nightCountdown <= 3 && nightCountdown >= 1 ? "gamingNightCountdownNumber--critical" : ""}`}>{nightCountdown}</span>
            </div>
          </div>
        )}

        {lastNightDeath && (
          <div className="gamingPhaseResult night">
            <Skull size={18} /> {t("gaming.nightDeath").replace("{{name}}", lastNightDeath.name)}
          </div>
        )}
        {lastDayLynch && (
          <div className="gamingPhaseResult day">
            <Sun size={18} /> {t("gaming.dayLynch").replace("{{name}}", lastDayLynch.name)}
          </div>
        )}

        {phase === "night" && needNightAction && !showNightCountdown && (
          <div className="gamingActionCard">
            <h3>{myRole === "mafia" ? <><Skull size={18} /> {t("gaming.chooseKill")}</> : <><Heart size={18} /> {t("gaming.chooseSave")}</>}</h3>
            <ul className="gamingTargetList">
              {alivePlayers.filter((p) => String(p.employeeId) !== myId).map((p) => (
                <li key={p.employeeId}>
                  <button
                    type="button"
                    className={`gamingTargetBtn ${nightTarget === p.employeeId ? "active" : ""}`}
                    onClick={() => setNightTarget(p.employeeId)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            {myRole === "doctor" && (
              <button type="button" className="gamingBtn gamingBtnSecondary gamingBtnSmall" onClick={() => { setNightTarget(null); send("gaming:mafia:night", { targetEmployeeId: null }); }}>
                {t("gaming.noSave")}
              </button>
            )}
            <button type="button" className="gamingBtn gamingBtnPrimary" onClick={handleNightSubmit} disabled={myRole === "mafia" && !nightTarget}>
              {t("common.save")}
            </button>
          </div>
        )}

        {phase === "day" && needDayVote && (
          <div className="gamingActionCard">
            <h3><Sun size={18} /> {t("gaming.voteLynch")}</h3>
            <ul className="gamingTargetList">
              {alivePlayers.filter((p) => String(p.employeeId) !== myId).map((p) => (
                <li key={p.employeeId}>
                  <button
                    type="button"
                    className={`gamingTargetBtn ${dayVote === p.employeeId ? "active" : ""}`}
                    onClick={() => setDayVote(p.employeeId)}
                  >
                    {p.name}
                  </button>
                </li>
              ))}
            </ul>
            <div className="gamingActionRow">
              <button type="button" className="gamingBtn gamingBtnSecondary" onClick={() => { send("gaming:mafia:day", { targetEmployeeId: null }); setDayVote(null); }}>
                {t("gaming.abstain")}
              </button>
              <button type="button" className="gamingBtn gamingBtnPrimary" onClick={handleDayVoteSubmit} disabled={!dayVote}>
                {t("gaming.submitVote")}
              </button>
            </div>
          </div>
        )}

        {phase === "night" && !needNightAction && !showNightCountdown && (
          <p className="gamingMuted gamingWaiting"><Moon size={18} /> {t("gaming.waitingNight")}</p>
        )}
        {phase === "day" && !needDayVote && (
          <p className="gamingMuted gamingWaiting"><Sun size={18} /> {t("gaming.waitingDay")}</p>
        )}

        <div className="gamingPlayerGrid">
          <h3>{t("gaming.players")}</h3>
          <div className="gamingPlayerGridChips">
          {players.map((p, i) => {
            const RoleI = p.role && ROLES[p.role]?.Icon ? ROLES[p.role].Icon : null;
            const isMe = String(p.employeeId) === myId;
            const canSelectNight = phase === "night" && needNightAction && !showNightCountdown && p.alive && !isMe;
            const canSelectDay = phase === "day" && needDayVote && p.alive && !isMe;
            const selectable = canSelectNight || canSelectDay;
            const selected = (canSelectNight && nightTarget === p.employeeId) || (canSelectDay && dayVote === p.employeeId);
            const handleCardClick = selectable
              ? () => {
                  if (canSelectNight) setNightTarget(p.employeeId);
                  if (canSelectDay) setDayVote(p.employeeId);
                }
              : undefined;
            return (
            <div
              key={p.employeeId || i}
              role={selectable ? "button" : undefined}
              tabIndex={selectable ? 0 : undefined}
              className={`gamingPlayerChip ${!p.alive ? "dead" : ""} ${isMe ? "you" : ""} ${p.isMafiaTeammate ? "mafiaTeammate" : ""} ${selectable ? "gamingPlayerChip--selectable" : ""} ${selected ? "gamingPlayerChip--selected" : ""}`}
              onClick={handleCardClick}
              onKeyDown={selectable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } } : undefined}
              aria-pressed={selectable ? selected : undefined}
            >
              <span>{p.name}{p.isBot && <span className="gamingBotBadge"><Bot size={12} /> {t("gaming.bot")}</span>}</span>
              {p.role && (p.employeeId === myId || !p.alive || p.isMafiaTeammate || status === "finished") && (
                <span className={`gamingRoleBadge role-${p.role}`}>{RoleI ? <RoleI size={12} /> : null} {getRoleLabel(p.role, t)}</span>
              )}
              {!p.alive && <span className="gamingDead"><Skull size={14} /></span>}
            </div>
          ); })}
          </div>
        </div>

        {phase === "day" && (
          <section className="gamingChat" aria-label={t("gaming.chatTitle")}>
            <h3 className="gamingChatTitle"><MessageCircle size={18} /> {t("gaming.chatTitle")}</h3>
            <div className="gamingChatList" ref={chatListRef}>
              {chatMessages.length === 0 ? (
                <p className="gamingChatEmpty">{t("gaming.waitingDay")}</p>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={msg.at + "-" + idx} className="gamingChatMessage">
                    <div className="gamingChatAvatar">
                      {msg.photoUrl ? (
                        <img src={msg.photoUrl} alt="" />
                      ) : (
                        <span className="gamingChatAvatarFallback">{(msg.name || "?").charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="gamingChatBody">
                      <div className="gamingChatMeta">
                        <span className="gamingChatName">{msg.name}{String(msg.employeeId) === myId ? ` (${t("gaming.you")})` : ""}</span>
                        <span className="gamingChatTime">{formatChatTime(msg.at)}</span>
                      </div>
                      <p className="gamingChatText">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="gamingChatInputWrap">
              <input
                type="text"
                className="gamingChatInput"
                placeholder={needDayVote ? t("gaming.chatPlaceholder") : t("gaming.chatDisabledDead")}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleChatSend(); }}
                disabled={!needDayVote}
                maxLength={2000}
                aria-label={t("gaming.chatTitle")}
              />
              <button type="button" className="gamingBtn gamingBtnPrimary gamingChatSendBtn" onClick={handleChatSend} disabled={!needDayVote || !chatInput.trim()} aria-label={t("gaming.chatSend")}>
                {t("gaming.chatSend")}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function BackgammonLobby({ state, myId, onLeave, t }) {
  const players = state?.players ?? [];
  const gameId = state?.gameId ?? "";

  return (
    <div className="gamingPage gamingLobby">
      <header className="gamingHeader">
        <h1 className="gamingTitle">{t("gaming.lobby")} — {gameId}</h1>
        <p className="gamingSubtitle">{t("gaming.backgammon")} · {t("gaming.backgammonNeedTwo")}</p>
        <div className="gamingLobbyActions">
          <button type="button" className="gamingBtn gamingBtnDanger" onClick={onLeave}>
            <LogOut size={18} /> {t("gaming.leave")}
          </button>
        </div>
      </header>
      <div className="gamingContent">
        <p className="gamingLobbyHint">{t("gaming.waitingForOpponent")}</p>
        <ul className="gamingPlayerList">
          {players.map((p, i) => (
            <li key={p.id || i} className={String(p.id) === myId ? "isYou" : ""}>
              <span>{p.name}{String(p.id) === myId ? ` (${t("gaming.you")})` : ""}</span>
            </li>
          ))}
        </ul>
        <p className="gamingMuted">{players.length} / 2 {t("gaming.players")}</p>
      </div>
    </div>
  );
}

/** 3D dice cube: 6 faces with pips, shows value 1-6. rolling = run 5s tumble then land on value. */
function Dice3DCube({ value, rolling }) {
  const displayValue = value >= 1 && value <= 6 ? value : 1;
  return (
    <div
      className={`dice3dCube ${rolling ? "dice3dCube--rolling" : ""}`}
      data-value={displayValue}
      aria-label={String(displayValue)}
    >
      <div className="dice3dCube-inner">
        <div className="dice3dFace dice3dFace--1" data-face="1"><DiceFacePips n={1} /></div>
        <div className="dice3dFace dice3dFace--2" data-face="2"><DiceFacePips n={2} /></div>
        <div className="dice3dFace dice3dFace--3" data-face="3"><DiceFacePips n={3} /></div>
        <div className="dice3dFace dice3dFace--4" data-face="4"><DiceFacePips n={4} /></div>
        <div className="dice3dFace dice3dFace--5" data-face="5"><DiceFacePips n={5} /></div>
        <div className="dice3dFace dice3dFace--6" data-face="6"><DiceFacePips n={6} /></div>
      </div>
    </div>
  );
}

function DiceFacePips({ n }) {
  const pips = [];
  const positions = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3]],
  };
  const grid = positions[n] || [];
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 3; c++) {
      const show = grid.some(([gc, gr]) => gc === c && gr === r);
      pips.push(<span key={`${r}-${c}`} className={`dice3dPip ${show ? "dice3dPip--on" : ""}`} style={{ gridColumn: c, gridRow: r }} />);
    }
  }
  return <div className="dice3dFaceInner">{pips}</div>;
}

/** Dice on board: two 3D dice, click to roll. When server sends dice both clients run 5s roll then static result. */
function BackgammonDiceOnBoard({ dice, rolling, mustRoll, yourTurnToRoll, onRoll, onRollEnd, t }) {
  const rollEndRef = useRef(null);

  useEffect(() => {
    if (!rolling) return;
    rollEndRef.current = setTimeout(() => onRollEnd?.(), 5000);
    return () => { if (rollEndRef.current) clearTimeout(rollEndRef.current); };
  }, [rolling, onRollEnd]);

  const showDice = dice?.length >= 2 ? dice : null;
  const clickable = mustRoll && yourTurnToRoll && !rolling;
  const cubeKey = showDice ? `dice-${showDice[0]}-${showDice[1]}` : "dice-p";

  return (
    <div
      className={`bgDiceOnBoard ${clickable ? "bgDiceOnBoard--clickable" : ""}`}
      onClick={clickable ? onRoll : undefined}
      role={clickable ? "button" : "img"}
      aria-label={showDice ? `${showDice[0]}, ${showDice[1]}` : t("gaming.clickDiceToRoll")}
      title={clickable ? t("gaming.clickDiceToRoll") : undefined}
    >
      {showDice ? (
        <>
          <Dice3DCube key={`${cubeKey}-0`} value={showDice[0]} rolling={rolling} />
          <Dice3DCube key={`${cubeKey}-1`} value={showDice[1]} rolling={rolling} />
        </>
      ) : (
        <span className="bgDiceOnBoardPlaceholder">{mustRoll && yourTurnToRoll ? t("gaming.clickDiceToRoll") : "—"}</span>
      )}
    </div>
  );
}

function BackgammonGame({ state, gameId, myId, onLeave, send, t }) {
  const board = state?.board;
  const points = board?.points ?? [];
  const barWhite = board?.barWhite ?? 0;
  const barBlack = board?.barBlack ?? 0;
  const yourIndex = state?.yourIndex ?? -1;
  const currentPlayer = state?.currentPlayer ?? 0;
  const dice = state?.dice ?? [];
  const mustRoll = state?.mustRoll === true;
  const validMoves = state?.validMoves ?? [];
  const winner = state?.winner;
  const players = state?.players ?? [];
  const canUndo = state?.canUndo === true;
  const undoDeadline = state?.undoDeadline ?? 0;
  const [diceRolling, setDiceRolling] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [movePending, setMovePending] = useState(false);
  const boardRef = useRef(null);
  const prevPhaseRef = useRef(state?.phase);

  useEffect(() => {
    const phase = state?.phase;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === "roll") {
      setMovePending(false);
      return;
    }
    if (phase === "move") {
      setMovePending(false);
      if (state?.dice?.length >= 2 && prev === "roll") setDiceRolling(true);
    }
  }, [state?.phase, state?.dice]);

  useEffect(() => {
    if (gameId && state?.status === "playing" && !board) {
      const id = setTimeout(() => send("gaming:backgammon:state", { gameId }), 300);
      return () => clearTimeout(id);
    }
  }, [gameId, state?.status, board, send]);

  useEffect(() => {
    if (!canUndo || !undoDeadline) {
      setUndoSecondsLeft(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((undoDeadline - Date.now()) / 1000));
      setUndoSecondsLeft(left);
    };
    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [canUndo, undoDeadline]);

  const handleRoll = () => {
    if (!mustRoll) return;
    send("gaming:backgammon:roll", { gameId });
  };
  const handleRollEnd = useCallback(() => setDiceRolling(false), []);

  const handleUndo = () => {
    if (!canUndo || !gameId) return;
    send("gaming:backgammon:undo", { gameId });
  };

  const canMove = state?.phase === "move" && currentPlayer === yourIndex && validMoves.length > 0 && !movePending;
  const isDragging = dragging !== null;
  const showHintsOnlyWhenDragging = isDragging;

  const tryDrop = useCallback((clientX, clientY) => {
    if (!dragging || !gameId) return;
    const target = document.elementFromPoint(clientX, clientY);
    const pointEl = target?.closest("[data-point]");
    const bearOffEl = target?.closest("[data-bearoff]");
    const isMyBearOff = bearOffEl && (
      (yourIndex === 0 && bearOffEl.classList.contains("bgBearOffWhite")) ||
      (yourIndex === 1 && bearOffEl.classList.contains("bgBearOffBlack"))
    );
    let didSend = false;
    if (isMyBearOff) {
      const move = validMoves.find((m) => m.from === dragging.from && m.bearOff);
      if (move) {
        setMovePending(true);
        send("gaming:backgammon:move", { gameId, from: move.from, bearOff: true });
        didSend = true;
        const rect = bearOffEl.getBoundingClientRect();
        setDragging((d) => d ? { ...d, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, landing: true } : null);
      }
    } else if (pointEl) {
      const toPoint = parseInt(pointEl.getAttribute("data-point"), 10);
      const move = validMoves.find((m) => m.from === dragging.from && !m.bearOff && m.to === toPoint);
      if (move) {
        setMovePending(true);
        send("gaming:backgammon:move", { gameId, from: move.from, to: move.to });
        didSend = true;
        const rect = pointEl.getBoundingClientRect();
        setDragging((d) => d ? { ...d, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, landing: true } : null);
      }
    }
    if (didSend) {
      setTimeout(() => setDragging(null), 400);
    } else {
      setDragging(null);
    }
  }, [dragging, gameId, validMoves, send, yourIndex]);

  const handlePointerDown = useCallback((e, fromPoint, fromBar, isWhite) => {
    if (!canMove) return;
    const from = fromBar ? "bar" : fromPoint;
    const hasValid = validMoves.some((m) => (m.from === "bar" && from === "bar") || (m.from === from));
    if (!hasValid) return;
    if (isWhite && yourIndex !== 0) return;
    if (!isWhite && yourIndex !== 1) return;
    e.preventDefault();
    setDragging({ from, fromBar, clientX: e.clientX, clientY: e.clientY, isWhite });
  }, [canMove, validMoves, yourIndex]);

  const hideAtSource = (pointIndex, fromBar, isWhite) => {
    if (!dragging) return 0;
    if (fromBar) return (dragging.fromBar && dragging.isWhite === isWhite) ? 1 : 0;
    return (dragging.from === pointIndex && !dragging.fromBar && dragging.isWhite === isWhite) ? 1 : 0;
  };

  const renderPoint = useCallback((pointNum, isTop) => {
    const pointIndex = pointNum - 1;
    const pt = points[pointIndex] || { w: 0, b: 0 };
    const hasValidFrom = validMoves.some((m) => m.from === pointIndex);
    const validTo = validMoves.filter((m) => m.to === pointIndex).length > 0;
    const whiteDraggable = canMove && yourIndex === 0 && hasValidFrom && pt.w > 0;
    const blackDraggable = canMove && yourIndex === 1 && hasValidFrom && pt.b > 0;
    return (
      <div
        key={pointNum}
        className={`bgPoint ${isTop ? "bgPointTop" : "bgPointBottom"} ${showHintsOnlyWhenDragging && validTo ? "bgPoint--valid bgPoint--hint" : ""}`}
        data-point={pointIndex}
      >
        <span className="bgPointNum">{pointNum}</span>
        <div className={`bgPointCheckers ${isTop ? "bgPointCheckers--top" : "bgPointCheckers--bottom"}`}>
          {Array.from({ length: Math.max(0, pt.w - hideAtSource(pointIndex, false, true)) }).map((_, i) => (
            <div
              key={`pt${pointIndex}-w-${i}`}
              className={`bgChecker bgCheckerWhite ${whiteDraggable ? "bgChecker--draggable" : ""}`}
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, pointIndex, false, true); }}
              role={whiteDraggable ? "button" : undefined}
            />
          ))}
          {Array.from({ length: Math.max(0, pt.b - hideAtSource(pointIndex, false, false)) }).map((_, i) => (
            <div
              key={`pt${pointIndex}-b-${i}`}
              className={`bgChecker bgCheckerBlack ${blackDraggable ? "bgChecker--draggable" : ""}`}
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, pointIndex, false, false); }}
              role={blackDraggable ? "button" : undefined}
            />
          ))}
        </div>
      </div>
    );
  }, [points, validMoves, canMove, yourIndex, showHintsOnlyWhenDragging, handlePointerDown]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => setDragging((d) => d ? { ...d, clientX: e.clientX, clientY: e.clientY } : null);
    const onUp = (e) => {
      tryDrop(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, tryDrop]);

  if (winner !== undefined && winner !== null) {
    const won = winner === yourIndex;
    return (
      <div className="gamingPage gamingGame gamingGameOver">
        <div className="gamingContent gamingGameOverContent">
          <div className={`gamingGameOverCard ${won ? "gamingGameOverCard--won" : "gamingGameOverCard--lost"}`}>
            <h2 className="gamingGameOverTitle">{won ? t("gaming.youWonBackgammon") : t("gaming.youLostBackgammon")}</h2>
            <p className="gamingGameOverSub">{players[winner]?.name} won!</p>
          </div>
          <button type="button" className="gamingBtn gamingBtnPrimary gamingGameOverBackBtn" onClick={onLeave}>
            {t("gaming.backToMenu")}
          </button>
        </div>
      </div>
    );
  }

  if (state?.status === "playing" && !board) {
    return (
      <div className="gamingPage gamingGame gamingBackgammon">
        <header className="gamingHeader gamingBackgammonHeader">
          <button type="button" className="gamingLeaveBtn" onClick={onLeave}>{t("gaming.leave")}</button>
        </header>
        <div className="gamingContent gamingBackgammonContent">
          <p className="gamingBackgammonLoading"><Loader2 size={28} className="spin" /> {t("common.loading")}</p>
        </div>
      </div>
    );
  }

  const validBearOff = canMove && validMoves.some((m) => m.bearOff);
  const showHints = showHintsOnlyWhenDragging;

  return (
    <div className="gamingPage gamingGame gamingBackgammon">
      {dragging && (
        <div
          className={`bgCheckerGhost ${dragging.isWhite ? "bgCheckerWhite" : "bgCheckerBlack"} ${dragging.landing ? "bgCheckerGhost--landing" : ""}`}
          style={{ left: dragging.clientX, top: dragging.clientY }}
          aria-hidden
        />
      )}
      <header className="gamingHeader gamingBackgammonHeader">
        <button type="button" className="gamingLeaveBtn" onClick={onLeave}>{t("gaming.leave")}</button>
        <div className="gamingBackgammonTurn">
          {currentPlayer === yourIndex ? t("gaming.yourTurn") : t("gaming.opponentTurn")}
        </div>
        {canUndo && undoSecondsLeft > 0 && (
          <button type="button" className="gamingBtn gamingBtnSecondary gamingBackgammonUndoBtn" onClick={handleUndo}>
            {t("gaming.undo")} ({undoSecondsLeft}s)
          </button>
        )}
      </header>
      <div className="gamingContent gamingBackgammonContent">
        <div className="bgBoard" ref={boardRef}>
          <div
            className={`bgBearOff bgBearOffWhite ${showHints && validBearOff && yourIndex === 0 ? "bgBearOff--hint" : ""}`}
            data-bearoff
            title={t("gaming.white")}
          />
          <div className="bgBoardMiddle">
            <div className="bgPoints bgPointsTop">
              {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((pointNum) => renderPoint(pointNum, true))}
            </div>
            <div className="bgBar bgBarSplitter" data-bar>
              <div className="bgBarCheckers bgBarWhite">
                {Array.from({ length: Math.max(0, barWhite - hideAtSource(null, true, true)) }).map((_, i) => (
                  <div
                    key={`bar-w-${i}`}
                    className={`bgChecker bgCheckerWhite ${canMove && yourIndex === 0 ? "bgChecker--draggable" : ""}`}
                    onPointerDown={(e) => { e.stopPropagation(); if (canMove && yourIndex === 0) handlePointerDown(e, null, true, true); }}
                    role={canMove && yourIndex === 0 ? "button" : undefined}
                  />
                ))}
              </div>
              <BackgammonDiceOnBoard
                dice={dice}
                rolling={diceRolling}
                mustRoll={mustRoll}
                yourTurnToRoll={currentPlayer === yourIndex}
                onRoll={handleRoll}
                onRollEnd={handleRollEnd}
                t={t}
              />
              <div className="bgBarCheckers bgBarBlack">
                {Array.from({ length: Math.max(0, barBlack - hideAtSource(null, true, false)) }).map((_, i) => (
                  <div
                    key={`bar-b-${i}`}
                    className={`bgChecker bgCheckerBlack ${canMove && yourIndex === 1 ? "bgChecker--draggable" : ""}`}
                    onPointerDown={(e) => { e.stopPropagation(); if (canMove && yourIndex === 1) handlePointerDown(e, null, true, false); }}
                    role={canMove && yourIndex === 1 ? "button" : undefined}
                  />
                ))}
              </div>
            </div>
            <div className="bgPoints bgPointsBottom">
              {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24].map((pointNum) => renderPoint(pointNum, false))}
            </div>
          </div>
          <div
            className={`bgBearOff bgBearOffBlack ${showHints && validBearOff && yourIndex === 1 ? "bgBearOff--hint" : ""}`}
            data-bearoff
            title={t("gaming.black")}
          />
        </div>
      </div>
    </div>
  );
}

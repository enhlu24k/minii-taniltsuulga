import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  Flame,
  Heart,
  LogIn,
  LogOut,
  Play,
  RotateCcw,
  Trash2,
  Trophy,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { CATEGORIES, CategoryId, Question } from '../data/categories';
import { ANIME_CATEGORIES, AnimeCategoryId } from '../data/animeCategories';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { getCategoryDisplay, Lang, loadLang, saveLang } from '../utils/i18n';
import { sfx } from '../utils/sound';
import Leaderboard from './Leaderboard';
import ConfettiBurst from './ConfettiBurst';

export type GameMode = 'anime' | 'sports';

interface EmojiQuizWindowProps {
  mode: GameMode;
  lang?: Lang;
  onLangChange?: (lang: Lang) => void;
  onClose: () => void;
}

const MAX_LIVES = 3;
const QUESTION_TIME_SECONDS = 10;
const PLAYER_NAME_KEY = 'emoji_quiz_player_name_v1';

interface SavedStats {
  totalScore: number;
  gamesPlayed: number;
  highScores: Record<string, number>;
}

type QuizGameName = 'Anime Guess' | 'Sports Emoji Quiz';

interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  game: QuizGameName;
  mode: string;
  categoryId: string;
  categoryIcon: string;
  correctCount: number;
  totalQuestions: number;
  won: boolean;
  authorId: string;
  createdAtMs: number;
}

type Screen = 'start' | 'game' | 'end' | 'leaderboard';

interface QuizCategory {
  id: string;
  name: string;
  short: string;
  icon: string;
  questions: Question[];
}

function loadPlayerName(): string {
  try {
    const saved = localStorage.getItem(PLAYER_NAME_KEY);
    return saved && saved.trim() ? saved.trim().slice(0, 24) : '';
  } catch {
    return '';
  }
}

function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // Ignore storage errors
  }
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function EmojiQuizWindow({
  mode,
  lang: controlledLang,
  onLangChange,
  onClose,
}: EmojiQuizWindowProps) {
  const isAnime = mode === 'anime';
  const storageKey = isAnime ? 'anime_emoji_guesser_v1' : 'sports_emoji_guesser_v2';
  const categoryMap: Record<string, QuizCategory> = isAnime ? ANIME_CATEGORIES : CATEGORIES;
  const defaultCatId: string = isAnime ? ('naruto' satisfies AnimeCategoryId) : ('football' satisfies CategoryId);

  const [internalLang, setInternalLang] = useState<Lang>(() => loadLang());
  const lang = controlledLang ?? internalLang;
  const isEn = lang === 'en';

  const handleSelectLang = useCallback(
    (nextLang: Lang) => {
      if (nextLang === lang) return;
      saveLang(nextLang);
      setInternalLang(nextLang);
      onLangChange?.(nextLang);
    },
    [lang, onLangChange]
  );

  const loadStats = useCallback((): SavedStats => {
    const baseHighScores: Record<string, number> = {};
    Object.keys(categoryMap).forEach((k) => {
      baseHighScores[k] = 0;
    });
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return { totalScore: 0, gamesPlayed: 0, highScores: baseHighScores };
      const parsed = JSON.parse(raw);
      return {
        totalScore: parsed.totalScore || 0,
        gamesPlayed: parsed.gamesPlayed || 0,
        highScores: { ...baseHighScores, ...(parsed.highScores || {}) },
      };
    } catch {
      return { totalScore: 0, gamesPlayed: 0, highScores: baseHighScores };
    }
  }, [categoryMap, storageKey]);

  const saveStats = useCallback(
    (stats: SavedStats) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(stats));
      } catch {
        // Ignore storage errors
      }
    },
    [storageKey]
  );

  const [screen, setScreen] = useState<Screen>('start');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(defaultCatId);
  const [savedStats, setSavedStats] = useState<SavedStats>(() => loadStats());
  const [muted, setMuted] = useState(sfx.muted);

  useEffect(() => {
    setMuted(sfx.muted);
    return sfx.subscribe(setMuted);
  }, []);

  const gameLabel: QuizGameName = isAnime ? 'Anime Guess' : 'Sports Emoji Quiz';

  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(false);
  const [playerName, setPlayerName] = useState<string>(() => loadPlayerName());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  const [endNameInput, setEndNameInput] = useState<string>(() => loadPlayerName());
  const [savingScore, setSavingScore] = useState(false);
  const [savedScoreDocId, setSavedScoreDocId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; type: 'good' | 'bad' | '' }>({
    text: '',
    type: '',
  });
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [gameResult, setGameResult] = useState<{
    won: boolean;
    isNewRecord: boolean;
    finalLives: number;
  }>({ won: false, isNewRecord: false, finalLives: MAX_LIVES });
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [timeRemainingMs, setTimeRemainingMs] = useState(QUESTION_TIME_SECONDS * 1000);

  const transitionTimerRef = useRef<number | null>(null);
  const lastTickSecondRef = useRef<number>(QUESTION_TIME_SECONDS);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTransitionTimer();
  }, [clearTransitionTimer]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user?.displayName) {
        setPlayerName((prev) => prev || user.displayName!.slice(0, 24));
        setEndNameInput((prev) => prev || user.displayName!.slice(0, 24));
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    setLeaderboardLoading(true);

    const scoresQuery = query(
      collection(db, 'scores'),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      scoresQuery,
      (snapshot) => {
        const rows: LeaderboardEntry[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const createdTs = data.createdAt;
          const createdAtMs =
            createdTs instanceof Timestamp ? createdTs.toMillis() : Date.now();
          return {
            id: docSnap.id,
            playerName: typeof data.playerName === 'string' ? data.playerName : 'Тоглогч',
            score: typeof data.score === 'number' ? data.score : 0,
            game: data.game === 'Sports Emoji Quiz' ? 'Sports Emoji Quiz' : 'Anime Guess',
            mode: typeof data.mode === 'string' ? data.mode : '',
            categoryId: typeof data.categoryId === 'string' ? data.categoryId : '',
            categoryIcon: typeof data.categoryIcon === 'string' ? data.categoryIcon : '🏆',
            correctCount: typeof data.correctCount === 'number' ? data.correctCount : 0,
            totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : 15,
            won: Boolean(data.won),
            authorId: typeof data.authorId === 'string' ? data.authorId : '',
            createdAtMs,
          };
        });
        rows.sort(
          (a, b) =>
            b.score - a.score ||
            b.correctCount - a.correctCount ||
            b.createdAtMs - a.createdAtMs
        );
        setLeaderboard(rows);
        setLeaderboardLoading(false);
      },
      (error) => {
        setLeaderboardLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'scores');
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  const categoriesList: QuizCategory[] = Object.values(categoryMap);
  const activeCategory: QuizCategory = categoryMap[selectedCategoryId] || categoriesList[0];
  const activeCatDisplay = getCategoryDisplay(
    activeCategory.id,
    activeCategory.name,
    activeCategory.short,
    lang
  );
  const topRecord = Math.max(...Object.values(savedStats.highScores), 0);
  const currentCatBest = savedStats.highScores[activeCategory.id] || 0;
  const displayedBest = screen === 'game' ? Math.max(currentCatBest, score) : currentCatBest;

  const modeLeaderboard = useMemo(
    () => leaderboard.filter((entry) => entry.game === gameLabel),
    [leaderboard, gameLabel]
  );
  const savedEntryRank = savedScoreDocId
    ? modeLeaderboard.findIndex((entry) => entry.id === savedScoreDocId) + 1
    : 0;

  const progressPercent =
    screen === 'end'
      ? gameResult.won
        ? 100
        : questions.length
          ? (currentIndex / questions.length) * 100
          : 0
      : screen === 'game' && questions.length
        ? (currentIndex / questions.length) * 100
        : 0;

  const startGame = useCallback(() => {
    clearTransitionTimer();
    sfx.click();

    const prepared = shuffle(activeCategory.questions).map((q) => ({
      ...q,
      options: shuffle(q.options),
    }));

    setQuestions(prepared);
    setCurrentIndex(0);
    setLives(MAX_LIVES);
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setLocked(false);
    setSelectedOption(null);
    setFeedback({ text: '', type: '' });
    setTimeRemainingMs(QUESTION_TIME_SECONDS * 1000);
    lastTickSecondRef.current = QUESTION_TIME_SECONDS;
    setScreen('game');
  }, [activeCategory, clearTransitionTimer]);

  const finishGame = useCallback(
    (won: boolean, finalScore: number, finalLives: number) => {
      const prevBest = savedStats.highScores[activeCategory.id] || 0;
      const isNewGlobalTop = modeLeaderboard.length > 0 && finalScore > modeLeaderboard[0].score;
      const isNewRecord = finalScore > 0 && (finalScore > prevBest || isNewGlobalTop);

      const updated: SavedStats = {
        gamesPlayed: savedStats.gamesPlayed + 1,
        totalScore: savedStats.totalScore + finalScore,
        highScores: {
          ...savedStats.highScores,
          [activeCategory.id]: Math.max(prevBest, finalScore),
        },
      };

      setSavedStats(updated);
      saveStats(updated);

      const defaultName =
        playerName.trim().slice(0, 24) ||
        currentUser?.displayName?.trim().slice(0, 24) ||
        '';
      setEndNameInput(defaultName);
      setSavedScoreDocId(null);
      setSavingScore(false);
      setSaveError('');

      setGameResult({ won, isNewRecord, finalLives });
      if (isNewRecord) {
        setConfettiBurstKey((k) => k + 1);
      }
      setScreen('end');

      if (won || isNewRecord) {
        sfx.win();
      } else {
        sfx.gameOver();
      }
    },
    [activeCategory.id, currentUser, modeLeaderboard, playerName, saveStats, savedStats]
  );

  const handleAnswer = useCallback(
    (option: string | null) => {
      if (locked || screen !== 'game') return;
      const q = questions[currentIndex];
      if (!q) return;

      setLocked(true);
      setSelectedOption(option);

      const isTimeout = option === null;
      const isCorrect = !isTimeout && option === q.answer;
      let nextScore = score;
      let nextLives = lives;
      let nextStreak = streak;
      let nextCorrectCount = correctCount;

      if (isCorrect) {
        nextStreak = streak + 1;
        const bonus = nextStreak >= 2 ? (nextStreak - 1) * 5 : 0;
        const gained = 10 + bonus;
        nextScore = score + gained;
        nextCorrectCount = correctCount + 1;

        setStreak(nextStreak);
        setCorrectCount(nextCorrectCount);
        setScore(nextScore);
        setFeedback({
          text:
            bonus > 0
              ? isEn
                ? `Correct · +${gained} pts (${nextStreak} streak)`
                : `Зөв хариуллаа · +${gained} оноо (${nextStreak} дараалал)`
              : isEn
                ? `Correct · +${gained} pts`
                : `Зөв хариуллаа · +${gained} оноо`,
          type: 'good',
        });
        sfx.correct(nextStreak);
      } else {
        nextLives = lives - 1;
        nextStreak = 0;

        setLives(nextLives);
        setStreak(0);
        setFeedback({
          text: isTimeout
            ? isEn
              ? `Time's up · Answer: ${q.answer}`
              : `Хугацаа дууслаа · Зөв хариу: ${q.answer}`
            : isEn
              ? `Wrong · Answer: ${q.answer}`
              : `Буруу · Зөв хариу: ${q.answer}`,
          type: 'bad',
        });
        setShakeTrigger((n) => n + 1);
        sfx.incorrect();
      }

      clearTransitionTimer();
      transitionTimerRef.current = window.setTimeout(() => {
        if (nextLives <= 0) {
          finishGame(false, nextScore, nextLives);
        } else if (currentIndex + 1 >= questions.length) {
          setCurrentIndex(questions.length);
          finishGame(true, nextScore, nextLives);
        } else {
          setCurrentIndex((idx) => idx + 1);
          setLocked(false);
          setSelectedOption(null);
          setFeedback({ text: '', type: '' });
          setTimeRemainingMs(QUESTION_TIME_SECONDS * 1000);
          lastTickSecondRef.current = QUESTION_TIME_SECONDS;
        }
      }, 1150);
    },
    [clearTransitionTimer, correctCount, currentIndex, finishGame, isEn, lives, locked, questions, score, screen, streak]
  );

  const goToHome = useCallback(() => {
    clearTransitionTimer();
    sfx.click();
    setScore(0);
    setStreak(0);
    setLives(MAX_LIVES);
    setLocked(false);
    setSelectedOption(null);
    setFeedback({ text: '', type: '' });
    setScreen('start');
  }, [clearTransitionTimer]);

  const handlePlayerNameChange = useCallback((value: string) => {
    const trimmed = value.slice(0, 24);
    setPlayerName(trimmed);
    if (trimmed.trim()) {
      savePlayerName(trimmed.trim());
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    sfx.click();
    setSaveError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      return cred.user;
    } catch {
      setSaveError(
        isEn ? 'Google sign-in was cancelled or failed.' : 'Google нэвтрэлт цуцлагдлаа эсвэл амжилтгүй боллоо.'
      );
      return null;
    }
  }, [isEn]);

  const handleGoogleSignOut = useCallback(async () => {
    sfx.click();
    try {
      await signOut(auth);
    } catch {
      // Ignore sign out error
    }
  }, []);

  const handleSaveScoreToFirestore = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (savingScore || savedScoreDocId) return;

      const cleanName = endNameInput.trim().slice(0, 24);
      if (!cleanName) {
        setSaveError(isEn ? 'Please enter your player name.' : 'Тоглогчийн нэрээ оруулна уу.');
        return;
      }

      setSavingScore(true);
      setSaveError('');

      let activeUser = auth.currentUser;
      if (!activeUser) {
        activeUser = await handleGoogleSignIn();
        if (!activeUser) {
          setSavingScore(false);
          return;
        }
      }

      setPlayerName(cleanName);
      savePlayerName(cleanName);

      const safeScore = Math.max(0, Math.min(5000, Math.floor(score)));
      const safeTotal = Math.max(1, Math.min(50, questions.length || 15));
      const safeCorrect = Math.max(0, Math.min(safeTotal, Math.floor(correctCount)));
      const newDocRef = doc(collection(db, 'scores'));

      const payload = {
        playerName: cleanName,
        score: safeScore,
        game: gameLabel,
        mode: activeCategory.short.slice(0, 40),
        categoryId: activeCategory.id.slice(0, 32),
        categoryIcon: activeCategory.icon.slice(0, 12),
        correctCount: safeCorrect,
        totalQuestions: safeTotal,
        won: gameResult.won,
        authorId: activeUser.uid,
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(newDocRef, payload);
        setSavedScoreDocId(newDocRef.id);
        sfx.correct();
      } catch (error) {
        setSaveError(isEn ? 'Failed to save score to Firestore.' : 'Firestore руу хадгалахад алдаа гарлаа.');
        handleFirestoreError(error, OperationType.CREATE, `scores/${newDocRef.id}`);
      } finally {
        setSavingScore(false);
      }
    },
    [
      activeCategory,
      correctCount,
      endNameInput,
      gameLabel,
      gameResult.won,
      handleGoogleSignIn,
      isEn,
      questions.length,
      savedScoreDocId,
      savingScore,
      score,
    ]
  );

  const openLeaderboard = useCallback(() => {
    sfx.click();
    setScreen('leaderboard');
  }, []);

  const handleResetStats = useCallback(() => {
    sfx.click();
    const baseHighScores: Record<string, number> = {};
    Object.keys(categoryMap).forEach((k) => {
      baseHighScores[k] = 0;
    });
    const def: SavedStats = { totalScore: 0, gamesPlayed: 0, highScores: baseHighScores };
    setSavedStats(def);
    saveStats(def);
  }, [categoryMap, saveStats]);

  const handleToggleSound = useCallback(() => {
    sfx.toggle();
  }, []);

  const handleAnswerRef = useRef(handleAnswer);
  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  useEffect(() => {
    if (screen !== 'game' || locked || !questions[currentIndex]) return;

    const totalMs = QUESTION_TIME_SECONDS * 1000;
    const startTime = performance.now();
    setTimeRemainingMs(totalMs);
    lastTickSecondRef.current = QUESTION_TIME_SECONDS;

    const intervalId = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, totalMs - elapsed);
      setTimeRemainingMs(remaining);

      const ceilSec = Math.ceil(remaining / 1000);
      if (ceilSec > 0 && ceilSec <= 3 && ceilSec < lastTickSecondRef.current) {
        lastTickSecondRef.current = ceilSec;
        sfx.tick();
      }

      if (remaining <= 0) {
        window.clearInterval(intervalId);
        handleAnswerRef.current(null);
      }
    }, 80);

    return () => window.clearInterval(intervalId);
  }, [currentIndex, locked, questions, screen]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (screen === 'leaderboard') {
          setScreen('start');
          return;
        }
        clearTransitionTimer();
        onClose();
        return;
      }
      if (screen !== 'game' || locked) return;
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx !== -1) {
        const currentQ = questions[currentIndex];
        if (currentQ && currentQ.options[idx]) {
          handleAnswer(currentQ.options[idx]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearTransitionTimer, currentIndex, handleAnswer, locked, onClose, questions, screen]);

  const currentQuestion = questions[currentIndex];
  const timeLeftSeconds = Math.ceil(timeRemainingMs / 1000);
  const timerPercent = (timeRemainingMs / (QUESTION_TIME_SECONDS * 1000)) * 100;
  const isUrgent = !locked && timeLeftSeconds <= 3;
  const isWarning = !locked && timeLeftSeconds > 3 && timeLeftSeconds <= 5;

  const gameTitle = isAnime ? 'Anime Emoji Guess' : 'Sports Emoji Quiz';
  const heroKicker = isEn
    ? isAnime
      ? 'Anime Character Quiz'
      : 'Sports Athlete Quiz'
    : isAnime
      ? 'Анимэ дүр таах тоглоом'
      : 'Тамирчин таах тоглоом';
  const heroHeadline = isEn
    ? isAnime
      ? 'Guess the Anime Character'
      : 'Guess the Sports Legend'
    : isAnime
      ? 'Эможигоор Анимэ Дүр Таа'
      : 'Эможигоор Тамирчин Таа';
  const heroDesc = isEn
    ? isAnime
      ? 'Read three emoji clues and name iconic anime characters within 10 seconds.'
      : 'Read three emoji clues and guess world-famous athletes and racers within 10 seconds.'
    : isAnime
      ? 'Гурван эможи сэжүүрийг уншаад алдартай анимэ баатруудыг 10 секундийн дотор зөв нэрлээрэй.'
      : 'Гурван эможи сэжүүрийг уншаад дэлхийн спортын шилдэг оддыг 10 секундийн дотор зөв нэрлээрэй.';

  return (
    <div className="game-window-overlay fixed inset-0 z-[80] flex flex-col bg-[#e6e0cf] text-[#201c15] overflow-y-auto">
      {screen === 'end' && <ConfettiBurst burstKey={confettiBurstKey} />}
      {/* Top Bar matching the portfolio parchment & ink aesthetic */}
      <header className="w-full border-b-2 border-[#16130e] bg-[#ece7d8]/95 backdrop-blur-sm shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 min-h-[58px] sm:min-h-[64px] py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => {
                clearTransitionTimer();
                sfx.click();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 min-h-[38px] sm:min-h-[40px] rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#e2dcce] text-xs font-bold text-[#201c15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">
                {isEn ? 'Back to Portfolio' : 'Портфолио руу буцах'}
              </span>
            </button>
            <span className="font-serif-display text-base sm:text-xl md:text-2xl uppercase tracking-tight text-[#16130e] whitespace-nowrap truncate">
              {gameTitle}
            </span>
          </div>

          <div className="hidden xl:flex items-center gap-3 text-xs font-semibold text-[#5a5243] whitespace-nowrap">
            {screen === 'start' || screen === 'leaderboard' ? (
              <>
                <span>{isEn ? '4 categories' : '4 ангилал'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {isEn ? `Best ${topRecord}` : `Нийт рекорд ${topRecord}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {isEn ? `Played ${savedStats.gamesPlayed}` : `Тоглосон ${savedStats.gamesPlayed}`}
                </span>
              </>
            ) : (
              <>
                <span className="text-[#16130e] font-bold">{activeCatDisplay.name}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {isEn ? `Score ${score}` : `Оноо ${score}`}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {isEn ? `Best ${displayedBest}` : `Рекорд ${displayedBest}`}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {screen !== 'game' && (
              <>
                {currentUser ? (
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={handleGoogleSignOut}
                    title={`${currentUser.displayName || currentUser.email} — ${isEn ? 'Sign out' : 'Гарах'}`}
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#e2dcce] text-xs font-bold text-[#201c15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <User className="w-3.5 h-3.5 text-emerald-800" />
                    <span className="max-w-[96px] truncate">
                      {currentUser.displayName?.split(' ')[0] || (isEn ? 'Signed in' : 'Бүртгэлтэй')}
                    </span>
                    <LogOut className="w-3.5 h-3.5 text-[#5a5243]" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={handleGoogleSignIn}
                    className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#e2dcce] text-xs font-bold text-[#201c15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5 text-amber-800" />
                    <span>{isEn ? 'Sign in' : 'Нэвтрэх'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onMouseEnter={() => sfx.hover()}
                  onClick={() => {
                    if (screen === 'leaderboard') {
                      sfx.click();
                      setScreen('start');
                    } else {
                      openLeaderboard();
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] sm:min-h-[40px] rounded-xl border-2 border-[#16130e] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    screen === 'leaderboard'
                      ? 'bg-[#16130e] text-[#e6e0cf]'
                      : 'bg-[#f8f5ec] hover:bg-[#e2dcce] text-[#201c15]'
                  }`}
                >
                  <Trophy className={`w-4 h-4 ${screen === 'leaderboard' ? 'text-amber-300' : 'text-amber-800'}`} />
                  <span className="hidden lg:inline">{isEn ? 'Leaderboard' : 'Тэргүүлэгчид'}</span>
                  {modeLeaderboard.length > 0 && (
                    <span className="font-mono-num text-[11px] opacity-80">({modeLeaderboard.length})</span>
                  )}
                </button>
              </>
            )}

            {/* MN | EN Language Switch */}
            <div
              role="group"
              aria-label={isEn ? 'Language switch' : 'Хэл солих'}
              className="inline-flex items-center p-0.5 rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] shrink-0"
            >
              {(['mn', 'en'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onMouseEnter={() => sfx.hover()}
                  onClick={() => handleSelectLang(code)}
                  className={`px-1.5 sm:px-2 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer ${
                    lang === code
                      ? 'bg-[#16130e] text-[#e6e0cf]'
                      : 'text-[#201c15] hover:bg-[#ebe5d4]'
                  }`}
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-sfx="custom"
              onClick={handleToggleSound}
              onMouseEnter={() => sfx.hover()}
              aria-label={muted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
              title={muted ? (isEn ? 'Unmute sound' : 'Дуу асаах') : (isEn ? 'Mute sound' : 'Дуу хаах')}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] sm:min-h-[40px] rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#e2dcce] text-xs font-bold text-[#201c15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {muted ? <VolumeX className="w-4 h-4 text-[#6d6657]" /> : <Volume2 className="w-4 h-4 text-amber-800" />}
              <span className="hidden lg:inline">
                {muted ? (isEn ? 'Muted' : 'Дуугүй') : (isEn ? 'Sound' : 'Дуутай')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearTransitionTimer();
                onClose();
              }}
              aria-label={isEn ? 'Close game window' : 'Тоглоомын цонх хаах'}
              className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-rose-100 text-[#201c15] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-12 pb-[max(2rem,env(safe-area-inset-bottom))] flex flex-col justify-start md:justify-center">
        {screen === 'start' && (
          <section className="screen-enter grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-9 lg:gap-12 items-start">
            <div className="lg:col-span-5 flex flex-col">
              <p className="text-xs font-bold tracking-[0.16em] text-[#6d6657] uppercase mb-2.5">
                {heroKicker}
              </p>
              <h1 className="font-serif-display text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-[#16130e] leading-[1.04] text-balance mb-3 sm:mb-4">
                {heroHeadline}
              </h1>
              <p className="text-sm sm:text-[15px] leading-relaxed text-[#4d4436] mb-6 sm:mb-7">
                {heroDesc}
              </p>

              {/* Career Summary Strip */}
              <div className="grid grid-cols-3 border-y-2 border-[#16130e]/25 py-3.5 sm:py-4 mb-6 sm:mb-7">
                <div className="pr-2.5 sm:pr-4">
                  <div className="font-mono-num text-xl sm:text-3xl font-bold text-amber-800">
                    {topRecord}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                    {isEn ? 'Best Score' : 'Шилдэг оноо'}
                  </div>
                </div>
                <div className="px-2.5 sm:px-4 border-l-2 border-[#16130e]/15">
                  <div className="font-mono-num text-xl sm:text-3xl font-bold text-[#16130e]">
                    {savedStats.totalScore}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                    {isEn ? 'Total Score' : 'Нийт оноо'}
                  </div>
                </div>
                <div className="pl-2.5 sm:pl-4 border-l-2 border-[#16130e]/15">
                  <div className="font-mono-num text-xl sm:text-3xl font-bold text-[#16130e]">
                    {savedStats.gamesPlayed}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                    {isEn ? 'Played' : 'Тоглосон'}
                  </div>
                </div>
              </div>

              {/* Clean Rules List */}
              <div className="space-y-2 text-sm text-[#352f25] mb-6">
                <div className="flex items-center justify-between py-1.5 border-b border-[#16130e]/12">
                  <span className="text-[#5a5243] font-medium">
                    {isEn ? 'Lives & Rounds' : 'Амь ба эрх'}
                  </span>
                  <span className="font-bold text-[#16130e] tabular-nums">
                    {isEn ? '3 lives · 15 questions' : '3 амь · 15 асуулт'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#16130e]/12">
                  <span className="text-[#5a5243] font-medium">
                    {isEn ? 'Time Limit' : 'Хугацааны хязгаар'}
                  </span>
                  <span className="font-bold text-[#16130e] tabular-nums">
                    {isEn ? `${QUESTION_TIME_SECONDS}s per question` : `Асуулт бүр ${QUESTION_TIME_SECONDS} секунд`}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-[#16130e]/12">
                  <span className="text-[#5a5243] font-medium">
                    {isEn ? 'Scoring' : 'Онооны систем'}
                  </span>
                  <span className="font-bold text-[#16130e]">
                    {isEn ? '+10 pts · Streak bonus' : '+10 оноо · Дарааллын бонус'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#5a5243] font-medium">
                    {isEn ? 'Controls' : 'Удирдлага'}
                  </span>
                  <span className="font-mono-num text-xs font-bold text-[#352f25]">
                    {isEn ? 'Mouse or Keys 1–4' : 'Хулгана эсвэл 1–4 товч'}
                  </span>
                </div>
              </div>

              {/* Player Nickname Input */}
              <div className="mb-6">
                <label
                  htmlFor="quiz-player-name"
                  className="block text-xs font-bold uppercase tracking-wider text-[#5a5243] mb-2"
                >
                  {isEn ? 'Player Name (Leaderboard)' : 'Тоглогчийн нэр (Leaderboard)'}
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-[#5a5243] absolute left-3.5 pointer-events-none" />
                  <input
                    id="quiz-player-name"
                    type="text"
                    maxLength={24}
                    value={playerName}
                    onChange={(e) => handlePlayerNameChange(e.target.value)}
                    placeholder={isEn ? 'Enter your name...' : 'Нэрээ бичнэ үү...'}
                    className="w-full pl-10 pr-4 py-2.5 min-h-[44px] rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] focus:bg-white focus:outline-none text-sm font-bold text-[#16130e] placeholder:text-[#8c826f] transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onMouseEnter={() => sfx.hover()}
                  onClick={startGame}
                  className="w-full sm:w-auto sm:flex-1 sm:min-w-[210px] inline-flex items-center justify-center gap-2.5 px-6 py-3.5 min-h-[48px] rounded-full bg-[#16130e] hover:bg-[#2a251c] text-[#e6e0cf] border-2 border-[#16130e] shadow-[0_6px_0_-1px_#e6e0cf,0_6px_0_2px_#16130e] hover:translate-y-[2px] hover:shadow-[0_4px_0_-1px_#e6e0cf,0_4px_0_2px_#16130e] font-bold text-sm uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isEn ? `Start ${activeCatDisplay.short}` : `${activeCatDisplay.short} эхлүүлэх`}
                  </span>
                </button>

                {(savedStats.gamesPlayed > 0 || topRecord > 0) && (
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={handleResetStats}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[48px] rounded-full border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-rose-100 text-xs font-bold uppercase tracking-wide text-[#201c15] hover:text-rose-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{isEn ? 'Reset Stats' : 'Оноо цэвэрлэх'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col gap-5">
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-3.5 sm:mb-4">
                  <h2 className="font-serif-display text-xl sm:text-2xl uppercase tracking-tight text-[#16130e]">
                    {isEn ? 'Choose Category' : 'Ангилал сонгох'}
                  </h2>
                  <span className="text-xs font-semibold text-[#5a5243]">
                    {isEn ? '4 Modes · 60 Questions' : 'Нийт 4 төрөл · 60 асуулт'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {categoriesList.map((cat) => {
                    const catBest = savedStats.highScores[cat.id] || 0;
                    const isSelected = cat.id === activeCategory.id;
                    const catDisplay = getCategoryDisplay(cat.id, cat.name, cat.short, lang);

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onMouseEnter={() => sfx.hover()}
                        onClick={() => {
                          sfx.click();
                          setSelectedCategoryId(cat.id);
                        }}
                        className={`group text-left p-4 sm:p-5 rounded-2xl border-2 border-[#16130e] transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-[#f8f5ec] shadow-[5px_5px_0_#16130e] -translate-y-0.5'
                            : 'bg-[#ebe5d4] hover:bg-[#f4efe1] hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <span className="text-4xl leading-none select-none transition-transform duration-150 group-hover:scale-110">
                            {cat.icon}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center border-2 transition-colors ${
                              isSelected
                                ? 'bg-[#16130e] border-[#16130e] text-[#e6e0cf]'
                                : 'border-[#16130e]/30 text-transparent bg-[#f8f5ec]'
                            }`}
                            aria-hidden="true"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        </div>

                        <div className="font-bold text-lg text-[#16130e] tracking-tight mb-1.5">
                          {catDisplay.name}
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold text-[#5a5243] tabular-nums">
                          <span>
                            {cat.questions.length} {isEn ? 'questions' : 'асуулт'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={catBest > 0 ? 'text-amber-800 font-bold' : ''}>
                            {isEn ? `Best ${catBest}` : `Рекорд ${catBest}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compact Leaderboard Preview Strip */}
              <div className="rounded-2xl border-2 border-[#16130e] bg-[#f8f5ec] p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-800" />
                    <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#16130e]">
                      {isEn ? 'Top 3 Players' : 'Шилдэг 3 тоглогч'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onMouseEnter={() => sfx.hover()}
                    onClick={openLeaderboard}
                    className="text-xs font-bold text-amber-800 hover:text-[#16130e] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                  >
                    {isEn ? 'View full board →' : 'Бүх самбар үзэх →'}
                  </button>
                </div>

                {leaderboardLoading ? (
                  <p className="text-xs font-medium text-[#5a5243] py-1">
                    {isEn ? 'Loading Firestore leaderboard...' : 'Firestore самбар ачаалж байна...'}
                  </p>
                ) : modeLeaderboard.length === 0 ? (
                  <p className="text-xs font-medium text-[#5a5243] py-1">
                    {isEn
                      ? 'No scores recorded yet. Finish a round to claim the top spot!'
                      : 'Одоогоор оноо бүртгэгдээгүй байна. Эхний тоглолтоо дуусгаад самбарыг тэргүүлээрэй.'}
                  </p>
                ) : (
                  <div className="divide-y divide-[#16130e]/12">
                    {modeLeaderboard.slice(0, 3).map((entry, idx) => {
                      const modeShort = entry.mode
                        ? getCategoryDisplay(entry.categoryId, entry.mode, entry.mode, lang).short
                        : '';
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-6 h-6 rounded-md border font-mono-num font-bold flex items-center justify-center shrink-0 ${
                                idx === 0
                                  ? 'bg-[#16130e] border-[#16130e] text-[#e6e0cf]'
                                  : 'bg-[#ebe5d4] border-[#16130e]/40 text-[#16130e]'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-bold text-[#16130e] truncate">{entry.playerName}</span>
                            <span className="text-[#5a5243] hidden sm:inline whitespace-nowrap">
                              · {entry.categoryIcon} {modeShort}
                            </span>
                          </div>
                          <span className="font-mono-num font-bold text-amber-800 whitespace-nowrap">
                            {entry.score} {isEn ? 'pts' : 'оноо'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {screen === 'game' && currentQuestion && (
          <section
            key={shakeTrigger > 0 ? `shake-${shakeTrigger}` : 'game-arena'}
            className={`max-w-3xl w-full mx-auto screen-enter ${shakeTrigger > 0 ? 'arena-shake' : ''}`}
          >
            {/* Scoreboard Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 sm:pb-4 border-b-2 border-[#16130e] mb-3.5 sm:mb-4">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="text-2xl sm:text-3xl leading-none" aria-hidden="true">
                  {activeCategory.icon}
                </span>
                <div>
                  <div className="text-xs sm:text-sm font-extrabold text-[#16130e] uppercase tracking-wide leading-tight">
                    {activeCatDisplay.name}
                  </div>
                  <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] tabular-nums mt-0.5">
                    {isEn
                      ? `Question ${currentIndex + 1} / ${questions.length}`
                      : `Асуулт ${currentIndex + 1} / ${questions.length}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-5">
                <div className="flex items-center gap-3 text-xs sm:text-sm tabular-nums">
                  <div>
                    <span className="text-[#5a5243] font-semibold mr-1">
                      {isEn ? 'Score' : 'Оноо'}
                    </span>
                    <span className="font-mono-num font-bold text-amber-800 text-sm sm:text-base">{score}</span>
                  </div>
                  {streak >= 2 && (
                    <div className="inline-flex items-center gap-1 text-orange-700 font-bold">
                      <Flame className="w-4 h-4" />
                      <span className="font-mono-num">{streak}x</span>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center gap-1"
                  aria-label={isEn ? `Lives remaining: ${lives}` : `Үлдсэн амь: ${lives}`}
                >
                  {Array.from({ length: MAX_LIVES }).map((_, idx) => {
                    const active = idx < lives;
                    return (
                      <Heart
                        key={idx}
                        className={`w-4 h-4 transition-all duration-200 ${
                          active
                            ? 'text-rose-700 fill-rose-600 scale-100'
                            : 'text-[#b5ac99] fill-transparent scale-90'
                        }`}
                      />
                    );
                  })}
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border-2 font-mono-num text-xs sm:text-sm font-bold transition-colors ${
                    isUrgent
                      ? 'bg-rose-100 border-rose-700 text-rose-800 timer-urgent-pulse'
                      : isWarning
                        ? 'bg-amber-100 border-amber-700 text-amber-900'
                        : 'bg-[#f8f5ec] border-[#16130e] text-[#16130e]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeLeftSeconds}{isEn ? 's' : 'с'}</span>
                </div>
              </div>
            </div>

            {/* Timer & Progress Lines */}
            <div className="mb-4 sm:mb-6 space-y-2">
              <div className="w-full h-2 bg-[#d5cebc] border border-[#16130e]/30 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
                    isUrgent ? 'bg-rose-600' : isWarning ? 'bg-amber-600' : 'bg-[#16130e]'
                  }`}
                  style={{ width: `${timerPercent}%` }}
                />
              </div>
              <div className="w-full h-1 bg-[#d5cebc]/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#6d6657] transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Parchment Clue Stage */}
            <div className="relative rounded-2xl bg-[#f8f5ec] border-2 border-[#16130e] shadow-[6px_6px_0_rgba(22,19,14,0.12)] px-4 sm:px-6 py-8 sm:py-12 md:py-14 text-center mb-4 sm:mb-6 overflow-hidden">
              <div className="relative text-4xl sm:text-6xl md:text-7xl tracking-[0.14em] sm:tracking-[0.22em] select-none leading-none">
                {currentQuestion.emoji}
              </div>
            </div>

            {/* 2x2 Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
              {currentQuestion.options.map((opt, idx) => {
                const isCorrectOption = opt === currentQuestion.answer;
                const isSelectedOption = opt === selectedOption;

                let stateClasses =
                  'bg-[#f8f5ec] border-[#16130e] text-[#16130e] hover:bg-[#ebe5d4] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#16130e]';
                let keyClasses = 'bg-[#e6e0cf] border-[#16130e] text-[#16130e]';

                if (locked) {
                  if (isCorrectOption) {
                    stateClasses = 'bg-emerald-100 border-emerald-800 text-emerald-950 shadow-[4px_4px_0_#065f46]';
                    keyClasses = 'bg-emerald-800 border-emerald-800 text-emerald-50';
                  } else if (isSelectedOption) {
                    stateClasses = 'bg-rose-100 border-rose-800 text-rose-950';
                    keyClasses = 'bg-rose-700 border-rose-800 text-white';
                  } else {
                    stateClasses = 'bg-[#ebe5d4]/70 border-[#16130e]/25 text-[#7a7160]';
                    keyClasses = 'bg-[#e6e0cf]/60 border-[#16130e]/25 text-[#7a7160]';
                  }
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    data-sfx="custom"
                    disabled={locked}
                    onMouseEnter={() => {
                      if (!locked) sfx.hover();
                    }}
                    onClick={() => handleAnswer(opt)}
                    className={`flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 sm:py-4 min-h-[52px] sm:min-h-[56px] rounded-xl border-2 text-left font-bold text-sm sm:text-[15px] transition-all duration-150 cursor-pointer disabled:cursor-default ${stateClasses}`}
                  >
                    <span className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-md border font-mono-num text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${keyClasses}`}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate">{opt}</span>
                    </span>

                    {locked && isCorrectOption && <Check className="w-4 h-4 text-emerald-800 shrink-0" />}
                    {locked && !isCorrectOption && isSelectedOption && (
                      <X className="w-4 h-4 text-rose-800 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 min-h-[36px]">
              <div
                className={`text-sm font-bold ${
                  feedback.type === 'good'
                    ? 'text-emerald-800'
                    : feedback.type === 'bad'
                      ? 'text-rose-700'
                      : 'text-[#5a5243]'
                }`}
              >
                {feedback.text ||
                  (isEn
                    ? 'Pick the right answer (or press keys 1–4)'
                    : 'Зөв хариултыг сонгоно уу (эсвэл 1–4 товч дарна уу)')}
              </div>

              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={goToHome}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border-2 border-[#16130e]/30 hover:border-[#16130e] bg-[#f8f5ec] text-xs font-bold text-[#201c15] transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isEn ? 'Change Mode' : 'Төрөл солих'}</span>
              </button>
            </div>
          </section>
        )}

        {screen === 'end' && (
          <section className="max-w-xl w-full mx-auto screen-enter bg-[#f8f5ec] border-2 border-[#16130e] shadow-[8px_8px_0_#16130e] rounded-2xl p-5 sm:p-8 md:p-10 text-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-4 sm:mb-5 rounded-xl bg-[#ebe5d4] border-2 border-[#16130e] flex items-center justify-center">
              {gameResult.won ? (
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-800" />
              ) : gameResult.isNewRecord ? (
                <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-700" />
              ) : (
                <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-rose-700" />
              )}
            </div>

            {gameResult.isNewRecord && (
              <p className="text-xs font-extrabold tracking-[0.16em] uppercase text-amber-800 mb-2">
                {isEn ? 'New High Score' : 'Шинэ рекорд тогтоолоо'}
              </p>
            )}

            <h2 className="font-serif-display text-2xl sm:text-4xl uppercase text-[#16130e] tracking-tight mb-2">
              {gameResult.won
                ? isEn
                  ? `${activeCatDisplay.short} — Victory!`
                  : `${activeCatDisplay.short} — Та яллаа!`
                : isEn
                  ? 'Game Over'
                  : 'Тоглоом дууслаа'}
            </h2>

            <p className="text-xs sm:text-sm font-medium text-[#5a5243] mb-5 sm:mb-6">
              {gameResult.won
                ? isEn
                  ? `Completed all ${questions.length} questions with ${gameResult.finalLives} lives left.`
                  : `Үлдсэн ${gameResult.finalLives} амьтайгаар бүх ${questions.length} асуултыг амжилттай дуусгалаа.`
                : gameResult.isNewRecord
                  ? isEn
                    ? `Out of lives, yet you set a new high score in ${activeCatDisplay.short}.`
                    : `3 амь дууссан ч ${activeCatDisplay.short} төрөлд өөрийн дээд оноог шинэчиллээ.`
                  : isEn
                    ? 'You ran out of 3 lives. Try again to beat your record!'
                    : 'Таны 3 амь дууслаа. Дахин оролдож рекордоо эвдээрэй.'}
            </p>

            <div className="grid grid-cols-3 border-y-2 border-[#16130e]/20 py-4 sm:py-5 mb-5 sm:mb-6">
              <div className="pr-2 sm:pr-3">
                <div className="font-mono-num text-xl sm:text-3xl font-bold text-amber-800">
                  {score}
                </div>
                <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                  {isEn ? 'This Run' : 'Энэ тоглолт'}
                </div>
              </div>
              <div className="px-2 sm:px-3 border-l-2 border-[#16130e]/15">
                <div className="font-mono-num text-xl sm:text-3xl font-bold text-[#16130e]">
                  {savedStats.highScores[activeCategory.id] || 0}
                </div>
                <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                  {isEn ? 'Mode Best' : 'Төрлийн рекорд'}
                </div>
              </div>
              <div className="pl-2 sm:pl-3 border-l-2 border-[#16130e]/15">
                <div className="font-mono-num text-xl sm:text-3xl font-bold text-[#16130e]">
                  {correctCount}/{questions.length}
                </div>
                <div className="text-[11px] sm:text-xs font-semibold text-[#5a5243] mt-1">
                  {isEn ? 'Correct' : 'Зөв таасан'}
                </div>
              </div>
            </div>

            {savedScoreDocId ? (
              <div className="mb-7 p-4 rounded-xl border-2 border-emerald-800 bg-emerald-50 text-left">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-900">
                    <Check className="w-4 h-4" />
                    <span>
                      {isEn
                        ? 'Saved to Firestore "scores"'
                        : 'Firestore "scores" санд хадгалагдлаа'}
                    </span>
                  </span>
                  {savedEntryRank > 0 && (
                    <span className="font-mono-num text-xs font-bold text-amber-800">
                      {isEn ? `Rank: #${savedEntryRank}` : `Байр: #${savedEntryRank}`}
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-emerald-950/80">
                  {endNameInput.trim()} · {score} {isEn ? 'pts' : 'оноо'} · {gameLabel} ({activeCatDisplay.short})
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSaveScoreToFirestore}
                className="mb-7 p-4 sm:p-5 rounded-xl border-2 border-[#16130e] bg-[#ebe5d4]/80 text-left"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <label
                    htmlFor="end-player-name"
                    className="text-xs font-extrabold uppercase tracking-wider text-[#16130e]"
                  >
                    {isEn
                      ? 'Enter your name to save score'
                      : 'Тоглогчийн нэрээ оруулж оноогоо хадгалах'}
                  </label>
                  <span className="text-[11px] font-semibold text-[#5a5243]">
                    {gameLabel} · {activeCatDisplay.short}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="end-player-name"
                    type="text"
                    maxLength={24}
                    value={endNameInput}
                    onChange={(e) => {
                      setEndNameInput(e.target.value.slice(0, 24));
                      if (saveError) setSaveError('');
                    }}
                    placeholder={isEn ? 'Your name...' : 'Таны нэр...'}
                    className="flex-1 px-3.5 py-2.5 min-h-[42px] rounded-lg border-2 border-[#16130e] bg-[#f8f5ec] focus:bg-white focus:outline-none text-sm font-bold text-[#16130e]"
                  />
                  <button
                    type="submit"
                    disabled={savingScore}
                    onMouseEnter={() => sfx.hover()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-lg border-2 border-[#16130e] bg-[#16130e] hover:bg-[#2a251c] disabled:opacity-60 text-[#e6e0cf] text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {!currentUser && <LogIn className="w-3.5 h-3.5 text-amber-300" />}
                    <span>
                      {savingScore
                        ? isEn
                          ? 'Saving...'
                          : 'Хадгалж байна...'
                        : currentUser
                          ? isEn
                            ? 'Save Score'
                            : 'Оноо хадгалах'
                          : isEn
                            ? 'Sign in & Save'
                            : 'Google нэвтэрч хадгалах'}
                    </span>
                  </button>
                </div>

                {saveError && (
                  <p className="mt-2 text-xs font-bold text-rose-700">{saveError}</p>
                )}
              </form>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={startGame}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] rounded-full bg-[#16130e] hover:bg-[#2a251c] text-[#e6e0cf] border-2 border-[#16130e] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isEn ? 'Play Again' : 'Дахин тоглох'}</span>
              </button>
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={openLeaderboard}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] rounded-full border-2 border-[#16130e] bg-[#ebe5d4] hover:bg-[#dfd7c4] text-[#16130e] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Trophy className="w-4 h-4 text-amber-800" />
                <span>{isEn ? 'Leaderboard' : 'Тэргүүлэгчид'}</span>
              </button>
              <button
                type="button"
                onMouseEnter={() => sfx.hover()}
                onClick={goToHome}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] rounded-full border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#ebe5d4] text-[#16130e] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{isEn ? 'Categories' : 'Ангилал'}</span>
              </button>
            </div>
          </section>
        )}

        {screen === 'leaderboard' && (
          <section className="max-w-4xl w-full mx-auto screen-enter">
            <Leaderboard
              lang={lang}
              initialGameFilter={gameLabel}
              availableModes={categoriesList.map((cat) => ({
                id: cat.id,
                short: cat.short,
                icon: cat.icon,
              }))}
              highlightDocId={savedScoreDocId}
              currentUserUid={currentUser?.uid ?? null}
              onPlayClick={startGame}
              playLabel={isEn ? `Play ${activeCatDisplay.short}` : `${activeCatDisplay.short} тоглох`}
              onBackClick={goToHome}
              onScoreDeleted={(deletedId) => {
                setSavedScoreDocId((prev) => (prev === deletedId ? null : prev));
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}

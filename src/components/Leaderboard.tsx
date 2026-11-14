import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Crown,
  Medal,
  Play,
  RefreshCw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { getCategoryDisplay, Lang } from '../utils/i18n';
import { sfx } from '../utils/sound';

export type QuizGameName = 'Anime Guess' | 'Sports Emoji Quiz';
export type LeaderboardGameFilter = QuizGameName | 'all';

export interface ScoreRecord {
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

export interface LeaderboardModeOption {
  id: string;
  short: string;
  icon: string;
}

interface LeaderboardProps {
  lang?: Lang;
  initialGameFilter?: LeaderboardGameFilter;
  availableModes?: LeaderboardModeOption[];
  highlightDocId?: string | null;
  currentUserUid?: string | null;
  compact?: boolean;
  maxEntries?: number;
  title?: string;
  subtitle?: string;
  onPlayClick?: () => void;
  playLabel?: string;
  onBackClick?: () => void;
  onScoreDeleted?: (deletedId: string) => void;
}

function formatScoreDate(ts: number): string {
  try {
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${year}.${month}.${day} ${hour}:${min}`;
  } catch {
    return '';
  }
}

function mapSnapshotToScores(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
): ScoreRecord[] {
  const rows: ScoreRecord[] = docs.map((docSnap) => {
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

  return rows;
}

export default function Leaderboard({
  lang = 'mn',
  initialGameFilter = 'all',
  availableModes = [],
  highlightDocId = null,
  currentUserUid,
  compact = false,
  maxEntries = 100,
  title,
  subtitle,
  onPlayClick,
  playLabel,
  onBackClick,
  onScoreDeleted,
}: LeaderboardProps) {
  const isEn = lang === 'en';
  const resolvedTitle = title ?? (isEn ? 'Leaderboard' : 'Тэргүүлэгчдийн Самбар');
  const resolvedSubtitle =
    subtitle ?? (isEn ? "Firestore 'scores' · Top Scores" : "Firestore 'scores' · Шилдэг оноонууд");
  const resolvedPlayLabel = playLabel ?? (isEn ? 'Play' : 'Тоглох');
  const [scores, setScores] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [activeUid, setActiveUid] = useState<string | null>(
    currentUserUid ?? auth.currentUser?.uid ?? null
  );

  const [gameFilter, setGameFilter] = useState<LeaderboardGameFilter>(initialGameFilter);
  const [modeFilter, setModeFilter] = useState<string>('all');

  useEffect(() => {
    setGameFilter(initialGameFilter);
    setModeFilter('all');
  }, [initialGameFilter]);

  useEffect(() => {
    if (currentUserUid !== undefined) {
      setActiveUid(currentUserUid);
    }
  }, [currentUserUid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (currentUserUid === undefined) {
        setActiveUid(user?.uid ?? null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [currentUserUid]);

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    setErrorMsg('');

    const scoresQuery = query(
      collection(db, 'scores'),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      scoresQuery,
      (snapshot) => {
        setScores(mapSnapshotToScores(snapshot.docs));
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        setErrorMsg(
          isEn ? 'Failed to load scores from Firestore.' : 'Firestore-оос оноо уншихад алдаа гарлаа.'
        );
        handleFirestoreError(error, OperationType.LIST, 'scores');
      }
    );

    return () => unsubscribe();
  }, [authReady, isEn]);

  const handleManualRefresh = useCallback(async () => {
    sfx.click();
    setRefreshing(true);
    setErrorMsg('');
    const scoresQuery = query(
      collection(db, 'scores'),
      where('score', '>=', 0),
      orderBy('score', 'desc'),
      limit(100)
    );
    try {
      const snapshot = await getDocs(scoresQuery);
      setScores(mapSnapshotToScores(snapshot.docs));
    } catch (error) {
      setErrorMsg(isEn ? 'Failed to refresh scores.' : 'Шинэчлэх үед алдаа гарлаа.');
      handleFirestoreError(error, OperationType.LIST, 'scores');
    } finally {
      setRefreshing(false);
    }
  }, [isEn]);

  const handleDelete = useCallback(
    async (entryId: string) => {
      sfx.click();
      try {
        await deleteDoc(doc(db, 'scores', entryId));
        onScoreDeleted?.(entryId);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `scores/${entryId}`);
      }
    },
    [onScoreDeleted]
  );

  const filteredScores = scores
    .filter((entry) => {
      if (gameFilter !== 'all' && entry.game !== gameFilter) return false;
      if (modeFilter !== 'all' && entry.categoryId !== modeFilter) return false;
      return true;
    })
    .slice(0, maxEntries);

  const topThree = filteredScores.slice(0, 3);
  const showModeStrip =
    availableModes.length > 0 &&
    gameFilter !== 'all' &&
    (initialGameFilter === 'all' || gameFilter === initialGameFilter);

  return (
    <div className="w-full text-[#201c15]">
      {/* Header & Game Filter Controls */}
      <div
        className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[#16130e] ${
          compact ? 'pb-3.5 mb-4' : 'pb-5 mb-6'
        }`}
      >
        <div>
          <p className="text-[11px] font-bold tracking-[0.16em] text-[#6d6657] uppercase mb-1">
            {resolvedSubtitle}
          </p>
          <h2
            className={`font-serif-display uppercase tracking-tight text-[#16130e] leading-none ${
              compact ? 'text-2xl' : 'text-3xl sm:text-4xl'
            }`}
          >
            {resolvedTitle}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'Anime Guess', label: 'Anime Guess' },
              { id: 'Sports Emoji Quiz', label: 'Sports Quiz' },
              { id: 'all', label: isEn ? 'All' : 'Бүгд' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={() => {
                sfx.click();
                setGameFilter(tab.id);
                setModeFilter('all');
              }}
              className={`px-3 py-1.5 min-h-[36px] rounded-xl border-2 border-[#16130e] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                gameFilter === tab.id
                  ? 'bg-[#16130e] text-[#e6e0cf]'
                  : 'bg-[#f8f5ec] hover:bg-[#ebe5d4] text-[#201c15]'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={handleManualRefresh}
            disabled={refreshing}
            aria-label={isEn ? 'Refresh' : 'Шинэчлэх'}
            title={isEn ? 'Refresh' : 'Шинэчлэх'}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#ebe5d4] text-[#201c15] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Category / Mode Filter Strip */}
      {showModeStrip && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            type="button"
            onMouseEnter={() => sfx.hover()}
            onClick={() => {
              sfx.click();
              setModeFilter('all');
            }}
            className={`px-3 py-1.5 min-h-[34px] rounded-lg border-2 border-[#16130e] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              modeFilter === 'all'
                ? 'bg-[#16130e] text-[#e6e0cf]'
                : 'bg-[#ebe5d4] hover:bg-[#f8f5ec] text-[#201c15]'
            }`}
          >
            {isEn ? 'All Modes' : 'Бүх горим'}
          </button>
          {availableModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={() => {
                sfx.click();
                setModeFilter(m.id);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg border-2 border-[#16130e] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                modeFilter === m.id
                  ? 'bg-[#16130e] text-[#e6e0cf]'
                  : 'bg-[#ebe5d4] hover:bg-[#f8f5ec] text-[#201c15]'
              }`}
            >
              <span>{m.icon}</span>
              <span>{getCategoryDisplay(m.id, m.short, m.short, lang).short}</span>
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <div className="mb-5 p-3.5 rounded-xl border-2 border-rose-700 bg-rose-50 text-xs font-bold text-rose-900">
          {errorMsg}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-xl border-2 border-[#16130e]/20 bg-[#ebe5d4]/70 animate-pulse"
            />
          ))}
        </div>
      ) : filteredScores.length === 0 ? (
        <div
          className={`bg-[#f8f5ec] border-2 border-[#16130e] rounded-2xl text-center mb-6 ${
            compact ? 'p-6' : 'p-10 shadow-[6px_6px_0_rgba(22,19,14,0.12)]'
          }`}
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#ebe5d4] border-2 border-[#16130e] flex items-center justify-center">
            <Trophy className="w-6 h-6 text-amber-800" />
          </div>
          <h3 className="font-serif-display text-xl sm:text-2xl uppercase text-[#16130e] mb-1.5">
            {isEn ? 'No scores recorded yet' : 'Онооны бүртгэл одоогоор хоосон байна'}
          </h3>
          <p className="text-xs sm:text-sm text-[#5a5243] max-w-md mx-auto">
            {isEn
              ? 'Finish a round and save your score under your name to claim the top spot.'
              : 'Тоглоомоо тоглож дуусгаад өөрийн нэрээр хамгийн эхний оноог бүртгүүлээрэй.'}
          </p>
          {onPlayClick && (
            <button
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={onPlayClick}
              className="mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-full bg-[#16130e] hover:bg-[#2a251c] text-[#e6e0cf] border-2 border-[#16130e] text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{resolvedPlayLabel}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {!compact && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5 sm:mb-6">
              {topThree.map((entry, idx) => {
                const isFirst = idx === 0;
                const PodiumIcon = idx === 0 ? Crown : idx === 1 ? Medal : Award;
                const localizedMode = entry.mode
                  ? getCategoryDisplay(entry.categoryId, entry.mode, entry.mode, lang).short
                  : '';
                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border-2 border-[#16130e] p-4 sm:p-5 flex flex-col justify-between transition-transform ${
                      isFirst
                        ? 'bg-[#f8f5ec] shadow-[5px_5px_0_#16130e]'
                        : 'bg-[#ebe5d4]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 font-mono-num text-xs font-extrabold uppercase tracking-wider ${
                          isFirst ? 'text-amber-800' : 'text-[#5a5243]'
                        }`}
                      >
                        <PodiumIcon className="w-4 h-4" />
                        <span>{isEn ? `Rank #${idx + 1}` : `#${idx + 1} байр`}</span>
                      </span>
                      <span className="text-lg leading-none" title={localizedMode}>
                        {entry.categoryIcon}
                      </span>
                    </div>

                    <div className="font-bold text-lg text-[#16130e] truncate mb-1">
                      {entry.playerName}
                    </div>
                    <div className="text-xs font-medium text-[#5a5243] mb-3 truncate">
                      {entry.game}
                      {localizedMode ? ` · ${localizedMode}` : ''}
                    </div>

                    <div className="pt-2.5 border-t border-[#16130e]/15 flex items-baseline justify-between">
                      <span className="font-mono-num text-2xl font-bold text-amber-800">
                        {entry.score}
                      </span>
                      <span className="text-[11px] font-semibold text-[#5a5243]">
                        {entry.correctCount}/{entry.totalQuestions} {isEn ? 'correct' : 'зөв'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full Ranked Ledger Table */}
          <div className="rounded-2xl border-2 border-[#16130e] bg-[#f8f5ec] overflow-hidden mb-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] sm:min-w-0 text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#16130e] bg-[#ebe5d4] text-[11px] font-extrabold uppercase tracking-wider text-[#352f25]">
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 w-12 sm:w-14">{isEn ? 'Rank' : 'Байр'}</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">{isEn ? 'Player' : 'Тоглогч'}</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4">{isEn ? 'Game / Mode' : 'Тоглоом / Горим'}</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">{isEn ? 'Accuracy' : 'Нарийвчлал'}</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right hidden sm:table-cell">{isEn ? 'Date' : 'Огноо'}</th>
                    <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right">{isEn ? 'Score' : 'Оноо'}</th>
                    {activeUid && <th className="py-2.5 sm:py-3 px-2.5 sm:px-3 w-10" aria-label={isEn ? 'Actions' : 'Үйлдэл'} />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#16130e]/12 text-xs sm:text-sm">
                  {filteredScores.map((entry, idx) => {
                    const isRecent = Boolean(highlightDocId && entry.id === highlightDocId);
                    const canDelete = Boolean(activeUid && entry.authorId === activeUid);
                    const localizedMode = entry.mode
                      ? getCategoryDisplay(entry.categoryId, entry.mode, entry.mode, lang).short
                      : '';

                    return (
                      <tr
                        key={entry.id}
                        className={
                          isRecent
                            ? 'bg-amber-100/70'
                            : 'hover:bg-[#ebe5d4]/50 transition-colors'
                        }
                      >
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-mono-num font-bold text-[#16130e]">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-xs ${
                              idx === 0
                                ? 'bg-[#16130e] border-[#16130e] text-[#e6e0cf]'
                                : idx < 3
                                  ? 'bg-[#ebe5d4] border-[#16130e]/50 text-[#16130e]'
                                  : 'border-transparent text-[#5a5243]'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 font-bold text-[#16130e]">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[115px] sm:max-w-[160px]">{entry.playerName}</span>
                            {isRecent && (
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                                {isEn ? 'New' : 'Шинэ'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-semibold text-[#4d4436] whitespace-nowrap">
                          <span className="mr-1.5">{entry.categoryIcon}</span>
                          <span>{entry.game}</span>
                          {localizedMode && (
                            <span className="text-[#6d6657]"> · {localizedMode}</span>
                          )}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-mono-num text-xs font-bold text-[#352f25]">
                          {entry.correctCount}/{entry.totalQuestions}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-mono-num text-xs text-[#6d6657] hidden sm:table-cell whitespace-nowrap">
                          {formatScoreDate(entry.createdAtMs)}
                        </td>
                        <td className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-mono-num font-bold text-amber-800">
                          {entry.score}
                        </td>
                        {activeUid && (
                          <td className="py-3 px-3 text-right">
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(entry.id)}
                                title={isEn ? 'Delete my score' : 'Өөрийн бичлэгийг устгах'}
                                aria-label={isEn ? 'Delete' : 'Устгах'}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-rose-100 text-[#6d6657] hover:text-rose-800 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Optional Footer Actions */}
      {(onBackClick || onPlayClick) && filteredScores.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {onBackClick && (
            <button
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={onBackClick}
              className="inline-flex items-center gap-2 px-5 py-3 min-h-[44px] rounded-full border-2 border-[#16130e] bg-[#f8f5ec] hover:bg-[#ebe5d4] text-xs font-bold uppercase tracking-wider text-[#16130e] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isEn ? 'Back' : 'Буцах'}</span>
            </button>
          )}
          {onPlayClick && (
            <button
              type="button"
              onMouseEnter={() => sfx.hover()}
              onClick={onPlayClick}
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[44px] rounded-full bg-[#16130e] hover:bg-[#2a251c] text-[#e6e0cf] border-2 border-[#16130e] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{resolvedPlayLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

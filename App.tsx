import React, { useState, useEffect, useMemo } from 'react';
import { LogsDatabase, WeekMeta, ExerciseMovement, SupersetMovement } from './types';
import { buildWorkoutDays, EXERCISE_DATABASE } from './constants/exerciseData';
import { ExerciseCard } from './components/ExerciseCard';
import { SupersetCard } from './components/SupersetCard';
import { RestTimer } from './components/RestTimer';
import { AiCoachModal } from './components/AiCoachModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { 
  Dumbbell, 
  Flame, 
  CheckCircle, 
  Download, 
  Upload, 
  Trash2, 
  BarChart3, 
  Smartphone, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

const TOTAL_WEEKS = 40;

export default function App() {
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [currentDay, setCurrentDay] = useState<number>(0);
  const [logs, setLogs] = useState<LogsDatabase>(() => {
    try {
      const saved = localStorage.getItem('apex_logs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [aiExerciseName, setAiExerciseName] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  // Synchronize state with LocalStorage
  useEffect(() => {
    localStorage.setItem('apex_logs', JSON.stringify(logs));
  }, [logs]);

  // Compute Meta for current week
  const meta: WeekMeta = useMemo(() => {
    const isPhase2 = currentWeek > 23;
    const phase = isPhase2 ? 2 : 1;
    const effectiveWeek = isPhase2 ? currentWeek - 23 : currentWeek;
    const cycle = Math.ceil(effectiveWeek / 4);
    const posInCycle = ((effectiveWeek - 1) % 4) + 1;

    let rotationKey: 'A' | 'B' | 'C' | 'Deload' = 'A';
    let rotationName = 'Rotation A';
    let targetRpe = 8;
    let typeDesc = 'Volume Accumulation';
    let researchFocus = 'Stretch-Mediated Hypertrophy & Motor Recruitment';

    if (posInCycle === 4) {
      rotationKey = 'Deload';
      rotationName = 'Deload & Joint Recovery';
      targetRpe = 6;
      typeDesc = 'Active Deload & Connective Tissue Restoration';
      researchFocus = 'Systemic fatigue reduction & glycogen replenishment';
    } else if (posInCycle === 1) {
      rotationKey = 'A';
      rotationName = 'Rotation A (Hypertrophy & Supersets)';
      targetRpe = currentWeek === 1 ? 7 : 7.5;
      typeDesc = currentWeek === 1 ? 'Baseline Benchmark' : 'Volume Accumulation';
      researchFocus = 'Agonist-antagonist pairing & deep lengthened pauses';
    } else if (posInCycle === 2) {
      rotationKey = 'B';
      rotationName = 'Rotation B (Heavy Strength & Low Reps)';
      targetRpe = 8.5;
      typeDesc = 'Load Progression';
      researchFocus = 'High mechanical tension & myofibrillar cross-sectional area';
    } else if (posInCycle === 3) {
      rotationKey = 'C';
      rotationName = 'Rotation C (Density & Unilateral Balance)';
      targetRpe = 9;
      typeDesc = 'Peak Overload';
      researchFocus = 'Unilateral stabilization & metabolic stress accumulation';
    }

    const phaseName = isPhase2
      ? "Phase 2: Functional Power & Capacity (Mar '27 - Jun '27)"
      : "Phase 1: Hypertrophy & Overload (Sep '26 - Feb '27)";

    return {
      week: currentWeek,
      phase,
      phaseName,
      cycle,
      posInCycle,
      rotationKey,
      rotationName,
      targetRpe,
      typeDesc,
      researchFocus,
    };
  }, [currentWeek]);

  // Generate the active days for current rotation
  const workoutDays = useMemo(() => {
    return buildWorkoutDays(meta.rotationKey);
  }, [meta.rotationKey]);

  const activeDay = workoutDays[currentDay] || workoutDays[0];
  const dayKey = `w${currentWeek}_d${currentDay}`;
  const currentDayLog = logs[dayKey] || { completed: false, exercises: {} };

  // Historical lookup for progressive overload targets
  const getOverloadRecommendation = (liftName: string): string => {
    if (meta.rotationKey === 'Deload') {
      return 'Deload: Use ~60% 1RM @ RPE 6 to promote joint recovery.';
    }

    for (let w = currentWeek - 1; w >= 1; w--) {
      for (let d = 0; d < 4; d++) {
        const k = `w${w}_d${d}`;
        const dayEntry = logs[k];
        if (dayEntry && dayEntry.exercises) {
          // Standard check
          if (dayEntry.exercises[liftName]?.sets?.length > 0) {
            const firstSet: any = dayEntry.exercises[liftName].sets[0];
            if (firstSet.weight !== '' && firstSet.weight !== undefined) {
              const prevW = parseFloat(firstSet.weight) || 0;
              const prevR = firstSet.reps;
              const bump = prevW >= 100 ? 5 : 2.5;
              return `Target: +${bump} lbs or +1 rep over Wk ${w} (${prevW} lbs × ${prevR} reps @ Target RPE ${meta.targetRpe}).`;
            }
          }
          // Superset sub-component check
          for (const itemKey in dayEntry.exercises) {
            const item = dayEntry.exercises[itemKey];
            if (item?.sets?.length > 0) {
              const s0: any = item.sets[0];
              if (s0.moveAName === liftName && s0.weightA) {
                return `Target: Beat Wk ${w} superset load (${s0.weightA} lbs × ${s0.repsA}).`;
              }
              if (s0.moveBName === liftName && s0.weightB) {
                return `Target: Beat Wk ${w} superset load (${s0.weightB} lbs × ${s0.repsB}).`;
              }
            }
          }
        }
      }
    }
    return `Baseline: Establish benchmark load for ${meta.targetRpe} RPE with 3s eccentric.`;
  };

  // Set handlers
  const handleSaveStandardSet = (exName: string, setIdx: number, field: string, val: any) => {
    setLogs((prev) => {
      const dayData = prev[dayKey] || { completed: false, exercises: {} };
      const exData = dayData.exercises[exName] || { isSuperset: false, sets: [] };
      const sets = [...exData.sets];
      if (!sets[setIdx]) sets[setIdx] = { setNumber: setIdx + 1, weight: '', reps: '', rpe: '' };
      sets[setIdx] = { ...sets[setIdx], [field]: val };

      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          exercises: {
            ...dayData.exercises,
            [exName]: {
              isSuperset: false,
              sets,
            },
          },
        },
      };
    });
  };

  const handleSaveSupersetSet = (supersetName: string, setIdx: number, field: string, val: any) => {
    setLogs((prev) => {
      const dayData = prev[dayKey] || { completed: false, exercises: {} };
      const exData = dayData.exercises[supersetName] || { isSuperset: true, sets: [] };
      const sets = [...exData.sets];
      if (!sets[setIdx]) {
        sets[setIdx] = {
          setNumber: setIdx + 1,
          weightA: '',
          repsA: '',
          weightB: '',
          repsB: '',
          rpe: '',
        };
      }
      sets[setIdx] = { ...sets[setIdx], [field]: val };

      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          exercises: {
            ...dayData.exercises,
            [supersetName]: {
              isSuperset: true,
              sets,
            },
          },
        },
      };
    });
  };

  // Swap exercise with alternative
  const handleSwapExercise = (index: number) => {
    const ex = activeDay.exercises[index];
    if ('isSuperset' in ex && ex.isSuperset) return;
    const stdEx = ex as ExerciseMovement;
    if (!stdEx.alternatives || stdEx.alternatives.length === 0) return;

    const nextAlt = stdEx.alternatives[0];
    const newAlternatives = [...stdEx.alternatives.slice(1), stdEx.name];
    const replacementObj = EXERCISE_DATABASE[nextAlt] || {
      ...stdEx,
      name: nextAlt,
      alternatives: newAlternatives,
    };

    activeDay.exercises[index] = {
      ...replacementObj,
      alternatives: newAlternatives,
    };
    // Force re-render
    setLogs((prev) => ({ ...prev }));
  };

  const toggleWorkoutComplete = () => {
    setLogs((prev) => {
      const dayData = prev[dayKey] || { exercises: {}, completed: false };
      return {
        ...prev,
        [dayKey]: {
          ...dayData,
          completed: !dayData.completed,
          completedAt: !dayData.completed ? new Date().toISOString() : undefined,
        },
      };
    });
  };

  const resetCurrentDay = () => {
    if (!window.confirm("Clear all logged data for this workout?")) return;
    setLogs((prev) => {
      const clone = { ...prev };
      delete clone[dayKey];
      return clone;
    });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex_overload_backup_w${currentWeek}.json`;
    a.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        setLogs(parsed);
        alert("Workout history successfully imported.");
      } catch {
        alert("Failed to parse JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  // Master adherence calculation
  const totalPossible = TOTAL_WEEKS * 4;
  let completedCount = 0;
  Object.values(logs).forEach((l) => {
    if (l && l.completed) completedCount++;
  });
  const adherencePct = Math.round((completedCount / totalPossible) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-28 pt-safe selection:bg-amber-400 selection:text-slate-950">
      {/* Sticky Header with Rest Timer and AI quick access */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-wider text-amber-400 uppercase truncate">
                Apex Science
              </h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  meta.phase === 2
                    ? 'bg-sky-400/20 text-sky-400 border-sky-400/30'
                    : 'bg-amber-400/20 text-amber-400 border-amber-400/30'
                }`}
              >
                Phase {meta.phase}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium truncate">
              Meso {meta.cycle} • Wk {currentWeek} ({meta.rotationName})
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowAnalytics(true)}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Progression Analytics"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </button>

            <button
              onClick={() => setShowInstallGuide(true)}
              className="hidden sm:flex items-center gap-1 bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 text-xs px-2.5 py-1.5 rounded-xl border border-amber-400/30 font-semibold transition-all"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>PWA</span>
            </button>

            <RestTimer />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-4 space-y-4">
        {/* Research Directive / Adherence Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold tracking-wider text-slate-400 uppercase text-[10px]">
              Master Adherence & Progressive Load
            </span>
            <span className="text-amber-400 font-mono font-bold">
              {completedCount} / {totalPossible} ({adherencePct}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-400 h-2 rounded-full transition-all duration-300 shadow-sm shadow-amber-400/40"
              style={{ width: `${adherencePct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
            <span className="text-[11px] truncate max-w-[240px] text-slate-300 font-medium">
              {meta.phaseName}
            </span>
            <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded-lg text-[11px] font-mono border border-slate-700 font-bold">
              Target RPE: {meta.targetRpe}
            </span>
          </div>
        </div>

        {/* 40-Week Horizontal Bar Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              Select Meso Cycle Week (40 Total)
            </span>
            <span className="text-amber-400 text-[10px] font-mono">
              {meta.typeDesc}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {Array.from({ length: TOTAL_WEEKS }).map((_, idx) => {
              const w = idx + 1;
              const isDeload = ((w - 1) % 4) + 1 === 4;
              const isSelected = w === currentWeek;

              return (
                <button
                  key={w}
                  onClick={() => setCurrentWeek(w)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-400/20'
                      : isDeload
                      ? 'bg-slate-900 text-emerald-400 border-emerald-900/50 hover:border-emerald-600'
                      : w > 23
                      ? 'bg-slate-900 text-sky-400 border-sky-900/60 hover:border-sky-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  W{w}{isDeload ? '·D' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Day Tabs */}
        <div className="grid grid-cols-4 gap-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          {workoutDays.map((d, dIdx) => {
            const isDaySelected = currentDay === dIdx;
            const isDayFinished = logs[`w${currentWeek}_d${dIdx}`]?.completed;

            return (
              <button
                key={dIdx}
                onClick={() => setCurrentDay(dIdx)}
                className={`py-2 text-xs font-bold rounded-xl transition-all relative ${
                  isDaySelected
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Day {dIdx + 1}
                <span
                  className={`text-[9px] font-normal block truncate ${
                    isDaySelected ? 'text-slate-900 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {d.label.split('(')[0].replace('Upper', 'Upper').replace('Lower', 'Lower').trim()}
                </span>
                {isDayFinished && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Warm-Up Protocol (PAP & Mobility) */}
        <div className="bg-slate-900/90 border border-amber-400/20 rounded-2xl p-4 space-y-2.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                {activeDay.label.split('(')[0]} Warm-Up Protocol
              </h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">5–8 mins</span>
          </div>

          <div className="space-y-2 text-xs">
            {activeDay.warmup.map((wItem, wIdx) => (
              <label
                key={wIdx}
                className="flex items-start gap-2.5 cursor-pointer select-none bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-700 text-amber-400 focus:ring-0 bg-slate-900"
                />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-semibold text-slate-200">
                      {wItem.name}
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      {wItem.duration}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {wItem.purpose}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Exercises Container */}
        <div className="space-y-4">
          {activeDay.exercises.map((item, exIdx) => {
            if ('isSuperset' in item && item.isSuperset) {
              const supersetItem = item as SupersetMovement;
              const savedSupersetSets = (currentDayLog.exercises[supersetItem.name]?.sets || []) as any[];

              return (
                <SupersetCard
                  key={supersetItem.id || exIdx}
                  superset={supersetItem}
                  supersetIndex={exIdx}
                  savedSets={savedSupersetSets}
                  meta={meta}
                  directiveA={getOverloadRecommendation(supersetItem.moveA.name)}
                  directiveB={getOverloadRecommendation(supersetItem.moveB.name)}
                  onSaveSupersetSet={(sIdx, field, val) =>
                    handleSaveSupersetSet(supersetItem.name, sIdx, field, val)
                  }
                  onAskAi={(name) => setAiExerciseName(name)}
                />
              );
            } else {
              const stdEx = item as ExerciseMovement;
              const savedSets = (currentDayLog.exercises[stdEx.name]?.sets || []) as any[];

              return (
                <ExerciseCard
                  key={stdEx.id || exIdx}
                  exercise={stdEx}
                  exerciseIndex={exIdx}
                  savedSets={savedSets}
                  meta={meta}
                  overloadRecommendation={getOverloadRecommendation(stdEx.name)}
                  onSaveSet={(sIdx, field, val) =>
                    handleSaveStandardSet(stdEx.name, sIdx, field, val)
                  }
                  onSwapExercise={handleSwapExercise}
                  onAskAi={(name) => setAiExerciseName(name)}
                />
              );
            }
          })}
        </div>

        {/* Completion Action Button */}
        <button
          onClick={toggleWorkoutComplete}
          className={`w-full py-4 rounded-2xl font-bold tracking-wide uppercase transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg ${
            currentDayLog.completed
              ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
          <span>
            {currentDayLog.completed ? "Workout Completed ✓ (Tap to Reopen)" : "Mark Workout Complete"}
          </span>
        </button>

        {/* Utilities & Backups */}
        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-4 border-t border-slate-800">
          <button
            onClick={exportData}
            className="flex items-center gap-1 hover:text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Backup</span>
          </button>

          <label className="flex items-center gap-1 hover:text-slate-300 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Backup</span>
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>

          <button
            onClick={resetCurrentDay}
            className="flex items-center gap-1 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Session</span>
          </button>
        </div>
      </main>

      {/* AI Biomechanics Coach Modal */}
      <AiCoachModal
        exerciseName={aiExerciseName}
        onClose={() => setAiExerciseName(null)}
      />

      {/* Analytics Modal */}
      {showAnalytics && (
        <AnalyticsModal
          logs={logs}
          totalWeeks={TOTAL_WEEKS}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* iOS PWA Install Guide Modal */}
      {showInstallGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center pb-safe"
          onClick={() => setShowInstallGuide(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-3xl p-6 text-slate-100 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-amber-400/40 flex items-center justify-center text-amber-400 font-black text-xl">
                A
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-100">Install Apex on iPhone / Android</h3>
                <p className="text-xs text-slate-400">Launch fullscreen with zero address bars.</p>
              </div>
            </div>
            <div className="space-y-2.5 bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400">1</span>
                <p>Tap the <strong>Share</strong> button in Safari’s bottom bar.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400">2</span>
                <p>Select <strong>"Add to Home Screen"</strong>.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-amber-400">3</span>
                <p>Tap <strong>"Add"</strong> in the top-right corner.</p>
              </div>
            </div>
            <button
              onClick={() => setShowInstallGuide(false)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, X } from 'lucide-react';

const STORAGE_KEY = 'arch_survey_completed';
const NPS_OPTIONS = Array.from({ length: 11 }, (_, index) => index);

export default function FormbricksSurvey() {
  const [mounted, setMounted] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [clarityScore, setClarityScore] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);

    if (localStorage.getItem(STORAGE_KEY)) return;

    let timer: ReturnType<typeof setTimeout>;

    const setupTimer = () => {
      clearTimeout(timer);
      if (window.location.pathname.includes('/architecture')) {
        timer = setTimeout(() => {
          if (!localStorage.getItem(STORAGE_KEY)) {
            setShowSurvey(true);
          }
        }, 120 * 1000);
      } else {
        setShowSurvey(false);
      }
    };

    setupTimer();
    document.addEventListener('astro:page-load', setupTimer);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('astro:page-load', setupTimer);
    };
  }, []);

  if (!mounted || !showSurvey) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowSurvey(false);
  };

  // TODO: Integrate with a real backend (Formbricks API or /api/feedback route).
  // Currently this only logs to console; submitted data is not persisted.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (clarityScore === null) {
      setError('Choose a clarity score before submitting.');
      return;
    }

    const data = {
      clarity_score: clarityScore,
      suggestions: suggestions.trim(),
    };

    console.log('[Demo Mode] Survey submitted (not sent to backend):', data);
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowSurvey(false);
  };

  return createPortal(
    <aside
      className="pointer-events-auto fixed bottom-24 left-4 right-4 z-[1100] w-auto rounded-xl border border-slate-800 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[350px]"
      aria-label="Architecture feedback survey"
    >
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-amber-400" />
          Quick Architecture Feedback <span className="text-[9px] text-slate-500 ml-1">[Demo]</span>
        </h4>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-900 rounded-lg cursor-pointer"
          aria-label="Dismiss feedback survey"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        We noticed you've been reviewing the System Architecture. How clear is the layout?
      </p>

      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          <div>
            <p id="clarity-score-label" className="text-slate-400 text-[10px] mb-1.5 block">
              Rate clarity from 0 (confusing) to 10 (very clear):
            </p>
            <div
              role="radiogroup"
              aria-labelledby="clarity-score-label"
              className="grid grid-cols-11 gap-1"
            >
              {NPS_OPTIONS.map((score) => {
                const selected = clarityScore === score;

                return (
                  <button
                    key={score}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setClarityScore(score);
                      setError('');
                    }}
                    className={[
                      'flex aspect-square min-w-0 items-center justify-center rounded-md border text-[11px] font-semibold transition-all cursor-pointer',
                      selected
                        ? 'border-blue-400 bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-blue-500/60 hover:bg-blue-600/25 hover:text-white',
                    ].join(' ')}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-slate-500">
              <span>confusing</span>
              <span>very clear</span>
            </div>
          </div>
          <div>
            <label htmlFor="feedback-suggestions" className="text-slate-400 text-[10px] mb-1 block">
              Any suggestions for improvements?
            </label>
            <textarea
              id="feedback-suggestions"
              name="suggestions"
              value={suggestions}
              onChange={(event) => setSuggestions(event.target.value)}
              placeholder="What details are missing?"
              className="w-full min-h-[56px] max-h-[110px] resize-none rounded-lg border border-slate-800 bg-slate-900 p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60"
            />
          </div>
          {error && (
            <p className="text-[10px] font-medium text-amber-300" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer"
          >
            Submit Feedback
          </button>
        </div>
      </form>
    </aside>,
    document.body,
  );
}

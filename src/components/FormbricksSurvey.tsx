import React, { useState, useEffect } from 'react';
import { Form, Nps, Textarea, Submit } from '@formbricks/react';
import { Sparkles, X } from 'lucide-react';

export default function FormbricksSurvey() {
  const [showSurvey, setShowSurvey] = useState(false);

  useEffect(() => {
    // Set a timer for 120 seconds (2 minutes) to trigger the survey
    // For local testing/demo we can keep it 120 seconds as requested
    const triggerTime = 120 * 1000;
    const timer = setTimeout(() => {
      // Trigger only if user is dwelling on an architecture page
      if (window.location.pathname.includes('/architecture')) {
        setShowSurvey(true);
      }
    }, triggerTime);

    return () => clearTimeout(timer);
  }, []);

  if (!showSurvey) return null;

  const handleSubmit = (data: any) => {
    console.log('Survey submitted to Formbricks:', data);
    setShowSurvey(false);
  };

  return (
    <div className="fixed bottom-24 left-6 z-50 w-[350px] bg-slate-950/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom-5">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-amber-400" />
          Quick Architecture Feedback
        </h4>
        <button
          onClick={() => setShowSurvey(false)}
          className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-900 rounded-lg cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        We noticed you've been reviewing the System Architecture. How clear is the layout?
      </p>

      {/* Formbricks React Primitives Form */}
      <Form onSubmit={handleSubmit} formId="arch-feedback">
        <div className="space-y-3">
          <div>
            <Nps
              name="clarity_score"
              label="Rate clarity from 0 (confusing) to 10 (very clear):"
              labelClassName="text-slate-400 text-[10px] mb-1.5 block"
              optionsClassName="flex justify-between gap-1"
              optionClassName="size-7 rounded-md bg-slate-900 hover:bg-blue-600/30 border border-slate-800 text-[11px] flex items-center justify-center cursor-pointer text-slate-300 hover:text-white transition-all font-semibold"
            />
          </div>
          <div>
            <Textarea
              name="suggestions"
              label="Any suggestions for improvements?"
              placeholder="What details are missing?"
              labelClassName="text-slate-400 text-[10px] mb-1 block"
              inputClassName="w-full bg-slate-900 border border-slate-805 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 min-h-[50px] max-h-[100px] resize-none"
            />
          </div>
          <Submit asChild>
            <button className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors duration-150 cursor-pointer">
              Submit Feedback
            </button>
          </Submit>
        </div>
      </Form>
    </div>
  );
}

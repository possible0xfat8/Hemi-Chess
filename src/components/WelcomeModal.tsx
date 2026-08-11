import { useState, useEffect } from 'react';
import { X, Trophy, Shield, Zap } from 'lucide-react';

const STORAGE_KEY = 'hasSeenHemiChessWelcome';

const ONBOARDING_STEPS = [
  {
    icon: Trophy,
    title: "You're Funded",
    description: "You start with a baseline of 1200 $HELO.",
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
  },
  {
    icon: Shield,
    title: "The Stakes",
    description: "Play Ranked to climb the leaderboard, or challenge Friends to Unranked games to protect your ELO.",
    color: 'text-teal',
    bg: 'bg-teal/10',
    border: 'border-teal/30',
  },
  {
    icon: Zap,
    title: "Blunder Check",
    description: "Double-check your openings, don't hang your pieces, and dominate the board.",
    color: 'text-orange',
    bg: 'bg-orange/10',
    border: 'border-orange/30',
  },
];

export function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has seen the welcome modal
    const hasSeenWelcome = localStorage.getItem(STORAGE_KEY);
    
    if (!hasSeenWelcome) {
      // Small delay for smooth appearance
      setTimeout(() => setIsOpen(true), 500);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  const currentStepData = ONBOARDING_STEPS[currentStep];
  const Icon = currentStepData.icon;
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg surface p-0 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink-muted hover:text-ink transition-colors"
          aria-label="Close welcome modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange/20 via-amber-400/10 to-teal/20 border-b border-line p-8 pb-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange mb-4 shadow-[0_0_28px_-8px_var(--accent-orange)]">
            <img 
              src="/hemi-chess-icon.png" 
              alt="Hemi Chess" 
              className="w-10 h-10"
              onError={(e) => {
                // Fallback to trophy icon if logo not found
                e.currentTarget.style.display = 'none';
              }}
            />
            <Trophy className="w-8 h-8 text-canvas" style={{ display: 'none' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mb-2">
            Welcome to <span className="text-orange">HemiChess</span>
          </h2>
          <p className="text-sm text-ink-muted">
            Master the board. Earn your rank. Own your legacy.
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {ONBOARDING_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-orange'
                    : 'w-2 bg-line hover:bg-line-strong'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Current Step */}
          <div className={`rounded-xl border ${currentStepData.border} ${currentStepData.bg} p-6 mb-6 min-h-[200px] flex flex-col justify-center animate-in fade-in slide-in-from-right-5 duration-300`}>
            <div className="flex items-start gap-4 mb-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full ${currentStepData.bg} border ${currentStepData.border} flex items-center justify-center`}>
                <Icon className={`w-6 h-6 ${currentStepData.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-xl font-bold ${currentStepData.color} mb-2`}>
                  {currentStepData.title}
                </h3>
                <p className="text-ink-muted leading-relaxed">
                  {currentStepData.description}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2.5 bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink rounded-lg font-medium transition-all"
              >
                Previous
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-orange hover:bg-orange/90 text-canvas rounded-xl font-bold shadow-[0_0_20px_-8px_var(--accent-orange)] transition-all hover:shadow-[0_0_28px_-6px_var(--accent-orange)] hover:-translate-y-0.5"
            >
              {isLastStep ? "Let's Play! 🚀" : 'Next'}
            </button>

            {!isLastStep && (
              <button
                onClick={handleClose}
                className="px-4 py-2.5 text-ink-muted hover:text-ink font-medium transition-colors"
              >
                Skip
              </button>
            )}
          </div>
        </div>

        {/* Footer Hint */}
        <div className="border-t border-line bg-[var(--surface-strong)] px-8 py-4 text-center">
          <p className="text-xs text-ink-faint">
            💡 Tip: This guide won't show again on this device
          </p>
        </div>
      </div>
    </div>
  );
}

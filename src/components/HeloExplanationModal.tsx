import { useState } from 'react';
import { X, Zap, Shield, Sparkles } from 'lucide-react';

interface HeloExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXPLANATION_POINTS = [
  {
    icon: Zap,
    title: "Instant Matches",
    description: "When you win or lose, your ELO rating updates instantly on the screen so you can jump right into the next game.",
    color: 'text-orange',
    bg: 'bg-orange/10',
    border: 'border-orange/30',
  },
  {
    icon: Shield,
    title: "The Blockchain Magic",
    description: "Behind the scenes, our server securely records your rating directly onto the Hemi blockchain as a permanent $HELO token.",
    color: 'text-teal',
    bg: 'bg-teal/10',
    border: 'border-teal/30',
  },
  {
    icon: Sparkles,
    title: "Zero Friction",
    description: "You don't have to sign annoying wallet pop-ups after every game, and you pay a $0 gas fee. We handle the heavy lifting while you focus on chess.",
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
  },
];

export function HeloExplanationModal({ isOpen, onClose }: HeloExplanationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[var(--bg-base)]/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl surface p-0 overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[var(--surface-strong)] hover:bg-[var(--surface-hover)] border border-line text-ink-muted hover:text-ink transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange/20 via-amber-400/10 to-teal/20 border-b border-line p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange to-amber-400 mb-4 shadow-[0_0_28px_-8px_var(--accent-orange)]">
            <span className="text-2xl font-bold text-canvas">$</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink mb-2">
            What is <span className="text-orange">$HELO</span>?
          </h2>
          <p className="text-sm sm:text-base text-ink-muted max-w-lg mx-auto">
            Your chess rating, permanently secured on the blockchain — without the hassle.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          <div className="space-y-4">
            {EXPLANATION_POINTS.map((point, index) => {
              const Icon = point.icon;
              return (
                <div
                  key={index}
                  className={`rounded-xl border ${point.border} ${point.bg} p-5 sm:p-6 transition-all hover:shadow-lg animate-in slide-in-from-left-5 duration-300`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full ${point.bg} border ${point.border} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${point.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg font-bold ${point.color} mb-2`}>
                        {point.title}
                      </h3>
                      <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                        {point.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Section */}
          <div className="mt-6 p-4 rounded-lg bg-[var(--surface-strong)] border border-line">
            <p className="text-center text-sm text-ink-muted">
              <span className="font-semibold text-ink">TL;DR:</span> Your ELO is your rating token on the Hemi blockchain. 
              It's like a digital trophy that proves your skill level — stored forever, updated automatically, 
              and completely free to use.
            </p>
          </div>

          {/* CTA Button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-orange hover:bg-orange/90 text-canvas rounded-xl font-bold shadow-[0_0_20px_-8px_var(--accent-orange)] transition-all hover:shadow-[0_0_28px_-6px_var(--accent-orange)] hover:-translate-y-0.5"
            >
              Got it, let's play! 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

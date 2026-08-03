import React from 'react'

interface LogoProps {
  variant?: 'full' | 'icon'
  className?: string
  /** Usar cores claras (sobre fundos escuros/verde) */
  darkMode?: boolean
}

export function Logo({ variant = 'full', className = '', darkMode = false }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <path
          d="M16 32 C16 20, 24 12, 36 10 C34 18, 28 24, 16 32Z"
          fill="currentColor"
          className={darkMode ? 'text-primary-foreground' : 'text-primary'}
        />
        <path
          d="M18 30 C20 24, 24 18, 32 14"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className={darkMode ? 'text-primary' : 'text-primary-foreground'}
          opacity="0.6"
        />
        <line x1="30" y1="20" x2="30" y2="28" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <line x1="34" y1="22" x2="34" y2="30" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
        <circle cx="30" cy="28" r="1.5" fill="currentColor" className="text-accent" />
        <circle cx="34" cy="30" r="1.5" fill="currentColor" className="text-accent" />
        <path
          d="M12 36 Q24 30 36 36"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className={darkMode ? 'text-primary-foreground' : 'text-primary'}
          opacity="0.4"
        />
        <path
          d="M14 38 Q24 33 34 38"
          stroke="currentColor"
          strokeWidth="1"
          fill="none"
          className={darkMode ? 'text-primary-foreground' : 'text-primary'}
          opacity="0.3"
        />
      </svg>
    )
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 shrink-0">
        <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.2" className="text-accent" />
        <path
          d="M13 28 C13 18, 20 11, 30 9 C28 16, 23 21, 13 28Z"
          fill="currentColor"
          className={darkMode ? 'text-primary-foreground' : 'text-primary'}
        />
        <path d="M15 26 C17 21, 20 16, 27 12" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.5" className="text-background" />
        <line x1="25" y1="17" x2="25" y2="24" stroke="currentColor" strokeWidth="1.2" className="text-accent" />
        <line x1="28" y1="19" x2="28" y2="26" stroke="currentColor" strokeWidth="1.2" className="text-accent" />
        <circle cx="25" cy="24" r="1.2" fill="currentColor" className="text-accent" />
        <circle cx="28" cy="26" r="1.2" fill="currentColor" className="text-accent" />
        <path
          d="M10 32 Q20 27 30 32"
          stroke="currentColor"
          strokeWidth="0.8"
          fill="none"
          className={darkMode ? 'text-primary-foreground' : 'text-primary'}
          opacity="0.3"
        />
      </svg>

      <div className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">
          <span className={`font-sans ${darkMode ? 'text-primary-foreground' : 'text-primary'}`}>Agro</span>
          {' '}
          <span className="font-display text-accent">GFI</span>
        </span>
      </div>
    </div>
  )
}

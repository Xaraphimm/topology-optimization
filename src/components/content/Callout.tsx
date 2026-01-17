import { Lightbulb, Info, AlertTriangle } from 'lucide-react';

interface CalloutProps {
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'tip' | 'warning';
}

/**
 * A callout box for highlighting key information
 * Modern design with icons, rounded corners, and subtle backgrounds
 * Supports both light and dark modes
 */
export function Callout({ title, children, type = 'info' }: CalloutProps) {
  const styles = {
    info: {
      wrapper: 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/50',
      icon: 'text-blue-500 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
      text: 'text-blue-800/90 dark:text-blue-200/90',
    },
    tip: {
      wrapper: 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/50',
      icon: 'text-emerald-500 dark:text-emerald-400',
      title: 'text-emerald-900 dark:text-emerald-100',
      text: 'text-emerald-800/90 dark:text-emerald-200/90',
    },
    warning: {
      wrapper: 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/50',
      icon: 'text-amber-500 dark:text-amber-400',
      title: 'text-amber-900 dark:text-amber-100',
      text: 'text-amber-800/90 dark:text-amber-200/90',
    },
  };
  
  const icons = {
    info: Info,
    tip: Lightbulb,
    warning: AlertTriangle,
  };
  
  const s = styles[type];
  const Icon = icons[type];
  
  return (
    <div className={`${s.wrapper} border rounded-xl p-4 sm:p-5 my-6 backdrop-blur-sm`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`w-5 h-5 ${s.icon}`} />
        </div>
        <div className="min-w-0">
          <h4 className={`font-semibold ${s.title} mb-1.5`}>{title}</h4>
          <div className={`${s.text} text-sm leading-relaxed`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Callout;

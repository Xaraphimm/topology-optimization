interface CalloutProps {
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'tip' | 'warning';
}

/**
 * A callout box for highlighting key information
 * Supports both light and dark modes
 */
export function Callout({ title, children, type = 'info' }: CalloutProps) {
  const styles = {
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      border: 'border-l-blue-500 dark:border-l-blue-400',
      title: 'text-blue-900 dark:text-blue-200',
      text: 'text-blue-800 dark:text-blue-300',
    },
    tip: {
      bg: 'bg-green-50 dark:bg-green-950/50',
      border: 'border-l-green-500 dark:border-l-green-400',
      title: 'text-green-900 dark:text-green-200',
      text: 'text-green-800 dark:text-green-300',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      border: 'border-l-amber-500 dark:border-l-amber-400',
      title: 'text-amber-900 dark:text-amber-200',
      text: 'text-amber-800 dark:text-amber-300',
    },
  };
  
  const s = styles[type];
  
  return (
    <div className={`${s.bg} border-l-4 ${s.border} rounded-r-lg p-4 my-6`}>
      <h4 className={`font-semibold ${s.title} mb-2`}>{title}</h4>
      <div className={`${s.text} text-sm leading-relaxed`}>
        {children}
      </div>
    </div>
  );
}

export default Callout;

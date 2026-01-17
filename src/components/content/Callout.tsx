interface CalloutProps {
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'tip' | 'warning';
}

/**
 * A callout box for highlighting key information
 */
export function Callout({ title, children, type = 'info' }: CalloutProps) {
  const styles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-l-blue-500',
      title: 'text-blue-900',
    },
    tip: {
      bg: 'bg-green-50',
      border: 'border-l-green-500',
      title: 'text-green-900',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-l-amber-500',
      title: 'text-amber-900',
    },
  };
  
  const s = styles[type];
  
  return (
    <div className={`${s.bg} border-l-4 ${s.border} rounded-r-lg p-4 my-6`}>
      <h4 className={`font-semibold ${s.title} mb-2`}>{title}</h4>
      <div className="text-gray-700 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default Callout;

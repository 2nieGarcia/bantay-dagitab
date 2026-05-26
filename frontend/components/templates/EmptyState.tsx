import React from 'react';

interface EmptyStateProps {
  title: string;
  description: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action, className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-surface border border-dashed border-line rounded-xl ${className}`}>
      {icon && <div className="mb-4 text-ink-3">{icon}</div>}
      <h3 className="text-lg font-semibold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-2 mb-4 max-w-sm">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

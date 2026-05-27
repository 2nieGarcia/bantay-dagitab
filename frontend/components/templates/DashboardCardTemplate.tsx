import React from 'react';

interface DashboardCardTemplateProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const DashboardCardTemplate: React.FC<DashboardCardTemplateProps> = ({ 
  title, 
  subtitle, 
  children,
  headerAction
}) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {headerAction && <div>{headerAction}</div>}
      </div>
      <div className="p-6 flex-grow">
        {children}
      </div>
    </div>
  );
};

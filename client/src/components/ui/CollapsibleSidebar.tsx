import React, { useState } from 'react';
import { useLocation } from 'wouter';

interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface CollapsibleSidebarProps {
  sections: MenuSection[];
  className?: string;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ 
  sections, 
  className = "" 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [location] = useLocation();

  return (
    <aside 
      className={`fixed h-full transition-all duration-300 ease-in-out bg-gradient-to-b from-black via-black to-red-600 shadow-2xl z-50 overflow-y-auto ${
        isExpanded ? 'w-44' : 'w-16'
      } ${className}`}
      style={{backgroundImage: 'linear-gradient(180deg, #000000 0%, #000000 65%, #dc2626 100%)'}}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="p-2">
        {/* Header */}
        <div className="flex items-center justify-center mb-4 h-8">
          {isExpanded ? (
            <span className="text-white text-sm font-bold whitespace-nowrap">WhatsApp CRM</span>
          ) : (
            <div className="w-8 h-8 bg-white/20 rounded-md flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 11 5.16-1.26 9-5.45 9-11V7l-10-5z"/>
              </svg>
            </div>
          )}
        </div>
        
        <nav className="mt-2 flex flex-col space-y-1">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {/* Section Title */}
              {isExpanded && (
                <div className="px-3 py-1">
                  <span className="text-xs uppercase font-semibold text-white/70">
                    {section.title}
                  </span>
                </div>
              )}
              
              {/* Menu Items */}
              {section.items.map((item, itemIndex) => {
                const isActive = location === item.href;
                
                return (
                  <a
                    key={itemIndex}
                    href={item.href}
                    className={`flex items-center transition-all duration-200 rounded-md group relative ${
                      isExpanded ? 'px-3 py-2' : 'px-2 py-2 mx-1'
                    } ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                    title={!isExpanded ? item.label : undefined}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 transition-all duration-200 ${
                      isExpanded ? 'mr-2 h-4 w-4' : 'h-5 w-5 mx-auto'
                    }`}>
                      {item.icon}
                    </div>
                    
                    {/* Label - only show when expanded */}
                    {isExpanded && (
                      <span className="text-xs font-medium whitespace-nowrap">
                        {item.label}
                      </span>
                    )}
                    
                    {/* Tooltip for collapsed state */}
                    {!isExpanded && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.label}
                        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    )}
                  </a>
                );
              })}
              
              {/* Add spacing between sections when collapsed */}
              {!isExpanded && sectionIndex < sections.length - 1 && (
                <div className="h-2"></div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default CollapsibleSidebar;
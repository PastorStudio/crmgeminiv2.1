import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

interface MenuCategory {
  id: string;
  label: string;
  icon: string;
  items: Array<{
    href: string;
    icon: string;
    label: string;
  }>;
}

export default function Sidebar({ isOpen, setIsOpen }: SidebarProps) {
  const [location] = useLocation();
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Navigation items - ALL existing menu items preserved
  const navItems = [
    { href: "/", icon: "dashboard", label: "Dashboard" },
    { href: "/leads", icon: "people", label: "Leads" },
    { href: "/messages", icon: "forum", label: "Messages" },
    { href: "/mass-sender", icon: "send", label: "Envío Masivo" },
    { href: "/message-templates", icon: "description", label: "Plantillas" },
    { href: "/media-gallery", icon: "perm_media", label: "Galería" },
    { href: "/calendar", icon: "event", label: "Calendar" },
    { href: "/tasks", icon: "assignment", label: "Tasks" },
    { href: "/analytics", icon: "leaderboard", label: "Analytics" },
    { href: "/database", icon: "storage", label: "Base de Datos" },
    { href: "/gemini-demo", icon: "smart_toy", label: "Gemini AI" },
    { href: "/gemini-test", icon: "psychology", label: "IA Test" },
    { href: "/integrations", icon: "link", label: "Integraciones" },
    { href: "/settings", icon: "settings", label: "Settings" },
  ];

  // Categories for grouping - ALL original menu items included
  const menuCategories: MenuCategory[] = [
    {
      id: "principal",
      label: "Principal",
      icon: "home",
      items: [
        { href: "/", icon: "dashboard", label: "Dashboard" },
        { href: "/leads", icon: "people", label: "Leads" },
      ]
    },
    {
      id: "comunicacion",
      label: "Comunicación",
      icon: "chat",
      items: [
        { href: "/messages", icon: "forum", label: "Messages" },
        { href: "/mass-sender", icon: "send", label: "Envío Masivo" },
        { href: "/message-templates", icon: "description", label: "Plantillas" },
        { href: "/media-gallery", icon: "perm_media", label: "Galería" },
      ]
    },
    {
      id: "planificacion",
      label: "Planificación",
      icon: "event_note",
      items: [
        { href: "/calendar", icon: "event", label: "Calendar" },
        { href: "/tasks", icon: "assignment", label: "Tasks" },
      ]
    },
    {
      id: "analisis",
      label: "Análisis y Recursos",
      icon: "analytics",
      items: [
        { href: "/analytics", icon: "leaderboard", label: "Analytics" },
        { href: "/database", icon: "storage", label: "Base de Datos" },
        { href: "/gemini-demo", icon: "smart_toy", label: "Gemini AI" },
        { href: "/gemini-test", icon: "psychology", label: "IA Test" },
      ]
    },
    {
      id: "conexion",
      label: "Conexión",
      icon: "link",
      items: [
        { href: "/integrations", icon: "link", label: "Integraciones" },
      ]
    },
    {
      id: "administracion",
      label: "Administración",
      icon: "admin_panel_settings",
      items: [
        { href: "/settings", icon: "settings", label: "Settings" },
      ]
    }
  ];

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const isCategoryExpanded = (categoryId: string) => expandedCategories.includes(categoryId);

  const isCategoryActive = (category: MenuCategory) => {
    return category.items.some(item => item.href === location);
  };

  // Auto-expand category containing current page
  useEffect(() => {
    const currentCategory = menuCategories.find(category => 
      category.items.some(item => item.href === location)
    );
    if (currentCategory && !expandedCategories.includes(currentCategory.id)) {
      setExpandedCategories(prev => [...prev, currentCategory.id]);
    }
  }, [location, menuCategories, expandedCategories]);

  // Handle closing the sidebar on mobile
  const handleLinkClick = () => {
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 transform bg-white transition duration-200 ease-in-out md:relative md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area */}
        <div className="flex items-center justify-center h-16 bg-primary-600">
          <div className="flex items-center">
            <span className="material-icons text-white mr-2">hub</span>
            <span className="text-white font-semibold text-lg">GeminiCRM</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex flex-col flex-grow overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-2">
            {menuCategories.map((category) => (
              <div key={category.id} className="space-y-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md group",
                    isCategoryActive(category) 
                      ? "text-white bg-primary-600" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <div className="flex items-center">
                    <span className="material-icons mr-3 h-6 w-6">{category.icon}</span>
                    {category.label}
                  </div>
                  <span 
                    className={cn(
                      "material-icons h-6 w-6",
                      isCategoryExpanded(category.id) ? "rotate-90" : "rotate-0"
                    )}
                  >
                    chevron_right
                  </span>
                </button>

                {/* Category Items */}
                {isCategoryExpanded(category.id) && (
                  <div className="ml-6 space-y-1">
                    {category.items.map((item) => (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center px-2 py-2 text-sm font-medium rounded-md group",
                          location === item.href 
                            ? "text-white bg-primary-600" 
                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        )}
                      >
                        <span className="material-icons mr-3 h-6 w-6">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User profile */}
          <div className="px-4 py-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <img 
                  className="h-10 w-10 rounded-full" 
                  src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" 
                  alt="User profile"
                />
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">Sarah Johnson</div>
                <div className="text-xs text-gray-500">Sales Manager</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import AiAssistant from "@/components/assistant/AiAssistant";
import LeadForm from "@/components/leads/LeadForm";

interface HeaderProps {
  onMenuButtonClick: () => void;
}

export default function Header({ onMenuButtonClick }: HeaderProps) {
  const [location] = useLocation();
  const [showAssistant, setShowAssistant] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);

  // Get the current page title
  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Dashboard";
      case "/leads":
        return "Leads";
      case "/messages":
        return "Messages";
      case "/calendar":
        return "Calendar";
      case "/tasks":
        return "Tasks";
      case "/analytics":
        return "Analytics";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  return (
    <>
      {/* Mobile header */}
      <div className="md:hidden bg-primary-600 text-white py-4 px-4 flex items-center justify-between shadow-md">
        <div className="flex items-center">
          <span className="material-icons mr-2">hub</span>
          <span className="font-semibold text-lg">GeminiCRM</span>
        </div>
        <button
          type="button"
          onClick={onMenuButtonClick}
          className="text-white"
        >
          <span className="material-icons">menu</span>
        </button>
      </div>

      {/* Page header */}
      <div className="bg-white shadow hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-900">{getPageTitle()}</h1>
            <div className="flex space-x-2">
              {(location === "/" || location === "/leads") && (
                <Button 
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                  onClick={() => setShowLeadForm(true)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  New Lead
                </Button>
              )}
              <Button 
                className="bg-secondary-600 hover:bg-secondary-700 text-white"
                onClick={() => setShowAssistant(true)}
              >
                <span className="material-icons text-sm mr-1">smart_toy</span>
                AI Assistant
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <AiAssistant open={showAssistant} onClose={() => setShowAssistant(false)} />

      {/* Lead Form Modal */}
      <LeadForm open={showLeadForm} onClose={() => setShowLeadForm(false)} />
    </>
  );
}

import { useEffect } from 'react';
import { useLocation } from 'wouter';

const AutoRedirect: React.FC = () => {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Automatically redirect to login page
    navigate('/login');
  }, [navigate]);

  // Return null since this component only handles redirection
  return null;
};

export default AutoRedirect;
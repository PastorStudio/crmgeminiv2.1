import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';

interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  department?: string;
  avatar?: string;
  permissions?: UserPermissions;
}

interface UserPermissions {
  canViewDashboard: boolean;
  canManageLeads: boolean;
  canManageUsers: boolean;
  canCreateAdmins: boolean;
  canDeleteUsers: boolean;
  canManageWhatsAppAccounts: boolean;
  canAssignChats: boolean;
  canAccessSettings: boolean;
  canAccessAllChats: boolean;
  canViewReports: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

// Crear el contexto con un valor inicial undefined
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'crm_auth_token';
const USER_KEY = 'crm_user_data';

// Componente proveedor que envuelve la aplicación
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [, navigate] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar datos de sesión del localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Error parsing stored user data:', err);
        localStorage.removeItem(USER_KEY);
      }
    }
    
    setIsLoading(false);
  }, []);

  // Verificar token con el servidor
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          } else {
            // Token inválido o sesión expirada
            handleLogout();
          }
        } else if (res.status === 401) {
          // Token inválido
          handleLogout();
        }
      }).catch(error => {
        console.error('Error al verificar sesión:', error);
      });
    }
  }, [token]);

  // Iniciar sesión
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (data.success && data.token && data.user) {
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        
        setToken(data.token);
        setUser(data.user);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Cerrar sesión
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    navigate('/login');
  };

  // Actualizar datos de usuario
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    login,
    logout: handleLogout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
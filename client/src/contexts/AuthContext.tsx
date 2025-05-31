import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
  department?: string;
  supervisorId?: number;
  status: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  canAccessResource: (resourceType: string, resourceId?: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión activa al cargar la aplicación
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("user_data");

    if (storedToken && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(userData);
      } catch (error) {
        console.error("Error parsing stored user data:", error);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user_data");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (authToken: string, userData: User) => {
    setToken(authToken);
    setUser(userData);
    localStorage.setItem("auth_token", authToken);
    localStorage.setItem("user_data", JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    const rolePermissions = {
      super_admin: [
        'read_all', 'write_all', 'delete_all', 'manage_users', 'manage_system'
      ],
      admin: [
        'read_all', 'write_all', 'delete_all', 'manage_users'
      ],
      supervisor: [
        'read_department', 'write_department', 'manage_agents'
      ],
      agent: [
        'read_assigned', 'write_assigned'
      ]
    };

    const userPermissions = rolePermissions[user.role as keyof typeof rolePermissions] || [];
    return userPermissions.includes(permission);
  };

  const canAccessResource = (resourceType: string, resourceId?: number): boolean => {
    if (!user) return false;

    // Super admins y admins pueden acceder a todo
    if (['super_admin', 'admin'].includes(user.role)) {
      return true;
    }

    // Los supervisores pueden acceder a recursos de su departamento
    if (user.role === 'supervisor') {
      return true; // Se validará en el backend según el departamento
    }

    // Los agentes solo pueden acceder a sus recursos asignados
    if (user.role === 'agent') {
      return true; // Se validará en el backend según la asignación
    }

    return false;
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isLoading,
    hasPermission,
    canAccessResource,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
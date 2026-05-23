// import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
// import axios from 'axios';

// // ─── Types ────────────────────────────────────────────────────────────────────
// export type Role =
//   | 'Patient'
//   | 'Doctor'
//   | 'Admin'
//   | 'Pharmacist'
//   | 'LabTechnician'
//   | 'Receptionist';

// export interface AuthUser {
//   id: number;
//   fullName: string;
//   email: string;
//   role: Role;
//   token: string;
//   tenantId: number;
// }

// interface AuthContextType {
//   user: AuthUser | null;
//   token: string | null;
//   isLoading: boolean;
//   login: (email: string, password: string) => Promise<void>;
//   register: (data: RegisterData) => Promise<void>;
//   logout: () => void;
//   isAuthenticated: boolean;
// }

// interface RegisterData {
//   fullName: string;
//   email: string;
//   password: string;
//   phone: string;
// }

// // ─── Context ──────────────────────────────────────────────────────────────────
// const AuthContext = createContext<AuthContextType | null>(null);

// const BASE_URL  = 'http://localhost:5000';
// const TOKEN_KEY = 'hms_token';
// const USER_KEY  = 'hms_user';

// export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
//   const [user, setUser]         = useState<AuthUser | null>(null);
//   const [isLoading, setLoading] = useState(true);

//   // Rehydrate on mount
//   useEffect(() => {
//     try {
//       const stored = localStorage.getItem(USER_KEY);
//       if (stored) {
//         const parsed: AuthUser = JSON.parse(stored);
//         const payload = JSON.parse(atob(parsed.token.split('.')[1]));
//         if (payload.exp * 1000 > Date.now()) {
//           setUser(parsed);
//         } else {
//           localStorage.removeItem(USER_KEY);
//           localStorage.removeItem(TOKEN_KEY);
//         }
//       }
//     } catch {
//       localStorage.removeItem(USER_KEY);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   const login = useCallback(async (email: string, password: string) => {
//     const response = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });
//     const data = response.data as AuthUser;
//     setUser(data);
//     localStorage.setItem(USER_KEY,  JSON.stringify(data));
//     localStorage.setItem(TOKEN_KEY, data.token);
//   }, []);

//   const register = useCallback(async (data: RegisterData) => {
//     await axios.post(`${BASE_URL}/api/auth/register`, data);
//     await login(data.email, data.password);
//   }, [login]);

//   const logout = useCallback(() => {
//     setUser(null);
//     localStorage.removeItem(USER_KEY);
//     localStorage.removeItem(TOKEN_KEY);
//   }, []);

//   return (
//     <AuthContext.Provider value={{
//       user,
//       token: user?.token ?? null,
//       isLoading,
//       login,
//       register,
//       logout,
//       isAuthenticated: !!user,
//     }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = (): AuthContextType => {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
//   return ctx;
// };




// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/axiosInstance';
import toast from 'react-hot-toast';

export type Role = 'Patient' | 'Doctor' | 'Admin' | 'Pharmacist' | 'LabTechnician' | 'Receptionist';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  phone: string;
  token: string;
  refreshToken?: string;
  tokenExpiry?: string;
  tenantId: number;
  profileImageUrl?: string;
  dateOfBirth?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  tenant: any;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  googleLogin: (tokenId: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (roles: Role | Role[]) => boolean;
}

interface RegisterData {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'hms_token';
const USER_KEY = 'hms_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);

  // Resolve Tenant on load
  useEffect(() => {
    const resolveTenant = async () => {
      const hostname = window.location.hostname;
      const parts = hostname.split('.');
      if (parts.length > 2 || (parts.length === 2 && hostname.includes('localhost'))) {
        const subdomain = parts[0];
        if (subdomain !== 'www') {
          try {
            const res = await authApi.resolveTenant(subdomain);
            setTenant(res.data);
            localStorage.setItem('hms_tenant_id', res.data.id.toString());
          } catch (err) {
            console.error('Tenant resolution failed', err);
            localStorage.removeItem('hms_tenant_id');
          }
        }
      } else {
        localStorage.removeItem('hms_tenant_id');
      }
    };
    resolveTenant();
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.tokenExpiry && new Date(parsedUser.tokenExpiry) > new Date()) {
          setUser(parsedUser);
        } else if (!parsedUser.tokenExpiry) {
          setUser(parsedUser);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    const userData = response.data as AuthUser;
    
    localStorage.setItem(TOKEN_KEY, userData.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    toast.success(`Welcome back, ${userData.fullName}!`);
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    await authApi.register(data);
    toast.success('Registration successful! Please login.');
    await login(data.email, data.password);
  }, [login]);

  const googleLogin = useCallback(async (tokenId: string) => {
    const response = await authApi.googleLogin(tokenId);
    const userData = response.data as AuthUser;
    
    localStorage.setItem(TOKEN_KEY, userData.token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
    toast.success(`Welcome back, ${userData.fullName}!`);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    toast.success('Logged out successfully');
    // Don't navigate here - let the component handle navigation
  }, []);

  const hasRole = useCallback((roles: Role | Role[]): boolean => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      tenant,
      token: user?.token ?? null, 
      isLoading, 
      login, 
      register, 
      googleLogin, 
      logout, 
      isAuthenticated: !!user, 
      hasRole 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
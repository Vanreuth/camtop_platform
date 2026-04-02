import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Role {
  hierarchyLevel: number;
  isActive: boolean;
  roleId: number;
  roleName: string;
  roleCode: string;
}

interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string | null;
  bio?: string;
  status: string;
  roles: Role[];
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
}

// Load initial state from localStorage
const loadInitialState = (): AuthState => {
  if (typeof window === "undefined") {
    return {
      user: null,
      isAuthenticated: false,
      loading: true,
    };
  }

  try {
    const savedUser = localStorage.getItem("auth_user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return {
        user,
        isAuthenticated: true,
        loading: false,
      };
    }
  } catch (error) {
    console.error("Failed to load auth state from localStorage:", error);
  }

  return {
    user: null,
    isAuthenticated: false,
    loading: true,
  };
};

const initialState: AuthState = loadInitialState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      const user = {
        ...action.payload,
        permissions: action.payload.permissions ?? [],
      };
      state.user = user;
      state.isAuthenticated = true;
      state.loading = false;
      
      // Save to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("auth_user", JSON.stringify(user));
      }
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      
      // Clear from localStorage
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_user");
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setUser, clearAuth, setLoading } = authSlice.actions;
export default authSlice.reducer;

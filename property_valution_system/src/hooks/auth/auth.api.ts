
import type {
  ChangePasswordInput,
  LoginInput,
  PreferencesPayload,
  RegisterInput,
  Role,
  UpdateProfileInput,
  UserPayload,
} from "./auth.schemas";
import { unwrap, toFormData } from "@/utils/helpers";
import api from "@/lib/api";
import { clearTokens, setAccessToken, setRefreshToken } from "@/lib/token";


type AuthPayload = {
  user: UserPayload;
  preferences?: PreferencesPayload | null;
  roles?: Role[];
  permissions?: string[];
  accessToken?: string;
  refreshToken?: string;
  verificationEmailSent?: boolean;
  message?: string;
};

function pickToken(
  payload: unknown,
  key: "accessToken" | "refreshToken"
): string | null {
  const data = payload as {
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    tokens?: { accessToken?: string; refreshToken?: string };
    data?: {
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      tokens?: { accessToken?: string; refreshToken?: string };
      data?: { accessToken?: string; refreshToken?: string; token?: string };
    };
  };

  if (key === "accessToken") {
    return (
      data?.accessToken ??
      data?.token ??
      data?.tokens?.accessToken ??
      data?.data?.accessToken ??
      data?.data?.token ??
      data?.data?.tokens?.accessToken ??
      data?.data?.data?.accessToken ??
      data?.data?.data?.token ??
      null
    );
  }

  return (
    data?.refreshToken ??
    data?.tokens?.refreshToken ??
    data?.data?.refreshToken ??
    data?.data?.tokens?.refreshToken ??
    data?.data?.data?.refreshToken ??
    null
  );
}

function syncAuthTokens(payload: unknown) {
  const accessToken = pickToken(payload, "accessToken");
  const refreshToken = pickToken(payload, "refreshToken");

  if (accessToken) setAccessToken(accessToken);
  if (refreshToken) setRefreshToken(refreshToken);

  return { accessToken, refreshToken };
}

export const authApi = {
  normalizeProfileUpdate: (profile: Partial<UpdateProfileInput>) => {
    const normalizedEntries = Object.entries(profile).filter(([, value]) => {
      if (value === undefined || value === null) return false;
      if (typeof value === "string" && value.trim() === "") return false;
      return true;
    });

    return Object.fromEntries(normalizedEntries) as Partial<UpdateProfileInput>;
  },

  refresh: async (): Promise<{ accessToken?: string; refreshToken?: string }> => {
    const { data } = await api.post("/auth/refresh", {});
    const payload = unwrap<unknown>(data);
    const tokens = syncAuthTokens(payload);
    return {
      accessToken: tokens.accessToken ?? undefined,
      refreshToken: tokens.refreshToken ?? undefined,
    };
  },
  getProfile: async (): Promise<AuthPayload> => {
    const { data } = await api.get("/auth/me");
    return unwrap<AuthPayload>(data);
  },

  register: async (credentials: RegisterInput): Promise<AuthPayload> => {
    const { profilePicture, ...payload } = credentials;
    if (profilePicture) {
      const formData = toFormData({ ...payload, profilePicture });
      const { data } = await api.post("/auth/register", formData);
      return unwrap<AuthPayload>(data);
    }

    const { data } = await api.post("/auth/register", payload);
    return unwrap<AuthPayload>(data);
  },


  // Login request
  login: async (credentials: LoginInput): Promise<AuthPayload> => {
    const { data } = await api.post("/auth/login", credentials);
    const payload = unwrap<AuthPayload>(data);
    syncAuthTokens(payload);

    return payload;
  },

  googleAuth: async (idToken: string): Promise<AuthPayload> => {
    const { data } = await api.post("/auth/google/callback", { idToken });
    const payload = unwrap<AuthPayload>(data);
    syncAuthTokens(payload);

    return payload;
  },

  updateProfile: async (profile: Partial<UpdateProfileInput>): Promise<AuthPayload> => {
    const profilePicture = (profile as any).profilePicture;
    const normalizedProfile = authApi.normalizeProfileUpdate(profile);

    if (profilePicture instanceof File) {
      const { profilePicture: _, ...rest } = normalizedProfile as any;
      const fd = new FormData();
      fd.append("profile", JSON.stringify(rest));
      fd.append("profilePicture", profilePicture);
      
      // Debug logging
      console.log("Uploading with file:", profilePicture.name, profilePicture.size, profilePicture.type);
      console.log("FormData entries:");
      for (const pair of fd.entries()) {
        console.log(pair[0], typeof pair[1] === 'string' ? pair[1] : `File: ${(pair[1] as File).name}`);
      }
      
      const { data } = await api.patch("/auth/me/profile", fd);
      return unwrap<AuthPayload>(data);
    }

    // Remove profilePicture field if it's not a file
    const { profilePicture: _, ...profileData } = normalizedProfile as any;
    const { data } = await api.patch("/auth/me/profile", { profile: profileData });
    return unwrap<AuthPayload>(data);
  },


  changePassword: async (
    userId: number,
    passwordData: ChangePasswordInput
  ): Promise<void> => {
    const { data } = await api.patch(`/auth/${userId}/password`, passwordData);
    return data;
  },

   logout: async (): Promise<void> => {
    await api.post("/auth/logout");
    clearTokens();
  },

  getPreferences: async (): Promise<PreferencesPayload> => {
    const { data } = await api.get("/auth/me");
    const payload = unwrap<AuthPayload>(data);
    return payload.preferences ?? {};
  },

  updatePreferences: async (
    preferences: PreferencesPayload
  ): Promise<AuthPayload> => {
    const { data } = await api.patch("/auth/me/preferences", preferences);
    return unwrap<AuthPayload>(data);
  },

  resendVerification: async (email: string): Promise<{ message: string }> => {
    const { data } = await api.post("/auth/resend-verification", { email });
    return unwrap<{ message: string }>(data);
  },

  verifyEmail: async (token: string): Promise<AuthPayload> => {
    const { data } = await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    return unwrap<AuthPayload>(data);
  },
};

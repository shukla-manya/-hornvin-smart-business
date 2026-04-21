import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "../api/resources";
import { disconnectSocket, invalidateSocket } from "../services/socket";

const AuthContext = createContext(null);

const TOKEN_KEY = "vello_token";
const USER_KEY = "vello_user";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, u] = await Promise.all([AsyncStorage.getItem(TOKEN_KEY), AsyncStorage.getItem(USER_KEY)]);
        if (t && u) {
          const parsed = JSON.parse(u);
          if (parsed.status === "pending") {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          } else {
            setToken(t);
            setUser(parsed);
          }
        }
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const persist = useCallback(async (t, u) => {
    setToken(t);
    setUser(u);
    if (t && u) {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, t],
        [USER_KEY, JSON.stringify(u)],
      ]);
      invalidateSocket();
    } else {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      disconnectSocket();
    }
  }, []);

  const login = useCallback(
    async ({ email, phone, password, otpCode, emailOtp, phoneOtp }) => {
      const { data } = await authApi.login({
        email,
        phone,
        password,
        otpCode,
        emailOtp: emailOtp ?? otpCode,
        phoneOtp,
      });
      if (data.needsOtp) return { needsOtp: true, message: data.message, needsPhoneOtp: !!data.needsPhoneOtp };
      await persist(data.token, data.user);
      return {
        needsOtp: false,
        user: data.user,
        mustChangePassword: !!data.user?.mustChangePassword,
      };
    },
    [persist]
  );

  const requestLoginOtpEmail = useCallback(async (email) => {
    await authApi.loginOtpRequest(email.trim().toLowerCase());
  }, []);

  const verifyLoginOtpEmail = useCallback(
    async (email, code) => {
      const { data } = await authApi.loginOtpVerify({
        email: email.trim().toLowerCase(),
        code: String(code).trim(),
      });
      await persist(data.token, data.user);
      return { user: data.user, mustChangePassword: !!data.user?.mustChangePassword };
    },
    [persist]
  );

  const forgotPasswordRequest = useCallback(async (email) => {
    await authApi.forgotRequest(email.trim().toLowerCase());
  }, []);

  const forgotPasswordReset = useCallback(
    async (email, code, newPassword) => {
      const { data } = await authApi.forgotReset({
        email: email.trim().toLowerCase(),
        code: String(code).trim(),
        newPassword,
      });
      if (data.token && data.user) await persist(data.token, data.user);
      return data;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const { data } = await authApi.register(payload);
      if (data.token && data.user) await persist(data.token, data.user);
      return data;
    },
    [persist]
  );

  const verifyRegisterEmail = useCallback(
    async (email, otpCode) => {
      const { data } = await authApi.registerVerifyEmail({
        email: email.trim().toLowerCase(),
        otpCode: String(otpCode).trim(),
      });
      if (data.token && data.user) await persist(data.token, data.user);
      return data;
    },
    [persist]
  );

  const resendRegisterEmailCode = useCallback(async (email) => {
    const { data } = await authApi.registerResendEmailCode(email.trim().toLowerCase());
    return data;
  }, []);

  const logout = useCallback(async () => {
    await persist(null, null);
  }, [persist]);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      await persist(token, data.user);
      return data.user;
    } catch (e) {
      if (e.response?.status === 403 || e.response?.status === 401) {
        await persist(null, null);
      }
      throw e;
    }
  }, [persist, token]);

  const updateProfile = useCallback(
    async (patch) => {
      const body = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.businessName !== undefined) body.businessName = patch.businessName;
      if (patch.address !== undefined) body.address = patch.address;
      if (Object.keys(body).length === 0) return user;
      const { data } = await authApi.profile(body);
      await persist(token, data.user);
      return data.user;
    },
    [persist, token, user]
  );

  const updateProfileName = useCallback(async (name) => updateProfile({ name }), [updateProfile]);

  const value = useMemo(
    () => ({
      user,
      token,
      booting,
      login,
      requestLoginOtpEmail,
      verifyLoginOtpEmail,
      forgotPasswordRequest,
      forgotPasswordReset,
      register,
      verifyRegisterEmail,
      resendRegisterEmailCode,
      logout,
      refreshMe,
      updateProfile,
      updateProfileName,
      isAuthenticated: Boolean(
        token && user && (user.status === "approved" || user.status == null)
      ),
    }),
    [
      user,
      token,
      booting,
      login,
      requestLoginOtpEmail,
      verifyLoginOtpEmail,
      forgotPasswordRequest,
      forgotPasswordReset,
      register,
      verifyRegisterEmail,
      resendRegisterEmailCode,
      logout,
      refreshMe,
      updateProfile,
      updateProfileName,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

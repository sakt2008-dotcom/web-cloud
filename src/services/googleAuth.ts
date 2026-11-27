/**
 * Official Google Auth Service via Firebase Authentication
 * Enforces real Google Sign-In popup (accounts.google.com) for every member.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase';

export interface GoogleUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL?: string | null;
}

// Type alias for backward compatibility across existing components
export type User = GoogleUser;

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

// In-memory-only OAuth access token cache (never store OAuth access tokens in localStorage)
let cachedAccessToken: string | null = null;
let currentGoogleUser: GoogleUser | null = null;
let isSigningIn = false;

export const isGoogleSignInPending = (): boolean => isSigningIn;

// Clean up any legacy simulated token key from prior versions
try {
  localStorage.removeItem('amasa_google_token');
} catch {}

function mapFirebaseUser(user: FirebaseUser): GoogleUser {
  return {
    uid: user.uid,
    email: (user.email || '').trim().toLowerCase(),
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

/**
 * Initialize Auth State Listener. Call this on app mount.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: GoogleUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
    if (fbUser && fbUser.email) {
      currentGoogleUser = mapFirebaseUser(fbUser);
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(currentGoogleUser, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      currentGoogleUser = null;
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Returns current authenticated Google user.
 */
export const getCurrentGoogleUser = (): GoogleUser | null => {
  if (auth.currentUser && auth.currentUser.email) {
    currentGoogleUser = mapFirebaseUser(auth.currentUser);
  }
  return currentGoogleUser;
};

/**
 * Official Sign in with Google popup.
 * Every user (Admin, Marketers, Coordinators, Guards) must authenticate directly with Google.
 */
export const googleSignIn = async (): Promise<{
  user: GoogleUser;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const email = (result.user.email || '').trim().toLowerCase();

    if (!email) {
      throw new Error('لم يتم استلام البريد الإلكتروني من حساب Google.');
    }

    const mappedUser = mapFirebaseUser(result.user);
    currentGoogleUser = mappedUser;
    cachedAccessToken = credential?.accessToken || '';

    return {
      user: mappedUser,
      accessToken: cachedAccessToken,
    };
  } catch (error: any) {
    const code = String(error?.code || '');
    const raiseAuthError = (message: string): never => {
      const wrapped = new Error(message) as Error & { code?: string };
      wrapped.code = code;
      throw wrapped;
    };

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      raiseAuthError('تم إغلاق نافذة تسجيل الدخول بحساب Google قبل إكمال المصادقة.');
    }
    if (code === 'auth/popup-blocked') {
      raiseAuthError('تم حظر نافذة تسجيل الدخول المنبثقة من المتصفح. يرجى السماح بالنوافذ المنبثقة لهذا الموقع والمحاولة مرة أخرى.');
    }
    if (code === 'auth/unauthorized-domain') {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      raiseAuthError(
        `النطاق الحالي (${host}) غير مضاف بعد في قائمة النطاقات المصرح بها لتسجيل دخول Google في Firebase Console (Authentication -> Settings -> Authorized domains).`
      );
    }
    if (code === 'auth/network-request-failed') {
      raiseAuthError('تعذر الاتصال بخوادم Google. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.');
    }
    if (code === 'auth/operation-not-allowed') {
      raiseAuthError('مزود تسجيل الدخول عبر Google غير مفعّل في إعدادات Firebase Authentication.');
    }
    if (code === 'auth/user-disabled') {
      raiseAuthError('تم تعطيل هذا الحساب في نظام المصادقة. يرجى مراجعة الإدارة.');
    }
    if (code === 'auth/too-many-requests') {
      raiseAuthError('تم إجراء محاولات متكررة بسرعة. يرجى الانتظار دقيقة ثم المحاولة مرة أخرى.');
    }
    if (code === 'auth/web-storage-unsupported' || code === 'auth/operation-not-supported-in-this-environment') {
      raiseAuthError('المتصفح الحالي يمنع تخزين الجلسة مؤقتاً. تأكد من تفعيل ملفات تعريف الارتباط (Cookies) أو افتح التطبيق في متصفح Chrome/Safari.');
    }
    if (code === 'auth/internal-error') {
      raiseAuthError('حدث خطأ مؤقت أثناء التواصل مع خادم Google. يرجى إعادة المحاولة.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Returns cached in-memory access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Manually set Google Access Token in memory
 */
export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Signs out from Google / Firebase Auth and clears in-memory credentials.
 */
export const googleLogout = async () => {
  currentGoogleUser = null;
  cachedAccessToken = null;
  try {
    await signOut(auth);
  } catch {}
  try {
    localStorage.removeItem('amasa_google_user');
    localStorage.removeItem('amasa_google_token');
  } catch {}
};

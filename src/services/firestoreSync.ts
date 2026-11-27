import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase';
import { isPersonalDemoMode } from '../lib/demoMode';
import {
  AdminBroadcastMessage,
  AppNotification,
  Booking,
  CommissionRequest,
  Coordinator,
  DateOverride,
  Guard,
  GuardDailyTask,
  GuardTaskTemplate,
  KayanDetergentItem,
  KayanOrderSheet,
  KayanSettings,
  Marketer,
  Property,
  SpecialAdminFeeBox,
  SupervisorDateOverride,
  UserAccount,
} from '../types';

export interface StoreData {
  marketers?: Marketer[];
  coordinators?: Coordinator[];
  userAccounts?: UserAccount[];
  bookings?: Booking[];
  guardsList?: Guard[];
  adminBroadcasts?: AdminBroadcastMessage[];
  notifications?: AppNotification[];
  guardTasks?: GuardDailyTask[];
  guardTaskTemplates?: GuardTaskTemplate[];
  specialAdminFeeBoxes?: SpecialAdminFeeBox[];
  properties?: Property[];
  dateOverrides?: Record<string, DateOverride>;
  supervisorDateOverrides?: Record<string, SupervisorDateOverride>;
  customSupervisorRates?: number[];
  commissionRequests?: CommissionRequest[];
  messageTemplates?: any;
  expenses?: any[];
  activityLogs?: any[];
  coordinatorServices?: any[];
  kayanItems?: KayanDetergentItem[];
  kayanSettings?: KayanSettings;
  kayanOrders?: KayanOrderSheet[];
  _lastUpdated?: string;
  _originClientId?: string;
}

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SaveResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export const CLIENT_SYNC_ID = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export const OWNER_EMAIL = 'sakt2008@gmail.com';

let currentSyncStatus: SyncStatus = 'connected';
let currentSyncMessage = '';
const statusListeners: Array<(status: SyncStatus, message?: string) => void> = [];

export function subscribeSyncStatus(listener: (status: SyncStatus, message?: string) => void): () => void {
  statusListeners.push(listener);
  listener(currentSyncStatus, currentSyncMessage);
  return () => {
    const idx = statusListeners.indexOf(listener);
    if (idx >= 0) statusListeners.splice(idx, 1);
  };
}

export function notifySyncStatus(status: SyncStatus, message?: string): void {
  currentSyncStatus = status;
  if (message !== undefined) currentSyncMessage = message;
  statusListeners.forEach((l) => l(status, message));
}

export function getQuotaUpgradeUrl(): string {
  const projectId = firebaseConfig.projectId || '';
  const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
  return `https://console.firebase.google.com/project/${projectId}/firestore/databases/${dbId}/data?openUpgradeDialog=true`;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function toSafeFirestoreId(rawId: string): string {
  const cleaned = String(rawId || 'doc')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : `doc_${Date.now()}`;
}

function sanitizeForFirestore(val: any, depth = 0): any {
  if (val === undefined || val === null) return null;
  if (depth > 8) return null;
  if (typeof val === 'string') {
    // Keep normal URLs and compact idb:// references (~25 chars); strip ephemeral blob: URLs and oversized inline base64 blobs
    if ((val.startsWith('data:') && val.length > 120000) || val.startsWith('blob:')) {
      return '';
    }
    return val.length > 120000 ? val.slice(0, 120000) : val;
  }
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    const cleaned = val
      .slice(0, 500)
      .map((item) => {
        if (typeof item === 'string') {
          if ((item.startsWith('data:') && item.length > 120000) || item.startsWith('blob:') || item === '') {
            return null;
          }
        }
        return sanitizeForFirestore(item, depth + 1);
      })
      .filter((item) => item !== null && item !== '');
    return cleaned;
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v, depth + 1);
      }
    }
    return out;
  }
  return String(val);
}

/**
 * Deterministic canonical JSON stringify so object key order differences between Firestore and local state never cause false rewrites.
 */
function canonicalStringify(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map((item) => canonicalStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(val)
    .filter((k) => val[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(val[k])}`).join(',')}}`;
}

export interface EnvelopeMeta {
  existsRemotely?: boolean;
  existingId?: string;
  authorUid: string;
  createdAt?: Timestamp | null;
  authorizedEmails?: string[];
  remoteStatus?: string;
  optionalKeys?: {
    marketerId?: boolean;
    coordinatorId?: boolean;
    guardId?: boolean;
    isSupervisor?: boolean;
  };
  hash: string;
}

export interface FirestoreSyncState {
  metaCache: Record<string, EnvelopeMeta>;
  knownStaffEmails: string[];
}

export function createFirestoreSyncState(): FirestoreSyncState {
  return { metaCache: {}, knownStaffEmails: [] };
}

export function isCurrentUserAdmin(accounts: UserAccount[]): boolean {
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) return false;
  const emailNorm = fbUser.email.trim().toLowerCase();
  if (emailNorm === OWNER_EMAIL) return true;
  const matched = accounts.find((a) => a?.email?.trim().toLowerCase() === emailNorm);
  return matched?.role === 'admin';
}

function buildAuthorizedEmailList(accounts: UserAccount[], syncState?: FirestoreSyncState): string[] {
  const set = new Set<string>([OWNER_EMAIL]);
  const activeEmail = auth.currentUser?.email?.trim().toLowerCase();
  if (activeEmail && activeEmail.includes('@')) set.add(activeEmail);
  accounts.forEach((a) => {
    const em = a?.email?.trim().toLowerCase();
    if (em && em.length <= 160 && em.includes('@')) {
      set.add(em);
    }
  });
  if (syncState) {
    syncState.knownStaffEmails.forEach((em) => {
      const clean = em?.trim().toLowerCase();
      if (clean && clean.includes('@') && clean.length <= 160) {
        set.add(clean);
      }
    });
    // Include known team emails cached from Firestore metadata so non-admin creates remain visible to all staff
    Object.values(syncState.metaCache).forEach((meta) => {
      meta.authorizedEmails?.forEach((em) => {
        const clean = em?.trim().toLowerCase();
        if (clean && clean.includes('@') && clean.length <= 160) {
          set.add(clean);
        }
      });
    });
  }
  return Array.from(set).slice(0, 50);
}

function buildAdminEmailList(accounts: UserAccount[]): string[] {
  const set = new Set<string>([OWNER_EMAIL]);
  accounts.forEach((a) => {
    if (a?.role === 'admin' && a?.email) {
      const em = a.email.trim().toLowerCase();
      if (em.includes('@') && em.length <= 160) set.add(em);
    }
  });
  return Array.from(set).slice(0, 20);
}

/**
 * Ensures /admins/{uid} exists when an authorized admin signs in with verified Google email.
 */
export async function ensureFirestoreAdminBootstrap(accounts: UserAccount[]): Promise<boolean> {
  if (isPersonalDemoMode()) return false;
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) return false;
  const emailNorm = fbUser.email.trim().toLowerCase();
  const isOwner = emailNorm === OWNER_EMAIL;
  const matched = accounts.find((a) => a.email.trim().toLowerCase() === emailNorm);
  if (!isOwner && matched?.role !== 'admin') return false;

  const path = `admins/${fbUser.uid}`;
  try {
    const ref = doc(db, 'admins', fbUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: fbUser.uid,
        email: emailNorm,
        role: 'admin',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  } catch (err) {
    console.warn('Admin bootstrap note:', path, err);
    return false;
  }
}

export interface AuthorizedUserLookupResult {
  status: 'found' | 'not_found' | 'offline';
  account: UserAccount | null;
}

function mapAuthorizedUserDoc(data: any): UserAccount {
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    ...(data.marketerId ? { marketerId: data.marketerId } : {}),
    ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
    ...(data.guardId ? { guardId: data.guardId } : {}),
    ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
  };
}

export async function fetchAuthorizedUserStatusFromFirestore(
  email: string
): Promise<AuthorizedUserLookupResult> {
  if (isPersonalDemoMode()) return { status: 'offline', account: null };
  const fbUser = auth.currentUser;
  if (!fbUser) return { status: 'offline', account: null };
  const emailNorm = email.trim().toLowerCase();
  const docRef = doc(db, 'authorizedUsers', emailNorm);
  const path = `authorizedUsers/${emailNorm}`;

  try {
    const serverSnap = await getDocFromServer(docRef);
    if (!serverSnap.exists()) {
      return { status: 'not_found', account: null };
    }
    return { status: 'found', account: mapAuthorizedUserDoc(serverSnap.data()) };
  } catch (serverErr: any) {
    const errMsg = String(serverErr?.code || serverErr?.message || '').toLowerCase();
    const isPermDenied = errMsg.includes('permission');
    if (isPermDenied) {
      try {
        handleFirestoreError(serverErr, OperationType.GET, path);
      } catch {
        return { status: 'not_found', account: null };
      }
    }
    // Offline or network hiccup: gracefully check persistent local cache
    try {
      const cachedSnap = await getDoc(docRef);
      if (cachedSnap.exists()) {
        return { status: 'found', account: mapAuthorizedUserDoc(cachedSnap.data()) };
      }
    } catch {}
    return { status: 'offline', account: null };
  }
}

export async function fetchAuthorizedUserFromFirestore(email: string): Promise<UserAccount | null> {
  const res = await fetchAuthorizedUserStatusFromFirestore(email);
  return res.account;
}

const VALID_EMAIL_KEY_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export async function syncAuthorizedUsersToFirestore(
  accounts: UserAccount[],
  syncState: FirestoreSyncState
): Promise<void> {
  if (isPersonalDemoMode()) return;
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) return;

  if (!isCurrentUserAdmin(accounts)) return;

  const adminEmails = buildAdminEmailList(accounts);
  const batch = writeBatch(db);
  let opCount = 0;

  for (const acc of accounts) {
    const emailKey = (acc.email || '').trim().toLowerCase();
    if (!emailKey || emailKey.length > 160 || !VALID_EMAIL_KEY_REGEX.test(emailKey)) continue;

    const cacheKey = `authorizedUsers/${emailKey}`;
    const existingMeta = syncState.metaCache[cacheKey];
    const docRef = doc(db, 'authorizedUsers', emailKey);

    let existsRemotely = Boolean(existingMeta?.existsRemotely || existingMeta?.createdAt);
    let existingId = existingMeta?.existingId;
    let existingOptional = existingMeta?.optionalKeys;
    let authorUid = existingMeta?.authorUid;
    let createdAt = existingMeta?.createdAt instanceof Timestamp ? existingMeta.createdAt : null;

    if (!existingMeta || !existsRemotely) {
      try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const d = snap.data() as any;
          existsRemotely = true;
          existingId = typeof d.id === 'string' && d.id ? d.id : undefined;
          authorUid = d.authorUid;
          createdAt = d.createdAt instanceof Timestamp ? d.createdAt : null;
          existingOptional = {
            marketerId: 'marketerId' in d,
            coordinatorId: 'coordinatorId' in d,
            guardId: 'guardId' in d,
            isSupervisor: 'isSupervisor' in d,
          };
        }
      } catch {}
    }

    const safeAccId = existingId || toSafeFirestoreId(acc.id);
    const payloadCore = {
      id: safeAccId,
      email: emailKey,
      name: String(acc.name || emailKey.split('@')[0]).slice(0, 160) || 'عضو',
      role: acc.role || 'marketer',
      ...(acc.marketerId ? { marketerId: toSafeFirestoreId(acc.marketerId) } : {}),
      ...(acc.coordinatorId ? { coordinatorId: toSafeFirestoreId(acc.coordinatorId) } : {}),
      ...(acc.guardId ? { guardId: toSafeFirestoreId(acc.guardId) } : {}),
      ...(acc.isSupervisor !== undefined ? { isSupervisor: Boolean(acc.isSupervisor) } : {}),
      adminEmails,
    };

    const hash = canonicalStringify(payloadCore);
    if (syncState.metaCache[cacheKey]?.hash === hash && existsRemotely) continue;

    const finalAuthorUid = authorUid || fbUser.uid;
    if (existsRemotely) {
      const updatePayload: Record<string, any> = {
        name: payloadCore.name,
        role: payloadCore.role,
        adminEmails,
        updatedAt: serverTimestamp(),
      };
      if (payloadCore.marketerId) {
        updatePayload.marketerId = payloadCore.marketerId;
      } else if (!existingOptional || existingOptional.marketerId) {
        updatePayload.marketerId = deleteField();
      }
      if (payloadCore.coordinatorId) {
        updatePayload.coordinatorId = payloadCore.coordinatorId;
      } else if (!existingOptional || existingOptional.coordinatorId) {
        updatePayload.coordinatorId = deleteField();
      }
      if (payloadCore.guardId) {
        updatePayload.guardId = payloadCore.guardId;
      } else if (!existingOptional || existingOptional.guardId) {
        updatePayload.guardId = deleteField();
      }
      if (payloadCore.isSupervisor !== undefined) {
        updatePayload.isSupervisor = payloadCore.isSupervisor;
      } else if (!existingOptional || existingOptional.isSupervisor) {
        updatePayload.isSupervisor = deleteField();
      }
      batch.update(docRef, updatePayload);
    } else {
      batch.set(docRef, {
        ...payloadCore,
        authorUid: finalAuthorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    syncState.metaCache[cacheKey] = {
      existsRemotely: true,
      existingId: safeAccId,
      authorUid: finalAuthorUid,
      createdAt,
      optionalKeys: {
        marketerId: Boolean(payloadCore.marketerId),
        coordinatorId: Boolean(payloadCore.coordinatorId),
        guardId: Boolean(payloadCore.guardId),
        isSupervisor: payloadCore.isSupervisor !== undefined,
      },
      hash,
    };
    opCount += 1;
    if (opCount >= 400) break;
  }

  if (opCount > 0) {
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'authorizedUsers');
    }
  }
}

export async function deleteAuthorizedUserFromFirestore(
  email: string,
  syncState: FirestoreSyncState
): Promise<void> {
  if (isPersonalDemoMode()) return;
  const fbUser = auth.currentUser;
  if (!fbUser) return;
  const emailKey = email.trim().toLowerCase();
  if (!emailKey || emailKey === OWNER_EMAIL) return;
  const path = `authorizedUsers/${emailKey}`;
  try {
    await deleteDoc(doc(db, 'authorizedUsers', emailKey));
    delete syncState.metaCache[path];
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteCollectionDocFromFirestore(
  collectionName: string,
  rawId: string,
  syncState: FirestoreSyncState
): Promise<void> {
  if (isPersonalDemoMode()) return;
  const fbUser = auth.currentUser;
  if (!fbUser) return;
  const safeId = toSafeFirestoreId(rawId);
  const path = `${collectionName}/${safeId}`;
  try {
    await deleteDoc(doc(db, collectionName, safeId));
    delete syncState.metaCache[path];
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

interface EnvelopeItemInput {
  rawId: string;
  title: string;
  status: string;
  amount: number;
  record: Record<string, any>;
}

interface SyncEnvelopeOptions {
  adminOnlyWrite?: boolean;
  createOnlyForNonAdmin?: boolean;
  nonAdminImmutableStatuses?: string[];
}

function stripHeavyDataUrls(val: any, depth = 0): any {
  if (val === undefined || val === null) return null;
  if (depth > 8) return null;
  if (typeof val === 'string') {
    if (val.startsWith('data:') && val.length > 2000) return '';
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .map((item) => stripHeavyDataUrls(item, depth + 1))
      .filter((item) => item !== null && item !== '');
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) out[k] = stripHeavyDataUrls(v, depth + 1);
    }
    return out;
  }
  return val;
}

async function syncEnvelopeCollection(
  collectionName: string,
  items: EnvelopeItemInput[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState,
  options: SyncEnvelopeOptions = {}
): Promise<void> {
  if (isPersonalDemoMode()) return;
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) return;

  const isAdmin = isCurrentUserAdmin(accounts);
  if (options.adminOnlyWrite && !isAdmin) return;

  const defaultAuthorizedEmails = buildAuthorizedEmailList(accounts, syncState);

  const chunks: EnvelopeItemInput[][] = [];
  for (let i = 0; i < items.length; i += 350) {
    chunks.push(items.slice(i, i + 350));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    let opCount = 0;

    for (const item of chunk) {
      const safeId = toSafeFirestoreId(item.rawId);
      const cacheKey = `${collectionName}/${safeId}`;
      const existingMeta = syncState.metaCache[cacheKey];
      const docRef = doc(db, collectionName, safeId);

      let authorUid = existingMeta?.authorUid;
      let createdAt = existingMeta?.createdAt instanceof Timestamp ? existingMeta.createdAt : null;
      let existingAuthEmails = existingMeta?.authorizedEmails;
      let remoteStatus = existingMeta?.remoteStatus;
      let docExistsRemotely = Boolean(existingMeta?.existsRemotely || existingMeta?.createdAt);

      if (!existingMeta || !docExistsRemotely) {
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const d = snap.data() as any;
            docExistsRemotely = true;
            authorUid = d.authorUid;
            createdAt = d.createdAt instanceof Timestamp ? d.createdAt : null;
            existingAuthEmails = Array.isArray(d.authorizedEmails) ? d.authorizedEmails : undefined;
            remoteStatus = typeof d.status === 'string' ? d.status : undefined;
          }
        } catch {}
      }

      if (docExistsRemotely && !isAdmin) {
        if (options.createOnlyForNonAdmin) continue;
        if (
          options.nonAdminImmutableStatuses &&
          remoteStatus &&
          options.nonAdminImmutableStatuses.includes(remoteStatus)
        ) {
          continue;
        }
      }

      // Critical Rule Alignment: Non-admins must preserve existing authorizedEmails on updates
      const targetAuthorizedEmails =
        !isAdmin && docExistsRemotely && Array.isArray(existingAuthEmails) && existingAuthEmails.length > 0
          ? existingAuthEmails
          : defaultAuthorizedEmails;

      let sanitizedRecord = sanitizeForFirestore(item.record);
      try {
        const serializedLen = JSON.stringify(sanitizedRecord).length;
        if (serializedLen > 820000) {
          sanitizedRecord = stripHeavyDataUrls(sanitizedRecord);
        }
      } catch {}

      const envelopeCore = {
        id: safeId,
        title: String(item.title || safeId).slice(0, 200),
        status: String(item.status || 'active').slice(0, 64),
        amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : 0,
        record: sanitizedRecord,
        authorizedEmails: targetAuthorizedEmails,
      };

      const hash = canonicalStringify(envelopeCore);
      if (existingMeta?.hash === hash && docExistsRemotely) continue;

      const finalAuthorUid = authorUid || fbUser.uid;
      if (docExistsRemotely) {
        // Use partial update strictly limited to fields allowed by firestore.rules for the caller's role
        if (isAdmin) {
          batch.update(docRef, {
            title: envelopeCore.title,
            status: envelopeCore.status,
            amount: envelopeCore.amount,
            record: envelopeCore.record,
            authorizedEmails: envelopeCore.authorizedEmails,
            updatedAt: serverTimestamp(),
          });
        } else if (collectionName === 'systemStates') {
          batch.update(docRef, {
            record: envelopeCore.record,
            updatedAt: serverTimestamp(),
          });
        } else if (collectionName === 'guardTasks') {
          batch.update(docRef, {
            title: envelopeCore.title,
            status: envelopeCore.status,
            record: envelopeCore.record,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(docRef, {
            title: envelopeCore.title,
            status: envelopeCore.status,
            amount: envelopeCore.amount,
            record: envelopeCore.record,
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        batch.set(docRef, {
          ...envelopeCore,
          authorUid: finalAuthorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      syncState.metaCache[cacheKey] = {
        existsRemotely: true,
        authorUid: finalAuthorUid,
        createdAt,
        authorizedEmails: targetAuthorizedEmails,
        remoteStatus: envelopeCore.status,
        hash,
      };
      opCount += 1;
    }

    if (opCount > 0) {
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, collectionName);
      }
    }
  }
}

export async function pushBookingsToFirestore(
  bookings: Booking[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  const allowed = new Set(['pending', 'waiting_deposit', 'pending_payment', 'confirmed', 'completed', 'cancelled']);
  await syncEnvelopeCollection(
    'bookings',
    bookings.map((b) => ({
      rawId: b.id,
      title: `${b.bookingNumber || ''} - ${b.customerName || ''} - ${b.propertyName || ''}`.trim(),
      status: allowed.has(b.status) ? b.status : 'pending',
      amount: Number(b.totalPrice) || 0,
      record: b,
    })),
    accounts,
    syncState,
    { nonAdminImmutableStatuses: ['completed', 'cancelled'] }
  );
}

export async function pushPropertiesToFirestore(
  properties: Property[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  await syncEnvelopeCollection(
    'properties',
    properties.map((p) => ({
      rawId: p.id,
      title: p.name || p.id,
      status: p.isPublished ? 'published' : 'hidden',
      amount: Number(p.basePriceWeekday) || 0,
      record: p,
    })),
    accounts,
    syncState,
    { adminOnlyWrite: true }
  );
}

export async function pushAdminFeeBoxesToFirestore(
  boxes: SpecialAdminFeeBox[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  await syncEnvelopeCollection(
    'adminFeeBoxes',
    boxes.map((box) => ({
      rawId: box.id,
      title: box.name || box.id,
      status: box.isLocked ? 'locked' : 'open',
      amount: Number(box.specialAdminFee) || 0,
      record: box,
    })),
    accounts,
    syncState,
    { adminOnlyWrite: true }
  );
}

export async function pushStaffMembersToFirestore(
  marketers: Marketer[],
  coordinators: Coordinator[],
  guardsList: Guard[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  const items: EnvelopeItemInput[] = [
    ...marketers.map((m) => ({
      rawId: `mk_${m.id}`,
      title: m.name || m.id,
      status: 'marketer',
      amount: Number(m.commissionRate) || 0,
      record: { memberType: 'marketer', data: m },
    })),
    ...coordinators.map((c) => ({
      rawId: `co_${c.id}`,
      title: c.name || c.id,
      status: 'coordinator',
      amount: Number(c.completedTasks) || 0,
      record: { memberType: 'coordinator', data: c },
    })),
    ...guardsList.map((g) => ({
      rawId: `gd_${g.id}`,
      title: g.name || g.id,
      status: 'guard',
      amount: Number(g.salary) || 0,
      record: { memberType: 'guard', data: g },
    })),
  ];
  await syncEnvelopeCollection('staffMembers', items, accounts, syncState, { adminOnlyWrite: true });
}

export async function pushGuardTasksToFirestore(
  tasks: GuardDailyTask[],
  templates: GuardTaskTemplate[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  const allowed = new Set(['pending', 'in_progress', 'completed', 'verified', 'template']);
  const items: EnvelopeItemInput[] = [
    ...tasks.map((t) => ({
      rawId: `task_${t.id}`,
      title: t.title || t.propertyName || t.id,
      status: allowed.has(t.status) ? t.status : 'pending',
      amount: 0,
      record: { kind: 'task', data: t },
    })),
    ...templates.map((tpl) => ({
      rawId: `tpl_${tpl.id}`,
      title: tpl.title || tpl.id,
      status: 'template',
      amount: 0,
      record: { kind: 'template', data: tpl },
    })),
  ];
  await syncEnvelopeCollection('guardTasks', items, accounts, syncState);
}

export async function pushCommissionRequestsToFirestore(
  requests: CommissionRequest[],
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  const allowed = new Set(['pending', 'approved', 'transferred', 'paid', 'rejected']);
  await syncEnvelopeCollection(
    'commissionRequests',
    requests.map((r) => ({
      rawId: r.id,
      title: r.marketerName || r.id,
      status: allowed.has(r.status) ? r.status : 'pending',
      amount: Number(r.amount) || 0,
      record: r,
    })),
    accounts,
    syncState,
    { createOnlyForNonAdmin: true }
  );
}

export async function pushSystemStateToFirestore(
  stateId: string,
  payload: any,
  accounts: UserAccount[],
  syncState: FirestoreSyncState
) {
  await syncEnvelopeCollection(
    'systemStates',
    [
      {
        rawId: stateId,
        title: stateId,
        status: 'active',
        amount: 0,
        record: { stateId, value: payload },
      },
    ],
    accounts,
    syncState
  );
}

const OPERATIONAL_CACHE_PREFIXES = [
  'bookings/',
  'properties/',
  'adminFeeBoxes/',
  'staffMembers/',
  'guardTasks/',
  'commissionRequests/',
  'systemStates/',
];

export function hasMissingAuthorizedEmailsInCache(
  accounts: UserAccount[],
  syncState: FirestoreSyncState
): boolean {
  const expectedEmails = accounts
    .map((a) => a?.email?.trim().toLowerCase())
    .filter((em): em is string => Boolean(em && em.includes('@')));
  if (expectedEmails.length === 0) return false;

  for (const [cacheKey, meta] of Object.entries(syncState.metaCache)) {
    if (!OPERATIONAL_CACHE_PREFIXES.some((prefix) => cacheKey.startsWith(prefix))) continue;
    const authSet = new Set((meta.authorizedEmails || []).map((e) => String(e || '').trim().toLowerCase()));
    if (expectedEmails.some((em) => !authSet.has(em))) {
      return true;
    }
  }
  return false;
}

export async function propagateAuthorizedEmailsToAllCollections(
  snapshot: {
    userAccounts: UserAccount[];
    marketers: Marketer[];
    coordinators: Coordinator[];
    guardsList: Guard[];
    bookings: Booking[];
    properties: Property[];
    specialAdminFeeBoxes: SpecialAdminFeeBox[];
    guardTasks: GuardDailyTask[];
    guardTaskTemplates: GuardTaskTemplate[];
    commissionRequests: CommissionRequest[];
    dateOverrides: Record<string, DateOverride>;
    supervisorDateOverrides: Record<string, SupervisorDateOverride>;
    customSupervisorRates: number[];
    adminBroadcasts: AdminBroadcastMessage[];
    notifications: AppNotification[];
    coordinatorServices?: any[];
    expenses?: any[];
    messageTemplates?: any;
    activityLogs?: any[];
    kayanItems?: KayanDetergentItem[];
    kayanSettings?: KayanSettings;
    kayanOrders?: KayanOrderSheet[];
  },
  syncState: FirestoreSyncState
): Promise<void> {
  if (isPersonalDemoMode()) return;
  if (!isCurrentUserAdmin(snapshot.userAccounts)) return;
  const tasks: Array<Promise<any>> = [
    syncAuthorizedUsersToFirestore(snapshot.userAccounts, syncState),
    pushStaffMembersToFirestore(
      snapshot.marketers,
      snapshot.coordinators,
      snapshot.guardsList,
      snapshot.userAccounts,
      syncState
    ),
    pushBookingsToFirestore(snapshot.bookings, snapshot.userAccounts, syncState),
    pushPropertiesToFirestore(snapshot.properties, snapshot.userAccounts, syncState),
    pushAdminFeeBoxesToFirestore(snapshot.specialAdminFeeBoxes, snapshot.userAccounts, syncState),
    pushGuardTasksToFirestore(
      snapshot.guardTasks,
      snapshot.guardTaskTemplates,
      snapshot.userAccounts,
      syncState
    ),
    pushCommissionRequestsToFirestore(snapshot.commissionRequests, snapshot.userAccounts, syncState),
    pushSystemStateToFirestore('dateOverrides', snapshot.dateOverrides, snapshot.userAccounts, syncState),
    pushSystemStateToFirestore('supervisorDateOverrides', snapshot.supervisorDateOverrides, snapshot.userAccounts, syncState),
    pushSystemStateToFirestore('customSupervisorRates', snapshot.customSupervisorRates, snapshot.userAccounts, syncState),
    pushSystemStateToFirestore('adminBroadcasts', snapshot.adminBroadcasts, snapshot.userAccounts, syncState),
    pushSystemStateToFirestore('notifications', snapshot.notifications, snapshot.userAccounts, syncState),
  ];

  if (Array.isArray(snapshot.coordinatorServices)) {
    tasks.push(
      pushSystemStateToFirestore('coordinatorServices', snapshot.coordinatorServices, snapshot.userAccounts, syncState)
    );
  }
  if (Array.isArray(snapshot.expenses)) {
    tasks.push(pushSystemStateToFirestore('expenses', snapshot.expenses, snapshot.userAccounts, syncState));
  }
  if (snapshot.messageTemplates && typeof snapshot.messageTemplates === 'object') {
    tasks.push(
      pushSystemStateToFirestore('messageTemplates', snapshot.messageTemplates, snapshot.userAccounts, syncState)
    );
  }
  if (Array.isArray(snapshot.activityLogs)) {
    tasks.push(
      pushSystemStateToFirestore('activityLogs', snapshot.activityLogs.slice(0, 80), snapshot.userAccounts, syncState)
    );
  }
  if (Array.isArray(snapshot.kayanItems)) {
    tasks.push(
      pushSystemStateToFirestore('kayanItems', snapshot.kayanItems, snapshot.userAccounts, syncState)
    );
  }
  if (snapshot.kayanSettings && typeof snapshot.kayanSettings === 'object') {
    tasks.push(
      pushSystemStateToFirestore('kayanSettings', snapshot.kayanSettings, snapshot.userAccounts, syncState)
    );
  }
  if (Array.isArray(snapshot.kayanOrders)) {
    tasks.push(
      pushSystemStateToFirestore('kayanOrders', snapshot.kayanOrders.slice(0, 120), snapshot.userAccounts, syncState)
    );
  }

  await Promise.allSettled(tasks);
}

export interface HydrationSnapshotResult {
  storeData: StoreData;
  populatedCollections: Set<string>;
}

/**
 * Loads current state from Firestore once before subscribing or seeding, preventing stale local defaults from overwriting cloud records.
 */
export async function hydrateFromFirestoreOnce(
  syncState: FirestoreSyncState,
  localAccounts: UserAccount[]
): Promise<HydrationSnapshotResult> {
  const storeData: StoreData = {};
  const populatedCollections = new Set<string>();
  if (isPersonalDemoMode()) {
    return { storeData, populatedCollections };
  }

  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
    return { storeData, populatedCollections };
  }

  const emailNorm = fbUser.email.trim().toLowerCase();
  const isOwner = emailNorm === OWNER_EMAIL;
  const isAdmin = isOwner || isCurrentUserAdmin(localAccounts);

  const buildScopedQuery = (colName: string) => {
    const colRef = collection(db, colName);
    return isOwner ? colRef : query(colRef, where('authorizedEmails', 'array-contains', emailNorm));
  };

  // 1. Authorized Users
  try {
    if (isOwner) {
      const snap = await getDocs(collection(db, 'authorizedUsers'));
      if (!snap.empty) {
        const list: UserAccount[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const cacheKey = `authorizedUsers/${d.id}`;
          const core = {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            ...(data.marketerId ? { marketerId: data.marketerId } : {}),
            ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
            ...(data.guardId ? { guardId: data.guardId } : {}),
            ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
            adminEmails: data.adminEmails || [],
          };
          syncState.metaCache[cacheKey] = {
            existsRemotely: true,
            existingId: data.id,
            authorUid: data.authorUid,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            optionalKeys: {
              marketerId: 'marketerId' in data,
              coordinatorId: 'coordinatorId' in data,
              guardId: 'guardId' in data,
              isSupervisor: 'isSupervisor' in data,
            },
            hash: canonicalStringify(core),
          };
          list.push({
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            ...(data.marketerId ? { marketerId: data.marketerId } : {}),
            ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
            ...(data.guardId ? { guardId: data.guardId } : {}),
            ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
          });
        });
        if (list.length > 0) {
          storeData.userAccounts = list;
          populatedCollections.add('authorizedUsers');
        }
      }
    } else if (isAdmin) {
      const snap = await getDocs(
        query(collection(db, 'authorizedUsers'), where('adminEmails', 'array-contains', emailNorm))
      );
      if (!snap.empty) {
        const list: UserAccount[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const cacheKey = `authorizedUsers/${d.id}`;
          const core = {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            ...(data.marketerId ? { marketerId: data.marketerId } : {}),
            ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
            ...(data.guardId ? { guardId: data.guardId } : {}),
            ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
            adminEmails: data.adminEmails || [],
          };
          syncState.metaCache[cacheKey] = {
            existsRemotely: true,
            existingId: data.id,
            authorUid: data.authorUid,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
            optionalKeys: {
              marketerId: 'marketerId' in data,
              coordinatorId: 'coordinatorId' in data,
              guardId: 'guardId' in data,
              isSupervisor: 'isSupervisor' in data,
            },
            hash: canonicalStringify(core),
          };
          list.push({
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            ...(data.marketerId ? { marketerId: data.marketerId } : {}),
            ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
            ...(data.guardId ? { guardId: data.guardId } : {}),
            ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
          });
        });
        if (list.length > 0) {
          storeData.userAccounts = list;
          populatedCollections.add('authorizedUsers');
        }
      }
    } else {
      const ownAcc = await fetchAuthorizedUserFromFirestore(emailNorm);
      if (ownAcc) {
        if (ownAcc.role === 'admin') {
          try {
            const adminSnap = await getDocs(
              query(collection(db, 'authorizedUsers'), where('adminEmails', 'array-contains', emailNorm))
            );
            if (!adminSnap.empty) {
              const list: UserAccount[] = [];
              adminSnap.forEach((d) => {
                const data = d.data() as any;
                const cacheKey = `authorizedUsers/${d.id}`;
                const core = {
                  id: data.id,
                  email: data.email,
                  name: data.name,
                  role: data.role,
                  ...(data.marketerId ? { marketerId: data.marketerId } : {}),
                  ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
                  ...(data.guardId ? { guardId: data.guardId } : {}),
                  ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
                  adminEmails: data.adminEmails || [],
                };
                syncState.metaCache[cacheKey] = {
                  existsRemotely: true,
                  existingId: data.id,
                  authorUid: data.authorUid,
                  createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
                  optionalKeys: {
                    marketerId: 'marketerId' in data,
                    coordinatorId: 'coordinatorId' in data,
                    guardId: 'guardId' in data,
                    isSupervisor: 'isSupervisor' in data,
                  },
                  hash: canonicalStringify(core),
                };
                list.push({
                  id: data.id,
                  email: data.email,
                  name: data.name,
                  role: data.role,
                  ...(data.marketerId ? { marketerId: data.marketerId } : {}),
                  ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
                  ...(data.guardId ? { guardId: data.guardId } : {}),
                  ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
                });
              });
              if (list.length > 0) {
                storeData.userAccounts = list;
                populatedCollections.add('authorizedUsers');
              }
            }
          } catch {}
        }
        if (!storeData.userAccounts || storeData.userAccounts.length === 0) {
          storeData.userAccounts = [ownAcc];
          populatedCollections.add('authorizedUsers');
        }
      }
    }
  } catch (err) {
    console.warn('Initial authorizedUsers hydration skipped:', err);
  }

  const readEnvelopeCollection = async (colName: string) => {
    try {
      const snap = await getDocs(buildScopedQuery(colName));
      const records: Array<{ id: string; record: any }> = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const cacheKey = `${colName}/${d.id}`;
        const envelopeCore = {
          id: data.id,
          title: data.title,
          status: data.status,
          amount: data.amount,
          record: data.record,
          authorizedEmails: data.authorizedEmails || [],
        };
        syncState.metaCache[cacheKey] = {
          existsRemotely: true,
          authorUid: data.authorUid,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
          authorizedEmails: Array.isArray(data.authorizedEmails) ? data.authorizedEmails : [],
          remoteStatus: typeof data.status === 'string' ? data.status : undefined,
          hash: canonicalStringify(envelopeCore),
        };
        if (data.record) {
          records.push({ id: d.id, record: data.record });
        }
      });
      if (records.length > 0) {
        populatedCollections.add(colName);
      }
      return records;
    } catch (err) {
      console.warn(`Initial ${colName} hydration error:`, err);
      return [];
    }
  };

  const [bookingsRecs, propsRecs, boxRecs, staffRecs, taskRecs, reqRecs, sysRecs] = await Promise.all([
    readEnvelopeCollection('bookings'),
    readEnvelopeCollection('properties'),
    readEnvelopeCollection('adminFeeBoxes'),
    readEnvelopeCollection('staffMembers'),
    readEnvelopeCollection('guardTasks'),
    readEnvelopeCollection('commissionRequests'),
    readEnvelopeCollection('systemStates'),
  ]);

  if (bookingsRecs.length > 0) storeData.bookings = bookingsRecs.map((r) => r.record as Booking);
  if (propsRecs.length > 0) storeData.properties = propsRecs.map((r) => r.record as Property);
  if (boxRecs.length > 0) storeData.specialAdminFeeBoxes = boxRecs.map((r) => r.record as SpecialAdminFeeBox);

  if (staffRecs.length > 0) {
    const marketers: Marketer[] = [];
    const coordinators: Coordinator[] = [];
    const guardsList: Guard[] = [];
    const staffEmails: string[] = [];
    staffRecs.forEach(({ record }) => {
      if (record.memberType === 'marketer' && record.data) {
        marketers.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      } else if (record.memberType === 'coordinator' && record.data) {
        coordinators.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      } else if (record.memberType === 'guard' && record.data) {
        guardsList.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      }
    });
    if (staffEmails.length > 0) {
      syncState.knownStaffEmails = Array.from(new Set([...syncState.knownStaffEmails, ...staffEmails]));
    }
    if (marketers.length > 0) storeData.marketers = marketers;
    if (coordinators.length > 0) storeData.coordinators = coordinators;
    if (guardsList.length > 0) storeData.guardsList = guardsList;
  }

  if (taskRecs.length > 0) {
    const tasks: GuardDailyTask[] = [];
    const templates: GuardTaskTemplate[] = [];
    taskRecs.forEach(({ record }) => {
      if (record.kind === 'task' && record.data) tasks.push(record.data);
      else if (record.kind === 'template' && record.data) templates.push(record.data);
    });
    if (tasks.length > 0) storeData.guardTasks = tasks;
    if (templates.length > 0) storeData.guardTaskTemplates = templates;
  }

  if (reqRecs.length > 0) {
    storeData.commissionRequests = reqRecs.map((r) => r.record as CommissionRequest);
  }

  sysRecs.forEach(({ record }) => {
    if (record.stateId && record.value !== undefined) {
      (storeData as Record<string, any>)[record.stateId] = record.value;
    }
  });

  return { storeData, populatedCollections };
}

export interface FirestoreHydrationCallbacks {
  onAuthorizedUsers?: (accounts: UserAccount[]) => void;
  onOwnAccountUpdated?: (account: UserAccount) => void;
  onOwnAccountRevoked?: () => void;
  onBookings?: (bookings: Booking[]) => void;
  onProperties?: (properties: Property[]) => void;
  onAdminFeeBoxes?: (boxes: SpecialAdminFeeBox[]) => void;
  onStaffMembers?: (staff: { marketers: Marketer[]; coordinators: Coordinator[]; guardsList: Guard[] }) => void;
  onGuardTasks?: (data: { tasks: GuardDailyTask[]; templates: GuardTaskTemplate[] }) => void;
  onCommissionRequests?: (reqs: CommissionRequest[]) => void;
  onSystemState?: (stateId: string, value: any) => void;
  onSyncReady?: () => void;
}

export function subscribeFirestoreRealtime(
  syncState: FirestoreSyncState,
  callbacks: FirestoreHydrationCallbacks
): () => void {
  if (isPersonalDemoMode()) {
    return () => {};
  }
  const fbUser = auth.currentUser;
  if (!fbUser || !fbUser.email || !fbUser.emailVerified) {
    return () => {};
  }

  const emailNorm = fbUser.email.trim().toLowerCase();
  const isOwner = emailNorm === OWNER_EMAIL;
  const unsubs: Array<() => void> = [];

  const buildScopedQuery = (colName: string) => {
    const colRef = collection(db, colName);
    return isOwner ? colRef : query(colRef, where('authorizedEmails', 'array-contains', emailNorm));
  };

  // 1. Authorized Users
  if (isOwner) {
    const authPath = 'authorizedUsers';
    unsubs.push(
      onSnapshot(
        collection(db, authPath),
        (snap) => {
          const list: UserAccount[] = [];
          snap.forEach((d) => {
            const data = d.data() as any;
            const cacheKey = `${authPath}/${d.id}`;
            const core = {
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              ...(data.marketerId ? { marketerId: data.marketerId } : {}),
              ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
              ...(data.guardId ? { guardId: data.guardId } : {}),
              ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
              adminEmails: data.adminEmails || [],
            };
            syncState.metaCache[cacheKey] = {
              existsRemotely: true,
              existingId: data.id,
              authorUid: data.authorUid,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
              optionalKeys: {
                marketerId: 'marketerId' in data,
                coordinatorId: 'coordinatorId' in data,
                guardId: 'guardId' in data,
                isSupervisor: 'isSupervisor' in data,
              },
              hash: canonicalStringify(core),
            };
            list.push({
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              ...(data.marketerId ? { marketerId: data.marketerId } : {}),
              ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
              ...(data.guardId ? { guardId: data.guardId } : {}),
              ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
            });
          });
          if (list.length > 0) {
            callbacks.onAuthorizedUsers?.(list);
          }
          notifySyncStatus('connected', 'متصل ومزامن لحظياً مع Firebase');
          callbacks.onSyncReady?.();
        },
        (error: any) => {
          const isPermDenied = String(error?.code || error?.message || '').toLowerCase().includes('permission');
          if (isPermDenied) {
            notifySyncStatus('error', 'تعذر التحقق من صلاحيات الحساب في Firebase');
            handleFirestoreError(error, OperationType.GET, authPath);
          } else {
            notifySyncStatus('offline', 'انقطع الاتصال مؤقتاً — جاري إعادة المزامنة تلقائياً');
            console.warn('Firestore authorizedUsers transient snapshot warning:', error);
          }
        }
      )
    );
  } else {
    // 1a. Non-owner Admin listener (list queries for delegated admins)
    const adminAuthQuery = query(collection(db, 'authorizedUsers'), where('adminEmails', 'array-contains', emailNorm));
    unsubs.push(
      onSnapshot(
        adminAuthQuery,
        (snap) => {
          if (snap.empty) return;
          const list: UserAccount[] = [];
          snap.forEach((d) => {
            const data = d.data() as any;
            const cacheKey = `authorizedUsers/${d.id}`;
            const core = {
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              ...(data.marketerId ? { marketerId: data.marketerId } : {}),
              ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
              ...(data.guardId ? { guardId: data.guardId } : {}),
              ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
              adminEmails: data.adminEmails || [],
            };
            syncState.metaCache[cacheKey] = {
              existsRemotely: true,
              existingId: data.id,
              authorUid: data.authorUid,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
              optionalKeys: {
                marketerId: 'marketerId' in data,
                coordinatorId: 'coordinatorId' in data,
                guardId: 'guardId' in data,
                isSupervisor: 'isSupervisor' in data,
              },
              hash: canonicalStringify(core),
            };
            list.push({
              id: data.id,
              email: data.email,
              name: data.name,
              role: data.role,
              ...(data.marketerId ? { marketerId: data.marketerId } : {}),
              ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
              ...(data.guardId ? { guardId: data.guardId } : {}),
              ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
            });
          });
          if (list.length > 0) callbacks.onAuthorizedUsers?.(list);
          notifySyncStatus('connected', 'متصل ومزامن لحظياً مع Firebase');
          callbacks.onSyncReady?.();
        },
        () => {}
      )
    );

    // 1b. Direct real-time listener on the caller's own authorizedUsers/{email} doc so role/Supervisor promotions sync live
    unsubs.push(
      onSnapshot(
        doc(db, 'authorizedUsers', emailNorm),
        (snap) => {
          if (!snap.exists()) {
            // Do not revoke session based on an empty offline cache before server confirmation
            if (snap.metadata.fromCache) return;
            callbacks.onOwnAccountRevoked?.();
            return;
          }
          const data = snap.data() as any;
          const acc: UserAccount = {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            ...(data.marketerId ? { marketerId: data.marketerId } : {}),
            ...(data.coordinatorId ? { coordinatorId: data.coordinatorId } : {}),
            ...(data.guardId ? { guardId: data.guardId } : {}),
            ...(data.isSupervisor !== undefined ? { isSupervisor: Boolean(data.isSupervisor) } : {}),
          };
          callbacks.onOwnAccountUpdated?.(acc);
          notifySyncStatus('connected', 'متصل ومزامن لحظياً مع Firebase');
          callbacks.onSyncReady?.();
        },
        (error) => {
          notifySyncStatus('error', 'تعذر التحقق من صلاحية الحساب في Firebase');
          console.warn('Own authorizedUsers doc listener error:', error);
        }
      )
    );
  }

  // Helper to attach collection snapshot with meta caching & delete-aware empty tracking
  const attachCollectionListener = (
    colName: string,
    onItems: (records: Array<{ id: string; record: any }>) => void
  ) => {
    let hadItemsPreviously = Object.keys(syncState.metaCache).some((k) => k.startsWith(`${colName}/`));
    unsubs.push(
      onSnapshot(
        buildScopedQuery(colName),
        (snap) => {
          const items: Array<{ id: string; record: any }> = [];
          snap.forEach((d) => {
            const data = d.data() as any;
            const cacheKey = `${colName}/${d.id}`;
            const envelopeCore = {
              id: data.id,
              title: data.title,
              status: data.status,
              amount: data.amount,
              record: data.record,
              authorizedEmails: data.authorizedEmails || [],
            };
            syncState.metaCache[cacheKey] = {
              existsRemotely: true,
              authorUid: data.authorUid,
              createdAt: data.createdAt instanceof Timestamp ? data.createdAt : null,
              authorizedEmails: Array.isArray(data.authorizedEmails) ? data.authorizedEmails : [],
              remoteStatus: typeof data.status === 'string' ? data.status : undefined,
              hash: canonicalStringify(envelopeCore),
            };
            if (data.record) {
              items.push({ id: d.id, record: data.record });
            }
          });
          if (items.length > 0) {
            hadItemsPreviously = true;
            onItems(items);
          } else if (hadItemsPreviously) {
            onItems([]);
          }
          notifySyncStatus('connected', 'متصل ومزامن لحظياً مع Firebase');
        },
        (error: any) => {
          const isPermDenied = String(error?.code || error?.message || '').toLowerCase().includes('permission');
          if (isPermDenied) {
            notifySyncStatus('error', `تعذر مزامنة ${colName} في Firebase`);
            handleFirestoreError(error, OperationType.GET, colName);
          } else {
            notifySyncStatus('offline', 'انقطع الاتصال مؤقتاً — جاري إعادة المزامنة تلقائياً');
            console.warn(`Firestore ${colName} transient snapshot warning:`, error);
          }
        }
      )
    );
  };

  attachCollectionListener('bookings', (items) => {
    callbacks.onBookings?.(items.map((it) => it.record as Booking));
  });

  attachCollectionListener('properties', (items) => {
    callbacks.onProperties?.(items.map((it) => it.record as Property));
  });

  attachCollectionListener('adminFeeBoxes', (items) => {
    callbacks.onAdminFeeBoxes?.(items.map((it) => it.record as SpecialAdminFeeBox));
  });

  attachCollectionListener('staffMembers', (items) => {
    const marketers: Marketer[] = [];
    const coordinators: Coordinator[] = [];
    const guardsList: Guard[] = [];
    const staffEmails: string[] = [];
    items.forEach(({ record }) => {
      if (record.memberType === 'marketer' && record.data) {
        marketers.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      } else if (record.memberType === 'coordinator' && record.data) {
        coordinators.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      } else if (record.memberType === 'guard' && record.data) {
        guardsList.push(record.data);
        if (record.data.email) staffEmails.push(String(record.data.email).trim().toLowerCase());
      }
    });
    if (staffEmails.length > 0) {
      syncState.knownStaffEmails = Array.from(new Set([...syncState.knownStaffEmails, ...staffEmails]));
    }
    callbacks.onStaffMembers?.({ marketers, coordinators, guardsList });
  });

  attachCollectionListener('guardTasks', (items) => {
    const tasks: GuardDailyTask[] = [];
    const templates: GuardTaskTemplate[] = [];
    items.forEach(({ record }) => {
      if (record.kind === 'task' && record.data) tasks.push(record.data);
      else if (record.kind === 'template' && record.data) templates.push(record.data);
    });
    callbacks.onGuardTasks?.({ tasks, templates });
  });

  attachCollectionListener('commissionRequests', (items) => {
    callbacks.onCommissionRequests?.(items.map((it) => it.record as CommissionRequest));
  });

  attachCollectionListener('systemStates', (items) => {
    items.forEach(({ record }) => {
      if (record.stateId && record.value !== undefined) {
        callbacks.onSystemState?.(record.stateId, record.value);
      }
    });
  });

  return () => {
    unsubs.forEach((u) => {
      try {
        u();
      } catch {}
    });
  };
}

export interface PushSubscriberMeta {
  role?: string;
  email?: string;
  isAdmin?: boolean;
  isSupervisor?: boolean;
  marketerId?: string;
  guardId?: string;
  coordinatorId?: string;
  guardPropertyIds?: string[];
}

export interface PushTargetSpec {
  targetAudience?: string;
  propertyId?: string;
  targetGuardId?: string;
  targetGuardIds?: string[];
  targetMarketerId?: string;
  targetMarketerIds?: string[];
  targetCoordinatorIds?: string[];
  isSupervisorNotification?: boolean;
}

/**
 * Determines whether a subscribed device matches the target audience of a notification.
 * Mirrors the in-app notification visibility rules so background Web Push reaches the exact intended team members.
 */
export function doesPushSubscriberMatchTarget(
  subscriber: PushSubscriberMeta | undefined,
  target: PushTargetSpec | undefined
): boolean {
  if (!subscriber) return false;
  if (!target) return true;

  const audience = target.targetAudience || 'all';
  const role = subscriber.role || '';
  const isAdmin = Boolean(subscriber.isAdmin || role === 'admin');
  const isGuard = role === 'guard';
  const isMarketer = role === 'marketer';
  const isCoordinator = role === 'coordinator';
  const isSupervisor = Boolean(subscriber.isSupervisor);

  // Admins always receive operational & admin-targeted alerts
  if (audience === 'admin_only') {
    return isAdmin;
  }

  if (audience === 'admin_and_guard') {
    if (isAdmin) return true;
    if (!isGuard) return false;
    if (target.targetGuardIds && target.targetGuardIds.length > 0) {
      return Boolean(subscriber.guardId && target.targetGuardIds.includes(subscriber.guardId));
    }
    if (target.targetGuardId) {
      return subscriber.guardId === target.targetGuardId;
    }
    if (target.propertyId && Array.isArray(subscriber.guardPropertyIds) && subscriber.guardPropertyIds.length > 0) {
      return subscriber.guardPropertyIds.includes(target.propertyId);
    }
    return true;
  }

  if (audience === 'guards') {
    if (!isGuard) return isAdmin;
    if (target.targetGuardIds && target.targetGuardIds.length > 0) {
      return Boolean(subscriber.guardId && target.targetGuardIds.includes(subscriber.guardId));
    }
    if (target.targetGuardId) {
      return subscriber.guardId === target.targetGuardId;
    }
    if (target.propertyId && Array.isArray(subscriber.guardPropertyIds) && subscriber.guardPropertyIds.length > 0) {
      return subscriber.guardPropertyIds.includes(target.propertyId);
    }
    return true;
  }

  if (audience === 'marketers' || audience === 'marketer') {
    if (isAdmin) return true;
    if (!isMarketer) return false;
    if (target.targetMarketerIds && target.targetMarketerIds.length > 0) {
      return Boolean(subscriber.marketerId && target.targetMarketerIds.includes(subscriber.marketerId));
    }
    if (target.targetMarketerId) {
      return subscriber.marketerId === target.targetMarketerId;
    }
    return true;
  }

  if (audience === 'coordinators') {
    if (isAdmin) return true;
    if (!isCoordinator) return false;
    if (target.targetCoordinatorIds && target.targetCoordinatorIds.length > 0) {
      return Boolean(subscriber.coordinatorId && target.targetCoordinatorIds.includes(subscriber.coordinatorId));
    }
    return true;
  }

  if (target.isSupervisorNotification) {
    return isAdmin || isSupervisor;
  }

  // 'all': check explicit ID filters if specified
  if (target.targetMarketerId && isMarketer && subscriber.marketerId !== target.targetMarketerId) {
    return false;
  }
  if (target.targetGuardId && isGuard && subscriber.guardId !== target.targetGuardId) {
    return false;
  }

  return true;
}

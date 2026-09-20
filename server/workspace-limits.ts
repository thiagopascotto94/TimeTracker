import { Workspace, Subscription, Plan, Tenant } from './db';

export interface WorkspaceLockStatus {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  order_index: number;
  is_locked: boolean;
  lock_reason: string | null;
}

export interface TenantWorkspaceLockInfo {
  tenantId: string;
  planId: string;
  planName: string;
  maxWorkspaces: number; // 1 for Free, -1 for Pro/Team
  totalWorkspaces: number;
  workspaces: WorkspaceLockStatus[];
  unlockedWorkspaceIds: string[];
  lockedWorkspaceIds: string[];
  firstUnlockedWorkspaceId: string | null;
}

/**
 * Returns lock status for all workspaces of a tenant based on their active plan.
 * Rule:
 * - Pro / Team (max_workspaces = -1): All workspaces are unlocked.
 * - Free (max_workspaces = 1): Only the 1st workspace (by created_at ASC) is unlocked.
 *   Workspaces from the 2nd onward (index >= 1) are locked for access and editing.
 */
export async function getTenantWorkspaceLockInfo(tenantId: string): Promise<TenantWorkspaceLockInfo> {
  // 1. Fetch active subscription & plan for tenant
  const [sub, tenant] = await Promise.all([
    Subscription.findOne({
      where: { tenant_id: tenantId, status: 'active' },
      include: [{ model: Plan, as: 'Plan' }],
      order: [['created_at', 'DESC']],
    }),
    Tenant.findByPk(tenantId),
  ]);

  let planId = sub?.Plan?.id || tenant?.plan_id || 'free';
  let planName = sub?.Plan?.name || (planId === 'free' ? 'Free' : planId === 'pro' ? 'Pro' : 'Team');
  let maxWorkspaces = sub?.Plan?.max_workspaces ?? (planId === 'free' ? 1 : -1);

  // If sub has no plan object loaded, load plan directly
  if (!sub?.Plan && planId) {
    const planObj = await Plan.findByPk(planId);
    if (planObj) {
      planName = planObj.name;
      maxWorkspaces = planObj.max_workspaces ?? (planId === 'free' ? 1 : -1);
    }
  }

  // 2. Fetch all workspaces of this tenant ordered chronologically (first created is first)
  const allWorkspaces = await Workspace.findAll({
    where: { tenant_id: tenantId },
    order: [
      ['created_at', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  const workspaces: WorkspaceLockStatus[] = allWorkspaces.map((ws, index) => {
    // If maxWorkspaces is -1 (unlimited), none are locked.
    // If maxWorkspaces > 0 (e.g. 1 in Free), index 0 is unlocked, index >= 1 is locked.
    const isLocked = maxWorkspaces !== -1 && index >= maxWorkspaces;
    const lockReason = isLocked
      ? `Este workspace está bloqueado porque o plano ${planName} permite apenas ${maxWorkspaces} workspace${maxWorkspaces === 1 ? '' : 's'}. Apenas o primeiro workspace está liberado para acesso e qualquer tipo de edição. Faça upgrade para o plano Pro para desbloquear.`
      : null;

    return {
      id: ws.id,
      name: ws.name,
      description: ws.description,
      created_at: ws.created_at,
      order_index: index,
      is_locked: isLocked,
      lock_reason: lockReason,
    };
  });

  const unlockedWorkspaceIds = workspaces.filter((w) => !w.is_locked).map((w) => w.id);
  const lockedWorkspaceIds = workspaces.filter((w) => w.is_locked).map((w) => w.id);
  const firstUnlockedWorkspaceId = unlockedWorkspaceIds[0] || (allWorkspaces[0]?.id ?? null);

  return {
    tenantId,
    planId,
    planName,
    maxWorkspaces,
    totalWorkspaces: workspaces.length,
    workspaces,
    unlockedWorkspaceIds,
    lockedWorkspaceIds,
    firstUnlockedWorkspaceId,
  };
}

/**
 * Checks if a specific workspace is locked for access or editing under the tenant's current plan.
 */
export async function isWorkspaceLocked(
  workspaceId: string,
  tenantId: string
): Promise<{
  isLocked: boolean;
  reason: string | null;
  firstUnlockedId: string | null;
  planName: string;
  maxWorkspaces: number;
}> {
  const lockInfo = await getTenantWorkspaceLockInfo(tenantId);
  const target = lockInfo.workspaces.find((w) => w.id === workspaceId);

  if (!target) {
    return {
      isLocked: false,
      reason: null,
      firstUnlockedId: lockInfo.firstUnlockedWorkspaceId,
      planName: lockInfo.planName,
      maxWorkspaces: lockInfo.maxWorkspaces,
    };
  }

  return {
    isLocked: target.is_locked,
    reason: target.lock_reason,
    firstUnlockedId: lockInfo.firstUnlockedWorkspaceId,
    planName: lockInfo.planName,
    maxWorkspaces: lockInfo.maxWorkspaces,
  };
}

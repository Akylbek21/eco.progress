export type MembershipStatus = 'ACTIVE' | 'INACTIVE';

export interface CompanyMembership {
  id: number;
  userId: number;
  fullName: string;
  email?: string;
  role: string;
  status: MembershipStatus;
  availableActions: Record<string, boolean>;
}

export interface MembershipList {
  items: CompanyMembership[];
  availableActions: Record<string, boolean>;
}

export interface CreateMembershipRequest {
  userId: number;
  role: string;
  status: MembershipStatus;
}

export interface UpdateMembershipRequest {
  role: string;
  status: MembershipStatus;
}

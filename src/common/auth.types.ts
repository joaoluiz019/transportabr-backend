export interface AuthUser {
  id: string;
  email: string;
  role: 'admin' | 'driver';
}

export interface TenantContext {
  companyId: string | null; // empresa do usuário (por owner_email ou pelo Driver)
  driverId: string | null; // preenchido quando o usuário é um motorista
  isOwner: boolean; // true quando é dono da empresa (admin)
}

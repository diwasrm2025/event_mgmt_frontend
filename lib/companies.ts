import { apiRequest } from './api';

export interface CompanyAdmin {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: {
    id: string;
    name: string;
  };
  company?: {
    id: string;
    name: string;
    slug: string;
  };
  eventsCount: number;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  memberCount: number;
  eventCount: number;
  admins: Array<{
    id: string;
    name: string;
    email: string;
    role: { id: string; name: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function listCompanies(): Promise<Company[]> {
  return apiRequest<Company[]>('/companies');
}

export async function listCompanyAdmins(): Promise<CompanyAdmin[]> {
  return apiRequest<CompanyAdmin[]>('/companies/admins');
}

export async function createCompany(input: {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
}): Promise<Company> {
  return apiRequest<Company>('/companies', {
    method: 'POST',
    body: input,
  });
}

export async function updateCompany(
  id: string,
  input: {
    name?: string;
    description?: string;
    website?: string;
    logoUrl?: string;
  },
): Promise<Company> {
  return apiRequest<Company>(`/companies/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function deleteCompany(id: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/companies/${id}`, {
    method: 'DELETE',
  });
}

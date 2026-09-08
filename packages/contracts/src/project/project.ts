export type ProjectStatus = 'planning' | 'active' | 'suspended' | 'completed';

export interface ProjectDto {
  id: string;
  clientId: string;
  clientName?: string;
  code: string;
  name: string;
  siteLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDto {
  clientId: string;
  code: string;
  name: string;
  siteLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
}

export interface UpdateProjectDto {
  clientId?: string;
  code?: string;
  name?: string;
  siteLocation?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
}

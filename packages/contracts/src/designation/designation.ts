export interface DesignationDto {
  id: string;
  code: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesignationDto {
  code: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateDesignationDto {
  code?: string;
  title?: string;
  description?: string | null;
  isActive?: boolean;
}

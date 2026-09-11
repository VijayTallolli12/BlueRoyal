export interface ClientDto {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  code: string;
  name: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive?: boolean;
}

export interface UpdateClientDto {
  code?: string;
  name?: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive?: boolean;
}

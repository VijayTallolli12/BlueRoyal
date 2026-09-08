export interface WeeklyOffConfigDto {
  id: string;
  name: string;
  daysOfWeek: number[]; // 0 = Sunday, 6 = Saturday
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWeeklyOffConfigDto {
  name: string;
  daysOfWeek: number[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  isDefault?: boolean;
}

export interface UpdateWeeklyOffConfigDto {
  name?: string;
  daysOfWeek?: number[];
  effectiveTo?: string | null;
  isDefault?: boolean;
}

export interface PublicHolidayDto {
  id: string;
  calendarYear: number;
  name: string;
  holidayDate: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePublicHolidayDto {
  calendarYear: number;
  name: string;
  holidayDate: string;
  description?: string | null;
}

export interface UpdatePublicHolidayDto {
  calendarYear?: number;
  name?: string;
  holidayDate?: string;
  description?: string | null;
}

import { Role, Gender, MaritalStatus, EmploymentStatus, EmploymentType, AttendanceStatus, LeaveStatus, PayrollStatus, CorrectionStatus, AnnouncementType, Priority, HolidayType, DeductionType } from '@prisma/client';

// Re-export Prisma enums
export { Role, Gender, MaritalStatus, EmploymentStatus, EmploymentType, AttendanceStatus, LeaveStatus, PayrollStatus, CorrectionStatus, AnnouncementType, Priority, HolidayType, DeductionType };

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth types
export interface LoginRequest {
  identifier: string; // email, employeeId, or hrId
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    employeeId: string;
    email: string;
    role: Role;
    name: string;
  };
}

export interface RegisterRequest {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Employee types
export interface CreateEmployeeRequest {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  bloodGroup?: string;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  departmentId?: string;
  designationId?: string;
  shiftId?: string;
  reportingManagerId?: string;
  joiningDate?: string;
  attendanceStartDate?: string;
  employmentType?: EmploymentType;
  role?: Role;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  employmentStatus?: EmploymentStatus;
  confirmationDate?: string;
  resignationDate?: string;
  relievingDate?: string;
  profileImage?: string;
}

// Attendance types
export interface CheckInRequest {
  notes?: string;
}

export interface CheckOutRequest {
  notes?: string;
}

export interface AttendanceCorrectionRequest {
  date: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
}

export interface AttendanceFilter {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
}

// Leave types
export interface LeaveRequestCreate {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface LeaveApprovalRequest {
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

// Salary types
export interface AssignSalaryRequest {
  employeeId: string;
  basicSalary: number;
  hra?: number;
  da?: number;
  ta?: number;
  medicalAllowance?: number;
  otherAllowances?: number;
  pf?: number;
  esi?: number;
  professionalTax?: number;
  tds?: number;
  otherDeductions?: number;
  effectiveFrom: string;
}

// Payroll types
export interface GeneratePayrollRequest {
  month: number;
  year: number;
  employeeIds?: string[]; // If empty, generate for all employees
}

// Department types
export interface CreateDepartmentRequest {
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  headId?: string;
}

// Designation types
export interface CreateDesignationRequest {
  name: string;
  code: string;
  description?: string;
  departmentId?: string;
  level?: number;
}

// Shift types
export interface CreateShiftRequest {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakDuration?: number;
  graceTime?: number;
}

// Tax Slab types
export interface CreateTaxSlabRequest {
  name: string;
  minIncome: number;
  maxIncome?: number;
  taxRate: number;
  year: number;
}

// Late Rule types
export interface CreateLateRuleRequest {
  name: string;
  minLateCount: number;
  maxLateCount?: number;
  deductionType: DeductionType;
  deductionValue: number;
  description?: string;
}

// Announcement types
export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  type?: AnnouncementType;
  priority?: Priority;
  publishDate: string;
  expiryDate?: string;
}

// Leave Type types
export interface CreateLeaveTypeRequest {
  name: string;
  code: string;
  description?: string;
  defaultDays: number;
  isCarryForward?: boolean;
  maxCarryForward?: number;
  isPaid?: boolean;
}

// Holiday types
export interface CreateHolidayRequest {
  name: string;
  date: string;
  type?: HolidayType;
  isOptional?: boolean;
  description?: string;
  year: number;
}

// Dashboard types
export interface EmployeeDashboard {
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    department: string;
    designation: string;
    profileImage?: string;
  };
  todayAttendance: {
    checkIn?: string;
    checkOut?: string;
    status: AttendanceStatus;
    workHours?: number;
    isOnBreak: boolean;
  };
  leaveBalance: Array<{
    leaveType: string;
    totalDays: number;
    usedDays: number;
    remainingDays: number;
  }>;
  pendingRequests: {
    leaveRequests: number;
    correctionRequests: number;
  };
  recentAttendance: Array<{
    date: string;
    checkIn?: string;
    checkOut?: string;
    status: AttendanceStatus;
  }>;
  upcomingHolidays: Array<{
    name: string;
    date: string;
    type: HolidayType;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    publishDate: string;
    priority: Priority;
  }>;
}

export interface AdminDashboard {
  stats: {
    totalEmployees: number;
    activeEmployees: number;
    onLeaveToday: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
  };
  pendingApprovals: {
    leaveRequests: number;
    correctionRequests: number;
  };
  departmentStats: Array<{
    department: string;
    totalEmployees: number;
    presentToday: number;
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    description: string;
    user: string;
    timestamp: string;
  }>;
  upcomingBirthdays: Array<{
    name: string;
    date: string;
    department: string;
  }>;
}

// Organization tree
export interface OrgTreeNode {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  profileImage?: string;
  subordinates: OrgTreeNode[];
}

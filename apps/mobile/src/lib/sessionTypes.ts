export type CustomerUser = {
  kind: 'customer';
  id: number;
  name: string;
  email: string;
  type: 'WHOLESALE' | 'RETAIL';
  contact: string | null;
};

export type StaffUser = {
  kind: 'staff';
  id: number;
  name: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
};

export type SessionUser = CustomerUser | StaffUser;

export type SessionState = {
  token: string | null;
  user: SessionUser | null;
};

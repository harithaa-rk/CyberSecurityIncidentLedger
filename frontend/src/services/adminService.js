import API from "./api";

/** Fetch 10 card statistics */
export const getAdminStats = async () => {
  const response = await API.get("/admin/stats");
  return response.data;
};

/** Fetch chart data (Daily, Monthly, Severity, Attack Types, Upload Trend) */
export const getDashboardCharts = async () => {
  const response = await API.get("/admin/charts");
  return response.data;
};

/** Fetch widget data (Recent Activities, Latest Logs, Latest Users, Latest Transactions) */
export const getDashboardWidgets = async () => {
  const response = await API.get("/admin/widgets");
  return response.data;
};

/** Fetch all users (paginated, searchable, filterable) */
export const getAllUsers = async (page = 1, limit = 10, search = "", role = "All", status = "All") => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.append("search", search);
  if (role && role !== "All") params.append("role", role);
  if (status && status !== "All") params.append("status", status);

  const response = await API.get(`/admin/users?${params.toString()}`);
  return response.data;
};

/** Create a new user */
export const createUser = async (userData) => {
  const response = await API.post("/admin/users", userData);
  return response.data;
};

/** Update user profile (Name, Email, Organization) */
export const updateUser = async (userId, userData) => {
  const response = await API.patch(`/admin/users/${userId}`, userData);
  return response.data;
};

/** Assign role to user */
export const assignUserRole = async (userId, role) => {
  const response = await API.patch(`/admin/users/${userId}/role`, { role });
  return response.data;
};

/** Reset password for user */
export const resetUserPassword = async (userId, newPassword) => {
  const response = await API.patch(`/admin/users/${userId}/reset-password`, { newPassword });
  return response.data;
};

/** Toggle a user's active status */
export const toggleUserActive = async (userId) => {
  const response = await API.patch(`/admin/users/${userId}/toggle-active`);
  return response.data;
};

/** Delete a user */
export const deleteUser = async (userId) => {
  const response = await API.delete(`/admin/users/${userId}`);
  return response.data;
};

// ─── Organization Management ───────────────────────────────

/** Fetch all organizations (paginated, searchable, filterable by status & type) */
export const getAllOrganizations = async (page = 1, limit = 10, search = "", status = "All", type = "All") => {
  const params = new URLSearchParams({ page, limit });
  if (search) params.append("search", search);
  if (status && status !== "All") params.append("status", status);
  if (type && type !== "All") params.append("type", type);
  const response = await API.get(`/admin/organizations?${params.toString()}`);
  return response.data;
};

/** Fetch single organization by ID with statistics */
export const getOrganizationById = async (orgId) => {
  const response = await API.get(`/admin/organizations/${orgId}`);
  return response.data;
};

/** Create a new organization */
export const createOrganization = async (data) => {
  const response = await API.post("/admin/organizations", data);
  return response.data;
};

/** Update an organization */
export const updateOrganization = async (orgId, data) => {
  const response = await API.put(`/admin/organizations/${orgId}`, data);
  return response.data;
};

/** Toggle organization status (Active/Inactive) */
export const toggleOrganizationStatus = async (orgId, status) => {
  const response = await API.patch(`/admin/organizations/${orgId}/status`, { status });
  return response.data;
};

/** Delete an organization */
export const deleteOrganization = async (orgId) => {
  const response = await API.delete(`/admin/organizations/${orgId}`);
  return response.data;
};

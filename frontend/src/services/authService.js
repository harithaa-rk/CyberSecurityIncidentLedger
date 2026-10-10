import API from "./api";

/**
 * Register a new user
 * @param {{ name: string, email: string, password: string, confirmPassword: string, role: string }} data
 */
export const registerUser = async (data) => {
  const response = await API.post("/auth/register", data);
  return response.data;
};

/**
 * Login a user
 * @param {{ email: string, password: string }} data
 */
export const loginUser = async (data) => {
  const response = await API.post("/auth/login", data);
  return response.data;
};

/**
 * Get the currently authenticated user profile
 */
export const getMe = async () => {
  const response = await API.get("/auth/me");
  return response.data;
};

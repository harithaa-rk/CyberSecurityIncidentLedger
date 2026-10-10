const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth");
const {
  getStats,
  getCharts,
  getWidgets,
  getAllUsers,
  createUser,
  updateUser,
  assignRole,
  resetPassword,
  toggleUserActive,
  deleteUser,
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  toggleOrganizationStatus,
  deleteOrganization,
} = require("../controllers/adminController");

const {
  upload,
  uploadSecurityLogs,
  getAllLogsAdmin,
  getLogDetailsAdmin,
  verifyLogIntegrityAdmin,
  downloadLogAdmin,
  deleteLogMetadataAdmin,
} = require("../controllers/securityLogManagementController");

// All admin routes require a valid JWT + Admin role
router.use(verifyToken);
router.use(requireRole("Admin"));

router.get("/stats",                     getStats);
router.get("/charts",                    getCharts);
router.get("/widgets",                   getWidgets);

// User Management Routes
router.get("/users",                     getAllUsers);
router.post("/users",                    createUser);
router.patch("/users/:id",               updateUser);
router.patch("/users/:id/role",          assignRole);
router.patch("/users/:id/reset-password", resetPassword);
router.patch("/users/:id/toggle-active",  toggleUserActive);
router.delete("/users/:id",              deleteUser);

// Organization Management Routes
router.get("/organizations",                     getAllOrganizations);
router.get("/organizations/:id",                 getOrganizationById);
router.post("/organizations",                    createOrganization);
router.put("/organizations/:id",                 updateOrganization);
router.delete("/organizations/:id",              deleteOrganization);
router.patch("/organizations/:id/status",        toggleOrganizationStatus);

// Security Log Management Routes
router.post("/logs/upload",                      upload.single("file"), uploadSecurityLogs);
router.get("/logs",                              getAllLogsAdmin);
router.get("/logs/:id",                          getLogDetailsAdmin);
router.patch("/logs/:id/verify",                 verifyLogIntegrityAdmin);
router.get("/logs/:id/download",                 downloadLogAdmin);
router.delete("/logs/:id",                       deleteLogMetadataAdmin);

module.exports = router;

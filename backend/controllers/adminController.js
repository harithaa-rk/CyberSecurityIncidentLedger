const User = require("../models/User");
const Organization = require("../models/Organization");
const SecurityLog = require("../models/SecurityLog");
const BlockchainTransaction = require("../models/BlockchainTransaction");
const ActivityLog = require("../models/ActivityLog");
const bcrypt = require("bcrypt");

// ─────────────────────────────────────────────
// @route   GET /api/admin/stats
// @desc    Get all 10 card statistics from MongoDB
// @access  Admin only
// ─────────────────────────────────────────────
const getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalOrgs,
      totalLogs,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      verifiedCount,
      tamperedCount,
      blockchainCount,
      byRole,
      lockedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      Organization.countDocuments(),
      SecurityLog.countDocuments(),
      SecurityLog.countDocuments({ severity: "Critical" }),
      SecurityLog.countDocuments({ severity: "High" }),
      SecurityLog.countDocuments({ severity: "Medium" }),
      SecurityLog.countDocuments({ severity: "Low" }),
      SecurityLog.countDocuments({ status: "Verified" }),
      SecurityLog.countDocuments({ status: "Tampered" }),
      BlockchainTransaction.countDocuments(),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
    ]);

    // Shape role counts from aggregation result
    const roleCounts = { Admin: 0, Analyst: 0, Auditor: 0, User: 0 };
    byRole.forEach(({ _id, count }) => {
      if (_id in roleCounts) roleCounts[_id] = count;
    });

    res.status(200).json({
      stats: {
        totalUsers,
        totalOrganizations: totalOrgs,
        totalLogs,
        criticalIncidents: criticalCount,
        highIncidents: highCount,
        mediumIncidents: mediumCount,
        lowIncidents: lowCount,
        verifiedLogs: verifiedCount,
        tamperedLogs: tamperedCount,
        blockchainTransactions: blockchainCount,
        lockedAccounts: lockedUsers,
        ...roleCounts,
      },
    });
  } catch (error) {
    console.error("Admin getStats error:", error);
    res.status(500).json({ message: "Server error fetching stats." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/charts
// @desc    All chart data aggregated from MongoDB
// @access  Admin only
// ─────────────────────────────────────────────
const getCharts = async (req, res) => {
  try {
    // ── 1. Daily Incidents: group SecurityLogs by day-of-week for last 7 days ──
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyRaw = await SecurityLog.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day:   { $dayOfMonth: "$createdAt" },
          },
          incidents: { $sum: 1 },
          critical:  { $sum: { $cond: [{ $eq: ["$severity", "Critical"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Build a full 7-day map (fill missing days with 0)
    const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyIncidents = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
      const match = dailyRaw.find(
        (r) => r._id.year === y && r._id.month === m && r._id.day === day
      );
      dailyIncidents.push({
        day: DAY_NAMES[d.getDay()],
        date: `${day}/${m}`,
        incidents: match ? match.incidents : 0,
        critical: match ? match.critical : 0,
      });
    }

    // ── 2. Monthly Incidents: last 6 calendar months ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRaw = await SecurityLog.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year:  { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyIncidents = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const match = monthlyRaw.find((r) => r._id.year === y && r._id.month === m);
      monthlyIncidents.push({
        month: MONTH_NAMES[m - 1],
        year: y,
        count: match ? match.count : 0,
      });
    }

    // ── 3. Severity Distribution: real counts from DB ──
    const severityAgg = await SecurityLog.aggregate([
      { $group: { _id: "$severity", value: { $sum: 1 } } },
    ]);

    const SEVERITY_COLORS = {
      Critical: "#ef4444",
      High:     "#f97316",
      Medium:   "#eab308",
      Low:      "#22c55e",
    };

    // Preserve order: Critical → High → Medium → Low
    const severityDistribution = ["Critical", "High", "Medium", "Low"].map((name) => {
      const found = severityAgg.find((s) => s._id === name);
      return { name, value: found ? found.value : 0, color: SEVERITY_COLORS[name] };
    });

    // ── 4. Attack Types: aggregate by attackType field ──
    const attackAgg = await SecurityLog.aggregate([
      { $group: { _id: "$attackType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 7 },
    ]);

    const totalAttacks = attackAgg.reduce((acc, a) => acc + a.count, 0) || 1;
    const attackTypes = attackAgg.map((a) => ({
      type: a._id,
      count: a.count,
      percentage: Math.round((a.count / totalAttacks) * 100),
    }));

    // ── 5. Upload Trend: logs created per hour-slot today ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const uploadRaw = await SecurityLog.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      {
        $group: {
          _id: { $floor: { $divide: [{ $hour: "$createdAt" }, 4] } }, // 4-hour buckets: 0,1,2,3,4,5
          rate: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const TIME_SLOTS = ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"];
    const uploadTrend = TIME_SLOTS.map((time, i) => {
      const match = uploadRaw.find((r) => r._id === i);
      return { time, rate: match ? match.rate : 0 };
    });

    res.status(200).json({
      dailyIncidents,
      monthlyIncidents,
      severityDistribution,
      attackTypes,
      uploadTrend,
    });
  } catch (error) {
    console.error("Admin getCharts error:", error);
    res.status(500).json({ message: "Server error fetching chart data." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/widgets
// @desc    Live widget data — all from MongoDB, no fallbacks
// @access  Admin only
// ─────────────────────────────────────────────
const getWidgets = async (req, res) => {
  try {
    const [recentActivities, latestLogs, latestUsers, latestTransactions] = await Promise.all([
      ActivityLog.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      SecurityLog.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .lean(),
      User.find()
        .select("-password -loginAttempts -lockUntil")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      BlockchainTransaction.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.status(200).json({
      recentActivities,
      latestLogs,
      latestUsers,
      latestTransactions,
    });
  } catch (error) {
    console.error("Admin getWidgets error:", error);
    res.status(500).json({ message: "Server error fetching widget data." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/users
// @desc    Get all users (paginated, searchable, filterable)
// @access  Admin only
// ─────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;
    const { search, role, status } = req.query;

    const filter = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { email: regex },
      ];
    }

    if (role && role !== "All") {
      filter.role = role;
    }

    if (status && status !== "All") {
      filter.isActive = status === "Active";
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .populate("organization", "name code type status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Admin getAllUsers error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/admin/users
// @desc    Create a new user
// @access  Admin only
// ─────────────────────────────────────────────
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, organization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "User",
      organization: organization || null,
      isActive: true,
    });

    const userObj = newUser.toObject();
    delete userObj.password;

    res.status(201).json({
      message: "User created successfully.",
      user: userObj,
    });
  } catch (error) {
    console.error("Admin createUser error:", error);
    res.status(500).json({ message: "Server error creating user." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/users/:id
// @desc    Update user profile (Name, Email, Organization)
// @access  Admin only
// ─────────────────────────────────────────────
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, organization } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (email && email.toLowerCase().trim() !== user.email) {
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Please provide a valid email address." });
      }
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({ message: "Email is already taken by another account." });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name) user.name = name.trim();
    if (organization !== undefined) user.organization = organization || null;

    await user.save();

    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      message: "User details updated successfully.",
      user: userObj,
    });
  } catch (error) {
    console.error("Admin updateUser error:", error);
    res.status(500).json({ message: "Server error updating user." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/users/:id/role
// @desc    Assign new role to a user
// @access  Admin only
// ─────────────────────────────────────────────
const assignRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ["Admin", "Analyst", "Auditor", "User"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role specified." });
    }

    if (id === req.user.id && role !== "Admin") {
      return res.status(400).json({ message: "You cannot demote your own Admin role." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.role = role;
    await user.save();

    res.status(200).json({
      message: `Role for ${user.name} changed to ${role}.`,
      role: user.role,
    });
  } catch (error) {
    console.error("Admin assignRole error:", error);
    res.status(500).json({ message: "Server error assigning role." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/users/:id/reset-password
// @desc    Reset user password
// @access  Admin only
// ─────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.password = await bcrypt.hash(newPassword, 12);
    user.loginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    res.status(200).json({ message: `Password for ${user.name} reset successfully.` });
  } catch (error) {
    console.error("Admin resetPassword error:", error);
    res.status(500).json({ message: "Server error resetting password." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/users/:id/toggle-active
// @desc    Activate or deactivate a user account
// @access  Admin only
// ─────────────────────────────────────────────
const toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      message: `User ${user.isActive ? "activated" : "deactivated"} successfully.`,
      isActive: user.isActive,
    });
  } catch (error) {
    console.error("Admin toggleUserActive error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/admin/users/:id
// @desc    Delete a user account
// @access  Admin only
// ─────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found." });
    if (user.role === "Admin") {
      return res.status(403).json({ message: "Cannot delete another Admin account." });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Admin deleteUser error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/organizations
// @desc    Get all organizations (paginated, searchable, filterable by status & type)
// @access  Admin only
// ─────────────────────────────────────────────
const getAllOrganizations = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;
    const { search, status, type } = req.query;

    const filter = {};

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: regex },
        { code: regex },
        { contactPerson: regex },
        { contactEmail: regex },
        { phone: regex },
        { sector: regex },
        { type: regex },
      ];
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (type && type !== "All") {
      filter.type = type;
    }

    const [organizations, total] = await Promise.all([
      Organization.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Organization.countDocuments(filter),
    ]);

    // Enrich each org with user count
    const orgIds = organizations.map((o) => o._id);
    const userCounts = await User.aggregate([
      { $match: { organization: { $in: orgIds } } },
      { $group: { _id: "$organization", count: { $sum: 1 } } },
    ]);
    const userCountMap = {};
    userCounts.forEach(({ _id, count }) => {
      userCountMap[_id.toString()] = count;
    });

    const enrichedOrgs = organizations.map((org) => ({
      ...org,
      totalUsers: userCountMap[org._id.toString()] || 0,
    }));

    res.status(200).json({
      organizations: enrichedOrgs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Admin getAllOrganizations error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// @route   GET /api/admin/organizations/:id
// @desc    Get single organization with statistics
// @access  Admin only
// ─────────────────────────────────────────────
const getOrganizationById = async (req, res) => {
  try {
    const { id } = req.params;

    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ message: "Organization not found." });

    // Compute statistics for this organization
    const [totalUsers, activeUsers, totalSecurityLogs, criticalIncidents] =
      await Promise.all([
        User.countDocuments({ organization: org._id }),
        User.countDocuments({ organization: org._id, isActive: true }),
        SecurityLog.countDocuments({ organization: org.name }),
        SecurityLog.countDocuments({
          organization: org.name,
          severity: "Critical",
        }),
      ]);

    res.status(200).json({
      organization: {
        ...org,
        stats: {
          totalUsers,
          activeUsers,
          totalSecurityLogs,
          criticalIncidents,
        },
      },
    });
  } catch (error) {
    console.error("Admin getOrganizationById error:", error);
    res.status(500).json({ message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// @route   POST /api/admin/organizations
// @desc    Create a new organization
// @access  Admin only
// ─────────────────────────────────────────────
const createOrganization = async (req, res) => {
  try {
    const { name, code, contactPerson, contactEmail, phone, address, sector, type, status } = req.body;

    if (!name || !contactEmail) {
      return res.status(400).json({ message: "Organization name and contact email are required." });
    }

    const existingName = await Organization.findOne({ name: name.trim() });
    if (existingName) {
      return res.status(409).json({ message: "An organization with this name already exists." });
    }

    // Auto-generate code if not supplied
    let orgCode = code ? code.trim().toUpperCase() : name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 4);
    if (!orgCode) orgCode = "ORG";

    const existingCode = await Organization.findOne({ code: orgCode });
    if (existingCode) {
      orgCode = `${orgCode}${Math.floor(Math.random() * 90 + 10)}`;
    }

    const newOrg = await Organization.create({
      name: name.trim(),
      code: orgCode,
      contactPerson: contactPerson ? contactPerson.trim() : "",
      contactEmail: contactEmail.toLowerCase().trim(),
      phone: phone ? phone.trim() : "",
      address: address ? address.trim() : "",
      sector: sector ? sector.trim() : "Cybersecurity",
      type: type || "Private",
      status: status || "Active",
    });

    res.status(201).json({
      message: "Organization created successfully.",
      organization: newOrg,
    });
  } catch (error) {
    console.error("Admin createOrganization error:", error);
    res.status(500).json({ message: "Server error creating organization." });
  }
};

// ─────────────────────────────────────────────
// @route   PUT /api/admin/organizations/:id
// @desc    Update organization details
// @access  Admin only
// ─────────────────────────────────────────────
const updateOrganization = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, contactPerson, contactEmail, phone, address, sector, type, status } = req.body;

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: "Organization not found." });

    if (name && name.trim() !== org.name) {
      const existing = await Organization.findOne({ name: name.trim() });
      if (existing) {
        return res.status(409).json({ message: "An organization with this name already exists." });
      }
      org.name = name.trim();
    }

    if (code && code.trim().toUpperCase() !== org.code) {
      const existingCode = await Organization.findOne({ code: code.trim().toUpperCase() });
      if (existingCode) {
        return res.status(409).json({ message: "Organization code is already in use." });
      }
      org.code = code.trim().toUpperCase();
    }

    if (contactPerson !== undefined) org.contactPerson = contactPerson.trim();
    if (contactEmail !== undefined) org.contactEmail = contactEmail.toLowerCase().trim();
    if (phone !== undefined) org.phone = phone.trim();
    if (address !== undefined) org.address = address.trim();
    if (sector !== undefined) org.sector = sector.trim();
    if (type !== undefined) org.type = type;
    if (status !== undefined) org.status = status;

    await org.save();

    res.status(200).json({
      message: "Organization updated successfully.",
      organization: org,
    });
  } catch (error) {
    console.error("Admin updateOrganization error:", error);
    res.status(500).json({ message: "Server error updating organization." });
  }
};

// ─────────────────────────────────────────────
// @route   PATCH /api/admin/organizations/:id/status
// @desc    Toggle organization status (Activate / Deactivate)
// @access  Admin only
// ─────────────────────────────────────────────
const toggleOrganizationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["Active", "Inactive", "Pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be Active, Inactive, or Pending." });
    }

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: "Organization not found." });

    org.status = status;
    await org.save();

    res.status(200).json({
      message: `Organization status changed to ${status}.`,
      organization: org,
    });
  } catch (error) {
    console.error("Admin toggleOrganizationStatus error:", error);
    res.status(500).json({ message: "Server error updating organization status." });
  }
};

// ─────────────────────────────────────────────
// @route   DELETE /api/admin/organizations/:id
// @desc    Delete an organization (unlinks users)
// @access  Admin only
// ─────────────────────────────────────────────
const deleteOrganization = async (req, res) => {
  try {
    const { id } = req.params;

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: "Organization not found." });

    // Unlink any users assigned to this organization
    await User.updateMany({ organization: org._id }, { $set: { organization: null } });

    await Organization.findByIdAndDelete(id);

    res.status(200).json({ message: "Organization deleted successfully." });
  } catch (error) {
    console.error("Admin deleteOrganization error:", error);
    res.status(500).json({ message: "Server error deleting organization." });
  }
};

module.exports = {
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
};


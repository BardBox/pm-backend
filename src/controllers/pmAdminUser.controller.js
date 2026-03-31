import { PmAdminUser } from "../models/pmAdminUser.model.js";

// POST /pm/admin-users/auth
export const authAdminUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await PmAdminUser.findOne({ email, isActive: true });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        permissions: user.permissions,
        dashboardWidgets: user.dashboardWidgets ?? null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /pm/admin-users
export const listAdminUsers = async (req, res) => {
  try {
    const users = await PmAdminUser.find({}, "-password").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/admin-users
export const createAdminUser = async (req, res) => {
  try {
    const { name, email, password, permissions, isActive, dashboardWidgets } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    const existing = await PmAdminUser.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: "A user with this email already exists" });
    }

    const user = await PmAdminUser.create({ name, email, password, permissions, isActive, dashboardWidgets });
    const { password: _, ...userData } = user.toObject();
    return res.status(201).json({ success: true, data: userData });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /pm/admin-users/:id
export const getAdminUser = async (req, res) => {
  try {
    const user = await PmAdminUser.findById(req.params.id, "-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /pm/admin-users/:id
export const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, password, isActive, permissions, dashboardWidgets } = req.body;

    const user = await PmAdminUser.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (name !== undefined) user.name = name;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions !== undefined) user.permissions = permissions;
    if (dashboardWidgets !== undefined) user.dashboardWidgets = dashboardWidgets;
    if (password && password.trim() !== "") user.password = password; // pre-save hook will hash
    if (dashboardWidgets !== undefined) user.dashboardWidgets = dashboardWidgets;

    await user.save();

    const { password: _, ...userData } = user.toObject();
    return res.status(200).json({ success: true, data: userData });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /pm/admin-users/:id
export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await PmAdminUser.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({ success: true, message: "User deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

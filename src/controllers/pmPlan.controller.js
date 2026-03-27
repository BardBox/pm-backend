import { PmPlan } from "../models/pmPlan.model.js";
import ApiErrors from "../utils/ApiErrors.js";
import ApiResponses from "../utils/ApiResponses.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create a new plan
const createPmPlan = asyncHandler(async (req, res) => {
  const { name, description, amount, discountPrice, duration, features, isActive, isDefault } = req.body;

  if (!name || !amount) {
    throw new ApiErrors(400, "Plan name and amount are required");
  }

  if (discountPrice !== undefined && discountPrice !== null && discountPrice >= amount) {
    throw new ApiErrors(400, "Discount price must be less than the original amount");
  }

  const plan = await PmPlan.create({
    name: name.trim(),
    description: description?.trim() || "",
    amount,
    discountPrice: discountPrice !== undefined ? discountPrice : null,
    duration: duration || "annual",
    features: features || [],
    isActive: isActive !== undefined ? isActive : true,
    isDefault: isDefault || false,
  });

  return res
    .status(201)
    .json(new ApiResponses(201, plan, "Plan created successfully"));
});

// Get all plans
const getAllPmPlans = asyncHandler(async (req, res) => {
  const { active } = req.query;

  const filter = {};
  if (active === "true") filter.isActive = true;
  if (active === "false") filter.isActive = false;

  const plans = await PmPlan.find(filter).sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponses(200, plans, "Plans fetched successfully"));
});

// Get single plan
const getPmPlan = asyncHandler(async (req, res) => {
  const plan = await PmPlan.findById(req.params.id);

  if (!plan) {
    throw new ApiErrors(404, "Plan not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, plan, "Plan fetched successfully"));
});

// Get default/active plans (public - for checkout page)
const getActivePmPlans = asyncHandler(async (req, res) => {
  const plans = await PmPlan.find({ isActive: true }).sort({ amount: 1 });

  return res
    .status(200)
    .json(new ApiResponses(200, plans, "Active plans fetched successfully"));
});

// Update plan
const updatePmPlan = asyncHandler(async (req, res) => {
  const { name, description, amount, discountPrice, duration, features, isActive, isDefault } = req.body;

  const updateData = {};
  if (name) updateData.name = name.trim();
  if (description !== undefined) updateData.description = description.trim();
  if (amount) updateData.amount = amount;
  if (discountPrice !== undefined) updateData.discountPrice = discountPrice;
  if (duration) updateData.duration = duration;
  if (features) updateData.features = features;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  // If setting as default, unset other defaults
  if (isDefault === true) {
    await PmPlan.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
  }

  const plan = await PmPlan.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
  });

  if (!plan) {
    throw new ApiErrors(404, "Plan not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, plan, "Plan updated successfully"));
});

// Delete plan
const deletePmPlan = asyncHandler(async (req, res) => {
  const plan = await PmPlan.findByIdAndDelete(req.params.id);

  if (!plan) {
    throw new ApiErrors(404, "Plan not found");
  }

  return res
    .status(200)
    .json(new ApiResponses(200, null, "Plan deleted successfully"));
});

export {
  createPmPlan,
  getAllPmPlans,
  getPmPlan,
  getActivePmPlans,
  updatePmPlan,
  deletePmPlan,
};

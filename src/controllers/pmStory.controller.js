import { PmStory } from "../models/pmStory.model.js";
import ApiResponse from "../utils/ApiResponses.js";
import ApiError from "../utils/ApiErrors.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadImageOnCloudinary } from "../utils/cloudinary.js";

// GET all stories (public - only active, sorted by order)
export const getStories = asyncHandler(async (req, res) => {
  const stories = await PmStory.find({ isActive: true }).sort({ order: 1, createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, stories, "Stories fetched"));
});

// GET all stories (admin - includes inactive)
export const getAllStories = asyncHandler(async (req, res) => {
  const stories = await PmStory.find().sort({ order: 1, createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, stories, "All stories fetched"));
});

// CREATE story
export const createStory = asyncHandler(async (req, res) => {
  const { name, quote, order } = req.body;
  if (!name || !quote) {
    throw new ApiError(400, "Name and quote are required");
  }

  let image = req.body.image || "";
  let logo = req.body.logo || "";

  if (req.files?.image?.[0]) {
    const result = await uploadImageOnCloudinary(req.files.image[0].path);
    if (result) image = result.secure_url;
  }

  if (req.files?.logo?.[0]) {
    const result = await uploadImageOnCloudinary(req.files.logo[0].path);
    if (result) logo = result.secure_url;
  }

  const story = await PmStory.create({ name, image, logo, quote, order: order || 0 });
  return res.status(201).json(new ApiResponse(201, story, "Story created"));
});

// UPDATE story
export const updateStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  if (req.files?.image?.[0]) {
    const result = await uploadImageOnCloudinary(req.files.image[0].path);
    if (result) updateData.image = result.secure_url;
  }

  if (req.files?.logo?.[0]) {
    const result = await uploadImageOnCloudinary(req.files.logo[0].path);
    if (result) updateData.logo = result.secure_url;
  }

  const story = await PmStory.findByIdAndUpdate(id, updateData, { new: true });
  if (!story) throw new ApiError(404, "Story not found");
  return res.status(200).json(new ApiResponse(200, story, "Story updated"));
});

// DELETE story
export const deleteStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const story = await PmStory.findByIdAndDelete(id);
  if (!story) throw new ApiError(404, "Story not found");
  return res.status(200).json(new ApiResponse(200, null, "Story deleted"));
});

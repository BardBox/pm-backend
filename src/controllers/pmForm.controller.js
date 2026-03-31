import { PmForm } from "../models/pmForm.model.js";

// GET /pm/forms
export const getAllForms = async (req, res) => {
  try {
    const forms = await PmForm.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: forms });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/forms
export const createForm = async (req, res) => {
  try {
    const { title, description, status, fields, successMessage, redirectUrl } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (fields !== undefined && !Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: "Fields must be an array" });
    }

    const form = await PmForm.create({ title, description, status, fields, successMessage, redirectUrl });
    return res.status(201).json({ success: true, data: form });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /pm/forms/:id
export const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, fields, successMessage, redirectUrl } = req.body;

    const form = await PmForm.findById(id);
    if (!form) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }

    if (title !== undefined)          form.title = title;
    if (description !== undefined)    form.description = description;
    if (status !== undefined)         form.status = status;
    if (fields !== undefined)         form.fields = fields;
    if (successMessage !== undefined) form.successMessage = successMessage;
    if (redirectUrl !== undefined)    form.redirectUrl = redirectUrl;

    await form.save();
    return res.status(200).json({ success: true, data: form });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /pm/forms/:id
export const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    const form = await PmForm.findByIdAndDelete(id);
    if (!form) {
      return res.status(404).json({ success: false, message: "Form not found" });
    }
    return res.status(200).json({ success: true, message: "Form deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

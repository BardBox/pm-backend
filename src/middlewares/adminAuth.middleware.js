// Middleware to verify admin authentication from JWT headers
export const verifySuperAdmin = async (req, res, next) => {
  try {
    // Get token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    // For now, just verify token exists
    // In production, you'd verify JWT signature and role
    // TODO: Implement proper JWT verification with secret key from env

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

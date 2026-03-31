import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import simpleGit from "simple-git";
import { PmLandingPage } from "../models/pmLandingPage.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_BASE = path.resolve(path.join(__dirname, "../../public/lp"));

// Ensure base static dir exists
if (!fs.existsSync(STATIC_BASE)) fs.mkdirSync(STATIC_BASE, { recursive: true });

// Only allow lowercase letters, digits, and hyphens — no dots, slashes, or traversal
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/;
const sanitizeSlug = (raw) => raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

// Resolve a slug to an absolute path, rejecting any traversal outside STATIC_BASE
const safeStaticDir = (slug) => {
  const resolved = path.resolve(path.join(STATIC_BASE, slug));
  if (!resolved.startsWith(STATIC_BASE + path.sep) && resolved !== STATIC_BASE) {
    throw new Error("Invalid slug: path traversal detected");
  }
  return resolved;
};

// GET /pm/landing-pages
export const getAllLandingPages = async (req, res) => {
  try {
    const pages = await PmLandingPage.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: pages });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/landing-pages
export const createLandingPage = async (req, res) => {
  try {
    const { title, slug, type, status, description, content, settings,
            buildMethod, subdomain, githubRepo, githubBranch } = req.body;

    if (!title || !slug || !type) {
      return res.status(400).json({ success: false, message: "Title, slug, and type are required" });
    }

    const safeSlug = sanitizeSlug(slug);
    if (!safeSlug) {
      return res.status(400).json({ success: false, message: "Slug must contain only letters, digits, and hyphens" });
    }

    const existing = await PmLandingPage.findOne({ slug: safeSlug });
    if (existing) {
      return res.status(409).json({ success: false, message: "A landing page with this slug already exists" });
    }

    const page = await PmLandingPage.create({
      title, slug: safeSlug, type, status, description, content, settings,
      buildMethod: buildMethod || "code",
      subdomain: subdomain || "",
      githubRepo: githubRepo || "",
      githubBranch: githubBranch || "main",
    });
    return res.status(201).json({ success: true, data: page });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /pm/landing-pages/:id
export const updateLandingPage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, type, status, description, content, settings,
            buildMethod, subdomain, githubRepo, githubBranch, staticPath } = req.body;

    const page = await PmLandingPage.findById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }

    if (title !== undefined)       page.title = title;
    if (slug !== undefined)        page.slug = sanitizeSlug(slug);
    if (type !== undefined)        page.type = type;
    if (status !== undefined)      page.status = status;
    if (description !== undefined) page.description = description;
    if (content !== undefined)     page.content = content;
    if (settings !== undefined)    page.settings = settings;
    if (buildMethod !== undefined) page.buildMethod = buildMethod;
    if (subdomain !== undefined)   page.subdomain = subdomain;
    if (githubRepo !== undefined)  page.githubRepo = githubRepo;
    if (githubBranch !== undefined) page.githubBranch = githubBranch;
    if (staticPath !== undefined)  page.staticPath = staticPath;

    await page.save();
    return res.status(200).json({ success: true, data: page });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A landing page with this slug already exists" });
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /pm/landing-pages/:id
export const deleteLandingPage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await PmLandingPage.findByIdAndDelete(id);
    if (!page) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }
    // Clean up static files if any
    if (page.slug) {
      const staticDir = safeStaticDir(page.slug);
      if (fs.existsSync(staticDir)) fs.rmSync(staticDir, { recursive: true, force: true });
    }
    return res.status(200).json({ success: true, message: "Landing page deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /pm/landing-pages/:id/upload-zip
export const uploadZip = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await PmLandingPage.findById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No ZIP file uploaded" });
    }

    const destDir = safeStaticDir(page.slug);
    if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });

    const zip = new AdmZip(req.file.path);

    // Zip-slip guard: validate every entry resolves inside destDir
    const MAX_UNZIPPED = 200 * 1024 * 1024; // 200 MB cap
    let totalSize = 0;
    for (const entry of zip.getEntries()) {
      const entryPath = path.resolve(path.join(destDir, entry.entryName));
      if (!entryPath.startsWith(destDir + path.sep) && entryPath !== destDir) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "Invalid ZIP: contains path traversal entries" });
      }
      totalSize += entry.header.size;
      if (totalSize > MAX_UNZIPPED) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: "ZIP contents exceed 200 MB limit when extracted" });
      }
    }

    zip.extractAllTo(destDir, true);

    // Clean up temp upload file
    fs.unlinkSync(req.file.path);

    // If ZIP had a single root folder, flatten it
    const entries = fs.readdirSync(destDir);
    if (entries.length === 1 && fs.statSync(path.join(destDir, entries[0])).isDirectory()) {
      const innerDir = path.join(destDir, entries[0]);
      const innerFiles = fs.readdirSync(innerDir);
      for (const f of innerFiles) {
        fs.renameSync(path.join(innerDir, f), path.join(destDir, f));
      }
      fs.rmdirSync(innerDir);
    }

    // Auto-detect where index.html lives after extraction
    const zipCandidates = ["", "public", "dist", "build", "out", "_site"];
    let zipServeSubdir = null;
    for (const sub of zipCandidates) {
      const indexPath = sub ? path.join(destDir, sub, "index.html") : path.join(destDir, "index.html");
      if (fs.existsSync(indexPath)) { zipServeSubdir = sub; break; }
    }

    // Reject if no index.html found — not a valid static site
    if (zipServeSubdir === null) {
      fs.rmSync(destDir, { recursive: true, force: true });
      const hasPackageJson = fs.existsSync(path.join(destDir, "package.json")) ||
                             zipCandidates.some(s => s && fs.existsSync(path.join(destDir, s, "package.json")));
      const hint = hasPackageJson
        ? "This looks like an unbuilt source project. Run 'npm run build' locally first and upload the build/ or dist/ folder as a ZIP."
        : "No index.html found. ZIP must contain a static HTML site with an index.html at the root (or inside build/, dist/, out/, or _site/).";
      return res.status(400).json({ success: false, message: hint });
    }

    page.buildMethod = "upload";
    page.staticPath = `/lp-static/${page.slug}/${zipServeSubdir ? zipServeSubdir + "/" : ""}`;
    await page.save();

    return res.status(200).json({ success: true, data: page, message: "ZIP uploaded and extracted successfully" });
  } catch (err) {
    console.error("ZIP upload error:", err);
    return res.status(500).json({ success: false, message: "Failed to extract ZIP" });
  }
};

// POST /pm/landing-pages/:id/pull-github
export const pullGithub = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await PmLandingPage.findById(id);
    if (!page) {
      return res.status(404).json({ success: false, message: "Landing page not found" });
    }

    const { githubRepo, githubBranch = "main" } = req.body;
    if (!githubRepo) {
      return res.status(400).json({ success: false, message: "GitHub repo URL is required" });
    }

    const destDir = safeStaticDir(page.slug);
    const git = simpleGit();

    if (fs.existsSync(path.join(destDir, ".git"))) {
      // Already cloned — pull latest
      const localGit = simpleGit(destDir);
      // Get actual default branch from remote if not specified
      let branch = githubBranch;
      if (!branch || branch === "main") {
        try {
          const remoteInfo = await localGit.remote(["show", "origin"]);
          const match = remoteInfo && remoteInfo.match(/HEAD branch:\s*(\S+)/);
          if (match) branch = match[1];
        } catch (_) { /* keep as-is */ }
      }
      await localGit.pull("origin", branch);
    } else {
      if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
      // Clone without --branch first to get default branch, then re-clone with correct branch
      const cloneArgs = ["--depth", "1"];
      if (githubBranch && githubBranch !== "main") {
        // User explicitly set a non-default branch — try it directly
        cloneArgs.unshift("--branch", githubBranch);
        await git.clone(githubRepo, destDir, cloneArgs);
      } else {
        // No branch specified or "main" — clone default branch (works for both main/master/etc)
        try {
          await git.clone(githubRepo, destDir, ["--branch", "main", "--depth", "1"]);
        } catch (_) {
          // Fallback: clone without --branch to use whatever the remote default is
          if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
          await git.clone(githubRepo, destDir, ["--depth", "1"]);
        }
      }
    }

    // Detect actual checked-out branch and save it
    const actualBranch = await simpleGit(destDir).revparse(["--abbrev-ref", "HEAD"]).catch(() => githubBranch);
    page.githubBranch = (actualBranch || githubBranch).trim();

    // Auto-detect where index.html lives (root, public/, dist/, build/, out/, _site/)
    const candidates = ["", "dist", "build", "out", "_site"];
    let serveSubdir = null;
    for (const sub of candidates) {
      const indexPath = sub ? path.join(destDir, sub, "index.html") : path.join(destDir, "index.html");
      if (fs.existsSync(indexPath)) { serveSubdir = sub; break; }
    }

    // Reject source projects — must have a built index.html
    if (serveSubdir === null) {
      fs.rmSync(destDir, { recursive: true, force: true });
      const isSourceProject = fs.existsSync(path.join(destDir, "package.json")) ||
                              fs.existsSync(path.join(destDir, "src"));
      const hint = isSourceProject
        ? "This repo appears to be an unbuilt source project. Push a pre-built branch (with index.html at root, or in dist/ / build/ / out/ / _site/) or use the ZIP upload instead."
        : "No index.html found in this repo. The repository must be a static HTML site with an index.html at the root or inside dist/, build/, out/, or _site/.";
      return res.status(400).json({ success: false, message: hint });
    }

    page.buildMethod = "github";
    page.githubRepo = githubRepo;
    page.staticPath = `/lp-static/${page.slug}/${serveSubdir ? serveSubdir + "/" : ""}`;
    await page.save();

    return res.status(200).json({ success: true, data: page, message: "GitHub repo pulled successfully" });
  } catch (err) {
    console.error("GitHub pull error:", err);
    return res.status(500).json({ success: false, message: "Failed to pull GitHub repo: " + err.message });
  }
};

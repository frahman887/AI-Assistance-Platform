import {
  createUser,
  findUserByEmail,
  verifyPassword,
  signToken
} from "../services/authService.js";
import {
  createBusinessWithOwner,
  getPrimaryBusinessForUser
} from "../services/businessService.js";

export async function register(req, res) {
  try {
    const { email, password, businessName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      return res.status(400).json({ error: "businessName is required" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const user = await createUser(email, password);

    let business;
    try {
      business = await createBusinessWithOwner(user.id, businessName.trim());
    } catch (bizErr) {
      // Business creation failed (e.g. slug collision) — the user row already
      // exists at this point. Surfacing this clearly rather than leaving an
      // orphaned user with no business is more important than a clean rollback
      // here; revisit if orphaned users become an actual problem.
      console.error("Business creation failed during registration:", bizErr);
      return res.status(409).json({ error: bizErr.message });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessId: business.id,
      role: "owner"
    });

    res.status(201).json({ user, business, token });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const business = await getPrimaryBusinessForUser(user.id);
    if (!business) {
      // A user with no business at all shouldn't happen post-migration, but
      // fail clearly instead of issuing a token that can't scope anything.
      return res.status(403).json({ error: "This account isn't attached to a business yet." });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      businessId: business.id,
      role: business.role
    });

    res.json({
      user: { id: user.id, email: user.email },
      business: { id: business.id, slug: business.slug, name: business.name, role: business.role },
      token
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}
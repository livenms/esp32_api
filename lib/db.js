import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyDb() {
  return { users: [], devices: [], payments: [] };
}

function load() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const db = emptyDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return emptyDb();
  }
}

function save(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

let db = load();

function id() {
  return crypto.randomUUID();
}

// ------------------------------------------------------------------
// Seed a default administrator account on first boot. Credentials can
// be overridden with env vars so the same default password is never
// left in place on a real deployment.
// ------------------------------------------------------------------
function seedAdmin() {
  if (db.users.some((u) => u.role === "admin")) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Afriinnox@2026";

  db.users.push({
    id: id(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: "admin",
    name: "Afriinnox Administrator",
    email: "",
    phone: "",
    active: true,
    mustChangePassword: !process.env.ADMIN_PASSWORD,
    createdAt: new Date().toISOString(),
  });
  save(db);

  if (!process.env.ADMIN_PASSWORD) {
    console.log("========================================================");
    console.log(" First run: a default admin account was created.");
    console.log("   username: " + username);
    console.log("   password: " + password);
    console.log(" Please log in and change this password immediately, or");
    console.log(" set ADMIN_USERNAME / ADMIN_PASSWORD env vars and redeploy.");
    console.log("========================================================");
  }
}
seedAdmin();

// ------------------------------------------------------------------
// Users
// ------------------------------------------------------------------
export function findUserByUsername(username) {
  return db.users.find(
    (u) => u.username.toLowerCase() === String(username || "").toLowerCase()
  );
}
export function findUserById(userId) {
  return db.users.find((u) => u.id === userId);
}
export function listUsers() {
  return db.users.filter((u) => u.role === "user");
}
export function createUser({ username, password, name, farmName, phone, email }) {
  if (findUserByUsername(username)) {
    throw new Error("That username is already taken.");
  }
  const user = {
    id: id(),
    username: username.trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    role: "user",
    name: name || username,
    farmName: farmName || "",
    phone: phone || "",
    email: email || "",
    active: true,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);
  return user;
}
export function updateUser(userId, patch) {
  const u = findUserById(userId);
  if (!u) throw new Error("User not found.");
  const allowed = ["name", "farmName", "phone", "email", "active"];
  for (const k of allowed) if (k in patch) u[k] = patch[k];
  save(db);
  return u;
}
export function setPassword(userId, newPassword) {
  const u = findUserById(userId);
  if (!u) throw new Error("User not found.");
  u.passwordHash = bcrypt.hashSync(newPassword, 10);
  u.mustChangePassword = false;
  save(db);
  return u;
}
export function deleteUser(userId) {
  db.users = db.users.filter((u) => u.id !== userId);
  db.devices.forEach((d) => {
    if (d.ownerId === userId) d.ownerId = null;
  });
  save(db);
}
export function verifyLogin(username, password) {
  const u = findUserByUsername(username);
  if (!u || !u.active) return null;
  if (!bcrypt.compareSync(password, u.passwordHash)) return null;
  return u;
}

// ------------------------------------------------------------------
// Devices
// ------------------------------------------------------------------
export function listDevices() {
  return db.devices;
}
export function findDevice(deviceRecordId) {
  return db.devices.find((d) => d.id === deviceRecordId);
}
export function createDevice({ deviceId, name, mqttBroker, topicPrefix, animal, location, ownerId }) {
  if (db.devices.some((d) => d.deviceId.toLowerCase() === deviceId.toLowerCase())) {
    throw new Error("A device with that Device ID already exists.");
  }
  const device = {
    id: id(),
    deviceId: deviceId.trim(),
    name: name || deviceId.trim(),
    mqttBroker: mqttBroker || "broker.hivemq.com",
    // MQTT topics are built as "<topicPrefix>/<deviceId>/...". Different
    // firmware builds have shipped with different casing here
    // (e.g. "BROODIINNOX" vs "broodinnox"), so this is per-device rather
    // than assumed.
    topicPrefix: (topicPrefix || "BROODIINNOX").trim(),
    animal: animal || "Chicken",
    location: location || "",
    ownerId: ownerId || null,
    createdAt: new Date().toISOString(),
  };
  db.devices.push(device);
  save(db);
  return device;
}
export function updateDevice(deviceRecordId, patch) {
  const d = findDevice(deviceRecordId);
  if (!d) throw new Error("Device not found.");
  const allowed = ["name", "mqttBroker", "topicPrefix", "animal", "location", "ownerId"];
  for (const k of allowed) if (k in patch) d[k] = patch[k];
  save(db);
  return d;
}
export function deleteDevice(deviceRecordId) {
  db.devices = db.devices.filter((d) => d.id !== deviceRecordId);
  db.payments = db.payments.filter((p) => p.deviceId !== deviceRecordId);
  save(db);
}
export function devicesForUser(userId) {
  return db.devices.filter((d) => d.ownerId === userId);
}

// ------------------------------------------------------------------
// Payments / subscription status
// ------------------------------------------------------------------
export function listPayments() {
  return db.payments.slice().sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));
}
export function paymentsForDevice(deviceRecordId) {
  return listPayments().filter((p) => p.deviceId === deviceRecordId);
}
export function createPayment({ deviceId, amount, currency, periodDays, paidOn, note }) {
  const device = findDevice(deviceId);
  if (!device) throw new Error("Device not found.");
  const paid = paidOn ? new Date(paidOn) : new Date();
  const days = Number(periodDays) > 0 ? Number(periodDays) : 30;
  const due = new Date(paid.getTime() + days * 24 * 60 * 60 * 1000);
  const payment = {
    id: id(),
    deviceId,
    amount: Number(amount) || 0,
    currency: currency || "RWF",
    periodDays: days,
    paidOn: paid.toISOString(),
    dueDate: due.toISOString(),
    note: note || "",
    createdAt: new Date().toISOString(),
  };
  db.payments.push(payment);
  save(db);
  return payment;
}
export function deletePayment(paymentId) {
  db.payments = db.payments.filter((p) => p.id !== paymentId);
  save(db);
}

// Latest payment record for a device, plus a derived status.
export function subscriptionStatus(deviceRecordId) {
  const history = paymentsForDevice(deviceRecordId);
  const latest = history[0] || null;
  if (!latest) {
    return { status: "no_payment", dueDate: null, lastPaidOn: null, latest: null, history };
  }
  const due = new Date(latest.dueDate);
  const now = new Date();
  const msLeft = due.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  let status = "paid";
  if (daysLeft < 0) status = "overdue";
  else if (daysLeft <= 7) status = "due_soon";
  return {
    status,
    daysLeft,
    dueDate: latest.dueDate,
    lastPaidOn: latest.paidOn,
    latest,
    history,
  };
}

export function adminStats() {
  const devices = listDevices();
  const users = listUsers();
  const now = new Date();
  let overdue = 0,
    dueSoon = 0,
    unassigned = 0;
  let revenueThisMonth = 0;

  devices.forEach((d) => {
    if (!d.ownerId) unassigned++;
    const s = subscriptionStatus(d.id);
    if (s.status === "overdue") overdue++;
    if (s.status === "due_soon") dueSoon++;
  });

  db.payments.forEach((p) => {
    const paid = new Date(p.paidOn);
    if (paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear()) {
      revenueThisMonth += Number(p.amount) || 0;
    }
  });

  return {
    totalUsers: users.length,
    totalDevices: devices.length,
    unassignedDevices: unassigned,
    overdue,
    dueSoon,
    revenueThisMonth,
  };
}

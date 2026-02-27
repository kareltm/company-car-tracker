const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || "https://nmgwoadartjylcifoimv.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tZ3dvYWRhcnRqeWxjaWZvaW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODE0MDIsImV4cCI6MjA4Nzc1NzQwMn0.9ArJx8IozW07vAo9LtfLPdtOfAVcaoRtCUt4k2iGlOU";
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/*
  DATABASE SETUP - Run this SQL in Supabase SQL Editor:

  CREATE TABLE IF NOT EXISTS reservations (
    id SERIAL PRIMARY KEY,
    plate TEXT NOT NULL REFERENCES cars(plate) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    UNIQUE(plate, date, hour)
  );

  -- If migrating from the old schema (without hour column):
  -- ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_plate_date_key;
  -- ALTER TABLE reservations ADD COLUMN hour INTEGER NOT NULL DEFAULT 8;
  -- ALTER TABLE reservations ADD CONSTRAINT reservations_plate_date_hour_key UNIQUE(plate, date, hour);
*/

// --- Cars ---

// Get all cars
app.get("/api/cars", async (req, res) => {
  const { data, error } = await supabase.from("cars").select("plate").order("plate");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map((c) => c.plate));
});

// Add a new car
app.post("/api/cars", async (req, res) => {
  const { plate } = req.body;
  if (!plate || !plate.trim()) {
    return res.status(400).json({ error: "License plate is required" });
  }

  const { error } = await supabase
    .from("cars")
    .insert({ plate: plate.trim().toUpperCase(), used_by: null });

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Car already exists" });
    }
    return res.status(500).json({ error: error.message });
  }

  const { data } = await supabase.from("cars").select("plate").order("plate");
  res.status(201).json(data.map((c) => c.plate));
});

// Remove a car
app.delete("/api/cars/:plate", async (req, res) => {
  const { error } = await supabase
    .from("cars")
    .delete()
    .ilike("plate", req.params.plate);

  if (error) return res.status(500).json({ error: error.message });

  const { data } = await supabase.from("cars").select("plate").order("plate");
  res.json(data.map((c) => c.plate));
});

// --- Reservations ---

// Get reservations for a date range
app.get("/api/reservations", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: "from and to query params required (YYYY-MM-DD)" });
  }

  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .gte("date", from)
    .lte("date", to)
    .order("date");

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create a reservation
app.post("/api/reservations", async (req, res) => {
  const { plate, name, date, hour } = req.body;
  if (!plate || !name || !date || hour === undefined) {
    return res.status(400).json({ error: "plate, name, date, and hour are required" });
  }

  const h = parseInt(hour);
  if (isNaN(h) || h < 8 || h > 22) {
    return res.status(400).json({ error: "hour must be between 8 and 22" });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({ plate: plate.trim(), name: name.trim(), date, hour: h })
    .select();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "This car is already reserved at that time" });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data[0]);
});

// Delete a reservation
app.delete("/api/reservations/:id", async (req, res) => {
  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Bulk delete reservations for a car on a specific date
app.delete("/api/reservations", async (req, res) => {
  const { plate, date } = req.query;
  if (!plate || !date) {
    return res.status(400).json({ error: "plate and date query params required" });
  }

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("plate", plate)
    .eq("date", date);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Bulk create reservations for multiple hours
app.post("/api/reservations/bulk", async (req, res) => {
  const { plate, name, date, hours } = req.body;
  if (!plate || !name || !date || !Array.isArray(hours) || hours.length === 0) {
    return res.status(400).json({ error: "plate, name, date, and hours[] are required" });
  }

  const rows = hours.map(h => {
    const hr = parseInt(h);
    if (isNaN(hr) || hr < 8 || hr > 22) return null;
    return { plate: plate.trim(), name: name.trim(), date, hour: hr };
  }).filter(Boolean);

  if (rows.length === 0) {
    return res.status(400).json({ error: "No valid hours provided" });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert(rows)
    .select();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Some hours are already reserved" });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

// Only start listening when not running on Vercel
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Car tracker running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;

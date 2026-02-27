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
    UNIQUE(plate, date)
  );
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
  const { plate, name, date } = req.body;
  if (!plate || !name || !date) {
    return res.status(400).json({ error: "plate, name, and date are required" });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({ plate: plate.trim(), name: name.trim(), date })
    .select();

  if (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "This car is already reserved on that day" });
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

// Only start listening when not running on Vercel
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Car tracker running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;

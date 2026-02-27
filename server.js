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

// Get all cars
app.get("/api/cars", async (req, res) => {
  const { data, error } = await supabase.from("cars").select("*");
  if (error) return res.status(500).json({ error: error.message });
  // Map to the format the frontend expects
  res.json(data.map((c) => ({ plate: c.plate, usedBy: c.used_by })));
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

  const { data } = await supabase.from("cars").select("*");
  res.status(201).json(data.map((c) => ({ plate: c.plate, usedBy: c.used_by })));
});

// Claim a car
app.post("/api/cars/:plate/claim", async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const { data: updated, error } = await supabase
    .from("cars")
    .update({ used_by: name.trim() })
    .ilike("plate", req.params.plate)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (updated.length === 0) return res.status(404).json({ error: "Car not found" });

  const { data } = await supabase.from("cars").select("*");
  res.json(data.map((c) => ({ plate: c.plate, usedBy: c.used_by })));
});

// Release a car
app.post("/api/cars/:plate/release", async (req, res) => {
  const { data: updated, error } = await supabase
    .from("cars")
    .update({ used_by: null })
    .ilike("plate", req.params.plate)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (updated.length === 0) return res.status(404).json({ error: "Car not found" });

  const { data } = await supabase.from("cars").select("*");
  res.json(data.map((c) => ({ plate: c.plate, usedBy: c.used_by })));
});

// Remove a car
app.delete("/api/cars/:plate", async (req, res) => {
  const { error } = await supabase
    .from("cars")
    .delete()
    .ilike("plate", req.params.plate);

  if (error) return res.status(500).json({ error: error.message });

  const { data } = await supabase.from("cars").select("*");
  res.json(data.map((c) => ({ plate: c.plate, usedBy: c.used_by })));
});

// Only start listening when not running on Vercel
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Car tracker running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;

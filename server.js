const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ cars: [] }));
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all cars
app.get("/api/cars", (req, res) => {
  const data = readData();
  res.json(data.cars);
});

// Add a new car
app.post("/api/cars", (req, res) => {
  const { plate } = req.body;
  if (!plate || !plate.trim()) {
    return res.status(400).json({ error: "License plate is required" });
  }

  const data = readData();
  const exists = data.cars.some(
    (c) => c.plate.toLowerCase() === plate.trim().toLowerCase()
  );
  if (exists) {
    return res.status(409).json({ error: "Car already exists" });
  }

  data.cars.push({ plate: plate.trim().toUpperCase(), usedBy: null });
  writeData(data);
  res.status(201).json(data.cars);
});

// Claim a car
app.post("/api/cars/:plate/claim", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const data = readData();
  const car = data.cars.find(
    (c) => c.plate.toLowerCase() === req.params.plate.toLowerCase()
  );
  if (!car) {
    return res.status(404).json({ error: "Car not found" });
  }

  car.usedBy = name.trim();
  writeData(data);
  res.json(data.cars);
});

// Release a car
app.post("/api/cars/:plate/release", (req, res) => {
  const data = readData();
  const car = data.cars.find(
    (c) => c.plate.toLowerCase() === req.params.plate.toLowerCase()
  );
  if (!car) {
    return res.status(404).json({ error: "Car not found" });
  }

  car.usedBy = null;
  writeData(data);
  res.json(data.cars);
});

// Remove a car
app.delete("/api/cars/:plate", (req, res) => {
  const data = readData();
  data.cars = data.cars.filter(
    (c) => c.plate.toLowerCase() !== req.params.plate.toLowerCase()
  );
  writeData(data);
  res.json(data.cars);
});

app.listen(PORT, () => {
  console.log(`Car tracker running at http://localhost:${PORT}`);
});

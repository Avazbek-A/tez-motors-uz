"use client";

import { useState, useEffect } from "react";

import {
  Plus, Search, Edit, Trash2, Eye, MoreHorizontal,
  Car, Filter, ArrowUpDown, Loader2, RefreshCw, CheckCircle, AlertCircle, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, cn } from "@/lib/utils";
import type { Car as CarType } from "@/types/car";

export default function AdminCarsPage() {
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchCars = () => {
    setLoading(true);
    fetch("/api/cars?all=true")
      .then((r) => r.json())
      .then((data) => {
        setCars(data.cars || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCars();
  }, []);

  const filteredCars = cars.filter((car) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${car.brand} ${car.model}`.toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelectedCars((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this car?")) return;
    const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCars(cars.filter((c) => c.id !== id));
      showFeedback("success", "Car deleted successfully");
    } else {
      showFeedback("error", "Failed to delete car");
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedCars.length} cars?`)) return;
    await Promise.all(selectedCars.map((id) => fetch(`/api/cars/${id}`, { method: "DELETE" })));
    setSelectedCars([]);
    fetchCars();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cars Management</h1>
          <p className="text-muted-foreground">{cars.length} cars in inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCars}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/admin/export?type=cars" download>
              <Download className="w-4 h-4" />
              Export CSV
            </a>
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            Add Car
          </Button>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-fade-in ${
          feedback.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {feedback.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {/* Search and filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search cars..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedCars.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-lime/10 rounded-xl border border-lime/20">
          <span className="text-sm font-medium">{selectedCars.length} selected</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedCars([])}>
            Cancel
          </Button>
        </div>
      )}

      {/* Cars table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="p-4 text-left w-10">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCars(filteredCars.map((c) => c.id));
                          } else {
                            setSelectedCars([]);
                          }
                        }}
                        checked={selectedCars.length === filteredCars.length && filteredCars.length > 0}
                        className="rounded"
                      />
                    </th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Car</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Price</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="p-4 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCars.map((car, index) => (
                    <tr
                      key={car.id}
                      className="animate-fade-in border-b border-border hover:bg-muted/30 transition-colors"
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedCars.includes(car.id)}
                          onChange={() => toggleSelect(car.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Car className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{car.brand} {car.model}</p>
                            <p className="text-xs text-muted-foreground">{car.year} &middot; {car.fuel_type} &middot; {car.transmission}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold">{formatPrice(car.price_usd)}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{car.body_type}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {car.is_available ? (
                            <Badge variant="success">Available</Badge>
                          ) : (
                            <Badge variant="destructive">Sold</Badge>
                          )}
                          {car.is_hot_offer && <Badge variant="default">Hot</Badge>}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <a href={`/catalog/${car.slug}`} target="_blank">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingCar(car)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(car.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredCars.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No cars found matching your search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {(showAddModal || editingCar) && (
        <CarFormModal
          car={editingCar}
          onClose={() => {
            setShowAddModal(false);
            setEditingCar(null);
          }}
          onSaved={fetchCars}
        />
      )}
    </div>
  );
}

function CarFormModal({ car, onClose, onSaved }: { car: CarType | null; onClose: () => void; onSaved: () => void }) {
  const isEditing = !!car;
  const [saving, setSaving] = useState(false);
  const [brand, setBrand] = useState(car?.brand || "");
  const [model, setModel] = useState(car?.model || "");
  const [year, setYear] = useState(car?.year?.toString() || "2024");
  const [priceUsd, setPriceUsd] = useState(car?.price_usd?.toString() || "");
  const [bodyType, setBodyType] = useState<string>(car?.body_type || "suv");
  const [fuelType, setFuelType] = useState<string>(car?.fuel_type || "petrol");
  const [engineVolume, setEngineVolume] = useState(car?.engine_volume?.toString() || "1.5");
  const [enginePower, setEnginePower] = useState(car?.engine_power?.toString() || "");
  const [transmission, setTransmission] = useState<string>(car?.transmission || "automatic");
  const [drivetrain, setDrivetrain] = useState<string>(car?.drivetrain || "fwd");
  const [color, setColor] = useState(car?.color || "");
  const [descriptionRu, setDescriptionRu] = useState(car?.description_ru || "");
  const [isHotOffer, setIsHotOffer] = useState(car?.is_hot_offer || false);
  const [isAvailable, setIsAvailable] = useState(car?.is_available ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const slug = `${brand}-${model}-${year}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const payload = {
      brand,
      model,
      slug,
      year: parseInt(year),
      price_usd: parseInt(priceUsd),
      body_type: bodyType,
      fuel_type: fuelType,
      engine_volume: engineVolume ? parseFloat(engineVolume) : null,
      engine_power: enginePower ? parseInt(enginePower) : null,
      transmission,
      drivetrain,
      color,
      description_ru: descriptionRu,
      is_hot_offer: isHotOffer,
      is_available: isAvailable,
      mileage: 0,
      images: car?.images || [],
      specs: car?.specs || {},
    };

    try {
      const url = isEditing ? `/api/cars/${car.id}` : "/api/cars";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        onSaved();
        onClose();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save car");
      }
    } catch {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="animate-fade-in relative bg-[#0d0d15] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
      >
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? `Edit ${car.brand} ${car.model}` : "Add New Car"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Brand</label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Model</label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Year</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Price (USD)</label>
              <Input type="number" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Color</label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Body Type</label>
              <select
                value={bodyType}
                onChange={(e) => setBodyType(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm"
              >
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="crossover">Crossover</option>
                <option value="hatchback">Hatchback</option>
                <option value="minivan">Minivan</option>
                <option value="coupe">Coupe</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fuel Type</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm"
              >
                <option value="petrol">Petrol</option>
                <option value="electric">Electric</option>
                <option value="hybrid">Hybrid</option>
                <option value="phev">PHEV</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Transmission</label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value)}
                className="w-full h-11 rounded-xl border border-border px-3 text-sm"
              >
                <option value="automatic">Automatic</option>
                <option value="manual">Manual</option>
                <option value="cvt">CVT</option>
                <option value="robot">Robot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Engine Volume (L)</label>
              <Input type="number" step="0.1" value={engineVolume} onChange={(e) => setEngineVolume(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Engine Power (hp)</label>
              <Input type="number" value={enginePower} onChange={(e) => setEnginePower(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description (RU)</label>
            <textarea
              value={descriptionRu}
              onChange={(e) => setDescriptionRu(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHotOffer}
                onChange={(e) => setIsHotOffer(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Hot Offer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Available</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? "Update Car" : "Add Car"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

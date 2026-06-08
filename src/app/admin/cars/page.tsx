"use client";

import { useState, useEffect } from "react";

import {
  Plus, Search, Edit, Trash2, Eye,
  Car, Loader2, RefreshCw, CheckCircle, AlertCircle, Download,
  Upload, X, ArrowLeft, ArrowRight, FileUp, FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MediaImporter } from "@/components/admin/media-importer";
import { cn, formatPrice } from "@/lib/utils";
import { useLocale } from "@/i18n/locale-context";
import type { Locale } from "@/i18n/config";
import type { Car as CarType } from "@/types/car";

const COPY: Record<Locale, {
  importFailed: string;
  importPreviewPrefix: string;
  importedPrefix: string;
  importReportLine: (verb: string, inserted: number, updated: number, skipped: number) => string;
  deleteConfirm: string;
  carDeleted: string;
  deleteFailed: string;
  bulkDeleteConfirm: (n: number) => string;
  heading: string;
  carsInInventory: (n: number) => string;
  templateBtn: string;
  templateTitle: string;
  exportCsv: string;
  previewTitle: string;
  previewCsv: string;
  importCsv: string;
  addCar: string;
  rowsSkipped: (n: number) => string;
  rowLabel: string;
  andMore: (n: number) => string;
  searchPlaceholder: string;
  selected: (n: number) => string;
  deleteBtn: string;
  cancel: string;
  thCar: string;
  thPrice: string;
  thType: string;
  thStatus: string;
  thActions: string;
  available: string;
  reserved: string;
  sold: string;
  hot: string;
  noCarsFound: string;
  editCarPrefix: string;
  addNewCar: string;
  brand: string;
  model: string;
  year: string;
  priceUsd: string;
  color: string;
  listingType: string;
  listingNew: string;
  listingUsed: string;
  mileageKm: string;
  vin: string;
  vinPlaceholder: string;
  owners: string;
  ownersPlaceholder: string;
  condition: string;
  condExcellent: string;
  condGood: string;
  condFair: string;
  accidentFree: string;
  originalPriceUsd: string;
  optional: string;
  videoUrl: string;
  bodyType: string;
  bodySedan: string;
  bodySuv: string;
  bodyCrossover: string;
  bodyHatchback: string;
  bodyMinivan: string;
  bodyCoupe: string;
  fuelType: string;
  fuelPetrol: string;
  fuelElectric: string;
  fuelHybrid: string;
  fuelPhev: string;
  transmission: string;
  transAutomatic: string;
  transManual: string;
  transCvt: string;
  transRobot: string;
  engineVolume: string;
  enginePower: string;
  descriptionRu: string;
  generating: string;
  generateAi: string;
  images: string;
  fullSpecSheet: string;
  specUrlPlaceholder: string;
  importSpec: string;
  specHelp: string;
  uploadFailedFor: (name: string) => string;
  networkErrorUploading: (name: string) => string;
  uploading: (n: number) => string;
  uploadHint: string;
  cover: string;
  moveLeft: string;
  remove: string;
  moveRight: string;
  hotOffer: string;
  inventoryStatus: string;
  invAvailable: string;
  invReserved: string;
  invSold: string;
  invalidValue: string;
  failedToSave: string;
  networkError: string;
  updateCar: string;
  specImportedOk: (trims: number, params: number, brand: string, model: string) => string;
  specImportFailedPrefix: string;
  specImportFailed: string;
}> = {
  ru: {
    importFailed: "Не удалось импортировать",
    importPreviewPrefix: "Предпросмотр: будет",
    importedPrefix: "Импортировано",
    importReportLine: (verb, inserted, updated, skipped) =>
      `${verb} добавлено ${inserted}, обновлено ${updated}, пропущено ${skipped}`,
    deleteConfirm: "Вы уверены, что хотите удалить этот автомобиль?",
    carDeleted: "Автомобиль успешно удалён",
    deleteFailed: "Не удалось удалить автомобиль",
    bulkDeleteConfirm: (n) => `Удалить ${n} авто?`,
    heading: "Управление автомобилями",
    carsInInventory: (n) => `${n} авто в наличии`,
    templateBtn: "Шаблон",
    templateTitle: "Скачать импортируемый CSV-шаблон",
    exportCsv: "Экспорт CSV",
    previewTitle: "Проверить CSV без записи в базу данных",
    previewCsv: "Предпросмотр CSV",
    importCsv: "Импорт CSV",
    addCar: "Добавить авто",
    rowsSkipped: (n) => `${n} ${n === 1 ? "строка пропущена" : "строк(и) пропущено"}`,
    rowLabel: "строка",
    andMore: (n) => `…и ещё ${n}`,
    searchPlaceholder: "Поиск авто...",
    selected: (n) => `Выбрано: ${n}`,
    deleteBtn: "Удалить",
    cancel: "Отмена",
    thCar: "Авто",
    thPrice: "Цена",
    thType: "Тип",
    thStatus: "Статус",
    thActions: "Действия",
    available: "В наличии",
    reserved: "Забронировано",
    sold: "Продано",
    hot: "Хит",
    noCarsFound: "Авто по вашему запросу не найдены.",
    editCarPrefix: "Редактировать",
    addNewCar: "Добавить новый автомобиль",
    brand: "Бренд",
    model: "Модель",
    year: "Год",
    priceUsd: "Цена (USD)",
    color: "Цвет",
    listingType: "Тип объявления",
    listingNew: "Новый (импорт)",
    listingUsed: "Б/у (с пробегом)",
    mileageKm: "Пробег (км)",
    vin: "VIN",
    vinPlaceholder: "Необязательно",
    owners: "Владельцев",
    ownersPlaceholder: "напр. 1",
    condition: "Состояние",
    condExcellent: "Отличное",
    condGood: "Хорошее",
    condFair: "Удовлетворительное",
    accidentFree: "Без ДТП",
    originalPriceUsd: "Старая цена (USD)",
    optional: "Необязательно",
    videoUrl: "URL видео",
    bodyType: "Тип кузова",
    bodySedan: "Седан",
    bodySuv: "Внедорожник",
    bodyCrossover: "Кроссовер",
    bodyHatchback: "Хэтчбек",
    bodyMinivan: "Минивэн",
    bodyCoupe: "Купе",
    fuelType: "Тип топлива",
    fuelPetrol: "Бензин",
    fuelElectric: "Электро",
    fuelHybrid: "Гибрид",
    fuelPhev: "Плагин-гибрид",
    transmission: "Коробка передач",
    transAutomatic: "Автомат",
    transManual: "Механика",
    transCvt: "Вариатор",
    transRobot: "Робот",
    engineVolume: "Объём двигателя (л)",
    enginePower: "Мощность двигателя (л.с.)",
    descriptionRu: "Описание (RU)",
    generating: "Генерация…",
    generateAi: "✨ Сгенерировать RU/UZ/EN с ИИ",
    images: "Изображения",
    fullSpecSheet: "Полный лист характеристик (AutoHome)",
    specUrlPlaceholder: "Вставьте URL вида global.autohome.com/en-hk/config/spec/…",
    importSpec: "Импорт характеристик",
    specHelp: "Загружает все комплектации и параметры в скачиваемый лист характеристик. Используйте англоязычный глобальный сайт AutoHome для чистых данных. Проверьте перед публикацией — данные для справки.",
    uploadFailedFor: (name) => `Не удалось загрузить ${name}`,
    networkErrorUploading: (name) => `Сетевая ошибка при загрузке ${name}`,
    uploading: (n) => `Загрузка ${n}…`,
    uploadHint: "Нажмите, чтобы загрузить JPG / PNG / WebP (макс. 5 МБ каждый)",
    cover: "ОБЛОЖКА",
    moveLeft: "Влево",
    remove: "Удалить",
    moveRight: "Вправо",
    hotOffer: "Горячее предложение",
    inventoryStatus: "Статус наличия",
    invAvailable: "В наличии",
    invReserved: "Забронировано",
    invSold: "Продано",
    invalidValue: "Недопустимое значение",
    failedToSave: "Не удалось сохранить авто",
    networkError: "Сетевая ошибка",
    updateCar: "Обновить авто",
    specImportedOk: (trims, params, brand, model) =>
      `✓ Импортировано ${trims} комплектаций, ${params} параметров (${brand} ${model}). Смотрите лист характеристик на странице авто.`,
    specImportFailedPrefix: "✗",
    specImportFailed: "✗ Не удалось импортировать.",
  },
  uz: {
    importFailed: "Import qilib boʻlmadi",
    importPreviewPrefix: "Koʻrib chiqish: boʻladi",
    importedPrefix: "Import qilindi",
    importReportLine: (verb, inserted, updated, skipped) =>
      `${verb} ${inserted} qoʻshildi, ${updated} yangilandi, ${skipped} oʻtkazib yuborildi`,
    deleteConfirm: "Ushbu avtomobil oʻchirilsinmi?",
    carDeleted: "Avtomobil muvaffaqiyatli oʻchirildi",
    deleteFailed: "Avtomobilni oʻchirib boʻlmadi",
    bulkDeleteConfirm: (n) => `${n} ta avto oʻchirilsinmi?`,
    heading: "Avtomobillarni boshqarish",
    carsInInventory: (n) => `Omborda ${n} ta avto`,
    templateBtn: "Shablon",
    templateTitle: "Import qilinadigan CSV shablonini yuklab olish",
    exportCsv: "CSV eksport",
    previewTitle: "CSV’ni bazaga yozmasdan tekshirish",
    previewCsv: "CSV koʻrib chiqish",
    importCsv: "CSV import",
    addCar: "Avto qoʻshish",
    rowsSkipped: (n) => `${n} ta qator oʻtkazib yuborildi`,
    rowLabel: "qator",
    andMore: (n) => `…va yana ${n} ta`,
    searchPlaceholder: "Avto qidirish...",
    selected: (n) => `Tanlangan: ${n}`,
    deleteBtn: "Oʻchirish",
    cancel: "Bekor qilish",
    thCar: "Avto",
    thPrice: "Narx",
    thType: "Turi",
    thStatus: "Holat",
    thActions: "Amallar",
    available: "Mavjud",
    reserved: "Band qilingan",
    sold: "Sotilgan",
    hot: "Hit",
    noCarsFound: "Soʻrovingiz boʻyicha avto topilmadi.",
    editCarPrefix: "Tahrirlash",
    addNewCar: "Yangi avtomobil qoʻshish",
    brand: "Brend",
    model: "Model",
    year: "Yil",
    priceUsd: "Narx (USD)",
    color: "Rang",
    listingType: "Eʼlon turi",
    listingNew: "Yangi (import)",
    listingUsed: "Ishlatilgan",
    mileageKm: "Yurgan masofa (km)",
    vin: "VIN",
    vinPlaceholder: "Ixtiyoriy",
    owners: "Egalari",
    ownersPlaceholder: "masalan 1",
    condition: "Holati",
    condExcellent: "Aʼlo",
    condGood: "Yaxshi",
    condFair: "Qoniqarli",
    accidentFree: "Avariyasiz",
    originalPriceUsd: "Eski narx (USD)",
    optional: "Ixtiyoriy",
    videoUrl: "Video URL",
    bodyType: "Kuzov turi",
    bodySedan: "Sedan",
    bodySuv: "SUV",
    bodyCrossover: "Krossover",
    bodyHatchback: "Xetchbek",
    bodyMinivan: "Miniven",
    bodyCoupe: "Kupe",
    fuelType: "Yoqilgʻi turi",
    fuelPetrol: "Benzin",
    fuelElectric: "Elektr",
    fuelHybrid: "Gibrid",
    fuelPhev: "Plagin-gibrid",
    transmission: "Uzatmalar qutisi",
    transAutomatic: "Avtomat",
    transManual: "Mexanika",
    transCvt: "Variator",
    transRobot: "Robot",
    engineVolume: "Dvigatel hajmi (l)",
    enginePower: "Dvigatel quvvati (o.k.)",
    descriptionRu: "Tavsif (RU)",
    generating: "Generatsiya…",
    generateAi: "✨ RU/UZ/EN’ni AI bilan yaratish",
    images: "Rasmlar",
    fullSpecSheet: "Toʻliq xususiyatlar varagʻi (AutoHome)",
    specUrlPlaceholder: "global.autohome.com/en-hk/config/spec/… koʻrinishidagi URL’ni joylashtiring",
    importSpec: "Xususiyatlarni import qilish",
    specHelp: "Barcha komplektatsiyalar va parametrlarni yuklab olinadigan xususiyatlar varagʻiga yuklaydi. Toza maʼlumotlar uchun inglizcha global AutoHome saytidan foydalaning. Eʼlon qilishdan oldin tekshiring — maʼlumotlar maʼlumot uchun.",
    uploadFailedFor: (name) => `${name} yuklab boʻlmadi`,
    networkErrorUploading: (name) => `${name} yuklashda tarmoq xatosi`,
    uploading: (n) => `Yuklanmoqda ${n}…`,
    uploadHint: "JPG / PNG / WebP yuklash uchun bosing (har biri maks. 5 MB)",
    cover: "MUQOVA",
    moveLeft: "Chapga",
    remove: "Oʻchirish",
    moveRight: "Oʻngga",
    hotOffer: "Issiq taklif",
    inventoryStatus: "Mavjudlik holati",
    invAvailable: "Mavjud",
    invReserved: "Band qilingan",
    invSold: "Sotilgan",
    invalidValue: "Yaroqsiz qiymat",
    failedToSave: "Avtoni saqlab boʻlmadi",
    networkError: "Tarmoq xatosi",
    updateCar: "Avtoni yangilash",
    specImportedOk: (trims, params, brand, model) =>
      `✓ ${trims} ta komplektatsiya, ${params} ta parametr import qilindi (${brand} ${model}). Xususiyatlar varagʻini avto sahifasida koʻring.`,
    specImportFailedPrefix: "✗",
    specImportFailed: "✗ Import qilib boʻlmadi.",
  },
  en: {
    importFailed: "Import failed",
    importPreviewPrefix: "Preview: would",
    importedPrefix: "Imported",
    importReportLine: (verb, inserted, updated, skipped) =>
      `${verb} insert ${inserted}, update ${updated}, skip ${skipped}`,
    deleteConfirm: "Are you sure you want to delete this car?",
    carDeleted: "Car deleted successfully",
    deleteFailed: "Failed to delete car",
    bulkDeleteConfirm: (n) => `Delete ${n} cars?`,
    heading: "Cars Management",
    carsInInventory: (n) => `${n} cars in inventory`,
    templateBtn: "Template",
    templateTitle: "Download an importable CSV template",
    exportCsv: "Export CSV",
    previewTitle: "Validate CSV without writing to the database",
    previewCsv: "Preview CSV",
    importCsv: "Import CSV",
    addCar: "Add Car",
    rowsSkipped: (n) => `${n} row${n === 1 ? "" : "s"} skipped`,
    rowLabel: "row",
    andMore: (n) => `…and ${n} more`,
    searchPlaceholder: "Search cars...",
    selected: (n) => `${n} selected`,
    deleteBtn: "Delete",
    cancel: "Cancel",
    thCar: "Car",
    thPrice: "Price",
    thType: "Type",
    thStatus: "Status",
    thActions: "Actions",
    available: "Available",
    reserved: "Reserved",
    sold: "Sold",
    hot: "Hot",
    noCarsFound: "No cars found matching your search.",
    editCarPrefix: "Edit",
    addNewCar: "Add New Car",
    brand: "Brand",
    model: "Model",
    year: "Year",
    priceUsd: "Price (USD)",
    color: "Color",
    listingType: "Listing type",
    listingNew: "New (import)",
    listingUsed: "Used (pre-owned)",
    mileageKm: "Mileage (km)",
    vin: "VIN",
    vinPlaceholder: "Optional",
    owners: "Owners",
    ownersPlaceholder: "e.g. 1",
    condition: "Condition",
    condExcellent: "Excellent",
    condGood: "Good",
    condFair: "Fair",
    accidentFree: "Accident-free",
    originalPriceUsd: "Original Price (USD)",
    optional: "Optional",
    videoUrl: "Video URL",
    bodyType: "Body Type",
    bodySedan: "Sedan",
    bodySuv: "SUV",
    bodyCrossover: "Crossover",
    bodyHatchback: "Hatchback",
    bodyMinivan: "Minivan",
    bodyCoupe: "Coupe",
    fuelType: "Fuel Type",
    fuelPetrol: "Petrol",
    fuelElectric: "Electric",
    fuelHybrid: "Hybrid",
    fuelPhev: "PHEV",
    transmission: "Transmission",
    transAutomatic: "Automatic",
    transManual: "Manual",
    transCvt: "CVT",
    transRobot: "Robot",
    engineVolume: "Engine Volume (L)",
    enginePower: "Engine Power (hp)",
    descriptionRu: "Description (RU)",
    generating: "Generating…",
    generateAi: "✨ Generate RU/UZ/EN with AI",
    images: "Images",
    fullSpecSheet: "Full spec sheet (AutoHome)",
    specUrlPlaceholder: "Paste a global.autohome.com/en-hk/config/spec/… URL",
    importSpec: "Import spec",
    specHelp: "Pulls all trims + parameters into a downloadable multi-trim spec sheet. Use the English global AutoHome site for clean data. Review before publishing — data is for reference.",
    uploadFailedFor: (name) => `Upload failed for ${name}`,
    networkErrorUploading: (name) => `Network error uploading ${name}`,
    uploading: (n) => `Uploading ${n}…`,
    uploadHint: "Click to upload JPG / PNG / WebP (max 5 MB each)",
    cover: "COVER",
    moveLeft: "Move left",
    remove: "Remove",
    moveRight: "Move right",
    hotOffer: "Hot Offer",
    inventoryStatus: "Inventory Status",
    invAvailable: "Available",
    invReserved: "Reserved",
    invSold: "Sold",
    invalidValue: "Invalid value",
    failedToSave: "Failed to save car",
    networkError: "Network error",
    updateCar: "Update Car",
    specImportedOk: (trims, params, brand, model) =>
      `✓ Imported ${trims} trim(s), ${params} params (${brand} ${model}). View the spec sheet on the car page.`,
    specImportFailedPrefix: "✗",
    specImportFailed: "✗ Import failed.",
  },
};

const CAR_CSV_HEADERS = [
  "slug", "brand", "model", "year", "price_usd", "original_price_usd", "price_uzs",
  "body_type", "fuel_type", "engine_volume", "engine_power", "transmission",
  "drivetrain", "mileage", "color", "description_ru", "description_uz", "description_en",
  "images", "thumbnail", "video_url", "is_hot_offer",
  "inventory_status", "order_position",
];

const CAR_CSV_EXAMPLE = [
  "", "BYD", "Song Plus", "2024", "32000", "35000", "",
  "suv", "hybrid", "1.5", "197", "automatic",
  "fwd", "0", "White", "Кроссовер с гибридной установкой DM-i", "", "",
  "https://example.com/photo1.jpg;https://example.com/photo2.jpg", "", "",
  "true", "available", "0",
];

export default function AdminCarsPage() {
  const { locale } = useLocale();
  const t = COPY[locale];
  const [cars, setCars] = useState<CarType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCar, setEditingCar] = useState<CarType | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; slug?: string; message: string }>;
  } | null>(null);

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

  const downloadTemplate = () => {
    const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv =
      CAR_CSV_HEADERS.join(",") + "\r\n" + CAR_CSV_EXAMPLE.map(esc).join(",") + "\r\n";
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cars-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File, dry = false) => {
    setImporting(true);
    setImportReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/cars/import${dry ? "?dry=true" : ""}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showFeedback("error", data.error || t.importFailed);
        return;
      }
      setImportReport(data);
      const { inserted = 0, updated = 0, skipped = 0 } = data;
      const prefix = dry ? t.importPreviewPrefix : t.importedPrefix;
      showFeedback(
        skipped > 0 ? "error" : "success",
        t.importReportLine(prefix, inserted, updated, skipped),
      );
      if (!dry) fetchCars();
    } catch (e) {
      showFeedback("error", e instanceof Error ? e.message : t.importFailed);
    } finally {
      setImporting(false);
    }
  };

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
    if (!confirm(t.deleteConfirm)) return;
    const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCars(cars.filter((c) => c.id !== id));
      showFeedback("success", t.carDeleted);
    } else {
      showFeedback("error", t.deleteFailed);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(t.bulkDeleteConfirm(selectedCars.length))) return;
    await Promise.all(selectedCars.map((id) => fetch(`/api/cars/${id}`, { method: "DELETE" })));
    setSelectedCars([]);
    fetchCars();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t.heading}</h1>
          <p className="text-muted-foreground">{t.carsInInventory(cars.length)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={fetchCars}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={downloadTemplate} title={t.templateTitle}>
            <FileDown className="w-4 h-4" />
            {t.templateBtn}
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/admin/export?type=cars" download>
              <Download className="w-4 h-4" />
              {t.exportCsv}
            </a>
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file, true);
                e.target.value = "";
              }}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-input bg-background px-3 h-9 text-sm font-medium cursor-pointer hover:bg-accent",
                importing && "opacity-60 cursor-not-allowed",
              )}
              title={t.previewTitle}
            >
              <FileUp className="w-4 h-4" /> {t.previewCsv}
            </span>
          </label>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file, false);
                e.target.value = "";
              }}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 h-9 text-sm font-medium cursor-pointer hover:opacity-90",
                importing && "opacity-60 cursor-not-allowed",
              )}
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              {t.importCsv}
            </span>
          </label>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />
            {t.addCar}
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

      {importReport && importReport.errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-amber-500">
              {t.rowsSkipped(importReport.errors.length)}
            </p>
            <button
              type="button"
              onClick={() => setImportReport(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="max-h-48 overflow-auto space-y-1 text-xs text-muted-foreground">
            {importReport.errors.slice(0, 50).map((err, idx) => (
              <li key={idx}>
                <span className="font-mono text-amber-500/80">{t.rowLabel} {err.row}</span>
                {err.slug ? <span className="text-muted-foreground"> ({err.slug})</span> : null}
                : {err.message}
              </li>
            ))}
            {importReport.errors.length > 50 && (
              <li className="italic">{t.andMore(importReport.errors.length - 50)}</li>
            )}
          </ul>
        </div>
      )}

      {/* Search and filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
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
          <span className="text-sm font-medium">{t.selected(selectedCars.length)}</span>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="w-4 h-4" />
            {t.deleteBtn}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedCars([])}>
            {t.cancel}
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
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">{t.thCar}</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">{t.thPrice}</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">{t.thType}</th>
                    <th className="p-4 text-left text-xs font-semibold text-muted-foreground uppercase">{t.thStatus}</th>
                    <th className="p-4 text-right text-xs font-semibold text-muted-foreground uppercase">{t.thActions}</th>
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
                        <p className="font-semibold font-mono">{formatPrice(car.price_usd)}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{car.body_type}</Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          {car.inventory_status === "available" ? (
                            <Badge variant="success">{t.available}</Badge>
                          ) : car.inventory_status === "reserved" ? (
                            <Badge variant="secondary">{t.reserved}</Badge>
                          ) : (
                            <Badge variant="destructive">{t.sold}</Badge>
                          )}
                          {car.is_hot_offer && <Badge variant="default">{t.hot}</Badge>}
                          {car.original_price_usd && car.original_price_usd > car.price_usd && (
                            <Badge variant="outline">-{Math.round((1 - car.price_usd / car.original_price_usd) * 100)}%</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" asChild>
                            <a href={`/catalog/${car.slug}`} target="_blank">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button size="icon" variant="ghost" asChild>
                            <a href={`/api/cars/${car.id}/pdf`} download>
                              <Download className="w-4 h-4" />
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
              {t.noCarsFound}
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
  const { locale } = useLocale();
  const t = COPY[locale];
  const isEditing = !!car;
  const [saving, setSaving] = useState(false);
  const [genCopy, setGenCopy] = useState(false);
  const [brand, setBrand] = useState(car?.brand || "");
  const [model, setModel] = useState(car?.model || "");
  const [year, setYear] = useState(car?.year?.toString() || "2024");
  const [priceUsd, setPriceUsd] = useState(car?.price_usd?.toString() || "");
  const [originalPriceUsd, setOriginalPriceUsd] = useState(car?.original_price_usd?.toString() || "");
  const [bodyType, setBodyType] = useState<string>(car?.body_type || "suv");
  const [fuelType, setFuelType] = useState<string>(car?.fuel_type || "petrol");
  const [engineVolume, setEngineVolume] = useState(car?.engine_volume?.toString() || "1.5");
  const [enginePower, setEnginePower] = useState(car?.engine_power?.toString() || "");
  // AutoHome full-spec import (multi-trim spec sheet) — only when editing a saved car.
  const [specUrl, setSpecUrl] = useState("");
  const [specImporting, setSpecImporting] = useState(false);
  const [specMsg, setSpecMsg] = useState<string | null>(null);
  const importSpec = async () => {
    if (!car?.id || !specUrl.trim()) return;
    setSpecImporting(true);
    setSpecMsg(null);
    try {
      const res = await fetch(`/api/admin/cars/${car.id}/import-spec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: specUrl.trim() }),
      });
      const d = await res.json();
      setSpecMsg(d.ok ? t.specImportedOk(d.spec.trims, d.spec.paramCount, d.spec.brand, d.spec.model) : `${t.specImportFailedPrefix} ${d.message || d.error || t.importFailed}`);
    } catch {
      setSpecMsg(t.specImportFailed);
    } finally {
      setSpecImporting(false);
    }
  };
  const [transmission, setTransmission] = useState<string>(car?.transmission || "automatic");
  const [drivetrain] = useState<string>(car?.drivetrain || "fwd");
  const [color, setColor] = useState(car?.color || "");
  const [descriptionRu, setDescriptionRu] = useState(car?.description_ru || "");
  const [videoUrl, setVideoUrl] = useState(car?.video_url || "");
  const [isHotOffer, setIsHotOffer] = useState(car?.is_hot_offer || false);
  const [inventoryStatus, setInventoryStatus] = useState<string>(car?.inventory_status || "available");
  const [listingType, setListingType] = useState<string>(car?.listing_type || "new");
  const [mileage, setMileage] = useState<string>(car?.mileage != null ? String(car.mileage) : "0");
  const [vin, setVin] = useState(car?.vin || "");
  const [ownersCount, setOwnersCount] = useState<string>(car?.owners_count != null ? String(car.owners_count) : "");
  const [accidentFree, setAccidentFree] = useState<boolean>(car?.accident_free ?? false);
  const [conditionGrade, setConditionGrade] = useState<string>(car?.condition_grade || "");
  const [images, setImages] = useState<string[]>(car?.images || []);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    const uploads = Array.from(files);
    setUploadingCount((c) => c + uploads.length);
    const newUrls: string[] = [];
    for (const file of uploads) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(data?.error || t.uploadFailedFor(file.name));
        } else if (data.url) {
          newUrls.push(data.url);
        }
      } catch {
        setUploadError(t.networkErrorUploading(file.name));
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
    if (newUrls.length) setImages((prev) => [...prev, ...newUrls]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    setImages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleImageDrop = (targetIndex: number) => {
    setImages((prev) => {
      if (draggedImageIndex === null || draggedImageIndex === targetIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(draggedImageIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDraggedImageIndex(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const slug = `${brand}-${model}-${year}`.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const payload = {
      brand,
      model,
      slug,
      year: parseInt(year),
      price_usd: parseInt(priceUsd),
      original_price_usd: originalPriceUsd ? parseInt(originalPriceUsd) : null,
      body_type: bodyType,
      fuel_type: fuelType,
      engine_volume: engineVolume ? parseFloat(engineVolume) : null,
      engine_power: enginePower ? parseInt(enginePower) : null,
      transmission,
      drivetrain,
      color,
      description_ru: descriptionRu,
      video_url: videoUrl || null,
      is_hot_offer: isHotOffer,
      inventory_status: inventoryStatus,
      mileage: parseInt(mileage) || 0,
      listing_type: listingType,
      vin: listingType === "used" ? (vin || null) : null,
      owners_count: listingType === "used" && ownersCount ? parseInt(ownersCount) : null,
      accident_free: listingType === "used" ? accidentFree : null,
      condition_grade: listingType === "used" && conditionGrade ? conditionGrade : null,
      images,
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
        const data = await res.json().catch(() => ({}));
        const nextFieldErrors: Record<string, string> = {};
        const issues: Array<{ path?: unknown[]; message?: string }> =
          data?.errors ?? data?.issues ?? [];
        for (const issue of issues) {
          const key = Array.isArray(issue.path) ? String(issue.path[0] ?? "") : "";
          if (key && !nextFieldErrors[key]) nextFieldErrors[key] = issue.message || t.invalidValue;
        }
        setFieldErrors(nextFieldErrors);
        setFormError(data.error || t.failedToSave);
      }
    } catch {
      setFormError(t.networkError);
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) =>
    fieldErrors[k] ? <p className="text-xs text-red-400 mt-1">{fieldErrors[k]}</p> : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="animate-fade-in relative bg-card border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
      >
        <h2 className="text-xl font-bold mb-6">
          {isEditing ? `${t.editCarPrefix} ${car.brand} ${car.model}` : t.addNewCar}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.brand}</label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} required />
              {err("brand")}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.model}</label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} required />
              {err("model")}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.year}</label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.priceUsd}</label>
              <Input type="number" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.color}</label>
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>

          {/* Listing type (New / Used) + mileage. Used reveals disclosure fields. */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.listingType}</label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value)}
                className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="new">{t.listingNew}</option>
                <option value="used">{t.listingUsed}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.mileageKm}</label>
              <Input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} />
            </div>
          </div>

          {listingType === "used" && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <label className="text-sm font-medium mb-1 block">{t.vin}</label>
                <Input value={vin} onChange={(e) => setVin(e.target.value)} placeholder={t.vinPlaceholder} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t.owners}</label>
                <Input type="number" value={ownersCount} onChange={(e) => setOwnersCount(e.target.value)} placeholder={t.ownersPlaceholder} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t.condition}</label>
                <select value={conditionGrade} onChange={(e) => setConditionGrade(e.target.value)} className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">—</option>
                  <option value="excellent">{t.condExcellent}</option>
                  <option value="good">{t.condGood}</option>
                  <option value="fair">{t.condFair}</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={accidentFree} onChange={(e) => setAccidentFree(e.target.checked)} />
                  {t.accidentFree}
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.originalPriceUsd}</label>
              <Input type="number" value={originalPriceUsd} onChange={(e) => setOriginalPriceUsd(e.target.value)} placeholder={t.optional} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.videoUrl}</label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.bodyType}</label>
              <select
                value={bodyType}
                onChange={(e) => setBodyType(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-card text-foreground px-3 text-sm"
              >
                <option value="sedan">{t.bodySedan}</option>
                <option value="suv">{t.bodySuv}</option>
                <option value="crossover">{t.bodyCrossover}</option>
                <option value="hatchback">{t.bodyHatchback}</option>
                <option value="minivan">{t.bodyMinivan}</option>
                <option value="coupe">{t.bodyCoupe}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.fuelType}</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-card text-foreground px-3 text-sm"
              >
                <option value="petrol">{t.fuelPetrol}</option>
                <option value="electric">{t.fuelElectric}</option>
                <option value="hybrid">{t.fuelHybrid}</option>
                <option value="phev">{t.fuelPhev}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.transmission}</label>
              <select
                value={transmission}
                onChange={(e) => setTransmission(e.target.value)}
                className="w-full h-11 rounded-xl border border-border bg-card text-foreground px-3 text-sm"
              >
                <option value="automatic">{t.transAutomatic}</option>
                <option value="manual">{t.transManual}</option>
                <option value="cvt">{t.transCvt}</option>
                <option value="robot">{t.transRobot}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t.engineVolume}</label>
              <Input type="number" step="0.1" value={engineVolume} onChange={(e) => setEngineVolume(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t.enginePower}</label>
              <Input type="number" value={enginePower} onChange={(e) => setEnginePower(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">{t.descriptionRu}</label>
              {car?.id && (
                <button
                  type="button"
                  disabled={genCopy}
                  onClick={async () => {
                    setGenCopy(true);
                    try {
                      const res = await fetch(`/api/admin/cars/${car.id}/generate-copy`, { method: "POST" });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.copy?.description_ru) setDescriptionRu(data.copy.description_ru);
                    } finally {
                      setGenCopy(false);
                    }
                  }}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {genCopy ? t.generating : t.generateAi}
                </button>
              )}
            </div>
            <textarea
              value={descriptionRu}
              onChange={(e) => setDescriptionRu(e.target.value)}
              className="w-full min-h-[80px] rounded-xl border border-border px-4 py-3 text-sm resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t.images}</label>
            <div className="mb-3">
              <MediaImporter
                bucket="car-images"
                brand={brand}
                model={model}
                year={year}
                onImages={(urls) => setImages((prev) => [...prev, ...urls])}
                onVideo={(u) => setVideoUrl(u)}
                onSpec={(spec) => {
                  if (spec.year) setYear(String(spec.year));
                  if (spec.body_type) setBodyType(String(spec.body_type));
                  if (spec.fuel_type) setFuelType(String(spec.fuel_type));
                  if (spec.transmission) setTransmission(String(spec.transmission));
                  if (spec.engine_volume != null) setEngineVolume(String(spec.engine_volume));
                  if (spec.engine_power != null) setEnginePower(String(spec.engine_power));
                  if (spec.color) setColor(String(spec.color));
                }}
              />
            </div>
            {isEditing && (
              <div className="mb-3 rounded-[2px] border border-border bg-[var(--bg-3)]/50 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {t.fullSpecSheet}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={specUrl}
                    onChange={(e) => setSpecUrl(e.target.value)}
                    placeholder={t.specUrlPlaceholder}
                    className="flex-1 text-sm"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={importSpec} disabled={specImporting || !specUrl.trim()}>
                    {specImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : t.importSpec}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t.specHelp}
                </p>
                {specMsg && <p className="text-xs text-primary">{specMsg}</p>}
              </div>
            )}
            <label
              className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:border-lime/50 transition-colors text-sm text-muted-foreground"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
            >
              <Upload className="w-4 h-4" />
              {uploadingCount > 0
                ? t.uploading(uploadingCount)
                : t.uploadHint}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadError && (
              <p className="text-xs text-red-400 mt-2">{uploadError}</p>
            )}
            {images.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative group rounded-lg overflow-hidden border border-white/10 cursor-grab"
                    draggable
                    onDragStart={() => setDraggedImageIndex(idx)}
                    onDragEnd={() => setDraggedImageIndex(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleImageDrop(idx)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-24 object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-lime text-navy text-[10px] font-bold px-1.5 py-0.5 rounded">{t.cover}</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => moveImage(idx, -1)}
                        disabled={idx === 0}
                        className="text-white disabled:opacity-30 p-1"
                        title={t.moveLeft}
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="text-red-300 hover:text-red-200 p-1"
                        title={t.remove}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 1)}
                        disabled={idx === images.length - 1}
                        className="text-white disabled:opacity-30 p-1"
                        title={t.moveRight}
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isHotOffer}
                onChange={(e) => setIsHotOffer(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{t.hotOffer}</span>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t.inventoryStatus}</label>
            <select
              value={inventoryStatus}
              onChange={(e) => setInventoryStatus(e.target.value)}
              className="w-full h-11 rounded-xl border border-border px-3 text-sm"
            >
              <option value="available">{t.invAvailable}</option>
              <option value="reserved">{t.invReserved}</option>
              <option value="sold">{t.invSold}</option>
            </select>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-3 py-2 rounded-lg">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>{t.cancel}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditing ? t.updateCar : t.addCar}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

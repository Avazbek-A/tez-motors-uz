"use client";

import { useState } from "react";
import { Save, Globe, Phone, Mail, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_CONFIG } from "@/lib/constants";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    siteName: SITE_CONFIG.name,
    phone: SITE_CONFIG.phone,
    email: SITE_CONFIG.email,
    address: SITE_CONFIG.address,
    telegram: SITE_CONFIG.telegram,
    instagram: SITE_CONFIG.instagram,
    whatsapp: SITE_CONFIG.whatsapp,
    workingHours: SITE_CONFIG.workingHours,
    telegramBotToken: "",
    telegramChatId: "",
  });

  const handleSave = () => {
    alert("Settings saved (mock). In production, this would update the database.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your website settings</p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Site Name</label>
            <Input
              value={settings.siteName}
              onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Working Hours</label>
            <Input
              value={settings.workingHours}
              onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Phone</label>
            <Input
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Address</label>
            <Input
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Social Media & Messengers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Telegram</label>
            <Input
              value={settings.telegram}
              onChange={(e) => setSettings({ ...settings, telegram: e.target.value })}
              placeholder="https://t.me/..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Instagram</label>
            <Input
              value={settings.instagram}
              onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
              placeholder="https://instagram.com/..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">WhatsApp</label>
            <Input
              value={settings.whatsapp}
              onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
              placeholder="https://wa.me/..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Telegram Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Configure Telegram bot to receive notifications when new inquiries are submitted.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Bot Token</label>
            <Input
              type="password"
              value={settings.telegramBotToken}
              onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
              placeholder="123456:ABC-DEF..."
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Chat ID</label>
            <Input
              value={settings.telegramChatId}
              onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
              placeholder="-1001234567890"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>
          <Save className="w-5 h-5" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}

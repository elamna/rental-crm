"use client";

import { create } from "zustand";
import { Client, InventoryCheck, InventoryItem, Kit, Rental, Service, WorkshopTicket } from "./types";

interface ActivityEntry {
  id: string;
  text: string;
  time: string;
}

interface AppState {
  clients: Client[];
  rentals: Rental[];
  inventory: InventoryItem[];
  kits: Kit[];
  services: Service[];
  inventoryChecks: InventoryCheck[];
  workshopTickets: WorkshopTicket[];
  activity: ActivityEntry[];
  hydrated: boolean;
  hydrating: boolean;

  hydrate: () => Promise<void>;
  refreshActivity: () => Promise<void>;

  addClient: (
    input: Partial<Client>
  ) => Promise<Client>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  importClients: (rows: Partial<Client>[]) => Promise<{ added: number; skipped: number }>;

  addInventoryItem: (input: Partial<InventoryItem> & { quantity?: number }) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;

  addKit: (input: Partial<Kit>) => Promise<Kit>;
  updateKit: (id: string, patch: Partial<Kit>) => Promise<void>;
  deleteKit: (id: string) => Promise<void>;

  addService: (input: Partial<Service>) => Promise<Service>;
  updateService: (id: string, patch: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;

  addInventoryCheck: (input: Partial<InventoryCheck>) => Promise<void>;

  addRental: (rental: Rental) => Promise<Rental>;
  updateRental: (id: string, patch: Partial<Rental>) => Promise<void>;

  addWorkshopTicket: (input: Partial<WorkshopTicket>) => Promise<WorkshopTicket>;
  updateWorkshopTicket: (id: string, patch: Partial<WorkshopTicket>) => Promise<void>;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка запроса: ${res.status}`);
  }
  return res.json();
}

export const useAppStore = create<AppState>((set, get) => ({
  clients: [],
  rentals: [],
  inventory: [],
  kits: [],
  services: [],
  inventoryChecks: [],
  workshopTickets: [],
  activity: [],
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (get().hydrated || get().hydrating) return;
    set({ hydrating: true });
    try {
      const [clients, rentals, inventory, kits, services, inventoryChecks, workshopTickets, activity] = await Promise.all([
        api<Client[]>("/api/clients"),
        api<Rental[]>("/api/rentals"),
        api<InventoryItem[]>("/api/inventory"),
        api<Kit[]>("/api/kits"),
        api<Service[]>("/api/services"),
        api<InventoryCheck[]>("/api/inventory-checks"),
        api<WorkshopTicket[]>("/api/workshop"),
        api<ActivityEntry[]>("/api/activity"),
      ]);
      set({ clients, rentals, inventory, kits, services, inventoryChecks, workshopTickets, activity, hydrated: true, hydrating: false });
    } catch (err) {
      console.error("Не удалось загрузить данные с сервера", err);
      set({ hydrating: false });
    }
  },

  refreshActivity: async () => {
    const activity = await api<ActivityEntry[]>("/api/activity");
    set({ activity });
  },

  addClient: async (input) => {
    const client = await api<Client>("/api/clients", { method: "POST", body: JSON.stringify(input) });
    set((s) => ({ clients: [client, ...s.clients] }));
    get().refreshActivity();
    return client;
  },

  updateClient: async (id, patch) => {
    const client = await api<Client>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? client : c)) }));
  },

  deleteClient: async (id) => {
    await api(`/api/clients/${id}`, { method: "DELETE" });
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
    get().refreshActivity();
  },

  importClients: async (rows) => {
    const result = await api<{ added: number; skipped: number }>("/api/clients/import", {
      method: "POST",
      body: JSON.stringify(rows),
    });
    const clients = await api<Client[]>("/api/clients");
    set({ clients });
    get().refreshActivity();
    return result;
  },

  addInventoryItem: async (input) => {
    // При quantity > 1 сервер возвращает массив созданных единиц
    const created = await api<InventoryItem | InventoryItem[]>("/api/inventory", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const items = Array.isArray(created) ? created : [created];
    set((s) => ({ inventory: [...items, ...s.inventory] }));
    get().refreshActivity();
    return items[0];
  },

  updateInventoryItem: async (id, patch) => {
    const item = await api<InventoryItem>(`/api/inventory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? item : i)) }));
  },

  deleteInventoryItem: async (id) => {
    await api(`/api/inventory/${id}`, { method: "DELETE" });
    set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) }));
  },

  addKit: async (input) => {
    const kit = await api<Kit>("/api/kits", { method: "POST", body: JSON.stringify(input) });
    set((s) => ({ kits: [kit, ...s.kits] }));
    get().refreshActivity();
    return kit;
  },

  updateKit: async (id, patch) => {
    const kit = await api<Kit>(`/api/kits/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ kits: s.kits.map((k) => (k.id === id ? kit : k)) }));
  },

  deleteKit: async (id) => {
    await api(`/api/kits/${id}`, { method: "DELETE" });
    set((s) => ({ kits: s.kits.filter((k) => k.id !== id) }));
  },

  addService: async (input) => {
    const service = await api<Service>("/api/services", { method: "POST", body: JSON.stringify(input) });
    set((s) => ({ services: [service, ...s.services] }));
    get().refreshActivity();
    return service;
  },

  updateService: async (id, patch) => {
    const service = await api<Service>(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ services: s.services.map((x) => (x.id === id ? service : x)) }));
  },

  deleteService: async (id) => {
    await api(`/api/services/${id}`, { method: "DELETE" });
    set((s) => ({ services: s.services.filter((x) => x.id !== id) }));
  },

  addInventoryCheck: async (input) => {
    const check = await api<InventoryCheck>("/api/inventory-checks", { method: "POST", body: JSON.stringify(input) });
    // «Сломан» может перевести единицу в ремонт — перечитываем каталог
    const inventory = await api<InventoryItem[]>("/api/inventory");
    set((s) => ({ inventoryChecks: [check, ...s.inventoryChecks], inventory }));
  },

  addRental: async (rental) => {
    const created = await api<Rental>("/api/rentals", { method: "POST", body: JSON.stringify(rental) });
    set((s) => ({ rentals: [created, ...s.rentals] }));
    // Позиции с привязкой к каталогу переходят в статус "в аренде" — обновим локальный кэш каталога.
    const inventory = await api<InventoryItem[]>("/api/inventory");
    const clients = await api<Client[]>("/api/clients");
    set({ inventory, clients });
    get().refreshActivity();
    return created;
  },

  updateRental: async (id, patch) => {
    const updated = await api<Rental>(`/api/rentals/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ rentals: s.rentals.map((r) => (r.id === id ? updated : r)) }));
    const inventory = await api<InventoryItem[]>("/api/inventory");
    set({ inventory });
  },

  addWorkshopTicket: async (input) => {
    const ticket = await api<WorkshopTicket>("/api/workshop", { method: "POST", body: JSON.stringify(input) });
    const inventory = await api<InventoryItem[]>("/api/inventory");
    set((s) => ({ workshopTickets: [ticket, ...s.workshopTickets], inventory }));
    get().refreshActivity();
    return ticket;
  },

  updateWorkshopTicket: async (id, patch) => {
    const ticket = await api<WorkshopTicket>(`/api/workshop/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    const inventory = await api<InventoryItem[]>("/api/inventory");
    set((s) => ({ workshopTickets: s.workshopTickets.map((t) => (t.id === id ? ticket : t)), inventory }));
  },
}));

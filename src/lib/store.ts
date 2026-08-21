"use client";

import { create } from "zustand";
import { Client, InventoryItem, Rental, WorkshopTicket } from "./types";

interface ActivityEntry {
  id: string;
  text: string;
  time: string;
}

interface AppState {
  clients: Client[];
  rentals: Rental[];
  inventory: InventoryItem[];
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

  addInventoryItem: (input: Partial<InventoryItem>) => Promise<InventoryItem>;
  updateInventoryItem: (id: string, patch: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;

  addRental: (rental: Rental) => Promise<void>;
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
  workshopTickets: [],
  activity: [],
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (get().hydrated || get().hydrating) return;
    set({ hydrating: true });
    try {
      const [clients, rentals, inventory, workshopTickets, activity] = await Promise.all([
        api<Client[]>("/api/clients"),
        api<Rental[]>("/api/rentals"),
        api<InventoryItem[]>("/api/inventory"),
        api<WorkshopTicket[]>("/api/workshop"),
        api<ActivityEntry[]>("/api/activity"),
      ]);
      set({ clients, rentals, inventory, workshopTickets, activity, hydrated: true, hydrating: false });
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
    const item = await api<InventoryItem>("/api/inventory", { method: "POST", body: JSON.stringify(input) });
    set((s) => ({ inventory: [item, ...s.inventory] }));
    get().refreshActivity();
    return item;
  },

  updateInventoryItem: async (id, patch) => {
    const item = await api<InventoryItem>(`/api/inventory/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    set((s) => ({ inventory: s.inventory.map((i) => (i.id === id ? item : i)) }));
  },

  deleteInventoryItem: async (id) => {
    await api(`/api/inventory/${id}`, { method: "DELETE" });
    set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) }));
  },

  addRental: async (rental) => {
    const created = await api<Rental>("/api/rentals", { method: "POST", body: JSON.stringify(rental) });
    set((s) => ({ rentals: [created, ...s.rentals] }));
    // Позиции с привязкой к каталогу переходят в статус "в аренде" — обновим локальный кэш каталога.
    const inventory = await api<InventoryItem[]>("/api/inventory");
    const clients = await api<Client[]>("/api/clients");
    set({ inventory, clients });
    get().refreshActivity();
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

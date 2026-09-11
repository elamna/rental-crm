"use client";

import { create } from "zustand";
import { DEFAULT_BRANCHES } from "./mock-data";
import { Client, ImportReport, InventoryCheck, InventoryItem, Kit, Rental, Service, WorkshopTicket, PaymentMethod } from "./types";


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
  /** Пункты проката: список в настройках, а не в коде */
  branches: string[];
  hydrated: boolean;
  hydrating: boolean;

  hydrate: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  saveBranches: (list: string[]) => Promise<string[]>;

  addClient: (
    input: Partial<Client>
  ) => Promise<Client>;
  updateClient: (id: string, patch: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  /** Массовое удаление клиентов. withRentals — забрать заодно и их аренды */
  deleteClients: (
    ids: string[],
    withRentals?: boolean
  ) => Promise<{ deleted: number; deletedRentals: number; skipped: { id: string; name: string; rentals: number }[] }>;
  importClients: (rows: Partial<Client>[]) => Promise<ImportReport>;
  /** Импорт истории аренд: клиенты и позиции подтягиваются по телефону и артикулу */
  importRentals: (
    rows: unknown[]
  ) => Promise<ImportReport & { clientsCreated: number; itemsLinked: number; itemsCreated: number; itemsUnmatched: number }>;
  /** Импорт каталога из выгрузки: строка файла разворачивается в несколько единиц */
  importInventoryItems: (
    rows: (Partial<InventoryItem> & { quantity?: number })[],
    opts?: { allowDuplicateSku?: boolean }
  ) => Promise<ImportReport & { units: number }>;

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

  addRental: (rental: Rental, payments?: { amount: number; method: PaymentMethod }[]) => Promise<Rental>;
  updateRental: (id: string, patch: Partial<Rental>) => Promise<void>;
  /** Массовое удаление аренд: чистка тестовых записей одной операцией */
  deleteRentals: (ids: string[]) => Promise<{ deleted: number }>;

  addWorkshopTicket: (input: Partial<WorkshopTicket>) => Promise<WorkshopTicket>;
  updateWorkshopTicket: (id: string, patch: Partial<WorkshopTicket>) => Promise<void>;
  deleteWorkshopTicket: (id: string) => Promise<void>;
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
  // До загрузки с сервера формы не должны остаться с пустым списком пунктов
  branches: DEFAULT_BRANCHES,
  hydrated: false,
  hydrating: false,

  hydrate: async () => {
    if (get().hydrated || get().hydrating) return;
    set({ hydrating: true });
    // Раздел, закрытый правами, отвечает 401 — и раньше это роняло всю загрузку:
    // менеджер без доступа к мастерской видел пустой каталог, пустых клиентов
    // и пустые аренды. Каждый источник теперь падает сам за себя
    const load = async <T>(url: string): Promise<T[]> => {
      try {
        return await api<T[]>(url);
      } catch {
        return [];
      }
    };

    try {
      const [clients, rentals, inventory, kits, services, inventoryChecks, workshopTickets, activity, branches] = await Promise.all([
        load<Client>("/api/clients"),
        load<Rental>("/api/rentals"),
        load<InventoryItem>("/api/inventory"),
        load<Kit>("/api/kits"),
        load<Service>("/api/services"),
        load<InventoryCheck>("/api/inventory-checks"),
        load<WorkshopTicket>("/api/workshop"),
        load<ActivityEntry>("/api/activity"),
        load<string>("/api/branches"),
      ]);
      set({
        clients, rentals, inventory, kits, services, inventoryChecks, workshopTickets, activity,
        // Пустой ответ бывает, если раздел закрыт правами — тогда оставляем
        // прежний список, иначе формы останутся без пунктов проката
        branches: branches.length ? branches : get().branches,
        hydrated: true,
        hydrating: false,
      });
    } catch (err) {
      console.error("Не удалось загрузить данные с сервера", err);
      set({ hydrating: false });
    }
  },

  refreshActivity: async () => {
    const activity = await api<ActivityEntry[]>("/api/activity");
    set({ activity });
  },

  saveBranches: async (list) => {
    const branches = await api<string[]>("/api/branches", {
      method: "PUT",
      body: JSON.stringify({ branches: list }),
    });
    set({ branches });
    get().refreshActivity();
    return branches;
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

  deleteClients: async (ids, withRentals) => {
    const result = await api<{ deleted: number; deletedRentals: number; skipped: { id: string; name: string; rentals: number }[] }>(
      "/api/clients/bulk-delete",
      { method: "POST", body: JSON.stringify({ ids, withRentals: !!withRentals }) }
    );
    // Из списка убираем только тех, кого действительно удалили
    const skipped = new Set(result.skipped.map((x) => x.id));
    const removed = new Set(ids.filter((id) => !skipped.has(id)));
    set((s) => ({
      clients: s.clients.filter((c) => !removed.has(c.id)),
      rentals: s.rentals.filter((r) => !removed.has(r.client.id)),
    }));
    if (result.deletedRentals > 0) {
      const inventory = await api<InventoryItem[]>("/api/inventory");
      set({ inventory });
    }
    get().refreshActivity();
    return result;
  },

  importClients: async (rows) => {
    const result = await api<ImportReport>("/api/clients/import", {
      method: "POST",
      body: JSON.stringify(rows),
    });
    const clients = await api<Client[]>("/api/clients");
    set({ clients });
    get().refreshActivity();
    return result;
  },

  importRentals: async (rows) => {
    const result = await api<
      ImportReport & { clientsCreated: number; itemsLinked: number; itemsCreated: number; itemsUnmatched: number }
    >(
      "/api/rentals/import",
      { method: "POST", body: JSON.stringify(rows) }
    );
    // Импорт трогает аренды, клиентов и занятость инвентаря — перечитываем всё три
    const [rentals, clients, inventory] = await Promise.all([
      api<Rental[]>("/api/rentals"),
      api<Client[]>("/api/clients"),
      api<InventoryItem[]>("/api/inventory"),
    ]);
    set({ rentals, clients, inventory });
    get().refreshActivity();
    return result;
  },

  importInventoryItems: async (rows, opts) => {
    const result = await api<ImportReport & { units: number }>("/api/inventory/import", {
      method: "POST",
      body: JSON.stringify({ rows, allowDuplicateSku: !!opts?.allowDuplicateSku }),
    });
    const inventory = await api<InventoryItem[]>("/api/inventory");
    set({ inventory });
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

  addRental: async (rental, payments = []) => {
    // Платежи идут тем же запросом: чек должен появиться вместе с арендой,
    // а не отдельным вызовом, который может не дойти
    const created = await api<Rental>("/api/rentals", { method: "POST", body: JSON.stringify({ ...rental, payments }) });
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

  deleteRentals: async (ids) => {
    const result = await api<{ deleted: number }>("/api/rentals/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    const removed = new Set(ids);
    set((s) => ({ rentals: s.rentals.filter((r) => !removed.has(r.id)) }));
    // Инвентарь освободился, а у клиентов пересчитались статистика и рейтинг
    const [inventory, clients] = await Promise.all([
      api<InventoryItem[]>("/api/inventory"),
      api<Client[]>("/api/clients"),
    ]);
    set({ inventory, clients });
    get().refreshActivity();
    return result;
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

  deleteWorkshopTicket: async (id) => {
    await api(`/api/workshop/${id}`, { method: "DELETE" });
    set((s) => ({ workshopTickets: s.workshopTickets.filter((t) => t.id !== id) }));
  },
}));

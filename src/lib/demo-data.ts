import type {
  EggType,
  Expense,
  PaymentMethod,
  Profile,
  RestockDelivery,
  StockLoss,
  UserRole,
} from "@/types/database";

export const DEMO_ACCOUNTS: Record<
  UserRole,
  { email: string; password: string; profile: Profile }
> = {
  owner: {
    email: "owner@berkahtelurjaya.demo",
    password: "demo1234",
    profile: {
      id: "11111111-1111-4111-8111-111111111111",
      full_name: "Pak Budi Santoso",
      role: "owner",
      whatsapp_number: "6281234567801",
      created_at: new Date().toISOString(),
    },
  },
  staff: {
    email: "staff@berkahtelurjaya.demo",
    password: "demo1234",
    profile: {
      id: "22222222-2222-4222-8222-222222222222",
      full_name: "Lala",
      role: "staff",
      whatsapp_number: "6281234567802",
      created_at: new Date().toISOString(),
    },
  },
};

export const DEMO_EGG_TYPES: EggType[] = [
  {
    id: "aaaa1111-1111-4111-8111-111111111111",
    name: "Telur Ayam Negeri",
    price_per_kg: 28500,
    cost_per_kg: 25500,
    stock_kg: 22.5,
    min_stock_kg: 30,
    kg_per_peti: 15,
    distributor_wa: "6281390001122",
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: "aaaa2222-2222-4222-8222-222222222222",
    name: "Telur Omega 3",
    price_per_kg: 34000,
    cost_per_kg: 29500,
    stock_kg: 42,
    min_stock_kg: 20,
    kg_per_peti: 15,
    distributor_wa: "6281390001122",
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: "aaaa3333-3333-4333-8333-333333333333",
    name: "Telur Ayam Kampung",
    price_per_kg: 48000,
    cost_per_kg: 41000,
    stock_kg: 11.5,
    min_stock_kg: 10,
    kg_per_peti: 10,
    distributor_wa: "6281390003344",
    is_active: true,
    updated_at: new Date().toISOString(),
  },
  {
    id: "aaaa4444-4444-4444-8444-444444444444",
    name: "Telur Bebek Mentah",
    price_per_kg: 38000,
    cost_per_kg: 32500,
    stock_kg: 26,
    min_stock_kg: 15,
    kg_per_peti: 15,
    distributor_wa: "6281390003344",
    is_active: true,
    updated_at: new Date().toISOString(),
  },
];

export const LOCAL_DEMO_COOKIE = "lapak_telur_demo_role";

function daysAndHoursAgoIso(daysAgo: number, hourWib: number): string {
  const now = new Date();
  const base = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(base);
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  const hh = String(hourWib).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${hh}:15:00+07:00`).toISOString();
}

export function buildDemoRestockDeliveries(): RestockDelivery[] {
  return [
    {
      id: "rrrr1111-1111-4111-8111-111111111111",
      egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
      peti_count: 5,
      qty_kg: 75,
      cost_per_kg: 25500,
      supplier_name: "Gudang Jaya Telur",
      driver_name: "Pak Slamet",
      broken_kg: 0.5,
      notes: "Kiriman pagi, 3 butir retak di peti atas",
      received_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(0, 7),
    },
    {
      id: "rrrr2222-2222-4222-8222-222222222222",
      egg_type_id: "aaaa2222-2222-4222-8222-222222222222",
      peti_count: 3,
      qty_kg: 45,
      cost_per_kg: 29500,
      supplier_name: "Gudang Jaya Telur",
      driver_name: "Mas Hendra",
      broken_kg: 0,
      notes: "Aman semua",
      received_by: "11111111-1111-4111-8111-111111111111",
      created_at: daysAndHoursAgoIso(1, 8),
    },
  ];
}

export function buildDemoStockLosses(): StockLoss[] {
  return [
    {
      id: "llll1111-1111-4111-8111-111111111111",
      egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
      qty_kg: 0.5,
      cost_loss: 12750,
      reason: "pecah_lapak",
      recorded_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(0, 11),
    },
    {
      id: "llll2222-2222-4222-8222-222222222222",
      egg_type_id: "aaaa3333-3333-4333-8333-333333333333",
      qty_kg: 0.25,
      cost_loss: 10250,
      reason: "busuk",
      recorded_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(1, 15),
    },
  ];
}

export function buildDemoExpenses(): Expense[] {
  return [
    {
      id: "eeee1111-1111-4111-8111-111111111111",
      amount: 18000,
      category: "plastik",
      notes: "Plastik kresek tanggung 1 pack",
      recorded_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(0, 8),
    },
    {
      id: "eeee2222-2222-4222-8222-222222222222",
      amount: 5000,
      category: "parkir",
      notes: "Retribusi & kebersihan toko",
      recorded_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(0, 10),
    },
    {
      id: "eeee3333-3333-4333-8333-333333333333",
      amount: 15000,
      category: "konsumsi",
      notes: "Makan siang & es teh staff",
      recorded_by: "22222222-2222-4222-8222-222222222222",
      created_at: daysAndHoursAgoIso(0, 12),
    },
  ];
}

export interface SaleHistoryItem {
  id: string;
  egg_type_id: string;
  egg_name: string;
  qty_kg: number;
  unit_label: string;
  is_cracked: boolean;
  price_per_kg: number;
  cost_per_kg: number;
  subtotal: number;
}

export interface SaleWithItems {
  id: string;
  total_amount: number;
  total_cost: number;
  payment_method: PaymentMethod;
  cash_received: number;
  change_amount: number;
  created_at: string;
  items: SaleHistoryItem[];
}

export interface DailyChartPoint {
  dateKey: string;
  revenue: number;
  profit: number;
  kgSold: number;
}

export function buildDemoSalesHistory(): SaleWithItems[] {
  return [
    {
      id: "sale-demo-01",
      total_amount: 57000,
      total_cost: 51000,
      payment_method: "cash",
      cash_received: 100000,
      change_amount: 43000,
      created_at: daysAndHoursAgoIso(0, 8),
      items: [
        {
          id: "si-01",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 2,
          unit_label: "2 kg",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 57000,
        },
      ],
    },
    {
      id: "sale-demo-02",
      total_amount: 427500,
      total_cost: 382500,
      payment_method: "transfer",
      cash_received: 0,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(0, 9),
      items: [
        {
          id: "si-02",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 15,
          unit_label: "1 Peti (15 kg)",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 427500,
        },
      ],
    },
    {
      id: "sale-demo-03",
      total_amount: 102000,
      total_cost: 88500,
      payment_method: "qris",
      cash_received: 0,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(0, 10),
      items: [
        {
          id: "si-03",
          egg_type_id: "aaaa2222-2222-4222-8222-222222222222",
          egg_name: "Telur Omega 3",
          qty_kg: 3,
          unit_label: "3 kg",
          is_cracked: false,
          price_per_kg: 34000,
          cost_per_kg: 29500,
          subtotal: 102000,
        },
      ],
    },
    {
      id: "sale-demo-04",
      total_amount: 20000,
      total_cost: 17850,
      payment_method: "cash",
      cash_received: 20000,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(0, 11),
      items: [
        {
          id: "si-04",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 0.7,
          unit_label: "Rp 20.000",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 20000,
        },
      ],
    },
    {
      id: "sale-demo-05",
      total_amount: 148000,
      total_cost: 126500,
      payment_method: "cash",
      cash_received: 150000,
      change_amount: 2000,
      created_at: daysAndHoursAgoIso(0, 13),
      items: [
        {
          id: "si-05a",
          egg_type_id: "aaaa3333-3333-4333-8333-333333333333",
          egg_name: "Telur Ayam Kampung",
          qty_kg: 1.5,
          unit_label: "1,5 kg",
          is_cracked: false,
          price_per_kg: 48000,
          cost_per_kg: 41000,
          subtotal: 72000,
        },
        {
          id: "si-05b",
          egg_type_id: "aaaa4444-4444-4444-8444-444444444444",
          egg_name: "Telur Bebek Mentah",
          qty_kg: 2,
          unit_label: "2 kg",
          is_cracked: false,
          price_per_kg: 38000,
          cost_per_kg: 32500,
          subtotal: 76000,
        },
      ],
    },
    {
      id: "sale-demo-06",
      total_amount: 20000,
      total_cost: 25500,
      payment_method: "cash",
      cash_received: 50000,
      change_amount: 30000,
      created_at: daysAndHoursAgoIso(0, 14),
      items: [
        {
          id: "si-06",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 1,
          unit_label: "Retak (1 kg)",
          is_cracked: true,
          price_per_kg: 20000,
          cost_per_kg: 25500,
          subtotal: 20000,
        },
      ],
    },
    {
      id: "sale-demo-07",
      total_amount: 513000,
      total_cost: 459000,
      payment_method: "cash",
      cash_received: 520000,
      change_amount: 7000,
      created_at: daysAndHoursAgoIso(1, 10),
      items: [
        {
          id: "si-07",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 18,
          unit_label: "18 kg",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 513000,
        },
      ],
    },
    {
      id: "sale-demo-08",
      total_amount: 612000,
      total_cost: 531000,
      payment_method: "qris",
      cash_received: 0,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(2, 11),
      items: [
        {
          id: "si-08",
          egg_type_id: "aaaa2222-2222-4222-8222-222222222222",
          egg_name: "Telur Omega 3",
          qty_kg: 18,
          unit_label: "18 kg",
          is_cracked: false,
          price_per_kg: 34000,
          cost_per_kg: 29500,
          subtotal: 612000,
        },
      ],
    },
    {
      id: "sale-demo-09",
      total_amount: 855000,
      total_cost: 765000,
      payment_method: "transfer",
      cash_received: 0,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(3, 9),
      items: [
        {
          id: "si-09",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 30,
          unit_label: "2 Peti (30 kg)",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 855000,
        },
      ],
    },
    {
      id: "sale-demo-10",
      total_amount: 712500,
      total_cost: 637500,
      payment_method: "cash",
      cash_received: 720000,
      change_amount: 7500,
      created_at: daysAndHoursAgoIso(4, 15),
      items: [
        {
          id: "si-10",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 25,
          unit_label: "25 kg",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 712500,
        },
      ],
    },
    {
      id: "sale-demo-11",
      total_amount: 980000,
      total_cost: 840000,
      payment_method: "cash",
      cash_received: 1000000,
      change_amount: 20000,
      created_at: daysAndHoursAgoIso(5, 10),
      items: [
        {
          id: "si-11",
          egg_type_id: "aaaa4444-4444-4444-8444-444444444444",
          egg_name: "Telur Bebek Mentah",
          qty_kg: 25.8,
          unit_label: "25,8 kg",
          is_cracked: false,
          price_per_kg: 38000,
          cost_per_kg: 32500,
          subtotal: 980000,
        },
      ],
    },
    {
      id: "sale-demo-12",
      total_amount: 684000,
      total_cost: 612000,
      payment_method: "qris",
      cash_received: 0,
      change_amount: 0,
      created_at: daysAndHoursAgoIso(6, 12),
      items: [
        {
          id: "si-12",
          egg_type_id: "aaaa1111-1111-4111-8111-111111111111",
          egg_name: "Telur Ayam Negeri",
          qty_kg: 24,
          unit_label: "24 kg",
          is_cracked: false,
          price_per_kg: 28500,
          cost_per_kg: 25500,
          subtotal: 684000,
        },
      ],
    },
  ];
}

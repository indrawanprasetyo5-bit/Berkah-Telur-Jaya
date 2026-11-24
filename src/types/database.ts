export type UserRole = "owner" | "staff";
export type PaymentMethod = "cash" | "qris" | "transfer";
export type StockLossReason = "pecah_lapak" | "busuk" | "lainnya";
export type ExpenseCategory = "plastik" | "parkir" | "konsumsi" | "lainnya";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  whatsapp_number: string | null;
  created_at: string;
};

export type EggType = {
  id: string;
  name: string;
  price_per_kg: number;
  cost_per_kg: number;
  stock_kg: number;
  min_stock_kg: number;
  kg_per_peti: number;
  distributor_wa: string | null;
  is_active: boolean;
  updated_at: string;
};

export type Sale = {
  id: string;
  cashier_id: string;
  total_amount: number;
  total_cost: number;
  payment_method: PaymentMethod;
  cash_received: number;
  change_amount: number;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  egg_type_id: string;
  qty_kg: number;
  unit_label: string;
  is_cracked: boolean;
  price_per_kg: number;
  cost_per_kg: number;
  subtotal: number;
};

export type RestockDelivery = {
  id: string;
  egg_type_id: string;
  peti_count: number;
  qty_kg: number;
  cost_per_kg: number;
  supplier_name: string;
  driver_name: string | null;
  broken_kg: number;
  notes: string | null;
  received_by: string;
  created_at: string;
};

export type StockLoss = {
  id: string;
  egg_type_id: string;
  qty_kg: number;
  cost_loss: number;
  reason: StockLossReason;
  recorded_by: string;
  created_at: string;
};

export type Expense = {
  id: string;
  amount: number;
  category: ExpenseCategory;
  notes: string | null;
  recorded_by: string;
  created_at: string;
};

export type DailyClosing = {
  id: string;
  closing_date: string;
  expected_cash: number;
  actual_cash: number;
  total_expenses: number;
  qris_total: number;
  transfer_total: number;
  total_revenue: number;
  total_profit: number;
  notes: string | null;
  closed_by: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Omit<Profile, "id" | "created_at">>;
        Relationships: [];
      };
      egg_types: {
        Row: EggType;
        Insert: Omit<EggType, "id" | "updated_at"> & {
          id?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<EggType, "id">>;
        Relationships: [];
      };
      sales: {
        Row: Sale;
        Insert: Omit<Sale, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Sale, "id" | "created_at">>;
        Relationships: [];
      };
      sale_items: {
        Row: SaleItem;
        Insert: Omit<SaleItem, "id"> & { id?: string };
        Update: Partial<Omit<SaleItem, "id">>;
        Relationships: [];
      };
      restock_deliveries: {
        Row: RestockDelivery;
        Insert: Omit<RestockDelivery, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<RestockDelivery, "id" | "created_at">>;
        Relationships: [];
      };
      stock_losses: {
        Row: StockLoss;
        Insert: Omit<StockLoss, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<StockLoss, "id" | "created_at">>;
        Relationships: [];
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Expense, "id" | "created_at">>;
        Relationships: [];
      };
      daily_closings: {
        Row: DailyClosing;
        Insert: Omit<DailyClosing, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<DailyClosing, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

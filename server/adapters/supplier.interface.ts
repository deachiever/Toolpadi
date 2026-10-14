export interface SupplierProductItem {
  id: number | string;
  name: string;
  description?: string;
  description_text?: string;
  price_usdt: number;
  base_price_usdt?: number | null;
  stock: number;
  available: boolean;
  unlimited: boolean;
  raw?: any;
}

export interface SupplierBalanceInfo {
  balance_usdt: number;
  currency: string;
  key_prefix?: string;
  status?: string;
  rate_limit_per_min?: number;
  last_checked: string;
}

export interface SupplierSyncResult {
  provider_id: string;
  provider_name: string;
  success: boolean;
  total_received: number;
  new_items_added: number;
  existing_items_updated: number;
  absent_items_disabled: number;
  error?: string;
  synced_at: string;
}

export interface ISupplierAdapter {
  readonly providerId: string;
  readonly providerName: string;

  isConfigured(): boolean;
  fetchCatalogue(): Promise<{ products: SupplierProductItem[]; raw?: any }>;
  getBalance(): Promise<SupplierBalanceInfo>;
}

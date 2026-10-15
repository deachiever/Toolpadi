import { logger } from '../utils/logger.js';
import type { ISupplierAdapter, SupplierProductItem, SupplierBalanceInfo } from '../adapters/supplier.interface.js';

const DEFAULT_INSIGHT_BASE_URL = 'https://api.insightxpro.store';

export class InsightXProClient implements ISupplierAdapter {
  readonly providerId = 'insightxpro';
  readonly providerName = 'InsightXPro Reseller API';

  private customApiKey: string | null = null;
  private customBaseUrl: string | null = null;

  setCredentials(apiKey: string | null, baseUrl?: string | null): void {
    if (apiKey !== undefined) {
      this.customApiKey = apiKey && apiKey.trim().length > 0 ? apiKey.trim() : null;
    }
    if (baseUrl !== undefined) {
      this.customBaseUrl = baseUrl && baseUrl.trim().length > 0 ? baseUrl.trim() : null;
    }
  }

  getBaseUrl(): string {
    return this.customBaseUrl || process.env.INSIGHT_API_BASE_URL || DEFAULT_INSIGHT_BASE_URL;
  }

  getApiKey(): string | null {
    if (this.customApiKey && this.customApiKey.trim() !== '') {
      return this.customApiKey.trim();
    }
    const envKey = process.env.INSIGHT_API_KEY;
    if (!envKey || envKey.trim() === '' || envKey === 'YOUR_INSIGHTXPRO_API_KEY_HERE') {
      return null;
    }
    return envKey.trim();
  }

  getMaskedKey(): string | null {
    const key = this.getApiKey();
    if (!key) return null;
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  }

  isConfigured(): boolean {
    return this.getApiKey() !== null;
  }

  /**
   * Tests live connection against the InsightXPro API and measures round-trip latency.
   */
  async testConnection(candidateApiKey?: string, candidateBaseUrl?: string): Promise<{
    success: boolean;
    status_code: number;
    latency_ms: number;
    message: string;
    balance_usdt?: number;
    key_prefix?: string;
  }> {
    const key = (candidateApiKey !== undefined ? candidateApiKey?.trim() : this.getApiKey()) || null;
    const baseUrl = (candidateBaseUrl !== undefined && candidateBaseUrl?.trim() ? candidateBaseUrl.trim() : this.getBaseUrl());

    if (!key) {
      return {
        success: false,
        status_code: 400,
        latency_ms: 0,
        message: 'No API key provided. Set the X-API-Key secret before testing.'
      };
    }

    const start = Date.now();
    const endpoint = `${baseUrl}/api/v1/products`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': key,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latency_ms = Date.now() - start;

      if (resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const count = Array.isArray(data.products) ? data.products.length : 0;
        return {
          success: true,
          status_code: resp.status,
          latency_ms,
          message: `Connection established (${latency_ms}ms). Reseller catalogue responded with ${count} active products.`,
          balance_usdt: data.balance_usdt !== undefined ? Number(data.balance_usdt) : undefined
        };
      }

      if (resp.status === 401) {
        return {
          success: false,
          status_code: 401,
          latency_ms,
          message: `Authentication failed (HTTP 401): The supplied X-API-Key was rejected by InsightXPro.`
        };
      }

      if (resp.status === 429) {
        return {
          success: false,
          status_code: 429,
          latency_ms,
          message: `Rate limit reached (HTTP 429): Maximum 60 requests per minute exceeded.`
        };
      }

      const errText = await resp.text().catch(() => '');
      return {
        success: false,
        status_code: resp.status,
        latency_ms,
        message: `InsightXPro responded with HTTP ${resp.status}: ${errText.slice(0, 120)}`
      };
    } catch (err: any) {
      const latency_ms = Date.now() - start;
      const isTimeout = err.name === 'AbortError';
      return {
        success: false,
        status_code: isTimeout ? 504 : 500,
        latency_ms,
        message: isTimeout
          ? `Connection timed out after 12s connecting to ${baseUrl}.`
          : `Network error connecting to supplier: ${err.message}`
      };
    }
  }

  /**
   * Fetches real live catalog from InsightXPro:
   * GET https://api.insightxpro.store/api/v1/products
   * Header: X-API-Key: <INSIGHT_API_KEY>
   */
  async fetchCatalogue(): Promise<{ products: SupplierProductItem[]; raw?: any }> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      throw new Error(
        'InsightXPro API key is not configured. Set INSIGHT_API_KEY in server environment variables to synchronize live products.'
      );
    }

    const endpoint = `${this.getBaseUrl()}/api/v1/products`;
    logger.info(`Fetching supplier catalogue from InsightXPro API`, { endpoint, provider: this.providerId });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 401) {
          throw new Error('InsightXPro authentication failed: invalid or missing API key (HTTP 401).');
        }
        if (resp.status === 429) {
          throw new Error('InsightXPro rate limit exceeded: maximum 60 requests per minute (HTTP 429).');
        }
        const errBody = await resp.text().catch(() => '');
        throw new Error(`InsightXPro API request failed with HTTP ${resp.status}: ${errBody.slice(0, 150)}`);
      }

      const data = await resp.json() as any;

      if (!data || typeof data !== 'object') {
        throw new Error('InsightXPro API returned malformed response: expected JSON object.');
      }

      if (!Array.isArray(data.products)) {
        throw new Error('InsightXPro API response missing "products" array. Expected { products: [...] }.');
      }

      // Map real documented fields strictly from the response
      const mappedProducts: SupplierProductItem[] = data.products.map((p: any, index: number) => {
        if (p === null || typeof p !== 'object') {
          throw new Error(`Invalid product record at index ${index}: expected an object.`);
        }

        const id = p.id !== undefined && p.id !== null ? p.id : `unknown-${index}`;
        const name = typeof p.name === 'string' && p.name.trim().length > 0 ? p.name.trim() : `Product #${id}`;
        const priceUsdt = typeof p.price_usdt === 'number'
          ? p.price_usdt
          : (typeof p.price === 'number' ? p.price : 0.0);

        const basePriceUsdt = typeof p.base_price_usdt === 'number' ? p.base_price_usdt : null;
        const stock = typeof p.stock === 'number' ? Math.max(0, Math.floor(p.stock)) : 0;
        const available = p.available === false ? false : true;
        const unlimited = Boolean(p.unlimited);

        return {
          id,
          name,
          description: typeof p.description === 'string' ? p.description : undefined,
          description_text: typeof p.description_text === 'string' ? p.description_text : undefined,
          price_usdt: priceUsdt,
          base_price_usdt: basePriceUsdt,
          stock,
          available,
          unlimited,
          raw: p
        };
      });

      logger.info(`Successfully fetched ${mappedProducts.length} live products from InsightXPro`, {
        count: mappedProducts.length
      });

      return {
        products: mappedProducts,
        raw: data
      };
    } catch (err: any) {
      logger.warn('InsightXPro catalogue fetch failed', { error: err.message });
      throw err;
    }
  }

  /**
   * Checks reseller balance and rate limit limits:
   * GET https://api.insightxpro.store/api/v1/balance
   * Header: X-API-Key: <INSIGHT_API_KEY>
   */
  async getBalance(): Promise<SupplierBalanceInfo> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return {
        balance_usdt: 0,
        currency: 'USDT',
        status: 'unconfigured',
        last_checked: new Date().toISOString()
      };
    }

    const endpoint = `${this.getBaseUrl()}/api/v1/balance`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json() as any;
        return {
          balance_usdt: Number(data.balance_usdt || data.balance || 0),
          currency: 'USDT',
          key_prefix: data.key_prefix,
          status: data.status || 'active',
          rate_limit_per_min: data.rate_limit_per_min || 60,
          last_checked: new Date().toISOString()
        };
      } else {
        const errText = await resp.text().catch(() => '');
        logger.warn(`InsightXPro balance check failed (HTTP ${resp.status})`, { error: errText });
        return {
          balance_usdt: 0,
          currency: 'USDT',
          status: `error_http_${resp.status}`,
          last_checked: new Date().toISOString()
        };
      }
    } catch (err: any) {
      logger.warn('InsightXPro balance network exception', { error: err.message });
      return {
        balance_usdt: 0,
        currency: 'USDT',
        status: 'network_error',
        last_checked: new Date().toISOString()
      };
    }
  }

  /**
   * Supplier Order Fulfilment:
   * Places an order to InsightXPro API with idempotency.
   */
  async placeOrder(req: { product_id: number | string; quantity?: number; idempotency_key: string }): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Cannot fulfill order: InsightXPro API key is not configured.');
    }

    logger.info('Placing order to InsightXPro API', {
      product_id: req.product_id,
      quantity: req.quantity || 1,
      idempotency_key: req.idempotency_key
    });

    const endpoint = `${this.getBaseUrl()}/api/v1/orders`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: Number(req.product_id),
        quantity: req.quantity || 1,
        idempotency_key: req.idempotency_key
      })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as any).error || `InsightXPro order failed with HTTP ${resp.status}`);
    }

    return await resp.json();
  }

  /**
   * Retrieves live status of a previously placed supplier order:
   * GET https://api.insightxpro.store/api/v1/orders/{order_id}
   */
  async getOrderStatus(orderId: number | string): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('InsightXPro API key is not configured.');
    }

    const endpoint = `${this.getBaseUrl()}/api/v1/orders/${orderId}`;
    const resp = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as any).error || `InsightXPro order status query failed with HTTP ${resp.status}`);
    }

    return await resp.json();
  }
}

export interface ExtractedFulfilmentItem {
  delivery_format: 'redemption_url' | 'license_key' | 'coupon_code' | 'account_credentials' | 'activation_code';
  delivery_content: string;
  redemption_url?: string;
  instructions: string;
}

export interface ExtractedSupplierOrder {
  supplier_order_id: string | null;
  supplier_status: 'completed' | 'pending' | 'processing' | 'failed';
  items: ExtractedFulfilmentItem[];
  raw_sanitized: any;
}

/**
 * Standardizes raw supplier response from InsightXPro into documented ToolPadi fulfilment model.
 * Never outputs "undefined" or synthetic values when actual supplier codes/links are present.
 */
export function extractSupplierFulfilment(rawResponse: any, fallbackInstructions?: string): ExtractedSupplierOrder {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return {
      supplier_order_id: null,
      supplier_status: 'failed',
      items: [],
      raw_sanitized: { error: 'Empty or invalid response from supplier' }
    };
  }

  const orderObj = rawResponse.order || rawResponse.data || rawResponse;
  const supplierOrderId = orderObj.supplier_order_id
    || orderObj.supplier_reference
    || (orderObj.order_id !== undefined ? String(orderObj.order_id) : null)
    || (orderObj.id !== undefined ? String(orderObj.id) : null)
    || (rawResponse.order_id ? String(rawResponse.order_id) : null);

  const rawStatus = (orderObj.status || rawResponse.status || '').toLowerCase();
  let supplierStatus: 'completed' | 'pending' | 'processing' | 'failed' = 'pending';

  if (rawStatus === 'completed' || rawStatus === 'success' || rawStatus === 'delivered') {
    supplierStatus = 'completed';
  } else if (rawStatus === 'failed' || rawStatus === 'rejected' || rawStatus === 'cancelled') {
    supplierStatus = 'failed';
  } else if (rawStatus === 'processing' || rawStatus === 'in_progress') {
    supplierStatus = 'processing';
  }

  // Gather all codes, coupons, and links
  const extractedList: string[] = [];

  if (Array.isArray(orderObj.codes)) {
    for (const c of orderObj.codes) {
      if (typeof c === 'string' && c.trim()) extractedList.push(c.trim());
    }
  }

  if (Array.isArray(orderObj.coupons)) {
    for (const c of orderObj.coupons) {
      if (typeof c === 'string' && c.trim() && !extractedList.includes(c.trim())) {
        extractedList.push(c.trim());
      }
    }
  }

  const singleCandidate = orderObj.license || orderObj.licence || orderObj.code || orderObj.link || orderObj.redemption_url || rawResponse.code || rawResponse.license;
  if (typeof singleCandidate === 'string' && singleCandidate.trim() && !extractedList.includes(singleCandidate.trim())) {
    extractedList.push(singleCandidate.trim());
  }

  // If we found valid delivered credentials or links, mark status as completed
  if (extractedList.length > 0 && supplierStatus !== 'failed') {
    supplierStatus = 'completed';
  }

  const items: ExtractedFulfilmentItem[] = extractedList.map((token) => {
    const isUrl = token.startsWith('http://') || token.startsWith('https://');
    if (isUrl) {
      return {
        delivery_format: 'redemption_url',
        delivery_content: token,
        redemption_url: token,
        instructions: fallbackInstructions || 'Open your unique activation URL to redeem and link your subscription directly on the service portal.'
      };
    }

    const isCoupon = token.toLowerCase().includes('coupon') || token.toLowerCase().includes('promo');
    if (isCoupon) {
      return {
        delivery_format: 'coupon_code',
        delivery_content: token,
        instructions: fallbackInstructions || 'Enter this redemption coupon code at checkout on the provider platform.'
      };
    }

    return {
      delivery_format: 'license_key',
      delivery_content: token,
      instructions: fallbackInstructions || 'Enter this activation license key into your software or account settings to unlock access.'
    };
  });

  return {
    supplier_order_id: supplierOrderId,
    supplier_status: supplierStatus,
    items,
    raw_sanitized: {
      supplier_order_id: supplierOrderId,
      product_id: orderObj.product_id,
      product_name: orderObj.product_name,
      status: orderObj.status,
      items_count: items.length,
      created_at: orderObj.created_at
    }
  };
}

export const insightXProClient = new InsightXProClient();

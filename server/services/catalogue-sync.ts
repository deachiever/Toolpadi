import { dbService } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { roundToMarketNaira } from './pricing.js';
import type { ISupplierAdapter, SupplierSyncResult } from '../adapters/supplier.interface.js';
import type { Product } from '../db/types.js';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function syncSupplierCatalogue(adapter: ISupplierAdapter): Promise<SupplierSyncResult> {
  const syncedAt = new Date().toISOString();

  // Get active exchange rate
  const rateSetting = await dbService.queryOne<{ value: string }>(
    `SELECT value FROM admin_settings WHERE key = 'usd_ngn_rate'`
  );
  const exchangeRate = Number(rateSetting?.value || 1450);

  logger.info(`Starting catalogue synchronization for provider: ${adapter.providerName}`, {
    providerId: adapter.providerId,
    exchangeRate
  });

  // If adapter is not configured, do not treat as fatal error; record status and return cleanly
  if (!adapter.isConfigured()) {
    const errorMsg = `${adapter.providerName} is not configured. Set INSIGHT_API_KEY in server environment variables to synchronize live products.`;
    logger.warn(`Catalogue synchronization paused for ${adapter.providerName}: API key is not configured.`);

    await dbService.run(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES ('catalogue_last_sync_error', ?, ?)
    `, [errorMsg, syncedAt]);

    return {
      provider_id: adapter.providerId,
      provider_name: adapter.providerName,
      success: false,
      total_received: 0,
      new_items_added: 0,
      existing_items_updated: 0,
      absent_items_disabled: 0,
      error: errorMsg,
      synced_at: syncedAt
    };
  }

  try {
    // 1. Fetch live products from provider
    const { products } = await adapter.fetchCatalogue();

    // 2. Track received source IDs
    const receivedSourceIds = new Set<string>();
    let newItemsAdded = 0;
    let existingItemsUpdated = 0;
    let absentItemsDisabled = 0;

    for (const item of products) {
      const sourceId = String(item.id);
      receivedSourceIds.add(sourceId);

      const costUsdt = Number(item.price_usdt || 0);
      const baseCostUsdt = item.base_price_usdt !== undefined && item.base_price_usdt !== null
        ? Number(item.base_price_usdt)
        : costUsdt;
      const costNgn = roundToMarketNaira(costUsdt * exchangeRate);
      const stock = item.unlimited ? 9999 : Number(item.stock || 0);
      const isUnlimited = item.unlimited ? 1 : 0;
      const rawPayload = JSON.stringify(item.raw || item);

      // Check if product exists in local database
      const existing = await dbService.queryOne<Product>(`
        SELECT * FROM products WHERE source_type = ? AND source_product_id = ?
      `, [adapter.providerId, sourceId]);

      if (existing) {
        // Update live supplier fields while preserving admin approval, custom pricing rules, and category
        await dbService.run(`
          UPDATE products
          SET
            description_text = ?,
            supplier_cost_usdt = ?,
            supplier_base_cost_usdt = ?,
            supplier_cost_ngn = ?,
            stock_count = ?,
            is_unlimited = ?,
            is_supplier_available = 1,
            raw_supplier_payload = ?,
            last_synced_at = ?,
            updated_at = ?
          WHERE id = ?
        `, [
          item.description_text || existing.description_text || null,
          costUsdt,
          baseCostUsdt,
          costNgn,
          stock,
          isUnlimited,
          rawPayload,
          syncedAt,
          syncedAt,
          existing.id
        ]);

        // Profit protection: check if fixed bulk pricing tiers became unprofitable under new cost
        if (existing.bulk_pricing_enabled === 1 && existing.bulk_pricing_mode === 'fixed_unit_price') {
          try {
            const tiers = await dbService.query<any>(`
              SELECT * FROM product_bulk_pricing_tiers WHERE product_id = ?
            `, [existing.id]);
            const unprofitableTiers = tiers.filter((t: any) => Number(t.fixed_unit_price_ngn) < costNgn);
            if (unprofitableTiers.length > 0) {
              logger.warn(`Profit alert: Product "${existing.title}" has ${unprofitableTiers.length} fixed bulk tier(s) below new wholesale cost of ₦${costNgn.toLocaleString()}`);
              await dbService.run(`
                INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
                VALUES (?, 'CATALOGUE_SYNC', 'BULK_TIER_UNPROFITABLE_FLAGGED', 'product', ?, ?, '127.0.0.1', ?)
              `, [
                `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                existing.id,
                `Supplier cost changed to ₦${costNgn.toLocaleString()}. Flagged ${unprofitableTiers.length} fixed bulk tier(s) as unprofitable.`,
                syncedAt
              ]);
            }
          } catch (e: any) {
            logger.warn(`Could not verify bulk tier profitability: ${e.message}`);
          }
        }

        existingItemsUpdated++;
      } else {
        // Ingest new supplier product into database
        const newId = `prod-${adapter.providerId}-${sourceId}`;
        const baseSlug = slugify(item.name || `product-${sourceId}`);
        const slug = `${baseSlug}-${sourceId}`;

        await dbService.run(`
          INSERT INTO products (
            id, source_type, source_product_id, title, slug, short_description, description,
            description_text, category, access_type, duration, supplier_cost_usdt, supplier_base_cost_usdt,
            supplier_cost_ngn, stock_count, is_unlimited, is_supplier_available, reseller_approved,
            is_active, raw_supplier_payload, terms_of_service, delivery_instructions,
            created_at, updated_at, last_synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'General', 'digital_access', 'as_specified', ?, ?, ?, ?, ?, 1, 0, 0, ?, ?, ?, ?, ?, ?)
        `, [
          newId,
          adapter.providerId,
          sourceId,
          item.name,
          slug,
          item.description_text || item.name,
          item.description || item.description_text || item.name,
          item.description_text || null,
          costUsdt,
          baseCostUsdt,
          costNgn,
          stock,
          isUnlimited,
          rawPayload,
          'Standard reseller delivery terms apply. Access verified per order.',
          'Direct digital credentials or invitation delivered to customer order portal.',
          syncedAt,
          syncedAt,
          syncedAt
        ]);

        // Default pricing rule for new product: 20% markup
        await dbService.run(`
          INSERT INTO pricing_rules (
            id, product_id, pricing_mode, markup_value, allow_negative_margin
          ) VALUES (?, ?, 'percentage_markup', 20, 0)
        `, [`rule-${newId}`, newId]);

        newItemsAdded++;
      }
    }

    // 3. Mark absent products as unavailable per InsightXPro documentation:
    // "A sold-out product leaves the list entirely. It is not returned with available: false — it is simply not there.
    // Anything in your storefront that is missing from a fresh response is no longer buyable."
    const providerProducts = await dbService.query<Product>(`
      SELECT id, source_product_id, is_supplier_available FROM products WHERE source_type = ?
    `, [adapter.providerId]);

    for (const p of providerProducts) {
      if (!receivedSourceIds.has(p.source_product_id)) {
        if (p.is_supplier_available === 1) {
          await dbService.run(`
            UPDATE products
            SET is_supplier_available = 0, stock_count = 0, updated_at = ?
            WHERE id = ?
          `, [syncedAt, p.id]);
          absentItemsDisabled++;
        }
      }
    }

    // 4. Update sync metadata in admin_settings
    await dbService.run(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES ('catalogue_last_synced', ?, ?)
    `, [syncedAt, syncedAt]);

    await dbService.run(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES ('catalogue_last_sync_error', '', ?)
    `, [syncedAt]);

    // 5. Audit log
    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'SYSTEM_SYNC', 'CATALOGUE_SYNC_SUCCESS', 'supplier', ?, ?, '127.0.0.1', ?)
    `, [
      `log-sync-${Date.now()}`,
      adapter.providerId,
      `Successfully synced ${products.length} live items (${newItemsAdded} added, ${existingItemsUpdated} updated, ${absentItemsDisabled} marked unavailable).`,
      syncedAt
    ]);

    logger.info(`Catalogue sync completed successfully for ${adapter.providerName}`, {
      total: products.length,
      new: newItemsAdded,
      updated: existingItemsUpdated,
      disabled: absentItemsDisabled
    });

    return {
      provider_id: adapter.providerId,
      provider_name: adapter.providerName,
      success: true,
      total_received: products.length,
      new_items_added: newItemsAdded,
      existing_items_updated: existingItemsUpdated,
      absent_items_disabled: absentItemsDisabled,
      synced_at: syncedAt
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Unknown catalogue synchronization error';
    if (errorMsg.includes('not configured')) {
      logger.warn(`Catalogue synchronization paused for ${adapter.providerName}: API key not configured.`);
    } else {
      logger.warn(`Catalogue synchronization failed for ${adapter.providerName}: ${errorMsg}`);
    }

    // Record error in settings without deleting or corrupting existing stored catalogue records
    await dbService.run(`
      INSERT OR REPLACE INTO admin_settings (key, value, updated_at)
      VALUES ('catalogue_last_sync_error', ?, ?)
    `, [errorMsg, syncedAt]);

    await dbService.run(`
      INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, details, ip_address, created_at)
      VALUES (?, 'SYSTEM_SYNC', 'CATALOGUE_SYNC_FAILED', 'supplier', ?, ?, '127.0.0.1', ?)
    `, [
      `log-sync-err-${Date.now()}`,
      adapter.providerId,
      `Catalogue sync failed: ${errorMsg}`,
      syncedAt
    ]);

    return {
      provider_id: adapter.providerId,
      provider_name: adapter.providerName,
      success: false,
      total_received: 0,
      new_items_added: 0,
      existing_items_updated: 0,
      absent_items_disabled: 0,
      error: errorMsg,
      synced_at: syncedAt
    };
  }
}

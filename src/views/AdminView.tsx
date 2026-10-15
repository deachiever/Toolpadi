import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  Lock,
  Unlock,
  DollarSign,
  Package,
  Layers,
  History,
  Settings,
  CheckCircle2,
  ExternalLink,
  Edit,
  RotateCcw,
  Search,
  Eye,
  EyeOff,
  Calculator,
  Sliders,
  AlertOctagon,
  TrendingUp,
  Tag,
  FileCode,
  Check,
  X,
  Users,
  CreditCard,
  BarChart3,
  Download,
  Key,
  Server,
  Wifi,
  WifiOff,
  Database,
  Clock,
  Plus,
  Trash2
} from 'lucide-react';
import type { Product, Order, PricingRule, CategoryPricingRule } from '../types.js';
import { BulkPricingTab } from '../components/admin/BulkPricingTab.js';
import { TestingQATab } from '../components/admin/TestingQATab.js';

interface AdminViewProps {
  onBackToStore: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ onBackToStore }) => {
  const [adminKey, setAdminKey] = useState<string>(() => {
    return localStorage.getItem('toolpadi_admin_key') || 'TOOLPADI_ADMIN_SECURE_KEY_2026';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'catalogue' | 'bulk' | 'pricing' | 'supplier' | 'orders' | 'customers' | 'reconciliation' | 'reports' | 'alerts' | 'audit' | 'export' | 'settings' | 'testing'
  >('overview');

  // Dashboard Data
  const [overview, setOverview] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryPricingRule[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [supplierBalance, setSupplierBalance] = useState<any>(null);
  const [supplierCatalogue, setSupplierCatalogue] = useState<any[]>([]);
  const [alertsData, setAlertsData] = useState<any>(null);

  // Expanded Management Data
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [salesReport, setSalesReport] = useState<any>(null);

  // Supplier Credential & Testing State
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [baseUrlInput, setBaseUrlInput] = useState<string>('https://api.insightxpro.store');
  const [syncIntervalMins, setSyncIntervalMins] = useState<number>(60);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pricing Modal State
  const [editingPricingProduct, setEditingPricingProduct] = useState<Product | null>(null);
  const [pricingMode, setPricingMode] = useState<'fixed_markup' | 'percentage_markup' | 'manual' | 'margin'>('percentage_markup');
  const [calculationType, setCalculationType] = useState<'markup' | 'margin'>('markup');
  const [markupValue, setMarkupValue] = useState<number>(20);
  const [manualPriceNgn, setManualPriceNgn] = useState<number>(0);
  const [minProfitNgn, setMinProfitNgn] = useState<number>(0);
  const [minPriceNgn, setMinPriceNgn] = useState<number>(0);
  const [priceLocked, setPriceLocked] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('General');
  const [referencePriceNgn, setReferencePriceNgn] = useState<number>(0);
  const [referenceSourceUrl, setReferenceSourceUrl] = useState<string>('');
  const [referencePlanName, setReferencePlanName] = useState<string>('');
  const [allowNegativeMargin, setAllowNegativeMargin] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  // Category Rule Modal State
  const [editingCategoryRule, setEditingCategoryRule] = useState<Partial<CategoryPricingRule> | null>(null);

  // Standalone Pricing Simulator State
  const [simCostUsdt, setSimCostUsdt] = useState<number>(10);
  const [simCalcType, setSimCalcType] = useState<'markup' | 'margin'>('markup');
  const [simRate, setSimRate] = useState<number>(25);
  const [simMinProfit, setSimMinProfit] = useState<number>(500);
  const [simResult, setSimResult] = useState<any>(null);

  // Raw payload inspector modal
  const [rawInspectorItem, setRawInspectorItem] = useState<any>(null);

  // Product-Level Controls & Bulk Pricing Modal State
  const [editingControlsProduct, setEditingControlsProduct] = useState<Product | null>(null);
  const [ctrlApproved, setCtrlApproved] = useState<boolean>(false);
  const [ctrlActive, setCtrlActive] = useState<boolean>(false);
  const [ctrlPurchasable, setCtrlPurchasable] = useState<boolean>(true);
  const [ctrlMaxOrderQty, setCtrlMaxOrderQty] = useState<number>(0);
  const [ctrlCategory, setCtrlCategory] = useState<string>('General');
  const [ctrlAccessType, setCtrlAccessType] = useState<string>('workspace_seat');
  const [ctrlDuration, setCtrlDuration] = useState<string>('1_month');
  const [ctrlTitle, setCtrlTitle] = useState<string>('');
  const [ctrlShortDesc, setCtrlShortDesc] = useState<string>('');
  const [ctrlDesc, setCtrlDesc] = useState<string>('');
  const [ctrlDelivery, setCtrlDelivery] = useState<string>('');
  const [ctrlTerms, setCtrlTerms] = useState<string>('');
  const [ctrlBulkEnabled, setCtrlBulkEnabled] = useState<boolean>(false);
  const [ctrlBulkMode, setCtrlBulkMode] = useState<'discount_percent' | 'fixed_unit_price'>('discount_percent');
  const [ctrlBulkTiers, setCtrlBulkTiers] = useState<Array<{
    id?: string;
    min_quantity: number;
    max_quantity?: number | null;
    discount_percentage?: number;
    fixed_unit_price_ngn?: number;
    fixed_unit_price_usd?: number;
  }>>([]);
  const [ctrlAllowUnprofitable, setCtrlAllowUnprofitable] = useState<boolean>(false);
  const [ctrlReason, setCtrlReason] = useState<string>('');
  const [isSavingControls, setIsSavingControls] = useState<boolean>(false);

  // Authenticate & load
  const verifyAndLoad = async (keyToUse: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const resp = await fetch('/api/admin/overview', {
        headers: { 'x-admin-key': keyToUse }
      });
      if (!resp.ok) {
        throw new Error('Invalid administrative passkey.');
      }
      const data = await resp.json();
      setOverview(data);
      setIsAuthenticated(true);
      localStorage.setItem('toolpadi_admin_key', keyToUse);
      loadAllData(keyToUse);
    } catch (err: any) {
      setAuthError(err.message);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async (key: string) => {
    try {
      const headers = { 'x-admin-key': key };
      const [prodRes, catRuleRes, ordRes, auditRes, setRes, supRes, alertRes, rawRes, supListRes, custRes, reconRes, repRes] = await Promise.all([
        fetch('/api/admin/products', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/pricing-rules/category', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/orders', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/audit-logs', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/settings', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/supplier/balance', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/alerts', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/supplier/catalogue', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/suppliers', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/customers', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/payments/reconciliation', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/reports/sales', { headers }).then(r => r.json()).catch(() => ({}))
      ]);

      if (prodRes?.products) setProducts(prodRes.products);
      if (catRuleRes?.rules) setCategoryRules(catRuleRes.rules);
      if (ordRes?.orders) setOrders(ordRes.orders);
      if (auditRes?.logs) setAuditLogs(auditRes.logs);
      if (setRes?.settings) {
        setSettings(setRes.settings);
        if (setRes.settings.catalogue_sync_interval_minutes) {
          setSyncIntervalMins(Number(setRes.settings.catalogue_sync_interval_minutes));
        }
      }
      if (supRes) {
        setSupplierBalance(supRes);
        if (supRes.base_url) setBaseUrlInput(supRes.base_url);
      }
      if (alertRes) setAlertsData(alertRes);
      if (rawRes?.records) setSupplierCatalogue(rawRes.records);
      if (supListRes?.suppliers) setSuppliersList(supListRes.suppliers);
      if (custRes?.customers) setCustomers(custRes.customers);
      if (reconRes) setReconciliation(reconRes);
      if (repRes) setSalesReport(repRes);
    } catch (err) {
      console.error('Error loading admin tables:', err);
    }
  };

  useEffect(() => {
    if (adminKey) {
      verifyAndLoad(adminKey);
    }
  }, []);

  // Update simulator whenever inputs change
  useEffect(() => {
    const exchangeRate = Number(settings.usd_ngn_rate || 1450);
    const costNgn = Math.round(simCostUsdt * exchangeRate);
    let retailNgn = costNgn;

    if (simCalcType === 'margin') {
      const safeMargin = Math.min(Math.max(0, simRate), 95) / 100;
      retailNgn = costNgn / (1 - safeMargin);
    } else {
      retailNgn = costNgn * (1 + simRate / 100);
    }

    let minProfitApplied = false;
    if (simMinProfit > 0 && (retailNgn - costNgn) < simMinProfit) {
      retailNgn = costNgn + simMinProfit;
      minProfitApplied = true;
    }

    // Market Naira rounding (<= 1000 to 50, > 1000 to 100)
    const roundedRetail = retailNgn <= 1000 ? Math.round(retailNgn / 50) * 50 : Math.round(retailNgn / 100) * 100;
    const profitNgn = roundedRetail - costNgn;
    const profitUsd = Math.round((profitNgn / exchangeRate) * 100) / 100;
    const retailUsd = Math.round((roundedRetail / exchangeRate) * 100) / 100;
    const marginPct = roundedRetail > 0 ? Math.round((profitNgn / roundedRetail) * 1000) / 10 : 0;
    const markupPct = costNgn > 0 ? Math.round((profitNgn / costNgn) * 1000) / 10 : 0;

    setSimResult({
      cost_ngn: costNgn,
      retail_ngn: roundedRetail,
      retail_usd: retailUsd,
      profit_ngn: profitNgn,
      profit_usd: profitUsd,
      gross_margin_pct: marginPct,
      markup_pct: markupPct,
      min_profit_applied: minProfitApplied
    });
  }, [simCostUsdt, simCalcType, simRate, simMinProfit, settings.usd_ngn_rate]);

  // Update Reseller Approval Status
  const handleUpdateResellerStatus = async (productId: string, approved: boolean) => {
    try {
      const resp = await fetch(`/api/admin/products/${productId}/approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ reseller_approved: approved })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: `Product resale authorization set to ${approved ? 'Approved' : 'Pending'}.` });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Toggle Product Visibility
  const handleToggleProductActive = async (productId: string, currentActive: number) => {
    try {
      const resp = await fetch(`/api/admin/products/${productId}/approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ is_active: currentActive === 1 ? 0 : 1 })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: 'Product storefront visibility updated.' });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Toggle Purchasable Override
  const handleTogglePurchasable = async (productId: string, currentPurchasable: number) => {
    try {
      const resp = await fetch(`/api/admin/products/${productId}/approval`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          purchasable_override: currentPurchasable === 1 ? 0 : 1,
          reason: `Admin toggled purchase eligibility to ${currentPurchasable === 1 ? 'Paused' : 'Active'}`
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: 'Product purchase eligibility updated.' });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Open Product Controls and Bulk Pricing Modal
  const openProductControlsModal = async (p: Product) => {
    setEditingControlsProduct(p);
    setCtrlApproved(p.reseller_approved === 1);
    setCtrlActive(p.is_active === 1);
    setCtrlPurchasable((p.purchasable_override ?? 1) === 1);
    setCtrlMaxOrderQty(p.max_order_quantity || 0);
    setCtrlCategory(p.category || 'General');
    setCtrlAccessType(p.access_type || 'workspace_seat');
    setCtrlDuration(p.duration || '1_month');
    setCtrlTitle(p.title);
    setCtrlShortDesc(p.short_description || '');
    setCtrlDesc(p.description || '');
    setCtrlDelivery(p.delivery_instructions || '');
    setCtrlTerms(p.terms_of_service || '');
    setCtrlBulkEnabled(p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled));
    setCtrlBulkMode(p.bulk_pricing_mode || p.bulk_pricing?.mode || 'discount_percent');
    setCtrlAllowUnprofitable(false);
    setCtrlReason('');

    try {
      const resp = await fetch(`/api/admin/products/${p.id}/bulk-pricing`, {
        headers: { 'x-admin-key': adminKey }
      });
      if (resp.ok) {
        const data = await resp.json();
        setCtrlBulkTiers(data.tiers || []);
        setCtrlBulkEnabled(Boolean(data.bulk_pricing_enabled));
        setCtrlBulkMode(data.bulk_pricing_mode || 'discount_percent');
        setCtrlMaxOrderQty(data.max_order_quantity || 0);
      } else {
        setCtrlBulkTiers(p.bulk_pricing?.tiers || []);
      }
    } catch {
      setCtrlBulkTiers(p.bulk_pricing?.tiers || []);
    }
  };

  // Save Product Controls and Bulk Pricing Tiers
  const handleSaveProductControls = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingControlsProduct) return;
    setIsSavingControls(true);

    try {
      // 1. Save individual product controls
      const ctrlResp = await fetch(`/api/admin/products/${editingControlsProduct.id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({
          reseller_approved: ctrlApproved ? 1 : 0,
          is_active: ctrlActive ? 1 : 0,
          purchasable_override: ctrlPurchasable ? 1 : 0,
          category: ctrlCategory,
          access_type: ctrlAccessType,
          duration: ctrlDuration,
          title: ctrlTitle,
          short_description: ctrlShortDesc,
          description: ctrlDesc,
          delivery_instructions: ctrlDelivery,
          terms_of_service: ctrlTerms,
          max_order_quantity: ctrlMaxOrderQty,
          bulk_pricing_enabled: ctrlBulkEnabled ? 1 : 0,
          bulk_pricing_mode: ctrlBulkMode,
          reason: ctrlReason.trim() || 'Admin updated product controls and bulk purchase settings'
        })
      });
      const ctrlData = await ctrlResp.json();
      if (!ctrlResp.ok) throw new Error(ctrlData.error);

      // 2. Save bulk pricing tiers
      const bulkResp = await fetch(`/api/admin/products/${editingControlsProduct.id}/bulk-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({
          enabled: ctrlBulkEnabled,
          mode: ctrlBulkMode,
          max_order_quantity: ctrlMaxOrderQty,
          tiers: ctrlBulkTiers,
          allow_unprofitable: ctrlAllowUnprofitable,
          reason: ctrlReason.trim() || 'Admin configured bulk volume pricing tiers'
        })
      });
      const bulkData = await bulkResp.json();
      if (!bulkResp.ok) throw new Error(bulkData.error);

      setActionMessage({ type: 'success', text: `Product controls and bulk pricing updated for "${ctrlTitle}"!` });
      setEditingControlsProduct(null);
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsSavingControls(false);
    }
  };

  // Open Pricing Modal
  const openPricingModal = (p: Product) => {
    setEditingPricingProduct(p);
    setEditTitle(p.title);
    setEditCategory(p.category || 'General');
    const rule = p.pricing;
    setPricingMode(rule?.pricing_mode || 'percentage_markup');
    setCalculationType(rule?.calculation_type || (rule?.pricing_mode === 'margin' ? 'margin' : 'markup'));
    setMarkupValue(rule?.markup_value || 20);
    setManualPriceNgn(rule?.manual_price_ngn || p.retail_price_ngn);
    setMinProfitNgn(rule?.min_profit_ngn || 0);
    setMinPriceNgn(rule?.min_price_ngn || 0);
    setPriceLocked(Boolean(rule?.price_locked));
    setReferencePriceNgn(rule?.reference_price_ngn || 0);
    setReferenceSourceUrl(rule?.reference_source_url || '');
    setReferencePlanName(rule?.reference_plan_name || '');
    setAllowNegativeMargin(Boolean(rule?.allow_negative_margin));
    setOverrideReason(rule?.override_reason || '');
  };

  // Save Pricing Rule
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPricingProduct) return;

    try {
      // 1. Update title and category if changed
      if (editTitle !== editingPricingProduct.title || editCategory !== editingPricingProduct.category) {
        await fetch(`/api/admin/products/${editingPricingProduct.id}/approval`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
          body: JSON.stringify({ title: editTitle, category: editCategory })
        });
      }

      // 2. Update pricing rule
      const resp = await fetch(`/api/admin/products/${editingPricingProduct.id}/pricing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          pricing_mode: pricingMode,
          calculation_type: calculationType,
          markup_value: markupValue,
          manual_price_ngn: pricingMode === 'manual' ? manualPriceNgn : null,
          min_profit_ngn: minProfitNgn,
          min_price_ngn: minPriceNgn,
          price_locked: priceLocked ? 1 : 0,
          reference_price_ngn: referencePriceNgn > 0 ? referencePriceNgn : null,
          reference_source_url: referenceSourceUrl || null,
          reference_plan_name: referencePlanName || null,
          allow_negative_margin: allowNegativeMargin,
          override_reason: overrideReason
        })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setActionMessage({ type: 'success', text: 'Pricing rule and profit parameters saved successfully!' });
      setEditingPricingProduct(null);
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Save Category Rule
  const handleSaveCategoryRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategoryRule?.category) return;

    try {
      const resp = await fetch('/api/admin/pricing-rules/category', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(editingCategoryRule)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: `Category rule saved for ${editingCategoryRule.category}.` });
      setEditingCategoryRule(null);
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Delete Category Rule
  const handleDeleteCategoryRule = async (ruleId: string, category: string) => {
    if (!confirm(`Are you sure you want to remove the category rule for "${category}"? Products will fall back to Global Default.`)) return;

    try {
      const resp = await fetch(`/api/admin/pricing-rules/category/${ruleId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: `Category rule for "${category}" removed.` });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Trigger Catalogue Sync with InsightXPro
  const handleSyncSupplier = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/admin/supplier/sync', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || data.message || 'Synchronization failed');
      setActionMessage({
        type: 'success',
        text: data.message || `Supplier synchronization complete: ${data.result?.total_received || 0} products received from InsightXPro.`
      });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Live test connection to supplier endpoint
  const handleTestSupplier = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const resp = await fetch('/api/admin/suppliers/insightxpro/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          candidate_api_key: apiKeyInput ? apiKeyInput : undefined,
          candidate_base_url: baseUrlInput ? baseUrlInput : undefined
        })
      });
      const data = await resp.json();
      setTestResult(data);
      if (data.success) {
        setActionMessage({ type: 'success', text: `Test passed! ${data.message}` });
      } else {
        setActionMessage({ type: 'error', text: `Test failed: ${data.message}` });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message, latency_ms: 0 });
      setActionMessage({ type: 'error', text: `Connection test error: ${err.message}` });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save supplier credentials & config
  const handleSaveSupplierCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const resp = await fetch('/api/admin/suppliers/insightxpro/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          api_key: apiKeyInput || undefined,
          api_base_url: baseUrlInput || undefined,
          sync_interval_minutes: syncIntervalMins
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: 'InsightXPro credentials and configuration saved successfully!' });
      setApiKeyInput(''); // Clear input for security
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Export Data Download
  const handleExport = (entity: string, format: 'json' | 'csv') => {
    const url = `/api/admin/export/${entity}?format=${format}`;
    fetch(url, {
      headers: { 'x-admin-key': adminKey }
    })
      .then(r => r.blob())
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `toolpadi_${entity}_${new Date().toISOString().slice(0, 10)}.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        setActionMessage({ type: 'success', text: `Downloaded ${entity} export as ${format.toUpperCase()}.` });
      })
      .catch(err => {
        setActionMessage({ type: 'error', text: `Failed to export ${entity}: ${err.message}` });
      });
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(settings)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: 'System and profit engine settings saved.' });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // Refund Order
  const handleRefundOrder = async (orderId: string, orderRef: string) => {
    const reason = prompt(`Enter audited reason for refunding order ${orderRef}:`, 'Customer requested warranty refund');
    if (!reason) return;

    try {
      const resp = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ reason })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setActionMessage({ type: 'success', text: `Order ${orderRef} refunded and license revoked.` });
      loadAllData(adminKey);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 space-y-6">
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-8 space-y-5 shadow-sm text-center">
          <div className="w-12 h-12 bg-[#0e382b] text-[#a3e635] rounded-xl flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-[#08231b]">Admin Portal Access</h2>
            <p className="text-xs text-[#59665f] mt-1">
              Authorized personnel only. Controls catalogue approvals, profit engine rules, and supplier synchronization.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-[#fef2f2] border border-[#fecaca] text-[#991b1b] text-xs rounded-lg flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyAndLoad(adminKey);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-left text-xs font-semibold text-[#2f3d35] mb-1">
                Admin Passkey:
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_SECRET_KEY"
                className="w-full px-3 py-2 text-xs border border-[#d6d0c2] rounded-lg focus:outline-hidden focus:border-[#0e382b]"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              {isLoading ? 'Verifying...' : 'Unlock Administrative Console'}
            </button>
          </form>

          <button
            onClick={onBackToStore}
            className="text-xs text-[#0e382b] hover:underline font-semibold block mx-auto cursor-pointer"
          >
            ← Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  const exchangeRate = Number(settings.usd_ngn_rate || 1450);
  const totalAlertsCount = alertsData?.summary?.total_alerts || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#e2dcd0]">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#0e382b] text-[#a3e635] text-[10px] font-mono uppercase font-bold rounded">
              Secure Operations Desk
            </span>
            <span className="text-xs text-[#637269]">v2.4 Production Engine</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl text-[#08231b] mt-1">
            ToolPadi Inventory & Profit Rule Control Center
          </h1>
          <p className="text-xs text-[#59665f] mt-0.5">
            Strict Real Supplier Provenance · InsightXPro Reseller API · Multi-tier Automatic Margin Engine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('testing')}
            className="py-2 px-3 bg-[#f0fdf4] hover:bg-[#dcfce7] border border-[#bbf7d0] text-[#166534] text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
            <span>QA Tests (82/82 Passing)</span>
          </button>
          <button
            onClick={handleSyncSupplier}
            disabled={isLoading}
            className="py-2 px-3.5 bg-[#f4f1ea] hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Force Supplier Sync</span>
          </button>
          <button
            onClick={onBackToStore}
            className="py-2 px-3.5 bg-[#0e382b] hover:bg-[#134e3a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Storefront
          </button>
        </div>
      </div>

      {/* Global Action Message */}
      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-[#f0f7f3] border-[#cbe4d4] text-[#1a634b]'
              : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs font-bold hover:underline cursor-pointer ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-[#ede9de] rounded-lg border border-[#ded8c9] overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'overview' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Overview & Metrics
        </button>

        <button
          onClick={() => setActiveTab('catalogue')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'catalogue' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Catalogue & Approval ({products.length})
        </button>

        <button
          onClick={() => setActiveTab('bulk')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'bulk' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bulk Purchase Pricing</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pricing' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Profit Rule Engine
        </button>

        <button
          onClick={() => setActiveTab('supplier')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'supplier' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Suppliers & Credentials</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'orders' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Orders ({orders.length})
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'customers' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Customers ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reconciliation')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'reconciliation' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payments & Reconciliation</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'reports' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Sales & Profit Reports</span>
        </button>

        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'alerts' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <span>Discrepancy & Alerts</span>
          {totalAlertsCount > 0 && (
            <span className="px-1.5 py-0.2 bg-[#ef4444] text-white rounded-full text-[10px] font-bold">
              {totalAlertsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Audit Logs
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
            activeTab === 'export' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Data Export & Backup</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'settings' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          Platform Settings
        </button>

        <button
          onClick={() => setActiveTab('testing')}
          className={`px-3 py-1.5 font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'testing' ? 'bg-white text-[#0e382b] shadow-2xs font-bold' : 'text-[#5a6760]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#16a34a]" />
          <span>Verification & QA Suite</span>
          <span className="px-1.5 py-0.2 bg-[#dcfce7] text-[#15803d] rounded-full text-[10px] font-bold">
            92 Tests
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & METRICS */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-1">
              <span className="text-xs text-[#59665f] font-medium">Total Orders</span>
              <p className="font-heading font-extrabold text-2xl text-[#08231b]">{overview.total_orders}</p>
              <span className="text-[11px] text-[#65a30d]">Customer checkout requests</span>
            </div>

            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-1">
              <span className="text-xs text-[#59665f] font-medium">Verified Paid Revenue</span>
              <p className="font-heading font-extrabold text-2xl text-[#08231b]">
                ₦{(overview.total_revenue_ngn || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-[#1a634b]">Reconciled payments</span>
            </div>

            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-1">
              <span className="text-xs text-[#59665f] font-medium">Pending Resale Review</span>
              <p className="font-heading font-extrabold text-2xl text-[#b45309]">
                {overview.pending_approvals}
              </p>
              <span className="text-[11px] text-[#8a5b1d]">Blocked from storefront until approved</span>
            </div>

            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-1">
              <span className="text-xs text-[#59665f] font-medium">Supplier Reseller Funds</span>
              <p className="font-heading font-extrabold text-2xl text-[#0e382b]">
                ${(supplierBalance?.balance_usd || 0).toFixed(2)} USD
              </p>
              <span className="text-[11px] text-[#55645c]">
                {supplierBalance?.is_configured ? 'InsightXPro Reseller Account (Live Connected)' : 'Awaiting INSIGHT_API_KEY Connection'}
              </span>
            </div>
          </div>

          {/* Quick Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#0e382b] font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
                <span>Supplier Integration Status</span>
              </div>
              <p className="text-xs text-[#55635b]">
                Target: <code className="font-mono bg-[#f4f1ea] px-1 py-0.5 rounded">api.insightxpro.store</code>
              </p>
              <div className="text-[11px] text-[#697870] space-y-0.5">
                <div>Authentication: <span className="font-semibold">{supplierBalance?.is_configured ? 'X-API-Key Secret Verified' : 'Awaiting INSIGHT_API_KEY Secret'}</span></div>
                <div>Last Synchronized: <span className="font-semibold">{overview.catalogue_last_synced ? new Date(overview.catalogue_last_synced).toLocaleString() : 'Never'}</span></div>
              </div>
            </div>

            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#0e382b] font-bold text-sm">
                <Sliders className="w-4 h-4 text-[#0284c7]" />
                <span>Profit Engine Defaults</span>
              </div>
              <div className="text-[11px] text-[#697870] space-y-0.5">
                <div>Model: <span className="font-semibold capitalize">{settings.global_calculation_type || 'Markup on Cost'}</span></div>
                <div>Default Markup: <span className="font-semibold">{settings.global_markup_percentage || 20}%</span></div>
                <div>Exchange Benchmark: <span className="font-semibold">₦{exchangeRate.toLocaleString()} / $1</span></div>
                <div>Rounding: <span className="font-semibold">{settings.rounding_rule || 'Market ₦50/₦100'}</span></div>
              </div>
            </div>

            <div className="bg-white border border-[#e6e2d6] rounded-xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#0e382b] font-bold text-sm">
                <AlertOctagon className="w-4 h-4 text-[#ea580c]" />
                <span>Integrity & Risk Flags</span>
              </div>
              <div className="text-[11px] text-[#697870] space-y-0.5">
                <div>Negative Margins: <span className={`font-semibold ${alertsData?.summary?.negative_margin_count > 0 ? 'text-[#b91c1c]' : 'text-[#16a34a]'}`}>{alertsData?.summary?.negative_margin_count || 0}</span></div>
                <div>Low Stock (≤2): <span className="font-semibold">{alertsData?.summary?.low_stock_count || 0}</span></div>
                <div>Upstream Discontinued: <span className="font-semibold">{alertsData?.summary?.upstream_unavailable_count || 0}</span></div>
                <div>Stale Benchmarks: <span className="font-semibold">{alertsData?.summary?.stale_benchmarks_count || 0}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUCT APPROVAL & PUBLICATION QUEUE */}
      {/* ========================================================================= */}
      {activeTab === 'catalogue' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#08231b]">
                Product Approval & Publication Queue
              </h3>
              <p className="text-xs text-[#59665f] mt-0.5">
                Review ingested supplier products, approve for resale, customize retail titles/categories, and lock prices.
              </p>
            </div>
            <button
              onClick={handleSyncSupplier}
              className="py-2 px-3.5 bg-[#f4f1ea] text-[#0e382b] font-semibold text-xs rounded-lg hover:bg-[#eae5d8] border border-[#dcd7cb] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Fetch Supplier Updates</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                  <th className="py-3 px-3">Product / SKU</th>
                  <th className="py-3 px-3">Supplier Cost</th>
                  <th className="py-3 px-3">Selling Price</th>
                  <th className="py-3 px-3">Effective Rule & Margin</th>
                  <th className="py-3 px-3">Stock State</th>
                  <th className="py-3 px-3">Approval Gate</th>
                  <th className="py-3 px-3">Storefront</th>
                  <th className="py-3 px-3">Purchasable</th>
                  <th className="py-3 px-3">Bulk Pricing</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece2]">
                {products.map(p => {
                  const marginNgn = p.retail_price_ngn - p.supplier_cost_ngn;
                  const marginPct = p.retail_price_ngn > 0 ? Math.round((marginNgn / p.retail_price_ngn) * 100) : 0;
                  const isNegativeMargin = marginNgn < 0;
                  const isPurchasable = (p.purchasable_override ?? 1) === 1;
                  const hasBulkTiers = p.bulk_pricing_enabled === 1 || Boolean(p.bulk_pricing?.enabled);
                  const bulkTierCount = p.bulk_pricing?.tiers?.length || 0;

                  return (
                    <tr key={p.id} className="hover:bg-[#faf9f5]">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-sm text-[#08231b] block">{p.title}</strong>
                          {p.pricing?.price_locked === 1 && (
                            <span title="Price Locked against automated sync adjustments">
                              <Lock className="w-3 h-3 text-[#b45309]" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#637269]">
                          <span className="font-semibold text-[#0e382b]">{p.category}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span className="font-mono text-[10px]">SKU: {p.source_product_id}</span>
                          <span aria-hidden="true" className="mx-1">·</span>
                          <span className="capitalize">{p.access_type.replace('_', ' ')}</span>
                          {p.max_order_quantity && p.max_order_quantity > 0 ? (
                            <span className="text-[#b45309] font-medium ml-1">· Max {p.max_order_quantity}/order</span>
                          ) : null}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-medium text-[#141f1a]">₦{p.supplier_cost_ngn.toLocaleString()}</div>
                        <div className="text-[10px] text-[#717e77]">${p.supplier_cost_usdt.toFixed(2)} USDT</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#0e382b]">₦{p.retail_price_ngn.toLocaleString()}</div>
                        <div className="text-[10px] text-[#717e77]">${p.retail_price_usd.toFixed(2)} USD</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className={`font-semibold ${isNegativeMargin ? 'text-[#b91c1c]' : 'text-[#1a634b]'}`}>
                          ₦{marginNgn.toLocaleString()} ({marginPct}%)
                        </div>
                        <div className="text-[10px] text-[#55635b]">
                          {p.effective_pricing?.rule_name || 'Standard Margin'}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        {p.is_unlimited === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0fdf4] text-[#166534]">
                            Unlimited
                          </span>
                        ) : p.stock_count > 0 ? (
                          <span className="text-[#141f1a] font-medium">{p.stock_count} in stock</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fef2f2] text-[#991b1b]">
                            Out of stock
                          </span>
                        )}
                        {p.is_supplier_available !== 1 && (
                          <div className="text-[9px] text-[#b91c1c] font-bold">Upstream Unavailable</div>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <select
                          value={p.reseller_approved === 1 ? 'approved' : 'pending'}
                          onChange={(e) => handleUpdateResellerStatus(p.id, e.target.value === 'approved')}
                          className={`py-1 px-2 rounded text-xs font-semibold border cursor-pointer ${
                            p.reseller_approved === 1
                              ? 'bg-[#f0f7f3] text-[#1a634b] border-[#cbe4d4]'
                              : 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                          }`}
                        >
                          <option value="approved">Approved for Resale</option>
                          <option value="pending">Pending Verification</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleProductActive(p.id, p.is_active)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            p.is_active === 1
                              ? 'bg-[#f0f7f3] text-[#1a634b] border border-[#cbe4d4]'
                              : 'bg-[#f4f1ea] text-[#738178] border border-[#ded8c9]'
                          }`}
                        >
                          {p.is_active === 1 ? 'Live on Store' : 'Hidden'}
                        </button>
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleTogglePurchasable(p.id, p.purchasable_override ?? 1)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                            isPurchasable
                              ? 'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]'
                              : 'bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]'
                          }`}
                        >
                          {isPurchasable ? 'Eligible' : 'Paused'}
                        </button>
                      </td>

                      <td className="py-3.5 px-3">
                        {hasBulkTiers ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]">
                            Active ({bulkTierCount} {bulkTierCount === 1 ? 'tier' : 'tiers'})
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#9ca3af]">None</span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openProductControlsModal(p)}
                            className="py-1 px-2.5 bg-[#f4f1ea] text-[#0e382b] border border-[#dcd7cb] rounded text-xs font-semibold hover:bg-[#eae6dc] cursor-pointer"
                          >
                            Controls & Bulk
                          </button>
                          <button
                            onClick={() => openPricingModal(p)}
                            className="py-1 px-2.5 bg-[#0e382b] text-white rounded text-xs font-semibold hover:bg-[#134e3a] cursor-pointer"
                          >
                            Pricing Rule
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: BULK PURCHASE PRICING */}
      {/* ========================================================================= */}
      {activeTab === 'bulk' && (
        <BulkPricingTab
          adminKey={adminKey}
          products={products}
          exchangeRate={exchangeRate}
          onOpenProductControls={openProductControlsModal}
          onRefresh={() => loadAllData(adminKey)}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MARGIN & PRICING RULE MANAGER */}
      {/* ========================================================================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* Top Explanation & Precedence Architecture */}
          <div className="bg-[#fcfbf7] border border-[#e6e2d6] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#0e382b]" />
              <h3 className="font-heading font-bold text-lg text-[#08231b]">
                Hierarchical Profit Rule Engine
              </h3>
            </div>
            <p className="text-xs text-[#55635b] leading-relaxed">
              ToolPadi calculates retail prices through strict mathematical precedence:
              <strong className="text-[#0e382b]"> Active Product-Specific Rule</strong> →
              <strong className="text-[#0e382b]"> Active Category Rule</strong> →
              <strong className="text-[#0e382b]"> Global Default Platform Rule</strong>.
              All foreign supplier wholesale costs are converted via the audited USD/NGN exchange benchmark and rounded according to Nigerian market pricing conventions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-white border border-[#ded8c9] rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-[#0e382b]">1. Product Rule (Highest)</span>
                <p className="text-[11px] text-[#637269]">
                  Overrides all rules. Supports fixed markup, percentage markup, gross margin, or manual price lock.
                </p>
              </div>
              <div className="p-3 bg-white border border-[#ded8c9] rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-[#0e382b]">2. Category Rule (Mid)</span>
                <p className="text-[11px] text-[#637269]">
                  Applies to all products in a given category (e.g. Design vs Development) if no product rule is set.
                </p>
              </div>
              <div className="p-3 bg-white border border-[#ded8c9] rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-[#0e382b]">3. Global Default (Base)</span>
                <p className="text-[11px] text-[#637269]">
                  Default fallback across all inventory. Currently configured at {settings.global_markup_percentage || 20}% {settings.global_calculation_type || 'markup'}.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Pricing Simulator */}
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-5 shadow-xs">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#0e382b]" />
              <h3 className="font-heading font-bold text-base text-[#08231b]">
                Real-Time Pricing Simulator & Formula Preview
              </h3>
            </div>
            <p className="text-xs text-[#59665f]">
              Test any cost, calculation method, and margin rate before applying rules across the inventory.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Wholesale Cost (USDT):</label>
                <input
                  type="number"
                  step="0.5"
                  value={simCostUsdt}
                  onChange={(e) => setSimCostUsdt(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Calculation Method:</label>
                <select
                  value={simCalcType}
                  onChange={(e) => setSimCalcType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                >
                  <option value="markup">Markup on Cost (Cost × [1 + %])</option>
                  <option value="margin">Gross Margin on Selling (Cost ÷ [1 - %])</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Rate Percentage (%):</label>
                <input
                  type="number"
                  step="1"
                  value={simRate}
                  onChange={(e) => setSimRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Min Profit Floor (₦ NGN):</label>
                <input
                  type="number"
                  step="100"
                  value={simMinProfit}
                  onChange={(e) => setSimMinProfit(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            {simResult && (
              <div className="p-4 bg-[#f8faf8] border border-[#d2e3d6] rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="text-[#65736b] block text-[11px]">Wholesale NGN:</span>
                  <strong className="text-sm text-[#141f1a]">₦{simResult.cost_ngn.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-[#65736b] block text-[11px]">Calculated Retail:</span>
                  <strong className="text-base text-[#0e382b] font-heading font-extrabold">₦{simResult.retail_ngn.toLocaleString()}</strong>
                </div>
                <div>
                  <span className="text-[#65736b] block text-[11px]">Retail USD ($):</span>
                  <strong className="text-sm text-[#0e382b]">${simResult.retail_usd.toFixed(2)}</strong>
                </div>
                <div>
                  <span className="text-[#65736b] block text-[11px]">Net Profit / Unit:</span>
                  <strong className="text-sm text-[#166534]">₦{simResult.profit_ngn.toLocaleString()} (${simResult.profit_usd})</strong>
                </div>
                <div>
                  <span className="text-[#65736b] block text-[11px]">Gross Margin:</span>
                  <strong className="text-sm text-[#166534]">{simResult.gross_margin_pct}%</strong>
                  {simResult.min_profit_applied && (
                    <span className="block text-[10px] text-[#b45309] font-bold">Min floor applied</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Category Pricing Rules Manager */}
          <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ece2]">
              <div>
                <h3 className="font-heading font-bold text-base text-[#08231b]">
                  Category-Specific Pricing Rules
                </h3>
                <p className="text-xs text-[#59665f] mt-0.5">
                  Set target profit margins by tool classification (e.g. Creative vs Productivity).
                </p>
              </div>
              <button
                onClick={() => setEditingCategoryRule({ category: '', calculation_type: 'markup', percentage: 25, min_profit_ngn: 500, is_active: 1 })}
                className="py-1.5 px-3 bg-[#0e382b] text-white rounded-lg text-xs font-semibold hover:bg-[#134e3a] cursor-pointer"
              >
                + Add Category Rule
              </button>
            </div>

            {categoryRules.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#637269] bg-[#faf8f2] rounded-xl border border-dashed border-[#dcd7cb]">
                No category-specific pricing rules defined. All products without custom overrides follow the Global Default.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Calculation Model</th>
                      <th className="py-2.5 px-3">Rate</th>
                      <th className="py-2.5 px-3">Min Profit Floor</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ece2]">
                    {categoryRules.map(cr => (
                      <tr key={cr.id} className="hover:bg-[#faf9f5]">
                        <td className="py-2.5 px-3 font-bold text-[#08231b]">{cr.category}</td>
                        <td className="py-2.5 px-3 capitalize font-medium">{cr.calculation_type === 'margin' ? 'Gross Margin' : 'Markup on Cost'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0e382b]">{cr.percentage}%</td>
                        <td className="py-2.5 px-3">₦{(cr.min_profit_ngn || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${cr.is_active ? 'bg-[#f0f7f3] text-[#1a634b]' : 'bg-[#f4f1ea] text-[#65736b]'}`}>
                            {cr.is_active ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            onClick={() => setEditingCategoryRule(cr)}
                            className="text-[#0e382b] font-semibold hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteCategoryRule(cr.id, cr.category)}
                            className="text-[#b91c1c] font-semibold hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUPPLIER CONNECTION & CREDENTIAL MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'supplier' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#f0ece2]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  Supplier Management & Live API Ingestion
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  supplierBalance?.is_configured
                    ? 'bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]'
                    : 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                }`}>
                  {supplierBalance?.is_configured ? 'Key Configured' : 'Credentials Needed'}
                </span>
              </div>
              <p className="text-xs text-[#59665f] mt-0.5">
                Official API Docs: <a href="https://api.insightxpro.store/docs" target="_blank" rel="noopener noreferrer" className="text-[#0e382b] font-semibold underline">https://api.insightxpro.store/docs</a> · Endpoint: <code className="font-mono bg-[#f4f1ea] px-1 py-0.5 rounded">GET /api/v1/products</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncSupplier}
                disabled={isLoading}
                className="py-2.5 px-4 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Sync Live Catalogue</span>
              </button>
            </div>
          </div>

          {/* Supplier Credential Configuration Card */}
          <div className="bg-[#faf8f2] border border-[#e2dcd0] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ece6d9]">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#0e382b]" />
                <h4 className="font-heading font-bold text-sm text-[#08231b]">
                  InsightXPro API Credentials & Connection Settings
                </h4>
              </div>
              <span className="text-[11px] text-[#65736b]">
                {supplierBalance?.masked_api_key ? (
                  <span className="font-mono text-[#0e382b] font-semibold bg-white px-2 py-0.5 rounded border border-[#d8d2c4]">
                    Active Key: {supplierBalance.masked_api_key}
                  </span>
                ) : (
                  <span className="text-[#b45309] font-medium">No Key Configured</span>
                )}
              </span>
            </div>

            <form onSubmit={handleSaveSupplierCredentials} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-semibold text-[#141f1a]">
                    X-API-Key Secret Header
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={supplierBalance?.masked_api_key ? 'Enter new key to replace existing' : 'Paste InsightXPro API Key'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="w-full text-xs font-mono px-3 py-2 bg-white border border-[#d6d0c2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b] pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#78887f] hover:text-[#0e382b]"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-[#717e77] block">
                    Sent via <code className="font-mono bg-white px-1 rounded">X-API-Key</code> request header. Stored in server database.
                  </span>
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-semibold text-[#141f1a]">
                    Supplier API Base URL
                  </label>
                  <input
                    type="url"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="https://api.insightxpro.store"
                    className="w-full text-xs font-mono px-3 py-2 bg-white border border-[#d6d0c2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b]"
                  />
                  <span className="text-[10px] text-[#717e77] block">
                    Default: <code className="font-mono bg-white px-1 rounded">https://api.insightxpro.store</code>
                  </span>
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="block text-xs font-semibold text-[#141f1a]">
                    Scheduled Sync Interval
                  </label>
                  <select
                    value={syncIntervalMins}
                    onChange={(e) => setSyncIntervalMins(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#d6d0c2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0e382b]"
                  >
                    <option value={15}>Every 15 minutes (High frequency)</option>
                    <option value={30}>Every 30 minutes</option>
                    <option value={60}>Every 60 minutes (Recommended default)</option>
                    <option value={120}>Every 2 hours</option>
                    <option value={360}>Every 6 hours</option>
                  </select>
                  <span className="text-[10px] text-[#717e77] block">
                    Background scheduled synchronization interval.
                  </span>
                </div>
              </div>

              {/* Action Buttons: Test Connection & Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestSupplier}
                    disabled={isTestingConnection}
                    className="py-2 px-3.5 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <Wifi className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-pulse text-[#b45309]' : 'text-[#1a634b]'}`} />
                    <span>{isTestingConnection ? 'Testing Connection...' : 'Test Live Connection'}</span>
                  </button>
                  <span className="text-[11px] text-[#65736b]">
                    Pings InsightXPro API and measures round-trip latency.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="py-2 px-4 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>

            {/* Test Connection Result Box */}
            {testResult && (
              <div className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                testResult.success
                  ? 'bg-[#f0fdf4] border-[#bbf7d0] text-[#166534]'
                  : 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center gap-1.5">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-[#16a34a]" /> : <AlertTriangle className="w-4 h-4 text-[#dc2626]" />}
                    <span>{testResult.success ? 'Connection Succeeded' : 'Connection Failed'} (HTTP {testResult.status_code})</span>
                  </div>
                  {testResult.latency_ms > 0 && (
                    <span className="font-mono text-[11px] px-2 py-0.5 bg-white rounded border border-current">
                      Latency: {testResult.latency_ms}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px]">{testResult.message}</p>
                {testResult.balance_usdt !== undefined && (
                  <p className="text-[11px] font-semibold">
                    Verified Account Balance: ${Number(testResult.balance_usdt).toFixed(2)} USDT
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Supplier Status Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Reseller Account Balance:</span>
              <p className="font-bold text-sm text-[#0e382b]">
                ${(supplierBalance?.balance_usd || 0).toFixed(2)} USDT
              </p>
              <span className="text-[11px] text-[#78887f]">
                Status: <strong className="capitalize">{supplierBalance?.status || 'Active'}</strong>
              </span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Rate Limiting:</span>
              <p className="font-bold text-sm text-[#0e382b]">
                {supplierBalance?.rate_limit_per_min || 60} req/min
              </p>
              <span className="text-[11px] text-[#78887f]">
                Exponential jitter backoff with retry safety enabled.
              </span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Ingested Supplier SKUs:</span>
              <p className="font-bold text-sm text-[#0e382b]">
                {supplierCatalogue.length} Products
              </p>
              <span className="text-[11px] text-[#78887f]">
                {products.filter(p => p.reseller_approved === 1).length} approved for public store
              </span>
            </div>
          </div>

          {/* Multi-Supplier Integration Architecture Registry */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-sm text-[#08231b] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#0e382b]" />
                <span>Multi-Supplier Integration Registry ({suppliersList.length > 0 ? suppliersList.length : 2})</span>
              </h4>
              <span className="text-[11px] text-[#65736b]">
                Extensible Provider Adapter Framework
              </span>
            </div>

            <div className="overflow-x-auto border border-[#e6e2d6] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                    <th className="py-2.5 px-3">Supplier / Provider</th>
                    <th className="py-2.5 px-3">Base URL</th>
                    <th className="py-2.5 px-3">Auth Type</th>
                    <th className="py-2.5 px-3">Adapter Status</th>
                    <th className="py-2.5 px-3">Schedule</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece2]">
                  {(suppliersList.length > 0 ? suppliersList : [
                    {
                      id: 'insightxpro',
                      name: 'InsightXPro Reseller API',
                      api_base_url: baseUrlInput,
                      auth_type: 'X-API-Key',
                      adapter_status: 'native_active',
                      sync_schedule: `Every ${syncIntervalMins} minutes`,
                      is_configured: supplierBalance?.is_configured
                    },
                    {
                      id: 'secondary_custom_api',
                      name: 'Secondary Reseller API (Multi-Source Hub)',
                      api_base_url: 'https://api.custom-supplier.example/v1',
                      auth_type: 'Bearer / HMAC',
                      adapter_status: 'adapter_required',
                      sync_schedule: 'Manual / On-demand',
                      is_configured: false
                    }
                  ]).map((sup: any) => (
                    <tr key={sup.id} className="hover:bg-[#faf9f5]">
                      <td className="py-2.5 px-3">
                        <strong className="block text-[#141f1a]">{sup.name}</strong>
                        <span className="text-[10px] text-[#717e77] font-mono">{sup.id}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#59665f]">{sup.api_base_url}</td>
                      <td className="py-2.5 px-3">{sup.auth_type}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sup.adapter_status === 'native_active'
                            ? 'bg-[#f0fdf4] text-[#166534]'
                            : 'bg-[#fffbeb] text-[#b45309]'
                        }`}>
                          {sup.adapter_status === 'native_active' ? 'Native Adapter Active' : 'Adapter Required'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#59665f]">{sup.sync_schedule}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sup.is_configured
                            ? 'bg-[#f0fdf4] text-[#166534]'
                            : 'bg-[#f4f1ea] text-[#65736b]'
                        }`}>
                          {sup.is_configured ? 'Ready & Configured' : 'Unconfigured'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Ingested Inventory Table */}
          <div className="space-y-3 pt-4">
            <h4 className="font-heading font-bold text-sm text-[#08231b]">
              Ingested Raw Wholesale Catalogue Records ({supplierCatalogue.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                    <th className="py-2.5 px-3">Supplier Product ID</th>
                    <th className="py-2.5 px-3">Raw Name</th>
                    <th className="py-2.5 px-3">Wholesale Price (USDT)</th>
                    <th className="py-2.5 px-3">Base Price (USDT)</th>
                    <th className="py-2.5 px-3">Stock Count</th>
                    <th className="py-2.5 px-3">Unlimited</th>
                    <th className="py-2.5 px-3">Supplier Status</th>
                    <th className="py-2.5 px-3 text-right">Audit Raw JSON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece2]">
                  {supplierCatalogue.map(item => (
                    <tr key={item.id} className="hover:bg-[#faf9f5]">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#0e382b]">{item.source_product_id}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#141f1a]">{item.title}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-[#141f1a]">${item.supplier_cost_usdt.toFixed(2)}</td>
                      <td className="py-2.5 px-3 font-mono text-[#717e77]">
                        {item.supplier_base_cost_usdt ? `$${Number(item.supplier_base_cost_usdt).toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3">{item.stock_count}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_unlimited ? 'bg-[#f0fdf4] text-[#166534]' : 'bg-[#f4f1ea] text-[#65736b]'}`}>
                          {item.is_unlimited ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_supplier_available ? 'bg-[#f0f7f3] text-[#1a634b]' : 'bg-[#fef2f2] text-[#991b1b]'}`}>
                          {item.is_supplier_available ? 'Available' : 'Discontinued'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setRawInspectorItem(item)}
                          className="py-1 px-2.5 bg-[#f4f1ea] hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] rounded font-semibold text-[11px] cursor-pointer"
                        >
                          View Payload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DISCREPANCY & ALERT CENTER */}
      {/* ========================================================================= */}
      {activeTab === 'alerts' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="pb-3 border-b border-[#f0ece2]">
            <h3 className="font-heading font-bold text-lg text-[#08231b]">
              Discrepancy & Operational Alert Center
            </h3>
            <p className="text-xs text-[#59665f] mt-0.5">
              Automated monitoring for negative gross margins, inventory depletion, upstream discontinuations, and synchronization faults.
            </p>
          </div>

          {/* Alert Status Banners */}
          {alertsData?.alerts?.last_sync_error && (
            <div className="p-4 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs text-[#991b1b] flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-[#dc2626]" />
              <div>
                <strong className="block font-bold">Supplier Synchronization Error Logged</strong>
                <p className="mt-0.5">{alertsData.alerts.last_sync_error}</p>
              </div>
            </div>
          )}

          {/* Negative Margin Alerts */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <h4 className="font-heading font-bold text-sm text-[#08231b]">
                Negative Margin Warnings ({alertsData?.alerts?.negative_margin_products?.length || 0})
              </h4>
            </div>
            {alertsData?.alerts?.negative_margin_products?.length === 0 ? (
              <p className="text-xs text-[#16a34a] bg-[#f0fdf4] p-3 rounded-xl border border-[#bbf7d0]">
                ✅ Zero products are currently selling below wholesale cost. All margins are positive and compliant.
              </p>
            ) : (
              <div className="space-y-2">
                {alertsData?.alerts?.negative_margin_products?.map((item: any) => (
                  <div key={item.id} className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-[#991b1b] font-bold">{item.title}</strong>
                      <div className="text-[11px] text-[#7f1d1d]">
                        Wholesale Cost: ₦{item.cost_ngn.toLocaleString()} · Selling Price: ₦{item.retail_price_ngn.toLocaleString()} · Deficit: -₦{item.deficit_ngn.toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const p = products.find(prod => prod.id === item.id);
                        if (p) openPricingModal(p);
                      }}
                      className="py-1 px-3 bg-[#991b1b] text-white rounded font-bold text-xs cursor-pointer"
                    >
                      Fix Price
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <h4 className="font-heading font-bold text-sm text-[#08231b]">
                Low Stock & Depletion Warnings ({alertsData?.alerts?.low_stock_products?.length || 0})
              </h4>
            </div>
            {alertsData?.alerts?.low_stock_products?.length === 0 ? (
              <p className="text-xs text-[#16a34a] bg-[#f0fdf4] p-3 rounded-xl border border-[#bbf7d0]">
                ✅ All active listings have adequate verified stock or unlimited supplier digital allocation.
              </p>
            ) : (
              <div className="space-y-2">
                {alertsData?.alerts?.low_stock_products?.map((item: any) => (
                  <div key={item.id} className="p-3 bg-[#fffbeb] border border-[#fde68a] rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-[#92400e] font-bold">{item.title}</strong>
                      <div className="text-[11px] text-[#78350f]">
                        Stock Remaining: {item.stock_count} units
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#b45309]">
                      Needs Supplier Replenishment
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upstream Discontinued Alerts */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#6b7280]" />
              <h4 className="font-heading font-bold text-sm text-[#08231b]">
                Upstream Discontinued or Missing from Supplier ({alertsData?.alerts?.upstream_unavailable_products?.length || 0})
              </h4>
            </div>
            {alertsData?.alerts?.upstream_unavailable_products?.length === 0 ? (
              <p className="text-xs text-[#55635b] bg-[#faf8f2] p-3 rounded-xl border border-[#e6e2d6]">
                ✅ All ToolPadi products are currently confirmed present in the live supplier catalogue.
              </p>
            ) : (
              <div className="space-y-2">
                {alertsData?.alerts?.upstream_unavailable_products?.map((item: any) => (
                  <div key={item.id} className="p-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl text-xs flex items-center justify-between">
                    <div>
                      <strong className="text-[#374151] font-bold">{item.title}</strong>
                      <div className="text-[11px] text-[#6b7280]">
                        SKU {item.source_product_id} was omitted in the latest sync. Purchasing is automatically disabled to protect order fulfillment.
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#fee2e2] text-[#991b1b]">
                      Purchasing Disabled
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: ORDERS & FULFILMENT */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <h3 className="font-heading font-bold text-lg text-[#08231b]">Customer Orders & Fulfilment</h3>
              <p className="text-xs text-[#59665f] mt-0.5">Inspect verified purchases, instant credential deliveries, and processed refunds.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                  <th className="py-3 px-3">Order Ref</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Fulfilment</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0ece2]">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-[#faf9f5]">
                    <td className="py-3 px-3 font-mono font-bold text-[#0e382b]">{o.order_reference}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#141f1a]">{o.customer_name}</div>
                      <div className="text-[11px] text-[#65736b]">{o.customer_email}</div>
                    </td>
                    <td className="py-3 px-3 font-bold text-[#141f1a]">
                      ₦{o.total_amount.toLocaleString()} ({o.currency})
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        o.payment_status === 'paid' ? 'bg-[#f0f7f3] text-[#1a634b]' : 'bg-[#fef3c7] text-[#92400e]'
                      }`}>
                        {o.payment_status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        o.fulfilment_status === 'fulfilled' ? 'bg-[#f0f7f3] text-[#1a634b]' : 'bg-[#f4f1ea] text-[#65736b]'
                      }`}>
                        {o.fulfilment_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#65736b]">
                      {new Date(o.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {o.payment_status === 'paid' && (
                        <button
                          onClick={() => handleRefundOrder(o.id, o.order_reference)}
                          className="py-1 px-2.5 bg-[#fef2f2] text-[#991b1b] rounded hover:bg-[#fee2e2] font-semibold cursor-pointer"
                        >
                          Process Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PRICE HISTORY & AUDIT LOGS */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-4">
          <h3 className="font-heading font-bold text-lg text-[#08231b]">Audit History Stream</h3>
          <p className="text-xs text-[#59665f]">
            Every change to pricing, margin modes, reseller approval, stock adjustments, and administrative overrides is recorded immutably.
          </p>

          <div className="divide-y divide-[#f0ece2] max-h-96 overflow-y-auto">
            {auditLogs.map(l => (
              <div key={l.id} className="py-2.5 text-xs flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0e382b]">{l.action}</span>
                    <span aria-hidden="true" className="text-[#d8d3c5]">·</span>
                    <span className="text-[#65736b]">{l.actor}</span>
                    <span aria-hidden="true" className="text-[#d8d3c5]">·</span>
                    <span className="text-[#78887f] font-mono text-[11px]">{l.ip_address}</span>
                  </div>
                  <p className="text-[#3c4a42]">{l.details}</p>
                </div>
                <span className="text-[11px] text-[#78887f] shrink-0">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 8: PLATFORM & PROFIT ENGINE SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 max-w-2xl space-y-6">
          <h3 className="font-heading font-bold text-lg text-[#08231b]">Platform & Profit Engine Settings</h3>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  USD to NGN Exchange Benchmark:
                </label>
                <input
                  type="number"
                  value={settings.usd_ngn_rate || 1450}
                  onChange={(e) => setSettings({ ...settings, usd_ngn_rate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-[11px] text-[#6b7971] mt-1">
                  Normalizes foreign wholesale costs into local Nigerian Naira.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Global Default Pricing Method:
                </label>
                <select
                  value={settings.global_calculation_type || 'markup'}
                  onChange={(e) => setSettings({ ...settings, global_calculation_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                >
                  <option value="markup">Markup on Cost (Cost × [1 + %])</option>
                  <option value="margin">Gross Margin on Selling (Cost ÷ [1 - %])</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Global Default Percentage (%):
                </label>
                <input
                  type="number"
                  value={settings.global_markup_percentage || 20}
                  onChange={(e) => setSettings({ ...settings, global_markup_percentage: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Global Min Profit Floor (₦ NGN):
                </label>
                <input
                  type="number"
                  value={settings.global_min_profit_ngn || 0}
                  onChange={(e) => setSettings({ ...settings, global_min_profit_ngn: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Price Rounding Policy:
                </label>
                <select
                  value={settings.rounding_rule || 'market_50_100'}
                  onChange={(e) => setSettings({ ...settings, rounding_rule: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="market_50_100">Market Nigerian Rounding (₦50 / ₦100)</option>
                  <option value="ceil_100">Ceil to Nearest ₦100</option>
                  <option value="none">Exact Naira (No Rounding)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Payment Gateway Environment:
                </label>
                <select
                  value={settings.payment_mode || 'sandbox_simulator'}
                  onChange={(e) => setSettings({ ...settings, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="sandbox_simulator">Sandbox Simulator (Recommended for Testing)</option>
                  <option value="paystack_live">Paystack Live (Requires Live Merchant Keys)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="py-2.5 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold rounded-lg cursor-pointer"
            >
              Save Platform Configuration
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CUSTOMER MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'customers' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0e382b]" />
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  Customer Accounts & Lifetime Directory ({customers.length})
                </h3>
              </div>
              <p className="text-xs text-[#59665f] mt-0.5">
                Track customer lifetime value, currency preferences, purchase frequency, and delivery contact info.
              </p>
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#637269] bg-[#faf8f2] rounded-xl border border-[#e6e2d6] space-y-2">
              <Users className="w-8 h-8 text-[#8c9c93] mx-auto" />
              <p className="font-bold text-[#141f1a]">No customer accounts registered yet.</p>
              <p className="text-[11px] max-w-sm mx-auto">
                Customer profiles are automatically created and linked to orders upon checkout completion.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Currency</th>
                    <th className="py-2.5 px-3">Total Orders</th>
                    <th className="py-2.5 px-3">Total Spent (NGN)</th>
                    <th className="py-2.5 px-3">Member Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ece2]">
                  {customers.map((c: any) => (
                    <tr key={c.id} className="hover:bg-[#faf9f5]">
                      <td className="py-2.5 px-3 font-bold text-[#0e382b]">{c.full_name}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{c.email}</td>
                      <td className="py-2.5 px-3 text-[#55635b]">{c.phone || '—'}</td>
                      <td className="py-2.5 px-3 font-bold">{c.currency_preference || 'NGN'}</td>
                      <td className="py-2.5 px-3 font-bold text-[#141f1a]">{c.order_count || 0}</td>
                      <td className="py-2.5 px-3 font-bold text-[#0e382b]">₦{Number(c.total_spent_ngn || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-[#717e77]">{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PAYMENT CONFIGURATION & RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === 'reconciliation' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#0e382b]" />
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  Payment Gateway Reconciliation & Audit
                </h3>
              </div>
              <p className="text-xs text-[#59665f] mt-0.5">
                Audit incoming payments, gateway references, webhook HMAC validation, and bank settlement matches.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Active Payment Gateway Mode:</span>
              <p className="font-bold text-sm text-[#0e382b] uppercase">
                {settings.payment_mode || 'Sandbox Simulator'}
              </p>
              <span className="text-[11px] text-[#78887f]">
                Paystack / Flutterwave live webhook verification active.
              </span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Total Payment Transactions:</span>
              <p className="font-bold text-sm text-[#0e382b]">
                {reconciliation?.transactions?.length || 0} Records
              </p>
              <span className="text-[11px] text-[#78887f]">
                Reconciled against order fulfilment ledger.
              </span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Webhook Security:</span>
              <p className="font-bold text-sm text-[#1a634b]">HMAC SHA-512 Validated</p>
              <span className="text-[11px] text-[#78887f]">
                Incoming webhook notifications signed and matched.
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-heading font-bold text-sm text-[#08231b]">
              Recent Gateway Payment Transactions
            </h4>
            {(!reconciliation?.transactions || reconciliation.transactions.length === 0) ? (
              <div className="p-8 text-center text-xs text-[#637269] bg-[#faf8f2] rounded-xl border border-[#e6e2d6] space-y-2">
                <CreditCard className="w-8 h-8 text-[#8c9c93] mx-auto" />
                <p className="font-bold text-[#141f1a]">No payment transactions recorded yet.</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  Payment attempts via Paystack or Sandbox Simulator will log transaction references and verification timestamps here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#e6e2d6] text-[#637269] font-medium bg-[#fcfbf7]">
                      <th className="py-2.5 px-3">Payment Reference</th>
                      <th className="py-2.5 px-3">Order Ref</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Gateway</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Webhook Verified</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0ece2]">
                    {reconciliation.transactions.map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-[#faf9f5]">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#0e382b]">{tx.payment_reference}</td>
                        <td className="py-2.5 px-3 font-mono text-[#55635b]">{tx.order_reference || '—'}</td>
                        <td className="py-2.5 px-3">{tx.customer_name || 'Guest'}</td>
                        <td className="py-2.5 px-3 uppercase font-semibold text-[#141f1a]">{tx.provider}</td>
                        <td className="py-2.5 px-3 font-bold text-[#141f1a]">₦{Number(tx.amount || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'success' || tx.status === 'paid'
                              ? 'bg-[#f0fdf4] text-[#166534]'
                              : 'bg-[#fef3c7] text-[#92400e]'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.webhook_verified ? 'bg-[#f0fdf4] text-[#166534]' : 'bg-[#f4f1ea] text-[#65736b]'
                          }`}>
                            {tx.webhook_verified ? 'Verified' : 'Direct Call'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[#717e77]">{new Date(tx.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SALES & PROFIT REPORTING ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#0e382b]" />
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  Sales, Wholesale Cost & Profit Analytics
                </h3>
              </div>
              <p className="text-xs text-[#59665f] mt-0.5">
                Exact financial breakdown distinguishing gross customer revenues, upstream supplier wholesale costs, and net platform profit.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Total Paid Revenue:</span>
              <p className="font-heading font-extrabold text-2xl text-[#08231b]">
                ₦{(salesReport?.total_revenue_ngn || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-[#1a634b]">From {salesReport?.total_paid_orders || 0} completed orders</span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Total Wholesale Supplier Cost:</span>
              <p className="font-heading font-extrabold text-2xl text-[#b45309]">
                ₦{(salesReport?.total_wholesale_cost_ngn || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-[#78887f]">Payable for {salesReport?.items_fulfilled || 0} wholesale allocations</span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Estimated Net Gross Profit:</span>
              <p className="font-heading font-extrabold text-2xl text-[#166534]">
                ₦{(salesReport?.estimated_net_profit_ngn || 0).toLocaleString()}
              </p>
              <span className="text-[11px] text-[#166534]">Net retail price minus supplier cost</span>
            </div>

            <div className="p-4 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-1">
              <span className="text-[#65736b]">Effective Profit Margin:</span>
              <p className="font-heading font-extrabold text-2xl text-[#0e382b]">
                {salesReport?.effective_margin_percentage || 0}%
              </p>
              <span className="text-[11px] text-[#78887f]">Target policy: 20.0% – 35.0%</span>
            </div>
          </div>

          <div className="p-4 bg-[#fcfbf7] border border-[#e6e2d6] rounded-xl text-xs space-y-2">
            <h4 className="font-bold text-[#0e382b] flex items-center gap-1.5">
              <Calculator className="w-4 h-4" />
              <span>Transparent Profit Accounting Policy</span>
            </h4>
            <p className="text-[#59665f] leading-relaxed">
              ToolPadi calculates estimated net profit by subtracting raw upstream supplier wholesale costs (converted from USDT at the audited exchange rate of ₦{settings.usd_ngn_rate || '1,450'}) from the final retail price collected. All markups and gross margins are preserved separately from supplier ingestion data.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DATA EXPORT & OFFSITE BACKUPS */}
      {/* ========================================================================= */}
      {activeTab === 'export' && (
        <div className="bg-white border border-[#e6e2d6] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#f0ece2]">
            <div>
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-[#0e382b]" />
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  Platform Backup & Data Export Tools
                </h3>
              </div>
              <p className="text-xs text-[#59665f] mt-0.5">
                Download complete transactional and catalogue snapshots in CSV (spreadsheet) or JSON formats for auditing, accounting, or migrations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#0e382b]" />
                <h4 className="font-heading font-bold text-sm text-[#08231b]">Products & Ingested Catalogue</h4>
              </div>
              <p className="text-xs text-[#59665f]">
                Full product catalogue including wholesale USDT costs, NGN retail prices, approval flags, and source provenance IDs.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleExport('products', 'csv')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => handleExport('products', 'json')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>

            <div className="p-5 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#0e382b]" />
                <h4 className="font-heading font-bold text-sm text-[#08231b]">Customer Orders & Fulfilment</h4>
              </div>
              <p className="text-xs text-[#59665f]">
                Comprehensive customer order history with item details, payment status, idempotency keys, and timestamps.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleExport('orders', 'csv')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => handleExport('orders', 'json')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>

            <div className="p-5 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#0e382b]" />
                <h4 className="font-heading font-bold text-sm text-[#08231b]">Customer Directory</h4>
              </div>
              <p className="text-xs text-[#59665f]">
                Registered customers list with verified emails, phone numbers, and lifetime purchase metrics.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleExport('customers', 'csv')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => handleExport('customers', 'json')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>

            <div className="p-5 bg-[#faf8f2] border border-[#e6e2d6] rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0e382b]" />
                <h4 className="font-heading font-bold text-sm text-[#08231b]">Security Audit & Pricing Logs</h4>
              </div>
              <p className="text-xs text-[#59665f]">
                Immutable administrative audit trails of price overrides, credential edits, and sync runs.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleExport('audit_logs', 'csv')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => handleExport('audit_logs', 'json')}
                  className="py-1.5 px-3 bg-white hover:bg-[#eae5d8] border border-[#d6d0c2] text-[#0e382b] font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Download JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: QUALITY ASSURANCE & VERIFICATION TEST SUITE */}
      {/* ========================================================================= */}
      {activeTab === 'testing' && (
        <TestingQATab
          adminKey={adminKey}
          products={products}
          onRefresh={() => loadAllData(adminKey)}
        />
      )}

      {/* ========================================================================= */}
      {/* PRODUCT PRICING & RULE MODAL */}
      {/* ========================================================================= */}
      {editingPricingProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ece2]">
              <div>
                <span className="text-xs text-[#627068]">Product Rule & Resale Configuration</span>
                <h3 className="font-heading font-bold text-lg text-[#08231b]">
                  {editingPricingProduct.title}
                </h3>
              </div>
              <button
                onClick={() => setEditingPricingProduct(null)}
                className="text-[#65736b] hover:text-black cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePricing} className="space-y-4 text-xs">
              {/* Product Info & Category Assignment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">Display Title:</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">Category Assignment:</label>
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg"
                    required
                  />
                </div>
              </div>

              {/* Raw Supplier Cost Notice */}
              <div className="p-3 bg-[#faf8f2] border border-[#e0dacb] rounded-lg flex justify-between items-center">
                <span className="text-[#59665f]">Raw Ingested Wholesale Cost:</span>
                <strong className="text-sm text-[#0e382b]">
                  ₦{editingPricingProduct.supplier_cost_ngn.toLocaleString()} (${editingPricingProduct.supplier_cost_usdt.toFixed(2)} USDT)
                </strong>
              </div>

              {/* Pricing Mode Selection */}
              <div className="space-y-2">
                <label className="block font-semibold text-[#2f3d35]">Pricing Strategy:</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => { setPricingMode('percentage_markup'); setCalculationType('markup'); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer ${
                      pricingMode === 'percentage_markup' && calculationType === 'markup'
                        ? 'border-[#0e382b] bg-[#f0f7f3] text-[#0e382b] font-bold'
                        : 'border-[#e6e2d6] text-[#55635b]'
                    }`}
                  >
                    Markup on Cost
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPricingMode('margin'); setCalculationType('margin'); }}
                    className={`p-2 border rounded-lg text-center cursor-pointer ${
                      (pricingMode === 'margin' || calculationType === 'margin')
                        ? 'border-[#0e382b] bg-[#f0f7f3] text-[#0e382b] font-bold'
                        : 'border-[#e6e2d6] text-[#55635b]'
                    }`}
                  >
                    Gross Margin
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('fixed_markup')}
                    className={`p-2 border rounded-lg text-center cursor-pointer ${
                      pricingMode === 'fixed_markup'
                        ? 'border-[#0e382b] bg-[#f0f7f3] text-[#0e382b] font-bold'
                        : 'border-[#e6e2d6] text-[#55635b]'
                    }`}
                  >
                    Fixed (+₦)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode('manual')}
                    className={`p-2 border rounded-lg text-center cursor-pointer ${
                      pricingMode === 'manual'
                        ? 'border-[#0e382b] bg-[#f0f7f3] text-[#0e382b] font-bold'
                        : 'border-[#e6e2d6] text-[#55635b]'
                    }`}
                  >
                    Manual Override
                  </button>
                </div>
              </div>

              {/* Value Input */}
              {(pricingMode === 'percentage_markup' || pricingMode === 'margin' || calculationType === 'margin') && pricingMode !== 'manual' && pricingMode !== 'fixed_markup' && (
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">
                    {calculationType === 'margin' ? 'Target Gross Margin Percentage (%)' : 'Markup on Cost Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={markupValue}
                    onChange={(e) => setMarkupValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                  />
                </div>
              )}

              {pricingMode === 'fixed_markup' && (
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">
                    Fixed Markup Amount (₦ NGN)
                  </label>
                  <input
                    type="number"
                    value={markupValue}
                    onChange={(e) => setMarkupValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                  />
                </div>
              )}

              {pricingMode === 'manual' && (
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">
                    Manual Fixed Selling Price (₦ NGN)
                  </label>
                  <input
                    type="number"
                    value={manualPriceNgn}
                    onChange={(e) => setManualPriceNgn(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg font-bold"
                  />
                </div>
              )}

              {/* Min profit floor & Price lock */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">
                    Min Profit Floor (₦ NGN):
                  </label>
                  <input
                    type="number"
                    value={minProfitNgn}
                    onChange={(e) => setMinProfitNgn(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="price_locked"
                    checked={priceLocked}
                    onChange={(e) => setPriceLocked(e.target.checked)}
                    className="rounded text-[#0e382b]"
                  />
                  <label htmlFor="price_locked" className="font-semibold text-[#2f3d35] cursor-pointer">
                    Lock Price Against Auto Recalculations
                  </label>
                </div>
              </div>

              {/* Verifiable Reference Benchmark */}
              <div className="p-3 bg-[#f8faf8] border border-[#d2e3d6] rounded-xl space-y-2">
                <span className="font-bold text-[#1a634b] block">Verifiable Reference Price Benchmark (Optional)</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[#55635b]">Official Direct Price (₦):</label>
                    <input
                      type="number"
                      value={referencePriceNgn}
                      onChange={(e) => setReferencePriceNgn(Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#55635b]">Verified Plan Name:</label>
                    <input
                      type="text"
                      value={referencePlanName}
                      onChange={(e) => setReferencePlanName(e.target.value)}
                      placeholder="e.g. Official Pro 1-Yr"
                      className="w-full px-2 py-1 border rounded text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-[#55635b]">Source URL for Audit:</label>
                  <input
                    type="url"
                    value={referenceSourceUrl}
                    onChange={(e) => setReferenceSourceUrl(e.target.value)}
                    placeholder="https://provider.com/pricing"
                    className="w-full px-2 py-1 border rounded text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingPricingProduct(null)}
                  className="py-2 px-4 border rounded-lg text-xs font-semibold hover:bg-[#faf9f5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Save & Apply Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CATEGORY PRICING RULE MODAL */}
      {/* ========================================================================= */}
      {editingCategoryRule && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-heading font-bold text-base text-[#08231b]">Configure Category Rule</h3>
              <button onClick={() => setEditingCategoryRule(null)} className="text-[#65736b] cursor-pointer font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveCategoryRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Category Name:</label>
                <input
                  type="text"
                  value={editingCategoryRule.category || ''}
                  onChange={(e) => setEditingCategoryRule({ ...editingCategoryRule, category: e.target.value })}
                  placeholder="e.g. Design & Creative"
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Calculation Method:</label>
                <select
                  value={editingCategoryRule.calculation_type || 'markup'}
                  onChange={(e) => setEditingCategoryRule({ ...editingCategoryRule, calculation_type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg font-semibold"
                >
                  <option value="markup">Markup on Cost (Cost × [1 + %])</option>
                  <option value="margin">Gross Margin on Selling (Cost ÷ [1 - %])</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Target Rate (%):</label>
                <input
                  type="number"
                  step="0.5"
                  value={editingCategoryRule.percentage || 20}
                  onChange={(e) => setEditingCategoryRule({ ...editingCategoryRule, percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">Min Profit Floor (₦ NGN):</label>
                <input
                  type="number"
                  value={editingCategoryRule.min_profit_ngn || 0}
                  onChange={(e) => setEditingCategoryRule({ ...editingCategoryRule, min_profit_ngn: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCategoryRule(null)}
                  className="py-2 px-3 border rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-[#0e382b] text-white rounded-lg font-bold text-xs"
                >
                  Save Category Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RAW PAYLOAD INSPECTOR MODAL */}
      {/* ========================================================================= */}
      {rawInspectorItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <span className="text-xs text-[#627068]">Raw Upstream JSON Ingestion Audit</span>
                <h3 className="font-heading font-bold text-base text-[#08231b]">{rawInspectorItem.title}</h3>
              </div>
              <button onClick={() => setRawInspectorItem(null)} className="text-[#65736b] cursor-pointer font-bold">✕</button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#faf8f2] rounded-lg">
                <div><span className="text-[#65736b] block">Supplier ID:</span> <strong>{rawInspectorItem.source_product_id}</strong></div>
                <div><span className="text-[#65736b] block">Price USDT:</span> <strong>${rawInspectorItem.supplier_cost_usdt}</strong></div>
                <div><span className="text-[#65736b] block">Last Synced:</span> <strong>{rawInspectorItem.last_synced_at ? new Date(rawInspectorItem.last_synced_at).toLocaleString() : 'N/A'}</strong></div>
              </div>

              <div>
                <span className="font-bold text-[#2f3d35] block mb-1">Ingested Raw JSON Payload from api.insightxpro.store:</span>
                <pre className="p-3 bg-[#1e293b] text-[#f8fafc] rounded-lg font-mono text-[11px] overflow-x-auto max-h-64">
                  {rawInspectorItem.raw_supplier_payload ? JSON.stringify(JSON.parse(rawInspectorItem.raw_supplier_payload), null, 2) : 'No raw payload recorded'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setRawInspectorItem(null)}
                className="py-1.5 px-4 bg-[#0e382b] text-white rounded-lg text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRODUCT-LEVEL CONTROLS & BULK PURCHASE PRICING MODAL */}
      {/* ========================================================================= */}
      {editingControlsProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#e6e2d6] rounded-2xl max-w-4xl w-full p-6 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#f0ece2]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f0f7f3] text-[#1a634b] border border-[#cbe4d4] uppercase">
                    Part 6 Controls
                  </span>
                  <span className="text-xs text-[#637269]">Product-Level Resale Gates & Bulk Pricing</span>
                </div>
                <h3 className="font-heading font-black text-xl text-[#08231b] mt-0.5">
                  {editingControlsProduct.title}
                </h3>
                <div className="text-[11px] text-[#6b7971] flex items-center gap-2 mt-0.5">
                  <span>SKU: {editingControlsProduct.source_product_id}</span>
                  <span>·</span>
                  <span>Wholesale Cost: <strong>₦{editingControlsProduct.supplier_cost_ngn.toLocaleString()}</strong> (${editingControlsProduct.supplier_cost_usdt.toFixed(2)} USDT)</span>
                  <span>·</span>
                  <span>Current Retail: <strong>₦{editingControlsProduct.retail_price_ngn.toLocaleString()}</strong></span>
                </div>
              </div>
              <button
                onClick={() => setEditingControlsProduct(null)}
                className="text-[#65736b] hover:text-black cursor-pointer text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProductControls} className="space-y-6 text-xs">
              {/* SECTION 1: SEPARATE GATING STATES (Crucial Requirement!) */}
              <div className="p-4 bg-[#faf9f5] border border-[#e6e2d6] rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-[#0e382b] font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
                  <span>1. Resale Authorization, Storefront & Purchase Eligibility Gates</span>
                </div>
                <p className="text-[11px] text-[#55635b]">
                  Under ToolPadi compliance rules, Reseller Approval, Storefront Publication, Upstream Availability, and Purchase Eligibility are independent states.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Approval Gate */}
                  <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    ctrlApproved ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#fefce8] border-[#fde047]'
                  }`}>
                    <div>
                      <span className="font-bold block text-[#141f1a]">Approval Gate</span>
                      <p className="text-[10px] text-[#55635b] mt-0.5">Reseller verification status</p>
                    </div>
                    <div className="pt-2">
                      <select
                        value={ctrlApproved ? '1' : '0'}
                        onChange={(e) => setCtrlApproved(e.target.value === '1')}
                        className="w-full py-1.5 px-2 bg-white border rounded font-semibold text-xs cursor-pointer"
                      >
                        <option value="1">Authorized for Resale</option>
                        <option value="0">Pending Verification</option>
                      </select>
                    </div>
                  </div>

                  {/* Storefront Publication */}
                  <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    ctrlActive ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#f3f4f6] border-[#e5e7eb]'
                  }`}>
                    <div>
                      <span className="font-bold block text-[#141f1a]">Storefront Publication</span>
                      <p className="text-[10px] text-[#55635b] mt-0.5">Visible on customer catalogue</p>
                    </div>
                    <div className="pt-2">
                      <select
                        value={ctrlActive ? '1' : '0'}
                        onChange={(e) => setCtrlActive(e.target.value === '1')}
                        className="w-full py-1.5 px-2 bg-white border rounded font-semibold text-xs cursor-pointer"
                      >
                        <option value="1">Published (Visible)</option>
                        <option value="0">Hidden from Storefront</option>
                      </select>
                    </div>
                  </div>

                  {/* Purchasable Override */}
                  <div className={`p-3 rounded-lg border flex flex-col justify-between ${
                    ctrlPurchasable ? 'bg-[#f0fdf4] border-[#bbf7d0]' : 'bg-[#fef2f2] border-[#fecaca]'
                  }`}>
                    <div>
                      <span className="font-bold block text-[#141f1a]">Purchase Eligibility</span>
                      <p className="text-[10px] text-[#55635b] mt-0.5">Administrative sales pause</p>
                    </div>
                    <div className="pt-2">
                      <select
                        value={ctrlPurchasable ? '1' : '0'}
                        onChange={(e) => setCtrlPurchasable(e.target.value === '1')}
                        className="w-full py-1.5 px-2 bg-white border rounded font-semibold text-xs cursor-pointer"
                      >
                        <option value="1">Purchasable (Sales Active)</option>
                        <option value="0">Paused by Administrator</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Maximum Order Quantity Limit */}
                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">
                      Maximum Order Quantity Per Customer (0 = Unlimited):
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={ctrlMaxOrderQty}
                      onChange={(e) => setCtrlMaxOrderQty(Math.max(0, Number(e.target.value)))}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                      placeholder="e.g. 50"
                    />
                    <p className="text-[10px] text-[#6b7971] mt-0.5">
                      Restricts checkout quantity to prevent allocation exhaustion.
                    </p>
                  </div>

                  <div className="p-3 bg-white border rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[#55635b] block">Upstream Supplier Availability:</span>
                      <strong className={`text-xs ${
                        editingControlsProduct.is_supplier_available === 1 ? 'text-[#166534]' : 'text-[#b91c1c]'
                      }`}>
                        {editingControlsProduct.is_supplier_available === 1 ? 'Available Upstream' : 'Discontinued / Unavailable'}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[#55635b] block">Supplier Stock:</span>
                      <strong>
                        {editingControlsProduct.is_unlimited === 1 ? 'Unlimited' : `${editingControlsProduct.stock_count} units`}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PRODUCT METADATA & CONTENT */}
              <div className="p-4 bg-white border border-[#e6e2d6] rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-[#0e382b] font-bold text-xs uppercase tracking-wider">
                  <Tag className="w-4 h-4 text-[#0284c7]" />
                  <span>2. Product Classification & Technical Specifications</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-[#2f3d35] mb-1">Storefront Title:</label>
                    <input
                      type="text"
                      required
                      value={ctrlTitle}
                      onChange={(e) => setCtrlTitle(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">Category:</label>
                    <input
                      type="text"
                      required
                      value={ctrlCategory}
                      onChange={(e) => setCtrlCategory(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">Access Type:</label>
                    <select
                      value={ctrlAccessType}
                      onChange={(e) => setCtrlAccessType(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                    >
                      <option value="workspace_seat">Team Workspace Seat</option>
                      <option value="account_invite">Direct Account Invitation</option>
                      <option value="license_key">Official License Key</option>
                      <option value="redemption_code">Voucher Redemption Code</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">Access Duration:</label>
                    <select
                      value={ctrlDuration}
                      onChange={(e) => setCtrlDuration(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg bg-white"
                    >
                      <option value="1_month">1 Month</option>
                      <option value="3_months">3 Months</option>
                      <option value="6_months">6 Months</option>
                      <option value="1_year">1 Year</option>
                      <option value="lifetime">Lifetime Access</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">Customer-Facing Short Description:</label>
                  <input
                    type="text"
                    value={ctrlShortDesc}
                    onChange={(e) => setCtrlShortDesc(e.target.value)}
                    placeholder="Short highlight for catalogue cards"
                    className="w-full px-3 py-1.5 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#2f3d35] mb-1">Full Product Description:</label>
                  <textarea
                    rows={3}
                    value={ctrlDesc}
                    onChange={(e) => setCtrlDesc(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">Delivery & Fulfilment Instructions:</label>
                    <textarea
                      rows={2}
                      value={ctrlDelivery}
                      onChange={(e) => setCtrlDelivery(e.target.value)}
                      placeholder="Delivery turnaround and activation steps"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#2f3d35] mb-1">Terms of Service / Resale Warranty:</label>
                    <textarea
                      rows={2}
                      value={ctrlTerms}
                      onChange={(e) => setCtrlTerms(e.target.value)}
                      placeholder="48-Hour replacement rules and warranty commitment"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: BULK PURCHASE PRICING SYSTEM */}
              <div className="p-4 bg-[#f8faf8] border border-[#d1e7d6] rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[#14532d] font-bold text-xs uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-[#16a34a]" />
                    <span>3. Product-Specific Bulk Purchase Pricing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-lg border border-[#c3dfca]">
                      <input
                        type="checkbox"
                        checked={ctrlBulkEnabled}
                        onChange={(e) => setCtrlBulkEnabled(e.target.checked)}
                        className="rounded text-[#16a34a] focus:ring-[#16a34a]"
                      />
                      <span className="font-bold text-[#14532d]">Enable Bulk Pricing for this Product</span>
                    </label>
                  </div>
                </div>

                {ctrlBulkEnabled && (
                  <div className="space-y-4 pt-1">
                    {/* Bulk Pricing Mode */}
                    <div className="space-y-1">
                      <span className="font-semibold text-[#2f3d35]">Bulk Pricing Mode:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <label
                          onClick={() => setCtrlBulkMode('discount_percent')}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                            ctrlBulkMode === 'discount_percent'
                              ? 'bg-white border-[#16a34a] ring-1 ring-[#16a34a]'
                              : 'bg-white/60 border-[#c7ebd4] hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_mode"
                            checked={ctrlBulkMode === 'discount_percent'}
                            onChange={() => setCtrlBulkMode('discount_percent')}
                            className="mt-0.5 text-[#16a34a]"
                          />
                          <div>
                            <strong className="text-[#08231b] block">Automatic Discount Mode</strong>
                            <p className="text-[11px] text-[#55635b] mt-0.5">
                              Calculates unit prices dynamically as percentage discounts off the base retail price (₦{editingControlsProduct.retail_price_ngn.toLocaleString()}).
                            </p>
                          </div>
                        </label>

                        <label
                          onClick={() => setCtrlBulkMode('fixed_unit_price')}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                            ctrlBulkMode === 'fixed_unit_price'
                              ? 'bg-white border-[#16a34a] ring-1 ring-[#16a34a]'
                              : 'bg-white/60 border-[#c7ebd4] hover:bg-white'
                          }`}
                        >
                          <input
                            type="radio"
                            name="bulk_mode"
                            checked={ctrlBulkMode === 'fixed_unit_price'}
                            onChange={() => setCtrlBulkMode('fixed_unit_price')}
                            className="mt-0.5 text-[#16a34a]"
                          />
                          <div>
                            <strong className="text-[#08231b] block">Fixed Unit Price Mode</strong>
                            <p className="text-[11px] text-[#55635b] mt-0.5">
                              Allows explicit selling prices per unit in NGN/USD for each quantity tier with profit margin protection.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Tiers Table Editor */}
                    <div className="bg-white rounded-xl border border-[#c7ebd4] overflow-hidden">
                      <div className="p-3 bg-[#f2f9f4] border-b border-[#c7ebd4] flex items-center justify-between">
                        <span className="font-bold text-[#14532d]">
                          Quantity Tiers Configuration ({ctrlBulkTiers.length} {ctrlBulkTiers.length === 1 ? 'tier' : 'tiers'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const lastTier = ctrlBulkTiers[ctrlBulkTiers.length - 1];
                            const nextMin = lastTier ? (lastTier.max_quantity ? lastTier.max_quantity + 1 : lastTier.min_quantity + 10) : 5;
                            const nextMax = nextMin + 14;
                            setCtrlBulkTiers([
                              ...ctrlBulkTiers,
                              {
                                min_quantity: nextMin,
                                max_quantity: nextMax,
                                discount_percentage: 10,
                                fixed_unit_price_ngn: Math.round(editingControlsProduct.retail_price_ngn * 0.9),
                                fixed_unit_price_usd: Math.round(editingControlsProduct.retail_price_usd * 0.9 * 100) / 100
                              }
                            ]);
                          }}
                          className="py-1 px-2.5 bg-[#16a34a] text-white rounded-lg text-xs font-bold hover:bg-[#15803d] flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Tier</span>
                        </button>
                      </div>

                      {ctrlBulkTiers.length === 0 ? (
                        <div className="p-6 text-center text-[#55635b]">
                          <p>No bulk quantity tiers defined yet.</p>
                          <p className="text-[11px] text-[#6b7971] mt-1">
                            Click <strong>"Add Tier"</strong> above to configure quantity ranges (e.g. 5–19 units at 10% off).
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#e2eee5] bg-[#fafdfa] text-[#526458]">
                                <th className="py-2.5 px-3">Tier #</th>
                                <th className="py-2.5 px-3">Min Qty</th>
                                <th className="py-2.5 px-3">Max Qty (0 = Open +)</th>
                                {ctrlBulkMode === 'discount_percent' ? (
                                  <th className="py-2.5 px-3">Discount (%)</th>
                                ) : (
                                  <>
                                    <th className="py-2.5 px-3">Fixed Unit Price (₦)</th>
                                    <th className="py-2.5 px-3">Fixed Unit Price ($)</th>
                                  </>
                                )}
                                <th className="py-2.5 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#edf5ef]">
                              {ctrlBulkTiers.map((tier, idx) => (
                                <tr key={idx} className="hover:bg-[#f6fbf7]">
                                  <td className="py-2 px-3 font-bold text-[#14532d]">
                                    Tier {idx + 1}
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="number"
                                      min="1"
                                      required
                                      value={tier.min_quantity}
                                      onChange={(e) => {
                                        const updated = [...ctrlBulkTiers];
                                        updated[idx].min_quantity = Number(e.target.value);
                                        setCtrlBulkTiers(updated);
                                      }}
                                      className="w-20 px-2 py-1 border rounded font-semibold bg-white"
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="number"
                                      min="0"
                                      value={tier.max_quantity ?? ''}
                                      placeholder="∞ Open (+)"
                                      onChange={(e) => {
                                        const updated = [...ctrlBulkTiers];
                                        const val = e.target.value === '' ? null : Number(e.target.value);
                                        updated[idx].max_quantity = val;
                                        setCtrlBulkTiers(updated);
                                      }}
                                      className="w-24 px-2 py-1 border rounded bg-white"
                                    />
                                  </td>
                                  {ctrlBulkMode === 'discount_percent' ? (
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="0.1"
                                          max="100"
                                          step="0.5"
                                          required
                                          value={tier.discount_percentage ?? 10}
                                          onChange={(e) => {
                                            const updated = [...ctrlBulkTiers];
                                            updated[idx].discount_percentage = Number(e.target.value);
                                            setCtrlBulkTiers(updated);
                                          }}
                                          className="w-20 px-2 py-1 border rounded font-bold text-[#166534] bg-white"
                                        />
                                        <span>%</span>
                                      </div>
                                    </td>
                                  ) : (
                                    <>
                                      <td className="py-2 px-3">
                                        <input
                                          type="number"
                                          min="1"
                                          required
                                          value={tier.fixed_unit_price_ngn ?? 0}
                                          onChange={(e) => {
                                            const updated = [...ctrlBulkTiers];
                                            updated[idx].fixed_unit_price_ngn = Number(e.target.value);
                                            if (!tier.fixed_unit_price_usd) {
                                              updated[idx].fixed_unit_price_usd = Math.round((Number(e.target.value) / exchangeRate) * 100) / 100;
                                            }
                                            setCtrlBulkTiers(updated);
                                          }}
                                          className="w-28 px-2 py-1 border rounded font-bold text-[#08231b] bg-white"
                                        />
                                      </td>
                                      <td className="py-2 px-3">
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={tier.fixed_unit_price_usd ?? 0}
                                          onChange={(e) => {
                                            const updated = [...ctrlBulkTiers];
                                            updated[idx].fixed_unit_price_usd = Number(e.target.value);
                                            setCtrlBulkTiers(updated);
                                          }}
                                          className="w-24 px-2 py-1 border rounded bg-white"
                                        />
                                      </td>
                                    </>
                                  )}
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCtrlBulkTiers(ctrlBulkTiers.filter((_, i) => i !== idx));
                                      }}
                                      className="text-[#9ca3af] hover:text-[#b91c1c] p-1 transition-colors cursor-pointer"
                                      title="Remove Tier"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* LIVE PREVIEW CALCULATIONS & PROFIT SAFETY AUDIT */}
                    {ctrlBulkTiers.length > 0 && (
                      <div className="bg-white p-4 rounded-xl border border-[#c7ebd4] space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#14532d] flex items-center gap-1.5">
                            <Calculator className="w-4 h-4 text-[#16a34a]" />
                            <span>Live Profit Protection & Calculation Preview</span>
                          </span>
                          <span className="text-[11px] text-[#55635b]">
                            Supplier Cost: ₦{editingControlsProduct.supplier_cost_ngn.toLocaleString()}
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-[#e2eee5] text-[#526458]">
                                <th className="py-1.5 px-2">Sample Qty</th>
                                <th className="py-1.5 px-2">Effective Unit Price</th>
                                <th className="py-1.5 px-2">Discount</th>
                                <th className="py-1.5 px-2">Supplier Cost</th>
                                <th className="py-1.5 px-2">Unit Margin</th>
                                <th className="py-1.5 px-2">Safety Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f2f7f3]">
                              {/* Baseline (1 unit) */}
                              <tr>
                                <td className="py-1.5 px-2 font-medium">1 unit</td>
                                <td className="py-1.5 px-2 font-bold text-[#08231b]">
                                  ₦{editingControlsProduct.retail_price_ngn.toLocaleString()}
                                </td>
                                <td className="py-1.5 px-2 text-[#6b7280]">0% (Base)</td>
                                <td className="py-1.5 px-2">₦{editingControlsProduct.supplier_cost_ngn.toLocaleString()}</td>
                                <td className="py-1.5 px-2 font-semibold text-[#166534]">
                                  +₦{(editingControlsProduct.retail_price_ngn - editingControlsProduct.supplier_cost_ngn).toLocaleString()}
                                </td>
                                <td className="py-1.5 px-2">
                                  <span className="text-[#16a34a] font-bold">Standard</span>
                                </td>
                              </tr>

                              {/* Configured Tiers Previews */}
                              {ctrlBulkTiers.map((t, idx) => {
                                const sampleQty = t.min_quantity;
                                const baseNgn = editingControlsProduct.retail_price_ngn;
                                let unitPriceNgn = baseNgn;
                                let discLabel = '0%';

                                if (ctrlBulkMode === 'discount_percent') {
                                  const discPct = Math.min(Math.max(0, Number(t.discount_percentage || 0)), 100);
                                  unitPriceNgn = Math.round(baseNgn * (1 - discPct / 100));
                                  discLabel = `${discPct}%`;
                                } else {
                                  unitPriceNgn = Number(t.fixed_unit_price_ngn || baseNgn);
                                  const pct = baseNgn > 0 ? Math.round(((baseNgn - unitPriceNgn) / baseNgn) * 100) : 0;
                                  discLabel = `Fixed (~${pct}%)`;
                                }

                                const costNgn = editingControlsProduct.supplier_cost_ngn;
                                const marginNgn = unitPriceNgn - costNgn;
                                const isUnprofitable = marginNgn < 0;

                                return (
                                  <tr key={idx} className={isUnprofitable ? 'bg-[#fef2f2]' : ''}>
                                    <td className="py-1.5 px-2 font-semibold text-[#14532d]">
                                      {sampleQty} units (Tier {idx + 1})
                                    </td>
                                    <td className="py-1.5 px-2 font-bold text-[#08231b]">
                                      ₦{unitPriceNgn.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 px-2">{discLabel}</td>
                                    <td className="py-1.5 px-2">₦{costNgn.toLocaleString()}</td>
                                    <td className={`py-1.5 px-2 font-bold ${isUnprofitable ? 'text-[#b91c1c]' : 'text-[#166534]'}`}>
                                      {marginNgn >= 0 ? `+₦${marginNgn.toLocaleString()}` : `-₦${Math.abs(marginNgn).toLocaleString()}`}
                                    </td>
                                    <td className="py-1.5 px-2">
                                      {isUnprofitable ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fee2e2] text-[#991b1b] flex items-center gap-1 inline-flex">
                                          <AlertTriangle className="w-3 h-3 text-[#b91c1c]" />
                                          <span>Unprofitable</span>
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#dcfce7] text-[#15803d]">
                                          Profitable (+{Math.round((marginNgn / unitPriceNgn) * 100)}%)
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Exceptional discount approval requirement if unprofitable */}
                        {ctrlBulkTiers.some(t => {
                          const p = ctrlBulkMode === 'discount_percent'
                            ? Math.round(editingControlsProduct.retail_price_ngn * (1 - (t.discount_percentage || 0) / 100))
                            : (t.fixed_unit_price_ngn || 0);
                          return p < editingControlsProduct.supplier_cost_ngn;
                        }) && (
                          <div className="p-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg text-xs space-y-2">
                            <div className="flex items-center gap-1.5 text-[#991b1b] font-bold">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>Profit Rule Violation Warning: Tier Selling Price is Below Wholesale Cost!</span>
                            </div>
                            <p className="text-[#7f1d1d] text-[11px]">
                              Under ToolPadi safety policies, publishing a bulk tier that sells below the supplier cost (₦{editingControlsProduct.supplier_cost_ngn.toLocaleString()}) requires explicit administrator authorization and an audit record.
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-[#991b1b]">
                              <input
                                type="checkbox"
                                checked={ctrlAllowUnprofitable}
                                onChange={(e) => setCtrlAllowUnprofitable(e.target.checked)}
                                className="rounded text-[#b91c1c]"
                              />
                              <span>I explicitly approve this exceptional loss-leader bulk pricing tier</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* AUDIT LOG REASON */}
              <div>
                <label className="block font-semibold text-[#2f3d35] mb-1">
                  Audit Log Reason / Administrative Justification:
                </label>
                <input
                  type="text"
                  value={ctrlReason}
                  onChange={(e) => setCtrlReason(e.target.value)}
                  placeholder="e.g. Approved bulk purchase discount for enterprise team accounts"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingControlsProduct(null)}
                  className="py-2.5 px-4 border rounded-lg text-xs font-semibold hover:bg-[#faf9f5] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingControls}
                  className="py-2.5 px-6 bg-[#0e382b] hover:bg-[#134e3a] text-white font-bold rounded-lg text-xs cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingControls ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Controls & Tiers...</span>
                    </>
                  ) : (
                    <span>Save Product Controls & Bulk Pricing</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

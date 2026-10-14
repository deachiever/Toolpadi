import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product, CartItem, ConfigData } from '../types.js';

export interface ItemPriceInfo {
  unitPriceNgn: number;
  unitPriceUsd: number;
  totalNgn: number;
  totalUsd: number;
  totalSavingsNgn: number;
  totalSavingsUsd: number;
  discountPercent: number;
  tierLabel: string;
  isBulkApplied: boolean;
}

export function getProductEffectivePrice(
  product: Product,
  quantity: number,
  exchangeRate: number = 1450
): ItemPriceInfo {
  const baseNgn = product.retail_price_ngn;
  const baseUsd = product.retail_price_usd;
  const qty = Math.max(1, quantity);

  if (!product.bulk_pricing || !product.bulk_pricing.enabled || !product.bulk_pricing.tiers || product.bulk_pricing.tiers.length === 0) {
    return {
      unitPriceNgn: baseNgn,
      unitPriceUsd: baseUsd,
      totalNgn: baseNgn * qty,
      totalUsd: Math.round((baseUsd * qty) * 100) / 100,
      totalSavingsNgn: 0,
      totalSavingsUsd: 0,
      discountPercent: 0,
      tierLabel: 'Standard Price',
      isBulkApplied: false
    };
  }

  const sortedTiers = [...product.bulk_pricing.tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  let matchedTier = null;

  for (const t of sortedTiers) {
    const min = t.min_quantity;
    const max = t.max_quantity && t.max_quantity > 0 ? t.max_quantity : Infinity;
    if (qty >= min && qty <= max) {
      matchedTier = t;
      break;
    }
  }

  if (!matchedTier) {
    return {
      unitPriceNgn: baseNgn,
      unitPriceUsd: baseUsd,
      totalNgn: baseNgn * qty,
      totalUsd: Math.round((baseUsd * qty) * 100) / 100,
      totalSavingsNgn: 0,
      totalSavingsUsd: 0,
      discountPercent: 0,
      tierLabel: 'Standard Price',
      isBulkApplied: false
    };
  }

  let unitPriceNgn = baseNgn;
  let unitPriceUsd = baseUsd;
  let discountPercent = 0;
  let tierLabel = '';

  if (product.bulk_pricing.mode === 'discount_percent') {
    discountPercent = Math.min(Math.max(0, Number(matchedTier.discount_percentage || 0)), 100);
    unitPriceNgn = Math.round(baseNgn * (1 - discountPercent / 100));
    unitPriceUsd = Math.round((baseUsd * (1 - discountPercent / 100)) * 100) / 100;
    tierLabel = `Bulk Discount (${discountPercent}% off)`;
  } else {
    // Fixed unit price mode
    unitPriceNgn = Number(matchedTier.fixed_unit_price_ngn || baseNgn);
    unitPriceUsd = matchedTier.fixed_unit_price_usd && matchedTier.fixed_unit_price_usd > 0
      ? matchedTier.fixed_unit_price_usd
      : Math.round((unitPriceNgn / exchangeRate) * 100) / 100;
    discountPercent = baseNgn > 0
      ? Math.max(0, Math.round(((baseNgn - unitPriceNgn) / baseNgn) * 100))
      : 0;
    tierLabel = `Fixed Bulk Tier`;
  }

  const totalNgn = unitPriceNgn * qty;
  const totalUsd = Math.round((unitPriceUsd * qty) * 100) / 100;
  const standardNgn = baseNgn * qty;
  const standardUsd = Math.round((baseUsd * qty) * 100) / 100;

  return {
    unitPriceNgn,
    unitPriceUsd,
    totalNgn,
    totalUsd,
    totalSavingsNgn: Math.max(0, standardNgn - totalNgn),
    totalSavingsUsd: Math.max(0, Math.round((standardUsd - totalUsd) * 100) / 100),
    discountPercent,
    tierLabel,
    isBulkApplied: true
  };
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => boolean;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  currency: 'NGN' | 'USD';
  setCurrency: (c: 'NGN' | 'USD') => void;
  exchangeRate: number;
  config: ConfigData | null;
  totalNgn: number;
  totalUsd: number;
  totalSavingsNgn: number;
  totalSavingsUsd: number;
  itemCount: number;
  formatPrice: (ngn: number, usd: number) => string;
  getItemPrice: (item: CartItem) => ItemPriceInfo;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('toolpadi_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currency, setCurrencyState] = useState<'NGN' | 'USD'>(() => {
    try {
      const saved = localStorage.getItem('toolpadi_currency');
      return (saved === 'USD' || saved === 'NGN') ? saved : 'NGN';
    } catch {
      return 'NGN';
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(1450);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        if (data.usd_ngn_rate) {
          setExchangeRate(Number(data.usd_ngn_rate));
        }
      })
      .catch(err => console.error('Error fetching marketplace config:', err));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('toolpadi_cart', JSON.stringify(cart));
    } catch (err) {
      console.error('Failed to save cart:', err);
    }
  }, [cart]);

  const setCurrency = (c: 'NGN' | 'USD') => {
    setCurrencyState(c);
    try {
      localStorage.setItem('toolpadi_currency', c);
    } catch {}
  };

  const addToCart = (product: Product, quantity: number = 1): boolean => {
    if (!product.can_purchase) {
      alert(`Cannot add to cart: ${product.block_reason || 'Product is not available for purchase.'}`);
      return false;
    }

    const maxLimit = product.max_order_quantity && product.max_order_quantity > 0
      ? product.max_order_quantity
      : product.stock_count;

    let targetQty = Math.max(1, quantity);

    if (targetQty > maxLimit && product.is_unlimited !== 1) {
      alert(`Cannot add ${targetQty} units. Maximum available is ${maxLimit}.`);
      return false;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + targetQty;
        if (newQty > maxLimit && product.is_unlimited !== 1) {
          alert(`Cannot add more than ${maxLimit} units to your order.`);
          return prev;
        }
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: newQty } : item
        );
      } else {
        return [...prev, { product, quantity: targetQty }];
      }
    });

    setIsCartOpen(true);
    return true;
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const maxLimit = item.product.max_order_quantity && item.product.max_order_quantity > 0
            ? Math.min(item.product.stock_count, item.product.max_order_quantity)
            : item.product.stock_count;
          const clamped = item.product.is_unlimited === 1
            ? (item.product.max_order_quantity && item.product.max_order_quantity > 0 ? Math.min(quantity, item.product.max_order_quantity) : quantity)
            : Math.min(quantity, maxLimit);
          return { ...item, quantity: clamped };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getItemPrice = (item: CartItem): ItemPriceInfo => {
    return getProductEffectivePrice(item.product, item.quantity, exchangeRate);
  };

  const totalNgn = cart.reduce((sum, item) => sum + getItemPrice(item).totalNgn, 0);
  const totalUsd = cart.reduce((sum, item) => sum + getItemPrice(item).totalUsd, 0);
  const totalSavingsNgn = cart.reduce((sum, item) => sum + getItemPrice(item).totalSavingsNgn, 0);
  const totalSavingsUsd = cart.reduce((sum, item) => sum + getItemPrice(item).totalSavingsUsd, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const formatPrice = (ngn: number, usd: number): string => {
    if (currency === 'USD') {
      return `$${usd.toFixed(2)}`;
    }
    return `₦${ngn.toLocaleString()}`;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        currency,
        setCurrency,
        exchangeRate,
        config,
        totalNgn,
        totalUsd,
        totalSavingsNgn,
        totalSavingsUsd,
        itemCount,
        formatPrice,
        getItemPrice
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

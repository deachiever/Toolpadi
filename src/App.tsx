import React, { useState, useEffect } from 'react';
import { CartProvider } from './context/CartContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { CartDrawer } from './components/CartDrawer.js';
import { HomeView } from './views/HomeView.js';
import { CatalogueView } from './views/CatalogueView.js';
import { ProductDetailView } from './views/ProductDetailView.js';
import { CheckoutView } from './views/CheckoutView.js';
import { OrderConfirmationView } from './views/OrderConfirmationView.js';
import { CustomerAccountView } from './views/CustomerAccountView.js';
import { AdminView } from './views/AdminView.js';
import { SupportView } from './views/SupportView.js';
import { LegalView } from './views/LegalView.js';
import type { Product, Order, Delivery } from './types.js';

const VALID_VIEWS = ['home', 'catalogue', 'product_detail', 'checkout', 'order_confirmation', 'account', 'support', 'admin', 'terms', 'refunds', 'privacy'];

function getViewFromLocation(): string {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '').trim();
    if (hash && VALID_VIEWS.includes(hash)) {
      return hash;
    }
    const path = window.location.pathname.replace(/^\//, '').trim();
    if (path && VALID_VIEWS.includes(path)) {
      return path;
    }
  } catch {}
  return 'home';
}

export function AppContent() {
  const [currentView, setCurrentView] = useState<string>(() => getViewFromLocation());
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [confirmedDeliveries, setConfirmedDeliveries] = useState<Delivery[]>([]);
  const [supportInitialOrderRef, setSupportInitialOrderRef] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);

  // Sync with URL hash changes (back/forward, direct link #admin)
  useEffect(() => {
    const handleHashChange = () => {
      const targetView = getViewFromLocation();
      setCurrentView(targetView);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch products
  const fetchProducts = async () => {
    try {
      const resp = await fetch('/api/products');
      const data = await resp.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error('Failed to fetch catalogue:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleNavigate = (view: string, param?: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView(view);
    try {
      if (window.location.hash.replace(/^#\/?/, '') !== view) {
        window.location.hash = `#${view}`;
      }
    } catch {}
    if (param && view === 'support') {
      setSupportInitialOrderRef(param);
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView('product_detail');
  };

  const handleCheckoutSuccess = (order: Order, deliveries: Delivery[]) => {
    setConfirmedOrder(order);
    setConfirmedDeliveries(deliveries);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView('order_confirmation');
    fetchProducts(); // Refresh stock
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fbfaf6] text-[#141f1a]">
      {/* Navigation Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentView === 'home' && (
          <HomeView
            products={products}
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'catalogue' && (
          <CatalogueView
            products={products}
            onSelectProduct={handleSelectProduct}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentView === 'product_detail' && selectedProduct && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => handleNavigate('catalogue')}
            onNavigateCheckout={() => handleNavigate('checkout')}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutView
            onSuccess={handleCheckoutSuccess}
            onBack={() => handleNavigate('catalogue')}
          />
        )}

        {currentView === 'order_confirmation' && confirmedOrder && (
          <OrderConfirmationView
            order={confirmedOrder}
            deliveries={confirmedDeliveries}
            onNavigateHome={() => handleNavigate('home')}
            onNavigateSupport={() => handleNavigate('support', confirmedOrder.order_reference)}
          />
        )}

        {currentView === 'account' && (
          <CustomerAccountView
            onNavigateSupportWithOrder={(ref) => handleNavigate('support', ref)}
          />
        )}

        {currentView === 'support' && (
          <SupportView initialOrderRef={supportInitialOrderRef} />
        )}

        {currentView === 'admin' && (
          <AdminView onBackToStore={() => handleNavigate('home')} />
        )}

        {currentView === 'terms' && <LegalView initialTab="terms" />}
        {currentView === 'refunds' && <LegalView initialTab="refunds" />}
        {currentView === 'privacy' && <LegalView initialTab="privacy" />}
      </main>

      {/* Global Slide-Over Cart Drawer */}
      <CartDrawer onCheckout={() => handleNavigate('checkout')} />

      {/* Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}

import React, { useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import AccountEvents from './components/AccountEvents';
import SupportPage from './pages/SupportPage';
import CalculatorModal from './components/CalculatorModal';
import RequireAuth from './components/RequireAuth';
import HomePage from './pages/HomePage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import ProfilePage from './pages/ProfilePage';
import MasterSetupPage from './pages/MasterSetupPage';
import AdminPage from './pages/AdminPage';
import NotFoundPage from './pages/NotFoundPage';
import CallMasterPage from './pages/CallMasterPage';
import MasterWorkPage from './pages/MasterWorkPage';
import RulesPage from './pages/RulesPage';
import PricesPage from './pages/PricesPage';
import PublicMasterPage from './pages/PublicMasterPage';
import FavoritesPage from './pages/FavoritesPage';
import MasterGuidePage from './pages/MasterGuidePage';
import RecruitFlyerPage from './pages/RecruitFlyerPage';
import MasterFlyerPage from './pages/MasterFlyerPage';
import { TermsPage, PrivacyPage } from './pages/LegalPage';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCalcModal, setShowCalcModal] = useState(false);

  // Kalkulyatorda tanlangan xizmat bo'yicha ustalar ro'yxatini ochish
  const handlePickService = (service) => {
    setShowCalcModal(false);
    const params = new URLSearchParams({ spec: service.id });
    if (service.vertical !== 'home') params.set('vertical', service.vertical);
    navigate(`/?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col pb-bottom-nav print:pb-0 print:min-h-0 print:bg-snow">
      <Header onOpenCalculator={() => setShowCalcModal(true)} />

      <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/call" element={<RequireAuth roles={['client']}><CallMasterPage /></RequireAuth>} />
        <Route path="/master/work" element={<RequireAuth roles={['master']}><MasterWorkPage /></RequireAuth>} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/prices" element={<PricesPage />} />
        <Route path="/u/:slug" element={<PublicMasterPage />} />
        <Route path="/ustalar" element={<MasterGuidePage />} />
        <Route path="/ustalar/varaqa" element={<RecruitFlyerPage />} />
        <Route path="/master/varaqa" element={<RequireAuth roles={['master']}><MasterFlyerPage /></RequireAuth>} />
        <Route path="/favorites" element={<RequireAuth><FavoritesPage /></RequireAuth>} />
        <Route path="/support" element={<RequireAuth><SupportPage /></RequireAuth>} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
        <Route path="/orders/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/master/setup" element={<RequireAuth roles={['client', 'master']}><MasterSetupPage /></RequireAuth>} />
        <Route path="/master/profile" element={<RequireAuth roles={['master']}><MasterSetupPage /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPage /></RequireAuth>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </ErrorBoundary>

      <Footer />
      <BottomNav />
      <InstallPrompt />
      <Onboarding />
      <AccountEvents />

      {showCalcModal && (
        <CalculatorModal onClose={() => setShowCalcModal(false)} onPickService={handlePickService} />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import Onboarding from './components/Onboarding';
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
import { TermsPage, PrivacyPage } from './pages/LegalPage';

export default function App() {
  const navigate = useNavigate();
  const [showCalcModal, setShowCalcModal] = useState(false);

  // Kalkulyatorda tanlangan xizmat bo'yicha ustalar ro'yxatini ochish
  const handlePickService = (service) => {
    setShowCalcModal(false);
    const params = new URLSearchParams({ spec: service.id });
    if (service.vertical !== 'home') params.set('vertical', service.vertical);
    navigate(`/?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col pb-bottom-nav">
      <Header onOpenCalculator={() => setShowCalcModal(true)} />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/call" element={<RequireAuth roles={['client']}><CallMasterPage /></RequireAuth>} />
        <Route path="/master/work" element={<RequireAuth roles={['master']}><MasterWorkPage /></RequireAuth>} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/prices" element={<PricesPage />} />
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

      <Footer />
      <BottomNav />
      <InstallPrompt />
      <Onboarding />

      {showCalcModal && (
        <CalculatorModal onClose={() => setShowCalcModal(false)} onPickService={handlePickService} />
      )}
    </div>
  );
}

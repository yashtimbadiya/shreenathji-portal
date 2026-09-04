import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { AddCategoryPage, CategoriesPage, EditCategoryPage } from './pages/CategoriesPage';
import { ChallansPage, ChallanDetailPage } from './pages/ChallanPage';
import { CreateJobWorkPage } from './pages/CreateJobWorkPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobWorkDetailPage, EditJobWorkPage } from './pages/JobWorkDetailPage';
import { JobWorksPage } from './pages/JobWorksPage';
import { LoginPage } from './pages/LoginPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AddProductPage, ProductsPage, EditProductPage } from './pages/ProductsPage';
import { ReceivePage, ReceiptHistoryPage } from './pages/ReceivePage';
import { VendorDetailPage } from './pages/VendorDetailPage';
import { VendorsPage } from './pages/VendorsPage';
import { ReportsPage } from './pages/ReportsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ReferencesPage, AddReferencePage, EditReferencePage } from './pages/ReferencePage';
import { SharedVariantsPage } from './pages/SharedVariantsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/new" element={<AddCategoryPage />} />
        <Route path="categories/:id/edit" element={<EditCategoryPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<AddProductPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="products/:id/edit" element={<EditProductPage />} />
        <Route path="vendors" element={<VendorsPage />} />
        <Route path="vendors/:id" element={<VendorDetailPage />} />
        <Route path="receive">
          <Route index element={<Navigate to="new" replace />} />
          <Route path="new" element={<ReceivePage />} />
          <Route path="history" element={<ReceiptHistoryPage />} />
        </Route>
        <Route path="job-works" element={<JobWorksPage />} />
        <Route path="job-works/create" element={<CreateJobWorkPage />} />
        <Route path="job-works/:id" element={<JobWorkDetailPage />} />
        <Route path="job-works/:id/edit" element={<EditJobWorkPage />} />
        <Route path="challans" element={<ChallansPage />} />
        <Route path="challans/:id" element={<ChallanDetailPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="references" element={<ReferencesPage />} />
        <Route path="references/new" element={<AddReferencePage />} />
        <Route path="references/:id/edit" element={<EditReferencePage />} />
        <Route path="shared-variants" element={<SharedVariantsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

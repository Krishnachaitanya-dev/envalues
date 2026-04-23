import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import WhatsAppEmbeddedCallback from "./pages/WhatsAppEmbeddedCallback";
import NotFound from "./pages/NotFound";
import DashboardLayout from "./layouts/DashboardLayout";
import AdminLayout from "./layouts/AdminLayout";
import OverviewPage from "./components/dashboard/overview/OverviewPage";
import SimpleBuilderPage from "./components/dashboard/builder/SimpleBuilderPage";
import FlowBuilderPage from "./components/dashboard/builder/FlowBuilderPage";
import SettingsPage from "./components/dashboard/settings/SettingsPage";
import BillingPage from "./components/dashboard/billing/BillingPage";
import AnalyticsPage from "./components/dashboard/analytics/AnalyticsPage";
import InboxPage from "./components/dashboard/inbox/InboxPage";
import ContactsPage from "./components/dashboard/contacts/ContactsPage";
import ClientsPage from "./components/dashboard/clients/ClientsPage"
import BroadcastPage from "./components/dashboard/broadcast/BroadcastPage";
import HelpPage from "@/components/dashboard/help/HelpPage";
import AdminOverview from "./components/admin/pages/AdminOverview";
import AdminUsers from "./components/admin/pages/AdminUsers";
import AdminRevenue from "./components/admin/pages/AdminRevenue";
import AdminActivity from "./components/admin/pages/AdminActivity";
import AdminSecurity from "./components/admin/pages/AdminSecurity";
import AdminEvolution from "./components/admin/pages/AdminEvolution";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/whatsapp/embedded-callback" element={<WhatsAppEmbeddedCallback />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="builder" element={<SimpleBuilderPage />} />
            <Route path="builder/advanced" element={<FlowBuilderPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="inbox" element={<InboxPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="revenue" element={<AdminRevenue />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="security" element={<AdminSecurity />} />
            <Route path="evolution" element={<AdminEvolution />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

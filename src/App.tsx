import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Analytics from './pages/Analytics';
import ProductLists from './pages/ProductLists';
import AddProducts from './pages/AddProducts';
import EditProduct from './pages/EditProduct';
import OrderLists from './pages/OrderLists';
import OrderDetail from './pages/OrderDetail';
import AppLogs from './pages/AppLogs';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/dashboard" element={<AdminDashboard />}>
          <Route index element={<Analytics />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="products" element={<ProductLists />} />
          <Route path="products/add" element={<AddProducts />} />
          <Route path="products/edit/:id" element={<EditProduct />} />
          <Route path="orders" element={<OrderLists />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="logs" element={<AppLogs />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

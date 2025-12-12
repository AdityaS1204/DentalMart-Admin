/**
 * Admin API client for backend communication
 * 
 * In development, VITE_API_URL points to the local backend.
 * In production (Vercel), use empty string for Vercel rewrites proxy.
 */

const API_URL = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || '')  // Empty = use Vercel proxy rewrites
  : (import.meta.env.VITE_API_URL || 'http://localhost:3000');

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{ path: string[]; message: string }>;
}

/**
 * Get admin token from localStorage
 */
function getAdminToken(): string | null {
  return localStorage.getItem('adminToken');
}

/**
 * Make API request with error handling and admin auth
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = getAdminToken();
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If unauthorized, clear token and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminEmail');
        window.location.href = '/login';
      }

      return {
        success: false,
        message: data.message || data.error || 'Request failed',
        error: data.error,
        errors: data.errors,
      };
    }

    return {
      success: true,
      data: data.data || data,
      message: data.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Network error',
      error: 'Network error',
    };
  }
}

// ============================================
// Admin Auth API
// ============================================

export interface AdminUser {
  id: string;
  email: string;
  role: string;
}

export const adminAuthApi = {
  /**
   * Admin login
   */
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; admin: AdminUser }>> {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${API_URL}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        return {
          success: false,
          message: data.message || 'Login failed',
          error: data.error,
        };
      }

      // Store token from data.data (API returns { success, data: { token, admin } })
      if (data.data?.token) {
        localStorage.setItem('adminToken', data.data.token);
        localStorage.setItem('adminEmail', data.data.admin.email);
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        error: 'Network error',
      };
    }
  },

  /**
   * Get current admin info
   */
  async me(): Promise<ApiResponse<AdminUser>> {
    return apiRequest<AdminUser>('/api/admin/auth/me');
  },

  /**
   * Admin logout
   */
  async logout(): Promise<ApiResponse> {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminEmail');
    return { success: true };
  },

  /**
   * Check if admin is authenticated
   */
  isAuthenticated(): boolean {
    return !!getAdminToken();
  },
};

// ============================================
// Products API
// ============================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  basePrice?: number;
  oldPrice?: number;
  chargeTax: boolean;
  image: string;
  images: string[];
  category: string;
  status: 'draft' | 'active' | 'archived';
  inStock: boolean;
  stock: number;
  rating: number;
  reviews: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateProductData {
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  basePrice: number;
  discountedPrice?: number;
  chargeTax?: boolean;
  inStock?: boolean;
  stock?: number;
  status?: 'draft' | 'active' | 'archived';
  category: string;
  image?: string;
  images?: string[];
}

export interface UpdatePricingData {
  basePrice: number;
  discountedPrice?: number | null;
  chargeTax?: boolean;
  inStock?: boolean;
}

export const productsApi = {
  /**
   * Get all products with pagination
   */
  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<ProductsResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);

    const queryString = searchParams.toString();
    return apiRequest<ProductsResponse>(`/api/admin/products${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a single product by ID
   */
  async getProduct(id: string): Promise<ApiResponse<Product>> {
    return apiRequest<Product>(`/api/admin/products/${id}`);
  },

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductData): Promise<ApiResponse<Product>> {
    return apiRequest<Product>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a product
   */
  async updateProduct(id: string, data: Partial<CreateProductData>): Promise<ApiResponse<Product>> {
    return apiRequest<Product>(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Update product pricing only
   */
  async updatePricing(id: string, data: UpdatePricingData): Promise<ApiResponse<Product>> {
    return apiRequest<Product>(`/api/admin/products/${id}/pricing`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<ApiResponse> {
    return apiRequest(`/api/admin/products/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all categories
   */
  async getCategories(): Promise<ApiResponse<string[]>> {
    return apiRequest<string[]>('/api/admin/products/categories/list');
  },
};

// ============================================
// Upload API (Cloudinary)
// ============================================

export interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  originalName: string;
  size: number;
  mimetype: string;
}

export interface MultipleUploadResponse {
  images: UploadedImage[];
  urls: string[];
}

export const uploadApi = {
  /**
   * Upload a single image to Cloudinary
   */
  async uploadImage(file: File): Promise<ApiResponse<UploadedImage>> {
    try {
      const token = localStorage.getItem('adminToken');
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_URL}/api/admin/upload/image`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminEmail');
          window.location.href = '/login';
        }
        return {
          success: false,
          message: data.message || 'Upload failed',
          error: data.error,
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        error: 'Network error',
      };
    }
  },

  /**
   * Upload multiple images to Cloudinary
   */
  async uploadImages(files: File[]): Promise<ApiResponse<MultipleUploadResponse>> {
    try {
      const token = localStorage.getItem('adminToken');
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch(`${API_URL}/api/admin/upload/images`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminEmail');
          window.location.href = '/login';
        }
        return {
          success: false,
          message: data.message || 'Upload failed',
          error: data.error,
        };
      }

      return {
        success: true,
        data: data.data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Network error',
        error: 'Network error',
      };
    }
  },

  /**
   * Delete an image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<ApiResponse> {
    return apiRequest(`/api/admin/upload/image/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// Orders API
// ============================================

export interface OrderUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
  product?: {
    id: string;
    name: string;
    image: string;
    sku?: string;
  };
}

export interface Order {
  id: string;
  userId: string;
  total: number;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod?: string;
  paymentDetails?: any;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
  };
  tracking?: {
    carrier?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
    updates?: Array<{
      status: string;
      message: string;
      timestamp: string;
      location?: string;
    }>;
  };
  createdAt: string;
  updatedAt: string;
  user: OrderUser;
  orderItems: OrderItem[];
  userOrderCount?: number;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    totalOrders: number;
    totalRevenue: number;
  };
}

export interface OrderStats {
  statusCounts: Record<string, number>;
  totalRevenue: number;
  todayOrders: number;
  weekOrders: number;
  totalOrders: number;
}

export const ordersApi = {
  /**
   * Get all orders with pagination
   */
  async getOrders(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    startDate?: string;
    endDate?: string;
  }): Promise<ApiResponse<OrdersResponse>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);

    const queryString = searchParams.toString();
    return apiRequest<OrdersResponse>(`/api/admin/orders${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get order statistics
   */
  async getStats(): Promise<ApiResponse<OrderStats>> {
    return apiRequest<OrderStats>('/api/admin/orders/stats');
  },

  /**
   * Get a single order by ID
   */
  async getOrder(id: string): Promise<ApiResponse<Order>> {
    return apiRequest<Order>(`/api/admin/orders/${id}`);
  },

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    status: Order['status'],
    tracking?: Order['tracking']
  ): Promise<ApiResponse<Order>> {
    return apiRequest<Order>(`/api/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, tracking }),
    });
  },

  /**
   * Get orders for a specific user
   */
  async getUserOrders(userId: string): Promise<ApiResponse<Order[]>> {
    return apiRequest<Order[]>(`/api/admin/orders/user/${userId}`);
  },
};


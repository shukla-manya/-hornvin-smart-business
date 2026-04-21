/**
 * Backend REST bindings (Axios instance from ../services/api).
 * Use these for consistent paths across the app.
 */
import { api } from "../services/api";

export const authApi = {
  /** Public: which roles may self-register under current server env. */
  roles: () => api.get("/auth/roles"),
  login: (body) => api.post("/auth/login", body),
  changePassword: (body) => api.patch("/auth/password", body),
  loginOtpRequest: (email) => api.post("/auth/login-otp/request", { email }),
  loginOtpVerify: (body) => api.post("/auth/login-otp/verify", body),
  register: (body) => api.post("/auth/register", body),
  registerVerifyEmail: (body) => api.post("/auth/register/verify-email", body),
  registerResendEmailCode: (email) => api.post("/auth/register/resend-email-code", { email }),
  me: () => api.get("/auth/me"),
  profile: (body) => api.patch("/auth/profile", body),
  patchMeLocation: (body) => api.patch("/auth/me/location", body),
  forgotRequest: (email) => api.post("/auth/forgot/request", { email }),
  forgotReset: (body) => api.post("/auth/forgot/reset", body),
};

export const productsApi = {
  list: (params) => api.get("/products", { params }),
  get: (productId) => api.get(`/products/${productId}`),
  create: (body) => api.post("/products", body),
  update: (productId, body) => api.patch(`/products/${productId}`, body),
  delete: (productId) => api.delete(`/products/${productId}`),
};

export const ordersApi = {
  list: () => api.get("/orders"),
  history: () => api.get("/orders/history"),
  get: (orderId) => api.get(`/orders/${orderId}`),
  create: (body) => api.post("/orders", body),
  updateStatus: (orderId, status) => api.patch(`/orders/${orderId}/status`, { status }),
};

export const chatApi = {
  rooms: () => api.get("/chat/rooms"),
  openRoom: (withUserId) => api.post("/chat/rooms", { withUserId }),
  messages: (roomId) => api.get(`/chat/rooms/${roomId}/messages`),
  sendMessage: (roomId, body) => api.post(`/chat/rooms/${roomId}/messages`, body),
};

export const dealerLocatorApi = {
  nearby: (params) => api.get("/dealer-locator/nearby", { params }),
};

/** Super Admin — sole Hornvin `company` user with `isPlatformOwner` (server-enforced). */
export const usersApi = {
  team: () => api.get("/users/team"),
  myRetail: () => api.get("/users/my-retail"),
  workspaceSummary: () => api.get("/users/workspace-summary"),
  createRetail: (body) => api.post("/users/retail", body),
  linkDistributor: (body) => api.patch("/users/link-distributor", body),
  linkRetail: (body) => api.patch("/users/link-retail", body),
};

export const adminApi = {
  platform: () => api.get("/admin/platform"),
  analyticsSummary: () => api.get("/admin/analytics/summary"),
  users: (params) => api.get("/admin/users", { params }),
  patchUser: (userId, body) => api.patch(`/admin/users/${userId}`, body),
  createDistributor: (body) => api.post("/admin/users/distributor", body),
  createRetailAdmin: (body) => api.post("/admin/users/retail", body),
  orders: (params) => api.get("/admin/orders", { params }),
  payments: (params) => api.get("/admin/payments", { params }),
  categories: () => api.get("/admin/categories"),
  postCategory: (body) => api.post("/admin/categories", body),
  patchCategory: (categoryId, body) => api.patch(`/admin/categories/${categoryId}`, body),
  deleteCategory: (categoryId) => api.delete(`/admin/categories/${categoryId}`),
  listGlobalProducts: () => api.get("/admin/catalog/products"),
  createGlobalProduct: (body) => api.post("/admin/catalog/products", body),
  deleteGlobalProduct: (productId) => api.delete(`/admin/catalog/products/${productId}`),
};

export const invoicesApi = {
  list: () => api.get("/invoices"),
  createFromOrder: (orderId) => api.post("/invoices/from-order", { orderId }),
  updateStatus: (invoiceId, body) => api.patch(`/invoices/${invoiceId}/status`, body),
};

export const wishlistApi = {
  list: () => api.get("/wishlist"),
  status: (productId) => api.get(`/wishlist/status/${productId}`),
  add: (productId) => api.post("/wishlist", { productId }),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};

export const notificationsFeedApi = {
  list: (params) => api.get("/notifications", { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

/** Retail (garage) only — Hornvin Garage operations side. */
export const garageApi = {
  summary: () => api.get("/garage/summary"),
  inventoryList: () => api.get("/garage/inventory"),
  inventoryCreate: (body) => api.post("/garage/inventory", body),
  inventoryPatch: (id, body) => api.patch(`/garage/inventory/${id}`, body),
  inventoryDelete: (id) => api.delete(`/garage/inventory/${id}`),
  serviceList: () => api.get("/garage/service-records"),
  serviceCreate: (body) => api.post("/garage/service-records", body),
  serviceDelete: (id) => api.delete(`/garage/service-records/${id}`),
  customersList: () => api.get("/garage/customers"),
  customerCreate: (body) => api.post("/garage/customers", body),
  customerPatch: (id, body) => api.patch(`/garage/customers/${id}`, body),
  customerDelete: (id) => api.delete(`/garage/customers/${id}`),
  aiCallScript: (body) => api.post("/garage/ai-call-script", body),
  workEstimate: (body) => api.post("/garage/work-estimate", body),
};

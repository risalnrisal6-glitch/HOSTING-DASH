export interface User {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
  status: string;
  balance: number;
  coins: number;
  bonusCoins: number;
  referralCode: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ServerLimits {
  ram: number;
  swap: number;
  disk: number;
  io: number;
  cpu: number;
}

export interface ServerFeatures {
  databases: number;
  allocations: number;
  backups: number;
}

export interface Server {
  id: string;
  uuid: string;
  userId: string;
  externalId: string | null;
  name: string;
  description: string | null;
  status: "CREATING" | "RUNNING" | "OFFLINE" | "SUSPENDED" | "ERROR" | "DELETED";
  planId: string | null;
  billingCycle: string | null;
  renewsAt: string | null;
  price: number;
  locationId: string | null;
  nodeId: string | null;
  nestId: string | null;
  eggId: string | null;
  eggName: string | null;
  dockerImage: string | null;
  startup: string | null;
  environment: string;
  limits: string;
  featureLimits: string;
  allocationIds: string;
  lastStartAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  usage?: Usage | null;
}

export interface Usage {
  state: string;
  cpu: number;
  memory_bytes: number;
  disk_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  uptime_seconds: number;
  limits?: Record<string, number>;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  cycle: string;
  ram: number;
  swap: number;
  cpu: number;
  disk: number;
  databases: number;
  backups: number;
  allocations: number;
  nestId: string | null;
  eggId: string | null;
  eggName: string | null;
  dockerImage: string | null;
  locationId: string | null;
  startup: string | null;
  environment: string;
  sort: number;
  active: boolean;
}

export interface ShopItem {
  id: string;
  type: "ram" | "cpu" | "disk" | "databases" | "backups" | "allocations" | "slots";
  name: string;
  unit: string;
  price: number;
  effectivePrice: number;
  minUnits: number;
  maxPerUser: number;
  stock: number;
  discount: number;
  enabled: boolean;
}

export interface Transaction {
  id: string;
  kind: "credit" | "debit";
  currency: "AKF" | "balance";
  amount: number;
  description: string;
  refType: string | null;
  refId: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string | null;
  description: string | null;
  items: string;
  discount: number;
  paidAt: string | null;
  createdAt: string;
  promoCode?: { code: string } | null;
}

export interface Ticket {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "answered" | "closed";
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
  user?: { username: string; avatar: string | null };
}

export interface TicketMessage {
  id: string;
  userId: string;
  body: string;
  attachments: string;
  isStaff: boolean;
  isInternal: boolean;
  createdAt: string;
  user?: { username: string; avatar: string | null };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: string;
  readAt: string | null;
  createdAt: string;
}

export interface EggVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  user_editable: boolean;
  rules: string;
}

export interface EggInfo {
  id: string;
  uuid: string;
  name: string;
  description: string;
  docker_images: string[];
  startup: string;
  features: string[];
  variables: EggVariable[];
}

export interface NestInfo {
  id: string;
  uuid: string;
  name: string;
  description: string;
}

export interface FileEntry {
  name: string;
  mode: string;
  size: number;
  is_file: boolean;
  is_directory?: boolean;
  mimetype: string;
  modified_at: string;
}

export interface Allocation {
  id: string;
  serverId: string | null;
  nodeId: string | null;
  ip: string;
  port: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface SftpInfo {
  ip: string;
  port: number;
  username: string;
}

export interface Backup {
  id: string;
  name: string;
  size: number;
  locked: boolean;
  createdAt: string;
  uuid?: string;
  is_successful?: boolean;
}

export interface DatabaseEntry {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  passwordEnc?: string;
  remote: string;
  createdAt: string;
  relationships?: { password?: { attributes?: { password?: string } } };
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
}

export interface PublicConfig {
  settings: Record<string, any>;
  panelConnected: boolean;
  wheel: WheelConfig | null;
  announcements: Announcement[];
}

export interface WheelSegment {
  label: string;
  coins: number;
  weight: number;
  color: string;
}

export interface WheelConfig {
  enabled: boolean;
  cost: number;
  dailyLimit: number;
  segments: WheelSegment[];
}

export interface DashboardData {
  user: User;
  servers: Server[];
  slots: { used: number; max: number };
  transactions: Transaction[];
  notifications: Notification[];
  checkin: { dailyClaimed: boolean; weeklyClaimed: boolean; monthlyClaimed: boolean; streak: number; last7: string[] };
  announcements: Announcement[];
  settings: Record<string, any>;
  referral: any;
  stats: {
    totalServers: number;
    activeServers: number;
    offlineServers: number;
    suspendedServers: number;
    totalRam: number;
    totalCpu: number;
    totalDisk: number;
  };
}

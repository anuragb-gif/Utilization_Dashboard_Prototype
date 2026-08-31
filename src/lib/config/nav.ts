import {
  Boxes,
  Building2,
  Users,
  Sparkles,
  ChartScatter,
  Handshake,
  CalendarRange,
  ClipboardList,
  Database,
  Gauge,
  LayoutDashboard,
  Map,
  Settings,
  Snowflake,
  TrendingUp,
  Truck,
  TriangleAlert,
} from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  href: string
  icon: typeof LayoutDashboard
  description: string
  /** Shows a live count badge sourced from the snapshot. */
  badge?: 'exceptions' | 'dataQuality'
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'control-tower', label: 'Control Tower', href: '/', icon: LayoutDashboard, description: 'Network position and today’s exceptions' },
  { id: 'capacity', label: 'Capacity', href: '/capacity', icon: Gauge, description: 'Capacity, headroom and forecast risk' },
  { id: 'utilization', label: 'Utilization', href: '/utilization', icon: TrendingUp, description: 'Trend against budget and last year' },
  { id: 'weekly', label: 'Weekly', href: '/weekly', icon: CalendarRange, description: 'Week-on-week utilization comparison' },
  { id: 'regions', label: 'Regions', href: '/regions', icon: Map, description: 'Region ranking and detail' },
  { id: 'warehouses', label: 'Warehouses', href: '/warehouses', icon: Building2, description: 'Facility and location utilization' },
  { id: 'customers', label: 'Customers', href: '/customers', icon: Users, description: 'Customer-wise utilization by location and zone' },
  { id: 'park-and-pay', label: 'Park & Pay', href: '/park-and-pay', icon: Handshake, description: 'Rented space, and what it does to the network figure' },
  { id: 'inventory', label: 'Inventory', href: '/inventory', icon: Boxes, description: 'Ageing, expiry and depositor concentration' },
  { id: 'cold-chain', label: 'Cold Chain', href: '/cold-chain', icon: Snowflake, description: 'Temperature zones, compliance and FEFO' },
  { id: 'operations', label: 'Operations', href: '/operations', icon: Truck, description: 'Pallet flow and dock performance' },
  { id: 'exceptions', label: 'Exceptions', href: '/exceptions', icon: TriangleAlert, description: 'Everything requiring intervention', badge: 'exceptions' },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: ChartScatter, description: 'Where capacity sits, how it is used, what is moving' },
  { id: 'assistant', label: 'Assistant', href: '/assistant', icon: Sparkles, description: 'Ask about the current position and get the calculation with it' },
  { id: 'reports', label: 'Reports', href: '/reports', icon: ClipboardList, description: 'Report centre and the print view' },
  { id: 'data-quality', label: 'Data Quality', href: '/data-quality', icon: Database, description: 'Pipeline health and known gaps', badge: 'dataQuality' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, description: 'KPI definitions, thresholds and access' },
]

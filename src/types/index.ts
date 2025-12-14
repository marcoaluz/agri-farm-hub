// Types for the Agricultural Management System (SGA)

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role?: 'admin' | 'manager' | 'operator'
  created_at: string
}

export interface Animal {
  id: string
  tag: string
  name?: string
  species: 'bovine' | 'swine' | 'poultry' | 'equine' | 'ovine' | 'caprine'
  breed?: string
  birth_date?: string
  weight?: number
  status: 'active' | 'sold' | 'deceased' | 'quarantine'
  lot_id?: string
  created_at: string
  updated_at: string
}

export interface Lot {
  id: string
  name: string
  description?: string
  capacity: number
  current_count: number
  location?: string
  created_at: string
}

export interface HealthRecord {
  id: string
  animal_id: string
  type: 'vaccination' | 'treatment' | 'examination' | 'surgery'
  description: string
  date: string
  veterinarian?: string
  notes?: string
  created_at: string
}

export interface Production {
  id: string
  type: 'milk' | 'eggs' | 'wool' | 'meat'
  quantity: number
  unit: string
  date: string
  lot_id?: string
  notes?: string
  created_at: string
}

export interface DashboardStats {
  totalAnimals: number
  totalLots: number
  activeAlerts: number
  monthlyProduction: number
  animalsBySpecies: { species: string; count: number }[]
  productionTrend: { date: string; value: number }[]
}
